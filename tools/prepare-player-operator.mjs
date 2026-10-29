#!/usr/bin/env node
// Offline only: no database driver, environment credentials or apply mode (docs/plans/STEG-F.md).
// Renders game-014 (players.operator_id) for Jakob; the evidence names the target, the engine's
// Studio scope and the fallback company of the backfill, which is Jakob's decision.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const productChecksum = '831637c49f3fa2210c3c5804531b13807d2d8fb1feb2c324bc2a986493f7fb1a';
const sourcePath = 'ops/neon-game/014-player-operator.sql';
export const PLAYER_OPERATOR_VERSION = 'game-014-player-operator';
const hash = value => createHash('sha256').update(value).digest('hex');
const literal = value => "'" + value.replaceAll("'", "''") + "'";
const KEYS = Object.freeze(['database', 'role', 'environment', 'workspace', 'fallbackOperator', 'releaseSha', 'rollbackSha', 'backupSha256']);
const PATTERNS = Object.freeze({
  database: /^[a-z_][a-z0-9_]{0,62}$/, role: /^[a-z_][a-z0-9_]{0,62}$/,
  // The same checks as croupier_studio.operators (Studio 005).
  environment: /^[a-z][a-z0-9_-]{0,62}$/, workspace: /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/,
  fallbackOperator: /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/,
  releaseSha: /^[a-f0-9]{40}$/, rollbackSha: /^[a-f0-9]{40}$/, backupSha256: /^[a-f0-9]{64}$/,
});

/** Evidence references bind the review artifact; they are not proof or execution authorization. */
export async function preparePlayerOperator(evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)
    || Object.keys(evidence).length !== KEYS.length || KEYS.some(key => !Object.hasOwn(evidence, key))) throw Error('Complete explicit migration evidence is required');
  for (const key of KEYS) if (typeof evidence[key] !== 'string' || !PATTERNS[key].test(evidence[key])) throw Error('Invalid migration evidence: ' + key);
  const product = (await readFile(new URL('../ops/neon-game/product-schema.sql', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
  if (hash(product) !== productChecksum) throw Error('Historical product schema changed');
  const source = (await readFile(new URL('../' + sourcePath, import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
  const migrationChecksum = hash(source);
  const boundEvidence = Object.fromEntries(KEYS.map(key => [key, evidence[key]]));
  const values = { database: evidence.database, role: evidence.role, environment: evidence.environment, workspace: evidence.workspace,
    fallbackOperator: evidence.fallbackOperator, productChecksum, migrationChecksum,
    evidence: JSON.stringify({ productChecksum, migrationChecksum, ...boundEvidence }) };
  const sql = source.replace(/\{\{([a-zA-Z]+)\}\}/g, (_, key) => {
    if (!Object.hasOwn(values, key)) throw Error('Unknown migration source parameter');
    return literal(values[key]);
  });
  if (sql.includes('{{') || sql.includes('}}')) throw Error('Unresolved migration source parameter');
  const parts = sql.split('-- MIGRATION MUTATIONS\n');
  if (parts.length !== 2) throw Error('Migration readiness boundary is ambiguous');
  // The readiness run shows the backfill plan (rule, company, players) and writes nothing.
  const readinessSql = parts[0] + 'ROLLBACK;\n';
  return { sql, readinessSql, manifest: { version: PLAYER_OPERATOR_VERSION, sourcePath, productChecksum, migrationChecksum,
    sqlSha256: hash(sql), readinessSha256: hash(readinessSql), evidence: boundEvidence, applies: false, productionApproved: false,
    // PR F1 reads the column tolerantly; only the krav PR requires this ledger row at start.
    deploymentRequired: false, minimumServerMajor: 16, idempotent: true, atomic: true,
    backfill: ['partner-key', 'latest-table', 'fallback'],
    recovery: 'Neon backup branch backup-player-operator-<date> taken first (docs/ENVIRONMENT-RESTORATION.md); no blind DOWN or in-place restore.' } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (![2, 3].includes(args.length) || args[0] !== '--evidence' || args[1].startsWith('--')
      || (args.length === 3 && !['--sql', '--readiness-sql'].includes(args[2]))) throw Error('Usage: prepare-player-operator.mjs --evidence PRIVATE_JSON [--sql | --readiness-sql]');
    const evidence = JSON.parse(await readFile(args[1], 'utf8'));
    const prepared = await preparePlayerOperator(evidence);
    process.stdout.write(args[2] === '--sql' ? prepared.sql : args[2] === '--readiness-sql' ? prepared.readinessSql : JSON.stringify(prepared.manifest, null, 2) + '\n');
  } catch { console.error('player_operator_preparation_refused'); process.exitCode = 1; }
}
