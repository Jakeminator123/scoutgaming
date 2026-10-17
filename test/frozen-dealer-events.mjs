import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveIdleController } from '../packages/presentation/runtime/live-idle.mjs';
import { createRegisteredIdlePolicy, registeredIdlePolicy } from '../packages/presentation/runtime/registered-idle-policy.mjs';
import { createSeedProject, addDealer, validateProject, defaultPresentationLane } from '../lab/lib/studio-model.mjs';
import { captureFrozenPresentation, assertCapturedPresentationMedia } from '../web/storage/frozen-presentation-capture.mjs';
import { createFrozenDealerPresentationContext } from '../web/storage/frozen-dealer-presentation.mjs';
import { assertFrozenMediaPreconditions } from '../web/storage/frozen-dealer-idle.mjs';
import { encodePresentationPackage, decodePresentationPackage } from '../web/storage/presentation-package.mjs';
import { validatePresentationPackage } from '../web/presentation-layers.mjs';
import { frozenPlaybackProject, mergeFrozenDealerPlayback } from '../web/frozen-dealer-playback.mjs';
import { selectPresentation } from '../lab/lib/presentation-selection.mjs';
import {recordedSpeechIdentity} from '../web/public/recorded-speech.mjs';
import {bindSpeechSlotStandard, OTHER_SPEECH_SLOT_IDS} from '../web/public/speech-slot-bindings.mjs';
import {createHash} from 'node:crypto';
import {createPresentationApi} from '../web/presentation-api.mjs';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';

const uuid = n => '10000000-0000-4000-8000-' + String(n).padStart(12, '0');
function record(dealerId, eventId, n, situation = '') {
  const id = uuid(n), sha256 = n.toString(16).padStart(64, '0');
  return { id, sha256, size: 4096, contentType: 'video/mp4',
    pathname: 'croupier/media/dealers/' + dealerId + '/review/uploads/' + id + '/' + sha256 + '.mp4',
    classification: { dealerId, eventId, kind: eventId.startsWith('speak.') ? 'speech' : eventId.startsWith('deal.') ? 'action' : 'idle',
      role: 'standard', situation, label: dealerId + ' ' + eventId, notes: '',
      compositing: { mode: 'green-screen', threshold: .2, softness: .1, despill: 0 } } };
}
function fixture({ secondDealer = false } = {}) {
  let project = addDealer(createSeedProject(), 'linnea', 'Linnea');
  if (secondDealer) project = addDealer(project, 'nora', 'Nora');
  project.lanes = [defaultPresentationLane('linnea')];
  const lane = project.lanes[0]; lane.id = 'johns-linnea'; lane.dealers = secondDealer ? ['linnea', 'nora'] : ['linnea'];
  lane.layers.dealer = {enabled:true, default:'linnea', allowed:[...lane.dealers]};
  const media = [record('linnea','idle.ready',1), record('linnea','speak.goodluck',2,'goodluck')];
  if (secondDealer) media.push(record('nora','idle.ready',3), record('nora','speak.goodluck',4,'goodluck'));
  for (const row of media) project.lines.find(line => line.dealerId === row.classification.dealerId && line.eventId === row.classification.eventId).variants[0].videoGenerationId = row.id;
  const inventory = {families:[],videos:media.map(row => ({id:row.id,sha256:row.sha256,bytes:row.size,dealer:row.classification.dealerId,
    available:true, integrity:'verified', classification:structuredClone(row.classification)}))};
  return {snapshot:{projectDocument:{kind:'project',revision:project.revision,value:project},
    administrationDocument:{kind:'administration',revision:'admin-1',value:{rooms:[]}},
    mediaRows:media.map(row => ({...row,revision:'media-1'}))}, inventory, selectedLaneIds:[lane.id], requiredIdleDealerIds:['linnea']};
}
function serviceFor(presentation) {
  const saved = {operator:{id:'north-id',slug:'north',status:'active'},
    package:{operatorId:'north-id',revision:7,lanes:['johns-linnea'],tables:['room-linnea'],frozen:presentation},
    administration:{rooms:[{schemaVersion:2,id:'room-linnea',name:'Linnea',operatorId:'north-id',presentationLaneId:'johns-linnea',gameLaneId:'portrait-linnea',state:'live'}],
      gameLanes:[{schemaVersion:1,id:'portrait-linnea',label:'Linnea',dealer:'linnea',renderer:'portrait-video',mediaCollection:'linnea-presentation'}]}};
  const served = [];
  return {saved,served,service:createFrozenDealerPresentationContext({readCurrentContext:async () => structuredClone(saved),
    readPresentation:pack => validatePresentationPackage(pack.frozen),
    privateMedia:async (row,request) => {served.push(row);return new Response(request.method==='HEAD'?null:'bytes',{status:request.headers.has('range')?206:200});}})};
}
const context = {operatorSlug:'north',roomId:'room-linnea',packageRevision:7,dealerId:'linnea'};

