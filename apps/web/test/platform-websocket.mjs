import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once, EventEmitter} from 'node:events';
import WebSocket, {WebSocketServer} from 'ws';
import {platformConfiguration} from '../../../packages/navigation/server/platform-routing.mjs';
import {platformSocketRequest, bridgePlatformSocket, platformSocketDiagnostics} from '@croupier/server-transport/socket-core';
import {createPlatformNativeWebSocketServer} from '@croupier/server-transport/node-server';
import {issueTicket} from '../../../services/astrid-gpu-worker/gateway/auth.mjs';
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

test('registered worker binding crosses only the worker route, complete and well formed',()=>{
  const binding={'x-dealer-id':'paow','x-speech-profile-revision':'a'.repeat(64),'x-speech-image-sha256':'b'.repeat(64),'x-speech-protocol':'3'};
  const worker=extra=>new Request(configuration.publicOrigin+'/lipsync-worker',{headers:{upgrade:'websocket',authorization:`Bearer ${workerSecret}`,'x-worker-id':'own-worker',...extra}});
  const result=platformSocketRequest(worker(binding),configuration);
  for(const [key,value] of Object.entries(binding))assert.equal(result.headers[key],value);
  for(const key of Object.keys(binding)){
    const missing={...binding};delete missing[key];assert.equal(platformSocketRequest(worker(missing),configuration).status,403);
    assert.equal(platformSocketRequest(worker({...binding,[key]:'INVALID!'}),configuration).status,403);
    assert.equal(platformSocketRequest(request('/speech-stream',binding),configuration).headers[key],undefined);
  }
});
async function rejected(url, protocols, options = {}) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, protocols, {...options, handshakeTimeout: 3000});
    socket.once('open', () => {socket.terminate(); reject(Error('Unexpected upgrade'));});
    socket.on('error', () => {});
    socket.once('unexpected-response', (_request, reply) => {reply.resume(); resolve(reply.statusCode); socket.terminate();});
  });
}

class FakeSocket extends EventEmitter {
  readyState = WebSocket.OPEN; bufferedAmount = 0; sent = []; codes = [];
  send(data, options, callback) {this.sent.push({data, binary: options.binary}); callback?.();}
  close(code) {this.codes.push(code); this.readyState = WebSocket.CLOSED; this.emit('close', code);}
  terminate() {this.close(1006);}
}

test('socket diagnostics stay silent for product origins and never observe bridge writes', () => {
  const rows = [];
  for (const runtime of [{NODE_ENV: 'production'}, {}]) {
    for (const path of ['/speech-stream', '/lipsync-worker']) {
      const trace = platformSocketDiagnostics(configuration, runtime, path, {emit: value => rows.push(value)});
      assert.notEqual(trace.enabled, true, path);
      trace('attached'); trace('upstream_receive', {bytes: 1, binary: true}); trace('done');
    }
  }
  assert.deepEqual(rows, []);
});

test('bridge keeps a native socket cork it does not own and delivers exact frames after the owner uncorks', {timeout: 5000}, async () => {
  const server = createServer(), websocketServer = new WebSocketServer({noServer: true, perMessageDeflate: false});
  const events = new EventEmitter(), frames = [];
  const attached = once(events, 'attached');
  let bridge, upstream, frontendSocket, client;
  try {
    upstream = new FakeSocket();
    server.on('upgrade', (req, socket, head) => websocketServer.handleUpgrade(req, socket, head, ws => {
      frontendSocket = ws;
      bridge = bridgePlatformSocket(upstream, {closeTimeoutMs: 25});
      bridge.attach(ws); events.emit('attached');
    }));
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    client = await connect(`ws://127.0.0.1:${server.address().port}/lipsync-worker`, [],
      {headers: {authorization: `Bearer ${workerSecret}`, 'x-worker-id': 'fixture-worker'}});
    client.on('message', (data, binary) => {frames.push({data: Buffer.from(data), binary}); events.emit('frame');});
    await attached;
    const receivedReady = once(events, 'frame'); upstream.emit('message', Buffer.from('ready'), false); await receivedReady;
    assert.equal(frontendSocket._socket.writableCorked, 0);
    // The test owns this cork. The bridge must queue behind it without releasing it.
    frontendSocket._socket.cork();
    upstream.emit('message', Buffer.from('later'), false);
    upstream.emit('message', Buffer.from([1, 2, 3, 4]), true);
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(frontendSocket._socket.writableCorked, 1);
    assert.ok(frontendSocket.bufferedAmount > 0);
    assert.deepEqual(frames.map(frame => frame.data.toString()), ['ready']);
    frontendSocket._socket.uncork();
    while (frames.length < 3) await once(events, 'frame');
    assert.deepEqual(frames, [{data: Buffer.from('ready'), binary: false}, {data: Buffer.from('later'), binary: false}, {data: Buffer.from([1, 2, 3, 4]), binary: true}]);
    const closed = once(client, 'close'); upstream.close(1000); assert.equal((await closed)[0], 1000);
    await bridge.done;
  } finally {
    frontendSocket?.terminate(); client?.terminate(); upstream?.terminate();
    websocketServer.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('frontend write errors close both sides with 1011 without retrying', async () => {
  for (const code of ['EPIPE', 'private-ticket-error']) {
    const upstream = new FakeSocket(), frontend = new FakeSocket();
    frontend.send = (_data, _options, callback) => callback(Object.assign(Error('private-payload'), {code}));
    const bridge = bridgePlatformSocket(upstream, {closeTimeoutMs: 5}); bridge.attach(frontend);
    upstream.emit('message', Buffer.from('private-input'), false); await bridge.done;
    assert.deepEqual(frontend.codes, [1011]); assert.deepEqual(upstream.codes, [1011]);
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
  let attempts = 0;
  class DeniedSocket extends FakeSocket {
    constructor() {super(); attempts++; queueMicrotask(() => this.emit('unexpected-response', null, {statusCode: 401, resume() {}}));}
  }
  for (const [runtime, status] of [[{}, 404], [{...env, CROUPIER_VERCEL_INGRESS_SECRET: ''}, 503], [env, 401]]) {
    const server = createPlatformNativeWebSocketServer('/speech-stream', {env: runtime, WebSocketImpl: DeniedSocket});
    try {
      server.listen(0, '127.0.0.1'); await once(server, 'listening');
      assert.equal(await rejected(`ws://127.0.0.1:${server.address().port}/speech-stream`,
        ['astrid-v2', `ticket.${ticket()}`], {headers: {origin: configuration.publicOrigin, cookie: 'player_session=owner'}}), status);
      assert.equal(attempts, status === 401 ? 1 : 0);
    } finally {await new Promise(resolve => server.close(resolve));}
  }
});
