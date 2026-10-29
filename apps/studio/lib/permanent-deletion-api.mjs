// Radera permanent: bolag, spelbord och scenmallar (Admin, `resource-delete-check` och `resource-delete`).
// Kontrollen och raderingen bygger samma plan i samma transaktion. Kontrollen svarar med vad som hindrar
// (med namn) och en token över alla revisioner; raderingen kräver samma token och objektets namn
// inskrivet, och nekar 409 `studio_resource_delete_blocked` om något hinder finns kvar.
//
// Ingen DDL och inga Blob-objekt rörs: bara rader och referenser i Neon. Historik som tillhör annat
// (andra bolags paket, spelmotorns rundor och spelinställningar) lämnas orörd.
//   spelbord  → en ny paketversion utan spelbordets papperskorgspost (journal: package.publish med
//               lifecycle.deleted) och dess sparade spelinställningsutkast i administrationen.
//   scenmall  → projektet sparas utan mallen (journal: document_history + audit_events save_document).
//   bolag     → bara ett bolag i papperskorgen som aldrig publicerat innehåll och saknar spelare: dess
//               utkast, journal, paket, medlemskap, roller och sist bolagsraden. Bolagsraden låses innan
//               planen läses (se lockOperator för vad låset garanterar). En tabell som kan peka på bolaget men inte kan läsas är ett hinder, aldrig
//               frånvaro. Journalen har FK till bolaget och en fast CHECK på åtgärden, så `operator.delete` kan inte sparas utan migrering (se PR).
import {createHash} from 'node:crypto';
import * as savedGameDocumentContract from '../../../packages/studio-registry/server/document-contract.mjs';
import {canonicalStudioJson,StudioStorageError,validateStudioScope} from '../../../packages/studio-registry/server/document-contract.mjs';
import {createOperatorStore} from '../../../packages/operators/server/operator-store.mjs';
import {readOperatorLifecycle,withOperatorLifecycle} from '../../../packages/operators/server/operator-lifecycle.mjs';
import {readPackagePresentation} from '../../../packages/presentation/server/presentation-package.mjs';
import {createSavedGamePolicy} from '../../../packages/presentation/server/saved-game-policy.mjs';
import {isPresentationRoom} from '../../../packages/presentation/contracts/presentation-room.mjs';
import {validateProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {compositionLabel} from '../../../packages/navigation/control-flow.mjs';
import {nativeFilmedPlanningMutations} from './presentation-runtime-readiness.mjs';
import {operatorAuditContext} from './operator-audit-context.mjs';
import {isStudioRole} from './studio-access-policy.mjs';

const {validateStudioGameAdministration}=createSavedGamePolicy({documentContract:savedGameDocumentContract});
const fail=(code,status=409)=>{throw new StudioStorageError(code,status);};
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value);
const KINDS=['operator','room','composition'];
// Fasta hinderkoder; klienten översätter dem och listar `items` (id och namn) under texten.
export const RESOURCE_DELETE_BLOCKERS=Object.freeze(['operator_active','operator_published','operator_rooms_in_trash','operator_api_keys','operator_players','operator_materials','operator_check_unreadable',
 'room_not_in_trash','composition_used_by_rooms','composition_used_by_archived_rooms','composition_assigned','composition_project_reference']);
const rows=result=>Array.isArray(result)?result:Array.isArray(result?.rows)?result.rows:fail('studio_storage_unavailable',503);
const parse=value=>typeof value==='string'?JSON.parse(value):value;

function bodyOf(body,withConfirmation){
 const keys=['kind','id',...(body?.kind==='room'?['operatorId']:[]),...(withConfirmation?['confirmName','token']:[])];
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!==[...keys].sort().join(','))fail('studio_invalid_request',400);
 if(!KINDS.includes(body.kind)||!id(body.id)||body.kind==='room'&&!id(body.operatorId))fail('studio_invalid_request',400);
 if(withConfirmation&&(typeof body.confirmName!=='string'||body.confirmName.length>200||typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token)))fail('studio_invalid_request',400);
 return body;
}

