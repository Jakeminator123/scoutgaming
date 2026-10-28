#!/usr/bin/env node
// Flat ban (Jakob 2026-10-27: one product path, no SQLite): no tracked file may mention
// Node's SQLite module or its synchronous database class, except documentation.
// Documentation is the reviewed prose set in tools/documentation-paths.mjs (guides,
// docs/**, migrering/**.md, docs/history/**); it has no runtime role. Runtime Markdown
// (prompts, runtime bundles, package docs outside that set) is code here and stays banned.
// CI runs this in the full regression (contracts/no-sqlite). A documentation-only PR
// cannot add a violation, because every file it touches is exempt.
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDocumentationPath } from './documentation-paths.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Built from parts so this guard and its test never match themselves.
export const SQLITE_PATTERN = ['node', 'sqlite'].join(':') + '|' + 'Database' + 'Sync';

export function sqliteMentions({ cwd = repository } = {}) {
  // Tracked files as edited in the working tree; untracked build output stays out.
  let output;
  try {
    output = execFileSync('git', ['grep', '-I', '-l', '-E', SQLITE_PATTERN, '--', '.'],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
  } catch (error) { if (error.status === 1) return []; throw error; } // git grep: 1 means no match.
  return [...new Set(output.split(/\r?\n/).filter(Boolean))].sort();
}

export function sqliteViolations(mentions) {
  return mentions.filter(path => !isDocumentationPath(path));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) { console.error('Usage: node tools/check-no-sqlite.mjs'); process.exitCode = 2; }
  else {
    const mentions = sqliteMentions(), violations = sqliteViolations(mentions);
    for (const file of violations) console.error(`${file}: SQLite is retired; the product path is PostgreSQL only (tests use PGlite, test/fixtures/pglite-pool.mjs).`);
    if (violations.length) process.exitCode = 1;
    else console.log(`SQLite ban: no use outside documentation (${mentions.length} documentation mentions).`);
  }
}
