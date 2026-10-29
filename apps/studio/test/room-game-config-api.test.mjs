import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioAdminApi} from '../lib/studio-admin-api.mjs';
import {createRoomGameConfigApi} from '../lib/room-game-config-api.mjs';
import {createNativeStudioRequestHandlers} from '../lib/studio-native-runtime.mjs';
import {cloudPresentationFixture} from './fixtures/cloud-presentation.mjs';
import {defaultPresentationLane} from '../../../packages/presentation/contracts/studio-model.mjs';
import {readPackagePresentation,withPackagePresentation} from '../../../packages/presentation/server/presentation-package.mjs';
import {canonicalStudioJson,validateDocumentValue} from '../../../packages/studio-registry/server/document-contract.mjs';
import {ROOM_LIMIT_PRESETS,validateRoomGameConfig} from '../../../packages/presentation/contracts/room-game-config.mjs';
import {isPresentationRoomReadQuery,studioAdminEndpoint} from '../lib/studio-admin-contract.mjs';
import {runtimeCatalogRevision} from '../../../packages/studio-registry/server/runtime-catalog.mjs';
import {recordedSpeechForVideo,recordedSpeechIdentity} from '../../../packages/presentation/contracts/recorded-speech.mjs';
import {SPEECH_SLOT_IDS} from '../../../packages/presentation/contracts/speech-slot-bindings.mjs';
import {readRuntimeCatalogFixture} from '../../../test/fixtures/runtime-media-catalog.mjs';
import {nativeRoomMaterialFixture,nativeRoomMaterialChoicesFixture} from '../../../test/fixtures/native-room-game-material.mjs';
import {resolveNativeRoomGameMaterial} from '../../../packages/presentation/server/native-room-game-material.mjs';
import {createSharedRoomAccess} from '../../../services/game/shared-room-access.mjs';
import {EXTENDED_PRESENTATION_STORAGE_CHECKSUM} from '../../../packages/presentation/server/presentation-storage.mjs';

