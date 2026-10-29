import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Spelets migreringsledger `croupier_game.storage_migrations` (version, checksum,
// source_hashes, applied_at som TEXT). Studios ledger i `croupier_studio` har ett eget
// format och egna nummer (ops/neon-studio/migrations.mjs), så spelets 011/012 är inte
// Studios 011/012. Rapporten namnger därför versionerna `game-NNN` och `studio-NNN`.
//
// Uttrycklig lista, ingen katalogskanning: en ny spelversion granskas här i samma PR
// som sin SQL-fil. `checksum` är sha256 av källfilen med LF-radslut (för 011–013 mallen
// före rendering), samma regel som motorns startkontroll av product-v1
// (packages/storage/server/postgres-store.mjs) och prepare-verktygen i tools/.
// Ordningen i ledgern är inte versionsordningen: 006–010 bokförs i efterhand av 013.
const hash = text => createHash('sha256').update(text).digest('hex');
const versions = Object.freeze([
  { version: 'product-v1', file: 'product-schema.sql' },
  // Produktionens engångsimport från SQLite 2 oktober 2026. Finns bara där och väntar aldrig.
  { version: 'sqlite-import-v1', file: 'product-schema.sql', historical: true },
  // Spelarprofil och roulettebord. Applicerade för hand före spelets ledgerrader; 013 skriver
  // raderna i efterhand. Obligatoriska i en uppföljande PR när 013 är körd i produktionen.
  { version: 'game-006-player-profile', file: '006-player-profile.sql', deploymentOptional: true },
  { version: 'game-007-roulette-tables', file: '007-roulette-tables.sql', deploymentOptional: true },
  // Delat bord. Applicerade i produktionen 27 oktober 2026 med tools/prepare-shared-schema.mjs,
  // som inte skriver ledgerrader; 013 skriver raderna i efterhand.
  { version: 'game-008-shared-wallet', file: '008-shared-wallet.sql', deploymentOptional: true },
  { version: 'game-009-shared-blackjack', file: '009-shared-blackjack.sql', deploymentOptional: true },
  { version: 'game-010-presentation-receiver', file: '010-presentation-receiver.sql', deploymentOptional: true },
  { version: 'game-011-retire-lissabon', file: '011-retire-lissabon.sql', deploymentOptional: true },
  // PR C i docs/plans/NYCKEL-BOLAG.md gör 012 obligatorisk här samtidigt som motorn kräver den vid start.
  { version: 'game-012-api-key-operator', file: '012-api-key-operator.sql', deploymentOptional: true },
  { version: 'game-013-ledger-backfill', file: '013-ledger-backfill.sql', deploymentOptional: true },
  // Steg F (docs/plans/STEG-F.md): spelarens bolag. Valfri tills kravsteget kräver den vid start.
  { version: 'game-014-player-operator', file: '014-player-operator.sql', deploymentOptional: true },
].map(Object.freeze));

export const GAME_LEDGER_VERSIONS = versions;

export class GameMigrationError extends Error {
  constructor(code) { super(code); this.name = 'GameMigrationError'; this.code = code; }
}
const refuse = code => { throw new GameMigrationError(code); };

/** `game-011-retire-lissabon` → `game-011`; `product-v1` → `game-product-v1`. */
export function gameMigrationLabel(version) {
  if (typeof version !== 'string' || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(version)) refuse('game_migration_invalid_version');
  const numbered = /^game-([0-9]{3})-[a-z0-9-]+$/.exec(version);
  return numbered ? `game-${numbered[1]}` : `game-${version}`;
}

/** Läser de granskade källorna och deras checksummor. Ingen databas. */
export async function loadGameMigrations() {
  const sources = new Map();
  const loaded = [];
  for (const row of versions) {
    if (!sources.has(row.file)) {
      let bytes;
      try { bytes = await readFile(new URL(row.file, import.meta.url), 'utf8'); }
      catch { refuse('game_migration_source_unavailable'); }
      sources.set(row.file, hash(bytes.replace(/^﻿/, '').replace(/\r\n/g, '\n')));
    }
    loaded.push(Object.freeze({ ...row, label: gameMigrationLabel(row.version), checksum: sources.get(row.file) }));
  }
  return Object.freeze(loaded);
}

/** Jämför ledgerns rader med listan. En okänd version eller en ändrad checksumma nekas,
 * precis som Studios planerare nekar en tvetydig ledger. Saknade versioner väntar:
 * obligatoriska i `pending`, valfria i `optionalPending`, historiska aldrig. */
export function planGameMigrationVersions(migrations, rows) {
  if (!Array.isArray(migrations) || !Array.isArray(rows) || rows.length > migrations.length) refuse('game_migration_ambiguous_ledger');
  const known = new Map(migrations.map(row => [row.version, row]));
  const seen = new Set();
  for (const row of rows) {
    const migration = known.get(row?.version);
    if (!migration) refuse('game_migration_unknown_version');
    if (seen.has(row.version)) refuse('game_migration_ambiguous_ledger');
    if (row.checksum !== migration.checksum) refuse('game_migration_checksum_mismatch');
    seen.add(row.version);
  }
  const missing = migrations.filter(row => !seen.has(row.version) && !row.historical);
  return {
    applied: migrations.filter(row => seen.has(row.version)).map(row => row.label),
    pending: missing.filter(row => !row.deploymentOptional).map(row => row.label),
    optionalPending: missing.filter(row => row.deploymentOptional).map(row => row.label),
  };
}

/** Läser spelets ledger i en skrivskyddad transaktion. Skriver aldrig. */
export async function planGameMigrations({ pool } = {}) {
  const migrations = await loadGameMigrations(); // Ingen filläsning under en öppen transaktion.
  if (!pool || typeof pool.connect !== 'function') refuse('game_migration_invalid_configuration');
  let client, begun = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); begun = true;
    await client.query("SET LOCAL statement_timeout = '10000ms'; SET LOCAL lock_timeout = '3000ms'; SET LOCAL idle_in_transaction_session_timeout = '10000ms'");
    await client.query('SET LOCAL search_path = pg_catalog');
    const present = (await client.query("/* game-migrations:ledger-present */ SELECT to_regclass('croupier_game.storage_migrations') IS NOT NULL AS present")).rows[0]?.present;
    if (present !== true) refuse('game_migration_ledger_missing');
    const rows = (await client.query('/* game-migrations:ledger */ SELECT version,checksum FROM croupier_game.storage_migrations ORDER BY version')).rows;
    await client.query('COMMIT'); begun = false;
    return planGameMigrationVersions(migrations, rows);
  } catch (error) {
    if (begun) try { await client.query('ROLLBACK'); } catch { /* Visa aldrig drivrutinens följdfel. */ }
    if (error instanceof GameMigrationError) throw error;
    throw new GameMigrationError('game_migration_ledger_unavailable');
  } finally { try { client?.release?.(); } catch { /* Poolen ägs av anroparen. */ } }
}
