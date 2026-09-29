import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import WebSocket from 'ws';
import { attachSpeechRelay } from '../relay.mjs';
import { issueTicket, ticketAuthenticator } from '../auth.mjs';

const secret = 'test-worker-secret-with-at-least-32-characters';
const ticketSecret = 'test-ticket-secret-with-at-least-32-characters';
const origin = 'https://game.example.test';
async function eventually(predicate, description) {
  const deadline = Date.now() + 1000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, description);
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
function messages(ws) {
  const queue = [], waiting = [];
  ws.on('message', (data, binary) => {
    const v = binary ? data : JSON.parse(data.toString());
    if (waiting.length) waiting.shift()(v); else queue.push(v);
  });
  return () => queue.length ? Promise.resolve(queue.shift()) : new Promise(resolve => waiting.push(resolve));
}
async function fixture(t, options = {}) {
  const server = createServer();
  const relay = attachSpeechRelay(server, { workerSecret: secret, allowedOrigins: [origin], authenticateClient: ticketAuthenticator(ticketSecret), allowClientPCM: true, ...options });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `ws://127.0.0.1:${server.address().port}`;
  const clients = [];
  t.after(async () => { clients.forEach(ws => ws.terminate()); relay.close(); await new Promise(resolve => server.close(resolve)); });
  const worker = () => { const ws = new WebSocket(`${url}/lipsync-worker`, { headers: { Authorization: `Bearer ${secret}`, 'X-Worker-Id': `worker-${clients.length}` } }); clients.push(ws); return ws; };
  const client = (overrides = {}) => {
    const token = issueTicket(ticketSecret, { userId: 'user1', sessionId: 'session1', ...overrides });
    const ws = new WebSocket(`${url}/speech-stream`, ['astrid-v2', `ticket.${token}`], { origin }); clients.push(ws); return ws;
  };
  return { url, relay, worker, client, clients };
}

test('forwards first media before input end; server owns ids; releases worker after done', { timeout: 5000 }, async t => {
  const idleWorkers = [];
  const f = await fixture(t, { onWorkerIdle: id => idleWorkers.push(id) });
  const w = f.worker(), fromWorker = messages(w); await once(w, 'open');
  assert.deepEqual(f.relay.workerStatus('worker-0'), { workers: 1, busy: 0, available: 1 });
  assert.deepEqual(f.relay.workerStatus('another-worker'), { workers: 0, busy: 0, available: 0 });
  const c = f.client(), fromClient = messages(c); const ready = await fromClient();
  assert.deepEqual(f.relay.workerStatus('worker-0'), { workers: 1, busy: 1, available: 0 });
  c.send(JSON.stringify({ t: 'start', id: 'attacker-id', rate: 24000, protocol: 2 }));
  assert.deepEqual(await fromWorker(), { t: 'start', id: ready.id, rate: 24000, protocol: 2 });
  const pcm = Buffer.alloc(4800, 4); c.send(pcm); assert.deepEqual(await fromWorker(), pcm);
  w.send(JSON.stringify({ t: 'stream', id: ready.id, mime: 'video/mp4; codecs="avc1.64002a, mp4a.40.2"' }));
  assert.equal((await fromClient()).t, 'stream');
  const fragment = Buffer.from('fixture-media'); w.send(fragment);
  assert.deepEqual(await fromClient(), fragment); // end has not yet been sent
  c.send(JSON.stringify({ t: 'end' })); assert.equal((await fromWorker()).t, 'end');
  w.send(JSON.stringify({ t: 'done', id: ready.id, frames: 24, ms: 1000 }));
  assert.equal((await fromClient()).t, 'done');
  assert.equal(f.relay.status().available, 1);
  assert.deepEqual(idleWorkers, ['worker-0']);
});

test('lifecycle stop closes only the named idle worker with a graceful bye', { timeout: 5000 }, async t => {
  const f = await fixture(t);
  const w = f.worker(), fromWorker = messages(w); await once(w, 'open');
  assert.equal(f.relay.stopWorker('unknown-worker'), false);
  const c = f.client(), fromClient = messages(c); const ready = await fromClient();
  c.send(JSON.stringify({ t: 'start', rate: 24000, protocol: 2 })); await fromWorker();
  assert.equal(f.relay.stopWorker('worker-0'), false, 'an active utterance owns the worker');
  w.send(JSON.stringify({ t: 'done', id: ready.id, frames: 1 })); await fromClient();
  const closed = once(w, 'close');
  assert.equal(f.relay.stopWorker('worker-0'), true);
  assert.equal(f.relay.status().available, 0, 'closing sockets cannot admit another speaker');
  assert.deepEqual(await fromWorker(), { t: 'bye' });
  assert.equal((await closed)[0], 1000);
  await eventually(() => f.relay.workerStatus('worker-0').workers === 0, 'terminal worker leaves relay before replacement');
});

