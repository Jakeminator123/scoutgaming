import assert from 'node:assert/strict';
import test from 'node:test';
import { readSettings } from '../../open-claw/lab/src/settings.mjs';
import { createSeedProject } from '../lib/studio-model.mjs';
import * as server from '../lib/studio-server.mjs';

// Never read the operator's .env or contact an actual model/Gateway in these tests.
const settings = (env = {}) => readSettings({ env, envFiles: [] });
const directSettings = () => settings({ OPENCLAW_BASE_URL: 'http://127.0.0.1:18789', OPENCLAWAPI_KEY: 'fixture-gateway-secret' });
const remoteSettings = (url = 'https://director.example.test') => settings({ LAB_REMOTE_URL: url, LAB_REMOTE_TOKEN: 'fixture-relay-secret' });
const germanReturn = { playerHistory: { returning: true, preferredLanguage: 'de' } };
const baselineId = 'astrid.speak.goodluck.standard';
const contextualId = 'astrid.speak.goodluck.contextual';
const videoId = 'c01866d1-7c93-43a4-9493-73f7c66d3725';
const registry = { videos: [{ id: videoId, classification: { label: 'Goodluck', dealerId: 'astrid', eventId: 'speak.goodluck', kind: 'speech', role: 'standard', situation: 'goodluck', notes: '' }, available: false, fileName: `${videoId}.mp4`, verdict: 'want', reviewStatus: 'unreviewed', bindingScope: 'lab-only' }], summary: {} };
function body(patch = {}) {
  return { project: createSeedProject(), dealerId: 'astrid', eventId: 'speak.goodluck', mode: 'active', context: germanReturn, ...patch };
}
function noFetch() { assert.fail('This test must not issue a network request.'); }
function gateway(answer = value => ({ requestId: value.requestId, catalogRevision: value.catalogRevision, variantId: contextualId }), capture = []) {
  return async (url, options) => {
    const payload = JSON.parse(options.body);
    capture.push({ url: String(url), options, payload });
    const opportunity = JSON.parse(payload.messages[1].content);
    return Response.json({ choices: [{ message: { content: JSON.stringify(answer(opportunity)) } }] });
  };
}

test('rules select highest-priority eligible variant with no model request', async () => {
  const result = await server.simulateStudio(body({ mode: 'rules' }), { settings: directSettings(), fetchImpl: noFetch });
  assert.equal(result.variant.id, contextualId);
  assert.equal(result.provider, 'deterministic_rules');
  assert.equal(result.decision.reason, 'deterministic_rules');
  assert.ok(result.trace.some(step => step.stage === 'rules'));
  const neutral = await server.simulateStudio(body({ mode: 'rules', context: {} }), { settings: directSettings(), fetchImpl: noFetch });
  assert.equal(neutral.variant.id, baselineId);
});

test('off always uses baseline without calling configured OpenClaw', async () => {
  const result = await server.simulateStudio(body({ mode: 'off' }), { settings: directSettings(), fetchImpl: noFetch });
  assert.equal(result.variant.id, baselineId);
  assert.equal(result.decision.reason, 'ai_disabled');
});

test('shadow validates advice but keeps baseline, active accepts only eligible choice', async () => {
  const shadow = await server.simulateStudio(body({ mode: 'shadow' }), { settings: directSettings(), fetchImpl: gateway() });
  assert.equal(shadow.variant.id, baselineId);
  assert.equal(shadow.decision.reason, 'shadow_only');
  const active = await server.simulateStudio(body(), { settings: directSettings(), fetchImpl: gateway() });
  assert.equal(active.variant.id, contextualId);
  assert.equal(active.decision.reason, 'accepted');
  assert.equal(active.decision.simulated, true);
});

