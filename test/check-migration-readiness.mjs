import { fixtureDatabaseUrl } from './fixtures/database-url.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkMigrationReadiness, readinessOutput } from '../tools/check-migration-readiness.mjs';
import { GameMigrationError } from '../ops/neon-game/migrations.mjs';

const script = fileURLToPath(new URL('../tools/check-migration-readiness.mjs', import.meta.url));
const cliEnv = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, PATHEXT: process.env.PATHEXT };

const secret = fixtureDatabaseUrl('postgres://ep-example.neon.tech/croupier', 'migrator');

function fakePool(canned) {
  const client = {
    async query(sql) {
      const marker = /\/\* studio-migrations:([a-z-]+) \*\//.exec(String(sql))?.[1];
      if (marker && Object.hasOwn(canned, marker)) return { rows: canned[marker], command: 'SELECT' };
      throw new Error('unexpected query');
    },
    release() {},
  };
  return { async connect() { return client; }, async end() {} };
}

function assertNoSecret(value) {
  const json = JSON.stringify(value);
  assert.equal(json.includes('postgres://'), false);
  assert.equal(json.includes('@'), false);
}

test('an empty pending ledger is ready and the JSON omits the connection string', async () => {
  const pool = fakePool({
    target: [{ database: 'croupier', role: 'app', address: secret, port: 5432 }],
  });
  const result = await checkMigrationReadiness({
    pool,
    plan: async ({ pool: given }) => {
      const client = await given.connect();
      const row = (await client.query('/* studio-migrations:target */ SELECT current_database() AS database, current_user AS role')).rows[0];
      client.release();
      return {
        target: row,
        applied: ['001', '002', '003', '004', '005'].map(version => ({ version, checksum: secret })),
        pending: [],
        leak: secret,
      };
    },
  });
  assert.equal(result.ready, true);
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.applied, ['001', '002', '003', '004', '005']);
  assert.deepEqual(result.pending, []);
  assert.deepEqual(result.optionalPending, []);
  assert.equal(result.database, 'croupier');
  assert.equal(result.role, 'app');
  assertNoSecret(result);
});

test('an explicit future optional 016 planner fixture never blocks readiness',async()=>{
  // Synthetic planner output only; 016 is not registered as a product migration.
  const required=['001','002','003','004','005','006','007','008','011','012','013','014','015'];
  for(const installed of [false,true]){
    const applied=[...required,...(installed?['016']:[])];
    const result=await checkMigrationReadiness({plan:async()=>({
      target:{database:'croupier',role:'app',address:secret},
      applied:applied.map(version=>({version,checksum:secret})),pending:[],
      optionalPending:installed?[]:[{version:'016',file:'016-future-optional-fixture.sql',checksum:secret}],
    })});
    assert.equal(result.ready,true);assert.equal(result.exitCode,0);assert.deepEqual(result.applied,applied);
    assert.deepEqual(result.pending,[]);assert.deepEqual(result.optionalPending,installed?[]:['016']);assertNoSecret(result);
  }
});

test('012 runtime cutover blocks readiness until the required ledger is installed', async()=>{
  for(const applied012 of [false,true]) {
    const versions=['001','002','003','004','005','006','007','008','011',...(applied012?['012']:[])];
    const result=await checkMigrationReadiness({plan:async()=>({target:{database:'croupier_game',role:'app'},
      applied:versions.map(version=>({version})),pending:applied012?[]:[{version:'012'}],optionalPending:[]})});
    assert.equal(result.ready,applied012);assert.equal(result.exitCode,applied012?0:1);assert.deepEqual(result.applied,versions);
    assert.deepEqual(result.pending,applied012?[]:['012']);assert.deepEqual(result.optionalPending,[]);
    if(!applied012)assert.match(result.message,/Migration studio-012 saknas/);
  }
});

