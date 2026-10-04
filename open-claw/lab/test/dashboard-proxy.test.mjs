import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createDashboardProxy } from '../src/dashboard-proxy.mjs';
import { openClawDashboardUrl } from '../../../lab/lib/openclaw-dashboard.mjs';

const ORIGIN = 'https://dashboard.example.test';
const HOST = 'dashboard.example.test';
const WS_KEY = 'dGhlIHNhbXBsZSBub25jZQ==';
const WS_ACCEPT = createHash('sha1').update(`${WS_KEY}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
const ENTRY_NAVIGATION = Object.freeze({
  'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate',
  'sec-fetch-dest': 'document', 'sec-fetch-user': '?1',
});

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

function get(port, path, headers = {}, method = 'GET', body) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method, headers: { host: HOST, ...headers } }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.once('error', reject);
      res.once('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.once('error', reject);
    req.end(body);
  });
}

function upgrade(port, { path = '/openclaw', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, headers: {
      host: HOST, origin: ORIGIN, connection: 'Upgrade', upgrade: 'websocket',
      'sec-websocket-key': WS_KEY, 'sec-websocket-version': '13', ...headers,
    } });
    req.once('error', reject);
    req.once('upgrade', (res, socket, head) => { socket.on('error', () => {}); resolve({ status: res.statusCode, headers: res.headers, socket, head }); });
    req.once('response', res => { const chunks = []; res.on('data', c => chunks.push(c)); res.once('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString(), headers: res.headers })); });
    req.end();
  });
}

async function fixture(t, { httpResponses = {}, ...options } = {}) {
  const received = [], upgraded = [], gatewaySockets = new Set();
  const gateway = createServer((req, res) => {
    received.push({ path: req.url, method: req.method, headers: req.headers });
    if (req.url === '/openclaw/disconnected') { req.socket.destroy(); return; }
    if (req.url === '/openclaw/slow') return;
    if (req.url === '/openclaw/redirect-out') { res.writeHead(302, { location: 'https://attacker.invalid/steal' }); res.end(); return; }
    if (req.url === '/openclaw/redirect-in') { res.writeHead(302, { location: `http://127.0.0.1:${gateway.address().port}/openclaw/chat` }); res.end(); return; }
    if (req.url === '/openclaw/control-ui-config.json' && !req.headers.authorization) { res.writeHead(401); res.end('native auth required'); return; }
    const resource = httpResponses[req.url];
    if (resource) {
      res.writeHead(resource.status ?? 200, {
        'content-security-policy': "default-src 'self'; frame-ancestors 'none'; object-src 'none'",
        ...resource.headers,
      });
      res.end(resource.body ?? ''); return;
    }
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      res.writeHead(200, {
        'content-type': 'application/json',
        'content-security-policy': "default-src 'self'; frame-ancestors 'none'; object-src 'none'",
        'permissions-policy': 'camera=(self), microphone=(self)',
        'cache-control': 'public, max-age=9999',
        'set-cookie': ['nativeOne=1; HttpOnly; Secure; SameSite=Strict; Path=/openclaw', 'nativeTwo=2; HttpOnly; Secure; SameSite=Strict; Path=/openclaw'],
      });
      res.end(JSON.stringify({ path: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() }));
    });
  });
  gateway.on('connection', socket => { gatewaySockets.add(socket); socket.once('close', () => gatewaySockets.delete(socket)); socket.on('error', () => {}); });
  gateway.on('upgrade', (req, socket, head) => {
    upgraded.push({ path: req.url, headers: req.headers, head });
    if (req.headers['sec-websocket-protocol'] === 'stall') return;
    if (req.headers['sec-websocket-protocol'] === 'disconnect') { socket.destroy(); return; }
    const accept = req.headers['sec-websocket-protocol'] === 'bad-accept' ? 'wrong' : WS_ACCEPT;
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Accept: ${accept}\r\nContent-Security-Policy: frame-ancestors 'none'\r\nSet-Cookie: nativeWs=1; HttpOnly; Secure; Path=/openclaw\r\n\r\nserver-first`);
    socket.on('data', data => socket.write(data));
  });
  const gatewayPort = await listen(gateway);
  const proxy = createDashboardProxy({ baseUrl: `http://127.0.0.1:${gatewayPort}`, origin: ORIGIN, requestTimeoutMs: 250, ...options });
  const server = createServer((req, res) => {
    if (proxy.handleRequest(req, res)) return;
    res.writeHead(404); res.end('outside proxy');
  });
  server.on('upgrade', (req, socket, head) => {
    if (!proxy.handleUpgrade(req, socket, head)) socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  });
  const port = await listen(server);
  t.after(async () => {
    proxy.close();
    for (const socket of gatewaySockets) socket.destroy();
    server.closeAllConnections(); gateway.closeAllConnections();
    await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => gateway.close(resolve))]);
  });
  return { proxy, port, received, upgraded, gatewayPort, gatewaySockets, gateway };
}

