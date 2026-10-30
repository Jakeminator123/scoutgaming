import test from 'node:test';
import assert from 'node:assert/strict';
import {addDealer,createEmptyProject,defaultPresentationLane} from '../packages/presentation/contracts/studio-model.mjs';
import {captureFrozenPresentation} from '../packages/presentation/server/frozen-presentation-capture.mjs';
import {withPackagePresentation,readPackagePresentation} from '../packages/presentation/server/presentation-package.mjs';
import {createGameEntrySelector} from '../packages/presentation/server/game-entry-selector.mjs';
import {decorateGameEntryHtml} from '../services/game/public/game-entry-contract.mjs';
import {gameLaneFromDocument} from '../packages/presentation/contracts/game-selection.mjs';
import {dealerVersionPath} from '../services/game/public/dealer-version-switcher.mjs';
import {resolvePlayerSelection} from '../packages/presentation/runtime/player-choices.mjs';
import {defaultCompositionSettings} from '../packages/presentation/contracts/composition-settings.mjs';
import {createPartnerBrandingApi} from '../apps/studio/lib/partner-branding-api.mjs';
import {publishThroughDraft,withBrandingDrafts} from '../apps/studio/test/fixtures/branding-draft-store.mjs';
import {nativeRoomMaterialChoicesFixture} from './fixtures/native-room-game-material.mjs';
import {resolveNativeRoomGameMaterial} from '../packages/presentation/server/native-room-game-material.mjs';
import {validateRoomGameMaterial} from '../packages/presentation/contracts/room-game-config.mjs';

function fixture({schemaVersion=3,includeBaselineDealer=false,branding={}}={}) {
  let project=addDealer(addDealer(addDealer(createEmptyProject(),'linnea','Linnea'),'nora','Nora'),'foreign','Foreign draft');
  if(includeBaselineDealer)for(const id of ['astrid'])project=addDealer(project,id,id);
  const lane=defaultPresentationLane('linnea');project.lanes=[lane];lane.id='johns-presentation';lane.dealers=['linnea','nora',...(includeBaselineDealer?['astrid']:[])];
  lane.layers.dealer={enabled:true,default:'linnea',allowed:[...lane.dealers]};
  lane.operatorAdjustable=['dealer','branding'];lane.composition=defaultCompositionSettings();
  const mediaRows=lane.dealers.map((dealerId,index)=>{
    const id='10000000-0000-4000-8000-'+String(index+1).padStart(12,'0'),sha256=String(index+1).repeat(64);
    project.lines.find(row=>row.dealerId===dealerId&&row.eventId==='idle.ready').variants[0].videoGenerationId=id;
    return {id,sha256,size:4096,contentType:'video/mp4',pathname:`croupier/media/dealers/${dealerId}/review/uploads/${id}/${sha256}.mp4`,
      classification:{dealerId,eventId:'idle.ready',kind:'idle',role:'standard',situation:'',label:dealerId,notes:'',playback:'once',
        compositing:{mode:'green-screen',threshold:.2,softness:.1,despill:0}},revision:'media-'+dealerId};
  });
  const inventory={videos:mediaRows.map(record=>({id:record.id,sha256:record.sha256,bytes:record.size,dealer:record.classification.dealerId,
    available:true,classification:record.classification,kind:'idle',playback:'once'})),families:[],summary:{readable:true,snapshotReadable:true}};
  const snapshot={projectDocument:{kind:'project',revision:project.revision,value:project},
    administrationDocument:{kind:'administration',revision:'admin-snapshot',value:{rooms:[]}},mediaRows};
  let presentation=captureFrozenPresentation({snapshot,inventory,selectedLaneIds:[lane.id],requiredIdleDealerIds:lane.dealers}).presentation;
  if(schemaVersion===2){presentation=structuredClone(presentation);presentation.schemaVersion=2;delete presentation.playback;}
  const room={schemaVersion:2,id:'room-johns',name:'Johns room',operatorId:'north',presentationLaneId:lane.id,
    gameLaneId:'portrait-linnea',state:'live'};
  const administration={gameLane:room.gameLaneId,gameLanes:[{schemaVersion:1,id:room.gameLaneId,label:'Linnea room',
    renderer:'portrait-video',dealer:'linnea',mediaCollection:'linnea-presentation'}],rooms:[room]};
  let pack={operatorId:'north',revision:1,lanes:[lane.id],games:['blackjack'],tables:[room.id],rooms:[room],
    branding:withPackagePresentation({name:'Johns',...branding},presentation)};
  const select=createGameEntrySelector({policy:{readGameConfiguration(){},readSaved:async()=>({project,administration})},
    packages:{resolve:async slug=>slug==='north'?{operator:{id:'north',status:'active'},package:structuredClone(pack)}:{operator:null}},
    log:()=>{}});
  const store=withBrandingDrafts({getCurrentPackage:async id=>id==='north'?structuredClone(pack):null,publishPackage:async input=>{
    assert.equal(input.expectedRevision,pack.revision);pack={...input,rooms:pack.rooms,revision:pack.revision+1};return structuredClone(pack);
  }});
  const readAdministration=async()=>({revision:'admin-snapshot',value:structuredClone(administration)});
  const api=createPartnerBrandingApi({store,readAdministration,readProject:()=>assert.fail('published choices cannot read the latest draft'),
    withWriteContext:work=>work({store,readAdministration,reauthorize:async()=>true})});
  const draft=(branding,{expectedPackageRevision=1,expectedDraftRevision=0}={})=>api.command({operatorId:'north',actor:'partner',action:'save-draft',branding,expectedPackageRevision,expectedDraftRevision});
  const publish=(branding,{expectedPackageRevision=1,expectedDraftRevision=0}={})=>publishThroughDraft(api,{operatorId:'north',actor:'partner',branding,expectedPackageRevision,expectedDraftRevision});
  return {select,api,draft,publish,pack:()=>structuredClone(pack),presentation,lane,room,administration};
}
function clientDocument(selection) {
  const html=decorateGameEntryHtml('<html lang="sv"></html>',selection),dataset={};
  for(const [,attribute,value]of html.matchAll(/data-(game-[a-z-]+)="([^"]*)"/g)) {
    dataset[attribute.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=value.replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>');
  }
  return {dataset,selection:gameLaneFromDocument(dataset)};
}

