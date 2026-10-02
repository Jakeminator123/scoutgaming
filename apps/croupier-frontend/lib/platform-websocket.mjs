import WebSocket from 'ws';
import {experimental_upgradeWebSocket, waitUntil} from '@vercel/functions';
import {platformConfiguration, canonicalPlatformPath} from './platform-routing.mjs';

const CLIENT_PATH = '/speech-stream', WORKER_PATH = '/lipsync-worker';
const MAX_BUFFERED = 8 * 1024 * 1024;
const MAX_MESSAGES = 256;
const response = status => new Response(null, {status, headers: {'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store'}});
const closeCode = code => code === 1000 || (code >= 1001 && code <= 1014 && ![1004, 1005, 1006].includes(code)) || (code >= 3000 && code <= 4999) ? code : 1011;
const byteLength = data => Buffer.byteLength(data);

// Only application credentials cross this boundary. ws constructs a fresh
// Host/Connection/Upgrade/key/extensions handshake to the configured backend.
export function platformSocketRequest(request, configuration) {
  const url = new URL(request.url), path = canonicalPlatformPath(url.pathname);
  if (![CLIENT_PATH, WORKER_PATH].includes(path) || url.search) return {status: 400};
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return {status: 426};
  const origin = request.headers.get('origin');
  const headers = {'x-croupier-vercel-secret': configuration.secret, 'x-croupier-public-origin': configuration.publicOrigin,
    'x-forwarded-host': new URL(configuration.publicOrigin).host, 'x-forwarded-proto': 'https'};
  let protocols = [];
  if (path === CLIENT_PATH) {
    if (origin !== configuration.publicOrigin) return {status: 403};
    const cookie = request.headers.get('cookie');
    if (!cookie || cookie.length > 16384) return {status: 401};
    protocols = (request.headers.get('sec-websocket-protocol') ?? '').split(',').map(value => value.trim());
    // The SDK selects the first protocol. Never reflect a signed ticket in
    // the response; existing native clients put astrid-v2 first.
    if (protocols.length !== 2 || protocols[0] !== 'astrid-v2' || !/^ticket\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(protocols[1]) || protocols[1].length > 4103) return {status: 401};
    headers.cookie = cookie; headers.origin = origin;
  } else {
    const authorization = request.headers.get('authorization'), workerId = request.headers.get('x-worker-id');
    if (!/^Bearer \S{1,2048}$/.test(authorization ?? '') || !/^[\w-]{1,100}$/.test(workerId ?? '') || request.headers.has('sec-websocket-protocol')) return {status: 403};
    if (origin && origin !== configuration.publicOrigin) return {status: 403};
    headers.authorization = authorization; headers['x-worker-id'] = workerId;
    if (origin) headers.origin = origin;
  }
  return {url: configuration.backendOrigin.replace('https:', 'wss:') + path, headers, protocols,
    maxPayload: path === CLIENT_PATH ? 1024 * 1024 : 4 * 1024 * 1024};
}

