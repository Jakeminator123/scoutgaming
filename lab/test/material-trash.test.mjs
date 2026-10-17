import test from 'node:test';
import assert from 'node:assert/strict';
import {combinedPool} from './fixtures/lifecycle-pool.mjs';
import {cloudPresentationFixture} from './fixtures/cloud-presentation.mjs';
import {createSeedProject,defaultPresentationLane,validateProject} from '../../packages/presentation/contracts/studio-model.mjs';
import {changeMaterialTrash} from '../lib/material-trash.mjs';
import {lifecycleProject} from '../lib/dealer-lifecycle.mjs';
import {createResourceLifecycleApi} from '../lib/resource-lifecycle-api.mjs';
import {createStudioAdminApi} from '../lib/studio-admin-api.mjs';
import {createStudioRepository} from '../../web/storage/studio-repository.mjs';
import {createOperatorStore} from '../../web/storage/operator-store.mjs';
import {withPackagePresentation,readPackagePresentation} from '../../web/storage/presentation-package.mjs';
import {layerAssetPath} from '../../web/presentation-layers.mjs';
import {defaultCompositionSettings,defaultBlackjackTableGeometry} from '../../packages/presentation/contracts/composition-settings.mjs';

const scope={environment:'material-trash-test',workspaceId:'isolated'},origin='https://trash.example.invalid';
const actor={user:'fixture-admin',role:'admin',scope},now=()=>1791753600000;
function asset(n,role='background'){
 const row={schemaVersion:1,id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,role,label:`Material ${n}`,sha256:String(n).repeat(64),size:128,contentType:'image/png',width:1920,height:1080};
 row.pathname=layerAssetPath(row);return row;
}
async function fixture(){
 const pool=combinedPool(scope),repository=createStudioRepository({pool,scope}),target=asset(1),kept=asset(2);
 const lane=defaultPresentationLane('astrid');lane.layers.background={enabled:true,mode:'image',default:target.id,allowed:[target.id]};
 const retained={...structuredClone(lane),id:'other-composition',label:'Behållen sammansättning'};
 retained.layers.background={enabled:true,mode:'image',default:kept.id,allowed:[kept.id]};
 const cloud=cloudPresentationFixture({lanes:[lane,retained],assets:[target,kept]});
 const gameLane={schemaVersion:1,id:'room-lane-trash',label:'Fixture',renderer:'portrait-video',dealer:'astrid',mediaCollection:'astrid-presentation'};
 const rooms=[{schemaVersion:2,id:'room-affected',name:'Berört rum',operatorId:'north',presentationLaneId:lane.id,gameLaneId:gameLane.id,state:'live'},
  {schemaVersion:2,id:'room-kept',name:'Behållet rum',operatorId:'north',presentationLaneId:retained.id,gameLaneId:gameLane.id,state:'live'}];
 await repository.initializeDocument('project',{value:cloud.project,actor:'fixture'});
 await repository.initializeDocument('administration',{value:{tiers:{classic:'vera',high:'astrid',vip:'amira'},rooms,gameLanes:[gameLane],gameLane:gameLane.id,tournaments:[],pitboss:{payout10x:true,streak5:true,randomWalkMin:45}},actor:'fixture'});
 const stored=work=>repository.transaction(()=>repository.withTransactionClient(async client=>work(await createOperatorStore({sql:client,scope,now,transaction:fn=>repository.withTransactionClient(fn)}))));
 await stored(store=>store.publishPackage({actor:'fixture',operatorId:'north',expectedRevision:null,lanes:[lane.id,retained.id],games:['blackjack'],tables:rooms.map(row=>row.id),branding:withPackagePresentation({},cloud.presentation)}));
 const service=createResourceLifecycleApi({repository,scope,now});
 const api=createStudioAdminApi({handlers:service.handlers,authorize:async()=>actor,allowedOrigins:[origin],publicHosts:[new URL(origin).host],mutationTransaction:work=>work()});
 const post=async(action,body,headers={})=>{const response=await api.handle(new Request(origin+'/studio/api/admin/'+action,{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json',...headers},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};};
 const body=async(archived=true)=>({id:target.id,archived,expectedRevision:(await repository.readDocument('project')).revision});
 return {pool,repository,target,kept,lane,retained,cloud,stored,post,body};
}

test('material trash removes active and archived draft references and restores only the asset',()=>{
 const project=createSeedProject(),target=asset(1,'table');project.lanes=[defaultPresentationLane('astrid')];project.layerAssets=[target];project.lanes[0].layers.table.default=target.id;project.lanes[0].layers.table.allowed=[target.id];
 const before=structuredClone(project),archived=changeMaterialTrash(project,{id:target.id,archived:true,now});
 assert.deepEqual(project,before);assert.deepEqual(archived.layerAssets,[]);assert.equal(archived.layerAssetTrash[0].asset.sha256,target.sha256);
 assert.equal(archived.lanes[0].layers.table.enabled,false);assert.equal(archived.lanes[0].layers.table.default,null);assert.deepEqual(archived.lanes[0].layers.table.allowed,[]);
 const restored=changeMaterialTrash(archived,{id:target.id,archived:false});assert.deepEqual(restored.layerAssets,[target]);assert.deepEqual(restored.lanes,archived.lanes);assert.deepEqual(restored.layerAssetTrash,[]);
 assert.throws(()=>validateProject({...archived,layerAssets:[target]}));
 const reattached=structuredClone(archived);reattached.lanes[0].layers.table.allowed=[target.id];assert.throws(()=>validateProject(reattached));
});

test('material deletion also detaches archived dealer snapshots without damaging later dealer restoration',()=>{
 const project=createSeedProject(),target=asset(1);project.lanes=[defaultPresentationLane('astrid')];project.layerAssets=[target];
 project.lanes[0].layers.background={enabled:true,mode:'image',default:target.id,allowed:[target.id]};
 const archived=lifecycleProject(project,{dealerId:'astrid',archived:true,records:[],now:new Date(now()).toISOString()});
 const removed=changeMaterialTrash(archived,{id:target.id,archived:true,now});
 assert.equal(removed.dealerTrash[0].compositions[0].layers.background.default,null);
 const restored=lifecycleProject(removed,{dealerId:'astrid',archived:false,records:[]});
 assert.equal(restored.lanes[0].layers.background.default,null);assert.equal(restored.layerAssetTrash[0].asset.id,target.id);
});

test('table trash removes its saved anchors from active and archived compositions; restore never reconnects them',()=>{
 const project=createSeedProject(),target=asset(1,'table');project.lanes=[defaultPresentationLane('astrid')];project.layerAssets=[target];
 const lane=project.lanes[0];lane.layers.table={enabled:true,default:target.id,allowed:[target.id]};
 lane.composition={...defaultCompositionSettings(),blackjackTables:[defaultBlackjackTableGeometry(target.id)]};
 validateProject(project);
 for(const input of [project,lifecycleProject(project,{dealerId:'astrid',archived:true,records:[],now:new Date(now()).toISOString()})]){
  const removed=changeMaterialTrash(input,{id:target.id,archived:true,now});
  const rows=[...(removed.lanes??[]),...(removed.dealerTrash??[]).flatMap(row=>row.compositions??[])];
  assert.ok(rows.every(row=>!row.composition?.blackjackTables));
  const restored=changeMaterialTrash(removed,{id:target.id,archived:false});
  assert.deepEqual(restored.lanes,removed.lanes);assert.deepEqual(restored.dealerTrash,removed.dealerTrash);
 }
});

test('preview is read only; commit detaches media and archives only affected rooms, preserving frozen survivors and history',async()=>{
 const f=await fixture(),before=f.pool.snapshot(),body=await f.body();
 const check=await f.post('material-trash-check',body);assert.equal(check.status,200);assert.deepEqual(f.pool.snapshot(),before);
 assert.deepEqual(check.body.impact.rooms.map(row=>row.id),['room-affected']);assert.equal(check.body.impact.compositions.length,1);
 const result=await f.post('material-trash',{...body,impactToken:check.body.impact.token});assert.equal(result.status,200);
 const project=(await f.repository.readDocument('project')).value,admin=(await f.repository.readDocument('administration')).value;
 assert.equal(project.layerAssets.some(row=>row.id===f.target.id),false);assert.equal(project.layerAssetTrash[0].asset.id,f.target.id);
 assert.deepEqual(admin.rooms.map(row=>row.id),['room-kept']);assert.equal(admin.gameLanes.length,1);
 const pack=await f.stored(store=>store.getCurrentPackage('north'));assert.deepEqual(pack.tables,['room-kept']);
 assert.deepEqual(readPackagePresentation(pack).lanes,[f.cloud.presentation.lanes[1]]);
 assert.deepEqual(f.pool.snapshot().packages[0],before.packages[0]);
 const restoreBody=await f.body(false),restoreCheck=await f.post('material-trash-check',restoreBody);
 assert.equal((await f.post('material-trash',{...restoreBody,impactToken:restoreCheck.body.impact.token})).status,200);
 assert.deepEqual((await f.repository.readDocument('administration')).value.rooms,admin.rooms);
 assert.deepEqual(await f.stored(store=>store.getCurrentPackage('north')),pack);
});

test('material confirmation rejects stale project, administration and publication revisions',async()=>{
 for(const change of ['project','administration','package']){
  const f=await fixture(),body=await f.body(),check=await f.post('material-trash-check',body);
  if(change==='package')await f.stored(async store=>{const pack=await store.getCurrentPackage('north');await store.publishPackage({...pack,operatorId:'north',actor:'fixture',expectedRevision:pack.revision});});
  else{const doc=await f.repository.readDocument(change);await f.repository.saveDocument(change,{value:doc.value,expectedRevision:doc.revision,actor:'fixture'});}
  const before=f.pool.snapshot();assert.equal((await f.post('material-trash',{...body,impactToken:check.body.impact.token})).status,409);assert.deepEqual(f.pool.snapshot(),before);
 }
});

test('material cascade rolls back every write on package or audit failure and prevents double confirmation',async()=>{
 for(const fault of ['publish-package','audit-write']){
  const f=await fixture(),body=await f.body(),check=await f.post('material-trash-check',body),before=f.pool.snapshot();f.pool.fail(fault);
  assert.equal((await f.post('material-trash',{...body,impactToken:check.body.impact.token})).status,503);assert.deepEqual(f.pool.snapshot(),before);
 }
 const f=await fixture(),body=await f.body(),check=await f.post('material-trash-check',body),request={...body,impactToken:check.body.impact.token};
 const results=await Promise.all([f.post('material-trash',request),f.post('material-trash',request)]);assert.deepEqual(results.map(row=>row.status).sort(),[200,409]);
});

test('ordinary project PUT cannot forge material trash; foreign origins and tokenless requests cannot mutate',async()=>{
 const f=await fixture(),doc=await f.repository.readDocument('project'),next=changeMaterialTrash(doc.value,{id:f.target.id,archived:true,now});
 await assert.rejects(()=>f.repository.saveDocument('project',{value:next,expectedRevision:doc.revision,actor:'fixture'}),{code:'studio_material_lifecycle_required'});
 const before=f.pool.snapshot(),body=await f.body();
 assert.equal((await f.post('material-trash-check',body,{origin:'https://foreign.invalid'})).status,403);
 assert.equal((await f.post('material-trash',body)).status,400);assert.deepEqual(f.pool.snapshot(),before);
});
