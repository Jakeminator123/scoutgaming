import {normalizeRecordedSpeech,recordedSpeechIdentity,selectRecordedSpeech} from '../packages/presentation/contracts/recorded-speech.mjs';

const owns=(value,key)=>value!=null&&Object.hasOwn(value,key);
export const hasRecordedSpeech=video=>owns(video,'recordedSpeech')||owns(video?.classification,'recordedSpeech');
export function recordedSpeechProjection(video){
  if(!hasRecordedSpeech(video))return {};
  return {recordedSpeech:structuredClone(video.recordedSpeech??video.classification?.recordedSpeech)};
}

// The authored line's saved UUID selects the language and take. Do not search
// other registrations for a translation, similar duration or replacement take.
function allowed(video,{project,dealerId,eventId,sourceEvent,preview=false}){
  if(!video||!hasRecordedSpeech(video))return video??null;
  try{
    if(sourceEvent?.type!=='speak'||video.classification?.eventId!==eventId
      ||!project.lines.some(line=>line.dealerId===dealerId&&line.eventId===eventId
        &&line.variants.some(variant=>variant.videoGenerationId===video.id)))return null;
    const tuple=normalizeRecordedSpeech(video.recordedSpeech??video.classification.recordedSpeech,
      {dealerId,lineId:sourceEvent.line,videoSha256:video.sha256});
    return selectRecordedSpeech([video],{dealerId,lineId:sourceEvent.line,language:tuple.language,takeId:tuple.takeId,requireApproved:!preview});
  }catch{return null;}
}

export function gateRecordedSpeechSelection({video,standard},context){
  const selected=allowed(video,context);
  let fallback=allowed(standard,context);
  if(hasRecordedSpeech(video)){
    if(!selected)return {video:null,standard:null,blocked:true};
    // A fallback is an identical attested recording, never a different sentence
    // or locale. Legacy metadata cannot prove equivalence to a new exact tuple.
    if(!hasRecordedSpeech(fallback))fallback=null;
    else try{
      const identity=row=>JSON.stringify(recordedSpeechIdentity(row.recordedSpeech??row.classification.recordedSpeech));
      if(identity(selected)!==identity(fallback))fallback=null;
    }catch{fallback=null;}
  }else if(hasRecordedSpeech(standard))fallback=null;
  return {video:selected,standard:fallback,blocked:false};
}

export function recordedSpeechResult(result,selection){
  if(!selection.blocked)return result;
  return {...result,videoGenerationId:null,decision:{...result.decision,
    media:{...result.decision?.media,familyId:result.decision?.media?.familyId??null,
      videoId:null,fileName:null,sha256:null,reason:'recorded_speech_unavailable'}}};
}
