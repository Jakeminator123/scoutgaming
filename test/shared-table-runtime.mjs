import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresTableRuntime } from '../services/game/games/blackjack/table/postgres-runtime.mjs';
import { createMemoryTableStore } from './fixtures/blackjack-table-memory-store.mjs';
import { deterministicRandom } from './fixtures/blackjack-deterministic-random.mjs';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = () => new Promise(setImmediate);
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
    lastSuccessAt: null, failed: false, lastErrorAt: null });
  assert.equal(clockReads, 0);
  await h.runtime.start();
  at = 20; await h.runtime.pump();
  assert.deepEqual(h.runtime.health(), { state: 'running', running: true, inFlight: false,
    lastSuccessAt: 20, failed: false, lastErrorAt: null });
  failure = new Error('private SQL connection and credentials must not appear in health');
  at = 30; await assert.rejects(h.runtime.pump(), error => error === failure);
  assert.deepEqual(h.runtime.health(), { state: 'running', running: true, inFlight: false,
    lastSuccessAt: 20, failed: true, lastErrorAt: 30 });
  failure = null; at = 40; h.timer.fire(); await flush();
  const recovered = h.runtime.health();
  assert.deepEqual(recovered, { state: 'running', running: true, inFlight: false,
    lastSuccessAt: 40, failed: false, lastErrorAt: 30 });
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
    lastSuccessAt: null, failed: true, lastErrorAt: 100000 });
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
    lastSuccessAt: null, failed: false, lastErrorAt: null });
  await assert.rejects(h.runtime.pump(), /not running/);
  await assert.rejects(h.runtime.start(), /Await stop/);
  gate.resolve(); await stopping;
  assert.deepEqual(h.runtime.health(), { state: 'stopped', running: false, inFlight: false,
    lastSuccessAt: 100000, failed: false, lastErrorAt: null });
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
