import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresTableRuntime, isSharedTableSystemFault, isSharedTableContention } from '../services/game/games/blackjack/table/postgres-runtime.mjs';
import { createMemoryTableStore } from './fixtures/blackjack-table-memory-store.mjs';
import { deterministicRandom } from './fixtures/blackjack-deterministic-random.mjs';
import { runPostgresTransactionOwner } from '../packages/storage/server/postgres-transaction-context.mjs';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = () => new Promise(setImmediate);

test('tick actor hints wait for commit, skip rollback/replay/refusal, and reject an outer transaction owner',async t=>{
  const gate=deferred(),captured=deferred(),hints=[];let mode='wait';
  const h=setup({coordinator:{async dueTicks(){return [{roomId:'room-a',tickId:'tick-a'}];},
    async tick(_,{captureActors}){captureActors(Object.freeze(['alice','bob']));captured.resolve();
      if(mode==='wait')await gate.promise;if(mode==='fail')throw Object.assign(Error('COMMIT failed'),{code:'08006'});
      return {outcome:mode==='blocked'?'blocked':'applied',replay:mode==='replay'};}},
    options:{onTickCommitted:context=>hints.push(context)}});t.after(()=>h.runtime.stop());await h.runtime.start();
  const owner={closed:false,failed:null};assert.throws(()=>runPostgresTransactionOwner(owner,()=>h.runtime.pump()),/must own the outer unit/);
  assert.equal(h.calls.due,0);const pending=h.runtime.pump();await captured.promise;assert.deepEqual(hints,[]);
  gate.resolve();await pending;assert.deepEqual(hints,[{roomId:'room-a',actors:['alice','bob']}]);
  for(mode of ['fail','replay','blocked']){if(mode==='fail')await assert.rejects(h.runtime.pump(),/COMMIT failed/);else await h.runtime.pump();assert.equal(hints.length,1);}
});

test('post-commit tick observers report separately and never fail pump health or retry durable effects',async t=>{
  for(const asynchronous of [false,true])for(const brokenReporter of [false,true]){
    const observerFailure=Error('hint unavailable'),reports=[];let committed=false,effects=0,callbacks=0;
    const h=setup({coordinator:{async dueTicks(){return [{roomId:'room-a',tickId:'durable-tick'}];},
      async tick(_,{captureActors}){if(committed)return {outcome:'applied',replay:true};
        effects++;committed=true;captureActors(Object.freeze(['alice']));return {outcome:'applied',replay:false};}},
      options:{onTickCommitted(){callbacks++;if(asynchronous)return Promise.reject(observerFailure);throw observerFailure;},
        onError(error){reports.push(error);if(brokenReporter)return Promise.reject(Error('reporter unavailable'));}}});
    t.after(()=>h.runtime.stop());await h.runtime.start();
    const first=await h.runtime.pump();assert.equal(first.ticks[0].outcome,'applied');
    assert.equal(h.runtime.health().failed,false);assert.equal(h.runtime.health().lastErrorAt,null);
    assert.equal(reports.length,1);assert.equal(reports[0].code,'shared_table_commit_observer_failed');assert.equal(reports[0].cause,observerFailure);
    const second=await h.runtime.pump();assert.equal(second.ticks[0].replay,true);
    assert.equal(effects,1);assert.equal(callbacks,1);assert.equal(reports.length,1);assert.equal(h.runtime.health().failed,false);
  }
});
function timers() {
  let next = 0;
  const pending = new Map();
  return {
    pending,
    setTimer(fn, delay) { const id = ++next; pending.set(id, { fn, delay }); return id; },
    clearTimer(id) { pending.delete(id); },
    fire() {
      assert.equal(pending.size, 1, 'exactly one owned timer');
      const [id, job] = pending.entries().next().value;
      pending.delete(id); job.fn();
    },
    delay: () => [...pending.values()][0]?.delay,
  };
}
function setup({ store = {}, coordinator = {}, options = {} } = {}) {
  const timer = timers(), calls = { installed: 0, due: 0, ticks: [], delivery: 0 }, errors = [];
  const fakeStore = { async assertInstalled() { calls.installed++; }, ...store };
  const fakeCoordinator = {
    async dueTicks() { calls.due++; return []; },
    async tick(row) { calls.ticks.push(row); return { tickId: row.tickId, outcome: 'applied' }; },
    async deliverOutbox() { calls.delivery++; return { delivered: [], superseded: [], failed: [] }; },
    ...coordinator,
  };
  const runtime = createPostgresTableRuntime({ walletMode: 'demo', clock: { now: () => 100000 },
    onError: error => errors.push(error), ...options }, {
    createStore: () => fakeStore, createCoordinator: () => fakeCoordinator,
    setTimer: timer.setTimer, clearTimer: timer.clearTimer,
  });
  return { runtime, timer, calls, errors, store: fakeStore, coordinator: fakeCoordinator };
}

