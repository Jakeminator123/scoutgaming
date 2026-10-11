import {kindForEvent,situationsForEvent,validateVideoMetadata} from './video-intake.mjs';
import {clipSituationLabel} from './clip-label.mjs';
import {MEDIA_FAMILY_DEFINITIONS} from '../../presentation-runtime/media-families.mjs';
export const DEALER_MEDIA_CATEGORIES=Object.freeze([{id:'all',label:'Alla klipp'},{id:'idle',label:'Idle / Grundloop'},{id:'deal',label:'Deal'},{id:'speech',label:'Tal-klipp & ljud'},{id:'reaction',label:'Reaktioner'},{id:'action',label:'Övriga handlingar'}]);
export function eventMediaCategory(event){if(event.id.startsWith('deal.')||event.id.startsWith('reveal.'))return 'deal';return kindForEvent(event);}
export function dealerMediaSlots(project,category='all'){
  return project.events.filter(event=>category==='all'||eventMediaCategory(event)===category).flatMap(event=>{
    const situations=situationsForEvent(event);
    return (situations.length?situations:['']).map(situation=>({id:event.id+'/'+situation,eventId:event.id,situation,category:eventMediaCategory(event),label:event.id==='idle.ready'?'Grundloop':situation?clipSituationLabel(event.id,situation):event.label}));
  }).sort((a,b)=>(a.category==='idle'?0:1)-(b.category==='idle'?0:1));
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

// A destination is exact. A neighbouring box, sound file or archived upload
// cannot satisfy the video requirement, even when its duration happens to fit.
export function mediaMatchesSlot(video,slot){
  const metadata=video.classification;
  return (metadata?.eventId??video.eventId??video.suggestedEventId)===slot.eventId
    && (slot.eventId==='idle.ready'||(metadata?.situation??video.situation??'')===slot.situation);
}
export function mediaUsage(project,video,dealerId){
  const idle=dealerId==='astrid'?project.idlePolicy:project.dealerIdlePolicies?.find(row=>row.dealerId===dealerId)?.policy;
  if(idle?.base?.some(row=>row.videoId===video.id))return 'Grundloop';
  if(idle?.variants?.some(row=>row.videoId===video.id))return 'Variation';
  for(const line of project.lines.filter(row=>row.dealerId===dealerId)){
    const variant=line.variants.find(row=>row.videoGenerationId===video.id);
    if(variant)return variant.id===line.baselineVariantId?'Standard i utkastet':'Variant i utkastet';
  }
  const policy=project.mediaPolicy?.find(row=>row.familyId===video.familyId)?.variants.find(row=>row.videoId===video.id);
  if(policy)return 'Variant med inställningar';
  if(video.role==='standard'&&video.familyId)return 'Familjens standard';
  return 'Inte vald i utkastet';
}
export function dealerSlotStatus(project,inventory,dealerId,slot,legacy=null){
  const files=dealerLibraryVideos(project,inventory,dealerId).filter(row=>mediaMatchesSlot(row,slot));
  const usable=files.filter(row=>row.available&&row.classification?.mediaType!=='audio');
  const original=['astrid','vera','amira','mei'].includes(dealerId);
  const legacyPart=slot.eventId==='idle.ready'?'idle':slot.category==='deal'?slot.situation:'';
  const originals=(legacy?.clips??[]).filter(row=>row.dealerId===dealerId&&row.available&&(legacyPart?row.exactParts.includes(legacyPart):slot.category==='speech'&&row.lineId===slot.situation));
  const count=usable.length+originals.filter(row=>!usable.some(file=>file.id===row.id)).length;
  if(slot.eventId==='idle.ready'){
    const policy=dealerId==='astrid'?project.idlePolicy:project.dealerIdlePolicies?.find(row=>row.dealerId===dealerId)?.policy;
    const line=project.lines.find(row=>row.dealerId===dealerId&&row.eventId===slot.eventId);
    const baseline=line?.variants.find(row=>row.id===line.baselineVariantId)?.videoGenerationId;
    const ids=policy?.base?.length?policy.base.map(row=>row.videoId):baseline?[baseline]:[];
    const explicit=project.legacyClipPolicy?.find(row=>row.dealerId===dealerId&&row.part==='idle');
    const chosen=ids.length?ids.every(id=>usable.some(row=>row.id===id))
      :originals.some(row=>explicit?row.id===explicit.clipId:row.engineKey===legacy?.defaults?.idle);
    if(chosen)return {level:'ready',label:'Grundloop vald',count};
    if(original&&!legacy)return {level:'unknown',label:'Originalklipp behöver kontrolleras',count};
    return {level:'required',label:count?'Krävs · välj grundloop':'Krävs · grundloop saknas',count};
  }
  if(slot.category==='deal'&&!count){
    if(original&&!legacy)return {level:'unknown',label:'Originalklipp behöver kontrolleras',count};
    return {level:'recommended',label:'Rekommenderas · klipp saknas',count};
  }
  return {level:count?'ready':'optional',label:count?count+' klipp finns':'Valfritt · tomt fack',count};
}
export function mediaPage(items,requested=1,size=6){
  const pageSize=Math.max(1,Math.floor(size)||6),pages=Math.max(1,Math.ceil(items.length/pageSize));
  const page=Math.max(1,Math.min(pages,Math.floor(requested)||1));
  return {items:items.slice((page-1)*pageSize,page*pageSize),page,pages,total:items.length};
}
