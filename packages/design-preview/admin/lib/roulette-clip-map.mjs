import {ROULETTE_MEDIA_EVENTS} from '../../../../lab/lib/roulette-media.mjs';
import {validateVideoMetadata} from '../../../../lab/lib/video-intake.mjs';

// Authoring intake only: these records never become blackjack runtime lines.
const descriptions={
  'roulette.reference':'Prova VILA som lokal PNG. Dealerregistret stöder ännu inte PNG. Saknas bilden används första tillgängliga roulette-idle i förhandsvisningen.',
  'roulette.idle':'Tyst grundloop och lugna variationer för denna dealer i roulette. Start och slut behöver matcha VILA.',
  'roulette.wheel-start':'Efter serverns sparade kvitto. Handkontakt och exakt ruta för kulsläpp behöver kalibreras.',
};
export function rouletteClipSlots() {
  return [...ROULETTE_MEDIA_EVENTS.flatMap(event=>event.situations.map(situation=>({
    id:`${event.id}/${situation}`,eventId:event.id,situation,title:event.label,
    description:descriptions[event.id],sourceType:event.sourceType,family:null,game:'roulette',intakeOnly:true,localOnly:event.id==='roulette.reference',
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
