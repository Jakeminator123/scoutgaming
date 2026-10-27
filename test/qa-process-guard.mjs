import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The guard patches process globals, so each case runs in its own child.
function guarded(body) {
  const guard = new URL('../tools/qa-process-guard.mjs', import.meta.url).href;
  const program = `
    import assert from 'node:assert/strict';
    import {readFileSync} from 'node:fs';
    import {readFile} from 'node:fs/promises';
    import {Socket} from 'node:net';
    import {installQaProcessGuard} from ${JSON.stringify(guard)};
    ${body}
    console.log('guard case passed');
  `;
  return spawnSync(process.execPath, ['--input-type=module', '-e', program], { windowsHide: true, encoding: 'utf8', env: { PATH: process.env.PATH ?? '' }, timeout: 15000 });
}

test('QA process guard blocks env-file reads and non-harness fetch/TCP before IO', async t => {
  // Real files: the guard must hide existing env files, not merely report absent ones.
  const directory = await mkdtemp(join(tmpdir(), 'croupier-qa-guard-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const name of ['.env', '.env.local', 'agent.env', 'notes.txt']) await writeFile(join(directory, name), 'SECRET=fixture');
  const result = guarded(`
    const directory = ${JSON.stringify(directory)};
    installQaProcessGuard({ports:[4196]});
    installQaProcessGuard({ports:[1]}); // idempotent: a second call never widens the allow-list
    for (const name of ['.env', '.env.local', 'agent.env']) {
      const file = directory + '/' + name;
      assert.throws(()=>readFileSync(file),error=>error.code==='ENOENT');
      await assert.rejects(readFile(file),error=>error.code==='ENOENT');
    }
    assert.equal(readFileSync(directory + '/notes.txt','utf8'),'SECRET=fixture');
    await assert.rejects(fetch('https://example.invalid/'),error=>error.code==='QA_NETWORK_BLOCKED');
    await assert.rejects(fetch('http://127.0.0.1:1/'),error=>error.code==='QA_NETWORK_BLOCKED');
    await assert.rejects(fetch('file:///etc/hosts'),error=>error.code==='QA_NETWORK_BLOCKED');
    assert.throws(()=>new Socket().connect({host:'203.0.113.1',port:443}),error=>error.code==='QA_NETWORK_BLOCKED');
    assert.throws(()=>new Socket().connect({host:'localhost',port:3100}),error=>error.code==='QA_NETWORK_BLOCKED');
    assert.throws(()=>new Socket().connect(4196,'203.0.113.1'),error=>error.code==='QA_NETWORK_BLOCKED');
    const local = new Socket(); local.on('error',()=>{}); local.connect({host:'127.0.0.1',port:4196}); local.destroy();
  `);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /guard case passed/);
});

test('QA process guard refuses to install without explicit valid ports', () => {
  for (const ports of ['undefined', '[]', '[0]', '[70000]', "['abc']"]) {
    const result = guarded(`assert.throws(()=>installQaProcessGuard({ports:${ports}}),/explicit local ports/);`);
    assert.equal(result.status, 0, `${ports}: ${result.stderr}`);
  }
});
