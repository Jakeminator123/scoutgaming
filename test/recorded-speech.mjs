import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRecordedSpeech,recordedSpeechIdentity,recordedSpeechForVideo,selectRecordedSpeech} from '../packages/presentation/contracts/recorded-speech.mjs';

function fixture(){
  const value={schemaVersion:1,dealerId:'fixture-dealer',lineId:'goodluck',takeId:'goodluck_1',language:'sv',exactText:'En exakt inspelad testreplik.',
    videoSha256:'a'.repeat(64),audioSha256:'b'.repeat(64),indexSha256:'c'.repeat(64),fps:24,frameCount:72,audioDelayMs:0,
    entryPose:'VILA',exitPose:'VILA',calibrationRevision:'fixture-calibration-v1',recording:{status:'pending'},review:{status:'pending'}};
  return value;
}
function attest(value,status='approved'){
  const identity=recordedSpeechIdentity(value),by='fixture-reviewer',at='2026-10-14T00:00:00.000Z';
  value.recording={status:'verified-recording',by,at,identity:structuredClone(identity)};
  value.review=status==='pending'?{status}:{status,by,at,identity:structuredClone(identity)};
  return value;
}
function video(value){return {id:'fixture-video',dealer:value.dealerId,sha256:value.videoSha256,available:true,contentType:'video/mp4',recordedSpeech:value};}
const selection={dealerId:'fixture-dealer',lineId:'goodluck',language:'sv',takeId:'goodluck_1'};

test('byte/transcript verification never promotes a recording to audiovisual approval',()=>{
  const pending=fixture();assert.deepEqual(normalizeRecordedSpeech(pending),pending);
  assert.equal(recordedSpeechForVideo(video(pending),{...selection,requireApproved:false}),null);
  const verified=attest(pending,'pending');
  assert.equal(recordedSpeechForVideo(video(verified),selection),null);
  assert.deepEqual(recordedSpeechForVideo(video(verified),{...selection,requireApproved:false}),verified);
  assert.equal(verified.review.status,'pending');
  assert.equal(recordedSpeechForVideo(video(attest(fixture(),'rejected')),{...selection,requireApproved:false}),null);
});

test('changed exact transcript, language, audio, video, index, timing or pose cannot inherit verification or approval',()=>{
  const approved=attest(fixture());
  const changes={dealerId:'other-dealer',lineId:'win',takeId:'goodluck_2',language:'en',exactText:'A different take.',
    videoSha256:'d'.repeat(64),audioSha256:'e'.repeat(64),indexSha256:'f'.repeat(64),fps:25,frameCount:73,audioDelayMs:10,
    entryPose:'REDO',exitPose:'REDO',calibrationRevision:'fixture-calibration-v2'};
  for(const [key,value]of Object.entries(changes)){
    const changed=structuredClone(approved);changed[key]=value;
    assert.throws(()=>normalizeRecordedSpeech(changed),{code:'invalid_recorded_speech'},key);
  }
  const unverified=structuredClone(approved);unverified.recording={status:'pending'};assert.throws(()=>normalizeRecordedSpeech(unverified));
  const copy=normalizeRecordedSpeech(approved);copy.review.identity.exactText='Changed';assert.equal(approved.review.identity.exactText,approved.exactText);
});

test('strict portable data validation rejects unknown fields, accessors and invalid limits without executing accessors',()=>{
  for(const mutate of [v=>v.extra=true,v=>v.language='SV',v=>v.fps=NaN,v=>v.frameCount=0,v=>v.audioDelayMs=5001,
    v=>v.videoSha256='short',v=>v.exactText=' padded ',v=>v.exactText='bad\u0000text',v=>v.entryPose='guessed',
    v=>v.recording={status:'verified-recording'},v=>v.review={status:'approved'},v=>v.takeId='../other']){
    const value=fixture();mutate(value);assert.throws(()=>normalizeRecordedSpeech(value));
  }
  let calls=0;const value=fixture();Object.defineProperty(value,'exactText',{enumerable:true,get(){calls++;return 'unsafe';}});
  assert.throws(()=>normalizeRecordedSpeech(value));assert.equal(calls,0);
});

test('selection uses the exact owned media hash, language and take without cross-dealer or nearest-duration fallback',()=>{
  const approved=attest(fixture()),row=video(approved);
  assert.deepEqual(recordedSpeechForVideo(row,selection),approved);
  assert.deepEqual(selectRecordedSpeech([row],selection),row);
  for(const change of [{dealerId:'other-dealer'},{lineId:'win'},{language:'en'},{takeId:'goodluck_2'}])assert.equal(recordedSpeechForVideo(row,{...selection,...change}),null);
  for(const change of [{sha256:'d'.repeat(64)},{dealer:'other-dealer'},{available:false},{contentType:'audio/wav'}])assert.equal(recordedSpeechForVideo({...row,...change},selection),null);
  assert.equal(selectRecordedSpeech([row,{...row,id:'duplicate'}],selection),null);
  assert.equal(selectRecordedSpeech([row],{...selection,takeId:undefined}),null);
  assert.equal(recordedSpeechForVideo({id:'legacy',dealer:'astrid'},selection),null);
  assert.throws(()=>normalizeRecordedSpeech(approved,{dealerId:'other-dealer'}));
  assert.throws(()=>normalizeRecordedSpeech(approved,{lineId:'win'}));
  assert.throws(()=>normalizeRecordedSpeech(approved,{videoSha256:'d'.repeat(64)}));
});
