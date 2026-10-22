import {createHash} from 'node:crypto';
import {canonicalStudioJson,StudioStorageError} from '../../studio-registry/server/document-contract.mjs';
import {validateRuntimeCatalogRecord} from '../../studio-registry/server/runtime-catalog.mjs';
import {isPresentationRoom,roomGame} from '../contracts/presentation-room.mjs';
import {validateRoomGameMaterial} from '../contracts/room-game-config.mjs';
import {recordedSpeechForVideo} from '../contracts/recorded-speech.mjs';
import {readPackagePresentation} from './presentation-package.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const digest=value=>hash(canonicalStudioJson(value));
const fail=()=>{throw new StudioStorageError('studio_room_game_material_unavailable',422);};
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const sourceKeys=['dealer','path','source','slot','variant','language','bytes','sha256'];
const sourceIdentity=row=>Object.fromEntries(sourceKeys.map(key=>[key,row?.[key]]));
const speechSources=new Set(['replik','replik-rot']);

/** Pure, server-only adapter; no registry reads, Blob requests or writes.
 * identityMap is an explicit K05 binding, NOT a new field on registry records:
 * {operatorId,packageRevision,roomId,presentationLaneId,dealerId,sourceDealer,entries}
 * entries: {source:{dealer,path,source,slot,variant,language,bytes,sha256},logicalPath,
 *           mediaId:null|uuid,speech:null|{lineId,takeId}}.
 * capturedCatalog is the existing {revision,value} runtime-catalog record.
 * The caller must supply it and the package from the intended scoped snapshot,
 * and recheck their revisions in the publication transaction. This does not prove
 * current Blob availability or audiovisual quality. It never fills observed
 * hashes from K04's catalogue claims, and never makes a missing identity playable.
 * planningRevision is K04's reviewed server producer, injected explicitly.
 */
export function resolveRoomGameMaterial({package:pack,room,language,catalogue,capturedCatalog,identityMap,planningRevision}={}) {
  if(typeof planningRevision!=='function'||!['en','sv'].includes(language)
    ||!isPresentationRoom(room)||room.state!=='live'||roomGame(room)!=='blackjack'
    ||pack?.operatorId!==room.operatorId||!Number.isSafeInteger(pack.revision)||pack.revision<1
    ||!pack.tables?.includes(room.id)||!pack.games?.includes('blackjack')
    ||!exact(identityMap,['operatorId','packageRevision','roomId','presentationLaneId','dealerId','sourceDealer','entries'])
    ||identityMap.operatorId!==pack.operatorId||identityMap.packageRevision!==pack.revision
    ||identityMap.roomId!==room.id||identityMap.presentationLaneId!==room.presentationLaneId
    ||typeof identityMap.sourceDealer!=='string'||!identityMap.sourceDealer
    ||!Array.isArray(identityMap.entries)||!identityMap.entries.length||identityMap.entries.length>5000
    ||!Array.isArray(catalogue)||!catalogue.length||catalogue.length>5000)fail();
  // Detach all caller-owned inputs before invoking the producer.
  const mapping=structuredClone(identityMap),sources=structuredClone(catalogue);
  const presentation=readPackagePresentation(pack),lane=presentation?.lanes.find(row=>row.id===room.presentationLaneId);
  if(!lane||lane.layers.dealer.default!==mapping.dealerId)fail();
  const {revision:catalogRevision,value:catalog}=validateRuntimeCatalogRecord(capturedCatalog);
  const rows=new Map(sources.map(row=>[row.path,row]));
  if(rows.size!==sources.length)fail();
  const blobs=new Map(catalog.blobIndex.files.map(row=>[row.logicalPath,row]));
  const captured=[...(presentation.playback?.media??[]),...(presentation.registeredDealers??[]).flatMap(row=>row.idle?[row.idle]:[])];
  const observed=new Map(),documents=new Map(),media=new Map(),bound=new Map();
  for(const entry of mapping.entries) {
    if(!exact(entry,['source','logicalPath','mediaId','speech'])||!exact(entry.source,sourceKeys)
      ||typeof entry.logicalPath!=='string'||bound.has(entry.source.path))fail();
    const source=rows.get(entry.source.path),blob=blobs.get(entry.logicalPath);
    if(!source||canonicalStudioJson(sourceIdentity(source))!==canonicalStudioJson(entry.source)
      ||!blob||blob.sha256!==source.sha256||blob.size!==source.bytes
      ||!['',language].includes(source.language)
      ||![mapping.sourceDealer,'shared'].includes(source.dealer))fail();
    // Only the validated imported catalog supplies independently recorded hashes.
    observed.set(source.path,blob.sha256);bound.set(source.path,source);
    if(source.source==='data-beroende') {
      if(entry.mediaId!==null||entry.speech!==null)fail();
      const text=catalog.legacy.entries['media/'+entry.logicalPath];
      if(text!==undefined)documents.set(source.path,Buffer.from(text,'utf8'));
      continue;
    }
    if(source.source==='still'||source.source==='keyed-still') {
      if(entry.mediaId!==null||entry.speech!==null||!/\.png$/.test(source.path)
        ||!entry.logicalPath.endsWith('.png')||blob.storage.contentType!=='image/png')fail();
      // The exact PNG identity is frozen by mapping + catalogRevision below,
      // not by a fabricated video record; it still belongs to the producer's full set.
      continue;
    }
    const record=captured.find(row=>row.id===entry.mediaId);
    if(!record||record.sha256!==blob.sha256||record.size!==blob.size
      ||record.classification.dealerId!==mapping.dealerId)fail();
    if(speechSources.has(source.source)) {
      if(!exact(entry.speech,['lineId','takeId'])||source.language!==language
        ||!recordedSpeechForVideo(record,{dealerId:mapping.dealerId,language,...entry.speech}))fail();
    } else if(entry.speech!==null)fail();
    media.set(record.id,{id:record.id,sha256:record.sha256});
  }
  if(!mapping.entries.some(entry=>speechSources.has(entry.source.source)&&entry.source.language===language))fail();
  const result=planningRevision({catalogue:structuredClone(sources),dealer:mapping.sourceDealer,language,
    observed:new Map(observed),documents:new Map([...documents].map(([path,bytes])=>[path,Buffer.from(bytes)]))});
  if(!exact(result,['ok','contract','dealer','language','leadMs','cardMs','revision','media','timing'])
    ||result.ok!==true||result.contract!=='k04-material-revision/1'||result.dealer!==mapping.sourceDealer||result.language!==language
    ||typeof result.revision!=='string'||!/^[a-f0-9]{64}$/.test(result.revision)
    ||!Array.isArray(result.media)||result.media.length!==bound.size||!result.timing)fail();
  const planned=new Set();
  for(const tuple of result.media) {
    if(!Array.isArray(tuple)||tuple.length!==3||planned.has(tuple[0]))fail();
    const source=bound.get(tuple[0]);
    if(!source||tuple[1]!==source.bytes||tuple[2]!==observed.get(tuple[0]))fail();
    planned.add(tuple[0]);
  }
  const timing=documents.get(result.timing.source);
  if(!timing||hash(timing)!==result.timing.sourceSha256)fail();
  return validateRoomGameMaterial({revision:digest({contract:'j08-material-binding/1',mapping,catalogRevision,
    presentationHash:digest(presentation),planningRevision:result.revision,language,leadMs:result.leadMs,cardMs:result.cardMs}),
    dealerId:mapping.dealerId,language,leadMs:result.leadMs,cardMs:result.cardMs,media:[...media.values()].sort((a,b)=>a.id.localeCompare(b.id))},
  {dealerId:mapping.dealerId,language});
}
