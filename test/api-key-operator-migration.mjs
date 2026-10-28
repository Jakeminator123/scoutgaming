// Migration 012 (docs/plans/NYCKEL-BOLAG.md): its offline preparation and the rendered SQL on PGlite.
// PGlite runs one session, so lock contention and lock_timeout stay unproved here (011 has them on CI Postgres).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareApiKeyOperator, API_KEY_OPERATOR_VERSION } from '../tools/prepare-api-key-operator.mjs';
import { createPglitePool } from './fixtures/pglite-pool.mjs';
import { createPostgresStore } from '../services/game/storage/postgres-store.mjs';

const fixture = () => ({ database: 'postgres', role: 'postgres', releaseSha: '1'.repeat(40), rollbackSha: '2'.repeat(40), backupSha256: '3'.repeat(64) });

test('012 preparation fails closed without every explicit evidence reference', async () => {
  for (const value of [undefined, null, {}, [], { ...fixture(), extra: true }]) await assert.rejects(prepareApiKeyOperator(value));
  for (const key of Object.keys(fixture())) {
    const missing = fixture(); delete missing[key]; await assert.rejects(prepareApiKeyOperator(missing));
    await assert.rejects(prepareApiKeyOperator({ ...fixture(), [key]: '' }));
    await assert.rejects(prepareApiKeyOperator({ ...fixture(), [key]: "x'; COMMIT;" }));
  }
});

test('012 artifact is deterministic, hash-bound, ends its readiness in ROLLBACK and claims no approval', async () => {
  const first = await prepareApiKeyOperator(fixture());
  assert.deepEqual(await prepareApiKeyOperator(fixture()), first);
  assert.equal(first.manifest.version, API_KEY_OPERATOR_VERSION);
  assert.equal(first.manifest.sqlSha256, createHash('sha256').update(first.sql).digest('hex'));
  assert.equal(first.manifest.readinessSha256, createHash('sha256').update(first.readinessSql).digest('hex'));
  assert.equal(first.manifest.applies, false); assert.equal(first.manifest.productionApproved, false);
  assert.equal(first.manifest.deploymentRequired, false, 'PR A code reads the column tolerantly');
  assert.match(first.readinessSql, /\nROLLBACK;\n$/); assert.doesNotMatch(first.readinessSql, /\bCOMMIT\b|ALTER TABLE|CREATE (INDEX|FUNCTION|TRIGGER)|INSERT INTO/);
  assert.ok(first.sql.startsWith(first.readinessSql.slice(0, -'ROLLBACK;\n'.length)));
  assert.doesNotMatch(first.sql, /\{\{|\}\}/);
  const different = await prepareApiKeyOperator({ ...fixture(), rollbackSha: '6'.repeat(40) });
  assert.notEqual(different.manifest.sqlSha256, first.manifest.sqlSha256);
});

test('012 offline CLI refuses apply, missing evidence and unknown arguments without exposing evidence', async t => {
  const root = await mkdtemp(join(tmpdir(), 'api-key-operator-offline-'));
  t.after(() => { assert.equal(dirname(root), resolve(tmpdir())); return rm(root, { recursive: true, force: true }); });
  const evidence = join(root, 'evidence.json'); await writeFile(evidence, JSON.stringify(fixture()));
  const script = fileURLToPath(new URL('../tools/prepare-api-key-operator.mjs', import.meta.url));
  for (const args of [[], ['--apply'], ['--evidence', evidence, '--apply'], ['--evidence', evidence, '--sql', 'extra']]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 1); assert.equal(result.stdout, '');
    assert.equal(result.stderr.trim(), 'api_key_operator_preparation_refused');
  }
  const readiness = spawnSync(process.execPath, [script, '--evidence', evidence, '--readiness-sql'], { encoding: 'utf8', timeout: 10000 });
  assert.equal(readiness.status, 0, readiness.stderr); assert.match(readiness.stdout, /ROLLBACK;\n$/);
  const manifest = spawnSync(process.execPath, [script, '--evidence', evidence], { encoding: 'utf8', timeout: 10000 });
  assert.equal(manifest.status, 0, manifest.stderr); assert.equal(JSON.parse(manifest.stdout).applies, false);
});