export function bridgePlatformSocket(upstream, {maxBufferedBytes = MAX_BUFFERED, maxMessages = MAX_MESSAGES, lifetimeMs = 290000, attachTimeoutMs = 10000, closeTimeoutMs = 2000} = {}) {
  let frontend, terminal, queuedBytes = 0, finished = false, closing = false;
  const queue = [];
  let resolveDone;
  const done = new Promise(resolve => {resolveDone = resolve;});
  let closeTimer;
  const finish = () => {
    if (finished) return;
    finished = true; clearTimeout(attachTimer); clearTimeout(lifetimeTimer); clearTimeout(closeTimer);
    queue.length = 0; queuedBytes = 0; resolveDone();
  };
  const shut = (code = 1011) => {
    if (finished || closing) return;
    closing = true;
    for (const socket of [frontend, upstream]) if (socket && socket.readyState < WebSocket.CLOSING) {
      try {socket.close(closeCode(code), 'Transport closed');} catch {socket.terminate();}
    }
    closeTimer = setTimeout(() => {
      for (const socket of [frontend, upstream]) if (socket && socket.readyState !== WebSocket.CLOSED) socket.terminate();
      finish();
    }, closeTimeoutMs);
    closeTimer.unref?.();
    if (!frontend && upstream.readyState === WebSocket.CLOSED) finish();
  };
  const send = (socket, data, binary) => {
    if (socket.readyState !== WebSocket.OPEN || socket.bufferedAmount + byteLength(data) > maxBufferedBytes) {shut(1013); return false;}
    try {socket.send(data, {binary}, error => {if (error) shut(1011);}); return true;} catch {shut(1011); return false;}
  };
  const attachTimer = setTimeout(() => shut(1011), attachTimeoutMs);
  const lifetimeTimer = setTimeout(() => shut(1001), lifetimeMs);
  attachTimer.unref?.(); lifetimeTimer.unref?.();
  upstream.on('message', (data, binary) => {
    if (finished || closing) return;
    if (frontend) {send(frontend, data, binary); return;}
    const bytes = byteLength(data);
    if (queuedBytes + bytes > maxBufferedBytes || queue.length >= maxMessages) {shut(1013); return;}
    // ready/stream can arrive in the same read as the backend handshake.
    queue.push({data, binary}); queuedBytes += bytes;
  });
  upstream.on('error', () => shut(1011));
  upstream.on('close', code => {
    terminal = closeCode(code);
    if (frontend) {
      shut(terminal);
      if (frontend.readyState === WebSocket.CLOSED) finish();
    }
  });
  return {
    done,
    cancel: () => shut(1011),
    attach(socket) {
      if (frontend) throw Error('Socket transport already attached.');
      frontend = socket; clearTimeout(attachTimer);
      frontend.on('error', () => shut(1011));
      frontend.on('close', code => {
        shut(code);
        if (upstream.readyState === WebSocket.CLOSED) finish();
      });
      frontend.on('message', (data, binary) => {if (!finished && !closing) send(upstream, data, binary);});
      if (finished || closing) {socket.close(1011, 'Transport closed'); return done;}
      for (const item of queue) if (!send(frontend, item.data, item.binary)) break;
      queue.length = 0; queuedBytes = 0;
      if (terminal) shut(terminal);
      return done;
    },
  };
}

export async function handlePlatformWebSocket(request, {env = process.env, WebSocketImpl = WebSocket, upgrade = experimental_upgradeWebSocket, handshakeMs = 10000, bridgeOptions} = {}) {
  let configuration;
  try {configuration = platformConfiguration(env);} catch {return response(503);}
  if (!configuration) return response(404);
  const input = platformSocketRequest(request, configuration);
  if (input.status) return response(input.status);
  let upstream, bridge, removeAbort;
  try {
    upstream = new WebSocketImpl(input.url, input.protocols, {headers: input.headers, followRedirects: false,
      perMessageDeflate: false, handshakeTimeout: handshakeMs, maxPayload: 4 * 1024 * 1024});
    bridge = bridgePlatformSocket(upstream, {lifetimeMs: input.url.endsWith(WORKER_PATH) ? 590000 : 290000, ...bridgeOptions});
    const status = await new Promise(resolve => {
      upstream.once('open', () => resolve(101));
      upstream.once('error', () => resolve(502));
      upstream.once('close', () => resolve(502));
      upstream.once('unexpected-response', (_request, reply) => {
        reply.resume();
        resolve([400, 401, 403, 409, 429, 503].includes(reply.statusCode) ? reply.statusCode : 502);
      });
    });
    if (status !== 101) {bridge.cancel(); return response(status);}
    if (input.protocols.length && upstream.protocol !== 'astrid-v2') {bridge.cancel(); return response(502);}
    if (request.signal.aborted) {bridge.cancel(); return response(499);}
    const abort = () => bridge.cancel();
    request.signal.addEventListener('abort', abort, {once: true});
    removeAbort = () => request.signal.removeEventListener('abort', abort);
    bridge.done.then(removeAbort);
    // Render has already checked current role/session, ticket ownership or
    // worker bearer. No reconnect/retry here: tickets are single use.
    return await upgrade(socket => {
      bridge.attach(socket);
      // SDK awaits its handler before returning the upgrade Response. Register
      // the bounded socket lifetime separately; return from setup immediately.
      waitUntil(bridge.done);
    }, {maxPayload: input.maxPayload});
  } catch {
    removeAbort?.();
    bridge?.cancel();
    return response(502);
  }
}
