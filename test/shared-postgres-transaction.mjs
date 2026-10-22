// Instrumented SQL clients exercise all three real adapters. These are not
// PostgreSQL row-lock tests; actual SQL concurrency remains an integration gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setImmediate as turn } from 'node:timers/promises';
import { createPostgresStore } from '../packages/storage/server/postgres-store.mjs';
import { createStudioRepository } from '../packages/studio-registry/server/document-repository.mjs';
import { createPostgresTableStore } from '../services/game/games/blackjack/table/postgres-store.mjs';
import { LockSetExceeded, TableError } from '../services/game/games/blackjack/table/ports.mjs';

const scope = Object.freeze({ environment: 'test', workspaceId: 'shared-transaction' });
const clone = value => structuredClone(value);
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const tableLock = (kind, id) => {
  const hash = createHash('sha256').update(`croupier-shared-table\0${kind}\0${id}`).digest();
  return [hash.readInt32BE(0), hash.readInt32BE(4)];
};

function fixture({ commitError, commitRollback = false, rollbackSavepointError, commitGate } = {}) {
  const clients = [], calls = [];
  let committed = { configs: {}, heads: {} };
  const pool = {
    async query() { assert.fail('No query may escape through the raw pool during shared work'); },
    async connect() {
      let state, savepoints = new Map();
      const client = {
        id: clients.length + 1, released: false,
        async query(sql, values = []) {
          calls.push({ client: this.id, sql, values });
          if (/^BEGIN\b/.test(sql)) { state = clone(committed); return { command: 'BEGIN', rows: [] }; }
          if (sql === 'COMMIT') {
            if (commitError) throw commitError;
            if (commitRollback) return { command: 'ROLLBACK', rows: [] };
            committed = clone(state);
            if (commitGate) { commitGate.entered.resolve(); await commitGate.resume.promise; }
            return { command: 'COMMIT', rows: [] };
          }
          if (sql === 'ROLLBACK') { state = clone(committed); return { command: 'ROLLBACK', rows: [] }; }
          if (sql.startsWith('SAVEPOINT ')) { savepoints.set(sql.slice(10), clone(state)); return { rows: [] }; }
          if (sql.startsWith('ROLLBACK TO SAVEPOINT ')) {
            if (rollbackSavepointError) throw rollbackSavepointError;
            state = clone(savepoints.get(sql.slice(22))); return { rows: [] };
          }
          if (sql.startsWith('RELEASE SAVEPOINT ')) { savepoints.delete(sql.slice(18)); return { rows: [] }; }
          if (sql.includes('test_sql_failure')) throw Object.assign(new Error('synthetic SQL failure'), { code: '40001' });
          if (sql.includes('INSERT INTO croupier_game.shared_table_configs')) { state.configs[values[0] + ':' + values[1]] = clone(values[2]); return { rows: [], rowCount: 1 }; }
          if (sql.includes('INSERT INTO croupier_game.shared_table_config_heads')) { state.heads[values[0]] = values[1]; return { rows: [], rowCount: 1 }; }
          if (sql.includes('SELECT body FROM croupier_game.shared_table_configs')) {
            const body = state.configs[values[0] + ':' + values[1]]; return { rows: body ? [{ body: JSON.stringify(body) }] : [] };
          }
          if (sql.includes('SELECT version FROM croupier_game.shared_table_config_heads')) return { rows: state.heads[values[0]] ? [{ version: state.heads[values[0]] }] : [] };
          if (sql.includes('SELECT id FROM croupier_game.players')) return { rows: [{ id: values[0] }] };
          return { rows: [{ client: this.id }], rowCount: 1, fields: [] };
        },
        release() { assert.equal(this.released, false); this.released = true; },
      };
      clients.push(client); return client;
    },
  };
  const storage = createPostgresStore({ pool });
  const repository = createStudioRepository({ pool, scope });
  const table = createPostgresTableStore({ pool: storage.gamePool, walletMode: 'demo' });
  const plan = { global: false, rooms: ['room-b', 'room-a'], players: ['bob', 'alice'] };
  const publish = () => table.runLocked(plan, tx => tx.publishConfig('room-a', 'v1', { language: 'en' }));
  return { pool, storage, repository, table, plan, publish, clients, calls, committed: () => committed };
}

