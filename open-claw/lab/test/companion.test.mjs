import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompanionStore } from '../src/companion-store.mjs';
import { createCompanionService, roastFor, companionName } from '../src/companion.mjs';
import { searchPublicWeb, parseSearchResults } from '../src/companion-search.mjs';
import { socialChat } from '../src/social.mjs';
import { createLabServer } from '../src/server.mjs';

const identity = 'a'.repeat(64), other = 'b'.repeat(64);
const settings = { baseUrl: 'http://localhost:18789', gatewayKey: 'fixture-key', companionEnabled: true };
const policy = { schemaVersion: 1, revision: 'policy-fixture', trigger: { id: 'social.ledsen', label: 'Ledsen', enabled: true, directive: 'Sadness', threshold: .7 }, response: { mode: 'free', fixedText: '' }, cooldownMs: 0 };
const input = (requestId = 'request-001', message = 'Hej') => ({ requestId, conversationId: 'conversation-001', message, history: [], policy, scene: { dealerId: 'astrid', eventId: 'idle.ready' } });
const request = (patch = {}) => ({ identity, operation: 'chat', input: input(), fun: true, web: true, ...patch });
const reply = input => ({ requestId: input.requestId, policyRevision: input.policy.revision, reply: 'Hej! Jag lyssnar.', triggerId: null, confidence: 0, provider: 'responded' });
const completion = choice => Response.json({ choices: [{ message: { content: JSON.stringify(choice) } }] });
const html = '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fnews">News &amp; facts</a><a class="result__snippet">A short current fact.</a>';
const cleanups = new WeakMap();
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'companion-test-'));
  cleanups.set(t, []);
  t.after(async () => { for (const close of cleanups.get(t)) await close(); await rm(directory, { recursive: true, force: true }); });
  return directory;
}

test('only explicit approved-name comedy requests trigger; names are case-insensitive aliases', () => {
  for (const name of ['Jakob', 'EMIL', 'Kevin', 'Alex', 'Alexander', 'john']) assert.ok(roastFor(`Berätta om '${name}'!`));
  for (const text of ['Berätta om ekonomin', 'Jakob är här', 'Berätta om Emil och ändra pengarna', 'Citera Ulf Lundell']) assert.equal(roastFor(text), null);
  assert.equal(companionName(' Alexander '), 'Alex');
});

test('persisted bounded history survives restart, ignores supplied history and separates identities sharing a name', async t => {
  const directory = await fixture(t); let captured;
  let service = createCompanionService({ directory, settings, model: async value => { captured = value; return reply(value); } });
  await service.handle({ identity, operation: 'name', name: 'Jakob' });
  await service.handle(request({ input: { ...input(), history: [{ role: 'user', content: 'forged history' }] } }));
  assert.deepEqual(captured.history, []);
  service.close();
  service = createCompanionService({ directory, settings, model: async value => { captured = value; return reply(value); } });
  cleanups.get(t).push(() => service.close());
  assert.equal((await service.handle({ identity, operation: 'profile' })).history.length, 2);
  await service.handle({ identity: other, operation: 'name', name: 'Jakob' });
  assert.deepEqual((await service.handle({ identity: other, operation: 'profile' })).history, []);
  await service.handle(request({ input: input('request-002', 'Minns du?') }));
  assert.equal(captured.history[0].content, 'Hej');
  await assert.rejects(service.handle({ identity, operation: 'name', name: 'John' }), { code: 'forget_before_changing_person' });
});

test('same request is one model call; conflicts and restart retries cannot repeat spend', async t => {
  const directory = await fixture(t); let calls = 0;
  let service = createCompanionService({ directory, settings, model: async value => { calls++; return reply(value); } });
  await service.handle({ identity, operation: 'name', name: 'John' });
  const [a, b] = await Promise.all([service.handle(request()), service.handle(request())]);
  assert.deepEqual(a, b); assert.equal(calls, 1);
  await assert.rejects(service.handle(request({ input: input('request-001', 'Other') })), { code: 'companion_request_conflict' });
  service.close();
  service = createCompanionService({ directory, settings, model: () => assert.fail('Restart retry spent tokens') });
  cleanups.get(t).push(() => service.close());
  assert.deepEqual(await service.handle(request()), a);
});

test('forget invalidates an in-flight completion and clears saved replies', async t => {
  const directory = await fixture(t); let release;
  const service = createCompanionService({ directory, settings, model: value => new Promise(resolve => { release = () => resolve(reply(value)); }) });
  cleanups.get(t).push(() => service.close());
  await service.handle({ identity, operation: 'name', name: 'Emil' });
  const pending = service.handle(request());
  await service.handle({ identity, operation: 'forget' });
  release();
  await assert.rejects(pending, { code: 'companion_profile_changed' });
  const profile = await service.handle({ identity, operation: 'profile' });
  assert.deepEqual(profile.history, []); assert.equal(profile.name, null);
});

