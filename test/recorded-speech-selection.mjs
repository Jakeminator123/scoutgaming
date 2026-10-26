import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';
import {addDealer,createEmptyProject} from '../packages/presentation/contracts/studio-model.mjs';
import {recordedSpeechIdentity,recordedSpeechForVideo} from '../packages/presentation/contracts/recorded-speech.mjs';
import {gateRecordedSpeechSelection,recordedSpeechProjection} from '../packages/presentation/runtime/recorded-speech-selection.mjs';
import {createPresentationApi} from '../services/game/presentation-api.mjs';

const id='10000000-0000-4000-8000-000000000001',otherId='10000000-0000-4000-8000-000000000002';
function speech(status='approved',overrides={}){
  const value={schemaVersion:1,dealerId:'nora',lineId:'goodluck',takeId:'goodluck_sv_1',language:'sv',exactText:'Lycka till.',
    videoSha256:'a'.repeat(64),audioSha256:'b'.repeat(64),indexSha256:'c'.repeat(64),fps:24,frameCount:72,audioDelayMs:0,
    entryPose:'VILA',exitPose:'VILA',calibrationRevision:'fixture-v1',recording:{status:'pending'},review:{status:'pending'},...overrides};
  const identity=recordedSpeechIdentity(value),by='fixture-reviewer',at='2026-10-14T00:00:00.000Z';
  value.recording={status:'verified-recording',by,at,identity:structuredClone(identity)};
  value.review=status==='pending'?{status}:{status,by,at,identity:structuredClone(identity)};
  return value;
}
function fixture(metadata=speech()){
  const project=addDealer(createEmptyProject(),'nora','Nora');
  const line=project.lines.find(row=>row.dealerId==='nora'&&row.eventId==='speak.goodluck');line.variants[0].videoGenerationId=id;
  const video={id,sha256:'a'.repeat(64),available:true,contentType:'video/mp4',dealer:'nora',fileName:'speech.mp4',
    classification:{dealerId:'nora',eventId:'speak.goodluck',kind:'speech',role:'standard',situation:'goodluck',label:'Lycka till',notes:'',recordedSpeech:metadata}};
  return {video,project,line,context:{project,dealerId:'nora',eventId:'speak.goodluck',sourceEvent:{type:'speak',line:'goodluck'}}};
}
function embeddedSpeech(status='approved',overrides={}){
  const value={schemaVersion:2,sourceKind:'embedded-mp4-av',dealerId:'nora',lineId:'goodluck',takeId:'goodluck_sv_1',language:'sv',exactText:'Lycka till.',
    videoSha256:'a'.repeat(64),fps:24,frameCount:72,videoTrackId:1,audioTrackId:2,entryPose:'VILA',exitPose:'VILA',
    source:{status:'pending'},review:{status:'pending'},...overrides};
  const identity=recordedSpeechIdentity(value),by='fixture-reviewer',at='2026-10-26T00:00:00.000Z';
  value.source={status:'verified-embedded-av',by,at,identity:structuredClone(identity)};
  value.review=status==='pending'?{status}:{status,by,at,identity:structuredClone(identity)};
  return value;
}
function embeddedFixture(metadata=embeddedSpeech()){
  const f=fixture(metadata);f.video.bytes=4096;
  f.video.mediaTiming={schemaVersion:1,mediaId:id,sha256:f.video.sha256,size:f.video.bytes,
    recordedSpeechIdentitySha256:createHash('sha256').update(JSON.stringify(recordedSpeechIdentity(metadata))).digest('hex'),
    video:{trackId:metadata.videoTrackId,frameCount:72,fps:24,firstPtsUs:0,lastPtsUs:2958333,endUs:3000000},
    audio:[{trackId:metadata.audioTrackId,firstPtsUs:0,endUs:3000000}],endUs:3000000,audioTailUs:0};
  return f;
}
function handlerFor(f,options={}){
  const inventory={videos:[f.video],families:[]};
  const api=createPresentationApi({db:{prepare:()=>({get:()=>undefined})},env:{},store:{load:async()=>f.project},registryLoader:async()=>inventory,...options});
  const request=async(extra={},player='fixture-player',query='')=>{
    const req=Readable.from([JSON.stringify({dealerId:'nora',mode:'off',version:1,event:{type:'speak',line:'goodluck'},...extra})]);
    req.method='POST';req.headers={};req.url='/api/presentation/select'+query;
    const res=new EventEmitter();res.writableEnded=false;res.writeHead=status=>res.status=status;
    res.end=raw=>{res.body=JSON.parse(raw);res.writableEnded=true;};
    await api(req,res,'/api/presentation/select',player);assert.equal(res.status,200,JSON.stringify(res.body));return res.body;
  };
  return {request,inventory};
}