test('one explicit runner owns G then S then sorted R/P/A, both auth schemas, protected reads and one commit', async () => {
  const h = fixture();
  const result = await h.repository.sharedTransaction(async () => {
    h.storage.db.assertSharedTransaction({ studioScope: scope, serialize: true });
    h.storage.boDb.assertSharedTransaction({ studioScope: scope, serialize: true });
    await h.publish();
    await h.storage.db.prepare('SELECT digest FROM player_sessions WHERE digest=? FOR SHARE').get('digest');
    await h.storage.boDb.prepare('SELECT id FROM users WHERE id=? FOR SHARE').get('user');
    const version = await h.table.runLocked(h.plan, tx => tx.config.latest('room-a'));
    const client = await h.storage.gamePool.query('SELECT id FROM players WHERE id=$1', ['alice']);
    await h.repository.withTransactionClient(sql => sql.query('SELECT $1::text,$2::text', [scope.environment, scope.workspaceId]));
    return { version, actor: client.rows[0].id };
  }, { serialize: true });
  assert.deepEqual(result, { version: 'v1', actor: 'alice' });
  assert.equal(h.clients.length, 1); assert.equal(h.clients[0].released, true);
  assert.equal(h.calls.filter(call => call.sql.startsWith('BEGIN')).length, 1);
  assert.equal(h.calls.filter(call => call.sql === 'COMMIT').length, 1);
  const locks = h.calls.filter(call => call.sql.includes('pg_advisory_xact_lock') || call.sql.includes('FOR UPDATE'));
  assert.equal(locks[0].sql, 'SELECT pg_advisory_xact_lock(1129467984)');
  const scopeHash = createHash('sha256').update('croupier-studio\0' + JSON.stringify(scope)).digest();
  assert.deepEqual(locks[1].values, [scopeHash.readInt32BE(0), scopeHash.readInt32BE(4)]);
  assert.deepEqual(locks.slice(2).map(call => call.values), [tableLock('room', 'room-a'), tableLock('room', 'room-b'), ['alice'], ['bob'], tableLock('audit', 'global')]);
  assert.ok(h.calls.some(call => call.sql.includes('FROM croupier_game.player_sessions')));
  assert.ok(h.calls.some(call => call.sql.includes('FROM croupier_auth.users')));
});

test('domain and response-projection failures preserve identity and roll back table changes', async () => {
  for (const error of [new TableError('STALE_COMMAND', 'stale'), new TypeError('invalid response projection')]) {
    const h = fixture();
    await assert.rejects(h.repository.sharedTransaction(async () => { await h.publish(); throw error; }, { serialize: true }), value => value === error);
    assert.deepEqual(h.committed(), { configs: {}, heads: {} });
    assert.equal(h.calls.at(-1).sql, 'ROLLBACK'); assert.equal(h.clients.length, 1);
  }
});

test('caught SQL and facade-scope errors poison the complete shared unit', async () => {
  for (const fail of [
    h => h.storage.boDb.prepare('SELECT test_sql_failure').get(),
    h => h.repository.withTransactionClient(client => client.query('SELECT $1,$2', ['other', scope.workspaceId])),
    h => h.storage.db.transaction(() => {}, { studioScope: {} }),
    h => h.storage.db.prepare('COMMIT').run(),
    h => h.storage.gamePool.connect(),
    h => h.table.runLocked({ rooms: [], players: [null] }, () => {}),
  ]) {
    const h = fixture();
    await assert.rejects(h.repository.sharedTransaction(async () => {
      await h.publish(); try { await fail(h); } catch {}
    }, { serialize: true }));
    assert.deepEqual(h.committed(), { configs: {}, heads: {} });
    assert.equal(h.calls.at(-1).sql, 'ROLLBACK');
  }
});

test('a failed savepoint rollback remains an infrastructure failure, not a recoverable lock retry', async () => {
  const rollbackSavepointError = Object.assign(new Error('rollback connection lost'), { code: '08006' });
  const h = fixture({ rollbackSavepointError });
  await assert.rejects(h.repository.sharedTransaction(() => h.table.runLocked(h.plan, () => {
    throw new LockSetExceeded({ rooms: ['room-c'] });
  }), { serialize: true }), error => error === rollbackSavepointError);
  assert.equal(h.calls.at(-1).sql, 'ROLLBACK');
  assert.equal(h.clients.length, 1);
});

test('foreign pools and scope mismatches cannot create a second transaction', async () => {
  for (const fail of [
    (h, other) => other.storage.db.prepare('SELECT 1').get(),
    h => h.storage.db.assertSharedTransaction({ studioScope: { ...scope, workspaceId: 'foreign' }, serialize: true }),
    h => h.storage.db.transaction(() => {}, { serialize: false, studioScope: { ...scope, workspaceId: 'foreign' } }),
  ]) {
    const h = fixture(), other = fixture();
    await assert.rejects(h.repository.sharedTransaction(async () => { try { await fail(h, other); } catch {} }, { serialize: true }));
    assert.equal(h.clients.length, 1); assert.equal(other.clients.length, 0); assert.equal(h.calls.at(-1).sql, 'ROLLBACK');
  }
  const h = fixture();
  assert.throws(() => h.storage.db.assertSharedTransaction({ studioScope: scope, serialize: true }));
  assert.equal(h.clients.length, 0);
});

