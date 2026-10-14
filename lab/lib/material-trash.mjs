import {createHash} from 'node:crypto';
import {validateProject} from './studio-model.mjs';
import {compositionLabel} from './control-flow.mjs';
import {canonicalStudioJson,StudioStorageError} from '../../web/storage/studio-contract.mjs';
import {gameLaneConfiguration} from '../../web/public/game-lanes.mjs';
import {isPresentationRoom} from '../../web/presentation-room-contract.mjs';
import {readOperatorLifecycle,withOperatorLifecycle} from '../../web/storage/operator-lifecycle.mjs';
import {PRESENTATION_PACKAGE_KEY,readPackagePresentation,withPackagePresentation} from '../../web/storage/presentation-package.mjs';
import {withoutPresentationLanes} from './dealer-archive-impact.mjs';
import {retainBlackjackTableGeometry} from '../../web/public/composition-settings.mjs';

const fail=(code='studio_material_missing')=>{throw new StudioStorageError(code,409);};
export const materialUsedBy=(lane,id)=>['background','table'].some(role=>lane.layers[role].default===id||lane.layers[role].allowed.includes(id))
  ||lane.backgroundPlayback?.rules.some(rule=>rule.assetId===id)||lane.composition?.blackjackTables?.some(row=>row.tableId===id);
function detach(lane,id){
 for(const role of ['background','table']){
  const layer=lane.layers[role];layer.allowed=layer.allowed.filter(value=>value!==id);
  if(layer.default===id){layer.default=null;layer.enabled=false;}
 }
 if(lane.backgroundPlayback)lane.backgroundPlayback.rules=lane.layers.background.enabled&&lane.layers.background.default
  ?lane.backgroundPlayback.rules.filter(rule=>rule.assetId!==id):[];
 retainBlackjackTableGeometry(lane.composition,lane.layers.table.allowed);
}
export function changeMaterialTrash(project,{id,archived,now=Date.now}){
 const next=structuredClone(project),trash=next.layerAssetTrash??[];
 if(archived){
  const asset=next.layerAssets?.find(row=>row.id===id);if(!asset)fail();
  if(trash.some(row=>row.asset.id===id))fail('studio_conflict');
  next.layerAssetTrash=[...trash,{asset,archivedAt:new Date(now()).toISOString()}];
  next.layerAssets=next.layerAssets.filter(row=>row.id!==id);
  for(const lane of [...(next.lanes??[]),...(next.dealerTrash??[]).flatMap(entry=>entry.compositions??[])])detach(lane,id);
 }else{
  const entry=trash.find(row=>row.asset.id===id);if(!entry)fail();
  if(next.layerAssets?.some(row=>row.id===id))fail('studio_conflict');
  next.layerAssets=[...(next.layerAssets??[]),entry.asset];next.layerAssetTrash=trash.filter(row=>row.asset.id!==id);
 }
 return validateProject(next);
}

// Read and apply use the same transaction and fresh revisions. The preview
// token binds every publication so a new use cannot slip past confirmation.
export async function materialTrashPlan({repository,operators,id,archived,expectedRevision,now=Date.now}){
 const project=await repository.readDocument('project'),administrationDocument=await repository.readDocument('administration');
 if(!project||!administrationDocument)fail('studio_document_missing');
 if(project.revision!==expectedRevision)fail('studio_conflict');
 const asset=archived?project.value.layerAssets?.find(row=>row.id===id):project.value.layerAssetTrash?.find(row=>row.asset.id===id)?.asset;
 if(!asset)fail();
 const next=changeMaterialTrash(project.value,{id,archived,now});
 const compositions=[...(project.value.lanes??[]),...(project.value.dealerTrash??[]).flatMap(entry=>entry.compositions??[])];
 const affected=archived?compositions.filter(lane=>materialUsedBy(lane,id)):[];
 const entries=[];
 for(const operator of [...await operators.listOperators()].sort((a,b)=>a.id.localeCompare(b.id))){
  const pack=await operators.getCurrentPackage(operator.id),presentation=readPackagePresentation(pack);
  const removed=new Set(archived?(presentation?.lanes??[]).filter(lane=>materialUsedBy(lane,id)).map(lane=>lane.id):[]);
  entries.push({operator,pack,presentation,removed});
 }
 const administration=structuredClone(administrationDocument.value),config=gameLaneConfiguration(administration);
 const roomIds=new Set(),rooms=[],changes=[];
 for(const {operator,pack,presentation,removed} of entries){
  if(!pack||!removed.size)continue;
  const selected=administration.rooms.filter(room=>isPresentationRoom(room)&&room.operatorId===operator.id&&removed.has(room.presentationLaneId));
  const lifecycle=readOperatorLifecycle(pack.branding);
  for(const room of selected){
   const gameLane=config.gameLanes.find(lane=>lane.id===room.gameLaneId);
   if(!gameLane||lifecycle.rooms.some(entry=>entry.room.id===room.id))fail('studio_room_configuration_missing');
   lifecycle.rooms.push({archivedAt:new Date(now()).toISOString(),room:structuredClone(room),gameLane:structuredClone(gameLane),sourcePackageRevision:pack.revision});
   roomIds.add(room.id);rooms.push({id:room.id,name:room.name,operatorId:operator.id});
  }
  let branding=structuredClone(pack.branding),retained=withoutPresentationLanes(presentation,[...removed]);
  if(retained)branding=withPackagePresentation(branding,retained);
  else{delete branding[PRESENTATION_PACKAGE_KEY];delete branding.dealer;}
  if(removed.has(branding.lane))delete branding.lane;
  if(branding.roomOverrides)for(const room of selected)delete branding.roomOverrides[room.id];
  branding=withOperatorLifecycle(branding,lifecycle);
  changes.push({operatorId:operator.id,expectedRevision:pack.revision,lanes:pack.lanes.filter(lane=>!removed.has(lane)),games:[...pack.games],
   tables:pack.tables.filter(room=>!roomIds.has(room)),branding,...(selected.length?{lifecycle:{resourceType:'room',resourceId:selected[0].id,archived:true}}:{})});
 }
 administration.rooms=administration.rooms.filter(room=>!roomIds.has(room.id));
 const removedAdapters=new Set(administrationDocument.value.rooms.filter(room=>roomIds.has(room.id)).map(room=>room.gameLaneId));
 administration.gameLanes=config.gameLanes.filter(lane=>!removedAdapters.has(lane.id)||!lane.id.startsWith('room-lane-')||administration.rooms.some(room=>room.gameLaneId===lane.id));
 administration.gameLane=administration.gameLanes.some(lane=>lane.id===config.gameLane)?config.gameLane:administration.gameLanes[0]?.id??null;
 const token=createHash('sha256').update(canonicalStudioJson({scope:repository.scope,id,archived,projectRevision:project.revision,administrationRevision:administrationDocument.revision,
  packages:entries.map(({operator,pack})=>({id:operator.id,status:operator.status,revision:pack?.revision??null}))})).digest('hex');
 const impact={token,id,archived,label:asset.label,role:asset.role,compositions:affected.map(lane=>({id:lane.id,label:compositionLabel(lane.label)})),rooms,
  operators:entries.filter(entry=>changes.some(change=>change.operatorId===entry.operator.id)).map(({operator})=>({id:operator.id,name:operator.name}))};
 return {impact,project:next,administration,administrationDocument,changes};
}
