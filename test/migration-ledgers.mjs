// Båda migreringsledgrarna i samma databas (PGlite, en session): spelets
// croupier_game.storage_migrations och Studios croupier_studio.storage_migrations läses av
// readiness och namnges game-NNN/studio-NNN, och 013 bokför 008–010 i efterhand utan DDL.
// Låskonkurrens mellan sessioner bevisas inte här (se test/fixtures/pglite-pool.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPglitePool, GAME_MIGRATIONS, WITH_API_KEY_OPERATOR } from './fixtures/pglite-pool.mjs';
import { planStudioMigrations, applyStudioMigrations } from '../ops/neon-studio/migrations.mjs';
import { GAME_LEDGER_VERSIONS, gameMigrationLabel, loadGameMigrations, planGameMigrations } from '../ops/neon-game/migrations.mjs';
import { checkMigrationReadiness, readinessOutput } from '../tools/check-migration-readiness.mjs';
import { prepareLedgerBackfill, LEDGER_BACKFILL_VERSION } from '../tools/prepare-ledger-backfill.mjs';
import { prepareSharedSchema } from '../tools/prepare-shared-schema.mjs';

const fixture = (patch = {}) => ({ database: 'postgres', role: 'postgres', appliedOn: '2026-10-27', ...patch });
const sha = async file => createHash('sha256').update((await readFile(new URL(`../ops/neon-game/${file}`, import.meta.url), 'utf8')).replaceAll('\r\n', '\n')).digest('hex');
const ledger = async pool => (await pool.query('SELECT version, checksum, source_hashes, applied_at FROM croupier_game.storage_migrations ORDER BY version')).rows;
const readiness = pool => checkMigrationReadiness({ pool, planGame: planGameMigrations });

test('the game registry names every numbered game file from 008 and pins the checksums the ledger holds', async () => {
  const files = (await readdir(new URL('../ops/neon-game/', import.meta.url))).filter(file => /^[0-9]{3}-.+\.sql$/.test(file) && file >= '008').sort();
  const numbered = GAME_LEDGER_VERSIONS.filter(row => row.version.startsWith('game-'));
  assert.deepEqual(numbered.map(row => row.file), files, 'a new game SQL file is registered in the same PR');
  for (const row of numbered) assert.equal(row.version, `game-${row.file.replace(/\.sql$/, '')}`);
  const loaded = await loadGameMigrations();
  const { sourceHashes } = (await prepareSharedSchema({ expectedDatabase: 'croupier_game', expectedRole: 'croupier_game' })).manifest;
  for (const row of loaded) assert.equal(row.checksum, await sha(row.file));
  for (const file of ['product-schema.sql', '008-shared-wallet.sql', '009-shared-blackjack.sql', '010-presentation-receiver.sql']) {
    assert.ok(loaded.some(row => row.file === file && row.checksum === sourceHashes[`ops/neon-game/${file}`]), file);
  }
  // Produktionens ledgerrader (läst 2026-10-29) har exakt dessa checksummor.
  assert.equal(loaded.find(row => row.version === 'game-011-retire-lissabon').checksum, 'd128b7ae3a7060320887274bb5b217ccb72af9da334fa9183d7773d5406aa939');
  assert.equal(loaded.find(row => row.version === 'game-012-api-key-operator').checksum, '782b087d907f0953304d265e0dc3e3eb8c478d9b2b972c5b88fa2a92a82116be');
  assert.deepEqual(loaded.map(row => row.label), ['game-product-v1', 'game-sqlite-import-v1', 'game-008', 'game-009', 'game-010', 'game-011', 'game-012', 'game-013']);
  assert.equal(gameMigrationLabel('game-012-api-key-operator'), 'game-012');
});

