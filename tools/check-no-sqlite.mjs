#!/usr/bin/env node
// Ratchet for the SQLite removal: only files in tools/no-sqlite-allowlist.json may
// mention Node's SQLite module or its synchronous database class, and every entry
// must still need it. A PR that removes the last mention also removes its entry,
// so the list only shrinks. CI passes --tree HEAD: the classification job has a
// sparse checkout, and git grep on the commit tree sees every tracked file.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Built from parts so this guard, its test and its allowlist never match themselves.
export const SQLITE_PATTERN = ['node', 'sqlite'].join(':') + '|' + 'Database' + 'Sync';
export const ALLOWLIST = 'tools/no-sqlite-allowlist.json';

export function sqliteMentions({ cwd = repository, tree = null, paths = null } = {}) {
  // Without a tree: tracked files as edited in the working tree (build output stays out).
  // With paths: only those pathspecs. A lazily fetched (blob:none) sparse clone would
  // otherwise download every blob of the tree one by one; CI passes the merge diff plus the allowlist.
  if (paths && !paths.length) return [];
  const args = ['grep', '-I', '-l', '-E', SQLITE_PATTERN, ...(tree ? [tree] : []), '--', ...(paths ?? ['.'])];
  let output;
  try { output = execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 }); }
  catch (error) { if (error.status === 1) return []; throw error; } // git grep: 1 means no match.
  const prefix = tree ? `${tree}:` : '';
  return [...new Set(output.split(/\r?\n/).filter(Boolean).map(line => line.startsWith(prefix) ? line.slice(prefix.length) : line))].sort();
}

export function checkSqliteRatchet({ mentions, allowlist }) {
  const errors = [];
  if (!Array.isArray(allowlist)) return ['allowlist must be a list of { path, removeBy, reason }'];
  const paths = allowlist.map(entry => entry?.path);
  allowlist.forEach((entry, index) => {
    if (!entry || typeof entry.path !== 'string' || !/^[\w.@/-]+$/.test(entry.path) || entry.path.split('/').includes('..')
      || typeof entry.removeBy !== 'string' || !entry.removeBy.trim() || typeof entry.reason !== 'string' || !entry.reason.trim()
      || Object.keys(entry).sort().join() !== 'path,reason,removeBy') errors.push(`entry ${index} needs exactly path, removeBy and reason`);
  });
  if (new Set(paths).size !== paths.length) errors.push('allowlist paths must be unique');
  if (paths.join('\n') !== [...paths].sort().join('\n')) errors.push('allowlist must be sorted by path');
  const allowed = new Set(paths), found = new Set(mentions);
  for (const file of mentions) if (!allowed.has(file)) errors.push(`${file}: new SQLite use; the product path is PostgreSQL only`);
  for (const file of paths) if (typeof file === 'string' && !found.has(file)) errors.push(`${file}: no longer mentions SQLite; remove it from ${ALLOWLIST}`);
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const ref = /^[\w./^~-]+$/;
  const tree = (args.length === 2 || args.length === 4) && args[0] === '--tree' && ref.test(args[1]) ? args[1] : args.length === 0 ? null : undefined;
  const since = args.length === 4 && tree && args[2] === '--changed-since' && ref.test(args[3]) ? args[3] : args.length === 4 ? undefined : null;
  if (tree === undefined || since === undefined) { console.error('Usage: node tools/check-no-sqlite.mjs [--tree HEAD [--changed-since HEAD^1]]'); process.exitCode = 2; }
  else {
    const allowlist = JSON.parse(readFileSync(join(repository, ALLOWLIST), 'utf8'));
    // --changed-since: grep only the files of that diff plus the allowlist, so a blob:none clone fetches a handful of blobs.
    const changed = since ? execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', since, tree], { cwd: repository, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).split(/\r?\n/).filter(Boolean) : null;
    const paths = changed ? [...new Set([...changed, ...allowlist.map(entry => entry?.path).filter(path => typeof path === 'string')])].sort() : null;
    const mentions = sqliteMentions({ tree, paths });
    const errors = checkSqliteRatchet({ mentions, allowlist });
    for (const error of errors) console.error(error);
    if (errors.length) process.exitCode = 1;
    else console.log(`SQLite ratchet: ${mentions.length} allowlisted files (${tree ?? 'working tree'}${since ? `, ${paths.length} pathspecs since ${since}` : ''}); no new use.`);
  }
}