test('health reports sanitized pump failure and recovery without doing work', async t => {
  let at = 10, clockReads = 0, failure = null;
  const h = setup({ coordinator: { async dueTicks() { if (failure) throw failure; return []; } },
    options: { clock: { now() { clockReads++; return at; } } } });
  t.after(() => h.runtime.stop());
  assert.deepEqual(h.runtime.health(), { state: 'stopped', running: false, inFlight: false,
    lastSuccessAt: null, failed: false, lastErrorAt: null, rooms: [], outbox: [], contention: { count: 0, lastAt: null } });
  assert.equal(clockReads, 0);
  await h.runtime.start();
  at = 20; await h.runtime.pump();
  assert.deepEqual(h.runtime.health(), { state: 'running', running: true, inFlight: false,
    lastSuccessAt: 20, failed: false, lastErrorAt: null, rooms: [], outbox: [], contention: { count: 0, lastAt: null } });
  failure = new Error('private SQL connection and credentials must not appear in health');
  at = 30; await assert.rejects(h.runtime.pump(), error => error === failure);
  assert.deepEqual(h.runtime.health(), { state: 'running', running: true, inFlight: false,
    lastSuccessAt: 20, failed: true, lastErrorAt: 30, rooms: [], outbox: [], contention: { count: 0, lastAt: null } });
  failure = null; at = 40; h.timer.fire(); await flush();
  const recovered = h.runtime.health();
  assert.deepEqual(recovered, { state: 'running', running: true, inFlight: false,
    lastSuccessAt: 40, failed: false, lastErrorAt: 30, rooms: [], outbox: [], contention: { count: 0, lastAt: null } });
  const calls = structuredClone(h.calls), reads = clockReads, jobs = [...h.timer.pending];
  assert.ok(Object.isFrozen(recovered));
  assert.throws(() => { recovered.state = 'stopped'; }, TypeError);
  assert.deepEqual(h.runtime.health(), recovered);
  assert.deepEqual(h.runtime.health(), recovered);
  assert.equal(clockReads, reads); assert.deepEqual(h.calls, calls);
  assert.deepEqual([...h.timer.pending], jobs);
});

test('readiness is single-flight and a failed schema check never starts work', async t => {
  const gate = deferred(), missing = new Error('schema missing'); let attempts = 0;
  const h = setup({ store: { assertInstalled() { attempts++; return gate.promise; } } });
  t.after(() => h.runtime.stop());
  const first = h.runtime.start(); assert.equal(h.runtime.start(), first);
  assert.equal(h.runtime.health().state, 'starting');
  assert.equal(attempts, 1); assert.equal(h.timer.pending.size, 0);
  await assert.rejects(h.runtime.pump(), /not running/);
  gate.reject(missing); await assert.rejects(first, error => error === missing);
  assert.deepEqual(h.runtime.health(), { state: 'stopped', running: false, inFlight: false,
    lastSuccessAt: null, failed: true, lastErrorAt: 100000, rooms: [], outbox: [], contention: { count: 0, lastAt: null } });
  assert.equal(h.calls.due, 0); assert.equal(h.timer.pending.size, 0);
  h.store.assertInstalled = async () => {};
  await h.runtime.start(); assert.equal(h.timer.delay(), 0);
  assert.equal(h.runtime.health().failed, true, 'schema success alone does not prove the pump recovered');
  await h.runtime.pump(); assert.equal(h.runtime.health().failed, false);
  assert.equal(h.runtime.store, h.store); assert.equal(h.runtime.coordinator, h.coordinator);
});