const scope={environment:'j08-test',workspaceId:'isolated'},actor={user:'j08-admin',role:'admin'};
const clone=structuredClone;
const catalogValue=readRuntimeCatalogFixture(),catalog={revision:runtimeCatalogRevision(catalogValue),value:catalogValue};
function fixture({resolver=true,speech=false,native=false,branding={}}={}) {
  const source=native?(native===true?nativeRoomMaterialFixture():native):null;
  const cloud=source?{project:source.project,presentation:source.presentation,mediaRows:source.records.map(row=>({...clone(row),revision:'media-1'}))}:cloudPresentationFixture({lanes:[defaultPresentationLane('linnea')]});
  const dealerId=cloud.presentation.lanes[0].layers.dealer.default;
  if(speech) {
    const record=clone(cloud.mediaRows[0]);record.id='80000000-0000-4000-8000-000000000001';
    record.pathname=`croupier/media/dealers/linnea/review/uploads/${record.id}/${record.sha256}.mp4`;
    const recorded={schemaVersion:1,dealerId:'linnea',lineId:'goodluck',takeId:'goodluck_1',language:'sv',exactText:'Fixture only.',
      videoSha256:record.sha256,audioSha256:'a'.repeat(64),indexSha256:'b'.repeat(64),fps:24,frameCount:48,audioDelayMs:0,
      entryPose:'VILA',exitPose:'VILA',calibrationRevision:'fixture-1',recording:{status:'pending'},review:{status:'pending'}};
    const proof={by:'fixture-reviewer',at:'2026-10-22T00:00:00.000Z',identity:recordedSpeechIdentity(recorded)};
    recorded.recording={status:'verified-recording',...clone(proof)};recorded.review={status:'approved',...clone(proof)};
    record.classification={dealerId:'linnea',eventId:'speak.goodluck',kind:'speech',role:'standard',situation:'goodluck',label:'Fixture',notes:'',recordedSpeech:recorded};
    cloud.mediaRows.push(record);const {revision,...frozen}=record;cloud.presentation.playback.media.push(frozen);
    cloud.presentation.playback.lines.find(row=>row.eventId==='speak.goodluck').variants[0].videoGenerationId=record.id;
  }
  const room={schemaVersion:2,id:'room-test',name:'Test room',operatorId:'north',presentationLaneId:'mobile-phone',gameLaneId:'room-lane',state:'live'};
  const operator={environment_id:scope.environment,workspace_id:scope.workspaceId,operator_id:'north',slug:'north',name:'North',status:'active',created_at_ms:1};
  let state={document:{revision:'admin-1',value:{rooms:[room],gameLane:'room-lane',gameLanes:[{schemaVersion:1,id:'room-lane',label:'Room',renderer:'portrait-video',dealer:dealerId,mediaCollection:dealerId+'-presentation'}]}},
    packages:[{environment_id:scope.environment,workspace_id:scope.workspaceId,operator_id:'north',package_revision:1,lanes:'["mobile-phone"]',games:'["blackjack"]',tables:'["room-test"]',branding:canonicalStudioJson(withPackagePresentation(branding,cloud.presentation,{allowExtended:Boolean(native)})),published_at_ms:1}],configs:{},heads:{},audits:[],mediaRows:clone(cloud.mediaRows),catalog:clone(catalog)};
  let work=null,serial=Promise.resolve(),failure=null,captureChange=null,mediaChange=null,resolverChange=null;const trace=[];
  const client={async query(sql,values) {
    assert.ok(work,'every SQL query uses one active repository transaction');assert.deepEqual(values.slice(0,2),[scope.environment,scope.workspaceId]);
    const marker=/\/\* ([^ ]+) \*\//.exec(sql)?.[1];trace.push(marker);
    if(failure===marker){failure=null;throw Error('injected SQL failure');}
    let rows=[];
    if(marker==='operator-store:operator-by-id'||marker==='operator-store:lock-operator')rows=values[2]===operator.operator_id?[operator]:[];
    else if(marker==='operator-store:extended-presentation-ready')rows=[{checksum:EXTENDED_PRESENTATION_STORAGE_CHECKSUM,structure_checksum:'a'.repeat(64),matching_checks:2}];
    else if(marker==='operator-store:current-package')rows=work.packages.filter(row=>row.operator_id===values[2]).slice(-1);
    else if(marker==='operator-store:publish-package') {const row={...work.packages.at(-1),package_revision:work.packages.at(-1).package_revision+1,lanes:values[3],games:values[4],tables:values[5],branding:values[6],published_at_ms:values[7]};work.packages.push(row);rows=[row];}
    else if(marker==='operator-store:audit-write'){work.audits.push(values);rows=[{event_id:values[3]}];}
    else if(marker==='operator-store:room-config-lock')assert.match(sql,/pg_advisory_xact_lock/);
    else if(marker==='operator-store:room-config-administration')rows=[clone(work.document)];
    else if(marker==='operator-store:package-by-revision')rows=work.packages.filter(row=>row.operator_id===values[2]&&row.package_revision===values[3]);
    else if(marker==='operator-store:room-config-current'){const version=work.heads[values[2]];rows=version?[{version,body:work.configs[values[2]+':'+version]}]:[];}
    else if(marker==='operator-store:room-config-media')rows=work.mediaRows.filter(row=>values[2].includes(row.id)).map(({revision,updatedAt,...record})=>({id:record.id,record}));
    else if(marker==='operator-store:room-config-insert'){const key=values[2]+':'+values[3];assert.equal(work.configs[key],undefined);work.configs[key]=values[4];}
    else if(marker==='operator-store:room-config-head'){if((work.heads[values[2]]??null)===values[4]){work.heads[values[2]]=values[3];rows=[{version:values[3]}];}}
    else if(marker==='room-game-config:read-published'){const body=work.configs[values[2]+':'+values[3]];rows=body?[{body}]:[];}
    else if(marker==='shared-room-access:config'){const version=work.heads[values[2]];rows=version?[{version,body:work.configs[values[2]+':'+version]}]:[];}
    else throw Error('Unhandled SQL '+marker);
    return {rows:clone(rows)};
  }};
  const repository={scope,async transaction(callback) {
    const previous=serial;let unlock;serial=new Promise(resolve=>{unlock=resolve;});await previous;work=clone(state);
    try{const result=await callback();state=work;return result;}finally{work=null;unlock();}
  },async withTransactionClient(callback){assert.ok(work);return callback(client);},async readDocument(){assert.ok(work);return clone(work.document);},
  async readPresentationSnapshot(){assert.ok(work,'snapshot must use the active scoped transaction');trace.push('material:snapshot');
    const value={scope:clone(scope),projectDocument:{kind:'project',revision:cloud.project.revision,value:clone(cloud.project)},administrationDocument:clone(work.document),mediaRows:clone(work.mediaRows),runtimeCatalog:clone(work.catalog)};
    captureChange?.(value);return value;},
  async getMedia(id){assert.ok(work,'media recheck must use the same transaction');trace.push('material:recheck');const row=clone(work.mediaRows.find(row=>row.id===id));mediaChange?.(row);return row;},
  async saveDocument(kind,{value,expectedRevision}) {
    assert.ok(work);assert.equal(kind,'administration');if(work.document.revision!==expectedRevision)throw Object.assign(Error('conflict'),{statusCode:409});
    work.document={revision:'admin-'+(Number(work.document.revision.split('-')[1])+1),value:validateDocumentValue(kind,value,'validation')};return clone(work.document);
  }};
  let materialOverride=null;
  const material=({language})=>materialOverride??({revision:'media-revision-1',dealerId:'linnea',language,leadMs:1200,cardMs:880,media:cloud.mediaRows.map(({id,sha256})=>({id,sha256}))});
  const api=createRoomGameConfigApi({repository,scope,...(resolver?{resolveMaterial:input=>{assert.ok(work);const value=typeof resolver==='function'?resolver(input):material(input);resolverChange?.(input,value);return value;}}:{}),now:()=>100});
  const invoke=(method,body,options={})=>api.handlers.get(method+' /studio/api/admin/room-game-config')({actor,scope,request:new Request('https://studio.invalid/studio/api/admin/room-game-config?operatorId=north&roomId=room-test',{method}),body,...options});
  const save=(gameConfig={language:'sv',limitPreset:'prive'},extra={})=>invoke('POST',{action:'save-draft',operatorId:'north',roomId:'room-test',expectedAdministrationRevision:state.document.revision,expectedPackageRevision:state.packages.at(-1).package_revision,gameConfig,...extra});
  const publish=draft=>invoke('POST',{action:'publish',operatorId:'north',roomId:'room-test',expectedAdministrationRevision:draft.administrationRevision,expectedPackageRevision:draft.packageRevision,expectedDraftRevision:draft.draft.revision});
  return {api,repository,invoke,save,publish,trace,snapshot:()=>clone(state),fail:marker=>{failure=marker;},setMaterial:value=>{materialOverride=value;},material:()=>material({language:'sv'}),
    changeState:change=>change(state),changeCapture:change=>{captureChange=change;},changeMediaRead:change=>{mediaChange=change;},changeResolver:change=>{resolverChange=change;}};
}

