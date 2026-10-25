import {validateProject} from './studio-model.mjs';
import {registeredFilmedProfile} from './filmed-profiles/registry.mjs';
import {videoFitsLine} from './video-intake.mjs';

const placement = take => {
  const box=Number(take.target)-1;
  return {eventId:take.target==='flip'?'reveal.dealer':['dealer','hole'].includes(take.target)?'deal.dealer':box<2?'deal.player.left':box<5?'deal.player.centre':'deal.player.right',
    situation:['hole','flip'].includes(take.target)?'dealer-hole':take.target==='dealer'?'dealer-up':'box'+box};
};

// The entire exact bank is a sequence, not 35 randomly interchangeable clips.
// Registration alone never activates it: binding remains an explicit draft edit.
export function filmedBankState(inventory,dealerId) {
  const profile=registeredFilmedProfile(dealerId);
  if(!profile)return null;
  const entries=profile.takes.map(take=>{
    const slot=placement(take);
    const originalName=take.repositoryPath.split('/').at(-1).replace(/\.mp4$/,'');
    const canonicalName=row=>row.classification.label===originalName||row.label===originalName;
    const video=inventory.videos.filter(row=>row.available===true&&row.integrity!=='unavailable'&&row.sha256===take.sha256
      &&Number.isSafeInteger(row.bytes)&&row.bytes>0&&videoFitsLine(row,dealerId,slot.eventId)
      &&row.classification?.dealerId===dealerId&&row.classification.archived!==true&&row.classification.game!=='roulette'
      &&!['image','audio'].includes(row.classification.mediaType)&&row.classification.eventId===slot.eventId&&row.classification.situation===slot.situation)
      .sort((a,b)=>Number(canonicalName(b))-Number(canonicalName(a))||a.id.localeCompare(b.id))[0]??null;
    return {take,video,...slot};
  });
  return {profileId:profile.id,entries,complete:entries.every(row=>row.video),missing:entries.filter(row=>!row.video).map(row=>row.take.key)};
}

export function bindFilmedBank(project,inventory,dealerId) {
  validateProject(project);
  if(!project.dealers.some(row=>row.id===dealerId))throw Error('Dealern finns inte i projektet.');
  const bank=filmedBankState(inventory,dealerId);
  if(!bank?.complete)throw Error('Givbanken saknar verifierade filmvarianter: '+(bank?.missing.join(', ')??dealerId));
  const next=structuredClone(project);
  for(const {take,video,eventId} of bank.entries){
    const line=next.lines.find(row=>row.dealerId===dealerId&&row.eventId===eventId);
    if(!line)throw Error('Givbankens händelse saknas i projektet: '+eventId);
    const id=`${dealerId}.${eventId}.filmed.${take.target}.${take.variant||'base'}`;
    const baseline=line.variants.find(row=>row.id===line.baselineVariantId);
    const existing=line.variants.find(row=>row.id===id||row.videoGenerationId===video.id);
    const binding={id,label:take.repositoryPath.split('/').at(-1).replace(/\.mp4$/,''),priority:0,triggerIds:[],assetId:baseline.assetId,
      videoGenerationId:video.id,selection:{rules:false,model:false,random:false}};
    if(existing)Object.assign(existing,{...binding,id:existing.id});else line.variants.push(binding);
  }
  return validateProject(next);
}

export function hasEmbeddedShoeTransitions(dealerId) {
  const profile=registeredFilmedProfile(dealerId);
  if(!profile)return false;
  return profile.takes.filter(take=>take.variant==='').every(base=>{
    const variant=(base.startPose==='VILA'?'':'i')+(base.endPose==='VILA'?'':'v');
    return profile.takes.some(take=>take.target===base.target&&take.variant===variant&&take.startPose==='VILA'&&take.endPose==='VILA');
  });
}
