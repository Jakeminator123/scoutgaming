import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkMigrationReadiness } from '../tools/check-migration-readiness.mjs';

const script = fileURLToPath(new URL('../tools/check-migration-readiness.mjs', import.meta.url));
const cliEnv = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, PATHEXT: process.env.PATHEXT };

const secret = 'postgres://migrator:secret-token@ep-example.neon.tech/croupier';

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
  assert.equal(result.database, 'croupier');
  assert.equal(result.role, 'app');
  assertNoSecret(result);
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
  assert.equal(result.message, 'Migration 005 saknas i måldatabasen. Kör migrationen innan deploy.');
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
