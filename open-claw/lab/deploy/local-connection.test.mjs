import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile, symlink } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  childSpecifications, installConnectionProcessGuard, loadPrivateConnection,
  parseCli, probeConnections, startIsolatedConnection,
} from './local-connection.mjs';
import { acquireLocalSession } from './local-session.mjs';
import { readSettings } from '../src/settings.mjs';
import { speechRoutingConfiguration } from '../../../packages/director/speech-routing.mjs';

async function freePort() {
  const server = createNetServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function httpFixture(t, handler) {
  const server = createHttpServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}

async function privateFixture(t, values) {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-openclaw-env-test-'));
  const path = join(directory, '.env.private-test');
  await writeFile(path, Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return path;
}

async function runtimeFixture(t) {
  const repoRoot = await mkdtemp(join(tmpdir(), 'croupier-connection-repo-test-'));
  const source = fileURLToPath(new URL('../../../', import.meta.url));
  for (const directory of ['web', 'lab']) await symlink(join(source, directory), join(repoRoot, directory), process.platform === 'win32' ? 'junction' : 'dir');
  t.after(() => rm(repoRoot, { recursive: true, force: true }));
  return repoRoot;
}

test('corrected OpenClaw key works in settings and private connections, with legacy compatibility and explicit disabling', async t => {
  for (const env of [
    { OPENCLAW_API_KEY: 'fixture-canonical' },
    { OPENCLAWAPI_KEY: 'fixture-legacy' },
    { OPENCLAW_API_KEY: 'fixture-canonical', OPENCLAWAPI_KEY: 'fixture-legacy' },
    { OPENCLAW_API_KEY: '', OPENCLAWAPI_KEY: 'fixture-legacy' },
  ]) {
    const expected = env.OPENCLAW_API_KEY ?? env.OPENCLAWAPI_KEY;
    assert.equal(readSettings({ env, envFiles: [] }).gatewayKey, expected);
    const { configuration } = loadPrivateConnection({ env, envFiles: [] });
    assert.equal(configuration.gatewayKey, expected);
  }
  const file = await privateFixture(t, { OPENCLAW_API_KEY: 'fixture-file' });
  assert.equal(readSettings({ env: {}, envFiles: [file] }).gatewayKey, 'fixture-file');
  assert.equal(loadPrivateConnection({ env: {}, envFiles: [file] }).configuration.gatewayKey, 'fixture-file');
  for (const env of [{ OPENCLAWAPI_KEY: 'fixture-process' }, { OPENCLAWAPI_KEY: '' }]) {
    assert.equal(readSettings({ env, envFiles: [file] }).gatewayKey, env.OPENCLAWAPI_KEY);
    assert.equal(loadPrivateConnection({ env, envFiles: [file] }).configuration.gatewayKey, env.OPENCLAWAPI_KEY);
  }
  const later = await privateFixture(t, { OPENCLAWAPI_KEY: 'fixture-later-file' });
  assert.equal(readSettings({ env: {}, envFiles: [file, later] }).gatewayKey, 'fixture-later-file');
  assert.equal(loadPrivateConnection({ env: {}, envFiles: [file, later] }).configuration.gatewayKey, 'fixture-later-file');
  const { configuration } = loadPrivateConnection({ envFiles: [], env: {
    OPENCLAW_BASE_URL: 'http://127.0.0.1:18789', OPENCLAW_API_KEY: 'fixture-private',
    OPENCLAW_PRODUCT_SPEECH_URL: 'https://speech.example.test', OPENCLAW_PRODUCT_SPEECH_TOKEN: 'fixture-relay',
  } });
  const specs = childSpecifications(configuration, join(tmpdir(), 'croupier-canonical-key-fixture'));
  for (const role of ['product', 'lab']) {
    assert.equal(specs[role].env.OPENCLAW_API_KEY, '');
    assert.equal(specs[role].env.OPENCLAWAPI_KEY, '');
    assert.equal(readSettings({ env: specs[role].env, envFiles: [file] }).gatewayKey, '');
  }
});

test('private configuration reports the dedicated speech role without exposing credential values', async t => {
  const gatewaySecret = 'fixture-gateway-secret-do-not-print';
  const providerSecret = 'fixture-provider-secret-do-not-print';
  const directorSecret = 'fixture-director-secret-do-not-print';
  const file = await privateFixture(t, {
    OPENCLAW_BASE_URL: 'http://127.0.0.1:18789', OPENCLAWAPI_KEY: gatewaySecret,
    OPENCLAW_MODEL_API_KEY: providerSecret, LAB_REMOTE_URL: 'https://director.example.test', LAB_REMOTE_TOKEN: directorSecret,
  });
  const { configuration, report } = loadPrivateConnection({ envFiles: [file], env: {} });
  assert.equal(report.productGateway.configured, true);
  assert.equal(report.labDirector.configured, true);
  assert.equal(report.credentials.gatewayAndModelDistinct, true);
  assert.equal(report.credentials.modelProviderForwardedToLocalChildren, false);
  assert.equal(report.productGateway.role.status, 'expected');
  assert.equal(configuration.modelKey, undefined);
  assert.ok(!JSON.stringify(configuration).includes(gatewaySecret));
  assert.ok(!JSON.stringify(configuration).includes(directorSecret));
  const serialized = JSON.stringify(report);
  for (const secret of [gatewaySecret, providerSecret, directorSecret]) assert.ok(!serialized.includes(secret));
});

test('private connection permits a Gateway-alias speech token while relay mode still withholds Gateway access', async t => {
  const aliased = 'fixture-user-selected-shared-token';
  const file = await privateFixture(t, {
    LAB_REMOTE_URL: 'https://director.example.test', LAB_REMOTE_TOKEN: 'fixture-lab-remote',
    OPENCLAW_BASE_URL: 'https://gateway.example.test', OPENCLAWAPI_KEY: aliased,
    OPENCLAW_PRODUCT_SPEECH_URL: 'https://director.example.test', OPENCLAW_PRODUCT_SPEECH_TOKEN: aliased,
  });
  const { configuration } = loadPrivateConnection({ envFiles: [file], env: {} });
  const directory = await mkdtemp(join(tmpdir(), 'croupier-openclaw-alias-spec-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const specs = childSpecifications(configuration, directory, { productPort: 4196, labPort: 4197 });
  assert.equal(specs.product.env.OPENCLAW_PRODUCT_SPEECH_TOKEN, aliased);
  assert.equal(specs.product.env.OPENCLAWAPI_KEY, '');
  assert.equal(specs.product.env.OPENCLAW_BASE_URL, '');
});

test('explicit speech timeout reaches only the product contract through the private env whitelist', async t => {
  const file = await privateFixture(t, { OPENCLAW_TIMEOUT_MS: '8000', OPENCLAW_SPEECH_TIMEOUT_MS: '20000',
    OPENCLAW_SPEECH_ROUTING: 'adaptive', OPENCLAW_SPEECH_DEEP_MODEL: 'gpt-6-sol' });
  for (const relay of [true, false]) {
    const env = relay
      ? { OPENCLAW_PRODUCT_SPEECH_URL: 'https://director.example.test', OPENCLAW_PRODUCT_SPEECH_TOKEN: 'fixture-speech-only' }
      : { OPENCLAW_BASE_URL: 'http://127.0.0.1:18789', OPENCLAWAPI_KEY: 'fixture-gateway-only' };
    const { configuration } = loadPrivateConnection({ envFiles: [file], env });
    assert.equal(configuration.timeoutMs, 8000); assert.equal(configuration.speechTimeoutMs, 20000);
    const specs = childSpecifications(configuration, join(tmpdir(), 'croupier-speech-timeout-fixture'));
    assert.equal(specs.product.env.OPENCLAW_SPEECH_TIMEOUT_MS, '20000');
    assert.equal(specs.lab.env.OPENCLAW_SPEECH_TIMEOUT_MS, undefined);
    for (const child of [specs.product, specs.lab]) {
      assert.equal(child.env.OPENCLAW_TIMEOUT_MS, '8000');
      assert.equal(child.env.OPENCLAW_SPEECH_ROUTING, undefined);
      assert.equal(child.env.OPENCLAW_SPEECH_DEEP_MODEL, undefined);
      assert.equal(readSettings({ env: child.env, envFiles: [] }).speechRouting, 'fixed');
    }
    const settings = readSettings({ env: specs.product.env, envFiles: [] });
    assert.equal(speechRoutingConfiguration(settings, 'astrid').timeoutMs, 20000);
    assert.equal(settings.adviceTimeoutMs, 8000);
  }
  assert.equal(loadPrivateConnection({ envFiles: [file], env: { OPENCLAW_SPEECH_TIMEOUT_MS: '1000' } }).configuration.speechTimeoutMs, 1000);
});

test('speech timeout is optional and rejects invalid explicit values before any child starts', () => {
  for (const value of ['', ' ', 'NaN', 'Infinity', '-1', '999', '30001', '1000.5']) {
    assert.throws(() => loadPrivateConnection({ envFiles: [], env: { OPENCLAW_SPEECH_TIMEOUT_MS: value } }), /OPENCLAW_SPEECH_TIMEOUT_MS must be an integer between 1000 and 30000/);
  }
  for (const value of ['1000', '30000']) {
    assert.equal(loadPrivateConnection({ envFiles: [], env: { OPENCLAW_SPEECH_TIMEOUT_MS: value } }).configuration.speechTimeoutMs, Number(value));
  }
  for (const generic of [undefined, '50', '9000']) {
    const { configuration } = loadPrivateConnection({ envFiles: [], env: generic ? { OPENCLAW_TIMEOUT_MS: generic } : {} });
    assert.equal(configuration.speechTimeoutMs, undefined);
    const specs = childSpecifications(configuration, join(tmpdir(), 'croupier-speech-timeout-default-fixture'));
    assert.equal(specs.product.env.OPENCLAW_SPEECH_TIMEOUT_MS, undefined);
    const settings = readSettings({ env: specs.product.env, envFiles: [] });
    assert.equal(speechRoutingConfiguration(settings, 'astrid').timeoutMs, Number(generic ?? 8000));
  }
});

test('child environments separate credentials, empty provider settings and use disposable data paths', async t => {
  const file = await privateFixture(t, {
    OPENCLAW_BASE_URL: 'http://127.0.0.1:18789', OPENCLAWAPI_KEY: 'fixture-gateway-only',
    OPENCLAW_MODEL_API_KEY: 'fixture-provider-only', LAB_REMOTE_URL: 'https://director.example.test', LAB_REMOTE_TOKEN: 'fixture-director-only',
  });
  const { configuration } = loadPrivateConnection({ envFiles: [file], env: {} });
  const directory = await mkdtemp(join(tmpdir(), 'croupier-openclaw-spec-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const specs = childSpecifications(configuration, directory, { productPort: 4196, labPort: 4197 });
  assert.equal(specs.product.env.HOST, '127.0.0.1'); assert.equal(specs.lab.env.HOST, '127.0.0.1');
  assert.deepEqual(specs.urls, { product: 'http://127.0.0.1:4196', lab: 'http://127.0.0.1:4197' });
  assert.equal(specs.product.env.PUBLIC_URL, specs.urls.product);
  assert.equal(specs.product.env.BO_URL, specs.urls.product);
  assert.equal(specs.product.env.CROUPIER_DATA_DIR, join(directory, 'product'));
  assert.equal(specs.product.env.CROUPIER_GENERATIONS_DIR, undefined);
  assert.equal(specs.product.env.CROUPIER_PRESENTATION_STUDIO_DIR, undefined);
  assert.equal(specs.lab.env.LAB_STUDIO_DATA_DIR, undefined);
  assert.equal(specs.lab.cwd, join(configuration.repoRoot, 'lab'));
  assert.match(specs.lab.args.join(' '), /next.* start .*--port 4197/);
  assert.equal(specs.product.env.OPENCLAW_API_KEY, 'fixture-gateway-only');
  assert.equal(specs.product.env.OPENCLAWAPI_KEY, '');
  assert.equal(readSettings({ env: specs.product.env, envFiles: [file] }).gatewayKey, 'fixture-gateway-only');
  assert.equal(specs.product.env.OPENCLAW_SPEECH_AGENT, 'openclaw/croupier-speech');
  assert.equal(specs.product.env.OPENCLAW_CHAT_AGENT, 'openclaw/croupier-chat');
  assert.equal(specs.product.env.LAB_REMOTE_TOKEN, '');
  assert.equal(specs.lab.env.OPENCLAWAPI_KEY, '');
  assert.equal(specs.lab.env.OPENCLAW_API_KEY, '');
  assert.equal(readSettings({ env: specs.lab.env, envFiles: [file] }).gatewayKey, '');
  assert.equal(specs.lab.env.LAB_REMOTE_TOKEN, 'fixture-director-only');
  for (const spec of [specs.product, specs.lab]) {
    assert.equal(spec.env.OPENCLAW_MODEL_API_KEY, '');
    assert.equal(spec.env.OPENCLAW_MODEL_BASE_URL, '');
    const commandLine = JSON.stringify([spec.command, ...spec.args]);
    for (const secret of ['fixture-gateway-only', 'fixture-provider-only', 'fixture-director-only']) assert.ok(!commandLine.includes(secret));
  }
});

test('Lissabon can share its saved project while keeping QA players and browser cookies separate', () => {
  const { configuration } = loadPrivateConnection({ envFiles: [], env: {} });
  const studioDataDir = join(tmpdir(), 'croupier-shared-studio-fixture');
  const playerDataDir = join(tmpdir(), 'croupier-qa-players-fixture');
  const normal = childSpecifications(configuration, join(tmpdir(), 'croupier-normal-run-fixture'), {
    studioDataDir, streamLane: 'lissabon-stream-lane', productPort: 4200, labPort: 4201,
  });
  const qa = childSpecifications(configuration, join(tmpdir(), 'croupier-qa-run-fixture'), {
    studioDataDir, playerDataDir, streamLane: 'lissabon-stream-lane', productPort: 4210, labPort: 4211,
    browserHostname: 'localhost', labDistDir: '.next-probe',
  });
  for (const specs of [normal, qa]) {
    assert.equal(specs.product.env.CROUPIER_PRESENTATION_STUDIO_DIR, undefined);
    assert.equal(specs.lab.env.LAB_STUDIO_DATA_DIR, undefined);
    assert.equal(specs.lab.dataDir, studioDataDir);
    assert.equal(specs.product.env.CROUPIER_LISSABON_PROFILES, '1');
    assert.equal(specs.product.env.HOST, '127.0.0.1');
    assert.equal(specs.lab.env.HOST, '127.0.0.1');
    assert.equal(specs.lab.args[specs.lab.args.indexOf('--hostname') + 1], '127.0.0.1');
    assert.equal(specs.product.env.PUBLIC_URL, specs.urls.product);
    assert.equal(specs.product.env.BO_URL, specs.urls.product);
  }
  assert.equal(normal.product.dataDir, join(studioDataDir, 'players'));
  assert.equal(normal.product.env.CROUPIER_DATA_DIR, join(studioDataDir, 'players'));
  assert.equal(qa.product.dataDir, playerDataDir);
  assert.equal(qa.product.env.CROUPIER_DATA_DIR, playerDataDir);
  assert.deepEqual(normal.urls, { product: 'http://127.0.0.1:4200', lab: 'http://127.0.0.1:4201' });
  assert.deepEqual(qa.urls, { product: 'http://localhost:4210', lab: 'http://localhost:4211' });
  assert.equal(qa.lab.env.CROUPIER_LAB_DIST_DIR, '.next-probe');
});

test('launcher validates browser hostname and separate player storage before starting anything', async () => {
  const { configuration } = loadPrivateConnection({ envFiles: [], env: {} });
  const runDir = join(tmpdir(), 'croupier-layout-validation-fixture');
  const studioDataDir = join(runDir, 'studio'), playerDataDir = join(runDir, 'players');
  const invalid = [
    ...['', null, '0.0.0.0', '192.168.1.2', 'http://localhost', 'localhost:4210', 'localhost.evil.invalid'].map(browserHostname => ({
      options: { browserHostname }, error: /browserHostname must be localhost or 127\.0\.0\.1/,
    })),
    ...[
      { playerDataDir },
      { playerDataDir, studioDataDir },
      { playerDataDir, streamLane: 'lissabon-stream-lane' },
      { playerDataDir, studioDataDir, streamLane: 'another-lane' },
    ].map(options => ({ options, error: /playerDataDir requires a Lissabon stream lane with studioDataDir/ })),
    ...['', ' ', null, 123].map(playerDataDir => ({
      options: { playerDataDir, studioDataDir, streamLane: 'lissabon-stream-lane' }, error: /non-empty directory path/,
    })),
  ];
  for (const { options, error } of invalid) {
    assert.throws(() => childSpecifications(configuration, runDir, options), error);
    await assert.rejects(startIsolatedConnection({ ...options, envFiles: [], env: {} }), error);
  }
});

test('isolated product keeps speech and presentation credentials separate without Gateway access', async t => {
  const productSpeechSecret = 'fixture-product-speech-only';
  const file = await privateFixture(t, {
    OPENCLAW_BASE_URL: 'https://gateway.example.test', OPENCLAWAPI_KEY: 'fixture-full-gateway-must-not-forward',
    OPENCLAW_PRODUCT_SPEECH_URL: 'https://director.example.test', OPENCLAW_PRODUCT_SPEECH_TOKEN: productSpeechSecret,
    OPENCLAW_SPEECH_AGENT: 'openclaw/croupier-speech', LAB_REMOTE_URL: 'https://director.example.test',
    LAB_REMOTE_TOKEN: 'fixture-lab-director-only',
  });
  const { configuration, report } = loadPrivateConnection({ envFiles: [file], env: {} });
  assert.equal(report.productGateway.configured, true);
  assert.equal(report.productSpeechRelay.configured, true);
  assert.equal(report.productSpeechRelay.role.status, 'expected');
  assert.equal(JSON.stringify(report).includes(productSpeechSecret), false);
  const directory = await mkdtemp(join(tmpdir(), 'croupier-openclaw-relay-spec-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const specs = childSpecifications(configuration, directory, { productPort: 4196, labPort: 4197 });
  assert.equal(specs.product.env.OPENCLAW_PRODUCT_SPEECH_URL, 'https://director.example.test');
  assert.equal(specs.product.env.OPENCLAW_PRODUCT_SPEECH_TOKEN, productSpeechSecret);
  assert.equal(specs.product.env.CROUPIER_PRESENTATION_DIRECTOR_TOKEN, 'fixture-lab-director-only');
  assert.equal(specs.product.env.CROUPIER_PRESENTATION_STUDIO_DIR, undefined);
  assert.equal(specs.lab.env.LAB_STUDIO_DATA_DIR, undefined);
  assert.equal(specs.product.env.OPENCLAWAPI_KEY, '');
  assert.equal(specs.product.env.OPENCLAW_BASE_URL, '');
  assert.deepEqual(JSON.parse(specs.product.env.CROUPIER_CONNECTION_ALLOWED_ORIGINS), ['https://director.example.test']);
  assert.equal(specs.lab.env.OPENCLAW_PRODUCT_SPEECH_TOKEN, '');
  assert.equal(specs.lab.env.OPENCLAWAPI_KEY, '');
  assert.equal(specs.lab.env.OPENCLAW_BASE_URL, '');
  assert.equal(JSON.stringify([specs.product.command, ...specs.product.args]).includes(productSpeechSecret), false);
  const probed = [];
  await probeConnections(configuration, { fetchImpl: async input => {
    const url = new URL(input); probed.push(url.pathname);
    return new Response(JSON.stringify(url.pathname === '/healthz' ? { ok: true } : { provider: { configured: true } }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } });
  assert.deepEqual(probed, ['/healthz', '/api/status']);
});

test('launcher refuses a partial speech relay instead of falling back with mixed credentials', async t => {
  const file = await privateFixture(t, {
    OPENCLAW_BASE_URL: 'https://gateway.example.test', OPENCLAWAPI_KEY: 'fixture-full-gateway',
    OPENCLAW_PRODUCT_SPEECH_URL: 'https://director.example.test',
    LAB_REMOTE_URL: 'https://director.example.test', LAB_REMOTE_TOKEN: 'fixture-lab-director',
  });
  const productPort = await freePort(), labPort = await freePort();
  await assert.rejects(startIsolatedConnection({ repoRoot: dirname(file), envFiles: [file], env: {}, productPort, labPort }), /must be configured together/);
});

test('read-only probes distinguish configured, reachable and model-not-run states', async t => {
  const gatewaySecret = 'fixture-gateway-probe';
  const directorSecret = 'fixture-director-probe';
  const gateway = await httpFixture(t, (request, response) => {
    assert.equal(request.headers.authorization, `Bearer ${gatewaySecret}`);
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ data: [{ id: 'openclaw/croupier-speech' }] }));
  });
  const director = await httpFixture(t, (request, response) => {
    if (request.url === '/api/status') assert.equal(request.headers.authorization, `Bearer ${directorSecret}`);
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(request.url === '/healthz' ? { ok: true } : { provider: { configured: true } }));
  });
  const file = await privateFixture(t, { OPENCLAW_BASE_URL: gateway, OPENCLAWAPI_KEY: gatewaySecret,
    LAB_REMOTE_URL: director, LAB_REMOTE_TOKEN: directorSecret });
  const { configuration } = loadPrivateConnection({ envFiles: [file], env: {} });
  const result = await probeConnections(configuration);
  assert.deepEqual(result.productGateway, { configured: true, reachable: true, functionalModelProbe: 'not_run', httpStatus: 200, agentListed: true });
  assert.deepEqual(result.labDirector, { configured: true, reachable: true, authenticatedApi: true, functionalModelProbe: 'not_run', healthStatus: 200, apiStatus: 200 });
  assert.ok(!JSON.stringify(result).includes(gatewaySecret));
  assert.ok(!JSON.stringify(result).includes(directorSecret));
});

test('launcher starts isolated native and the real Next Eventstudio without reviving disk-backed Studio state', async t => {
  const gatewaySecret = 'fixture-gateway-launch';
  const directorSecret = 'fixture-director-launch';
  const gateway = await httpFixture(t, (_request, response) => { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end('{"data":[]}'); });
  const director = await httpFixture(t, (request, response) => {
    if (request.url === '/api/status') assert.equal(request.headers.authorization, `Bearer ${directorSecret}`);
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(request.url === '/healthz' ? { ok: true } : { service: 'fixture-director', provider: { configured: true }, remote: { configured: false } }));
  });
  const file = await privateFixture(t, { OPENCLAW_BASE_URL: gateway, OPENCLAWAPI_KEY: gatewaySecret,
    OPENCLAW_SPEECH_AGENT: 'openclaw/croupier-speech', LAB_REMOTE_URL: director, LAB_REMOTE_TOKEN: directorSecret });
  const productPort = await freePort(), labPort = await freePort();
  const repoRoot = await runtimeFixture(t);
  const fixture = await startIsolatedConnection({ repoRoot, envFiles: [file], env: {}, productPort, labPort });
  t.after(() => fixture.stop());
  const entry=await fetch(fixture.urls.product + '/');
  assert.equal(entry.status,503);assert.match(await entry.text(),/<h1>Ingen presentation vald<\/h1>/);
  const studioHealth = await fetch(fixture.urls.lab + '/api/health');
  assert.equal(studioHealth.status, 200);
  assert.deepEqual(await studioHealth.json(), { ok: true, service: 'croupier-next-studio', localOnly: true, streamLane: null });
  const project = await fetch(fixture.urls.lab + '/api/project');
  assert.equal(project.status, 503);
  assert.deepEqual(await project.json(), { error: 'studio_read_storage_unavailable' });
  const reference = await fetch(fixture.urls.lab + '/api/inputs/reference');
  assert.equal(reference.status, 200);
  const referenceStatus = await reference.json();
  assert.equal(referenceStatus.configured, true);
  assert.equal(referenceStatus.origin, fixture.urls.product);
  assert.match(referenceStatus.playerId, /^connection-/);
  const verify = await fetch(fixture.urls.lab + '/api/inputs/reference', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"verify"}',
  });
  assert.equal(verify.status, 200);
  assert.deepEqual((await verify.json()).scopes, ['launch', 'events']);
  const launch = await fetch(fixture.urls.lab + '/api/inputs/reference', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"launch"}',
  });
  assert.equal(launch.status, 200);
  assert.equal(new URL((await launch.json()).url).origin, fixture.urls.product);
  assert.ok(existsSync(join(fixture.runDir, 'product', 'croupier.db')));
  assert.ok(existsSync(join(fixture.runDir, 'product', 'craig.db')));
  assert.ok(existsSync(join(fixture.runDir, 'next-studio')));
  const serialized = JSON.stringify(fixture);
  assert.ok(!serialized.includes(gatewaySecret)); assert.ok(!serialized.includes(directorSecret));
  const runDir = fixture.runDir;
  await fixture.stop();
  assert.equal(existsSync(runDir), false);
  const released = await acquireLocalSession({ repoRoot, productPort, labPort });
  await released.release();
});

test('launcher refuses shared ports and its child guard blocks env reads and unrelated network', async () => {
  await assert.rejects(startIsolatedConnection({ envFiles: [], env: {}, productPort: 4192, labPort: 4197 }), /reserved/);
  await assert.rejects(startIsolatedConnection({ envFiles: [], env: {}, productPort: await freePort(), labPort: 4194 }), /reserved/);
  const module = new URL('./local-connection.mjs', import.meta.url).href;
  const program = `
    import assert from 'node:assert/strict';
    import {readFileSync} from 'node:fs';
    import {Socket} from 'node:net';
    import {installConnectionProcessGuard} from ${JSON.stringify(module)};
    installConnectionProcessGuard();
    assert.throws(()=>readFileSync('.env'),error=>error.code==='ENOENT');
    await assert.rejects(fetch('https://example.invalid/'),error=>error.code==='OPENCLAW_CONNECTION_NETWORK_BLOCKED');
    assert.throws(()=>new Socket().connect({host:'203.0.113.1',port:443}),error=>error.code==='OPENCLAW_CONNECTION_NETWORK_BLOCKED');
    console.log('connection guard passed');
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', program], {
    windowsHide: true, encoding: 'utf8', timeout: 15000,
    env: { CROUPIER_CONNECTION_ALLOWED_ORIGINS: '[]', CROUPIER_CONNECTION_LOCAL_PORTS: '4196,4197' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /connection guard passed/);
});

test('launcher refuses to connect product traffic to a known conflicting role', async t => {
  const file = await privateFixture(t, {
    OPENCLAW_BASE_URL: 'http://127.0.0.1:18789', OPENCLAWAPI_KEY: 'fixture-gateway-conflict',
    OPENCLAW_SPEECH_AGENT: 'openclaw/croupier-chat',
    LAB_REMOTE_URL: 'http://127.0.0.1:4189', LAB_REMOTE_TOKEN: 'fixture-director-conflict',
  });
  const productPort = await freePort(), labPort = await freePort();
  await assert.rejects(startIsolatedConnection({ repoRoot: dirname(file), envFiles: [file], env: {}, productPort, labPort }), /conflicting runtime contract/);
});

test('generated speech is explicit CLI opt-in and never takes credentials from arguments', () => {
  assert.equal(parseCli([]).generatedSpeech, false);
  assert.deepEqual(parseCli(['--start', '--generated-speech', '--product-port', '4296', '--lab-port', '4297']), {
    mode: 'start', generatedSpeech: true, productPort: 4296, labPort: 4297,
  });
  assert.equal(parseCli(['--check', '--generated-speech']).mode, 'check');
  assert.throws(() => parseCli(['--runpod-api-key', 'fixture-never-on-cli']), /never command-line arguments/);
});

test('the coordinated local pair receives one explicit absolute Astrid video archive', () => {
  const archive = join(tmpdir(), 'croupier-shared-video-archive');
  const { configuration } = loadPrivateConnection({ envFiles: [], env: { LAB_VIDEO_ARCHIVE: archive } });
  const children = childSpecifications(configuration, join(tmpdir(), 'croupier-local-video-run'), {
    productPort: 4296, labPort: 4297,
  });
  assert.equal(children.product.env.LAB_VIDEO_ARCHIVE, archive);
  assert.equal(children.lab.env.LAB_VIDEO_ARCHIVE, archive);
  assert.ok(!JSON.stringify(configuration).includes(archive));
  assert.throws(() => loadPrivateConnection({ envFiles: [], env: { LAB_VIDEO_ARCHIVE: './relative' } }), /absolute directory/);
});

test('separate private speech file supplies the scoped endpoint after the base files', async t => {
  const repoRoot = await mkdtemp(join(tmpdir(), 'croupier-speech-config-test-'));
  t.after(() => rm(repoRoot, { recursive: true, force: true }));
  await mkdir(join(repoRoot, 'lab'));
  await writeFile(join(repoRoot, '.env'), 'CARTESIA_API_KEY=fixture-root-cartesia\nRUNPOD_API_KEY=fixture-root-runpod\nRUNPOD_ENDPOINT_ID=legacy-root-endpoint\n');
  await writeFile(join(repoRoot, 'lab', '.env.local'), 'CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID=earlier-scoped-endpoint\n');
  await writeFile(join(repoRoot, 'lab', '.env.generated-speech.local'), 'CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID=dedicated-scoped-endpoint\n');
  const { configuration, report } = loadPrivateConnection({ repoRoot, env: {}, generatedSpeech: true });
  assert.equal(configuration.speechEndpointId, 'dedicated-scoped-endpoint');
  assert.equal(configuration.cartesiaKey, 'fixture-root-cartesia');
  assert.equal(configuration.runpodKey, 'fixture-root-runpod');
  assert.equal(report.generatedSpeech.configured, true);
  assert.ok(!JSON.stringify({ configuration, report }).includes('dedicated-scoped-endpoint'));
  const overridden = loadPrivateConnection({ repoRoot, env: { CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID: 'explicit-process-override' }, generatedSpeech: true });
  assert.equal(overridden.configuration.speechEndpointId, 'explicit-process-override');
});

test('cloud storage needs explicit opt-in and forwards each credential only to its consuming server', async t => {
  const blob = 'vercel_blob_rw_FixtureStore_fixtureSecret';
  const database = 'postgresql://fixture:private-password@ep-fixture.eu-central-1.aws.neon.tech/zones?sslmode=require';
  const values = { CROUPIER_MEDIA_STORAGE: 'blob', BLOB_READ_WRITE_TOKEN: blob, CROUPIER_ZONES_DATABASE_URL: database,
    VERCEL_BLOB_API_URL: 'https://untrusted.example', BLOB_API_URL: 'https://untrusted.example', NEXT_PUBLIC_VERCEL_BLOB_API_URL: 'https://untrusted.example' };
  const file = await privateFixture(t, values);
  const disabled = loadPrivateConnection({ envFiles: [file], env: values });
  const disabledChildren = childSpecifications(disabled.configuration, join(tmpdir(), 'croupier-storage-disabled'));
  for (const child of [disabledChildren.product, disabledChildren.lab]) {
    assert.equal(child.env.CROUPIER_MEDIA_STORAGE, 'disk');
    assert.equal(child.env.BLOB_READ_WRITE_TOKEN, ''); assert.equal(child.env.CROUPIER_ZONES_DATABASE_URL, '');
    assert.deepEqual(JSON.parse(child.env.CROUPIER_CONNECTION_ALLOWED_ORIGINS), []);
  }
  const active = loadPrivateConnection({ envFiles: [file], env: values, cloudStorage: true });
  const children = childSpecifications(active.configuration, join(tmpdir(), 'croupier-storage-enabled'));
  for (const child of [children.product, children.lab]) {
    assert.equal(child.env.CROUPIER_MEDIA_STORAGE, 'blob'); assert.equal(child.env.BLOB_READ_WRITE_TOKEN, blob);
    assert.equal(child.env.VERCEL_BLOB_API_URL, undefined);
    assert.equal(child.env.BLOB_API_URL, undefined); assert.equal(child.env.NEXT_PUBLIC_VERCEL_BLOB_API_URL, undefined);
    const origins = JSON.parse(child.env.CROUPIER_CONNECTION_ALLOWED_ORIGINS);
    assert.ok(origins.includes('https://vercel.com')); assert.ok(origins.includes('https://fixturestore.private.blob.vercel-storage.com'));
    assert.ok(!origins.some(origin => origin.includes('*') || origin.includes('untrusted')));
  }
  assert.equal(children.product.env.CROUPIER_ZONES_DATABASE_URL, '');
  assert.equal(children.lab.env.CROUPIER_ZONES_DATABASE_URL, database);
  assert.ok(!JSON.parse(children.product.env.CROUPIER_CONNECTION_ALLOWED_ORIGINS).includes('https://api.eu-central-1.aws.neon.tech'));
  assert.ok(JSON.parse(children.lab.env.CROUPIER_CONNECTION_ALLOWED_ORIGINS).includes('https://api.eu-central-1.aws.neon.tech'));
  const serialized = JSON.stringify(active);
  assert.ok(!serialized.includes(blob)); assert.ok(!serialized.includes(database)); assert.ok(!serialized.includes('private-password'));
  assert.deepEqual(active.report.cloudStorage, { enabled: true, mode: 'blob', blobCredentialPresent: true, zonesDatabasePresent: true });
  assert.equal(parseCli(['--check', '--cloud-storage']).cloudStorage, true);
});

test('dedicated private cloud storage file is loaded last only after explicit opt-in; process environment wins', async t => {
  const repoRoot = await mkdtemp(join(tmpdir(), 'croupier-storage-order-'));
  t.after(() => rm(repoRoot, { recursive: true, force: true })); await mkdir(join(repoRoot, 'lab'));
  await writeFile(join(repoRoot, '.env'), 'CROUPIER_MEDIA_STORAGE=blob\nBLOB_READ_WRITE_TOKEN=vercel_blob_rw_OldStore_fixture\n');
  await writeFile(join(repoRoot, 'lab', '.env.cloud-storage.local'), 'CROUPIER_MEDIA_STORAGE=blob\nBLOB_READ_WRITE_TOKEN=vercel_blob_rw_CurrentStore_fixture\n');
  assert.equal(loadPrivateConnection({ repoRoot, env: {} }).configuration.blobToken, '');
  const selected = loadPrivateConnection({ repoRoot, env: {}, cloudStorage: true });
  assert.equal(selected.configuration.blobToken, 'vercel_blob_rw_CurrentStore_fixture');
  assert.equal(loadPrivateConnection({ repoRoot, env: { BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_Explicit_fixture' }, cloudStorage: true }).configuration.blobToken, 'vercel_blob_rw_Explicit_fixture');
});

test('cloud storage rejects non-Neon database hosts, unsafe credentials and implicit boolean opt-in', () => {
  const valid = { CROUPIER_MEDIA_STORAGE: 'blob', BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_Fixture_fixture' };
  assert.throws(() => loadPrivateConnection({ envFiles: [], env: valid, cloudStorage: 'true' }), /boolean opt-in/);
  for (const extra of [{ CROUPIER_MEDIA_STORAGE: 'disk' }, { BLOB_READ_WRITE_TOKEN: 'arbitrary-token' },
    { BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_untrusted.example_secret' },
    { CROUPIER_ZONES_DATABASE_URL: 'postgresql://u:p@localhost/zones?sslmode=require' },
    { CROUPIER_ZONES_DATABASE_URL: 'postgresql://u:p@ep-fixture.neon.tech/zones' }]) {
    assert.throws(() => loadPrivateConnection({ envFiles: [], env: { ...valid, ...extra }, cloudStorage: true }), /cloud-storage|CROUPIER_ZONES_DATABASE_URL/);
  }
});

test('default launcher ignores inherited and file speech credentials and leaves provider origins blocked', async t => {
  const values = {
    CARTESIA_API_KEY: 'fixture-cartesia-disabled', ELEVENLABS_API_KEY: 'fixture-elevenlabs-disabled', ELEVENLABS_OC_API: 'fixture-elevenlabs-alias-disabled',
    RUNPOD_API_KEY: 'fixture-runpod-disabled', RUNPOD_ENDPOINT_ID: 'legacy-unused-endpoint',
    CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID: 'scoped-unused-endpoint', CROUPIER_GENERATED_SPEECH: '1',
    CROUPIER_GENERATED_SPEECH_DIR: 'untrusted-shared-directory', CROUPIER_GENERATED_SPEECH_PREVIEW: '1',
  };
  const file = await privateFixture(t, values);
  const { configuration, report } = loadPrivateConnection({ envFiles: [file], env: values });
  assert.equal(report.generatedSpeech.enabled, false);
  assert.equal(report.generatedSpeech.configured, false);
  const specs = childSpecifications(configuration, join(tmpdir(), 'croupier-fixture-disabled-speech'));
  for (const spec of [specs.product, specs.lab]) {
    for (const key of Object.keys(values)) assert.equal(spec.env[key], '', key);
    assert.deepEqual(JSON.parse(spec.env.CROUPIER_CONNECTION_ALLOWED_ORIGINS), []);
  }
  assert.equal(configuration.cartesiaKey, '');
  assert.equal(configuration.runpodKey, '');
});

test('generated speech forwards only scoped provider credentials and separate disposable speech directories', async t => {
  const cartesia = 'fixture-cartesia-opt-in';
  const runpod = 'fixture-runpod-opt-in';
  const endpoint = 'fixture-scoped-speech-endpoint';
  const file = await privateFixture(t, {
    CARTESIA_API_KEY: cartesia, RUNPOD_API_KEY: runpod, CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID: endpoint,
    RUNPOD_ENDPOINT_ID: 'fixture-legacy-endpoint-do-not-use', OPENCLAW_MODEL_API_KEY: 'fixture-model-never-forward',
    OPENCLAW_BASE_URL: 'https://gateway.example.test', OPENCLAWAPI_KEY: 'fixture-gateway-never-forward',
    OPENCLAW_PRODUCT_SPEECH_URL: 'https://speech.example.test', OPENCLAW_PRODUCT_SPEECH_TOKEN: 'fixture-speech-only',
    LAB_REMOTE_URL: 'https://director.example.test', LAB_REMOTE_TOKEN: 'fixture-director-only',
  });
  const { configuration, report } = loadPrivateConnection({ envFiles: [file], env: {}, generatedSpeech: true });
  assert.deepEqual(report.generatedSpeech, {
    enabled: true, configured: true, cartesiaCredentialPresent: true, elevenlabsCredentialPresent: false, runpodCredentialPresent: true,
    scopedEndpointPresent: true, previewOnly: true, visualApproval: 'not_verified', functionalProbe: 'not_run',
  });
  for (const value of [cartesia, runpod, endpoint]) {
    assert.ok(!JSON.stringify(report).includes(value));
    assert.ok(!JSON.stringify(configuration).includes(value));
  }
  const directory = join(tmpdir(), 'croupier-fixture-opt-in-speech');
  const specs = childSpecifications(configuration, directory);
  assert.equal(specs.product.env.CROUPIER_GENERATED_SPEECH_DIR, join(directory, 'speech', 'product'));
  assert.equal(specs.lab.env.CROUPIER_GENERATED_SPEECH_DIR, join(directory, 'speech', 'lab'));
  assert.equal(specs.product.env.LAB_REMOTE_TOKEN, '');
  assert.equal(specs.lab.env.OPENCLAW_PRODUCT_SPEECH_TOKEN, '');
  for (const [name, origin] of [['product', 'https://speech.example.test'], ['lab', 'https://director.example.test']]) {
    const spec = specs[name];
    assert.equal(spec.env.CROUPIER_GENERATED_SPEECH, '1');
    assert.equal(spec.env.CROUPIER_GENERATED_SPEECH_PREVIEW, '1');
    assert.equal(spec.env.CARTESIA_API_KEY, cartesia);
    assert.equal(spec.env.ELEVENLABS_API_KEY, '');
    assert.equal(spec.env.ELEVENLABS_OC_API, '');
    assert.equal(spec.env.RUNPOD_API_KEY, runpod);
    assert.equal(spec.env.CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID, endpoint);
    assert.equal(spec.env.RUNPOD_ENDPOINT_ID, '');
    assert.equal(spec.env.OPENCLAWAPI_KEY, '');
    assert.equal(spec.env.OPENCLAW_MODEL_API_KEY, '');
    assert.deepEqual(JSON.parse(spec.env.CROUPIER_CONNECTION_ALLOWED_ORIGINS), [origin, ...(name === 'product' ? ['https://director.example.test'] : []), 'https://api.cartesia.ai', 'https://api.runpod.ai']);
    const command = JSON.stringify([spec.command, ...spec.args]);
    assert.ok(!command.includes(cartesia)); assert.ok(!command.includes(runpod));
    assert.ok(!Object.keys(spec.env).some(key => key.startsWith('NEXT_PUBLIC_')));
  }
  assert.throws(() => childSpecifications(configuration, directory, { productPort: 4192 }), /reserved/);
  assert.throws(() => childSpecifications(configuration, directory, { labPort: 4194 }), /reserved/);
});

test('ElevenLabs local speech uses the selected file only after generated speech opt-in', async t => {
  const key = 'fixture-selected-elevenlabs';
  const values = {
    CARTESIA_API_KEY: 'fixture-cartesia', RUNPOD_API_KEY: 'fixture-runpod',
    CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID: 'fixture-endpoint', ELEVENLABS_API_KEY: key,
    EMIL_ELEVENLABS_API_KEY: 'fixture-emil-never-import', EMIL_RUNPOD_API_KEY: 'fixture-emil-runpod',
    EMIL_RUNPOD_ENDPOINT_ID: 'fixture-emil-endpoint',
  };
  const file = await privateFixture(t, values);
  for (const generatedSpeech of [false, true]) {
    const { configuration, report } = loadPrivateConnection({ envFiles: [file], env: {}, generatedSpeech });
    const specs = childSpecifications(configuration, join(tmpdir(), 'croupier-fixture-elevenlabs'));
    assert.ok(!JSON.stringify(configuration).includes(key));
    assert.ok(!JSON.stringify(report).includes(key));
    for (const spec of [specs.product, specs.lab]) {
      assert.equal(spec.env.ELEVENLABS_API_KEY, generatedSpeech ? key : '');
      assert.equal(spec.env.ELEVENLABS_OC_API, '');
      assert.ok(!Object.keys(spec.env).some(name => name.startsWith('EMIL_')));
      assert.equal(spec.env.CROUPIER_GAME_DATABASE_URL, undefined);
      assert.equal(JSON.parse(spec.env.CROUPIER_CONNECTION_ALLOWED_ORIGINS).includes('https://api.elevenlabs.io'), generatedSpeech);
    }
    assert.equal(Boolean(configuration.elevenlabsKey), generatedSpeech);
    assert.equal(report.generatedSpeech.elevenlabsCredentialPresent, generatedSpeech);
  }
  const emilOnly = loadPrivateConnection({ envFiles: [], env: {
    ...values, ELEVENLABS_API_KEY: '',
  }, generatedSpeech: true });
  assert.equal(emilOnly.configuration.elevenlabsKey, '');
  assert.equal(emilOnly.report.generatedSpeech.elevenlabsCredentialPresent, false);
  assert.ok(!JSON.parse(childSpecifications(emilOnly.configuration, tmpdir()).product.env.CROUPIER_CONNECTION_ALLOWED_ORIGINS).includes('https://api.elevenlabs.io'));
});

test('ElevenLabs child guard permits only its exact API origin after explicit speech opt-in', () => {
  const module = new URL('./local-connection.mjs', import.meta.url).href;
  for (const generatedSpeech of [false, true]) {
    const { configuration } = loadPrivateConnection({ envFiles: [], env: {
      CARTESIA_API_KEY: 'fixture-cartesia', RUNPOD_API_KEY: 'fixture-runpod',
      CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID: 'fixture-endpoint', ELEVENLABS_API_KEY: 'fixture-elevenlabs',
    }, generatedSpeech });
    const specs = childSpecifications(configuration, join(tmpdir(), 'croupier-fixture-elevenlabs-guard'));
    for (const spec of [specs.product, specs.lab]) {
      const program = `
        import assert from 'node:assert/strict';
        import { readFileSync } from 'node:fs';
        import { installConnectionProcessGuard } from ${JSON.stringify(module)};
        let calls = 0;
        globalThis.fetch = async () => { calls++; return new Response('{}'); };
        installConnectionProcessGuard();
        const request = () => fetch('https://api.elevenlabs.io/v1/text-to-speech/fixture');
        if (${generatedSpeech}) await request();
        else await assert.rejects(request(), error => error.code === 'OPENCLAW_CONNECTION_NETWORK_BLOCKED');
        for (const url of ['http://api.elevenlabs.io/', 'https://api.elevenlabs.io:444/', 'https://elevenlabs.io/', 'https://api.elevenlabs.io.evil.invalid/', 'https://other.api.elevenlabs.io/']) {
          await assert.rejects(fetch(url), error => error.code === 'OPENCLAW_CONNECTION_NETWORK_BLOCKED');
        }
        assert.equal(calls, ${generatedSpeech ? 1 : 0});
        assert.throws(() => readFileSync('.env.emil'), error => error.code === 'ENOENT');
      `;
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', program], {
        windowsHide: true, encoding: 'utf8', timeout: 15000,
        env: { CROUPIER_CONNECTION_ALLOWED_ORIGINS: spec.env.CROUPIER_CONNECTION_ALLOWED_ORIGINS,
          CROUPIER_CONNECTION_LOCAL_PORTS: spec.env.CROUPIER_CONNECTION_LOCAL_PORTS },
      });
      assert.equal(result.status, 0, result.stderr);
    }
  }
});

test('generated speech never substitutes the legacy endpoint and refuses incomplete opt-in settings', async t => {
  const file = await privateFixture(t, {
    CARTESIA_API_KEY: 'fixture-cartesia', RUNPOD_API_KEY: 'fixture-runpod', RUNPOD_ENDPOINT_ID: 'legacy-only-endpoint',
  });
  const { configuration, report } = loadPrivateConnection({ envFiles: [file], env: {}, generatedSpeech: true });
  assert.equal(report.generatedSpeech.configured, false);
  assert.equal(report.generatedSpeech.scopedEndpointPresent, false);
  assert.equal(configuration.speechEndpointId, '');
  assert.throws(() => childSpecifications(configuration, tmpdir()), /separate CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID/);
  for (const missing of ['CARTESIA_API_KEY', 'RUNPOD_API_KEY']) {
    const values = { CARTESIA_API_KEY: 'fixture-cartesia', RUNPOD_API_KEY: 'fixture-runpod', CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID: 'scoped-endpoint' };
    delete values[missing];
    const partial = loadPrivateConnection({ envFiles: [], env: values, generatedSpeech: true });
    assert.equal(partial.report.generatedSpeech.configured, false);
    assert.throws(() => childSpecifications(partial.configuration, tmpdir()), /requires existing/);
  }
  assert.throws(() => loadPrivateConnection({ envFiles: [], env: { CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID: 'https://untrusted.example/' }, generatedSpeech: true }), /endpoint ID, not a URL/);
});

test('Astrid translation aliases the verified OpenAI credential only into an opted-in product child', async t => {
  const providerKey = 'fixture-official-openai-provider';
  const file = await privateFixture(t, {
    OPENCLAW_MODEL_API_KEY: providerKey, OPENCLAW_MODEL_BASE_URL: 'https://api.openai.com/v1',
    OPENCLAWAPI_KEY: 'fixture-private-gateway', OPENCLAW_BASE_URL: 'https://gateway.example.test',
    OPENCLAW_PRODUCT_SPEECH_URL: 'https://director.example.test', OPENCLAW_PRODUCT_SPEECH_TOKEN: 'fixture-private-speech',
  });
  const { configuration, report } = loadPrivateConnection({ envFiles: [file], env: {}, astridCamera: true });
  assert.equal(report.astridTranslation.configured, true);
  assert.equal(report.astridTranslation.credentialSource, 'OPENCLAW_MODEL_API_KEY');
  assert.equal(report.astridTranslation.authenticationVerified, false);
  assert.equal(report.credentials.modelProviderForwardedToLocalChildren, true);
  assert.equal(configuration.translationKey, providerKey);
  assert.ok(!JSON.stringify({ configuration, report }).includes(providerKey));
  const directory = join(tmpdir(), 'croupier-translation-spec-fixture');
  const options = { streamLane: 'lissabon-stream-lane', astridCamera: true };
  const specs = childSpecifications(configuration, directory, options);
  assert.equal(specs.product.env.CROUPIER_ASTRID_TRANSLATION_KEY, providerKey);
  assert.equal(specs.lab.env.CROUPIER_ASTRID_TRANSLATION_KEY, '');
  assert.deepEqual(JSON.parse(specs.product.env.CROUPIER_CONNECTION_ALLOWED_ORIGINS), ['https://director.example.test', 'https://api.openai.com']);
  assert.deepEqual(JSON.parse(specs.lab.env.CROUPIER_CONNECTION_ALLOWED_ORIGINS), []);
  for (const spec of [specs.product, specs.lab]) {
    assert.equal(spec.env.OPENCLAW_MODEL_API_KEY, '');
    assert.equal(spec.env.OPENCLAWAPI_KEY, '');
    assert.equal(spec.env.OPENAI_API_KEY, undefined);
    assert.ok(!Object.keys(spec.env).some(key => key.startsWith('NEXT_PUBLIC_')));
    assert.ok(!JSON.stringify([spec.command, ...spec.args]).includes(providerKey));
  }
  const off = childSpecifications(configuration, directory);
  assert.equal(off.product.env.CROUPIER_ASTRID_TRANSLATION_KEY, '');
  assert.ok(!JSON.parse(off.product.env.CROUPIER_CONNECTION_ALLOWED_ORIGINS).includes('https://api.openai.com'));
});

test('Astrid translation is not enabled by inherited credentials and never borrows third-party or Gateway keys', () => {
  const directory = join(tmpdir(), 'croupier-translation-off-fixture');
  const env = { OPENCLAW_MODEL_API_KEY: 'fixture-model', CROUPIER_ASTRID_TRANSLATION_KEY: 'fixture-scoped', OPENAI_API_KEY: 'fixture-ambient-openai' };
  const off = loadPrivateConnection({ envFiles: [], env });
  assert.equal(off.configuration.translationKey, ''); assert.equal(off.report.astridTranslation.enabled, false);
  for (const spec of Object.values(childSpecifications(off.configuration, directory)).filter(value => value.env)) {
    assert.equal(spec.env.CROUPIER_ASTRID_TRANSLATION_KEY, '');
    assert.equal(spec.env.OPENAI_API_KEY, undefined);
    assert.deepEqual(JSON.parse(spec.env.CROUPIER_CONNECTION_ALLOWED_ORIGINS), []);
  }
  for (const base of ['https://models.example.test/v1', 'https://api.openai.com.evil.invalid/v1', 'http://api.openai.com/v1', 'https://api.openai.com/v1?redirect=1', 'https://account:secret@api.openai.com/v1']) {
    const custom = { OPENCLAW_MODEL_API_KEY: 'fixture-third-party', OPENCLAW_MODEL_BASE_URL: base };
    const disabled = loadPrivateConnection({ envFiles: [], env: custom, astridCamera: true });
    assert.equal(disabled.configuration.translationKey, ''); assert.equal(disabled.report.astridTranslation.configured, false);
    const specs = childSpecifications(disabled.configuration, directory, { astridCamera: true, streamLane: 'lissabon-stream-lane' });
    assert.ok(!JSON.parse(specs.product.env.CROUPIER_CONNECTION_ALLOWED_ORIGINS).includes('https://api.openai.com'));
    assert.throws(() => loadPrivateConnection({ envFiles: [], env: { ...custom, CROUPIER_ASTRID_TRANSLATION_KEY: custom.OPENCLAW_MODEL_API_KEY }, astridCamera: true }), /third-party provider credential/);
    const explicit = loadPrivateConnection({ envFiles: [], env: { ...custom, CROUPIER_ASTRID_TRANSLATION_KEY: 'fixture-separate-openai-key' }, astridCamera: true });
    assert.equal(explicit.configuration.translationKey, 'fixture-separate-openai-key');
    assert.equal(explicit.report.credentials.modelProviderForwardedToLocalChildren, false);
  }
  for (const forbidden of ['OPENCLAWAPI_KEY', 'OPENCLAW_PRODUCT_SPEECH_TOKEN', 'LAB_REMOTE_TOKEN']) {
    assert.throws(() => loadPrivateConnection({ envFiles: [], env: { [forbidden]: 'fixture-wrong-credential', CROUPIER_ASTRID_TRANSLATION_KEY: 'fixture-wrong-credential' }, astridCamera: true }), /never a Gateway/);
  }
  assert.throws(() => loadPrivateConnection({ envFiles: [], env: { OPENCLAWAPI_KEY: 'fixture-shared', OPENCLAW_MODEL_API_KEY: 'fixture-shared' }, astridCamera: true }), /never a Gateway/);
  const openai = loadPrivateConnection({ envFiles: [], env: { OPENAI_API_KEY: 'fixture-approved-openai' }, astridCamera: true });
  assert.equal(openai.configuration.translationKey, 'fixture-approved-openai');
  assert.equal(openai.report.astridTranslation.credentialSource, 'OPENAI_API_KEY');
  assert.throws(() => loadPrivateConnection({ envFiles: [], env: {}, astridCamera: 'true' }), /boolean/);
});

test('Astrid translation accepts an explicit private override without serializing it', async t => {
  const file = await privateFixture(t, { CROUPIER_ASTRID_TRANSLATION_KEY: 'fixture-private-scoped-key', OPENAI_API_KEY: 'fixture-dedicated-openai', OPENCLAW_MODEL_API_KEY: 'fixture-provider' });
  const fromFile = loadPrivateConnection({ envFiles: [file], env: {}, astridCamera: true });
  assert.equal(fromFile.configuration.translationKey, 'fixture-private-scoped-key');
  assert.equal(fromFile.report.astridTranslation.credentialSource, 'CROUPIER_ASTRID_TRANSLATION_KEY');
  const explicit = loadPrivateConnection({ envFiles: [file], env: { CROUPIER_ASTRID_TRANSLATION_KEY: 'fixture-process-scoped-key' }, astridCamera: true });
  assert.equal(explicit.configuration.translationKey, 'fixture-process-scoped-key');
  assert.ok(!JSON.stringify(explicit).includes('fixture-'));
  const officialDefault = loadPrivateConnection({ envFiles: [], env: { OPENCLAW_MODEL_API_KEY: 'fixture-default-openai' }, astridCamera: true });
  assert.equal(officialDefault.configuration.translationKey, 'fixture-default-openai');
});

test('Astrid translation prefers the dedicated OpenAI credential to the old model credential without exposing either', async t => {
  const env = { OPENAI_API_KEY: 'fixture-new-openai', OPENCLAW_MODEL_API_KEY: 'fixture-old-model' };
  const file = await privateFixture(t, { ...env, OPENAI_BASE_URL: 'https://api.openai.com/v1/' });
  const { configuration, report } = loadPrivateConnection({ envFiles: [file], env: {}, astridCamera: true });
  assert.equal(configuration.translationKey, env.OPENAI_API_KEY);
  assert.equal(report.astridTranslation.credentialSource, 'OPENAI_API_KEY');
  assert.equal(report.astridTranslation.authenticationVerified, false);
  assert.equal(report.credentials.modelProviderForwardedToLocalChildren, false);
  const specs = childSpecifications(configuration, join(tmpdir(), 'croupier-openai-selection-fixture'), { astridCamera: true, streamLane: 'lissabon-stream-lane' });
  assert.equal(specs.product.env.CROUPIER_ASTRID_TRANSLATION_KEY, env.OPENAI_API_KEY);
  assert.equal(specs.lab.env.CROUPIER_ASTRID_TRANSLATION_KEY, '');
  for (const spec of [specs.product, specs.lab]) {
    assert.equal(spec.env.OPENAI_API_KEY, undefined); assert.equal(spec.env.OPENCLAW_MODEL_API_KEY, '');
    assert.ok(!JSON.stringify([spec.command, ...spec.args]).includes('fixture-new-openai'));
  }
  assert.ok(!JSON.stringify({ configuration, report }).includes('fixture-'));
  const off = loadPrivateConnection({ envFiles: [file], env, astridCamera: false });
  assert.equal(off.configuration.translationKey, ''); assert.equal(off.report.astridTranslation.credentialSource, null);
  const independent = loadPrivateConnection({ envFiles: [], env: { ...env, OPENCLAW_MODEL_BASE_URL: 'https://models.example.test/v1' }, astridCamera: true });
  assert.equal(independent.configuration.translationKey, env.OPENAI_API_KEY);
});

test('Astrid translation pairs the OpenAI credential with its endpoint metadata and rejects known credential collisions', () => {
  for (const name of ['OPENAI_BASE_URL', 'OPENAI_API_BASE', 'OPENAI_API_HOST']) {
    for (const base of ['https://models.example.test/v1', 'http://api.openai.com/v1', 'https://api.openai.com.evil.invalid/v1', 'https://api.openai.com/v1?redirect=1']) {
      const env = { OPENAI_API_KEY: 'fixture-third-party-openai-compatible', [name]: base };
      const unavailable = loadPrivateConnection({ envFiles: [], env, astridCamera: true });
      assert.equal(unavailable.configuration.translationKey, ''); assert.equal(unavailable.report.astridTranslation.credentialSource, null);
      const model = loadPrivateConnection({ envFiles: [], env: { ...env, OPENCLAW_MODEL_API_KEY: 'fixture-official-model' }, astridCamera: true });
      assert.equal(model.configuration.translationKey, 'fixture-official-model');
      assert.equal(model.report.astridTranslation.credentialSource, 'OPENCLAW_MODEL_API_KEY');
      for (const alias of ['CROUPIER_ASTRID_TRANSLATION_KEY', 'OPENCLAW_MODEL_API_KEY']) {
        assert.throws(() => loadPrivateConnection({ envFiles: [], env: { ...env, [alias]: env.OPENAI_API_KEY }, astridCamera: true }), /third-party provider credential/);
      }
    }
  }
  for (const forbidden of ['OPENCLAW_API_KEY', 'OPENCLAWAPI_KEY', 'OPENCLAW_PRODUCT_SPEECH_TOKEN', 'LAB_REMOTE_TOKEN', 'CARTESIA_API_KEY', 'RUNPOD_API_KEY']) {
    assert.throws(() => loadPrivateConnection({ envFiles: [], env: { [forbidden]: 'fixture-wrong-provider', OPENAI_API_KEY: 'fixture-wrong-provider' }, astridCamera: true }), /provider credential/);
  }
});

test('Astrid translation network is open only in the enabled product, including the actual process guard', () => {
  const { configuration } = loadPrivateConnection({ envFiles: [], env: { CROUPIER_ASTRID_TRANSLATION_KEY: 'fixture-network-key' }, astridCamera: true });
  const directory = join(tmpdir(), 'croupier-translation-guard-fixture');
  const specs = childSpecifications(configuration, directory, { astridCamera: true, streamLane: 'lissabon-stream-lane' });
  const module = new URL('./local-connection.mjs', import.meta.url).href;
  for (const [role, specification] of [['product', specs.product], ['lab', specs.lab]]) {
    const program = `
      import assert from 'node:assert/strict';
      import {installConnectionProcessGuard} from ${JSON.stringify(module)};
      const received=[];
      globalThis.fetch=async input=>{received.push(input);return new Response('{}');};
      installConnectionProcessGuard();
      const translation='https://api.openai.com/v1/audio/translations';
      if(${role === 'product'}) {await fetch(translation);assert.deepEqual(received,[translation]);}
      else await assert.rejects(fetch(translation),error=>error.code==='OPENCLAW_CONNECTION_NETWORK_BLOCKED');
      for(const url of ['http://api.openai.com/v1/audio/translations','https://api.openai.com.evil.invalid/','https://other.api.openai.com/']) {
        await assert.rejects(fetch(url),error=>error.code==='OPENCLAW_CONNECTION_NETWORK_BLOCKED');
      }
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', program], {
      windowsHide: true, encoding: 'utf8', timeout: 15000,
      env: { CROUPIER_CONNECTION_ALLOWED_ORIGINS: specification.env.CROUPIER_CONNECTION_ALLOWED_ORIGINS, CROUPIER_CONNECTION_LOCAL_PORTS: specification.env.CROUPIER_CONNECTION_LOCAL_PORTS },
    });
    assert.equal(result.status, 0, result.stderr);
  }
});