test('disconnect holds worker until cancellation acknowledgement', { timeout: 5000 }, async t => {
  const f = await fixture(t);
  const w = f.worker(), fromWorker = messages(w); await once(w, 'open');
  const c = f.client(), fromClient = messages(c); const ready = await fromClient();
  c.send(JSON.stringify({ t: 'start', rate: 24000, protocol: 2 })); await fromWorker();
  c.close(); assert.equal((await fromWorker()).t, 'abort'); assert.equal(f.relay.status().available, 0);
  w.send(JSON.stringify({ t: 'done', id: ready.id, aborted: true }));
  await eventually(() => f.relay.status().available === 1, 'worker must be released after its acknowledgement');
  assert.equal(f.relay.status().available, 1);
});

test('bounds audio and forwards cancellation', { timeout: 5000 }, async t => {
  const f = await fixture(t, { maxAudioSeconds: 0.01 });
  const w = f.worker(), readW = messages(w); await once(w, 'open');
  const c = f.client(), readC = messages(c); await readC();
  c.send(JSON.stringify({ t: 'start', rate: 16000, protocol: 2 })); await readW();
  c.send(Buffer.alloc(322));
  assert.equal((await readC()).error, 'Audio limit exceeded');
  assert.equal((await readW()).t, 'abort');
});

test('rejects missing credentials and foreign origins', { timeout: 5000 }, async t => {
  const f = await fixture(t);
  for (const path of ['/lipsync-worker', '/speech-stream']) {
    const ws = new WebSocket(f.url + path); f.clients.push(ws);
    const error = await new Promise(resolve => ws.once('error', resolve));
    assert.match(error.message, /403/);
  }
});

test('tickets enforce integrity, expiration and single use', () => {
  const auth = ticketAuthenticator(ticketSecret);
  const token = issueTicket(ticketSecret, { userId: 'u', sessionId: 's' });
  const request = value => ({ headers: { 'sec-websocket-protocol': `astrid-v2, ticket.${value}` } });
  assert.equal(auth(request(token + 'x')), null);
  assert.deepEqual(auth(request(token)), { userId: 'u', sessionId: 's' });
  assert.equal(auth(request(token)), null);
  const old = issueTicket(ticketSecret, { userId: 'u', sessionId: 's' }, Date.now() - 90000);
  assert.equal(auth(request(old)), null);
});

test('server source streams PCM directly and browser input is disabled by default', { timeout: 5000 }, async t => {
  const f = await fixture(t, { allowClientPCM: false });
  const w = f.worker(), readW = messages(w); await once(w, 'open');
  const c = f.client(), readC = messages(c); const ready = await readC();
  assert.throws(() => f.relay.openSource({ userId: 'other-user', sessionId: 'session1', id: ready.id, rate: 24000 }), /owned/);
  const source = f.relay.openSource({ userId: 'user1', sessionId: 'session1', id: ready.id, rate: 24000 });
  assert.equal((await readW()).t, 'start');
  const pcm = new Uint8Array(4800); await source.writePCM(pcm);
  assert.deepEqual(await readW(), Buffer.from(pcm));
  source.end(); assert.equal((await readW()).t, 'end');
  c.send(Buffer.alloc(2)); assert.equal((await readC()).error, 'Client audio upload is disabled');
  assert.equal((await readW()).t, 'abort'); assert.equal(source.signal.aborted, true);
});

test('disconnect before start releases warm worker without cancellation', { timeout: 5000 }, async t => {
  const f = await fixture(t);
  const w = f.worker(); await once(w, 'open');
  const c = f.client(), readC = messages(c); await readC(); c.close();
  await once(c, 'close');
  await eventually(() => f.relay.status().available === 1, 'server must release the unstarted session');
  assert.equal(f.relay.status().available, 1); assert.equal(w.readyState, WebSocket.OPEN);
});

test('null and non-object controls are rejected without crashing service', { timeout: 5000 }, async t => {
  const f = await fixture(t);
  const w = f.worker(); await once(w, 'open');
  for (const data of ['null', '[]', '42']) {
    const c = f.client(), readC = messages(c); await readC(); c.send(data);
    assert.equal((await readC()).error, 'Invalid control'); await once(c, 'close');
  }
  w.send('null'); assert.equal((await once(w, 'close'))[0], 1008);
  // Peer close can arrive before the relay receives its own socket close event.
  await eventually(() => f.relay.status().workers === 0, 'server must remove the rejected worker');
  assert.equal(f.relay.status().workers, 0);
});

test('stale source cannot attach to replacement utterance owned by same session', { timeout: 5000 }, async t => {
  const f = await fixture(t, { allowClientPCM: false });
  const w = f.worker(); await once(w, 'open');
  const a = f.client(), readA = messages(a); const first = await readA();
  a.close(); await once(a, 'close');
  await eventually(() => f.relay.status().available === 1, 'server must release the previous session');
  const b = f.client(), readB = messages(b); const second = await readB();
  assert.notEqual(first.id, second.id);
  assert.throws(() => f.relay.openSource({ userId: 'user1', sessionId: 'session1', id: first.id, rate: 24000 }), /owned/);
  assert.throws(() => f.relay.openSource({ userId: 'user1', sessionId: 'session1', rate: 24000 }), /owned/);
  assert.equal(f.relay.openSource({ userId: 'user1', sessionId: 'session1', id: second.id, rate: 24000 }).id, second.id);
});
