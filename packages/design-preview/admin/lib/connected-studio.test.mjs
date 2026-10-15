import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedProject, createEmptyProject, addDealer, defaultPresentationLane, addVariant } from '../../../../lab/lib/studio-model.mjs';
import { kindForEvent } from '../../../../lab/lib/video-intake.mjs';
import { bindClip, clipSlots, clipsForSlot, compositionUses, configuredClipIds, currentClipId, createStudioClient, navigationKeepsStudioTab, roomChoicesPath, selectCompositionLayer, uploadMetadata } from './connected-studio.mjs';
import { selectPresentation } from '../../../../packages/presentation/runtime/selection.mjs';
import { createStudioProjectBindings } from '../../../../lab/lib/studio-project-bindings.mjs';
import { materialSource } from '../../../../web/public/material-catalog.mjs';
import { layerAssetPath } from '../../../../web/layer-asset-contract.mjs';
import { speechSlotStandard, speechSlotVariantId } from '../../../../web/public/speech-slot-bindings.mjs';
import { recordedSpeechIdentity } from '../../../../web/public/recorded-speech.mjs';
import { gateRecordedSpeechSelection } from '../../../../web/recorded-speech-selection.mjs';
const id1='11111111-1111-4111-8111-111111111111', id2='22222222-2222-4222-8222-222222222222';
test('room choices in another tab preserve drafts while same-tab navigation retains its leave guard',()=>{
  const event={button:0,metaKey:false,ctrlKey:false,shiftKey:false,altKey:false},anchor={target:'',hasAttribute:()=>false};
  assert.equal(navigationKeepsStudioTab(event,{...anchor,target:'_blank'}),true);
  assert.equal(navigationKeepsStudioTab(event,{...anchor,target:'room-choices'}),true);
  for(const patch of [{button:1},{metaKey:true},{ctrlKey:true},{shiftKey:true},{altKey:true}])assert.equal(navigationKeepsStudioTab({...event,...patch},anchor),true);
  assert.equal(navigationKeepsStudioTab(event,{...anchor,hasAttribute:name=>name==='download'}),true);
  for(const target of ['','_self','_top','_parent'])assert.equal(navigationKeepsStudioTab(event,{...anchor,target}),false);
});
test('room-choice links retain exact owner and room inside Admin, including unpublished drafts',()=>{
  const operator={id:'north',slug:'north-casino'},room={id:'vip-room',operatorId:'north',state:'live',published:true,compositionId:'shared',game:'blackjack'};
  const path='/admin/rooms?view=registered&operator=north&table=vip-room&composition=shared&game=blackjack';
  assert.equal(roomChoicesPath(operator,room),path);
  assert.equal(roomChoicesPath(operator,{...room,state:'preview',published:false}),path);
  for(const changed of [{operatorId:'south'},{state:'archived'},{id:'../other'}])assert.equal(roomChoicesPath(operator,{...room,...changed}),null);
  assert.equal(roomChoicesPath({...operator,id:'../north'},{...room,operatorId:'../north'}),null);
  assert.equal(roomChoicesPath(undefined,room),null);assert.equal(roomChoicesPath(operator,undefined),null);
});

