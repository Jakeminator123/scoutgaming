import WebSocket from 'ws';
import {experimental_upgradeWebSocket, waitUntil} from '@vercel/functions';
import {platformConfiguration, canonicalPlatformPath} from './platform-configuration.mjs';

const CLIENT_PATH = '/speech-stream', WORKER_PATH = '/lipsync-worker';
const MAX_BUFFERED = 8 * 1024 * 1024;
const MAX_MESSAGES = 256;
const response = status => new Response(null, {status, headers: {'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store'}});
const closeCode = code => code === 1000 || (code >= 1001 && code <= 1014 && ![1004, 1005, 1006].includes(code)) || (code >= 3000 && code <= 4999) ? code : 1011;
const byteLength = data => Buffer.byteLength(data);
const DIAGNOSTIC_PHASES = new Set(['created', 'upstream_open', 'upstream_receive', 'frontend_send', 'frontend_receive', 'upstream_send',
  'frontend_send_before', 'upstream_send_before',
  'frontend_send_callback', 'frontend_send_pending', 'upstream_send_callback', 'upstream_send_pending', 'frontend_drain', 'upstream_drain',
  'upstream_close', 'frontend_close', 'attached', 'returned', 'request_abort', 'failed', 'done']);
const WRITE_ERROR_CODES = new Set(['EPIPE', 'ECONNRESET', 'ERR_STREAM_DESTROYED', 'ERR_STREAM_WRITE_AFTER_END']);

export function platformSocketDiagnostics(configuration, env, path, {emit = value => console.info(value)} = {}) {
  if (env.NODE_ENV !== 'production' || configuration.publicOrigin !== 'https://croupier-player-preview-qa.vercel.app'
      || configuration.backendOrigin !== 'https://croupier-vercel-preview-qa.onrender.com') return () => {};
  const counts = new Map();
  const trace = (phase, fields = {}) => {
    if (!DIAGNOSTIC_PHASES.has(phase)) return;
    const count = (counts.get(phase) ?? 0) + 1; counts.set(phase, count);
    if (count > 8 && phase !== 'done') return;
    const value = {channel: path === WORKER_PATH ? 'worker' : 'client', phase, count};
    for (const name of ['bytes', 'code', 'status', 'sequence', 'bufferedAmount', 'writableLength', 'writableCorked', 'bytesWritten']) if (Number.isSafeInteger(fields?.[name]) && fields[name] >= 0 && fields[name] <= MAX_BUFFERED) value[name] = fields[name];
    for (const name of ['binary', 'contextWaitUntil', 'hasSocket', 'writable', 'writableEnded', 'needDrain', 'destroyed', 'writeError']) if (typeof fields?.[name] === 'boolean') value[name] = fields[name];
    if (WRITE_ERROR_CODES.has(fields?.writeErrorCode) || fields?.writeErrorCode === 'OTHER') value.writeErrorCode = fields.writeErrorCode;
    if (phase === 'attached') {
      try {value.contextWaitUntil = typeof globalThis[Symbol.for('@vercel/request-context')]?.get?.()?.waitUntil === 'function';} catch {value.contextWaitUntil = false;}
    }
    if (phase === 'done') value.counters = Object.fromEntries(counts);
    try {emit('CROUPIER_UNPAID_SOCKET ' + JSON.stringify(value));} catch { /* Evidence never changes transport. */ }
  };
  trace.enabled = true;
  return trace;
}

