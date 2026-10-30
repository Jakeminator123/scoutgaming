import test from 'node:test';
import {combinedPool} from './fixtures/lifecycle-pool.mjs';
import assert from 'node:assert/strict';
import {defaultPresentationLane} from '../../../packages/presentation/contracts/studio-model.mjs';
import {cloudPresentationFixture} from './fixtures/cloud-presentation.mjs';
import {createResourceLifecycleApi} from '../lib/resource-lifecycle-api.mjs';
import {createStudioAdminApi} from '../lib/studio-admin-api.mjs';
import {createStudioRepository} from '../../../packages/studio-registry/server/document-repository.mjs';
import {createOperatorStore} from '../../../packages/operators/server/operator-store.mjs';
import {buildPresentationPackage} from '../../../packages/presentation/contracts/presentation-layers.mjs';
import {withPackagePresentation,publicPackageBranding,readPackagePresentation} from '../../../packages/presentation/server/presentation-package.mjs';
import {readOperatorLifecycle,withOperatorLifecycle,OPERATOR_LIFECYCLE_KEY} from '../../../packages/operators/server/operator-lifecycle.mjs';
import {lifecycleSnapshotKey} from '../client/admin/lib/studio-resource-lifecycle.mjs';
import {listPackageRooms} from '../../../packages/presentation/server/package-rooms.mjs';
import {assertLifecyclePackages} from '../lib/dealer-lifecycle.mjs';
import {wrapNativePresentationRepository,PRESENTATION_RUNTIME_UPDATE_REQUIRED} from '../lib/presentation-runtime-readiness.mjs';
import {createNativePresentationMutationTransaction} from '../lib/studio-native-runtime.mjs';
import {presentationCapabilitiesForVersion} from '../../../packages/presentation/capability-contract.mjs';
import {defaultCompositionSettings,defaultBlackjackTableGeometry} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {layerAssetPath} from '../../../packages/presentation/contracts/layer-asset-contract.mjs';
const scope={environment:'lifecycle-fixture',workspaceId:'isolated'};
const origin='https://lifecycle.example.invalid',clone=value=>structuredClone(value);
const actor={user:'internal',role:'admin',scope},clock=()=>1791753600000;
function withFrozenAnchors(value){
 const presentation=clone(value),id='30000000-0000-4000-8000-000000000001',sha256='d'.repeat(64),contentType='image/png';
 presentation.assets.push({schemaVersion:1,id,sha256,contentType,size:4096,width:720,height:1280,role:'table',label:'Table',pathname:layerAssetPath({id,sha256,contentType,role:'table'})});
 Object.assign(presentation.lanes[0].layers.table,{enabled:true,allowed:[id],default:id});
 const board=defaultBlackjackTableGeometry(id);
 for(const layout of ['mobile','desktop'])board[layout].anchors={cards:{target:'scene',rect:{x:.1,y:.2,width:.4,height:.5}},bets:{target:'dealer',rect:{x:0,y:0,width:1,height:1}}};
 presentation.lanes[0].composition={...defaultCompositionSettings(),blackjackTables:[board]};return presentation;
}
async function fixture({shared=false,nativeVersion,frozenAnchors=false}={}){
 const pool=combinedPool(scope),repository=createStudioRepository({pool,scope}),cloud=cloudPresentationFixture({lanes:[defaultPresentationLane('astrid')]}),project=cloud.project;
 const gameLane={schemaVersion:1,id:'room-lane-test',label:'Generated',renderer:'portrait-video',dealer:'astrid',mediaCollection:'astrid-presentation'};
 const base={...gameLane,id:'mobile-phone',label:'Default'};
 const room={schemaVersion:2,id:'room-north',name:'North room',operatorId:'north',presentationLaneId:'mobile-phone',gameLaneId:gameLane.id,state:'live'};
 const administration={tiers:{classic:'vera',high:'astrid',vip:'amira'},rooms:[room,...(shared?[{...room,id:'room-other',operatorId:'other',name:'Other room'}]:[])],
  gameLanes:[base,gameLane],gameLane:base.id,tournaments:[],pitboss:{payout10x:true,streak5:true,randomWalkMin:45}};
 await repository.initializeDocument('project',{value:project,actor:'fixture'});
 await repository.initializeDocument('administration',{value:{...administration,rooms:[]},actor:'fixture'});
 const stored=work=>repository.transaction(()=>repository.withTransactionClient(async client=>work(await createOperatorStore({sql:client,scope,now:clock,transaction:fn=>repository.withTransactionClient(fn)}))));
 await stored(store=>store.publishPackage({actor:'fixture',operatorId:'north',expectedRevision:null,lanes:['mobile-phone'],games:['blackjack'],tables:[room.id],rooms:[room],branding:withPackagePresentation({},frozenAnchors?withFrozenAnchors(cloud.presentation):cloud.presentation)}));
 if(shared)await stored(store=>store.publishPackage({actor:'fixture',operatorId:'other',expectedRevision:null,lanes:['mobile-phone'],games:['blackjack'],tables:['room-other'],rooms:administration.rooms.filter(row=>row.operatorId==='other'),branding:withPackagePresentation({},cloud.presentation)}));
 const gates={fetches:[],transactions:0,beforeMutation:null},nativeRepository=nativeVersion===undefined?repository:wrapNativePresentationRepository(repository,{
  env:{CROUPIER_BACKEND_ORIGIN:'https://render.example.invalid'},fetchImpl:async(_url,{headers})=>{
   assert.equal(pool.active,0,'readiness HTTP precedes SQL');assert.ok(!gates.active,'readiness HTTP precedes product mutation');
   const version=Number(headers['X-Presentation-Capability-Version']);gates.fetches.push(version);
   return version>nativeVersion?new Response(null,{status:406}):Response.json(presentationCapabilitiesForVersion(version));
  }});
 // The real native coordinator uses scoped OperatorStore reads. This fixture
 // executes those reads on an isolated read-only connection, never its writer.
 const readPool={async query(sql,values){const client=await pool.connect();try{await client.query('BEGIN READ ONLY');const result=await client.query(sql,values);await client.query('COMMIT');return result;}finally{client.release();}}};
 const service=createResourceLifecycleApi({repository:nativeRepository,scope,now:clock});
 const mutationTransaction=nativeVersion===undefined?work=>work():createNativePresentationMutationTransaction({repository:nativeRepository,pool:readPool,scope,
  boDb:{async transaction(work){gates.transactions++;gates.active=true;try{if(gates.beforeMutation)await gates.beforeMutation();return await work();}finally{gates.active=false;}}}});
 const api=createStudioAdminApi({handlers:service.handlers,authorize:async()=>actor,allowedOrigins:[origin],publicHosts:[new URL(origin).host],mutationTransaction});
 const post=async(action,body,headers={})=>{const response=await api.handle(new Request(origin+'/studio/api/admin/'+action,{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json',...headers},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};};
 const get=()=>service.handlers.get('GET /studio/api/admin/resource-lifecycle')({actor,scope});
 const pack=()=>stored(store=>store.getCurrentPackage('north'));
 const body=async(extra={})=>({operatorId:'north',roomId:room.id,archived:true,expectedAdministrationRevision:(await repository.readDocument('administration')).revision,expectedPackageRevision:(await pack()).revision,...extra});
 return {pool,repository,project,gameLane,room,stored,post,get,pack,body,service,gates};
}
test('archive detaches a room, keeps immutable media/package history and exposes explicit persistent readouts',async()=>{
 const f=await fixture(),before=await f.pack();
 const archived=await f.post('room-lifecycle',await f.body());assert.equal(archived.status,200);
 const read=await f.get(),room=read.rooms.find(row=>row.id==='room-north'),admin=(await f.repository.readDocument('administration')).value,pack=await f.pack();
 assert.equal(room.state,'archived');assert.ok(room.archivedAt);assert.equal(room.published,false);assert.equal(room.canRestore,true);
 assert.deepEqual(admin.rooms,[]);assert.equal(admin.gameLanes.some(row=>row.id===f.gameLane.id),false);assert.deepEqual(pack.tables,[]);
 assert.equal(read.operators[0].archivedRoomCount,1);assert.deepEqual(read.operators[0].lanes,['mobile-phone']);assert.equal(read.operators[0].packageRevision,pack.revision);assert.equal(read.historyCoverage,'complete');
 assert.deepEqual(listPackageRooms({administration:admin,package:pack,operatorId:'north'}),[]);
 assert.deepEqual(JSON.parse(f.pool.snapshot().packages[0].branding),before.branding);
 assert.deepEqual(readPackagePresentation(pack),readPackagePresentation(before));
 assert.throws(()=>assertLifecyclePackages(f.pool.snapshot().packages,{dealerId:'astrid'}),{code:'studio_dealer_published'});
 const restarted=createResourceLifecycleApi({repository:f.repository,scope,now:clock});
 const again=await restarted.handlers.get('GET /studio/api/admin/resource-lifecycle')({actor,scope});assert.deepEqual(again.rooms,read.rooms);
});

test('admin observes roomless company archive and restore when administration revision stays unchanged',async()=>{
 const f=await fixture(),before=await f.get(),operator=before.operators.find(row=>row.id==='other');
 assert.equal(operator.roomCount,0);
 const archived=await f.post('operator-lifecycle',{operatorId:operator.id,archived:true,expectedPackageRevision:operator.packageRevision,expectedAdministrationRevision:before.administrationRevision});
 assert.equal(archived.status,200);assert.equal(archived.body.administrationRevision,before.administrationRevision);
 const afterArchive=await f.get();assert.equal(afterArchive.operators.find(row=>row.id===operator.id).status,'suspended');
 assert.notEqual(lifecycleSnapshotKey(afterArchive),lifecycleSnapshotKey(before));
 const restored=await f.post('operator-lifecycle',{operatorId:operator.id,archived:false,expectedPackageRevision:archived.body.packageRevision,expectedAdministrationRevision:afterArchive.administrationRevision});
 assert.equal(restored.status,200);assert.equal(restored.body.administrationRevision,before.administrationRevision);
 const afterRestore=await f.get();assert.equal(afterRestore.operators.find(row=>row.id===operator.id).status,'active');
 assert.notEqual(lifecycleSnapshotKey(afterRestore),lifecycleSnapshotKey(afterArchive));
 assert.equal(lifecycleSnapshotKey({...afterRestore,operators:[...afterRestore.operators].reverse()}),lifecycleSnapshotKey(afterRestore));
});
test('restore preserves room identity, returns pending, and opening needs a separate tenant/revision checked action',async()=>{
 const f=await fixture();assert.equal((await f.post('room-lifecycle',await f.body())).status,200);
 const result=await f.post('room-lifecycle',await f.body({archived:false}));assert.equal(result.status,200);assert.equal(result.body.room.state,'pending');
 assert.equal(result.body.room.id,f.room.id);assert.deepEqual((await f.pack()).tables,[f.room.id]);
 const open=await f.body();delete open.archived;open.state='live';
 assert.equal((await f.post('room-state',open)).status,200);assert.equal((await f.get()).rooms[0].state,'live');
 const before=f.pool.snapshot();assert.equal((await f.post('room-state',{...open,operatorId:'other',expectedPackageRevision:null})).status,409);assert.deepEqual(f.pool.snapshot(),before);
});
// Plan L3 PR 3: Pausa/Öppna is a package revision (pkg+1) where only `rooms` differs, with and without
// Studio 023; the document keeps the same state. With 023 every room writer sends `rooms` explicitly
// (the fixture does not model the lock statement's document read, so nothing else could write them).
test('pause, opening, archive and restore publish only their package rooms',async t=>{
 const warn=t.mock.method(console,'warn',()=>{});
 const f=await fixture({shared:true}),before=await f.pack(),states=pack=>pack.rooms?.map(row=>[row.id,row.state])??null;
 const body=await f.body();delete body.archived;body.state='pending';
 const paused=await f.post('room-state',body);assert.equal(paused.status,200);
 assert.equal(paused.body.packageRevision,before.revision+1);assert.equal((await f.pack()).revision,before.revision+1);
 assert.deepEqual(states(await f.pack()),[[f.room.id,'pending']]);
 const admin=(await f.repository.readDocument('administration')).value;
 assert.equal(admin.rooms.find(row=>row.id===f.room.id).state,'pending');
 assert.deepEqual(listPackageRooms({administration:admin,package:await f.pack(),operatorId:'north'}).map(row=>row.state),['pending']);
 assert.deepEqual(readPackagePresentation(await f.pack()),readPackagePresentation(before),'only the state differs');
 const opened=await f.post('room-state',{...body,state:'live',expectedAdministrationRevision:paused.body.administrationRevision,expectedPackageRevision:paused.body.packageRevision});
 assert.equal(opened.status,200);assert.equal(opened.body.packageRevision,before.revision+2);
 assert.deepEqual(states(await f.pack()),[[f.room.id,'live']]);
 assert.equal((await f.stored(store=>store.getCurrentPackage('other'))).revision,1,'another company stays unchanged');
 assert.equal((await f.post('room-lifecycle',await f.body())).status,200);assert.deepEqual(states(await f.pack()),[]);
 assert.equal((await f.post('room-lifecycle',await f.body({archived:false}))).status,200);
 assert.deepEqual(states(await f.pack()),[[f.room.id,'pending']]);
 assert.equal(warn.mock.calls.every(call=>call.arguments[0]==='operator_package_rooms_missing'),true);
});
// The pause moves only this company's settings drafts made on its current package (another company's draft
// keeps its base, even the same number), and the journal's package.publish entry names the table and its state.
test('a pause moves only the company\'s own settings drafts and names the table and state in the journal',async()=>{
 const f=await fixture({shared:true}),before=await f.pack(),saved=await f.repository.readDocument('administration');
 const draft=(roomId,operatorId,index)=>({roomId,operatorId,revision:`room-config-00000000-0000-4000-8000-${String(index).padStart(12,'0')}`,
  basePackageRevision:before.revision,gameConfig:{language:'sv',limitPreset:'casual'}});
 await f.repository.saveDocument('administration',{value:{...saved.value,roomGameConfigs:[draft(f.room.id,'north',1),draft('room-other','other',2)]},expectedRevision:saved.revision,actor:'fixture'});
 const body=await f.body();delete body.archived;body.state='pending';
 const paused=await f.post('room-state',body);assert.equal(paused.status,200);
 assert.deepEqual((await f.repository.readDocument('administration')).value.roomGameConfigs.map(row=>[row.roomId,row.basePackageRevision]),
  [[f.room.id,before.revision+1],['room-other',before.revision]]);
 const opened=await f.post('room-state',{...body,state:'live',expectedAdministrationRevision:paused.body.administrationRevision,expectedPackageRevision:paused.body.packageRevision});
 assert.equal(opened.status,200);
 const journal=f.pool.snapshot().operatorAudits.filter(values=>values[6]==='package.publish').map(values=>[values[10],JSON.parse(values[13]).after]);
 assert.deepEqual(journal.slice(-2).map(([revision,after])=>[revision,after.roomId,after.state]),
  [[before.revision+1,f.room.id,'pending'],[before.revision+2,f.room.id,'live']]);
});
test('cross-operator room archive is refused without changing either tenant',async()=>{
 const f=await fixture(),before=f.pool.snapshot();
 assert.equal((await f.post('room-lifecycle',await f.body({operatorId:'other',expectedPackageRevision:null}))).status,409);assert.deepEqual(f.pool.snapshot(),before);
});
test('stale revisions and concurrent archive requests cannot partially change documents or packages',async()=>{
 const f=await fixture();
 for(const changed of [{expectedAdministrationRevision:'old-admin'},{expectedPackageRevision:99}]){const before=f.pool.snapshot();assert.equal((await f.post('room-lifecycle',await f.body(changed))).status,409);assert.deepEqual(f.pool.snapshot(),before);}
 const input=await f.body(),results=await Promise.all([f.post('room-lifecycle',input),f.post('room-lifecycle',input)]);
 assert.deepEqual(results.map(row=>row.status).sort(),[200,409]);assert.equal(readOperatorLifecycle((await f.pack()).branding).rooms.length,1);
});
test('journal and package failures roll back room state and operator status atomically',async()=>{
 for(const action of ['room-lifecycle','operator-lifecycle'])for(const fault of ['publish-package','audit-write']){
  const f=await fixture(),before=f.pool.snapshot(),body=action==='room-lifecycle'?await f.body():{operatorId:'north',archived:true,expectedPackageRevision:1,expectedAdministrationRevision:(await f.repository.readDocument('administration')).revision};
  f.pool.fail(fault);assert.equal((await f.post(action,body)).status,503);assert.deepEqual(f.pool.snapshot(),before);
 }
});
test('company trash detaches its rooms and generated adapters; company restore does not reopen them',async()=>{
 const f=await fixture();
 const archiveBody={operatorId:'north',archived:true,expectedPackageRevision:1,expectedAdministrationRevision:(await f.repository.readDocument('administration')).revision};
 const archived=await f.post('operator-lifecycle',archiveBody);assert.equal(archived.status,200);assert.equal(archived.body.operator.status,'suspended');assert.ok(archived.body.operator.archivedAt);
 const read=await f.get();assert.equal(read.operators.find(row=>row.id==='north').roomCount,0);assert.equal(read.operators.find(row=>row.id==='north').archivedRoomCount,1);
 assert.deepEqual((await f.repository.readDocument('administration')).value.rooms,[]);assert.deepEqual((await f.pack()).tables,[]);
 assert.equal((await f.repository.readDocument('administration')).value.gameLanes.some(row=>row.id===f.gameLane.id),false);
 const expectedAdministrationRevision=archived.body.administrationRevision;
 const restored=await f.post('operator-lifecycle',{operatorId:'north',archived:false,expectedPackageRevision:archived.body.packageRevision,expectedAdministrationRevision});assert.equal(restored.status,200);assert.equal(restored.body.operator.status,'active');assert.equal(restored.body.operator.archivedAt,null);
 assert.equal((await f.get()).rooms[0].state,'archived');assert.deepEqual((await f.pack()).tables,[]);
 const empty=await f.post('operator-lifecycle',{operatorId:'other',archived:true,expectedPackageRevision:null,expectedAdministrationRevision});assert.equal(empty.status,200);
 assert.equal((await f.post('operator-lifecycle',{operatorId:'other',archived:false,expectedPackageRevision:empty.body.packageRevision,expectedAdministrationRevision})).status,200);
 assert.equal((await f.post('room-lifecycle',await f.body({archived:false}))).body.room.state,'pending');
});

test('company trash rejects a changed structure and preserves another company sharing the adapter',async()=>{
 const f=await fixture({shared:true}),before=f.pool.snapshot();
 const body={operatorId:'north',archived:true,expectedPackageRevision:1,expectedAdministrationRevision:'stale'};
 assert.equal((await f.post('operator-lifecycle',body)).status,409);assert.deepEqual(f.pool.snapshot(),before);
 body.expectedAdministrationRevision=(await f.repository.readDocument('administration')).revision;
 assert.equal((await f.post('operator-lifecycle',body)).status,200);
 const admin=(await f.repository.readDocument('administration')).value;
 assert.deepEqual(admin.rooms.map(row=>row.id),['room-other']);assert.ok(admin.gameLanes.some(row=>row.id===f.gameLane.id));
});
test('ordinary publication preserves current lifecycle metadata and cannot replay archived table ids',async()=>{
 const f=await fixture(),old=await f.pack();assert.equal((await f.post('room-lifecycle',await f.body())).status,200);
 const current=await f.pack();
 const refreshed=await f.stored(store=>store.publishPackage({actor:'fixture',operatorId:'north',expectedRevision:current.revision,lanes:old.lanes,games:old.games,tables:[],branding:old.branding}));
 assert.deepEqual(readOperatorLifecycle(refreshed.branding),readOperatorLifecycle(current.branding));
 const before=f.pool.snapshot();await assert.rejects(f.stored(store=>store.publishPackage({actor:'fixture',operatorId:'north',expectedRevision:refreshed.revision,lanes:old.lanes,games:old.games,tables:old.tables,branding:old.branding})),{statusCode:409});assert.deepEqual(f.pool.snapshot(),before);
 const publicBranding=publicPackageBranding(current.branding);assert.equal(Object.hasOwn(publicBranding,OPERATOR_LIFECYCLE_KEY),false);
 const republished=withPackagePresentation(current.branding,readPackagePresentation(current));assert.deepEqual(readOperatorLifecycle(republished),readOperatorLifecycle(current.branding));
});
test('a removed published composition produces a clear restore blocker instead of silently using another presentation',async()=>{
 const f=await fixture();await f.post('room-lifecycle',await f.body());const pack=await f.pack();
 await f.stored(store=>store.publishPackage({actor:'fixture',operatorId:'north',expectedRevision:pack.revision,lanes:[],games:['blackjack'],tables:[],branding:{}}));
 const read=await f.get();assert.equal(read.rooms[0].canRestore,false);assert.ok(read.rooms[0].restoreBlockers.includes('presentation_not_published'));
 const before=f.pool.snapshot();assert.equal((await f.post('room-lifecycle',await f.body({archived:false}))).status,409);assert.deepEqual(f.pool.snapshot(),before);
});
test('archiving one room keeps playback configuration used by another operator room',async()=>{
 const f=await fixture({shared:true});const unconfigured=(await f.get()).rooms.find(row=>row.operatorId==='other');assert.equal(unconfigured.canArchive,true);assert.equal(unconfigured.packageRevision,1);assert.equal((await f.post('room-lifecycle',await f.body())).status,200);
 const admin=(await f.repository.readDocument('administration')).value;assert.ok(admin.gameLanes.some(row=>row.id===f.gameLane.id));assert.equal(admin.rooms[0].operatorId,'other');
});
test('invalid methods, forged actor input and foreign origin cannot reach lifecycle writes',async()=>{
 const f=await fixture(),before=f.pool.snapshot();
 assert.equal((await f.post('operator-lifecycle',{operatorId:'north',archived:true,expectedPackageRevision:1,actor:'other'})).status,400);
 assert.equal((await f.post('room-lifecycle',await f.body(),{origin:'https://foreign.invalid'})).status,403);
 await assert.rejects(f.service.handlers.get('GET /studio/api/admin/resource-lifecycle')({actor:{user:'partner',role:'partner'},scope}),{statusCode:403});
 assert.deepEqual(f.pool.snapshot(),before);
});
test('lifecycle metadata has bounded, integrity checked encoding and is never trusted as public branding',()=>{
 const lifecycle={schemaVersion:1,operator:{archivedAt:'2026-10-12T00:00:00.000Z'},rooms:[]};
 const branding=withOperatorLifecycle({dealer:'astrid'},lifecycle);assert.deepEqual(readOperatorLifecycle(branding),lifecycle);
 branding[OPERATOR_LIFECYCLE_KEY].sha256='0'.repeat(64);assert.throws(()=>readOperatorLifecycle(branding),{code:'studio_invalid_resource_lifecycle'});
 assert.deepEqual(publicPackageBranding(branding),{dealer:'astrid'});
});
test('every lifecycle route declares its selected operator for frozen-package preflight',async()=>{
 for(const action of ['operator-lifecycle','room-lifecycle','room-state']){
  const options=[];let invoked=0;
  const api=createStudioAdminApi({authorize:async()=>actor,allowedOrigins:[origin],publicHosts:[new URL(origin).host],
   handlers:new Map([['POST /studio/api/admin/'+action,()=>{invoked++;return {ok:true};}]]),
   mutationTransaction:async(work,requirement)=>{options.push(requirement);return work();}});
  const response=await api.handle(new Request(origin+'/studio/api/admin/'+action,{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify({operatorId:'north'})}));
  assert.equal(response.status,200);assert.equal(invoked,1);
  assert.deepEqual(options,[{presentationDocuments:['project','administration'],presentationOperatorIds:['north'],presentationMutation:{kind:'resource-lifecycle',value:{}}}]);
 }
});

for(const action of ['room-lifecycle','operator-lifecycle'])for(const nativeVersion of [19,20])test(`${action}: v${nativeVersion} cannot republish anchors held only in a frozen package`,async()=>{
 const f=await fixture({nativeVersion,frozenAnchors:true}),body=await f.body();if(action==='operator-lifecycle')delete body.roomId;
 assert.equal(f.project.lanes[0].composition?.blackjackTables,undefined,'the saved draft has no anchors');
 const before=f.pool.snapshot(),offset=f.pool.trace.length,response=await f.post(action,body);
 assert.equal(response.status,503);assert.equal(response.body.code,PRESENTATION_RUNTIME_UPDATE_REQUIRED);
 assert.deepEqual(f.gates.fetches,[21]);assert.equal(f.gates.transactions,0);assert.deepEqual(f.pool.snapshot(),before);
 assert.ok(!f.pool.trace.slice(offset).some(row=>['save-document','publish-package','operator-status','audit','audit-write'].includes(row.marker)));
});

for(const action of ['room-lifecycle','operator-lifecycle'])test(`${action}: v21 retains frozen anchors with ordinary ownership, revision and rollback rules`,async()=>{
 const f=await fixture({nativeVersion:21,frozenAnchors:true}),original=readPackagePresentation(await f.pack()),body=await f.body();if(action==='operator-lifecycle')delete body.roomId;
 const before=f.pool.snapshot();
 assert.equal((await f.post(action,{...body,expectedPackageRevision:99})).status,409);assert.deepEqual(f.pool.snapshot(),before);
 const foreign={...body,operatorId:'other',expectedPackageRevision:null};
 if(action==='room-lifecycle'){assert.equal((await f.post(action,foreign)).status,409);assert.deepEqual(f.pool.snapshot(),before);}
 f.pool.fail('publish-package');assert.equal((await f.post(action,body)).status,503);assert.deepEqual(f.pool.snapshot(),before,'all lifecycle writes roll back');
 const archived=await f.post(action,body);assert.equal(archived.status,200);assert.equal(archived.body.packageRevision,2);
 assert.deepEqual(readPackagePresentation(await f.pack()),original);
 const restored=await f.post(action,{...body,archived:false,expectedPackageRevision:2,expectedAdministrationRevision:archived.body.administrationRevision});
 assert.equal(restored.status,200);assert.equal(restored.body.packageRevision,3);assert.deepEqual(readPackagePresentation(await f.pack()),original);
 const rows=(await f.get()).rooms;assert.equal(rows[0].state,action==='room-lifecycle'?'pending':'archived');
 assert.ok(f.gates.fetches.includes(21));
});

test('lifecycle cannot acquire frozen anchors between preflight and its SQL transaction',async()=>{
 const f=await fixture({nativeVersion:21}),body=await f.body();body.expectedPackageRevision=2;
 f.gates.beforeMutation=async()=>{const pack=await f.pack();await f.stored(store=>store.publishPackage({actor:'fixture',operatorId:'north',expectedRevision:1,lanes:pack.lanes,games:pack.games,tables:pack.tables,branding:withPackagePresentation(pack.branding,withFrozenAnchors(readPackagePresentation(pack)))}));};
 const admin=await f.repository.readDocument('administration'),response=await f.post('room-lifecycle',body);
 assert.equal(response.status,503);assert.equal(response.body.code,PRESENTATION_RUNTIME_UPDATE_REQUIRED);
 assert.deepEqual(f.gates.fetches,[19],'no second HTTP call while holding SQL');
 assert.deepEqual(await f.repository.readDocument('administration'),admin);assert.equal((await f.pack()).revision,2);
 assert.deepEqual((await f.pack()).tables,[f.room.id]);
});

test('lifecycle preflight reads only the selected operator package and preserves v19 for scenes without anchors',async()=>{
 const f=await fixture({nativeVersion:19}),pack=await f.pack();
 await f.stored(store=>store.publishPackage({actor:'fixture',operatorId:'other',expectedRevision:null,lanes:pack.lanes,games:pack.games,tables:[],branding:withPackagePresentation({},withFrozenAnchors(readPackagePresentation(pack)))}));
 const response=await f.post('room-lifecycle',await f.body());assert.equal(response.status,200);assert.deepEqual(f.gates.fetches,[19]);
 const foreign=await f.stored(store=>store.getCurrentPackage('other'));assert.equal(foreign.revision,1);
});
