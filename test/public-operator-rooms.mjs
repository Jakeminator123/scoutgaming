import test from 'node:test';
import assert from 'node:assert/strict';
import {addDealer,createEmptyProject,defaultPresentationLane} from '../lab/lib/studio-model.mjs';
import {captureFrozenPresentation} from '../web/storage/frozen-presentation-capture.mjs';
import {captureFrozenRegisteredDealers,captureFrozenDealerPlayback} from '../web/storage/frozen-dealer-idle.mjs';
import {withPackagePresentation} from '../web/storage/presentation-package.mjs';
import {defaultCompositionSettings} from '../web/public/composition-settings.mjs';
import {buildPresentationPackage,layerAssetPath} from '../web/presentation-layers.mjs';
import {createPublicOperatorRooms,isUnplayableOperatorRooms} from '../web/public-operator-rooms.mjs';
import {validatePublicOperatorRooms} from '../web/public/operator-rooms-contract.mjs';
import {createPortraitRoomEntryFixture} from './fixtures/portrait-room-entry.mjs';
import {materialSource} from '../web/public/material-catalog.mjs';

function asset(role,n) {
  const row={schemaVersion:1,id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,role,label:`${role} ${n}`,
    sha256:'a'.repeat(64),size:128,contentType:'image/png',width:720,height:1280};
  return {...row,pathname:layerAssetPath(row)};
}
function fixture({schemaVersion=3,idleMode='green-screen',extraBaseMode=null,eventMode=null,legacy=false,fullFrame=false,baked=false}={}) {
  const dealers=[['johanna','Johanna published'],['nora','Nora published'],['selma','Selma published'],['astrid','Astrid published'],['foreign','Draft only']];
  const project=dealers.reduce((value,[id,label])=>addDealer(value,id,label),createEmptyProject());
  const lane=defaultPresentationLane('johanna');lane.id='johns-presentation';lane.label='Published presentation';project.lanes=[lane];
  lane.dealers=['johanna','nora','selma','astrid'];lane.layers.dealer={enabled:true,default:'johanna',allowed:[...lane.dealers]};
  lane.composition=defaultCompositionSettings();lane.operatorAdjustable=['dealer','table','background','branding'];
  if(fullFrame)delete lane.composition;
  project.layerAssets=[asset('background',1),asset('background',2),asset('table',3),asset('table',4),asset('table',5)];
  lane.layers.background={enabled:true,mode:'image',default:project.layerAssets[0].id,allowed:project.layerAssets.slice(0,2).map(row=>row.id)};
  if(baked)lane.layers.background.mode='baked';
  lane.layers.table={enabled:true,default:project.layerAssets[2].id,allowed:project.layerAssets.slice(2,4).map(row=>row.id),colors:['#123456']};
  const mediaRows=lane.dealers.map((dealerId,index)=>{
    const id='10000000-0000-4000-8000-'+String(index+1).padStart(12,'0'),sha256=String(index+1).repeat(64);
    project.lines.find(row=>row.dealerId===dealerId&&row.eventId==='idle.ready').variants[0].videoGenerationId=id;
    return {id,sha256,size:4096,contentType:'video/mp4',pathname:`croupier/media/dealers/${dealerId}/review/uploads/${id}/${sha256}.mp4`,
      classification:{dealerId,eventId:'idle.ready',kind:'idle',role:'standard',situation:'',label:dealerId,notes:'',playback:'once',
        compositing:legacy&&dealerId==='selma'?{mode:'opaque'}:{mode:'green-screen',threshold:.2,softness:.1,despill:0}},revision:'media-'+dealerId};
  });
  const compositing = mode => mode === 'green-screen' ? {mode,threshold:.3,softness:.15,despill:.1} : mode === null ? undefined : {mode};
  for (const row of mediaRows) {
    if(!['johanna','nora'].includes(row.classification.dealerId))continue;
    if (idleMode === null) delete row.classification.compositing;
    else row.classification.compositing=compositing(idleMode);
  }
  function extraRecord(n,eventId,mode) {
    const record=structuredClone(mediaRows[0]);record.id='10000000-0000-4000-8000-'+String(n).padStart(12,'0');record.sha256=String(n).repeat(64);
    record.pathname='croupier/media/dealers/johanna/review/uploads/'+record.id+'/'+record.sha256+'.mp4';
    record.classification={...record.classification,eventId,kind:eventId.startsWith('speak.')?'speech':'idle',
      situation:eventId==='speak.goodluck'?'goodluck':'',compositing:compositing(mode)};
    mediaRows.push(record);return record;
  }
  if (extraBaseMode) {
    const extra=extraRecord(5,'idle.ready',extraBaseMode);
    project.dealerIdlePolicies=[{dealerId:'johanna',policy:{schemaVersion:1,familyId:'johanna/idle.ready/ready',
      base:[{videoId:mediaRows[0].id,weight:50,durationMs:10000},{videoId:extra.id,weight:50,durationMs:9000}],variants:[]}}];
    // Different per-clip parameters are fully supported by the compositor.
    if(extraBaseMode==='green-screen')extra.classification.compositing={mode:'green-screen',threshold:.6,softness:.2,despill:.3};
  }
  if (eventMode) {
    const extra=extraRecord(6,'speak.goodluck',eventMode);
    project.lines.find(row=>row.dealerId==='johanna'&&row.eventId==='speak.goodluck').variants[0].videoGenerationId=extra.id;
  }
  const inventory={videos:mediaRows.map(record=>({id:record.id,sha256:record.sha256,bytes:record.size,dealer:record.classification.dealerId,
    available:true,classification:record.classification,kind:'idle',playback:'once'})),families:[],summary:{readable:true,snapshotReadable:true}};
  let presentation;
  if(legacy) {
    // Model an already published package using the historical wire format.
    // New publication deliberately rejects these opaque source records.
    const captured=captureFrozenRegisteredDealers({project,selectedLaneIds:[lane.id],inventory,mediaRows,requiredIdleDealerIds:lane.dealers});
    const events=captureFrozenDealerPlayback({project,inventory,mediaRows,registeredDealers:captured.registeredDealers});
    presentation=buildPresentationPackage(project,[lane.id],project.layerAssets,{registeredDealers:captured.registeredDealers,playback:events.playback});
  } else presentation=captureFrozenPresentation({snapshot:{projectDocument:{kind:'project',revision:project.revision,value:project},
    administrationDocument:{kind:'administration',revision:'admin-snapshot',value:{rooms:[]}},mediaRows},inventory,
    selectedLaneIds:[lane.id],requiredIdleDealerIds:lane.dealers}).presentation;
  if(schemaVersion===2){presentation=structuredClone(presentation);presentation.schemaVersion=2;delete presentation.playback;}
  const room={schemaVersion:2,id:'room-north',name:'North room',operatorId:'north-id',presentationLaneId:lane.id,gameLaneId:'portrait-johanna',state:'live'};
  const administration={gameLane:room.gameLaneId,gameLanes:[{schemaVersion:1,id:room.gameLaneId,label:'Johanna room',
    renderer:'portrait-video',dealer:'johanna',mediaCollection:'johanna-presentation'}],rooms:[room]};
  const operator={id:'north-id',slug:'north',name:'North',status:'active',internalSecret:'never-expose'};
  const state={operator,project,administration,pack:{operatorId:operator.id,revision:7,lanes:[lane.id],games:['blackjack'],tables:[room.id],
    branding:withPackagePresentation({name:'North',dealer:'nora',table:project.layerAssets[3].id,background:project.layerAssets[1].id},presentation)}};
  const calls={operators:0,packages:0,snapshots:0};
  const api=createPublicOperatorRooms({store:{getOperatorBySlug:async slug=>{calls.operators++;return slug===operator.slug?structuredClone(state.operator):null;},
    getCurrentPackage:async()=>{calls.packages++;return structuredClone(state.pack);}},
    policy:{readGameConfiguration(){assert.fail('directory must select an explicit room snapshot');},
      readSaved:async()=>{calls.snapshots++;return structuredClone({project:state.project,administration:state.administration});}}});
  return {api,state,room,lane,presentation,calls};
}
function response() {return {status:0,headers:{},body:'',writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=body;}};}
async function request(api,path='/api/operators/north/rooms',method='GET') {
  const res=response();assert.equal(await api.handle({method,url:path},res,path.split('?')[0]),true);return res;
}

