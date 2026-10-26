import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {normalizeRecordedSpeech,recordedSpeechIdentity,recordedSpeechSourceVerified,recordedSpeechForVideo,selectRecordedSpeech} from '../packages/presentation/contracts/recorded-speech.mjs';

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

function embeddedFixture(){
  return {schemaVersion:2,sourceKind:'embedded-mp4-av',dealerId:'fixture-dealer',lineId:'goodluck',takeId:'goodluck_1',language:'sv',
    exactText:'En exakt inspelad testreplik.',videoSha256:'a'.repeat(64),fps:24,frameCount:72,videoTrackId:1,audioTrackId:2,
    entryPose:'VILA',exitPose:'VILA',source:{status:'pending'},review:{status:'pending'}};
}
function attestEmbedded(value,status='approved'){
  const identity=recordedSpeechIdentity(value),by='fixture-reviewer',at='2026-10-26T00:00:00.000Z';
  value.source={status:'verified-embedded-av',by,at,identity:structuredClone(identity)};
  value.review=status==='pending'?{status}:{status,by,at,identity:structuredClone(identity)};
  return value;
}
function measuredVideo(value){
  const row={...video(value),id:'10000000-0000-4000-8000-000000000001',bytes:4096};
  const endUs=Math.ceil(value.frameCount*1e6/value.fps);
  row.mediaTiming={schemaVersion:1,mediaId:row.id,sha256:row.sha256,size:row.bytes,
    recordedSpeechIdentitySha256:createHash('sha256').update(JSON.stringify(recordedSpeechIdentity(value))).digest('hex'),
    video:{trackId:value.videoTrackId,frameCount:value.frameCount,fps:value.fps,firstPtsUs:0,lastPtsUs:Math.round((value.frameCount-1)*1e6/value.fps),endUs},
    audio:[{trackId:value.audioTrackId,firstPtsUs:0,endUs}],endUs,audioTailUs:0};
  return row;
}

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

test('embedded MP4 source verification stays separate from audiovisual approval and filming origin',()=>{
  const pending=embeddedFixture();assert.deepEqual(normalizeRecordedSpeech(pending),pending);
  for(const field of ['recording','audioSha256','indexSha256','audioDelayMs','calibrationRevision'])assert.equal(Object.hasOwn(pending,field),false);
  assert.equal(recordedSpeechSourceVerified(pending),false);
  assert.equal(recordedSpeechForVideo(measuredVideo(pending),{...selection,requireApproved:false}),null);
  const verified=attestEmbedded(pending,'pending');assert.equal(recordedSpeechSourceVerified(verified),true);
  assert.equal(recordedSpeechForVideo(measuredVideo(verified),selection),null);
  assert.deepEqual(recordedSpeechForVideo(measuredVideo(verified),{...selection,requireApproved:false}),verified);
  assert.equal(verified.review.status,'pending');
  const approved=attestEmbedded(embeddedFixture());assert.deepEqual(normalizeRecordedSpeech(approved),approved);
  assert.deepEqual(recordedSpeechForVideo(measuredVideo(approved),selection),approved);
  assert.equal(recordedSpeechForVideo(video(approved),selection),null,'a source stamp alone is not a playable measured record');
  const rejected=attestEmbedded(embeddedFixture(),'rejected');assert.equal(recordedSpeechSourceVerified(rejected),true);
  assert.equal(recordedSpeechForVideo(measuredVideo(rejected),{...selection,requireApproved:false}),null);
  approved.source={status:'pending'};assert.throws(()=>normalizeRecordedSpeech(approved));assert.equal(recordedSpeechSourceVerified(approved),false);
  assert.equal(recordedSpeechSourceVerified(fixture()),false);assert.equal(recordedSpeechSourceVerified(attest(fixture())),true);
});

test('embedded proofs bind every source, content, track and pose field without accepting v1 recording proofs',()=>{
  const approved=attestEmbedded(embeddedFixture());
  const changes={sourceKind:'external-audio',dealerId:'other-dealer',lineId:'win',takeId:'goodluck_2',language:'en',exactText:'Another take.',
    videoSha256:'d'.repeat(64),fps:25,frameCount:73,videoTrackId:3,audioTrackId:4,entryPose:'REDO',exitPose:'REDO'};
  for(const [name,value]of Object.entries(changes)){
    const changed=structuredClone(approved);changed[name]=value;
    assert.throws(()=>normalizeRecordedSpeech(changed),{code:'invalid_recorded_speech'},name);
  }
  for(const name of ['source','review']){
    const changed=structuredClone(approved);changed[name].identity=recordedSpeechIdentity(attest(fixture()));
    assert.throws(()=>normalizeRecordedSpeech(changed));
  }
  const copy=normalizeRecordedSpeech(approved);copy.review.identity.audioTrackId=9;copy.source.identity.exactText='Changed';
  assert.equal(approved.review.identity.audioTrackId,2);assert.equal(approved.source.identity.exactText,approved.exactText);
  for(const context of [{dealerId:'other-dealer'},{lineId:'win'},{videoSha256:'d'.repeat(64)}])assert.throws(()=>normalizeRecordedSpeech(approved,context));
});

