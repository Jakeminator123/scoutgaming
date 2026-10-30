// Steg F, PR F1 (docs/plans/STEG-F.md): migration game-014 (players.operator_id) and the tolerant reads.
// The offline preparation, the rendered SQL on PGlite before and after, the backfill rule, idempotence,
// refusals and the game ledger's readiness; then the engine session and Admin's player list run the same
// code without and with 014. PGlite runs one session: lock contention and lock_timeout stay unproved here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preparePlayerOperator, PLAYER_OPERATOR_VERSION } from '../tools/prepare-player-operator.mjs';
import { createPglitePool, GAME_MIGRATIONS, WITH_API_KEY_OPERATOR } from './fixtures/pglite-pool.mjs';
import { createPostgresStore } from '../services/game/storage/postgres-store.mjs';
import { planGameMigrations } from '../ops/neon-game/migrations.mjs';
import { playerOperator, PLAYER_OPERATOR_VERSION as READ_VERSION } from '../packages/storage/server/player-operator.mjs';
import { playerAuth } from '../services/game/storage/async-player-auth.mjs';
import { createStudioAdminData } from '../apps/studio/lib/studio-admin-data.mjs';

const scope = Object.freeze({ environment: 'fixture', workspaceId: 'croupier' });
const fixture = (patch = {}) => ({ database: 'postgres', role: 'postgres', environment: scope.environment, workspace: scope.workspaceId,
  fallbackOperator: 'demo', releaseSha: '1'.repeat(40), rollbackSha: '2'.repeat(40), backupSha256: '3'.repeat(64), ...patch });
const ms = iso => Date.parse(iso);

