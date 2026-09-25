import test from 'node:test';
import assert from 'node:assert/strict';
import { completeChatWithSpeech } from '../web/generated-speech-chat.mjs';

function fixture(change = () => {}) {
  let owner = 'session-one', stale = false, jobs = 0;
  const controller = new AbortController();
  const data = { request: { requestId: 'request-one' }, status: { dealerId: 'astrid' }, owner,
    readOwner: () => owner, readStatus: () => { if (stale) throw Error('stale-round'); }, signal: controller.signal,
    decide: async () => { change({ setOwner: v => owner = v, stale: () => stale = true, abort: () => controller.abort() }); return { kind: 'generatedText', exactText: 'Hej.' }; },
    service: { generate: async input => { jobs++; assert.equal(input.owner, 'session-one'); assert.equal(input.signal, controller.signal); return { preview: true }; } } };
  return { data, get jobs() { return jobs; }, changeOwner() { owner = 'session-two'; } };
}
test('fresh reply produces one preview in the bound session', async () => {
  const f = fixture(), result = await completeChatWithSpeech(f.data);
  assert.equal(f.jobs, 1); assert.equal(result.visualMode, 'generated-lipsync-preview'); assert.ok(result.speechPackage);
});
for (const change of ['owner', 'round', 'abort']) test(`${change} during model work prevents paid generation`, async () => {
  const f = fixture(control => change === 'owner' ? control.setOwner(null) : change === 'round' ? control.stale() : control.abort());
  await assert.rejects(completeChatWithSpeech(f.data)); assert.equal(f.jobs, 0);
});
test('session revoked during generation never publishes generated media', async () => {
  const f = fixture(); f.data.service.generate = async () => { f.changeOwner(); return {}; };
  await assert.rejects(completeChatWithSpeech(f.data), /stale_chat_session/);
});
test('recorded lines and other dealers do not enter generated preview', async () => {
  const f = fixture(); f.data.status.dealerId = 'vera';
  assert.equal((await completeChatWithSpeech(f.data)).speechPackage, undefined); assert.equal(f.jobs, 0);
  f.data.status.dealerId = 'astrid'; f.data.decide = async () => ({ kind: 'recordedLine' });
  assert.equal((await completeChatWithSpeech(f.data)).speechPackage, undefined); assert.equal(f.jobs, 0);
});
