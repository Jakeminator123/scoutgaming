import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {access, mkdtemp, copyFile, cp, mkdir, symlink, unlink, rm, realpath, readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join, dirname, basename} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const frontendRequire = createRequire(new URL('../apps/web/package.json', import.meta.url));
const WebSocket = frontendRequire('ws');
const {createPlatformNativeWebSocketServer} = await import(pathToFileURL(frontendRequire.resolve('@croupier/server-transport/node-server')).href);
import {platformConfiguration} from '../packages/navigation/server/platform-routing.mjs';
import {PLATFORM_SOCKET_ENDPOINTS, MOVING_WORKER_SOCKET, SHARED_ROOM_SOCKET} from '../packages/server-transport/paths.mjs';
import {issueTicket, ticketAuthenticator} from '../services/astrid-gpu-worker/gateway/auth.mjs';
import {vercelIngressRequest} from '../ops/cloud/vercel-ingress.mjs';
import {createSpeechIngress} from '../apps/speech/service.mjs';

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

test('Services routes every public socket to the native speech entrypoint before any other service', async () => {
  const deployment = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const speech = deployment.services.speech;
  // Vercel's Node framework captures listen() from the declared entrypoint.
  assert.equal(speech.framework, 'node');
  await access(new URL(`../${speech.root}/${speech.entrypoint}`, import.meta.url));
  // The bridge closes sockets at 290 s, so the function must outlive it.
  assert.ok(speech.functions[speech.entrypoint].maxDuration >= 300);
  const firstOther = deployment.rewrites.findIndex(rule => rule.destination.service !== 'speech');
  for (const source of [...Object.keys(PLATFORM_SOCKET_ENDPOINTS), `${MOVING_WORKER_SOCKET}:path*`, `${SHARED_ROOM_SOCKET}:path*`]) {
    const at = deployment.rewrites.findIndex(rule => rule.source === source);
    assert.ok(at >= 0 && at < firstOther, source);
    assert.deepEqual(deployment.rewrites[at].destination, {service: 'speech'});
  }
});

test('speech installs independently and configuration imports without WebSocket dependencies', async () => {
  const temporaryRoot = await realpath(tmpdir());
  const fixture = await mkdtemp(join(temporaryRoot, 'speech-install-'));
  const speech = new URL('../apps/speech/', import.meta.url);
  const run = source => {
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
      cwd: fixture, encoding: 'utf8', timeout: 10000, env: {...process.env, NODE_PATH: ''}
    });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
  };
  try {
    await mkdir(join(fixture, 'node_modules', '@croupier'), {recursive: true});
    await cp(new URL('node_modules/@croupier/server-transport/', speech),
      join(fixture, 'node_modules', '@croupier', 'server-transport'), {recursive: true, dereference: true});
    run(`import assert from 'node:assert/strict';
      import {platformConfiguration} from '@croupier/server-transport/configuration';
      import {canonicalPlatformPath} from '@croupier/server-transport/paths';
      assert.equal(platformConfiguration({}), null);
      assert.equal(canonicalPlatformPath('/speech-stream'), '/speech-stream');`);
    await cp(new URL('node_modules/ws/', speech), join(fixture, 'node_modules', 'ws'), {recursive: true, dereference: true});
    await copyFile(new URL('service.mjs', speech), join(fixture, 'service.mjs'));
    run(`import assert from 'node:assert/strict';
      import {createSpeechIngress} from './service.mjs';
      const server = createSpeechIngress({env: {}});
      assert.equal(server.listening, false);
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      try {assert.equal((await fetch('http://127.0.0.1:' + server.address().port + '/speech-stream')).status, 404);}
      finally {await new Promise(resolve => server.close(resolve));}`);
  } finally {
    if (dirname(fixture) !== temporaryRoot || !basename(fixture).startsWith('speech-install-')) throw Error('Unexpected fixture cleanup path');
    await rm(fixture, {recursive: true, force: true});
  }
});

test('speech service exposes only exact public paths and preserves admission before contacting Render', async () => {
  let backendCalls = 0;
  class ForbiddenBackend {constructor() {backendCalls++; throw Error('Unexpected backend call');}}
  const server = createSpeechIngress({env, WebSocketImpl: ForbiddenBackend});
  try {
    const base = await listen(server);
    for (const path of ['/speech-stream', '/lipsync-worker']) {
      const response = await fetch(base.replace('ws:', 'http:') + path);
      assert.equal(response.status, 426);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal(await rejected(base + path), 403);
    }
    for (const path of ['/api/platform-speech-stream', '/api/platform-lipsync-worker', '/other',
      '/speech-stream?ticket=secret', '/lipsync-worker/', '/%73peech-stream']) {
      assert.equal(await rejected(base + path), 404, path);
      assert.equal((await fetch(base.replace('ws:', 'http:') + path)).status, 404, path);
    }
    assert.equal(backendCalls, 0);
  } finally {await closeServer(server);}
});