// ws exposes its Node socket internally. Read only numeric/boolean state for
// isolated QA; never uncork a stream owned by the runtime or log socket data.
function socketWriteState(socket) {
  try {
    const raw = socket._socket;
    return {hasSocket: !!raw, bufferedAmount: socket.bufferedAmount,
      writableLength: raw?.writableLength, writableCorked: raw?.writableCorked, bytesWritten: raw?.bytesWritten,
      writable: raw?.writable, writableEnded: raw?.writableEnded, needDrain: raw?.writableNeedDrain, destroyed: raw?.destroyed};
  } catch {return {};}
}

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
    const bindingFields = ['x-dealer-id','x-speech-profile-revision','x-speech-image-sha256','x-speech-protocol'];
    if (bindingFields.some(name => request.headers.has(name))) {
      const [dealer, profile, image, protocol] = bindingFields.map(name => request.headers.get(name));
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(dealer ?? '') || !/^[a-f0-9]{64}$/.test(profile ?? '')
        || !/^[a-f0-9]{64}$/.test(image ?? '') || protocol !== '3') return {status:403};
      for (const name of bindingFields) headers[name] = request.headers.get(name);
    }
    if (origin) headers.origin = origin;
  }
  return {url: configuration.backendOrigin.replace('https:', 'wss:') + path, headers, protocols,
    maxPayload: path === CLIENT_PATH ? 1024 * 1024 : 4 * 1024 * 1024};
}