// croupier_studio.operators exactly as Studio migration 005 creates it, in the same database as the game schema.
async function withOperators(pool) {
  const studio = (await readFile(new URL('../ops/neon-studio/005-operators.sql', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  await pool.query('CREATE SCHEMA croupier_studio;\n' + /CREATE TABLE croupier_studio\.operators \([\s\S]*?\n\);/.exec(studio)[0]);
  for (const [environment, workspace, id, status] of [[scope.environment, scope.workspaceId, 'north', 'active'],
    [scope.environment, scope.workspaceId, 'south', 'active'], [scope.environment, scope.workspaceId, 'demo', 'suspended'],
    [scope.environment, 'other-workspace', 'elsewhere', 'active']]) {
    await pool.query('INSERT INTO croupier_studio.operators VALUES ($1,$2,$3,$4,$5,$6,$7)', [environment, workspace, id, id, id, status, 1]);
  }
  return pool;
}
const pool = async (migrations = WITH_API_KEY_OPERATOR) => withOperators(await createPglitePool({ migrations }));

// One player per backfill case. Rooms map to companies through the head of their frozen game settings.
async function seed(db, { bound = true } = {}) {
  const q = (sql, values) => db.query(sql, values);
  for (const id of ['p-partner', 'p-shared', 'p-roulette', 'p-gone', 'p-none']) {
    await q("INSERT INTO croupier_game.players(id,name,created_at) VALUES ($1,$1,'2026-10-01T00:00:00Z')", [id]);
  }
  for (const [room, operator] of [['room-north', 'north'], ['room-south', 'south'], ['room-gone', 'elsewhere']]) {
    await q('INSERT INTO croupier_game.shared_table_configs(room_id,version,body) VALUES ($1,$2,$3)', [room, 'v1', JSON.stringify({ roomId: room, operatorId: operator })]);
    await q('INSERT INTO croupier_game.shared_table_config_heads(room_id,version) VALUES ($1,$2)', [room, 'v1']);
  }
  const presence = (room, player, iso) => q('INSERT INTO croupier_game.shared_table_presence(room_id,player_id,seen) VALUES ($1,$2,$3)', [room, player, ms(iso)]);
  await presence('room-north', 'p-shared', '2026-10-20T00:00:00Z');
  await presence('room-south', 'p-shared', '2026-10-25T00:00:00Z');
  await presence('room-north', 'p-roulette', '2026-10-01T00:00:00Z');
  await presence('room-north', 'p-partner', '2026-10-28T00:00:00Z');
  await presence('room-gone', 'p-gone', '2026-10-28T00:00:00Z');
  const roulette = async (player, operator, room, at) => {
    await q("INSERT INTO croupier_game.roulette_tables(player_id,operator_id,room_id,state) VALUES ($1,$2,$3,'{}') ON CONFLICT DO NOTHING", [player, operator, room]);
    await q("INSERT INTO croupier_game.transactions(player_id,type,amount,currency,meta,at) VALUES ($1,'roulette_bet',-1,'USD',$2,$3)",
      [player, JSON.stringify({ game: 'roulette', roomId: room, roundId: 'r', number: 1, wagered: 1, returned: 0 }), at]);
  };
  await roulette('p-roulette', 'south', 'room-r-south', '2026-10-10T00:00:00.000Z');
  await roulette('p-gone', 'elsewhere', 'room-r-gone', '2026-10-29T00:00:00.000Z');
  await roulette('p-none', 'north', 'room-r-north', 'yesterday'); // an unreadable time is no evidence
  // Before game-012 a key has no company column; to_jsonb reads it as null and the table rule decides.
  await q(bound ? "INSERT INTO croupier_auth.api_keys(id,name,key,secret,scopes,created_at,operator_id) VALUES ('k1','K','ck','cs','[]','x','south')"
    : "INSERT INTO croupier_auth.api_keys(id,name,key,secret,scopes,created_at) VALUES ('k1','K','ck','cs','[]','x')");
  await q("INSERT INTO croupier_game.partner_players(key_id,partner_player,player_id) VALUES ('k1','ext-1','p-partner')");
}
const EXPECTED = Object.freeze({ 'p-partner': 'south', 'p-shared': 'south', 'p-roulette': 'south', 'p-gone': 'demo', 'p-none': 'demo' });

async function state(db) {
  const rows = async sql => (await db.query(sql)).rows;
  return {
    columns: await rows("SELECT attname, format_type(atttypid,atttypmod) AS type, attnotnull FROM pg_attribute WHERE attrelid='croupier_game.players'::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum"),
    constraints: await rows("SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='croupier_game.players'::regclass ORDER BY conname"),
    indexes: await rows("SELECT pg_get_indexdef(indexrelid) AS definition FROM pg_index WHERE indrelid='croupier_game.players'::regclass ORDER BY 1"),
    ledger: await rows('SELECT version, checksum, source_hashes, applied_at FROM croupier_game.storage_migrations ORDER BY version'),
    players: await rows('SELECT row_to_json(p)::text AS row FROM croupier_game.players p ORDER BY id'),
  };
}
const operators = async db => Object.fromEntries((await db.query("SELECT id, operator_id FROM croupier_game.players ORDER BY id")).rows.map(row => [row.id, row.operator_id]));
const planOf = results => results.find(result => result.fields?.some(field => field.name === 'rule'))?.rows
  .map(row => [row.rule, row.operator_id, Number(row.players)]);

test('014 preparation fails closed without every explicit evidence reference', async () => {
  for (const value of [undefined, null, {}, [], { ...fixture(), extra: true }]) await assert.rejects(preparePlayerOperator(value));
  for (const key of Object.keys(fixture())) {
    const missing = fixture(); delete missing[key]; await assert.rejects(preparePlayerOperator(missing), key);
    await assert.rejects(preparePlayerOperator({ ...fixture(), [key]: '' }), key);
    await assert.rejects(preparePlayerOperator({ ...fixture(), [key]: "x'; COMMIT;" }), key);
  }
});

test('014 artifact is deterministic, hash-bound, plans in a ROLLBACK readiness and claims no approval', async () => {
  const first = await preparePlayerOperator(fixture());
  assert.deepEqual(await preparePlayerOperator(fixture()), first);
  assert.equal(first.manifest.version, PLAYER_OPERATOR_VERSION); assert.equal(READ_VERSION, PLAYER_OPERATOR_VERSION);
  assert.equal(first.manifest.sqlSha256, createHash('sha256').update(first.sql).digest('hex'));
  assert.equal(first.manifest.readinessSha256, createHash('sha256').update(first.readinessSql).digest('hex'));
  assert.equal(first.manifest.applies, false); assert.equal(first.manifest.productionApproved, false);
  assert.equal(first.manifest.deploymentRequired, false, 'PR F1 code reads the column tolerantly');
  assert.equal(first.manifest.idempotent, true);
  assert.match(first.readinessSql, /\nROLLBACK;\n$/);
  assert.doesNotMatch(first.readinessSql, /^(?:COMMIT|ALTER TABLE|CREATE INDEX|INSERT INTO|UPDATE croupier_game)/m);
  assert.match(first.sql, /^COMMIT;\n$/m);
  assert.ok(first.sql.startsWith(first.readinessSql.slice(0, -'ROLLBACK;\n'.length)));
  assert.doesNotMatch(first.sql, /\{\{|\}\}/);
  assert.match(first.sql, /operator_id='demo'\) THEN/);
  assert.notEqual((await preparePlayerOperator(fixture({ fallbackOperator: 'johns-bet' }))).manifest.sqlSha256, first.manifest.sqlSha256);
});

test('014 offline CLI refuses apply, missing evidence and unknown arguments without exposing evidence', async t => {
  const root = await mkdtemp(join(tmpdir(), 'player-operator-offline-'));
  t.after(() => { assert.equal(dirname(root), resolve(tmpdir())); return rm(root, { recursive: true, force: true }); });
  const evidence = join(root, 'evidence.json'); await writeFile(evidence, JSON.stringify(fixture()));
  const script = fileURLToPath(new URL('../tools/prepare-player-operator.mjs', import.meta.url));
  for (const args of [[], ['--apply'], ['--evidence', evidence, '--apply'], ['--evidence', evidence, '--sql', 'extra']]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 1); assert.equal(result.stdout, '');
    assert.equal(result.stderr.trim(), 'player_operator_preparation_refused');
  }
  const readiness = spawnSync(process.execPath, [script, '--evidence', evidence, '--readiness-sql'], { encoding: 'utf8', timeout: 10000 });
  assert.equal(readiness.status, 0, readiness.stderr); assert.match(readiness.stdout, /ROLLBACK;\n$/);
  const manifest = spawnSync(process.execPath, [script, '--evidence', evidence], { encoding: 'utf8', timeout: 10000 });
  assert.equal(manifest.status, 0, manifest.stderr); assert.equal(JSON.parse(manifest.stdout).applies, false);
});

test('014 on PGlite: readiness shows the plan and writes nothing, apply backfills once, a rerun is idempotent', async t => {
  const db = await pool(); t.after(() => db.end());
  const prepared = await preparePlayerOperator(fixture());
  await seed(db);
  let plan = await planGameMigrations({ pool: db });
  assert.ok(plan.optionalPending.includes('game-014'), 'registered as optional, pending before the run');
  assert.equal(plan.pending.length, 0);
  const baseline = await state(db);

  const readiness = await db.query(prepared.readinessSql);
  assert.deepEqual(planOf(readiness), [['fallback', 'demo', 2], ['latest-table', 'south', 2], ['partner-key', 'south', 1]]);
  assert.equal(readiness.at(-1).command, 'ROLLBACK');
  assert.deepEqual(await state(db), baseline, 'readiness rolls back');

  // An interruption after the DDL and the backfill and before the ledger row leaves nothing behind.
  const interrupted = prepared.sql.replace('INSERT INTO croupier_game.storage_migrations', 'SELECT 1/0;\nINSERT INTO croupier_game.storage_migrations');
  assert.notEqual(interrupted, prepared.sql);
  await assert.rejects(db.query(interrupted), /division by zero/);
  assert.deepEqual(await state(db), baseline);
  // Postflight checks what was created: another CHECK is refused.
  const drifted = prepared.sql.replace("{0,99}$');\nCREATE INDEX", () => "{0,98}$');\nCREATE INDEX");
  assert.notEqual(drifted, prepared.sql);
  await assert.rejects(db.query(drifted), /player_operator_postflight_failed/);
  assert.deepEqual(await state(db), baseline);

  await db.query(prepared.sql);
  const after = await state(db);
  assert.deepEqual(await operators(db), EXPECTED);
  assert.deepEqual(after.columns.at(-1), { attname: 'operator_id', type: 'text', attnotnull: false });
  assert.deepEqual(after.columns.slice(0, -1), baseline.columns);
  assert.deepEqual(after.constraints.find(row => row.conname === 'players_operator_id_check'),
    { conname: 'players_operator_id_check', definition: "CHECK ((operator_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$'::text))" });
  assert.ok(after.indexes.some(row => row.definition === 'CREATE INDEX players_operator_idx ON croupier_game.players USING btree (operator_id)'));
  const ledger = after.ledger.find(row => row.version === PLAYER_OPERATOR_VERSION);
  assert.equal(ledger.checksum, prepared.manifest.migrationChecksum);
  assert.deepEqual(JSON.parse(ledger.source_hashes), { productChecksum: prepared.manifest.productChecksum,
    migrationChecksum: prepared.manifest.migrationChecksum, ...fixture() });
  assert.deepEqual(after.ledger.filter(row => row.version !== PLAYER_OPERATOR_VERSION), baseline.ledger);
  await createPostgresStore({ pool: db }).db.assertInstalled(); // the engine's own start check (product-v1)
  plan = await planGameMigrations({ pool: db });
  assert.ok(plan.applied.includes('game-014') && !plan.optionalPending.includes('game-014'));

  // Idempotent: the same run again changes nothing, its readiness plans nothing.
  assert.deepEqual(planOf(await db.query(prepared.readinessSql)), []);
  await db.query(prepared.sql);
  assert.deepEqual(await state(db), after);
  // A player created by code that does not yet write the company gets one by the same rule; others stay.
  await db.query("INSERT INTO croupier_game.players(id,name,created_at) VALUES ('p-late','late','2026-10-30T00:00:00Z')");
  await db.query("INSERT INTO croupier_game.shared_table_presence(room_id,player_id,seen) VALUES ('room-north','p-late',$1)", [ms('2026-10-30T00:00:00Z')]);
  await db.query((await preparePlayerOperator(fixture({ fallbackOperator: 'south' }))).sql);
  assert.deepEqual(await operators(db), { ...EXPECTED, 'p-late': 'north' });
  assert.deepEqual((await state(db)).ledger, after.ledger, 'the ledger row keeps its first evidence');

  // The column only takes company ids; NULL stays allowed until game-015.
  for (const value of ['', '-north', 'north company', 'a'.repeat(101)]) {
    await assert.rejects(db.query("UPDATE croupier_game.players SET operator_id=$1 WHERE id='p-late'", [value]), { code: '23514' }, value);
  }
  await db.query("INSERT INTO croupier_game.players(id,name,created_at) VALUES ('p-null','n','x')");
  assert.equal((await db.query("SELECT operator_id FROM croupier_game.players WHERE id='p-null'")).rows[0].operator_id, null);
});

test('014 refuses a wrong target, drift, an unknown fallback, a hand-made column and a hook on operator_id', async t => {
  const db = await pool(); t.after(() => db.end());
  const prepared = await preparePlayerOperator(fixture());
  await seed(db);
  const baseline = await state(db);
  const refuses = async (sql, pattern) => { await assert.rejects(db.query(sql), pattern); assert.deepEqual(await state(db), baseline); };
  await refuses((await preparePlayerOperator(fixture({ database: 'croupier_game' }))).sql, /player_operator_target_mismatch/);
  await refuses((await preparePlayerOperator(fixture({ role: 'croupier_game' }))).sql, /player_operator_target_mismatch/);
  for (const fallbackOperator of ['unknown-company', 'elsewhere']) {
    await refuses((await preparePlayerOperator(fixture({ fallbackOperator }))).readinessSql, /player_operator_fallback_unknown/);
  }
  await refuses((await preparePlayerOperator(fixture({ workspace: 'other-workspace' }))).sql, /player_operator_fallback_unknown/);

  await db.query("UPDATE croupier_game.storage_migrations SET checksum='wrong' WHERE version='product-v1'");
  await assert.rejects(db.query(prepared.sql), /player_operator_ledger_mismatch/);
  await db.query("UPDATE croupier_game.storage_migrations SET checksum=$1 WHERE version='product-v1'", [prepared.manifest.productChecksum]);
  await db.query("INSERT INTO croupier_game.storage_migrations VALUES ($1,$2,'{}','x')", [PLAYER_OPERATOR_VERSION, 'f'.repeat(64)]);
  await assert.rejects(db.query(prepared.readinessSql), /player_operator_ledger_mismatch/);
  await db.query('DELETE FROM croupier_game.storage_migrations WHERE version=$1', [PLAYER_OPERATOR_VERSION]);
  assert.deepEqual(await state(db), baseline);

  // A trigger that wakes on every UPDATE of players would also wake on the backfill.
  await db.query('CREATE FUNCTION public.f14_trigger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$');
  await db.query('CREATE TRIGGER f14_trigger BEFORE UPDATE ON croupier_game.players FOR EACH ROW EXECUTE FUNCTION public.f14_trigger()');
  await assert.rejects(db.query(prepared.sql), /player_operator_unknown_player_hook/);
  await db.query('DROP TRIGGER f14_trigger ON croupier_game.players');
  await db.query('CREATE FUNCTION public.f14_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$');
  await db.query('CREATE TRIGGER f14_ledger BEFORE INSERT ON croupier_game.storage_migrations FOR EACH ROW EXECUTE FUNCTION public.f14_ledger()');
  await assert.rejects(db.query(prepared.sql), /player_operator_unknown_ledger_hook/);
  await db.query('DROP TRIGGER f14_ledger ON croupier_game.storage_migrations');

  // Hand-made objects without the ledger row are refused, also an index of the same name.
  for (const [create, drop] of [
    ['ALTER TABLE croupier_game.players ADD COLUMN operator_id text', 'ALTER TABLE croupier_game.players DROP COLUMN operator_id'],
    ['CREATE INDEX players_operator_idx ON croupier_game.players(name)', 'DROP INDEX croupier_game.players_operator_idx'],
  ]) {
    await db.query(create);
    await assert.rejects(db.query(prepared.sql), /player_operator_structure_mismatch/, create);
    await db.query(drop);
  }
  await db.query('ALTER TABLE croupier_game.roulette_tables RENAME TO roulette_tables_moved');
  await assert.rejects(db.query(prepared.sql), /player_operator_backfill_source_missing/);
  await db.query('ALTER TABLE croupier_game.roulette_tables_moved RENAME TO roulette_tables');
  assert.deepEqual(await state(db), baseline, 'every refusal rolled back');

  // After a run, a changed structure is refused instead of being silently re-created.
  await db.query(prepared.sql);
  await db.query('DROP INDEX croupier_game.players_operator_idx');
  await assert.rejects(db.query(prepared.sql), /player_operator_structure_mismatch/);
});

test('014 also runs where game-012 is missing: partner players then follow the table rule', async t => {
  const db = await pool(GAME_MIGRATIONS); t.after(() => db.end());
  await seed(db, { bound: false });
  await db.query((await preparePlayerOperator(fixture())).sql);
  assert.deepEqual(await operators(db), { ...EXPECTED, 'p-partner': 'north' });
});

// The tolerant reads: the same code without 014 (today) and with it.
test('a player row names its company exactly; a malformed value is never trusted', () => {
  assert.equal(playerOperator(undefined), null); assert.equal(playerOperator({}), null); assert.equal(playerOperator({ operator_id: null }), null);
  assert.equal(playerOperator({ operator_id: 'north' }), 'north');
  for (const value of ['', 'bad company', 42, '-north', 'a'.repeat(101)]) {
    assert.throws(() => playerOperator({ operator_id: value }), { code: 'player_operator_invalid', statusCode: 503 });
  }
});

for (const migrated of [false, true]) {
  test(`engine session and Admin's player list ${migrated ? 'carry the company after 014' : 'are unchanged before 014'}`, async t => {
    const db = await pool(); t.after(() => db.end());
    const store = createPostgresStore({ pool: db });
    await store.db.prepare("INSERT INTO players (id,name,currency,balance,created_at) VALUES ('p-shared','Shared','USD',1000,'2026-10-02T00:00:00Z'),('p-none','None','USD',1000,'2026-10-01T00:00:00Z')").run();
    await db.query("INSERT INTO croupier_game.shared_table_configs VALUES ('room-north','v1',$1)", [JSON.stringify({ operatorId: 'north' })]);
    await db.query("INSERT INTO croupier_game.shared_table_config_heads VALUES ('room-north','v1')");
    await db.query("INSERT INTO croupier_game.shared_table_presence VALUES ('room-north','p-shared',1)");
    if (migrated) await db.query((await preparePlayerOperator(fixture())).sql);
    const expires = Date.now() + 60000, token = id => createHash('sha256').update('token-' + id).digest('hex');
    for (const id of ['p-shared', 'p-none']) {
      await store.db.prepare('INSERT INTO player_sessions (digest,player_id,expires,source_stamp,display_name) VALUES (?,?,?,?,?)').run(token(id), id, expires, null, null);
    }
    const auth = playerAuth(store.db, () => assert.fail('reading a session never creates a player'));
    const shared = await auth.bindingById('player-' + token('p-shared')), none = await auth.bindingById('player-' + token('p-none'));
    const base = id => ({ actorId: id, sessionId: 'player-' + token(id), expiresAt: expires, partnerKeyId: null });
    assert.deepEqual(shared, migrated ? { ...base('p-shared'), playerOperatorId: 'north' } : base('p-shared'));
    assert.deepEqual(none, migrated ? { ...base('p-none'), playerOperatorId: 'demo' } : base('p-none'));
    // A player without a company (created after 014 by code that does not yet write it) binds as today.
    if (migrated) {
      await db.query("UPDATE croupier_game.players SET operator_id=NULL WHERE id='p-none'");
      assert.deepEqual(await auth.bindingById('player-' + token('p-none')), base('p-none'));
    }
    await db.query("UPDATE croupier_game.players SET status='blocked' WHERE id='p-shared'");
    assert.equal(await auth.bindingById('player-' + token('p-shared')), null, 'status still decides first');

    const admin = createStudioAdminData({ db: store.db, boDb: store.boDb, scope,
      repository: { readDocument: async () => null, saveDocument: async () => assert.fail('no document write') } });
    const listed = await admin.handlers.get('GET /studio/api/admin/players')({ scope, actor: { user: 'operator', role: 'admin' } });
    assert.equal(listed.operatorBinding, migrated ? 'ready' : 'pending');
    assert.deepEqual(listed.players.map(row => [row.id, row.operatorId]), [['p-shared', migrated ? 'north' : null], ['p-none', null]]);
    assert.equal(listed.players.some(row => Object.hasOwn(row, 'operator_id')), false);
  });
}
