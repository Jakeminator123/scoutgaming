import {createHash} from 'node:crypto';
import {createOperatorStore} from '../../packages/operators/server/operator-store.mjs';
import {createGameEntrySelector} from '../../packages/presentation/server/game-entry-selector.mjs';
import {readPackagePresentation,resolvePackageRoomDealer} from '../../packages/presentation/server/presentation-package.mjs';
import {resolveNativeRoomGameMaterial,NATIVE_ROOM_MATERIAL_PREFIX} from '../../packages/presentation/server/native-room-game-material.mjs';
import {isPresentationRoom,roomGame} from '../../packages/presentation/contracts/presentation-room.mjs';
import {isGameLaneId} from '../../packages/presentation/contracts/game-lane-id.mjs';
import {recordedSpeechForVideo} from '../../packages/presentation/contracts/recorded-speech.mjs';
import {validateRoomGameConfig,validateRoomGameMaterial,ROOM_GAME_TIMERS,ROOM_LIMIT_PRESETS} from '../../packages/presentation/contracts/room-game-config.mjs';
import {canonicalStudioJson,validateStudioScope,StudioStorageError} from '../../packages/studio-registry/server/document-contract.mjs';

const deny=()=>{throw new StudioStorageError('studio_forbidden',403);};
const unavailable=()=>{throw new StudioStorageError('studio_storage_unavailable',503);};
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const keys=['actorId','sessionId','operatorId','roomId','packageRevision','expiresAt'];
const same=(a,b)=>canonicalStudioJson(a)===canonicalStudioJson(b);
const aborted=signal=>{if(signal?.aborted)throw signal.reason??new DOMException('Aborted','AbortError');};
function session(value,now) {
  // Legacy partner keys have no canonical operator/room grant. This new demo
  // channel rejects them; the existing Partner HTTP/table paths are untouched.
  if(!value||!Object.hasOwn(value,'partnerKeyId')||value.partnerKeyId!==null
    ||!id(value.actorId)||!/^player-[a-f0-9]{64}$/.test(value.sessionId)
    ||!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=now())deny();
  return {actorId:value.actorId,sessionId:value.sessionId,expiresAt:value.expiresAt};
}
function configMatches(value,{version,pack,room,presentation,dealerId}) {
  if(!value||value.configVersion!==version||value.roomId!==room.id||value.operatorId!==room.operatorId
    ||value.presentationLaneId!==room.presentationLaneId||!Number.isSafeInteger(value.packageRevision)
    ||value.packageRevision<1||value.packageRevision>pack.revision
    ||value.presentationHash!==createHash('sha256').update(canonicalStudioJson(presentation)).digest('hex'))deny();
  // Branding-only publications retain the original config version/revision.
  // Never equate a currently open round with a newly published config here.
  try {
    const selected=validateRoomGameConfig({language:value.language,limitPreset:value.limitPreset});
    const preset=ROOM_LIMIT_PRESETS[selected.limitPreset];
    const material=validateRoomGameMaterial(value.material,{language:selected.language,dealerId});
    if(material.revision.startsWith(NATIVE_ROOM_MATERIAL_PREFIX)
      && !same(material,resolveNativeRoomGameMaterial({package:pack,room,language:selected.language})))deny();
    const captured=[...(presentation.playback?.media??[]),...(presentation.registeredDealers??[]).flatMap(row=>row.idle?[row.idle]:[])];
    for(const ref of material.media) {
      const record=captured.find(row=>row.id===ref.id&&row.sha256===ref.sha256&&row.classification?.dealerId===dealerId);
      if(!record||record.classification.archived===true||record.deletion)deny();
      if(record.classification.kind==='speech'&&!recordedSpeechForVideo(record,{dealerId,language:selected.language,
        lineId:record.classification.situation,takeId:record.classification.recordedSpeech?.takeId}))deny();
    }
    if(value.betMs!==ROOM_GAME_TIMERS.betMs||value.actionMs!==ROOM_GAME_TIMERS.actionMs
      ||!same(value.limits,{min:preset.min,max:preset.max,sideMax:preset.sideMax})||!same(value.chips,preset.chips)
      ||value.refill!==preset.refill||value.leadMs!==material.leadMs||value.cardMs!==material.cardMs)deny();
  } catch(error) {if(error?.statusCode===422)deny();throw error;}
}

/** Read-only authorization for createSharedRoomChannel, not an installed route.
 * The existing repository owns its scoped lock, SQL client and bounded waits.
 * Construction performs no I/O. No bearer, cache, inferred grants or provider
 * access is retained. Only the room id comes from the channel's strict path.
 */
