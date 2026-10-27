import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ALLOWLIST, SQLITE_PATTERN, checkSqliteRatchet, sqliteMentions } from '../tools/check-no-sqlite.mjs';

// Assembled at runtime: this file must never match the guard it tests.
const moduleName = ['node', 'sqlite'].join(':'), className = 'Database' + 'Sync';
const entry = (path, removeBy = 'PR-6') => ({ path, removeBy, reason: 'fixture' });

test('ratchet rejects new use, stale entries and malformed or unsorted allowlists', () => {
  assert.deepEqual(checkSqliteRatchet({ mentions: ['a.mjs'], allowlist: [entry('a.mjs')] }), []);
  assert.match(checkSqliteRatchet({ mentions: ['a.mjs', 'b.mjs'], allowlist: [entry('a.mjs')] }).join('\n'), /b\.mjs: new SQLite use/);
  assert.match(checkSqliteRatchet({ mentions: [], allowlist: [entry('a.mjs')] }).join('\n'), /a\.mjs: no longer mentions SQLite; remove it/);
  assert.match(checkSqliteRatchet({ mentions: ['a.mjs', 'b.mjs'], allowlist: [entry('b.mjs'), entry('a.mjs')] }).join('\n'), /sorted/);
  assert.match(checkSqliteRatchet({ mentions: ['a.mjs'], allowlist: [entry('a.mjs'), entry('a.mjs')] }).join('\n'), /unique/);
  for (const bad of [{ path: 'a.mjs', reason: 'x' }, { ...entry('a.mjs'), removeBy: ' ' }, { ...entry('a.mjs'), extra: 1 }, entry('../a.mjs')])
    assert.match(checkSqliteRatchet({ mentions: ['a.mjs'], allowlist: [bad] }).join('\n'), /entry 0 needs/);
  assert.deepEqual(checkSqliteRatchet({ mentions: [], allowlist: {} }), ['allowlist must be a list of { path, removeBy, reason }']);
});

test('mentions come from the commit tree, so a sparse checkout still sees every tracked file', () => {
  const root = mkdtempSync(join(tmpdir(), 'no-sqlite-'));
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' };
  for (const key of Object.keys(env)) if (/^GIT_(?:DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES)$/.test(key)) delete env[key];
  const git = (...args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    git('init', '-q', '-b', 'main'); git('config', 'user.name', 'CI fixture'); git('config', 'user.email', 'ci@example.invalid');
    git('config', 'core.hooksPath', join(root, 'no-hooks'));
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src', 'store.mjs'), `import { ${className} } from '${moduleName}';\n`);
    writeFileSync(join(root, 'src', 'class-only.mjs'), `export const name = '${className}';\n`);
    writeFileSync(join(root, 'src', 'clean.mjs'), 'export const sqlite = false;\n');
    git('add', '.'); git('commit', '-qm', 'fixture');
    assert.deepEqual(sqliteMentions({ cwd: root, tree: 'HEAD' }), ['src/class-only.mjs', 'src/store.mjs']);
    git('sparse-checkout', 'set', '--no-cone', '/src/clean.mjs');
    assert.throws(() => readFileSync(join(root, 'src', 'store.mjs')), { code: 'ENOENT' });
    assert.deepEqual(sqliteMentions({ cwd: root, tree: 'HEAD' }), ['src/class-only.mjs', 'src/store.mjs']);
    git('sparse-checkout', 'disable');
    writeFileSync(join(root, 'src', 'class-only.mjs'), 'export const name = null;\n');
    writeFileSync(join(root, 'src', 'build-output.mjs'), `await import('${moduleName}');\n`);
    assert.deepEqual(sqliteMentions({ cwd: root }), ['src/store.mjs'], 'local mode reads tracked files as edited; untracked build output is ignored');
    git('add', 'src/build-output.mjs');
    assert.deepEqual(sqliteMentions({ cwd: root }), ['src/build-output.mjs', 'src/store.mjs']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the guard and its test never match themselves', () => {
  // The repository-wide check runs as tools/check-no-sqlite.mjs (CI: --tree HEAD in the classifier job).
  for (const file of ['../tools/check-no-sqlite.mjs', '../' + ALLOWLIST, import.meta.url])
    assert.equal(new RegExp(SQLITE_PATTERN).test(readFileSync(new URL(file, import.meta.url), 'utf8')), false, file);
});