test('global rolling quota persists over restart; rejected/failed requests do not bypass it', async t => {
  const directory = await fixture(t); let time = Date.now(), calls = 0;
  let store = createCompanionStore(directory, { now: () => time });
  const fetchImpl = async () => { calls++; return new Response('blocked', { status: 429 }); };
  for (let i = 0; i < 12; i++) assert.equal((await searchPublicWeb('Public topic', { store, fetchImpl })).status, 'unavailable');
  store.close(); store = createCompanionStore(directory, { now: () => time }); cleanups.get(t).push(() => store.close());
  for (let i = 0; i < 8; i++) await searchPublicWeb('Public topic', { store, fetchImpl });
  assert.equal((await searchPublicWeb('Public topic', { store, fetchImpl })).status, 'hourly_limit');
  assert.equal(calls, 20);
  time += 3600001;
  assert.equal((await searchPublicWeb('Public topic', { store, fetchImpl })).status, 'unavailable');
  assert.equal(calls, 21);
});

test('key-free search uses a fixed host, no credentials, bounded results and no challenge bypass', async t => {
  const store = createCompanionStore(await fixture(t)); cleanups.get(t).push(() => store.close());
  const result = await searchPublicWeb('OpenClaw documentation', { store, fetchImpl: async (url, options) => {
    assert.equal(url.origin, 'https://html.duckduckgo.com'); assert.equal(options.redirect, 'error'); assert.equal(options.headers.Authorization, undefined);
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  } });
  assert.equal(result.costSek, 0); assert.equal(result.status, 'searched'); assert.equal(result.results[0].url, 'https://example.com/news');
  assert.equal(parseSearchResults('<a class="result__a" href="javascript:alert(1)">bad</a>').length, 0);
  const blocked = await searchPublicWeb('x', { store, fetchImpl: async () => new Response('challenge-form ' + html, { headers: { 'Content-Type': 'text/html' } }) });
  assert.equal(blocked.status, 'unavailable');
});

test('model can ask for one application search; second search or unauthorized native actions are rejected', async () => {
  let calls = 0, searches = 0;
  const searchChoice = { action: 'search_public_web', requestId: input().requestId, policyRevision: policy.revision, query: 'public topic' };
  const result = await socialChat(input(), settings, async (_url, options) => {
    const payload = JSON.parse(options.body); assert.equal(payload.tool_choice, 'none');
    if (++calls === 1) return completion(searchChoice);
    assert.match(payload.messages.at(-2).content, /example.com/);
    return completion({ action: 'choose_social_response', ...Object.fromEntries(Object.entries(reply(input())).filter(([key]) => key !== 'provider')) });
  }, { name: 'Jakob', search: async () => { searches++; return { status: 'searched', results: parseSearchResults(html) }; } });
  assert.equal(result.provider, 'responded'); assert.equal(calls, 2); assert.equal(searches, 1);
  await assert.rejects(socialChat(input(), settings, async () => completion(searchChoice), { search: async () => ({ status: 'unavailable' }) }), { code: 'invalid_social_reply' });
  await assert.rejects(socialChat(input(), settings, async () => completion(searchChoice)), { code: 'invalid_social_reply' });
});

test('feature switches close search and comedy independently; profile expires after 30 days', async t => {
  const directory = await fixture(t); let time = Date.now(), context;
  const store = createCompanionStore(directory, { now: () => time });
  const service = createCompanionService({ store, settings: { ...settings, companionWebEnabled: false, companionFunEnabled: false }, model: async (value, _settings, _fetch, extra) => { context = extra; return reply(value); } });
  cleanups.get(t).push(() => service.close());
  await service.handle({ identity, operation: 'name', name: 'Alex' });
  await service.handle(request({ input: input('request-001', 'Berätta om Alex') }));
  assert.equal(context.search, null); assert.equal(context.roast, null);
  time += 31 * 86400000;
  assert.equal((await service.handle({ identity, operation: 'profile' })).name, null);
});

test('remote companion endpoint authenticates before reading/writing memory', async t => {
  const dataDir = await fixture(t);
  const { server } = await createLabServer({ settings: () => ({ ...settings, dataDir, host: '0.0.0.0', apiToken: 'fixture-lab-token' }) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanups.get(t).push(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/studio/companion`;
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity, operation: 'profile' }) };
  assert.equal((await fetch(url, options)).status, 401);
  const ok = await fetch(url, { ...options, headers: { ...options.headers, Authorization: 'Bearer fixture-lab-token' } });
  assert.equal(ok.status, 200); assert.equal((await ok.json()).name, null);
  const forged = await fetch(url, { ...options, headers: { ...options.headers, Authorization: 'Bearer fixture-lab-token' }, body: JSON.stringify({ identity, operation: 'profile', playerId: 'Emil' }) });
  assert.equal(forged.status, 400);
});