test('v3 room switches between its two frozen own dealers and excludes a dealer from the latest draft',async()=>{
  const f=fixture(),before=f.pack();
  for(const [requested,expected]of [['linnea','linnea'],['nora','nora']]) {
    const result=await f.select('operator=north&table=room-johns&dealer='+requested);
    assert.equal(result.status,200);
    const {selection}=clientDocument(result.selection);
    assert.equal(selection.dealer,expected);assert.equal(selection.localDealer,expected);
    assert.equal(selection.lane,'portrait-linnea');assert.equal(selection.roomId,'room-johns');
    assert.equal(selection.presentation,'local');assert.equal(selection.packageRevision,1);
    assert.deepEqual(selection.choices.dealers,['linnea','nora']);
    assert.deepEqual(selection.registeredDealers.map(row=>row.id),['linnea','nora']);
  }
  for(const dealer of ['foreign','vera','mei','amira','johanna'])assert.equal((await f.select('operator=north&table=room-johns&dealer='+dealer)).status,404);
  assert.deepEqual(f.pack(),before);
  assert.equal((await f.select('operator=north&table=foreign-room&dealer=nora')).status,404);
  assert.equal((await f.select('operator=foreign&table=room-johns&dealer=nora')).status,404);
});
test('room override reaches server and client bootstrap while explicit allowed choices retain their contract',async()=>{
  const f=fixture({branding:{roomOverrides:{'room-johns':{dealer:'nora'},'other-room':{dealer:'linnea'}}}});
  const before=f.pack(),entry=await f.select('operator=north&table=room-johns');
  assert.equal(entry.selection.dealer,'nora');
  const {selection}=clientDocument(entry.selection);
  assert.equal(selection.dealer,'nora');assert.equal(selection.localDealer,'nora');assert.equal(selection.branding.dealer,'nora');
  assert.equal(resolvePlayerSelection({choices:selection.choices,branding:selection.branding,currentDealer:selection.dealer}).navigateDealer,null);
  assert.equal((await f.select('operator=north&table=room-johns&dealer=linnea')).selection.dealer,'linnea');
  assert.equal((await f.select('operator=north&table=room-johns&dealer=foreign')).status,404);
  assert.equal((await f.select('operator=north&table=other-room')).status,404);
  assert.equal((await f.select('operator=foreign&table=room-johns')).status,404);
  assert.deepEqual(f.pack(),before,'query choices cannot publish or replace a room config');
  const invalid=fixture({branding:{roomOverrides:{'room-johns':{dealer:'foreign'}}}});
  await assert.rejects(invalid.select('operator=north&table=room-johns'),error=>error.statusCode===503);
});

