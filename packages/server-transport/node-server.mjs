import {createServer} from 'node:http';
import WebSocket, {WebSocketServer} from 'ws';
import {platformConfiguration} from './configuration.mjs';
import {canonicalPlatformPath, PLATFORM_SOCKET_ENDPOINTS, MOVING_WORKER_SOCKET, movingWorkerSocketPath, SHARED_ROOM_SOCKET, sharedRoomSocketPath} from './paths.mjs';
import {platformSocketRequest, bridgePlatformSocket, platformSocketDiagnostics} from './socket-core.mjs';

const BACKEND_FAILURES = new Set([400, 401, 403, 409, 429, 503, 504]);

function reject(socket, status) {
  if (!socket.destroyed) socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\nCache-Control: private, no-store\r\nCDN-Cache-Control: no-store\r\nContent-Length: 0\r\n\r\n`);
}

function matchesPath(raw, publicPath) {
  if (publicPath === SHARED_ROOM_SOCKET) return sharedRoomSocketPath(raw);
  if (publicPath === MOVING_WORKER_SOCKET) return typeof raw === 'string' && !raw.includes('#')
    && movingWorkerSocketPath(raw.split('?')[0]);
  // A middleware rewrite can preserve the original path or deliver the fixed
  // internal function path. Neither form permits a query or another function.
  return typeof raw === 'string' && !raw.includes('?') && !raw.includes('#')
    && [publicPath, PLATFORM_SOCKET_ENDPOINTS[publicPath]].includes(raw)
    && canonicalPlatformPath(raw) === raw;
}

function requestHeaders(request) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  return headers;
}

// Vercel owns the exported HTTP server's listener and socket lifecycle. Module
// imports never bind a port; isolated fixtures explicitly listen and close it.
export function createPlatformNativeWebSocketServer(publicPath, {env = process.env, WebSocketImpl = WebSocket,
  handshakeMs = 10000, bridgeOptions, diagnosticEmit, WebSocketServerImpl = WebSocketServer} = {}) {
  if (publicPath !== SHARED_ROOM_SOCKET && publicPath !== MOVING_WORKER_SOCKET && !Object.hasOwn(PLATFORM_SOCKET_ENDPOINTS, publicPath)) throw Error('Unknown platform socket function.');
  const worker = publicPath === '/lipsync-worker';
  const room = publicPath === SHARED_ROOM_SOCKET;
  const moving = publicPath === MOVING_WORKER_SOCKET || publicPath === '/moving-speech-stream';
  const protocol = publicPath === '/moving-speech-stream' ? 'moving-v1' : 'astrid-v2';
  const websocketServer = new WebSocketServerImpl({noServer: true, perMessageDeflate: false,
    maxPayload: room ? 1024 : moving ? 2 * 1024 * 1024 : worker ? 4 * 1024 * 1024 : 1024 * 1024,
    handleProtocols: protocols => !room && protocols.has(protocol) ? protocol : false});
  const bridges = new Set();
  let closed = false;
  const configure = () => {
    try {return closed ? {status: 503} : {configuration: platformConfiguration(env)};} catch {return {status: 503};}
  };
  const server = createServer((request, response) => {
    const {configuration, status} = configure();
    response.writeHead(status ?? (!configuration ? 404 : matchesPath(request.url, publicPath) ? 426 : 400),
      {'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store', Connection: 'close'});
    response.end();
  });
  const shutdown = () => {
    if (closed) return; closed = true;
    for (const bridge of bridges) bridge.cancel();
    websocketServer.close();
  };
  server.on('close', shutdown);
  const close = server.close;
  server.close = function (...args) {shutdown(); return close.apply(this, args);};
  server.on('upgrade', async (request, socket, head) => {
    let bridge, trace = () => {}, abort;
    try {
      const {configuration, status} = configure();
      if (status || !configuration) {reject(socket, status ?? 404); return;}
      if (request.method !== 'GET' || !matchesPath(request.url, publicPath)) {reject(socket, 400); return;}
      if (room) {
        const seen = new Set(), protectedNames = new Set(['host','origin','cookie','authorization','x-worker-id',
          'upgrade','connection','sec-websocket-key','sec-websocket-version','sec-websocket-protocol']);
        for (let i = 0; i < (request.rawHeaders?.length ?? 0); i += 2) {
          const name = request.rawHeaders[i].toLowerCase();
          if (protectedNames.has(name) && seen.has(name)) {reject(socket, 403); return;}
          seen.add(name);
        }
        if (!Buffer.isBuffer(head) || head.length > 1038) {reject(socket, 403); return;}
      }
      const input = platformSocketRequest(new Request(configuration.publicOrigin + ((room || publicPath === MOVING_WORKER_SOCKET) ? request.url : publicPath),
        {headers: requestHeaders(request)}), configuration);
      if (input.status) {reject(socket, input.status); return;}
      trace = platformSocketDiagnostics(configuration, env, publicPath, {emit: diagnosticEmit});
      trace('created');
      const upstream = new WebSocketImpl(input.url, input.protocols, {headers: input.headers,
        followRedirects: false, perMessageDeflate: false, handshakeTimeout: handshakeMs,
        maxPayload: (input.room || input.moving) ? input.maxPayload : 4 * 1024 * 1024});
      bridge = bridgePlatformSocket(upstream, {lifetimeMs: input.lifetimeMs ?? (worker ? 590000 : 290000), ...((input.room || input.moving) ? {maxBufferedBytes: input.maxBufferedBytes} : {}), ...bridgeOptions, trace});
      bridges.add(bridge);
      bridge.done.then(() => bridges.delete(bridge));
      abort = () => {trace('request_abort'); bridge.cancel();};
      socket.once('close', abort); socket.once('error', abort);
      const upstreamStatus = await new Promise(resolve => {
        upstream.once('open', () => resolve(101));
        upstream.once('error', () => resolve(502));
        upstream.once('close', () => resolve(502));
        socket.once('close', () => resolve(499));
        upstream.once('unexpected-response', (_request, reply) => {
          reply.resume(); resolve(BACKEND_FAILURES.has(reply.statusCode) ? reply.statusCode : 502);
        });
      });
      if (upstreamStatus !== 101 || socket.destroyed || upstream.readyState !== WebSocket.OPEN) {
        bridge.cancel(); reject(socket, upstreamStatus === 101 ? 502 : upstreamStatus); return;
      }
      trace('upstream_open');
      if ((input.protocols.length && upstream.protocol !== input.protocols[0]) || (input.room && upstream.protocol)) {bridge.cancel(); reject(socket, 502); return;}
      // Only Render can accept the current owner/session, single-use ticket or
      // worker bearer/capability. Its authenticated 101 precedes public upgrade.
      websocketServer.handleUpgrade(request, socket, head, frontend => {
        socket.removeListener('close', abort); socket.removeListener('error', abort);
        bridge.attach(frontend);
        trace('returned', {status: 101});
      });
      // handleUpgrade can reject an invalid WebSocket key/version on its own.
      if (socket.destroyed) bridge.cancel();
      bridge.done.then(() => {socket.removeListener('close', abort); socket.removeListener('error', abort);});
    } catch {
      trace('failed'); bridge?.cancel();
      if (abort) {socket.removeListener('close', abort); socket.removeListener('error', abort);}
      reject(socket, 502);
    }
  });
  return server;
}