export function createPermanentDeletionApi({repository,scope,now=Date.now}={}){
 scope=validateStudioScope(scope);
 if(!repository?.transaction||!repository?.withTransactionClient||canonicalStudioJson(repository.scope)!==canonicalStudioJson(scope))fail('studio_storage_unavailable',503);
 const trusted=context=>{if(!isStudioRole(context.actor?.role)||typeof context.actor?.user!=='string'||!context.actor.user
  ||canonicalStudioJson(validateStudioScope(context.scope))!==canonicalStudioJson(scope))fail('studio_request_rejected',403);};
 const params=[scope.environment,scope.workspaceId];

 // The transaction client takes the scope as $1/$2 on every statement, also on catalog reads.
 const scoped='$1::text IS NOT NULL AND $2::text IS NOT NULL';
 // The catalog is readable by every role, so a lookup never poisons the transaction. 'absent' means the
 // table does not exist; 'unreadable' means it exists but this role cannot read it (schema or table).
 async function access(client,schema,table){
  const [row]=rows(await client.query(`SELECT has_schema_privilege(n.oid,'USAGE') AND has_table_privilege(c.oid,'SELECT') AS readable
   FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE ${scoped} AND n.nspname=$3 AND c.relname=$4 AND c.relkind IN ('r','p','v','m','f')`,[...params,schema,table]));
  return !row?'absent':row.readable===true?'readable':'unreadable';
 }
 async function column(client,schema,table,name){
  return rows(await client.query(`SELECT 1 FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
   JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE ${scoped} AND n.nspname=$3 AND c.relname=$4 AND a.attname=$5
   AND a.attnum>0 AND NOT a.attisdropped`,[...params,schema,table,name])).length>0;
 }
 // Bolagsraden låses innan planen läses. Det serialiserar mot Studios egna skrivningar på bolaget (status, paket,
 // roller). Spelare och API-nycklar har ingen FK till bolaget, så låset hindrar inte att sådana skapas samtidigt;
 // i praktiken fångas de av `operator_published` (spelbord kräver publicerat innehåll) och `operator_api_keys`
 // (partnerspelare kräver en nyckel). `operator_players` är en extra kontroll, inte en garanti.
 async function lockOperator(client,operatorId){
  await client.query(`SELECT 1 FROM croupier_studio.operators WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 FOR UPDATE`,[...params,operatorId]);
 }
 async function readState(operators){
  const administration=await repository.readDocument('administration'),project=await repository.readDocument('project');
  if(!administration||!project)fail('studio_document_missing',503);
  const companies=[];
  for(const operator of await operators.listOperators()){
   const pack=await operators.getCurrentPackage(operator.id);
   companies.push({operator,pack,lifecycle:readOperatorLifecycle(pack?.branding)});
  }
  return {administration,project,companies};
 }
 // The token binds every authority the plan read: both documents and each company's head and status.
 const tokenOf=(body,state)=>createHash('sha256').update(canonicalStudioJson({scope,kind:body.kind,id:body.id,operatorId:body.operatorId??null,
  project:state.project.revision,administration:state.administration.revision,
  companies:state.companies.map(({operator,pack})=>({id:operator.id,status:operator.status,revision:pack?.revision??null}))})).digest('hex');
 const named=(rows_,name=row=>row.name)=>rows_.map(row=>({id:row.id,name:name(row)}));

 async function roomPlan(state,body){
  const company=state.companies.find(row=>row.operator.id===body.operatorId);
  if(!company)fail('studio_operator_not_found',404);
  const entry=company.lifecycle.rooms.find(row=>row.room.id===body.id);
  const live=state.administration.value.rooms.find(room=>isPresentationRoom(room)&&room.id===body.id&&room.operatorId===body.operatorId);
  if(!entry&&!live)fail('studio_room_not_found',404);
  const blockers=entry?[]:[{code:'room_not_in_trash',items:[]}];
  const drafts=(Array.isArray(state.administration.value.roomGameConfigs)?state.administration.value.roomGameConfigs:[])
   .filter(row=>row?.roomId===body.id&&row?.operatorId===body.operatorId).length;
  return {name:(entry?.room??live).name,blockers,removes:{trashEntry:Boolean(entry),gameSettingsDrafts:drafts},company,entry};
 }
 async function compositionPlan(state,body){
  const lane=(state.project.value.lanes??[]).find(row=>row.id===body.id);
  if(!lane)fail('studio_composition_not_found',404);
  const companyName=operatorId=>state.companies.find(row=>row.operator.id===operatorId)?.operator.name??operatorId;
  const blockers=[];
  const rooms=state.administration.value.rooms.filter(room=>isPresentationRoom(room)&&room.presentationLaneId===lane.id);
  if(rooms.length)blockers.push({code:'composition_used_by_rooms',items:named(rooms,room=>`${room.name} (${companyName(room.operatorId)})`)});
  const archived=state.companies.flatMap(({operator,lifecycle})=>lifecycle.rooms.filter(row=>row.room.presentationLaneId===lane.id)
   .map(row=>({id:row.room.id,name:`${row.room.name} (${operator.name})`})));
  if(archived.length)blockers.push({code:'composition_used_by_archived_rooms',items:archived});
  // A suspended company's package is not served; its frozen copy keeps playing if the company is restored.
  const assigned=state.companies.filter(({operator,pack})=>operator.status==='active'&&pack?.lanes.includes(lane.id)).map(({operator})=>operator);
  if(assigned.length)blockers.push({code:'composition_assigned',items:named(assigned)});
  const next=structuredClone(state.project.value);next.lanes=(next.lanes??[]).filter(row=>row.id!==lane.id);
  let project=null;
  try{project=validateProject(next);}catch{blockers.push({code:'composition_project_reference',items:[]});}
  return {name:compositionLabel(lane.label),blockers,removes:{composition:true},project};
 }
 async function operatorPlan(state,body,client){
  const company=state.companies.find(row=>row.operator.id===body.id);
  if(!company)fail('studio_operator_not_found',404);
  const {operator,lifecycle}=company,blockers=[];
  if(operator.status==='active')blockers.push({code:'operator_active',items:[]});
  const history=rows(await client.query(`SELECT package_revision,lanes,tables,branding FROM croupier_studio.operator_packages
   WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 ORDER BY package_revision`,[...params,operator.id]));
  // Every revision counts: a version that once reached players is history other records point at.
  const published=[];
  for(const row of history){
   const lanes=parse(row.lanes),tables=parse(row.tables);let presentation=null;
   try{presentation=readPackagePresentation({branding:parse(row.branding)});}catch{presentation=true;}
   if(lanes.length||tables.length||presentation)published.push({id:String(row.package_revision),
    name:`version ${row.package_revision}: ${lanes.length} scenmallar, ${tables.length} spelbord`});
  }
  if(published.length)blockers.push({code:'operator_published',items:published});
  if(lifecycle.rooms.length)blockers.push({code:'operator_rooms_in_trash',items:named(lifecycle.rooms.map(row=>row.room))});
  const unreadable=[];
  const keyTable=await access(client,'croupier_auth','api_keys');
  if(keyTable==='unreadable')unreadable.push({id:'croupier_auth.api_keys',name:'API-nycklar'});
  else if(keyTable==='readable'&&await column(client,'croupier_auth','api_keys','operator_id')){
   const keys=rows(await client.query(`SELECT id,name FROM croupier_auth.api_keys WHERE ${scoped} AND operator_id=$3 ORDER BY id`,[...params,operator.id]));
   if(keys.length)blockers.push({code:'operator_api_keys',items:named(keys)});
  }
  // Spelare bär saldo och historik. Före game-014 saknar spelarna kolumnen operator_id; efter 014 har bara spelare
  // från backfillen den satt (nya spelare skrivs utan bolag). Partnerspelare nås därför också via sin nyckel.
  const playerTable=await access(client,'croupier_game','players');
  if(playerTable==='unreadable')unreadable.push({id:'croupier_game.players',name:'Spelare'});
  const sources=[];
  if(playerTable==='readable'&&await column(client,'croupier_game','players','operator_id'))
   sources.push('SELECT id,name FROM croupier_game.players WHERE operator_id=$3');
  if(keyTable==='readable'&&await column(client,'croupier_auth','api_keys','operator_id')){
   const mapTable=await access(client,'croupier_game','partner_players');
   if(mapTable==='unreadable')unreadable.push({id:'croupier_game.partner_players',name:'Partnerspelare'});
   else if(mapTable==='readable')sources.push(playerTable==='readable'
    ?`SELECT m.player_id AS id,coalesce(p.name,m.player_id) AS name FROM croupier_game.partner_players m JOIN croupier_auth.api_keys k ON k.id=m.key_id
     LEFT JOIN croupier_game.players p ON p.id=m.player_id WHERE k.operator_id=$3`
    :`SELECT m.player_id AS id,m.player_id AS name FROM croupier_game.partner_players m JOIN croupier_auth.api_keys k ON k.id=m.key_id WHERE k.operator_id=$3`);
  }
  if(sources.length){
   const players=rows(await client.query(`SELECT id,name,(count(*) OVER ())::integer AS total FROM (${sources.join(' UNION ')}) s
    WHERE ${scoped} ORDER BY id LIMIT 20`,[...params,operator.id]));
   const total=players[0]?.total??0,items=named(players);
   if(total>items.length)items.push({id:'more',name:`och ${total-items.length} till`});
   if(total)blockers.push({code:'operator_players',items});
  }
  const own=['operator_material_policies','operator_ai_attempts'];
  const materialTable=await access(client,'croupier_studio','operator_materials');
  if(materialTable==='unreadable')unreadable.push({id:'croupier_studio.operator_materials',name:'Bolagets material'});
  if(materialTable==='readable'){
   const materials=rows(await client.query(`SELECT DISTINCT material_id AS id FROM croupier_studio.operator_materials
    WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 ORDER BY material_id`,[...params,operator.id]));
   // Bolagets eget material pekar på Blob-objekt; att tappa journalen vore att tappa enda referensen.
   if(materials.length)blockers.push({code:'operator_materials',items:named(materials,row=>row.id)});
  }
  const count=async table=>Number(rows(await client.query(`SELECT count(*)::integer AS n FROM croupier_studio.${table}
   WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3`,[...params,operator.id]))[0].n);
  const removes={packages:history.length,journal:await count('operator_audit_events'),drafts:await count('operator_branding_drafts'),
   memberships:await count('operator_memberships'),roles:await count('operator_roles')};
  // Egna tabeller med FK till bolaget: en som finns men inte kan läsas ger annars FK-fel vid raderingen.
  const extra=[];
  for(const table of own){
   const state=await access(client,'croupier_studio',table);
   if(state==='readable')extra.push(table);
   else if(state==='unreadable')unreadable.push({id:'croupier_studio.'+table,name:table==='operator_ai_attempts'?'Bolagets AI-försök':'Bolagets materialpolicyer'});
  }
  if(unreadable.length)blockers.push({code:'operator_check_unreadable',items:unreadable});
  return {name:operator.name,blockers,removes,company,extra};
 }
 async function plan(body,operators,client){
  if(body.kind!=='composition')await lockOperator(client,body.kind==='operator'?body.id:body.operatorId);
  const state=await readState(operators);
  const result=body.kind==='room'?await roomPlan(state,body):body.kind==='composition'?await compositionPlan(state,body):await operatorPlan(state,body,client);
  return {...result,state,token:tokenOf(body,state)};
 }
 const publicPlan=(body,value)=>({kind:body.kind,id:body.id,...(body.operatorId?{operatorId:body.operatorId}:{}),name:value.name,
  allowed:value.blockers.length===0,blockers:value.blockers,removes:value.removes,token:value.token});

 async function apply(context,body,value,operators,client){
  const actor=context.actor.user;
  if(body.kind==='room'){
   const {company,entry,state}=value,pack=company.pack;
   const presentation=readPackagePresentation(pack);
   if(presentation&&repository.withMutationContext)await repository.withMutationContext(async()=>{},[{kind:'presentation-package',value:presentation},...nativeFilmedPlanningMutations(pack)]);
   const lifecycle=structuredClone(company.lifecycle);lifecycle.rooms=lifecycle.rooms.filter(row=>row.room.id!==entry.room.id);
   let administrationRevision=state.administration.revision;
   const drafts=state.administration.value.roomGameConfigs;
   if(Array.isArray(drafts)&&drafts.some(row=>row?.roomId===body.id&&row?.operatorId===body.operatorId)){
    const next={...structuredClone(state.administration.value),roomGameConfigs:drafts.filter(row=>!(row?.roomId===body.id&&row?.operatorId===body.operatorId))};
    administrationRevision=(await repository.saveDocument('administration',{value:validateStudioGameAdministration(next),expectedRevision:state.administration.revision,actor})).revision;
   }
   const saved=await operators.publishPackage({actor,audit:operatorAuditContext(context.actor),operatorId:company.operator.id,expectedRevision:pack.revision,
    lanes:[...pack.lanes],games:[...pack.games],tables:[...pack.tables],branding:withOperatorLifecycle(pack.branding,lifecycle),
    lifecycle:{resourceType:'room',resourceId:entry.room.id,archived:true,deleted:true}});
   return {packageRevision:saved.revision,administrationRevision};
  }
  if(body.kind==='composition'){
   const saved=await repository.saveDocument('project',{value:value.project,expectedRevision:value.state.project.revision,actor});
   return {projectRevision:saved.revision};
  }
  // Bolag: lås raden, radera beroenden i FK-ordning och sist bolaget, som måste vara kvar i papperskorgen.
  const operatorId=value.company.operator.id;
  const locked=rows(await client.query(`SELECT status FROM croupier_studio.operators WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 FOR UPDATE`,[...params,operatorId]));
  if(locked.length!==1||locked[0].status==='active')fail('studio_conflict');
  for(const table of ['operator_branding_drafts','operator_audit_events','operator_packages','operator_memberships','operator_roles',...value.extra])
   await client.query(`DELETE FROM croupier_studio.${table} WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3`,[...params,operatorId]);
  const removed=rows(await client.query(`DELETE FROM croupier_studio.operators WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 AND status<>'active' RETURNING operator_id`,[...params,operatorId]));
  if(removed.length!==1)fail('studio_conflict');
  return {};
 }

 const handlers=new Map();
 const endpoint=(action,handler)=>handlers.set(`POST /studio/api/admin/${action}`,async context=>{trusted(context);
  return repository.transaction(()=>repository.withTransactionClient(async client=>handler(context,client,
   await createOperatorStore({sql:client,scope,now,transaction:work=>repository.withTransactionClient(work)}))));});
 endpoint('resource-delete-check',async(context,client,operators)=>{
  const body=bodyOf(context.body,false);
  return publicPlan(body,await plan(body,operators,client));
 });
 endpoint('resource-delete',async(context,client,operators)=>{
  const body=bodyOf(context.body,true),value=await plan(body,operators,client);
  if(body.token!==value.token)fail('studio_conflict');
  if(value.blockers.length)fail('studio_resource_delete_blocked');
  if(body.confirmName.trim()!==value.name.trim())fail('studio_delete_name_mismatch');
  const result=await apply(context,body,value,operators,client);
  return {ok:true,deleted:{kind:body.kind,id:body.id,...(body.operatorId?{operatorId:body.operatorId}:{}),name:value.name},removes:value.removes,...result};
 });
 return Object.freeze({handlers});
}
