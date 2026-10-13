import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const gateUrl = new URL('../tools/raderingsgrind.mjs', import.meta.url).href;
const gatePath = fileURLToPath(gateUrl);

function repository(t) {
  const parent = resolve(tmpdir());
  const root = mkdtempSync(join(parent, 'raderingsgrind-test-'));
  t.after(() => {
    assert.equal(dirname(root), parent);
    assert.ok(root.startsWith(join(parent, 'raderingsgrind-test-')));
    rmSync(root, { recursive: true, force: true });
  });
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  const put = (name, text) => {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), text);
  };
  git('init', '--quiet', '--initial-branch=main');
  for (const [key, value] of [['user.name','Gate test'],['user.email','gate@example.invalid'],['core.autocrlf','false'],['commit.gpgsign','false'],['core.hooksPath',join(root,'no-hooks')]]) git('config', key, value);
  put('src/consumer.mjs', "import './gone.mjs';\n");
  put('src/gone.mjs', 'export const value = 42;\n');
  put('media/layout.json', '{"files":[]}\n');
  put('media/blob-index.json', '{"files":[]}\n');
  const commit = () => { git('add', '.'); git('commit', '--quiet', '-m', 'fixture'); };
  commit();
  const base = git('rev-parse', 'HEAD').trim();
  const run = (...args) => spawnSync(process.execPath, [gatePath, base, ...args], { cwd: root, encoding: 'utf8' });
  return { root, git, put, commit, base, run };
}

test('strict mode rejects a deleted module while diagnostic mode still reports it', t => {
  const repo = repository(t);
  repo.git('rm', 'src/gone.mjs'); repo.commit();
  const runtime = spawnSync(process.execPath, ['src/consumer.mjs'], { cwd: repo.root, encoding: 'utf8' });
  assert.match(runtime.stderr, /ERR_MODULE_NOT_FOUND/);
  const report = repo.run();
  assert.equal(report.status, 0, report.stderr);
  assert.match(report.stdout, /deleted 1: imports 1/);
  const strict = repo.run('--strict');
  assert.equal(strict.status, 1, strict.stdout + strict.stderr);
});

test('R100 rename checks the removed source path and permits a corrected import', t => {
  const repo = repository(t);
  repo.git('mv', 'src/gone.mjs', 'src/renamed.mjs'); repo.commit();
  assert.match(repo.git('diff', '--name-status', '--find-renames', repo.base, 'HEAD'), /R100\s+src\/gone.mjs\s+src\/renamed.mjs/);
  const broken = repo.run('--strict');
  assert.equal(broken.status, 1, broken.stdout + broken.stderr);
  assert.match(broken.stdout, /IMPORT src\/gone.mjs <- src\/consumer.mjs/);
  repo.put('src/consumer.mjs', "import './renamed.mjs';\n"); repo.commit();
  const fixed = repo.run('--strict');
  assert.equal(fixed.status, 0, fixed.stderr);
  assert.match(fixed.stdout, /deleted 1: imports 0/);
});

test('a live shim at the old path is not treated as a removed module', t => {
  const repo = repository(t);
  repo.git('mv', 'src/gone.mjs', 'src/renamed.mjs');
  repo.put('src/gone.mjs', "export * from './renamed.mjs';\n"); repo.commit();
  const report = repo.run('--strict');
  assert.equal(report.status, 0, report.stderr);
  assert.match(report.stdout, /deleted 0: imports 0/);
});

test('historical mentions stay diagnostic while active registry rows fail strict mode', t => {
  const repo = repository(t);
  repo.git('rm', 'src/gone.mjs');
  repo.put('src/consumer.mjs', 'export const live = true;\n');
  repo.put('docs/history.md', 'Historical removal: src/gone.mjs\n'); repo.commit();
  const history = repo.run('--strict');
  assert.equal(history.status, 0, history.stderr);
  assert.match(history.stdout, /MENTION docs\/history.md/);
  repo.put('media/layout.json', '{"files":[{"path":"src/gone.mjs"}]}\n'); repo.commit();
  const registry = repo.run('--strict');
  assert.equal(registry.status, 1, registry.stdout + registry.stderr);
  assert.match(registry.stdout, /REGISTRY media\/layout.json: 1 deleted files/);
});

