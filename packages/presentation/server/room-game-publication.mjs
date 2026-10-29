import {createHash,randomUUID} from 'node:crypto';
import {canonicalStudioJson,cloneStudioJson,validateDocumentValue,validateStudioMedia,StudioStorageError} from '../../studio-registry/server/document-contract.mjs';
import {resolveRoomBranding} from '../../operators/contracts/branding.mjs';
import {isPresentationRoom,roomGame} from '../contracts/presentation-room.mjs';
import {validateRoomGameConfig,validateRoomGameMaterial,ROOM_GAME_TIMERS,ROOM_LIMIT_PRESETS} from '../contracts/room-game-config.mjs';
import {recordedSpeechForVideo} from '../contracts/recorded-speech.mjs';
import {withoutPresentationLanes} from '../contracts/retained-presentation.mjs';
import {readPackagePresentation,publicPackageBranding,resolvePackageRoomDealer} from './presentation-package.mjs';
import {resolveNativeRoomGameMaterial} from './native-room-game-material.mjs';
import {assertNativeFilmedPlanningReady} from './native-filmed-readiness-context.mjs';
import {isNativeRoomMaterial,nativeRoomMaterialVersion} from '../contracts/native-room-filmed-planning.mjs';

const bindingKey='roomGameConfigVersions';
const configId=value=>typeof value==='string'&&/^room-config-[a-f0-9-]{36}$/.test(value);
const roomId=value=>typeof value==='string'&&/^[a-z0-9_-]{1,128}$/.test(value)&&!['constructor','prototype','__proto__'].includes(value);
const same=(a,b)=>canonicalStudioJson(a)===canonicalStudioJson(b);
const hash=value=>createHash('sha256').update(canonicalStudioJson(value)).digest('hex');
const fail=(code='studio_room_game_material_unavailable',status=422)=>{throw new StudioStorageError(code,status);};
const conflict=()=>fail('studio_conflict',409);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const stored=value=>{try{return typeof value==='string'?JSON.parse(value):value;}catch{fail('studio_corrupt_room_game_config',503);}};

export function roomGameLockKeys(id) {
  if(!roomId(id))fail('studio_invalid_data',422);
  const bytes=createHash('sha256').update(`croupier-shared-table\0room\0${id}`).digest();
  return [bytes.readInt32BE(0),bytes.readInt32BE(4)];
}

/** One predicate for publication and game access. The material is bound to the
 * actual immutable package, never a browser's requested dealer or revision. */
export function assertPublishedRoomGameConfig(value,{version,pack,room,presentation=readPackagePresentation(pack),dealerId=resolvePackageRoomDealer(pack,room,presentation)}={}) {
  if(!value||value.configVersion!==version||value.roomId!==room?.id||value.operatorId!==room?.operatorId
    ||value.presentationLaneId!==room.presentationLaneId||!Number.isSafeInteger(value.packageRevision)
    ||value.packageRevision<1||value.packageRevision>pack?.revision||!dealerId
    ||value.presentationHash!==hash(presentation))fail();
  const selected=validateRoomGameConfig({language:value.language,limitPreset:value.limitPreset});
  const preset=ROOM_LIMIT_PRESETS[selected.limitPreset];
  const material=validateRoomGameMaterial(value.material,{language:selected.language,dealerId});
  if(isNativeRoomMaterial(material)
    &&!same(material,resolveNativeRoomGameMaterial({package:pack,room,language:selected.language},{version:nativeRoomMaterialVersion(material)})))fail();
  const captured=[...(presentation.playback?.media??[]),...(presentation.registeredDealers??[]).flatMap(row=>row.idle?[row.idle]:[])];
  for(const ref of material.media) {
    const record=captured.find(row=>row.id===ref.id&&row.sha256===ref.sha256&&row.classification?.dealerId===dealerId);
    if(!record||record.classification.archived===true||record.deletion)fail();
    if(record.classification.kind==='speech'&&!recordedSpeechForVideo(record,{dealerId,language:selected.language,
      lineId:record.classification.situation,takeId:record.classification.recordedSpeech?.takeId}))fail();
  }
  if(value.betMs!==ROOM_GAME_TIMERS.betMs||value.actionMs!==ROOM_GAME_TIMERS.actionMs
    ||!same(value.limits,{min:preset.min,max:preset.max,sideMax:preset.sideMax})||!same(value.chips,preset.chips)
    ||value.refill!==preset.refill||value.leadMs!==material.leadMs||value.cardMs!==material.cardMs)fail();
  return value;
}