test('exact approved authored UUID projects its complete recording and review identity',async()=>{
  const f=fixture(),{request}=handlerFor(f),result=await request();
  assert.equal(result.video.id,id);assert.deepEqual(result.video.recordedSpeech,speech());
  assert.equal(result.video.recordedSpeech.exactText,'Lycka till.');assert.equal(result.video.recordedSpeech.language,'sv');
  assert.equal(result.video.src,'/api/presentation/videos/'+id);
  const projected=recordedSpeechProjection(f.video);projected.recordedSpeech.review.status='rejected';
  assert.equal(f.video.classification.recordedSpeech.review.status,'approved');
});

test('missing approval, wrong identity, changed bytes and unbound UUID are denied with no fallback',async()=>{
  const mutations=[
    f=>f.video.classification.recordedSpeech=speech('pending'),
    f=>f.video.classification.recordedSpeech=speech('rejected'),
    f=>f.video.classification.recordedSpeech=speech('approved',{dealerId:'astrid'}),
    f=>f.video.classification.recordedSpeech=speech('approved',{lineId:'win'}),
    f=>f.video.classification.recordedSpeech.exactText='A changed sentence.',
    f=>f.video.classification.recordedSpeech.takeId='another_take',
    f=>f.video.sha256='d'.repeat(64),
    f=>f.video.classification.situation='win',
    f=>f.video.classification.eventId='speak.win',
    f=>f.video.classification.dealerId='astrid',
    f=>f.video.classification.recordedSpeech=null,
    f=>f.video.available=false,
    f=>f.video.classification.archived=true,
    f=>f.line.variants[0].videoGenerationId=otherId,
  ];
  for(const mutate of mutations){
    const f=fixture();mutate(f);
    assert.deepEqual(gateRecordedSpeechSelection({video:f.video,standard:f.video},f.context),{video:null,standard:null,blocked:true});
  }
  for(const status of ['pending','rejected']){
    const f=fixture(speech(status)),{request}=handlerFor(f),result=await request();
    assert.equal(result.video,null);assert.equal(result.standard,null);assert.equal(result.videoGenerationId,null);
    assert.equal(result.decision.media.reason,'recorded_speech_unavailable');
  }
});

test('authored Swedish take cannot fall back to English, another take, or legacy metadata',()=>{
  const f=fixture();f.line.variants.push({...structuredClone(f.line.variants[0]),id:'nora.speak.goodluck.variant1',videoGenerationId:otherId});
  for(const metadata of [speech('approved',{language:'en',exactText:'Good luck.'}),speech('approved',{takeId:'goodluck_sv_2'}),undefined]){
    const standard={...structuredClone(f.video),id:otherId};
    if(metadata)standard.classification.recordedSpeech=metadata;else delete standard.classification.recordedSpeech;
    const result=gateRecordedSpeechSelection({video:f.video,standard},f.context);
    assert.equal(result.video,f.video);assert.equal(result.standard,null);
  }
  const exact={...structuredClone(f.video),id:otherId};
  assert.equal(gateRecordedSpeechSelection({video:f.video,standard:exact},f.context).standard,exact);
});

test('legacy selection remains unchanged and cannot adopt a new recording as an unproved fallback',async()=>{
  const f=fixture(),newVideo=structuredClone(f.video);delete f.video.classification.recordedSpeech;
  const gate=gateRecordedSpeechSelection({video:f.video,standard:f.video},f.context);
  assert.equal(gate.video,f.video);assert.equal(gate.standard,f.video);assert.equal(gate.blocked,false);
  assert.equal(gateRecordedSpeechSelection({video:f.video,standard:newVideo},f.context).standard,null);
  const result=await handlerFor(f).request();assert.equal(result.video.id,id);assert.equal(Object.hasOwn(result.video,'recordedSpeech'),false);
});

test('random selection preserves authored Swedish identity and rejects an English family fallback even when approved',async()=>{
  const f=fixture();f.video.familyId='nora.goodluck';
  f.line.variants.push({...structuredClone(f.line.variants[0]),id:'nora.speak.goodluck.variant1',videoGenerationId:otherId,selection:{rules:false,random:true,model:false}});
  const english={...structuredClone(f.video),id:otherId,classification:{...f.video.classification,
    recordedSpeech:speech('approved',{language:'en',exactText:'Good luck.',takeId:'goodluck_en_1'})}};
  const {request,inventory}=handlerFor(f,{select:async()=>({videoGenerationId:id,decision:{requestId:'fixture-selected-swedish',media:{videoId:id}}})});
  inventory.videos.push(english);inventory.families.push({id:f.video.familyId,standardIds:[otherId]});
  const result=await request({mode:'random'});assert.equal(result.video.id,id);assert.equal(result.video.recordedSpeech.language,'sv');assert.equal(result.standard,null);
  f.video.classification.recordedSpeech=speech('pending');
  const pending=await request({mode:'random'});assert.equal(pending.video,null);assert.equal(pending.standard,null);
});

