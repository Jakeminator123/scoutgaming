import test from 'node:test';
import assert from 'node:assert/strict';
import { createOperatorPackageReader, OPERATOR_PACKAGE_CACHE_MAX_MS } from '../web/storage/operator-package-reader.mjs';
import { operatorPackageSql as memorySql, operatorRow, packageRow } from './fixtures/operator-package-sql.mjs';

const scope = { environment: 'qa', workspaceId: 'workspace-north' };
const other = { environment: 'qa', workspaceId: 'workspace-south' };

function fixture(options = {}) {
  const db = memorySql({
    operators: [operatorRow(scope, 'sg-test', 'sg-test'), operatorRow(scope, 'empty-op', 'empty-op'),
      operatorRow(scope, 'paused', 'paused', 'suspended'), operatorRow(other, 'south-only', 'south-only')],
    packages: [packageRow(scope, 'sg-test', 1, ['beta']), packageRow(scope, 'sg-test', 2, ['mobile-phone'], '{"felt":"#0a5"}'),
      packageRow(other, 'south-only', 1, ['mobile-phone'])],
  });
  const logs = [];
  let clock = 1_000_000;
  const reader = createOperatorPackageReader({ sql: db.sql, scope, now: () => clock, log: (...line) => logs.push(line), ...options });
  return { db, logs, reader, advance: ms => { clock += ms; } };
}

test('reads the latest package revision for an active operator in the bound scope', async () => {
  const { reader, logs } = fixture();
  const found = await reader.resolve('sg-test');
  assert.deepEqual(found.operator, { id: 'sg-test', slug: 'sg-test' });
  assert.equal(found.package.revision, 2);
  assert.deepEqual([...found.package.lanes], ['mobile-phone']);
  assert.deepEqual({ ...found.package.branding }, { felt: '#0a5' });
  assert.deepEqual(found.package.scope, scope);
  assert.ok(Object.isFrozen(found) && Object.isFrozen(found.package));
  assert.deepEqual(logs, []);
});

test('missing package is null; unknown, suspended or other-scope slugs have no operator', async () => {
  const { reader, db, logs } = fixture();
  assert.deepEqual(await reader.resolve('empty-op'), { operator: { id: 'empty-op', slug: 'empty-op' }, package: null });
  for (const slug of ['nobody', 'paused', 'south-only']) assert.deepEqual(await reader.resolve(slug), { operator: null, package: null });
  // Suspended operators are not looked up further; no package read happens for them.
  assert.equal(db.calls.filter(tag => tag === 'current-package').length, 1);
  const before = db.calls.length;
  for (const slug of ['', 'Bad', 'play', 'a'.repeat(64), null]) assert.deepEqual(await reader.resolve(slug), { operator: null, package: null });
  assert.equal(db.calls.length, before, 'an invalid slug never reaches the database');
  assert.deepEqual(logs, []);
});

test('sql failure returns null with one log line per failure period, never the database error', async () => {
  const { reader, db, logs } = fixture();
  db.state.fail = Object.assign(new Error('connection to secret-host.neon.tech refused'), { code: 'ECONNREFUSED' });
  assert.equal(await reader.resolve('sg-test'), null);
  assert.equal(await reader.resolve('sg-test'), null, 'failures are not cached');
  assert.equal(await reader.resolve('empty-op'), null);
  assert.equal(logs.length, 1);
  assert.deepEqual(logs[0], ['[operator-package] read failed; game entry keeps the saved lane catalogue', 'studio_storage_unavailable']);
  assert.ok(!JSON.stringify(logs).includes('secret-host'));
  db.state.fail = null;
  assert.equal((await reader.resolve('sg-test')).package.revision, 2);
  db.state.fail = new Error('again');
  assert.equal(await reader.resolve('empty-op'), null);
  assert.equal(logs.length, 2, 'a new failure after recovery is logged again');
});

test('corrupt stored package fails closed to null instead of a partial context', async () => {
  const db = memorySql({ operators: [operatorRow(scope, 'sg-test', 'sg-test')],
    packages: [{ ...packageRow(scope, 'sg-test', 1, ['mobile-phone']), lanes: '["mobile-phone", "beta"]' }] });
  const logs = [];
  const reader = createOperatorPackageReader({ sql: db.sql, scope, log: (...line) => logs.push(line) });
  assert.equal(await reader.resolve('sg-test'), null);
  assert.deepEqual(logs, [['[operator-package] read failed; game entry keeps the saved lane catalogue', 'studio_corrupt_operator']]);
});

test('a slow read times out to null', async () => {
  const { reader, db, logs } = fixture({ timeoutMs: 20 });
  db.state.delayMs = 200;
  assert.equal(await reader.resolve('sg-test'), null);
  assert.deepEqual(logs, [['[operator-package] read failed; game entry keeps the saved lane catalogue', 'studio_operator_package_timeout']]);
});

test('successful reads are cached per slug for at most 30 s and shared while in flight', async () => {
  assert.equal(OPERATOR_PACKAGE_CACHE_MAX_MS, 30_000);
  for (const ttlMs of [30_001, -1, Number.NaN]) assert.throws(() => createOperatorPackageReader({ sql: () => [], scope, ttlMs }));
  const { reader, db, advance } = fixture();
  const [first, second] = await Promise.all([reader.resolve('sg-test'), reader.resolve('sg-test')]);
  assert.equal(first, second);
  assert.deepEqual(db.calls, ['operator-by-slug', 'current-package']);
  advance(29_999);
  await reader.resolve('sg-test');
  await reader.resolve('nobody');
  await reader.resolve('nobody');
  assert.deepEqual(db.calls, ['operator-by-slug', 'current-package', 'operator-by-slug']);
  advance(1);
  await reader.resolve('sg-test');
  assert.deepEqual(db.calls.slice(3), ['operator-by-slug', 'current-package']);
  const uncached = fixture({ ttlMs: 0 });
  await uncached.reader.resolve('sg-test');
  await uncached.reader.resolve('sg-test');
  assert.equal(uncached.db.calls.length, 4);
});

test('the cache stays bounded when many slugs are probed', async () => {
  const { reader, db } = fixture();
  for (let index = 0; index < 300; index += 1) await reader.resolve(`probe-${index}`);
  const before = db.calls.length;
  await reader.resolve('probe-0');
  assert.equal(db.calls.length, before + 1, 'the oldest entry was evicted');
  await reader.resolve('probe-299');
  assert.equal(db.calls.length, before + 1, 'recent entries stay cached');
});

test('an invalid scope or store failure falls back without throwing', async () => {
  const logs = [];
  const reader = createOperatorPackageReader({ sql: () => [], scope: { environment: 'BAD', workspaceId: 'x' }, log: (...line) => logs.push(line) });
  assert.equal(await reader.resolve('sg-test'), null);
  assert.deepEqual(logs, [['[operator-package] read failed; game entry keeps the saved lane catalogue', 'studio_invalid_scope']]);
  let attempts = 0;
  const flaky = createOperatorPackageReader({ sql: memorySql().sql, scope, log: () => {}, storeFactory: async () => { attempts += 1; throw new Error('boom'); } });
  assert.equal(await flaky.resolve('sg-test'), null);
  assert.equal(await flaky.resolve('sg-test'), null);
  assert.equal(attempts, 2, 'a failed store construction is retried, not cached');
});
