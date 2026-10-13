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
import { selectPresentation } from '../packages/presentation/runtime/selection.mjs';

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
  let project = addDealer(createSeedProject(), 'johanna', 'Johanna');
  if (secondDealer) project = addDealer(project, 'nora', 'Nora');
  project.lanes = [defaultPresentationLane('johanna')];
  const lane = project.lanes[0]; lane.id = 'johns-johanna'; lane.dealers = secondDealer ? ['johanna', 'nora'] : ['johanna'];
  lane.layers.dealer = {enabled:true, default:'johanna', allowed:[...lane.dealers]};
  const media = [record('johanna','idle.ready',1), record('johanna','speak.goodluck',2,'goodluck')];
  if (secondDealer) media.push(record('nora','idle.ready',3), record('nora','speak.goodluck',4,'goodluck'));
  for (const row of media) project.lines.find(line => line.dealerId === row.classification.dealerId && line.eventId === row.classification.eventId).variants[0].videoGenerationId = row.id;
  const inventory = {families:[],videos:media.map(row => ({id:row.id,sha256:row.sha256,bytes:row.size,dealer:row.classification.dealerId,
    available:true, integrity:'verified', classification:structuredClone(row.classification)}))};
  return {snapshot:{projectDocument:{kind:'project',revision:project.revision,value:project},
    administrationDocument:{kind:'administration',revision:'admin-1',value:{rooms:[]}},
    mediaRows:media.map(row => ({...row,revision:'media-1'}))}, inventory, selectedLaneIds:[lane.id], requiredIdleDealerIds:['johanna']};
}
function serviceFor(presentation) {
  const saved = {operator:{id:'north-id',slug:'north',status:'active'},
    package:{operatorId:'north-id',revision:7,lanes:['johns-johanna'],tables:['room-johanna'],frozen:presentation},
    administration:{rooms:[{schemaVersion:2,id:'room-johanna',name:'Johanna',operatorId:'north-id',presentationLaneId:'johns-johanna',gameLaneId:'portrait-johanna',state:'live'}],
      gameLanes:[{schemaVersion:1,id:'portrait-johanna',label:'Johanna',dealer:'johanna',renderer:'portrait-video',mediaCollection:'johanna-presentation'}]}};
  const served = [];
  return {saved,served,service:createFrozenDealerPresentationContext({readCurrentContext:async () => structuredClone(saved),
    readPresentation:pack => validatePresentationPackage(pack.frozen),
    privateMedia:async (row,request) => {served.push(row);return new Response(request.method==='HEAD'?null:'bytes',{status:request.headers.has('range')?206:200});}})};
}
const context = {operatorSlug:'north',roomId:'room-johanna',packageRevision:7,dealerId:'johanna'};

