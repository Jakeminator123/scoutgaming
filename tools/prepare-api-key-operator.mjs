#!/usr/bin/env node
// Offline only: no database driver, environment credentials or apply mode (docs/plans/NYCKEL-BOLAG.md).
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const productChecksum = '831637c49f3fa2210c3c5804531b13807d2d8fb1feb2c324bc2a986493f7fb1a';
const sourcePath = 'ops/neon-game/012-api-key-operator.sql';
export const API_KEY_OPERATOR_VERSION = 'game-012-api-key-operator';
const hash = value => createHash('sha256').update(value).digest('hex');
const literal = value => "'" + value.replaceAll("'", "''") + "'";

/** Evidence references bind the review artifact; they are not proof or execution authorization. */
export async function prepareApiKeyOperator(evidence) {
  const keys = ['database','role','releaseSha','rollbackSha','backupSha256'];
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)
    || Object.keys(evidence).length !== keys.length || keys.some(key => !Object.hasOwn(evidence,key))) throw Error('Complete explicit migration evidence is required');
  for (const key of keys) {
    const pattern = ['database','role'].includes(key) ? /^[a-z_][a-z0-9_]{0,62}$/
      : ['releaseSha','rollbackSha'].includes(key) ? /^[a-f0-9]{40}$/ : /^[a-f0-9]{64}$/;
    if (typeof evidence[key] !== 'string' || !pattern.test(evidence[key])) throw Error('Invalid migration evidence: '+key);
  }
  const product = (await readFile(new URL('../ops/neon-game/product-schema.sql',import.meta.url),'utf8')).replaceAll('\r\n','\n');
  if (hash(product) !== productChecksum) throw Error('Historical product schema changed');
  const source = (await readFile(new URL('../'+sourcePath,import.meta.url),'utf8')).replaceAll('\r\n','\n');
  const migrationChecksum = hash(source);
  const boundEvidence = Object.fromEntries(keys.map(key => [key,evidence[key]]));
  const values = { database:evidence.database,role:evidence.role,productChecksum,migrationChecksum,
    evidence:JSON.stringify({productChecksum,migrationChecksum,...boundEvidence}) };
  const sql = source.replace(/\{\{([a-zA-Z]+)\}\}/g,(_,key) => {
    if (!Object.hasOwn(values,key)) throw Error('Unknown migration source parameter');
    return literal(values[key]);
  });
  if (sql.includes('{{') || sql.includes('}}')) throw Error('Unresolved migration source parameter');
  const parts=sql.split('-- MIGRATION MUTATIONS\n');
  if(parts.length!==2) throw Error('Migration readiness boundary is ambiguous');
  const readinessSql=parts[0]+'ROLLBACK;\n';
  return { sql,readinessSql,manifest: { version:API_KEY_OPERATOR_VERSION,sourcePath,productChecksum,migrationChecksum,
    sqlSha256:hash(sql),readinessSha256:hash(readinessSql),evidence:boundEvidence,applies:false,productionApproved:false,
    // Code from PR A reads the column tolerantly; only PR C requires this ledger row at start.
    deploymentRequired:false,minimumServerMajor:16,emptyTableOnly:true,atomic:true,
    recovery:'Neon backup branch backup-api-key-operator-<date> taken first (docs/ENVIRONMENT-RESTORATION.md); no blind DOWN or in-place restore.' } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (![2,3].includes(args.length) || args[0] !== '--evidence' || args[1].startsWith('--')
      || (args.length===3 && !['--sql','--readiness-sql'].includes(args[2]))) throw Error('Usage: prepare-api-key-operator.mjs --evidence PRIVATE_JSON [--sql | --readiness-sql]');
    const evidence = JSON.parse(await readFile(args[1],'utf8'));
    const prepared = await prepareApiKeyOperator(evidence);
    process.stdout.write(args[2] === '--sql' ? prepared.sql : args[2] === '--readiness-sql' ? prepared.readinessSql : JSON.stringify(prepared.manifest,null,2)+'\n');
  } catch { console.error('api_key_operator_preparation_refused'); process.exitCode=1; }
}
