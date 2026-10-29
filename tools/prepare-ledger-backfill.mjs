#!/usr/bin/env node
// Bara offline: ingen databasdrivrutin, inga miljövariabler och inget apply-läge.
// Renderar ops/neon-game/013-ledger-backfill.sql: efterhandsrader för delat bord 008–010 i
// spelets ledger (docs/ENVIRONMENT-RESTORATION.md, "Två migreringsledgrar").
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { prepareSharedSchema } from './prepare-shared-schema.mjs';

const productChecksum = '831637c49f3fa2210c3c5804531b13807d2d8fb1feb2c324bc2a986493f7fb1a';
const sourcePath = 'ops/neon-game/013-ledger-backfill.sql';
export const LEDGER_BACKFILL_VERSION = 'game-013-ledger-backfill';
// Version, källfil och mallparameter för checksumman respektive evidensen.
const backfilled = Object.freeze([
  ['game-008-shared-wallet', 'ops/neon-game/008-shared-wallet.sql', 'sharedWallet'],
  ['game-009-shared-blackjack', 'ops/neon-game/009-shared-blackjack.sql', 'sharedBlackjack'],
  ['game-010-presentation-receiver', 'ops/neon-game/010-presentation-receiver.sql', 'presentationReceiver'],
]);
const hash = value => createHash('sha256').update(value).digest('hex');
const literal = value => "'" + value.replaceAll("'", "''") + "'";
const read = async path => (await readFile(new URL('../' + path, import.meta.url), 'utf8')).replaceAll('\r\n', '\n');

function appliedDay(value) {
  if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return null;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

/** `appliedOn` är dagen då 008–010 applicerades i just det målet (produktionen: 2026-10-27).
 * Underlaget är granskningsbart men ger inget mandat att köra det. */
export async function prepareLedgerBackfill({ database, role, appliedOn } = {}) {
  for (const value of [database, role]) {
    if (typeof value !== 'string' || !/^[a-z_][a-z0-9_]{0,62}$/.test(value)) throw Error('Explicit simple database and role names are required');
  }
  if (!appliedDay(appliedOn)) throw Error('appliedOn must be a real YYYY-MM-DD day');
  if (hash(await read('ops/neon-game/product-schema.sql')) !== productChecksum) throw Error('Historical product schema changed');
  // prepare-shared-schema.mjs pinnar 008–010:s bytes och nekar om de ändrats.
  const { sourceHashes } = (await prepareSharedSchema({ expectedDatabase: database, expectedRole: role })).manifest;
  const source = await read(sourcePath);
  const migrationChecksum = hash(source);
  const values = { database, role, productChecksum, migrationChecksum, appliedOn,
    evidence: JSON.stringify({ productChecksum, migrationChecksum, database, role, appliedOn,
      backfilled: backfilled.map(([version]) => version) }) };
  const rows = [];
  for (const [version, path, key] of backfilled) {
    const checksum = hash(await read(path));
    if (sourceHashes[path] !== checksum) throw Error('Shared schema source changed: ' + path);
    values[key + 'Checksum'] = checksum;
    values[key + 'Evidence'] = JSON.stringify({ productChecksum, migrationChecksum: checksum, backfilledBy: LEDGER_BACKFILL_VERSION,
      backfillChecksum: migrationChecksum, database, role, appliedOn });
    rows.push({ version, checksum });
  }
  const sql = source.replace(/\{\{([a-zA-Z]+)\}\}/g, (_, key) => {
    if (!Object.hasOwn(values, key)) throw Error('Unknown ledger backfill parameter');
    return literal(values[key]);
  });
  if (sql.includes('{{') || sql.includes('}}')) throw Error('Unresolved ledger backfill parameter');
  const parts = sql.split('-- BACKFILL MUTATIONS\n');
  if (parts.length !== 2) throw Error('Ledger backfill readiness boundary is ambiguous');
  const readinessSql = parts[0] + 'ROLLBACK;\n';
  return { sql, readinessSql, manifest: { version: LEDGER_BACKFILL_VERSION, sourcePath, productChecksum, migrationChecksum,
    database, role, appliedOn, backfilled: rows, sqlSha256: hash(sql), readinessSha256: hash(readinessSql),
    ddl: false, idempotent: true, deploymentRequired: false, applies: false, productionApproved: false } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2), options = {}; let output = 'manifest';
    const keys = { '--database': 'database', '--role': 'role', '--applied-on': 'appliedOn' };
    for (let index = 0; index < args.length; index++) {
      const arg = args[index];
      if ((arg === '--sql' || arg === '--readiness-sql') && output === 'manifest') { output = arg; continue; }
      const key = Object.hasOwn(keys, arg) ? keys[arg] : undefined;
      if (!key || options[key] !== undefined || !args[index + 1] || args[index + 1].startsWith('--')) {
        throw Error('Usage: prepare-ledger-backfill.mjs --database NAME --role NAME --applied-on YYYY-MM-DD [--sql | --readiness-sql]');
      }
      options[key] = args[++index];
    }
    const prepared = await prepareLedgerBackfill(options);
    process.stdout.write(output === '--sql' ? prepared.sql : output === '--readiness-sql' ? prepared.readinessSql : JSON.stringify(prepared.manifest, null, 2) + '\n');
  } catch { console.error('ledger_backfill_preparation_refused'); process.exitCode = 1; }
}
