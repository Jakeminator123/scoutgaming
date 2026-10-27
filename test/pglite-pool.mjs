import test from 'node:test';
import assert from 'node:assert/strict';
import { createPglitePool, createPgliteStore } from './fixtures/pglite-pool.mjs';

// Pins the local PostgreSQL double that module tests rely on, so a PGlite upgrade
// cannot silently change what those tests prove.
test('PGlite store installs the product schema as ready and returns pg-shaped rows', async t => {
  const store = await createPgliteStore(); t.after(() => store.close());
  await store.db.assertInstalled();
  const raw = await store.pool.query('SELECT 9007199254740993::int8 AS big, 1.5::numeric AS num, 2 AS small, true AS flag');
  assert.deepEqual(raw.rows, [{ big: '9007199254740993', num: '1.5', small: 2, flag: true }], 'int8/numeric stay strings as in pg');
  assert.equal(raw.command, 'SELECT'); assert.equal(raw.rowCount, 1);
  const multi = await store.pool.query('SELECT 1; SELECT 2');
  assert.ok(Array.isArray(multi) && multi.length === 2, 'no values: simple protocol, one result per statement');
  await store.db.prepare('INSERT INTO players (id,name,created_at) VALUES (?,?,?)').run('p', 'n', 'x');
  assert.deepEqual(await store.db.prepare('SELECT balance, account_epoch FROM players').get(), { balance: 1000, account_epoch: 0 });
  for (const table of ['shared_table_rooms', 'roulette_tables']) assert.equal((await store.pool.query(`SELECT to_regclass('croupier_game.${table}') AS t`)).rows[0].t, `croupier_game.${table}`, 'forward migrations applied');
});

test('failed and swallowed-error transactions roll back like PostgreSQL', async t => {
  const store = await createPgliteStore(); t.after(() => store.close());
  await store.db.prepare('INSERT INTO players (id,name,created_at) VALUES (?,?,?)').run('p', 'n', 'x');
  await assert.rejects(store.db.transaction(async () => {
    await store.db.prepare('UPDATE players SET balance=0').run(); throw Error('work failed');
  }), /work failed/);
  // An error caught inside the transaction aborts it; COMMIT then reports ROLLBACK.
  await assert.rejects(store.db.transaction(async () => {
    await store.db.prepare('UPDATE players SET balance=1').run();
    await store.db.prepare('SELECT 1/0').get().catch(() => {});
  }), /rolled back/);
  assert.equal((await store.db.prepare('SELECT balance FROM players').get()).balance, 1000);
});

test('one session: clients are serialized and a nested checkout fails instead of hanging', async t => {
  const pool = await createPglitePool({ waitMs: 200 }); t.after(() => pool.end());
  const order = [];
  const first = await pool.connect();
  await first.query('BEGIN');
  const queued = pool.query('SELECT 1').then(() => order.push('query'));
  await new Promise(resolve => setTimeout(resolve, 50));
  order.push('commit'); await first.query('COMMIT'); await first.release();
  await queued; assert.deepEqual(order, ['commit', 'query']);
  const held = await pool.connect();
  await assert.rejects(pool.connect(), /pglite_pool_wait_timeout/);
  await held.release();
  assert.equal((await pool.query('SELECT 1 AS one')).rows[0].one, 1, 'an abandoned wait does not wedge the queue');
  const leaked = await pool.connect(); await leaked.query('BEGIN'); await leaked.release();
  assert.equal(pool.pglite.isInTransaction(), false, 'a client released mid-transaction is rolled back');
});
