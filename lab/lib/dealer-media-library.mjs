import {kindForEvent,situationsForEvent,validateVideoMetadata} from './video-intake.mjs';
import {clipSituationLabel} from './clip-label.mjs';
import {MEDIA_FAMILY_DEFINITIONS} from '../../presentation-runtime/media-families.mjs';
export const DEALER_MEDIA_CATEGORIES=Object.freeze([{id:'all',label:'Alla klipp'},{id:'idle',label:'Idle / Grundloop'},{id:'deal',label:'Deal'},{id:'speech',label:'Tal-klipp & ljud'},{id:'reaction',label:'Reaktioner'},{id:'action',label:'Övriga handlingar'}]);
export function eventMediaCategory(event){if(event.id.startsWith('deal.')||event.id.startsWith('reveal.'))return 'deal';return kindForEvent(event);}
export function dealerMediaSlots(project,category='all'){
  return project.events.filter(event=>category==='all'||eventMediaCategory(event)===category).flatMap(event=>{
    const situations=situationsForEvent(event);
    return (situations.length?situations:['']).map(situation=>({id:event.id+'/'+situation,eventId:event.id,situation,category:eventMediaCategory(event),label:situation?clipSituationLabel(event.id,situation):event.label}));
  });
}
export function mediaClassification(project,{dealerId,slotId,label,contentType}){
  const slot=dealerMediaSlots(project).find(row=>row.id===slotId);
  if(!slot||!project.dealers.some(row=>row.id===dealerId))throw Error('Välj dealer och ett exakt fack.');
  const audio=contentType.startsWith('audio/');
  if(audio&&slot.category!=='speech')throw Error('Välj ett talfack för ljudfilen.');
  const family=!audio&&MEDIA_FAMILY_DEFINITIONS.find(row=>row.dealerId===dealerId&&row.eventId===slot.eventId&&(row.playbackType==='idle-pool'?slot.situation==='':row.situation===slot.situation));
  return validateVideoMetadata({dealerId,eventId:slot.eventId,situation:slot.situation,label,kind:kindForEvent(project.events.find(row=>row.id===slot.eventId)),role:family?'alternative':'standard',playback:'once',notes:'',...(family?{familyId:family.id}:{}),...(audio?{mediaType:'audio'}:{})});
}
export function dealerLibraryVideos(project,inventory,dealerId,category='all',archived=false){
  return inventory.videos.filter(video=>(video.dealer??video.classification?.dealerId??video.familyId?.split('/')[0])===dealerId&&Boolean(video.classification?.archived)===archived
    &&(category==='all'||eventMediaCategory(project.events.find(event=>event.id===(video.classification?.eventId??video.eventId??video.suggestedEventId))??{id:'',sourceType:''})===category));
}
export function draftUsesMedia(project,id){return JSON.stringify(project).includes(JSON.stringify(id));}
