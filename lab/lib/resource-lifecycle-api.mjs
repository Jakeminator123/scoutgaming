import * as savedGameDocumentContract from '../../web/storage/studio-contract.mjs';

import {createOperatorStore} from '../../packages/operators/server/operator-store.mjs';
import {readOperatorLifecycle,withOperatorLifecycle} from '../../packages/operators/server/operator-lifecycle.mjs';
import {readPackagePresentation} from '../../web/storage/presentation-package.mjs';
import {canonicalStudioJson,StudioStorageError,validateStudioScope,validateRevision} from '../../web/storage/studio-contract.mjs';
import { createSavedGamePolicy } from '../../packages/presentation/server/saved-game-policy.mjs';
import {isPresentationRoom} from '../../web/presentation-room-contract.mjs';
import { gameLaneConfiguration } from '../../packages/presentation/contracts/game-lanes.mjs';
import {isPresentationRoomLaneCompatible} from '../../web/storage/frozen-presentation-capture.mjs';
import {operatorAuditContext} from './operator-audit-context.mjs';
import {isStudioRole} from './studio-access-policy.mjs';
import {materialTrashPlan} from './material-trash.mjs';

const { validateStudioGameAdministration } = createSavedGamePolicy({ documentContract: savedGameDocumentContract });
const fail=(code='studio_resource_lifecycle_rejected',status=409)=>{throw new StudioStorageError(code,status);};
const exact=(body,fields)=>{if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!==[...fields].sort().join(','))fail('studio_invalid_request',400);};
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value);
const revision=value=>value===null||Number.isSafeInteger(value)&&value>0;
const same=(a,b)=>canonicalStudioJson(a)===canonicalStudioJson(b);
function lifecycleFor(pack,operatorId){
 const value=readOperatorLifecycle(pack?.branding);
 if(value.rooms.some(entry=>entry.room.operatorId!==operatorId))fail('studio_invalid_resource_lifecycle',503);
 return value;
}
function restoreBlockers({operator,pack,administration,project},entry){
 const blockers=[];
 if(operator.status!=='active')blockers.push('operator_archived');
 if(administration.rooms.some(room=>room.id===entry.room.id))blockers.push('room_identity_in_use');
 const presentation=readPackagePresentation(pack),lane=presentation?.lanes.find(row=>row.id===entry.room.presentationLaneId);
 if(!lane)blockers.push('presentation_not_published');
 const {gameLanes}=gameLaneConfiguration(administration),gameLane=gameLanes.find(row=>row.id===entry.room.gameLaneId);
 if(gameLane&&!same(gameLane,entry.gameLane))blockers.push('playback_configuration_changed');
 if(!gameLane&&gameLanes.length>=32)blockers.push('playback_configuration_limit');
 if(!project?.dealers?.some(row=>row.id===entry.gameLane.dealer))blockers.push('dealer_not_available');
 if(lane&&!isPresentationRoomLaneCompatible(gameLane??entry.gameLane,lane,presentation,entry.room.game??'blackjack'))blockers.push('presentation_incompatible');
 if(administration.rooms.length>=1000)blockers.push('room_limit');
 return blockers;
}
function packageInput(context,operatorId,pack,branding,lifecycle){return {actor:context.actor.user,audit:operatorAuditContext(context.actor),operatorId,
 expectedRevision:pack?.revision??null,lanes:[...(pack?.lanes??[])],games:[...(pack?.games??[])],tables:[...(pack?.tables??[])],branding,...(lifecycle?{lifecycle}:{})};}
