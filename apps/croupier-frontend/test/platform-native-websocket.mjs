import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp, copyFile, symlink, unlink, rm, realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname, basename} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import WebSocket from 'ws';
import {createPlatformNativeWebSocketServer} from '../lib/platform-native-websocket.mjs';
import {platformConfiguration} from '../lib/platform-routing.mjs';
import {issueTicket, ticketAuthenticator} from '../../../services/astrid-gpu-worker/gateway/auth.mjs';
import {vercelIngressRequest} from '../../../ops/cloud/vercel-ingress.mjs';

const env = {CROUPIER_VERCEL_UI: '1', CROUPIER_PUBLIC_ORIGIN: 'https://public.example.test',
  CROUPIER_BACKEND_ORIGIN: 'https://isolated.onrender.com', CROUPIER_LAB_UI_ORIGIN: 'https://lab.example.test',
  CROUPIER_VERCEL_INGRESS_SECRET: 'isolated-private-ingress-'.repeat(3)};
const configuration = platformConfiguration(env);
const ticketSecret = 'isolated-ticket-secret-'.repeat(3), workerSecret = 'isolated-worker-secret-'.repeat(3);
const ticket = () => issueTicket(ticketSecret, {userId: 'owner', sessionId: 'session'});
const ownerHeaders = {origin: configuration.publicOrigin, cookie: 'player_session=owner'};
const workerHeaders = {authorization: `Bearer ${workerSecret}`, 'x-worker-id': 'native-fixture-worker'};
const closeServer = server => new Promise(resolve => server.close(resolve));
async function listen(server) {server.listen(0, '127.0.0.1'); await once(server, 'listening'); return `ws://127.0.0.1:${server.address().port}`;}
async function rejected(url, protocols = [], headers = {}) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, protocols, {headers, handshakeTimeout: 3000});
    socket.on('error', () => {});
    socket.once('open', () => {socket.terminate(); reject(Error('Unexpected upgrade'));});
    socket.once('unexpected-response', (_request, response) => {response.resume(); resolve(response.statusCode); socket.terminate();});
  });
}

test('native API exports do not listen during imports and flag-off stays closed', async () => {
  const client = (await import('../api/platform-speech-stream.mjs')).default;
  const worker = (await import('../api/platform-lipsync-worker.mjs')).default;
  assert.equal(client.listening, false); assert.equal(worker.listening, false);
  const disabled = createPlatformNativeWebSocketServer('/speech-stream', {env: {}});
  try {
    const base = await listen(disabled);
    assert.equal((await fetch(base.replace('ws:', 'http:') + '/speech-stream')).status, 404);
    assert.equal(await rejected(base + '/speech-stream'), 404);
  } finally {await closeServer(disabled);}
});

test('native fixed functions reject other paths, query tricks and invalid local credentials before backend', async () => {
  let backendCalls = 0;
  class ForbiddenBackend {constructor() {backendCalls++; throw Error('Unexpected backend call');}}
  const client = createPlatformNativeWebSocketServer('/speech-stream', {env, WebSocketImpl: ForbiddenBackend});
  const worker = createPlatformNativeWebSocketServer('/lipsync-worker', {env, WebSocketImpl: ForbiddenBackend});
  try {
    const base = await listen(client), workerBase = await listen(worker);
    for (const path of ['/lipsync-worker', '/api/platform-lipsync-worker', '/other', '/speech-stream?ticket=secret',
      '/api/platform-speech-stream?x=1', '/%73peech-stream', '/speech-stream/']) assert.equal(await rejected(base + path), 400);
    assert.equal(await rejected(base + '/speech-stream', ['astrid-v2', `ticket.${ticket()}`], {...ownerHeaders, origin: 'https://foreign.test'}), 403);
    assert.equal(await rejected(base + '/api/platform-speech-stream'), 403);
    assert.equal(await rejected(workerBase + '/api/platform-lipsync-worker'), 403);
    assert.equal((await fetch(base.replace('ws:', 'http:') + '/api/platform-speech-stream')).status, 426);
    assert.equal(backendCalls, 0);
  } finally {await Promise.all([closeServer(client), closeServer(worker)]);}
});

test('disconnect during authentication cannot produce public101 and cleans up within the handshake bound', {timeout: 5000}, async () => {
  const backend = createServer(), pending = new Set();
  let frontend, client;
  try {
    const backendBase = await listen(backend);
    const authenticated = new Promise(resolve => backend.once('upgrade', (_request, socket) => {
      pending.add(socket); socket.once('close', () => pending.delete(socket));
      socket.once('end', () => socket.destroy()); socket.resume(); resolve(socket);
      // No backend101: authentication has not completed yet.
    }));
    class PendingBackend extends WebSocket {
      constructor(url, protocols, options) {super(backendBase + new URL(url).pathname, protocols, options);}
    }
    frontend = createPlatformNativeWebSocketServer('/speech-stream', {env, WebSocketImpl: PendingBackend,
      handshakeMs: 1000, bridgeOptions: {closeTimeoutMs: 30}});
    const frontendBase = await listen(frontend);
    client = new WebSocket(frontendBase + '/speech-stream', ['astrid-v2', `ticket.${ticket()}`], {headers: ownerHeaders});
    client.on('error', () => {});
    let upgraded = false; client.on('open', () => {upgraded = true;});
    const backendSocket = await authenticated, upstreamClosed = once(backendSocket, 'close'), clientClosed = new Promise(resolve => client.once('close', resolve));
    client.terminate(); await clientClosed; await upstreamClosed;
    assert.equal(upgraded, false); assert.equal(pending.size, 0);
  } finally {
    client?.terminate(); for (const socket of pending) socket.destroy();
    await Promise.all([closeServer(backend), ...(frontend ? [closeServer(frontend)] : [])]);
  }
});