test('configuration is explicit, private-upstream-only and fails closed without leaking values', () => {
  assert.equal(createDashboardProxy(), null);
  for (const options of [
    { baseUrl: 'http://gateway.internal:18789' },
    { origin: ORIGIN },
    { baseUrl: 'https://public.example.test', origin: ORIGIN },
    { baseUrl: 'http://user:secret@gateway.internal:18789', origin: ORIGIN },
    { baseUrl: 'http://gateway.internal:18789/v1', origin: ORIGIN },
    { baseUrl: 'http://gateway.internal:18789?target=elsewhere', origin: ORIGIN },
    { baseUrl: 'http://gateway.internal:18789', origin: 'https://dashboard.example.test/openclaw' },
    { baseUrl: 'http://gateway.internal:18789', origin: 'http://dashboard.example.test', allowLoopbackHttp: true },
    { baseUrl: 'http://gateway.internal:18789', origin: 'http://localhost:4188' },
  ]) assert.throws(() => createDashboardProxy(options), { message: 'Invalid native OpenClaw dashboard proxy configuration.' });
  const local = createDashboardProxy({ baseUrl: 'http://127.0.0.1:18789', origin: 'http://localhost:4188', allowLoopbackHttp: true });
  assert(local); local.close();
});

test('HTTP preserves /openclaw assets, SPA and exact native resources with native policies/cookies', async t => {
  const { port, received } = await fixture(t);
  for (const path of ['/openclaw', '/openclaw/', '/openclaw/chat/session-1', '/openclaw/nodes', '/openclaw/tools', '/openclaw/assets/index-123.js?v=abc', '/openclaw/.well-known/openclaw/browser-bootstrap', '/openclaw/avatar/croupier-director', '/openclaw/api/users/profile-1/avatar', '/openclaw/api/chat/media/outgoing/file-1', '/openclaw/__openclaw__/plugins/control-ui/plugin-id/index.js']) {
    const response = await get(port, path);
    assert.equal(response.status, 200, path);
    assert.equal(JSON.parse(response.body).path, path);
    assert.equal(received.at(-1).path, path);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['content-security-policy'], "default-src 'self'; frame-ancestors 'none'; object-src 'none'");
    assert.equal(response.headers['set-cookie'].length, 2);
    assert(response.headers['set-cookie'].every(c => c.includes('Path=/openclaw')));
  }
  const head = await get(port, '/openclaw/assets/index-123.js', {}, 'HEAD');
  assert.equal(head.status, 200); assert.equal(head.body, '');
});

