import test from 'node:test';
import assert from 'node:assert/strict';
import {readVercelIngressConfig, vercelIngressRequest} from '../vercel-ingress.mjs';
import {proxyHeaders} from '../gateway.mjs';
import {createCloudGateway} from '../gateway.mjs';
import {createServer, request as httpRequest} from 'node:http';
import {once} from 'node:events';

const env = {CROUPIER_VERCEL_TRANSPORT_ORIGIN: 'https://isolated.onrender.com', CROUPIER_PUBLIC_ORIGIN: 'https://preview.example.test', CROUPIER_VERCEL_INGRESS_SECRET: 'isolated-ingress-fixture-'.repeat(3)};
const ingress = readVercelIngressConfig(env);
const request = (url = '/api/table', extra = {}) => ({url, method: 'POST', headers: {host: 'isolated.onrender.com', origin: ingress.publicOrigin,
  cookie: 'player_session=isolated', 'x-croupier-vercel-secret': ingress.secret, 'x-croupier-public-origin': ingress.publicOrigin,
  'x-forwarded-host': 'preview.example.test', 'x-forwarded-proto': 'https', 'sec-fetch-site': 'same-origin', ...extra}});

test('only a secret-authenticated exact Vercel origin can cross the backend transport boundary', () => {
  assert.equal(readVercelIngressConfig({}), null);
  assert.throws(() => readVercelIngressConfig({...env, CROUPIER_PUBLIC_ORIGIN: env.CROUPIER_VERCEL_TRANSPORT_ORIGIN}));
  const accepted = vercelIngressRequest(request('/api/table?requestId=a%20b', {'x-croupier-lab-authorized': 'browser-spoof'}), ingress);
  assert.equal(accepted.accepted, true); assert.equal(accepted.headers.host, 'preview.example.test');
  assert.equal(accepted.headers.cookie, 'player_session=isolated'); assert.equal(accepted.headers.origin, ingress.publicOrigin);
  assert.equal(accepted.headers['x-croupier-lab-authorized'], undefined);
  assert.equal(accepted.headers['x-croupier-vercel-secret'], undefined);
  const downstream = proxyHeaders(accepted.headers, accepted.headers.host);
  assert.equal(downstream['x-forwarded-host'], 'preview.example.test');
  for (const extra of [{host: 'preview.example.test'}, {'x-croupier-vercel-secret': 'wrong'}, {'x-croupier-public-origin': 'https://evil.example.test'},
    {'x-forwarded-host': 'evil.example.test'}, {'x-forwarded-proto': 'http'}]) assert.equal(vercelIngressRequest(request('/api/table', extra), ingress).accepted, false);
  for (const path of ['/api/auth/lab/check', '/__vercel/admin', '/api/unknown', '/studio/api/%70roject', '/studio/api/../project']) assert.equal(vercelIngressRequest(request(path), ingress).accepted, false, path);
  assert.equal(vercelIngressRequest({...request('/__vercel/lab/session'), method: 'GET'}, ingress).session, true);
  assert.equal(vercelIngressRequest(request('/__vercel/lab/session'), ingress).accepted, false);
});

test('WebSocket and SSE pass through the same authenticated ingress without replay or origin rewriting', () => {
  for (const path of ['/speech-stream', '/lipsync-worker', '/studio/api/inputs/events']) {
    const input = {...request(path), method: 'GET'};
    input.headers.upgrade = 'websocket';
    const accepted = vercelIngressRequest(input, ingress);
    assert.equal(accepted.accepted, true); assert.equal(accepted.headers.origin, ingress.publicOrigin);
    assert.equal(accepted.headers.upgrade, 'websocket');
  }
  assert.equal(vercelIngressRequest({url: '/__cloud/health', method: 'GET', headers: {host: 'isolated.onrender.com'}}, ingress).health, true);
});

test('real HTTP gateway preserves media ranges and streams SSE, checking Lab access on every reconnect', async () => {
  let authorized = true, checks = 0, labRequests = 0;
  const web = createServer((req, res) => {
    assert.equal(req.headers.host, 'preview.example.test');
    assert.equal(req.headers['x-croupier-vercel-secret'], undefined);
    assert.equal(req.headers.range, 'bytes=2-4');
    res.writeHead(206, {'Content-Type': 'video/mp4', 'Content-Range': 'bytes 2-4/8', 'Accept-Ranges': 'bytes', ETag: '"unchanged-hash"', 'Cross-Origin-Resource-Policy': 'same-origin'});
    res.end('234');
  });
  const lab = createServer((req, res) => {
    labRequests++; assert.equal(req.headers['x-croupier-lab-authorized'], 'lab-fixture-internal-secret-'.repeat(3));
    assert.equal(req.headers['last-event-id'], 'version-17');
    res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store'});
    res.write('id: version-18\ndata: {"version":18}\n\n');
    // Keep the connection open; the first event must reach the client now.
  });
  const servers = [web, lab];
  try {
    for (const server of servers) {server.listen(0, '127.0.0.1'); await once(server, 'listening');}
    const gateway = createCloudGateway({singleOrigin: true, gameOrigin: ingress.publicOrigin, boOrigin: ingress.publicOrigin, labOrigin: ingress.publicOrigin, streaming: true}, {
      webPort: web.address().port, labPort: lab.address().port, vercelIngress: ingress, labInternalSecret: 'lab-fixture-internal-secret-'.repeat(3),
      sessionCheck: async (cookie, host) => {checks++; assert.equal(cookie, 'player_session=isolated'); assert.equal(host, 'preview.example.test'); return {available: true, authorized};},
    });
    servers.push(gateway); gateway.listen(0, '127.0.0.1'); await once(gateway, 'listening');
    const get = (path, headers = {}, firstChunk = false) => new Promise((resolve, reject) => {
      const req = httpRequest({host: '127.0.0.1', port: gateway.address().port, method: 'GET', path, headers: request(path, headers).headers}, res => {
        let body = '';
        res.on('data', chunk => {body += chunk; if (firstChunk) {resolve({status: res.statusCode, headers: res.headers, body}); res.destroy();}});
        res.on('end', () => resolve({status: res.statusCode, headers: res.headers, body}));
      });
      req.on('error', reject); req.setTimeout(2000, () => req.destroy(Error('Fixture timed out.'))); req.end();
    });
    const media = await get('/api/presentation/videos/id', {range: 'bytes=2-4'});
    assert.equal(media.status, 206); assert.equal(media.body, '234'); assert.equal(media.headers['content-range'], 'bytes 2-4/8');
    assert.equal(media.headers.etag, '"unchanged-hash"'); assert.equal(media.headers['cross-origin-resource-policy'], 'same-origin');
    const session = await get('/__vercel/lab/session'); assert.equal(session.status, 200);
    const sse = await get('/studio/api/inputs/events', {'last-event-id': 'version-17'}, true);
    assert.equal(sse.status, 200); assert.match(sse.body, /id: version-18/); assert.equal(labRequests, 1);
    authorized = false;
    assert.equal((await get('/__vercel/lab/session')).status, 401);
    assert.equal((await get('/studio/api/inputs/events', {'last-event-id': 'version-18'})).status, 401);
    assert.equal(labRequests, 1); assert.equal(checks, 4);
    assert.equal((await get('/api/table', {'x-croupier-vercel-secret': 'spoof'})).status, 421);
  } finally {
    for (const server of servers.reverse()) {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
  }
});
