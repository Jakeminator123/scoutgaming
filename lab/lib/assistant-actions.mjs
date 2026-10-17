import {createStudioMediaApi} from './studio-media-api.mjs';
import {addDealer} from '../../packages/presentation/contracts/studio-model.mjs';
import {createHash} from 'node:crypto';
import {canonicalStudioJson} from '../../packages/studio-registry/server/document-contract.mjs';
import {createStudioDealerApi} from './studio-dealer-api.mjs';
import {createStudioDocumentApi} from './studio-document-api.mjs';
import {assistantRequest,assistantRead,assistantWrite,assistantServices} from './assistant-context.mjs';
import {validateAssistantProposal,assistantFailure as fail} from './assistant-model.mjs';

export const assistantDigest=value=>createHash('sha256').update(canonicalStudioJson(value)).digest('hex');
const name=row=>String(row?.label??row?.name??row?.id??'').slice(0,180);
async function dealerMediaSignature(runtime,id){
  const rows=await runtime.repository.listMedia({limit:5000});
  if(rows.length>=5000)fail('assistant_delete_blocked',409);
  return assistantDigest(rows.filter(row=>row.classification.dealerId===id).map(row=>({
    id:row.id,sha256:row.sha256,pathname:row.pathname,classification:row.classification,
  })).sort((a,b)=>a.id.localeCompare(b.id)));
}
const required=value=>{if(!value)fail('assistant_target_unavailable',409);return value;};
export async function prepareAssistantAction(runtime,request,proposal,{services=assistantServices(runtime)}={}){
  validateAssistantProposal(proposal);
  const {action,targetId,value}=proposal;
  if(!['resource.rename','openclaw.model','dealer.create','media.rename'].includes(action)&&value!==null)fail('assistant_invalid_proposal');
  let path,method='POST',body,impact,label,kind='admin',permanent=false,mediaSignature=null;
  if(action==='openclaw.model'){
    const current=await services.openclaw(request),agent=required(current.agents.find(row=>row.id===targetId));
    if(!current.models.some(row=>row.id===value))fail('assistant_model_not_in_gateway',422);
    if(agent.model.primary===value&&!agent.model.fallbacks.length)fail('assistant_no_change',409);
    body={version:1,baseHash:current.baseHash,agentId:targetId,model:{primary:value,fallbacks:[]}};
    kind='openclaw';method='PATCH';path='/openclaw/admin';label=targetId;
    impact={before:agent.model,after:body.model,notice:'Byter agentens modell och tar bort reservmodeller. Gateway kan startas om. Övriga agenters modeller och verktygsbehörigheter ändras inte.'};
  }else if(action.startsWith('media.')){
    const row=required(await runtime.repository.getMedia(targetId));
    if(row.retainedBank||row.deletion)fail('assistant_target_unavailable',409);
    label=name(row.classification);kind='media';permanent=action==='media.delete';
    if(permanent){
      body={id:targetId,sha256:row.sha256,expectedRevision:row.revision};
      const check=await assistantRead(await createStudioMediaApi(runtime).handle(assistantRequest(request,runtime,'/videos/delete-check','POST',body)));
      if(check.allowed!==true)fail('assistant_delete_blocked',409);
      path='/videos/delete';impact={notice:'Raderar denna arkiverade fil permanent från lagringen. Kan inte ångras. Befintlig beroendekontroll måste godkänna den.',dealerId:row.classification.dealerId};
      mediaSignature=assistantDigest({id:row.id,sha256:row.sha256,pathname:row.pathname,classification:row.classification});
    }else if(action==='media.rename'){
      if(row.classification.familyId)fail('assistant_media_immutable',409);
      if(typeof value!=='string'||!value.trim()||value.trim().length>100)fail('assistant_invalid_proposal');
      if(label===value.trim())fail('assistant_no_change',409);
      path='/videos/classify';body={id:targetId,sha256:row.sha256,previous:row.classification,metadata:{...row.classification,label:value.trim()}};
      impact={before:label,after:value.trim(),notice:'Byter klippets namn i det sparade mediaregistret. Filens bytes och placering bevaras.'};
    }else{
      const archived=action==='media.archive';
      if(Boolean(row.classification.archived)===archived)fail('assistant_no_change',409);
      const usage=await runtime.repository.findMediaReferences(targetId);
      if(!Array.isArray(usage?.references))fail('assistant_dependency_unavailable',503);
      if(archived&&usage.references.some(item=>!item.historical))fail('assistant_media_in_use',409);
      path='/videos/archive';body={id:targetId,sha256:row.sha256,previous:row.classification,archived};
      impact={dealerId:row.classification.dealerId,notice:archived?'Flyttar det oanvända klippet till papperskorgen. Fil och historik finns kvar.':'Återställer klippet till biblioteket. Ingen placering i spel väljs automatiskt.'};
    }
  }else if(action.startsWith('dealer.')||action.startsWith('material.')||action==='resource.rename'){
    const saved=required(await runtime.repository.readDocument('project')),p=saved.value;
    if(action==='dealer.create'){
      if(typeof value!=='string'||!value.trim()||value.trim().length>100)fail('assistant_invalid_proposal');
      let next;try{next=addDealer(p,targetId,value.trim());}catch{fail('assistant_invalid_dealer',422);}
      label=value.trim();kind='document';path='/project';method='PUT';body={project:next,expectedRevision:saved.revision};
      impact={after:label,dealerId:targetId,notice:'Registrerar en ny dealer med tomma klippfack. Kopierar inga filmer och lägger inte till dealern i något rum. Du kan sedan ladda upp filer.'};
    }else if(action==='resource.rename'){

      if(typeof value!=='string'||!value.trim()||value.length>100)fail('assistant_invalid_proposal');
      const matches=[...(p.dealers??[]),...(p.layerAssets??[]),...(p.lanes??[])].filter(row=>row.id===targetId);
      if(matches.length!==1)fail('assistant_target_ambiguous',409);
      label=name(matches[0]);if(label===value.trim())fail('assistant_no_change',409);
      const next=structuredClone(p);
      [...(next.dealers??[]),...(next.layerAssets??[]),...(next.lanes??[])].find(row=>row.id===targetId).label=value.trim();
      kind='document';path='/project';method='PUT';body={project:next,expectedRevision:saved.revision};
      impact={before:label,after:value.trim(),notice:'Ändrar endast namnet på den valda dealern, det valda materialet eller sammansättningen. Sparas som en ny granskad projektversion.'};
    }else if(action.startsWith('dealer.')){
      const restore=action==='dealer.restore';permanent=action==='dealer.delete';
      const row=required(restore||permanent?p.dealerTrash?.find(row=>row.dealer.id===targetId)?.dealer:p.dealers?.find(row=>row.id===targetId));
      label=name(row);kind='dealer';body={dealerId:targetId,expectedRevision:saved.revision};
      const api=createStudioDealerApi(runtime);
      if(permanent){
        const check=await assistantRead(await api.handle(assistantRequest(request,runtime,'/dealers/delete-check','POST',body)));
        if(check.allowed!==true)fail('assistant_delete_blocked',409);
        mediaSignature=await dealerMediaSignature(runtime,targetId);
        path='/dealers/delete';impact={...check,notice:'Permanent radering av dealer och dess raderbara filer. Kan inte ångras. Publicerad historik och skyddade filer får inte raderas.'};
      }else{
        let check;
        if(!restore)check=await assistantRead(await api.handle(assistantRequest(request,runtime,'/dealers/archive-check','POST',body)));
        body={...body,archived:!restore,...(!restore?{impactToken:check.impact.token}:{})};
        path='/dealers/archive';
        const compositions=restore?p.dealerTrash?.find(entry=>entry.dealer.id===targetId)?.compositions??[]:[];
        impact=restore?{notice:`Dealern, materialet och sparade sammansättningar återförs som utkast. Sparade sammansättningar (${compositions.length}): ${compositions.map(name).join(', ')||'inga'}. AI-tal förblir avstängt. Rum återställs eller öppnas inte automatiskt.`}:{...check.impact,notice:'Dealern och berörda kopplingar flyttas till papperskorgen. Se alla berörda rum och bolag nedan. Historik och källfiler bevaras.'};
      }
    }else{
      const archived=action==='material.archive';
      const row=required(archived?p.layerAssets?.find(row=>row.id===targetId):p.layerAssetTrash?.find(row=>row.asset.id===targetId)?.asset);
      label=name(row);body={id:targetId,archived,expectedRevision:saved.revision};
      const check=await services.admin(request,'material-trash-check','POST',body);
      path='/admin/material-trash';body={...body,impactToken:check.impact.token};
      impact={...check.impact,notice:archived?'Flyttas till papperskorgen och lossas från aktiva rum/sammansättningar. Källfil och publicerad historik bevaras.':'Återställs som ett fristående materialval. Tidigare kopplingar återställs inte automatiskt.'};
    }
  }else{
    const saved=await services.admin(request,'resource-lifecycle');
    if(action.startsWith('company.')){
      const row=required(saved.operators.find(row=>row.id===targetId)),archived=action==='company.archive';
      if(archived?row.status!=='active':!row.archivedAt)fail('assistant_no_change',409);
      label=name(row);path='/admin/operator-lifecycle';
      body={operatorId:targetId,archived,expectedPackageRevision:row.packageRevision,expectedAdministrationRevision:saved.administrationRevision};
      impact={rooms:saved.rooms.filter(room=>room.operatorId===targetId&&!room.archivedAt).map(({id,name})=>({id,name})),
        notice:archived?'Bolaget stängs av och dess aktiva rum flyttas till papperskorgen.':'Bolaget återställs. Dess rum förblir stängda tills de återställs separat.'};
    }else{
      const row=required(saved.rooms.find(row=>row.id===targetId));label=name(row);
      body={operatorId:row.operatorId,roomId:targetId,expectedPackageRevision:row.packageRevision,expectedAdministrationRevision:saved.administrationRevision};
      if(['room.open','room.pause'].includes(action)){
        if(row.archivedAt)fail('assistant_target_unavailable',409);
        const state=action==='room.open'?'live':'pending';if(row.state===state)fail('assistant_no_change',409);
        path='/admin/room-state';body={...body,state};impact={before:row.state,after:state,notice:state==='live'?'Öppnar det publicerade rummet för spelare. Befintliga publiceringskontroller gäller.':'Stänger rummet för nya spelstarter.'};
      }else{
        const archived=action==='room.archive';
        if(archived?!row.canArchive:!row.canRestore)fail('assistant_target_unavailable',409);
        path='/admin/room-lifecycle';body={...body,archived};
        impact={operatorId:row.operatorId,notice:archived?'Rummet flyttas till papperskorgen och tas bort från aktiva publiceringar.':'Rummet återställs stängt; öppning kräver en separat åtgärd.'};
      }
    }
  }
  // No secret or executable content in the review UI; fingerprint binds the
  // FULL command and impact, including every current dependency/revision.
  const plan={kind,path,method,body,impact,label,permanent,mediaSignature};
  const visibleImpact=structuredClone(impact);delete visibleImpact.token;
  return {plan,review:{action,targetId,label,permanent,impact:visibleImpact,
    confirmation:permanent?'RADERA '+targetId:targetId,
    question:`Är du säker på att du vill ${action==='dealer.create'?'skapa dealern':action==='resource.rename'||action==='media.rename'?'byta namn på':action==='openclaw.model'?'byta modell för':action.endsWith('.restore')?'återställa':action.endsWith('.open')?'öppna':action.endsWith('.pause')?'stänga':permanent?'permanent radera':'flytta till papperskorgen'} "${label}"?`},
    fingerprint:assistantDigest(plan)};
}
export async function executeAssistantAction(runtime,request,prepared,{services=assistantServices(runtime)}={}){
  const {kind,path,method,body}=prepared.plan;
  if(kind==='openclaw')return services.openclaw(request,method,body);
  if(kind==='media'){
    let guarded=runtime;
    if(prepared.plan.permanent)guarded={...runtime,mediaDeletion:{...runtime.mediaDeletion,
      remove:(input,options)=>runtime.mediaDeletion.remove(input,{...options,stillAuthorized:async()=>{
        const actor=await options.stillAuthorized(),row=required(await runtime.repository.getMedia(input.id));
        if(assistantDigest({id:row.id,sha256:row.sha256,pathname:row.pathname,classification:row.classification})!==prepared.plan.mediaSignature)fail('assistant_review_changed',409);
        return actor;
      }})}};
    return assistantWrite(await createStudioMediaApi(guarded).handle(assistantRequest(request,runtime,path,method,body)));
  }
  if(kind==='dealer'&&prepared.plan.permanent){
    // Verify exact objects again INSIDE the existing tombstone transaction and
    // before each external purge. Our own tombstones change revisions, not
    // object identity/classification. Fresh uploads/edits invalidate approval.
    const guarded={...runtime,mediaDeletion:{...runtime.mediaDeletion,
      removeDealer:(input,options)=>runtime.mediaDeletion.removeDealer(input,{...options,stillAuthorized:async()=>{
        const actor=await options.stillAuthorized();
        if(await dealerMediaSignature(runtime,input.dealerId)!==prepared.plan.mediaSignature)fail('assistant_review_changed',409);
        return actor;
      }})}};
    return assistantWrite(await createStudioDealerApi(guarded).handle(assistantRequest(request,runtime,path,method,body)));
  }
  if(kind==='dealer')return assistantWrite(await createStudioDealerApi(runtime).handle(assistantRequest(request,runtime,path,method,body)));
  if(kind==='document')return assistantWrite(await createStudioDocumentApi(runtime).handle(assistantRequest(request,runtime,path,method,body)));
  return services.admin(request,path.slice('/admin/'.length),method,body,{ackOnly:true});
}