test('cached selection rechecks changed review and file hash without a project revision change',async()=>{
  const f=fixture(),{request}=handlerFor(f),revision=f.project.revision;
  assert.equal((await request()).video.id,id);
  f.video.classification.recordedSpeech=speech('rejected');assert.equal((await request()).video,null);
  f.video.classification.recordedSpeech=speech();f.video.sha256='d'.repeat(64);assert.equal((await request()).video,null);
  assert.equal(f.project.revision,revision);
});

test('request rehearsal and preview flags cannot authorize pending speech',async()=>{
  const f=fixture(speech('pending')),{request}=handlerFor(f);
  const result=await request({recordedSpeechPreview:true,rehearsal:true,preview:true},'studio-preview:10000000-0000-4000-8000-000000000001','?rehearsal=1&recordedSpeechPreview=true');
  assert.equal(result.video,null);assert.equal(result.standard,null);
  const serverOptionOnly=handlerFor(f,{recordedSpeechPreview:true});
  assert.equal((await serverOptionOnly.request()).video,null,'option without isolated preview source and identity is insufficient');
});

test('embedded MP4 selection projects its measured source through the public player gate without changing v1 DTOs',async()=>{
  const f=embeddedFixture(),result=await handlerFor(f).request(),tuple=f.video.classification.recordedSpeech;
  assert.deepEqual(result.video.recordedSpeech,tuple);assert.deepEqual(result.video.mediaTiming,f.video.mediaTiming);
  assert.equal(result.video.contentType,'video/mp4');assert.equal(result.video.bytes,4096);
  assert.deepEqual(recordedSpeechForVideo(result.video,{dealerId:'nora',lineId:'goodluck',language:'sv',takeId:'goodluck_sv_1'}),tuple);
  const projected=recordedSpeechProjection(f.video);projected.mediaTiming.audio[0].trackId=99;
  assert.equal(f.video.mediaTiming.audio[0].trackId,2,'projected measurements are detached');
  assert.deepEqual(recordedSpeechProjection(fixture().video),{recordedSpeech:speech()},'historical projection is unchanged');
});

test('embedded source identity cannot borrow an older recording proof or another take as fallback',()=>{
  const f=embeddedFixture();f.line.variants.push({...structuredClone(f.line.variants[0]),id:'nora.speak.goodluck.variant1',videoGenerationId:otherId});
  for(const metadata of [speech(),embeddedSpeech('approved',{language:'en',exactText:'Good luck.'}),embeddedSpeech('approved',{takeId:'goodluck_sv_2'})]){
    const standard=embeddedFixture(metadata).video;standard.id=otherId;standard.mediaTiming.mediaId=otherId;
    const selected=gateRecordedSpeechSelection({video:f.video,standard},f.context);
    assert.equal(selected.video,f.video);assert.equal(selected.standard,null);
  }
  const standard=structuredClone(f.video);standard.id=otherId;standard.mediaTiming.mediaId=otherId;
  assert.equal(gateRecordedSpeechSelection({video:f.video,standard},f.context).standard,standard);
});

test('cached embedded selection rechecks missing or changed source measurements and never promotes pending AV review',async()=>{
  const f=embeddedFixture(),{request}=handlerFor(f),revision=f.project.revision,original=structuredClone(f.video.mediaTiming);
  assert.equal((await request()).video.id,id);
  for(const mutation of [v=>delete v.mediaTiming,v=>v.mediaTiming.audio[0].trackId=3,v=>v.mediaTiming.mediaId=otherId,
    v=>v.mediaTiming.audio.push({...v.mediaTiming.audio[0],trackId:3})]){
    f.video.mediaTiming=structuredClone(original);mutation(f.video);
    const denied=await request();assert.equal(denied.video,null);assert.equal(denied.standard,null);
    assert.equal(denied.decision.media.reason,'recorded_speech_unavailable');
  }
  f.video.mediaTiming=original;f.video.classification.recordedSpeech=embeddedSpeech('pending');
  assert.equal((await request({rehearsal:true,preview:true})).video,null);
  assert.equal(f.project.revision,revision);
});

