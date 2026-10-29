import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createSeedProject,addDealer,defaultPresentationLane,normalizeProject} from '../packages/presentation/contracts/studio-model.mjs';
import {createNeonProjectStore} from '../apps/studio/lib/neon-project-store.mjs';
import {createStudioRepository} from '../packages/studio-registry/server/document-repository.mjs';
import {createStudioMemoryPool} from './fixtures/studio-memory-pool.mjs';
import {nativeReceipts} from './fixtures/native-receipts.mjs';
import {captureFrozenPresentation} from '../packages/presentation/server/frozen-presentation-capture.mjs';
import {createFrozenDealerPresentationContext} from '../packages/presentation/server/frozen-dealer-presentation.mjs';
import {encodePresentationPackage,decodePresentationPackage} from '../packages/presentation/server/presentation-package.mjs';
import {createPresentationApi,presentationInput} from '../services/game/presentation-api.mjs';
import {filmedDealSelection} from '../services/game/filmed-deal-selection.mjs';
import {presentationEvents} from '../services/game/partner-presentation.mjs';
import {DRAGAN_KEVIN_PROFILE as profile} from '../packages/presentation/contracts/filmed-profiles/kevin-dragan-f15b2af1.mjs';
import {PAOW_KEVIN_PROFILE} from '../packages/presentation/contracts/filmed-profiles/kevin-paow-c7138759.mjs';
import {nativeRoomMaterialFixture} from './fixtures/native-room-game-material.mjs';
const uuid=n=>'71000000-0000-4000-8000-'+String(n).padStart(12,'0');
const box=(shoeDraw,seat=0)=>({type:'deal',to:'box',box:seat,shoeDraw,faceDown:false,card:{r:'6',s:'S'}});
const hole=shoeDraw=>({type:'deal',to:'dealer',box:null,shoeDraw,faceDown:true,card:null});
function fixture(){
  const project=addDealer(createSeedProject(),'dragan','Dragan');
  project.lanes=[defaultPresentationLane('dragan')];project.lanes[0].id='fixture-lane';
  const classification=(eventId,situation,label)=>({dealerId:'dragan',eventId,situation,label,kind:eventId==='idle.ready'?'idle':'action',
    role:'alternative',notes:'Test fixture only',compositing:{mode:'green-screen',threshold:.23,softness:.15,despill:0}});
  const videos=profile.takes.map((take,i)=>{
    const seat=Number(take.target)-1;
    const eventId=take.target==='flip'?'reveal.dealer':['dealer','hole'].includes(take.target)?'deal.dealer':seat<2?'deal.player.left':seat<5?'deal.player.centre':'deal.player.right';
    const situation=['hole','flip'].includes(take.target)?'dealer-hole':take.target==='dealer'?'dealer-up':'box'+seat;
    return {id:uuid(i+1),sha256:take.sha256,fileName:take.key+'.mp4',available:true,bytes:1000,duration:take.frames/24,
      classification:classification(eventId,situation,take.key)};
  });
  videos.push({id:uuid(100),sha256:'f'.repeat(64),fileName:'idle.mp4',available:true,bytes:1000,duration:2,classification:classification('idle.ready','','Fixture idle')});
  for(const video of videos)video.dealer='dragan';
  for(const line of project.lines.filter(line=>line.dealerId==='dragan')){
    const bound=videos.filter(video=>video.classification.eventId===line.eventId),baseline=structuredClone(line.variants[0]);
    if(line.eventId==='idle.ready')line.variants[0].videoGenerationId=bound[0].id;
    else if(bound.length)line.variants=[baseline,...bound.map((video,i)=>({...structuredClone(baseline),id:`dragan.${line.eventId}.film${i}`,videoGenerationId:video.id,
      selection:{rules:false,model:false,random:false}}))];
  }
  const media=videos.map(video=>({id:video.id,sha256:video.sha256,size:video.bytes,contentType:'video/mp4',classification:structuredClone(video.classification),
    pathname:`croupier/media/dealers/dragan/review/uploads/${video.id}/${video.sha256}.mp4`}));
  return {project:normalizeProject(project),media,inventory:{videos,families:[],summary:{}}};
}
function choose(f,published,sourceEvent=published[0],dealerId='dragan'){
  return filmedDealSelection({...f,published,sourceEvent,dealerId,shoeTransitions:true});
}
const takeVideo=(f,key)=>f.inventory.videos.find(video=>video.sha256===profile.takes.find(take=>take.key===key).sha256);