test('nested G/S, readonly and lock-plan escalation fail closed', async () => {
  for (const fail of [
    h => h.storage.db.transaction(() => {}),
    h => h.repository.sharedTransaction(() => {}, { serialize: true }),
    h => h.storage.boDb.assertSharedTransaction({ studioScope: scope, serialize: true }),
  ]) {
    const h = fixture();
    await assert.rejects(h.repository.sharedTransaction(async () => { try { await fail(h); } catch {} }));
    assert.equal(h.clients.length, 1); assert.equal(h.calls.at(-1).sql, 'ROLLBACK');
  }
  const h = fixture();
  await assert.rejects(h.repository.transaction(() => h.repository.sharedTransaction(() => {}), { readOnly: true }));
  assert.equal(h.clients.length, 1); assert.equal(h.calls.at(-1).sql, 'ROLLBACK');
  const widened = fixture();
  await assert.rejects(widened.repository.sharedTransaction(async () => {
    await widened.publish();
    await widened.table.runLocked({ ...widened.plan, rooms: ['room-c'] }, () => {});
  }, { serialize: true }), /lock escalation/);
  assert.deepEqual(widened.committed(), { configs: {}, heads: {} });
});

test('shared runner cannot begin inside an unrelated owned storage or table transaction', async () => {
  for (const outer of [
    (h, work) => h.storage.db.transaction(work),
    (h, work) => h.table.runLocked(h.plan, work),
  ]) {
    const h = fixture();
    await assert.rejects(outer(h, async () => { try { await h.repository.sharedTransaction(() => {}); } catch {} }));
    assert.equal(h.clients.length, 1); assert.equal(h.calls.at(-1).sql, 'ROLLBACK');
  }
});

test('a lock-plan retry rolls back its savepoint and can reacquire R/P/A without another checkout', async () => {
  const h = fixture();
  await h.repository.sharedTransaction(async () => {
    await assert.rejects(h.table.runLocked(h.plan, async tx => {
      await tx.publishConfig('room-a', 'failed', { language: 'en' });
      throw new LockSetExceeded({ rooms: ['room-a'] });
    }), LockSetExceeded);
    await h.publish();
  }, { serialize: true });
  assert.equal(h.clients.length, 1);
  assert.deepEqual(Object.keys(h.committed().configs), ['room-a:v1']);
  assert.equal(h.calls.filter(call => call.sql.startsWith('ROLLBACK TO SAVEPOINT')).length, 1);
  assert.equal(h.calls.filter(call => call.sql === 'SELECT pg_advisory_xact_lock($1::integer,$2::integer)').length, 6);
});

test('escaped auth, facade and table callbacks cannot use a released client or open another', async () => {
  const h = fixture(); let escaped, delayed;
  await h.repository.sharedTransaction(async () => {
    await h.table.runLocked(h.plan, tx => { escaped = tx; });
    delayed = turn().then(() => h.storage.db.prepare('SELECT 1').get()).catch(error => error);
  }, { serialize: true });
  assert.match((await delayed).message, /closed/);
  await assert.rejects(escaped.config.latest('room-a'), /escaped|closed/);
  assert.equal(h.clients.length, 1);
});

test('commit failures never return a successful protected result', async () => {
  for (const options of [{ commitError: new Error('commit failed') }, { commitRollback: true }]) {
    const h = fixture(options);
    await assert.rejects(h.repository.sharedTransaction(async () => { await h.publish(); return { ok: true }; }, { serialize: true }));
    assert.deepEqual(h.committed(), { configs: {}, heads: {} });
    assert.equal(h.clients[0].released, true);
  }
});

test('without the explicit runner existing independent adapter transactions stay independent', async () => {
  const h = fixture();
  await h.repository.transaction(() => h.storage.db.prepare('SELECT 1').get());
  assert.equal(h.clients.length, 2);
  assert.equal(h.calls.filter(call => call.sql === 'COMMIT').length, 2);
});

test('an ordinary repository transaction cannot upgrade into a shared transaction', async () => {
  const h = fixture();
  await assert.rejects(h.repository.transaction(() => h.repository.sharedTransaction(() => {})), /escalation|shared|transaction/i);
  assert.equal(h.clients.length, 1);
  assert.equal(h.calls.at(-1).sql, 'ROLLBACK');
});

test('escaped shared work is already closed while an acknowledged COMMIT promise is deferred', async () => {
  const commitGate = { entered: deferred(), resume: deferred() }, h = fixture({ commitGate });
  let escaped;
  const pending = h.repository.sharedTransaction(() => {
    escaped = commitGate.entered.promise.then(() => h.storage.db.prepare('SELECT 1').get()).catch(error => error);
  }, { serialize: true });
  await commitGate.entered.promise;
  try {
    assert.match((await escaped).message, /closed/);
    assert.equal(h.clients.length, 1);
    assert.equal(h.calls.at(-1).sql, 'COMMIT');
  } finally { commitGate.resume.resolve(); }
  await pending;
});

test('ports captured from a rolled-back attempt cannot write after a successful retry', async () => {
  const h = fixture(); let captured;
  await assert.rejects(h.repository.sharedTransaction(async () => {
    await assert.rejects(h.table.runLocked(h.plan, tx => {
      captured = tx; throw new LockSetExceeded({ rooms: ['room-c'] });
    }), LockSetExceeded);
    await h.publish();
    try { await captured.publishConfig('room-a', 'leaked', { language: 'en' }); } catch {}
  }, { serialize: true }), /closed|inactive|expired/i);
  assert.ok(!h.calls.some(call => call.values.includes('leaked')));
  assert.deepEqual(h.committed(), { configs: {}, heads: {} });
});