test('J08 save/read/publish binds immutable full profile and package on the same transaction',async()=>{
  const f=fixture(),draft=await f.save();assert.equal(draft.published,null);assert.equal(draft.publication.ready,true);
  assert.deepEqual(f.snapshot().heads,{});assert.equal(f.snapshot().packages.length,1);assert.deepEqual((await f.invoke('GET')).draft,draft.draft);
  const result=await f.publish(draft);assert.equal(result.packageRevision,2);assert.equal(result.draft,null);assert.equal(result.published.packageRevision,2);
  const stored=f.snapshot(),version=result.published.configVersion,config=JSON.parse(stored.configs['room-test:'+version]);
  assert.equal(stored.heads['room-test'],version);assert.equal(JSON.parse(stored.packages.at(-1).branding).roomGameConfigVersions['room-test'],version);
  assert.equal(config.betMs,20000);assert.equal(config.actionMs,15000);assert.equal(config.language,'sv');assert.equal(config.cardMs,880);
  assert.deepEqual(config.limits,{min:5,max:2000,sideMax:200});assert.deepEqual(config.chips,ROOM_LIMIT_PRESETS.prive.chips);assert.equal(config.refill,1000);
  assert.ok(f.trace.indexOf('operator-store:room-config-lock')<f.trace.indexOf('operator-store:publish-package'));
  assert.deepEqual((await f.invoke('GET')).published,result.published);
});
test('native material publishes through the captured current-record and frozen-package checks without provider I/O',async t=>{
  const provider=t.mock.method(globalThis,'fetch',()=>{throw Error('unexpected provider request');});
  const f=fixture({native:true,resolver:resolveNativeRoomGameMaterial});
  const draft=await f.save({language:'sv',limitPreset:'casual'});assert.deepEqual(draft.publication,{ready:true});
  const published=await f.publish(draft),state=f.snapshot();
  const frozen=JSON.parse(state.configs['room-test:'+published.published.configVersion]);
  assert.match(frozen.material.revision,/^native-/);assert.equal(frozen.material.dealerId,'dragan');
  assert.ok(f.trace.includes('material:snapshot'));assert.ok(f.trace.includes('material:recheck'));
  assert.equal(provider.mock.callCount(),0);

  const changed=fixture({native:true,resolver:resolveNativeRoomGameMaterial});
  const prepared=await changed.save({language:'sv',limitPreset:'casual'});
  changed.changeCapture(snapshot=>{snapshot.mediaRows[0].classification.notes='Changed after frozen publication';});
  const before=changed.snapshot();await assert.rejects(changed.publish(prepared),{code:'studio_room_game_material_unavailable'});
  assert.deepEqual(changed.snapshot(),before,'changed current material never publishes a config or new package');
});
test('room override save/read/publish binds the selected full bank and rejects missing or unauthorized choices',async()=>{
  const source=nativeRoomMaterialChoicesFixture();
  const branding={roomOverrides:{'room-test':{dealer:'paow'},'another-room':{dealer:'dragan'}}};
  const f=fixture({native:source,branding,resolver:resolveNativeRoomGameMaterial});
  const draft=await f.save({language:'sv',limitPreset:'casual'});
  assert.deepEqual(draft.publication,{ready:true});
  assert.deepEqual((await f.invoke('GET')).draft,draft.draft);
  const result=await f.publish(draft),state=f.snapshot();
  const frozen=JSON.parse(state.configs['room-test:'+result.published.configVersion]);
  assert.equal(frozen.material.dealerId,'paow');
  assert.deepEqual((await f.invoke('GET')).published,result.published);
  assert.deepEqual(frozen.material.media.map(row=>row.id),source.records.filter(row=>row.classification.dealerId==='paow').map(row=>row.id).sort());
  assert.deepEqual(JSON.parse(state.packages.at(-1).branding).roomOverrides,branding.roomOverrides);
  for(const dealer of ['nora','paow']) {
    const native=dealer==='paow'?nativeRoomMaterialFixture():nativeRoomMaterialChoicesFixture();
    const rejected=fixture({native,branding:{roomOverrides:{'room-test':{dealer}}},resolver:resolveNativeRoomGameMaterial});
    const pending=await rejected.save({language:'sv',limitPreset:'casual'});
    assert.equal(pending.publication.ready,false);
    const before=rejected.snapshot();
    await assert.rejects(rejected.publish(pending),{code:'studio_room_game_material_unavailable'});
    assert.deepEqual(rejected.snapshot(),before);
  }
});

