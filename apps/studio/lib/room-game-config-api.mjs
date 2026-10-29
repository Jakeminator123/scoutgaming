import {randomUUID} from 'node:crypto';
import {createOperatorStore} from '../../../packages/operators/server/operator-store.mjs';
import {isAdministratorRole} from '../../../packages/studio-access/account-role.mjs';
import {canonicalStudioJson,validateRevision,validateStudioScope,validateStudioMedia,StudioStorageError} from '../../../packages/studio-registry/server/document-contract.mjs';
import {validateRuntimeCatalogRecord} from '../../../packages/studio-registry/server/runtime-catalog.mjs';
import {isPresentationRoom,roomGame} from '../../../packages/presentation/contracts/presentation-room.mjs';
import {readPackagePresentation,resolvePackageRoomDealer} from '../../../packages/presentation/server/presentation-package.mjs';
import {assertCapturedPresentationMedia} from '../../../packages/presentation/server/frozen-presentation-capture.mjs';
import {recordedSpeechForVideo} from '../../../packages/presentation/contracts/recorded-speech.mjs';
import {resolvePackageRoom} from '../../../packages/presentation/server/package-rooms.mjs';
import {validateRoomGameConfig,validateRoomGameDrafts,validateRoomGameMaterial,ROOM_GAME_TIMERS} from '../../../packages/presentation/contracts/room-game-config.mjs';
import {operatorAuditContext} from './operator-audit-context.mjs';
import {isRoomGameConfigReadQuery} from './studio-admin-contract.mjs';

const fail=(code='studio_room_game_config_rejected',status=422)=>{throw new StudioStorageError(code,status);};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
const bindingKey='roomGameConfigVersions';
// Samma standardval som Admin (room-game-config-client.mjs ROOM_GAME_DEFAULTS).
const ROOM_GAME_FALLBACK=Object.freeze({language:'en',limitPreset:'prive'});
const materialReasons=new Set(['native_material_bank_incomplete','native_material_contract_unsupported','native_material_dealer_missing',
  'native_material_frozen_v3_required','native_material_idle_missing','native_material_invalid_publication','native_material_measurement_mismatch',
  'native_material_measurement_missing','native_material_media_limit','native_material_profile_missing','native_material_room_mismatch',
  'native_material_size_mismatch','native_material_slot_unsupported','native_material_speech_pose_unsupported','native_material_speech_slot_missing',
  'native_material_speech_timing_mismatch','native_material_speech_unbound','native_material_take_audio_truncated','native_material_take_mismatch',
  'native_material_take_unrecognized','native_material_timing_limit','native_material_transition_pose_missing','native_material_video_unavailable']);