test('activated Studio entry reaches the document and its same-origin native resource/auth/WS sequence', async t => {
  // Route-shape fixture for the pinned native UI; live rendering/pairing still
  // needs the deployed Director and actual Gateway. Do not invent an auth shim.
  const { port, received, upgraded } = await fixture(t, {
    gatewayKey: 'SERVER-GATEWAY-SECRET',
    httpResponses: {
      '/openclaw': { status: 302, headers: { location: '/openclaw/' } },
      '/openclaw/': { headers: { 'content-type': 'text/html' },
        body: '<!doctype html><title>OpenClaw Control</title><link rel="stylesheet" href="/openclaw/assets/index-native.css"><script type="module" src="/openclaw/assets/index-native.js"></script><openclaw-app></openclaw-app>' },
      '/openclaw/assets/index-native.css': { headers: { 'content-type': 'text/css' }, body: 'openclaw-app{display:block}' },
      '/openclaw/assets/index-native.js': { headers: { 'content-type': 'application/javascript' }, body: '/* isolated native-route fixture */' },
    },
  });
  const entry = new URL(openClawDashboardUrl()).pathname;
  assert.equal(entry, '/openclaw/');
  const redirected = await get(port, '/openclaw', ENTRY_NAVIGATION);
  assert.equal(redirected.status, 302); assert.equal(redirected.headers.location, entry);
  const page = await get(port, entry, ENTRY_NAVIGATION);
  assert.equal(page.status, 200); assert.equal(page.headers['content-type'], 'text/html');
  assert(page.body.includes('<openclaw-app>'));
  assert.equal(page.headers['content-security-policy'], "default-src 'self'; frame-ancestors 'none'; object-src 'none'");
  assert.equal(received.at(-1).headers.origin, undefined);
  assert.equal(received.at(-1).headers.authorization, undefined);
  const sameOrigin = { 'sec-fetch-site': 'same-origin' };
  for (const [path, mode, dest, type] of [
    ['/openclaw/assets/index-native.js', 'cors', 'script', 'application/javascript'],
    ['/openclaw/assets/index-native.css', 'no-cors', 'style', 'text/css'],
  ]) {
    assert(page.body.includes(path));
    const asset = await get(port, path, { ...sameOrigin, origin: ORIGIN, 'sec-fetch-mode': mode, 'sec-fetch-dest': dest });
    assert.equal(asset.status, 200, path); assert.equal(asset.headers['content-type'], type);
  }
  const nativeFetch = { ...sameOrigin, origin: ORIGIN, 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' };
  assert.equal((await get(port, '/openclaw/control-ui-config.json', nativeFetch)).status, 401);
  const caller = { ...nativeFetch, authorization: 'Bearer caller-device-token', 'x-openclaw-scopes': 'operator.read' };
  assert.equal((await get(port, '/openclaw/control-ui-config.json', caller)).status, 200);
  assert.equal((await get(port, '/openclaw/.well-known/openclaw/browser-bootstrap', caller)).status, 200);
  const tunnel = await upgrade(port, { headers: { ...caller, 'sec-fetch-mode': 'websocket' } });
  assert.equal(tunnel.status, 101);
  assert.equal(upgraded[0].headers.origin, ORIGIN);
  assert.equal(upgraded[0].headers.authorization, caller.authorization);
  assert.equal(upgraded[0].headers['x-openclaw-scopes'], 'operator.read');
  tunnel.socket.destroy();
  assert(!JSON.stringify({ received, upgraded }).includes('SERVER-GATEWAY-SECRET'));
});

test('same-site activated document navigation is limited to either exact dashboard entry', async t => {
  const { port } = await fixture(t);
  for (const path of ['/openclaw', '/openclaw/']) {
    assert.equal((await get(port, path, { ...ENTRY_NAVIGATION, 'sec-fetch-site': 'same-site' })).status, 200);
  }
});

test('entry navigation exception rejects fetch, iframe, automatic navigation, mutations and non-entry routes', async t => {
  const { port, received, upgraded } = await fixture(t);
  const cases = [
    ['/openclaw/', { 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' }],
    ['/openclaw/', { 'sec-fetch-mode': 'no-cors', 'sec-fetch-dest': 'empty' }],
    ['/openclaw/', { 'sec-fetch-dest': 'iframe' }],
    ['/openclaw/', { 'sec-fetch-dest': 'frame' }],
    ['/openclaw/', { 'sec-fetch-user': undefined }],
    ['/openclaw/', { 'sec-fetch-user': '?0' }],
    ['/openclaw/', { 'sec-fetch-mode': undefined }],
    ['/openclaw/', { 'sec-fetch-dest': undefined }],
    ['/openclaw/', { 'sec-fetch-site': 'invalid-site' }],
    ['/openclaw/', { 'sec-fetch-user': ['?1', '?1'] }],
    ['/openclaw/', { origin: 'https://studio.example.test' }],
    ['/openclaw/', { origin: ORIGIN }],
    ['/openclaw/', { origin: 'null' }],
    ['/openclaw/', { host: 'evil.test', 'x-forwarded-host': HOST }],
    ['/openclaw/', { authorization: ['Bearer first-caller', 'Bearer second-caller'] }],
    ['/openclaw/', { connection: 'x-openclaw-scopes', 'x-openclaw-scopes': 'operator.read' }],
    ['/openclaw/', {}, 'HEAD'],
    ['/openclaw/', {}, 'POST'],
    ['/openclaw/', {}, 'PUT'],
    ['/openclaw/assets/index-native.js', {}],
    ['/openclaw/chat/session-1', {}],
    ['/openclaw/control-ui-config.json', {}],
    ['/openclaw/.well-known/openclaw/browser-bootstrap', {}],
    ['/openclaw/api/users/profile-1/avatar', {}],
    ['/openclaw/__openclaw__/assistant-media', {}, 'POST'],
    ['/openclaw/?tab=chat', {}],
  ];
  for (const [path, overrides, method = 'GET'] of cases) {
    const headers = { ...ENTRY_NAVIGATION, ...overrides };
    for (const name of Object.keys(headers)) if (headers[name] === undefined) delete headers[name];
    assert.equal((await get(port, path, headers, method)).status, 403, `${method} ${path} ${JSON.stringify(overrides)}`);
  }
  assert.equal((await get(port, '/openclaw/', { ...ENTRY_NAVIGATION, 'content-length': '1' }, 'GET', 'x')).status, 400);
  assert.equal((await upgrade(port, { headers: ENTRY_NAVIGATION })).status, 403);
  assert.equal(received.length, 0); assert.equal(upgraded.length, 0);
});

test('native HTTP auth remains native and only caller credentials/scopes reach Gateway', async t => {
  const { port, received } = await fixture(t, { gatewayKey: 'SERVER-SECRET-MUST-NOT-APPEAR', password: 'SERVER-PASSWORD' });
  assert.equal((await get(port, '/openclaw/control-ui-config.json')).status, 401);
  assert.equal(received.at(-1).headers.authorization, undefined);
  const headers = {
    origin: ORIGIN, authorization: 'Bearer caller-device-token', cookie: 'nativeCaller=1', 'x-openclaw-scopes': 'operator.read',
    'x-forwarded-for': '127.0.0.1', 'x-forwarded-host': 'localhost', 'x-forwarded-proto': 'https', forwarded: 'for=127.0.0.1', 'x-real-ip': '127.0.0.1',
    'x-forwarded-user': 'admin', 'remote-user': 'admin', 'proxy-authorization': 'Bearer privileged', 'x-openclaw-client-ip': '127.0.0.1',
  };
  const response = await get(port, '/openclaw/control-ui-config.json', headers);
  assert.equal(response.status, 200);
  const actual = JSON.parse(response.body).headers;
  assert.equal(actual.authorization, 'Bearer caller-device-token');
  assert.equal(actual.cookie, 'nativeCaller=1');
  assert.equal(actual['x-openclaw-scopes'], 'operator.read');
  assert.equal(actual.origin, ORIGIN);
  assert.equal(actual.host, HOST);
  for (const name of ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'forwarded', 'x-real-ip', 'x-forwarded-user', 'remote-user', 'proxy-authorization', 'x-openclaw-client-ip']) assert.equal(actual[name], undefined, name);
  assert(!JSON.stringify(received).includes('SERVER-SECRET'));
  assert(!JSON.stringify(received).includes('SERVER-PASSWORD'));
});

test('foreign/ambiguous origins, host spoofing and proxy path/query escape never reach upstream', async t => {
  const { port, received } = await fixture(t);
  const cases = [
    ['/openclaw', { origin: 'https://evil.test' }, 403],
    ['/openclaw', { origin: 'null' }, 403],
    ['/openclaw', { origin: 'https://dashboard.example.test.evil.test' }, 403],
    ['/openclaw', { host: 'evil.test', 'x-forwarded-host': HOST }, 403],
    ['/openclaw', { 'sec-fetch-site': 'cross-site' }, 403],
    ['/openclaw', { 'sec-fetch-site': 'same-site' }, 403],
    ['/openclaw/../v1/chat/completions', {}, 400],
    ['/openclaw/%2e%2e/v1/chat/completions', {}, 400],
    ['/openclaw/%252e%252e/v1/chat/completions', {}, 400],
    ['/openclaw/%25252e%25252e/v1/chat/completions', {}, 400],
    ['/openclaw/%5c..%5cv1', {}, 400],
    ['/openclaw?upstream=http://127.0.0.1', {}, 400],
    ['/openclaw?gatewayUrl=wss://evil.test', {}, 400],
    ['/openclaw?redirect=https://evil.test', {}, 400],
    ['/openclaw', { connection: 'x-openclaw-scopes', 'x-openclaw-scopes': 'operator.read' }, 403],
    ['/v1/chat/completions', {}, 404],
    ['/openclaw/v1/chat/completions', {}, 404],
    ['/openclaw/tools/invoke', {}, 404],
    ['/openclaw/api/arbitrary-admin', {}, 404],
    ['/openclaw-evil', {}, 404],
  ];
  for (const [path, headers, status] of cases) assert.equal((await get(port, path, headers)).status, status, path);
  assert.equal(received.length, 0);
});

test('read-only surface rejects mutations except bounded same-origin native media permission request', async t => {
  const { port, received } = await fixture(t, { maxBodyBytes: 100 });
  for (const method of ['POST', 'PUT', 'DELETE']) assert.equal((await get(port, '/openclaw/control-ui-config.json', { origin: ORIGIN }, method)).status, 405);
  const path = '/openclaw/__openclaw__/assistant-media?source=selected-file&allow=1';
  assert.equal((await get(port, path, { 'content-type': 'application/json' }, 'POST', '{}')).status, 403);
  const headers = { origin: ORIGIN, authorization: 'Bearer caller-token', 'content-type': 'application/json' };
  const response = await get(port, path, headers, 'POST', '{"allow":true}');
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).body, '{"allow":true}');
  assert.equal(received.at(-1).headers.authorization, 'Bearer caller-token');
  assert.equal((await get(port, path, { ...headers, 'content-length': '101' }, 'POST', 'a'.repeat(101))).status, 413);
  assert.equal((await get(port, path, { ...headers, 'transfer-encoding': 'chunked' }, 'POST', 'a'.repeat(101))).status, 413);
});