function bindShoe(f){
  const line=f.project.lines.find(row=>row.dealerId==='dragan'&&row.eventId==='transition.shoe');
  for(const [i,situation] of ['to-shoe','from-shoe'].entries()){
    const video={id:uuid(200+i),sha256:String(i+1).repeat(64),fileName:situation+'.mp4',available:true,bytes:1000,
      dealer:'dragan',classification:{dealerId:'dragan',eventId:'transition.shoe',situation,kind:'action',role:'standard',label:situation,notes:''}};
    f.inventory.videos.push(video);
    f.media.push({id:video.id,sha256:video.sha256,size:1000,contentType:'video/mp4',classification:video.classification,pathname:`croupier/media/dealers/dragan/review/uploads/${video.id}/${video.sha256}.mp4`});
    line.variants.push({...structuredClone(line.variants[0]),id:`dragan.transition.shoe.slot.${situation}`,videoGenerationId:video.id});
  }
}

test('saved directional standards supply transitions, never foreign or library-only alternatives',()=>{
  const f=fixture(),event=box(2);bindShoe(f);
  const chosen=choose(f,[event]);
  assert.equal(chosen.filmedTake.takeKey,'1:base');
  assert.equal(chosen.transitions.before.id,uuid(200));assert.equal(chosen.transitions.after.id,uuid(201));
  f.inventory.videos.find(v=>v.id===uuid(200)).classification.dealerId='astrid';
  assert.equal(choose(f,[event]).filmedTake.takeKey,'1:i');
  f.project.lines.find(row=>row.dealerId==='dragan'&&row.eventId==='transition.shoe').variants.splice(1);
  assert.equal(choose(f,[event]).filmedTake.takeKey,'1:iv');
});

test('only explicit own project references opt in; foreign dealers and library-only media do not',()=>{
  const f=fixture(),event=box(2);
  assert.equal(choose(f,[event]).filmedTake.takeKey,'1:iv');
  assert.equal(choose(f,[event],event,'astrid'),null);
  for(const line of f.project.lines.filter(line=>line.dealerId==='dragan'))for(const variant of line.variants)variant.videoGenerationId=null;
  assert.equal(choose(f,[event]),null);
  const foreign=fixture();for(const video of foreign.inventory.videos)video.classification.dealerId='astrid';
  assert.equal(choose(foreign,[event]),null);
});

test('a bound but incomplete filmed chain returns a static reserve instead of ordinary random selection',()=>{
  const f=fixture(),events=[box(2),box(3,1)];
  takeVideo(f,'2:v').available=false;
  const selection=choose(f,events);
  assert.equal(selection.video,null);assert.equal(selection.filmedTake,null);
  assert.equal(selection.result.decision.media.reason,'position_clip_missing');
  assert.equal(selection.result.decision.media.sequenceReason,'exact_video_missing');
  const reveal={type:'reveal',to:'dealer',shoeDraw:4};takeVideo(f,'flip:base').available=false;
  assert.equal(choose(f,[reveal]).result.decision.media.reason,'frozen_clip_missing');
  const unbound=fixture(),id=takeVideo(unbound,'1:iv').id;
  for(const line of unbound.project.lines)line.variants=line.variants.filter(v=>v.videoGenerationId!==id);
  assert.equal(choose(unbound,[box(2)]).result.decision.media.sequenceReason,'exact_video_missing');
});

