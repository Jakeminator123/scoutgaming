import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { createPglitePool } from './fixtures/pglite-pool.mjs';
import { createPostgresTableStore } from '../services/game/games/blackjack/table/postgres-store.mjs';
import { createTableCoordinator, FULL_TABLE, WAIT_WRITE_AFTER_MS } from '../services/game/games/blackjack/table/coordinator.mjs';
import { LockSetExceeded } from '../services/game/games/blackjack/table/ports.mjs';
import { createSharedRoomService } from '../services/game/shared-room-service.mjs';
import { createSharedRoomCommand } from '../services/game/shared-room-command.mjs';
import { createSharedRoomCommandClient } from '../services/game/public/shared-room-command-client.mjs';
import { createSharedRoomWaiting, waitingForSeat } from '../services/game/public/shared-room-waiting.mjs';
import { DEFAULT_CONFIG } from './fixtures/blackjack-table-memory-store.mjs';
import { deterministicRandom } from './fixtures/blackjack-deterministic-random.mjs';

// K6 / P11 (docs/plans/KEVIN-PORT.md, P-C): a full table and a viewer waiting for a seat. Kevin's behaviour
// (kevin-staging K/server/shared-table.mjs 7ddb7de4, K/test/ghost-seats.test.mjs), rewritten for main's coordinator
// and run on PostgreSQL (PGlite) through the production table store, lock plans included.
const ROOM = 'full-room', T0 = 1_800_000_000_000;

async function setup(t, players = ['alice', 'bob', 'carol', 'dave']) {
  const pool = await createPglitePool();
  t.after(() => pool.end());
  for (const id of players) await pool.query('INSERT INTO croupier_game.players(id,name,balance,created_at) VALUES($1,$2,$3,$4)',
    [id, `Synthetic ${id}`, 1000, '2026-10-28T00:00:00.000Z']);
  const store = createPostgresTableStore({ pool, walletMode: 'demo' });
  await store.config.publish(ROOM, 'v1', structuredClone(DEFAULT_CONFIG));
  let time = T0, n = 0, exceeded = 0;
  const table = createTableCoordinator({ store, clock: { now: () => time }, random: deterministicRandom('k6-full-table') });
  // Every unit of work's declared lock plan, and any lock it needed outside that plan.
  const plans = [], runLocked = store.runLocked;
  store.runLocked = async (plan, work) => {
    plans.push(plan);
    try { return await runLocked(plan, work); } catch (error) { if (error instanceof LockSetExceeded) exceeded++; throw error; }
  };
  const rows = async sql => (await pool.query(sql, [ROOM])).rows.map(row => JSON.parse(row.body));
  const h = {
    pool, table, plans, get exceeded() { return exceeded; }, get time() { return time; }, set time(value) { time = value; },
    snap: (who = 'alice') => table.snapshot(ROOM, who),
    send: (who, op, fields = {}, commandId = `c${++n}`) => table.command({ actorId: who }, { roomId: ROOM, op, commandId, ...fields }),
    async join(who, seats) {
      const s = await h.snap(who);
      return h.send(who, 'join', { seats, seatGens: Object.fromEntries(seats.map(i => [i, s?.seatGen[i] ?? 0])), memberGen: s?.me.memberGen ?? 0 });
    },
    async bet(who, seat) { return h.send(who, 'bet', { seat, field: 'main', chip: 5, windowId: (await h.snap(who)).windowId }); },
    async ready(who) { return h.send(who, 'ready', { windowId: (await h.snap(who)).windowId }); },
    async drain() {
      for (let i = 0; i < 100; i++) { const due = await table.dueTicks(); if (!due.length) return; for (const d of due) await table.tick(d); }
      throw new Error('scheduler did not settle');
    },
    // Every hand stands until the round is settled (the plan's end, then the settle tick).
    async standAll() {
      for (let i = 0; i < 40; i++) {
        const s = await h.snap();
        if (s.phase === 'settled') return s;
        const hand = s.round?.hands?.[s.round.active];
        if (s.phase === 'round' && s.round.phase === 'decisions' && hand) {
          time = Math.max(time, s.plan.turnAt);
          await h.send(s.owners[hand.box], 'act', { action: 'stand', roundId: s.roundId, turnSeq: s.turnSeq, box: hand.box, handIndex: s.round.active });
          continue;
        }
        time = Math.max(time, s.plan?.endAt ?? time, s.actionDeadline ?? time); await h.drain();
      }
      throw new Error('round did not settle');
    },
    async next(who) { return h.send(who, 'next', { roundId: (await h.snap(who)).roundId }); },
    room: async () => (await rows('SELECT body FROM croupier_game.shared_table_rooms WHERE room_id=$1'))[0],
    audit: async type => (await rows('SELECT body FROM croupier_game.shared_table_audit WHERE room_id=$1 ORDER BY seq'))
      .filter(row => row.type === type).map(row => JSON.parse(row.payload)),
    member: async who => (await rows('SELECT body FROM croupier_game.shared_table_members WHERE room_id=$1')).find(m => m.actorId === who),
    idleDue: async () => (await table.dueTicks()).filter(d => d.kind === 'seat.idle').map(d => d.playerId),
    rawRoom: async () => (await pool.query('SELECT body FROM croupier_game.shared_table_rooms WHERE room_id=$1', [ROOM])).rows[0].body,
    // Another writer's room JSON (an engine without this change), straight into the row.
    async writeRoom(edit) {
      const r = await h.room(); edit(r);
      await pool.query('UPDATE croupier_game.shared_table_rooms SET body=$2 WHERE room_id=$1', [ROOM, JSON.stringify(r)]);
    },
    receipts: async who => (await pool.query('SELECT command_id FROM croupier_game.shared_table_receipts WHERE room_id=$1 AND player_id=$2 ORDER BY command_id',
      [ROOM, who])).rows.map(row => row.command_id),
  };
  return h;
}
const A = 'alice', B = 'bob';
// The fields #547 added that an engine without it never writes. Its resetRound (main before #547) gives the
// room a new windowId and leaves these as they were; a room it stored before #547 has none of them.
const NEW_FIELDS = ['windowAt', 'lastAct', 'waiting'];
async function oldEngineNext(h, who) {
  const before = await h.room();
  await h.next(who);
  await h.writeRoom(r => { for (const key of NEW_FIELDS) { if (Object.hasOwn(before, key)) r[key] = before[key]; else delete r[key]; } });
}
// alice holds boxes 0-3 and bob 4-6, every box bet on: the table is full and the round is played.
async function fullRound(h) {
  await h.join(A, [0, 1, 2, 3]); await h.join(B, [4, 5, 6]);
  for (const i of [0, 1, 2, 3]) await h.bet(A, i);
  for (const i of [4, 5, 6]) await h.bet(B, i);
  await h.ready(A); await h.ready(B);
  assert.equal((await h.snap()).phase, 'round');
}