test('v3 preloading describes only frozen exact baselines, preserving selection and private media scope', async () => {
  const input = fixture({ secondDealer: true }), project = input.snapshot.projectDocument.value;
  const records = [record('johanna','deal.player.centre',5,'box3'),
    record('johanna','deal.dealer',6,'dealer-up'), record('johanna','reveal.dealer',7,'dealer-hole')];
  records[2].classification.kind = 'action';
  for (const row of records) {
    input.snapshot.mediaRows.push({ ...row, revision: 'media-1' });
    input.inventory.videos.push({ id:row.id, sha256:row.sha256, bytes:row.size, dealer:'johanna', available:true, classification:row.classification });
    project.lines.find(line => line.dealerId === 'johanna' && line.eventId === row.classification.eventId).variants[0].videoGenerationId = row.id;
  }
  const alternative = record('johanna','speak.goodluck',8,'goodluck');
  input.snapshot.mediaRows.push({ ...alternative, revision:'media-1' });
  input.inventory.videos.push({ id:alternative.id, sha256:alternative.sha256, bytes:alternative.size, dealer:'johanna', available:true, classification:alternative.classification });
  const speech = project.lines.find(line => line.dealerId === 'johanna' && line.eventId === 'speak.goodluck');
  speech.variants.push({ ...speech.variants[0], id:'johanna.speak.goodluck.alternative', videoGenerationId:alternative.id, selection:{ rules:true, random:true, model:true } });
  const presentation = captureFrozenPresentation(input).presentation, before = structuredClone(presentation);
  const f = serviceFor(presentation), config = await f.service.configuration(context);
  assert.deepEqual(config.eventPreloads.map(({eventId,situation,videoId}) => [eventId,situation,videoId]).sort(), [
    ['deal.player.centre','box3',uuid(5)], ['deal.dealer','dealer-up',uuid(6)],
    ['reveal.dealer','dealer-hole',uuid(7)], ['speak.goodluck','goodluck',uuid(2)],
  ].sort());
  assert.ok(config.eventPreloads.every(row => row.dealerId === 'johanna'));
  assert.ok(config.eventPreloads.every(row => config.inventory.videos.some(video => video.id === row.videoId && video.sha256 && video.src.includes('/north/room-johanna/7/johanna/'))));
  assert.ok(config.inventory.videos.some(row => row.id === uuid(8)), 'eligible alternative is retained for later server selection');
  assert.ok(config.inventory.families.every(row => row.eventId === 'idle.ready'), 'hints do not fabricate selection families');
  assert.equal(JSON.stringify(config).includes('pathname'), false);
  assert.deepEqual(f.saved.package.frozen, before); assert.deepEqual(f.served, [], 'configuration never fetches private media');
  speech.variants[0].videoGenerationId = alternative.id;
  assert.deepEqual((await f.service.configuration(context)).eventPreloads, config.eventPreloads, 'live edits do not change frozen hints');
  const nora = await f.service.configuration({ ...context, dealerId:'nora' });
  assert.deepEqual(nora.eventPreloads, [{dealerId:'nora',eventId:'speak.goodluck',situation:'goodluck',videoId:uuid(4)}]);
  f.saved.package.revision++;
  await assert.rejects(f.service.configuration(context), error => error.statusCode === 409);
});

test('v2 and unbound baselines do not invent event preload candidates', async () => {
  const presentation = captureFrozenPresentation(fixture()).presentation;
  const {playback, ...v2} = presentation; v2.schemaVersion = 2;
  const config = await serviceFor(v2).service.configuration(context);
  assert.equal(Object.hasOwn(config,'eventPreloads'), false);
  const input = fixture();
  input.snapshot.projectDocument.value.lines.find(row => row.dealerId === 'johanna' && row.eventId === 'speak.goodluck').variants[0].videoGenerationId = null;
  assert.deepEqual((await serviceFor(captureFrozenPresentation(input).presentation).service.configuration(context)).eventPreloads, []);
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
  assert.equal(frozen.lines.find(line => line.dealerId === 'johanna' && line.eventId === 'speak.goodluck').variants[0].videoGenerationId, uuid(2));
  const service = serviceFor(legacy).service;
  assert.equal((await service.resolve(context)).dealer.id, 'johanna');
  const newFrozen = frozenPlaybackProject(current.playback, {registeredDealers:current.registeredDealers,projectRevision:current.projectRevision});
  assert.equal(newFrozen.events.length, 17);
  const damaged = structuredClone(legacy);
  damaged.playback.lines = damaged.playback.lines.filter(line => !(line.dealerId === 'johanna' && line.eventId === 'speak.goodluck'));
  assert.throws(() => validatePresentationPackage(damaged), /studio_invalid_presentation/);
});

