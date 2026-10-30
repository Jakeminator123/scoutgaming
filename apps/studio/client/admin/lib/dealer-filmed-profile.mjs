import {validateProject} from '../../../../../packages/presentation/contracts/studio-model.mjs';

export const MAX_FILMED_PROFILE_BYTES=2*1024*1024;
export async function readFilmedProfileFile(file){
  if(!file||file.size>MAX_FILMED_PROFILE_BYTES)throw Error('Profilfilen får vara högst 2 MB.');
  let value;
  try{value=JSON.parse(await file.text());}catch{throw Error('Välj filmed_profile.json från dealerfabrikens export.');}
  if(!value||typeof value.derivedFrom!=='string'||!Array.isArray(value.takes)||!value.takes.length||value.takes.length>128)
    throw Error('Filen saknar filmad profil. Välj filmed_profile.json.');
  return value;
}
function message(status,body){
  const code=body?.code??body?.error;
  if(code==='studio_presentation_runtime_update_required')return 'Spelmotorn behöver uppdateras innan profilen kan sparas.';
  if(code==='studio_filmed_profile_sha_missing')return `Ladda upp rätt filer till denna dealer först. ${body.missing?.length??'Några'} tagningar saknas eller har ändrade filer.`;
  if(code==='studio_filmed_profile_seeded')return 'Denna dealers källprofil hanteras i kod.';
  if(code==='studio_filmed_profile_source_unknown')return 'Profilens rörelsekälla stöds inte av denna version. Uppdatera exporten och spelmotorn.';
  if(code==='studio_filmed_profile_mismatch'){
    const reasons={frames:'mät klippets speltid igen',slot:'kontrollera fack och poser',timing:'exportera om med rätt rutnummer',source:'rörelsekällan är fel',missing:'tagningen saknas',geometry:'geometrin matchar inte källan',unknown:'okänd eller dubblerad tagning'};
    const details=(body.mismatch??[]).slice(0,6).map(row=>`${row.key}: ${reasons[row.reason]??'kontrollera profilen'}`).join('; ');
    return 'Profilen matchar inte klippen. '+details;
  }
  if(status===409)return 'Projektet har ändrats. Läs in senaste revisionen och försök igen.';
  if(status===401||status===403)return 'Logga in med behörighet att ändra dealern.';
  return 'Profilen kunde inte bekräftas. Försök igen.';
}
export async function importDealerFilmedProfile(dealerId,expectedRevision,profile,{fetchImpl=fetch,signal}={}){
  const response=await fetchImpl(`/studio/api/dealers/${encodeURIComponent(dealerId)}/filmed-profile`,{
    method:'PUT',credentials:'same-origin',cache:'no-store',redirect:'error',signal,
    headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision,profile}),
  });
  const body=await response.json().catch(()=>null);
  if(!response.ok)throw Error(message(response.status,body));
  if(!body?.project?.dealers?.some(row=>row.id===dealerId&&row.filmedProfile))throw Error('Den sparade profilen kunde inte verifieras. Läs om projektet.');
  return validateProject(body.project);
}
