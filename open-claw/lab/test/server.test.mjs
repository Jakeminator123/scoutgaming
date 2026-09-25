import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request, createServer } from 'node:http';
import { createLabServer } from '../src/server.mjs';
import { LAB_ROOT, readSettings, gatewayEndpoint } from '../src/settings.mjs';
import { askDirector } from '../src/openclaw.mjs';
import { prepareDecision, normalizeInput } from '../src/engine.mjs';

const catalog = JSON.parse(await readFile(join(LAB_ROOT, 'config/catalog.json'), 'utf8'));
const settings = dataDir => ({ host: '127.0.0.1', port: 0, apiToken: '', dataDir,
  remoteUrl: '', remoteToken: '', baseUrl: '', gatewayKey: '', agent: 'openclaw/croupier-director',
  chatAgent: 'openclaw/croupier-chat', adviceTimeoutMs: 100 });
async function running(t, overrides = {}, fetchImpl = fetch, serverOptions = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'croupier-openclaw-test-'));
  const config = { ...settings(dir), ...overrides };
  const { server, store } = await createLabServer({ settings: () => config, fetchImpl, ...serverOptions });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  return { base, config, store };
}
const post = (base, path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const completion = content => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { headers: { 'Content-Type': 'application/json' } });

test('only the named OpenClaw credential is used; no implicit OpenAI fallback', () => {
  const config = readSettings({ env: { OPENAI_API_KEY: 'do-not-use', OPENCLAWAPI_KEY: 'gateway-only' }, envFiles: [] });
  assert.equal(config.gatewayKey, 'gateway-only');
  assert.equal(readSettings({ env: { OPENAI_API_KEY: 'do-not-use' }, envFiles: [] }).gatewayKey, '');
  assert.equal(gatewayEndpoint('http://localhost:18789/v1'), 'http://localhost:18789/v1/chat/completions');
  assert.throws(() => gatewayEndpoint('https://user:pass@example.com'));
});

test('Director settings reject a product speech token aliased to any broader credential', () => {
  const speech = 'fixture-aliased-speech-token';
  const base = {
    LAB_API_TOKEN: 'fixture-lab-api', LAB_REMOTE_TOKEN: 'fixture-lab-remote',
    OPENCLAWAPI_KEY: 'fixture-gateway', OPENCLAW_MODEL_API_KEY: 'fixture-model-provider',
    OPENCLAW_PRODUCT_SPEECH_TOKEN: speech,
  };
  for (const key of ['LAB_API_TOKEN', 'LAB_REMOTE_TOKEN', 'OPENCLAWAPI_KEY', 'OPENCLAW_MODEL_API_KEY']) {
    assert.throws(() => readSettings({ env: { ...base, [key]: speech }, envFiles: [] }), /must not reuse/);
  }
  const result = readSettings({ env: base, envFiles: [] });
  assert.equal(result.speechToken, speech);
  assert.equal(result.modelKey, undefined);
});

test('dashboard origin is explicit, or opted in to the Render web service origin', () => {
  const env = { RENDER_EXTERNAL_URL: 'https://lab.example', OPENCLAW_DASHBOARD_ALLOW_LOOPBACK: 'true' };
  assert.equal(readSettings({ env, envFiles: [] }).dashboardOrigin, '');
  assert.equal(readSettings({ env: { ...env, OPENCLAW_DASHBOARD_ENABLED: 'true' }, envFiles: [] }).dashboardOrigin, 'https://lab.example');
  const explicit = readSettings({ env: { ...env, OPENCLAW_DASHBOARD_ORIGIN: 'http://localhost:4189' }, envFiles: [] });
  assert.equal(explicit.dashboardOrigin, 'http://localhost:4189');
  assert.equal(explicit.dashboardAllowLoopback, true);
});

test('native dashboard uses its own auth path; lab APIs still require the lab token', async t => {
  let seenHeaders;
  const upstream = createServer((req, res) => {
    seenHeaders = req.headers;
    res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Security-Policy': "default-src 'none'" });
    res.end('<title>Native OpenClaw fixture</title>');
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => upstream.close(resolve)));
  const { base, config } = await running(t, { host: '0.0.0.0', apiToken: 'lab-secret', gatewayKey: 'never-inject',
    baseUrl: `http://127.0.0.1:${upstream.address().port}`, dashboardOrigin: 'https://lab.example' });
  const response = await new Promise((resolve, reject) => {
    const req = request(base + '/openclaw/', { headers: { Host: 'lab.example' } }, res => {
      res.resume(); res.on('end', () => resolve(res));
    });
    req.on('error', reject); req.end();
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['content-security-policy'], "default-src 'none'");
  assert.equal(seenHeaders.authorization, undefined);
  assert.equal((await fetch(base + '/api/catalog')).status, 401);
  config.dashboardOrigin = 'https://evil.example';
  assert.equal((await fetch(base + '/openclaw/', { headers: { Origin: 'https://evil.example' } })).status, 403);
});

test('dashboard defaults off and a local remote relay does not expose the admin proxy', async t => {
  const local = await running(t);
  assert.equal((await fetch(local.base + '/openclaw/')).status, 503);
  const relay = await running(t, { remoteUrl: 'https://lab.example', dashboardOrigin: 'https://lab.example', baseUrl: 'invalid-unused' });
  assert.equal((await fetch(relay.base + '/openclaw/')).status, 503);
});

test('lab runs without gateway and reports real fallback; chat is never simulated', async t => {
  const { base } = await running(t);
  const response = await post(base, '/api/decide', { requestId: 'no-gateway', event: { type: 'idle', privateShoe: ['AS'] }, mode: 'active' });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.provider.status, 'openclaw_not_configured');
  assert.equal(result.selected.id, result.baseline.id);
  assert.equal(JSON.stringify(result).includes('privateShoe'), false);
  assert.equal((await post(base, '/api/chat', { message: 'Hej', conversationId: 'test-conversation' })).status, 503);
});