test('013 admission storage is required and named in a failed readiness report',async()=>{
  for(const present of [false,true]){
    const applied=['001','002','003','004','005','006','007','008','011','012',...(present?['013']:[])];
    const report=await checkMigrationReadiness({plan:async()=>({target:{database:'croupier_game',role:'app'},
      applied:applied.map(version=>({version})),pending:present?[]:[{version:'013'}],optionalPending:[]})});
    assert.equal(report.ready,present);assert.equal(report.exitCode,present?0:1);
    assert.deepEqual(report.pending,present?[]:['013']);assert.deepEqual(report.optionalPending,[]);
    if(!present)assert.match(report.message,/Migration studio-013 saknas/);
  }
});

test('pending 005 is not ready and the message names 005', async () => {
  const pool = fakePool({
    ledger: [
      { version: '001', checksum: secret },
      { version: '002', checksum: secret },
      { version: '003', checksum: secret },
      { version: '004', checksum: secret },
    ],
  });
  const result = await checkMigrationReadiness({
    pool,
    plan: async ({ pool: given }) => {
      const client = await given.connect();
      const rows = (await client.query('/* studio-migrations:ledger */ SELECT version,checksum FROM croupier_studio.storage_migrations')).rows;
      client.release();
      const applied = rows.map(row => row.version);
      const pending = ['001', '002', '003', '004', '005'].filter(version => !applied.includes(version));
      return {
        target: { database: 'croupier', role: 'app', address: secret },
        applied: applied.map(version => ({ version, checksum: secret })),
        pending: pending.map(version => ({ version, file: `${version}.sql`, checksum: secret })),
      };
    },
  });
  assert.equal(result.ready, false);
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.pending, ['005']);
  assert.match(result.message, /005/);
  assertNoSecret(result);
});

test('cli exits 2 when the database env is missing or the host is not neon', () => {
  const missing = spawnSync(process.execPath, [script], { env: cliEnv, encoding: 'utf8', timeout: 5000 });
  assert.equal(missing.status, 2);
  assert.equal(missing.stdout, '');
  assert.equal(missing.stderr.trim(), 'migration_check_unconfigured');
  const empty = spawnSync(process.execPath, [script], {
    env: { ...cliEnv, CROUPIER_GAME_DATABASE_URL: '' },
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.equal(empty.status, 2);
  assert.equal(empty.stdout, '');
  assert.equal(empty.stderr.trim(), 'migration_check_unconfigured');
  const rejected = spawnSync(process.execPath, [script], {
    env: { ...cliEnv, CROUPIER_GAME_DATABASE_URL: 'postgres://u:p@localhost/db' },
    encoding: 'utf8',
    timeout: 2000,
  });
  assert.equal(rejected.status, 2);
  assert.equal(rejected.stdout, '');
  assert.equal(rejected.stderr.trim(), 'migration_check_host_rejected');
  assertNoSecret(rejected.stderr);
});

test('the host guard rejects a non-neon URL before planning', async () => {
  let planned = false;
  const result = await checkMigrationReadiness({
    connectionString: 'postgres://u:p@localhost/db',
    pool: { async connect() { throw new Error('postgres://u:p@localhost/db'); } },
    plan: async () => { planned = true; throw new Error(secret); },
  });
  assert.equal(planned, false);
  assert.equal(result.exitCode, 2);
  assert.equal(result.code, 'migration_check_host_rejected');
  assert.equal(result.ready, false);
  assertNoSecret(result);
});

test('a planner failure stays a safe code', async () => {
  const result = await checkMigrationReadiness({
    pool: fakePool({}),
    plan: async () => { throw new Error(`connect failed ${secret}`); },
  });
  assert.equal(result.exitCode, 2);
  assert.equal(result.code, 'migration_check_unreachable');
  assertNoSecret(result);
});

test('apply runs only when confirmation is exactly true', async () => {
  const calls = [];
  const plan = async () => ({
    target: { database: 'croupier', role: 'app', address: secret, port: 5432 },
    applied: [{ version: '001' }, { version: '002' }, { version: '003' }, { version: '004' }],
    pending: [{ version: '005', checksum: secret }],
  });
  const applyMigrations = async args => {
    calls.push({ confirm: args.confirm, database: args.expectedTarget.database });
    return {
      target: { database: 'croupier', role: 'app' },
      applied: ['001', '002', '003', '004', '005'].map(version => ({ version })),
      pending: [],
      appliedNow: ['005'],
    };
  };
  const refused = await checkMigrationReadiness({ pool: fakePool({}), plan, apply: true, confirm: false, applyMigrations });
  assert.equal(calls.length, 0);
  assert.equal(refused.exitCode, 2);
  assert.equal(refused.code, 'migration_check_confirm_required');
  const applied = await checkMigrationReadiness({ pool: fakePool({}), plan, apply: true, confirm: true, applyMigrations });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].confirm, true);
  assert.equal(calls[0].database, 'croupier');
  assert.deepEqual(applied.appliedNow, ['005']);
  assert.equal(applied.ready, true);
  assert.equal(applied.exitCode, 0);
  assertNoSecret(applied);
});