test('the values are Kevin\'s, in one place: three boxes, a 30 s registration and 90 s without a bet', () => {
  assert.deepEqual(FULL_TABLE, { keepBoxes: 3, waitingMs: 30000, idleSeatMs: 90000 });
  assert.ok(Object.isFrozen(FULL_TABLE));
});

test('a viewer waiting at a full table leaves each player at most three boxes after the round, the ones played first; nothing leaves a round in play', async t => {
  const h = await setup(t);
  await fullRound(h);
  const full = [A, A, A, A, B, B, B];
  const during = await h.send('carol', 'wait');
  assert.equal(during.replay, false);
  assert.deepEqual(during.result, { op: 'wait', waiting: true, version: (await h.snap()).version });
  assert.deepEqual((await h.snap('carol')).owners, full, 'nothing is taken from the round in play');
  const settled = await h.standAll();
  assert.deepEqual(settled.owners, full, 'nor from the settled round before next');
  await h.send('carol', 'wait');                                // the client renews it while the table is full
  const plansBefore = h.plans.length;
  await h.next(A);
  const s = await h.snap('carol');
  assert.equal(s.phase, 'bets');
  // round.mjs deals and plays from the rightmost box, so alice's boxes were played 3, 2, 1, 0: box 0 goes.
  assert.deepEqual(s.owners, [null, A, A, A, B, B, B], 'alice keeps three boxes, bob keeps his three');
  assert.deepEqual((await h.audit('seat.release')).map(({ playerId, boxes, reason, waiting, memberEnded }) => ({ playerId, boxes, reason, waiting, memberEnded })),
    [{ playerId: A, boxes: [0], reason: 'table full', waiting: ['carol'], memberEnded: false }]);
  assert.deepEqual(h.plans.slice(plansBefore).map(p => p.players), [[A]], 'next locks only its actor: the limit ends no membership');
  assert.equal(h.exceeded, 0, 'no lock outside the plan was needed');
  assert.equal((await h.member(A)).active, true);
  const joined = await h.join('carol', [0]);
  assert.deepEqual(joined.result.seats, [0], 'the waiting viewer gets the free box');
  assert.deepEqual((await h.room()).waiting, {}, 'the reset used the registration; a viewer still waiting sends it again');
});

