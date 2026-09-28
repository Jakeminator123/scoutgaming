import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { childSpecifications, inspectCloudDisk, validateCloudConfig } from '../config.mjs';
import { createCloudGateway, proxyHeaders, upstreamForHost, upstreamForRequest } from '../gateway.mjs';
import { startChildren, terminateChild } from '../process-group.mjs';
import { assertCloudAccessReady } from '../start.mjs';

const fixture = () => ({
  NODE_ENV: 'production', PORT: '10000',
  CROUPIER_CLOUD_DATA_ROOT: join(tmpdir(), 'croupier-cloud-test-volume'),
  PUBLIC_URL: 'https://game.example.test', BO_URL: 'https://bo.example.test',
  LAB_PUBLIC_URL: 'https://lab.example.test',
  CROUPIER_GAME_ORIGIN: 'https://game.example.test',
  BETTALOTTO_PARTNER_BASE_URL: 'https://game.example.test',
  CROUPIER_STREAM_LANE: 'lissabon-stream-lane',
});
const LAB_SECRET = '0123456789abcdef'.repeat(4);

test('three exact public origins share one port and two loopback children', () => {
  const env = fixture();
  const config = validateCloudConfig(env);
  const specs = childSpecifications(config, { PATH: '/usr/bin', UNRELATED_SECRET: 'never-forward' }, { labInternalSecret: LAB_SECRET });
  assert.equal(upstreamForHost('game.example.test', config), 4173);
  assert.equal(upstreamForHost('bo.example.test', config), 4173);
  assert.equal(upstreamForHost('lab.example.test', config), 4188);
  assert.equal(upstreamForHost('evil.example.test', config), null);
  assert.equal(upstreamForHost('game.example.test:443', config), null);
  assert.equal(upstreamForHost('bo.example.test:443', config), null);
  assert.equal(config.boOrigin, 'https://bo.example.test');
  assert.equal(specs.web.env.HOST, '127.0.0.1');
  assert.equal(specs.web.env.PUBLIC_URL, config.gameOrigin);
  assert.equal(specs.web.env.BO_URL, config.boOrigin);
  assert.equal(specs.web.env.LAB_PUBLIC_URL, config.labOrigin);
  assert.equal(specs.lab.env.LAB_STUDIO_DATA_DIR, specs.web.env.CROUPIER_PRESENTATION_STUDIO_DIR);
  assert.equal(specs.web.env.CROUPIER_DATA_DIR, join(config.dataRoot, 'players'));
  assert.equal(specs.web.env.UNRELATED_SECRET, undefined);
  assert.equal(specs.lab.env.UNRELATED_SECRET, undefined);
  assert.equal(specs.web.env.DEMO_GUEST_ACCESS, '');
  assert.equal(specs.lab.env.LAB_PUBLIC_URL, config.labOrigin);
  assert.equal(specs.lab.env.CROUPIER_LAB_INTERNAL_SECRET, LAB_SECRET);
  assert.equal(specs.web.env.CROUPIER_LAB_INTERNAL_SECRET, undefined);
});

test('configuration rejects local or ambiguous exposure and conflicting storage', () => {
  for (const change of [
    { LAB_PUBLIC_URL: 'http://lab.example.test' },
    { LAB_PUBLIC_URL: 'https://game.example.test' },
    { LAB_PUBLIC_URL: 'https://bo.example.test' },
    { PUBLIC_URL: 'https://game.example.test:444' },
    { BO_URL: 'https://game.example.test' },
    { BO_URL: 'https://lab.example.test' },
    { BO_URL: 'http://bo.example.test' },
    { BO_URL: 'https://bo.example.test:443' },
    { BO_URL: 'https://bo.example.test/path' },
    { BO_URL: 'https://bo.example.test?next=/bo' },
    { CROUPIER_GAME_ORIGIN: 'https://other.example.test' },
    { PORT: '4173' },
    { DEMO_GUEST_ACCESS: '1' },
    { LAB_STUDIO_DATA_DIR: join(tmpdir(), 'unrelated-studio') },
    { CROUPIER_CLOUD_DATA_ROOT: '.' },
  ]) {
    assert.throws(() => validateCloudConfig({ ...fixture(), ...change }));
  }
});

