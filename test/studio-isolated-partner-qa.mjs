import test from 'node:test';
import assert from 'node:assert/strict';
import { runPartnerDatabaseQa } from '../tools/studio-isolated-qa.mjs';

function fixture(targetPatch = {}) {
  const target = { address: '127.0.0.1', role: 'studio_qa', database: 'postgres', listeners: '127.0.0.1', port: 55499, ...targetPatch };
  const sql = [], pools = [];
  const adminPool = { async query(statement) { sql.push(statement); return { rows: [target] }; } };
  const createPool = options => {
    const pool = { options, ended: false, async end() { assert.equal(pool.ended, false, 'a fixture pool closes once'); pool.ended = true; } };
    pools.push(pool); return pool;
  };
  return { adminPool, pgPort: 55499, createPool, sql, pools };
}

test('partner SQL acceptance rejects an unexpected target before creating databases', async () => {
  for (const patch of [{ address: '192.0.2.9' }, { listeners: '*' }, { role: 'production' }, { database: 'game' }, { port: 5432 }]) {
    const f = fixture(patch);
    await assert.rejects(runPartnerDatabaseQa({ ...f, restartCluster() {}, runChecks() {} }), /partner_qa_target_refused/);
    assert.equal(f.sql.length, 1); assert.equal(f.pools.length, 0);
  }
});

test('partner SQL acceptance uses separate new pools and closes both around the actual cluster restart', async () => {
  const f = fixture(); let restarts = 0;
  const checks = await runPartnerDatabaseQa({ ...f, restartCluster: async () => {
    assert.equal(f.pools.length, 2); assert.ok(f.pools.every(pool => pool.ended)); restarts++;
  }, runChecks: async ({ operatorPool, authPool, restart }) => {
    assert.notEqual(operatorPool, authPool);
    assert.equal(operatorPool.options.database, 'n2_qa_operators'); assert.equal(authPool.options.database, 'n2_qa_auth');
    assert.ok(f.pools.every(pool => pool.options.max === 4 && pool.options.host === '127.0.0.1' && pool.options.user === 'studio_qa' && pool.options.port === 55499));
    const reopened = await restart();
    assert.notEqual(reopened.operatorPool, operatorPool); assert.notEqual(reopened.authPool, authPool);
    assert.equal(reopened.operatorPool.ended, false); assert.equal(reopened.authPool.ended, false);
    return { checks: ['competing last administrator writes', 'journal survives database restart'] };
  } });
  assert.equal(restarts, 1); assert.equal(f.pools.length, 4); assert.ok(f.pools.every(pool => pool.ended));
  assert.deepEqual(f.sql.slice(1), ['CREATE DATABASE n2_qa_operators', 'CREATE DATABASE n2_qa_auth']);
  assert.deepEqual(checks, ['competing last administrator writes', 'journal survives database restart']);
});

test('a stale fixture database is refused rather than reused or cleared', async () => {
  const f = fixture(); const query = f.adminPool.query;
  f.adminPool.query = async sql => { if (sql === 'CREATE DATABASE n2_qa_operators') throw Error('database already exists'); return query(sql); };
  await assert.rejects(runPartnerDatabaseQa({ ...f, restartCluster() {}, runChecks() {} }), /database already exists/);
  assert.equal(f.pools.length, 0);
});

test('failed acceptance and absent execution evidence cannot pass and always close their pools', async () => {
  for (const runChecks of [async () => { throw Error('real SQL failed'); }, async () => ({ checks: [] })]) {
    const f = fixture(); await assert.rejects(runPartnerDatabaseQa({ ...f, restartCluster() {}, runChecks }));
    assert.equal(f.pools.length, 2); assert.ok(f.pools.every(pool => pool.ended));
  }
});

test('failure while opening the second pool releases the first pool', async () => {
  const f = fixture(); let calls = 0;
  await assert.rejects(runPartnerDatabaseQa({ ...f, createPool: options => {
    if (++calls === 2) throw Error('auth pool unavailable'); return f.createPool(options);
  }, restartCluster() {}, runChecks() {} }), /auth pool unavailable/);
  assert.equal(f.pools.length, 1); assert.equal(f.pools[0].ended, true);
});
