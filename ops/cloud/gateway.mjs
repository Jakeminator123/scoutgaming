import { createServer, request as httpRequest } from 'node:http';
import { LAB_PORT, WEB_PORT } from './config.mjs';

const HOP_HEADERS = new Set(['connection', 'keep-alive', 'proxy-authenticate',
  'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);

export function upstreamForHost(host, config) {
  if (host === new URL(config.gameOrigin).host) return WEB_PORT;
  if (host === new URL(config.labOrigin).host) return LAB_PORT;
  return null;
}

function headersWithoutHops(headers) {
  return Object.fromEntries(Object.entries(headers).filter(([key]) => !HOP_HEADERS.has(key.toLowerCase())));
}

// One platform port, two exact public hostnames. The original Host and Origin
// reach the child; rewriting them to loopback would defeat application checks.
export function createCloudGateway(config) {
  const server = createServer((incoming, outgoing) => {
    if (incoming.method === 'GET' && incoming.url === '/__cloud/health') {
      outgoing.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      outgoing.end('ok');
      return;
    }
    const targetPort = upstreamForHost(incoming.headers.host, config);
    if (!targetPort || !incoming.url?.startsWith('/') || incoming.url.startsWith('//')) {
      outgoing.writeHead(421, { 'Cache-Control': 'no-store' });
      outgoing.end();
      return;
    }
    const headers = headersWithoutHops(incoming.headers);
    delete headers.forwarded;
    delete headers['x-forwarded-for'];
    delete headers['x-forwarded-host'];
    delete headers['x-forwarded-port'];
    delete headers['x-forwarded-proto'];
    headers.host = incoming.headers.host;
    headers['x-forwarded-host'] = incoming.headers.host;
    headers['x-forwarded-port'] = '443';
    headers['x-forwarded-proto'] = 'https';
    const upstream = httpRequest({ hostname: '127.0.0.1', port: targetPort,
      method: incoming.method, path: incoming.url, headers }, response => {
      outgoing.writeHead(response.statusCode ?? 502, headersWithoutHops(response.headers));
      response.pipe(outgoing);
    });
    upstream.on('error', () => {
      if (!outgoing.headersSent) outgoing.writeHead(502, { 'Cache-Control': 'no-store' });
      outgoing.end();
    });
    incoming.on('aborted', () => upstream.destroy());
    outgoing.on('close', () => upstream.destroy());
    incoming.pipe(upstream);
  });
  server.on('upgrade', (_request, socket) => {
    socket.end('HTTP/1.1 426 Upgrade Required\r\nConnection: close\r\n\r\n');
  });
  server.on('connect', (_request, socket) => {
    socket.end('HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\n\r\n');
  });
  server.requestTimeout = 0; // SSE is a long-lived response.
  return server;
}