test('v3 freezes own exact event binding and policy; later live edits cannot change shared selection', async () => {
  const input = fixture(), project = input.snapshot.projectDocument.value;
  project.triggers.push({id:'johanna.goodluck',label:'Good luck',category:'deterministic',path:'event.line',op:'eq',value:'goodluck'});
  const line = project.lines.find(row => row.dealerId==='johanna' && row.eventId==='speak.goodluck');
  line.variants.push({...structuredClone(line.variants[0]),id:'johanna.speak.goodluck.variant1',priority:50,triggerIds:['johanna.goodluck'],selection:{rules:true,model:false,random:false}});
  const captured = captureFrozenPresentation(input), envelope = encodePresentationPackage(captured.presentation);
  assert.equal(captured.presentation.schemaVersion,3); assert.ok(envelope.data.length<6500);
  assert.equal(captured.mediaPreconditions.length,2);
  line.variants[1].selection.rules=false; input.inventory.videos=[]; input.snapshot.mediaRows[1].classification.label='Changed';
  const decoded = decodePresentationPackage(envelope), {service} = serviceFor(decoded), frozen = await service.resolve(context);
  assert.equal(frozen.project.lines.filter(row => ['astrid','vera','amira','mei'].includes(row.dealerId)).every(row => row.variants.every(v => v.videoGenerationId===null)),true);
  const result = await selectPresentation({project:frozen.project,dealerId:'johanna',eventId:'speak.goodluck',sourceEvent:{type:'speak',line:'goodluck'},mode:'rules'}, {videoRegistry:frozen.inventory});
  assert.equal(result.videoGenerationId,uuid(2)); assert.equal(result.variant.id,'johanna.speak.goodluck.variant1');
  const video=service.publicVideo(frozen,result.videoGenerationId);
  assert.equal(video.sha256,decoded.playback.media.find(row=>row.id===uuid(2)).sha256);
  assert.match(video.src,/registered-video\/north\/room-johanna\/7\/johanna\//);
  assert.equal(JSON.stringify(video).includes('pathname'),false);
});

test('exact position mismatch skips video while matching server event uses own frozen film', async () => {
  const input=fixture(), project=input.snapshot.projectDocument.value, row=record('johanna','deal.player.centre',5,'box3');
  input.snapshot.mediaRows.push({...row,revision:'media-1'}); input.inventory.videos.push({id:row.id,sha256:row.sha256,bytes:row.size,dealer:'johanna',available:true,classification:row.classification});
  project.lines.find(line=>line.dealerId==='johanna'&&line.eventId==='deal.player.centre').variants[0].videoGenerationId=row.id;
  const {service}=serviceFor(captureFrozenPresentation(input).presentation), frozen=await service.resolve(context);
  for (const box of [3,4]) {
    const result=await selectPresentation({project:frozen.project,dealerId:'johanna',eventId:'deal.player.centre',sourceEvent:{...structuredClone(project.events.find(row=>row.id==='deal.player.centre').exampleEvent),box},mode:'off'},{videoRegistry:frozen.inventory});
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
    f=>f.snapshot.projectDocument.value.lines.find(row=>row.dealerId==='johanna'&&row.eventId==='speak.goodluck').variants[0].videoGenerationId='legacy:astrid/goodluck'
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
    p=>Object.defineProperty(p.playback.lines[0],'dealerId',{enumerable:true,get(){reads++;return 'johanna';}})
  ]) {const changed=structuredClone(source);mutate(changed);assert.throws(()=>validatePresentationPackage(changed));}
  assert.equal(reads,0);
});

test('room merge preserves old frozen policy, conflicts for a shared retained dealer, permits replacement otherwise', () => {
  const old=captureFrozenPresentation(fixture()).presentation,newer=structuredClone(old);
  newer.playback.lines.find(row=>row.eventId==='speak.goodluck').variants[0].label='Updated baseline';
  assert.throws(()=>mergeFrozenDealerPlayback(old,newer,{registeredDealers:newer.registeredDealers,preservedDealerIds:['johanna']}));
  const merged=mergeFrozenDealerPlayback(old,newer,{registeredDealers:newer.registeredDealers,preservedDealerIds:[]});
  assert.equal(merged.lines.find(row=>row.eventId==='speak.goodluck').variants[0].label,'Updated baseline');
  assert.deepEqual(mergeFrozenDealerPlayback(old,old,{registeredDealers:old.registeredDealers}),old.playback);
});

