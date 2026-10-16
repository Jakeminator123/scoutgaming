import test from 'node:test';
import assert from 'node:assert/strict';
import { createMovingSpeechSourceSet, validateMovingSpeechSourceSet, createRegisteredMovingSpeech, movingSpeechHash } from '../web/moving-speech-bank.mjs';

const id = '11111111-1111-1111-1111-111111111111';
const other = '22222222-2222-2222-2222-222222222222';
const sha = 'a'.repeat(64), avatarSha256 = 'b'.repeat(64);
const clip = (videoId = id) => ({videoId, sha256:sha,bytes:4,fps:24,frameCount:30,width:1080,height:1920});
const sources = () => createMovingSpeechSourceSet({dealerId:'dragan',clips:[clip(),clip(other)],rest:{videoId:id,frame:2}});
const video = (videoId = id) => ({id:videoId,dealer:'dragan',sha256:sha,bytes:4,available:true,storage:'private-blob',contentType:'video/mp4',classification:{dealerId:'dragan',kind:'action'}});
function fixture() {
  const sourceSet = sources(), registry = {videos:[video(),video(other)]};
  const frozenContext = {context:{dealerId:'dragan',operatorSlug:'example',roomId:'room',packageRevision:3},
    dealer:{id:'dragan'},schemaVersion:3,records:registry.videos.map(v=>({id:v.id,sha256:v.sha256,size:v.bytes,contentType:v.contentType,classification:{...v.classification}}))};
  const audio = {pcm:Buffer.alloc(2400),format:'s16le',sampleRate:24000,channels:1};
  const binding = {sessionId:'session',talkId:'talk',revision:1,profileRevision:'c'.repeat(64),textSha256:'d'.repeat(64),audioSha256:movingSpeechHash(audio.pcm)};
  const input = {sourceSet,avatarSha256,frozenContext,binding,audio,frames:Array.from({length:12},(_,frame)=>({videoId:id,frame}))};
  let checks = 0;
  const service = createRegisteredMovingSpeech({readRegistry:async()=>registry,
    verifyBank:async expected=>{checks++;return expected;}});
  return {input,service,registry,get checks(){return checks;}};
}

test('immutable source identities are deterministic; identical bytes retain distinct media IDs', () => {
  const a = sources();
  const b = createMovingSpeechSourceSet({...a,clips:[...a.clips].reverse()});
  assert.equal(a.sourceSetSha256,b.sourceSetSha256);
  assert.notEqual(a.clips[0].take,a.clips[1].take);
  assert.ok(Object.isFrozen(a.clips[0]));
  assert.deepEqual(validateMovingSpeechSourceSet(a),a);
  for (const change of [{fps:30},{frameCount:0},{width:1920},{videoId:'../other'}]) {
    assert.throws(()=>createMovingSpeechSourceSet({dealerId:'dragan',clips:[{...clip(),...change}],rest:{videoId:id,frame:0}}));
  }
  const changed=structuredClone(a);changed.clips[0].sha256='e'.repeat(64);
  assert.throws(()=>validateMovingSpeechSourceSet(changed),/sources_changed/);
  assert.throws(()=>createMovingSpeechSourceSet({...a,rest:{videoId:id,frame:30}}),/invalid_rest/);
});

test('registered, published sources flow into the existing PCM/worker plan with exact held frames', async () => {
  const f=fixture();
  f.input.frames[5]={videoId:other,frame:3};
  f.input.frames[6]={videoId:other,frame:3};
  f.input.frames[7]={videoId:id,frame:2,still:true};
  const result=await f.service.prepare(f.input);
  assert.equal(f.checks,1);
  assert.equal(result.plan.binding.dealerId,'dragan');
  assert.equal(result.plan.binding.workerAvatar,'dragan');
  assert.equal(result.plan.binding.avatarSha256,avatarSha256);
  assert.deepEqual(result.plan.timeline[5],{take:'clip-'+other,frame:3,sourceSha256:sha});
  assert.deepEqual(result.plan.timeline[6],result.plan.timeline[5]);
  assert.deepEqual(result.plan.timeline[7],{take:'vila',frame:0,sourceSha256:sha});
  const messages=[...result.messages()];
  assert.deepEqual(JSON.parse(messages[0]),result.plan.start);
  assert.deepEqual(messages[1],f.input.audio.pcm);
  result.cancel();
  assert.throws(()=>result.playbackPcm(),/cancelled/);
});

test('unpublished, archived, replaced, wrong-owner and recorded-speech media fail before bank verification', async () => {
  for (const change of [
    f=>f.input.frozenContext.records.splice(0,1),
    f=>f.input.frozenContext.records[0].sha256='e'.repeat(64),
    f=>f.input.frozenContext.context.dealerId='paow',
    f=>f.registry.videos[0].classification.archived=true,
    f=>f.registry.videos[0].sha256='e'.repeat(64),
    f=>f.registry.videos[0].dealer='paow',
    f=>f.registry.videos[0].classification.recordedSpeech={},
    f=>f.registry.videos[0].storage='disk',
    f=>f.registry.videos.push(video()),
    f=>f.input.frames[0].frame=30,
    f=>f.input.frames[0]={videoId:id,frame:3,still:true},
  ]) {
    const f=fixture();change(f);
    await assert.rejects(f.service.prepare(f.input));
    assert.equal(f.checks,0);
  }
});

test('a different bank receipt and an aborted request cannot create a transport input', async () => {
  const f=fixture();
  const service=createRegisteredMovingSpeech({readRegistry:async()=>f.registry,
    verifyBank:async expected=>({...expected,avatarSha256:'e'.repeat(64)})});
  await assert.rejects(service.prepare(f.input),/unverified/);
  const controller=new AbortController();controller.abort();
  await assert.rejects(f.service.prepare({...f.input,signal:controller.signal}),{name:'AbortError'});
  assert.equal(f.checks,0);
});

test('revocation during bank verification fails; caller mutation cannot change an admitted input snapshot', async () => {
  const f=fixture();
  const revoked=createRegisteredMovingSpeech({readRegistry:async()=>f.registry,
    verifyBank:async expected=>{f.registry.videos[0].available=false;return expected;}});
  await assert.rejects(revoked.prepare(f.input),/source_unavailable/);
  const g=fixture();let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const service=createRegisteredMovingSpeech({readRegistry:async()=>{await gate;return g.registry;},
    verifyBank:async expected=>expected});
  const pending=service.prepare(g.input);
  g.input.frozenContext.records.length=0;g.input.binding.talkId='changed';g.input.audio.pcm.fill(255);
  g.input.frames[0].frame=29;
  release();
  const result=await pending;
  assert.equal(result.plan.binding.talkId,'talk');
  assert.equal(result.plan.timeline[0].frame,0);
  assert.ok(result.playbackPcm().every(byte=>byte===0));
});