test('embedded AV room override survives J08 save/read/publish and native access with exact source, tracks and revisions',async t=>{
  const provider=t.mock.method(globalThis,'fetch',()=>{throw Error('unexpected provider request');});
  const options={speechSchemaVersion:2,language:'en',allSpeechSlots:true};
  const source=nativeRoomMaterialChoicesFixture(options);
  const branding={roomOverrides:{'room-test':{dealer:'paow'},'another-room':{dealer:'dragan'}}};
  const f=fixture({native:source,branding,resolver:resolveNativeRoomGameMaterial});
  const draft=await f.save({language:'en',limitPreset:'casual'}),readDraft=await f.invoke('GET');
  assert.deepEqual(readDraft.draft,draft.draft);assert.deepEqual(readDraft.publication,{ready:true});
  const published=await f.publish(readDraft),read=await f.invoke('GET'),state=f.snapshot();
  assert.deepEqual(read.published,published.published);assert.equal(read.draft,null);
  const version=read.published.configVersion,key='room-test:'+version,frozen=JSON.parse(state.configs[key]);
  const row=state.packages.at(-1),pack={operatorId:row.operator_id,revision:row.package_revision,
    lanes:JSON.parse(row.lanes),games:JSON.parse(row.games),tables:JSON.parse(row.tables),branding:JSON.parse(row.branding)};
  assert.equal(state.heads['room-test'],version);assert.equal(pack.branding.roomGameConfigVersions['room-test'],version);
  assert.equal(frozen.configVersion,version);assert.equal(frozen.packageRevision,read.published.packageRevision);
  assert.equal(pack.revision,2);assert.equal(read.packageRevision,pack.revision);assert.equal(frozen.packageRevision,pack.revision);
  assert.deepEqual(pack.branding.roomOverrides,branding.roomOverrides);
  const material=resolveNativeRoomGameMaterial({package:pack,room:state.document.value.rooms[0],language:read.published.gameConfig.language});
  assert.deepEqual(frozen.material,material);assert.match(material.revision,/^native-film-v1-[a-f0-9]{64}$/);
  assert.equal(material.dealerId,'paow');assert.equal(material.language,'en');
  assert.deepEqual(material.media.map(item=>item.id),source.records.filter(item=>item.classification.dealerId==='paow').map(item=>item.id).sort());
  const speeches=readPackagePresentation(pack).playback.media.filter(item=>item.classification.dealerId==='paow'&&item.classification.kind==='speech');
  assert.deepEqual(new Set(speeches.map(item=>item.classification.situation)),new Set(SPEECH_SLOT_IDS));
  for(const video of speeches){
    const speech=video.classification.recordedSpeech;
    assert.equal(speech.schemaVersion,2);assert.equal(speech.sourceKind,'embedded-mp4-av');
    assert.equal(speech.source.status,'verified-embedded-av');assert.equal(speech.review.status,'approved');
    assert.deepEqual(speech.source.identity,recordedSpeechIdentity(speech));
    assert.equal(video.mediaTiming.video.trackId,speech.videoTrackId);
    assert.deepEqual(video.mediaTiming.audio.map(track=>track.trackId),[speech.audioTrackId]);
    assert.deepEqual(recordedSpeechForVideo(video,{dealerId:'paow',language:'en',lineId:speech.lineId,takeId:speech.takeId}),speech);
    assert.equal(recordedSpeechForVideo(video,{dealerId:'paow',language:'sv',lineId:speech.lineId}),null);
  }
  const session={actorId:'synthetic-player',sessionId:'player-'+'a'.repeat(64),expiresAt:1000,partnerKeyId:null};
  const access=createSharedRoomAccess({repository:f.repository,scope,now:()=>100,
    auth:{binding:async()=>clone(session),bindingById:async id=>id===session.sessionId?clone(session):null}});
  const authorize=()=>access.authorize(new Request('https://engine.invalid/shared-room/room-test'),{roomId:'room-test'});
  const binding=await authorize();assert.equal(binding.packageRevision,read.packageRevision);
  assert.equal(binding.roomId,'room-test');assert.equal(binding.operatorId,'north');
  assert.deepEqual(await access.revalidate(binding),binding);assert.deepEqual(f.snapshot(),state);
  assert.ok(f.trace.includes('shared-room-access:config'));
  for(const change of [value=>{value.configVersion='room-config-00000000-0000-4000-8000-000000000000';},
    value=>{value.packageRevision++;},value=>{value.material.revision='native-film-v1-'+'f'.repeat(64);}]){
    f.changeState(saved=>{const value=clone(frozen);change(value);saved.configs[key]=JSON.stringify(value);});
    const before=f.snapshot();await assert.rejects(authorize(),{code:'studio_forbidden',statusCode:403});assert.deepEqual(f.snapshot(),before);
    f.changeState(saved=>{saved.configs[key]=JSON.stringify(frozen);});
  }
  const selectedSpeech=rows=>rows.find(item=>item.classification.dealerId==='paow'&&item.classification.kind==='speech');
  const negatives=[
    {name:'pending source',captured:true,change:video=>{video.classification.recordedSpeech.source={status:'pending'};video.classification.recordedSpeech.review={status:'pending'};}},
    {name:'pending review',captured:true,change:video=>{video.classification.recordedSpeech.review={status:'pending'};}},
    {name:'changed video track',change:video=>{video.mediaTiming.video.trackId=3;}},
    {name:'changed audio track',change:video=>{video.mediaTiming.audio[0].trackId=3;}}
  ];
  for(const {name,captured,change} of negatives){
    const native=nativeRoomMaterialChoicesFixture(options);if(captured)change(selectedSpeech(native.records));
    const denied=fixture({native,branding,resolver:resolveNativeRoomGameMaterial}),pending=await denied.save({language:'en',limitPreset:'casual'});
    if(!captured){assert.equal(pending.publication.ready,true);denied.changeState(saved=>change(selectedSpeech(saved.mediaRows)));}
    const before=denied.snapshot();denied.trace.length=0;
    assert.equal((await denied.invoke('GET')).publication.ready,false,name);
    await assert.rejects(denied.publish(pending),{code:'studio_room_game_material_unavailable',statusCode:422});
    assert.deepEqual(denied.snapshot(),before,name+' cannot change package, config, head, draft or audit');
    assert.equal(denied.trace.some(marker=>['operator-store:publish-package','operator-store:audit-write','operator-store:room-config-insert','operator-store:room-config-head'].includes(marker)),false);
  }
  assert.equal(provider.mock.callCount(),0);
});