test('disk preflight accepts its actual directory despite Windows path casing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-cloud-disk-'));
  try { await inspectCloudDisk(validateCloudConfig({ ...fixture(), CROUPIER_CLOUD_DATA_ROOT: directory })); }
  finally {
    assert.equal(dirname(resolve(directory)).toLowerCase(), resolve(tmpdir()).toLowerCase());
    assert.match(basename(directory), /^croupier-cloud-disk-/);
    await rm(directory, { recursive: true, force: true });
  }
});

test('game Host cannot reach BO routes except the exact public config GET', () => {
  const config = validateCloudConfig(fixture());
  const route = (method, url, headers = {}) => upstreamForRequest({
    method, url, headers: { host: 'game.example.test', ...headers },
  }, config);
  for (const url of ['/', '/v2/', '/api/table', '/api/auth/bo/start']) {
    assert.equal(route('GET', url), 4173, url);
  }
  assert.equal(route('GET', '/api/bo/config'), 4173);
  for (const [method, url] of [
    ['HEAD', '/api/bo/config'], ['POST', '/api/bo/config'],
    ['GET', '/api/bo/config?extra=1'], ['GET', '/api/bo/me'],
    ['GET', '/bo'], ['GET', '/bo/'], ['GET', '/bo/login.html'],
    ['POST', '/api/bo/login'], ['GET', '/api/auth/lab/check'],
    ['GET', '/%62o/login.html'], ['GET', '/bo%2flogin.html'],
    ['GET', '/x/../bo/login.html'], ['GET', '/BO/login.html'],
    ['GET', '/bo./login.html'], ['GET', '/%5cbo%5clogin.html'],
    ['GET', '//bo.example.test/bo/'], ['GET', 'https://bo.example.test/bo/'],
  ]) assert.equal(route(method, url), null, `${method} ${url}`);
  assert.equal(route('GET', '/bo/', { origin: config.boOrigin }), null,
    'a spoofed BO Origin cannot override the game Host');
});

test('BO Host serves BO routes only; Lab handoff routes reach Web but public check is closed', () => {
  const config = validateCloudConfig(fixture());
  const route = (host, method, url) => upstreamForRequest({ headers: { host }, method, url }, config);
  for (const url of ['/bo', '/bo/', '/bo/login.html', '/api/bo/config', '/api/bo/lab-login?state=abc']) {
    assert.equal(route('bo.example.test', 'GET', url), 4173, url);
  }
  for (const url of ['/', '/v2/', '/api/table', '/api/auth/lab/start', '/api/auth/lab/check']) {
    assert.equal(route('bo.example.test', 'GET', url), null, url);
  }
  assert.equal(route('lab.example.test', 'GET', '/'), 4188);
  assert.equal(route('lab.example.test', 'GET', '/_next/static/chunk.js'), 4188);
  assert.equal(route('lab.example.test', 'POST', '/api/project'), 4188);
  assert.equal(route('lab.example.test', 'GET', '/api/auth/lab/start'), 4173);
  assert.equal(route('lab.example.test', 'GET', '/api/auth/lab/callback?state=abc&code=def'), 4173);
  for (const url of ['/api/auth/lab/check', '/%61pi/auth/lab/check', '/%61pi/auth/lab/start']) {
    assert.equal(route('lab.example.test', 'GET', url), null, url);
  }
  assert.equal(route('evil.example.test', 'GET', '/api/bo/config'), null);
  assert.equal(route('game.example.test:443', 'GET', '/'), null);
});

test('proxy keeps the exact public Host and Origin but drops spoofed forwarding and Lab auth', () => {
  const incoming = { host: 'bo.example.test', origin: 'https://evil.example.test',
    forwarded: 'host=evil.example.test;proto=http',
    'x-forwarded-host': 'evil.example.test', 'x-forwarded-proto': 'http',
    'x-forwarded-for': '203.0.113.10', 'x-forwarded-uri': '/api/bo/me',
    'x-croupier-lab-authorized': 'fake-authorization',
    cookie: 'bo_jwt=browser-cookie', connection: 'keep-alive' };
  const headers = proxyHeaders(incoming, incoming.host);
  assert.equal(headers.host, 'bo.example.test');
  assert.equal(headers.origin, 'https://evil.example.test');
  assert.equal(headers.cookie, 'bo_jwt=browser-cookie');
  assert.equal(headers['x-forwarded-host'], 'bo.example.test');
  assert.equal(headers['x-forwarded-proto'], 'https');
  assert.equal(headers['x-forwarded-port'], '443');
  for (const name of ['forwarded', 'x-forwarded-for', 'x-forwarded-uri',
    'x-croupier-lab-authorized', 'connection']) assert.equal(headers[name], undefined, name);
  const config = validateCloudConfig(fixture());
  assert.equal(upstreamForRequest({ headers: { ...incoming, host: 'evil.example.test' },
    method: 'GET', url: '/bo/' }, config), null,
    'neither Origin nor X-Forwarded-Host can substitute for an allowed Host');
});

