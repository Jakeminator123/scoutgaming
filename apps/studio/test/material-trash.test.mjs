import test from 'node:test';
import assert from 'node:assert/strict';
import {combinedPool} from './fixtures/lifecycle-pool.mjs';
import {cloudPresentationFixture} from './fixtures/cloud-presentation.mjs';
import {createSeedProject,defaultPresentationLane,validateProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {changeMaterialTrash,materialUsedBy} from '../lib/material-trash.mjs';
import {defaultLayerRule} from '../../../packages/presentation/contracts/background-playback-policy.mjs';
import {lifecycleProject} from '../lib/dealer-lifecycle.mjs';
import {createResourceLifecycleApi} from '../lib/resource-lifecycle-api.mjs';
import {createStudioAdminApi} from '../lib/studio-admin-api.mjs';
import {createStudioRepository} from '../../../packages/studio-registry/server/document-repository.mjs';
import {createOperatorStore} from '../../../packages/operators/server/operator-store.mjs';
import {withPackagePresentation,readPackagePresentation,encodePresentationPackage} from '../../../packages/presentation/server/presentation-package.mjs';
import {EXTENDED_PRESENTATION_FORMAT} from '../../../packages/presentation/server/presentation-storage.mjs';
import {nativeRoomMaterialFixture} from '../../../test/fixtures/native-room-game-material.mjs';
import {layerAssetPath} from '../../../packages/presentation/contracts/presentation-layers.mjs';
import {defaultCompositionSettings,defaultBlackjackTableGeometry} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {wrapNativePresentationRepository,PRESENTATION_RUNTIME_UPDATE_REQUIRED} from '../lib/presentation-runtime-readiness.mjs';
import {createNativePresentationMutationTransaction} from '../lib/studio-native-runtime.mjs';
import {presentationCapabilitiesForVersion} from '../../../packages/presentation/capability-contract.mjs';
import {withoutPresentationLanes} from '../lib/dealer-archive-impact.mjs';
import {resolveNativeRoomGameMaterial} from '../../../packages/presentation/server/native-room-game-material.mjs';

const scope={environment:'material-trash-test',workspaceId:'isolated'},origin='https://trash.example.invalid';
const actor={user:'fixture-admin',role:'admin',scope},now=()=>1791753600000;
function asset(n,role='background'){
 const row={schemaVersion:1,id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,role,label:`Material ${n}`,sha256:String(n).repeat(64),size:128,contentType:'image/png',width:1920,height:1080};
 row.pathname=layerAssetPath(row);return row;
}
function withRetainedAnchors(input){
 const value=structuredClone(input),table=asset(3,'table');value.assets.push(table);
 const lane=value.lanes.find(row=>row.id==='other-composition');lane.layers.table={enabled:true,default:table.id,allowed:[table.id]};
 const geometry=defaultBlackjackTableGeometry(table.id);
 for(const layout of ['mobile','desktop'])geometry[layout].anchors={cards:{target:'scene',rect:{x:.1,y:.2,width:.4,height:.5}},bets:{target:'dealer',rect:{x:0,y:0,width:1,height:1}}};
 lane.composition={...defaultCompositionSettings(),blackjackTables:[geometry]};return value;
}
async function fixture({nativeVersion,frozenAnchors=false,measuredBank=false}={}){
 const pool=combinedPool(scope,{extendedPresentationReady:measuredBank}),repository=createStudioRepository({pool,scope}),target=asset(1),kept=asset(2);
 const dealerId=measuredBank?'dragan':'astrid';
 const lane=defaultPresentationLane(dealerId);lane.layers.background={enabled:true,mode:'image',default:target.id,allowed:[target.id]};
 const retained={...structuredClone(lane),id:'other-composition',label:'Behållen sammansättning'};
 retained.layers.background={enabled:true,mode:'image',default:kept.id,allowed:[kept.id]};
 const cloud=cloudPresentationFixture({lanes:[lane,retained],assets:[target,kept]});
 if(measuredBank){
  const bank=nativeRoomMaterialFixture({capture:false,allSpeechSlots:true});
  cloud.project={...bank.project,lanes:cloud.project.lanes,layerAssets:cloud.project.layerAssets};
  cloud.presentation={...bank.presentation,lanes:cloud.presentation.lanes,assets:cloud.presentation.assets};
 }
 const gameLane={schemaVersion:1,id:'room-lane-trash',label:'Fixture',renderer:'portrait-video',dealer:dealerId,mediaCollection:dealerId+'-presentation'};
 const rooms=[{schemaVersion:2,id:'room-affected',name:'Berört rum',operatorId:'north',presentationLaneId:lane.id,gameLaneId:gameLane.id,state:'live'},
  {schemaVersion:2,id:'room-kept',name:'Behållet rum',operatorId:'north',presentationLaneId:retained.id,gameLaneId:gameLane.id,state:'live'}];
 await repository.initializeDocument('project',{value:cloud.project,actor:'fixture'});
 await repository.initializeDocument('administration',{value:{tiers:{classic:'vera',high:'astrid',vip:'amira'},rooms,gameLanes:[gameLane],gameLane:gameLane.id,tournaments:[],pitboss:{payout10x:true,streak5:true,randomWalkMin:45}},actor:'fixture'});
 const stored=work=>repository.transaction(()=>repository.withTransactionClient(async client=>work(await createOperatorStore({sql:client,scope,now,transaction:fn=>repository.withTransactionClient(fn)}))));
 await stored(store=>store.publishPackage({actor:'fixture',operatorId:'north',expectedRevision:null,lanes:[lane.id,retained.id],games:['blackjack'],tables:rooms.map(row=>row.id),branding:withPackagePresentation({},frozenAnchors?withRetainedAnchors(cloud.presentation):cloud.presentation,{allowExtended:measuredBank})}));
 const gates={version:nativeVersion,fetches:[],transactions:0,beforeMutation:null},nativeRepository=nativeVersion===undefined?repository:wrapNativePresentationRepository(repository,{
  env:{CROUPIER_BACKEND_ORIGIN:'https://render.example.invalid'},fetchImpl:async(_url,{headers})=>{
   assert.equal(pool.active,0,'readiness HTTP precedes SQL');assert.ok(!gates.active,'no HTTP under product lock');
   const version=Number(headers['X-Presentation-Capability-Version']);gates.fetches.push(version);
   return version>gates.version?new Response(null,{status:406}):Response.json(presentationCapabilitiesForVersion(version));
  }});
 const readPool={async query(sql,values){const client=await pool.connect();try{await client.query('BEGIN READ ONLY');const result=await client.query(sql,values);await client.query('COMMIT');return result;}finally{client.release();}}};
 const mutationTransaction=nativeVersion===undefined?work=>work():createNativePresentationMutationTransaction({repository:nativeRepository,pool:readPool,scope,
  boDb:{async transaction(work){gates.transactions++;gates.active=true;try{if(gates.beforeMutation)await gates.beforeMutation();return await work();}finally{gates.active=false;}}}});
 const service=createResourceLifecycleApi({repository:nativeRepository,scope,now});
 const api=createStudioAdminApi({handlers:service.handlers,authorize:async()=>actor,allowedOrigins:[origin],publicHosts:[new URL(origin).host],mutationTransaction});
 const post=async(action,body,headers={})=>{const response=await api.handle(new Request(origin+'/studio/api/admin/'+action,{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json',...headers},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};};
 const body=async(archived=true)=>({id:target.id,archived,expectedRevision:(await repository.readDocument('project')).revision});
 return {pool,repository,target,kept,lane,retained,cloud,stored,post,body,gates};
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

test('trashing a table video referenced by a table rule removes the rule; trashing the base table drops all table rules',()=>{
 const project=createSeedProject(),base=asset(1,'table'),clip={...asset(2,'table'),contentType:'video/mp4'};clip.pathname=layerAssetPath(clip);
 project.lanes=[defaultPresentationLane('astrid')];project.layerAssets=[base,clip];
 const lane=project.lanes[0];lane.layers.table={enabled:true,default:base.id,allowed:[base.id,clip.id]};
 lane.tablePlayback={schemaVersion:1,rules:[defaultLayerRule(clip.id,'living',{role:'table'})]};
 validateProject(project);
 assert.equal(materialUsedBy(lane,clip.id),true);assert.equal(materialUsedBy({...lane,layers:{...lane.layers,table:{enabled:true,default:base.id,allowed:[base.id]}}},clip.id),true,'a rule alone keeps the clip in use');
 const removed=changeMaterialTrash(project,{id:clip.id,archived:true,now});
 assert.deepEqual(removed.lanes[0].tablePlayback,{schemaVersion:1,rules:[]});assert.deepEqual(removed.lanes[0].layers.table,{enabled:true,default:base.id,allowed:[base.id]});
 const restored=changeMaterialTrash(removed,{id:clip.id,archived:false});assert.deepEqual(restored.lanes,removed.lanes,'restore never reconnects rules');
 const baseless=changeMaterialTrash(project,{id:base.id,archived:true,now});
 assert.equal(baseless.lanes[0].layers.table.enabled,false);assert.deepEqual(baseless.lanes[0].tablePlayback.rules,[],'no base table means no living clips');
 assert.deepEqual(baseless.lanes[0].layers.table.allowed,[clip.id]);
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

test('material trash preserves an imported surviving room bank and cannot reactivate an archived room on restore',async()=>{
 const f=await fixture({measuredBank:true});
 const rooms=(await f.repository.readDocument('administration')).value.rooms;
 for(const record of readPackagePresentation(await f.stored(store=>store.getCurrentPackage('north'))).playback.media)f.pool.setMedia(record);
 for(const room of rooms)await f.stored(async store=>{
  const pack=await store.getCurrentPackage('north'),material=resolveNativeRoomGameMaterial({package:pack,room,language:'sv'});
  material.revision='imported-verified-lifecycle-fixture';
  await store.publishRoomGameConfig({actor:'fixture',operatorId:'north',expectedRevision:pack.revision,lanes:pack.lanes,games:pack.games,tables:pack.tables,branding:pack.branding},
   {roomId:room.id,gameConfig:{language:'sv',limitPreset:'prive'},material});
 });
 const before=f.pool.snapshot(),original=await f.stored(store=>store.getCurrentPackage('north'));
 const removedVersion=original.branding.roomGameConfigVersions['room-affected'],keptVersion=original.branding.roomGameConfigVersions['room-kept'];
 const oldKept=before.roomConfigs.find(row=>row.version===keptVersion).body;
 const body=await f.body(),preview=await f.post('material-trash-check',body);
 assert.equal(preview.status,200);assert.deepEqual(f.pool.snapshot(),before);
 assert.deepEqual(preview.body.impact.rooms.map(row=>row.id),['room-affected']);
 const result=await f.post('material-trash',{...body,impactToken:preview.body.impact.token});assert.equal(result.status,200);
 const after=f.pool.snapshot(),pack=await f.stored(store=>store.getCurrentPackage('north'));
 assert.deepEqual(pack.tables,['room-kept']);assert.deepEqual(Object.keys(pack.branding.roomGameConfigVersions),['room-kept']);
 assert.equal(after.roomConfigHeads.find(row=>row.room_id==='room-affected').version,removedVersion,'retired head is retained only as history');
 assert.notEqual(pack.branding.roomGameConfigVersions['room-kept'],keptVersion);
 const next=after.roomConfigs.find(row=>row.version===pack.branding.roomGameConfigVersions['room-kept']).body;
 assert.equal(next.packageRevision,pack.revision);assert.deepEqual(next.material,oldKept.material);
 assert.deepEqual(after.roomConfigs.slice(0,before.roomConfigs.length),before.roomConfigs,'old active and retired config bodies are immutable');
 assert.equal(after.roomConfigs.length,before.roomConfigs.length+1,'only the surviving room gets a new config');
 const restoreBody=await f.body(false),restorePreview=await f.post('material-trash-check',restoreBody);
 assert.equal((await f.post('material-trash',{...restoreBody,impactToken:restorePreview.body.impact.token})).status,200);
 const restored=f.pool.snapshot();assert.deepEqual(restored.roomConfigs,after.roomConfigs);assert.deepEqual(restored.roomConfigHeads,after.roomConfigHeads);
 assert.deepEqual(await f.stored(store=>store.getCurrentPackage('north')),pack);
 assert.deepEqual((await f.repository.readDocument('administration')).value.rooms.map(row=>row.id),['room-kept']);
});

test('material trash retains a large measured v2 bank only after native v29 and storage readiness',async()=>{
 const f=await fixture({nativeVersion:29,measuredBank:true}),body=await f.body();
 const original=await f.stored(store=>store.getCurrentPackage('north'));
 const retained=withoutPresentationLanes(readPackagePresentation(original),[f.lane.id]);
 assert.equal(original.branding._scoutPresentation.format,EXTENDED_PRESENTATION_FORMAT);
 assert.throws(()=>encodePresentationPackage(retained),error=>error.statusCode===413,'the surviving bank must still require v2');
 const before=f.pool.snapshot(),check=await f.post('material-trash-check',body);
 assert.equal(check.status,200);assert.deepEqual(f.pool.snapshot(),before,'preview cannot change the publication');
 const request={...body,impactToken:check.body.impact.token};
 f.gates.version=28;
 const transactions=f.gates.transactions,offset=f.pool.trace.length;
 const denied=await f.post('material-trash',request);
 assert.equal(denied.status,503);assert.equal(denied.body.code,PRESENTATION_RUNTIME_UPDATE_REQUIRED);
 assert.equal(f.gates.fetches.at(-1),29);assert.equal(f.gates.transactions,transactions);
 assert.deepEqual(f.pool.snapshot(),before);
 assert.ok(!f.pool.trace.slice(offset).some(row=>['save-document','publish-package','audit','audit-write'].includes(row.marker)));
 f.gates.version=29;f.pool.setExtendedPresentationReady(false);
 assert.equal((await f.post('material-trash',request)).status,503);
 assert.deepEqual(f.pool.snapshot(),before,'missing optional020 rolls back every lifecycle write');
 f.pool.setExtendedPresentationReady(true);f.pool.fail('audit-write');
 assert.equal((await f.post('material-trash',request)).status,503);assert.deepEqual(f.pool.snapshot(),before);
 assert.equal((await f.post('material-trash',request)).status,200);
 const pack=await f.stored(store=>store.getCurrentPackage('north'));
 assert.equal(pack.branding._scoutPresentation.format,EXTENDED_PRESENTATION_FORMAT);
 assert.deepEqual(readPackagePresentation(pack),retained,'all surviving measurements, identities and selections remain frozen');
 assert.deepEqual(pack.tables,['room-kept']);assert.deepEqual(pack.lanes,[f.retained.id]);
 assert.deepEqual(f.pool.snapshot().packages[0],before.packages[0]);
 assert.equal((await f.repository.readDocument('project')).value.layerAssetTrash[0].asset.id,f.target.id);
 assert.deepEqual((await f.repository.readDocument('administration')).value.rooms.map(room=>room.id),['room-kept']);
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

for(const version of [19,20])test(`material trash refuses v${version} before writes when a retained frozen lane alone has anchors`,async()=>{
 const f=await fixture({nativeVersion:21,frozenAnchors:true}),body=await f.body();
 assert.ok(f.cloud.project.lanes.every(lane=>!lane.composition?.blackjackTables));
 const check=await f.post('material-trash-check',body);assert.equal(check.status,200);
 f.gates.version=version;const before=f.pool.snapshot(),offset=f.pool.trace.length,transactions=f.gates.transactions;
 const result=await f.post('material-trash',{...body,impactToken:check.body.impact.token});
 assert.equal(result.status,503);assert.equal(result.body.code,PRESENTATION_RUNTIME_UPDATE_REQUIRED);
 assert.equal(f.gates.fetches.at(-1),21);assert.equal(f.gates.transactions,transactions);assert.deepEqual(f.pool.snapshot(),before);
 assert.ok(!f.pool.trace.slice(offset).some(row=>['save-document','publish-package','operator-status','audit','audit-write'].includes(row.marker)));
});

test('v21 material trash detaches only the affected lane while retaining frozen anchors and atomic rollback',async()=>{
 const f=await fixture({nativeVersion:21,frozenAnchors:true}),body=await f.body(),check=await f.post('material-trash-check',body);
 assert.equal(check.status,200);const before=f.pool.snapshot(),original=await f.stored(store=>store.getCurrentPackage('north'));
 for(const fault of ['publish-package','audit-write']){
  f.pool.fail(fault);assert.equal((await f.post('material-trash',{...body,impactToken:check.body.impact.token})).status,503);assert.deepEqual(f.pool.snapshot(),before);
 }
 const result=await f.post('material-trash',{...body,impactToken:check.body.impact.token});assert.equal(result.status,200);
 const pack=await f.stored(store=>store.getCurrentPackage('north'));
 assert.equal(pack.revision,2);assert.deepEqual(pack.tables,['room-kept']);assert.deepEqual(pack.lanes,[f.retained.id]);
 assert.deepEqual(readPackagePresentation(pack).lanes,[readPackagePresentation(original).lanes[1]]);
 assert.deepEqual((await f.repository.readDocument('administration')).value.rooms.map(room=>room.id),['room-kept']);
 assert.equal((await f.repository.readDocument('project')).value.layerAssetTrash[0].asset.id,f.target.id);
 assert.deepEqual(f.pool.snapshot().packages[0],before.packages[0]);assert.ok(f.gates.fetches.every(version=>version===21));
});

test('material transaction rejects retained anchors introduced after preflight before its first write',async()=>{
 const f=await fixture({nativeVersion:21}),body=await f.body(),check=await f.post('material-trash-check',body);
 assert.equal(check.status,200);let afterConcurrent,offset;
 f.gates.beforeMutation=async()=>{
  await f.stored(async store=>{const pack=await store.getCurrentPackage('north');await store.publishPackage({...pack,actor:'fixture',expectedRevision:pack.revision,branding:withPackagePresentation(pack.branding,withRetainedAnchors(readPackagePresentation(pack)))});});
  afterConcurrent=f.pool.snapshot();offset=f.pool.trace.length;
 };
 const result=await f.post('material-trash',{...body,impactToken:check.body.impact.token});
 assert.equal(result.status,503);assert.equal(result.body.code,PRESENTATION_RUNTIME_UPDATE_REQUIRED);
 assert.deepEqual(f.gates.fetches,[19,19]);assert.deepEqual(f.pool.snapshot(),afterConcurrent);
 assert.ok(!f.pool.trace.slice(offset).some(row=>['save-document','publish-package','audit','audit-write'].includes(row.marker)));
});

test('unaffected operator anchors do not widen the material-trash preflight',async()=>{
 const f=await fixture({nativeVersion:19}),retained=withoutPresentationLanes(withRetainedAnchors(f.cloud.presentation),[f.lane.id]);
 const other=await f.stored(store=>store.publishPackage({actor:'fixture',operatorId:'other',expectedRevision:null,lanes:[f.retained.id],games:['blackjack'],tables:[],branding:withPackagePresentation({},retained)}));
 const body=await f.body(),check=await f.post('material-trash-check',body);assert.equal(check.status,200);
 assert.equal((await f.post('material-trash',{...body,impactToken:check.body.impact.token})).status,200);
 assert.deepEqual(f.gates.fetches,[19,19]);assert.deepEqual(await f.stored(store=>store.getCurrentPackage('other')),other);
});

test('anchors removed with the affected frozen lane do not require v21 for the retained plain lane',async()=>{
 const f=await fixture({nativeVersion:19}),presentation=withRetainedAnchors(f.cloud.presentation);
 presentation.lanes[0].layers.table=structuredClone(presentation.lanes[1].layers.table);
 presentation.lanes[0].composition=structuredClone(presentation.lanes[1].composition);
 presentation.lanes[1]=structuredClone(f.cloud.presentation.lanes[1]);
 await f.stored(async store=>{const pack=await store.getCurrentPackage('north');await store.publishPackage({...pack,actor:'fixture',expectedRevision:pack.revision,branding:withPackagePresentation(pack.branding,presentation)});});
 const body=await f.body(),check=await f.post('material-trash-check',body);assert.equal(check.status,200);
 assert.equal((await f.post('material-trash',{...body,impactToken:check.body.impact.token})).status,200);
 const pack=await f.stored(store=>store.getCurrentPackage('north'));assert.deepEqual(readPackagePresentation(pack).lanes,[f.cloud.presentation.lanes[1]]);assert.deepEqual(f.gates.fetches,[19,19]);
});
