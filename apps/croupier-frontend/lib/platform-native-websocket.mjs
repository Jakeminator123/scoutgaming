import {createServer} from 'node:http';
import WebSocket, {WebSocketServer} from 'ws';
import {canonicalPlatformPath, platformConfiguration, PLATFORM_SOCKET_ENDPOINTS} from './platform-routing.mjs';
import {platformSocketRequest, bridgePlatformSocket, platformSocketDiagnostics} from './platform-websocket.mjs';

const BACKEND_FAILURES = new Set([400, 401, 403, 409, 429, 503]);

function reject(socket, status) {
  if (!socket.destroyed) socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\nCache-Control: private, no-store\r\nCDN-Cache-Control: no-store\r\nContent-Length: 0\r\n\r\n`);
}

function matchesPath(raw, publicPath) {
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
  handshakeMs = 10000, bridgeOptions, diagnosticEmit} = {}) {
  if (!Object.hasOwn(PLATFORM_SOCKET_ENDPOINTS, publicPath)) throw Error('Unknown platform socket function.');
  const worker = publicPath === '/lipsync-worker';
  const websocketServer = new WebSocketServer({noServer: true, perMessageDeflate: false,
    maxPayload: worker ? 4 * 1024 * 1024 : 1024 * 1024,
    handleProtocols: protocols => protocols.has('astrid-v2') ? 'astrid-v2' : false});
  const bridges = new Set();
  const configure = () => {
    try {return {configuration: platformConfiguration(env)};} catch {return {status: 503};}
  };
  const server = createServer((request, response) => {
    const {configuration, status} = configure();
    response.writeHead(status ?? (!configuration ? 404 : matchesPath(request.url, publicPath) ? 426 : 400),
      {'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store', Connection: 'close'});
    response.end();
  });
  server.on('close', () => {for (const bridge of bridges) bridge.cancel(); websocketServer.close();});
  server.on('upgrade', async (request, socket, head) => {
    let bridge, trace = () => {}, abort;
    try {
      const {configuration, status} = configure();
      if (status || !configuration) {reject(socket, status ?? 404); return;}
      if (request.method !== 'GET' || !matchesPath(request.url, publicPath)) {reject(socket, 400); return;}
      const input = platformSocketRequest(new Request(configuration.publicOrigin + publicPath,
        {headers: requestHeaders(request)}), configuration);
      if (input.status) {reject(socket, input.status); return;}
      trace = platformSocketDiagnostics(configuration, env, publicPath, {emit: diagnosticEmit});
      trace('created');
      const upstream = new WebSocketImpl(input.url, input.protocols, {headers: input.headers,
        followRedirects: false, perMessageDeflate: false, handshakeTimeout: handshakeMs,
        maxPayload: 4 * 1024 * 1024});
      bridge = bridgePlatformSocket(upstream, {lifetimeMs: worker ? 590000 : 290000, ...bridgeOptions, trace});
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
      if (input.protocols.length && upstream.protocol !== 'astrid-v2') {bridge.cancel(); reject(socket, 502); return;}
      // Only Render can accept the current owner/session, single-use ticket or
      // worker bearer. Its authenticated 101 must precede the public upgrade.
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