function pendingRecording(row, exactText = 'Lycka till.') {
  return {schemaVersion:1,dealerId:row.classification.dealerId,lineId:row.classification.situation,
    takeId:row.classification.situation+'_sv_1',language:'sv',exactText,
    videoSha256:row.sha256,audioSha256:'b'.repeat(64),indexSha256:'c'.repeat(64),fps:24,frameCount:72,audioDelayMs:0,
    entryPose:'VILA',exitPose:'VILA',calibrationRevision:'fixture-v1',recording:{status:'pending'},review:{status:'pending'}};
}

test('publication omits unverified recordings from its copy, preserving draft bindings and media preconditions', () => {
  const input=fixture(), row=input.snapshot.mediaRows[1];
  row.classification.recordedSpeech=pendingRecording(row);
  input.inventory.videos[1].classification=structuredClone(row.classification);
  const line=input.snapshot.projectDocument.value.lines.find(row=>row.dealerId==='linnea'&&row.eventId==='speak.goodluck');
  line.variants.push({...structuredClone(line.variants[0]),id:'linnea.speak.goodluck.variant1',label:'Alternative',priority:10});
  const before=structuredClone(input), captured=captureFrozenPresentation(input);
  assert.deepEqual(input,before);
  assert.equal(captured.presentation.schemaVersion,3);
  assert.equal(captured.presentation.playback.media.some(media=>media.id===row.id),false);
  assert.ok(captured.presentation.playback.lines.find(row=>row.dealerId===line.dealerId&&row.eventId===line.eventId).variants.every(variant=>variant.videoGenerationId===null));
  assert.deepEqual(captured.mediaPreconditions.find(item=>item.id===row.id).record.classification.recordedSpeech,row.classification.recordedSpeech);
  assertFrozenMediaPreconditions(captured.mediaPreconditions,input.snapshot.mediaRows);
  input.snapshot.mediaRows[1].revision='media-2';
  assert.throws(()=>assertFrozenMediaPreconditions(captured.mediaPreconditions,input.snapshot.mediaRows),{code:'studio_conflict'});
});

test('pending recording projection still rejects unavailable, mismatched or malformed snapshot evidence', () => {
  for(const mutate of [
    input=>{input.inventory.videos[1].available=false;},
    input=>{input.inventory.videos[1].sha256='f'.repeat(64);},
    input=>{input.snapshot.mediaRows[1].classification.recordedSpeech.videoSha256='f'.repeat(64);},
    input=>{input.snapshot.mediaRows[1].classification.recordedSpeech.recording={status:'pending',by:'unexpected'};},
  ]) {
    const input=fixture(),row=input.snapshot.mediaRows[1];
    row.classification.recordedSpeech=pendingRecording(row);
    input.inventory.videos[1].classification=structuredClone(row.classification);
    mutate(input);
    assert.throws(()=>captureFrozenPresentation(input));
  }
});