test('timer and simultaneous explicit pumps share one pass and never overlap ticks', async t => {
  const gate = deferred(), due = [{ tickId: 'a' }, { tickId: 'b' }], ran = [];
  const h = setup({ coordinator: {
    async dueTicks() { return due; },
    async tick(row) { ran.push(row.tickId); if (row.tickId === 'a') await gate.promise; return row; },
  }, options: { sink: async () => 'applied', intervalMs: 75 } });
  t.after(() => h.runtime.stop());
  await h.runtime.start(); h.timer.fire(); await flush();
  const one = h.runtime.pump(), two = h.runtime.pump(); assert.equal(one, two);
  assert.deepEqual(ran, ['a']); assert.equal(h.timer.pending.size, 0);
  gate.resolve(); const result = await one; await flush();
  assert.deepEqual(ran, ['a', 'b']); assert.equal(result.ticks.length, 2);
  assert.equal(h.calls.delivery, 1); assert.equal(h.timer.delay(), 75);
});

test('stop drains the active pass, clears its timer and leaves the supplied pool open', async () => {
  const gate = deferred(), seen = [];
  const h = setup({ coordinator: { async dueTicks() { return [{ tickId: 'a' }]; },
    async tick(row) { await gate.promise; seen.push(row); return row; } },
    options: { pool: { end() { assert.fail('pool ownership belongs to the caller'); } } } });
  await h.runtime.start(); h.timer.fire(); await flush();
  let stopped = false; const stopping = h.runtime.stop().then(() => { stopped = true; });
  await flush(); assert.equal(stopped, false);
  assert.deepEqual(h.runtime.health(), { state: 'stopping', running: false, inFlight: true,
    lastSuccessAt: null, failed: false, lastErrorAt: null, rooms: [], outbox: [], contention: { count: 0, lastAt: null } });
  await assert.rejects(h.runtime.pump(), /not running/);
  await assert.rejects(h.runtime.start(), /Await stop/);
  gate.resolve(); await stopping;
  assert.deepEqual(h.runtime.health(), { state: 'stopped', running: false, inFlight: false,
    lastSuccessAt: 100000, failed: false, lastErrorAt: null, rooms: [], outbox: [], contention: { count: 0, lastAt: null } });
  assert.equal(seen.length, 1); assert.equal(h.timer.pending.size, 0);
  await h.runtime.start(); assert.equal(h.timer.pending.size, 1);
  await h.runtime.stop(); assert.equal(h.timer.pending.size, 0);
});

test('stop during schema readiness waits and cannot resurrect the scheduler', async () => {
  const gate = deferred(); const h = setup({ store: { assertInstalled: () => gate.promise } });
  const starting = h.runtime.start(); let stopped = false;
  const stopping = h.runtime.stop().then(() => { stopped = true; });
  await flush(); assert.equal(stopped, false);
  assert.equal(h.runtime.health().state, 'stopping');
  gate.resolve(); await Promise.all([starting, stopping]);
  assert.equal(h.runtime.health().state, 'stopped');
  assert.equal(h.runtime.health().lastSuccessAt, null);
  assert.equal(h.timer.pending.size, 0); assert.equal(h.calls.due, 0);
});

