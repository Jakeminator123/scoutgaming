import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {AsyncLocalStorage} from 'node:async_hooks';
import {once, EventEmitter} from 'node:events';
import {mkdtemp, copyFile, symlink, unlink, rm, realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname, basename} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import WebSocket from 'ws';
import {experimental_upgradeWebSocket} from '@vercel/functions';
import {platformConfiguration} from '../lib/platform-routing.mjs';
import {platformSocketRequest, bridgePlatformSocket, handlePlatformWebSocket, platformSocketDiagnostics} from '../lib/platform-websocket.mjs';
import {issueTicket, ticketAuthenticator} from '../../../services/astrid-gpu-worker/gateway/auth.mjs';
import {vercelIngressRequest} from '../../../ops/cloud/vercel-ingress.mjs';

const env = {CROUPIER_VERCEL_UI: '1', CROUPIER_PUBLIC_ORIGIN: 'https://public.example.test',
  CROUPIER_BACKEND_ORIGIN: 'https://isolated.onrender.com', CROUPIER_LAB_UI_ORIGIN: 'https://lab.example.test',
  CROUPIER_VERCEL_INGRESS_SECRET: 'isolated-private-ingress-'.repeat(3)};
const configuration = platformConfiguration(env);
const ticketSecret = 'isolated-ticket-secret-'.repeat(3), workerSecret = 'isolated-worker-secret-'.repeat(3);
const ticket = () => issueTicket(ticketSecret, {userId: 'owner', sessionId: 'session'});
function request(path = '/speech-stream', headers = {}) {
  return new Request(configuration.publicOrigin + path, {headers: {upgrade: 'websocket', origin: configuration.publicOrigin,
    cookie: 'player_session=owner', 'sec-websocket-protocol': `astrid-v2, ticket.${ticket()}`, ...headers}});
}

test('socket boundary forwards only exact credentials and independently generated handshake protocols', () => {
  const input = platformSocketRequest(request('/speech-stream', {
    host: 'spoofed.test', connection: 'spoofed', 'sec-websocket-key': 'spoofed', 'sec-websocket-version': 'spoofed',
    'x-croupier-vercel-secret': 'spoofed', 'x-forwarded-for': 'spoofed', authorization: 'Bearer spoofed',
  }), configuration);
  assert.equal(input.url, 'wss://isolated.onrender.com/speech-stream');
  assert.deepEqual(Object.keys(input.headers).sort(), ['cookie', 'origin', 'x-croupier-public-origin', 'x-croupier-vercel-secret', 'x-forwarded-host', 'x-forwarded-proto']);
  assert.equal(input.headers['x-croupier-vercel-secret'], configuration.secret);
  assert.equal(input.protocols[0], 'astrid-v2');
  assert.equal(platformSocketRequest(request('/speech-stream', {origin: 'https://foreign.test'}), configuration).status, 403);
  assert.equal(platformSocketRequest(request('/speech-stream?ticket=secret'), configuration).status, 400);
  assert.equal(platformSocketRequest(request('/speech-stream', {'sec-websocket-protocol': `ticket.${ticket()}, astrid-v2`}), configuration).status, 401);
  assert.equal(platformSocketRequest(request('/speech-stream', {upgrade: ''}), configuration).status, 426);
  const worker = new Request(configuration.publicOrigin + '/lipsync-worker', {headers: {upgrade: 'websocket',
    authorization: `Bearer ${workerSecret}`, 'x-worker-id': 'worker1', cookie: 'bo_jwt=irrelevant'}});
  const workerInput = platformSocketRequest(worker, configuration);
  assert.deepEqual(Object.keys(workerInput.headers).sort(), ['authorization', 'x-croupier-public-origin', 'x-croupier-vercel-secret', 'x-forwarded-host', 'x-forwarded-proto', 'x-worker-id']);
  assert.deepEqual(workerInput.protocols, []);
  const ingressConfiguration = {transportOrigin: configuration.backendOrigin, publicOrigin: configuration.publicOrigin, secret: configuration.secret};
  for (const candidate of [input, workerInput]) {
    const actualIngress = vercelIngressRequest({method: 'GET', url: new URL(candidate.url).pathname,
      headers: {host: new URL(configuration.backendOrigin).host, ...candidate.headers}}, ingressConfiguration);
    assert.equal(actualIngress.accepted, true);
    assert.equal(actualIngress.transported, true);
    assert.equal(actualIngress.headers.host, new URL(configuration.publicOrigin).host);
    assert.equal(actualIngress.headers['x-croupier-vercel-secret'], undefined);
    assert.equal(vercelIngressRequest({method: 'GET', url: new URL(candidate.url).pathname,
      headers: {host: new URL(configuration.backendOrigin).host, ...candidate.headers, 'x-forwarded-host': 'spoofed.test'}}, ingressConfiguration).accepted, false);
  }
  assert.equal(platformSocketRequest(new Request(configuration.publicOrigin + '/lipsync-worker', {headers: {upgrade: 'websocket'}}), configuration).status, 403);
});