// Den fasta listan av materialskäl som får visas (delas med room-release.mjs).
export const isRoomGameMaterialReason=value=>typeof value==='string'&&materialReasons.has(value);
function intent(value) {
  const common=['action','operatorId','roomId','expectedAdministrationRevision','expectedPackageRevision'];
  if(!exact(value,[...common,...(value?.action==='save-draft'?['gameConfig']:['expectedDraftRevision'])])||!['save-draft','publish'].includes(value.action)
    ||!id(value.operatorId)||!id(value.roomId)||!Number.isSafeInteger(value.expectedPackageRevision)||value.expectedPackageRevision<1)fail();
  validateRevision(value.expectedAdministrationRevision);
  if(value.action==='save-draft')validateRoomGameConfig(value.gameConfig);
  else if(typeof value.expectedDraftRevision!=='string'||!/^room-config-[a-f0-9-]{36}$/.test(value.expectedDraftRevision))fail();
  return structuredClone(value);
}
export function createRoomGameConfigApi({repository,scope,resolveMaterial=null,now=Date.now}={}) {
  scope=validateStudioScope(scope);
  if(!repository?.transaction||!repository?.withTransactionClient||!repository?.saveDocument||canonicalStudioJson(scope)!==canonicalStudioJson(repository.scope))fail('studio_storage_unavailable',503);
  const params=[scope.environment,scope.workspaceId],handlers=new Map();
  function trusted(context) {
    if(!isAdministratorRole(context.actor?.role)||typeof context.actor?.user!=='string'||!context.actor.user
      ||canonicalStudioJson(context.scope)!==canonicalStudioJson(scope))fail('studio_forbidden',403);
  }
  async function snapshot(client,operatorId,roomId) {
    const operators=await createOperatorStore({sql:client,scope,now,transaction:work=>repository.withTransactionClient(work)});
    const operator=await operators.getOperatorById(operatorId);
    if(!operator||operator.status!=='active')fail('studio_room_not_found',404);
    const document=await repository.readDocument('administration');
    if(!document)fail('studio_storage_unavailable',503);
    const administration=document.value,pack=await operators.getCurrentPackage(operatorId);
    const room=administration.rooms?.find(row=>row.id===roomId);
    if(!isPresentationRoom(room)||roomGame(room)!=='blackjack'||room.operatorId!==operatorId||room.state!=='live'
      ||!resolvePackageRoom({administration,package:pack,operatorId,roomId}))fail('studio_room_not_found',404);
    const drafts=validateRoomGameDrafts(administration.roomGameConfigs??[],administration.rooms),draft=drafts.find(row=>row.roomId===roomId)??null;
    const presentation=readPackagePresentation(pack),lane=presentation?.lanes.find(row=>row.id===room.presentationLaneId);
    if(!lane)fail('studio_room_not_found',404);
    return {operators,operator,document,administration,pack,room,drafts,draft,presentation,lane};
  }
  async function material(saved,gameConfig) {
    if(typeof resolveMaterial!=='function')return {ready:false,reason:'studio_room_game_material_unavailable'};
    try {
      if(typeof repository.readPresentationSnapshot!=='function')fail('studio_storage_unavailable',503);
      // Nested snapshot reads reuse this transaction's scope-locked client. Registry
      // writers and runtime-catalog import share that lock; no provider I/O belongs here.
      const snapshot=await repository.readPresentationSnapshot();
      if(canonicalStudioJson(validateStudioScope(snapshot.scope))!==canonicalStudioJson(scope))fail('studio_scope_mismatch',409);
      if(snapshot.administrationDocument?.revision!==saved.document.revision)fail('studio_conflict',409);
      const capturedCatalog=validateRuntimeCatalogRecord(snapshot.runtimeCatalog);
      const dealerId=resolvePackageRoomDealer(saved.pack,saved.room,saved.presentation);
      if(!dealerId)fail('studio_room_game_material_unavailable',422);
      const value=validateRoomGameMaterial(await resolveMaterial({room:structuredClone(saved.room),package:structuredClone(saved.pack),
        language:gameConfig.language,capturedCatalog:structuredClone(capturedCatalog)}),{language:gameConfig.language,dealerId});
      const captured=[...(saved.presentation.playback?.media??[]),...(saved.presentation.registeredDealers??[]).flatMap(row=>row.idle?[row.idle]:[])];
      const preconditions=value.media.map(ref=>{
        const frozen=captured.find(row=>row.id===ref.id&&row.sha256===ref.sha256&&row.classification?.dealerId===value.dealerId);
        const registered=snapshot.mediaRows?.find(row=>row.id===ref.id);
        if(!frozen||!registered)fail('studio_room_game_material_unavailable',422);
        const {revision,updatedAt,...input}=registered,record=validateStudioMedia(input);
        if(record.deletion||record.classification.archived===true||canonicalStudioJson(record)!==canonicalStudioJson(validateStudioMedia(frozen)))fail('studio_room_game_material_unavailable',422);
        if(record.classification.kind==='speech'&&!recordedSpeechForVideo(record,{dealerId:value.dealerId,language:gameConfig.language,
          lineId:frozen.classification.situation,takeId:frozen.classification.recordedSpeech?.takeId}))fail('studio_room_game_material_unavailable',422);
        return {id:record.id,revision:validateRevision(revision),record};
      });
      await assertCapturedPresentationMedia(repository,preconditions);
      return {ready:true,material:value};
    } catch(error) {
      if(error?.statusCode===422)return {ready:false,reason:'studio_room_game_material_unavailable',
        ...(error.code==='studio_room_game_material_unavailable'&&materialReasons.has(error.reason)?{materialReason:error.reason}:{})};
      throw error;
    }
  }
  async function publishedConfig(client,saved) {
    const version=saved.pack.branding?.[bindingKey]?.[saved.room.id];let published=null;
    if(version!==undefined) {
      if(typeof version!=='string')fail('studio_corrupt_room_game_config',503);
      const result=await client.query('/* room-game-config:read-published */ SELECT body FROM croupier_game.shared_table_configs WHERE $1::text IS NOT NULL AND $2::text IS NOT NULL AND room_id=$3 AND version=$4',[...params,saved.room.id,version]);
      const frozen=result.rows[0]?.body;let value;try{value=typeof frozen==='string'?JSON.parse(frozen):frozen;}catch{fail('studio_corrupt_room_game_config',503);}
      if(!value||value.configVersion!==version||value.operatorId!==saved.operator.id||value.roomId!==saved.room.id)fail('studio_corrupt_room_game_config',503);
      published={configVersion:version,packageRevision:value.packageRevision,gameConfig:validateRoomGameConfig({language:value.language,limitPreset:value.limitPreset}),...ROOM_GAME_TIMERS};
    }
    return published;
  }
  // Utkastet är ett mellansteg (enkel väg §3, klass C): utan utkast prövas materialet för det
  // som Publicera sparar, det publicerade valet eller standardvalen. Efter en publicering är
  // materialet för det publicerade valet nyss prövat (`checked`), så det läses inte om.
  async function receipt(client,saved,checked=null) {
    const published=await publishedConfig(client,saved);
    const available=checked??await material(saved,saved.draft?.gameConfig??published?.gameConfig??ROOM_GAME_FALLBACK);
    return {ok:true,roomId:saved.room.id,operatorId:saved.operator.id,administrationRevision:saved.document.revision,packageRevision:saved.pack.revision,
      draft:saved.draft?{revision:saved.draft.revision,gameConfig:saved.draft.gameConfig}:null,published,
      publication:{ready:available.ready,...(available.reason?{reason:available.reason}:{}),...(available.materialReason?{materialReason:available.materialReason}:{})}};
  }
  handlers.set('GET /studio/api/admin/room-game-config',async context=>{
    trusted(context);const url=new URL(context.request.url);
    if(!isRoomGameConfigReadQuery('GET',url))fail('studio_invalid_data',400);
    return repository.transaction(()=>repository.withTransactionClient(async client=>receipt(client,await snapshot(client,url.searchParams.get('operatorId'),url.searchParams.get('roomId')))));
  });
  // Admin och Partnerportalen skriver med samma kod. Admins väg kontrollerar
  // administrationsdokumentets revision; partnerns väg (partner-table-api.mjs)
  // ser inte det dokumentet och skickar i stället `guard`, som läser om
  // behörighet och tilldelning och kontrollerar utkastets revision inne i
  // transaktionen, efter att spelbordet visats höra till bolaget.
  async function write(client,body,actor,guard=null) {
    // The scope lock protects draft intent. The shared publication writer
    // takes the operator lock then ordered room locks and rechecks all material.
    const saved=await snapshot(client,body.operatorId,body.roomId);
    if(guard)await guard({...saved,published:await publishedConfig(client,saved)});
    else if(saved.document.revision!==body.expectedAdministrationRevision)fail('studio_conflict',409);
    if(saved.pack.revision!==body.expectedPackageRevision)fail('studio_conflict',409);
    if(body.action==='save-draft') {
      const row={roomId:body.roomId,operatorId:body.operatorId,revision:`room-config-${randomUUID()}`,basePackageRevision:saved.pack.revision,gameConfig:validateRoomGameConfig(body.gameConfig)};
      const drafts=[...saved.drafts.filter(row=>row.roomId!==body.roomId),row];
      const document=await repository.saveDocument('administration',{value:{...saved.administration,roomGameConfigs:drafts},expectedRevision:saved.document.revision,actor:actor.user});
      return receipt(client,{...saved,document,drafts,draft:row});
    }
    if(!saved.draft||saved.draft.revision!==body.expectedDraftRevision||saved.draft.basePackageRevision!==saved.pack.revision)fail('studio_conflict',409);
    const resolved=await material(saved,saved.draft.gameConfig);
    if(!resolved.ready)fail(resolved.reason,422);
    const {package:pack}=await saved.operators.publishRoomGameConfig({actor:actor.user,audit:actor.audit,operatorId:body.operatorId,expectedRevision:body.expectedPackageRevision,
      lanes:saved.pack.lanes,games:saved.pack.games,tables:saved.pack.tables,branding:saved.pack.branding},
      {roomId:body.roomId,gameConfig:saved.draft.gameConfig,material:resolved.material});
    const drafts=saved.drafts.filter(row=>row.roomId!==body.roomId);
    const document=await repository.saveDocument('administration',{value:{...saved.administration,roomGameConfigs:drafts},expectedRevision:saved.document.revision,actor:actor.user});
    return receipt(client,{...saved,pack,document,drafts,draft:null},{ready:true});
  }
  handlers.set('POST /studio/api/admin/room-game-config',async context=>{
    trusted(context);const body=intent(context.body);
    return repository.transaction(()=>repository.withTransactionClient(client=>write(client,body,{user:context.actor.user,audit:operatorAuditContext(context.actor)})));
  });
  // Partnerportalens väg: anroparen äger transaktionen, sessionen och bolaget.
  return Object.freeze({handlers,
    writeRoom:(client,body,actor,guard)=>{if(typeof guard!=='function')fail('studio_forbidden',403);return write(client,body,actor,guard);}});
}
