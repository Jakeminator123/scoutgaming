import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createLabServer } from '../src/server.mjs';
import { LAB_ROOT, readSettings } from '../src/settings.mjs';

const seed = JSON.parse(await readFile(join(LAB_ROOT, 'config/catalog.json'), 'utf8'));
const auth = { Authorization: 'Bearer fixture-studio-api-token' };
const paths = ['/api/studio/advice', '/api/studio/chat'];
const completion = content => Response.json({ choices: [{ message: { content } }] });

function studioBody() {
  const catalog = structuredClone(seed);
  catalog.revision = 'draft-fixture-studio';
  catalog.events[0].label = 'Enbart tillfälligt studionamn';
  return {
    catalog,
    input: { requestId: 'studio-endpoint-fixture', event: catalog.events[0].exampleEvent, context: { playerHistory: { returning: true, preferredLanguage: 'de' } }, mode: 'active' },
    message: 'Förklara mitt tillfälliga eventträd.',
    conversationId: 'studio-fixture-chat',
  };
}

function stubGateway(captured = []) {
  return async (url, options) => {
    const payload = JSON.parse(options.body);
    captured.push({ url: String(url), options, payload });
    if (payload.model === 'openclaw/croupier-chat') return completion('Studion använder ett tillfälligt, validerat eventträd.');
    const opportunity = JSON.parse(payload.messages[1].content);
    return completion(JSON.stringify({ requestId: opportunity.requestId, catalogRevision: opportunity.catalogRevision, variantId: opportunity.candidates[0].variantId }));
  };
}

async function running(t, fetchImpl, overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-studio-endpoints-'));
  const config = {
    ...readSettings({ envFiles: [], env: {
      HOST: '0.0.0.0', PORT: '0', LAB_API_TOKEN: 'fixture-studio-api-token',
      LAB_DATA_DIR: directory, OPENCLAW_BASE_URL: 'http://127.0.0.1:18789',
      OPENCLAWAPI_KEY: 'fixture-gateway-key',
    } }),
    ...overrides,
  };
  // Exercise public-listener authorization policy, but bind the test only to loopback.
  const { server, store } = await createLabServer({ settings: () => config, fetchImpl });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  return { base: `http://127.0.0.1:${server.address().port}`, directory, store };
}

const post = (base, path, body, headers = auth) => fetch(base + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});

test('both studio endpoints require the distinct lab Bearer token before issuing model requests', async t => {
  const calls = [];
  const { base } = await running(t, stubGateway(calls));
  for (const path of paths) {
    assert.equal((await post(base, path, studioBody(), {})).status, 401);
    assert.equal((await post(base, path, studioBody(), { Authorization: 'Bearer wrong-token' })).status, 401);
    assert.equal((await post(base, path, studioBody(), { Authorization: 'Bearer fixture-gateway-key' })).status, 401);
  }
  assert.equal(calls.length, 0);
  for (const path of paths) assert.equal((await post(base, path, studioBody())).status, 200);
  assert.equal(calls.length, 2);
});

test('authorized status reports studio capabilities without exposing either credential', async t => {
  const { base } = await running(t, () => assert.fail('Status never calls a model.'));
  assert.equal((await fetch(base + '/api/status')).status, 401);
  const response = await fetch(base + '/api/status', { headers: auth });
  assert.equal(response.status, 200);
  const status = await response.json();
  assert.ok(status.capabilities.includes('studio-advice-v1'));
  assert.ok(status.capabilities.includes('studio-chat-v1'));
  assert.ok(!JSON.stringify(status).includes('fixture-studio-api-token'));
  assert.ok(!JSON.stringify(status).includes('fixture-gateway-key'));
});

test('ephemeral advice catalog is accepted, projected and never saved to the deployed catalog', async t => {
  const calls = [];
  const { base, directory, store } = await running(t, stubGateway(calls));
  const before = await store.load();
  const input = studioBody();
  input.input.event = { ...input.input.event, privateShoe: ['PRIVATE_FUTURE_CARD'] };
  input.input.context.playerHistory.playerId = 'PRIVATE_PLAYER';
  input.input.context.chat = { signal: 'praise', text: 'PRIVATE_CHAT' };
  input.input.context.wallet = 'PRIVATE_BALANCE';
  const response = await post(base, '/api/studio/advice', input);
  assert.equal(response.status, 200);
  const answer = await response.json();
  assert.equal(answer.advice.catalogRevision, input.catalog.revision);
  assert.equal(answer.advice.requestId, input.input.requestId);
  const opportunity = JSON.parse(calls[0].payload.messages[1].content);
  assert.equal(opportunity.catalogRevision, input.catalog.revision);
  assert.equal(opportunity.event.type, input.input.event.type);
  assert.equal(opportunity.context.playerHistory.returning, true);
  assert.ok(opportunity.candidates.some(item => item.variantId === answer.advice.variantId));
  assert.equal(calls[0].payload.tool_choice, 'none');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer fixture-gateway-key');
  assert.ok(!JSON.stringify(calls[0].payload).includes('PRIVATE_'));
  assert.ok(!JSON.stringify(answer).includes('fixture-gateway-key'));
  assert.deepEqual(await store.load(), before);
  assert.deepEqual(await readdir(directory), [], 'Advice must not create catalog.json or history.');
});