export function createResourceLifecycleApi({repository,scope,now=Date.now}={}){
 scope=validateStudioScope(scope);
 if(!repository?.transaction||!repository?.withTransactionClient||!same(repository.scope,scope))fail('studio_storage_unavailable',503);
 const handlers=new Map();
 const trusted=context=>{if(!isStudioRole(context.actor?.role)||!id(context.actor?.accountId??'internal')||typeof context.actor?.user!=='string'||!context.actor.user
  ||!same(validateStudioScope(context.scope),scope))fail('studio_request_rejected',403);};
 const store=client=>createOperatorStore({sql:client,scope,now,transaction:work=>repository.withTransactionClient(work)});
 async function documents(){
  const administrationDocument=await repository.readDocument('administration'),projectDocument=await repository.readDocument('project');
  if(!administrationDocument||!projectDocument)fail('studio_document_missing',503);
  return {administration:validateStudioGameAdministration(administrationDocument.value),administrationRevision:administrationDocument.revision,project:projectDocument.value};
 }
 async function selected(operators,operatorId){
  const operator=await operators.getOperatorById(operatorId);if(!operator)fail('studio_operator_not_found',404);
  const pack=await operators.getCurrentPackage(operatorId);return {operator,pack,lifecycle:lifecycleFor(pack,operatorId)};
 }
 const endpoint=(method,action,handler)=>handlers.set(`${method} /studio/api/admin/${action}`,async context=>{trusted(context);return repository.transaction(()=>repository.withTransactionClient(async client=>handler(context,await store(client))));});
 endpoint('GET','resource-lifecycle',async(context,operators)=>{
  const saved=await documents(),result={administrationRevision:saved.administrationRevision,operators:[],rooms:[],presentations:[],historyCoverage:'complete'};
  const published=[];
  for(const operator of await operators.listOperators()){
   const pack=await operators.getCurrentPackage(operator.id),lifecycle=lifecycleFor(pack,operator.id),rooms=saved.administration.rooms.filter(room=>isPresentationRoom(room)&&room.operatorId===operator.id);
   result.operators.push({id:operator.id,slug:operator.slug,name:operator.name,status:operator.status,packageRevision:pack?.revision??null,lanes:[...(pack?.lanes??[])],
    archivedAt:lifecycle.operator?.archivedAt??null,roomCount:rooms.length,archivedRoomCount:lifecycle.rooms.length});
   for(const room of rooms)result.rooms.push({...room,archivedAt:null,packageRevision:pack?.revision??null,published:Boolean(pack?.tables.includes(room.id)),canArchive:Boolean(pack),canRestore:false,restoreBlockers:[]});
   for(const entry of lifecycle.rooms)result.rooms.push({...entry.room,state:'archived',archivedAt:entry.archivedAt,packageRevision:pack.revision,published:false,canArchive:false,
    canRestore:restoreBlockers({...saved,operator,pack},entry).length===0,restoreBlockers:restoreBlockers({...saved,operator,pack},entry)});
   if(pack)published.push({operator,pack});
  }
  let history=[];
  try{history=await repository.listLifecyclePackages();}catch{result.historyCoverage='incomplete';}
  for(const lane of saved.project.lanes??[]){
   result.presentations.push({id:lane.id,label:lane.label,
    rooms:result.rooms.filter(room=>!room.archivedAt&&room.presentationLaneId===lane.id).map(room=>({id:room.id,name:room.name,operatorId:room.operatorId})),
    archivedRooms:result.rooms.filter(room=>room.archivedAt&&room.presentationLaneId===lane.id).map(room=>({id:room.id,name:room.name,operatorId:room.operatorId})),
    publishedTo:published.filter(({pack})=>pack.lanes.includes(lane.id)).map(({operator})=>({id:operator.id,name:operator.name})),
    historicalPackageReferences:result.historyCoverage==='complete'?history.filter(row=>{try{return (typeof row.lanes==='string'?JSON.parse(row.lanes):row.lanes).includes(lane.id);}catch{fail('studio_invalid_resource_lifecycle',503);}}).length:null});
  }
  return result;
 });
 endpoint('POST','operator-lifecycle',async(context,operators)=>{
  const body=context.body;exact(body,['operatorId','archived','expectedPackageRevision','expectedAdministrationRevision']);
  if(!id(body.operatorId)||typeof body.archived!=='boolean'||!revision(body.expectedPackageRevision))fail('studio_invalid_request',400);
  validateRevision(body.expectedAdministrationRevision);
  const saved=await documents();
  if(saved.administrationRevision!==body.expectedAdministrationRevision)fail('studio_conflict');
  const {operator,pack,lifecycle}=await selected(operators,body.operatorId);
  if((pack?.revision??null)!==body.expectedPackageRevision)fail('studio_conflict');
  if(body.archived?operator.status!=='active'||lifecycle.operator!==null:operator.status!=='suspended'||lifecycle.operator===null)fail('studio_conflict');
  const archivedAt=body.archived?new Date(now()).toISOString():lifecycle.operator.archivedAt;
  lifecycle.operator=body.archived?{archivedAt}:null;
  const input=packageInput(context,operator.id,pack,structuredClone(pack?.branding??{}),{resourceType:'operator',resourceId:operator.id,archived:body.archived});
  let administrationRevision=saved.administrationRevision;
  if(body.archived||saved.administration.rooms.some(room=>room.operatorId===operator.id)){
   const administration=structuredClone(saved.administration),config=gameLaneConfiguration(administration);
   const rooms=administration.rooms.filter(room=>room.operatorId===operator.id);
   for(const room of rooms){
    const gameLane=config.gameLanes.find(row=>row.id===room.gameLaneId);
    if(!isPresentationRoom(room)||!gameLane||!pack)fail('studio_room_configuration_missing');
    if(lifecycle.rooms.some(entry=>entry.room.id===room.id))fail('studio_conflict');
    lifecycle.rooms.push({archivedAt,room:structuredClone(room),gameLane:structuredClone(gameLane),sourcePackageRevision:pack.revision});
   }
   const ids=new Set(rooms.map(room=>room.id));
   administration.rooms=administration.rooms.filter(room=>!ids.has(room.id));
   const adapters=new Set(rooms.map(room=>room.gameLaneId));
   administration.gameLanes=config.gameLanes.filter(lane=>!adapters.has(lane.id)||!lane.id.startsWith('room-lane-')||administration.rooms.some(room=>room.gameLaneId===lane.id));
   administration.gameLane=administration.gameLanes.some(lane=>lane.id===config.gameLane)?config.gameLane:administration.gameLanes[0]?.id??null;
   input.tables=input.tables.filter(value=>!ids.has(value));
   if(input.branding.roomOverrides)for(const roomId of ids)delete input.branding.roomOverrides[roomId];
   if(rooms.length)administrationRevision=(await repository.saveDocument('administration',{value:validateStudioGameAdministration(administration),expectedRevision:saved.administrationRevision,actor:context.actor.user})).revision;
  }
  // Restoring a company never republishes its rooms. Each room is restored
  // explicitly as pending through the existing room lifecycle contract.
  input.branding=withOperatorLifecycle(input.branding,lifecycle);
  const changed=await operators.changeOperatorStatus({...input,
   status:body.archived?'suspended':'active',expectedStatus:operator.status});
  return {ok:true,operator:{id:operator.id,slug:operator.slug,name:operator.name,status:changed.operator.status,archivedAt:lifecycle.operator?.archivedAt??null},administrationRevision,packageRevision:changed.package.revision};
 });
 for(const action of ['material-trash-check','material-trash'])endpoint('POST',action,async(context,operators)=>{
  const body=context.body;exact(body,['id','archived','expectedRevision',...(action==='material-trash'?['impactToken']:[])]);
  if(!id(body.id)||typeof body.archived!=='boolean')fail('studio_invalid_request',400);
  validateRevision(body.expectedRevision);
  const plan=await materialTrashPlan({repository,operators,id:body.id,archived:body.archived,expectedRevision:body.expectedRevision,now});
  if(action==='material-trash-check')return {impact:plan.impact};
  if(typeof body.impactToken!=='string'||body.impactToken!==plan.impact.token)fail('studio_conflict');
  const saved=await repository.saveDealerLifecycle(plan.project,{expectedRevision:body.expectedRevision,actor:context.actor.user});
  if(!same(plan.administration,plan.administrationDocument.value))await repository.saveDocument('administration',{
   value:validateStudioGameAdministration(plan.administration),expectedRevision:plan.administrationDocument.revision,actor:context.actor.user});
  for(const change of plan.changes)await operators.publishPackage({...change,actor:context.actor.user,audit:operatorAuditContext(context.actor)});
  return {ok:true,project:saved.value,impact:plan.impact};
 });
 endpoint('POST','room-lifecycle',async(context,operators)=>{
  const body=context.body;exact(body,['operatorId','roomId','archived','expectedAdministrationRevision','expectedPackageRevision']);
  if(!id(body.operatorId)||!id(body.roomId)||typeof body.archived!=='boolean'||!revision(body.expectedPackageRevision))fail('studio_invalid_request',400);
  validateRevision(body.expectedAdministrationRevision);
  const saved={...await documents(),...await selected(operators,body.operatorId)};
  if(saved.administrationRevision!==body.expectedAdministrationRevision||(saved.pack?.revision??null)!==body.expectedPackageRevision)fail('studio_conflict');
  if(!saved.pack)fail('studio_operator_package_missing');
  const administration=structuredClone(saved.administration),lifecycle=structuredClone(saved.lifecycle),input=packageInput(context,body.operatorId,saved.pack,saved.pack.branding,{resourceType:'room',resourceId:body.roomId,archived:body.archived});
  let room;
  if(body.archived){
   room=administration.rooms.find(row=>row.id===body.roomId);
   if(!isPresentationRoom(room)||room.operatorId!==body.operatorId)fail('studio_room_not_found',404);
   if(lifecycle.rooms.some(entry=>entry.room.id===room.id))fail('studio_conflict');
   const config=gameLaneConfiguration(administration),gameLane=config.gameLanes.find(row=>row.id===room.gameLaneId);if(!gameLane)fail('studio_room_configuration_missing');
   lifecycle.rooms.push({archivedAt:new Date(now()).toISOString(),room:structuredClone(room),gameLane:structuredClone(gameLane),sourcePackageRevision:saved.pack.revision});
   administration.rooms=administration.rooms.filter(row=>row.id!==room.id);
   // Generated playback entries have no independent purpose once their last
   // room is archived. Explicit legacy/default configurations remain intact.
   if(gameLane.id.startsWith('room-lane-')&&!administration.rooms.some(row=>row.gameLaneId===gameLane.id)){
    administration.gameLanes=config.gameLanes.filter(row=>row.id!==gameLane.id);
    administration.gameLane=config.gameLane===gameLane.id?administration.gameLanes[0]?.id??null:config.gameLane;
   }
   input.tables=input.tables.filter(value=>value!==room.id);
   input.branding=structuredClone(input.branding);if(input.branding.roomOverrides)delete input.branding.roomOverrides[room.id];
  }else{
   const entry=lifecycle.rooms.find(row=>row.room.id===body.roomId);if(!entry)fail('studio_room_not_found',404);
   const blockers=restoreBlockers(saved,entry);if(blockers.length)fail('studio_room_restore_blocked');
   room={...entry.room,state:'pending'};
   const config=gameLaneConfiguration(administration);
   if(!config.gameLanes.some(row=>row.id===entry.gameLane.id)){administration.gameLanes=[...config.gameLanes,entry.gameLane];administration.gameLane=config.gameLane??entry.gameLane.id;}
   administration.rooms.push(room);lifecycle.rooms=lifecycle.rooms.filter(row=>row.room.id!==room.id);input.tables=[...new Set([...input.tables,room.id])];
  }
  input.branding=withOperatorLifecycle(input.branding,lifecycle);
  const changed=await repository.saveDocument('administration',{value:validateStudioGameAdministration(administration),expectedRevision:saved.administrationRevision,actor:context.actor.user});
  const pack=await operators.publishPackage(input);
  return {ok:true,room:{...room,...(body.archived?{state:'archived',archivedAt:lifecycle.rooms.find(entry=>entry.room.id===room.id).archivedAt}:{archivedAt:null})},administrationRevision:changed.revision,packageRevision:pack.revision};
 });
 endpoint('POST','room-state',async(context,operators)=>{
  const body=context.body;exact(body,['operatorId','roomId','state','expectedAdministrationRevision','expectedPackageRevision']);
  if(!id(body.operatorId)||!id(body.roomId)||!['live','pending'].includes(body.state)||!revision(body.expectedPackageRevision))fail('studio_invalid_request',400);
  validateRevision(body.expectedAdministrationRevision);
  const saved={...await documents(),...await selected(operators,body.operatorId)};
  if(saved.administrationRevision!==body.expectedAdministrationRevision||(saved.pack?.revision??null)!==body.expectedPackageRevision)fail('studio_conflict');
  const room=saved.administration.rooms.find(row=>row.id===body.roomId);if(!isPresentationRoom(room)||room.operatorId!==body.operatorId)fail('studio_room_not_found',404);
  if(body.state==='live'){
   const presentation=readPackagePresentation(saved.pack),gameLane=gameLaneConfiguration(saved.administration).gameLanes.find(row=>row.id===room.gameLaneId);
   if(saved.operator.status!=='active'||!saved.pack?.tables.includes(room.id)||!presentation||!isPresentationRoomLaneCompatible(gameLane,presentation.lanes.find(row=>row.id===room.presentationLaneId),presentation,room.game??'blackjack'))fail('studio_room_activation_blocked');
  }
  room.state=body.state;
  const changed=await repository.saveDocument('administration',{value:validateStudioGameAdministration(saved.administration),expectedRevision:saved.administrationRevision,actor:context.actor.user});
  return {ok:true,room:{...room,archivedAt:null},administrationRevision:changed.revision,packageRevision:saved.pack?.revision??null};
 });
 return Object.freeze({handlers});
}
