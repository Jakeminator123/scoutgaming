import test from 'node:test';
import assert from 'node:assert/strict';
import {validateManagedStudioMedia} from '../packages/studio-registry/server/managed-media-contract.mjs';
import {validateStudioMedia, createRetainedStudioMedia, RETAINED_BANK_VARIANTS} from '../packages/studio-registry/server/document-contract.mjs';
const id='10000000-0000-4000-8000-000000000001', sha256='a'.repeat(64);
const record=()=>({id,sha256,size:4096,contentType:'video/mp4',pathname:`croupier/media/dealers/johanna/review/uploads/${id}/${sha256}.mp4`,
  classification:{dealerId:'johanna',eventId:'idle.ready',kind:'idle',role:'alternative',situation:'',label:' Johanna ',notes:' Test ',
    compositing:{mode:'green-screen',threshold:.2,softness:.1,despill:0}}});
test('portable and server normal-record validation share exact metadata and immutable path rules',()=>{
  for(const mutate of [()=>{},r=>r.classification.playback='once',r=>r.classification.compositing={mode:'opaque'}]){
    const input=record();mutate(input);
    assert.deepEqual(validateManagedStudioMedia(input),validateStudioMedia(input));
    assert.equal(validateManagedStudioMedia(input).classification.label,'Johanna');
    assert.equal(input.classification.label,' Johanna ');
  }
});
test('normal descriptor corruption is rejected equally on server and browser',()=>{
  for(const mutate of [r=>r.pathname='../file',r=>r.size=15,r=>r.sha256='A'.repeat(64),r=>r.url='https://mutable.invalid',
    r=>r.classification.dealerId='constructor',r=>r.classification.eventId='speak.other',
    r=>r.classification.playback='loop',r=>r.classification.compositing.threshold=2,r=>r.classification.role='unknown']){
    const input=record();mutate(input);
    assert.throws(()=>validateManagedStudioMedia(input),e=>e.code==='studio_invalid_media');
    assert.throws(()=>validateStudioMedia(input));
  }
});

test('recorded speech metadata follows the exact registered video bytes in both storage and frozen descriptors',()=>{
  const row=record();row.classification={...row.classification,eventId:'speak.goodluck',kind:'speech',situation:'goodluck',playback:'once',
    recordedSpeech:{schemaVersion:1,dealerId:'johanna',lineId:'goodluck',takeId:'goodluck_1',language:'sv',exactText:'Inspelad testreplik.',
      videoSha256:row.sha256,audioSha256:'b'.repeat(64),indexSha256:'c'.repeat(64),fps:24,frameCount:72,audioDelayMs:0,
      entryPose:'VILA',exitPose:'VILA',calibrationRevision:'fixture-v1',recording:{status:'pending'},review:{status:'pending'}}};
  assert.deepEqual(validateManagedStudioMedia(row),validateStudioMedia(row));
  const mismatched=structuredClone(row);mismatched.classification.recordedSpeech.videoSha256='d'.repeat(64);
  assert.throws(()=>validateManagedStudioMedia(mismatched),e=>e.code==='studio_invalid_media');
  assert.throws(()=>validateStudioMedia(mismatched));
});
test('accessors and non-data values cannot be invoked while decoding media descriptors',()=>{
  let called=0; const input=record();
  Object.defineProperty(input.classification,'label',{enumerable:true,get(){called++;return 'unsafe';}});
  assert.throws(()=>validateManagedStudioMedia(input)); assert.equal(called,0);
  for(const mutate of [r=>r.extra=Symbol(),r=>r.classification[Symbol('hidden')]='x',r=>r.classification.notes=NaN,
    r=>Object.setPrototypeOf(r.classification,{extra:1}),r=>Object.defineProperty(r,'hidden',{value:'x'})]){
    const next=record();mutate(next);assert.throws(()=>validateManagedStudioMedia(next));
  }
});
test('retained bank authority remains exclusively the existing server contract',()=>{
  for(const source of RETAINED_BANK_VARIANTS){
    const retained=createRetainedStudioMedia(source.id);
    assert.deepEqual(validateStudioMedia(retained),retained);
    assert.throws(()=>validateManagedStudioMedia(retained),e=>e.code==='studio_invalid_media');
  }
});

test('the complete portable package validation import graph has no Node dependency or server-contract cycle',async()=>{
  const {readFile}=await import('node:fs/promises');
  const visited=new Set();
  async function visit(url){
    if(visited.has(url.href)||url.pathname.endsWith('.json'))return;
    visited.add(url.href);const source=await readFile(url,'utf8');
    assert.doesNotMatch(source,/\b(?:Buffer|process|require)\b/,'browser validator does not depend on Node globals');
    for(const match of source.matchAll(/(?:import[\s\S]*?from|export[\s\S]*?from)\s*['"]([^'"]+)['"]/g)){
      assert.ok(match[1].startsWith('.'),'portable imports are relative data/model modules');
      assert.ok(!match[1].includes('storage/studio-contract'),'portable decoding must not create the Studio model/contract cycle');
      await visit(new URL(match[1],url));
    }
  }
  await visit(new URL('../packages/presentation/contracts/presentation-layers.mjs',import.meta.url));
  assert.ok(visited.size>=4);
});

