#!/usr/bin/env node
// J08 uses J07's owned-cluster lifecycle, without running unrelated game suites.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { runSharedTableQa } from './run-shared-table-qa.mjs';
import { runRoomGameConfigSqlChecks } from '../test/fixtures/room-game-config-sql-checks.mjs';

export function runRoomGameConfigQa(options = {}) {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw Error('J08 Studio verification requires Node24.x');
  return runSharedTableQa({ ...options, runChecks: async context => {
    // 007 (required in the Studio registry, so present in every deployment): since plan L3 PR 3 every
    // package publication reads the company's open appearance draft under the operator lock
    // (operator-store.mjs lockOperator/rebaseOpenDraft). This fixture has no drafts; nothing is carried over.
    for (const file of ['neon-game/product-schema.sql', 'neon-game/008-shared-wallet.sql', 'neon-game/009-shared-blackjack.sql',
      'neon-studio/001-studio-metadata.sql', 'neon-studio/005-operators.sql', 'neon-studio/006-operator-audit.sql',
      'neon-studio/007-partner-branding-drafts.sql', 'neon-studio/012-runtime-media-catalog.sql'])
      await context.pool.query(await readFile(new URL(`../ops/${file}`, import.meta.url), 'utf8'));
    return runRoomGameConfigSqlChecks(context);
  } });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const options = args.length === 1 && args[0] === '--download-postgres' ? { downloadPostgres: true }
    : args.length === 2 && args[0] === '--postgres-bin' ? { postgresBin: args[1] } : null;
  if (!options) { console.error('Usage: node tools/run-room-game-config-qa.mjs --download-postgres | --postgres-bin /absolute/bin'); process.exitCode = 1; }
  else runRoomGameConfigQa(options).catch(error => { console.error(error.stack); process.exitCode = 1; });
}