test('shared-template usage lists exact nonarchived room bindings across companies',()=>{
  const catalog={administration:{operators:[{id:'north',name:'North'},{id:'south',name:'South'}],rooms:[
    {id:'north-main',name:'Main',operatorId:'north',compositionId:'shared',state:'live'},
    {id:'north-vip',name:'VIP',operatorId:'north',compositionId:'shared',state:'preview'},
    {id:'south-main',name:'Main',operatorId:'south',compositionId:'shared',state:'live'},
    {id:'retired',operatorId:'south',compositionId:'shared',state:'archived'},
    {id:'same-name',name:'Main',operatorId:'south',compositionId:'other',state:'live'},
  ]}};
  assert.deepEqual(compositionUses(catalog,'shared'),[
    {roomId:'north-main',roomName:'Main',operatorName:'North'},
    {roomId:'north-vip',roomName:'VIP',operatorName:'North'},
    {roomId:'south-main',roomName:'Main',operatorName:'South'},
  ]);assert.deepEqual(compositionUses(catalog,undefined),[]);
});
test('supplied blackjack table is a foreground choice and keeps operator room identity',()=>{
  const project=createSeedProject(),lane=defaultPresentationLane('astrid'),source=materialSource('blackjack-green-felt');
  const {kind,hasAlpha,...metadata}=source;
  const asset={schemaVersion:1,id:id1,role:'table',label:'Blackjack · grön filt',...metadata};asset.pathname=layerAssetPath(asset);
  project.layerAssets=[asset];lane.layers.table.allowed=[asset.id];project.lanes=[lane];
  const room={id:'room-a',operatorId:'operator-a',compositionId:lane.id,game:'blackjack'};
  const next=selectCompositionLayer(project,room,'table',asset.id);
  assert.equal(next.lanes[0].layers.table.default,asset.id);assert.equal(next.lanes[0].composition.tableFront,true);
  assert.equal(project.lanes[0].layers.table.default,null);assert.equal(room.id,'room-a');
  assert.throws(()=>selectCompositionLayer(project,{...room,game:'roulette'},'table',asset.id));
});
function fixture() {
  const project=createSeedProject();
  const classification={label:'A',dealerId:'astrid',eventId:'deal.player.left',kind:kindForEvent(project.events.find(row=>row.id==='deal.player.left')),role:'standard',situation:'box0',playback:'once',notes:'',compositing:{mode:'green-screen',threshold:.38,softness:.12,despill:.6}};
  const video={id:id1,label:'A',available:true,integrity:'verified',previewUrl:'/studio/api/videos/'+id1,classification};
  const inventory={videos:[video],families:[]};
  return {project,inventory,video,slot:clipSlots(project,inventory,'astrid').find(row=>row.id==='deal.player.left/box0')};
}
test('slot candidates reject another dealer, destination, archived and unavailable bytes',()=>{
  const f=fixture(); f.inventory.videos.push(...[
    {...f.video,id:'other',classification:{...f.video.classification,dealerId:'vera'}},
    {...f.video,id:'seat',classification:{...f.video.classification,situation:'box1'}},
    {...f.video,id:'archived',classification:{...f.video.classification,archived:true}},
    {...f.video,id:'missing',available:false},
  ]);
  assert.deepEqual(clipsForSlot(f.inventory,'astrid',f.slot).map(row=>row.id),[id1]);
  assert.throws(()=>bindClip(f.project,f.inventory,'vera',f.slot,id1));
});
test('binding edits only selected existing line; exact IDs survive save and reload',async()=>{
  const f=fixture(), original=structuredClone(f.project);
  let saved=f.project;
  const client=createStudioClient({fetchImpl:async(url,options)=>{
    if(options.method==='PUT') {const body=JSON.parse(options.body);assert.equal(body.expectedRevision,saved.revision);saved={...body.project,revision:'studio.test.2'};return Response.json({project:saved});}
    if(url.endsWith('/catalog'))return Response.json({source:'registered',administration:{revisions:{project:saved.revision}}});
    return Response.json(url.endsWith('/project')?{project:saved}:f.inventory);
  }});
  const draft=bindClip(f.project,f.inventory,'astrid',f.slot,id1);
  assert.deepEqual(f.project,original);
  assert.equal(currentClipId(draft,'astrid',f.slot,undefined,f.inventory),id1);
  assert.equal(draft.lines.find(row=>row.dealerId==='astrid'&&row.eventId===f.slot.eventId).variants[0].videoGenerationId,null);
  assert.deepEqual(draft.lines.filter(row=>row.dealerId!=='astrid'),original.lines.filter(row=>row.dealerId!=='astrid'));
  await client.save(draft); const loaded=await client.load();
  assert.equal(loaded.project.revision,'studio.test.2');assert.deepEqual(loaded.project.lines,draft.lines);
  assert.equal(currentClipId(loaded.project,'astrid',f.slot,undefined,loaded.inventory),id1);
});
test('managed family activation preserves other active variants and reports all bindings',()=>{
  const f=fixture(), family={id:'astrid/deal.player.left/box0',dealerId:'astrid',eventId:'deal.player.left',situation:'box0',playbackType:'once',standardIds:[],variantIds:[id1,id2]};
  f.inventory.families=[family]; f.inventory.videos=[id1,id2].map((id,index)=>({...f.video,id,classification:{...f.video.classification,familyId:family.id,role:'alternative'},familyId:family.id}));
  const slot=clipSlots(f.project,f.inventory,'astrid').find(row=>row.family?.id===family.id);
  const a=bindClip(f.project,f.inventory,'astrid',slot,id1),b=bindClip(a,f.inventory,'astrid',slot,id2);
  assert.deepEqual(configuredClipIds(b,'astrid',slot),[id1,id2]);
  assert.deepEqual(b.mediaPolicy[0].variants[0],a.mediaPolicy[0].variants[0]);
});
test('idle binding requires its exact metadata duration and preserves variant policy',()=>{
  const f=fixture(); f.video.classification={...f.video.classification,eventId:'idle.ready',kind:'idle',situation:''};
  const slot=clipSlots(f.project,f.inventory,'astrid').find(row=>row.eventId==='idle.ready');
  assert.throws(()=>bindClip(f.project,f.inventory,'astrid',slot,id1));
  const next=bindClip(f.project,f.inventory,'astrid',slot,id1,{durationMs:4042});
  assert.equal(next.dealerIdlePolicies[0].policy.base[0].durationMs,4042);
  assert.equal(next.lines.find(row=>row.dealerId==='astrid'&&row.eventId==='idle.ready').variants[0].videoGenerationId,id1);
});
test('layer selection uses only the current composition allowlist; roulette table changes fail closed',()=>{
  const f=fixture(),lane=defaultPresentationLane('astrid');f.project.lanes=[lane];
  lane.layers.background={enabled:true,mode:'image',default:'bg-a',allowed:['bg-a','bg-b']};
  const room={compositionId:lane.id,game:'blackjack'};
  const next=selectCompositionLayer(f.project,room,'background','bg-b');assert.equal(next.lanes[0].layers.background.default,'bg-b');
  assert.throws(()=>selectCompositionLayer(f.project,room,'background','foreign'));
  assert.throws(()=>selectCompositionLayer(f.project,{...room,game:'roulette'},'table',lane.layers.table.default));
});
test('upload metadata remains exact and rejects speech sets and unsupported files',()=>{
  const f=fixture(),file=new File([new Uint8Array(20)],'own.mp4',{type:'video/mp4'});
  const metadata=uploadMetadata(f.project,'astrid',f.slot,file,f.video.classification.compositing);
  assert.equal(metadata.situation,'box0');assert.equal(metadata.dealerId,'astrid');assert.equal(metadata.eventId,'deal.player.left');
  assert.throws(()=>uploadMetadata(f.project,'astrid',{...f.slot,eventId:'speak.goodluck'},file,metadata.compositing));
  assert.throws(()=>uploadMetadata(f.project,'astrid',f.slot,new File(['x'],'wrong.mov'),metadata.compositing));
});
test('upload success is accepted only after exact registered media is reread',async()=>{
  const f=fixture(),file=new File([new Uint8Array(20)],'own.mp4');let calls=0;
  const client=createStudioClient({fetchImpl:async()=>{calls++;return Response.json({...f.inventory,uploadMode:'private-client-blob'});},uploadImpl:async()=>({id:id1,duplicate:false})});
  const result=await client.upload(file,f.video.classification);assert.equal(result.video.id,id1);assert.equal(calls,2);
  f.video.classification={...f.video.classification,situation:'box1'};
  await assert.rejects(client.upload(file,{...f.video.classification,situation:'box0'}),/återläsas/);
});
test('N1 denial and revision conflicts keep the caller draft unchanged; mixed snapshot is rejected',async()=>{
  const f=fixture(),draft=structuredClone(f.project);
  for(const status of [401,403,409,503]){
    const client=createStudioClient({fetchImpl:async()=>Response.json({error:'denied'},{status})});
    await assert.rejects(client.save(draft),error=>error.statusCode===status);assert.deepEqual(draft,f.project);
  }
  const client=createStudioClient({fetchImpl:async url=>Response.json(url.endsWith('/catalog')?{source:'registered',administration:{revisions:{project:'changed'}}}:url.endsWith('/project')?{project:f.project}:f.inventory)});
  await assert.rejects(client.load(),/samma revision/);
});