test('readiness reads both ledgers on PGlite, keeps studio-012 and game-012 apart, and sees 013 backfill 008–010 once', async t => {
  // En databas med båda ledgrarna: spelets via fixturen (product-v1 och 012), Studios via dess runner.
  const pool = await createPglitePool({ migrations: WITH_API_KEY_OPERATOR }); t.after(() => pool.end());
  const plan = await planStudioMigrations({ pool });
  await applyStudioMigrations({ pool, expectedTarget: plan.target, confirm: true });
  let result = await readiness(pool);
  assert.equal(result.exitCode, 0, result.code ?? result.message); assert.equal(result.ready, true);
  assert.ok(result.applied.includes('012'), 'Studio 012 (runtime media catalogue)');
  assert.deepEqual(result.game, { applied: ['game-product-v1', 'game-012'], pending: [],
    optionalPending: ['game-008', 'game-009', 'game-010', 'game-011', 'game-013'], ready: true }, 'ready without the backfill');
  const line = readinessOutput(result);
  assert.ok(line.applied.includes('studio-012') && line.applied.includes('game-012'));
  assert.equal(line.applied.some(label => /^[0-9]{3}$/.test(label)), false, 'no bare number in the report');
  assert.equal(new Set([...line.applied, ...line.optionalPending]).size, line.applied.length + line.optionalPending.length);
  assert.equal((await checkMigrationReadiness({ pool })).game, undefined, 'without the game planner only Studio is read, as before');

  const prepared = await prepareLedgerBackfill(fixture());
  const before = await ledger(pool);
  await pool.query(prepared.readinessSql);
  assert.deepEqual(await ledger(pool), before, 'readiness rolls back');
  await pool.query(prepared.sql);
  const after = await ledger(pool);
  const rows = Object.fromEntries(after.map(row => [row.version, row]));
  for (const [version, file] of [['game-008-shared-wallet', '008-shared-wallet.sql'], ['game-009-shared-blackjack', '009-shared-blackjack.sql'],
    ['game-010-presentation-receiver', '010-presentation-receiver.sql']]) {
    assert.equal(rows[version].checksum, await sha(file)); assert.equal(rows[version].applied_at, '2026-10-27');
    const evidence = JSON.parse(rows[version].source_hashes);
    assert.equal(evidence.backfilledBy, LEDGER_BACKFILL_VERSION); assert.equal(evidence.backfillChecksum, await sha('013-ledger-backfill.sql'));
    assert.equal(evidence.migrationChecksum, rows[version].checksum); assert.equal(evidence.appliedOn, '2026-10-27');
  }
  assert.equal(rows[LEDGER_BACKFILL_VERSION].checksum, await sha('013-ledger-backfill.sql'));
  assert.deepEqual(after.filter(row => before.some(old => old.version === row.version)), before, 'existing rows untouched');
  await pool.query(prepared.sql);
  await pool.query((await prepareLedgerBackfill(fixture({ appliedOn: '2026-10-28' }))).sql);
  assert.deepEqual(await ledger(pool), after, 'a second run changes nothing');
  result = await readiness(pool);
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.game.applied, ['game-product-v1', 'game-008', 'game-009', 'game-010', 'game-012', 'game-013']);
  assert.deepEqual(result.game.optionalPending, ['game-011']);
  assert.ok(readinessOutput(result).applied.includes('game-010'));

  // Fail closed: en ändrad checksumma och en okänd version ger exit 2, saknad product-v1 blockerar.
  await pool.query("UPDATE croupier_game.storage_migrations SET checksum='" + 'e'.repeat(64) + "' WHERE version='game-012-api-key-operator'");
  result = await readiness(pool);
  assert.equal(result.exitCode, 2); assert.equal(result.code, 'game_migration_checksum_mismatch');
  await pool.query("UPDATE croupier_game.storage_migrations SET checksum='" + (await sha('012-api-key-operator.sql')) + "' WHERE version='game-012-api-key-operator'");
  await pool.query("INSERT INTO croupier_game.storage_migrations(version,checksum,source_hashes,applied_at) VALUES ('game-014-unreviewed','" + 'a'.repeat(64) + "','{}','now')");
  result = await readiness(pool);
  assert.equal(result.exitCode, 2); assert.equal(result.code, 'game_migration_unknown_version');
  await pool.query("DELETE FROM croupier_game.storage_migrations WHERE version IN ('game-014-unreviewed','product-v1')");
  result = await readiness(pool);
  assert.equal(result.exitCode, 1); assert.equal(result.ready, false);
  assert.deepEqual(result.game.pending, ['game-product-v1']); assert.deepEqual(result.pending, []);
  assert.match(result.message, /Migration game-product-v1 saknas/);
});