function bindings(branding) {
  const value=branding?.[bindingKey]??{};
  if(!plain(value)||Object.keys(value).length>256||Object.entries(value).some(([id,version])=>!roomId(id)||!configId(version)))fail('studio_invalid_data',422);
  return structuredClone(value);
}
// Keep the same per-room resolution as launch. Other rooms' overrides and the
// server-owned config map cannot make an unchanged room rotate its head.
function effect(pack,room,presentation) {
  const lane=presentation?.lanes.find(row=>row.id===room.presentationLaneId);
  if(!lane)fail();
  const saved=publicPackageBranding(pack.branding),branding={...saved};
  for(const key of ['lane','dealer','table','background','color','roomOverrides',bindingKey])delete branding[key];
  if((saved.lane??presentation.lanes[0].id)!==lane.id)delete branding.tableColor;
  Object.assign(branding,resolveRoomBranding({lane:presentation.lanes[0].id,...saved},room.id,lane.id));
  return {presentationHash:hash(presentation),dealerId:resolvePackageRoomDealer(pack,room,presentation),branding};
}
function unchangedRetainedPresentation(previous,next,room) {
  if(!next?.lanes.some(lane=>lane.id===room.presentationLaneId))return false;
  const kept=new Set(next.lanes.map(lane=>lane.id)),removed=previous.lanes.filter(lane=>!kept.has(lane.id)).map(lane=>lane.id);
  return removed.length>0&&same(withoutPresentationLanes(previous,removed),next);
}
function configBody({room,pack,presentation,gameConfig,material}) {
  const selected=validateRoomGameConfig(gameConfig),preset=ROOM_LIMIT_PRESETS[selected.limitPreset];
  const dealerId=resolvePackageRoomDealer(pack,room,presentation);
  material=validateRoomGameMaterial(material,{dealerId,language:selected.language});
  if(nativeRoomMaterialVersion(material)===2)assertNativeFilmedPlanningReady();
  const value={configVersion:`room-config-${randomUUID()}`,roomId:room.id,operatorId:room.operatorId,packageRevision:pack.revision,
    presentationLaneId:room.presentationLaneId,presentationHash:hash(presentation),...selected,...ROOM_GAME_TIMERS,
    limits:{min:preset.min,max:preset.max,sideMax:preset.sideMax},chips:[...preset.chips],refill:preset.refill,
    leadMs:material.leadMs,cardMs:material.cardMs,material};
  return assertPublishedRoomGameConfig(value,{version:value.configVersion,pack,room,presentation,dealerId});
}

/** Runs only on the operator publication's existing scoped transaction/client.
 * No game window, history, provider or ledger is changed. An explicit J08
 * replacement is a separate server method, never a flag in package input. */