test('material readiness exposes only fixed native reason codes and leaves publish errors generic',async()=>{
  for(const reason of ['native_material_measurement_missing','private_database_password','native_material_measurement_missing\nsecret']){
    const f=fixture({resolver:()=>{throw Object.assign(Error('private failure'),{statusCode:422,code:'studio_room_game_material_unavailable',reason});}});
    const draft=await f.save();
    const expected={ready:false,reason:'studio_room_game_material_unavailable',...(reason==='native_material_measurement_missing'?{materialReason:reason}:{})};
    assert.deepEqual(draft.publication,expected);assert.deepEqual((await f.invoke('GET')).publication,expected);
    await assert.rejects(f.publish(draft),error=>error.code==='studio_room_game_material_unavailable'&&error.reason===undefined);
  }
  const native=fixture({resolver:resolveNativeRoomGameMaterial}),draft=await native.save();
  // A dealer without its own filmed profile inherits PAOW's and reaches the material checks.
  assert.deepEqual(draft.publication,{ready:false,reason:'studio_room_game_material_unavailable',materialReason:'native_material_measurement_missing'});
});
test('J08 role and tenant failures happen before data reads; wrong room cannot publish',async()=>{
  const f=fixture();await assert.rejects(f.invoke('GET',undefined,{actor:{user:'partner',role:'partner'}}),{statusCode:403});
  await assert.rejects(f.invoke('GET',undefined,{scope:{...scope,workspaceId:'other'}}),{statusCode:403});assert.equal(f.trace.length,0);
  await assert.rejects(f.save(undefined,{roomId:'other-room'}),{statusCode:404});assert.equal(f.snapshot().packages.length,1);
});
test('J08 stale administration, package and draft revisions never partially publish',async()=>{
  const f=fixture(),first=await f.save();await assert.rejects(f.save(undefined,{expectedAdministrationRevision:'old'}),{statusCode:409});
  await assert.rejects(f.save(undefined,{expectedPackageRevision:99}),{statusCode:409});await f.save({language:'en',limitPreset:'high'});
  await assert.rejects(f.publish(first),{statusCode:409});assert.deepEqual(f.snapshot().heads,{});
});
test('J08 publication fault rolls package, audit, config, head and draft back together',async()=>{
  const f=fixture(),draft=await f.save(),before=f.snapshot();f.fail('operator-store:room-config-head');await assert.rejects(f.publish(draft),{code:'studio_storage_unavailable',statusCode:503});assert.deepEqual(f.snapshot(),before);
  await f.publish(draft);assert.equal(f.snapshot().packages.length,2);
});
test('J08 concurrent duplicate publications have one winner',async()=>{
  const f=fixture(),draft=await f.save();const outcomes=await Promise.allSettled([f.publish(draft),f.publish(draft)]);
  assert.equal(outcomes.filter(row=>row.status==='fulfilled').length,1);assert.equal(outcomes.find(row=>row.status==='rejected').reason.statusCode,409);assert.equal(f.snapshot().packages.length,2);
});
test('J08 unavailable, wrong-language or changed-hash material is rejected without fixture fallback',async()=>{
  const unavailable=fixture({resolver:false}),draft=await unavailable.save();assert.equal(draft.publication.ready,false);await assert.rejects(unavailable.publish(draft),{statusCode:422});
  for(const override of ['language','hash']) {const f=fixture();const value=f.material();if(override==='language')value.language='en';else value.media[0].sha256='f'.repeat(64);f.setMaterial(value);const d=await f.save();assert.equal(d.publication.ready,false);await assert.rejects(f.publish(d),{statusCode:422});assert.deepEqual(f.snapshot().heads,{});}
});
test('J08 material receives the current scoped catalogue and detached package inside the write transaction',async()=>{
  const f=fixture(),draft=await f.save();f.trace.length=0;
  f.changeState(state=>{state.catalog.value.layout.files.reverse();state.catalog.revision=runtimeCatalogRevision(state.catalog.value);});
  const currentCatalog=f.snapshot().catalog;assert.notEqual(currentCatalog.revision,catalog.revision);
  f.changeResolver(input=>{
    assert.deepEqual(input.capturedCatalog,f.snapshot().catalog);
    assert.equal(input.package.operatorId,'north');assert.equal(input.package.revision,1);assert.equal(input.room.id,'room-test');
    input.package.tables.length=0;input.room.id='tampered';input.capturedCatalog.revision='c'.repeat(64);
  });
  await f.publish(draft);const state=f.snapshot();
  assert.deepEqual(JSON.parse(state.packages.at(-1).tables),['room-test']);assert.equal(state.document.value.rooms[0].id,'room-test');
  assert.deepEqual(state.catalog,currentCatalog);assert.equal(f.trace.filter(row=>row==='material:snapshot').length,1);
  assert.ok(f.trace.indexOf('material:recheck')<f.trace.indexOf('operator-store:publish-package'));
});

