import {validateVideoMetadata} from '../../../../lab/lib/video-intake.mjs';
import {validateDealerFraming} from '../../../../web/public/dealer-framing.mjs';
import {rouletteClipSlots,rouletteClipMatches} from './roulette-clip-map.mjs';

export function rouletteReviewForm(video) {
  const metadata=video.classification;
  return {startPose:metadata?.startPose??'unverified',endPose:metadata?.endPose??'unverified',
    scale:metadata?.framing?String(metadata.framing.scale):'',x:metadata?.framing?String(metadata.framing.x):'',y:metadata?.framing?String(metadata.framing.y):''};
}
export function rouletteReviewMetadata(video,dealerId,form) {
  const slot=rouletteClipSlots().find(row=>['roulette.idle','roulette.wheel-start'].includes(row.eventId)
    &&row.eventId===video?.classification?.eventId&&row.situation===video.classification.situation);
  if(!slot||!rouletteClipMatches(video,dealerId,slot)||video.contentType!=='video/webm'||video.classification.compositing?.mode!=='alpha')
    throw Error('Granskningen kräver en tillgänglig alfa-WebM i denna dealers roulettefack.');
  if(!/^[a-f0-9]{64}$/.test(video.sha256??''))throw Error('Filens exakta hash saknas. Läs om registret.');
  const framing={};
  for(const key of ['scale','x','y']) {
    if(typeof form[key]!=='string'||!form[key].trim())throw Error('Ange granskad inramning: skala, x och y. Inga värden fylls i automatiskt.');
    framing[key]=Number(form[key]);
  }
  validateDealerFraming(framing);
  return validateVideoMetadata({...video.classification,startPose:form.startPose,endPose:form.endPose,framing},{forWrite:true});
}
export async function saveRouletteReview(video,dealerId,form,{fetchImpl=fetch,signal}={}) {
  const metadata=rouletteReviewMetadata(video,dealerId,form);
  const response=await fetchImpl('/studio/api/videos/classify',{method:'POST',credentials:'same-origin',signal,
    headers:{'Content-Type':'application/json'},body:JSON.stringify({id:video.id,sha256:video.sha256,previous:video.classification,metadata})});
  let inventory;try{inventory=await response.json();}catch{throw Error('Granskningen kan ha sparats. Läs om filmregistret innan du försöker igen.');}
  if(!response.ok)throw Error(response.status===409?'Filmklassificeringen har ändrats. Läs om registret; formuläret är kvar.':response.status===401||response.status===403?'N1-sessionen saknas. Logga in och läs om.':'Filmgranskningen kunde inte sparas. Formuläret är kvar.');
  const saved=inventory.videos?.find(row=>row.id===video.id);
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
    ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  if(!saved||saved.sha256!==video.sha256||!same(saved.classification,metadata))
    throw Error('Sparandet kunde inte återläsas exakt. Läs om filmregistret före koppling.');
  return inventory;
}
