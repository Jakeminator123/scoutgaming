import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SQLITE_PATTERN, sqliteMentions, sqliteViolations } from '../tools/check-no-sqlite.mjs';

// Assembled at runtime: this file must never match the guard it tests.
const moduleName = ['node', 'sqlite'].join(':'), className = 'Database' + 'Sync';

test('the ban exempts only reviewed documentation; code and runtime Markdown stay banned', () => {
  const documentation = ['docs/history/jakob-main-migrering/STORSTADNING-UNDERLAG-2026-10-22.md',
    'migrering/kevin-ks-migrering/AKTIVITETER.md', 'docs/NEXT-AGENT.md', 'START-HERE.md'];
  assert.deepEqual(sqliteViolations(documentation), []);
  const runtime = ['services/game/store.mjs', 'packages/director/node/companion-store.mjs', 'tools/import.mjs',
    'services/openclaw/lab/deploy/runtime-bundle/knowledge/croupier-model.md', 'docs/history/run.mjs', 'docs/config.json'];
  assert.deepEqual(sqliteViolations([...documentation, ...runtime]), runtime);
});

test('mentions come from tracked files as edited; untracked build output is ignored', () => {
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
    assert.deepEqual(sqliteMentions({ cwd: root }), ['src/class-only.mjs', 'src/store.mjs']);
    writeFileSync(join(root, 'src', 'class-only.mjs'), 'export const name = null;\n');
    writeFileSync(join(root, 'src', 'build-output.mjs'), `await import('${moduleName}');\n`);
    assert.deepEqual(sqliteMentions({ cwd: root }), ['src/store.mjs'], 'tracked files are read as edited; untracked output is ignored');
    git('add', 'src/build-output.mjs');
    assert.deepEqual(sqliteMentions({ cwd: root }), ['src/build-output.mjs', 'src/store.mjs']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the guard and its test never match themselves', () => {
  for (const file of ['../tools/check-no-sqlite.mjs', import.meta.url])
    assert.equal(new RegExp(SQLITE_PATTERN).test(readFileSync(new URL(file, import.meta.url), 'utf8')), false, file);
});