test('foreign origins, DNS rebinding, unknown events and static path traversal fail closed', async t => {
  const { base } = await running(t);
  assert.equal((await post(base, '/api/decide', { event: { type: 'idle' } }, { Origin: 'https://evil.example' })).status, 403);
  const reboundStatus = await new Promise((resolve, reject) => {
    const req = request(base + '/api/status', { headers: { Host: 'evil.example' } }, response => { response.resume(); resolve(response.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(reboundStatus, 403);
  assert.equal((await post(base, '/api/decide', { event: { type: 'rng.win' } })).status, 400);
  assert.equal((await fetch(base + '/.env')).status, 404);
  assert.equal((await fetch(base + '/src/server.mjs')).status, 404);
});

test('public service requires a separate narrow bearer token', async t => {
  const { base } = await running(t, { host: '0.0.0.0', apiToken: 'lab-test-token' });
  assert.equal((await fetch(base + '/healthz')).status, 200);
  assert.equal((await fetch(base + '/api/catalog')).status, 401);
  assert.equal((await fetch(base + '/api/catalog', { headers: { Authorization: 'Bearer lab-test-token' } })).status, 200);
});

test('local browser relay works with Compose credentials in the same env and auth follows actual bind', async t => {
  const local = await running(t, { apiToken: 'compose-director-token' });
  assert.equal((await fetch(local.base + '/api/status')).status, 200);
  const deployed = await running(t, { host: '0.0.0.0', apiToken: 'render-director-token' });
  deployed.config.host = '127.0.0.1'; // Editing .env cannot turn off auth on an already public listener.
  assert.equal((await fetch(deployed.base + '/api/status')).status, 401);
});

test('operator chat receives current catalog and uses a different agent/session from decisions', async t => {
  let captured;
  const { base } = await running(t, { baseUrl: 'http://localhost:18789', gatewayKey: 'test-gateway' }, async (_url, options) => {
    captured = JSON.parse(options.body); return completion('Katalogen har en standardlinje och en variant.');
  });
  const response = await post(base, '/api/chat', { conversationId: 'operator-test', message: 'Vilka varianter finns?' });
  assert.equal(response.status, 200);
  assert.equal(captured.model, 'openclaw/croupier-chat');
  assert.equal(captured.user, 'croupier-lab-chat:operator-test');
  assert.equal(JSON.parse(captured.messages[1].content).catalog.revision, catalog.revision);
});

test('catalog edits persist, preserve recoverable version and reject stale writes', async t => {
  const { base, store } = await running(t);
  const original = await (await fetch(base + '/api/catalog')).json();
  const next = structuredClone(original); next.events[0].label = 'Testetikett';
  const save = () => fetch(base + '/api/catalog', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catalog: next, expectedRevision: original.revision }) });
  const response = await save(); assert.equal(response.status, 200);
  const saved = await response.json(); assert.notEqual(saved.revision, original.revision);
  assert.equal((await store.load()).events[0].label, 'Testetikett');
  assert.equal((await save()).status, 409);
  const invalid = structuredClone(saved); invalid.events[0].sourceType = 'rng.future';
  assert.equal((await fetch(base + '/api/catalog', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catalog: invalid, expectedRevision: saved.revision }) })).status, 422);
  assert.equal((await store.load()).revision, saved.revision);
});

