import {validateProject} from './studio-model.mjs';
import {registeredFilmedProfile} from './filmed-profiles/registry.mjs';
import {videoFitsLine} from './video-intake.mjs';
import {requiredNativeFilmedTakes} from '../runtime/filmed-deal-coverage.mjs';
import {transitionClipsForDealer} from '../runtime/shoe-transitions.mjs';

const placement = take => {
  const box=Number(take.target)-1;
  return {eventId:take.target==='flip'?'reveal.dealer':['dealer','hole'].includes(take.target)?'deal.dealer':box<2?'deal.player.left':box<5?'deal.player.centre':'deal.player.right',
    situation:['hole','flip'].includes(take.target)?'dealer-hole':take.target==='dealer'?'dealer-up':'box'+box};
};
// The deal slot (eventId/situation) a filmed take is bound to; also used by Landningar's copy.
export {placement as filmedTakePlacement};

// The legacy full bank is a sequence, not randomly interchangeable clips.
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

function compatibleShoeVideo(video,dealerId,situation) {
  const metadata=video?.classification,poses=situation==='to-shoe'?['VILA','REDO']:['REDO','VILA'];
  return video?.available===true&&video.integrity!=='unavailable'&&/^[a-f0-9]{64}$/.test(video.sha256??'')
    &&Number.isSafeInteger(video.bytes)&&video.bytes>0&&metadata?.dealerId===dealerId
    &&metadata.archived!==true&&metadata.game!=='roulette'&&!['image','audio'].includes(metadata.mediaType)
    &&metadata.eventId==='transition.shoe'&&metadata.situation===situation
    &&metadata.startPose===poses[0]&&metadata.endPose===poses[1]&&videoFitsLine(video,dealerId,'transition.shoe');
}
export function hasSeparateShoeTransitions(inventory,dealerId) {
  return ['to-shoe','from-shoe'].some(situation=>inventory.videos.some(video=>compatibleShoeVideo(video,dealerId,situation)));
}
export function nativeFilmedBankState(project,inventory,dealerId) {
  const bank=filmedBankState(inventory,dealerId),profile=registeredFilmedProfile(dealerId);
  if(!bank||!profile)return null;
  const transitions=transitionClipsForDealer(project,inventory,dealerId);
  const line=project.lines.find(row=>row.dealerId===dealerId&&row.eventId==='transition.shoe');
  for(const [direction,situation] of [['toShoe','to-shoe'],['fromShoe','from-shoe']]){
    const explicit=line?.variants.find(row=>row.id===`${dealerId}.transition.shoe.slot.${situation}`),video=transitions[direction];
    if(explicit?.videoGenerationId&&!video||video&&(!compatibleShoeVideo(video,dealerId,situation)
      ||inventory.videos.filter(row=>row.id===video.id).length!==1))
      return {...bank,complete:false,missing:[],reason:'shoe_transition_invalid'};
  }
  const coverage=requiredNativeFilmedTakes({profile,dealerId,transitions});
  if(!coverage.complete)return {...bank,complete:false,missing:[],reason:coverage.reason};
  const required=new Set(coverage.requiredTakeKeys),entries=bank.entries.filter(row=>required.has(row.take.key));
  return {...bank,entries,complete:entries.every(row=>row.video),missing:entries.filter(row=>!row.video).map(row=>row.take.key),reason:null};
}
function bindBank(project,inventory,dealerId,native) {
  validateProject(project);
  if(!project.dealers.some(row=>row.id===dealerId))throw Error('Dealern finns inte i projektet.');
  const bank=native?nativeFilmedBankState(project,inventory,dealerId):filmedBankState(inventory,dealerId);
  if(bank?.reason==='shoe_transition_invalid')throw Error('Ett valt skoklipp saknas eller har fel riktning. Välj ett giltigt standardklipp först.');
  if(!bank?.complete)throw Error('Givbanken saknar verifierade filmvarianter: '+(bank?.missing.join(', ')||bank?.reason||dealerId));
  const next=structuredClone(project);
  for(const {take,video,eventId} of bank.entries){
    const line=next.lines.find(row=>row.dealerId===dealerId&&row.eventId===eventId);
    if(!line)throw Error('Givbankens händelse saknas i projektet: '+eventId);
    const id=`${dealerId}.${eventId}.filmed.${take.target}.${take.variant||'base'}`;
    const baseline=line.variants.find(row=>row.id===line.baselineVariantId);
    const existing=line.variants.find(row=>row.id===id||row.videoGenerationId===video.id);
    if(native&&existing){
      if(existing.videoGenerationId!=null&&existing.videoGenerationId!==video.id)throw Error('En sparad givkoppling har ändrats. Granska den innan banken kopplas.');
      existing.videoGenerationId=video.id;
      continue;
    }
    const binding={id,label:take.repositoryPath.split('/').at(-1).replace(/\.mp4$/,''),priority:0,triggerIds:[],assetId:baseline.assetId,
      videoGenerationId:video.id,selection:{rules:false,model:false,random:false}};
    if(existing)Object.assign(existing,{...binding,id:existing.id});else line.variants.push(binding);
  }
  return validateProject(next);
}
export function bindFilmedBank(project,inventory,dealerId) { return bindBank(project,inventory,dealerId,false); }
// This explicit draft edit neither approves media nor publishes a room. The
// native producer rechecks the exact saved topology and identities at publication.
export function bindNativeFilmedBank(project,inventory,dealerId) { return bindBank(project,inventory,dealerId,true); }

export function hasEmbeddedShoeTransitions(dealerId) {
  const profile=registeredFilmedProfile(dealerId);
  if(!profile)return false;
  return profile.takes.filter(take=>take.variant==='').every(base=>{
    const variant=(base.startPose==='VILA'?'':'i')+(base.endPose==='VILA'?'':'v');
    return profile.takes.some(take=>take.target===base.target&&take.variant===variant&&take.startPose==='VILA'&&take.endPose==='VILA');
  });
}