test('pending optional speech slots add no bytes to the schema3 package and keep drafts intact', () => {
  const input=fixture(), baseline=captureFrozenPresentation(input).presentation;
  for(const [index,situation] of OTHER_SPEECH_SLOT_IDS.entries()) {
    const row=record('linnea','speak.other',index+10,situation);
    const exactText=Array.from({length:16},(_,part)=>createHash('sha256').update(`${situation}:${part}`).digest('hex')).join('').slice(0,1000);
    row.classification.recordedSpeech=pendingRecording(row,exactText);
    input.snapshot.mediaRows.push({...row,revision:'media-1'});
    input.inventory.videos.push({id:row.id,sha256:row.sha256,bytes:row.size,dealer:'linnea',available:true,classification:structuredClone(row.classification)});
    input.snapshot.projectDocument.value=bindSpeechSlotStandard(input.snapshot.projectDocument.value,
      {dealerId:'linnea',eventId:'speak.other',situation,videoId:row.id});
  }
  const before=structuredClone(input),captured=captureFrozenPresentation(input),encoded=encodePresentationPackage(captured.presentation);
  assert.deepEqual(input,before);
  assert.equal(captured.presentation.schemaVersion,3);
  assert.deepEqual(encoded,encodePresentationPackage(baseline));
  assert.ok(encoded.data.length<7400);
  assert.equal(captured.presentation.playback.lines.find(row=>row.dealerId==='linnea'&&row.eventId==='speak.other').variants.length,1);
  assert.equal(captured.mediaPreconditions.length,input.snapshot.mediaRows.length);
  assert.deepEqual(decodePresentationPackage(encoded),baseline);
});

test('frozen recorded speech preserves complete exact metadata and cannot select pending or rejected recordings',async()=>{
  for(const status of ['approved','pending','rejected']){
    const input=fixture(),row=input.snapshot.mediaRows[1];
    const metadata={schemaVersion:1,dealerId:'linnea',lineId:'goodluck',takeId:'goodluck_sv_1',language:'sv',exactText:'Lycka till.',
      videoSha256:row.sha256,audioSha256:'b'.repeat(64),indexSha256:'c'.repeat(64),fps:24,frameCount:72,audioDelayMs:0,
      entryPose:'VILA',exitPose:'VILA',calibrationRevision:'fixture-v1',recording:{status:'pending'},review:{status:'pending'}};
    const proof={by:'fixture-reviewer',at:'2026-10-14T00:00:00.000Z',identity:recordedSpeechIdentity(metadata)};
    metadata.recording={status:'verified-recording',...structuredClone(proof)};
    if(status!=='pending')metadata.review={status,...structuredClone(proof)};
    row.classification.recordedSpeech=metadata;input.inventory.videos[1].classification.recordedSpeech=structuredClone(metadata);
    const {service}=serviceFor(captureFrozenPresentation(input).presentation),frozen=await service.resolve(context);
    const projected=service.publicVideo(frozen,row.id);assert.deepEqual(projected.recordedSpeech,metadata);
    projected.recordedSpeech.exactText='Changed';assert.equal(service.publicVideo(frozen,row.id).recordedSpeech.exactText,'Lycka till.');
    const api=createPresentationApi({db:{prepare:()=>({get:()=>undefined})},env:{},frozenDealerContext:service,recordedSpeechPreview:true});
    const req=Readable.from([JSON.stringify({dealerId:'linnea',mode:'rules',version:1,event:{type:'speak',line:'goodluck'},presentationContext:context,recordedSpeechPreview:true})]);
    req.method='POST';req.headers={};req.url='/api/presentation/select?rehearsal=1';
    const res=new EventEmitter();res.writableEnded=false;res.writeHead=code=>res.status=code;res.end=raw=>{res.body=JSON.parse(raw);res.writableEnded=true;};
    await api(req,res,'/api/presentation/select','studio-preview:10000000-0000-4000-8000-000000000001');assert.equal(res.status,200,JSON.stringify(res.body));
    if(status==='approved'){
      assert.equal(res.body.video.id,row.id);assert.deepEqual(res.body.video.recordedSpeech,metadata);assert.equal(res.body.standard.id,row.id);
    }else{
      assert.equal(res.body.video,null);assert.equal(res.body.standard,null);assert.equal(res.body.videoGenerationId,null);
      assert.equal(res.body.decision.media.reason,'recorded_speech_unavailable');
    }
  }
});