test('event media CAS supports more than the dealer-count limit without weakening exact revision checks', () => {
  const rows=Array.from({length:40},(_,i)=>({...record('johanna','idle.ready',100+i),revision:'r1'}));
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
  const clips=[record('johanna','idle.ready',11),record('johanna','idle.ready',12),record('johanna','idle.ready',13)];
  for(const row of clips){input.snapshot.mediaRows.push({...row,revision:'media-1'});input.inventory.videos.push({id:row.id,sha256:row.sha256,bytes:row.size,dealer:'johanna',available:true,classification:row.classification});}
  const policy=createRegisteredIdlePolicy({dealerId:'johanna',baselineVideoId:uuid(1),durationMs:10000});
  policy.variants=[
    {videoId:uuid(11),durationMs:1000,use:'automatic',automatic:{averageEveryMs:5000,jitterMs:0,cooldownMs:10000,maxPerMinute:2}},
    {videoId:uuid(12),durationMs:1000,use:'openclaw',automatic:null,description:'Friendly response'},
    {videoId:uuid(13),durationMs:1000,use:'manual',automatic:null}
  ];
  project.dealerIdlePolicies=[{dealerId:'johanna',policy}];
  const captured=captureFrozenPresentation(input);
  assert.equal(captured.mediaPreconditions.length,5);
  const {service}=serviceFor(captured.presentation),frozen=await service.resolve(context),config=await service.configuration(context);
  assert.deepEqual(config.idlePolicy,policy);assert.equal(config.inventory.families[0].dealerId,'johanna');
  assert.equal(config.inventory.videos.find(row=>row.id===uuid(11)).role,'variant');
  assert.match(config.inventory.videos.find(row=>row.id===uuid(11)).src,/registered-video/);
  assert.equal(JSON.stringify(config).includes('pathname'),false);
  assert.equal(frozen.inventory.families.length,0,'event selection keeps explicit own line bindings');
  const event=await selectPresentation({project:frozen.project,dealerId:'johanna',eventId:'speak.goodluck',sourceEvent:{type:'speak',line:'goodluck'},mode:'off'},{videoRegistry:frozen.inventory});
  assert.equal(event.videoGenerationId,uuid(2));
  let at=0;
  const controller=createLiveIdleController({policy:config.idlePolicy,inventory:config.inventory,dealerId:'johanna',now:()=>at,initialScene:{active:true}});
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
  assert.equal(registeredIdlePolicy(project,'johanna'),null);
  for(const durationMs of [undefined,0,Infinity,61000])assert.throws(()=>createRegisteredIdlePolicy({dealerId:'johanna',baselineVideoId:uuid(1),durationMs}));
  const policy=createRegisteredIdlePolicy({dealerId:'johanna',baselineVideoId:uuid(1),durationMs:10000});
  project.dealerIdlePolicies=[{dealerId:'johanna',policy}];
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
  const result=await selectPresentation({project:frozen.project,dealerId:'johanna',eventId:'speak.goodluck',sourceEvent:{type:'speak',line:'goodluck'},mode:'off'},{videoRegistry:frozen.inventory});
  assert.equal(result.videoGenerationId,uuid(2));
  const own=f.service.publicVideo(frozen,result.videoGenerationId);
  assert.equal((await f.service.response(new Request('https://game.invalid'+own.src))).status,200);
  assert.deepEqual(f.saved,before);
  f.saved.administration.gameLanes[0].dealer='amira';f.saved.administration.gameLanes[0].mediaCollection='amira-presentation';
  await assert.rejects(f.service.resolve(context),error=>error.statusCode===404);
});
