import {createHash} from 'node:crypto';
import {canonicalStudioJson,StudioStorageError,validateRevision} from '../../packages/studio-registry/server/document-contract.mjs';
import {createOperatorStore} from '../../packages/operators/server/operator-store.mjs';
import {readOperatorLifecycle,withOperatorLifecycle} from '../../packages/operators/server/operator-lifecycle.mjs';
import {PRESENTATION_PACKAGE_KEY,readPackagePresentation,withPackagePresentation} from '../../packages/presentation/server/presentation-package.mjs';
import {validatePresentationPackage} from '../../packages/presentation/contracts/presentation-layers.mjs';
import { gameLaneConfiguration } from '../../packages/presentation/contracts/game-lanes.mjs';
import {isPresentationRoom} from '../../packages/presentation/contracts/presentation-room.mjs';
import {operatorAuditContext} from './operator-audit-context.mjs';

const fail=(code='studio_dealer_archive_coverage_incomplete',status=409)=>{throw new StudioStorageError(code,status);};
const same=(left,right)=>canonicalStudioJson(left)===canonicalStudioJson(right);
// Only relationship fields establish ownership. Labels, IDs, model names and
// historical snapshots can legitimately contain the same text as a dealer ID.
const laneUsesDealer=(lane,dealerId,mediaIds)=>lane.dealers?.includes(dealerId)
  ||lane.layers?.dealer?.default===dealerId||lane.layers?.dealer?.allowed?.includes(dealerId)
  ||lane.idle?.variants?.some(id=>mediaIds.includes(id));
const brandingUsesDealer=(branding,dealerId)=>branding?.dealer===dealerId
  ||Object.values(branding?.roomOverrides??{}).some(row=>row?.dealer===dealerId);

export function dealerArchiveCompositionIds(project,dealerId,records=[]){
  const mediaIds=records.filter(row=>row.classification?.dealerId===dealerId).map(row=>row.id);
  return (project.lanes??[]).filter(lane=>laneUsesDealer(lane,dealerId,mediaIds)).map(lane=>lane.id);
}

// Keep surviving publications byte-for-byte equivalent at the media/selection
// level. In particular, never recapture mutable drafts or choose a replacement.
export function withoutPresentationLanes(presentation,removedIds){
  const next=structuredClone(presentation),removed=new Set(removedIds);
  next.lanes=next.lanes.filter(lane=>!removed.has(lane.id));
  if(!next.lanes.length)return null;
  const dealers=new Set(next.lanes.flatMap(lane=>[...lane.dealers,...lane.layers.dealer.allowed]));
  const layerAssets=new Set(next.lanes.flatMap(lane=>['background','table'].flatMap(role=>lane.layers[role].allowed)));
  next.assets=next.assets.filter(asset=>layerAssets.has(asset.id));
  if(next.registeredDealers)next.registeredDealers=next.registeredDealers.filter(dealer=>dealers.has(dealer.id));
  if(next.playback){
    const playback=next.playback;
    playback.lines=playback.lines.filter(line=>dealers.has(line.dealerId));
    if(playback.dealerIdlePolicies)playback.dealerIdlePolicies=playback.dealerIdlePolicies.filter(row=>dealers.has(row.dealerId));
    const variants=playback.lines.flatMap(line=>line.variants);
    const assets=new Set(variants.map(row=>row.assetId)),triggers=new Set(variants.flatMap(row=>row.triggerIds));
    const media=new Set(variants.map(row=>row.videoGenerationId).filter(Boolean));
    for(const row of playback.dealerIdlePolicies??[])for(const item of [...row.policy.base,...row.policy.variants])media.add(item.videoId);
    playback.assets=playback.assets.filter(row=>assets.has(row.id));
    playback.triggers=playback.triggers.filter(row=>triggers.has(row.id));
    playback.media=playback.media.filter(row=>media.has(row.id));
  }
  return validatePresentationPackage(next);
}

