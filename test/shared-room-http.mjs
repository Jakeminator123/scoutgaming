import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { connect } from 'node:net';
import { setImmediate as turn } from 'node:timers/promises';
import { createSharedRoomCommand } from '../services/game/shared-room-command.mjs';
import { handleSharedRoomHttp } from '../services/game/shared-room-http.mjs';

const origin = 'https://player.example.test', path = '/api/shared-room/room-a/command';
const input = { op: 'ready', commandId: 'request-1', windowId: 'window-a' };
const cookie = 'croupier_session=server-selected-alice; preference=en';
const resources = [];
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function bounded(promise) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Loopback test timed out')), 5000); })]); }
  finally { clearTimeout(timer); }
}
const output = () => ({ result: { op: 'ready', version: 1, started: false }, replay: false,
  snapshot: { contract: 'blackjack-table/1', roomId: 'room-a', version: 1, presentationVer: 0,
    configVersion: 'v1', windowId: 'window-a', me: { id: 'alice', available: 100 } } });

async function fixture(t, { disabled = false, maxBodyBytes, onCommand } = {}) {
  const seen = [], records = [], pending = new Set(), sockets = new Set(), socketClosures = [], arrived = deferred();
  let command, engineOrigin;
  const server = createServer((req, res) => {
    arrived.resolve({ req, res });
    const before = { req: Object.fromEntries(['aborted', 'data', 'end', 'error'].map(event => [event, req.listenerCount(event)])),
      res: Object.fromEntries(['close', 'finish', 'error'].map(event => [event, res.listenerCount(event)])) };
    const work = (async () => {
      const handled = await handleSharedRoomHttp(req, res, { command, engineOrigin });
      records.push({ handled, req, res, before, finished: res.writableFinished || res.destroyed });
      if (!handled) { res.writeHead(404); res.end(); }
    })();
    pending.add(work); work.finally(() => pending.delete(work)).catch(error => { records.push({ error }); res.destroy(); });
  });
  server.on('connection', socket => {
    sockets.add(socket);
    socketClosures.push(new Promise(resolve => socket.once('close', () => { sockets.delete(socket); resolve(); })));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; engineOrigin = `http://127.0.0.1:${port}`;
  resources.push({ host: '127.0.0.1', port, pid: process.pid, closed: false });
  const resource = resources.at(-1);
  command = disabled ? null : createSharedRoomCommand({ origin, engineOrigin, ...(maxBodyBytes ? { maxBodyBytes } : {}), service: {
    async command(request, fields) {
      const actor = request.headers.get('cookie') === cookie ? 'alice' : null;
      seen.push({ actor, headers: Object.fromEntries(request.headers), url: request.url, ...fields });
      if (!actor) throw Object.assign(Error('private session details'), { statusCode: 401 });
      return onCommand ? onCommand(request, fields) : output();
    },
  } });
  const idle = async () => { await bounded(Promise.all([...pending])); };
  t.after(async () => {
    const closed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    server.closeAllConnections(); await bounded(closed); await idle(); await bounded(Promise.all(socketClosures));
    assert.equal(server.listening, false); assert.equal(sockets.size, 0);
    const refusal = await new Promise((resolve, reject) => {
      const socket = connect({ host: '127.0.0.1', port });
      socket.once('connect', () => { socket.destroy(); reject(Error('Task loopback port still accepts connections')); });
      socket.once('error', error => { socket.destroy(); resolve(error.code); });
    });
    assert.equal(refusal, 'ECONNREFUSED'); resource.closed = true;
    for (const record of records) {
      assert.equal(record.error, undefined);
      for (const target of ['req', 'res']) for (const [event, count] of Object.entries(record.before[target])) {
        // Node installs clearIncoming itself after a response that did not read
        // the body. It is not a bridge listener and can remain on a closed req.
        const remaining = record[target].listeners(event).filter(fn => !(target === 'req' && event === 'end' && fn.name === 'clearIncoming'));
        assert.ok(remaining.length <= count, `${target}.${event} bridge listeners cleaned`);
      }
      if (record.handled) assert.equal(record.finished, true, 'bridge awaits response completion or client close');
    }
  });
  function start(options = {}) {
    const req = httpRequest({ host: '127.0.0.1', port, path: options.path ?? path, method: options.method ?? 'POST', agent: false,
      headers: { host: `127.0.0.1:${port}`, origin, cookie, 'content-type': 'application/json', ...options.headers } });
    const response = new Promise((resolve, reject) => {
      req.once('error', reject);
      req.once('response', res => {
        const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.once('error', reject);
        res.once('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
      });
    });
    return { req, response };
  }
  async function send(options = {}) {
    const client = start(options);
    client.req.end(options.body ?? ((options.method ?? 'POST') === 'POST' ? JSON.stringify(input) : undefined));
    const response = await bounded(client.response); await idle(); return response;
  }
  return { seen, records, pending, start, send, idle, engineOrigin, arrived };
}

test('real HTTP POST preserves Host, cookie and Origin and passes only the parsed server room/payload to the service', async t => {
  const h = await fixture(t), response = await h.send();
  assert.equal(response.status, 200); assert.deepEqual(JSON.parse(response.text), output());
  assert.equal(response.headers['cache-control'], 'private, no-store');
  assert.equal(response.headers['cdn-cache-control'], 'no-store');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(h.seen.length, 1); assert.equal(h.seen[0].actor, 'alice');
  assert.equal(h.seen[0].headers.host, new URL(h.engineOrigin).host);
  assert.equal(h.seen[0].headers.origin, origin); assert.equal(h.seen[0].headers.cookie, cookie);
  assert.equal(h.seen[0].url, h.engineOrigin + path);
  assert.equal(h.seen[0].roomId, 'room-a'); assert.deepEqual(h.seen[0].input, { roomId: 'room-a', ...input });
  assert.equal(h.seen[0].signal.aborted, false);
});

test('raw HTTP request targets reject dot/percent/query/fragment paths before normalization; unrelated paths return false', async t => {
  const h = await fixture(t);
  for (const invalid of ['/api/shared-room', '/api/shared-room/', path + '?', path + '?x=1', path + '#fragment',
    '/api/shared-room/a/../room-a/command', '/api/shared-room/../elsewhere', '/other/../api/shared-room/room-a/command',
    '/api/shared-room/%72oom-a/command', '/api/shared-room/%2e%2e/room-a/command', '/api/shared-room/room-a%2fother/command',
    '/api/shared-room/Room-A/command', '/api/shared-room/' + 'a'.repeat(129) + '/command']) {
    const response = await h.send({ path: invalid });
    assert.equal(response.status, 400, invalid); assert.deepEqual(JSON.parse(response.text), { error: 'shared_room_invalid_path' });
  }
  for (const other of ['/', '/api/table', '/api/shared-rooms/room-a/command', '/api/shared-room-other']) {
    assert.equal((await h.send({ path: other })).status, 404); assert.equal(h.records.at(-1).handled, false);
  }
  assert.equal(h.seen.length, 0);
});

test('disabled HTTP namespace fails closed without intercepting other routes', async t => {
  const h = await fixture(t, { disabled: true });
  const response = await h.send();
  assert.equal(response.status, 503); assert.deepEqual(JSON.parse(response.text), { error: 'shared_room_service_unavailable' });
  assert.equal((await h.send({ path: '/' })).status, 404); assert.equal(h.records.at(-1).handled, false);
});

test('real HTTP rejects foreign Origin/Host, alternate credentials, identity injection and methods before service admission', async t => {
  const h = await fixture(t);
  for (const headers of [{ origin: 'https://foreign.example.test' }, { origin: '' }, { host: 'foreign.example.test' },
    { host: 'foreign.example.test', 'x-forwarded-host': new URL(h.engineOrigin).host }, { authorization: 'Bearer private' },
    { 'x-worker-id': 'worker' }, { 'sec-websocket-protocol': 'private' }]) assert.equal((await h.send({ headers })).status, 403);
  for (const extra of [{ actorId: 'mallory' }, { roomId: 'other' }, { digest: 'other' }, { sessionId: 'other' }]) {
    assert.equal((await h.send({ body: JSON.stringify({ ...input, ...extra }) })).status, 400);
  }
  for (const method of ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS']) {
    const response = await h.send({ method }); assert.equal(response.status, 405); assert.equal(response.headers.allow, 'POST');
  }
  assert.equal(h.seen.length, 0);
  const noCookie = await h.send({ headers: { cookie: 'preference=en' } });
  assert.equal(noCookie.status, 401); assert.deepEqual(JSON.parse(noCookie.text), { error: 'shared_room_authentication_required' });
  assert.equal(h.seen[0].actor, null);
});

test('oversized chunked HTTP body returns 413 instead of dropping the socket and never reaches the service', async t => {
  const h = await fixture(t, { maxBodyBytes: 64 });
  const client = h.start({ headers: { 'transfer-encoding': 'chunked' } });
  client.req.write('x'.repeat(32)); client.req.write('x'.repeat(33)); client.req.end();
  const response = await bounded(client.response); await h.idle();
  assert.equal(response.status, 413); assert.deepEqual(JSON.parse(response.text), { error: 'shared_room_body_too_large' });
  assert.equal(h.seen.length, 0);
});

test('oversized declared HTTP body returns 413 before the client finishes sending it', async t => {
  const h = await fixture(t, { maxBodyBytes: 64 });
  const client = h.start({ headers: { 'content-length': '1024' } });
  t.after(() => client.req.destroy());
  client.req.write('x'); // Deliberately neither send the remaining bytes nor end.
  const response = await bounded(client.response); await h.idle();
  assert.equal(response.status, 413); assert.equal(response.headers.connection, 'close');
  assert.deepEqual(JSON.parse(response.text), { error: 'shared_room_body_too_large' });
  assert.equal(h.seen.length, 0);
});

test('HTTP service failures expose only a safe response and the bridge waits for pending service/response work', async t => {
  const error = await fixture(t, { onCommand: async () => { throw Error('SELECT private_password FROM database'); } });
  const response = await error.send();
  assert.equal(response.status, 503); assert.deepEqual(JSON.parse(response.text), { error: 'shared_room_command_unavailable' });
  const entered = deferred(), release = deferred();
  t.after(() => release.resolve());
  const h = await fixture(t, { onCommand: async () => { entered.resolve(); await release.promise; return output(); } });
  const pending = h.send(); await bounded(entered.promise);
  assert.equal(h.records.length, 0); assert.equal(h.pending.size, 1);
  release.resolve(); assert.equal((await pending).status, 200);
});

test('dropped HTTP client during service work aborts the same signal, cleans listeners and never sends late success', async t => {
  const entered = deferred(), aborted = deferred(), release = deferred();
  t.after(() => release.resolve());
  const h = await fixture(t, { onCommand: async (_request, { signal }) => {
    signal.addEventListener('abort', () => aborted.resolve(), { once: true });
    entered.resolve(); await release.promise; return output();
  } });
  const client = h.start(); const disconnected = client.response.catch(error => error.code);
  client.req.end(JSON.stringify(input)); await bounded(entered.promise); client.req.destroy();
  await bounded(aborted.promise); await h.idle();
  assert.equal(await bounded(disconnected), 'ECONNRESET'); assert.equal(h.seen[0].signal.aborted, true);
  assert.equal(h.records.length, 1); assert.equal(h.records[0].res.destroyed, true);
  release.resolve(); await turn(); assert.equal(h.seen.length, 1);
});

test('dropped HTTP client during a partial request body aborts reading before service admission', async t => {
  const h = await fixture(t), client = h.start({ headers: { 'transfer-encoding': 'chunked' } });
  const disconnected = client.response.catch(error => error.code);
  client.req.write('{"op":'); await bounded(h.arrived.promise); client.req.destroy();
  assert.equal(await bounded(disconnected), 'ECONNRESET'); await h.idle();
  assert.equal(h.seen.length, 0);
  assert.equal(h.records.length, 1); assert.equal(h.records[0].req.aborted, true);
});

test.after(() => {
  assert.ok(resources.every(resource => resource.closed));
  console.info('Owned loopback resources closed:', JSON.stringify(resources));
});