test('infrastructure and delivery failures remain errors; only a later pump retries them', async t => {
  const unavailable = new Error('database unavailable'), delivery = new Error('sink unavailable');
  let failed = true; const attempts = [], delivered = [];
  const h = setup({ coordinator: {
    async dueTicks() { return [{ tickId: 'retry' }, ...(attempts.length ? [] : [{ tickId: 'healthy' }])]; },
    async tick(row) { attempts.push(row.tickId); if (failed && row.tickId === 'retry') throw unavailable; return row; },
    async deliverOutbox() {
      delivered.push('attempt'); return { delivered: [], superseded: [], failed: failed ? [{ error: delivery }] : [] };
    },
  }, options: { sink: async () => 'applied' } });
  t.after(() => h.runtime.stop());
  await h.runtime.start();
  await assert.rejects(h.runtime.pump(), error => error instanceof AggregateError
    && assert.deepEqual(error.errors, [unavailable, delivery]) === undefined);
  assert.deepEqual(attempts, ['retry', 'healthy']); assert.equal(delivered.length, 1);
  await flush(); assert.deepEqual(attempts, ['retry', 'healthy'], 'no inline retry or drain loop');
  failed = false; const result = await h.runtime.pump();
  assert.deepEqual(attempts, ['retry', 'healthy', 'retry']); assert.deepEqual(result.ticks, [{ tickId: 'retry' }]);
});

test('scheduled failures reach onError and stop waits for its owned reporting job', async () => {
  const gate = deferred(), failure = new Error('statement timeout'); const errors = [];
  const h = setup({ coordinator: { async dueTicks() { throw failure; } },
    options: { async onError(error) { errors.push(error); await gate.promise; } } });
  await h.runtime.start(); h.timer.fire(); await flush();
  assert.deepEqual(errors, [failure]); assert.equal(h.timer.pending.size, 0);
  assert.equal(h.runtime.health().failed, true);
  let stopped = false; const stopping = h.runtime.stop().then(() => { stopped = true; });
  await flush(); assert.equal(stopped, false);
  gate.resolve(); await stopping; assert.equal(h.timer.pending.size, 0);
});

test('invalid clocks never reach due jobs; absent sink leaves committed delivery pending', async t => {
  let at = NaN;
  const h = setup({ options: { clock: { now: () => at } } }); t.after(() => h.runtime.stop());
  await h.runtime.start(); await assert.rejects(h.runtime.pump(), /Invalid shared table clock/);
  assert.equal(h.runtime.health().failed, true); assert.equal(h.runtime.health().lastErrorAt, null);
  assert.equal(h.calls.due, 0); assert.equal(h.calls.delivery, 0);
  at = 100000; const result = await h.runtime.pump();
  assert.equal(h.runtime.health().failed, false); assert.equal(h.runtime.health().lastSuccessAt, at);
  assert.equal(h.calls.due, 1); assert.equal(h.calls.delivery, 0); assert.equal(result.outbox, null);
});

test('factory preserves explicit demo choice and rejects intervals that Node would clamp to a busy timer', () => {
  const pool = { query() { assert.fail('construction does not query'); }, connect() { assert.fail('construction does not connect'); } };
  assert.throws(() => createPostgresTableRuntime({ pool }), /explicit demo wallet/);
  assert.throws(() => createPostgresTableRuntime({ pool, walletMode: 'aggregator' }), /explicit demo wallet/);
  for (const intervalMs of [0, -1, 0.5, Infinity, 2147483648])
    assert.throws(() => createPostgresTableRuntime({ pool, walletMode: 'demo', intervalMs }), /positive timer interval/);
  assert.doesNotThrow(() => createPostgresTableRuntime({ pool, walletMode: 'demo' }));
});