test('J08 current registry identities must still match the frozen package at publication',async()=>{
  for(const change of [state=>state.mediaRows.splice(0),state=>state.mediaRows[0].sha256='f'.repeat(64),
    state=>state.mediaRows[0].classification.dealerId='nora',state=>state.mediaRows[0].classification.archived=true,
    state=>state.mediaRows[0].classification.kind='forged']) {
    const f=fixture(),draft=await f.save();f.changeState(change);const before=f.snapshot();
    assert.equal((await f.invoke('GET')).publication.ready,false);
    await assert.rejects(f.publish(draft),{statusCode:422});assert.deepEqual(f.snapshot(),before);
  }
});

test('J08 current speech must retain its approved exact language and take',async()=>{
  const accepted=fixture({speech:true});await accepted.publish(await accepted.save());
  for(const change of [speech=>{speech.review={status:'pending'};},speech=>{speech.review.status='rejected';},
    speech=>{speech.language='en';speech.recording.identity.language='en';speech.review.identity.language='en';},
    speech=>{speech.takeId='goodluck_2';speech.recording.identity.takeId='goodluck_2';speech.review.identity.takeId='goodluck_2';}]) {
    const f=fixture({speech:true}),draft=await f.save();f.changeState(state=>change(state.mediaRows[1].classification.recordedSpeech));const before=f.snapshot();
    await assert.rejects(f.publish(draft),{statusCode:422});assert.deepEqual(f.snapshot(),before);
  }
});

