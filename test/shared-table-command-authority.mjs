// The reference adapter proves rollback and command ordering. The final case
// executes the real PostgreSQL adapter against an instrumented fake SQL client;
// it proves same-client call order, not PostgreSQL row-lock/revocation behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTableCoordinator } from '../services/game/games/blackjack/table/coordinator.mjs';
import { createPostgresTableStore } from '../services/game/games/blackjack/table/postgres-store.mjs';
import { LockSetExceeded } from '../services/game/games/blackjack/table/ports.mjs';
import { createMemoryTableStore } from './fixtures/blackjack-table-memory-store.mjs';
import { deterministicRandom } from './fixtures/blackjack-deterministic-random.mjs';

const clock = { now: () => 100000 };
const identity = Object.freeze({ actorId: 'alice', authority: Symbol('server-selected-authority') });
const join = Object.freeze({ roomId: 'party', commandId: 'join-1', op: 'join', seats: [0], seatGens: { 0: 0 }, memberGen: 0 });
const denied = error => error?.code === 'AUTHORITY_REJECTED';
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

function fixture(authorize, { afterWork } = {}) {
  const base = createMemoryTableStore(), trace = [];
  base.test.fund('alice', 1000);
  let active, attempts = 0;
  const store = {
    ...base,
    runLocked(plan, work) {
      return base.runLocked(plan, async original => {
        const tx = { ...original, receipts: {
          ...original.receipts,
          get(key) { trace.push('receipt.get'); return original.receipts.get(key); },
          put(key, value) { trace.push('receipt.put'); return original.receipts.put(key, value); },
        } };
        active = tx; attempts++; trace.push('locked');
        try {
          const result = await work(tx);
          await afterWork?.(attempts);
          return result;
        } finally { active = undefined; trace.push('release'); }
      });
    },
  };
  const options = { store, clock, random: deterministicRandom('command-authority') };
  if (authorize !== undefined) options.authorizeCommand = (tx, request) => {
    trace.push('authority');
    assert.equal(tx, active, 'the authority receives this same locked port object');
    return authorize(tx, request);
  };
  const table = createTableCoordinator(options);
  return { base, table, trace };
}

async function durable(base) {
  return {
    room: await base.read.room('party'), members: await base.read.members('party'),
    presence: await base.read.presence('party', 'alice'), balance: base.test.balance('alice'),
    reservations: base.test.reservations(), ledger: base.test.ledger(), audit: base.test.audit(),
    receipts: base.test.receipts(), outbox: base.test.outbox(), pause: await base.read.pausedUntil('alice'),
  };
}

test('only a constructor-selected function configures internal command authority', async () => {
  const options = { store: createMemoryTableStore(), clock, random: deterministicRandom('configuration') };
  for (const authorizeCommand of [null, false, true, 0, {}, 'allow']) {
    assert.throws(() => createTableCoordinator({ ...options, authorizeCommand }), /authority must be a function/);
  }
  const h = fixture(() => false);
  await assert.rejects(h.table.command({ ...identity, authorizeCommand: () => true }, { ...join, authorizeCommand: () => true }), denied);
  assert.equal(h.base.test.receipts(), 0);
});

test('authority is awaited on the locked ports before receipts and receives server context separately from command input', async () => {
  const gate = deferred(), entered = deferred();
  const h = fixture(async (tx, request) => {
    assert.equal(Object.isFrozen(request), true);
    assert.deepEqual(request, { actorId: 'alice', roomId: 'party', commandId: 'join-1', authority: identity.authority });
    assert.equal(tx.query, undefined, 'no raw SQL client is exposed');
    assert.equal(await tx.config.latest('party'), 'v1');
    assert.equal(await tx.wallet.available('alice'), 1000);
    entered.resolve();
    await gate.promise;
    return true;
  });
  const pending = h.table.command(identity, join);
  await entered.promise;
  assert.deepEqual(h.trace, ['locked', 'authority']);
  assert.equal(h.base.test.receipts(), 0);
  gate.resolve();
  const result = await pending;
  assert.equal(result.replay, false);
  assert.deepEqual(h.trace, ['locked', 'authority', 'receipt.get', 'receipt.put', 'release']);
  assert.equal(h.base.test.receipts(), 1);
});

test('revocation denies an existing matching receipt before any receipt or result read', async () => {
  let allowed = true;
  const h = fixture(() => allowed);
  await h.table.command(identity, join);
  const before = await durable(h.base);
  h.trace.length = 0; allowed = false;
  await assert.rejects(h.table.command(identity, join), denied);
  assert.deepEqual(h.trace, ['locked', 'authority', 'release']);
  assert.deepEqual(await durable(h.base), before);
});