import {createHash} from 'node:crypto';
import {mediaTimingSpeechIdentity} from '../packages/presentation/contracts/media-timing.mjs';
import {recordedSpeechIdentity} from '../packages/presentation/contracts/recorded-speech.mjs';
function measuredRecord({withSpeech=false}={}) {
  const row=record();
  if(withSpeech)Object.assign(row.classification,{eventId:'speak.goodluck',kind:'speech',situation:'goodluck',playback:'once',
    recordedSpeech:{schemaVersion:1,dealerId:'johanna',lineId:'goodluck',takeId:'goodluck_1',language:'sv',exactText:'Inspelad testreplik.',
      videoSha256:row.sha256,audioSha256:'b'.repeat(64),indexSha256:'c'.repeat(64),fps:24,frameCount:72,audioDelayMs:0,
      entryPose:'VILA',exitPose:'VILA',calibrationRevision:'fixture-v1',recording:{status:'pending'},review:{status:'pending'}}});
  row.mediaTiming={schemaVersion:1,mediaId:row.id,sha256:row.sha256,size:row.size,
    recordedSpeechIdentitySha256:withSpeech?createHash('sha256').update(mediaTimingSpeechIdentity(row.classification.recordedSpeech)).digest('hex'):null,
    video:{trackId:1,frameCount:72,fps:24,firstPtsUs:0,lastPtsUs:2958333,endUs:3000000},
    audio:withSpeech?[{trackId:2,firstPtsUs:0,endUs:3200000}]:[],endUs:withSpeech?3200000:3000000,audioTailUs:withSpeech?200000:0};
  return row;
}
function embeddedRecord({verified=false,measured=true}={}) {
  const row=measuredRecord({withSpeech:true});
  const speech={schemaVersion:2,sourceKind:'embedded-mp4-av',dealerId:'johanna',lineId:'goodluck',takeId:'goodluck_1',language:'sv',
    exactText:'Inspelad testreplik.',videoSha256:row.sha256,fps:24,frameCount:72,videoTrackId:1,audioTrackId:2,
    entryPose:'VILA',exitPose:'VILA',source:{status:'pending'},review:{status:'pending'}};
  if(verified)speech.source={status:'verified-embedded-av',by:'Inspector',at:'2026-10-26T00:00:00.000Z',identity:recordedSpeechIdentity(speech)};
  row.classification.recordedSpeech=speech;
  row.mediaTiming.recordedSpeechIdentitySha256=createHash('sha256').update(mediaTimingSpeechIdentity(speech)).digest('hex');
  if(!measured)delete row.mediaTiming;
  return row;
}
test('embedded AV is MP4-only and verified source requires its measured binding in every reader',()=>{
  for(const verified of [false,true]){
    const input=embeddedRecord({verified}),before=structuredClone(input);
    assert.deepEqual(validateManagedStudioMedia(input),validateStudioMedia(input));assert.deepEqual(input,before);
    const missing=embeddedRecord({verified,measured:false});
    if(verified){assert.throws(()=>validateManagedStudioMedia(missing));assert.throws(()=>validateStudioMedia(missing));}
    else assert.deepEqual(validateManagedStudioMedia(missing),validateStudioMedia(missing));
    const webm=embeddedRecord({verified,measured:false});webm.contentType='video/webm';webm.pathname=webm.pathname.replace('.mp4','.webm');
    assert.throws(()=>validateManagedStudioMedia(webm));assert.throws(()=>validateStudioMedia(webm));
  }
});
test('embedded AV readers bind track IDs and frame identity while server also recomputes the digest',()=>{
  for(const change of [row=>{row.mediaTiming.video.trackId=3;},row=>{row.mediaTiming.audio[0].trackId=3;},
    row=>{row.mediaTiming.audio=[];row.mediaTiming.endUs=row.mediaTiming.video.endUs;row.mediaTiming.audioTailUs=0;},
    row=>{row.mediaTiming.audio.push({...row.mediaTiming.audio[0],trackId:3});}]){
    const input=embeddedRecord({verified:true});change(input);
    assert.throws(()=>validateManagedStudioMedia(input));assert.throws(()=>validateStudioMedia(input));
  }
  const forged=embeddedRecord({verified:true});forged.mediaTiming.recordedSpeechIdentitySha256='d'.repeat(64);
  assert.throws(()=>validateStudioMedia(forged));
});
test('optional timing survives portable and server reads without changing old media or speech approvals',()=>{
  for(const withSpeech of [false,true]){
    const input=measuredRecord({withSpeech}),before=structuredClone(input);
    const portable=validateManagedStudioMedia(input),server=validateStudioMedia(input);
    assert.deepEqual(portable,server);assert.deepEqual(server.mediaTiming,input.mediaTiming);
    assert.deepEqual(input,before);
    if(withSpeech)assert.deepEqual(server.classification.recordedSpeech.recording,{status:'pending'});
  }
  assert.equal(Object.hasOwn(validateStudioMedia(record()),'mediaTiming'),false);
});
test('timing byte binding fails in all readers and changed speech digests fail at the server boundary',()=>{
  for(const mutate of [
    r=>{r.sha256='d'.repeat(64);r.pathname=r.pathname.replace(sha256,r.sha256);},
    r=>{r.id='30000000-0000-4000-8000-000000000001';r.pathname=r.pathname.replace(id,r.id);},
    r=>r.size++,r=>r.mediaTiming.video.frameCount++,
  ]){
    const input=measuredRecord({withSpeech:true});mutate(input);
    assert.throws(()=>validateManagedStudioMedia(input));assert.throws(()=>validateStudioMedia(input));
  }
  for(const field of ['exactText','audioSha256','indexSha256','calibrationRevision']){
    const input=measuredRecord({withSpeech:true});
    input.classification.recordedSpeech[field]=field.endsWith('Sha256')?'d'.repeat(64):'changed';
    assert.doesNotThrow(()=>validateManagedStudioMedia(input),'portable reader only validates form and byte tuple');
    assert.throws(()=>validateStudioMedia(input),e=>e.code==='studio_invalid_media');
  }
  const forged=measuredRecord({withSpeech:true});forged.mediaTiming.recordedSpeechIdentitySha256='d'.repeat(64);
  assert.throws(()=>validateStudioMedia(forged));
});