test('native API exports do not listen during imports and flag-off stays closed', async () => {
  const client = (await import('../apps/web/api/platform-speech-stream.mjs')).default;
  const worker = (await import('../apps/web/api/platform-lipsync-worker.mjs')).default;
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
  const bindingHeaders={'x-dealer-id':'paow','x-speech-profile-revision':'a'.repeat(64),'x-speech-image-sha256':'b'.repeat(64),'x-speech-protocol':'3'};
  const temporaryRoot = await realpath(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, 'croupier-native-relay-'));
  const backend = createServer();
  let linked = false, relay, clientServer, workerServer, speechServer, worker, client, currentOwnerActive = true;
  const authenticate = ticketAuthenticator(ticketSecret), backendRequests = [], workerReceived = [];
  try {
    // Keep the product relay's bytes unchanged, including its real auth module.
    await copyFile(new URL('../services/astrid-gpu-worker/gateway/relay.mjs', import.meta.url), join(directory, 'relay.mjs'));
    await copyFile(new URL('../services/astrid-gpu-worker/gateway/auth.mjs', import.meta.url), join(directory, 'auth.mjs'));
    await symlink(fileURLToPath(new URL('../apps/web/node_modules', import.meta.url)), join(directory, 'node_modules'), 'junction'); linked = true;
    const {attachSpeechRelay} = await import(pathToFileURL(join(directory, 'relay.mjs')).href);
    backend.on('upgrade', request => {
      const verdict = vercelIngressRequest({...request, headers: {...request.headers, host: new URL(configuration.backendOrigin).host}},
        {transportOrigin: configuration.backendOrigin, publicOrigin: configuration.publicOrigin, secret: configuration.secret});
      assert.equal(verdict.accepted, true); assert.equal(verdict.transported, true);
      backendRequests.push({path: request.url, headers: request.headers});
      assert.equal(verdict.headers['x-croupier-vercel-secret'], undefined);
    });
    relay = attachSpeechRelay(backend, {workerSecret, allowedOrigins: [configuration.publicOrigin],
      authenticateWorker:request=>Object.entries(bindingHeaders).every(([key,value])=>request.headers[key]===value),
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
    speechServer = createSpeechIngress({env, WebSocketImpl: ActualBackend, bridgeOptions: {closeTimeoutMs: 30}});
    const clientBase = await listen(clientServer), workerBase = await listen(workerServer), speechBase = await listen(speechServer);
    // Invalid worker credentials are rejected by the actual Render relay before101.
    assert.equal(await rejected(workerBase + '/lipsync-worker', [], {...workerHeaders, authorization: 'Bearer invalid'}), 403);
    assert.equal(await rejected(speechBase + '/lipsync-worker', [], {...workerHeaders, authorization: 'Bearer invalid'}), 403);
    assert.equal(await rejected(speechBase + '/lipsync-worker', [], workerHeaders), 403, 'missing binding cannot enter registered worker');
    worker = new WebSocket(speechBase + '/lipsync-worker', [], {headers: {...workerHeaders,...bindingHeaders}});
    await once(worker, 'open');
    worker.on('message', (data, binary) => {
      if (binary) {workerReceived.push(Buffer.from(data)); worker.send(Buffer.from('exact-native-fixture-media')); return;}
      const message = JSON.parse(data.toString()); workerReceived.push(message.t);
      if (message.t === 'start') worker.send(JSON.stringify({t: 'stream', id: message.id, mime: 'video/mp4'}));
      if (message.t === 'end') worker.send(JSON.stringify({t: 'done', id: message.id}));
    });
    for (const [base, path] of [[clientBase, '/speech-stream'], [clientBase, '/api/platform-speech-stream'], [speechBase, '/speech-stream']]) {
      const protocols = ['astrid-v2', `ticket.${ticket()}`];
      assert.equal(await rejected(base + path, protocols, {...ownerHeaders, cookie: 'player_session=foreign'}), 401);
      currentOwnerActive = false;
      assert.equal(await rejected(base + path, protocols, ownerHeaders), 401);
      currentOwnerActive = true;
      const messages = [], binaryFrames = [];
      client = new WebSocket(base + path, protocols, {headers: {...ownerHeaders, 'x-croupier-vercel-secret': 'spoofed'}});
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
      assert.equal(await rejected(base + path, protocols, ownerHeaders), 401);
    }
    assert.deepEqual(workerReceived, Array.from({length: 3}, () => ['start', Buffer.from('pcm!'), 'end']).flat());
    assert.ok(backendRequests.length >= 8);
    assert.ok(backendRequests.every(value => value.headers['x-croupier-vercel-secret'] === configuration.secret));
    assert.ok(backendRequests.every(value => ['/speech-stream', '/lipsync-worker'].includes(value.path)));
    // Closing the native client cancels the relay; no listener/bridge survives.
    worker.close(1000); await once(worker, 'close');
  } finally {
    client?.terminate(); worker?.terminate(); relay?.close();
    await Promise.all([closeServer(backend), ...(clientServer ? [closeServer(clientServer)] : []), ...(workerServer ? [closeServer(workerServer)] : []), ...(speechServer ? [closeServer(speechServer)] : [])]);
    if (dirname(directory) !== temporaryRoot || !basename(directory).startsWith('croupier-native-relay-')) throw Error('Unexpected fixture cleanup path');
    if (linked) await unlink(join(directory, 'node_modules'));
    await rm(directory, {recursive: true, force: true});
  }
});
