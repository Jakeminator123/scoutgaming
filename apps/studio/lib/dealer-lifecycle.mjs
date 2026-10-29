import {nativeFilmedPlanningMutations} from './presentation-runtime-readiness.mjs';
import {validateProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {isActiveDealerId} from '../../../packages/presentation/contracts/dealer-identity.mjs';
import {canonicalStudioJson,StudioStorageError,validateRevision} from '../../../packages/studio-registry/server/document-contract.mjs';
import {readPackagePresentation} from '../../../packages/presentation/server/presentation-package.mjs';
import {dealerArchiveCompositionIds,readDealerArchiveImpact,applyDealerArchiveImpact} from './dealer-archive-impact.mjs';

const fail=(code,status=409)=>{throw new StudioStorageError(code,status);};
const contains=(value,id)=>value===id||Boolean(value&&typeof value==='object'&&Object.values(value).some(item=>contains(item,id)));
const speechOff=dealer=>dealer.speechProfile?{...dealer,speechProfile:{...dealer.speechProfile,state:'preparation'}}:dealer;
export function lifecycleProject(project,{dealerId,archived,records,now=new Date().toISOString()}) {
  validateProject(project,{allowIncompatibleAnimations:true});
  const next=structuredClone(project);
  if(archived){
    const dealer=next.dealers.find(row=>row.id===dealerId);
    if(!dealer)fail('studio_dealer_missing');
    const owned=records.filter(row=>row.classification.dealerId===dealerId&&row.deletion?.state!=='deleted');
    if(owned.some(row=>row.deletion))fail('studio_media_deletion_pending');
    const mediaIds=new Set(owned.map(row=>row.id)),owns=value=>[...mediaIds].some(id=>contains(value,id));
    const compositionIds=new Set(dealerArchiveCompositionIds(next,dealerId,records));
    const entry={schemaVersion:2,dealer:speechOff(dealer),lines:next.lines.filter(row=>row.dealerId===dealerId),
      idlePolicy:next.dealerIdlePolicies?.find(row=>row.dealerId===dealerId)?.policy??null,
      compositions:(next.lanes??[]).filter(row=>compositionIds.has(row.id)),
      activeMediaIds:owned.filter(row=>!row.retainedBank&&!row.classification.archived).map(row=>row.id),archivedAt:now};
    const categories=next.dealerSets?.filter(row=>row.dealerId===dealerId)??[];
    if(categories.length){entry.dealerSets=categories;next.dealerSets=next.dealerSets.filter(row=>row.dealerId!==dealerId);if(!next.dealerSets.length)delete next.dealerSets;}
    if(next.legacyClipPolicy){
      entry.legacyClipPolicy=next.legacyClipPolicy.filter(row=>row.dealerId===dealerId||owns(row));
      next.legacyClipPolicy=next.legacyClipPolicy.filter(row=>!entry.legacyClipPolicy.includes(row));
    }
    if(next.mediaPolicy){
      entry.mediaPolicy=next.mediaPolicy.map(row=>({...row,variants:row.variants.filter(variant=>mediaIds.has(variant.videoId))})).filter(row=>row.variants.length);
      next.mediaPolicy=next.mediaPolicy.map(row=>({...row,variants:row.variants.filter(variant=>!mediaIds.has(variant.videoId))})).filter(row=>row.variants.length);
    }
    if(next.idlePolicy&&owns(next.idlePolicy)){entry.globalIdlePolicy=next.idlePolicy;delete next.idlePolicy;}
    next.dealerTrash=[...(next.dealerTrash??[]),entry];
    next.dealers=next.dealers.filter(row=>row.id!==dealerId);
    next.lines=next.lines.filter(row=>row.dealerId!==dealerId);
    if(next.lanes)next.lanes=next.lanes.filter(row=>!compositionIds.has(row.id));
    if(next.dealerIdlePolicies)next.dealerIdlePolicies=next.dealerIdlePolicies.filter(row=>row.dealerId!==dealerId);
    const {dealerTrash,...active}=next;
    // An unrelated active dealer cannot keep using this dealer's archived media.
    if(owns(active))fail('studio_media_in_use');
  }else{
    const entry=next.dealerTrash?.find(row=>row.dealer.id===dealerId);
    if(!entry||next.dealers.some(row=>row.id===dealerId))fail('studio_dealer_missing');
    if(!isActiveDealerId(dealerId))fail('studio_dealer_inactive');
    if(entry.deletion)fail('studio_dealer_delete_pending');
    const owned=new Map(records.filter(row=>row.classification.dealerId===dealerId).map(row=>[row.id,row]));
    for(const id of entry.activeMediaIds){const row=owned.get(id);if(!row||row.deletion||row.retainedBank||row.classification.archived!==true)fail('studio_dealer_restore_conflict');}
    const compositions=entry.compositions??[],activeIds=new Set((next.lanes??[]).map(row=>row.id));
    if(compositions.some(row=>activeIds.has(row.id)))fail('studio_dealer_restore_conflict');
    for(const lane of compositions)for(const role of ['background','table'])for(const id of lane.layers[role].allowed){
      if(!(next.layerAssets??[]).some(asset=>asset.id===id&&asset.role===role))fail('studio_dealer_restore_conflict');
    }
    // An archived environment's miljöbild needs no check here: validateProject above already
    // requires every trashed lane.illustration to be an `illustration` in the library.
    if(entry.dealerSets?.some(row=>next.dealerSets?.some(active=>active.id===row.id)))fail('studio_dealer_restore_conflict');
    next.dealers.push(speechOff(entry.dealer));next.lines.push(...entry.lines);
    if(entry.dealerSets?.length)next.dealerSets=[...(next.dealerSets??[]),...entry.dealerSets];
    if(compositions.length)next.lanes=[...(next.lanes??[]),...compositions];
    if(entry.idlePolicy)next.dealerIdlePolicies=[...(next.dealerIdlePolicies??[]),{dealerId,policy:entry.idlePolicy}];
    if(entry.legacyClipPolicy?.length)next.legacyClipPolicy=[...(next.legacyClipPolicy??[]),...entry.legacyClipPolicy];
    if(entry.globalIdlePolicy){if(next.idlePolicy)fail('studio_dealer_restore_conflict');next.idlePolicy=entry.globalIdlePolicy;}
    for(const family of entry.mediaPolicy??[]){
      next.mediaPolicy??=[];
      const current=next.mediaPolicy.find(row=>row.familyId===family.familyId);
      if(!current)next.mediaPolicy.push(family);
      else{if(family.variants.some(row=>current.variants.some(active=>active.videoId===row.videoId)))fail('studio_dealer_restore_conflict');current.variants.push(...family.variants);}
    }
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
export async function checkDealerArchive({repository,body}){
  if(!body||Object.keys(body).sort().join(',')!=='dealerId,expectedRevision'||typeof body.dealerId!=='string')fail('studio_invalid_request',400);
  const plan=await readDealerArchiveImpact({repository,...body});
  lifecycleProject(plan.projectDocument.value,{...body,archived:true,records:plan.records});
  return {impact:plan.impact};
}
export async function changeDealerLifecycle({repository,mutationTransaction,stillAuthorized,body}){
  if(typeof repository?.saveDealerLifecycle!=='function'||typeof mutationTransaction!=='function')fail('studio_mutation_transaction_required',503);
  const keys=body?.archived===true?'archived,dealerId,expectedRevision,impactToken':'archived,dealerId,expectedRevision';
  if(!body||Object.keys(body).sort().join(',')!==keys||typeof body.archived!=='boolean'||typeof body.dealerId!=='string'
    ||body.archived&&(typeof body.impactToken!=='string'||!(/^[a-f0-9]{64}$/).test(body.impactToken)))fail('studio_invalid_request',400);
  validateRevision(body.expectedRevision);
  const plan=body.archived?await readDealerArchiveImpact({repository,dealerId:body.dealerId,expectedRevision:body.expectedRevision}):null;
  const before=plan?.projectDocument??await repository.readDocument('project');
  if(!before||before.revision!==body.expectedRevision)fail('studio_conflict');
  if(plan&&plan.impact.token!==body.impactToken)fail('studio_conflict');
  const records=plan?.records??await repository.listMedia({limit:5000});
  const next=lifecycleProject(before.value,{...body,records});
  const cascade=body.archived||before.value.dealerTrash?.find(entry=>entry.dealer.id===body.dealerId)?.schemaVersion===2;
  const descriptors=[...(cascade?[{kind:'dealer-archive',value:next}]:[]),{kind:'project',value:next},
    ...(plan?[{kind:'administration',value:plan.administration}]:[]),
    ...(plan?.packageChanges??[]).flatMap(change=>{
      const presentation=readPackagePresentation(change);
      return [...nativeFilmedPlanningMutations(change),...(presentation?[{kind:'presentation-package',value:presentation}]:[])];
    }),
    ...records.filter(row=>row.classification.dealerId===body.dealerId&&!row.retainedBank).map(row=>({metadata:row.classification}))];
  return mutationTransaction(()=>repository.transaction(async()=>{
    const actor=await stillAuthorized();
    const current=await repository.readDocument('project');
    if(!current||current.revision!==before.revision)fail('studio_conflict');
    const currentRecords=await repository.listMedia({limit:5000});
    if(canonicalStudioJson(currentRecords)!==canonicalStudioJson(records))fail('studio_conflict');
    const owned=currentRecords.filter(row=>row.classification.dealerId===body.dealerId);
    if(body.archived){
      for(const row of owned){
        const usage=await repository.findMediaReferences(row.id);
        if(!Array.isArray(usage?.references))fail('studio_media_delete_coverage_incomplete',503);
        if(usage.references.some(ref=>!ref.historical&&!['project','administration'].includes(ref.kind)))fail('studio_media_in_use');
      }
      await applyDealerArchiveImpact({repository,dealerId:body.dealerId,expectedRevision:body.expectedRevision,impactToken:body.impactToken,actor});
    }
    const entry=body.archived?next.dealerTrash.find(row=>row.dealer.id===body.dealerId):before.value.dealerTrash.find(row=>row.dealer.id===body.dealerId);
    const activeIds=new Set(entry.activeMediaIds);
    // Both writes use the outer repository.transaction's one SQL client.
    // Archive detaches category links before media classification; any failure
    // rolls back the document, media, history and audit. Restore reverses this.
    const saved=body.archived?await repository.saveDealerLifecycle(next,{expectedRevision:before.revision,actor}):null;
    for(const row of owned)if(activeIds.has(row.id))await repository.classifyMedia(row.id,{sha256:row.sha256,expectedRevision:row.revision,metadata:{...row.classification,archived:body.archived},actor});
    return (saved??await repository.saveDealerLifecycle(next,{expectedRevision:before.revision,actor})).value;
  }),{presentationMutation:descriptors});
}