test('with nobody waiting every player keeps every box he played', async t => {
  const h = await setup(t);
  await fullRound(h);
  await h.standAll(); await h.next(A);
  assert.deepEqual((await h.snap()).owners, [A, A, A, A, B, B, B]);
  assert.deepEqual(await h.audit('seat.release'), []);
});

test('a registration counts for 30 s: a stale one changes nothing, a renewed one counts', async t => {
  const h = await setup(t);
  await fullRound(h);
  await h.standAll();
  await h.send('carol', 'wait');
  h.time += FULL_TABLE.waitingMs;                               // exactly 30 s later it no longer counts
  await h.next(A);
  assert.deepEqual((await h.snap()).owners, [A, A, A, A, B, B, B], 'a stale registration has no effect');
  for (const i of [0, 1, 2, 3]) await h.bet(A, i);
  for (const i of [4, 5, 6]) await h.bet(B, i);
  await h.ready(A); await h.ready(B);
  await h.standAll();
  await h.send('carol', 'wait');
  h.time += 20000; await h.send('carol', 'wait');               // renewed after 20 s
  h.time += 20000;                                              // 40 s after the first, 20 s after the renewal
  await h.next(B);
  assert.deepEqual((await h.snap()).owners, [null, A, A, A, B, B, B]);
  assert.equal(h.exceeded, 0);
});

test('wait is idempotent: a replay repeats its receipt, a renewal only moves the time, and nothing any viewer sees changes', async t => {
  const h = await setup(t);
  await h.join(A, [0, 1, 2, 3]); await h.join(B, [4, 5]);
  const notFull = await h.send('carol', 'wait');
  assert.equal(notFull.result.waiting, false, 'a table with a free box needs no wait');
  assert.equal(Object.hasOwn((await h.room()).waiting ?? {}, 'carol'), false);
  await h.join(B, [4, 5, 6]);
  const before = await h.room(), seen = await h.snap(A);
  const first = await h.send('carol', 'wait', {}, 'wait-1');
  assert.deepEqual(first.result, { op: 'wait', waiting: true, version: before.version });
  assert.equal((await h.room()).waiting.carol, h.time);
  const replay = await h.send('carol', 'wait', {}, 'wait-1');
  assert.equal(replay.replay, true); assert.deepEqual(replay.result, first.result);
  // Renewals of a registration younger than WAIT_WRITE_AFTER_MS (5 s) keep their receipts but write no room row.
  assert.equal(WAIT_WRITE_AFTER_MS, 5000);
  const firstAt = h.time, stored = await h.rawRoom();
  for (const [i, ms] of [1000, 2000, 4000, WAIT_WRITE_AFTER_MS - 1].entries()) {
    h.time = firstAt + ms;
    const renewed = await h.send('carol', 'wait', {}, `wait-burst-${i}`);
    assert.equal(renewed.replay, false); assert.deepEqual(renewed.result, first.result);
  }
  assert.equal(await h.rawRoom(), stored, 'no room write for a fresh registration');
  const at = h.time = firstAt + WAIT_WRITE_AFTER_MS;
  await h.send('carol', 'wait', {}, 'wait-2');
  const after = await h.room();
  assert.equal(after.waiting.carol, at, 'an older one is written: the renewal moves the registration');
  assert.deepEqual((await h.receipts('carol')).filter(id => id.startsWith('wait')),
    ['wait-1', 'wait-2', 'wait-burst-0', 'wait-burst-1', 'wait-burst-2', 'wait-burst-3'], 'every renewal keeps its receipt');
  assert.equal(after.version, before.version, 'the room version stays: no snapshot shows a registration');
  const { serverNow: _a, ...seenNow } = await h.snap(A), { serverNow: _b, ...seenBefore } = seen;
  assert.deepEqual(seenNow, seenBefore, 'a seated player sees nothing new');
  assert.equal((await h.audit('player.wait')).length, 1, 'the wait is audited once, not every renewal');
  const seated = await h.send(A, 'wait');
  assert.equal(seated.result.waiting, false, 'a player with a box is not waiting');
  assert.equal(Object.hasOwn((await h.room()).waiting, A), false);
  assert.deepEqual(h.plans.at(-1).players, [A], 'wait locks only its actor');
  await h.send('dave', 'pause');
  await assert.rejects(h.send('dave', 'wait'), { code: 'PAUSED' }, 'a paused account does not wait for a seat');
  assert.equal(h.exceeded, 0);
});