test('the same allowed receipt is reauthorized without duplicate effects or a new presence write', async () => {
  let authorizations = 0;
  const h = fixture(() => { authorizations++; return true; });
  const first = await h.table.command(identity, join), before = await durable(h.base);
  const second = await h.table.command(identity, join);
  assert.equal(authorizations, 2);
  assert.equal(second.replay, true);
  assert.deepEqual(second.result, first.result);
  assert.deepEqual(await durable(h.base), before);
  assert.equal(h.trace.filter(value => value === 'receipt.put').length, 1);
});

test('false, absent, and truthy non-boolean authority results fail closed without effects', async () => {
  for (const result of [false, undefined, null, 1, 'true', {}]) {
    const h = fixture(async () => result), before = await durable(h.base);
    await assert.rejects(h.table.command(identity, join), denied);
    assert.deepEqual(await durable(h.base), before);
    assert.deepEqual(h.trace, ['locked', 'authority', 'release']);
  }
});

test('authority infrastructure errors preserve their identity and roll back the whole unit', async () => {
  const failure = Object.assign(new Error('synthetic infrastructure failure'), { code: '57P01' });
  const h = fixture(async tx => {
    // Deliberate fixture-only sentinel proves that the hook is inside rollback;
    // a production authorization implementation should perform reads only.
    await tx.pause.extend('alice', 999999);
    throw failure;
  });
  const before = await durable(h.base);
  await assert.rejects(h.table.command(identity, join), error => error === failure);
  assert.deepEqual(await durable(h.base), before);
  assert.deepEqual(h.trace, ['locked', 'authority', 'release']);
});

test('revocation while authority awaits and between lock-plan attempts cannot reuse earlier admission', async () => {
  const gate = deferred(), entered = deferred();
  let allowed = true;
  const waiting = fixture(async () => { entered.resolve(); await gate.promise; return allowed; });
  const before = await durable(waiting.base), pending = waiting.table.command(identity, join);
  await entered.promise; allowed = false; gate.resolve();
  await assert.rejects(pending, denied);
  assert.deepEqual(await durable(waiting.base), before);

  allowed = true;
  const retry = fixture(() => allowed, { afterWork(attempt) {
    if (attempt === 1) { allowed = false; throw new LockSetExceeded({ rooms: ['party'] }); }
  } });
  const retryBefore = await durable(retry.base);
  await assert.rejects(retry.table.command(identity, join), denied);
  assert.equal(retry.trace.filter(value => value === 'authority').length, 2);
  assert.equal(retry.trace.filter(value => value === 'receipt.get').length, 1);
  assert.deepEqual(await durable(retry.base), retryBefore);
});

test('real PostgreSQL adapter calls authority after R/P/A on its same fake SQL client and rolls back denial', async () => {
  const clients = [];
  const pool = {
    async query() { assert.fail('the locked work must not query through the pool'); },
    async connect() {
      const client = { statements: [], released: false, async query(sql, values = []) {
        this.statements.push({ sql, values });
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { command: sql, rows: [] };
        if (sql.includes('SELECT id FROM croupier_game.players')) return { rows: [{ id: 'alice' }] };
        if (sql.includes('SELECT version FROM croupier_game.shared_table_config_heads')) return { rows: [{ version: 'v1' }] };
        return { rows: [] };
      }, release() { this.released = true; } };
      clients.push(client); return client;
    },
  };
  const store = createPostgresTableStore({ pool, walletMode: 'demo' });
  const table = createTableCoordinator({ store, clock, random: deterministicRandom('sql-order'), authorizeCommand: async tx => {
    assert.equal(clients.length, 2, 'one completed lock-plan read and one locked unit');
    const client = clients[1];
    assert.equal(client.released, false);
    assert.equal(client.statements.length, 5);
    assert.equal(client.statements[2].sql, 'SELECT pg_advisory_xact_lock($1::integer,$2::integer)');
    assert.match(client.statements[3].sql, /players WHERE id=\$1 FOR UPDATE/);
    assert.equal(client.statements[4].sql, 'SELECT pg_advisory_xact_lock($1::integer,$2::integer)');
    assert.equal(await tx.config.latest('party'), 'v1');
    assert.equal(clients.length, 2, 'the authority port read stays on the active SQL client');
    assert.match(client.statements.at(-1).sql, /shared_table_config_heads/);
    return false;
  } });
  await assert.rejects(table.command(identity, join), denied);
  assert.equal(clients[0].statements.at(-1).sql, 'COMMIT');
  assert.equal(clients[1].statements.at(-1).sql, 'ROLLBACK');
  assert.ok(clients.every(client => client.released));
  assert.ok(clients.every(client => client.statements.every(({ sql }) => !sql.includes('shared_table_receipts'))));
});
