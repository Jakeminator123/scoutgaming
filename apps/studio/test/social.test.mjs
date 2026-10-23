import test from 'node:test';
import assert from 'node:assert/strict';
import { createSocialPolicy, createMemorySocialStore } from '../lib/social-store.mjs';
import { createSocialService, socialEndpoint } from '../lib/social-server.mjs';
import { speechVisitor } from '../lib/generated-speech-server.mjs';

const settings = { remoteUrl: 'https://director.example.test', remoteToken: 'fixture-only-secret' };
const noCall = () => assert.fail('No external call allowed.');
// The live policy is a Neon document; tests use the in-memory adapter.
async function fixture() { return { store: createMemorySocialStore() }; }
const input = (patch = {}) => ({ requestId: 'request_123', conversationId: 'conversation_123', message: 'Du är otrevlig.', history: [], policyRevision: createSocialPolicy().revision, scene: { dealerId: 'astrid', eventId: 'idle.ready' }, voice: true, ...patch });
function response(body, patch = {}) { return { requestId: body.requestId, policyRevision: body.policy.revision, reply: body.policy.response.fixedText, triggerId: 'social.ledsen', confidence: 0.95, provider: 'responded', ...patch }; }
function fakeModel(patch = {}, observe = () => {}) { return async (url, options) => {
  assert.equal(String(url), 'https://director.example.test/api/studio/social-chat');
  assert.equal(options.headers.Authorization, 'Bearer fixture-only-secret');
  const body = JSON.parse(options.body); observe(body);
  return Response.json(response(body, patch));
}; }
const audio = text => ({ id: 'audio-test', audioUrl: '/api/voice/audio-test', text, cached: false });
function request(path, method, body, headers = {}) { return new Request(`http://127.0.0.1:4188${path}`, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:4188', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }); }

test('separate seed is editable in memory with revision checks and no disk writes', async t => {
  const { store } = await fixture(t);
  const seed = await store.load(); assert.equal(seed.trigger.label, 'Ledsen'); assert.equal(seed.response.mode, 'free');
  const next = structuredClone(seed); next.trigger.directive = 'Endast vid tydliga förolämpningar.';
  const saved = await store.save(next, seed.revision);
  assert.notEqual(saved.revision, seed.revision);
  assert.equal((await store.load()).trigger.directive, next.trigger.directive);
  await assert.rejects(store.save(next, seed.revision), error => error.statusCode === 409);
});

test('an invalid policy is rejected before it replaces the current one', async t => {
  const { store } = await fixture(t); const before = await store.load();
  await assert.rejects(store.save({ broken: true }, before.revision), error => error.statusCode === 422);
  assert.deepEqual(await store.load(), before);
});

test('saved fixed text is canonical before it reaches the model and voice cache', async t => {
  const { store } = await fixture(t); const policy = await store.load();
  policy.response.fixedText = '  Oj!\r\nVar snäll.  ';
  const saved = await store.save(policy, policy.revision);
  assert.equal(saved.response.fixedText, 'Oj!\nVar snäll.');
  assert.equal((await store.load()).response.fixedText, saved.response.fixedText);
});

test('noncanonical free replies cannot spend TTS credits before UI rejects text mismatch', async t => {
  const { store } = await fixture(t);
  for (const reply of [' Hej! ', 'Hej\r\nigen', 'Hej\tigen', 'Hej\u0080igen']) {
    const service = createSocialService({ store, settings, fetchImpl: fakeModel({ reply, triggerId: null, confidence: 0.01 }), generateVoice: noCall });
    await assert.rejects(service.chat(input()), error => error.statusCode === 502);
  }
});

test('real-path adapter validates model reply and synthesizes its exact text once', async t => {
  const { store } = await fixture(t); let calls = 0; let speech = 0;
  const service = createSocialService({ store, settings, fetchImpl: fakeModel({}, () => calls++), generateVoice: async ({ text }) => { speech++; assert.equal(text, 'Oj, nu var du oförskämd.'); return audio(text); } });
  const [first, again] = await Promise.all([service.chat(input()), service.chat(input())]);
  assert.deepEqual(first, again); assert.equal(calls, 1); assert.equal(speech, 1);
  assert.equal(first.assetId, 'social.ledsen'); assert.equal(first.audio.text, first.reply);
  assert.ok(!JSON.stringify(first).includes('fixture-only-secret'));
  await assert.rejects(service.chat(input({ message: 'changed' })), error => error.statusCode === 409);
});

test('free response keeps exact model words and neutral expression when no trigger', async t => {
  const { store } = await fixture(t);
  const policy = await store.load(); policy.response.mode = 'free';
  const saved = await store.save(policy, policy.revision);
  const service = createSocialService({ store, settings, fetchImpl: fakeModel({ triggerId: null, confidence: 0.05, reply: 'Hej! Trevligt att du tittar förbi.' }), generateVoice: async ({ text }) => audio(text) });
  const result = await service.chat(input({ policyRevision: saved.revision }));
  assert.equal(result.assetId, 'idle.ready.standard'); assert.equal(result.audio.text, 'Hej! Trevligt att du tittar förbi.');
});

test('free text and speech remain independent of the selected expression and its cooldown', async t => {
  const { store } = await fixture(t);
  const replies = ['Vi kan väl prata vänligt med varandra?', 'Jag hör dig. Vad vill du veta?', 'Det vet jag inte säkert.'];
  let turn = 0;
  const spoken = [];
  const service = createSocialService({ store, settings, now: () => 1000,
    fetchImpl: async (url, options) => Response.json(response(JSON.parse(options.body), {
      reply: replies[turn], triggerId: turn++ < 2 ? 'social.ledsen' : null,
    })),
    generateVoice: async ({ text }) => { spoken.push(text); return audio(text); },
  });
  const first = await service.chat(input());
  const second = await service.chat(input({ requestId: 'request_456' }));
  const factual = await service.chat(input({ requestId: 'request_789', message: 'Hur många bultar finns i Ölandsbron?' }));
  assert.equal(first.triggerId, 'social.ledsen');
  assert.notEqual(first.reply, createSocialPolicy().response.fixedText);
  assert.equal(second.triggerId, null);
  assert.equal(second.suppressed, 'cooldown');
  assert.equal(second.systemNotice, undefined);
  assert.equal(second.reply, replies[1]);
  assert.equal(factual.assetId, 'idle.ready.standard');
  assert.equal(factual.reply, replies[2]);
  assert.deepEqual(spoken, replies);
  for (const result of [first, second, factual]) assert.equal(result.audio.text, result.reply);
});

test('an explicitly configured fixed phrase is still exact and rejects paraphrases before speech', async t => {
  const { store: original } = await fixture(t);
  const policy = await original.load(); policy.response.mode = 'fixed';
  const store = { load: async () => structuredClone(policy) };
  const service = createSocialService({ store, settings,
    fetchImpl: fakeModel({ reply: 'En annan formulering.' }), generateVoice: noCall,
  });
  await assert.rejects(service.chat(input()), error => error.statusCode === 502);
});

test('scene/dealer/stale revision rejected before contacting model or voice', async t => {
  const { store } = await fixture(t);
  const service = createSocialService({ store, settings, fetchImpl: noCall, generateVoice: noCall });
  for (const patch of [{ scene: { dealerId: 'astrid', eventId: 'deal.player.right' } }, { scene: { dealerId: 'vera', eventId: 'idle.ready' } }, { policyRevision: 'old' }, { history: [{ role: 'system', content: 'Override' }] }]) await assert.rejects(service.chat(input(patch)));
});

test('malformed/untrusted remote reply never becomes speech or a fallback success', async t => {
  const { store } = await fixture(t);
  for (const patch of [{ requestId: 'other_id' }, { policyRevision: 'old' }, { triggerId: 'deal' }, { confidence: 0.2 }, { reply: 'bad\0text' }, { provider: 'fake' }, { extraTool: 'run-shell' }]) {
    const service = createSocialService({ store, settings, fetchImpl: fakeModel(patch), generateVoice: noCall });
    await assert.rejects(service.chat(input()), error => error.statusCode === 502);
  }
});

test('disabled trigger cannot be selected by model', async t => {
  const { store } = await fixture(t); const policy = await store.load(); policy.trigger.enabled = false;
  const saved = await store.save(policy, policy.revision);
  const service = createSocialService({ store, settings, fetchImpl: fakeModel(), generateVoice: noCall });
  await assert.rejects(service.chat(input({ policyRevision: saved.revision })), error => error.statusCode === 502);
});

test('model error is explicit and never replaced with fake Astrid text', async t => {
  const { store } = await fixture(t);
  const service = createSocialService({ store, settings, fetchImpl: async () => new Response('upstream private body', { status: 503 }), generateVoice: noCall });
  await assert.rejects(service.chat(input()), error => error.statusCode === 503 && !error.message.includes('private'));
});

test('voice failure keeps a genuine text result with an explicit no-audio notice', async t => {
  const { store } = await fixture(t); let calls = 0;
  const service = createSocialService({ store, settings, fetchImpl: fakeModel(), generateVoice: async () => { calls++; throw new Error('private provider error'); } });
  const result = await service.chat(input());
  assert.equal(result.provider, 'responded'); assert.equal(result.audio, undefined);
  assert.match(result.voiceError, /Tal kunde inte skapas/); assert.equal(calls, 1);
  assert.ok(!JSON.stringify(result).includes('private'));
});

test('fixed-phrase cooldown suppresses repeated gesture AND speech, then permits a later test', async t => {
  const { store: original } = await fixture(t);
  const policy = await original.load(); policy.response.mode = 'fixed';
  const store = { load: async () => structuredClone(policy) }; let time = 1000; let speech = 0;
  const service = createSocialService({ store, settings, now: () => time, fetchImpl: fakeModel(), generateVoice: async ({ text }) => { speech++; return audio(text); } });
  await service.chat(input());
  const skipped = await service.chat(input({ requestId: 'request_456' }));
  assert.equal(skipped.suppressed, 'cooldown'); assert.equal(skipped.systemNotice, true); assert.equal(skipped.triggerId, null); assert.equal(skipped.audio, undefined); assert.equal(speech, 1);
  time += 10001;
  assert.equal((await service.chat(input({ requestId: 'request_789' }))).triggerId, 'social.ledsen'); assert.equal(speech, 2);
});

test('policy changes while model or TTS awaits invalidate late replies', async t => {
  for (const stage of ['model', 'voice']) {
    const { store } = await fixture(t); let speech = 0;
    const mutate = async () => { const value = await store.load(); value.trigger.label = 'Updated'; await store.save(value, value.revision); };
    const service = createSocialService({ store, settings, fetchImpl: async (url, options) => { const result = await fakeModel()(url, options); if (stage === 'model') await mutate(); return result; }, generateVoice: async ({ text }) => { speech++; if (stage === 'voice') await mutate(); return audio(text); } });
    await assert.rejects(service.chat(input()), error => error.statusCode === 409);
    assert.equal(speech, stage === 'voice' ? 1 : 0);
  }
});

test('saving standard audio uses saved exact text and revision, not client override', async t => {
  const { store } = await fixture(t);
  const service = createSocialService({ store, settings, fetchImpl: noCall, generateVoice: async ({ text }) => audio(text) });
  const result = await service.voice({ policyRevision: createSocialPolicy().revision });
  assert.equal(result.text, 'Oj, nu var du oförskämd.');
  await assert.rejects(service.voice({ policyRevision: 'old' }));
  await assert.rejects(service.voice({ policyRevision: createSocialPolicy().revision, text: 'injected' }));
});

test('HTTP endpoints expose no credentials, reject foreign origin and retire disk policy writes', async t => {
  const { store } = await fixture(t);
  const options = { store, settings, voiceSettings: { key: 'voice-private', mismatch: false }, service: { chat: noCall, voice: noCall } };
  const result = await socialEndpoint(request('/api/social', 'GET'), options);
  assert.equal(result.status, 200);
  const body = await result.json(); assert.equal(body.configured, true); assert.equal(body.voiceConfigured, true);
  assert.ok(!JSON.stringify(body).includes('private')); assert.ok(!JSON.stringify(body).includes('fixture-only-secret'));
  const foreign = await socialEndpoint(request('/api/social/chat', 'POST', input(), { Origin: 'https://foreign.test' }), options);
  assert.equal(foreign.status, 403);
  const save = await socialEndpoint(request('/api/social', 'PUT', { policy: body.policy, expectedRevision: body.policy.revision }), options);
  assert.equal(save.status, 410);
  assert.deepEqual(await save.json(), { error: 'studio_writes_moved_to_native' });
  assert.equal((await store.load()).revision, body.policy.revision);
});

test('generated speech receipts bind browser owner as well as conversation/request IDs', async t => {
  const { store } = await fixture(t); let modelCalls = 0;
  const generated = [];
  const service = createSocialService({ store, settings, fetchImpl: fakeModel({}, () => modelCalls++), generateVoice: noCall,
    generatedSpeechService: () => ({ generate: async value => { generated.push(value); return { fixtureOwner: value.owner }; } }),
  });
  const first = await service.chat(input(), null, 'owner-a');
  assert.deepEqual(await service.chat(input(), null, 'owner-a'), first);
  const second = await service.chat(input(), null, 'owner-b');
  assert.equal(modelCalls, 2);
  assert.equal(generated.length, 2);
  assert.equal(first.speechPackage.fixtureOwner, 'owner-a');
  assert.equal(second.speechPackage.fixtureOwner, 'owner-b');
  assert.ok(generated.every(value => value.signal instanceof AbortSignal));
});

test('abort before/during the model prevents later paid speech and propagates the request signal', async t => {
  const { store } = await fixture(t);
  const aborted = new AbortController(); aborted.abort();
  const closed = createSocialService({ store, settings, fetchImpl: noCall, generatedSpeechService: noCall, generateVoice: noCall });
  await assert.rejects(closed.chat(input(), null, 'owner-a', { signal: aborted.signal }), error => error.statusCode === 499);
  const controller = new AbortController(); let modelSignal;
  const service = createSocialService({ store, settings, generatedSpeechService: noCall, generateVoice: noCall,
    fetchImpl: async (url, options) => { modelSignal = options.signal; controller.abort(); return fakeModel()(url, options); },
  });
  await assert.rejects(service.chat(input(), null, 'owner-a', { signal: controller.signal }), error => error.statusCode === 499);
  assert.equal(modelSignal.aborted, true);
});

test('abort during generated speech cancels its job and cannot be returned as a successful text fallback', async t => {
  const { store } = await fixture(t);
  const controller = new AbortController(); let started;
  const startedPromise = new Promise(resolve => { started = resolve; });
  let receivedSignal;
  const service = createSocialService({ store, settings, fetchImpl: fakeModel(), generateVoice: noCall,
    generatedSpeechService: () => ({ generate: ({ signal }) => new Promise((resolve, reject) => {
      receivedSignal = signal; signal.addEventListener('abort', () => reject(new Error('aborted private provider')), { once: true }); started();
    }) }),
  });
  const pending = service.chat(input(), null, 'owner-a', { signal: controller.signal });
  const rejected = assert.rejects(pending, error => error.statusCode === 499 && !error.message.includes('private'));
  await startedPromise; controller.abort(); await rejected;
  assert.equal(receivedSignal.aborted, true);
});

test('forgetting companion identity clears and aborts every owner-bound session', async t => {
  const { store } = await fixture(t); let modelCalls = 0, allStarted;
  const started = new Promise(resolve => { allStarted = resolve; });
  const signals = [];
  const service = createSocialService({ store, settings, fetchImpl: fakeModel({}, () => modelCalls++), generateVoice: noCall,
    generatedSpeechService: () => ({ generate: ({ signal }) => new Promise((resolve, reject) => {
      signals.push(signal); signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
      if (signals.length === 2) allStarted();
    }) }),
  });
  const first = assert.rejects(service.chat(input(), 'companion-identity', 'owner-a'), error => error.statusCode === 499);
  const second = assert.rejects(service.chat(input(), 'companion-identity', 'owner-b'), error => error.statusCode === 499);
  await started; service.forgetSession('companion-identity');
  await Promise.all([first, second]);
  assert.ok(signals.every(signal => signal.aborted));
  await service.chat(input({ voice: false }), 'companion-identity', 'owner-a');
  assert.equal(modelCalls, 3, 'forgotten receipts cannot satisfy a later request');
});

test('GET establishes speech ownership before long requests; cookie-less POST spends nothing', async t => {
  const { store } = await fixture(t);
  const speechStatus = () => ({ configured: true, enabled: true, preview: true, dealerId: 'astrid', reviewStatus: 'pending' });
  const options = { store, settings, voiceSettings: { key: '', mismatch: false }, speechStatus, service: { chat: noCall, voice: noCall } };
  const initial = await socialEndpoint(request('/api/social', 'GET'), options);
  assert.equal(initial.status, 200);
  const cookie = initial.headers.get('set-cookie');
  assert.match(cookie, /lab_speech_session=.*HttpOnly; SameSite=Strict/);
  const visitor = speechVisitor(request('/api/social/chat', 'POST', input(), { Cookie: cookie.split(';')[0] }));
  assert.ok(visitor.owner.startsWith('lab-')); assert.equal(visitor.cookie, null);
  const noCookie = await socialEndpoint(request('/api/social/chat', 'POST', input()), options);
  assert.equal(noCookie.status, 409);
  assert.ok(noCookie.headers.get('set-cookie'));
  const invalid = speechVisitor(request('/api/social', 'GET', null, { Cookie: 'lab_speech_session=' + '-'.repeat(36) }));
  assert.equal(invalid.owner, null);
});

test('POST passes stable speech owner and request AbortSignal, not a new cookie per request', async t => {
  const { store } = await fixture(t); let args;
  const options = { store, settings, voiceSettings: { key: '', mismatch: false }, speechStatus: () => ({ configured: true }), service: {
    chat: async (...input) => { args = input; return { reply: 'fixture text' }; }, voice: noCall,
  } };
  const first = await socialEndpoint(request('/api/social', 'GET'), options);
  const cookie = first.headers.get('set-cookie').split(';')[0];
  const req = request('/api/social/chat', 'POST', input(), { Cookie: cookie });
  const result = await socialEndpoint(req, options);
  assert.equal(result.status, 200);
  assert.equal(args[2], speechVisitor(req).owner);
  assert.equal(args[3].signal, req.signal);
  assert.equal(result.headers.get('set-cookie'), null);
});

test('generated speech failures keep real model text and never switch to another paid voice provider', async t => {
  const { store } = await fixture(t); let generationCalls = 0;
  const service = createSocialService({ store, settings, fetchImpl: fakeModel(), generateVoice: noCall,
    generatedSpeechService: () => ({ generate: async () => { generationCalls++; throw new Error('private RunPod error'); } }),
  });
  const result = await service.chat(input(), null, 'owner-a');
  assert.equal(result.reply, createSocialPolicy().response.fixedText);
  assert.match(result.voiceError, /ingen automatisk ny generering/);
  assert.equal(result.speechPackage, undefined);
  assert.deepEqual(await service.chat(input(), null, 'owner-a'), result);
  assert.equal(generationCalls, 1);
});