test('J08 foreign or stale snapshots and corrupted catalogues cannot publish',async()=>{
  for(const [change,statusCode] of [[snapshot=>snapshot.scope.workspaceId='other',409],
    [snapshot=>snapshot.administrationDocument.revision='old',409],[snapshot=>snapshot.runtimeCatalog.revision='f'.repeat(64),503]]) {
    const f=fixture(),draft=await f.save(),before=f.snapshot();f.changeCapture(change);
    await assert.rejects(f.publish(draft),{statusCode});assert.deepEqual(f.snapshot(),before);
  }
});

test('J08 media revision recheck and snapshot infrastructure failures roll back the entire publication',async()=>{
  const changed=fixture(),draft=await changed.save(),before=changed.snapshot();
  changed.changeMediaRead(row=>row.revision='replacement-revision');
  await assert.rejects(changed.publish(draft),{statusCode:409});assert.deepEqual(changed.snapshot(),before);
  const failed=fixture(),saved=await failed.save(),stable=failed.snapshot();failed.changeCapture(()=>{throw Error('injected snapshot read failure');});
  await assert.rejects(failed.publish(saved),/injected snapshot read failure/);assert.deepEqual(failed.snapshot(),stable);
  const unavailable=fixture({resolver:false});unavailable.changeCapture(()=>{throw Error('must not read material without resolver');});
  const closed=await unavailable.save();assert.equal(closed.publication.ready,false);await assert.rejects(unavailable.publish(closed),{statusCode:422});
});

test('J08 only accepted values, strict document draft and read query shapes survive validation',()=>{
  for(const language of ['en','sv'])for(const limitPreset of Object.keys(ROOM_LIMIT_PRESETS))assert.deepEqual(validateRoomGameConfig({language,limitPreset}),{language,limitPreset});
  for(const bad of [{language:'de',limitPreset:'prive'},{language:'sv',limitPreset:'custom'},{language:'sv',limitPreset:'prive',betMs:1}])assert.throws(()=>validateRoomGameConfig(bad));
  assert.throws(()=>validateDocumentValue('administration',{rooms:[],roomGameConfigs:[{roomId:'forged'}]},'r1'));
  assert.ok(studioAdminEndpoint('GET','/studio/api/admin/room-game-config'));assert.ok(studioAdminEndpoint('GET','/studio/api/admin/shared-table-proof'));
  for(const query of ['operatorId=north&roomId=r&roomId=other','operatorId=north&roomId=r&language=sv','operatorId=north','operatorId=north&roomId=../x'])assert.equal(isPresentationRoomReadQuery('GET',new URL('https://x.invalid/studio/api/admin/room-game-config?'+query)),false);
  assert.equal(isPresentationRoomReadQuery('POST',new URL('https://x.invalid/studio/api/admin/room-game-config?operatorId=north&roomId=r')),false);
});

test('J08 HTTP boundary preserves private reads, origin protection and package readiness descriptors',async()=>{
  const f=fixture(),origin='https://studio.invalid',transactions=[];
  const http=createStudioAdminApi({authorize:async()=>({...actor,scope}),allowedOrigins:[origin],publicHosts:['studio.invalid'],handlers:f.api.handlers,
    mutationTransaction:async(work,options)=>{transactions.push(options);return work();}});
  const path=origin+'/studio/api/admin/room-game-config';
  const read=await http.handle(new Request(path+'?operatorId=north&roomId=room-test'));
  assert.equal(read.status,200);assert.equal(read.headers.get('cache-control'),'private, no-store');assert.equal((await read.json()).draft,null);
  const request=body=>new Request(path,{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify(body)});
  const body={action:'save-draft',operatorId:'north',roomId:'room-test',expectedAdministrationRevision:'admin-1',expectedPackageRevision:1,gameConfig:{language:'sv',limitPreset:'casual'}};
  const draftResponse=await http.handle(request(body));assert.equal(draftResponse.status,200);const draft=await draftResponse.json();
  // Both writes declare the administration draft field so the v23 preflight runs before SQL.
  const drafts={kind:'administration',value:{roomGameConfigs:[]}};
  assert.deepEqual(transactions[0],{presentationDocuments:['project','administration'],presentationMutation:[drafts]});
  const publishBody={action:'publish',operatorId:'north',roomId:'room-test',expectedAdministrationRevision:draft.administrationRevision,expectedPackageRevision:1,expectedDraftRevision:draft.draft.revision};
  const forged=request(publishBody);forged.headers.set('origin','https://other.invalid');assert.equal((await http.handle(forged)).status,403);assert.equal(f.snapshot().packages.length,1);
  const published=await http.handle(request(publishBody));assert.equal(published.status,200);assert.equal((await published.json()).published.packageRevision,2);
  assert.deepEqual(transactions[1],{presentationDocuments:['project','administration'],presentationMutation:[drafts,{kind:'native-film-planning',value:{}}],presentationOperatorIds:['north']});
});