export async function prepareRoomGamePublication({query,decodePackage,current,next,replacement=null}={}) {
  if(typeof query!=='function'||typeof decodePackage!=='function')throw new TypeError('Scoped publication ports required');
  const previous=bindings(current?.branding),incoming=bindings(next.branding);
  // Detach the server method's already validated payload before SQL awaits.
  replacement=replacement===null?null:cloneStudioJson(replacement);
  if(replacement!==null&&(!plain(replacement)||Object.keys(replacement).sort().join(',')!=='gameConfig,material,roomId'
    ||!roomId(replacement.roomId)))fail('studio_invalid_data',422);
  if(replacement)validateRoomGameConfig(replacement.gameConfig);
  const retained=new Set(next.tables);
  for(const [id,version] of Object.entries(incoming))if(previous[id]!==version)fail('studio_forbidden',403);
  for(const [id,version] of Object.entries(previous))if(retained.has(id)&&incoming[id]!==version)fail('studio_forbidden',403);
  if(!Object.keys(previous).length&&!replacement)return {branding:next.branding,configs:[]};

  const documents=await query(`/* operator-store:room-config-administration */ SELECT revision,value FROM croupier_studio.documents
    WHERE environment_id=$1 AND workspace_id=$2 AND kind=$3`,['administration']);
  if(documents.length!==1)fail('studio_document_missing',503);
  const administration=validateDocumentValue('administration',stored(documents[0].value),documents[0].revision,{allowLegacyRead:true});
  const roomRows=administration.rooms??[],map={};
  const ids=[...new Set([...Object.keys(previous).filter(id=>retained.has(id)),...(replacement?[replacement.roomId]:[])])].sort();
  for(const id of ids)await query(`/* operator-store:room-config-lock */ SELECT pg_advisory_xact_lock($3::integer,$4::integer)
    WHERE $1::text IS NOT NULL AND $2::text IS NOT NULL`,roomGameLockKeys(id));
  const presentation=readPackagePresentation(next),configs=[],media=new Map(),packages=new Map(current?[[current.revision,current]]:[]);
  for(const id of ids) {
    const matches=roomRows.filter(room=>room?.id===id),room=matches.length===1?matches[0]:null;
    // A paused room (plan L3 PR 3: a pause is a package revision) keeps its published settings as
    // they are; nobody plays it, and reopening it publishes again and checks them then.
    const paused=room?.state==='pending'&&replacement?.roomId!==id;
    if(!isPresentationRoom(room)||roomGame(room)!=='blackjack'||room.state!=='live'&&!paused||room.operatorId!==next.operatorId
      ||!retained.has(id)||!next.games.includes('blackjack')||!next.lanes.includes(room.presentationLaneId))conflict();
    const heads=await query(`/* operator-store:room-config-current */ SELECT h.version,c.body
      FROM croupier_game.shared_table_config_heads h LEFT JOIN croupier_game.shared_table_configs c
      ON c.room_id=h.room_id AND c.version=h.version
      WHERE $1::text IS NOT NULL AND $2::text IS NOT NULL AND h.room_id=$3`,[id]);
    if(heads.length>1||previous[id]&&(heads.length!==1||heads[0].version!==previous[id]))conflict();
    const expectedVersion=heads[0]?.version??null;
    if(paused){map[id]=expectedVersion;continue;}
    let body;
    if(replacement?.roomId===id) {
      if(expectedVersion!==null) {
        const prior=stored(heads[0].body);
        if(!prior||prior.configVersion!==expectedVersion||prior.roomId!==id||prior.operatorId!==next.operatorId)conflict();
      }
      body=configBody({room,pack:next,presentation,gameConfig:replacement.gameConfig,material:replacement.material});
    } else {
      const existing=stored(heads[0]?.body);
      if(!existing||!configId(expectedVersion)||!Number.isSafeInteger(existing.packageRevision)
        ||existing.packageRevision<1||existing.packageRevision>current.revision)conflict();
      let source=packages.get(existing.packageRevision);
      if(!source) {
        const rows=await query(`/* operator-store:package-by-revision */ SELECT environment_id,workspace_id,operator_id,package_revision,lanes,games,tables,branding,published_at_ms
          FROM croupier_studio.operator_packages WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 AND package_revision=$4`,[next.operatorId,existing.packageRevision]);
        if(rows.length!==1)conflict();
        source=decodePackage(rows[0]);packages.set(source.revision,source);
      }
      if(source.operatorId!==next.operatorId||source.revision!==existing.packageRevision||!source.tables.includes(id))conflict();
      const oldPresentation=readPackagePresentation(source),dealerId=resolvePackageRoomDealer(source,room,oldPresentation);
      assertPublishedRoomGameConfig(existing,{version:expectedVersion,pack:source,room,presentation:oldPresentation,dealerId});
      if(same(effect(source,room,oldPresentation),effect(next,room,presentation))) {map[id]=expectedVersion;continue;}
      let material=existing.material;
      if(isNativeRoomMaterial(material))material=resolveNativeRoomGameMaterial({package:next,room,language:existing.language},{version:nativeRoomMaterialVersion(material)});
      else if(dealerId!==resolvePackageRoomDealer(next,room,presentation)
        ||hash(oldPresentation)!==hash(presentation)&&!unchangedRetainedPresentation(oldPresentation,presentation,room))fail();
      body=configBody({room,pack:next,presentation,gameConfig:{language:existing.language,limitPreset:existing.limitPreset},material});
    }
    const captured=[...(presentation.playback?.media??[]),...(presentation.registeredDealers??[]).flatMap(row=>row.idle?[row.idle]:[])];
    for(const ref of body.material.media) {
      const frozen=captured.find(row=>row.id===ref.id&&row.sha256===ref.sha256&&row.classification?.dealerId===body.material.dealerId);
      if(!frozen)fail();
      const checked=validateStudioMedia(frozen);
      if(media.has(ref.id)&&!same(media.get(ref.id),checked))fail();
      media.set(ref.id,checked);
    }
    map[id]=body.configVersion;configs.push({roomId:id,expectedVersion,body});
  }
  if(media.size) {
    const rows=await query(`/* operator-store:room-config-media */ SELECT id,record FROM croupier_studio.media_records
      WHERE environment_id=$1 AND workspace_id=$2 AND id=ANY($3::uuid[])`,[[...media.keys()]]);
    if(rows.length!==media.size||new Set(rows.map(row=>row.id)).size!==rows.length)fail();
    for(const row of rows) {
      const record=validateStudioMedia(stored(row.record)),expected=media.get(row.id);
      if(!expected||record.id!==row.id||record.deletion||record.classification.archived===true||!same(record,expected))fail();
    }
  }
  const branding=structuredClone(next.branding);
  if(Object.keys(map).length)branding[bindingKey]=map;else delete branding[bindingKey];
  return {branding,configs};
}

export async function writeRoomGamePublication(query,plan,packageRevision) {
  for(const {roomId,expectedVersion,body} of plan.configs) {
    if(body.packageRevision!==packageRevision)conflict();
    await query(`/* operator-store:room-config-insert */ INSERT INTO croupier_game.shared_table_configs(room_id,version,body)
      SELECT $3,$4,$5 WHERE $1::text IS NOT NULL AND $2::text IS NOT NULL`,[roomId,body.configVersion,canonicalStudioJson(body)]);
    const rows=await query(`/* operator-store:room-config-head */ INSERT INTO croupier_game.shared_table_config_heads(room_id,version)
      SELECT $3,$4 WHERE $1::text IS NOT NULL AND $2::text IS NOT NULL AND ($5::text IS NULL OR EXISTS
        (SELECT 1 FROM croupier_game.shared_table_config_heads WHERE room_id=$3 AND version=$5))
      ON CONFLICT(room_id) DO UPDATE SET version=EXCLUDED.version WHERE croupier_game.shared_table_config_heads.version=$5
      RETURNING version`,[roomId,body.configVersion,expectedVersion]);
    if(rows.length!==1||rows[0].version!==body.configVersion)conflict();
  }
}