test('HEAD and staged comparisons read their own snapshots, including unstaged fixes', t => {
  const repo = repository(t);
  repo.git('mv', 'src/gone.mjs', 'src/renamed.mjs');
  const head = repo.run('--strict');
  assert.equal(head.status, 0, head.stderr);
  assert.match(head.stdout, /comparison .* -> HEAD /);
  const broken = repo.run('--strict', '--staged');
  assert.equal(broken.status, 1, broken.stdout + broken.stderr);
  assert.match(broken.stdout, /comparison .* -> index /);
  repo.put('src/consumer.mjs', "import './renamed.mjs';\n");
  assert.equal(repo.run('--strict', '--staged').status, 1, 'unstaged source must not repair the index');
  repo.git('add', 'src/consumer.mjs');
  repo.put('src/consumer.mjs', "import './gone.mjs';\n");
  assert.equal(repo.run('--strict', '--staged').status, 0, 'unstaged source must not break the index');
});

test('mandatory unreadable registry sources never produce a successful report', t => {
  const repo = repository(t);
  repo.git('rm', 'media/layout.json'); repo.commit();
  const result = repo.run('--strict');
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /source could not be read: "media\/layout.json"/);
});

function runGate({ readError = null, source = "import './gone.mjs';" } = {}) {
  // Exercise the CLI with synthetic Git/filesystem inputs. No repository,
  // temporary file, network call or operating-system permission is changed.
  const harness = `
    import fs from 'node:fs';
    import childProcess from 'node:child_process';
    import os from 'node:os';
    import { syncBuiltinESMExports } from 'node:module';
    const fixture = ${JSON.stringify({ readError, source })};
    const originalRead = fs.readFileSync;
    fs.readFileSync = (file, ...args) => {
      if (file === 'src/consumer.mjs') {
        if (fixture.readError) {
          throw Object.assign(new Error('private error details must stay hidden'), { code: fixture.readError });
        }
        return fixture.source;
      }
      if (file === 'media/layout.json' || file === 'media/blob-index.json') return '{"files":[]}';
      return originalRead(file, ...args);
    };
    fs.writeFileSync = () => {};
    fs.mkdtempSync = () => '/synthetic-raderingsgrind';
    fs.unlinkSync = () => {};
    fs.rmdirSync = () => {};
    os.tmpdir = () => '/synthetic-raderingsgrind';
    childProcess.execFileSync = (command, args) => {
      if (command !== 'git') throw new Error('unexpected command');
      if (args[0] === 'diff') return 'D\\0src/gone.mjs\\0';
      if (args[0] === 'ls-tree') return 'src/consumer.mjs\\0';
      if (args[0] === 'rev-parse') return 'fixture-head\\n';
      if (args[0] === 'show') return fs.readFileSync(args[1].slice(args[1].indexOf(':') + 1), 'utf8');
      throw new Error('unexpected git command');
    };
    // The full-path grep need not find a relative './gone.mjs' import.
    childProcess.spawnSync = () => ({ status: 1, stdout: '', stderr: '' });
    syncBuiltinESMExports();
    process.argv = [process.execPath, 'raderingsgrind.mjs', 'fixture-base'];
    await import(${JSON.stringify(gateUrl)});
  `;
  return spawnSync(process.execPath, ['--input-type=module', '--eval', harness], { encoding: 'utf8' });
}

test('source read failure stops the gate without a clean summary or private error details', () => {
  const result = runGate({ readError: 'EACCES' });
  assert.ifError(result.error);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /source could not be read: "src\/consumer\.mjs" \(EACCES\)/);
  assert.doesNotMatch(result.stderr, /private error details|Error:|at file:/);
});

test('a readable relative import still reports its deleted target', () => {
  const result = runGate();
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /deleted 1: imports 1, mentioning files 0/);
  assert.match(result.stdout, /IMPORT src\/gone\.mjs <- src\/consumer\.mjs/);
});

test('a readable source with only a surviving import has no deleted import', () => {
  const result = runGate({ source: "import './kept.mjs';" });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /deleted 1: imports 0, mentioning files 0/);
});

test('unexpected source-read error codes are redacted', () => {
  const result = runGate({ readError: 'EACCES: private credential context' });
  assert.ifError(result.error);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /source could not be read: "src\/consumer\.mjs" \(UNKNOWN\)/);
  assert.doesNotMatch(result.stderr, /private|credential|Error:/);
});