test('published J08 room binds server and client bootstrap to its frozen material dealer before any query override',async()=>{
  const source=nativeRoomMaterialChoicesFixture(),room=source.input.room,pack=source.input.package;
  pack.branding.roomOverrides={[room.id]:{dealer:'paow'}};
  pack.branding.roomGameConfigVersions={[room.id]:'room-config-00000000-0000-4000-8000-000000000001'};
  const lane={schemaVersion:1,id:room.gameLaneId,label:'Fixture lane',renderer:'portrait-video',
    dealer:'dragan',mediaCollection:'dragan-presentation'};
  const administration={gameLane:lane.id,gameLanes:[lane],rooms:[room]};
  const select=createGameEntrySelector({log:()=>{},policy:{readGameConfiguration(){},
    readSaved:async()=>({project:source.project,administration})},
    packages:{resolve:async slug=>slug==='fixture'?{operator:{id:room.operatorId,status:'active'},package:structuredClone(pack)}:{operator:null}}});
  const material=resolveNativeRoomGameMaterial(source.input),before=structuredClone(pack);
  assert.equal(material.dealerId,'paow');
  for(const dealer of [undefined,'paow']){
    const query=new URLSearchParams({operator:'fixture',table:room.id});if(dealer)query.set('dealer',dealer);
    const entry=await select(query);assert.equal(entry.status,200);
    const {selection}=clientDocument(entry.selection);
    assert.equal(entry.selection.dealer,material.dealerId);
    assert.equal(selection.dealer,material.dealerId);assert.equal(selection.localDealer,material.dealerId);
    assert.equal(selection.branding.dealer,material.dealerId);
    assert.deepEqual(validateRoomGameMaterial(material,{dealerId:selection.dealer,language:'sv'}),material);
  }
  const mismatch=await select(new URLSearchParams({operator:'fixture',table:room.id,dealer:'dragan'}));
  assert.deepEqual(mismatch,{status:404},'a different allowed dealer cannot reach the shared room client');
  assert.equal((await select(new URLSearchParams({operator:'foreign',table:room.id,dealer:'paow'}))).status,404);
  assert.equal((await select(new URLSearchParams({operator:'fixture',table:'another-room',dealer:'paow'}))).status,404);
  assert.deepEqual(pack,before,'entry cannot rewrite the published config or room choices');
});

test('another room config never removes the existing query choice from an unconfigured v3 room',async()=>{
  for(const roomGameConfigVersions of [undefined,{}, {'other-room':'room-config-00000000-0000-4000-8000-000000000001'}]){
    const branding={roomOverrides:{'room-johns':{dealer:'nora'}},...(roomGameConfigVersions===undefined?{}:{roomGameConfigVersions})};
    const f=fixture({branding}),before=f.pack();
    const result=await f.select('operator=north&table=room-johns&dealer=linnea');
    assert.equal(result.status,200);assert.equal(clientDocument(result.selection).selection.dealer,'linnea');
    assert.deepEqual(f.pack(),before);
  }
});