test('opt-in provider origins do not open unrelated network or env-file access in child guard', () => {
  const module = new URL('./local-connection.mjs', import.meta.url).href;
  const program = `
    import assert from 'node:assert/strict';
    import {readFileSync} from 'node:fs';
    import {installConnectionProcessGuard} from ${JSON.stringify(module)};
    const allowed = [];
    globalThis.fetch = async input => { allowed.push(String(input)); return new Response('{}'); };
    installConnectionProcessGuard();
    await fetch('https://api.cartesia.ai/tts/bytes');
    await fetch('https://api.runpod.ai/v2/fixture/status/fixture-job');
    assert.equal(allowed.length, 2);
    for (const url of ['http://api.runpod.ai/v2/fixture', 'https://runpod.ai/', 'https://other.api.runpod.ai/', 'https://api.cartesia.ai.evil.invalid/', 'http://127.0.0.1:4194/']) {
      await assert.rejects(fetch(url), error => error.code === 'OPENCLAW_CONNECTION_NETWORK_BLOCKED');
    }
    assert.throws(() => readFileSync('.env.local'), error => error.code === 'ENOENT');
    console.log('opt-in connection guard passed');
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', program], {
    windowsHide: true, encoding: 'utf8', timeout: 15000,
    env: { CROUPIER_CONNECTION_ALLOWED_ORIGINS: JSON.stringify(['https://api.cartesia.ai', 'https://api.runpod.ai']), CROUPIER_CONNECTION_LOCAL_PORTS: '4196,4197' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /opt-in connection guard passed/);
});