test('upstream redirects remain within dashboard; disconnects and deadlines fail without details', async t => {
  const { port } = await fixture(t, { requestTimeoutMs: 50 });
  const safe = await get(port, '/openclaw/redirect-in');
  assert.equal(safe.status, 302); assert.equal(safe.headers.location, '/openclaw/chat');
  const outside = await get(port, '/openclaw/redirect-out');
  assert.equal(outside.status, 502); assert.equal(outside.headers.location, undefined); assert(!outside.body.includes('attacker'));
  assert.equal((await get(port, '/openclaw/disconnected')).status, 502);
  assert.equal((await get(port, '/openclaw/slow')).status, 504);
});

test('native WS keeps /openclaw and tunnels caller auth frames without injected credentials', async t => {
  const { port, upgraded } = await fixture(t, { gatewayKey: 'SERVER-GATEWAY-SECRET' });
  const result = await upgrade(port, { headers: { 'x-forwarded-for': '127.0.0.1', 'x-forwarded-user': 'admin' } });
  assert.equal(result.status, 101);
  assert.equal(upgraded[0].path, '/openclaw');
  assert.equal(upgraded[0].headers.origin, ORIGIN);
  assert.equal(upgraded[0].headers.authorization, undefined);
  assert.equal(upgraded[0].headers['x-forwarded-for'], undefined);
  assert.equal(upgraded[0].headers['x-forwarded-user'], undefined);
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.headers['content-security-policy'], "frame-ancestors 'none'");
  assert.equal(result.headers['set-cookie'].length, 1);
  const received = [result.head];
  result.socket.on('data', data => received.push(data));
  const frame = Buffer.from([0x81, 0x82, 0x01, 0x02, 0x03, 0x04, 0x6e, 0x69]);
  const echoed = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { result.socket.off('data', check); reject(new Error('WS bytes were not relayed')); }, 1500);
    function check() { if (Buffer.concat(received).includes(frame)) { clearTimeout(timer); result.socket.off('data', check); resolve(); } }
    result.socket.on('data', check);
  });
  result.socket.write(frame);
  await echoed;
  assert(Buffer.concat(received).includes(frame));
  assert(Buffer.concat(received).includes(Buffer.from('server-first')));
  assert(!JSON.stringify(upgraded).includes('SERVER-GATEWAY-SECRET'));
  result.socket.destroy();
});

