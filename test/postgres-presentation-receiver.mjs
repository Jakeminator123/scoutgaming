// K04 real SQL checks for the durable presentation receiver, invoked only by
// tools/run-shared-table-qa.mjs on its owned loopback cluster after the J07 checks.
import assert from 'node:assert/strict';
import { createTableCoordinator } from '../services/game/games/blackjack/table/coordinator.mjs';
import { createPostgresTableStore } from '../services/game/games/blackjack/table/postgres-store.mjs';
import { createPostgresPresentationReceiver } from '../services/game/games/blackjack/presentation/postgres-receiver.mjs';
import { reconnectPresentation } from '../services/game/games/blackjack/presentation/outbox-presentation.mjs';
import { DEFAULT_CONFIG } from './fixtures/blackjack-table-memory-store.mjs';
import { deterministicRandom } from './fixtures/blackjack-deterministic-random.mjs';

export async function checkPresentationReceiverGuard({ pool }) {
  await assert.rejects(createPostgresPresentationReceiver({ pool }).assertInstalled(), /receiver schema is not installed/);
  return { checks: ['presentation-receiver-missing-schema-refused-without-startup-ddl'] };
}

export async function runPostgresPresentationReceiverChecks({ pool, createPool, restart }) {
  let time = 500000, n = 0, generation = 0, secondPool = createPool();
  const clock = { now: () => time }, checks = [];
  let store, table, other, first, second;
  const reopen = () => {
    store = createPostgresTableStore({ pool, walletMode: 'demo' });
    table = createTableCoordinator({ store, clock, random: deterministicRandom(`k04-sql-${++generation}`) });
    other = createTableCoordinator({ store: createPostgresTableStore({ pool: secondPool, walletMode: 'demo' }), clock, random: deterministicRandom(`k04-sql-other-${generation}`) });
    first = createPostgresPresentationReceiver({ pool }); second = createPostgresPresentationReceiver({ pool: secondPool });
  };
  reopen(); await first.assertInstalled();
  const check = async (name, work) => { await work(); checks.push(name); console.log(`ok - ${name}`); };
  const room = 'k04-room', actor = 'k04-player';
  const send = (op, fields = {}) => table.command({ actorId: actor }, { roomId: room, commandId: `k04-${++n}`, op, ...fields });
  const snap = () => table.snapshot(room, actor);
  const pending = async roomId => (await store.outbox.pending()).filter(r => r.roomId === roomId);
  const rowXmin = async roomId => (await pool.query('SELECT xmin::text AS x FROM croupier_game.shared_table_presentation_receiver WHERE room_id=$1', [roomId])).rows[0]?.x;
  const stack = ranks => store.runLocked({ global: false, rooms: [room], players: [] }, async tx => {
    const value = await tx.rooms.read(room);
    value.game.shoe.cards.splice(-ranks.length, ranks.length, ...ranks.map((r, i) => ({ r, s: ['♠', '♦', '♥', '♣'][i % 4], serial: 900 + i })).reverse());
    await tx.rooms.write(room, value);
  });
  await pool.query('INSERT INTO croupier_game.players(id,name,balance,created_at) VALUES($1,$2,$3,$4)', [actor, 'Synthetic SQL player', 1000, '2026-10-22T00:00:00.000Z']);
  await store.config.publish(room, 'v1', structuredClone(DEFAULT_CONFIG));
  let held = [];

  await check('presentation-receiver-two-receivers-two-pools-deliver-real-outbox-in-version-order', async () => {
    await send('join', { seats: [3], seatGens: { 3: 0 }, memberGen: 0 });
    await send('bet', { seat: 3, field: 'main', chip: 10, windowId: (await snap()).windowId });
    await stack(['10', '6', '9', '10', '5']);
    await send('ready', { windowId: (await snap()).windowId });
    const s = await snap(); time = s.plan.turnAt;
    await send('act', { action: 'stand', roundId: s.roundId, turnSeq: s.turnSeq, box: 3, handIndex: s.round.active });
    held = await pending(room);
    assert.deepEqual(held.map(r => r.payload.presentation.kind), ['plan', 'plan']);
    const results = await Promise.all([table.deliverOutbox(first.sink), other.deliverOutbox(second.sink)]);
    for (const r of results) assert.deepEqual(r.failed, []);
    assert.deepEqual(await pending(room), []);
    assert.equal(await first.lastAccepted(room), held.at(-1).ver);
    const current = await second.current(room);
    assert.equal(current.ver, held.at(-1).ver); assert.equal(current.talkId, held.at(-1).talkId);
    assert.deepEqual(current.events.filter(e => ['deal', 'reveal'].includes(e.type)).map(e => [e.type, e.shoeDraw]), [['reveal', 5], ['deal', 6]]);
  });
  await check('presentation-receiver-delayed-older-version-stale-identical-last-applied-without-rewrite', async () => {
    const last = held.at(-1), xmin = await rowXmin(room);
    assert.equal(await second.sink(held[0]), 'stale');
    assert.equal(await first.sink(last), 'applied');
    assert.equal(await rowXmin(room), xmin, 'identical last version is not written again');
    await assert.rejects(first.sink({ ...last, payload: { ...last.payload, startAt: last.payload.startAt + 1 } }), /presentation_version_conflict/);
    assert.equal(await rowXmin(room), xmin);
  });
  await check('presentation-receiver-concurrent-out-of-order-deliveries-keep-the-highest-version', async () => {
    const rows = Array.from({ length: 24 }, (_, i) => ({ roomId: 'k04-race', auditSeq: i + 1, talkId: `race-${i + 1}`, ver: i + 1, payload: { events: [] } }));
    const shuffled = [...rows].sort((a, b) => ((a.ver * 7919) % 24) - ((b.ver * 7919) % 24));
    const answers = await Promise.all(shuffled.map((row, i) => (i % 2 ? first : second).sink(row)));
    assert.ok(answers.every(a => a === 'applied' || a === 'stale'));
    assert.equal(answers[shuffled.findIndex(r => r.ver === 24)], 'applied');
    assert.equal(await first.lastAccepted('k04-race'), 24);
    assert.equal((await second.current('k04-race')).talkId, 'race-24');
    for (const row of rows.slice(0, -1)) assert.equal(await first.sink(row), 'stale');
  });
  await check('presentation-receiver-durable-across-pg-restart-window-row-presents-placebets', async () => {
    pool = await restart(); secondPool = createPool(); reopen();
    assert.equal(await second.lastAccepted(room), held.at(-1).ver);
    assert.equal(await first.sink(held[0]), 'stale');
    assert.equal(await second.sink(held.at(-1)), 'applied');
    time = (await snap()).plan.endAt;
    for (const tick of (await table.dueTicks()).filter(r => r.roomId === room)) await table.tick(tick);
    await send('next', { roundId: (await snap()).roundId });
    const fresh = await pending(room);
    assert.deepEqual(fresh.map(r => r.payload.presentation.kind), ['collect', 'window']);
    assert.ok(fresh.every(r => r.ver > held.at(-1).ver));
    // Reconnect before delivery: the receiver still holds the older plan; never applied over the new window.
    assert.deepEqual(reconnectPresentation(await snap(), await first.current(room)), { apply: false, reason: 'stale_presentation' });
    const delivered = await other.deliverOutbox(second.sink);
    assert.deepEqual(delivered.failed, []); assert.equal(delivered.delivered.length, 2);
    const current = await first.current(room);
    assert.equal(current.kind, 'window');
    assert.deepEqual(current.events.map(e => e.family), ['speak.other/placebets', 'idle.ready/ready']);
    const resumed = reconnectPresentation(await snap(), current);
    assert.equal(resumed.apply, true); assert.equal(resumed.presentation.ver, fresh.at(-1).ver);
  });
  // Review 6328762858 finding 2: reads go through the bounded transaction, not a bare pool.query.
  await check('presentation-receiver-reads-bounded-by-sql-timeouts-blocked-read-and-recovery', async () => {
    const untimedPool = createPool({ queryTimeoutMs: null });
    assert.equal(untimedPool.options.query_timeout, undefined);
    assert.equal((await untimedPool.query('SHOW lock_timeout')).rows[0].lock_timeout, '0');
    assert.equal((await untimedPool.query('SHOW statement_timeout')).rows[0].statement_timeout, '0');
    const byLock = createPostgresPresentationReceiver({ pool: untimedPool, lockTimeoutMs: 100, statementTimeoutMs: 60000 });
    const byStatement = createPostgresPresentationReceiver({ pool: untimedPool, lockTimeoutMs: 60000, statementTimeoutMs: 250 });
    const expectedVer = await first.lastAccepted(room), expected = await first.current(room);
    // This watchdog only fails the test; it does not cancel the SQL or supply its timeout.
    const watchdog = work => { let timer; return Promise.race([work, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error('receiver_read_sql_timeout_missing')), 3000); })]).finally(() => clearTimeout(timer)); };
    const holder = await secondPool.connect();
    try {
      await holder.query('BEGIN');
      await holder.query('LOCK TABLE croupier_game.shared_table_presentation_receiver IN ACCESS EXCLUSIVE MODE');
      for (const [receiver, code] of [[byLock, '55P03'], [byStatement, '57014']]) {
        await assert.rejects(watchdog(receiver.lastAccepted(room)), error => error.code === code);
        await assert.rejects(watchdog(receiver.current(room)), error => error.code === code);
      }
      await watchdog(byLock.assertInstalled());
    } finally {
      try { await holder.query('ROLLBACK'); } finally { holder.release(); }
    }
    assert.equal(await byLock.lastAccepted(room), expectedVer);
    assert.deepEqual(await byStatement.current(room), expected);
    assert.equal(untimedPool.waitingCount, 0);
    assert.equal(untimedPool.idleCount, untimedPool.totalCount, 'every read client went back to the pool');
    assert.equal((await untimedPool.query('SHOW lock_timeout')).rows[0].lock_timeout, '0', 'timeouts stayed transaction-local');
  });
  return { pool, checks };
}
