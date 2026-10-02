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
  const f = fixture(), progress = [], previews = []; f.data.onProgress = stage => progress.push(stage);
  f.data.onDecision = text => previews.push(text);
  const result = await completeChatWithSpeech(f.data);
  assert.equal(f.jobs, 1); assert.equal(result.visualMode, 'generated-lipsync-preview'); assert.ok(result.speechPackage);
  assert.deepEqual(progress, ['text', 'ready']);
  assert.deepEqual(previews, ['Hej.']);
});
test('async database ownership is awaited before paid work and after generation', async () => {
  const f = fixture(), originalOwner = f.data.readOwner;
  f.data.readOwner = async () => { await Promise.resolve(); return originalOwner(); };
  const result = await completeChatWithSpeech(f.data);
  assert.equal(result.visualMode, 'generated-lipsync-preview'); assert.equal(f.jobs, 1);
  f.data.service.generate = async () => { f.changeOwner(); return {}; };
  await assert.rejects(completeChatWithSpeech(f.data), /stale_chat_session/);
});
for (const change of ['owner', 'round', 'abort']) test(`${change} during model work prevents paid generation`, async () => {
  const f = fixture(control => change === 'owner' ? control.setOwner(null) : change === 'round' ? control.stale() : control.abort());
  await assert.rejects(completeChatWithSpeech(f.data)); assert.equal(f.jobs, 0);
});
test('session revoked during generation never publishes generated media', async () => {
  const f = fixture(); f.data.service.generate = async () => { f.changeOwner(); return {}; };
  await assert.rejects(completeChatWithSpeech(f.data), /stale_chat_session/);
});

test('async memory policy invalidation after model work prevents preview and paid generation', async () => {
  const f=fixture();let enabled=true,previews=0;
  f.data.readStatus=async()=>{await Promise.resolve();if(!enabled)throw Error('stale_chat_memory');};
  f.data.decide=async()=>{enabled=false;return {kind:'generatedText',exactText:'An old memory.'};};
  f.data.onDecision=()=>previews++;
  await assert.rejects(completeChatWithSpeech(f.data),/stale_chat_memory/);
  assert.equal(f.jobs,0);assert.equal(previews,0);
});

test('paid stages recheck memory after waiting and a later change cannot publish final media', async () => {
  for(const atStage of ['before-costly','before-publish']){
    const f=fixture();let current=true,charged=false;
    f.data.readStatus=async()=>{if(!current)throw Error('stale_chat_memory');};
    f.data.service.generate=async({beforeCostly})=>{
      if(atStage==='before-costly')current=false;
      await beforeCostly();charged=true;
      current=false;return {};
    };
    await assert.rejects(completeChatWithSpeech(f.data),/stale_chat_memory/);
    assert.equal(charged,atStage==='before-publish');
  }
});
test('recorded lines and other dealers do not enter generated preview', async () => {
  const f = fixture(); f.data.status.dealerId = 'vera';
  assert.equal((await completeChatWithSpeech(f.data)).speechPackage, undefined); assert.equal(f.jobs, 0);
  f.data.status.dealerId = 'astrid'; f.data.decide = async () => ({ kind: 'recordedLine' });
  assert.equal((await completeChatWithSpeech(f.data)).speechPackage, undefined); assert.equal(f.jobs, 0);
});

test('negotiated stream returns descriptor without falling back to fullfile generation', async () => {
  const f = fixture(); let prepared = 0; const progress = [];
  f.data.onProgress = stage => progress.push(stage);
  f.data.streamService = { prepare: async value => { await value.beforeCostly(); prepared++; return { kind: 'generated-speech-stream' }; } };
  const result = await completeChatWithSpeech(f.data);
  assert.equal(result.visualMode, 'generated-lipsync-stream-preview'); assert.ok(result.speechStream);
  assert.equal(prepared, 1); assert.equal(f.jobs, 0);
  assert.deepEqual(progress, ['text', 'video-queue', 'ready']);
  f.data.streamService.prepare = async () => { throw Error('worker unavailable'); };
  await assert.rejects(completeChatWithSpeech(f.data), /worker unavailable/); assert.equal(f.jobs, 0);
});

test('without negotiated stream service existing fullfile API is retained', async () => {
  const f = fixture();
  const result = await completeChatWithSpeech(f.data);
  assert.ok(result.speechPackage); assert.equal(result.speechStream, undefined); assert.equal(f.jobs, 1);
});