test('ephemeral chat explains supplied catalog without writing it or inheriting decision authority', async t => {
  const calls = [];
  const { base, directory, store } = await running(t, stubGateway(calls));
  const before = await store.load();
  const input = studioBody();
  const response = await post(base, '/api/studio/chat', input);
  assert.equal(response.status, 200);
  const answer = await response.json();
  assert.equal(answer.conversationId, input.conversationId);
  assert.equal(typeof answer.reply, 'string');
  const payload = calls[0].payload;
  const question = JSON.parse(payload.messages[1].content);
  assert.equal(question.catalog.revision, input.catalog.revision);
  assert.equal(question.catalog.events[0].label, input.catalog.events[0].label);
  assert.equal(payload.model, 'openclaw/croupier-chat');
  assert.equal(payload.tool_choice, 'none');
  assert.equal(payload.user, 'croupier-lab-chat:studio-fixture-chat');
  assert.ok(payload.messages[0].content.includes('Chat cannot modify the catalog'));
  assert.deepEqual(await store.load(), before);
  assert.deepEqual(await readdir(directory), []);
});

test('invalid catalogs and unknown runtime inputs are rejected before either model endpoint', async t => {
  let called = false;
  const { base, directory } = await running(t, () => { called = true; assert.fail('Invalid studio request reached a model.'); });
  const invalidCatalog = studioBody();
  invalidCatalog.catalog.events[0].variants[0].when.all.push({ path: 'event.futureCard', op: 'eq', value: 'PRIVATE_FUTURE_CARD' });
  const invalidInput = studioBody(); invalidInput.input.event = { type: 'rng.choose' };
  for (const path of paths) {
    for (const body of [invalidCatalog, invalidInput, { ...studioBody(), catalog: null }]) {
      const response = await post(base, path, body);
      assert.equal(response.status, 400);
      const text = await response.text();
      assert.ok(!text.includes('PRIVATE_FUTURE_CARD'));
      assert.ok(!text.includes(directory));
    }
  }
  assert.equal(called, false);
  assert.deepEqual(await readdir(directory), []);
});

test('face-down card content is projected away before studio advice', async t => {
  const calls = [];
  const { base } = await running(t, stubGateway(calls));
  const input = studioBody();
  input.input.event = {
    type: 'deal', to: 'dealer', box: null, handIndex: null, faceDown: true,
    clip: { action: 'deal-dealer' }, card: { r: 'A', s: '♠' }, shoeDraw: 7,
    privateShoe: ['PRIVATE_FUTURE_CARD'],
  };
  const response = await post(base, '/api/studio/advice', input);
  assert.equal(response.status, 200);
  const opportunity = JSON.parse(calls[0].payload.messages[1].content);
  assert.equal(opportunity.event.card, null);
  assert.equal(opportunity.event.shoeDraw, 7);
  assert.ok(!JSON.stringify(opportunity).includes('PRIVATE_FUTURE_CARD'));
});

test('both studio endpoints retain foreign-origin and method rejection even with valid token', async t => {
  const { base } = await running(t, () => assert.fail('Rejected request reached a model.'));
  for (const path of paths) {
    assert.equal((await post(base, path, studioBody(), { ...auth, Origin: 'https://evil.example.test' })).status, 403);
    assert.equal((await fetch(base + path, { headers: auth })).status, 405);
  }
});

test('studio relay validates catalog and projects input before sending its own narrow token', async t => {
  let captured;
  const { base, directory, store } = await running(t, async (url, options) => {
    captured = { url: String(url), options, body: JSON.parse(options.body) };
    return Response.json({ advice: null, provider: { status: 'fixture-relay' } });
  }, { remoteUrl: 'https://remote.example.test', remoteToken: 'fixture-remote-token' });
  const before = await store.load();
  const input = studioBody();
  input.input.event = { ...input.input.event, privateShoe: ['PRIVATE_FUTURE_CARD'] };
  input.input.context.privatePlayer = 'PRIVATE_PLAYER';
  const response = await post(base, '/api/studio/advice', input);
  assert.equal(response.status, 200);
  assert.equal(captured.url, 'https://remote.example.test/api/studio/advice');
  assert.equal(captured.options.headers.Authorization, 'Bearer fixture-remote-token');
  assert.equal(captured.options.redirect, 'error');
  assert.ok(!captured.options.body.includes('PRIVATE_'));
  assert.ok(!captured.options.body.includes('fixture-gateway-key'));
  assert.equal(captured.body.catalog.revision, input.catalog.revision);
  assert.deepEqual(await store.load(), before);
  assert.deepEqual(await readdir(directory), []);
});
