import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresentationDirector } from '../lib/presentation-director.mjs';
import { presentationDecisionResponse } from '../lib/presentation-decision-http.mjs';
import { createSeedProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { simulateStudio } from '../lib/studio-server.mjs';
import { readSettings } from '../lib/director-settings.mjs';

const output = () => ({ decision: { reason: 'accepted' }, eligible: [{ id: 'standard' }], trace: [] });
const base = { requestId: 'decision-1', mode: 'active', sourceEvent: { type: 'speak', line: 'win' }, sourceRef: { kind: 'import', channel: 'partner/player 1', requestId: 'upstream-1', version: 4, presentationIndex: 2 } };

test('separately loaded route bundles share the process-level decision boundary', async () => {
  const a = await import('../lib/presentation-director.mjs?route=new');
  const b = await import('../lib/presentation-director.mjs?route=legacy');
  assert.equal(a.decidePresentation, b.decidePresentation);
});

test('parallel retries share one decision and cached callers cannot mutate the result', async () => {
  let calls = 0, finish;
  const decide = createPresentationDirector({ decide: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  const first = decide(base), retry = decide({ ...base });
  await Promise.resolve(); assert.equal(calls, 1); finish(output());
  const [a, b] = await Promise.all([first, retry]);
  assert.equal(a.decision.director.reused, false); assert.equal(b.decision.director.reused, true);
  assert.equal(a.decision.director.owner, 'openclaw'); assert.equal(a.decision.director.playbackConfirmed, false);
  assert.equal(a.decision.director.sourceRef.requestId, 'upstream-1');
  a.eligible[0].id = 'tampered';
  assert.equal((await decide(base)).eligible[0].id, 'standard');
  await assert.rejects(decide({ ...base, mode: 'off' }), error => error.statusCode === 409);
  const reordered = Object.fromEntries(Object.entries(base).reverse());
  assert.equal((await decide(reordered)).decision.director.reused, true);
  assert.equal(calls, 1);
});

test('bounded concurrency allows retries at capacity; failed jobs can be retried', async () => {
  let rejectJob, calls = 0;
  const decide = createPresentationDirector({ concurrency: 1, decide: () => { calls++; return new Promise((_resolve, reject) => { rejectJob = reject; }); } });
  const a = decide(base), b = decide(base);
  await assert.rejects(decide({ ...base, requestId: 'decision-2' }), error => error.statusCode === 429);
  rejectJob(new Error('fixture failure'));
  await Promise.all([assert.rejects(a), assert.rejects(b)]);
  const retry = decide(base); await Promise.resolve(); rejectJob(new Error('fixture retry'));
  await assert.rejects(retry); assert.equal(calls, 2);
});

test('completed cache is bounded and expires; a fresh manual request gets a fresh choice', async () => {
  let time = 0, calls = 0;
  const decide = createPresentationDirector({ now: () => time, capacity: 2, ttlMs: 10, decide: async () => { calls++; return output(); } });
  await decide(base); await decide({ ...base, requestId: 'decision-2' });
  await assert.rejects(decide({ ...base, requestId: 'decision-3' }), error => error.statusCode === 429);
  time = 10; await decide(base); assert.equal(calls, 3);
});

test('invalid identity or source provenance cannot reach the decision engine', async () => {
  const decide = createPresentationDirector({ decide: () => assert.fail('must validate first') });
  for (const body of [null, [], { ...base, requestId: '../key' }, { ...base, sourceRef: { kind: 'example' } }, { ...base, sourceRef: { kind: 'observed', version: -1 } }, { mode: 'off', sourceRef: { kind: 'import' } }, { ...base, sourceRef: { ...base.sourceRef, token: 'private' } }]) {
    await assert.rejects(decide(body), error => error.statusCode === 400);
  }
});

test('real engine fallback, rules and shadow have honest ownership; source references never enter model input', async () => {
  const project = createSeedProject(); let calls = 0;
  const settings = readSettings({ env: { OPENCLAW_BASE_URL: 'http://127.0.0.1:18789', OPENCLAWAPI_KEY: 'fixture' }, envFiles: [] });
  const decide = createPresentationDirector({ decide: body => simulateStudio(body, { settings, videoRegistry: { videos: [], families: [] }, fetchImpl: async (_url, options) => {
    calls++;
    assert.ok(!options.body.includes('private-correlation'));
    const opportunity = JSON.parse(JSON.parse(options.body).messages[1].content);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ requestId: opportunity.requestId, catalogRevision: opportunity.catalogRevision, variantId: 'astrid.speak.goodluck.standard' }) } }] });
  } }) });
  const body = { project, dealerId: 'astrid', eventId: 'speak.goodluck', context: {}, sourceRef: { kind: 'example', requestId: 'private-correlation' } };
  for (const [mode, owner] of [['off', 'baseline'], ['rules', 'rules'], ['random', 'random'], ['shadow', 'baseline'], ['active', 'openclaw']]) {
    const result = await decide({ ...body, mode, requestId: `decision-${mode}` });
    assert.equal(result.decision.director.owner, owner); assert.equal(result.decision.simulated, true);
  }
  assert.equal(calls, 2);
});

test('HTTP boundary enforces local JSON and preserves conflicts for both route adapters', async () => {
  const decide = createPresentationDirector({ decide: async () => output() });
  const request = (body, headers = {}) => new Request('http://127.0.0.1:4188/api/presentation/decision', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  assert.equal((await presentationDecisionResponse(request(base, { origin: 'https://foreign.test' }), decide)).status, 403);
  assert.equal((await presentationDecisionResponse(request(base, { 'content-length': '1048577' }), decide)).status, 413);
  assert.equal((await presentationDecisionResponse(request(base), decide)).status, 200);
  assert.equal((await presentationDecisionResponse(request({ ...base, mode: 'off' }), decide)).status, 409);
});
