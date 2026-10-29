import {createOperatorStore} from '../../packages/operators/server/operator-store.mjs';
import {createGameEntrySelector} from '../../packages/presentation/server/game-entry-selector.mjs';
import {readPackagePresentation,resolvePackageRoomDealer} from '../../packages/presentation/server/presentation-package.mjs';
import {isPresentationRoom,roomGame} from '../../packages/presentation/contracts/presentation-room.mjs';
import {isGameLaneId} from '../../packages/presentation/contracts/game-lane-id.mjs';
import {assertPublishedRoomGameConfig} from '../../packages/presentation/server/room-game-publication.mjs';
import {canonicalStudioJson,validateStudioScope,validateStudioMedia,StudioStorageError} from '../../packages/studio-registry/server/document-contract.mjs';
import {PARTNER_KEY_UNBOUND,PARTNER_OPERATOR_MISMATCH} from './partner-operator.mjs';

const deny=()=>{throw new StudioStorageError('studio_forbidden',403);};
const unavailable=()=>{throw new StudioStorageError('studio_storage_unavailable',503);};
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const keys=['actorId','sessionId','operatorId','roomId','packageRevision','expiresAt'];
const same=(a,b)=>canonicalStudioJson(a)===canonicalStudioJson(b);
const mediaIdentity=value=>({...value,classification:Object.fromEntries(Object.entries(value.classification).filter(([key])=>!['label','notes'].includes(key)))});
const layerIdentity=({label,...value})=>value;
const aborted=signal=>{if(signal?.aborted)throw signal.reason??new DOMException('Aborted','AbortError');};
const refuse=code=>{throw new StudioStorageError(code,403);};
// A live room whose package binds no game settings, or whose binding has no published head, has
// nothing a seat can use until Admin publishes its settings (Spelinställningar › Publicera). The
// upgrade names this refusal in its 1008 close, so the page says so instead of retrying for a minute.
export const ROOM_CONFIG_MISSING='room_config_missing';
const configMissing=()=>refuse(ROOM_CONFIG_MISSING);
function session(value,now) {
  if(!value||!Object.hasOwn(value,'partnerKeyId')
    ||!id(value.actorId)||!/^player-[a-f0-9]{64}$/.test(value.sessionId)
    ||!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=now())deny();
  // Nyckel→bolag (docs/plans/NYCKEL-BOLAG.md): a partner-launched session enters only rooms of its
  // key's company, with a player's rights; admit() compares that company with the room's. A key
  // without a company (every key before 012) has no room grant and is refused by name.
  if(value.partnerKeyId!==null) {
    if(!id(value.partnerKeyId)||!Object.hasOwn(value,'operatorId'))deny();
    if(value.operatorId===null)refuse(PARTNER_KEY_UNBOUND);
    if(!id(value.operatorId))deny();
  }
  return {actorId:value.actorId,sessionId:value.sessionId,expiresAt:value.expiresAt};
}
const grant=value=>value.partnerKeyId===null?null:value.partnerKeyId+'\0'+value.operatorId;
function admit(value,publication) {
  if(value.partnerKeyId!==null&&value.operatorId!==publication.operatorId)refuse(PARTNER_OPERATOR_MISMATCH);
}
function configMatches(value,context) {
  try { assertPublishedRoomGameConfig(value,context); }
  catch(error) { if(error?.statusCode===422)deny(); throw error; }
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
  async function current(roomId,signal,details=false) {
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
      const bindings=pack.branding?.roomGameConfigVersions;
      if(!bindings||typeof bindings!=='object'||!Object.hasOwn(bindings,roomId))configMissing();
      const version=bindings[roomId];
      if(typeof version!=='string'||!/^room-config-[a-f0-9-]{36}$/.test(version))deny();
      // These are the existing ConfigPort tables. Read head + frozen body on
      // this same scoped client, without starting or modifying a game window.
      const result=await sql.query(`/* shared-room-access:config */ SELECT h.version,c.body
        FROM croupier_game.shared_table_config_heads h LEFT JOIN croupier_game.shared_table_configs c
        ON c.room_id=h.room_id AND c.version=h.version
        WHERE $1::text IS NOT NULL AND $2::text IS NOT NULL AND h.room_id=$3`,[...parameters,roomId]);
      if(!result.rows.length)configMissing();
      if(result.rows.length!==1||result.rows[0].version!==version)deny();
      let config;try{config=typeof result.rows[0].body==='string'?JSON.parse(result.rows[0].body):result.rows[0].body;}catch{unavailable();}
      configMatches(config,{version,pack,room,presentation,dealerId});
      aborted(signal);
      const publication={operatorId:operator.id,roomId,packageRevision:pack.revision};
      return details?{publication,operator,pack,room,presentation,config,administration,administrationRevision:document.revision}:publication;
    }));
  }
  async function bind(value,roomId,signal) {
    const accepted=session(value,now);aborted(signal);
    const publication=await current(roomId,signal);aborted(signal);
    admit(value,publication);
    // Recheck revocation/expiry after the registry wait, with no retained token.
    const fresh=await auth.bindingById(accepted.sessionId),latest=session(fresh,now);aborted(signal);
    if(!same(accepted,latest)||grant(fresh)!==grant(value))deny();
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
    const value=await commandAuth.bindingById(binding.sessionId,{actorId:binding.actorId,signal}),fresh=session(value,now);
    if(['actorId','sessionId','expiresAt'].some(key=>fresh[key]!==binding[key]))deny();
    const publication=await current(binding.roomId,signal);
    if(['operatorId','roomId','packageRevision'].some(key=>publication[key]!==binding[key]))deny();
    admit(value,publication);
    aborted(signal);
    return Object.freeze({...fresh,...publication});
  }
  async function readPresentationContextLocked(binding,{configVersion=null,signal}={}) {
    // The caller obtains configVersion from the locked engine room, never from
    // a query/body. Null means no engine window: use the current published head.
    // Revalidate on the same G/S/R/P/A owner, including the current session.
    await revalidateLocked(binding,{signal});aborted(signal);
    return repository.transaction(()=>repository.withTransactionClient(async client=>{
      const saved=await current(binding.roomId,signal,true);aborted(signal);
      const {operator,pack,room,presentation,administration}=saved;
      let config=saved.config;
      if(configVersion!==null) {
        if(typeof configVersion!=='string'||!/^room-config-[a-f0-9-]{36}$/.test(configVersion))deny();
        const result=await client.query(`/* shared-room-access:active-config */ SELECT body FROM croupier_game.shared_table_configs
          WHERE $1::text IS NOT NULL AND $2::text IS NOT NULL AND room_id=$3 AND version=$4`,[...parameters,room.id,configVersion]);
        aborted(signal);if(result.rows.length!==1)deny();
        try{config=typeof result.rows[0].body==='string'?JSON.parse(result.rows[0].body):result.rows[0].body;}catch{unavailable();}
      }
      const version=configVersion??config.configVersion;
      if(!Number.isSafeInteger(config?.packageRevision)||config.packageRevision<1||config.packageRevision>pack.revision)deny();
      const operators=await createOperatorStore({sql:client,scope,now});
      const source=config.packageRevision===pack.revision?pack:await operators.getPackage(operator.id,config.packageRevision);aborted(signal);
      if(!source||source.operatorId!==operator.id||source.branding?.roomGameConfigVersions?.[room.id]!==version
        ||!source.games.includes('blackjack')||!source.tables.includes(room.id)||!source.lanes.includes(room.presentationLaneId))deny();
      const frozen=readPackagePresentation(source),dealerId=resolvePackageRoomDealer(source,room,frozen);
      configMatches(config,{version,pack:source,room,presentation:frozen,dealerId});
      const liveLane=presentation.lanes.find(row=>row.id===room.presentationLaneId),lane=frozen.lanes.find(row=>row.id===room.presentationLaneId);
      if(!liveLane?.dealers.includes(dealerId)||!liveLane.layers.dealer.allowed.includes(dealerId)
        ||!presentation.registeredDealers.some(row=>row.id===dealerId))deny();
      const project=await repository.readDocument('project');aborted(signal);
      if(!project?.value?.dealers?.some(row=>row.id===dealerId))deny();
      // A frozen asset may outlive a changed default, but never its ordinary
      // trash/deletion or approval. Provider bytes are fetched after COMMIT.
      const records=[...(frozen.playback?.media??[]),...(frozen.registeredDealers??[]).flatMap(row=>row.idle?[row.idle]:[])]
        .filter(row=>row.classification?.dealerId===dealerId);
      const expected=new Map(records.map(row=>[row.id,validateStudioMedia(row)]));
      if(!expected.size)deny();
      const rows=await client.query(`/* shared-room-access:active-media */ SELECT id,record FROM croupier_studio.media_records
        WHERE environment_id=$1 AND workspace_id=$2 AND id=ANY($3::uuid[])`,[...parameters,[...expected.keys()]]);aborted(signal);
      if(rows.rows.length!==expected.size||new Set(rows.rows.map(row=>row.id)).size!==rows.rows.length)deny();
      for(const row of rows.rows) {
        let value;try{value=validateStudioMedia(typeof row.record==='string'?JSON.parse(row.record):row.record);}catch{deny();}
        if(value.id!==row.id||value.deletion||value.classification.archived===true||!expected.has(row.id)
          ||!same(mediaIdentity(value),mediaIdentity(expected.get(row.id))))deny();
      }
      const assets=frozen.assets.filter(asset=>lane.layers[asset.role]?.allowed.includes(asset.id));
      for(const asset of assets)if(!project.value.layerAssets?.some(row=>row.id===asset.id&&same(layerIdentity(row),layerIdentity(asset))))deny();
      aborted(signal);
      return {config,context:{operatorSlug:operator.slug,roomId:room.id,packageRevision:source.revision,dealerId},
        saved:{operator,package:source,administration},
        authority:{administrationRevision:saved.administrationRevision,projectRevision:project.revision,
          media:[...expected.values()],assets}};
    }));
  }
  // Speech lag (28 Oct 2026): the immutable package a room's frozen config is bound to, read on this scoped
  // repository only to derive that config's own speech clips (shared-room-filmed-steps.mjs). It grants
  // nothing: no session, room or media access follows from it, and the caller checks the config's binding.
  async function readPackage(operatorId,packageRevision,{signal}={}) {
    if(!id(operatorId)||!Number.isSafeInteger(packageRevision)||packageRevision<1)deny();
    aborted(signal);
    return repository.transaction(()=>repository.withTransactionClient(async client=>{
      aborted(signal);
      const sql={async query(text,values){aborted(signal);const result=await client.query(text,values);aborted(signal);return result;}};
      return (await createOperatorStore({sql,scope,now})).getPackage(operatorId,packageRevision);
    }));
  }
  return Object.freeze({authorize,revalidate,revalidateLocked,readPresentationContextLocked,readPackage});
}