test('WS requires exact origin, mounted root, real handshake and rejects failed upstreams', async t => {
  const { port, upgraded } = await fixture(t, { requestTimeoutMs: 50 });
  const cases = [
    [{ headers: { origin: '' } }, 403],
    [{ headers: { origin: 'https://evil.test' } }, 403],
    [{ path: '/openclaw/chat' }, 404],
    [{ path: '/openclaw/v1/chat/completions' }, 404],
    [{ path: '/v1/chat/completions' }, 404],
    [{ path: '/openclaw?token=not-a-ws-auth-mechanism' }, 404],
    [{ headers: { 'sec-websocket-version': '12' } }, 400],
    [{ headers: { 'sec-websocket-key': 'not-valid' } }, 400],
  ];
  for (const [options, status] of cases) assert.equal((await upgrade(port, options)).status, status);
  assert.equal(upgraded.length, 0);
  assert.equal((await upgrade(port, { headers: { 'sec-websocket-protocol': 'bad-accept' } })).status, 502);
  assert.equal((await upgrade(port, { headers: { 'sec-websocket-protocol': 'disconnect' } })).status, 502);
  assert.equal((await upgrade(port, { headers: { 'sec-websocket-protocol': 'stall' } })).status, 504);
});

test('connection budget and close tear down native tunnels and pending HTTP requests', async t => {
  const { proxy, port, gateway } = await fixture(t, { requestTimeoutMs: 1000, maxConnections: 2 });
  const tunnel = await upgrade(port);
  const slowReceived = once(gateway, 'request');
  const pending = get(port, '/openclaw/slow').then(() => 'unexpected-response', () => 'disconnected');
  // A third request is rejected while one HTTP request and one native WS own slots.
  await slowReceived;
  assert.equal((await get(port, '/openclaw/')).status, 503);
  const closed = once(tunnel.socket, 'close');
  proxy.close();
  await closed;
  assert.equal(await pending, 'disconnected');
  assert.equal((await get(port, '/openclaw/')).status, 503);
});
