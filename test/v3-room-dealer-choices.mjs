import test from 'node:test';
import assert from 'node:assert/strict';
import {addDealer,createEmptyProject,defaultPresentationLane} from '../lab/lib/studio-model.mjs';
import {captureFrozenPresentation} from '../web/storage/frozen-presentation-capture.mjs';
import {withPackagePresentation,readPackagePresentation} from '../web/storage/presentation-package.mjs';
import {createGameEntrySelector} from '../web/game-entry-operator.mjs';
import {decorateGameEntryHtml} from '../web/public/game-entry-contract.mjs';
import {gameLaneFromDocument} from '../web/public/game-lanes.mjs';
import {dealerVersionPath} from '../web/public/dealer-version-switcher.mjs';
import {resolvePlayerSelection} from '../web/public/player-choices.mjs';
import {defaultCompositionSettings} from '../web/public/composition-settings.mjs';
import {createPartnerBrandingApi} from '../lab/lib/partner-branding-api.mjs';

function fixture({schemaVersion=3,includeHistoricalNames=false}={}) {
  let project=addDealer(addDealer(addDealer(createEmptyProject(),'johanna','Johanna'),'nora','Nora'),'foreign','Foreign draft');
  if(includeHistoricalNames)for(const id of ['vera','mei','astrid'])project=addDealer(project,id,id);
  const lane=defaultPresentationLane('johanna');project.lanes=[lane];lane.id='johns-presentation';lane.dealers=['johanna','nora',...(includeHistoricalNames?['vera','mei','astrid']:[])];
  lane.layers.dealer={enabled:true,default:'johanna',allowed:[...lane.dealers]};
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
    gameLaneId:'portrait-johanna',state:'live'};
  const administration={gameLane:room.gameLaneId,gameLanes:[{schemaVersion:1,id:room.gameLaneId,label:'Johanna room',
    renderer:'portrait-video',dealer:'johanna',mediaCollection:'johanna-presentation'}],rooms:[room]};
  let pack={operatorId:'north',revision:1,lanes:[lane.id],games:['blackjack'],tables:[room.id],
    branding:withPackagePresentation({name:'Johns'},presentation)};
  const select=createGameEntrySelector({policy:{readGameConfiguration(){},readSaved:async()=>({project,administration})},
    packages:{resolve:async slug=>slug==='north'?{operator:{id:'north',status:'active'},package:structuredClone(pack)}:{operator:null}},
    log:()=>{}});
  const store={getCurrentPackage:async id=>id==='north'?structuredClone(pack):null,publishPackage:async input=>{
    assert.equal(input.expectedRevision,pack.revision);pack={...input,revision:pack.revision+1};return structuredClone(pack);
  }};
  const readAdministration=async()=>({revision:'admin-snapshot',value:structuredClone(administration)});
  const api=createPartnerBrandingApi({store,readAdministration,readProject:()=>assert.fail('published choices cannot read the latest draft'),
    withWriteContext:work=>work({store,readAdministration,reauthorize:async()=>true})});
  return {select,api,pack:()=>structuredClone(pack),presentation,lane,room,administration};
}
function clientDocument(selection) {
  const html=decorateGameEntryHtml('<html lang="sv"></html>',{CROUPIER_STUDIO_NEON_POLICY:'1'},selection),dataset={};
  for(const [,attribute,value]of html.matchAll(/data-(game-[a-z-]+)="([^"]*)"/g)) {
    dataset[attribute.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=value.replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>');
  }
  return {dataset,selection:gameLaneFromDocument(dataset)};
}

