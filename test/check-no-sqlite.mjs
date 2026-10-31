import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sqliteImports, sqliteDependencies, sqliteViolations } from '../tools/check-no-sqlite.mjs';

test('comments, negative-test strings and type-only references are not executable SQLite use', () => {
  assert.deepEqual(sqliteImports(`
    // import { DatabaseSync } from 'node:sqlite';
    const example = "await import('node:sqlite')";
    const name = 'DatabaseSync';
    type DatabaseSync = { close(): void };
    import type { DatabaseSync as OldStore } from 'node:sqlite';
    import { type StatementSync } from 'node:sqlite';
    export type { DatabaseSync } from 'node:sqlite';
    assert.equal(source.includes('node:sqlite'), false);
  `, 'contract.test.ts'), []);
  assert.deepEqual(sqliteImports("import { DatabaseSync } from 'node:sqlite';", 'types.d.mts'), []);
});

test('actual SQLite module loading is refused across ESM, CommonJS and constant specifiers', () => {
  for (const source of [
    "import { DatabaseSync } from 'node:sqlite';",
    "import 'sqlite3';",
    "export { default } from 'better-sqlite3';",
    "const store = require('sql.js');",
    "const store = module.require('sqlite');",
    "const path = require.resolve('sqlite3');",
    "const store = await import(`bun:sqlite`);",
    "const moduleName = 'node:' + 'sqlite'; await import(moduleName);",
    "import { createRequire as makeRequire } from 'node:module'; const load = makeRequire(import.meta.url); load('node:sqlite');",
    "import { createRequire } from 'node:module'; createRequire(import.meta.url)('node:sqlite');",
    "import { createRequire } from 'module'; const require = createRequire(import.meta.url); require('node:sqlite');",
    "import * as nodeModule from 'node:module'; const load = nodeModule.createRequire(import.meta.url); load('node:sqlite');",
    "import sqlite = require('sqlite3');",
    "await import('node:\\x73qlite');",
  ]) {
    const found = sqliteImports(source, 'store.ts');
    assert.equal(found.length, 1, source);
    assert.equal(found[0].line, 1);
  }
  assert.deepEqual(sqliteImports("import pg from 'pg'; const database = new DatabaseSync();"), [], 'a class name alone is no evidence of loading SQLite');
});

test('constant specifiers and require aliases respect lexical scopes', () => {
  assert.deepEqual(sqliteImports("const name = 'pg'; function oldExample() { const name = 'node:sqlite'; } await import(name);"), []);
  assert.equal(sqliteImports("const name = 'pg'; function badStore() { const name = 'node:sqlite'; return import(name); }").length, 1);
  assert.deepEqual(sqliteImports("function callback(require) { require('node:sqlite'); }"), [], 'a passed callback is not the Node loader');
});

test('manifest dependencies include aliased SQLite packages without matching descriptions', () => {
  assert.deepEqual(sqliteDependencies(JSON.stringify({
    description: 'Replace sqlite3 with PostgreSQL',
    dependencies: { pg: '8', oldStore: 'npm:sqlite3@5.1.7' },
    optionalDependencies: { 'better-sqlite3': '11' },
    devDependencies: { '@electric-sql/pglite': '0.3' },
  })), ['sqlite3', 'better-sqlite3']);
});

test('the audit reads tracked edited source, ignores examples and output, and catches new tracked imports', () => {
  const root = mkdtempSync(join(tmpdir(), 'no-sqlite-'));
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' };
  for (const key of Object.keys(env)) if (/^GIT_(?:DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES)$/.test(key)) delete env[key];
  const git = (...args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    git('init', '-q', '-b', 'main');
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src', 'store.mjs'), "import { DatabaseSync } from 'node:sqlite';\n");
    writeFileSync(join(root, 'src', 'comment.mjs'), "// DatabaseSync was replaced; import('node:sqlite') is a negative example.\n");
    writeFileSync(join(root, 'src', 'README.md'), "Example: import('node:sqlite')\n");
    git('add', '.');
    assert.deepEqual(sqliteViolations({ cwd: root }), [{ path: 'src/store.mjs', line: 1, specifier: 'node:sqlite' }]);
    writeFileSync(join(root, 'src', 'store.mjs'), "import pg from 'pg';\n");
    writeFileSync(join(root, 'src', 'output.mjs'), "await import('node:sqlite');\n");
    assert.deepEqual(sqliteViolations({ cwd: root }), [], 'edited tracked source is current; untracked output is ignored');
    git('add', 'src/output.mjs');
    assert.deepEqual(sqliteViolations({ cwd: root }), [{ path: 'src/output.mjs', line: 1, specifier: 'node:sqlite' }]);
    writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { sqlite3: '5.1.7' } }));
    git('add', 'package.json');
    assert.equal(sqliteViolations({ cwd: root }).some(item => item.path === 'package.json' && item.specifier === 'sqlite3'), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a fresh checkout without the parser fails with the installation command', () => {
  const root = mkdtempSync(join(tmpdir(), 'sqlite-parser-'));
  try {
    mkdirSync(join(root, 'tools'));
    const tool = join(root, 'tools', 'check-no-sqlite.mjs');
    writeFileSync(tool, readFileSync(new URL('../tools/check-no-sqlite.mjs', import.meta.url)));
    const script = `const {sqliteImports}=await import(${JSON.stringify(pathToFileURL(tool).href)}); sqliteImports('export const value = 1;');`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: root, encoding: 'utf8', timeout: 10000 });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /npm --prefix apps\/studio ci/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