export function bridgePlatformSocket(upstream, {maxBufferedBytes = MAX_BUFFERED, maxMessages = MAX_MESSAGES, lifetimeMs = 290000, attachTimeoutMs = 10000, closeTimeoutMs = 2000, writeObservationMs = 2000, trace = () => {}} = {}) {
  let frontend, terminal, queuedBytes = 0, finished = false, closing = false;
  const queue = [];
  const observations = new Set(), drainListeners = [], sendSequences = new Map();
  const observeWrites = trace.enabled === true;
  let upstreamDrainOnOpen;
  let resolveDone;
  const done = new Promise(resolve => {resolveDone = resolve;});
  let closeTimer;
  const finish = () => {
    if (finished) return;
    finished = true; clearTimeout(attachTimer); clearTimeout(lifetimeTimer); clearTimeout(closeTimer);
    for (const timer of observations) clearTimeout(timer);
    for (const [socket, listener] of drainListeners) socket.removeListener('drain', listener);
    if (upstreamDrainOnOpen) upstream.removeListener('open', upstreamDrainOnOpen);
    queue.length = 0; queuedBytes = 0; trace('done'); resolveDone();
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
  const send = (socket, data, binary, phase) => {
    if (socket.readyState !== WebSocket.OPEN || socket.bufferedAmount + byteLength(data) > maxBufferedBytes) {shut(1013); return false;}
    let observation, sequence;
    if (observeWrites) {
      sequence = (sendSequences.get(phase) ?? 0) + 1; sendSequences.set(phase, sequence);
      trace(phase + '_before', {sequence, ...socketWriteState(socket)});
      // Only the first eight sends per direction need a delayed observation.
      if (sequence <= 8) {
        observation = setTimeout(() => {
          observations.delete(observation);
          trace(phase + '_pending', {sequence, ...socketWriteState(socket)});
        }, writeObservationMs);
        observation.unref?.(); observations.add(observation);
      }
    }
    try {
      socket.send(data, {binary}, error => {
        if (observation) {clearTimeout(observation); observations.delete(observation);}
        if (observeWrites) trace(phase + '_callback', {sequence, writeError: !!error,
          ...(error ? {writeErrorCode: WRITE_ERROR_CODES.has(error.code) ? error.code : 'OTHER'} : {}), ...socketWriteState(socket)});
        if (error) shut(1011);
      });
      if (phase) trace(phase, {bytes: byteLength(data), binary, ...(observeWrites ? {sequence, ...socketWriteState(socket)} : {})});
      return true;
    } catch {
      if (observation) {clearTimeout(observation); observations.delete(observation);}
      shut(1011); return false;
    }
  };
  const observeDrain = (socket, phase) => {
    if (!observeWrites || !socket._socket?.on) return;
    const listener = () => trace(phase, socketWriteState(socket));
    socket._socket.on('drain', listener); drainListeners.push([socket._socket, listener]);
  };
  const attachTimer = setTimeout(() => shut(1011), attachTimeoutMs);
  const lifetimeTimer = setTimeout(() => shut(1001), lifetimeMs);
  attachTimer.unref?.(); lifetimeTimer.unref?.();
  if (observeWrites && upstream.readyState !== WebSocket.OPEN) {
    upstreamDrainOnOpen = () => observeDrain(upstream, 'upstream_drain');
    upstream.once('open', upstreamDrainOnOpen);
  } else observeDrain(upstream, 'upstream_drain');
  upstream.on('message', (data, binary) => {
    trace('upstream_receive', {bytes: byteLength(data), binary});
    if (finished || closing) return;
    if (frontend) {send(frontend, data, binary, 'frontend_send'); return;}
    const bytes = byteLength(data);
    if (queuedBytes + bytes > maxBufferedBytes || queue.length >= maxMessages) {shut(1013); return;}
    // ready/stream can arrive in the same read as the backend handshake.
    queue.push({data, binary}); queuedBytes += bytes;
  });
  upstream.on('error', () => shut(1011));
  upstream.on('close', code => {
    trace('upstream_close', {code});
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
      trace('attached', observeWrites ? socketWriteState(frontend) : {});
      observeDrain(frontend, 'frontend_drain');
      frontend.on('error', () => shut(1011));
      frontend.on('close', code => {
        trace('frontend_close', {code});
        shut(code);
        if (upstream.readyState === WebSocket.CLOSED) finish();
      });
      frontend.on('message', (data, binary) => {trace('frontend_receive', {bytes: byteLength(data), binary}); if (!finished && !closing) send(upstream, data, binary, 'upstream_send');});
      if (finished || closing) {socket.close(1011, 'Transport closed'); return done;}
      for (const item of queue) if (!send(frontend, item.data, item.binary, 'frontend_send')) break;
      queue.length = 0; queuedBytes = 0;
      if (terminal) shut(terminal);
      return done;
    },
  };
}

export async function handlePlatformWebSocket(request, {env = process.env, WebSocketImpl = WebSocket, upgrade = experimental_upgradeWebSocket, retain = waitUntil, handshakeMs = 10000, bridgeOptions, diagnosticEmit} = {}) {
  let configuration;
  try {configuration = platformConfiguration(env);} catch {return response(503);}
  if (!configuration) return response(404);
  const input = platformSocketRequest(request, configuration);
  if (input.status) return response(input.status);
  const trace = platformSocketDiagnostics(configuration, env, new URL(input.url).pathname, {emit: diagnosticEmit});
  trace('created');
  let upstream, bridge, removeAbort;
  try {
    upstream = new WebSocketImpl(input.url, input.protocols, {headers: input.headers, followRedirects: false,
      perMessageDeflate: false, handshakeTimeout: handshakeMs, maxPayload: 4 * 1024 * 1024});
    bridge = bridgePlatformSocket(upstream, {lifetimeMs: input.url.endsWith(WORKER_PATH) ? 590000 : 290000, ...bridgeOptions, trace});
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
    trace('upstream_open');
    if (input.protocols.length && upstream.protocol !== 'astrid-v2') {bridge.cancel(); return response(502);}
    if (request.signal.aborted) {bridge.cancel(); return response(499);}
    const abort = () => {trace('request_abort'); bridge.cancel();};
    request.signal.addEventListener('abort', abort, {once: true});
    removeAbort = () => request.signal.removeEventListener('abort', abort);
    bridge.done.then(removeAbort);
    // Render has already checked current role/session, ticket ownership or
    // worker bearer. No reconnect/retry here: tickets are single use.
    const reply = await upgrade(socket => {
      bridge.attach(socket);
      // SDK awaits its handler before returning the upgrade Response. Register
      // the bounded socket lifetime separately; return from setup immediately.
      retain(bridge.done);
    }, {maxPayload: input.maxPayload});
    trace('returned', {status: reply.status});
    return reply;
  } catch {
    trace('failed');
    removeAbort?.();
    bridge?.cancel();
    return response(502);
  }
}