test('cli arguments accept --only/--skip lists and reject everything else', async () => {
  const { parseMigrationArgs } = await import('../tools/check-migration-readiness.mjs');
  assert.deepEqual(parseMigrationArgs([]), { apply: false, only: undefined, skip: undefined });
  assert.deepEqual(parseMigrationArgs(['--apply', '--only', '021']), { apply: true, only: ['021'], skip: undefined });
  assert.deepEqual(parseMigrationArgs(['--apply', '--only=018,019', '--skip', '016']), { apply: true, only: ['018', '019'], skip: ['016'] });
  assert.deepEqual(parseMigrationArgs(['--only', '018', '--only', '019']), { apply: false, only: ['018', '019'], skip: undefined });
  for (const args of [['--skip', '016'], ['--only'], ['--only', ''], ['--only', '21'], ['--only', '021,'], ['--apply', '--apply'], ['--force'], ['021']]) {
    assert.equal(parseMigrationArgs(args), null, args.join(' '));
  }
  const usage = spawnSync(process.execPath, [script, '--skip', '016'], { env: cliEnv, encoding: 'utf8', timeout: 5000 });
  assert.equal(usage.status, 2);
  assert.equal(usage.stdout, '');
  assert.equal(usage.stderr.trim(), 'migration_check_usage');
});

test('--only selection follows registry order, defers only skips and later versions, and names refused versions', async () => {
  const { selectPendingMigrations } = await import('../tools/check-migration-readiness.mjs');
  const registry = [
    { version: '015', tables: [], fingerprintTables: ['moving'] },
    { version: '016', deploymentOptional: true, tables: ['drift'] },
    { version: '018', deploymentOptional: true, tables: [], fingerprintTables: ['gpu'] },
    { version: '019', deploymentOptional: true, tables: [], fingerprintTables: ['moving', 'gpu'] },
    { version: '020', deploymentOptional: true, tables: [], fingerprintTables: ['packages'] },
    { version: '021', deploymentOptional: true, tables: ['materials'] },
  ];
  const base = { registry, pending: [], optionalPending: ['016', '018', '019', '020', '021'] };
  assert.deepEqual(selectPendingMigrations({ ...base, only: ['021'], skip: ['016', '018', '019', '020'] }),
    { ok: true, selected: ['021'], deferOptional: ['016', '018', '019', '020'] });
  // Earlier applied optional versions are not deferred: if they become pending again the runner refuses.
  assert.deepEqual(selectPendingMigrations({ ...base, optionalPending: ['018', '019', '020', '021'], only: ['018'] }),
    { ok: true, selected: ['018'], deferOptional: ['019', '020', '021'] });
  assert.deepEqual(selectPendingMigrations({ ...base, only: ['019', '018', '016'] }).selected, ['016', '018', '019']);
  const refused = (args, code, versions) => assert.deepEqual(selectPendingMigrations({ ...base, ...args }), { ok: false, code, versions });
  refused({ only: ['021'] }, 'migration_check_selection_order', ['016', '018', '019', '020']);
  refused({ only: ['019'], skip: ['016', '018'] }, 'migration_check_skip_conflict', ['018']);
  refused({ only: ['015'] }, 'migration_check_selection_not_pending', ['015']);
  refused({ pending: ['015'], only: ['016'] }, 'migration_check_required_pending', ['015']);
  refused({ pending: ['015'], only: ['016'], skip: ['015'] }, 'migration_check_skip_required', ['015']);
  refused({ only: ['016'], skip: ['018'] }, 'migration_check_skip_invalid', ['018']);
  refused({ only: ['022', '016'] }, 'migration_check_selection_unknown', ['022']);
  refused({ only: ['016', '016'] }, 'migration_check_selection_invalid', ['016']);
  refused({ only: [] }, 'migration_check_selection_invalid', []);
});