test('J08 native material dry-run refuses publication without a resolver and preserves the saved draft',async t=>{
  const provider=t.mock.method(globalThis,'fetch',()=>{throw Error('unexpected provider request');});
  for(const apiBase of ['/studio/api/admin','/api/admin']) {
    const f=fixture({resolver:false}),origin='https://studio.invalid',path=origin+apiBase+'/room-game-config';
    f.changeCapture(()=>{throw Error('material capture must not run without a resolver');});
    let identity={...actor,scope};
    const api=createStudioAdminApi({authorize:async()=>{
      if(!identity)throw Object.assign(Error('private authentication failure'),{statusCode:401});return identity;
    },allowedOrigins:[origin],publicHosts:['studio.invalid'],handlers:f.api.handlers,apiBase,mutationTransaction:async work=>work()});
    const native=createNativeStudioRequestHandlers({configuration:()=>({allowedOrigins:[origin,'https://game.invalid'],
      publicHosts:['studio.invalid','game.invalid'],apiBase,authBase:apiBase.replace('/admin','/auth')}),runtime:async()=>({api})});
    const request=(body,extra={})=>new Request(path,{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json',...extra},body:JSON.stringify(body)});
    const save={action:'save-draft',operatorId:'north',roomId:'room-test',expectedAdministrationRevision:'admin-1',expectedPackageRevision:1,gameConfig:{language:'sv',limitPreset:'casual'}};
    const saved=await native.handleNativeAdmin(request(save));assert.equal(saved.status,200);const draft=await saved.json();
    assert.deepEqual(draft.publication,{ready:false,reason:'studio_room_game_material_unavailable'});
    const before=f.snapshot(),read=await native.handleNativeAdmin(new Request(path+'?operatorId=north&roomId=room-test'));
    assert.equal(read.status,200);assert.equal(read.headers.get('cache-control'),'private, no-store');
    assert.deepEqual((await read.json()).publication,draft.publication);
    const publish={action:'publish',operatorId:'north',roomId:'room-test',expectedAdministrationRevision:draft.administrationRevision,
      expectedPackageRevision:1,expectedDraftRevision:draft.draft.revision};
    const traceBefore=f.trace.length;
    identity=null;assert.equal((await native.handleNativeAdmin(request(publish))).status,401);
    identity={user:'partner',role:'partner',scope};assert.equal((await native.handleNativeAdmin(request(publish))).status,403);
    identity={...actor,scope};assert.equal((await native.handleNativeAdmin(request(publish,{origin:'https://other.invalid'}))).status,403);
    assert.equal(f.trace.length,traceBefore,'auth/origin rejection happens before any repository reads');
    const denied=await native.handleNativeAdmin(request(publish));assert.equal(denied.status,422);
    assert.deepEqual(await denied.json(),{error:'studio_room_game_material_unavailable',code:'studio_room_game_material_unavailable'});
    assert.equal(denied.headers.get('cache-control'),'private, no-store');
    assert.deepEqual(f.snapshot(),before,'package, config, head, audit and saved draft remain unchanged');
    assert.equal(f.trace.some(marker=>marker?.startsWith('material:')||marker==='operator-store:publish-package'||marker==='operator-store:room-config-insert'),false);
  }
  assert.equal(provider.mock.callCount(),0);
});

test('J08 public material error is restricted to its action, status and fixed code',async()=>{
  const origin='https://studio.invalid',materialCode='studio_room_game_material_unavailable';
  for(const [action,statusCode,code,expected] of [
    ['room-game-config',422,materialCode,{error:materialCode,code:materialCode}],
    ['room-game-config',422,'private_internal_code',{error:'Invalid data'}],
    ['room-game-config',503,materialCode,{error:'Action unavailable'}],
    ['tier',422,materialCode,{error:'Invalid data'}],
  ]) {
    const path='/studio/api/admin/'+action;
    const api=createStudioAdminApi({authorize:async()=>({...actor,scope}),allowedOrigins:[origin],publicHosts:['studio.invalid'],
      handlers:new Map([['POST '+path,()=>{throw Object.assign(Error('private database detail'),{statusCode,code,detail:'private provider detail'});}]]),mutationTransaction:async work=>work()});
    const response=await api.handle(new Request(origin+path,{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json'},body:'{}'}));
    assert.equal(response.status,statusCode);assert.deepEqual(await response.json(),expected);
  }
});
