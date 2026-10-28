import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { setTimeout as delay, setImmediate as turn } from 'node:timers/promises';
import { createPglitePool } from './fixtures/pglite-pool.mjs';
import { createSharedRoomService } from '../services/game/shared-room-service.mjs';
import { installGracefulShutdown } from '../services/game/graceful-shutdown.mjs';
import { createPostgresTableStore } from '../services/game/games/blackjack/table/postgres-store.mjs';
import { DEFAULT_CONFIG } from './fixtures/blackjack-table-memory-store.mjs';

// F11 (K04 RERUN-6, K06 RERUN-2): during a Render deploy or restart the old and the new engine
// instance run side by side for about three minutes. Both runtimes tick rooms; a socket on the
// old instance used to hear only its own instance's commits and stood still for 2 min 9 s.
// Two real shared-room services (runtime, receiver, channel) share one PostgreSQL database
// (PGlite). Only session admission and the WebSocket transport are fixtures; commands, ticks,
// outbox, receiver, projection and the consistency gate are the production modules.
const origin = 'https://player.invalid', engineOrigin = 'https://engine.invalid', roomId = 'overlap-room';
const T0 = 1_800_000_000_000, LIMIT_MS = 2000;
const binding = actorId => ({ actorId, sessionId: `session-${actorId}`, operatorId: 'operator-overlap', roomId,
  packageRevision: 1, expiresAt: T0 + 3_600_000 });
const request = actorId => new Request(`${engineOrigin}/shared-room/${roomId}`, { headers: { origin, 'x-actor': actorId } });
class Socket extends EventEmitter {
  readyState = 1; bufferedAmount = 0; frames = []; closed = [];
  send(text, callback) { this.frames.push(JSON.parse(text)); callback?.(); }
  close(code, reason) { this.closed.push({ code, reason }); this.readyState = 3; this.emit('close'); }
}
async function within(ms, check, message) {
  const started = Date.now();
  while (Date.now() - started <= ms) { if (check()) return Date.now() - started; await delay(10); }
  assert.fail(`${message} (not within ${ms} ms)`);
}

function instance(pool, name) {
  const clock = { time: T0, now() { return this.time; } }, errors = [], gate = { locked: null };
  let channel;
  const service = createSharedRoomService({ pool, walletMode: 'demo', origin, engineOrigin,
    scope: { environment: 'test', workspaceId: 'overlap' }, auth: {}, commandAuth: {},
    // The service owns the outer commit; the table store opens its own transaction inside.
    repository: { sharedTransaction: work => work() },
    clock, onError: error => errors.push(error), lockTimeoutMs: 4000, statementTimeoutMs: 8000 }, {
    createAccess: () => ({
      async authorize(req) { return binding(req.headers.get('x-actor')); },
      async revalidate(value) { return value; },
      async revalidateLocked(value, { signal }) { await gate.locked?.(value, signal); },
    }),
    createUpgrade: value => { channel = value.channel; return { handleUpgrade: () => false, close: () => value.channel.close() }; },
  });
  let n = 0;
  return { name, clock, errors, gate, service,
    async attach(actorId) { const socket = new Socket(); (await channel.prepare(request(actorId))).attach(socket); return socket; },
    command(actorId, op, fields = {}, commandId = `${name}-${actorId}-${++n}`) {
      return service.command(request(actorId), { roomId, input: { roomId, commandId, op, ...fields } });
    } };
}
const last = socket => socket.frames.at(-1);

