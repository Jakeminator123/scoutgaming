import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

test('agent-talk serializes writers, protects claims and bounds history without dropping pending pings', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'agent-talk-'));
  const run = (...args) => new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [resolve('tools/agent-talk.mjs'), ...args], {
      env: { ...process.env, AGENT_TALK_TEST_DIR: directory }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    child.once('error', reject);
    child.once('close', code => resolveResult({ code, output }));
  });
  const read = () => JSON.parse(readFileSync(join(directory, 'state.json'), 'utf8'));
  try {
    const claims = await Promise.all(Array.from({ length: 10 }, (_, index) => run('claim', `agent-${index}`, `web/file-${index}.mjs`, 'Test')));
    assert.ok(claims.every(result => result.code === 0), JSON.stringify(claims));
    assert.equal(Object.keys(read().agents).length, 10);
    assert.equal((await run('claim', 'intruder', 'WEB', 'Overlap')).code, 1);
    assert.equal((await run('claim', 'intruder', '../web', 'Traversal')).code, 1);
    const ping = await run('ping', 'agent-0', 'agent-1', 'Question');
    assert.equal(ping.code, 0);
    assert.equal((await run('ack', 'intruder', ping.output.trim(), 'Wrong recipient')).code, 1);
    assert.equal((await run('ack', 'agent-1', ping.output.trim(), 'Answer')).code, 0);
    assert.equal(read().pings.length, 0);
    assert.ok(read().history.at(-1).text.includes('Answer'));
    assert.equal(JSON.parse((await run('status','agent-0')).output).replies[0].to,'agent-0');
    for (let index = 0; index < 45; index++) assert.equal((await run('claim', 'agent-0', 'web/file-0.mjs', `Step ${index}`)).code, 0);
    assert.equal(read().history.length, 40);
    for (let index = 0; index < 40; index++) assert.equal((await run('ping', 'agent-0', 'agent-1', `Ping ${index}`)).code, 0);
    assert.equal((await run('ping', 'agent-0', 'agent-1', 'Overflow')).code, 1);
    assert.equal(read().pings.length, 40);
    assert.equal((await run('done', 'agent-0', 'Complete')).code, 0);
    assert.equal((await run('claim', 'intruder', 'web/file-0.mjs', 'Released')).code, 0);
    assert.equal((await run('status', 'agent-1')).code, 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