test('v3 room switches between its two frozen own dealers and excludes a dealer from the latest draft',async()=>{
  const f=fixture(),before=f.pack();
  for(const [requested,expected]of [['johanna','johanna'],['nora','nora']]) {
    const result=await f.select('operator=north&table=room-johns&dealer='+requested);
    assert.equal(result.status,200);
    const {selection}=clientDocument(result.selection);
    assert.equal(selection.dealer,expected);assert.equal(selection.localDealer,expected);
    assert.equal(selection.lane,'portrait-johanna');assert.equal(selection.roomId,'room-johns');
    assert.equal(selection.presentation,'local');assert.equal(selection.packageRevision,1);
    assert.deepEqual(selection.choices.dealers,['johanna','nora']);
    assert.deepEqual(selection.registeredDealers.map(row=>row.id),['johanna','nora']);
  }
  for(const dealer of ['foreign','amira'])assert.equal((await f.select('operator=north&table=room-johns&dealer='+dealer)).status,404);
  assert.deepEqual(f.pack(),before);
  assert.equal((await f.select('operator=north&table=foreign-room&dealer=nora')).status,404);
  assert.equal((await f.select('operator=foreign&table=room-johns&dealer=nora')).status,404);
});
test('dealer navigation round trip retains the v3 room and exact requested identity',async t=>{
  const f=fixture(),first=clientDocument((await f.select('operator=north&table=room-johns')).selection);
  const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{value:{documentElement:{dataset:first.dataset}},configurable:true});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;});
  const url=new URL(dealerVersionPath('nora','original','?operator=north&table=room-johns&launch=private'),'https://game.invalid');
  assert.equal(url.pathname,'/blackjack');assert.equal(url.searchParams.has('launch'),false);
  assert.equal(url.searchParams.get('lane'),'portrait-johanna');assert.equal(url.searchParams.get('table'),'room-johns');
  const next=(await f.select(url.searchParams)).selection;
  assert.equal(next.dealer,'nora');assert.equal(next.roomId,'room-johns');
  assert.throws(()=>dealerVersionPath('foreign','original'),/Dealer is not registered/);
});
test('v2 own-dealer room keeps its single-dealer contract even if its frozen lane lists a second dealer',async()=>{
  const f=fixture({schemaVersion:2});
  assert.equal((await f.select('operator=north&table=room-johns&dealer=nora')).status,404);
  const result=await f.select('operator=north&table=room-johns');
  assert.equal(result.selection.dealer,'johanna');
  assert.deepEqual(result.selection.choices.dealers,['johanna']);
  assert.deepEqual((await f.api.read({operatorId:'north'})).dealerChoices[f.lane.id],['johanna']);
  await assert.rejects(f.api.write({operatorId:'north',actor:'partner',expectedRevision:1,branding:{dealer:'nora'}}),error=>error.statusCode===409);
  assert.equal(f.pack().revision,1);
});
test('partner can save either frozen v3 dealer and the chosen identity reaches that room without rewriting its frozen package',async()=>{
  const f=fixture(),original=readPackagePresentation(f.pack());
  assert.deepEqual((await f.api.read({operatorId:'north'})).dealerChoices[f.lane.id],['johanna','nora']);
  await assert.rejects(f.api.write({operatorId:'north',actor:'partner',expectedRevision:1,branding:{dealer:'foreign'}}),error=>error.statusCode===422);
  const saved=await f.api.write({operatorId:'north',actor:'partner',expectedRevision:1,branding:{lane:f.lane.id,dealer:'nora'}});
  assert.equal(saved.branding.dealer,'nora');assert.equal(saved.packageRevision,2);
  assert.deepEqual(readPackagePresentation(f.pack()),original);assert.deepEqual(f.pack().tables,['room-johns']);
  const {selection}=clientDocument((await f.select('operator=north&table=room-johns')).selection);
  const choice=resolvePlayerSelection({choices:selection.choices,branding:selection.branding,currentDealer:selection.dealer,composition:selection.composition});
  assert.equal(choice.dealer,'nora');assert.equal(choice.navigateDealer,'nora');
  assert.equal((await f.select('operator=north&table=room-johns&dealer='+choice.navigateDealer)).selection.dealer,'nora');
  await assert.rejects(f.api.write({operatorId:'north',actor:'partner',expectedRevision:1,branding:{dealer:'johanna'}}),error=>error.statusCode===409);
  const reverted=await f.api.write({operatorId:'north',actor:'partner',expectedRevision:2,branding:{dealer:'johanna'}});
  assert.equal(reverted.branding.dealer,'johanna');assert.equal(reverted.packageRevision,3);
});

test('historical dealer names use their own frozen cloud media and never indexed adapters',async()=>{
  const f=fixture({includeHistoricalNames:true}),before=f.pack();
  for(const dealer of ['nora','vera','johanna','mei','astrid']){
    const result=await f.select('operator=north&table=room-johns&dealer='+dealer);
    assert.equal(result.status,200);
    const {selection}=clientDocument(result.selection);
    assert.equal(selection.dealer,dealer);assert.equal(selection.presentation,'local');assert.equal(selection.localDealer,dealer);
    assert.equal(selection.operator,'north');assert.equal(selection.roomId,'room-johns');assert.equal(selection.lane,'portrait-johanna');assert.equal(selection.packageRevision,1);
    assert.deepEqual(selection.choices.dealers,['johanna','nora','vera','mei','astrid']);
    assert.equal(selection.composition.dealer.compatibility,'per-clip');
    assert.ok(f.presentation.playback.media.some(row=>row.classification.dealerId===dealer));
  }
  for(const dealer of ['foreign','amira'])assert.equal((await f.select('operator=north&table=room-johns&dealer='+dealer)).status,404);
  assert.deepEqual(f.pack(),before);
});