test('F11: commits by another engine instance reach this instance\'s sockets within 2 s; SIGTERM ends them with 1012 and drains commands atomically', async t => {
  const pool = await createPglitePool();
  let old, fresh, server;
  // Services and the listener stop before the database they share.
  t.after(async () => {
    await Promise.allSettled([old?.service.close(), fresh?.service.close()]);
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await pool.end();
  });
  for (const id of ['alice', 'bob']) await pool.query('INSERT INTO croupier_game.players(id,name,balance,created_at) VALUES($1,$2,$3,$4)',
    [id, `Synthetic ${id}`, 1000, '2026-10-28T00:00:00.000Z']);
  await createPostgresTableStore({ pool, walletMode: 'demo' }).config.publish(roomId, 'v1', structuredClone(DEFAULT_CONFIG));
  // old = the instance Render keeps draining; fresh = the one that has just started.
  old = instance(pool, 'old'); fresh = instance(pool, 'fresh');
  await old.service.start(); await fresh.service.start();
  const joined = await old.command('alice', 'join', { seats: [0], seatGens: { 0: 0 }, memberGen: 0 });
  await old.command('bob', 'join', { seats: [1], seatGens: { 1: 0 }, memberGen: 0 });
  const windowId = joined.snapshot.windowId;
  await old.command('alice', 'bet', { windowId, seat: 0, field: 'main', chip: 5 });
  const alice = await old.attach('alice'), bob = await old.attach('bob');
  await within(LIMIT_MS, () => alice.frames.length && bob.frames.length, 'first snapshots');
  const start = last(alice).snapshot;
  assert.equal(start.phase, 'bets'); assert.equal(start.bets[0].main, 5); assert.ok(start.deadline > T0);

  // 1. A command committed on the fresh instance: its hint goes to the fresh channel only.
  await fresh.command('bob', 'bet', { windowId, seat: 1, field: 'main', chip: 5 });
  const commandMs = await within(LIMIT_MS, () => [alice, bob].every(s => last(s).snapshot.bets[1].main === 5), 'the other instance\'s bet');
  assert.ok(last(alice).snapshot.version > start.version);

  // 2. A tick only the fresh instance runs: its clock has passed the betting deadline, the
  //    old one's has not, so the old runtime never finds it due (as when the fresh one holds the room).
  const before = last(alice).snapshot.version, framesBefore = alice.frames.length;
  fresh.clock.time = start.deadline + 1;
  const tickMs = await within(LIMIT_MS, () => [alice, bob].every(s => last(s).snapshot.phase === 'round'), 'the other instance\'s round start');
  for (const socket of [alice, bob]) {
    const frame = last(socket);
    assert.ok(frame.snapshot.version > before);
    assert.equal(frame.presentation?.ver, frame.snapshot.presentationVer, 'never a mixed-version frame: the receiver row arrived too');
  }
  assert.ok(alice.frames.length - framesBefore <= 3, 'an observation is one reread, not a stream of frames');
  // Already up to date: further passes of the old runtime send nothing new.
  const settled = alice.frames.length; await delay(700);
  assert.equal(alice.frames.length, settled, 'an unchanged room costs no frame');
  t.diagnostic(`other-instance command ${commandMs} ms, other-instance tick ${tickMs} ms`);

  // 3. Render's SIGTERM to the old instance, while one of its commands holds the room lock.
  const target = new EventEmitter(); server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const shutdown = installGracefulShutdown({ server, processTarget: target, closeRuntime: () => old.service.close() });
  let entered, release;
  const inside = new Promise(resolve => { entered = resolve; }), held = new Promise(resolve => { release = resolve; });
  old.gate.locked = async () => { entered(); await held; };
  const roomBefore = JSON.parse((await pool.query('SELECT body FROM croupier_game.shared_table_rooms WHERE room_id=$1', [roomId])).rows[0].body).version;
  const pending = old.command('alice', 'leave', { memberGen: last(alice).snapshot.me.memberGen }, 'old-inflight-leave');
  pending.catch(() => {});
  await inside;
  target.emit('SIGTERM');
  await turn();
  for (const socket of [alice, bob]) assert.deepEqual(socket.closed, [{ code: 1012, reason: 'shared_room_restart' }], 'at once, while work is still draining');
  await assert.rejects(old.command('bob', 'leave', { memberGen: 1 }), { statusCode: 503 }, 'no new command after SIGTERM');
  release();
  await assert.rejects(pending, 'the in-flight command is cancelled, not half-applied');
  assert.deepEqual(await shutdown.stop(), { completed: true });
  const receipts = await pool.query('SELECT count(*)::int AS n FROM croupier_game.shared_table_receipts WHERE room_id=$1 AND command_id=$2', [roomId, 'old-inflight-leave']);
  assert.equal(receipts.rows[0].n, 0);
  const roomAfter = JSON.parse((await pool.query('SELECT body FROM croupier_game.shared_table_rooms WHERE room_id=$1', [roomId])).rows[0].body);
  assert.equal(roomAfter.version, roomBefore, 'the cancelled command left no state');

  // 4. The client reconnects after 1012; the fresh instance answers with the same round.
  const again = await fresh.attach('alice');
  await within(LIMIT_MS, () => again.frames.length, 'snapshot after reconnect');
  assert.equal(last(again).snapshot.roundId, last(alice).snapshot.roundId);
  assert.equal(last(again).snapshot.version, roomAfter.version);
  assert.deepEqual(old.errors.concat(fresh.errors).filter(error => error?.code !== 'shared_table_room_contention'), []);
});