// Spel-ledgern (croupier_game.storage_migrations) bredvid Studios: samma nummer betyder olika
// migreringar, så rapporten namnger dem studio-NNN och game-NNN. PGlite-provet med båda
// ledgrarna i samma databas står i test/migration-ledgers.mjs.
const studioReady = async () => ({ target: { database: 'croupier_game', role: 'croupier_game', address: secret },
  applied: ['011', '012'].map(version => ({ version, checksum: secret })), pending: [], optionalPending: [{ version: '021' }] });

test('the game ledger joins readiness: a required game version blocks and is named game-NNN', async () => {
  const ready = await checkMigrationReadiness({ plan: studioReady,
    planGame: async () => ({ applied: ['game-product-v1', 'game-011', 'game-012'], pending: [], optionalPending: ['game-008'] }) });
  assert.equal(ready.ready, true); assert.equal(ready.exitCode, 0);
  assert.deepEqual(ready.game, { applied: ['game-product-v1', 'game-011', 'game-012'], pending: [], optionalPending: ['game-008'], ready: true });
  const line = readinessOutput(ready);
  assert.deepEqual(line.applied, ['studio-011', 'studio-012', 'game-product-v1', 'game-011', 'game-012']);
  assert.deepEqual(line.optionalPending, ['studio-021', 'game-008']);
  assert.equal(new Set(line.applied).size, line.applied.length, 'studio-012 and game-012 are two versions');
  assert.equal(line.applied.some(label => /^[0-9]{3}$/.test(label)), false);
  assertNoSecret(line);
  const blocked = await checkMigrationReadiness({ plan: studioReady,
    planGame: async () => ({ applied: [], pending: ['game-product-v1'], optionalPending: [] }) });
  assert.equal(blocked.ready, false); assert.equal(blocked.exitCode, 1);
  assert.deepEqual(blocked.pending, [], 'Studio itself has nothing pending');
  assert.match(blocked.message, /^Migration game-product-v1 saknas i måldatabasen/);
});

test('a game ledger failure is a safe exit 2 code and never runs a Studio apply', async () => {
  let applied = false;
  const applyMigrations = async () => { applied = true; throw new Error('must not run'); };
  for (const [planGame, code] of [
    [async () => { throw new GameMigrationError('game_migration_checksum_mismatch'); }, 'game_migration_checksum_mismatch'],
    [async () => { throw new GameMigrationError('game_migration_unknown_version'); }, 'game_migration_unknown_version'],
    [async () => { throw new Error(`connect failed ${secret}`); }, 'migration_check_unreachable'],
    [async () => ({ applied: ['012'], pending: [], optionalPending: [] }), 'migration_check_unreachable'],
    ['not a planner', 'migration_check_unreachable'],
  ]) {
    const result = await checkMigrationReadiness({ plan: studioReady, planGame, apply: true, confirm: true, applyMigrations });
    assert.equal(result.exitCode, 2); assert.equal(result.code, code); assertNoSecret(result);
  }
  assert.equal(applied, false);
});

