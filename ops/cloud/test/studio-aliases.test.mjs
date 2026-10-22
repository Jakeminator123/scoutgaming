import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { test } from 'node:test';
import { createCloudGateway, studioAliasRedirect, upstreamForRequest } from '../gateway.mjs';

const origin = 'https://croupier-fixture.onrender.com';
const host = new URL(origin).host;
const config = { gameOrigin: origin, boOrigin: origin, labOrigin: origin, singleOrigin: true };
const incoming = (url, method = 'GET', selectedHost = host) => ({ url, method, headers: { host: selectedHost } });
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = server => new Promise(resolve => server.close(resolve));

test('old Studio bookmarks preserve queries on a single canonical document route', () => {
  for (const alias of ['/lab', '/studio-astrid', '/studio-lissabon']) {
    for (const method of ['GET', 'HEAD']) {
      assert.equal(studioAliasRedirect(incoming(alias, method), config), '/control');
      assert.equal(studioAliasRedirect(incoming(`${alias}/?family=deal_pos1&next=%2Fbo%2F`, method), config), '/control?family=deal_pos1&next=%2Fbo%2F');
    }
  }
});

test('Studio aliases cannot create an API mount, replay writes, or change host boundaries', () => {
  for (const url of ['/lab/api/project', '/studio-astrid/api/project', '/studio-lissabon/zones',
    '/studio', '/bo', '/api/auth/lab/check', '/%6cab', '/LAB', '/lab//', '/lab/../studio',
    '//external.test/lab', '/lab#fragment', '/lab?x=\r\nLocation: https://external.test', '/lab\\']) {
    assert.equal(studioAliasRedirect(incoming(url), config), null, url);
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) assert.equal(studioAliasRedirect(incoming('/lab', method), config), null, method);
  assert.equal(studioAliasRedirect(incoming('/lab', 'GET', 'other.example.test'), config), null);
  assert.equal(studioAliasRedirect(incoming('/lab'), { ...config, singleOrigin: false }), null);
  assert.equal(upstreamForRequest(incoming('/studio/api/project'), config), 4188);
  assert.equal(upstreamForRequest(incoming('/api/auth/lab/check'), config), null);
});

test('following a Studio alias still requires the normal Lab session and never reaches an unauthorized upstream', async () => {
  let upstreamCalls = 0;
  let sessionChecks = 0;
  let authorized = false;
  const lab = createServer((req, res) => {
    upstreamCalls++;
    assert.equal(req.headers['x-croupier-lab-authorized'], 's'.repeat(64));
    res.writeHead(200); res.end('studio');
  });
  const labPort = await listen(lab);
  const gateway = createCloudGateway(config, { labInternalSecret: 's'.repeat(64), labPort,
    sessionCheck: async () => { sessionChecks++; return { available: true, authorized }; } });
  let gatewayPort;
  const read = (url, navigate = false) => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: gatewayPort, path: url,
      headers: { host, ...(navigate ? { 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' } : {}) } }, response => {
      response.resume(); response.on('end', () => resolve({ status: response.statusCode, headers: response.headers }));
    });
    req.on('error', reject); req.end();
  });
  try {
    gatewayPort = await listen(gateway);
    const alias = await read('/studio-lissabon?view=clips', true);
    assert.equal(alias.status, 307);
    assert.equal(alias.headers.location, '/control?view=clips');
    assert.equal(sessionChecks, 0);
    const studioDocument = '/studio?view=clips';
    const protectedPage = await read(studioDocument, true);
    assert.equal(protectedPage.status, 303);
    assert.equal(protectedPage.headers.location, '/api/auth/lab/start?next=%2Fstudio%3Fview%3Dclips');
    assert.equal((await read('/studio/api/project')).status, 401);
    assert.equal(upstreamCalls, 0);
    authorized = true;
    assert.equal((await read(studioDocument, true)).status, 200);
    assert.equal(upstreamCalls, 1);
  } finally { await close(gateway); await close(lab); }
});

test('without a Lab child every /studio request is misdirected before any session check; aliases and Web-owned Lab auth remain', async () => {
  const gameOnly = { ...config, labChild: false };
  for (const url of ['/studio', '/studio/', '/studio/administration', '/studio/api/project', '/studio/_next/static/chunk.js']) {
    assert.equal(upstreamForRequest(incoming(url), gameOnly), null, url);
    assert.equal(upstreamForRequest(incoming(url), config), 4188, url);
  }
  for (const url of ['/', '/api/table', '/api/auth/lab/start?next=%2Fstudio', '/api/bo/lab-login?state=abc', '/api/auth/lab/callback']) {
    assert.equal(upstreamForRequest(incoming(url), gameOnly), 4173, url);
  }
  assert.equal(upstreamForRequest(incoming('/api/auth/lab/check'), gameOnly), null);
  assert.equal(studioAliasRedirect(incoming('/lab?view=clips'), gameOnly), '/control?view=clips');
  let sessionChecks = 0, labCalls = 0, webCalls = 0;
  const lab = createServer((_req, res) => { labCalls++; res.writeHead(200); res.end(); });
  const web = createServer((_req, res) => { webCalls++; res.writeHead(401); res.end(); });
  const [labPort, webPort] = [await listen(lab), await listen(web)];
  const gateway = createCloudGateway(gameOnly, { labInternalSecret: 's'.repeat(64), labPort, webPort,
    sessionCheck: async () => { sessionChecks++; return { available: true, authorized: true }; } });
  const gatewayPort = await listen(gateway);
  const read = url => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: gatewayPort, path: url,
      headers: { host, 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' } }, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode));
    });
    req.on('error', reject); req.end();
  });
  try {
    for (const url of ['/studio', '/studio/api/project', '/studio/_next/static/chunk.js']) assert.equal(await read(url), 421, url);
    assert.equal(sessionChecks, 0); assert.equal(labCalls, 0); assert.equal(webCalls, 0);
    assert.equal(await read('/api/auth/lab/start?next=%2Fstudio'), 401);
    assert.equal(webCalls, 1); assert.equal(labCalls, 0);
  } finally { await close(gateway); await close(lab); await close(web); }
});