async function connect(url, protocols, options = {}) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, protocols, {...options, handshakeTimeout: 3000});
    socket.once('open', () => resolve(socket)); socket.once('error', reject);
  });
}
async function rejected(url, protocols, options = {}) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, protocols, {...options, handshakeTimeout: 3000});
    socket.once('open', () => {socket.terminate(); reject(Error('Unexpected upgrade'));});
    socket.on('error', () => {});
    socket.once('unexpected-response', (_request, reply) => {reply.resume(); resolve(reply.statusCode); socket.terminate();});
  });
}

test('actual SDK and Next after retain real relay bytes after response204 without SDK waitUntil and preserve owner/replay checks', {timeout: 15000}, async () => {
  // Vercel installs only this app's dependencies. Keep the actual relay bytes
  // unchanged while resolving ws through the app's installed node_modules.
  const temporaryRoot = await realpath(tmpdir());
  const fixtureDirectory = await mkdtemp(join(temporaryRoot, 'croupier-relay-runtime-'));
  let linkedDependencies = false, relay;
  const backend = createServer(), frontend = createServer();
  const authenticate = ticketAuthenticator(ticketSecret);
  const context = new AsyncLocalStorage(), contextSymbol = Symbol.for('@vercel/request-context');
  const oldContext = globalThis[contextSymbol];
  const previousAsyncLocalStorage = globalThis.AsyncLocalStorage;
  globalThis.AsyncLocalStorage = AsyncLocalStorage;
  const requireNext = createRequire(import.meta.url);
  const {after} = requireNext('next/server');
  const {AfterContext} = requireNext('next/dist/server/after/after-context.js');
  const {workAsyncStorage} = requireNext('next/dist/server/app-render/work-async-storage.external.js');
  globalThis[contextSymbol] = {get: () => context.getStore()};
  const lifetimes = [], replies = new EventEmitter(), returned = new Map(), workerRequestAbort = new AbortController();
  function returnedReply(path) {
    if (returned.has(path)) return Promise.resolve(returned.get(path));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {replies.off(path, ready); reject(Error('Upgrade setup waited for socket closure'));}, 1000);
      const ready = value => {clearTimeout(timer); resolve(value);};
      replies.once(path, ready);
    });
  }
  const backendRequests = [];
  let worker, client;
  try {
    await copyFile(new URL('../../../services/astrid-gpu-worker/gateway/relay.mjs', import.meta.url), join(fixtureDirectory, 'relay.mjs'));
    await copyFile(new URL('../../../services/astrid-gpu-worker/gateway/auth.mjs', import.meta.url), join(fixtureDirectory, 'auth.mjs'));
    await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(fixtureDirectory, 'node_modules'), 'junction');
    linkedDependencies = true;
    const {attachSpeechRelay} = await import(pathToFileURL(join(fixtureDirectory, 'relay.mjs')).href);
    relay = attachSpeechRelay(backend, {workerSecret, allowedOrigins: [configuration.publicOrigin],
      authenticateClient: req => req.headers.cookie === 'player_session=owner' ? authenticate(req) : null,
      allowClientPCM: true});
    backend.listen(0, '127.0.0.1'); await once(backend, 'listening');
    class BackendSocket extends WebSocket {
      constructor(url, protocols, options) {
        assert.ok(url.startsWith('wss://isolated.onrender.com/'));
        backendRequests.push({path: new URL(url).pathname, headers: options.headers});
        super(`ws://127.0.0.1:${backend.address().port}${new URL(url).pathname}`, protocols, options);
      }
    }
    frontend.on('upgrade', (req, socket, head) => {
      let responseFinished;
      const afterContext = new AfterContext({onClose: callback => {responseFinished = callback;}, waitUntil: promise => {
        const lifetime = {promise, settled: false}; lifetimes.push(lifetime);
        promise.then(() => {lifetime.settled = true;});
      }});
      context.run({upgradeWebSocket: () => ({req, socket, head})}, () => workAsyncStorage.run({afterContext}, async () => {
        const reply = await handlePlatformWebSocket(new Request(configuration.publicOrigin + req.url,
          {headers: req.headers, ...(req.url === '/lipsync-worker' ? {signal: workerRequestAbort.signal} : {})}),
          {env, WebSocketImpl: BackendSocket, retain: promise => after(() => promise), bridgeOptions: {closeTimeoutMs: 30}});
        const result = {status: reply.status, pendingLifetimes: lifetimes.filter(value => !value.settled).length};
        returned.set(req.url, result); replies.emit(req.url, result);
        responseFinished?.();
        if (reply.status !== 204 && !socket.destroyed) socket.end(`HTTP/1.1 ${reply.status} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
      }));
    });
    frontend.listen(0, '127.0.0.1'); await once(frontend, 'listening');
    const base = `ws://127.0.0.1:${frontend.address().port}`;
    worker = await connect(base + '/lipsync-worker', [], {headers: {authorization: `Bearer ${workerSecret}`, 'x-worker-id': 'fixture-worker'}});
    assert.deepEqual(await returnedReply('/lipsync-worker'), {status: 204, pendingLifetimes: 1});
    assert.equal(lifetimes[0].settled, false);
    worker.on('message', (data, binary) => {
      if (binary) {worker.send(Buffer.from('exact-fixture-bytes')); return;}
      const message = JSON.parse(data.toString());
      if (message.t === 'start') worker.send(JSON.stringify({t: 'stream', id: message.id, mime: 'video/mp4'}));
      if (message.t === 'end') worker.send(JSON.stringify({t: 'done', id: message.id}));
    });
    const ownerTicket = ticket(), protocols = ['astrid-v2', `ticket.${ownerTicket}`];
    const headers = {origin: configuration.publicOrigin, cookie: 'player_session=owner'};
    // Foreign cookie does not consume a valid owner's ticket.
    assert.equal(await rejected(base + '/speech-stream', protocols, {headers: {...headers, cookie: 'player_session=foreign'}}), 401);
    assert.equal(await rejected(base + '/speech-stream', protocols, {headers: {...headers, origin: 'https://foreign.test'}}), 403);
    const messages = [], binaryFrames = [];
    client = new WebSocket(base + '/speech-stream', protocols, {headers});
    const closed = new Promise((resolve, reject) => {
      client.on('error', reject);
      client.on('message', (data, binary) => {
        if (binary) {binaryFrames.push(Buffer.from(data)); return;}
        const message = JSON.parse(data.toString()); messages.push(message.t);
        if (message.t === 'ready') {client.send(JSON.stringify({t: 'start', protocol: 2, rate: 24000})); client.send(Buffer.from('pcm!')); client.send(JSON.stringify({t: 'end'}));}
      });
      client.once('close', code => resolve(code));
    });
    assert.equal(await closed, 1000);
    assert.equal((await returnedReply('/speech-stream')).status, 204);
    await lifetimes[1].promise;
    assert.equal(lifetimes[0].settled, false);
    assert.equal(client.protocol, 'astrid-v2');
    assert.deepEqual(messages, ['ready', 'stream', 'done']);
    assert.deepEqual(binaryFrames, [Buffer.from('exact-fixture-bytes')]);
    assert.equal(await rejected(base + '/speech-stream', protocols, {headers}), 401);
    assert.ok(backendRequests.length >= 4);
    assert.ok(backendRequests.every(value => value.headers['x-croupier-vercel-secret'] === configuration.secret));
    // Request cancellation remains active after setup has already returned204.
    const workerClosed = once(worker, 'close'); workerRequestAbort.abort();
    assert.equal((await workerClosed)[0], 1011);
    await lifetimes[0].promise;
    assert.equal(lifetimes[0].settled, true);
  } finally {
    worker?.terminate(); client?.terminate(); relay?.close();
    await Promise.all([new Promise(resolve => backend.close(resolve)), new Promise(resolve => frontend.close(resolve))]);
    if (oldContext === undefined) delete globalThis[contextSymbol]; else globalThis[contextSymbol] = oldContext;
    if (previousAsyncLocalStorage === undefined) delete globalThis.AsyncLocalStorage; else globalThis.AsyncLocalStorage = previousAsyncLocalStorage;
    if (dirname(fixtureDirectory) !== temporaryRoot || !basename(fixtureDirectory).startsWith('croupier-relay-runtime-')) throw Error('Unexpected fixture cleanup path');
    // Remove the directory link before deleting our own temporary sources.
    if (linkedDependencies) await unlink(join(fixtureDirectory, 'node_modules'));
    await rm(fixtureDirectory, {recursive: true, force: true});
  }
});

class FakeSocket extends EventEmitter {
  readyState = WebSocket.OPEN; bufferedAmount = 0; sent = []; codes = [];
  send(data, options, callback) {this.sent.push({data, binary: options.binary}); callback?.();}
  close(code) {this.codes.push(code); this.readyState = WebSocket.CLOSED; this.emit('close', code);}
  terminate() {this.close(1006);}
}

test('QA socket counters reveal phase and waitUntil presence without payloads, and remain silent for production origins', async () => {
  const rows = [], symbol = Symbol.for('@vercel/request-context'), previous = globalThis[symbol];
  const qa = {...configuration, publicOrigin: 'https://croupier-player-preview-qa.vercel.app', backendOrigin: 'https://croupier-vercel-preview-qa.onrender.com'};
  try {
    globalThis[symbol] = {get: () => ({waitUntil() {}})};
    const trace = platformSocketDiagnostics(qa, {NODE_ENV: 'production'}, '/lipsync-worker', {emit: value => rows.push(value)});
    const upstream = new FakeSocket(), frontend = new FakeSocket();
    const bridge = bridgePlatformSocket(upstream, {trace, closeTimeoutMs: 5});
    upstream.emit('message', Buffer.from('{"t":"start","id":"private-id"}'), false);
    bridge.attach(frontend);
    frontend.emit('message', Buffer.from('private-media-payload'), true);
    upstream.close(1000); await bridge.done;
    const parsed = rows.map(value => JSON.parse(value.slice('CROUPIER_UNPAID_SOCKET '.length)));
    assert.equal(parsed.find(value => value.phase === 'attached').contextWaitUntil, true);
    assert.equal(parsed.find(value => value.phase === 'done').counters.frontend_receive, 1);
    assert.equal(parsed.find(value => value.phase === 'done').counters.upstream_send, 1);
    assert.equal(parsed.find(value => value.phase === 'frontend_send_callback').writeError, false);
    assert.doesNotMatch(rows.join(''), /private-id|private-media|cookie|ticket/);
    const before = rows.length;
    for (const [candidate, runtime] of [[configuration, {NODE_ENV: 'production'}], [qa, {}]]) {
      platformSocketDiagnostics(candidate, runtime, '/speech-stream', {emit: value => rows.push(value)})('attached');
    }
    assert.equal(rows.length, before);
    trace('unknown-private-phase', {text: 'private-text'});
    for (let index = 0; index < 300; index++) trace('upstream_receive', {bytes: 1, binary: true, payload: 'private-extra'});
    assert.equal(rows.length - before, 7);
    assert.doesNotMatch(rows.join(''), /private-/);
  } finally {
    if (previous === undefined) delete globalThis[symbol]; else globalThis[symbol] = previous;
  }
});

test('actual SDK pre-corked socket reports pending writes until its owner uncorks and exact frames arrive', {timeout: 5000}, async () => {
  const qaEnv = {...env, NODE_ENV: 'production', CROUPIER_PUBLIC_ORIGIN: 'https://croupier-player-preview-qa.vercel.app',
    CROUPIER_BACKEND_ORIGIN: 'https://croupier-vercel-preview-qa.onrender.com'};
  const context = new AsyncLocalStorage(), contextSymbol = Symbol.for('@vercel/request-context'), previous = globalThis[contextSymbol];
  globalThis[contextSymbol] = {get: () => context.getStore()};
  const server = createServer(), events = new EventEmitter(), rows = [], lifetimes = [];
  let upstream, sdkSocket, client, frames = [];
  class OpenUpstream extends FakeSocket {
    constructor() {super(); upstream = this; queueMicrotask(() => this.emit('open'));}
  }
  const diagnosticEmit = line => {
    const row = JSON.parse(line.slice('CROUPIER_UNPAID_SOCKET '.length)); rows.push(row); events.emit('row', row);
  };
  async function waitFor(predicate) {
    const prior = rows.find(predicate); if (prior) return prior;
    return new Promise(resolve => {
      const listener = row => {if (predicate(row)) {events.off('row', listener); resolve(row);}};
      events.on('row', listener);
    });
  }
  try {
    server.on('upgrade', (req, socket, head) => context.run({upgradeWebSocket: () => ({req, socket, head})}, async () => {
      const reply = await handlePlatformWebSocket(new Request(qaEnv.CROUPIER_PUBLIC_ORIGIN + req.url, {headers: req.headers}),
        {env: qaEnv, WebSocketImpl: OpenUpstream, diagnosticEmit, bridgeOptions: {writeObservationMs: 25, closeTimeoutMs: 25},
          upgrade: (handler, options) => experimental_upgradeWebSocket(ws => {sdkSocket = ws; return handler(ws);}, options),
          retain: promise => lifetimes.push(promise)});
      assert.equal(reply.status, 204);
    }));
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    client = await connect(`ws://127.0.0.1:${server.address().port}/lipsync-worker`, [],
      {headers: {authorization: `Bearer ${workerSecret}`, 'x-worker-id': 'fixture-worker'}});
    client.on('message', (data, binary) => {frames.push({data: Buffer.from(data), binary}); events.emit('frame');});
    await waitFor(row => row.phase === 'returned');
    const receivedReady = once(events, 'frame'); upstream.emit('message', Buffer.from('ready'), false); await receivedReady;
    assert.equal(sdkSocket._socket.writableCorked, 0);
    // The test owns this cork. The bridge must observe it without releasing it.
    sdkSocket._socket.cork();
    upstream.emit('message', Buffer.from('later'), false);
    upstream.emit('message', Buffer.from([1, 2, 3, 4]), true);
    const pending = await waitFor(row => row.phase === 'frontend_send_pending' && row.sequence === 3);
    assert.equal(pending.writableCorked, 1);
    assert.ok(pending.bufferedAmount > 0); assert.ok(pending.writableLength > 0);
    assert.equal(pending.destroyed, false); assert.equal(pending.writable, true); assert.equal(pending.writableEnded, false);
    assert.deepEqual(frames.map(frame => frame.data.toString()), ['ready']);
    assert.equal(rows.filter(row => row.phase === 'frontend_send_callback').length, 1);
    const before = rows.find(row => row.phase === 'frontend_send_before' && row.sequence === 2);
    const queued = rows.find(row => row.phase === 'frontend_send' && row.sequence === 2);
    assert.equal(before.writableCorked, 1); assert.equal(before.bufferedAmount, 0);
    assert.ok(queued.bufferedAmount > before.bufferedAmount);
    sdkSocket._socket.uncork();
    await waitFor(row => row.phase === 'frontend_send_callback' && row.sequence === 3);
    while (frames.length < 3) await once(events, 'frame');
    assert.deepEqual(frames, [{data: Buffer.from('ready'), binary: false}, {data: Buffer.from('later'), binary: false}, {data: Buffer.from([1, 2, 3, 4]), binary: true}]);
    assert.ok(rows.filter(row => row.phase === 'frontend_send_callback').every(row => row.writeError === false && row.writableCorked === 0));
    const closed = once(client, 'close'); upstream.close(1000); assert.equal((await closed)[0], 1000);
    await Promise.all(lifetimes);
  } finally {
    sdkSocket?.terminate(); client?.terminate(); upstream?.terminate();
    await new Promise(resolve => server.close(resolve));
    if (previous === undefined) delete globalThis[contextSymbol]; else globalThis[contextSymbol] = previous;
  }
});

test('QA write errors expose only allowlisted codes and keep failure closure intact', async () => {
  const qa = {...configuration, publicOrigin: 'https://croupier-player-preview-qa.vercel.app', backendOrigin: 'https://croupier-vercel-preview-qa.onrender.com'};
  for (const [code, expected] of [['EPIPE', 'EPIPE'], ['private-ticket-error', 'OTHER']]) {
    const rows = [], trace = platformSocketDiagnostics(qa, {NODE_ENV: 'production'}, '/speech-stream', {emit: value => rows.push(value)});
    const upstream = new FakeSocket(), frontend = new FakeSocket();
    frontend.send = (_data, _options, callback) => callback(Object.assign(Error('private-payload'), {code}));
    const bridge = bridgePlatformSocket(upstream, {trace, closeTimeoutMs: 5}); bridge.attach(frontend);
    upstream.emit('message', Buffer.from('private-input'), false); await bridge.done;
    const callback = rows.map(value => JSON.parse(value.slice('CROUPIER_UNPAID_SOCKET '.length))).find(value => value.phase === 'frontend_send_callback');
    assert.equal(callback.writeError, true); assert.equal(callback.writeErrorCode, expected);
    assert.equal(frontend.codes[0], 1011); assert.equal(upstream.codes[0], 1011);
    assert.doesNotMatch(rows.join(''), /private-payload|private-input|private-ticket-error/);
  }
});

test('early ready is retained once, close drains it, and bounded queue/backpressure closes both sides', async () => {
  const upstream = new FakeSocket(), frontend = new FakeSocket();
  const bridge = bridgePlatformSocket(upstream, {maxBufferedBytes: 10, closeTimeoutMs: 5});
  upstream.emit('message', Buffer.from('ready'), false); upstream.close(1000);
  await bridge.attach(frontend);
  assert.deepEqual(frontend.sent.map(value => value.data.toString()), ['ready']);
  assert.deepEqual(frontend.codes, [1000]);
  const overflow = new FakeSocket(), overflowBridge = bridgePlatformSocket(overflow, {maxBufferedBytes: 3, closeTimeoutMs: 5});
  overflow.emit('message', Buffer.from('oversized'), true);
  await overflowBridge.done; assert.equal(overflow.codes[0], 1013);
  const slowUpstream = new FakeSocket(), slowFrontend = new FakeSocket();
  const slow = bridgePlatformSocket(slowUpstream, {maxBufferedBytes: 3, closeTimeoutMs: 5});
  slow.attach(slowFrontend); slowFrontend.bufferedAmount = 3;
  slowUpstream.emit('message', Buffer.from('x'), true);
  await slow.done; assert.equal(slowFrontend.codes[0], 1013); assert.equal(slowUpstream.codes[0], 1013);
});

test('flag-off, invalid config and upstream failure cannot accept or retry a socket', async () => {
  let attempts = 0, upgrades = 0;
  class DeniedSocket extends FakeSocket {
    constructor() {super(); attempts++; queueMicrotask(() => this.emit('unexpected-response', null, {statusCode: 401, resume() {}}));}
  }
  const options = {WebSocketImpl: DeniedSocket, upgrade() {upgrades++; throw Error('must not upgrade');}};
  assert.equal((await handlePlatformWebSocket(request(), {...options, env: {}})).status, 404);
  assert.equal((await handlePlatformWebSocket(request(), {...options, env: {...env, CROUPIER_VERCEL_INGRESS_SECRET: ''}})).status, 503);
  assert.equal(attempts, 0);
  assert.equal((await handlePlatformWebSocket(request(), {...options, env})).status, 401);
  assert.equal(attempts, 1); assert.equal(upgrades, 0);
});