async function readWithin(repository,{dealerId,expectedRevision,now=Date.now}){
  validateRevision(expectedRevision);
  const projectDocument=await repository.readDocument('project');
  if(!projectDocument||projectDocument.revision!==expectedRevision)fail('studio_conflict');
  const dealer=projectDocument.value.dealers.find(row=>row.id===dealerId);
  if(!dealer)fail('studio_dealer_missing');
  const administrationDocument=await repository.readDocument('administration');
  if(!administrationDocument)fail('studio_document_missing',503);
  const records=await repository.listMedia({limit:5000});
  const owned=records.filter(row=>row.classification.dealerId===dealerId);
  const mediaIds=owned.map(row=>row.id),compositionIds=new Set(dealerArchiveCompositionIds(projectDocument.value,dealerId,records));
  const administration=structuredClone(administrationDocument.value),config=gameLaneConfiguration(administration);
  // Operator rooms do not use legacy tiers. Drop only an entire obsolete
  // assignment; mixed tiers and documents with legacy rooms stay untouched.
  if(administration.tiers&&Object.keys(administration.tiers).length===3
    &&['classic','high','vip'].every(tier=>administration.tiers[tier]===dealerId)
    &&Array.isArray(administration.rooms)&&administration.rooms.every(isPresentationRoom))delete administration.tiers;
  const adapterById=new Map(config.gameLanes.map(row=>[row.id,row]));
  const entries=await repository.withTransactionClient(async client=>{
    const store=await createOperatorStore({sql:client,scope:repository.scope,now,transaction:work=>repository.withTransactionClient(work)});
    const result=[];
    for(const operator of [...await store.listOperators()].sort((a,b)=>a.id.localeCompare(b.id))){
      const pack=await store.getCurrentPackage(operator.id);
      const presentation=readPackagePresentation(pack);
      const removedIds=new Set((pack?.lanes??[]).filter(id=>compositionIds.has(id)));
      for(const lane of presentation?.lanes??[])if(laneUsesDealer(lane,dealerId,mediaIds))removedIds.add(lane.id);
      result.push({operator,pack,presentation,removedIds});
    }
    return result;
  });
  const entryById=new Map(entries.map(entry=>[entry.operator.id,entry]));
  const removedRooms=(administration.rooms??[]).filter(room=>isPresentationRoom(room)
    ? entryById.get(room.operatorId)?.removedIds.has(room.presentationLaneId)||adapterById.get(room.gameLaneId)?.dealer===dealerId
    : room.dealer===dealerId);
  const removedRoomIds=new Set(removedRooms.map(room=>room.id));
  for(const room of removedRooms)if(isPresentationRoom(room)&&(!entryById.get(room.operatorId)?.pack||!adapterById.has(room.gameLaneId)))fail();
  if(removedRooms.length)administration.rooms=administration.rooms.filter(room=>!removedRoomIds.has(room.id));
  const usedAdapters=new Set((administration.rooms??[]).filter(isPresentationRoom).map(room=>room.gameLaneId));
  const archivedAdapters=new Set(removedRooms.filter(isPresentationRoom).map(room=>room.gameLaneId));
  const remainingAdapters=config.gameLanes.filter(row=>row.dealer!==dealerId&&!(archivedAdapters.has(row.id)&&row.id.startsWith('room-lane-')&&!usedAdapters.has(row.id)));
  if(remainingAdapters.length!==config.gameLanes.length){
    administration.gameLanes=remainingAdapters;
    administration.gameLane=remainingAdapters.some(row=>row.id===config.gameLane)?config.gameLane:null;
  }
  const packageChanges=[];
  for(const entry of entries){
    const {operator,pack,presentation,removedIds}=entry;if(!pack)continue;
    const rooms=removedRooms.filter(room=>room.operatorId===operator.id);
    const directBranding=brandingUsesDealer(pack.branding,dealerId);
    if(!removedIds.size&&!rooms.length&&!directBranding)continue;
    const lanes=pack.lanes.filter(id=>!removedIds.has(id));
    let branding=structuredClone(pack.branding);
    if(branding.dealer===dealerId)delete branding.dealer;
    if(removedIds.has(branding.lane))delete branding.lane;
    if(branding.roomOverrides){
      for(const [roomId,override] of Object.entries(branding.roomOverrides)){
        if(removedRoomIds.has(roomId))delete branding.roomOverrides[roomId];
        else if(override?.dealer===dealerId)delete override.dealer;
      }
    }
    if(presentation&&removedIds.size){
      const retained=withoutPresentationLanes(presentation,[...removedIds]);
      if(retained)branding=withPackagePresentation(branding,retained);
      else{delete branding[PRESENTATION_PACKAGE_KEY];delete branding.lane;delete branding.dealer;}
    }
    const lifecycle=readOperatorLifecycle(pack.branding);
    for(const room of rooms){
      if(lifecycle.rooms.some(row=>row.room.id===room.id))fail('studio_conflict');
      lifecycle.rooms.push({archivedAt:new Date(now()).toISOString(),room:structuredClone(room),gameLane:structuredClone(adapterById.get(room.gameLaneId)),sourcePackageRevision:pack.revision});
    }
    branding=withOperatorLifecycle(branding,lifecycle);
    // Historical lifecycle snapshots may reference the dealer by design.
    const { _scoutLifecycle:history,...activeBranding}=branding;
    if(brandingUsesDealer(activeBranding,dealerId))fail();
    packageChanges.push({operatorId:operator.id,expectedRevision:pack.revision,lanes,games:[...pack.games],tables:pack.tables.filter(id=>!removedRoomIds.has(id)),branding,
      ...(rooms.length?{lifecycle:{resourceType:'room',resourceId:rooms[0].id,archived:true}}:{})});
  }
  const token=createHash('sha256').update(canonicalStudioJson({scope:repository.scope,dealerId,projectRevision:projectDocument.revision,
    administrationRevision:administrationDocument.revision,media:records.map(row=>({id:row.id,revision:row.revision})),
    packages:entries.map(({operator,pack})=>({id:operator.id,status:operator.status,revision:pack?.revision??null}))})).digest('hex');
  const affectedCompositions=new Map((projectDocument.value.lanes??[]).filter(lane=>compositionIds.has(lane.id)).map(({id,label})=>[id,{id,label}]));
  for(const entry of entries)for(const lane of entry.presentation?.lanes??[])if(entry.removedIds.has(lane.id)&&!affectedCompositions.has(lane.id))affectedCompositions.set(lane.id,{id:lane.id,label:lane.label});
  const impact={token,dealerId,mediaCount:owned.filter(row=>row.deletion?.state!=='deleted').length,speechEnabled:dealer.speechProfile?.state==='enabled',
    compositions:[...affectedCompositions.values()],
    rooms:removedRooms.map(({id,name,operatorId})=>({id,name,operatorId:operatorId??null})),
    operators:entries.filter(entry=>packageChanges.some(change=>change.operatorId===entry.operator.id)).map(({operator})=>({id:operator.id,name:operator.name}))};
  return {impact,projectDocument,records,administrationDocument,administration,packageChanges};
}

export async function readDealerArchiveImpact({repository,...input}){
  if(!repository?.transaction||!repository?.withTransactionClient)fail('studio_mutation_transaction_required',503);
  return repository.transaction(()=>readWithin(repository,input));
}

export async function applyDealerArchiveImpact({repository,impactToken,actor,...input}){
  return repository.transaction(async()=>{
    const plan=await readWithin(repository,input);
    if(typeof impactToken!=='string'||impactToken!==plan.impact.token)fail('studio_conflict');
    if(!same(plan.administration,plan.administrationDocument.value))await repository.saveDocument('administration',{
      value:plan.administration,expectedRevision:plan.administrationDocument.revision,actor});
    await repository.withTransactionClient(async client=>{
      const store=await createOperatorStore({sql:client,scope:repository.scope,transaction:work=>repository.withTransactionClient(work)});
      const audit=operatorAuditContext({user:actor,role:'admin'});
      for(const change of plan.packageChanges)await store.publishPackage({...change,actor,audit});
    });
    return plan.impact;
  });
}