test('published 16-event packages remain readable after the optional shoe slot is added', async () => {
  const current = captureFrozenPresentation(fixture({secondDealer:true})).presentation;
  const legacy = structuredClone(current);
  legacy.playback.lines = legacy.playback.lines.filter(line => line.eventId !== 'transition.shoe');
  const used = new Set(legacy.playback.lines.flatMap(line => line.variants.map(variant => variant.assetId)));
  legacy.playback.assets = legacy.playback.assets.filter(asset => used.has(asset.id));
  const before = JSON.stringify(legacy);
  const encoded = encodePresentationPackage(legacy);
  assert.deepEqual(decodePresentationPackage(encoded), legacy);
  assert.equal(JSON.stringify(legacy), before);
  const frozen = frozenPlaybackProject(legacy.playback, {registeredDealers:legacy.registeredDealers,projectRevision:legacy.projectRevision});
  assert.equal(frozen.events.length, 16);
  assert.equal(frozen.lines.length, 32);
  assert.equal(frozen.lines.find(line => line.dealerId === 'linnea' && line.eventId === 'speak.goodluck').variants[0].videoGenerationId, uuid(2));
  const service = serviceFor(legacy).service;
  assert.equal((await service.resolve(context)).dealer.id, 'linnea');
  const newFrozen = frozenPlaybackProject(current.playback, {registeredDealers:current.registeredDealers,projectRevision:current.projectRevision});
  assert.equal(newFrozen.events.length, 17);
  const damaged = structuredClone(legacy);
  damaged.playback.lines = damaged.playback.lines.filter(line => !(line.dealerId === 'linnea' && line.eventId === 'speak.goodluck'));
  assert.throws(() => validatePresentationPackage(damaged), /studio_invalid_presentation/);
});