test('a seat holder who neither bets nor sends a command for 90 s in the betting window gives up his boxes; a bet keeps them', async t => {
  const h = await setup(t);
  await h.join(A, [0, 1]); await h.join('dave', [3]); await h.join(B, [5]);
  h.time = T0 + 60000; await h.send('dave', 'clear', { windowId: (await h.snap('dave')).windowId });   // a command restarts his clock
  h.time = T0 + 80000; await h.bet(B, 5);
  h.time = T0 + FULL_TABLE.idleSeatMs - 1;
  assert.deepEqual(await h.idleDue(), []);
  h.time = T0 + FULL_TABLE.idleSeatMs;
  const due = (await h.table.dueTicks()).filter(d => d.kind === 'seat.idle');
  assert.deepEqual(due.map(d => d.playerId), [A], 'bob has a bet and dave acted 30 s ago');
  const before = h.plans.length;
  assert.equal((await h.table.tick(due[0])).outcome, 'applied');
  assert.deepEqual(h.plans.slice(before), [{ global: false, rooms: [ROOM], players: [A] }]);
  let s = await h.snap(A);
  assert.deepEqual(s.owners, [null, null, null, 'dave', null, B, null]);
  assert.equal(s.me.active, false, 'his membership ends with his last box');
  h.time = T0 + 60000 + FULL_TABLE.idleSeatMs - 1;
  assert.deepEqual(await h.idleDue(), []);
  h.time = T0 + 60000 + FULL_TABLE.idleSeatMs;
  const dave = (await h.table.dueTicks()).find(d => d.kind === 'seat.idle');
  assert.equal(dave.playerId, 'dave');
  assert.equal((await h.table.tick(dave)).outcome, 'applied');
  s = await h.snap(B);
  assert.deepEqual(s.owners, [null, null, null, null, null, B, null], 'the player with a bet keeps his box');
  // A new window counts from its opening, not from a command in the round before it.
  await h.drain(); await h.standAll();
  h.time += 1000; await h.next(B);
  const opened = h.time;
  assert.equal((await h.snap(B)).phase, 'bets');
  h.time = opened + FULL_TABLE.idleSeatMs - 1;
  assert.deepEqual(await h.idleDue(), []);
  h.time = opened + FULL_TABLE.idleSeatMs;
  assert.deepEqual(await h.idleDue(), [B], 'he must bet again within 90 s of the new window');
  await h.drain();
  assert.deepEqual((await h.snap(B)).owners, Array(7).fill(null));
  assert.equal(h.exceeded, 0);
});

// Review of #547: the idle clock belongs to the betting window it was stamped for. A window opened without the
// stamp (a room stored before #547, the old engine during a Render overlap, a rollback) gets no seat.idle.
test('a room stored before #547 gets no idle release in its window, while the absence release still comes', async t => {
  const h = await setup(t);
  await h.join(A, [0, 1]); await h.join(B, [5]);
  await h.writeRoom(r => { for (const key of NEW_FIELDS) delete r[key]; });
  h.time = T0 + FULL_TABLE.idleSeatMs + 10000;
  assert.deepEqual(await h.idleDue(), [], 'joined 100 s ago without a bet, and still no seat.idle');
  h.time = T0 + 120000;
  assert.deepEqual((await h.table.dueTicks()).map(d => [d.kind, d.playerId]).sort(), [['seat.release', A], ['seat.release', B]]);
});