test('real coordinator advances a due table without poll writes and delivers only committed outbox', async t => {
  const store = createMemoryTableStore(), timer = timers(), applied = [], errors = [];
  let at = 100000; store.assertInstalled = async () => {};
  store.test.fund('alice', 1000);
  // Only the storage and timer are fixtures; this exercises the real imported K03
  // coordinator. PostgreSQL transactions/locks are covered by J07 adapter tests.
  const runtime = createPostgresTableRuntime({ walletMode: 'demo', clock: { now: () => at },
    random: deterministicRandom('runtime'), onError: error => errors.push(error),
    sink: async row => { assert.ok(store.test.outbox().some(stored => stored.ver === row.ver)); applied.push(row); return 'applied'; },
  }, { createStore: () => store, setTimer: timer.setTimer, clearTimer: timer.clearTimer });
  t.after(() => runtime.stop()); await runtime.start();
  const table = runtime.coordinator;
  await table.command({ actorId: 'alice' }, { roomId: 'party', op: 'join', commandId: 'join', seats: [0], seatGens: { 0: 0 }, memberGen: 0 });
  const initial = await table.snapshot('party', 'alice');
  await table.command({ actorId: 'alice' }, { roomId: 'party', op: 'bet', commandId: 'bet', seat: 0, field: 'main', chip: 5, windowId: initial.windowId });
  at = (await table.snapshot('party', 'alice')).deadline;
  const units = store.test.stats.units;
  assert.equal((await table.snapshot('party', 'alice')).phase, 'bets');
  assert.equal((await table.snapshot('party', 'alice')).phase, 'bets');
  assert.equal(store.test.stats.units, units, 'polls do not run transactions');
  assert.equal(store.test.balance('alice'), 1000);
  timer.fire(); await flush();
  assert.deepEqual(errors, []); assert.equal((await table.snapshot('party', 'alice')).phase, 'round');
  assert.equal(store.test.balance('alice'), 995); assert.equal(store.test.ledger().length, 1);
  assert.ok(applied.length > 0); assert.equal((await store.outbox.pending()).length, 0);
  assert.equal(timer.pending.size, 1);
});

// B3 (external review, reproduction 4): one room's tick error must not close the
// shared tables. The broken room is marked, alarmed and retried with backoff.
test('a room tick error isolates that room: healthy rooms advance and the service stays ready', async t => {
  let poison = true, at = 1000; const applied = [], attempts = [];
  const h = setup({ coordinator: {
    async dueTicks() { return [{ roomId: 'broken-room', tickId: 'b' }, { roomId: 'healthy-room', tickId: 'h' }]; },
    async tick(d) { attempts.push(d.roomId); if (d.roomId === 'broken-room' && poison) throw new Error('isolated bad room state');
      applied.push(d.roomId); return { outcome: 'applied', replay: false }; },
  }, options: { clock: { now: () => at }, intervalMs: 100, roomBackoffMaxMs: 400 } });
  t.after(() => h.runtime.stop()); await h.runtime.start();
  const first = await h.runtime.pump();
  assert.deepEqual(applied, ['healthy-room']); assert.deepEqual(first.rooms, ['broken-room']);
  const health = h.runtime.health();
  assert.equal(health.failed, false); assert.equal(health.lastSuccessAt, 1000);
  assert.equal(health.running === true && health.failed === false, true, 'the service readiness expression stays open');
  assert.deepEqual(health.rooms, [{ roomId: 'broken-room', failures: 1, blocked: false, since: 1000, lastErrorAt: 1000, retryAt: 1100 }]);
  assert.doesNotMatch(JSON.stringify(health), /isolated bad room state/);
  assert.equal(h.errors.length, 1); assert.equal(h.errors[0].code, 'shared_table_room_failed');
  assert.equal(h.errors[0].roomId, 'broken-room'); assert.equal(h.errors[0].cause.message, 'isolated bad room state');
  // Backoff: the resting room is not retried, the healthy room keeps running.
  at = 1050; await h.runtime.pump();
  assert.deepEqual(attempts, ['broken-room', 'healthy-room', 'healthy-room']); assert.equal(h.errors.length, 1);
  // Retries double up to the cap; the third consecutive failure blocks commands.
  for (const [time, failures, retryAt] of [[1100, 2, 1300], [1300, 3, 1700], [1700, 4, 2100]]) {
    at = time; await h.runtime.pump();
    assert.deepEqual(h.runtime.roomHealth('broken-room'), { roomId: 'broken-room', failures, blocked: failures >= 3, since: 1000, lastErrorAt: time, retryAt });
  }
  assert.equal(h.runtime.roomHealth('healthy-room'), null); assert.equal(h.runtime.health().failed, false);
  assert.equal(applied.filter(room => room === 'healthy-room').length, 5);
  // Recovery: the first eligible pass without a failure clears the mark.
  poison = false; at = 2100; await h.runtime.pump();
  assert.deepEqual(h.runtime.health().rooms, []); assert.equal(h.runtime.roomHealth('broken-room'), null);
  assert.equal(applied.at(-2), 'broken-room');
});

