import WebSocket from 'ws';
import {canonicalPlatformPath, movingWorkerSocketPath, sharedRoomSocketPath} from './paths.mjs';

const CLIENT_PATH = '/speech-stream', WORKER_PATH = '/lipsync-worker';
const MAX_BUFFERED = 8 * 1024 * 1024;
const MAX_MESSAGES = 256;
const closeCode = code => code === 1000 || (code >= 1001 && code <= 1014 && ![1004, 1005, 1006].includes(code)) || (code >= 3000 && code <= 4999) ? code : 1011;
const byteLength = data => Buffer.byteLength(data);
// Only application credentials cross this boundary. ws constructs a fresh
// Host/Connection/Upgrade/key/extensions handshake to the configured backend.
export function platformSocketRequest(request, configuration) {
  const url = new URL(request.url), path = canonicalPlatformPath(url.pathname);
  const room = sharedRoomSocketPath(path);
  const movingClient = path === '/moving-speech-stream', movingWorker = movingWorkerSocketPath(path);
  const moving = movingClient || movingWorker;
  if ((!room && !moving && ![CLIENT_PATH, WORKER_PATH].includes(path)) || (!movingWorker && url.search) || url.hash) return {status: 400};
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return {status: 426};
  const origin = request.headers.get('origin');
  const headers = {'x-croupier-vercel-secret': configuration.secret, 'x-croupier-public-origin': configuration.publicOrigin,
    'x-forwarded-host': new URL(configuration.publicOrigin).host, 'x-forwarded-proto': 'https'};
  let protocols = [];
  if (room) {
    // Only the game authenticates the current session before101. Speech tickets
    // and worker bearers are never accepted as room authentication.
    if (url.origin !== configuration.publicOrigin || request.headers.get('host') !== new URL(configuration.publicOrigin).host
      || origin !== configuration.publicOrigin || request.headers.has('authorization')
      || request.headers.has('x-worker-id') || request.headers.has('sec-websocket-protocol')) return {status: 403};
    const cookie = request.headers.get('cookie');
    if (!cookie || cookie.length > 16384) return {status: 401};
    headers.cookie = cookie; headers.origin = origin;
  } else if (path === CLIENT_PATH || movingClient) {
    if (origin !== configuration.publicOrigin) return {status: 403};
    const cookie = request.headers.get('cookie');
    if (!cookie || cookie.length > 16384) return {status: 401};
    protocols = (request.headers.get('sec-websocket-protocol') ?? '').split(',').map(value => value.trim());
    // Never reflect a signed ticket in
    // the response; the public protocol (astrid-v2 or moving-v1) comes first.
    if (protocols.length !== 2 || protocols[0] !== (movingClient ? 'moving-v1' : 'astrid-v2') || !/^ticket\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(protocols[1]) || protocols[1].length > 4103) return {status: 401};
    headers.cookie = cookie; headers.origin = origin;
  } else if (movingWorker) {
    const params = url.searchParams;
    if (request.headers.has('origin') || request.headers.has('sec-websocket-protocol')
      || params.getAll('token').length !== 1 || !/^[a-f0-9]{64}$/.test(params.get('token') ?? '')
      || params.getAll('avatar').length !== 1 || !/^[a-z][a-z0-9-]{0,39}$/.test(params.get('avatar') ?? '')
      || [...params.keys()].some(key => !['token', 'avatar'].includes(key))
      || /[%+]/.test(url.search)) return {status: 403};
    // The live capability authorizes this channel, never browser credentials.
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
  return {url: configuration.backendOrigin.replace('https:', 'wss:') + path + url.search, headers, protocols,
    maxPayload: room ? 256 * 1024 : moving ? 2 * 1024 * 1024 : path === CLIENT_PATH ? 1024 * 1024 : 4 * 1024 * 1024,
    ...(room ? {room: true, lifetimeMs: 290000, maxBufferedBytes: 256 * 1024} : {}),
    ...(moving ? {moving: true, lifetimeMs: 180000, maxBufferedBytes: 4 * 1024 * 1024} : {})};
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
    try {
      socket.send(data, {binary}, error => {if (error) shut(1011);});
      return true;
    } catch {shut(1011); return false;}
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
    // K04 F10: an engine that went away without a close frame (1005/1006, e.g. a Render restart) is a service
    // restart, 1012, not an internal error. Clients reconnect on both; receipts can tell the two apart.
    terminal = code === 1005 || code === 1006 ? 1012 : closeCode(code);
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