test('public catalog freezes dealer and asset labels and honors company defaults and allowed layers',async()=>{
  const f=fixture(),before=structuredClone(f.state);
  f.state.project.dealers.find(row=>row.id==='johanna').label='Unpublished new label';
  f.state.project.layerAssets[0].label='Unpublished asset';f.state.project.lanes[0].label='Unpublished presentation';
  const value=await f.api.read('north'),room=value.rooms[0];
  assert.equal(value.schemaVersion,1);assert.deepEqual(value.operator,{slug:'north',name:'North'});assert.equal(value.packageRevision,7);
  assert.equal(room.id,'room-north');assert.equal(room.laneId,'portrait-johanna');assert.equal(room.presentation.label,'Published presentation');
  assert.equal(room.dealerDefault,'nora');assert.deepEqual(room.dealers.map(row=>row.id),['johanna','nora','selma','astrid']);
  assert.equal(room.dealers[0].label,'Johanna published');assert.equal(room.dealers[0].independentLayers,true);
  assert.equal(room.dealers[0].table.default,before.project.layerAssets[3].id);
  assert.equal(room.dealers[0].background.default,before.project.layerAssets[1].id);
  assert.deepEqual(room.dealers[0].background.allowed.map(row=>row.label),['background 1','background 2']);
  assert.deepEqual(room.dealers[0].table.allowed.map(row=>row.id),before.project.layerAssets.slice(2,4).map(row=>row.id));
  const selma=room.dealers.find(row=>row.id==='selma');assert.equal(selma.presentation,'local');assert.equal(selma.independentLayers,true);
  assert.deepEqual(selma.table,room.dealers[0].table);assert.deepEqual(selma.background,room.dealers[0].background);
  assert.equal(room.playUrl,'/play/blackjack?operator=north&table=room-north');
  assert.doesNotMatch(JSON.stringify(value),/never-expose|north-id|sha256|pathname|contentType|branding|_scoutPresentation|croupier\/media|Draft only/);
  assert.deepEqual(f.state.pack,before.pack);assert.deepEqual(f.state.administration,before.administration);
  assert.deepEqual(f.calls,{operators:1,packages:1,snapshots:1});
});

