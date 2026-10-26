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

test('isolated SQL evidence binds the actual draft suite imports and immutable migration', async () => {
  const { STUDIO_ISOLATED_QA_SOURCES } = await import('../tools/studio-isolated-qa.mjs');
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { relative } = await import('node:path');
  const root = new URL('../', import.meta.url), suite = new URL('./partner-branding-postgres.mjs', import.meta.url);
  const fixture = new URL('../apps/studio/test/fixtures/cloud-presentation.mjs', import.meta.url);
  const runtimeFixture = new URL('./fixtures/studio-runtime-sql-checks.mjs', import.meta.url);
  const runtimeImporter = new URL('../ops/neon-studio/runtime-media-import.mjs', import.meta.url);
  const required = ['ops/neon-studio/007-partner-branding-drafts.sql', 'test/partner-branding-postgres.mjs',
    'ops/neon-studio/020-extended-presentation.sql', 'packages/presentation/server/presentation-storage.mjs',
    'packages/presentation/contracts/media-timing.mjs',
    'packages/presentation/contracts/room-game-config.mjs',
    'ops/neon-studio/012-runtime-media-catalog.sql', 'test/fixtures/studio-runtime-sql-checks.mjs',
    'media/layout.json','media/blob-index.json','media/catalog/presentation.json','media/catalog/legacy.json',
    'packages/studio-access/studio-native-auth.mjs', 'packages/studio-access/studio-access-policy.mjs',
    'packages/studio-access/studio-scope.mjs', 'packages/studio-access/account-role.mjs',
    'packages/studio-access/server/account-credentials.mjs', 'packages/studio-access/server/craig-identity.mjs', 'packages/studio-access/server/bo-auth-epoch.mjs', 'packages/studio-access/server/partner-access-policy.mjs',
    'packages/studio-access/display-name.mjs',
    'packages/operators/contracts/branding.mjs', 'apps/studio/lib/partner-branding-api.mjs', 'apps/studio/test/fixtures/cloud-presentation.mjs'];
  for (const entry of [suite,fixture,runtimeFixture,runtimeImporter]) {
    const source = await readFile(entry,'utf8');
    for (const [,path] of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      if (path.startsWith('.')) required.push(relative(fileURLToPath(root),fileURLToPath(new URL(path,entry))).replaceAll('\\','/'));
    }
  }
  assert.equal(new Set(STUDIO_ISOLATED_QA_SOURCES).size,STUDIO_ISOLATED_QA_SOURCES.length,'each source has one receipt hash');
  for (const path of required) assert.ok(STUDIO_ISOLATED_QA_SOURCES.includes(path),`SQL evidence must hash ${path}`);
});

test('disposable runtime copy can load the native frozen-material and storage dependency chain', async t => {
  const { copyOpenClawRuntime } = await import('./fixtures/copy-openclaw-runtime.mjs');
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { basename, dirname, join, resolve } = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const root = await mkdtemp(join(tmpdir(),'croupier-runtime-import-'));
  t.after(async () => {
    assert.equal(dirname(resolve(root)),resolve(tmpdir()));
    assert.ok(basename(root).startsWith('croupier-runtime-import-'));
    await rm(root,{recursive:true,force:true});
  });
  await copyOpenClawRuntime(root);
  const load = file => import(pathToFileURL(join(root,file)).href);
  const publication = await load('packages/presentation/server/presentation-package.mjs');
  const material = await load('packages/presentation/server/native-room-game-material.mjs');
  const budget = await load('packages/presentation/contracts/native-room-game-budget.mjs');
  const storage = await load('packages/studio-registry/server/storage-contract.mjs');
  const operators = await load('packages/operators/server/operator-store.mjs');
  assert.equal(publication.readPackagePresentation({branding:{}}),null);
  assert.throws(()=>material.resolveNativeRoomGameMaterial({}),{code:'studio_room_game_material_unavailable'});
  assert.equal(typeof budget.assertNativeRoomSequenceBudget,'function');
  assert.equal(typeof storage.validateStudioMedia,'function');
  assert.equal(typeof operators.createOperatorStore,'function');
});