test('a window the old engine opens during a deploy overlap gets no idle release; the next window this engine opens does', async t => {
  const h = await setup(t);
  await h.join(A, [0]); await h.join(B, [1]);
  for (const [who, seat] of [[A, 0], [B, 1]]) await h.bet(who, seat);
  await h.ready(A); await h.ready(B); await h.standAll();
  h.time = T0 + 95000;                                          // the round and its settlement took 95 s
  await oldEngineNext(h, B);
  const old = await h.room();
  assert.notEqual(old.windowAt.windowId, old.windowId, 'the stamp names the window before');
  h.time += 250;                                                // this engine's next pass
  assert.deepEqual(await h.idleDue(), [], 'nobody is released 250 ms into the window');
  h.time += FULL_TABLE.idleSeatMs;
  assert.deepEqual(await h.idleDue(), [], 'nor later: that window has no idle clock');
  for (const [who, seat] of [[A, 0], [B, 1]]) await h.bet(who, seat);
  await h.ready(A); await h.ready(B); await h.standAll();
  await h.next(A);
  const opened = h.time, stamped = await h.room();
  assert.deepEqual(stamped.windowAt, { windowId: stamped.windowId, at: opened });
  // A command stamped for another window does not count in this one.
  await h.writeRoom(r => { r.lastAct[B] = { windowId: old.windowId, at: opened + 60000 }; });
  h.time = opened + FULL_TABLE.idleSeatMs - 1;
  assert.deepEqual(await h.idleDue(), []);
  h.time = opened + FULL_TABLE.idleSeatMs;
  assert.deepEqual((await h.idleDue()).sort(), [A, B]);
  assert.equal(h.exceeded, 0);
});

test('a deploy onto a room the old engine played: its new window releases nobody, 250 ms or 90 s in (review scenario)', async t => {
  const h = await setup(t);
  await h.join(A, [0]); await h.join(B, [1]);
  await h.writeRoom(r => { for (const key of NEW_FIELDS) delete r[key]; });
  for (const [who, seat] of [[A, 0], [B, 1]]) await h.bet(who, seat);
  await h.ready(A); await h.ready(B); await h.standAll();
  await h.writeRoom(r => { for (const key of NEW_FIELDS) delete r[key]; });  // every write was the old engine's
  h.time = T0 + 100000;
  await oldEngineNext(h, A);
  assert.equal(Object.hasOwn(await h.room(), 'windowAt'), false);
  h.time += 250;
  assert.deepEqual(await h.idleDue(), []);
  h.time += FULL_TABLE.idleSeatMs;
  assert.deepEqual(await h.idleDue(), []);
});

test('the box limit stays inside next\'s lock plan when it also ends a membership', async t => {
  const h = await setup(t);
  await h.join(A, [0, 1, 2, 3]); await h.join(B, [4, 5]); await h.join('dave', [6]);
  for (const i of [0, 1, 2, 3]) await h.bet(A, i);
  for (const i of [4, 5]) await h.bet(B, i);
  h.time = (await h.snap()).deadline; await h.drain();         // dave sits without a bet, so the deadline starts it
  assert.equal((await h.snap()).phase, 'round');
  await h.standAll();
  await h.send('carol', 'wait');
  const before = h.plans.length;
  await h.next(B);
  assert.deepEqual(h.plans.slice(before).map(p => p.players), [[B, 'dave']], 'only the actor and dave, whose last box goes, are locked');
  assert.equal(h.exceeded, 0);
  assert.deepEqual((await h.snap()).owners, [null, A, A, A, B, B, null]);
  assert.deepEqual((await h.audit('seat.release')).map(({ playerId, boxes, reason, memberEnded }) => [playerId, boxes, reason, memberEnded]),
    [[A, [0], 'table full', false], ['dave', [6], 'unplayed', true]]);
  assert.equal((await h.member('dave')).active, false);
});