test('unknown, cross-dealer, stale-revision, wrong-request and expanded advice cannot select a variant', async () => {
  for (const [patch, expectedReason] of [
    [{ variantId: 'unknown.variant' }, 'ineligible_variant'],
    [{ variantId: 'vera.speak.goodluck.contextual' }, 'ineligible_variant'],
    [{ catalogRevision: 'old-catalog' }, 'catalog_mismatch'],
    [{ requestId: 'old-request' }, 'request_mismatch'],
    [{ assetId: 'untrusted-video' }, 'no_advice'],
  ]) {
    const result = await server.simulateStudio(body(), { settings: directSettings(), fetchImpl: gateway(value => ({ requestId: value.requestId, catalogRevision: value.catalogRevision, variantId: contextualId, ...patch })) });
    assert.equal(result.variant.id, baselineId, JSON.stringify(patch));
    assert.equal(result.decision.reason, expectedReason, JSON.stringify(patch));
  }
  const ineligible = await server.simulateStudio(body({ context: {} }), { settings: directSettings(), fetchImpl: gateway() });
  assert.equal(ineligible.variant.id, baselineId);
  assert.equal(ineligible.decision.reason, 'ineligible_variant');
});

test('full draft fingerprint changes for video bindings, line labels and unused trigger edits', () => {
  const original = createSeedProject();
  const first = server.decisionCatalog(original, 'astrid').revision;
  for (const change of [
    project => { project.lines[0].variants[0].videoGenerationId = videoId; },
    project => { project.lines[0].label = 'Ändrad standardlinje'; },
    project => { project.triggers[0].label = 'Ny triggeretikett'; },
  ]) {
    const project = structuredClone(original); change(project);
    assert.notEqual(server.decisionCatalog(project, 'astrid').revision, first);
    assert.equal(project.revision, original.revision, 'An unsaved draft need not change saved revision.');
  }
  assert.notEqual(server.decisionCatalog(original, 'vera').revision, first);
  assert.equal(server.decisionCatalog(structuredClone(original), 'astrid').revision, first);
});

test('missing model configuration falls back without issuing a request or exposing secrets', async () => {
  const result = await server.simulateStudio(body(), { settings: settings(), fetchImpl: noFetch });
  assert.equal(result.variant.id, baselineId);
  assert.equal(result.provider, 'openclaw_not_configured');
  const status = server.connectionStatus(directSettings());
  assert.equal(status.configured, true);
  assert.ok(!JSON.stringify(status).includes('fixture-gateway-secret'));
  assert.ok(!JSON.stringify(status).includes('18789'));
});

test('advice receives projected context and eligible IDs, not private data, money or credentials', async () => {
  const captured = [];
  const context = {
    ...germanReturn,
    playerHistory: { ...germanReturn.playerHistory, privateUserId: 'PRIVATE_PLAYER' },
    chat: { signal: 'praise', text: 'PRIVATE_CHAT' },
    session: { recentWins: 3, wallet: 'PRIVATE_WALLET' },
    futureCards: ['PRIVATE_CARD'], password: 'PRIVATE_PASSWORD',
  };
  const result = await server.simulateStudio(body({ context, apiKey: 'PRIVATE_KEY' }), { settings: directSettings(), fetchImpl: gateway(undefined, captured) });
  assert.equal(result.decision.reason, 'accepted');
  const sent = JSON.stringify(captured[0].payload);
  assert.ok(!sent.includes('PRIVATE_'));
  assert.ok(!sent.includes('fixture-gateway-secret'));
  assert.equal(captured[0].payload.tool_choice, 'none');
  assert.equal(captured[0].options.redirect, 'error');
  const opportunity = JSON.parse(captured[0].payload.messages[1].content);
  assert.equal(opportunity.context.playerHistory.returning, true);
  assert.ok(opportunity.candidates.every(item => item.variantId.startsWith('astrid.speak.goodluck.')));
  assert.ok(!JSON.stringify(result).includes('PRIVATE_'));
});

