// Nytt spelbord på ett steg, serversidan (plan-enkel-vag PR 1b): POST presentation-room med `gameConfig`
// skapar spelbordet, publicerar tilldelningen och spelinställningarna i en transaktion och en paketversion.
// Ett öppet utseendeutkast stoppar före första skrivningen; räcker materialet inte rullas spelbordet tillbaka.
// Provet går produktens väg: HTTP-gränsen (studio-admin-api.mjs, förhandlingen före SQL), produktens
// transaktion med bolagets paket (createNativePresentationMutationTransaction) och produktens koppling av
// tjänsterna (createNativeRoomApis). PostgreSQL via PGlite med produktens repository och operatörsbutik.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPglitePool} from '../../../test/fixtures/pglite-pool.mjs';
import {planStudioMigrations,applyStudioMigrations} from '../../../ops/neon-studio/migrations.mjs';
import {createStudioRepository} from '../../../packages/studio-registry/server/document-repository.mjs';
import {createOperatorStore} from '../../../packages/operators/server/operator-store.mjs';
import {createOperatorMaterialStore} from '../lib/operator-material-store.mjs';
import {runtimeCatalogJson,runtimeCatalogRevision} from '../../../packages/studio-registry/server/runtime-catalog.mjs';
import {PRESENTATION_CAPABILITY_VERSION_HEADER,presentationCapabilitiesForVersion} from '../../../packages/presentation/capability-contract.mjs';
import {readRuntimeCatalogFixture} from '../../../test/fixtures/runtime-media-catalog.mjs';
import {nativeRoomMaterialFixture} from '../../../test/fixtures/native-room-game-material.mjs';
import {wrapNativePresentationRepository} from '../lib/presentation-runtime-readiness.mjs';
import {createNativePresentationMutationTransaction,createNativeRoomApis} from '../lib/studio-native-runtime.mjs';
import {createStudioAdminApi} from '../lib/studio-admin-api.mjs';

const actor={user:'quick-admin',role:'admin'},origin='https://studio.invalid';
let fixtures=0;
async function quickFixture(t) {
  const scope={environment:`quick-create-${++fixtures}`,workspaceId:'isolated'};
  const pool=await createPglitePool();t.after(()=>pool.end());
  const plan=await planStudioMigrations({pool});await applyStudioMigrations({pool,expectedTarget:plan.target,confirm:true});
  const source=nativeRoomMaterialFixture({capture:false}),lane=source.project.lanes[0].id,raw=createStudioRepository({pool,scope});
  // Körtiden svarar med den version som förhandlas fram (inget förenklat kapacitetssvar).
  const repository=wrapNativePresentationRepository(raw,{env:{CROUPIER_BACKEND_ORIGIN:'https://runtime.example.invalid'},
    fetchImpl:async(_url,init)=>Response.json(presentationCapabilitiesForVersion(Number(init.headers[PRESENTATION_CAPABILITY_VERSION_HEADER]??3)))});
  const catalog=readRuntimeCatalogFixture();
  await pool.query('INSERT INTO croupier_studio.runtime_media_catalogs(environment_id,workspace_id,revision,value) VALUES($1,$2,$3,$4::jsonb)',
    [scope.environment,scope.workspaceId,runtimeCatalogRevision(catalog),runtimeCatalogJson(catalog)]);
  await raw.initializeDocument('project',{value:source.project,revision:source.project.revision,actor:'fixture'});
  await raw.initializeDocument('administration',{value:{rooms:[],gameLane:'fixture-lane',gameLanes:[{schemaVersion:1,id:'fixture-lane',label:'Fixture',
    renderer:'portrait-video',dealer:'dragan',mediaCollection:'dragan-presentation'}]},revision:'admin-initial',actor:'fixture'});
  for(const {revision,updatedAt,mediaTiming,...record} of structuredClone(source.records)) {
    const {media}=await raw.registerMedia(record,{actor:'fixture'});
    await raw.saveMediaTiming(record.id,{sha256:record.sha256,expectedRevision:media.revision,mediaTiming,actor:'fixture'});
  }
  const store=await createOperatorStore({sql:pool,scope});
  await store.createOperator({actor:'fixture',operatorId:'north',slug:'north',name:'north'});
  const videoRegistry={loadCaptured:async snapshot=>({videos:snapshot.mediaRows.map(row=>({...row,dealer:row.classification.dealerId,bytes:row.size,
    available:true,integrity:'verified'})),families:[],summary:{readable:true,snapshotReadable:true}}),verifyCapturedMedia:async()=>{}};
  const {rooms}=createNativeRoomApis({repository,scope,videoRegistry,materials:sql=>createOperatorMaterialStore({sql,scope})});
  const http=createStudioAdminApi({authorize:async()=>({...actor,scope}),allowedOrigins:[origin],publicHosts:['studio.invalid'],
    handlers:rooms.handlers,preparations:rooms.preparations,
    mutationTransaction:createNativePresentationMutationTransaction({repository,boDb:{transaction:async work=>work()},pool,scope})});
  let key=0;
  const body=async(name,extra={})=>{
    const project=await raw.readDocument('project'),administration=await raw.readDocument('administration'),pack=await store.getCurrentPackage('north');
    return {operatorId:'north',presentationLaneId:lane,name,idempotencyKey:`00000000-0000-4000-8000-${String(++key).padStart(12,'0')}`,
      expectedProjectRevision:project.revision,expectedAdministrationRevision:administration.revision,expectedPackageRevision:pack?.revision??null,...extra};
  };
  const post=async value=>{
    const response=await http.handle(new Request(origin+'/studio/api/admin/presentation-room',{method:'POST',
      headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify(value)}));
    return {status:response.status,json:await response.json()};
  };
  // Allt som en misslyckad skrivning inte får lämna efter sig.
  const persisted=async()=>({administration:(await raw.readDocument('administration')).revision,package:(await store.getCurrentPackage('north'))?.revision??null,
    configs:(await pool.query('SELECT count(*)::int AS n FROM croupier_game.shared_table_configs')).rows[0].n});
  return {post,body,persisted,store,raw};
}
const settings={language:'sv',limitPreset:'prive'};

