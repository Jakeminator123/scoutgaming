import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const gateUrl = new URL('./raderingsgrind.mjs', import.meta.url).href;

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
    os.tmpdir = () => '/synthetic-raderingsgrind';
    childProcess.execFileSync = (command, args) => {
      if (command !== 'git') throw new Error('unexpected command');
      if (args[0] === 'diff') return 'src/gone.mjs\\n';
      if (args[0] === 'ls-files') return 'src/consumer.mjs\\n';
      if (args[0] === 'rev-parse') return 'fixture-head\\n';
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