test('remote relay carries bounded draft and projected input; credentials remain headers only', async () => {
  let captured;
  const result = await server.simulateStudio(body({ context: { ...germanReturn, password: 'PRIVATE_PASSWORD' } }), {
    settings: remoteSettings(),
    fetchImpl: async (url, options) => {
      captured = { url: String(url), options, payload: JSON.parse(options.body) };
      return Response.json({ advice: { requestId: captured.payload.input.requestId, catalogRevision: captured.payload.catalog.revision, variantId: contextualId }, provider: { status: 'responded' } });
    },
  });
  assert.equal(result.decision.reason, 'accepted');
  assert.equal(captured.url, 'https://director.example.test/api/studio/advice');
  assert.equal(captured.options.headers.Authorization, 'Bearer fixture-relay-secret');
  assert.equal(captured.options.redirect, 'error');
  assert.ok(!JSON.stringify(captured.payload).includes('PRIVATE_PASSWORD'));
  assert.ok(!JSON.stringify(captured.payload).includes('fixture-relay-secret'));
  assert.ok(!JSON.stringify(result).includes('fixture-relay-secret'));
});

test('foreign HTTP, URL credentials and URL query cannot receive relay token', async () => {
  for (const url of ['http://director.example.test', 'https://user:password@director.example.test', 'https://director.example.test?token=x']) {
    const result = await server.simulateStudio(body(), { settings: remoteSettings(url), fetchImpl: noFetch });
    assert.equal(result.variant.id, baselineId);
    assert.equal(result.provider, 'remote_unavailable_baseline');
  }
});

test('remote failures and stale advice retain safe baseline without reflecting remote error bodies', async () => {
  const unavailable = await server.simulateStudio(body(), {
    settings: remoteSettings(), fetchImpl: async () => new Response('PRIVATE_UPSTREAM_KEY', { status: 500 }),
  });
  assert.equal(unavailable.variant.id, baselineId);
  assert.ok(!JSON.stringify(unavailable).includes('PRIVATE_UPSTREAM_KEY'));
  const stale = await server.simulateStudio(body(), { settings: remoteSettings(), fetchImpl: async () => Response.json({ advice: { requestId: 'stale', catalogRevision: 'stale', variantId: contextualId }, provider: { status: 'responded' } }) });
  assert.equal(stale.variant.id, baselineId);
  assert.equal(stale.decision.reason, 'request_mismatch');
});

test('video bindings must reference inventory IDs; known unavailable originals can remain references', async () => {
  const project = createSeedProject();
  project.lines[0].variants[0].videoGenerationId = videoId;
  await server.validateVideoBindings(project, { registry });
  const result = await server.simulateStudio(body({ project, mode: 'off' }), { settings: settings(), fetchImpl: noFetch, videoRegistry: registry });
  assert.equal(result.videoGenerationId, videoId);
  assert.equal(result.variant.id, baselineId);
  const bad = structuredClone(project);
  bad.lines[0].variants[0].videoGenerationId = '00000000-0000-0000-0000-000000000000';
  await assert.rejects(async () => server.validateVideoBindings(bad, { registry }), error => error.statusCode >= 400 && error.statusCode < 500);
  await assert.rejects(server.simulateStudio(body({ project: bad, mode: 'off' }), { settings: settings(), fetchImpl: noFetch, videoRegistry: registry }), error => error.statusCode >= 400 && error.statusCode < 500);
});

test('chat validates input, cannot mutate catalog and uses no model tools', async () => {
  const project = createSeedProject();
  const original = JSON.stringify(project);
  let captured;
  const result = await server.studioChat({ dealerId: 'astrid', message: 'Förklara mitt eventträd.', conversationId: 'fixture-chat-123' }, {
    project, settings: directSettings(), fetchImpl: async (_url, options) => {
      captured = JSON.parse(options.body);
      return Response.json({ choices: [{ message: { content: 'Du har en skyddad standardlinje.' } }] });
    },
  });
  assert.equal(result.reply, 'Du har en skyddad standardlinje.');
  assert.equal(captured.tool_choice, 'none');
  assert.equal(JSON.stringify(project), original);
  assert.ok(!JSON.stringify(result).includes('fixture-gateway-secret'));
  await assert.rejects(server.studioChat({ dealerId: 'astrid', message: '', conversationId: 'fixture-chat-123' }, { project, settings: settings(), fetchImpl: noFetch }), error => error.statusCode === 400);
});