test('gateway receives only eligible public opportunity; repeated request ids do not spend twice', async t => {
  let calls = 0; let captured;
  const fake = async (url, options) => {
    calls++; assert.equal(options.headers.Authorization, 'Bearer test-gateway');
    const body = JSON.parse(options.body); captured = body;
    const data = JSON.parse(body.messages[1].content);
    return completion(JSON.stringify({ requestId: data.requestId, catalogRevision: data.catalogRevision, variantId: data.candidates.at(-1).variantId }));
  };
  const { base } = await running(t, { baseUrl: 'http://localhost:18789', gatewayKey: 'test-gateway' }, fake);
  const input = { requestId: 'dedupe-123', event: { type: 'idle', shoe: ['A', 'K'] }, context: { private: 'hidden' }, mode: 'active' };
  const [a, b] = await Promise.all([post(base, '/api/decide', input), post(base, '/api/decide', input)]);
  assert.equal(a.status, 200); assert.deepEqual(await a.json(), await b.json()); assert.equal(calls, 1);
  assert.equal(JSON.stringify(captured).includes('hidden'), false);
  assert.equal(captured.user, undefined);
  assert.equal(captured.tool_choice, 'none');
  assert.equal((await post(base, '/api/decide', { ...input, mode: 'shadow' })).status, 409);
});

test('malformed or late OpenClaw answers safely fall back', async () => {
  const prepared = prepareDecision(catalog, normalizeInput({ event: { type: 'idle' }, requestId: 'error-case' }));
  const config = { ...settings(''), baseUrl: 'http://localhost:18789', gatewayKey: 'secret-not-logged' };
  const bad = await askDirector(prepared, config, async () => completion('not JSON'));
  assert.equal(bad.advice, null); assert.equal(bad.provider.status, 'invalid_advice_json');
  const timed = await askDirector(prepared, config, async () => { throw new DOMException('sensitive response', 'TimeoutError'); });
  assert.equal(timed.provider.status, 'openclaw_timeout');
  assert.equal(JSON.stringify(timed).includes('sensitive'), false);
});

test('catalog revision change while awaiting advice invalidates that advice', async t => {
  let release; let started;
  const arrived = new Promise(resolve => { started = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  const fake = async (_url, options) => {
    const data = JSON.parse(JSON.parse(options.body).messages[1].content);
    started(); await held;
    return completion(JSON.stringify({ requestId: data.requestId, catalogRevision: data.catalogRevision, variantId: data.candidates[0].variantId }));
  };
  const { base, store } = await running(t, { baseUrl: 'http://localhost:18789', gatewayKey: 'test-gateway' }, fake);
  const pending = post(base, '/api/decide', { requestId: 'revision-race', event: { type: 'idle' }, mode: 'active' });
  await arrived;
  const old = await store.load(); const updated = await store.save(old, old.revision);
  release();
  const result = await (await pending).json();
  assert.equal(result.provider.status, 'catalog_changed_baseline');
  assert.equal(result.catalogRevision, updated.revision);
  assert.equal(result.selected.id, result.baseline.id);
});

test('Render relay transports sanitized input using its own token', async t => {
  let captured;
  const { base } = await running(t, { remoteUrl: 'https://director.example', remoteToken: 'narrow-lab-token', gatewayKey: 'must-stay-local' }, async (_url, options) => {
    captured = options;
    return new Response(JSON.stringify({ selected: { id: 'remote' } }));
  });
  const response = await post(base, '/api/decide', { event: { type: 'idle', shoe: [1, 2, 3] }, context: { privateHoleCard: 'AS' } });
  assert.equal(response.status, 200);
  assert.equal(captured.headers.Authorization, 'Bearer narrow-lab-token');
  assert.equal(captured.body.includes('privateHoleCard'), false); assert.equal(captured.body.includes('shoe'), false);
  assert.equal(JSON.stringify(captured).includes('must-stay-local'), false);
});

test('ordered presentation import validates the whole batch before requesting advice', async t => {
  let calls = 0;
  const { base } = await running(t, {}, async () => { calls++; throw new Error('unexpected'); });
  const valid = await post(base, '/api/presentation', { presentation: [{ type: 'speak', line: 'placebets' }, { type: 'idle' }], mode: 'off', requestId: 'batch-case' });
  assert.equal(valid.status, 200);
  assert.deepEqual((await valid.json()).decisions.map(d => d.event.type), ['speak', 'idle']);
  assert.equal((await post(base, '/api/presentation', { presentation: [{ type: 'idle' }, { type: 'made-up' }] })).status, 400);
  assert.equal(calls, 0);
});

test('a slow imported batch finishes within its shared budget using baseline for remaining events', async t => {
  let calls = 0;
  const { base } = await running(t, { baseUrl: 'http://localhost:18789', gatewayKey: 'test-gateway' }, async () => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 40));
    throw new DOMException('late', 'TimeoutError');
  }, { batchBudgetMs: 10 });
  const response = await post(base, '/api/presentation', { requestId: 'bounded-batch', mode: 'active', presentation: [{ type: 'idle' }, { type: 'idle' }, { type: 'idle' }] });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(calls, 1);
  assert.equal(result.decisions.length, 3);
  assert.equal(result.decisions[1].provider.status, 'batch_deadline_baseline');
  assert.ok(result.decisions.every(d => d.selected.id === d.baseline.id));
});