test('system faults still fail the whole pass and readiness; unattributed errors are system faults', async t => {
  for (const failure of [Object.assign(new Error('terminating connection'), { code: '57P01' }),
    Object.assign(new Error('connect refused'), { code: 'ECONNREFUSED' }),
    Object.assign(new Error('relation missing'), { code: '42P01' }),
    new Error('Connection terminated unexpectedly'),
    new Error('wrapped', { cause: Object.assign(new Error('auth'), { code: '28P01' }) })]) {
    assert.equal(isSharedTableSystemFault(failure), true, failure.message);
    const h = setup({ coordinator: {
      async dueTicks() { return [{ roomId: 'room-a', tickId: 'a' }, { roomId: 'room-b', tickId: 'b' }]; },
      async tick(d) { if (d.roomId === 'room-a') throw failure; return { outcome: 'applied', replay: false }; },
    } });
    t.after(() => h.runtime.stop()); await h.runtime.start();
    await assert.rejects(h.runtime.pump(), error => error === failure);
    assert.equal(h.runtime.health().failed, true); assert.deepEqual(h.runtime.health().rooms, []);
  }
  for (const roomFault of [new Error('Invalid stored room'), new TypeError('bad shape'),
    Object.assign(new Error('lock timeout'), { code: '55P03' }), Object.assign(new Error('statement timeout'), { code: '57014' })])
    assert.equal(isSharedTableSystemFault(roomFault), false, roomFault.message);
});

test('a due-check fault marks its room; an outbox fault only defers that room\'s delivery and never its ticks or commands', async t => {
  let at = 1000, failDelivery = true; const delivering = [], ticked = [];
  const h = setup({ coordinator: {
    async dueTicks(_, { onRoomError }) { if (at === 1000) await onRoomError('due-room', new Error('corrupt room row'));
      return [{ roomId: 'ok-room', tickId: 'ok' }, { roomId: 'sink-room', tickId: 's' }]; },
    async tick(d) { ticked.push(d.roomId); return { outcome: 'applied', replay: false }; },
    async deliverOutbox(_, { skipRoom }) {
      const failed = [];
      for (const room of ['due-room', 'sink-room', 'ok-room']) {
        if (skipRoom(room)) continue; delivering.push(room);
        if (room === 'sink-room' && failDelivery) failed.push({ row: { roomId: room, ver: 2 }, error: new Error('receiver rejected row') });
      }
      return { delivered: [], superseded: [], failed };
    },
  }, options: { sink: async () => 'applied', clock: { now: () => at }, intervalMs: 100 } });
  t.after(() => h.runtime.stop()); await h.runtime.start();
  const result = await h.runtime.pump();
  assert.deepEqual(result.rooms, ['due-room']); assert.deepEqual(result.outboxRooms, ['sink-room']);
  assert.deepEqual(ticked, ['ok-room', 'sink-room'], 'a presentation fault does not pause the game');
  assert.deepEqual(h.runtime.health().rooms.map(room => room.roomId), ['due-room']);
  assert.deepEqual(h.runtime.health().outbox, [{ roomId: 'sink-room', failures: 1, since: 1000, lastErrorAt: 1000, retryAt: 1100 }]);
  assert.equal(h.runtime.roomHealth('sink-room'), null, 'commands are never blocked by delivery');
  assert.deepEqual(h.errors.map(error => [error.code, error.roomId]), [['shared_table_room_failed', 'due-room'], ['shared_table_outbox_failed', 'sink-room']]);
  assert.equal(h.runtime.health().failed, false);
  // Delivery backoff grows on its own; ticks keep running in the meantime.
  for (const [time, failures] of [[1050, 1], [1100, 2], [1300, 3], [1700, 4]]) {
    at = time; await h.runtime.pump();
    assert.equal(h.runtime.health().outbox[0].failures, failures); assert.equal(h.runtime.roomHealth('sink-room'), null);
  }
  assert.equal(delivering.filter(room => room === 'sink-room').length, 4, 'not delivered while resting at 1050');
  assert.equal(ticked.filter(room => room === 'sink-room').length, 5);
  failDelivery = false; at = 2500; await h.runtime.pump();
  assert.deepEqual(h.runtime.health().outbox, []); assert.deepEqual(h.runtime.health().rooms, []);
  const system = setup({ coordinator: { async dueTicks(_, { onRoomError }) {
    await onRoomError('room-a', Object.assign(new Error('gone'), { code: '08006' })); return []; } } });
  t.after(() => system.runtime.stop()); await system.runtime.start();
  await assert.rejects(system.runtime.pump(), /gone/); assert.equal(system.runtime.health().failed, true);
});