export function createSharedRoomAccess({auth,commandAuth,repository,scope,now=Date.now}={}) {
  scope=validateStudioScope(scope);
  if(typeof now!=='function'||!auth||typeof auth.binding!=='function'||typeof auth.bindingById!=='function'
    ||!repository||!['transaction','withTransactionClient','readDocument'].every(key=>typeof repository[key]==='function')
    ||!same(scope,validateStudioScope(repository.scope)))throw new TypeError('Explicit scoped room access required');
  const parameters=[scope.environment,scope.workspaceId];
  async function current(roomId,signal) {
    aborted(signal);
    return repository.transaction(()=>repository.withTransactionClient(async client=>{
      aborted(signal);
      const sql={async query(text,values){aborted(signal);const result=await client.query(text,values);aborted(signal);return result;}};
      const document=await repository.readDocument('administration');aborted(signal);
      if(!document||!Array.isArray(document.value?.rooms))unavailable();
      const administration=document.value,rooms=administration.rooms.filter(row=>row?.id===roomId);
      if(rooms.length>1)unavailable();
      const room=rooms[0];
      if(!isPresentationRoom(room)||roomGame(room)!=='blackjack'||room.state!=='live')deny();
      const operators=await createOperatorStore({sql,scope,now});
      const operator=await operators.getOperatorById(room.operatorId);
      if(!operator||operator.status!=='active')deny();
      const pack=await operators.getCurrentPackage(operator.id);
      if(!pack||!pack.games.includes('blackjack'))deny();
      const select=createGameEntrySelector({game:'blackjack',log:()=>{},
        policy:{readSaved:async()=>({administration,project:{}}),readGameConfiguration:()=>unavailable()},
        packages:{resolve:async()=>({operator,package:pack})}});
      const entry=await select(new URLSearchParams({operator:operator.slug,table:roomId}));
      if(entry.status!==200||entry.selection?.roomId!==roomId||entry.selection.packageRevision!==pack.revision)deny();
      const presentation=readPackagePresentation(pack);
      if(!presentation)deny();
      const dealerId=resolvePackageRoomDealer(pack,room,presentation);
      if(!dealerId||entry.selection.dealer!==dealerId)deny();
      const version=pack.branding?.roomGameConfigVersions?.[roomId];
      if(typeof version!=='string'||!/^room-config-[a-f0-9-]{36}$/.test(version))deny();
      // These are the existing ConfigPort tables. Read head + frozen body on
      // this same scoped client, without starting or modifying a game window.
      const result=await sql.query(`/* shared-room-access:config */ SELECT h.version,c.body
        FROM croupier_game.shared_table_config_heads h LEFT JOIN croupier_game.shared_table_configs c
        ON c.room_id=h.room_id AND c.version=h.version
        WHERE $1::text IS NOT NULL AND $2::text IS NOT NULL AND h.room_id=$3`,[...parameters,roomId]);
      if(result.rows.length!==1||result.rows[0].version!==version)deny();
      let config;try{config=typeof result.rows[0].body==='string'?JSON.parse(result.rows[0].body):result.rows[0].body;}catch{unavailable();}
      configMatches(config,{version,pack,room,presentation,dealerId});
      aborted(signal);
      return {operatorId:operator.id,roomId,packageRevision:pack.revision};
    }));
  }
  async function bind(value,roomId,signal) {
    const accepted=session(value,now);aborted(signal);
    const publication=await current(roomId,signal);aborted(signal);
    // Recheck revocation/expiry after the registry wait, with no retained token.
    const latest=session(await auth.bindingById(accepted.sessionId),now);aborted(signal);
    if(!same(accepted,latest))deny();
    return Object.freeze({...accepted,...publication});
  }
  async function authorize(request,{roomId,signal}={}) {
    if(!isGameLaneId(roomId)||typeof request?.headers?.get!=='function')deny();
    signal=signal&&request.signal?AbortSignal.any([signal,request.signal]):signal??request.signal;aborted(signal);
    // The channel uses Fetch Request; existing player auth consumes a Node cookie header.
    const value=await auth.binding({headers:{cookie:request.headers.get('cookie')??undefined}});aborted(signal);
    return bind(value,roomId,signal);
  }
  async function revalidate(binding,{signal}={}) {
    if(!binding||keys.some(key=>!Object.hasOwn(binding,key))||!isGameLaneId(binding.roomId)
      ||!id(binding.operatorId)||!Number.isSafeInteger(binding.packageRevision)||binding.packageRevision<1)deny();
    aborted(signal);
    const value=await auth.bindingById(binding.sessionId);aborted(signal);
    const accepted=session(value,now);
    if(['actorId','sessionId','expiresAt'].some(key=>accepted[key]!==binding[key]))deny();
    const latest=await bind(value,binding.roomId,signal);
    if(keys.some(key=>latest[key]!==binding[key]))deny();
    return latest;
  }
  async function revalidateLocked(binding,{signal}={}) {
    // Called only after the table's declared R/P/A locks, inside the explicit
    // shared transaction. The auth adapter verifies this same scoped context.
    if(typeof commandAuth?.bindingById!=='function')unavailable();
    if(!binding||keys.some(key=>!Object.hasOwn(binding,key))||!isGameLaneId(binding.roomId)
      ||!id(binding.operatorId)||!Number.isSafeInteger(binding.packageRevision)||binding.packageRevision<1)deny();
    aborted(signal);
    const fresh=session(await commandAuth.bindingById(binding.sessionId,{actorId:binding.actorId,signal}),now);
    if(['actorId','sessionId','expiresAt'].some(key=>fresh[key]!==binding[key]))deny();
    const publication=await current(binding.roomId,signal);
    if(['operatorId','roomId','packageRevision'].some(key=>publication[key]!==binding[key]))deny();
    aborted(signal);
    return Object.freeze({...fresh,...publication});
  }
  return Object.freeze({authorize,revalidate,revalidateLocked});
}
