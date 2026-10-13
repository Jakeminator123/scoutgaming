import {ROULETTE_MEDIA_EVENTS} from '../../../../lab/lib/roulette-media.mjs';
import {validateVideoMetadata} from '../../../../lab/lib/video-intake.mjs';
import {assertRouletteIdleRecord,validateRouletteIdleBinding} from '../../../../web/public/roulette-idle-contract.mjs';

// Explicit roulette authoring. These records never become blackjack lines.
const descriptions={
  'roulette.reference':'Prova VILA som lokal PNG. Dealerregistret stöder ännu inte PNG. Saknas bilden används första tillgängliga roulette-idle i förhandsvisningen.',
  'roulette.idle':'Koppla en grundloop och högst tre glasögonvarianter till utkastet. Start och slut behöver matcha VILA. Ny grundloop rensar handmask och tidigare variationer. Publicera rummet separat.',
  'roulette.wheel-start':'Efter serverns sparade kvitto. Handkontakt och exakt ruta för kulsläpp behöver kalibreras.',
};
export function rouletteClipSlots() {
  return [...ROULETTE_MEDIA_EVENTS.flatMap(event=>event.situations.map(situation=>({
    id:`${event.id}/${situation}`,eventId:event.id,situation,title:event.label,
    description:descriptions[event.id],sourceType:event.sourceType,family:null,game:'roulette',intakeOnly:event.id!=='roulette.idle',localOnly:event.id==='roulette.reference',
  }))),
  {id:'roulette.plan.betting',eventId:'roulette.plan.betting',situation:'betting',title:'Insatser och välkomsttal',description:'Välkommen, lägg era insatser, inga fler insatser. Eget roulette-talset med exakt text, ljud och video behövs.',sourceType:'speak',family:null,game:'roulette',intakeOnly:true,planned:true},
  {id:'roulette.plan.outcome',eventId:'roulette.plan.outcome',situation:'outcome',title:'Hjulutfall 0–36',description:'37 filmer i ett separat bordsspår. Servernumret väljer filmen; spela en gång och håll slutbilden. Bankkoppling återstår.',sourceType:'settle',family:null,game:'roulette',intakeOnly:true,planned:true},
  {id:'roulette.plan.result',eventId:'roulette.plan.result',situation:'result',title:'Resultat och återgång',description:'Nummer/färg och eventuell reaktion på nettot. Återgå till vila. Kräver eget roulette-talset och sekvensstyrning.',sourceType:'settle',family:null,game:'roulette',intakeOnly:true,planned:true}];
}
export function rouletteClipMatches(video,dealerId,slot) {
  if(slot.planned||!rouletteClipSlots().some(row=>!row.planned&&row.id===slot.id&&row.eventId===slot.eventId&&row.situation===slot.situation))return false;
  const m=video?.classification;
  if(video?.available!==true||video.integrity==='unavailable'||m?.archived||m?.dealerId!==dealerId
    ||m?.game!=='roulette'||m.eventId!==slot.eventId||m.situation!==slot.situation)return false;
  try{validateVideoMetadata(m);return true;}catch{return false;}
}
function idleSlot(slot) {
  return slot?.game==='roulette'&&slot.eventId==='roulette.idle'
    &&rouletteClipSlots().some(row=>row.id===slot.id&&row.eventId===slot.eventId&&row.situation===slot.situation);
}
export function rouletteConfiguredClipIds(project,dealerId,slot) {
  if(!idleSlot(slot))return [];
  const binding=project.dealers.find(row=>row.id===dealerId)?.rouletteIdle;
  if(!binding)return [];
  validateRouletteIdleBinding(binding);
  return slot.situation==='breathing'?[binding.videoId]:[...(binding.variantVideoIds??[])];
}
export function bindRouletteClip(project,inventory,dealerId,slot,videoId) {
  if(!idleSlot(slot))throw Error('Detta roulettefack kan ännu inte kopplas till spel.');
  const dealer=project.dealers.find(row=>row.id===dealerId);
  const video=inventory.videos.find(row=>row.id===videoId&&rouletteClipMatches(row,dealerId,slot));
  if(!dealer||!video)throw Error('Klippet passar inte denna dealer och rouletteplats.');
  try{assertRouletteIdleRecord({contentType:video.contentType,classification:video.classification},dealerId,slot.situation);}
  catch{throw Error('Roulette-vila behöver en tillgänglig WebM med alfa i rätt fack.');}
  const draft=structuredClone(project),target=draft.dealers.find(row=>row.id===dealerId);
  if(slot.situation==='breathing') {
    // New source invalidates the old calibration and variant profile.
    if(target.rouletteIdle?.videoId!==videoId)target.rouletteIdle={videoId};
  } else {
    const binding=target.rouletteIdle;
    if(!binding)throw Error('Koppla grundloopen innan du lägger till en glasögonvariant.');
    const base=inventory.videos.find(row=>row.id===binding.videoId);
    const baseSlot=rouletteClipSlots().find(row=>row.situation==='breathing');
    if(!rouletteClipMatches(base,dealerId,baseSlot))throw Error('Den kopplade grundloopen är inte tillgänglig. Välj den på nytt.');
    assertRouletteIdleRecord({contentType:base.contentType,classification:base.classification},dealerId);
    const frame=row=>row.classification.framing?JSON.stringify(Object.entries(row.classification.framing).sort()):'null';
    if(frame(base)!==frame(video))throw Error('Varianten måste ha samma inramning som grundloopen.');
    const ids=[...new Set([...(binding.variantVideoIds??[]),videoId])];
    if(ids.length>3)throw Error('Högst tre glasögonvarianter kan kopplas. Ta bort en tidigare variant först.');
    binding.variantVideoIds=ids;
  }
  validateRouletteIdleBinding(target.rouletteIdle);return draft;
}
export function unbindRouletteClip(project,dealerId,slot,videoId) {
  if(!idleSlot(slot))throw Error('Detta roulettefack saknar sparad spelkoppling.');
  const draft=structuredClone(project),dealer=draft.dealers.find(row=>row.id===dealerId);
  if(!dealer)throw Error('Dealern saknas.');
  if(slot.situation==='breathing'&&dealer.rouletteIdle?.videoId===videoId)delete dealer.rouletteIdle;
  else if(slot.situation==='glasses-clean'&&dealer.rouletteIdle)dealer.rouletteIdle.variantVideoIds=(dealer.rouletteIdle.variantVideoIds??[]).filter(id=>id!==videoId);
  return draft;
}
// Stable editor-only fallback, never automatic publication or visual approval.
export function rouletteReferencePreview(inventory,dealerId) {
  const slots=rouletteClipSlots();
  for(const eventId of ['roulette.reference','roulette.idle']) {
    const videos=inventory.videos.filter(video=>slots.some(slot=>slot.eventId===eventId&&rouletteClipMatches(video,dealerId,slot)))
      .sort((a,b)=>a.id.localeCompare(b.id));
    if(videos.length)return videos[0];
  }
  return null;
}