test('lock and statement timeouts, serialization failures and deadlocks are neutral: skipped, counted, never blocking', async t => {
  let at = 1000; const attempts = [];
  const contention = code => Object.assign(new Error('contention ' + code), { code });
  const codes = ['55P03', '57014', '40001', '40P01'];
  for (const code of codes) assert.equal(isSharedTableContention(contention(code)), true, code);
  assert.equal(isSharedTableContention(new Error('wrapped', { cause: contention('57014') })), true);
  assert.equal(isSharedTableContention(contention('57P01')), false, 'an admin shutdown stays a system fault');
  let n = 0;
  const h = setup({ coordinator: {
    async dueTicks() { return [{ roomId: 'busy-room', tickId: 'b1' }, { roomId: 'busy-room', tickId: 'b2' }, { roomId: 'calm-room', tickId: 'c' }]; },
    async tick(d) { attempts.push(d.tickId); if (d.roomId === 'busy-room' && n < 6) throw contention(codes[n++ % 4]);
      return { outcome: 'applied', replay: false }; },
  }, options: { clock: { now: () => at }, intervalMs: 100, roomBlockAfter: 1 } });
  t.after(() => h.runtime.stop()); await h.runtime.start();
  for (let pass = 0; pass < 6; pass++) {
    const result = await h.runtime.pump(); at += 1;
    assert.deepEqual(result.contended, ['busy-room']); assert.deepEqual(result.rooms, []);
    assert.equal(h.runtime.roomHealth('busy-room'), null, 'even roomBlockAfter=1 never blocks on contention');
    assert.deepEqual(h.runtime.health().rooms, []); assert.equal(h.runtime.health().failed, false);
  }
  assert.deepEqual(h.runtime.health().contention, { count: 6, lastAt: 1005 });
  assert.equal(attempts.filter(id => id === 'b2').length, 0, 'the rest of a contended room waits for the next pass');
  assert.equal(attempts.filter(id => id === 'c').length, 6);
  assert.ok(h.errors.every(error => error.code === 'shared_table_room_contention' && error.roomId === 'busy-room'));
  // The next pass is immediate, without backoff: the room proceeds once the lock is free.
  await h.runtime.pump(); assert.deepEqual(attempts.slice(-3), ['b1', 'b2', 'c']);
});

test('real coordinator: an unreadable room does not stop another room from starting its round', async t => {
  const store = createMemoryTableStore(), errors = []; let at = 100000; store.assertInstalled = async () => {};
  store.test.fund('alice', 1000); store.test.fund('bob', 1000);
  const runtime = createPostgresTableRuntime({ walletMode: 'demo', clock: { now: () => at }, random: deterministicRandom('isolation'),
    onError: error => errors.push(error) }, { createStore: () => store, setTimer: () => 1, clearTimer: () => {} });
  t.after(() => runtime.stop()); await runtime.start();
  const table = runtime.coordinator;
  for (const [actorId, roomId] of [['alice', 'party'], ['bob', 'broken']]) {
    await table.command({ actorId }, { roomId, op: 'join', commandId: 'join', seats: [0], seatGens: { 0: 0 }, memberGen: 0 });
    const { windowId } = await table.snapshot(roomId, actorId);
    await table.command({ actorId }, { roomId, op: 'bet', commandId: 'bet', seat: 0, field: 'main', chip: 5, windowId });
  }
  at = Math.max((await table.snapshot('party', 'alice')).deadline, (await table.snapshot('broken', 'bob')).deadline);
  const read = store.read.room;
  store.read.room = async id => { if (id === 'broken') throw new Error('Invalid stored room'); return read(id); };
  await runtime.pump();
  store.read.room = read;
  assert.equal((await table.snapshot('party', 'alice')).phase, 'round');
  assert.equal((await table.snapshot('broken', 'bob')).phase, 'bets');
  assert.equal(runtime.health().failed, false);
  assert.deepEqual(runtime.health().rooms.map(room => room.roomId), ['broken']);
  assert.deepEqual(errors.map(error => [error.code, error.roomId]), [['shared_table_room_failed', 'broken']]);
  at += 250; await runtime.pump();
  assert.equal((await table.snapshot('broken', 'bob')).phase, 'round'); assert.deepEqual(runtime.health().rooms, []);
});