test('public room choices use canonical material names without granting unpublished catalog assets',async()=>{
  const f=fixture(),source=materialSource('studio-teal'),{kind,...signature}=source;
  const presentation=structuredClone(f.presentation),asset=presentation.assets[0];
  Object.assign(asset,signature);asset.pathname=layerAssetPath(asset);
  f.state.pack.branding=withPackagePresentation(f.state.pack.branding,presentation);
  const before=structuredClone(f.state),room=(await f.api.read('north')).rooms[0];
  assert.equal(room.id,'room-north');
  assert.deepEqual(room.dealers[0].background.allowed,[{id:asset.id,label:'Studio · turkos'},
    {id:f.presentation.assets[1].id,label:'background 2'}]);
  assert.deepEqual(f.state,before);
});

test('historical opaque or unspecified own idle keeps explicitly allowed independent layers',async()=>{
  for (const idleMode of ['opaque',null]) {
    const f=fixture({legacy:true,idleMode,eventMode:'green-screen'}),before=structuredClone(f.state.pack),room=(await f.api.read('north')).rooms[0];
    for(const id of ['johanna','nora']){
      const dealer=room.dealers.find(row=>row.id===id);assert.equal(dealer.independentLayers,true);
      assert.equal(dealer.table.allowed.length,2);assert.equal(dealer.background.allowed.length,2);
    }
    assert.equal(room.dealers.find(row=>row.id==='astrid').independentLayers,true);
    assert.equal(room.dealers.find(row=>row.id==='selma').independentLayers,true);
    assert.deepEqual(f.state.pack,before,'legacy package bytes stay unchanged');
  }
  const v2=(await fixture({legacy:true,schemaVersion:2,idleMode:'opaque'}).api.read('north')).rooms[0];
  assert.equal(v2.dealers[0].independentLayers,true);
});

test('weighted idle bases use their own keying parameters or the historical default',async()=>{
  for(const extraBaseMode of ['opaque','green-screen']){
    const room=(await fixture({legacy:extraBaseMode==='opaque',extraBaseMode}).api.read('north')).rooms[0];
    const johanna=room.dealers.find(row=>row.id==='johanna');assert.equal(johanna.independentLayers,true);
    assert.equal(johanna.table.enabled,true);assert.equal(johanna.background.enabled,true);
    assert.equal(room.dealers.find(row=>row.id==='nora').independentLayers,true);
  }
});

test('historical opaque event metadata stays readable without disabling allowed environment layers',async()=>{
  const f=fixture({legacy:true,eventMode:'opaque'}),johanna=(await f.api.read('north')).rooms[0].dealers[0];
  assert.equal(johanna.independentLayers,true);assert.equal(johanna.table.allowed.length,2);assert.equal(johanna.background.allowed.length,2);
  assert.equal(f.presentation.playback.media.find(row=>row.classification.eventId==='speak.goodluck').classification.compositing.mode,'opaque');
});

