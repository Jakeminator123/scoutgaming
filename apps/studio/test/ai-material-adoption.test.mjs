// "Använd i miljön och i spelbordet" (AI-dialogen): materialet tillåts i spelbordets
// scenmall, blir dess standard (bordsgrafikens bredd följer med) och spelbordet
// publiceras i samma transaktion som steg D (room-release.mjs). PostgreSQL via PGlite
// (en session) med produktens Studio-repository, operatörsbutik och 009-lagring; ingen
// bildtjänst anropas här. Samma uppbyggnad som room-release.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPglitePool} from '../../../test/fixtures/pglite-pool.mjs';
import {planStudioMigrations,applyStudioMigrations} from '../../../ops/neon-studio/migrations.mjs';
import {createStudioRepository} from '../../../packages/studio-registry/server/document-repository.mjs';
import {createOperatorStore} from '../../../packages/operators/server/operator-store.mjs';
import {runtimeCatalogJson,runtimeCatalogRevision} from '../../../packages/studio-registry/server/runtime-catalog.mjs';
import {PRESENTATION_CAPABILITY_VERSION_HEADER,presentationCapabilitiesForVersion} from '../../../packages/presentation/capability-contract.mjs';
import {readRuntimeCatalogFixture} from '../../../test/fixtures/runtime-media-catalog.mjs';
import {layerAssetPath} from '../../../packages/presentation/contracts/presentation-layers.mjs';
import {nativeRoomMaterialFixture} from '../../../test/fixtures/native-room-game-material.mjs';
import {defaultCompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {readPackagePresentation} from '../../../packages/presentation/server/presentation-package.mjs';
import {wrapNativePresentationRepository} from '../lib/presentation-runtime-readiness.mjs';
import {createOperatorPackageApi} from '../lib/operator-package-api.mjs';
import {createRoomGameConfigApi} from '../lib/room-game-config-api.mjs';
import {AI_ADOPT_ACTION,AiAdoptError,adoptLayerAssets,validateAdoptMaterials} from '../lib/ai-material-adoption.mjs';
import {aiImageLabel,aiPlacementHash} from '../lib/ai-image-contract.mjs';
import {filmedTableFit} from '../lib/filmed-table-template.mjs';

const actor={user:'adopt-admin',role:'admin'};
const POST='POST /studio/api/admin/operator-package',GET='GET /studio/api/admin/room-release';
const code=(expected,status,extra={})=>error=>error?.code===expected&&error.statusCode===status
  &&Object.entries(extra).every(([key,value])=>error[key]===value);
const TABLE='00000000-0000-4000-8000-00000000ad01',BACKGROUND='00000000-0000-4000-8000-00000000ad02',OTHER='00000000-0000-4000-8000-00000000ad03';
// The fixture's dealer is Dragan, who lands where PAOW lands; the table is drawn for the suggested width.
const fit=filmedTableFit('dragan',defaultCompositionSettings());
const width={mobile:fit.suggested.composition.mobile.table.width,desktop:fit.suggested.composition.desktop.table.width};
const asset=(id,role,label,extra={})=>{const row={schemaVersion:1,id,role,label,contentType:'image/webp',sha256:id.slice(-4).padStart(64,'a'),size:4096,
  width:role==='table'?1446:1920,height:role==='table'?2074:1080,...(role==='table'?{game:'blackjack'}:{}),...extra};return {...row,pathname:layerAssetPath(row)};};
const tableAsset=asset(TABLE,'table',aiImageLabel('Mörk lyx',{dealerId:'dragan',placement:aiPlacementHash(fit.suggested.composition)}));
const backgroundAsset=asset(BACKGROUND,'background','AI · Mörk lyx');
// Drawn for the old width: does not fit once the width is not changed with it.
const otherAsset=asset(OTHER,'table',aiImageLabel('Gammal',{dealerId:'dragan',placement:aiPlacementHash({...defaultCompositionSettings(),desktop:{...defaultCompositionSettings().desktop,table:{width:.5,x:0,y:.35}}})}));

let fixtures=0;
async function adoptFixture(t) {
  const n=++fixtures,scope={environment:`ai-adopt-${n}`,workspaceId:'isolated'},id=name=>`a${n}-${name}`;
  const pool=await createPglitePool();t.after(()=>pool.end());
  const plan=await planStudioMigrations({pool});await applyStudioMigrations({pool,expectedTarget:plan.target,confirm:true});
  const source=nativeRoomMaterialFixture({capture:false}),lane=source.project.lanes[0].id,raw=createStudioRepository({pool,scope});
  const repository=wrapNativePresentationRepository(raw,{env:{CROUPIER_BACKEND_ORIGIN:'https://runtime.example.invalid'},
    fetchImpl:async(_url,init)=>Response.json(presentationCapabilitiesForVersion(Number(init.headers[PRESENTATION_CAPABILITY_VERSION_HEADER]??3)))});
  const catalog=readRuntimeCatalogFixture();
  await pool.query('INSERT INTO croupier_studio.runtime_media_catalogs(environment_id,workspace_id,revision,value) VALUES($1,$2,$3,$4::jsonb)',
    [scope.environment,scope.workspaceId,runtimeCatalogRevision(catalog),runtimeCatalogJson(catalog)]);
  const rooms=[['north-a','north'],['north-b','north']].map(([name,operatorId])=>({schemaVersion:2,id:id(name),name:id(name),operatorId,
    presentationLaneId:lane,gameLaneId:'fixture-lane',state:'live'}));
  await raw.initializeDocument('project',{value:source.project,revision:source.project.revision,actor:'fixture'});
  await raw.initializeDocument('administration',{value:{rooms,gameLane:'fixture-lane',gameLanes:[{schemaVersion:1,id:'fixture-lane',label:'Fixture',
    renderer:'portrait-video',dealer:'dragan',mediaCollection:'dragan-presentation'}]},revision:'admin-initial',actor:'fixture'});
  for(const {revision,updatedAt,mediaTiming,...record} of structuredClone(source.records)) {
    const {media}=await raw.registerMedia(record,{actor:'fixture'});
    await raw.saveMediaTiming(record.id,{sha256:record.sha256,expectedRevision:media.revision,mediaTiming,actor:'fixture'});
  }
  const direct=await createOperatorStore({sql:pool,scope});
  await direct.createOperator({actor:'fixture',operatorId:'north',slug:'north',name:'north'});
  const videoRegistry={loadCaptured:async snapshot=>({videos:snapshot.mediaRows.map(row=>({...row,dealer:row.classification.dealerId,bytes:row.size,
    available:true,integrity:'verified'})),families:[],summary:{readable:true,snapshotReadable:true}}),verifyCapturedMedia:async()=>{}};
  const api=createOperatorPackageApi({pool,scope,repository,videoRegistry});
  const post=async body=>{const context={body,actor,scope};return api.handlers.get(POST)({...context,prepared:await api.preparations.get(POST)(context)});};
  await post({operatorId:'north',lanes:[lane]});
  const pack=await direct.getCurrentPackage('north');
  await direct.publishPackage({actor:'fixture',operatorId:'north',expectedRevision:pack.revision,lanes:pack.lanes,games:pack.games,tables:rooms.map(room=>room.id),branding:pack.branding});
  // The room is live with published settings (a prerequisite: the action publishes the room as it is).
  const configs=createRoomGameConfigApi({repository:raw,scope});
  const admin=await raw.readDocument('administration'),current=await direct.getCurrentPackage('north');
  await configs.handlers.get('POST /studio/api/admin/room-game-config')({actor,scope,body:{action:'save-draft',operatorId:'north',roomId:id('north-a'),
    expectedAdministrationRevision:admin.revision,expectedPackageRevision:current.revision,gameConfig:{language:'sv',limitPreset:'prive'}}});
  const read=()=>api.handlers.get(GET)({actor,scope,request:new Request(`https://studio.invalid/studio/api/admin/room-release?operatorId=north&roomId=${id('north-a')}`)});
  const view=await read();
  await post({action:'publish-room',operatorId:'north',roomId:id('north-a'),gameConfig:view.gameConfig,expectedPackageRevision:view.revisions.package,
    expectedProjectRevision:view.revisions.project,expectedAdministrationRevision:view.revisions.administration,previewToken:view.previewToken});
  // "Använd" saved the AI material in the library (the existing upload): a new project revision, nothing in a template.
  const doc=await raw.readDocument('project');
  await raw.saveDocument('project',{value:{...doc.value,layerAssets:[...(doc.value.layerAssets??[]),tableAsset,backgroundAsset,otherAsset]},expectedRevision:doc.revision,actor:'fixture'});
  const rows=async(sql,values=[])=>(await pool.query(sql,values)).rows;
  const own=[scope.environment];
  const persisted=async()=>({packages:await rows('SELECT package_revision FROM croupier_studio.operator_packages WHERE environment_id=$1 ORDER BY package_revision',own),
    documents:await rows('SELECT kind,revision FROM croupier_studio.documents WHERE environment_id=$1 ORDER BY kind',own),
    heads:await rows('SELECT room_id,version FROM croupier_game.shared_table_config_heads WHERE room_id LIKE $1 ORDER BY room_id',[`a${n}-%`])});
  const body=async(patch={})=>({action:AI_ADOPT_ACTION,operatorId:'north',roomId:id('north-a'),compositionId:lane,
    materials:[{role:'table',assetId:TABLE},{role:'background',assetId:BACKGROUND}],tableWidth:width,
    expectedProjectRevision:(await raw.readDocument('project')).revision,...patch});
  return {pool,raw,direct,api,lane,id,post,read,body,persisted};
}

test('one click: the AI table and background are allowed, become the defaults with the fitted width, and the room is published in one transaction',async t=>{
  const f=await adoptFixture(t);
  const before=await f.direct.getCurrentPackage('north'),headsBefore=(await f.persisted()).heads;
  const receipt=await f.post(await f.body());
  const after=await f.direct.getCurrentPackage('north'),project=(await f.raw.readDocument('project'));
  assert.equal(receipt.ok,true);assert.equal(receipt.previousPackageRevision,before.revision);
  assert.equal(after.revision,before.revision+1,'the published version rises by exactly one');assert.equal(receipt.packageRevision,after.revision);
  assert.equal(receipt.projectRevision,project.revision,'the receipt names the written scene template revision');
  const lane=project.value.lanes.find(row=>row.id===f.lane);
  assert.ok(lane.layers.table.allowed.includes(TABLE));assert.equal(lane.layers.table.default,TABLE);
  assert.ok(lane.layers.background.allowed.includes(BACKGROUND));assert.equal(lane.layers.background.default,BACKGROUND);assert.equal(lane.layers.background.mode,'image');
  assert.deepEqual([lane.composition.mobile.table.width,lane.composition.desktop.table.width],[width.mobile,width.desktop],'Bordsbredd % follows the table');
  // Live: the package's presentation carries the template, the new project revision and the room's choices.
  const presentation=readPackagePresentation(after);
  assert.equal(presentation.projectRevision,project.revision);
  assert.deepEqual(presentation.assets.map(row=>row.id).sort(),[TABLE,BACKGROUND].sort());
  const view=await f.read();
  assert.equal(view.live.roomChoices.table,TABLE);assert.equal(view.live.roomChoices.background,BACKGROUND);
  assert.equal(view.changed,false,'nothing is left to publish');
  assert.deepEqual(receipt.changes.filter(row=>row.area==='roomChoices').map(row=>[row.key,row.after]).sort(),[['background',BACKGROUND],['table',TABLE]]);
  assert.ok(receipt.changes.some(row=>row.area==='placement'),'the width is a placement change');
  const heads=(await f.persisted()).heads;
  assert.notDeepEqual(heads,headsBefore,'the room\'s settings are bound to the new version');
  assert.deepEqual(receipt.gameConfig,{language:'sv',limitPreset:'prive'},'the published settings stay');
});

test('a stale project revision, another template, a pending change or a misfit table writes nothing',async t=>{
  const f=await adoptFixture(t);
  let stable=await f.persisted();
  await assert.rejects(f.post(await f.body({expectedProjectRevision:'project-old'})),code('studio_conflict',409,{step:'project'}));
  assert.deepEqual(await f.persisted(),stable);
  await assert.rejects(f.post(await f.body({compositionId:'annan-mall'})),code('studio_release_invalid',422,{reason:'ai_adopt_other_template'}));
  // The table drawn for another width does not fit the template with the given width.
  await assert.rejects(f.post(await f.body({materials:[{role:'table',assetId:OTHER}]})),code('studio_release_invalid',422,{reason:'ai_adopt_table_misfit'}));
  // The fitted table without its width: misfit as well.
  await assert.rejects(f.post(await f.body({materials:[{role:'table',assetId:TABLE}],tableWidth:null})),code('studio_release_invalid',422,{reason:'ai_adopt_table_misfit'}));
  assert.deepEqual(await f.persisted(),stable,'refusals write nothing');
  // Something else saved but not live (another allowed background) is never published along.
  const doc=await f.raw.readDocument('project');
  await f.raw.saveDocument('project',{value:{...doc.value,lanes:doc.value.lanes.map(lane=>lane.id===f.lane?{...lane,layers:{...lane.layers,background:{...lane.layers.background,allowed:[BACKGROUND]}}}:lane)},
    expectedRevision:doc.revision,actor:'fixture'});
  stable=await f.persisted();
  await assert.rejects(f.post(await f.body()),code('studio_release_invalid',422,{reason:'studio_release_other_changes'}));
  assert.deepEqual(await f.persisted(),stable);
  for (const bad of [{materials:[]},{materials:[{role:'table',assetId:TABLE},{role:'table',assetId:OTHER}]},{materials:[{role:'dealer',assetId:TABLE}]},
    {tableWidth:{mobile:9,desktop:.3}},{materials:[{role:'background',assetId:BACKGROUND}],tableWidth:width},{extra:true}]) {
    await assert.rejects(f.post(await f.body(bad)),code('studio_release_invalid',422),JSON.stringify(bad));
  }
});

test('adoption into a scene template is pure: defaults, allowed lists, width and the fit guard',()=>{
  const project=structuredClone(nativeRoomMaterialFixture({capture:false}).project);
  project.layerAssets=[...(project.layerAssets??[]),tableAsset,backgroundAsset,otherAsset];
  const lane=project.lanes[0].id;
  const next=adoptLayerAssets(project,{compositionId:lane,materials:[{role:'table',assetId:TABLE}],tableWidth:width});
  const adopted=next.lanes[0];
  assert.deepEqual(adopted.layers.table.allowed,[TABLE]);assert.equal(adopted.layers.table.default,TABLE);assert.equal(adopted.renderer,'layered');
  assert.equal(adopted.composition.desktop.table.width,width.desktop);assert.equal(project.lanes[0].layers.table.default,null,'the input is not changed');
  // Adopting twice keeps one entry; a background alone leaves the placement alone.
  const again=adoptLayerAssets(next,{compositionId:lane,materials:[{role:'table',assetId:TABLE},{role:'background',assetId:BACKGROUND}],tableWidth:width});
  assert.deepEqual(again.lanes[0].layers.table.allowed,[TABLE]);assert.equal(again.lanes[0].layers.background.default,BACKGROUND);
  assert.equal(adoptLayerAssets(project,{compositionId:lane,materials:[{role:'background',assetId:BACKGROUND}]}).lanes[0].composition,undefined);
  for (const [input,reason] of [[{compositionId:'saknas',materials:[{role:'table',assetId:TABLE}],tableWidth:width},'ai_adopt_template_missing'],
    [{compositionId:lane,materials:[{role:'background',assetId:TABLE}]},'ai_adopt_material_missing'],
    [{compositionId:lane,materials:[{role:'table',assetId:OTHER}],tableWidth:width},'ai_adopt_table_misfit'],
    [{compositionId:lane,materials:[{role:'table',assetId:TABLE}]},'ai_adopt_table_misfit']]) {
    assert.throws(()=>adoptLayerAssets(project,input),error=>error instanceof AiAdoptError&&error.code===reason,reason);
  }
  assert.throws(()=>validateAdoptMaterials([{role:'table',assetId:TABLE}],{mobile:.05,desktop:.3}),AiAdoptError);
});