test('actual settled-double server ordering never leaves the player take REDO before the VILA flip',()=>{
  const card=(r,shoeDraw)=>({r,s:'S',shoeDraw});
  const prev={round:{phase:'decisions',active:0,holeDraw:5,dealer:[card('6',3)],hands:[{box:0,stake:10,cards:[card('5',2),card('6',4)]}]}};
  const next=structuredClone(prev);next.round.phase='settled';next.round.hands[0].cards.push(card('10',6));next.round.hands[0].result=40;
  next.round.dealer.push(card('9',5),card('5',7));
  const published=presentationEvents(prev,next,'act',{action:'double'}),f=fixture();
  const byDraw=(type,draw)=>choose(f,published,published.find(event=>event.type===type&&event.shoeDraw===draw));
  assert.equal(byDraw('deal',6).filmedTake.takeKey,'1:iv');
  assert.equal(byDraw('reveal',5).filmedTake.takeKey,'flip:base');
  assert.equal(byDraw('deal',7).filmedTake.takeKey,'dealer:iv');
});

test('the canonical committed event owns card, faceDown and target before profile selection',()=>{
  const f=fixture(),published=[hole(8)];
  const canonical=presentationInput({...hole(8),faceDown:false,card:{r:'A',s:'H'}},published);
  assert.equal(canonical.faceDown,true);assert.equal(canonical.card,null);
  const selection=choose(f,published,canonical);
  assert.equal(selection.filmedTake.takeKey,'hole:i');assert.equal(selection.result.decision.sourceEvent.card,null);
  assert.throws(()=>presentationInput({type:'reveal',to:'dealer',shoeDraw:8},published),/committed/);
});

async function serverFixture(t,{frozen=false,shoe=false}={}){
  const f=fixture();
  if(shoe)bindShoe(f);
  const published=[box(2),hole(3)],receipts=new Map([['qa',{version:7,payload:JSON.stringify(published)}]]);
  const db=nativeReceipts(receipts);
  let fallbackCalls=0,resolveCalls=0;
  const context={operatorSlug:'swedish-games',roomId:'fixture-room',packageRevision:4,dealerId:'dragan'};
  const scope={environment:'test',workspaceId:'filmed-fixture'},repository=createStudioRepository({pool:createStudioMemoryPool(),scope});
  const store=createNeonProjectStore({repository,scope,actor:'qa'});
  await repository.initializeDocument('project',{value:createSeedProject(),actor:'qa'});
  const initial=await store.load();f.project.revision=initial.revision;
  await store.save(f.project,initial.revision);f.project=await store.load();
  assert.equal(f.project.lines.filter(row=>row.dealerId==='dragan'&&/^(deal\.|reveal\.)/.test(row.eventId)).reduce((n,row)=>n+row.variants.filter(v=>v.videoGenerationId).length,0),35);
  const captured=captureFrozenPresentation({snapshot:{projectDocument:{kind:'project',revision:f.project.revision,value:f.project},
    administrationDocument:{kind:'administration',revision:'admin-1',value:{rooms:[]}},mediaRows:f.media.map(row=>({...row,revision:'media-1'}))},
    inventory:f.inventory,selectedLaneIds:['fixture-lane'],requiredIdleDealerIds:['dragan']});
  const presentation=decodePresentationPackage(encodePresentationPackage(captured.presentation));
  assert.equal(presentation.playback.media.length,shoe?38:36);
  const saved={operator:{id:'fixture-operator',slug:context.operatorSlug,status:'active'},
    package:{operatorId:'fixture-operator',revision:4,lanes:['fixture-lane'],tables:[context.roomId],frozen:presentation},
    administration:{rooms:[{schemaVersion:2,id:context.roomId,name:'Fixture',operatorId:'fixture-operator',presentationLaneId:'fixture-lane',gameLaneId:'fixture-game',state:'live'}],
      gameLanes:[{schemaVersion:1,id:'fixture-game',label:'Fixture',dealer:'dragan',renderer:'portrait-video',mediaCollection:'dragan-presentation'}]}};
  const service=createFrozenDealerPresentationContext({readCurrentContext:async()=>{resolveCalls++;return structuredClone(saved);},
    readPresentation:pack=>pack.frozen,privateMedia:async()=>{throw Error('selection must not fetch private bytes');}});
  const frozenDealerContext=frozen?service:null;
  const handler=createPresentationApi({db,env:{},store,registryLoader:async()=>f.inventory,frozenDealerContext,
    select:async()=>{fallbackCalls++;throw Error('ordinary selector must not run for configured filmed actions');}});
  const server=createServer((req,res)=>{void handler(req,res,'/api/presentation/select',req.headers['x-fixture-player']??'qa');});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.closeAllConnections();server.close();});
  const post=(event,patch={},headers={})=>fetch(`http://127.0.0.1:${server.address().port}/api/presentation/select`,{
    method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify({dealerId:'dragan',version:7,mode:'off',event,shoeTransitions:true,
      ...(frozen?{presentationContext:context}:{}),...patch})});
  const setPublished=events=>receipts.set('qa',{version:7,payload:JSON.stringify(events)});
  return {...f,published,post,setPublished,counts:()=>({fallbackCalls,resolveCalls})};
}