const KEY = "INSERT INTO croupier_auth.api_keys(id,name,key,secret,scopes,created_at) VALUES ('key-a','Key A','ck_live_a','cs_a','[\"launch\"]','2026-10-28T00:00:00Z')";
async function state(pool) {
  const rows = async sql => (await pool.query(sql)).rows;
  return {
    columns: await rows("SELECT attname, format_type(atttypid,atttypmod) AS type, attnotnull FROM pg_attribute WHERE attrelid='croupier_auth.api_keys'::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum"),
    constraints: await rows("SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='croupier_auth.api_keys'::regclass AND contype<>'n' ORDER BY conname"),
    indexes: await rows("SELECT indexrelid::regclass::text AS name FROM pg_index WHERE indrelid='croupier_auth.api_keys'::regclass ORDER BY 1"),
    triggers: await rows("SELECT tgname FROM pg_trigger WHERE tgrelid='croupier_auth.api_keys'::regclass AND NOT tgisinternal ORDER BY 1"),
    functions: await rows("SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='croupier_auth' ORDER BY 1"),
    ledger: await rows('SELECT version, checksum, source_hashes FROM croupier_game.storage_migrations ORDER BY version'),
    keys: await rows('SELECT row_to_json(k)::text AS row FROM croupier_auth.api_keys k ORDER BY id'),
  };
}

test('012 on PGlite: readiness changes nothing, preflight refuses drift and rows, apply binds the column once', async t => {
  const pool = await createPglitePool(), prepared = await prepareApiKeyOperator(fixture());
  t.after(() => pool.end());
  const apply = sql => pool.query(sql);
  const baseline = await state(pool);
  await apply(prepared.readinessSql);
  assert.deepEqual(await state(pool), baseline, 'readiness rolls back');

  await assert.rejects(apply((await prepareApiKeyOperator({ ...fixture(), database: 'wrong' })).sql), /api_key_operator_target_mismatch/);
  await assert.rejects(apply((await prepareApiKeyOperator({ ...fixture(), role: 'other_role' })).sql), /api_key_operator_target_mismatch/);
  await pool.query("UPDATE croupier_game.storage_migrations SET checksum='wrong' WHERE version='product-v1'");
  await assert.rejects(apply(prepared.sql), /api_key_operator_ledger_mismatch/);
  await pool.query("UPDATE croupier_game.storage_migrations SET checksum=$1 WHERE version='product-v1'", [prepared.manifest.productChecksum]);
  assert.deepEqual(await state(pool), baseline);

  // Test keys are deleted first: a key without a company cannot be given one afterwards.
  await pool.query(KEY);
  const withKey = await state(pool);
  for (const sql of [prepared.readinessSql, prepared.sql]) await assert.rejects(apply(sql), /api_key_operator_not_empty/);
  assert.deepEqual(await state(pool), withKey);
  await pool.query('DELETE FROM croupier_auth.api_keys');

  for (const [create, drop] of [
    ['CREATE INDEX api_keys_operator_idx ON croupier_auth.api_keys(name)', 'DROP INDEX croupier_auth.api_keys_operator_idx'],
    ['CREATE INDEX api_keys_extra_idx ON croupier_auth.api_keys(name)', 'DROP INDEX croupier_auth.api_keys_extra_idx'],
    ["CREATE FUNCTION croupier_auth.api_key_operator_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$",
      'DROP FUNCTION croupier_auth.api_key_operator_immutable()'],
  ]) {
    await pool.query(create); const before = await state(pool);
    await assert.rejects(apply(prepared.sql), /api_key_operator_structure_mismatch/, create);
    assert.deepEqual(await state(pool), before); await pool.query(drop);
  }
  await pool.query('CREATE FUNCTION public.k12_trigger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$');
  await pool.query('CREATE TRIGGER k12_trigger BEFORE INSERT ON croupier_auth.api_keys FOR EACH ROW EXECUTE FUNCTION public.k12_trigger()');
  await assert.rejects(apply(prepared.sql), /api_key_operator_structure_mismatch/);
  await pool.query('DROP TRIGGER k12_trigger ON croupier_auth.api_keys'); await pool.query('DROP FUNCTION public.k12_trigger()');
  await pool.query("CREATE FUNCTION public.k12_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'k12_injected'; END $$");
  await pool.query('CREATE TRIGGER k12_fail BEFORE INSERT ON croupier_game.storage_migrations FOR EACH ROW EXECUTE FUNCTION public.k12_fail()');
  await assert.rejects(apply(prepared.sql), /api_key_operator_unknown_ledger_hook/);
  await pool.query('DROP TRIGGER k12_fail ON croupier_game.storage_migrations'); await pool.query('DROP FUNCTION public.k12_fail()');
  // An interruption after every DDL statement and before the ledger row leaves nothing behind.
  const interrupted = prepared.sql.replace('INSERT INTO croupier_game.storage_migrations', 'SELECT 1/0;\nINSERT INTO croupier_game.storage_migrations');
  assert.notEqual(interrupted, prepared.sql);
  await assert.rejects(apply(interrupted), /division by zero/);
  assert.deepEqual(await state(pool), baseline);
  // Postflight checks what was created, not only that it exists: another CHECK or a trigger on every UPDATE is refused.
  for (const [from, to] of [["{0,99}$');\nCREATE INDEX", "{0,98}$');\nCREATE INDEX"], ['BEFORE UPDATE OF operator_id ON', 'BEFORE UPDATE ON']]) {
    const drifted = prepared.sql.replace(from, () => to);
    assert.notEqual(drifted, prepared.sql, from);
    await assert.rejects(apply(drifted), /api_key_operator_postflight_failed/, to);
    assert.deepEqual(await state(pool), baseline);
  }

  await apply(prepared.sql);
  const after = await state(pool);
  assert.deepEqual(after.columns.at(-1), { attname: 'operator_id', type: 'text', attnotnull: true });
  assert.deepEqual(after.columns.slice(0, -1), baseline.columns);
  assert.deepEqual(after.constraints.find(row => row.conname === 'api_keys_operator_id_check'),
    { conname: 'api_keys_operator_id_check', definition: "CHECK ((operator_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'::text))" });
  assert.ok(after.indexes.some(row => row.name === 'croupier_auth.api_keys_operator_idx'));
  assert.deepEqual(after.triggers, [{ tgname: 'api_keys_operator_immutable' }]);
  const ledger = after.ledger.find(row => row.version === API_KEY_OPERATOR_VERSION);
  assert.equal(ledger.checksum, prepared.manifest.migrationChecksum);
  assert.deepEqual(JSON.parse(ledger.source_hashes), { productChecksum: prepared.manifest.productChecksum,
    migrationChecksum: prepared.manifest.migrationChecksum, ...fixture() });
  assert.deepEqual(after.ledger.filter(row => row.version !== API_KEY_OPERATOR_VERSION), baseline.ledger);
  // The engine's own readiness (product-v1) is unaffected.
  await createPostgresStore({ pool }).db.assertInstalled();
  // No blind second run, also not its readiness.
  for (const sql of [prepared.readinessSql, prepared.sql]) await assert.rejects(apply(sql), /api_key_operator_ledger_mismatch/);
  assert.deepEqual(await state(pool), after);
});