test('historical full-frame and baked flags expose only frozen allowed layers without rewriting the package',async()=>{
  const f=fixture({legacy:true,fullFrame:true,baked:true}),before=structuredClone(f.state.pack);
  const room=(await f.api.read('north')).rooms[0];
  for(const dealer of room.dealers){
    assert.equal(dealer.independentLayers,true);
    assert.deepEqual(dealer.table.allowed.map(row=>row.id),f.lane.layers.table.allowed);
    assert.deepEqual(dealer.background.allowed.map(row=>row.id),f.lane.layers.background.allowed);
    assert.equal(dealer.background.mode,'image');
  }
  assert.deepEqual(f.state.pack,before);
});

test('catalog only lists live owned rooms referenced by the current frozen package',async()=>{
  const f=fixture();
  for(const [id,changes,published]of [['preview',{state:'preview'},true],['pending',{state:'pending'},true],
    ['foreign',{operatorId:'other'},true],['unpublished',{},false],['orphan',{presentationLaneId:'draft-only'},true]]){
    f.state.administration.rooms.push({...f.room,id:'room-'+id,...changes});if(published)f.state.pack.tables.push('room-'+id);
  }
  assert.deepEqual((await f.api.read('north')).rooms.map(room=>room.id),['room-north']);
  f.state.pack.tables=[];assert.deepEqual((await f.api.read('north')).rooms,[]);
});

test('existing plain-text operator and room names remain valid without HTML interpretation',async()=>{
  const f=fixture();f.state.operator.name='North <VIP>';f.room.name='Room <1>';
  const value=await f.api.read('north');assert.equal(value.operator.name,'North <VIP>');assert.equal(value.rooms[0].name,'Room <1>');
});

test('old v2 custom packages expose only the runtime compatible own dealer',async()=>{
  const f=fixture({schemaVersion:2}),value=await f.api.read('north');
  assert.deepEqual(value.rooms[0].dealers.map(row=>row.id),['johanna']);assert.equal(value.rooms[0].dealerDefault,'johanna');
});

test('portrait room fixture exposes only its explicitly published cloud dealer',async()=>{
  const f=createPortraitRoomEntryFixture();
  const api=createPublicOperatorRooms({store:{getOperatorBySlug:async()=>({id:f.room.operatorId,slug:'sg-test',name:'SG test',status:'active'}),
    getCurrentPackage:async()=>f.pack},policy:{readGameConfiguration(){},readSaved:async()=>({project:f.project,administration:f.administration})}});
  const room=(await api.read('sg-test')).rooms[0];assert.equal(room.dealerDefault,'johanna');assert.equal(room.dealers[0].presentation,'local');
  assert.deepEqual(room.dealers.map(row=>row.id),['johanna']);
  const retired=createPortraitRoomEntryFixture({dealer:'amira'});
  const denied=createPublicOperatorRooms({store:{getOperatorBySlug:async()=>({id:retired.room.operatorId,slug:'sg-test',name:'SG test',status:'active'}),getCurrentPackage:async()=>retired.pack},
    policy:{readGameConfiguration(){},readSaved:async()=>({project:retired.project,administration:retired.administration})}});
  const response=await request(denied,'/api/operators/sg-test/rooms');assert.equal(response.status,503);assert.deepEqual(JSON.parse(response.body),{error:'operator_rooms_unavailable'});
  await assert.rejects(denied.read('sg-test'),error=>isUnplayableOperatorRooms(error,'sg-test')&&!isUnplayableOperatorRooms(error,'north'));
});

test('absence of an eligible published room is empty, without any draft/demo fallback',async()=>{
  for(const mode of ['none','unfrozen','other-game']){
    const f=fixture();if(mode==='none')f.state.pack=null;
    else if(mode==='unfrozen')f.state.pack.branding={name:'North'};else f.state.pack.games=['roulette'];
    const value=await f.api.read('north');assert.deepEqual(value.rooms,[]);assert.equal(value.packageRevision,mode==='none'?null:7);
    // A roulette-enabled package still needs its room game checked against the
    // saved administration: the legacy blackjack room must remain excluded.
    assert.equal(f.calls.snapshots,mode==='other-game'?1:0);
  }
});

test('every read rechecks operator status, package revision and room state',async()=>{
  const f=fixture();assert.equal((await f.api.read('north')).rooms.length,1);
  f.state.pack.revision=8;f.room.state='preview';assert.equal((await f.api.read('north')).packageRevision,8);
  assert.equal((await f.api.read('north')).rooms.length,0);f.state.operator.status='suspended';assert.equal(await f.api.read('north'),null);
  assert.equal((await request(f.api)).status,404);assert.equal(await f.api.read('missing'),null);
});