test('public gateway rejects misdirected requests before contacting a child', async () => {
  const gateway = createCloudGateway(validateCloudConfig(fixture()), { labInternalSecret: LAB_SECRET });
  await new Promise((resolve, reject) => {
    gateway.once('error', reject);
    gateway.listen(0, '127.0.0.1', resolve);
  });
  try {
    const status = (host, path, origin = 'https://bo.example.test') => new Promise((resolve, reject) => {
      const request = httpRequest({ hostname: '127.0.0.1', port: gateway.address().port,
        method: 'GET', path, headers: { Host: host, Origin: origin,
          'X-Forwarded-Host': 'bo.example.test' } }, response => {
        response.resume();
        response.on('end', () => resolve(response.statusCode));
      });
      request.on('error', reject);
      request.end();
    });
    assert.equal(await status('evil.example.test', '/bo/'), 421);
    assert.equal(await status('game.example.test', '/bo/'), 421);
    assert.equal(await status('lab.example.test', '/api/auth/lab/check'), 421);
    assert.equal(await status('evil.example.test', '/__cloud/health'), 421);
    assert.equal(await status('bo.example.test', '/__cloud/health'), 200);
  } finally {
    await new Promise((resolve, reject) => gateway.close(error => error ? reject(error) : resolve()));
  }
});

test('gateway checks every Lab request with Web before adding its private Lab header', async () => {
  const checks = [], labRequests = [], handoffs = [];
  const web = createServer((request, response) => {
    if (request.url === '/api/auth/lab/check') {
      checks.push({ host: request.headers.host, cookie: request.headers.cookie });
      response.writeHead(request.headers.cookie === 'lab_session=valid' ? 200
        : request.headers.cookie === 'lab_session=outage' ? 503 : 401);
    } else {
      handoffs.push({ host: request.headers.host, path: request.url,
        authorized: request.headers['x-croupier-lab-authorized'] });
      response.writeHead(200);
    }
    response.end();
  });
  const lab = createServer((request, response) => {
    labRequests.push({ host: request.headers.host,
      authorized: request.headers['x-croupier-lab-authorized'],
      forwardedHost: request.headers['x-forwarded-host'],
      forwardedProto: request.headers['x-forwarded-proto'] });
    response.writeHead(200);
    response.end();
  });
  web.listen(0, '127.0.0.1'); lab.listen(0, '127.0.0.1');
  await Promise.all([once(web, 'listening'), once(lab, 'listening')]);
  const gateway = createCloudGateway(validateCloudConfig(fixture()), {
    labInternalSecret: LAB_SECRET, webPort: web.address().port, labPort: lab.address().port,
  });
  gateway.listen(0, '127.0.0.1');
  await once(gateway, 'listening');
  const hit = (path, headers = {}) => new Promise((resolve, reject) => {
    const request = httpRequest({ hostname: '127.0.0.1', port: gateway.address().port,
      method: 'GET', path, headers: { Host: 'lab.example.test', ...headers } }, response => {
      response.resume();
      response.on('end', () => resolve({ status: response.statusCode,
        location: response.headers.location }));
    });
    request.on('error', reject);
    request.end();
  });
  try {
    assert.equal((await hit('/api/project')).status, 401);
    assert.equal((await hit('/api/project', {
      'X-Croupier-Lab-Authorized': LAB_SECRET, Cookie: 'lab_session=old',
    })).status, 401, 'browser-supplied internal header never authorizes Lab');
    const document = await hit('/lissabon', {
      'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document',
    });
    assert.equal(document.status, 303);
    assert.equal(document.location, '/api/auth/lab/start?next=%2Flissabon');
    assert.equal((await hit('/api/project', { Cookie: 'lab_session=outage' })).status, 503);
    assert.equal((await hit('/api/auth/lab/start')).status, 200);
    assert.equal((await hit('/api/project', { Cookie: 'lab_session=valid',
      'X-Croupier-Lab-Authorized': 'fake' })).status, 200);
    assert.equal(labRequests.length, 1);
    assert.deepEqual(labRequests[0], { host: 'lab.example.test', authorized: LAB_SECRET,
      forwardedHost: 'lab.example.test', forwardedProto: 'https' });
    assert.deepEqual(handoffs, [{ host: 'lab.example.test', path: '/api/auth/lab/start',
      authorized: undefined }]);
    assert.deepEqual(checks, [
      { host: 'lab.example.test', cookie: 'lab_session=old' },
      { host: 'lab.example.test', cookie: 'lab_session=outage' },
      { host: 'lab.example.test', cookie: 'lab_session=valid' },
    ]);
  } finally {
    await Promise.all([gateway, web, lab].map(server => new Promise(resolve => server.close(resolve))));
  }
});

