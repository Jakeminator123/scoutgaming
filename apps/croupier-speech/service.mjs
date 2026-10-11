import {createServer} from 'node:http';
import {createPlatformNativeWebSocketServer} from '../croupier-frontend/lib/platform-native-websocket.mjs';

// Keep the existing bounded, authenticated transport. This service owns only
// the two public socket paths; Render still owns all sessions and provider jobs.
export function createSpeechIngress(options = {}) {
  const handlers = new Map(['/speech-stream', '/lipsync-worker'].map(path =>
    [path, createPlatformNativeWebSocketServer(path, options)]));
  const server = createServer((request, response) => {
    const handler = handlers.get(request.url);
    if (handler) {handler.emit('request', request, response); return;}
    response.writeHead(404, {'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store'});
    response.end();
  });
  server.on('upgrade', (request, socket, head) => {
    const handler = handlers.get(request.url);
    if (handler) {handler.emit('upgrade', request, socket, head); return;}
    socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\nCache-Control: private, no-store\r\nContent-Length: 0\r\n\r\n');
  });
  server.on('close', () => {for (const handler of handlers.values()) handler.emit('close');});
  return server;
}
