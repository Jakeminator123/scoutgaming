import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  childSpecifications, installConnectionProcessGuard, loadPrivateConnection,
  parseCli, probeConnections, startIsolatedConnection,
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
  assert.deepEqual(specs.urls, { product: 'http://127.0.0.1:4196', lab: 'http://127.0.0.1:4197' });
  assert.equal(specs.product.env.PUBLIC_URL, specs.urls.product);
  assert.equal(specs.product.env.BO_URL, specs.urls.product);
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
    assert.equal(specs.product.env.CROUPIER_PRESENTATION_STUDIO_DIR, studioDataDir);
    assert.equal(specs.lab.env.LAB_STUDIO_DATA_DIR, studioDataDir);
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
  assert.equal(specs.product.env.CROUPIER_PRESENTATION_STUDIO_DIR, specs.lab.env.LAB_STUDIO_DATA_DIR);
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
  assert.deepEqual(await studioHealth.json(), { ok: true, service: 'croupier-next-studio', localOnly: true, streamLane: null });
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

test('generated speech is explicit CLI opt-in and never takes credentials from arguments', () => {
  assert.equal(parseCli([]).generatedSpeech, false);
  assert.deepEqual(parseCli(['--start', '--generated-speech', '--product-port', '4296', '--lab-port', '4297']), {
    mode: 'start', generatedSpeech: true, productPort: 4296, labPort: 4297,
  });
  assert.equal(parseCli(['--check', '--generated-speech']).mode, 'check');
  assert.throws(() => parseCli(['--runpod-api-key', 'fixture-never-on-cli']), /never command-line arguments/);
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
    enabled: true, configured: true, cartesiaCredentialPresent: true, runpodCredentialPresent: true,
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