test('native handlers carry actual relay media both ways with current owner, ingress, worker and one-use ticket checks', {timeout: 15000}, async () => {
  const temporaryRoot = await realpath(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, 'croupier-native-relay-'));
  const backend = createServer();
  let linked = false, relay, clientServer, workerServer, worker, client, currentOwnerActive = true;
  const authenticate = ticketAuthenticator(ticketSecret), backendRequests = [], workerReceived = [];
  try {
    // Keep the product relay's bytes unchanged, including its real auth module.
    await copyFile(new URL('../../../services/astrid-gpu-worker/gateway/relay.mjs', import.meta.url), join(directory, 'relay.mjs'));
    await copyFile(new URL('../../../services/astrid-gpu-worker/gateway/auth.mjs', import.meta.url), join(directory, 'auth.mjs'));
    await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(directory, 'node_modules'), 'junction'); linked = true;
    const {attachSpeechRelay} = await import(pathToFileURL(join(directory, 'relay.mjs')).href);
    backend.on('upgrade', request => {
      const verdict = vercelIngressRequest({...request, headers: {...request.headers, host: new URL(configuration.backendOrigin).host}},
        {transportOrigin: configuration.backendOrigin, publicOrigin: configuration.publicOrigin, secret: configuration.secret});
      assert.equal(verdict.accepted, true); assert.equal(verdict.transported, true);
      backendRequests.push({path: request.url, headers: request.headers});
      assert.equal(verdict.headers['x-croupier-vercel-secret'], undefined);
    });
    relay = attachSpeechRelay(backend, {workerSecret, allowedOrigins: [configuration.publicOrigin],
      authenticateClient: request => currentOwnerActive && request.headers.cookie === 'player_session=owner' ? authenticate(request) : null,
      allowClientPCM: true});
    const backendBase = await listen(backend);
    class ActualBackend extends WebSocket {
      constructor(url, protocols, options) {
        assert.ok(url.startsWith(configuration.backendOrigin.replace('https:', 'wss:')));
        assert.equal(options.followRedirects, false); assert.equal(options.perMessageDeflate, false);
        assert.deepEqual(Object.keys(options.headers).filter(key => /sec-websocket|^host$|connection|upgrade/.test(key)), []);
        super(backendBase + new URL(url).pathname, protocols, options);
      }
    }
    clientServer = createPlatformNativeWebSocketServer('/speech-stream', {env, WebSocketImpl: ActualBackend, bridgeOptions: {closeTimeoutMs: 30}});
    workerServer = createPlatformNativeWebSocketServer('/lipsync-worker', {env, WebSocketImpl: ActualBackend, bridgeOptions: {closeTimeoutMs: 30}});
    const clientBase = await listen(clientServer), workerBase = await listen(workerServer);
    // Invalid worker credentials are rejected by the actual Render relay before101.
    assert.equal(await rejected(workerBase + '/lipsync-worker', [], {...workerHeaders, authorization: 'Bearer invalid'}), 403);
    worker = new WebSocket(workerBase + '/api/platform-lipsync-worker', [], {headers: workerHeaders});
    await once(worker, 'open');
    worker.on('message', (data, binary) => {
      if (binary) {workerReceived.push(Buffer.from(data)); worker.send(Buffer.from('exact-native-fixture-media')); return;}
      const message = JSON.parse(data.toString()); workerReceived.push(message.t);
      if (message.t === 'start') worker.send(JSON.stringify({t: 'stream', id: message.id, mime: 'video/mp4'}));
      if (message.t === 'end') worker.send(JSON.stringify({t: 'done', id: message.id}));
    });
    for (const path of ['/speech-stream', '/api/platform-speech-stream']) {
      const protocols = ['astrid-v2', `ticket.${ticket()}`];
      assert.equal(await rejected(clientBase + path, protocols, {...ownerHeaders, cookie: 'player_session=foreign'}), 401);
      currentOwnerActive = false;
      assert.equal(await rejected(clientBase + path, protocols, ownerHeaders), 401);
      currentOwnerActive = true;
      const messages = [], binaryFrames = [];
      client = new WebSocket(clientBase + path, protocols, {headers: {...ownerHeaders, 'x-croupier-vercel-secret': 'spoofed'}});
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
      assert.equal(client.protocol, 'astrid-v2');
      assert.deepEqual(messages, ['ready', 'stream', 'done']);
      assert.deepEqual(binaryFrames, [Buffer.from('exact-native-fixture-media')]);
      assert.equal(await rejected(clientBase + path, protocols, ownerHeaders), 401);
    }
    assert.deepEqual(workerReceived, ['start', Buffer.from('pcm!'), 'end', 'start', Buffer.from('pcm!'), 'end']);
    assert.ok(backendRequests.length >= 8);
    assert.ok(backendRequests.every(value => value.headers['x-croupier-vercel-secret'] === configuration.secret));
    assert.ok(backendRequests.every(value => ['/speech-stream', '/lipsync-worker'].includes(value.path)));
    // Closing the native client cancels the relay; no listener/bridge survives.
    worker.close(1000); await once(worker, 'close');
  } finally {
    client?.terminate(); worker?.terminate(); relay?.close();
    await Promise.all([closeServer(backend), ...(clientServer ? [closeServer(clientServer)] : []), ...(workerServer ? [closeServer(workerServer)] : [])]);
    if (dirname(directory) !== temporaryRoot || !basename(directory).startsWith('croupier-native-relay-')) throw Error('Unexpected fixture cleanup path');
    if (linked) await unlink(join(directory, 'node_modules'));
    await rm(directory, {recursive: true, force: true});
  }
});
