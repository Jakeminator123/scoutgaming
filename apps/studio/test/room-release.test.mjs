// En publicering per spelbord (room-release.mjs, ADMIN-FORENKLING §7) på riktig
// PostgreSQL-SQL (PGlite, en session): produktens Studio-repository, operatörsbutik,
// J08-skrivare och 009-lagring. PGlite är en enda session: låskonkurrens mellan sessioner
// provas inte här (inte heller i tools/studio-isolated-qa.mjs). Samtidighet provas som
// CAS: en förberedelse vars revisioner, utkast, medieposter eller material ändras före
// transaktionen stoppas med 409 och skriver inget.
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createPglitePool} from '../../../test/fixtures/pglite-pool.mjs';
import {planStudioMigrations,applyStudioMigrations} from '../../../ops/neon-studio/migrations.mjs';
import {createStudioRepository} from '../../../packages/studio-registry/server/document-repository.mjs';
import {createOperatorStore} from '../../../packages/operators/server/operator-store.mjs';
import {runtimeCatalogJson,runtimeCatalogRevision} from '../../../packages/studio-registry/server/runtime-catalog.mjs';
import {PRESENTATION_CAPABILITY_VERSION_HEADER,presentationCapabilitiesForVersion} from '../../../packages/presentation/capability-contract.mjs';
import {readRuntimeCatalogFixture} from '../../../test/fixtures/runtime-media-catalog.mjs';
import {nativeRoomMaterialFixture} from '../../../test/fixtures/native-room-game-material.mjs';
import {wrapNativePresentationRepository} from '../lib/presentation-runtime-readiness.mjs';
import {createOperatorPackageApi} from '../lib/operator-package-api.mjs';
import {createOperatorMaterialStore} from '../lib/operator-material-store.mjs';
import {createRoomGameConfigApi} from '../lib/room-game-config-api.mjs';
import {createStudioAdminApi} from '../lib/studio-admin-api.mjs';
import {createNativePresentationMutationTransaction} from '../lib/studio-native-runtime.mjs';
import {isPresentationRoomReadQuery} from '../lib/studio-admin-contract.mjs';

const actor={user:'release-admin',role:'admin'};
const POST='POST /studio/api/admin/operator-package',GET='GET /studio/api/admin/room-release';
const code=(expected,status,extra={})=>error=>error?.code===expected&&error.statusCode===status
  &&Object.entries(extra).every(([key,value])=>error[key]===value);