test('Skapa och publicera: spelbord, tilldelning och spelinställningar i en transaktion och en paketversion', async t => {
  const f=await quickFixture(t);
  const before=(await f.raw.readDocument('administration')).revision;
  const created=await f.post(await f.body('Dragan Blackjack 1',{gameConfig:settings}));
  assert.equal(created.status,200,JSON.stringify(created.json));
  assert.equal(created.json.duplicate,false);assert.equal(created.json.room.state,'live');
  assert.equal(created.json.packageRevision,1,'tilldelningen och spelinställningarna i samma paketversion');
  assert.deepEqual(created.json.published.gameConfig,settings);assert.equal(created.json.published.packageRevision,1);
  assert.deepEqual((await f.store.listPackages('north')).map(row=>row.revision),[1],'en paketversion');
  const pack=await f.store.getCurrentPackage('north');
  assert.ok(pack.tables.includes(created.json.room.id));
  assert.equal(typeof pack.branding.roomGameConfigVersions?.[created.json.room.id],'string','paketet binder spelinställningarna');
  const administration=await f.raw.readDocument('administration');
  assert.notEqual(administration.revision,before);assert.equal(created.json.administrationRevision,administration.revision);
  assert.deepEqual(administration.value.roomGameConfigs??[],[],'inget utkast skrivs');
});

test('vanligt POST efter publicerade spelinställningar förhandlar bolagets paket (produktens väg)', async t => {
  const f=await quickFixture(t);
  assert.equal((await f.post(await f.body('Dragan Blackjack 1',{gameConfig:settings}))).status,200);
  const plain=await f.post(await f.body('Dragan Blackjack 2'));
  assert.equal(plain.status,200,JSON.stringify(plain.json));assert.equal(plain.json.packageRevision,2);assert.equal(plain.json.published,undefined);
  const again=await f.post(await f.body('Dragan Blackjack 3',{gameConfig:{language:'sv',limitPreset:'casual'}}));
  assert.equal(again.status,200,JSON.stringify(again.json));assert.equal(again.json.packageRevision,3);
  assert.deepEqual(again.json.published.gameConfig,{language:'sv',limitPreset:'casual'});
});

test('samma idempotensnyckel: samma spelinställningar är ett omförsök, andra är 409', async t => {
  const f=await quickFixture(t);
  const value=await f.body('Dragan Blackjack 1',{gameConfig:settings});
  const created=await f.post(value);assert.equal(created.status,200);
  const replay=await f.post(value);
  assert.equal(replay.status,200);assert.equal(replay.json.duplicate,true);assert.deepEqual(replay.json.published.gameConfig,settings);
  const before=await f.persisted();
  const changed=await f.post({...value,gameConfig:{language:'sv',limitPreset:'casual'}});
  assert.equal(changed.status,409,JSON.stringify(changed.json));
  assert.deepEqual(await f.persisted(),before,'inget skrevs');
});

test('räcker materialet inte rullas spelbordet tillbaka; ett öppet utseendeutkast stoppar före första skrivningen (koden syns i svaret)', async t => {
  const f=await quickFixture(t);
  assert.equal((await f.post(await f.body('Dragan Blackjack 1',{gameConfig:settings}))).status,200);
  // Fixturen har bara svenskt tal: engelska kan inte publiceras och spelbordet får inte finnas kvar.
  const before=await f.persisted();
  const refused=await f.post(await f.body('Dragan Blackjack 2',{gameConfig:{language:'en',limitPreset:'prive'}}));
  assert.equal(refused.status,422);
  assert.equal(refused.json.code,'studio_room_game_material_unavailable');assert.match(refused.json.materialReason,/^native_material_/);
  assert.deepEqual(await f.persisted(),before,'spelbord, tilldelning och spelinställningar rullades tillbaka');
  assert.equal((await f.raw.readDocument('administration')).value.rooms.length,1);
  await f.store.saveBrandingDraft({operatorId:'north',actor:'partner',audit:{actorId:'actor-partner',accessClass:'partner',requestId:'00000000-0000-4000-8000-0000000000aa'},
    expectedDraftRevision:0,expectedPackageRevision:1,branding:{color:'#112233'}});
  const drafted=await f.persisted();
  const pending=await f.post(await f.body('Dragan Blackjack 2',{gameConfig:settings}));
  assert.equal(pending.status,409);assert.deepEqual(pending.json,{error:'studio_room_choices_draft_pending',code:'studio_room_choices_draft_pending'});
  assert.deepEqual(await f.persisted(),drafted,'inget skrevs');
});
