import test from 'node:test';
import {combinedPool} from './fixtures/lifecycle-pool.mjs';
import assert from 'node:assert/strict';
import {defaultPresentationLane} from '../lib/studio-model.mjs';
import {cloudPresentationFixture} from './fixtures/cloud-presentation.mjs';
import {createResourceLifecycleApi} from '../lib/resource-lifecycle-api.mjs';
import {createStudioAdminApi} from '../lib/studio-admin-api.mjs';
import {createStudioRepository} from '../../web/storage/studio-repository.mjs';
import {createOperatorStore} from '../../web/storage/operator-store.mjs';
import {buildPresentationPackage} from '../../web/presentation-layers.mjs';
import {withPackagePresentation,publicPackageBranding,readPackagePresentation} from '../../web/storage/presentation-package.mjs';
import {readOperatorLifecycle,withOperatorLifecycle,OPERATOR_LIFECYCLE_KEY} from '../../web/storage/operator-lifecycle.mjs';
import {lifecycleSnapshotKey} from '../../packages/design-preview/admin/lib/studio-resource-lifecycle.mjs';
import {listPackageRooms} from '../../web/presentation-room-contract.mjs';
import {assertLifecyclePackages} from '../lib/dealer-lifecycle.mjs';
const scope={environment:'lifecycle-fixture',workspaceId:'isolated'};
const origin='https://lifecycle.example.invalid',clone=value=>structuredClone(value);
const actor={user:'internal',role:'admin',scope},clock=()=>1791753600000;
async function fixture({shared=false}={}){
 const pool=combinedPool(scope),repository=createStudioRepository({pool,scope}),cloud=cloudPresentationFixture({lanes:[defaultPresentationLane('astrid')]}),project=cloud.project;
 const gameLane={schemaVersion:1,id:'room-lane-test',label:'Generated',renderer:'portrait-video',dealer:'astrid',mediaCollection:'astrid-presentation'};
 const base={...gameLane,id:'mobile-phone',label:'Default'};
 const room={schemaVersion:2,id:'room-north',name:'North room',operatorId:'north',presentationLaneId:'mobile-phone',gameLaneId:gameLane.id,state:'live'};
 const administration={tiers:{classic:'vera',high:'astrid',vip:'amira'},rooms:[room,...(shared?[{...room,id:'room-other',operatorId:'other',name:'Other room'}]:[])],
  gameLanes:[base,gameLane],gameLane:base.id,tournaments:[],pitboss:{payout10x:true,streak5:true,randomWalkMin:45}};
 await repository.initializeDocument('project',{value:project,actor:'fixture'});
 await repository.initializeDocument('administration',{value:administration,actor:'fixture'});
 const stored=work=>repository.transaction(()=>repository.withTransactionClient(async client=>work(await createOperatorStore({sql:client,scope,now:clock,transaction:fn=>repository.withTransactionClient(fn)}))));
 await stored(store=>store.publishPackage({actor:'fixture',operatorId:'north',expectedRevision:null,lanes:['mobile-phone'],games:['blackjack'],tables:[room.id],branding:withPackagePresentation({},cloud.presentation)}));
 const service=createResourceLifecycleApi({repository,scope,now:clock});
 const api=createStudioAdminApi({handlers:service.handlers,authorize:async()=>actor,allowedOrigins:[origin],publicHosts:[new URL(origin).host],mutationTransaction:work=>work()});
 const post=async(action,body,headers={})=>{const response=await api.handle(new Request(origin+'/studio/api/admin/'+action,{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json',...headers},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};};
 const get=()=>service.handlers.get('GET /studio/api/admin/resource-lifecycle')({actor,scope});
 const pack=()=>stored(store=>store.getCurrentPackage('north'));
 const body=async(extra={})=>({operatorId:'north',roomId:room.id,archived:true,expectedAdministrationRevision:(await repository.readDocument('administration')).revision,expectedPackageRevision:(await pack()).revision,...extra});
 return {pool,repository,project,gameLane,room,stored,post,get,pack,body,service};
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
 const f=await fixture({shared:true});const unconfigured=(await f.get()).rooms.find(row=>row.operatorId==='other');assert.equal(unconfigured.canArchive,false);assert.equal(unconfigured.packageRevision,null);assert.equal((await f.post('room-lifecycle',await f.body())).status,200);
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
test('every lifecycle route requests the v6 preflight before opening its mutation transaction',async()=>{
 for(const action of ['operator-lifecycle','room-lifecycle','room-state']){
  const options=[];let invoked=0;
  const api=createStudioAdminApi({authorize:async()=>actor,allowedOrigins:[origin],publicHosts:[new URL(origin).host],
   handlers:new Map([['POST /studio/api/admin/'+action,()=>{invoked++;return {ok:true};}]]),
   mutationTransaction:async(work,requirement)=>{options.push(requirement);return work();}});
  const response=await api.handle(new Request(origin+'/studio/api/admin/'+action,{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json'},body:'{}'}));
  assert.equal(response.status,200);assert.equal(invoked,1);
  assert.deepEqual(options,[{presentationDocuments:['project','administration'],presentationMutation:{kind:'resource-lifecycle',value:{}}}]);
 }
});