// En egen databas per fixtur: medieposternas id och sökvägar är globala i registret.
// Scope och spelbords-id skiljer ändå fixturerna åt (spelinställningarnas tabeller saknar scope).
// Delproven i samma fixtur körs i ordning och bygger vidare på varandras publiceringar.
let fixtures=0;
async function releaseFixture(t,{without009=false}={}) {
  const n=++fixtures,scope={environment:`room-release-${n}`,workspaceId:'isolated'},id=name=>`r${n}-${name}`;
  const pool=await createPglitePool();t.after(()=>pool.end());
  const plan=await planStudioMigrations({pool});await applyStudioMigrations({pool,expectedTarget:plan.target,confirm:true});
  // Som en databas där 009 inte är applicerad: spelinställningarnas två tabeller saknas.
  if(without009)await pool.query('DROP TABLE croupier_game.shared_table_config_heads; DROP TABLE croupier_game.shared_table_configs');
  const source=nativeRoomMaterialFixture({capture:false}),lane=source.project.lanes[0].id,raw=createStudioRepository({pool,scope});
  const io={fetches:0,verified:0};
  // Den nativa grinden frågar spelmotorn om förmåga; här svarar en fast fixtur på begärd version.
  const repository=wrapNativePresentationRepository(raw,{env:{CROUPIER_BACKEND_ORIGIN:'https://runtime.example.invalid'},
    fetchImpl:async(_url,init)=>{io.fetches++;return Response.json(presentationCapabilitiesForVersion(Number(init.headers[PRESENTATION_CAPABILITY_VERSION_HEADER]??3)));}});
  const catalog=readRuntimeCatalogFixture();
  await pool.query('INSERT INTO croupier_studio.runtime_media_catalogs(environment_id,workspace_id,revision,value) VALUES($1,$2,$3,$4::jsonb)',
    [scope.environment,scope.workspaceId,runtimeCatalogRevision(catalog),runtimeCatalogJson(catalog)]);
  const rooms=[['north-a','north'],['north-b','north'],['south','south']].map(([name,operatorId])=>({schemaVersion:2,id:id(name),name:id(name),operatorId,
    presentationLaneId:lane,gameLaneId:'fixture-lane',state:'live'}));
  await raw.initializeDocument('project',{value:source.project,revision:source.project.revision,actor:'fixture'});
  await raw.initializeDocument('administration',{value:{rooms,gameLane:'fixture-lane',gameLanes:[{schemaVersion:1,id:'fixture-lane',label:'Fixture',
    renderer:'portrait-video',dealer:'dragan',mediaCollection:'dragan-presentation'}]},revision:'admin-initial',actor:'fixture'});
  for(const {revision,updatedAt,mediaTiming,...record} of structuredClone(source.records)) {
    const {media}=await raw.registerMedia(record,{actor:'fixture'});
    await raw.saveMediaTiming(record.id,{sha256:record.sha256,expectedRevision:media.revision,mediaTiming,actor:'fixture'});
  }
  const direct=await createOperatorStore({sql:pool,scope});
  for(const id of ['north','south'])await direct.createOperator({actor:'fixture',operatorId:id,slug:id,name:id});
  const videoRegistry={loadCaptured:async snapshot=>({videos:snapshot.mediaRows.map(row=>({...row,dealer:row.classification.dealerId,bytes:row.size,
    available:true,integrity:'verified'})),families:[],summary:{readable:true,snapshotReadable:true}}),verifyCapturedMedia:async()=>{io.verified++;}};
  const api=createOperatorPackageApi({pool,scope,repository,videoRegistry});
  const post=async(body,extra={})=>{const context={body,actor,scope,...extra};return api.handlers.get(POST)({...context,prepared:await api.preparations.get(POST)(context)});};
  for(const operatorId of ['north','south']) {
    await post({operatorId,lanes:[lane]});
    const pack=await direct.getCurrentPackage(operatorId);
    await direct.publishPackage({actor:'fixture',operatorId,expectedRevision:pack.revision,lanes:pack.lanes,games:pack.games,
      tables:rooms.filter(room=>room.operatorId===operatorId).map(room=>room.id),branding:pack.branding});
  }
  // Spelinställningarnas utkast sparas med den befintliga J08-åtgärden.
  const configs=createRoomGameConfigApi({repository:raw,scope});
  const saveDraft=async(room,gameConfig,operatorId='north')=>{
    const roomId=id(room);
    const admin=await raw.readDocument('administration'),pack=await direct.getCurrentPackage(operatorId);
    return configs.handlers.get('POST /studio/api/admin/room-game-config')({actor,scope,body:{action:'save-draft',operatorId,roomId,
      expectedAdministrationRevision:admin.revision,expectedPackageRevision:pack.revision,gameConfig}});
  };
  const read=(room='north-a',operatorId='north',extra={})=>api.handlers.get(GET)({actor,scope,
    request:new Request(`https://studio.invalid/studio/api/admin/room-release?operatorId=${operatorId}&roomId=${id(room)}`),...extra});
  const bodyOf=(view,patch={})=>({action:'publish-room',operatorId:view.operatorId,roomId:view.roomId,gameConfig:view.gameConfig,
    expectedPackageRevision:view.revisions.package,expectedProjectRevision:view.revisions.project,
    expectedAdministrationRevision:view.revisions.administration,previewToken:view.previewToken,...patch});
  const rows=async(sql,values=[])=>(await pool.query(sql,values)).rows;
  // Allt som en publicering kan skriva, för "ingen skrivning"-kontrollerna.
  const own=[scope.environment],prefix=[`r${n}-%`];
  const persisted=async()=>({packages:await rows('SELECT operator_id,package_revision,branding FROM croupier_studio.operator_packages WHERE environment_id=$1 ORDER BY operator_id,package_revision',own),
    documents:await rows('SELECT kind,revision FROM croupier_studio.documents WHERE environment_id=$1 ORDER BY kind',own),
    audits:await rows('SELECT count(*)::int AS count FROM croupier_studio.operator_audit_events WHERE environment_id=$1',own),
    ...(!without009?{configs:await rows('SELECT room_id,version,body FROM croupier_game.shared_table_configs WHERE room_id LIKE $1 ORDER BY room_id,version',prefix),
      heads:await rows('SELECT room_id,version FROM croupier_game.shared_table_config_heads WHERE room_id LIKE $1 ORDER BY room_id',prefix)}:{})});
  return {pool,raw,repository,videoRegistry,api,direct,io,lane,source,scope,id,post,read,saveDraft,bodyOf,rows,persisted,publish:view=>post(bodyOf(view))};
}

