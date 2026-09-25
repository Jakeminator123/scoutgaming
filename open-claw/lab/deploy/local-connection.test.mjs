import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  childSpecifications, installConnectionProcessGuard, loadPrivateConnection,
  probeConnections, startIsolatedConnection,
} from './local-connection.mjs';

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
  assert.equal(specs.product.env.CROUPIER_DATA_DIR, join(directory, 'product'));
  assert.equal(specs.lab.env.LAB_STUDIO_DATA_DIR, join(directory, 'next-studio'));
  assert.equal(specs.lab.cwd, join(configuration.repoRoot, 'lab'));
  assert.match(specs.lab.args.join(' '), /next.* start .*--port 4197/);
  assert.equal(specs.product.env.OPENCLAWAPI_KEY, 'fixture-gateway-only');
  assert.equal(specs.product.env.OPENCLAW_SPEECH_AGENT, 'openclaw/croupier-speech');
  assert.equal(specs.product.env.OPENCLAW_CHAT_AGENT, 'openclaw/croupier-chat');
  assert.equal(specs.product.env.LAB_REMOTE_TOKEN, '');
  assert.equal(specs.lab.env.OPENCLAWAPI_KEY, '');
  assert.equal(specs.lab.env.LAB_REMOTE_TOKEN, 'fixture-director-only');
  for (const spec of [specs.product, specs.lab]) {
    assert.equal(spec.env.OPENCLAW_MODEL_API_KEY, '');
    assert.equal(spec.env.OPENCLAW_MODEL_BASE_URL, '');
    const commandLine = JSON.stringify([spec.command, ...spec.args]);
    for (const secret of ['fixture-gateway-only', 'fixture-provider-only', 'fixture-director-only']) assert.ok(!commandLine.includes(secret));
  }
});

test('isolated product can receive only the narrow Director speech credential', async t => {
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
  await assert.rejects(startIsolatedConnection({ envFiles: [file], env: {}, productPort, labPort }), /must be configured together/);
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

test('launcher starts isolated native and the real Next Eventstudio without using real databases', async t => {
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
  const fixture = await startIsolatedConnection({ envFiles: [file], env: {}, productPort, labPort });
  t.after(() => fixture.stop());
  assert.equal((await fetch(fixture.urls.product + '/')).status, 200);
  const studioHealth = await fetch(fixture.urls.lab + '/api/health');
  assert.equal(studioHealth.status, 200);
  assert.deepEqual(await studioHealth.json(), { ok: true, service: 'croupier-next-studio', localOnly: true });
  const project = await fetch(fixture.urls.lab + '/api/project');
  assert.equal(project.status, 200);
  assert.equal((await project.json()).status.provider, 'render-relay');
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
  await assert.rejects(startIsolatedConnection({ envFiles: [file], env: {}, productPort, labPort }), /conflicting runtime contract/);
});
