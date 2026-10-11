import {StudioStorageError,validateMediaId,validateRevision,validateDocumentValue,canonicalStudioJson} from '../../web/storage/studio-contract.mjs';
import {assertLifecyclePackages} from './dealer-lifecycle.mjs';
import {readMediaBlobIndex} from './media-blob-index.mjs';
import {isCloudMediaConfigured,purgeManagedMedia} from './cloud-media-store.mjs';
const fail=(code,status=409)=>{throw new StudioStorageError(code,status);};
const denied=reason=>({allowed:false,reason});
const contains=(value,id,path)=>value===id||typeof value==='string'&&value.includes(path)||value&&typeof value==='object'&&Object.values(value).some(item=>contains(item,id,path));
function validateInput(body){
 if(!body||Object.keys(body).sort().join(',')!=='expectedRevision,id,sha256')fail('studio_invalid_request',400);
 validateMediaId(body.id);validateRevision(body.expectedRevision);
 if(typeof body.sha256!=='string'||!(/^[a-f0-9]{64}$/).test(body.sha256))fail('studio_invalid_request',400);
}
function withoutTrashMembership(value,id){
 const next=structuredClone(value);
 // This list is lifecycle bookkeeping, not a playable binding. Permanent
 // deletion explicitly relinquishes restoration of this one unused upload.
 if(next.dealerTrash)for(const entry of next.dealerTrash)entry.activeMediaIds=entry.activeMediaIds.filter(value=>value!==id);
 return next;
}
async function eligibility(repository,row,{indexVerified=false,now=Date.now,ignoreTrashDealer=null}={}){
 if(row.retainedBank)return denied('studio_retained_media_immutable');
 if(row.deletion?.state==='deleted')return denied('studio_media_already_deleted');
 if(row.classification.archived!==true)return denied('studio_media_archive_required');
 if(!row.deletion){
  const registered=typeof repository.mediaRegisteredAt==='function'?await repository.mediaRegisteredAt(row.id):null;
  const at=Date.parse(registered??row.updatedAt);if(!Number.isFinite(at))return denied('studio_media_delete_coverage_incomplete');
  // Upload tokens are path-bound, non-overwriting, valid for 15 minutes and
  // issued before registration. Old rows without registration audit use the latest change conservatively.
  const remaining=at+15*60*1000-now();
  if(remaining>0)return {...denied('studio_media_upload_grant_active'),retryAfterMs:remaining};
 }
 if(typeof repository.inspectMediaDeletion!=='function')return denied('studio_media_delete_coverage_incomplete');
 const dependencies=await repository.inspectMediaDeletion(row);
 if(!Array.isArray(dependencies?.documents)||!Array.isArray(dependencies.packages)||!Array.isArray(dependencies.aliases))return denied('studio_media_delete_coverage_incomplete');
 if(dependencies.aliases.length)return denied('studio_media_owned_elsewhere');
 for(const doc of dependencies.documents){
  let value;try{value=validateDocumentValue(doc.kind,doc.value,doc.revision,{allowLegacyRead:true});}catch{return denied('studio_media_delete_coverage_incomplete');}
  if(doc.kind==='project'&&doc.environment_id===repository.scope.environment&&doc.workspace_id===repository.scope.workspaceId){
    value=withoutTrashMembership(value,row.id);
    if(ignoreTrashDealer)value.dealerTrash=(value.dealerTrash??[]).filter(entry=>entry.dealer.id!==ignoreTrashDealer);
    else if(value.dealerTrash?.some(entry=>entry.deletion?.mediaIds.includes(row.id)))return denied('studio_dealer_delete_pending');
  }
  if(contains(value,row.id,row.pathname))return denied('studio_media_in_use');
 }
 try{assertLifecyclePackages(dependencies.packages,{mediaIds:[row.id,row.pathname]});}
 catch(error){if(error.code==='studio_media_published')return denied(error.code);throw error;}
 // Only current references are owners. Historical drafts may remain readable,
 // but later activation must pass the current registry/binding/tombstone checks.
 return indexVerified?{allowed:true}:denied('studio_media_delete_coverage_incomplete');
}
export async function checkPermanentMediaDeletion(repository,body,options={}){
 validateInput(body);
 return repository.transaction(async()=>{
  const row=await repository.getMedia(body.id);
  if(!row)fail('studio_media_missing',404);
  if(row.revision!==body.expectedRevision||row.sha256!==body.sha256)fail('studio_conflict');
  return eligibility(repository,row,options);
 },{readOnly:true});
}
export function createStudioMediaDeletion({repository,mutationTransaction,env=process.env,options={},now=Date.now,
 readIndex=readMediaBlobIndex,purge=purgeManagedMedia}={}){
 const mediaOptions={...options,env:Object.freeze({...env})};
 function verifiedIndex(){
  if(!isCloudMediaConfigured(mediaOptions.env))fail('studio_media_delete_coverage_incomplete',503);
  let index;try{index=readIndex(mediaOptions);}catch{fail('studio_media_delete_coverage_incomplete',503);}
  if(!(index instanceof Map))fail('studio_media_delete_coverage_incomplete',503);
  for(const row of index.values())if(/^croupier\/media\/dealers\/[^/]+\/review\/uploads\//.test(row.storage?.pathname??''))fail('studio_media_delete_coverage_incomplete',503);
  return true;
 }
 const descriptor={kind:'project',value:{dealerTrash:[]}};
 async function dealerPlan(body,indexVerified){
  if(!body||Object.keys(body).sort().join(',')!=='dealerId,expectedRevision'||typeof body.dealerId!=='string')fail('studio_invalid_request',400);
  validateRevision(body.expectedRevision);
  const saved=await repository.readDocument('project');
  if(!saved||saved.revision!==body.expectedRevision)fail('studio_conflict');
  const entry=saved.value.dealerTrash?.find(row=>row.dealer.id===body.dealerId);
  if(!entry)fail('studio_dealer_missing');
  const rows=(await repository.listMedia({limit:5000})).filter(row=>row.classification.dealerId===body.dealerId).sort((a,b)=>a.pathname.localeCompare(b.pathname));
  const count=rows.filter(row=>row.deletion?.state!=='deleted').length;
  const result=reason=>({saved,entry,rows,result:{...reason,count}});
  // Drain uncommitted grants too, before the dealer ID can become reusable.
  const remaining=Date.parse(entry.archivedAt)+15*60*1000-now();
  if(!Number.isFinite(remaining))return result(denied('studio_media_delete_coverage_incomplete'));
  if(remaining>0)return result({...denied('studio_media_upload_grant_active'),retryAfterMs:remaining});
  if(entry.deletion && (entry.deletion.mediaIds.some(id=>!rows.some(row=>row.id===id)) || rows.some(row=>row.deletion?.state!=='deleted'&&!entry.deletion.mediaIds.includes(row.id))))return result(denied('studio_media_delete_coverage_incomplete'));
  const administration=await repository.readDocument('administration');if(!administration)fail('studio_document_missing',503);
  const hasDealer=value=>value===body.dealerId||value&&typeof value==='object'&&Object.values(value).some(hasDealer);
  if(hasDealer(administration.value))return result(denied('studio_dealer_in_use'));
  try{assertLifecyclePackages(await repository.listLifecyclePackages(),{dealerId:body.dealerId});}catch(error){if(error.code==='studio_dealer_published')return result(denied(error.code));throw error;}
  for(const row of rows){
    if(row.retainedBank)return result(denied('studio_retained_media_immutable'));
    if(row.deletion?.state==='deleted')continue;
    const check=await eligibility(repository,row,{indexVerified,now,ignoreTrashDealer:body.dealerId});
    if(!check.allowed)return result(check);
  }
  return result({allowed:true});
 }
 async function finishOne(row,stillAuthorized){
  await stillAuthorized();await purge(row,mediaOptions);
  return mutationTransaction(()=>repository.withMediaObjectLock(row.id,async current=>{
    const actor=await stillAuthorized();
    if(current.sha256!==row.sha256||current.pathname!==row.pathname)fail('studio_conflict');
    if(current.deletion?.state==='deleted')return current;
    if(current.deletion?.state!=='pending')fail('studio_conflict');
    return repository.setMediaDeletion(current.id,{sha256:current.sha256,expectedRevision:current.revision,actor,
      deletion:{...current.deletion,state:'deleted',completedAt:new Date(Math.max(now(),Date.parse(current.deletion.requestedAt))).toISOString()}});
  }),{presentationMutation:descriptor});
 }
 return Object.freeze({
  async checkDealer(body){const verified=verifiedIndex();return repository.transaction(async()=>(await dealerPlan(body,verified)).result,{readOnly:true});},
  async removeDealer(body,{stillAuthorized}={}){
   const verified=verifiedIndex();
   if(typeof mutationTransaction!=='function'||typeof stillAuthorized!=='function')fail('studio_mutation_transaction_required',503);
   const batch=await mutationTransaction(()=>repository.transaction(async()=>{
    const actor=await stillAuthorized();
    const owned=(await repository.listMedia({limit:5000})).filter(row=>row.classification.dealerId===body?.dealerId).sort((a,b)=>a.pathname.localeCompare(b.pathname));
    for(const row of owned)await repository.withMediaObjectLock(row.id,async()=>{});
    const plan=await dealerPlan(body,verified);if(!plan.result.allowed)fail(plan.result.reason);
    if(plan.entry.deletion)return structuredClone(plan.entry.deletion);
    const deletion={state:'pending',requestedAt:new Date(now()).toISOString(),mediaIds:plan.rows.filter(row=>row.deletion?.state!=='deleted').map(row=>row.id)};
    // All candidate objects pass BEFORE the first tombstone or external delete.
    for(const row of plan.rows)if(!row.deletion)await repository.setMediaDeletion(row.id,{expectedRevision:row.revision,sha256:row.sha256,actor,deletion:{state:'pending',requestedAt:deletion.requestedAt}});
    const next=structuredClone(plan.saved.value);next.dealerTrash.find(row=>row.dealer.id===body.dealerId).deletion=deletion;
    await repository.saveDealerLifecycle(next,{expectedRevision:plan.saved.revision,actor});
    return deletion;
   }),{presentationMutation:descriptor});
   try{
    for(const id of batch.mediaIds){const row=await repository.getMedia(id);if(!row||row.classification.dealerId!==body.dealerId)fail('studio_conflict');if(row.deletion?.state==='deleted')continue;await finishOne(row,stillAuthorized);}
    return await mutationTransaction(()=>repository.transaction(async()=>{
      const actor=await stillAuthorized(),saved=await repository.readDocument('project');if(!saved)fail('studio_document_missing',503);
      const entry=saved.value.dealerTrash?.find(row=>row.dealer.id===body.dealerId);
      if(!entry)return saved.value;
      if(canonicalStudioJson(entry.deletion)!==canonicalStudioJson(batch))fail('studio_conflict');
      for(const id of batch.mediaIds)if((await repository.getMedia(id))?.deletion?.state!=='deleted')fail('studio_dealer_delete_pending',503);
      const next=structuredClone(saved.value);next.dealerTrash=next.dealerTrash.filter(row=>row.dealer.id!==body.dealerId);
      return (await repository.saveDealerLifecycle(next,{expectedRevision:saved.revision,actor})).value;
    }),{presentationMutation:descriptor});
   }catch(error){if(error?.statusCode===403)throw error;fail('studio_dealer_delete_pending',503);}
  },
  async check(body){const indexVerified=verifiedIndex();return checkPermanentMediaDeletion(repository,body,{indexVerified,now});},
  async remove(body,{stillAuthorized}={}){
   validateInput(body);const indexVerified=verifiedIndex();
   if(typeof mutationTransaction!=='function'||typeof stillAuthorized!=='function'||typeof repository.withMediaObjectLock!=='function'||typeof repository.setMediaDeletion!=='function')fail('studio_mutation_transaction_required',503);
   const pending=await mutationTransaction(()=>repository.withMediaObjectLock(body.id,async row=>{
    const actor=await stillAuthorized();
    if(row.revision!==body.expectedRevision||row.sha256!==body.sha256)fail('studio_conflict');
    if(row.deletion?.state==='deleted')return row;
    const result=await eligibility(repository,row,{indexVerified,now});if(!result.allowed)fail(result.reason);
    if(row.deletion?.state==='pending')return row;
    const saved=await repository.readDocument('project');if(!saved)fail('studio_document_missing',503);
    const next=withoutTrashMembership(saved.value,row.id);next.dealerTrash??=[];
    const marked=await repository.setMediaDeletion(row.id,{sha256:row.sha256,expectedRevision:row.revision,actor,deletion:{state:'pending',requestedAt:new Date(now()).toISOString()}});
    // Invalidates old prepared PUT/publication before the external delete. The
    // v5 field also makes old readers fail closed instead of ignoring tombstones.
    await repository.saveDealerLifecycle(next,{expectedRevision:saved.revision,actor});
    return marked;
   }),{presentationMutation:descriptor});
   if(pending.deletion.state==='deleted')return pending;
   await stillAuthorized();
   try{await purge(pending,mediaOptions);}catch{fail('studio_media_delete_failed',503);}
   return mutationTransaction(()=>repository.withMediaObjectLock(body.id,async row=>{
    const actor=await stillAuthorized();
    if(row.sha256!==pending.sha256||row.pathname!==pending.pathname)fail('studio_conflict');
    if(row.deletion?.state==='deleted')return row;
    if(row.revision!==pending.revision||canonicalStudioJson(row.deletion)!==canonicalStudioJson(pending.deletion))fail('studio_conflict');
    return repository.setMediaDeletion(row.id,{sha256:row.sha256,expectedRevision:row.revision,actor,
      deletion:{...row.deletion,state:'deleted',completedAt:new Date(Math.max(now(),Date.parse(row.deletion.requestedAt))).toISOString()}});
   }),{presentationMutation:descriptor});
  }
 });
}