test('012 refuses a hand-made operator column, also after it was dropped again', async t => {
  const pool = await createPglitePool(), prepared = await prepareApiKeyOperator(fixture());
  t.after(() => pool.end());
  await pool.query('ALTER TABLE croupier_auth.api_keys ADD COLUMN operator_id text');
  await assert.rejects(pool.query(prepared.readinessSql), /api_key_operator_structure_mismatch/);
  // A dropped column leaves a tombstone that a later ADD COLUMN would sit beside.
  await pool.query('ALTER TABLE croupier_auth.api_keys DROP COLUMN operator_id');
  await assert.rejects(pool.query(prepared.sql), /api_key_operator_structure_mismatch/);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM croupier_game.storage_migrations WHERE version=$1", [API_KEY_OPERATOR_VERSION])).rows[0].n, 0);
});

test('after 012 a key has exactly one valid company, which it can never change', async t => {
  const pool = await createPglitePool({ migrations: (await import('./fixtures/pglite-pool.mjs')).WITH_API_KEY_OPERATOR });
  t.after(() => pool.end());
  await assert.rejects(pool.query(KEY), { code: '23502' }, 'NOT NULL');
  const insert = operator => pool.query(KEY.replace('(id,name,key,secret,scopes,created_at)', '(id,name,key,secret,scopes,created_at,operator_id)')
    .replace("'2026-10-28T00:00:00Z')", "'2026-10-28T00:00:00Z',$1)"), [operator]);
  for (const operator of ['', '-north', 'north company', 'a'.repeat(101)]) await assert.rejects(insert(operator), { code: '23514' }, operator);
  await insert('north');
  await assert.rejects(pool.query("UPDATE croupier_auth.api_keys SET operator_id='south' WHERE id='key-a'"), /api_key_operator_immutable/);
  await assert.rejects(pool.query("UPDATE croupier_auth.api_keys SET operator_id=NULL WHERE id='key-a'"));
  // Rotation, revocation and use are ordinary updates of other columns; an unchanged company passes.
  await pool.query("UPDATE croupier_auth.api_keys SET secret='cs_rotated', last_used='now', revoked_at='later' WHERE id='key-a'");
  await pool.query("UPDATE croupier_auth.api_keys SET operator_id='north' WHERE id='key-a'");
  assert.deepEqual((await pool.query("SELECT operator_id, secret FROM croupier_auth.api_keys")).rows, [{ operator_id: 'north', secret: 'cs_rotated' }]);
  assert.deepEqual((await pool.query("SELECT to_jsonb(k)->>'operator_id' AS operator_id FROM croupier_auth.api_keys k")).rows, [{ operator_id: 'north' }]);
});