test('v3 freezes own exact event binding and policy; later live edits cannot change shared selection', async () => {
  const input = fixture(), project = input.snapshot.projectDocument.value;
  project.triggers.push({id:'linnea.goodluck',label:'Good luck',category:'deterministic',path:'event.line',op:'eq',value:'goodluck'});
  const line = project.lines.find(row => row.dealerId==='linnea' && row.eventId==='speak.goodluck');
  line.variants.push({...structuredClone(line.variants[0]),id:'linnea.speak.goodluck.variant1',priority:50,triggerIds:['linnea.goodluck'],selection:{rules:true,model:false,random:false}});
  const captured = captureFrozenPresentation(input), envelope = encodePresentationPackage(captured.presentation);
  assert.equal(captured.presentation.schemaVersion,3); assert.ok(envelope.data.length<6500);
  assert.equal(captured.mediaPreconditions.length,2);
  line.variants[1].selection.rules=false; input.inventory.videos=[]; input.snapshot.mediaRows[1].classification.label='Changed';
  const decoded = decodePresentationPackage(envelope), {service} = serviceFor(decoded), frozen = await service.resolve(context);
  assert.equal(frozen.project.lines.filter(row => ['astrid','vera','amira','mei'].includes(row.dealerId)).every(row => row.variants.every(v => v.videoGenerationId===null)),true);
  const result = await selectPresentation({project:frozen.project,dealerId:'linnea',eventId:'speak.goodluck',sourceEvent:{type:'speak',line:'goodluck'},mode:'rules'}, {videoRegistry:frozen.inventory});
  assert.equal(result.videoGenerationId,uuid(2)); assert.equal(result.variant.id,'linnea.speak.goodluck.variant1');
  const video=service.publicVideo(frozen,result.videoGenerationId);
  assert.equal(video.sha256,decoded.playback.media.find(row=>row.id===uuid(2)).sha256);
  assert.match(video.src,/registered-video\/north\/room-linnea\/7\/linnea\//);
  assert.equal(JSON.stringify(video).includes('pathname'),false);
});

test('exact position mismatch skips video while matching server event uses own frozen film', async () => {
  const input=fixture(), project=input.snapshot.projectDocument.value, row=record('linnea','deal.player.centre',5,'box3');
  input.snapshot.mediaRows.push({...row,revision:'media-1'}); input.inventory.videos.push({id:row.id,sha256:row.sha256,bytes:row.size,dealer:'linnea',available:true,classification:row.classification});
  project.lines.find(line=>line.dealerId==='linnea'&&line.eventId==='deal.player.centre').variants[0].videoGenerationId=row.id;
  const {service}=serviceFor(captureFrozenPresentation(input).presentation), frozen=await service.resolve(context);
  for (const box of [3,4]) {
    const result=await selectPresentation({project:frozen.project,dealerId:'linnea',eventId:'deal.player.centre',sourceEvent:{...structuredClone(project.events.find(row=>row.id==='deal.player.centre').exampleEvent),box},mode:'off'},{videoRegistry:frozen.inventory});
    assert.equal(result.videoGenerationId,box===3?row.id:null);
    if(box===4)assert.equal(result.decision.media.reason,'position_clip_missing');
  }
});

test('all bound event media is required, byte/metadata-consistent and rechecked after provider I/O', async () => {
  for(const mutate of [
    f=>f.inventory.videos[1].available=false,
    f=>f.inventory.videos[1].sha256='f'.repeat(64),
    f=>f.inventory.videos[1].classification.situation='win',
    f=>f.snapshot.mediaRows.pop(),
    f=>f.snapshot.projectDocument.value.lines.find(row=>row.dealerId==='linnea'&&row.eventId==='speak.goodluck').variants[0].videoGenerationId='legacy:astrid/goodluck'
  ]) {
    const input=fixture();mutate(input);assert.throws(()=>captureFrozenPresentation(input),error=>error.code==='studio_media_binding_invalid');
  }
  const input=fixture(),capture=captureFrozenPresentation(input);
  const rows=structuredClone(input.snapshot.mediaRows);rows[1].classification.compositing.threshold=.5;
  await assert.rejects(assertCapturedPresentationMedia({getMedia:async id=>rows.find(row=>row.id===id)},capture.mediaPreconditions),error=>error.statusCode===409);
});

test('frozen event media transport checks live scope and revision for each GET/HEAD and refuses another own dealer', async () => {
  const f=serviceFor(captureFrozenPresentation(fixture({secondDealer:true})).presentation);
  const frozen=await f.service.resolve(context), own=f.service.publicVideo(frozen,uuid(2));
  assert.equal(f.service.publicVideo(frozen,uuid(4)),null);
  assert.equal((await f.service.response(new Request('https://game.invalid'+own.src,{headers:{Range:'bytes=0-10'}}))).status,206);
  assert.equal(f.served[0].sha256,own.sha256);
  assert.equal((await f.service.response(new Request('https://game.invalid'+own.src,{method:'HEAD'}))).status,200);
  assert.equal((await f.service.response(new Request('https://game.invalid'+own.src.replace(uuid(2),uuid(4))))).status,404);
  assert.equal((await f.service.response(new Request('https://game.invalid'+own.src+'?url=foreign'))).status,400);
  f.saved.package.revision++;
  assert.equal((await f.service.response(new Request('https://game.invalid'+own.src))).status,409);
  assert.equal(f.served.length,2);
});

test('v3 permits another allowed own dealer in the same portrait room, with complete frozen selection inventory', async () => {
  const f=serviceFor(captureFrozenPresentation(fixture({secondDealer:true})).presentation), frozen=await f.service.resolve({...context,dealerId:'nora'});
  assert.equal(frozen.record.id,uuid(3));assert.equal(frozen.inventory.videos.length,4);
  const result=await selectPresentation({project:frozen.project,dealerId:'nora',eventId:'speak.goodluck',sourceEvent:{type:'speak',line:'goodluck'},mode:'off'},{videoRegistry:frozen.inventory});
  assert.equal(result.videoGenerationId,uuid(4));
  await assert.rejects(f.service.resolve({...context,dealerId:'unknown'}),error=>error.statusCode===404);
});

test('portable v3 decode rejects unknown or cross-event media, changed policy, accessors and idle mismatch', () => {
  const source=captureFrozenPresentation(fixture()).presentation;let reads=0;
  for(const mutate of [
    p=>p.playback.media.pop(),
    p=>p.playback.media.push(structuredClone(p.playback.media[0])),
    p=>p.playback.lines[0].variants[0].triggerIds=['missing'],
    p=>p.playback.lines[0].dealerId='astrid',
    p=>p.playback.media[1].classification.dealerId='nora',
    p=>p.playback.media.find(row=>row.id===uuid(2)).classification.eventId='idle.ready',
    p=>p.playback.lines.find(row=>row.eventId==='idle.ready').variants[0].videoGenerationId=null,
    p=>Object.defineProperty(p.playback.lines[0],'dealerId',{enumerable:true,get(){reads++;return 'linnea';}})
  ]) {const changed=structuredClone(source);mutate(changed);assert.throws(()=>validatePresentationPackage(changed));}
  assert.equal(reads,0);
});

test('room merge preserves old frozen policy, conflicts for a shared retained dealer, permits replacement otherwise', () => {
  const old=captureFrozenPresentation(fixture()).presentation,newer=structuredClone(old);
  newer.playback.lines.find(row=>row.eventId==='speak.goodluck').variants[0].label='Updated baseline';
  assert.throws(()=>mergeFrozenDealerPlayback(old,newer,{registeredDealers:newer.registeredDealers,preservedDealerIds:['linnea']}));
  const merged=mergeFrozenDealerPlayback(old,newer,{registeredDealers:newer.registeredDealers,preservedDealerIds:[]});
  assert.equal(merged.lines.find(row=>row.eventId==='speak.goodluck').variants[0].label,'Updated baseline');
  assert.deepEqual(mergeFrozenDealerPlayback(old,old,{registeredDealers:old.registeredDealers}),old.playback);
});

test('event media CAS supports more than the dealer-count limit without weakening exact revision checks', () => {
  const rows=Array.from({length:40},(_,i)=>({...record('linnea','idle.ready',100+i),revision:'r1'}));
  const conditions=rows.map(({revision,...row})=>({id:row.id,revision,record:row}));
  assert.doesNotThrow(()=>assertFrozenMediaPreconditions(conditions,rows));
  rows.at(-1).revision='r2';assert.throws(()=>assertFrozenMediaPreconditions(conditions,rows),error=>error.statusCode===409);
});

test('v2 idle-only envelopes remain readable and do not fabricate frozen event policies', () => {
  const newer=captureFrozenPresentation(fixture()).presentation;
  const {playback,...v2}=newer;v2.schemaVersion=2;
  const decoded=decodePresentationPackage(encodePresentationPackage(v2));
  assert.equal(decoded.schemaVersion,2);assert.equal(Object.hasOwn(decoded,'playback'),false);
  assert.throws(()=>frozenPlaybackProject(undefined,{registeredDealers:newer.registeredDealers,projectRevision:newer.projectRevision}));
});


test('adding a v3 room retains a different dealer from a historical v2 idle package without inventing event bindings', async () => {
  const selected=captureFrozenPresentation(fixture()).presentation;
  const full=captureFrozenPresentation(fixture({secondDealer:true})).presentation;
  const nora=full.registeredDealers.find(row=>row.id==='nora');
  const previous={schemaVersion:2,projectRevision:'older',registeredDealers:[nora]};
  const registry=[nora,...selected.registeredDealers];
  const playback=mergeFrozenDealerPlayback(previous,selected,{registeredDealers:registry,preservedDealerIds:['nora']});
  const project=frozenPlaybackProject(playback,{registeredDealers:registry,projectRevision:'merged'});
  const noraLines=project.lines.filter(row=>row.dealerId==='nora');
  assert.equal(noraLines.find(row=>row.eventId==='idle.ready').variants[0].videoGenerationId,uuid(3));
  assert.equal(noraLines.filter(row=>row.eventId!=='idle.ready').every(row=>row.variants.every(v=>v.videoGenerationId===null)),true);
  assert.equal(playback.media.some(row=>row.id===uuid(4)),false);
});

test('own saved idle schedule drives the shared controller through automatic and OpenClaw starts, returning to baseline', async () => {
  const input=fixture(),project=input.snapshot.projectDocument.value;
  const clips=[record('linnea','idle.ready',11),record('linnea','idle.ready',12),record('linnea','idle.ready',13)];
  for(const row of clips){input.snapshot.mediaRows.push({...row,revision:'media-1'});input.inventory.videos.push({id:row.id,sha256:row.sha256,bytes:row.size,dealer:'linnea',available:true,classification:row.classification});}
  const policy=createRegisteredIdlePolicy({dealerId:'linnea',baselineVideoId:uuid(1),durationMs:10000});
  policy.variants=[
    {videoId:uuid(11),durationMs:1000,use:'automatic',automatic:{averageEveryMs:5000,jitterMs:0,cooldownMs:10000,maxPerMinute:2}},
    {videoId:uuid(12),durationMs:1000,use:'openclaw',automatic:null,description:'Friendly response'},
    {videoId:uuid(13),durationMs:1000,use:'manual',automatic:null}
  ];
  project.dealerIdlePolicies=[{dealerId:'linnea',policy}];
  const captured=captureFrozenPresentation(input);
  assert.equal(captured.mediaPreconditions.length,5);
  const {service}=serviceFor(captured.presentation),frozen=await service.resolve(context),config=await service.configuration(context);
  assert.deepEqual(config.idlePolicy,policy);assert.equal(config.inventory.families[0].dealerId,'linnea');
  assert.equal(config.inventory.videos.find(row=>row.id===uuid(11)).role,'variant');
  assert.match(config.inventory.videos.find(row=>row.id===uuid(11)).src,/registered-video/);
  assert.equal(JSON.stringify(config).includes('pathname'),false);
  assert.equal(frozen.inventory.families.length,0,'event selection keeps explicit own line bindings');
  const event=await selectPresentation({project:frozen.project,dealerId:'linnea',eventId:'speak.goodluck',sourceEvent:{type:'speak',line:'goodluck'},mode:'off'},{videoRegistry:frozen.inventory});
  assert.equal(event.videoGenerationId,uuid(2));
  let at=0;
  const controller=createLiveIdleController({policy:config.idlePolicy,inventory:config.inventory,dealerId:'linnea',now:()=>at,initialScene:{active:true}});
  let clip=controller.snapshot().clip;assert.equal(clip.videoId,uuid(1));controller.presented(clip.playId);
  at=6000;clip=controller.completed(clip.playId).clip;assert.equal(clip.videoId,uuid(11));assert.equal(clip.reason,'scheduled');
  controller.started(clip.playId);at=7000;clip=controller.completed(clip.playId).clip;assert.equal(clip.videoId,uuid(1));
  assert.equal(controller.offerVariant({videoId:uuid(13),requestId:'manual-not-advice',expiresAt:20000}),false);
  assert.equal(controller.offerVariant({videoId:uuid(12),requestId:'own-advice',expiresAt:20000}),true);
  controller.started(clip.playId);at=8000;clip=controller.completed(clip.playId).clip;assert.equal(clip.videoId,uuid(12));assert.equal(clip.reason,'openclaw');
  controller.started(clip.playId);at=9000;clip=controller.completed(clip.playId).clip;assert.equal(clip.videoId,uuid(1));
  assert.equal(controller.updateScene({actionBusy:true}).state,'blocked');
  at=50000;clip=controller.updateScene({actionBusy:false}).clip;assert.equal(clip.videoId,uuid(1));
  assert.equal(controller.updateScene({speechPlaying:true}).state,'blocked');
  assert.equal(controller.updateScene({speechPlaying:false,speechReady:true}).clip.standardBase,true);
  controller.close();
  input.snapshot.mediaRows.find(row=>row.id===uuid(11)).revision='changed';
  await assert.rejects(assertCapturedPresentationMedia({getMedia:async id=>input.snapshot.mediaRows.find(row=>row.id===id)},captured.mediaPreconditions),error=>error.statusCode===409);
});

test('own idle policy never inherits Astrid, foreign media, missing durations or a changed baseline', () => {
  const input=fixture(),project=input.snapshot.projectDocument.value;
  assert.equal(registeredIdlePolicy(project,'linnea'),null);
  for(const durationMs of [undefined,0,Infinity,61000])assert.throws(()=>createRegisteredIdlePolicy({dealerId:'linnea',baselineVideoId:uuid(1),durationMs}));
  const policy=createRegisteredIdlePolicy({dealerId:'linnea',baselineVideoId:uuid(1),durationMs:10000});
  project.dealerIdlePolicies=[{dealerId:'linnea',policy}];
  const frozen=captureFrozenPresentation(input).presentation;
  policy.base[0].videoId=uuid(99);
  assert.doesNotThrow(()=>validateProject(project),'a draft baseline edit must not delete its saved schedule');
  assert.throws(()=>captureFrozenPresentation(input),error=>error.code==='studio_dealer_idle_policy_mismatch');
  const wrong=structuredClone(frozen);wrong.playback.dealerIdlePolicies[0].policy.familyId='astrid/idle.ready/ready';
  assert.throws(()=>validatePresentationPackage(wrong));
  const foreign=structuredClone(frozen);foreign.playback.dealerIdlePolicies[0].dealerId='nora';
  assert.throws(()=>validatePresentationPackage(foreign));
  const normal=structuredClone(frozen);normal.playback.dealerIdlePolicies[0].policy.variants.push({videoId:uuid(200),durationMs:1000,use:'openclaw',automatic:null});
  assert.throws(()=>validatePresentationPackage(normal));
});


test('v3 frozen own media require a registered adapter and reject retired Amira', async () => {
  const f=serviceFor(captureFrozenPresentation(fixture()).presentation);

  const before=structuredClone(f.saved), frozen=await f.service.resolve(context);
  assert.equal(frozen.record.id,uuid(1));
  const result=await selectPresentation({project:frozen.project,dealerId:'linnea',eventId:'speak.goodluck',sourceEvent:{type:'speak',line:'goodluck'},mode:'off'},{videoRegistry:frozen.inventory});
  assert.equal(result.videoGenerationId,uuid(2));
  const own=f.service.publicVideo(frozen,result.videoGenerationId);
  assert.equal((await f.service.response(new Request('https://game.invalid'+own.src))).status,200);
  assert.deepEqual(f.saved,before);
  f.saved.administration.gameLanes[0].dealer='amira';f.saved.administration.gameLanes[0].mediaCollection='amira-presentation';
  await assert.rejects(f.service.resolve(context),error=>error.statusCode===404);
});