test('013 refuses a wrong target, missing 008–010 objects, a different existing row and a changed product checksum', async t => {
  const prepared = await prepareLedgerBackfill(fixture());
  const empty = await createPglitePool({ migrations: ['006-player-profile.sql', '007-roulette-tables.sql'] }); t.after(() => empty.end());
  const emptyBefore = await ledger(empty);
  await assert.rejects(empty.query(prepared.sql), /ledger_backfill_structure_mismatch/);
  assert.deepEqual(await ledger(empty), emptyBefore);

  const pool = await createPglitePool({ migrations: GAME_MIGRATIONS }); t.after(() => pool.end());
  const before = await ledger(pool);
  for (const patch of [{ database: 'croupier_game' }, { role: 'croupier_game' }]) {
    await assert.rejects(pool.query((await prepareLedgerBackfill(fixture(patch))).sql), /ledger_backfill_target_mismatch/);
  }
  await pool.query("INSERT INTO croupier_game.storage_migrations(version,checksum,source_hashes,applied_at) VALUES ('game-009-shared-blackjack','" + 'f'.repeat(64) + "','{}','2026-10-27')");
  await assert.rejects(pool.query(prepared.sql), /ledger_backfill_ledger_mismatch/);
  await pool.query("DELETE FROM croupier_game.storage_migrations WHERE version='game-009-shared-blackjack'");
  await pool.query("UPDATE croupier_game.storage_migrations SET checksum='" + '0'.repeat(64) + "' WHERE version='product-v1'");
  await assert.rejects(pool.query(prepared.sql), /ledger_backfill_product_mismatch/);
  await pool.query("UPDATE croupier_game.storage_migrations SET checksum='" + before.find(row => row.version === 'product-v1').checksum + "' WHERE version='product-v1'");
  assert.deepEqual(await ledger(pool), before, 'every refusal rolled back');
});

test('013 preparation refuses unsafe arguments and its offline CLI never applies', async () => {
  for (const options of [undefined, {}, fixture({ database: "x'; COMMIT;" }), fixture({ role: '' }), fixture({ appliedOn: '27 oktober' }),
    fixture({ appliedOn: '2026-02-30' }), fixture({ appliedOn: undefined })]) await assert.rejects(prepareLedgerBackfill(options));
  const first = await prepareLedgerBackfill(fixture());
  assert.deepEqual(await prepareLedgerBackfill(fixture()), first, 'deterministic');
  assert.equal(first.manifest.sqlSha256, createHash('sha256').update(first.sql).digest('hex'));
  assert.equal(first.manifest.ddl, false); assert.equal(first.manifest.applies, false); assert.equal(first.manifest.productionApproved, false);
  assert.match(first.readinessSql, /\nROLLBACK;\n$/); assert.doesNotMatch(first.readinessSql, /\bCOMMIT\b|INSERT INTO/);
  assert.doesNotMatch(first.sql, /\{\{|\}\}|\b(?:CREATE|ALTER|DROP|TRUNCATE|DELETE|UPDATE)\b/);
  const script = fileURLToPath(new URL('../tools/prepare-ledger-backfill.mjs', import.meta.url));
  const target = ['--database', 'croupier_game', '--role', 'croupier_game', '--applied-on', '2026-10-27'];
  for (const args of [[], ['--apply'], [...target, '--apply'], [...target, '--sql', '--readiness-sql'], [...target, '--database', 'other']]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.equal(result.stderr.trim(), 'ledger_backfill_preparation_refused');
  }
  const manifest = spawnSync(process.execPath, [script, ...target], { encoding: 'utf8', timeout: 10000 });
  assert.equal(manifest.status, 0, manifest.stderr);
  assert.deepEqual(JSON.parse(manifest.stdout).backfilled.map(row => row.version), ['game-008-shared-wallet', 'game-009-shared-blackjack', 'game-010-presentation-receiver']);
  const sql = spawnSync(process.execPath, [script, ...target, '--sql'], { encoding: 'utf8', timeout: 10000 });
  assert.equal(sql.status, 0); assert.match(sql.stdout, /current_database\(\) <> 'croupier_game'/);
});