test('unreadable or inconsistent published runtime fails closed without returning raw storage errors',async()=>{
  for(const mode of ['digest','owner','renderer','duplicate-room','no-policy']){
    const f=fixture();let api=f.api;
    if(mode==='digest')f.state.pack.branding._scoutPresentation={...f.state.pack.branding._scoutPresentation,sha256:'b'.repeat(64)};
    if(mode==='owner')f.state.pack.operatorId='someone-else';
    if(mode==='renderer'){Object.assign(f.state.administration.gameLanes[0],{renderer:'indexed-video',dealer:'amira',mediaCollection:'legacy-dealers'});}
    if(mode==='duplicate-room')f.state.administration.rooms.push({...f.room});
    if(mode==='no-policy')api=createPublicOperatorRooms();
    const res=await request(api);assert.equal(res.status,503,mode);assert.deepEqual(JSON.parse(res.body),{error:'operator_rooms_unavailable'});
    await assert.rejects(api.read('north'),error=>isUnplayableOperatorRooms(error,'north')===(mode==='renderer'),mode);
    assert.equal(res.headers['Cache-Control'],'no-store');
  }
  const api=createPublicOperatorRooms({store:{getOperatorBySlug:async()=>{throw Error('secret connection string');},getCurrentPackage(){}},
    policy:{readSaved(){},readGameConfiguration(){}}});
  assert.equal((await request(api)).body,'{"error":"operator_rooms_unavailable"}');
});

test('anonymous GET/HEAD are exact, uncached and reject query/body methods before storage',async()=>{
  const f=fixture(),get=await request(f.api);assert.equal(get.status,200);assert.equal(get.headers['Cache-Control'],'no-store');
  const head=await request(f.api,undefined,'HEAD');assert.equal(head.status,200);assert.equal(head.body,undefined);
  const prior=f.calls.operators;
  const post=await request(f.api,undefined,'POST');assert.equal(post.status,405);assert.equal(post.headers.Allow,'GET, HEAD');
  assert.equal((await request(f.api,'/api/operators/north/rooms?dealer=foreign')).status,400);
  assert.equal((await request(f.api,'/api/operators/%zz/rooms')).status,404);
  assert.equal((await request(f.api,'/api/operators/control/rooms')).status,404);
  assert.equal(f.calls.operators,prior);
  assert.equal(await f.api.handle({method:'GET'},response(),'/api/operators/north'),false);
});

test('portable public decoder rejects wrong origin/context, extra/private fields and malformed choices',async()=>{
  const original=await fixture().api.read('north');
  const copy=validatePublicOperatorRooms(original,{operatorSlug:'north'});assert.deepEqual(copy,original);assert.notEqual(copy,original);
  assert.throws(()=>validatePublicOperatorRooms(original,{operatorSlug:'other'}),/Invalid operator rooms/);
  for(const change of [
    v=>{v.privateToken='secret';},v=>{v.operator.id='internal';},v=>{v.rooms[0].playUrl='https://foreign.test/';},
    v=>{v.rooms[0].dealerDefault='foreign';},v=>{v.rooms[0].dealers.push(v.rooms[0].dealers[0]);},
    v=>{v.rooms[0].dealers[0].table.allowed[0].src='/media/private';},v=>{v.rooms[0].dealers[0].table.default='foreign';},
    v=>{v.rooms[0].dealers[2].table.enabled=false;},v=>{v.packageRevision=null;},
  ]){const value=structuredClone(original);change(value);assert.throws(()=>validatePublicOperatorRooms(value),/Invalid operator rooms/);}
  let getterCalled=false;const accessor=structuredClone(original);
  Object.defineProperty(accessor.operator,'name',{enumerable:true,get(){getterCalled=true;return 'secret';}});
  assert.throws(()=>validatePublicOperatorRooms(accessor));assert.equal(getterCalled,false);
});

test('v3 catalogue retains the same room and grants when its frozen default differs from its portrait anchor',async()=>{
  const f=fixture(),before=structuredClone(f.state.pack);
  Object.assign(f.state.administration.gameLanes[0],{dealer:'astrid',mediaCollection:'astrid-presentation'});
  const value=await f.api.read('north');assert.equal(value.rooms.length,1);
  assert.equal(value.rooms[0].id,f.room.id);assert.equal(value.rooms[0].dealerDefault,'nora','existing company choice keeps precedence');
  assert.deepEqual(value.rooms[0].dealers.map(row=>row.id),['johanna','nora','selma','astrid']);
  assert.deepEqual(f.state.pack,before);
});