test('embedded v2 rejects mixed formats, invalid track pairs and portable-data traps without invoking accessors',()=>{
  const mutations=[v=>v.schemaVersion=3,v=>v.schemaVersion=1,v=>v.recording={status:'pending'},v=>v.audioSha256='b'.repeat(64),
    v=>v.indexSha256='c'.repeat(64),v=>v.audioDelayMs=0,v=>v.calibrationRevision='invented',v=>delete v.sourceKind,
    v=>v.sourceKind='video/webm',v=>v.videoTrackId=0,v=>v.videoTrackId=2,v=>v.audioTrackId=1,v=>v.audioTrackId=-1,
    v=>v.audioTrackId=2.5,v=>v.audioTrackId=0x100000000,v=>v.videoTrackId=NaN,v=>v.fps=0,v=>v.fps=Infinity,
    v=>v.frameCount=28801,v=>v.source={status:'verified-recording'},v=>v.review={status:'approved'},
    v=>v.source={status:'pending',by:'not allowed'},v=>Object.defineProperty(v,'hidden',{value:true}),v=>v[Symbol('extra')]=true];
  for(const mutate of mutations){const value=embeddedFixture();mutate(value);assert.throws(()=>normalizeRecordedSpeech(value));}
  for(const target of ['schemaVersion','videoTrackId','source']){
    let calls=0;const value=embeddedFixture();Object.defineProperty(value,target,{enumerable:true,get(){calls++;throw Error('called');}});
    assert.throws(()=>normalizeRecordedSpeech(value));assert.equal(calls,0,target);
  }
  let calls=0;const value=attestEmbedded(embeddedFixture());
  Object.defineProperty(value.source.identity,'audioTrackId',{enumerable:true,get(){calls++;return 2;}});
  assert.throws(()=>normalizeRecordedSpeech(value));assert.equal(calls,0);
});

test('embedded selection needs exact MP4 timing and source tracks through the projected video',()=>{
  const approved=attestEmbedded(embeddedFixture()),row=measuredVideo(approved);
  const mutations=[v=>delete v.contentType,v=>v.contentType='video/webm',v=>v.contentType='audio/mp4',v=>delete v.mediaTiming,
    v=>v.mediaTiming.schemaVersion=2,v=>v.mediaTiming.mediaId='another-media',v=>v.mediaTiming.sha256='d'.repeat(64),
    v=>v.bytes++,v=>v.size=4097,v=>v.mediaTiming.recordedSpeechIdentitySha256=null,
    v=>v.mediaTiming.video.trackId=3,v=>v.mediaTiming.video.frameCount++,v=>v.mediaTiming.video.fps=25,
    v=>v.mediaTiming.audio=[],v=>v.mediaTiming.audio.push({...v.mediaTiming.audio[0],trackId:3}),v=>v.mediaTiming.audio[0].trackId=3,
    v=>v.sha256='d'.repeat(64),v=>v.available=false,v=>v.classification={dealerId:'another-dealer'},
    v=>v.classification={recordedSpeech:attest(fixture())}];
  for(const mutate of mutations){const changed=structuredClone(row);mutate(changed);assert.equal(recordedSpeechForVideo(changed,selection),null);}
  let calls=0;const changed=structuredClone(row);Object.defineProperty(changed.mediaTiming.audio,'0',{enumerable:true,get(){calls++;return {};}});
  assert.equal(recordedSpeechForVideo(changed,selection),null);assert.equal(calls,0);
  assert.equal(selectRecordedSpeech([row],selection),row);
  assert.equal(selectRecordedSpeech([row,{...row}],selection),null);
  for(const change of [{dealerId:'other-dealer'},{lineId:'win'},{language:'en'},{takeId:'goodluck_2'}])assert.equal(recordedSpeechForVideo(row,{...selection,...change}),null);
  const legacy=video(attest(fixture()));
  for(const contentType of ['video/mp4','video/webm',undefined])assert.ok(recordedSpeechForVideo({...legacy,contentType},selection),'v1 content type compatibility');
});

