// Nytt spelbord på ett steg, serversidan (plan-enkel-vag PR 1b): POST presentation-room med `gameConfig`
// skapar spelbordet, publicerar tilldelningen och publicerar spelinställningarna i en transaktion.
// Ett öppet utseendeutkast hos bolaget stoppar före första skrivningen; ett fel i spelinställningarna
// rullar tillbaka spelbordet. PostgreSQL via PGlite med produktens repository och operatörsbutik.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPglitePool} from '../../../test/fixtures/pglite-pool.mjs';
import {planStudioMigrations,applyStudioMigrations} from '../../../ops/neon-studio/migrations.mjs';
import {createStudioRepository} from '../../../packages/studio-registry/server/document-repository.mjs';
import {createOperatorStore} from '../../../packages/operators/server/operator-store.mjs';
import {runtimeCatalogJson,runtimeCatalogRevision} from '../../../packages/studio-registry/server/runtime-catalog.mjs';
import {PRESENTATION_CAPABILITY_VERSION_HEADER,presentationCapabilitiesForVersion} from '../../../packages/presentation/capability-contract.mjs';
import {readRuntimeCatalogFixture} from '../../../test/fixtures/runtime-media-catalog.mjs';
import {nativeRoomMaterialFixture} from '../../../test/fixtures/native-room-game-material.mjs';
import {resolveNativeRoomGameMaterial} from '../../../packages/presentation/server/native-room-game-material.mjs';
import {NATIVE_FILMED_PLANNING_MUTATION,wrapNativePresentationRepository,presentationPackageRequiresV29,presentationPackageRequiresV30} from '../lib/presentation-runtime-readiness.mjs';
import {createRoomGameConfigApi} from '../lib/room-game-config-api.mjs';
import {createPresentationRoomApi} from '../lib/presentation-room-api.mjs';

const actor={user:'quick-admin',role:'admin'},POST='POST /studio/api/admin/presentation-room';
const code=(expected,status)=>error=>error?.code===expected&&error.statusCode===status;
let fixtures=0;
async function quickFixture(t) {
  const scope={environment:`quick-create-${++fixtures}`,workspaceId:'isolated'};
  const pool=await createPglitePool();t.after(()=>pool.end());
  const plan=await planStudioMigrations({pool});await applyStudioMigrations({pool,expectedTarget:plan.target,confirm:true});
  const source=nativeRoomMaterialFixture({capture:false}),lane=source.project.lanes[0].id,raw=createStudioRepository({pool,scope});
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
  const roomGameConfig=createRoomGameConfigApi({repository,scope,resolveMaterial:input=>resolveNativeRoomGameMaterial(input,{version:2})});
  const capabilities=async presentation=>{const version=presentation&&presentationPackageRequiresV30(presentation)?30:presentation&&presentationPackageRequiresV29(presentation)?29:4;
    if(process.env.DEBUG_CAPS)console.log('CAPV',version,presentation?.schemaVersion);return presentationCapabilitiesForVersion(version);};
  const api=createPresentationRoomApi({repository,scope,videoRegistry,roomGameConfig,runtimeCapabilities:capabilities});
  let key=0;
  const body=async(name,extra={})=>{
    const project=await raw.readDocument('project'),administration=await raw.readDocument('administration'),pack=await store.getCurrentPackage('north');
    return {operatorId:'north',presentationLaneId:lane,name,idempotencyKey:`00000000-0000-4000-8000-${String(++key).padStart(12,'0')}`,
      expectedProjectRevision:project.revision,expectedAdministrationRevision:administration.revision,expectedPackageRevision:pack?.revision??null,...extra};
  };
  // Samma förhandling som studio-admin-api.mjs gör före SQL-låset (spelbord, paket och, med gameConfig, spelinställningar).
  const post=async value=>{const context={body:value,actor,scope},prepared=await api.preparations.get(POST)(context);
    return repository.withMutationContext(()=>api.handlers.get(POST)({...context,prepared}),[{kind:'administration',value:{rooms:[{schemaVersion:2,game:'blackjack'}]}},
      {kind:'presentation-package',value:prepared.publicationPresentation},...(value.gameConfig?[{kind:'administration',value:{roomGameConfigs:[]}},NATIVE_FILMED_PLANNING_MUTATION]:[])]);};
  // Allt som en misslyckad skrivning inte får lämna efter sig.
  const persisted=async()=>({administration:(await raw.readDocument('administration')).revision,package:(await store.getCurrentPackage('north'))?.revision??null,
    configs:(await pool.query('SELECT count(*)::int AS n FROM croupier_game.shared_table_configs')).rows[0].n});
  return {post,body,persisted,store,raw};
}

test('Skapa och publicera: spelbord, tilldelning och spelinställningar i en transaktion', async t => {
  const f=await quickFixture(t);
  const created=await f.post(await f.body('Dragan Blackjack 1',{gameConfig:{language:'sv',limitPreset:'prive'}}));
  assert.equal(created.duplicate,false);assert.equal(created.room.state,'live');
  assert.equal(created.packageRevision,2,'spelbordet publicerar tilldelningen (1), spelinställningarna nästa version (2)');
  assert.deepEqual(created.published.gameConfig,{language:'sv',limitPreset:'prive'});
  const pack=await f.store.getCurrentPackage('north');
  assert.equal(pack.revision,2);assert.ok(pack.tables.includes(created.room.id));
  assert.equal(typeof pack.branding.roomGameConfigVersions?.[created.room.id],'string','paketet binder spelinställningarna');
  assert.deepEqual((await f.raw.readDocument('administration')).value.roomGameConfigs??[],[],'inget utkast blir kvar');
});

test('ett öppet utseendeutkast stoppar före första skrivningen; ett fel i spelinställningarna rullar tillbaka spelbordet', async t => {
  const f=await quickFixture(t);
  await f.post(await f.body('Dragan Blackjack 1',{gameConfig:{language:'sv',limitPreset:'prive'}}));
  // Fixturen har bara svenskt tal: engelska kan inte publiceras och spelbordet får inte finnas kvar.
  const before=await f.persisted();
  await assert.rejects(async()=>f.post(await f.body('Dragan Blackjack 2',{gameConfig:{language:'en',limitPreset:'prive'}})),
    error=>error?.code==='studio_room_game_material_unavailable'&&error.statusCode===422&&/^native_material_/.test(error.materialReason));
  assert.deepEqual(await f.persisted(),before,'spelbord, tilldelning och spelinställningar rullades tillbaka');
  assert.equal((await f.raw.readDocument('administration')).value.rooms.length,1);
  await f.store.saveBrandingDraft({operatorId:'north',actor:'partner',audit:{actorId:'actor-partner',accessClass:'partner',requestId:'00000000-0000-4000-8000-0000000000aa'},
    expectedDraftRevision:0,expectedPackageRevision:2,branding:{color:'#112233'}});
  const drafted=await f.persisted();
  await assert.rejects(async()=>f.post(await f.body('Dragan Blackjack 2',{gameConfig:{language:'sv',limitPreset:'prive'}})),code('studio_room_choices_draft_pending',409));
  assert.deepEqual(await f.persisted(),drafted,'inget skrevs');
});