for(const frozen of [false,true])test(`${frozen?'frozen':'native'} API keeps shoe media exact and scoped after save and publication`,async t=>{
  const f=await serverFixture(t,{frozen,shoe:true});f.setPublished([box(2)]);
  let response=await f.post(box(2));assert.equal(response.status,200,await response.clone().text());
  let result=await response.json();assert.equal(result.video.filmedTake.takeKey,'1:base');
  assert.equal(result.transitions.before.id,uuid(200));assert.equal(result.transitions.after.id,uuid(201));
  const oldClient=await (await f.post(box(2),{shoeTransitions:undefined})).json();
  assert.equal(oldClient.video.filmedTake.takeKey,'1:iv');assert.equal(oldClient.transitions.before,null);
  if(frozen)assert.match(result.transitions.before.src,/registered-video\/swedish-games\/fixture-room\/4\/dragan\//);
  f.inventory.videos.find(v=>v.id===uuid(200)).available=false;
  result=await (await f.post(box(2))).json();
  assert.equal(result.video.filmedTake.takeKey,frozen?'1:base':'1:i');
  assert.equal(result.transitions.before?.id??null,frozen?uuid(200):null);
  assert.equal((await f.post(box(2),{version:6})).status,409);
});

for(const frozen of [false,true])test(`${frozen?'frozen':'native'} selects every one of the 35 exact films after native save and package roundtrip`,async t=>{
  const f=await serverFixture(t,{frozen});
  for(const take of profile.takes){
    const event=shoeDraw=>take.target==='flip'?{type:'reveal',to:'dealer',shoeDraw}:take.target==='hole'?hole(shoeDraw)
      :take.target==='dealer'?{type:'deal',to:'dealer',shoeDraw,faceDown:false,card:{r:'9',s:'H'}}:box(shoeDraw,Number(take.target)-1);
    let events,selected;
    if(take.target==='flip'||take.key==='hole:i'||take.variant==='iv'){events=[event(1)];selected=events[0];}
    else if(take.key==='hole:base'){events=[box(1),event(2)];selected=events[1];}
    else if(take.variant==='i'||take.variant==='v'){events=[event(1),event(2)];selected=events[take.variant==='i'?0:1];}
    else {events=[event(1),event(2),event(3)];selected=events[1];}
    f.setPublished(events);
    const response=await f.post(selected);assert.equal(response.status,200,take.key+' '+await response.clone().text());
    const result=await response.json();assert.equal(result.video?.filmedTake?.takeKey,take.key);
    assert.equal(result.video.sha256,take.sha256);
  }
  assert.equal(f.counts().fallbackCalls,0);
});

for(const frozen of [false,true])test(`${frozen?'frozen':'native'} API rechecks version and uses the complete server receipt for exact film selection`,async t=>{
  const f=await serverFixture(t,{frozen});
  let response=await f.post({...box(2),card:{r:'A',s:'H'}});assert.equal(response.status,200,await response.clone().text());
  let result=await response.json();assert.equal(result.video.filmedTake.takeKey,'1:i');
  assert.deepEqual(result.decision.sourceEvent.card,{r:'6',s:'S'});
  response=await f.post({...hole(3),faceDown:false,card:{r:'K',s:'H'}});assert.equal(response.status,200);
  result=await response.json();assert.equal(result.video.filmedTake.takeKey,'hole:base');assert.equal(result.decision.sourceEvent.card,null);
  assert.equal((await f.post(box(2),{version:6})).status,409);
  assert.equal((await f.post(box(99))).status,409);
  assert.equal((await f.post(box(2),{},{'x-fixture-player':'different-qa'})).status,409);
  takeVideo(f,'1:i').available=false;
  response=await f.post(box(2));assert.equal(response.status,200);result=await response.json();
  if(frozen)assert.equal(result.video.filmedTake.takeKey,'1:i','live library changes cannot alter a frozen selection');
  else {assert.equal(result.video,null);assert.equal(result.standard,null);assert.equal(result.decision.media.reason,'position_clip_missing');}
  assert.equal(f.counts().fallbackCalls,0);
  if(frozen)assert.ok(f.counts().resolveCalls>=2);
});

test('Landningar: the frozen context carries a new dealer\'s copied landings to selection and config; PAOW\'s stay the code profile',async()=>{
  const context=dealerId=>({operatorSlug:'north',roomId:'room-native-fixture',packageRevision:7,dealerId});
  const service=f=>createFrozenDealerPresentationContext({readCurrentContext:async()=>structuredClone({operator:{id:'operator-fixture',slug:'north',status:'active'},
    package:{...f.input.package,frozen:f.presentation},administration:{rooms:[f.input.room],gameLanes:[{schemaVersion:1,id:'fixture-lane',label:'Fixture',
      dealer:f.presentation.registeredDealers[0].id,renderer:'portrait-video',mediaCollection:f.presentation.registeredDealers[0].id+'-presentation'}]}}),
    readPresentation:pack=>pack.frozen,privateMedia:async()=>{throw Error('selection must not fetch private bytes');}});
  const f=nativeRoomMaterialFixture({dealerId:'jakob-2',copyOf:'paow'}),row=f.presentation.registeredDealers[0];
  const frozen=await service(f).resolve(context('jakob-2'));
  assert.equal(frozen.filmedProfile.id,row.filmedProfile.id);assert.deepEqual(frozen.filmedProfile.positions,PAOW_KEVIN_PROFILE.positions);
  assert.deepEqual((await service(f).configuration(context('jakob-2'))).filmedProfile,row.filmedProfile,'the room\'s locked config carries it');
  const events=[box(1)],choose=profile=>filmedDealSelection({project:frozen.project,inventory:frozen.inventory,dealerId:'jakob-2',sourceEvent:events[0],published:events,profile});
  const chosen=choose(frozen.filmedProfile);
  assert.equal(chosen.filmedTake.profileId,row.filmedProfile.id);assert.match(chosen.filmedTake.takeKey,/^1:/);
  assert.equal(chosen.video.sha256,row.filmedProfile.takes[chosen.filmedTake.takeKey].sha256,'its own clip for PAOW\'s landing');
  assert.equal(choose(undefined),null,'without the frozen landings the code register has none for jakob-2');
  // PAOW: no studio profile, so the frozen context and config look exactly as before.
  const p=nativeRoomMaterialFixture({dealerId:'paow'}),paow=await service(p).resolve(context('paow'));
  assert.equal(Object.hasOwn(paow,'filmedProfile'),false);assert.equal(Object.hasOwn(await service(p).configuration(context('paow')),'filmedProfile'),false);
  const own=filmedDealSelection({project:paow.project,inventory:paow.inventory,dealerId:'paow',sourceEvent:events[0],published:events,profile:paow.filmedProfile});
  assert.equal(own.filmedTake.profileId,PAOW_KEVIN_PROFILE.id);assert.equal(own.filmedTake.takeKey,chosen.filmedTake.takeKey);
});