const slotIds=[id1,id2,'33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555'];
function nativeSlots(eventId,situations){
  const project=createSeedProject();delete project.idlePolicy;
  const event=project.events.find(row=>row.id===eventId);
  const inventory={families:[],videos:situations.map((situation,index)=>({id:slotIds[index],label:situation,dealer:'astrid',bytes:20,sha256:String(index+1).repeat(64),
    available:true,integrity:'verified',previewUrl:'/studio/api/videos/'+slotIds[index],classification:{label:situation,dealerId:'astrid',eventId,
      kind:kindForEvent(event),role:'standard',situation,playback:'once',notes:'',compositing:{mode:'opaque'}}}))};
  const slots=clipSlots(project,inventory,'astrid').filter(row=>row.eventId===eventId);
  return {project,inventory,event,slots};
}
async function nativeChoice(project,inventory,event,changes={}){
  return selectPresentation({project,dealerId:'astrid',eventId:event.id,mode:'rules',sourceEvent:{...event.exampleEvent,...changes}},
    {videoRegistry:inventory,fetchImpl:async()=>{throw Error('No provider calls in exact-slot rules verification');}});
}
test('three destination slots survive save/reload and satisfy native binding and selector contracts',async()=>{
  const f=nativeSlots('deal.player.centre',['box2','box3','box4']), original=structuredClone(f.project);
  let draft=f.project;
  for(const [index,situation] of ['box2','box3','box4'].entries())draft=bindClip(draft,f.inventory,'astrid',f.slots.find(slot=>slot.situation===situation),slotIds[index]);
  const line=draft.lines.find(row=>row.dealerId==='astrid'&&row.eventId===f.event.id);
  assert.equal(line.variants.length,4);assert.equal(line.variants[0].videoGenerationId,null);
  assert.ok(line.variants.slice(1).every(row=>row.selection.rules&&!row.selection.model&&!row.selection.random));
  assert.deepEqual(f.project,original);
  let saved=draft;
  const client=createStudioClient({fetchImpl:async(url,options)=>{
    if(options.method==='PUT'){const body=JSON.parse(options.body);saved={...body.project,revision:'slot.saved.2'};return Response.json({project:saved});}
    return Response.json(url.endsWith('/catalog')?{source:'registered',administration:{revisions:{project:saved.revision}}}:url.endsWith('/project')?{project:saved}:f.inventory);
  }});
  await client.save(draft);const loaded=await client.load();
  await createStudioProjectBindings({videoRegistry:async()=>loaded.inventory})(loaded.project);
  for(const [index,box] of [2,3,4].entries()){
    const slot=f.slots.find(row=>row.situation===`box${box}`);
    assert.equal(currentClipId(loaded.project,'astrid',slot,line.baselineVariantId,loaded.inventory),slotIds[index]);
    assert.deepEqual(configuredClipIds(loaded.project,'astrid',slot,undefined,loaded.inventory),[slotIds[index]]);
    const result=await nativeChoice(loaded.project,loaded.inventory,f.event,{box});
    assert.equal(result.videoGenerationId,slotIds[index]);
    assert.equal(result.eligible.filter(row=>row.id!==line.baselineVariantId).length,1);
  }
});
test('dealer up/hole and reveal use only authoritative native fields',async()=>{
  const f=nativeSlots('deal.dealer',['dealer-up','dealer-hole']);let draft=f.project;
  for(const [index,situation]of ['dealer-up','dealer-hole'].entries())draft=bindClip(draft,f.inventory,'astrid',f.slots.find(slot=>slot.situation===situation),slotIds[index]);
  await createStudioProjectBindings({videoRegistry:async()=>f.inventory})(draft);
  const up=await nativeChoice(draft,f.inventory,f.event,{faceDown:false,card:{r:'8',s:'♣'}});
  const hole=await nativeChoice(draft,f.inventory,f.event,{faceDown:true,card:null});
  assert.equal(up.videoGenerationId,id1);assert.equal(hole.videoGenerationId,id2);
  const reveal=nativeSlots('reveal.dealer',['dealer-hole']);
  const next=bindClip(reveal.project,reveal.inventory,'astrid',reveal.slots[0],id1);
  assert.equal(next.triggers.some(row=>row.path==='event.faceDown'),false);
  await createStudioProjectBindings({videoRegistry:async()=>reveal.inventory})(next);
  assert.equal((await nativeChoice(next,reveal.inventory,reveal.event)).videoGenerationId,id1);
});
test('binding another destination preserves a pre-existing baseline and rejects explicit cross-slot edits',async()=>{
  const f=nativeSlots('deal.player.left',['box0','box1']);
  const base=f.project.lines.find(row=>row.dealerId==='astrid'&&row.eventId===f.event.id);base.variants[0].videoGenerationId=id1;
  const first=bindClip(f.project,f.inventory,'astrid',f.slots.find(row=>row.situation==='box1'),id2);
  const line=first.lines.find(row=>row.dealerId==='astrid'&&row.eventId===f.event.id),slot0=f.slots.find(row=>row.situation==='box0'),slot1=f.slots.find(row=>row.situation==='box1');
  assert.equal(line.variants[0].videoGenerationId,id1);
  assert.equal((await nativeChoice(first,f.inventory,f.event,{box:0})).videoGenerationId,id1);
  assert.equal((await nativeChoice(first,f.inventory,f.event,{box:1})).videoGenerationId,id2);
  assert.throws(()=>bindClip(first,f.inventory,'astrid',slot0,id1,{variantId:line.variants[1].id}),/annat exakt fack/);
  assert.equal(currentClipId(first,'astrid',slot0,line.variants[1].id,f.inventory),'');
  const second=bindClip(first,f.inventory,'astrid',slot1,id2);
  assert.equal(second.lines.find(row=>row.dealerId==='astrid'&&row.eventId===f.event.id).variants.length,2);
});
test('exact slot alternatives preserve custom conditions and enforce four-alternative capacity',()=>{
  const f=nativeSlots('deal.player.centre',['box2','box3','box4']);
  let draft=addVariant(f.project,'astrid',f.event.id,'Custom'),line=draft.lines.find(row=>row.dealerId==='astrid'&&row.eventId===f.event.id);
  const variant=line.variants.at(-1);variant.priority=37;
  draft.triggers.push({id:'custom.slot.condition',label:'Handindex',category:'deterministic',path:'event.handIndex',op:'eq',value:0});variant.triggerIds=['custom.slot.condition'];
  draft=bindClip(draft,f.inventory,'astrid',f.slots.find(row=>row.situation==='box2'),id1,{variantId:variant.id});
  line=draft.lines.find(row=>row.dealerId==='astrid'&&row.eventId===f.event.id);
  assert.equal(line.variants[1].priority,37);assert.ok(line.variants[1].triggerIds.includes('custom.slot.condition'));
  assert.equal(currentClipId(draft,'astrid',f.slots.find(row=>row.situation==='box2'),undefined,f.inventory),id1);
  const updated=bindClip(draft,f.inventory,'astrid',f.slots.find(row=>row.situation==='box2'),id1);
  assert.equal(updated.lines.find(row=>row.dealerId==='astrid'&&row.eventId===f.event.id).variants.length,2);
  let full=f.project;for(let index=0;index<4;index++)full=addVariant(full,'astrid',f.event.id,'Reserved '+index);
  assert.throws(()=>bindClip(full,f.inventory,'astrid',f.slots.find(row=>row.situation==='box3'),id2),/fyra alternativ/);
  const conflicting=addVariant(f.project,'astrid',f.event.id,'Other destination');
  const other=conflicting.lines.find(row=>row.dealerId==='astrid'&&row.eventId===f.event.id).variants.at(-1);
  conflicting.triggers.push({id:'other.destination',label:'Plats 4',category:'deterministic',path:'event.box',op:'in',value:[3]});
  other.triggerIds=['other.destination'];
  assert.throws(()=>bindClip(conflicting,f.inventory,'astrid',f.slots.find(row=>row.situation==='box2'),id1,{variantId:other.id}),/platsvillkor/);
});
test('foreign media and non-authoritative event/slot data cannot create destination triggers',()=>{
  const f=nativeSlots('deal.player.left',['box0','box1']),original=structuredClone(f.project);
  assert.throws(()=>bindClip(f.project,f.inventory,'astrid',f.slots.find(row=>row.situation==='box1'),id1),/passar inte/);
  assert.throws(()=>bindClip(f.project,f.inventory,'astrid',{...f.slots[0],situation:'box6'},id1),/Kortplats/);
  const changed=structuredClone(f.project);changed.events.find(row=>row.id===f.event.id).match={};
  assert.throws(()=>bindClip(changed,f.inventory,'astrid',f.slots[0],id1),/källkontrakt/);
  const foreign=structuredClone(f.inventory);foreign.videos[0].classification.dealerId='vera';
  assert.throws(()=>bindClip(f.project,foreign,'astrid',f.slots[0],id1),/passar inte/);
  assert.deepEqual(f.project,original);
});
test('transition lines still fail closed rather than replace a neighbouring exact slot',()=>{
  for(const [eventId,situations]of [['transition.shoe',['to-shoe','from-shoe']]]){
    const f=nativeSlots(eventId,situations),first=bindClip(f.project,f.inventory,'astrid',f.slots.find(row=>row.situation===situations[0]),id1),before=structuredClone(first);
    assert.throws(()=>bindClip(first,f.inventory,'astrid',f.slots.find(row=>row.situation===situations[1]),id2),/talgruppen|servervillkor/);
    assert.deepEqual(first,before);
    assert.equal(currentClipId(first,'astrid',f.slots.find(row=>row.situation===situations[1]),undefined,f.inventory),'');
  }
});

