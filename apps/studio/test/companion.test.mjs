import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { labCompanionIdentity } from '../lib/companion-server.mjs';
import { createSocialService, socialEndpoint } from '../lib/social-server.mjs';
import { createSocialStore } from '../lib/social-store.mjs';

const settings = { remoteUrl: 'https://director.example.test', remoteToken: 'fixture-remote-token', companionEnabled: true };
const request = (cookie, path = '/api/social/profile', body) => new Request(`http://127.0.0.1:4188${path}`, {
  method: body ? 'POST' : 'GET', headers: { ...(cookie ? { cookie } : {}), 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:4188' }, ...(body ? { body: JSON.stringify(body) } : {}),
});
test('opaque HttpOnly lab identity survives return and cannot be selected by name, playerId or another server secret', () => {
  const first = labCompanionIdentity(request(), settings);
  assert.match(first.cookie, /HttpOnly; SameSite=Strict/); assert.match(first.identity, /^[a-f0-9]{64}$/);
  assert.deepEqual(labCompanionIdentity(request(first.cookie), settings), { identity: first.identity, cookie: null });
  assert.notEqual(labCompanionIdentity(request(), settings).identity, first.identity);
  assert.notEqual(labCompanionIdentity(request(first.cookie), { remoteToken: 'other-server' }).identity, first.identity);
  assert.notEqual(labCompanionIdentity(request('playerId=Jakob; name=Jakob'), settings).identity, first.identity);
});

test('local profile endpoint derives identity itself and rejects injected IDs and foreign origins', async () => {
  let calls = 0;
  const options = { settings, fetchImpl: async (url, options) => {
    calls++; assert.equal(String(url), 'https://director.example.test/api/studio/companion');
    const body = JSON.parse(options.body); assert.match(body.identity, /^[a-f0-9]{64}$/);
    return Response.json({ name: null, history: [], greeting: 'Vem kom in?' });
  } };
  const response = await socialEndpoint(request(), options);
  assert.equal(response.status, 200); assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  const forged = await socialEndpoint(request(null, undefined, { operation: 'name', name: 'Jakob', identity: 'a'.repeat(64) }), options);
  assert.equal(forged.status, 400);
  const foreign = new Request('http://127.0.0.1:4188/api/social/profile', { headers: { Origin: 'https://attacker.test' } });
  assert.equal((await socialEndpoint(foreign, options)).status, 403); assert.equal(calls, 1);
});

test('companion poem uses the existing exact-text social TTS path once', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'companion-local-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = createSocialStore(directory), policy = await store.load();
  let calls = 0, voices = 0;
  const service = createSocialService({ store, settings, fetchImpl: async (url, options) => {
    calls++; assert.equal(String(url), 'https://director.example.test/api/studio/companion');
    const { input, identity } = JSON.parse(options.body); assert.equal(identity, 'a'.repeat(64));
    return Response.json({ result: { requestId: input.requestId, policyRevision: policy.revision, reply: 'Emil, du kortens kung! Sehr gut, 你好!', triggerId: null, confidence: 0, provider: 'responded' }, profile: { name: 'Emil' }, comedy: true, search: { status: 'not_requested', results: [] } });
  }, generateVoice: async ({ text }) => { voices++; return { id: 'a'.repeat(64), audioUrl: `/api/voice/${'a'.repeat(64)}`, text, cached: false }; } });
  const body = { requestId: 'request-fixture', conversationId: 'conversation-fixture', message: 'Berätta om Emil', history: [], policyRevision: policy.revision, scene: { dealerId: 'astrid', eventId: 'idle.ready' }, voice: true, companion: { fun: true, web: true } };
  const result = await service.chat(body, 'a'.repeat(64));
  assert.equal(result.companion.comedy, true); assert.equal(result.audio.text, result.reply);
  await service.chat(body, 'a'.repeat(64)); assert.equal(calls, 1); assert.equal(voices, 1);
  await assert.rejects(service.chat(body), /Ogiltigt namn/);
});