// Local end to end (P-C's preview step, before preview): the production HTTP route, shared-room service,
// coordinator, PostgreSQL store (PGlite), runtime ticks, presentation receiver and read channel, with the
// browser's own command client and waiting module. Only session admission and the WebSocket transport are
// fixtures, as in test/shared-room-overlap.mjs.
const origin = 'https://player.invalid', engineOrigin = 'https://engine.invalid';
class Socket extends EventEmitter {
  readyState = 1; bufferedAmount = 0; frames = []; onFrame = () => {};
  send(text, callback) { const frame = JSON.parse(text); this.frames.push(frame); callback?.(); this.onFrame(frame); }
  close() { this.readyState = 3; this.emit('close'); }
}
async function until(check, message, ms = 5000) {
  const started = Date.now();
  while (Date.now() - started <= ms) { const value = await check(); if (value) return value; await delay(10); }
  assert.fail(`${message} (not within ${ms} ms)`);
}

test('end to end: two players fill the seven boxes, a third waits through the real route and client, and gets a box after the round', async t => {
  const pool = await createPglitePool();
  let service, waiting;
  t.after(async () => { waiting?.stop(); await service?.close(); await pool.end(); });
  for (const id of [A, B, 'carol']) await pool.query('INSERT INTO croupier_game.players(id,name,balance,created_at) VALUES($1,$2,$3,$4)',
    [id, `Synthetic ${id}`, 1000, '2026-10-28T00:00:00.000Z']);
  await createPostgresTableStore({ pool, walletMode: 'demo' }).config.publish(ROOM, 'v1', structuredClone(DEFAULT_CONFIG));
  const clock = { time: T0, now() { return this.time; } }, errors = [];
  const binding = actorId => ({ actorId, sessionId: `session-${actorId}`, operatorId: 'operator-full', roomId: ROOM, packageRevision: 1, expiresAt: T0 + 3_600_000 });
  let channel;
  service = createSharedRoomService({ pool, walletMode: 'demo', origin, engineOrigin, scope: { environment: 'test', workspaceId: 'full-table' },
    auth: {}, commandAuth: {}, repository: { sharedTransaction: work => work() }, clock, onError: error => errors.push(error),
    lockTimeoutMs: 4000, statementTimeoutMs: 8000 }, {
    createAccess: () => ({ async authorize(request) { return binding(request.headers.get('x-actor')); },
      async revalidate(value) { return value; }, async revalidateLocked() {} }),
    createUpgrade: value => { channel = value.channel; return { handleUpgrade: () => false, close: () => value.channel.close() }; },
  });
  await service.start();
  const route = createSharedRoomCommand({ service, origin, engineOrigin });
  // The browser command client's request as the engine receives it for one signed-in player.
  const fetchFor = actorId => (url, init) => route(new Request(engineOrigin + url, { method: init.method, body: init.body,
    headers: { ...init.headers, host: new URL(engineOrigin).host, origin, 'x-actor': actorId } }));
  const clients = Object.fromEntries([A, B].map(id => [id, createSharedRoomCommandClient({ roomId: ROOM, fetchImpl: fetchFor(id) })]));
  clients.carol = createSharedRoomCommandClient({ roomId: ROOM, fetchImpl: fetchFor('carol') });
  const post = async (actorId, intent) => {
    const reply = await clients[actorId].send(intent);
    assert.equal(reply.status, 'ok', `${actorId} ${intent.op}: ${reply.code ?? ''}`);
    return reply.result;
  };
  const sockets = {};
  for (const id of [A, B, 'carol']) {
    sockets[id] = new Socket();
    (await channel.prepare(new Request(`${engineOrigin}/shared-room/${ROOM}`, { headers: { origin, 'x-actor': id } }))).attach(sockets[id]);
  }
  const latest = id => sockets[id].frames.at(-1)?.snapshot;
  const seen = (id, check, message = `${id} sees the expected state`) => until(() => { const s = latest(id); return s && check(s) ? s : null; }, message);
  const room = async () => JSON.parse((await pool.query('SELECT body FROM croupier_game.shared_table_rooms WHERE room_id=$1', [ROOM])).rows[0].body);
  const receipts = async () => (await pool.query("SELECT count(*)::int AS n FROM croupier_game.shared_table_receipts WHERE player_id='carol'")).rows[0].n;

  await seen(A, s => s.unopened === true);
  await post(A, { op: 'join', memberGen: 0, seats: [0, 1, 2, 3], seatGens: { 0: 0, 1: 0, 2: 0, 3: 0 } });
  let s = await seen(B, x => x.owners[3] === A);
  await post(B, { op: 'join', memberGen: 0, seats: [4, 5, 6], seatGens: Object.fromEntries([4, 5, 6].map(i => [i, s.seatGen[i]])) });
  s = await seen(A, x => x.owners.every(Boolean));
  for (const seat of [0, 1, 2, 3]) await post(A, { op: 'bet', windowId: s.windowId, seat, field: 'main', chip: 5 });
  for (const seat of [4, 5, 6]) await post(B, { op: 'bet', windowId: s.windowId, seat, field: 'main', chip: 5 });
  await post(A, { op: 'ready', windowId: s.windowId }); await post(B, { op: 'ready', windowId: s.windowId });
  const full = await seen('carol', x => x.phase === 'round');
  assert.equal(waitingForSeat(full), true, 'carol sees a full table without a seat of her own');

  // Carol's page renews her wait after each snapshot, as shared-room-app.mjs does after a restore. Its timers and
  // sends are counted, so the end of the renewals is a state, not a guess after a delay.
  const timers = new Set();
  let sends = 0, inFlight = 0;
  waiting = createSharedRoomWaiting({ roomId: ROOM, refreshMs: 200, state: () => ({ snapshot: latest('carol'), connected: true, closed: false }),
    setTimer: (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; },
    clearTimer: id => { clearTimeout(id); timers.delete(id); },
    createCommands: options => {
      const client = createSharedRoomCommandClient({ ...options, fetchImpl: fetchFor('carol') });
      return { get state() { return client.state; }, stop: () => client.stop(),
        async send(intent) { sends++; inFlight++; try { return await client.send(intent); } finally { inFlight--; } } };
    } });
  sockets.carol.onFrame = () => waiting.update();
  const framesBefore = sockets[A].frames.length;
  waiting.update();
  await until(async () => (await room()).waiting?.carol === clock.time, 'carol is registered as waiting');
  await until(async () => await receipts() >= 3, 'the wait is renewed');
  assert.equal(sockets[A].frames.length, framesBefore, 'a wait and its renewals send the seated players no frame');
  assert.deepEqual(latest('carol').owners, [A, A, A, A, B, B, B], 'nothing leaves the round in play');

  for (let i = 0; i < 60 && latest(A).phase !== 'settled'; i++) {
    s = latest(A);
    const hand = s.round?.hands?.[s.round.active];
    if (s.phase === 'round' && s.round.phase === 'decisions' && hand) {
      clock.time = Math.max(clock.time, s.plan.turnAt);
      await post(s.owners[hand.box], { op: 'act', roundId: s.roundId, turnSeq: s.turnSeq, box: hand.box, handIndex: s.round.active, action: 'stand' });
    } else clock.time = Math.max(clock.time, s.plan?.endAt ?? clock.time, s.actionDeadline ?? clock.time) + 1;
    await seen(A, x => x.version > s.version, 'the round moves on');
  }
  const settled = await seen(A, x => x.phase === 'settled');
  assert.deepEqual(settled.owners, [A, A, A, A, B, B, B]);
  // A renewal rewrites the registration once it is WAIT_WRITE_AFTER_MS old on the table clock, so it stays current.
  await until(async () => clock.time - (await room()).waiting?.carol < WAIT_WRITE_AFTER_MS, 'the wait stays current on the table clock');

  await post(A, { op: 'next', roundId: settled.roundId });
  const opened = await seen('carol', x => x.phase === 'bets');
  assert.deepEqual(opened.owners, [null, A, A, A, B, B, B], 'alice keeps the three boxes played first, bob keeps his three');
  assert.equal(waitingForSeat(opened), false);
  // The snapshot with a free seat cancelled the next renewal, and a send still under way arms none.
  await until(() => inFlight === 0 && timers.size === 0, 'the renewals stop at a free seat');
  const sent = sends, before = await receipts();
  await post('carol', { op: 'join', memberGen: 0, seats: [0], seatGens: { 0: opened.seatGen[0] } });
  assert.deepEqual((await seen('carol', x => x.owners[0] === 'carol')).me.seats, [0], 'carol has a box');
  assert.deepEqual([sends, inFlight, timers.size], [sent, 0, 0], 'no renewal after the seat was free');
  assert.equal(await receipts(), before + 1, 'only her join');
  assert.deepEqual(errors.filter(error => error?.code !== 'shared_table_room_contention'), []);
});