test('room release on PostgreSQL with the 009 game-settings storage',async t=>{
  const f=await releaseFixture(t);
  const room=name=>f.id(name),binding=async name=>(await f.direct.getCurrentPackage('north')).branding.roomGameConfigVersions?.[room(name)];

  await t.test('a room without a draft or published settings is blocked',async()=>{
    const view=await f.read();
    assert.equal(view.ready,false);assert.equal(view.changed,false);
    assert.deepEqual(view.blockers,[{area:'settings',code:'studio_room_game_config_missing'}]);
  });

  await t.test('one publication raises the package by exactly one and reads its receipt from the written rows',async t=>{
    await f.saveDraft('north-a',{language:'sv',limitPreset:'prive'});
    const provider=t.mock.method(globalThis,'fetch',()=>{throw Error('unexpected provider request');});
    const io={...f.io},view=await f.read();
    assert.deepEqual(f.io,io,'the preview makes no capability fetch and no Blob verification');assert.equal(provider.mock.callCount(),0);
    provider.mock.restore();
    assert.equal(view.ready,true,JSON.stringify(view.blockers));assert.deepEqual(view.blockers,[]);
    assert.deepEqual(view.gameConfig,{language:'sv',limitPreset:'prive'});assert.match(view.previewToken,/^[a-f0-9]{64}$/);
    assert.deepEqual(view.changes,[{area:'settings',before:null,after:{language:'sv',limitPreset:'prive'}}]);
    assert.equal(view.live.settings,null);assert.equal(view.candidate.roomChoices.dealer,'dragan');assert.equal(view.candidate.clips.count,f.source.records.length);
    assert.equal(view.candidate.speech.every(row=>row.language==='sv'&&row.approvedBy==='unit-test-fixture'),true);
    assert.deepEqual(view.affectedRooms,[{id:room('north-b'),name:room('north-b'),bound:false,rebinds:false}],'only the company\'s own rooms');
    assert.equal(typeof view.revisions.roomGameConfigDraft,'string');
    const southBefore=await f.direct.getCurrentPackage('south'),before=await f.direct.getCurrentPackage('north');
    assert.equal(view.revisions.package,before.revision);
    const receipt=await f.publish(view),after=await f.direct.getCurrentPackage('north');
    assert.equal(receipt.previousPackageRevision,before.revision);assert.equal(receipt.packageRevision,before.revision+1);assert.equal(after.revision,before.revision+1);
    assert.equal(await binding('north-a'),receipt.configVersion);
    assert.deepEqual(receipt.gameConfig,{language:'sv',limitPreset:'prive'});assert.equal(receipt.actor,actor.user);
    assert.equal(receipt.publishedAt,new Date(after.publishedAtMs).toISOString());assert.deepEqual(receipt.changes,view.changes);
    const [head]=await f.rows('SELECT version FROM croupier_game.shared_table_config_heads WHERE room_id=$1',[room('north-a')]);
    assert.equal(head.version,receipt.configVersion);
    const [stored]=await f.rows('SELECT body FROM croupier_game.shared_table_configs WHERE room_id=$1 AND version=$2',[room('north-a'),receipt.configVersion]);
    const config=JSON.parse(stored.body);
    assert.equal(config.packageRevision,after.revision);assert.equal(config.operatorId,'north');assert.equal(config.limitPreset,'prive');
    assert.equal(config.material.dealerId,'dragan');assert.match(config.material.revision,/^native-film-v2-[a-f0-9]{64}$/);
    const admin=await f.raw.readDocument('administration');
    assert.equal(admin.revision,receipt.administrationRevision);assert.deepEqual(admin.value.roomGameConfigs,[],'the room draft is removed');
    assert.deepEqual(await f.direct.getCurrentPackage('south'),southBefore,'another company is untouched');
    // Inget kvar att publicera, och den gamla förhandsvisningen kan inte publicera igen.
    const again=await f.read();
    assert.equal(again.changed,false);assert.equal(again.ready,false);assert.deepEqual(again.changes,[]);assert.deepEqual(again.live.settings,{language:'sv',limitPreset:'prive'});
    const stable=await f.persisted();
    await assert.rejects(f.publish(view),code('studio_conflict',409,{step:'package'}));
    await assert.rejects(f.publish(again),code('studio_release_invalid',422,{reason:'studio_release_unchanged'}));
    assert.deepEqual(await f.persisted(),stable);
    // Ett utkast lika med live: vägran tar bort det med CAS, så att det inte ligger kvar som väntande.
    await f.saveDraft('north-a',{language:'sv',limitPreset:'prive'});
    const noop=await f.read(),pending=await f.persisted();
    assert.equal(noop.changed,false);assert.equal(typeof noop.revisions.roomGameConfigDraft,'string');
    await assert.rejects(f.publish(noop),code('studio_release_invalid',422,{reason:'studio_release_unchanged'}));
    const cleared=await f.read(),left=await f.persisted();
    assert.equal(cleared.revisions.roomGameConfigDraft,null,'the no-op draft is removed');
    assert.deepEqual((await f.raw.readDocument('administration')).value.roomGameConfigs,[]);
    assert.deepEqual({...left,documents:null},{...pending,documents:null},'only the administration document moves');
  });

  await t.test('a stale preview is a 409 before provider I/O and writes nothing',async()=>{
    await f.saveDraft('north-a',{language:'sv',limitPreset:'casual'});
    const view=await f.read(),before=await f.persisted(),io={...f.io};
    assert.equal(view.ready,true);
    for(const patch of [{previewToken:'0'.repeat(64)},{gameConfig:{language:'en',limitPreset:'casual'}}])
      await assert.rejects(f.post(f.bodyOf(view,patch)),code('studio_release_preview_stale',409));
    // Changed metadata on an approved take changes the frozen candidate without moving any revision.
    const speech=f.source.records.find(row=>row.classification.kind==='speech'),media=await f.raw.getMedia(speech.id);
    await f.raw.classifyMedia(speech.id,{sha256:speech.sha256,expectedRevision:media.revision,metadata:{...media.classification,label:'Ny etikett'},actor:'fixture'});
    const changed=await f.persisted();
    await assert.rejects(f.publish(view),code('studio_release_preview_stale',409));
    assert.deepEqual(f.io,io,'stale previews stop before Blob verification and capability checks');
    assert.deepEqual(await f.persisted(),changed);assert.deepEqual(changed.packages,before.packages);
    for(const [patch,step] of [[{expectedProjectRevision:'project-old'},'project'],[{expectedAdministrationRevision:'admin-old'},'administration'],[{expectedPackageRevision:1},'package']])
      await assert.rejects(f.post(f.bodyOf(view,patch)),code('studio_conflict',409,{step}));
    for(const patch of [{previewToken:'X'},{gameConfig:{language:'de',limitPreset:'casual'}},{roomId:'../room'},{extra:true}])
      await assert.rejects(f.post(f.bodyOf(view,patch)),code('studio_release_invalid',422));
    assert.deepEqual(await f.persisted(),changed);
  });

  await t.test('K05 material gate: no approved speech in the room language blocks and refuses before Blob verification',async()=>{
    await f.saveDraft('north-a',{language:'en',limitPreset:'casual'});
    const view=await f.read(),unavailable={area:'speech',code:'studio_room_game_material_unavailable',materialReason:'native_material_speech_unbound'};
    assert.equal(view.ready,false);assert.deepEqual(view.blockers,[unavailable]);
    const before=await f.persisted(),verified=f.io.verified;
    await assert.rejects(f.publish(view),code('studio_room_game_material_unavailable',422,{materialReason:'native_material_speech_unbound'}));
    assert.deepEqual(await f.persisted(),before);assert.equal(f.io.verified,verified);
  });

  await t.test('the neighbour room keeps its binding; a changed presentation rebinds it with its own settings',async()=>{
    await f.saveDraft('north-b',{language:'sv',limitPreset:'high'});
    const first=await f.publish(await f.read('north-b'));
    const neighbour=async()=>({binding:await binding('north-b'),
      heads:await f.rows('SELECT version FROM croupier_game.shared_table_config_heads WHERE room_id=$1',[room('north-b')]),
      configs:await f.rows('SELECT version,body FROM croupier_game.shared_table_configs WHERE room_id=$1 ORDER BY version',[room('north-b')])});
    const kept=await neighbour();assert.equal(kept.binding,first.configVersion);
    await f.saveDraft('north-a',{language:'sv',limitPreset:'casual'});
    const view=await f.read();
    assert.deepEqual(view.affectedRooms,[{id:room('north-b'),name:room('north-b'),bound:true,rebinds:false}]);
    const receipt=await f.publish(view);
    assert.deepEqual(await neighbour(),kept,'publishing room A leaves room B\'s binding, head and config untouched');
    assert.equal(await binding('north-a'),receipt.configVersion);
    // A new frozen candidate (changed media metadata) rebinds B: same settings, new package revision.
    const idle=f.source.records[0],media=await f.raw.getMedia(idle.id);
    await f.raw.classifyMedia(idle.id,{sha256:idle.sha256,expectedRevision:media.revision,metadata:{...media.classification,notes:'Ny anteckning'},actor:'fixture'});
    await f.saveDraft('north-a',{language:'sv',limitPreset:'prive'});
    const next=await f.read();
    assert.deepEqual(next.blockers,[]);assert.deepEqual(next.affectedRooms,[{id:room('north-b'),name:room('north-b'),bound:true,rebinds:true}]);
    const second=await f.publish(next),rebound=await neighbour(),pack=await f.direct.getCurrentPackage('north');
    assert.equal(second.packageRevision,receipt.packageRevision+1);assert.notEqual(rebound.binding,kept.binding);
    const body=JSON.parse(rebound.configs.find(row=>row.version===rebound.binding).body);
    assert.deepEqual([body.language,body.limitPreset,body.packageRevision],['sv','high',pack.revision]);
    assert.equal(rebound.heads[0].version,rebound.binding);
  });

  await t.test('a neighbour whose material J08 cannot rebind blocks the preview and is a 422 with its material reason',async()=>{
    // En ny fryst kandidat (ändrad metadata) binder om grannrummet B.
    const idle=f.source.records[0],media=await f.raw.getMedia(idle.id);
    await f.raw.classifyMedia(idle.id,{sha256:idle.sha256,expectedRevision:media.revision,metadata:{...media.classification,notes:'Grannrummet binds om'},actor:'fixture'});
    const version=await binding('north-b'),[{body:original}]=await f.rows('SELECT body FROM croupier_game.shared_table_configs WHERE room_id=$1 AND version=$2',[room('north-b'),version]);
    const store=async change=>{const value=JSON.parse(original);change(value);
      await f.pool.query('UPDATE croupier_game.shared_table_configs SET body=$3 WHERE room_id=$1 AND version=$2',[room('north-b'),version,JSON.stringify(value)]);};
    try {
      for(const [change,materialReason] of [
        // Icke-nativt material: J08 vägrar en ändrad presentation (fail utan skäl).
        [value=>{value.material.revision='legacy-room-material';delete value.material.film;},undefined],
        // Nativt material på ett språk utan godkänt tal: J08:s omlösning kastar med skäl.
        [value=>{value.language='en';value.material.language='en';},'native_material_speech_unbound']]) {
        await store(change);
        const view=await f.read();
        const blocker={area:'rooms',code:'studio_room_game_material_unavailable',roomId:room('north-b'),...(materialReason?{materialReason}:{})};
        assert.equal(view.ready,false);assert.deepEqual(view.blockers,[blocker]);
        const before=await f.persisted();
        await assert.rejects(f.publish(view),error=>code('studio_room_game_material_unavailable',422)(error)&&error.materialReason===materialReason);
        assert.deepEqual(await f.persisted(),before);
      }
    } finally {
      await f.pool.query('UPDATE croupier_game.shared_table_configs SET body=$3 WHERE room_id=$1 AND version=$2',[room('north-b'),version,original]);
    }
  });

  await t.test('HTTP: exact read query, {error, code, step} and runtime negotiation before SQL',async()=>{
    const origin='https://studio.invalid',transactions=[];
    const mutationTransaction=createNativePresentationMutationTransaction({repository:f.repository,boDb:{transaction:work=>work()},pool:f.pool,scope:f.scope});
    const http=createStudioAdminApi({authorize:async()=>({...actor,scope:f.scope}),allowedOrigins:[origin],publicHosts:['studio.invalid'],
      handlers:f.api.handlers,preparations:f.api.preparations,mutationTransaction:(work,options)=>{transactions.push(options);return mutationTransaction(work,options);}});
    for(const query of ['operatorId=north','operatorId=north&roomId=r1-north-a&roomId=x','operatorId=north&roomId=r1-north-a&gameConfig=x','operatorId=north&roomId=../x'])
      assert.equal(isPresentationRoomReadQuery('GET',new URL(`${origin}/studio/api/admin/room-release?${query}`)),false,query);
    assert.equal(isPresentationRoomReadQuery('GET',new URL(`${origin}/studio/api/admin/room-release?operatorId=north&roomId=r1-north-a`)),true);
    assert.equal((await http.handle(new Request(`${origin}/studio/api/admin/room-release?operatorId=north`))).status,404);
    await f.saveDraft('north-a',{language:'sv',limitPreset:'casual'});
    const io={...f.io},read=await http.handle(new Request(`${origin}/studio/api/admin/room-release?operatorId=north&roomId=${room('north-a')}`));
    assert.equal(read.status,200);assert.equal(read.headers.get('cache-control'),'private, no-store');assert.deepEqual(f.io,io);
    const view=await read.json();assert.equal(view.ready,true);
    const foreign=await http.handle(new Request(`${origin}/studio/api/admin/room-release?operatorId=south&roomId=${room('north-a')}`));
    assert.equal(foreign.status,404);assert.deepEqual(await foreign.json(),{error:'studio_room_not_found',code:'studio_room_not_found'});
    const request=body=>new Request(`${origin}/studio/api/admin/operator-package`,{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify(body)});
    const stale=await http.handle(request(f.bodyOf(view,{previewToken:'f'.repeat(64)})));
    assert.equal(stale.status,409);assert.deepEqual(await stale.json(),{error:'studio_release_preview_stale',code:'studio_release_preview_stale'});
    const old=await http.handle(request(f.bodyOf(view,{expectedPackageRevision:1})));
    assert.equal(old.status,409);assert.deepEqual(await old.json(),{error:'studio_conflict',code:'studio_conflict',step:'package'});
    const invalid=await http.handle(request(f.bodyOf(view,{gameConfig:{language:'sv',limitPreset:'custom'}})));
    assert.equal(invalid.status,422);assert.deepEqual(await invalid.json(),{error:'studio_release_invalid',code:'studio_release_invalid'});
    const published=await http.handle(request(f.bodyOf(view)));
    assert.equal(published.status,200);assert.equal((await published.json()).packageRevision,view.revisions.package+1);
    const options=transactions.at(-1);
    assert.deepEqual(options.presentationDocuments,['project','administration']);assert.deepEqual(options.presentationOperatorIds,['north']);
    assert.equal(options.presentationMutation[0].kind,'presentation-package');
    assert.deepEqual(options.presentationMutation.slice(1),[{kind:'administration',value:{roomGameConfigs:[]}},{kind:'native-film-planning',value:{}}]);
    const repeat=await http.handle(request(f.bodyOf(view)));
    assert.equal(repeat.status,409);assert.deepEqual(await repeat.json(),{error:'studio_conflict',code:'studio_conflict',step:'package'});
  });

  await t.test('company isolation, role and scope, and J08 CAS: one concurrent winner, a moved room head is a conflict',async()=>{
    for(const [name,operatorId] of [['north-a','south'],['south','north'],['missing','north']])
      await assert.rejects(f.read(name,operatorId),code('studio_room_not_found',404));
    await assert.rejects(f.read('north-a','north',{actor:{user:'partner',role:'partner'}}),{statusCode:403});
    await assert.rejects(f.read('north-a','north',{scope:{...f.scope,workspaceId:'other'}}),{statusCode:403});
    await f.saveDraft('north-a',{language:'sv',limitPreset:'high'});
    const view=await f.read(),before=await f.persisted();
    await assert.rejects(f.post(f.bodyOf(view,{operatorId:'south'})),code('studio_room_not_found',404));
    await assert.rejects(f.post(f.bodyOf(view),{actor:{user:'partner',role:'partner'}}),{statusCode:403});
    assert.deepEqual(await f.persisted(),before);
    // Two preparations of the same preview: one commits, the other meets the package CAS.
    const context={body:f.bodyOf(view),actor,scope:f.scope},prepare=()=>f.api.preparations.get(POST)(context);
    const [one,two]=[await prepare(),await prepare()];
    const outcomes=await Promise.allSettled([one,two].map(prepared=>f.api.handlers.get(POST)({...context,prepared})));
    assert.equal(outcomes.filter(row=>row.status==='fulfilled').length,1);
    assert.ok(code('studio_conflict',409,{step:'package'})(outcomes.find(row=>row.status==='rejected').reason));
    assert.equal((await f.direct.getCurrentPackage('north')).revision,view.revisions.package+1);
    await assert.rejects(f.api.handlers.get(POST)({...context,prepared:{...one}}),code('studio_release_invalid',422),'a copied preparation never writes');
    // Varje revision läses om under låset: en ändring efter förberedelsen är 409 och skriver inget.
    await f.saveDraft('north-a',{language:'sv',limitPreset:'casual'});
    const late=async(change,check)=>{
      const fresh=await f.read(),later={body:f.bodyOf(fresh),actor,scope:f.scope};
      assert.equal(fresh.ready,true,JSON.stringify(fresh.blockers));
      const prepared=await f.api.preparations.get(POST)(later);
      await change();const stable=await f.persisted();
      await assert.rejects(f.api.handlers.get(POST)({...later,prepared}),check);
      assert.deepEqual(await f.persisted(),stable);
    };
    await late(async()=>{const doc=await f.raw.readDocument('project');
      await f.raw.saveDocument('project',{value:{...doc.value,lanes:doc.value.lanes.map((lane,index)=>index?lane:{...lane,label:`${lane.label} (ändrad)`})},expectedRevision:doc.revision,actor:'fixture'});},
    code('studio_conflict',409,{step:'project'}));
    await late(()=>f.saveDraft('north-b',{language:'sv',limitPreset:'prive'}),code('studio_conflict',409,{step:'administration'}));
    // Det nativa materialet binder varje infångad post för dealern; omkontrollen av de infångade
    // medieposterna svarar före materialkontrollen (som annars ger 422).
    const action=f.source.records.find(row=>row.classification.kind==='action');
    await late(async()=>{const media=await f.raw.getMedia(action.id);
      await f.raw.classifyMedia(action.id,{sha256:action.sha256,expectedRevision:media.revision,metadata:{...media.classification,notes:'Ändrad efter förberedelsen'},actor:'fixture'});},
    code('studio_conflict',409,{step:'media'}));
    // Another writer moved room A's head without a package: the J08 head CAS refuses and nothing is written.
    await f.saveDraft('north-a',{language:'sv',limitPreset:'casual'});
    const moved='room-config-00000000-0000-4000-8000-000000000099',ready=await f.read();
    await f.pool.query('INSERT INTO croupier_game.shared_table_configs(room_id,version,body) VALUES($1,$2,$3)',[room('north-a'),moved,'{}']);
    await f.pool.query('UPDATE croupier_game.shared_table_config_heads SET version=$2 WHERE room_id=$1',[room('north-a'),moved]);
    const stable=await f.persisted();
    await assert.rejects(f.publish(ready),code('studio_conflict',409,{step:'room_config_head'}));
    assert.deepEqual(await f.persisted(),stable);
  });

  await t.test('company material changed after the preparation is a 409 at step materials',async()=>{
    const materials=sql=>createOperatorMaterialStore({sql,scope:f.scope});
    const api=createOperatorPackageApi({pool:f.pool,scope:f.scope,repository:f.repository,videoRegistry:f.videoRegistry,materials});
    const view=await api.handlers.get(GET)({actor,scope:f.scope,
      request:new Request(`https://studio.invalid/studio/api/admin/room-release?operatorId=north&roomId=${room('north-b')}`)});
    assert.equal(view.ready,true,JSON.stringify(view.blockers));
    const context={body:f.bodyOf(view),actor,scope:f.scope},prepared=await api.preparations.get(POST)(context);
    const materialId='0d0d0d0d-0000-4000-8000-00000000b0f1',sha256='6'.repeat(64);
    await materials(f.pool).appendMaterial({actor:'staff-1',audit:{actorId:'staff-1',accessClass:'internal-admin',requestId:randomUUID()},
      operatorId:'north',materialId,expectedRevision:0,state:'pending',source:'upload',asset:{schemaVersion:1,id:materialId,role:'background',
        label:'Bolagets bakgrund',sha256,size:4096,contentType:'image/png',width:1920,height:1080,pathname:`croupier/media/backgrounds/${materialId}/${sha256}.png`}});
    const stable=await f.persisted();
    await assert.rejects(api.handlers.get(POST)({...context,prepared}),code('studio_conflict',409,{step:'materials'}));
    assert.deepEqual(await f.persisted(),stable);
  });

  await t.test('an open company appearance draft blocks the release (first version)',async()=>{
    await f.saveDraft('north-b',{language:'sv',limitPreset:'casual'});
    const ready=await f.read('north-b'),context={body:f.bodyOf(ready),actor,scope:f.scope};
    assert.equal(ready.ready,true,JSON.stringify(ready.blockers));
    const prepared=await f.api.preparations.get(POST)(context);
    const pack=await f.direct.getCurrentPackage('north');
    await f.direct.saveBrandingDraft({actor:'partner-1',operatorId:'north',expectedDraftRevision:0,expectedPackageRevision:pack.revision,branding:{color:'#112233'}});
    const view=await f.read('north-b');
    assert.equal(view.ready,false);assert.deepEqual(view.blockers,[{area:'roomChoices',code:'studio_room_choices_draft_pending',draftRevision:1}]);
    const before=await f.persisted();
    await assert.rejects(f.publish(view),code('studio_room_choices_draft_pending',409));
    // Ett utkast sparat efter förberedelsen stoppas under låset.
    await assert.rejects(f.api.handlers.get(POST)({...context,prepared}),code('studio_room_choices_draft_pending',409));
    assert.deepEqual(await f.persisted(),before);
  });
});

test('without the 009 game-settings storage the preview blocks and publication is a 503 before any write',async t=>{
  const f=await releaseFixture(t,{without009:true});
  assert.equal((await f.rows("SELECT to_regclass('croupier_game.shared_table_configs')::text AS configs"))[0].configs,null);
  await f.saveDraft('north-a',{language:'sv',limitPreset:'prive'});
  const view=await f.read(),before=await f.persisted();
  assert.equal(view.ready,false);assert.ok(view.blockers.some(row=>row.code==='studio_room_config_storage_missing'));
  await assert.rejects(f.publish(view),code('studio_room_config_storage_missing',503));
  assert.deepEqual(await f.persisted(),before);
});