test('the printed --only/--apply lists name Studio versions studio-NNN', () => {
  const line = readinessOutput({ database: 'croupier_game', role: 'croupier_game', applied: ['020'], pending: [], optionalPending: [],
    ready: true, selected: ['021'], appliedNow: ['021'], game: { applied: ['game-012'], pending: [], optionalPending: [] } }, { only: ['021'], apply: true });
  assert.deepEqual(line, { database: 'croupier_game', role: 'croupier_game', applied: ['studio-020', 'game-012'], pending: [], optionalPending: [],
    ready: true, selected: ['studio-021'], appliedNow: ['studio-021'] });
});

// L3 PR 4: the report's information line `paket utan rooms: N` (stderr beside the JSON line; it
// never blocks): companies whose current package has no rooms (Studio 023), per scope, as
// tools/republish-rooms.mjs runs per scope. Real PostgreSQL (PGlite) with every reviewed Studio migration.
test('readiness counts the companies whose current package has no rooms, per scope', async t => {
  const [{ createPglitePool }, { planStudioMigrations, applyStudioMigrations }, { createOperatorStore }, { countPackagesWithoutRooms, packageRoomsLine }] = await Promise.all([
    import('./fixtures/pglite-pool.mjs'), import('../ops/neon-studio/migrations.mjs'), import('../packages/operators/server/operator-store.mjs'),
    import('../tools/check-migration-readiness.mjs')]);
  const pool = await createPglitePool(); t.after(() => pool.end());
  await applyStudioMigrations({ pool, expectedTarget: (await planStudioMigrations({ pool })).target, confirm: true, deferOptional: ['023'] });
  const line = async () => packageRoomsLine(await countPackagesWithoutRooms({ pool }));
  assert.equal(await line(), 'paket utan rooms: 0');
  const actor = 'readiness-test';
  const production = await createOperatorStore({ sql: pool, scope: { environment: 'production', workspaceId: 'croupier' } });
  const preview = await createOperatorStore({ sql: pool, scope: { environment: 'staging_k06_k07', workspaceId: 'croupier' } });
  const otherWorkspace = await createOperatorStore({ sql: pool, scope: { environment: 'production', workspaceId: 'other' } });
  const publish = (store, operatorId) => store.publishPackage({ actor, operatorId, lanes: [], games: ['blackjack'], tables: [], branding: { name: operatorId } });
  for (const [store, operatorId] of [[production, 'alpha'], [production, 'beta'], [preview, 'alpha'], [otherWorkspace, 'alpha'], [production, 'empty']]) {
    await store.createOperator({ operatorId, slug: operatorId, name: operatorId, status: 'active', actor });
    if (operatorId !== 'empty') await publish(store, operatorId);
  }
  // Without 023 every current package lacks rooms; a company counts once, and one without a package not at all.
  await publish(production, 'alpha');
  assert.equal(await line(), 'paket utan rooms: 4 (production/croupier: 2, production/other: 1, staging_k06_k07/croupier: 1)');
  const plan = await planStudioMigrations({ pool });
  await applyStudioMigrations({ pool, expectedTarget: plan.target, confirm: true });
  // With 023 a new revision carries rooms: only the current package counts, not the history.
  assert.deepEqual((await publish(production, 'alpha')).rooms, []);
  assert.equal(await line(), 'paket utan rooms: 3 (production/croupier: 1, production/other: 1, staging_k06_k07/croupier: 1)');
  for (const [store, operatorId] of [[production, 'beta'], [preview, 'alpha'], [otherWorkspace, 'alpha']]) await publish(store, operatorId);
  assert.equal(await line(), 'paket utan rooms: 0');
  // An unreadable count is `okänt`, never an error and never a driver message.
  const failing = { async query() { throw new Error(`count failed ${secret}`); } };
  assert.equal(packageRoomsLine(await countPackagesWithoutRooms({ pool: failing })), 'paket utan rooms: okänt');
  assert.equal(packageRoomsLine(await countPackagesWithoutRooms({ pool: { async query() { return { rows: [{ environment_id: 'x', workspace_id: 'y', missing: 'many' }] }; } } })), 'paket utan rooms: okänt');
});