test('only paired credentials reach the intended child and errors do not echo secret values', () => {
  const env = { ...fixture(), LAB_REMOTE_URL: 'https://director.example.test',
    LAB_REMOTE_TOKEN: 'private-director-token',
    OPENCLAW_PRODUCT_SPEECH_URL: 'https://speech.example.test',
    OPENCLAW_PRODUCT_SPEECH_TOKEN: 'private-speech-token' };
  const specs = childSpecifications(validateCloudConfig(env), env, { labInternalSecret: LAB_SECRET });
  assert.equal(specs.lab.env.LAB_REMOTE_TOKEN, 'private-director-token');
  assert.equal(specs.web.env.LAB_REMOTE_TOKEN, undefined);
  assert.equal(specs.web.env.OPENCLAW_PRODUCT_SPEECH_TOKEN, 'private-speech-token');
  assert.equal(specs.lab.env.OPENCLAW_PRODUCT_SPEECH_TOKEN, undefined);
  assert.throws(() => validateCloudConfig({ ...env, LAB_REMOTE_URL: 'https://private-director-token@director.example.test' }),
    error => !error.message.includes('private-director-token'));
  assert.throws(() => validateCloudConfig({ ...env, LAB_REMOTE_TOKEN: '' }),
    error => !error.message.includes('private-director-token'));
});

test('deployment environment cannot enable the access gate', () => {
  process.env.CROUPIER_CLOUD_AUTH_READY = '1';
  try { assert.throws(() => assertCloudAccessReady(), /Cloud start blocked/); }
  finally { delete process.env.CROUPIER_CLOUD_AUTH_READY; }
});

test('child shutdown sends TERM once and waits for close', async () => {
  class FakeChild extends EventEmitter {
    pid = 123;
    exitCode = null;
    signalCode = null;
    signals = [];
    kill(signal) {
      this.signals.push(signal);
      queueMicrotask(() => { this.signalCode = signal; this.emit('close', 0, signal); });
      return true;
    }
  }
  const child = new FakeChild();
  await terminateChild(child, 50);
  await terminateChild(child, 50);
  assert.deepEqual(child.signals, ['SIGTERM']);
});

test('process group starts Web then Lab and stops Lab then Web without real servers', async () => {
  const activity = [];
  class FakeChild extends EventEmitter {
    pid = 123;
    exitCode = null;
    signalCode = null;
    constructor(name) { super(); this.name = name; }
    kill(signal) {
      activity.push(`stop:${this.name}:${signal}`);
      queueMicrotask(() => { this.signalCode = signal; this.emit('close', 0, signal); });
      return true;
    }
  }
  const specs = childSpecifications(validateCloudConfig(fixture()), fixture(), { labInternalSecret: LAB_SECRET });
  const group = await startChildren(specs, {
    spawnProcess: (_command, _args, options) => {
      const name = options.cwd.endsWith('lab') ? 'lab' : 'web';
      activity.push(`start:${name}`);
      return new FakeChild(name);
    },
    wait: async () => {},
    portCheck: async () => {},
  });
  await group.stop();
  assert.deepEqual(activity, ['start:web', 'start:lab', 'stop:lab:SIGTERM', 'stop:web:SIGTERM']);
});
