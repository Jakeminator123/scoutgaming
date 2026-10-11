import {DEALER_IDS,validateProject} from './studio-model.mjs';
import {dealerRemovalStatus} from './dealer-removal.mjs';
import {canonicalStudioJson,StudioStorageError,validateRevision} from '../../web/storage/studio-contract.mjs';
import {readPackagePresentation} from '../../web/storage/presentation-package.mjs';

const fail=(code,status=409)=>{throw new StudioStorageError(code,status);};
const contains=(value,id)=>value===id||value&&typeof value==='object'&&Object.values(value).some(item=>contains(item,id));
export function lifecycleProject(project,{dealerId,archived,records,now=new Date().toISOString()}) {
  validateProject(project,{allowIncompatibleAnimations:true});
  if(DEALER_IDS.includes(dealerId))fail('studio_dealer_base_protected');
  const next=structuredClone(project);
  if(archived){
    const status=dealerRemovalStatus(project,dealerId);
    if(status.kind!=='ready')fail(status.kind==='missing'?'studio_dealer_missing':'studio_dealer_in_use');
    const dealer=next.dealers.find(row=>row.id===dealerId);
    if(dealer.speechProfile?.state==='enabled')fail('studio_dealer_speech_enabled');
    const owned=records.filter(row=>row.classification.dealerId===dealerId&&row.deletion?.state!=='deleted');
    if(owned.some(row=>row.retainedBank||row.deletion))fail('studio_media_deletion_pending');
    next.dealerTrash=[...(next.dealerTrash??[]),{schemaVersion:1,dealer,
      lines:next.lines.filter(row=>row.dealerId===dealerId),
      idlePolicy:next.dealerIdlePolicies?.find(row=>row.dealerId===dealerId)?.policy??null,
      activeMediaIds:owned.filter(row=>!row.classification.archived).map(row=>row.id),archivedAt:now}];
    next.dealers=next.dealers.filter(row=>row.id!==dealerId);
    next.lines=next.lines.filter(row=>row.dealerId!==dealerId);
    if(next.dealerIdlePolicies)next.dealerIdlePolicies=next.dealerIdlePolicies.filter(row=>row.dealerId!==dealerId);
    const {dealerTrash,...active}=next;
    if(owned.some(row=>contains(active,row.id)))fail('studio_media_in_use');
  }else{
    const entry=next.dealerTrash?.find(row=>row.dealer.id===dealerId);
    if(!entry||next.dealers.some(row=>row.id===dealerId))fail('studio_dealer_missing');
    if(entry.deletion)fail('studio_dealer_delete_pending');
    const owned=new Map(records.filter(row=>row.classification.dealerId===dealerId).map(row=>[row.id,row]));
    for(const id of entry.activeMediaIds){const row=owned.get(id);if(!row||row.deletion||row.retainedBank||row.classification.archived!==true)fail('studio_dealer_restore_conflict');}
    next.dealers.push(entry.dealer);next.lines.push(...entry.lines);
    if(entry.idlePolicy)next.dealerIdlePolicies=[...(next.dealerIdlePolicies??[]),{dealerId,policy:entry.idlePolicy}];
    next.dealerTrash=next.dealerTrash.filter(row=>row.dealer.id!==dealerId);
  }
  try{return validateProject(next,{allowIncompatibleAnimations:true});}catch{fail('studio_dealer_restore_conflict');}
}
export function assertLifecyclePackages(rows,{dealerId,mediaIds=[]}){
  if(!Array.isArray(rows))fail('studio_media_delete_coverage_incomplete',503);
  for(const row of rows){
    let pack,presentation;
    try{
      pack={lanes:typeof row.lanes==='string'?JSON.parse(row.lanes):row.lanes,branding:typeof row.branding==='string'?JSON.parse(row.branding):row.branding};
      if(!Array.isArray(pack.lanes)||!pack.branding||typeof pack.branding!=='object'||Array.isArray(pack.branding))throw Error();
      presentation=readPackagePresentation(pack);
    }catch{fail('studio_media_delete_coverage_incomplete',503);}
    if(dealerId&&(contains(pack,dealerId)||contains(presentation,dealerId)))fail('studio_dealer_published');
    if(mediaIds.some(id=>contains(pack,id)||contains(presentation,id)))fail('studio_media_published');
  }
}
export async function changeDealerLifecycle({repository,mutationTransaction,stillAuthorized,body}){
  if(typeof repository?.saveDealerLifecycle!=='function'||typeof repository.listLifecyclePackages!=='function'||typeof mutationTransaction!=='function')fail('studio_mutation_transaction_required',503);
  if(!body||Object.keys(body).sort().join(',')!=='archived,dealerId,expectedRevision'||typeof body.archived!=='boolean'||typeof body.dealerId!=='string')fail('studio_invalid_request',400);
  validateRevision(body.expectedRevision);
  const before=await repository.readDocument('project');
  if(!before||before.revision!==body.expectedRevision)fail('studio_conflict');
  const records=await repository.listMedia({limit:5000});
  const next=lifecycleProject(before.value,{...body,records});
  return mutationTransaction(()=>repository.transaction(async()=>{
    const actor=await stillAuthorized();
    const current=await repository.readDocument('project');
    if(!current||current.revision!==before.revision)fail('studio_conflict');
    const currentRecords=await repository.listMedia({limit:5000});
    if(canonicalStudioJson(currentRecords)!==canonicalStudioJson(records))fail('studio_conflict');
    const owned=currentRecords.filter(row=>row.classification.dealerId===body.dealerId);
    const administration=await repository.readDocument('administration');
    if(!administration)fail('studio_document_missing',503);
    if(body.archived){
      if(contains(administration.value,body.dealerId))fail('studio_dealer_in_use');
      assertLifecyclePackages(await repository.listLifecyclePackages(),{dealerId:body.dealerId,mediaIds:owned.map(row=>row.id)});
      for(const row of owned){
        const usage=await repository.findMediaReferences(row.id);
        if(!Array.isArray(usage?.references))fail('studio_media_delete_coverage_incomplete',503);
        if(usage.references.some(ref=>!ref.historical&&ref.kind!=='project'))fail('studio_media_in_use');
      }
    }
    const activeIds=new Set(body.archived?owned.filter(row=>!row.classification.archived).map(row=>row.id):before.value.dealerTrash.find(entry=>entry.dealer.id===body.dealerId).activeMediaIds);
    for(const row of owned)if(activeIds.has(row.id))await repository.classifyMedia(row.id,{sha256:row.sha256,expectedRevision:row.revision,metadata:{...row.classification,archived:body.archived},actor});
    return (await repository.saveDealerLifecycle(next,{expectedRevision:before.revision,actor})).value;
  }),{presentationMutation:[{kind:'project',value:next},...records.filter(row=>row.classification.dealerId===body.dealerId).map(row=>({metadata:row.classification}))]});
}