function speechFixture(){
  const project=addDealer(createEmptyProject(),'dragan','Dragan'),inventory={families:[],videos:[]};
  const slots=clipSlots(project,inventory,'dragan').filter(slot=>slot.sourceType==='speak');
  inventory.videos=slots.map((slot,index)=>{
    const id=`20000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,sha256='a'.repeat(64);
    const recordedSpeech={schemaVersion:1,dealerId:'dragan',lineId:slot.situation,takeId:slot.situation+'_1',language:'sv',exactText:'En testreplik.',
      videoSha256:sha256,audioSha256:'b'.repeat(64),indexSha256:'c'.repeat(64),fps:24,frameCount:72,audioDelayMs:0,
      entryPose:'VILA',exitPose:'VILA',calibrationRevision:'fixture-v1',recording:{status:'pending'},review:{status:'pending'}};
    return {id,sha256,bytes:32,dealer:'dragan',available:true,integrity:'verified',contentType:'video/mp4',label:slot.situation,
      classification:{dealerId:'dragan',eventId:slot.eventId,situation:slot.situation,kind:'speech',role:'standard',label:slot.situation,
        notes:'',playback:'once',recordedSpeech}};
  });
  return {project,inventory,slots};
}

test('all 17 speech slots bind through the shared standard API and survive native save, reload and off-mode selection',async()=>{
  const f=speechFixture(),original=structuredClone(f.project);assert.equal(f.slots.length,17);
  let draft=f.project;
  for(const [index,slot]of f.slots.entries()){
    const line=draft.lines.find(row=>row.dealerId==='dragan'&&row.eventId===slot.eventId);
    draft=bindClip(draft,f.inventory,'dragan',slot,f.inventory.videos[index].id,{variantId:line.baselineVariantId});
  }
  assert.deepEqual(f.project,original);
  assert.equal(draft.lines.find(row=>row.eventId==='speak.other').variants.length,15);
  let saved=draft;
  const client=createStudioClient({fetchImpl:async(url,options)=>{
    if(options.method==='PUT'){const body=JSON.parse(options.body);saved={...body.project,revision:'speech.map.saved.2'};return Response.json({project:saved});}
    return Response.json(url.endsWith('/catalog')?{source:'registered',administration:{revisions:{project:saved.revision}}}:url.endsWith('/project')?{project:saved}:f.inventory);
  }});
  await client.save(draft);const loaded=await client.load();
  await createStudioProjectBindings({videoRegistry:async()=>loaded.inventory})(loaded.project);
  for(const [index,slot]of f.slots.entries()){
    const id=f.inventory.videos[index].id,expected=speechSlotVariantId('dragan',slot.eventId,slot.situation);
    assert.equal(speechSlotStandard(loaded.project,'dragan',slot.eventId,slot.situation).videoGenerationId,id);
    assert.equal(currentClipId(loaded.project,'dragan',slot,undefined,loaded.inventory),id);
    assert.equal(currentClipId(loaded.project,'dragan',slot,expected,loaded.inventory),id);
    assert.equal(currentClipId(loaded.project,'dragan',slot),id);
    assert.deepEqual(configuredClipIds(loaded.project,'dragan',slot,undefined,loaded.inventory),[id]);
    assert.deepEqual(configuredClipIds(loaded.project,'dragan',slot),[id]);
    const result=await selectPresentation({project:loaded.project,dealerId:'dragan',eventId:slot.eventId,sourceEvent:{type:'speak',line:slot.situation},mode:'off'},
      {videoRegistry:loaded.inventory,fetchImpl:async()=>{throw Error('No provider calls in standard mode');}});
    assert.equal(result.videoGenerationId,id);
  }
});

test('speech standards preserve the older baseline and never promote or overwrite another exact slot or manual alternative',()=>{
  const f=speechFixture(),slot=f.slots.find(row=>row.situation==='greeting'),other=f.slots.find(row=>row.situation==='blackjack');
  const video=f.inventory.videos.find(row=>row.classification.situation==='greeting'),otherVideo=f.inventory.videos.find(row=>row.classification.situation==='blackjack');
  const line=f.project.lines.find(row=>row.eventId==='speak.other');line.variants[0].videoGenerationId=video.id;
  assert.equal(currentClipId(f.project,'dragan',slot,undefined,f.inventory),video.id);
  assert.equal(currentClipId(f.project,'dragan',other,undefined,f.inventory),'');
  let draft=bindClip(f.project,f.inventory,'dragan',other,otherVideo.id);
  assert.equal(draft.lines.find(row=>row.eventId==='speak.other').variants[0].videoGenerationId,video.id);
  const otherId=speechSlotVariantId('dragan',other.eventId,other.situation),before=structuredClone(draft);
  assert.throws(()=>bindClip(draft,f.inventory,'dragan',slot,video.id,{variantId:otherId}),/annat exakt talfack/);
  assert.equal(currentClipId(draft,'dragan',slot,otherId,f.inventory),'');
  assert.deepEqual(configuredClipIds(draft,'dragan',slot,otherId,f.inventory),[video.id]);
  assert.deepEqual(draft,before);
  const replacement={...structuredClone(video),id:id2};f.inventory.videos.push(replacement);
  draft=bindClip(draft,f.inventory,'dragan',slot,replacement.id);
  assert.equal(currentClipId(draft,'dragan',slot,undefined,f.inventory),replacement.id);
  assert.deepEqual(configuredClipIds(draft,'dragan',slot,undefined,f.inventory),[replacement.id]);
  replacement.available=false;
  assert.equal(currentClipId(draft,'dragan',slot,undefined,f.inventory),'');
  assert.deepEqual(configuredClipIds(draft,'dragan',slot,undefined,f.inventory),[]);
  replacement.available=true;replacement.integrity='unavailable';
  assert.equal(currentClipId(draft,'dragan',slot,undefined,f.inventory),'');
  assert.deepEqual(configuredClipIds(draft,'dragan',slot,undefined,f.inventory),[]);
  let manual=addVariant(f.project,'dragan','speak.other','Manual');
  const target=manual.lines.find(row=>row.eventId==='speak.other').variants.at(-1);
  manual=bindClip(manual,f.inventory,'dragan',other,otherVideo.id,{variantId:target.id});
  assert.equal(currentClipId(manual,'dragan',other,undefined,f.inventory),'');
  assert.equal(currentClipId(manual,'dragan',other,target.id,f.inventory),otherVideo.id);
  assert.equal(currentClipId(manual,'dragan',slot,target.id,f.inventory),'');
  assert.throws(()=>bindClip(manual,f.inventory,'dragan',slot,video.id,{variantId:target.id}),/annat exakt talfack/);
  assert.deepEqual(manual.lines.find(row=>row.eventId==='speak.other').variants.at(-1).selection,{rules:false,model:false,random:false});
});

test('speech binding retains pending and rejected review gates and rejects missing tuples, changed hashes and deletion',()=>{
  const f=speechFixture(),slot=f.slots.find(row=>row.situation==='greeting'),video=f.inventory.videos.find(row=>row.classification.situation==='greeting');
  for(const status of ['pending','rejected']){
    const tuple=video.classification.recordedSpeech;
    tuple.review=status==='pending'?{status}:{status,by:'fixture',at:'2026-10-14T00:00:00.000Z',identity:recordedSpeechIdentity(tuple)};
    const before=structuredClone(f.inventory),draft=bindClip(f.project,f.inventory,'dragan',slot,video.id);
    assert.deepEqual(f.inventory,before);
    assert.equal(gateRecordedSpeechSelection({video,standard:video},{project:draft,dealerId:'dragan',eventId:slot.eventId,sourceEvent:{type:'speak',line:slot.situation}}).blocked,true);
  }
  for(const edit of [row=>{delete row.classification.recordedSpeech;},row=>{row.sha256='d'.repeat(64);},row=>{row.deletion={state:'pending'};},
    row=>{row.classification.recordedSpeech.lineId='blackjack';}]){
    const inventory=structuredClone(f.inventory),row=inventory.videos.find(row=>row.id===video.id);edit(row);
    assert.throws(()=>bindClip(f.project,inventory,'dragan',slot,video.id),/inspelningsidentitet|passar inte/);
  }
});
test('runtime readiness 503 retains its explicit explanation and status',async()=>{
  const f=fixture(),client=createStudioClient({fetchImpl:async()=>Response.json({error:'studio_presentation_runtime_update_required'},{status:503})});
  await assert.rejects(client.save(f.project),error=>error.statusCode===503&&/Spelmotorn behöver uppdateras/.test(error.message));
});
