import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

function fixture(t) {
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
  const save = state => writeFileSync(join(directory, 'state.json'), JSON.stringify(state));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { directory, run, read, save };
}
function fullQueue() {
  return { version: 1, agents: { owner: { paths: ['web/owned.mjs'], summary: 'Still owned', at: '2026-10-02T12:00:00.000Z' } },
    history: [], pings: Array.from({ length: 40 }, (_, index) => ({ id: `${index.toString(16).padStart(8, '0')}-abc`,
      at: new Date(Date.UTC(2026, 8, 29, 0, 0, index)).toISOString(), from: 'sender', to: 'receiver', text: `Pending ${index}` })) };
}

test('agent-talk serializes writers, protects claims and preserves overflowing pings for the recipient', async t => {
  const { run, read } = fixture(t);
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
    const oldest = read().pings[0];
    assert.equal((await run('ping', 'agent-0', 'agent-1', 'Overflow')).code, 0);
    assert.equal(read().pings.length, 40);
    assert.deepEqual(JSON.parse((await run('archived', 'agent-1')).output).pings[0].id, oldest.id);
    assert.equal((await run('ack', 'intruder', oldest.id, 'Wrong recipient')).code, 1);
    assert.equal((await run('ack', 'agent-1', oldest.id, 'Read from archive')).code, 0);
    assert.equal(JSON.parse((await run('archived', 'agent-1')).output).total, 0);
    assert.equal((await run('done', 'agent-0', 'Complete')).code, 0);
    assert.equal((await run('claim', 'intruder', 'web/file-0.mjs', 'Released')).code, 0);
    assert.equal((await run('status', 'agent-1')).code, 0);
});

test('concurrent overflow keeps newest messages, exact older bytes and unrelated claims', async t => {
  const { directory, run, read, save } = fixture(t), original = fullQueue(); save(original);
  const sent = await Promise.all(Array.from({ length: 8 }, (_, n) => run('ping', 'new-sender', 'new-recipient', `New ${n}`)));
  assert.ok(sent.every(result => result.code === 0), JSON.stringify(sent));
  const state = read(), archive = JSON.parse((await run('archived', 'receiver')).output);
  assert.equal(state.pings.length, 40); assert.equal(archive.total, 8);
  assert.deepEqual(state.agents, original.agents);
  const combined = [...state.pings, ...archive.pings];
  assert.equal(new Set(combined.map(ping => ping.id)).size, 48);
  for (const ping of original.pings) assert.ok(combined.some(saved => saved.id === ping.id && saved.text === ping.text));
  for (const result of sent) assert.ok(state.pings.some(ping => ping.id === result.output.trim()));
  for (const entry of archive.pings) {
    const saved = JSON.parse(readFileSync(join(directory, entry.archive), 'utf8'));
    assert.deepEqual(saved.ping, original.pings.find(ping => ping.id === entry.id));
  }
  const status = JSON.parse((await run('status', 'unrelated')).output);
  assert.deepEqual(status.pings, []); assert.equal(status.queue.pending, 40); assert.equal(status.queue.capacity, 40);
  assert.equal(status.queue.archivedPending, 0);
  assert.equal(JSON.parse((await run('status', 'receiver')).output).queue.archivedPending, 8);
});

test('archive failure leaves the full queue unchanged and emits no successful ping id', async t => {
  const { directory, run, save } = fixture(t); save(fullQueue());
  const before = readFileSync(join(directory, 'state.json'));
  writeFileSync(join(directory, 'arkiv'), 'Blocked archive directory');
  const sent = await run('ping', 'sender', 'receiver', 'Must not disappear');
  assert.equal(sent.code, 1); assert.doesNotMatch(sent.output.trim(), /^[a-f0-9]{8}-[a-f0-9]{3}$/);
  assert.deepEqual(readFileSync(join(directory, 'state.json')), before);
  assert.equal(existsSync(join(directory, 'write.lock')), false);
});

test('interruption after archive write is deduplicated and ack never makes the message reappear', async t => {
  const { directory, run, read, save } = fixture(t), original = fullQueue(); save(original);
  assert.equal((await run('ping', 'sender', 'receiver', 'After overflow')).code, 0);
  const archived = JSON.parse((await run('archived', 'receiver')).output).pings[0];
  const archiveBytes = readFileSync(join(directory, archived.archive));
  // Reproduce interruption between archive commit and atomic state replacement.
  save(original);
  assert.equal(JSON.parse((await run('archived', 'receiver')).output).total, 0);
  assert.equal((await run('ack', 'receiver', original.pings[0].id, 'Recovered')).code, 0);
  assert.equal(read().pings.length, 39);
  assert.equal(JSON.parse((await run('archived', 'receiver')).output).total, 0);
  assert.deepEqual(readFileSync(join(directory, archived.archive)), archiveBytes);
  assert.equal(read().history.filter(entry => entry.kind === 'ack').length, 1);
  assert.equal(JSON.parse((await run('status', 'sender')).output).replies.length, 1);
  assert.equal((await run('ack', 'receiver', original.pings[0].id, 'Duplicate')).code, 1);
  // A persisted archive acknowledgement also survives a lost state write.
  save(original);
  assert.equal((await run('ack', 'receiver', original.pings[0].id, 'Retry')).code, 0);
  assert.equal(read().pings.length, 39); assert.equal(read().history.length, 0);
  assert.equal(JSON.parse((await run('archived', 'receiver')).output).total, 0);
  const replies = JSON.parse((await run('status', 'sender')).output).replies;
  assert.equal(replies.length, 1); assert.match(replies[0].text, /Recovered$/);
});

test('archived inbox is bounded and paginated without replaying requests', async t => {
  const { run, read, save } = fixture(t); save(fullQueue());
  for (let i = 0; i < 41; i++) assert.equal((await run('ping', 'sender', 'receiver', `Newest ${i}`)).code, 0);
  const before = read(), first = JSON.parse((await run('archived', 'receiver')).output);
  const second = JSON.parse((await run('archived', 'receiver', '2')).output);
  assert.equal(first.total, 41); assert.equal(first.pings.length, 40); assert.equal(first.nextPage, 2);
  assert.equal(second.pings.length, 1); assert.equal(second.nextPage, null);
  assert.equal(new Set([...first.pings, ...second.pings].map(ping => ping.id)).size, 41);
  assert.equal((await run('archived', 'receiver', '../')).code, 1);
  assert.deepEqual(read(), before);
});