test('contention is counted every time but reported at most once per room per interval', async t => {
  let at = 1000;
  const h = setup({ coordinator: {
    async dueTicks() { return [{ roomId: 'busy-room', tickId: 'b' }, { roomId: 'other-room', tickId: 'o' }]; },
    async tick() { throw Object.assign(new Error('lock timeout'), { code: '55P03' }); },
  }, options: { clock: { now: () => at }, contentionReportMs: 10000 } });
  t.after(() => h.runtime.stop()); await h.runtime.start();
  for (let pass = 0; pass < 5; pass++) { await h.runtime.pump(); at += 1000; }
  assert.deepEqual(h.runtime.health().contention, { count: 10, lastAt: 5000 });
  assert.deepEqual(h.errors.map(error => [error.roomId, error.occurrences]), [['busy-room', 1], ['other-room', 1]]);
  at = 11000; await h.runtime.pump();
  assert.deepEqual(h.errors.slice(2).map(error => [error.code, error.roomId, error.occurrences]),
    [['shared_table_room_contention', 'busy-room', 5], ['shared_table_room_contention', 'other-room', 5]]);
  assert.throws(() => setup({ options: { contentionReportMs: -1 } }), /contention report/);
});

test("F11: each pass hands the rooms' committed versions to onRoomObserved after its own ticks and delivery; a broken observer changes nothing",async t=>{
  const observed=[],order=[];let broken=false;
  const h=setup({coordinator:{async dueTicks(_at,{observeRoom}){
    observeRoom('room-a',{version:4,presentationVer:2});observeRoom('room-b',{version:9,presentationVer:9});
    return [{roomId:'room-a',tickId:'tick-a'}];},
    async tick(row){order.push('tick');return {tickId:row.tickId,outcome:'applied'};},
    async deliverOutbox(){order.push('deliver');return {delivered:[],superseded:[],failed:[]};}},
    options:{sink:async()=>'applied',onRoomObserved(value){order.push('observe');if(broken==='sync')throw Error('observer down');
      if(broken==='async')return Promise.reject(Error('observer down'));assert.ok(Object.isFrozen(value));observed.push(value);}}});
  t.after(()=>h.runtime.stop());await h.runtime.start();
  const first=await h.runtime.pump();
  assert.deepEqual(observed,[{roomId:'room-a',version:4,presentationVer:2},{roomId:'room-b',version:9,presentationVer:9}]);
  assert.deepEqual(order,['tick','deliver','observe','observe']);
  for(broken of ['sync','async']){const next=await h.runtime.pump();assert.equal(next.ticks.length,1);}
  await flush();assert.equal(first.ticks.length,1);assert.equal(h.runtime.health().failed,false);assert.deepEqual(h.errors,[]);
  // Without the port the scheduler is asked exactly as before.
  const plain=setup({coordinator:{async dueTicks(_at,options){assert.equal(Object.hasOwn(options,'observeRoom'),false);return [];}}});
  t.after(()=>plain.runtime.stop());await plain.runtime.start();await plain.runtime.pump();
  assert.throws(()=>setup({options:{onRoomObserved:'yes'}}),/Invalid runtime ports/);
});