test('dealer navigation round trip retains the v3 room and exact requested identity',async t=>{
  const f=fixture(),first=clientDocument((await f.select('operator=north&table=room-johns')).selection);
  const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{value:{documentElement:{dataset:first.dataset}},configurable:true});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;});
  const url=new URL(dealerVersionPath('nora','original','?operator=north&table=room-johns&launch=private'),'https://game.invalid');
  assert.equal(url.pathname,'/game');assert.equal(url.searchParams.get('game'),'blackjack');assert.equal(url.searchParams.has('launch'),false);
  assert.equal(url.searchParams.get('lane'),'portrait-linnea');assert.equal(url.searchParams.get('table'),'room-johns');
  const next=(await f.select(url.searchParams)).selection;
  assert.equal(next.dealer,'nora');assert.equal(next.roomId,'room-johns');
  assert.throws(()=>dealerVersionPath('foreign','original'),/Dealer is not registered/);
});
test('v2 own-dealer room keeps its single-dealer contract even if its frozen lane lists a second dealer',async()=>{
  const f=fixture({schemaVersion:2});
  assert.equal((await f.select('operator=north&table=room-johns&dealer=nora')).status,404);
  const result=await f.select('operator=north&table=room-johns');
  assert.equal(result.selection.dealer,'linnea');
  assert.deepEqual(result.selection.choices.dealers,['linnea']);
  assert.deepEqual((await f.api.readState({operatorId:'north'})).dealerChoices[f.lane.id],['linnea']);
  await assert.rejects(f.draft({dealer:'nora'}),error=>error.statusCode===409);
  assert.equal(f.pack().revision,1);
});
test('partner can save either frozen v3 dealer and the chosen identity reaches that room without rewriting its frozen package',async()=>{
  const f=fixture(),original=readPackagePresentation(f.pack());
  assert.deepEqual((await f.api.readState({operatorId:'north'})).dealerChoices[f.lane.id],['linnea','nora']);
  await assert.rejects(f.draft({dealer:'foreign'}),error=>error.statusCode===422);
  const saved=await f.publish({lane:f.lane.id,dealer:'nora'});
  assert.equal(saved.branding.dealer,'nora');assert.equal(saved.packageRevision,2);
  assert.deepEqual(readPackagePresentation(f.pack()),original);assert.deepEqual(f.pack().tables,['room-johns']);
  const {selection}=clientDocument((await f.select('operator=north&table=room-johns')).selection);
  const choice=resolvePlayerSelection({choices:selection.choices,branding:selection.branding,currentDealer:selection.dealer,composition:selection.composition});
  assert.equal(choice.dealer,'nora');assert.equal(choice.navigateDealer,null);
  assert.equal(selection.dealer,'nora');assert.equal(selection.localDealer,'nora');
  // Draft revision 2 after save and publish; a stale package revision is still a conflict.
  await assert.rejects(f.draft({dealer:'linnea'},{expectedPackageRevision:1,expectedDraftRevision:2}),error=>error.statusCode===409);
  const reverted=await f.publish({dealer:'linnea'},{expectedPackageRevision:2,expectedDraftRevision:2});
  assert.equal(reverted.branding.dealer,'linnea');assert.equal(reverted.packageRevision,3);
});

test('the active baseline dealer uses its own frozen cloud media and never indexed adapters',async()=>{
  const f=fixture({includeBaselineDealer:true}),before=f.pack();
  for(const dealer of ['nora','linnea','astrid']){
    const result=await f.select('operator=north&table=room-johns&dealer='+dealer);
    assert.equal(result.status,200);
    const {selection}=clientDocument(result.selection);
    assert.equal(selection.dealer,dealer);assert.equal(selection.presentation,'local');assert.equal(selection.localDealer,dealer);
    assert.equal(selection.operator,'north');assert.equal(selection.roomId,'room-johns');assert.equal(selection.lane,'portrait-linnea');assert.equal(selection.packageRevision,1);
    assert.deepEqual(selection.choices.dealers,['linnea','nora','astrid']);
    assert.equal(selection.composition.dealer.compatibility,'per-clip');
    assert.ok(f.presentation.playback.media.some(row=>row.classification.dealerId===dealer));
  }
  for(const dealer of ['foreign','vera','mei','amira','johanna'])assert.equal((await f.select('operator=north&table=room-johns&dealer='+dealer)).status,404);
  assert.deepEqual(f.pack(),before);
});
