import {isDealerId} from './dealer-identity.mjs';

export const MAX_RECORDED_SPEECH_SECONDS = 120;

const identityKeys=Object.freeze(['dealerId','lineId','takeId','language','exactText','videoSha256','audioSha256','indexSha256',
  'fps','frameCount','audioDelayMs','entryPose','exitPose','calibrationRevision']);
const embeddedIdentityKeys=Object.freeze(['sourceKind','dealerId','lineId','takeId','language','exactText','videoSha256',
  'fps','frameCount','videoTrackId','audioTrackId','entryPose','exitPose']);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const key=value=>typeof value==='string'&&/^[a-z][a-z0-9_-]{0,99}$/.test(value);
const fail=()=>{throw Object.assign(Error('invalid_recorded_speech'),{code:'invalid_recorded_speech'});};
function exact(value,keys){
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))
    ||Object.getOwnPropertySymbols(value).length||Object.getOwnPropertyNames(value).length!==keys.length)fail();
  for(const name of keys){
    const descriptor=Object.getOwnPropertyDescriptor(value,name);
    if(!descriptor||!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))fail();
  }
}
function text(value,max){
  return typeof value==='string'&&value.length>0&&value.length<=max&&value.trim()===value&&value.isWellFormed()
    &&!/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/.test(value);
}
function identity(value){
  exact(value,identityKeys);
  if(!isDealerId(value.dealerId)||!key(value.lineId)||!key(value.takeId)
    ||typeof value.language!=='string'||!/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(value.language)||!text(value.exactText,1000)
    ||!hash(value.videoSha256)||!hash(value.audioSha256)||!hash(value.indexSha256)
    ||!Number.isFinite(value.fps)||value.fps<=0||value.fps>240
    ||!Number.isSafeInteger(value.frameCount)||value.frameCount<1||value.frameCount/value.fps>MAX_RECORDED_SPEECH_SECONDS
    ||!Number.isSafeInteger(value.audioDelayMs)||value.audioDelayMs < -5000||value.audioDelayMs>5000
    ||!['VILA','REDO'].includes(value.entryPose)||!['VILA','REDO'].includes(value.exitPose)
    ||typeof value.calibrationRevision!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value.calibrationRevision))fail();
  return Object.fromEntries(identityKeys.map(name=>[name,value[name]]));
}
function embeddedIdentity(value){
  exact(value,embeddedIdentityKeys);
  if(value.sourceKind!=='embedded-mp4-av'||!isDealerId(value.dealerId)||!key(value.lineId)||!key(value.takeId)
    ||typeof value.language!=='string'||!/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(value.language)||!text(value.exactText,1000)
    ||!hash(value.videoSha256)||!Number.isFinite(value.fps)||value.fps<=0||value.fps>240
    ||!Number.isSafeInteger(value.frameCount)||value.frameCount<1||value.frameCount/value.fps>MAX_RECORDED_SPEECH_SECONDS
    ||![value.videoTrackId,value.audioTrackId].every(id=>Number.isSafeInteger(id)&&id>0&&id<=0xffffffff)
    ||value.videoTrackId===value.audioTrackId||!['VILA','REDO'].includes(value.entryPose)||!['VILA','REDO'].includes(value.exitPose))fail();
  return Object.fromEntries(embeddedIdentityKeys.map(name=>[name,value[name]]));
}
function proof(value,statuses,expected){
  const descriptor=value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,'status'):undefined;
  if(!descriptor||!Object.hasOwn(descriptor,'value'))fail();
  if(descriptor.value==='pending'){exact(value,['status']);return {status:'pending'};}
  exact(value,['status','by','at','identity']);
  if(!statuses.includes(value.status)||!text(value.by,120)||typeof value.at!=='string'
    ||!Number.isFinite(Date.parse(value.at))||new Date(value.at).toISOString()!==value.at)fail();
  const embedded=Object.hasOwn(expected,'sourceKind'),keys=embedded?embeddedIdentityKeys:identityKeys;
  const bound=(embedded?embeddedIdentity:identity)(value.identity);
  if(keys.some(name=>bound[name]!==expected[name]))fail();
  return {status:value.status,by:value.by,at:value.at,identity:bound};
}

// This records the exact declared tuple. It does not transcribe, hash media bytes
// or perform audiovisual acceptance; those are separate, attributable checks.
export function recordedSpeechIdentity(value){
  const version=value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,'schemaVersion'):undefined;
  const embedded=version?.value===2,keys=embedded?embeddedIdentityKeys:identityKeys;
  exact(value,['schemaVersion',...keys,embedded?'source':'recording','review']);
  if(value.schemaVersion!==(embedded?2:1))fail();
  return (embedded?embeddedIdentity:identity)(Object.fromEntries(keys.map(name=>[name,value[name]])));
}
export function normalizeRecordedSpeech(value,{dealerId,lineId,videoSha256}={}){
  const bound=recordedSpeechIdentity(value);
  if(dealerId!==undefined&&dealerId!==bound.dealerId||lineId!==undefined&&lineId!==bound.lineId
    ||videoSha256!==undefined&&videoSha256!==bound.videoSha256)fail();
  if(value.schemaVersion===2){
    const source=proof(value.source,['verified-embedded-av'],bound),review=proof(value.review,['approved','rejected'],bound);
    if(review.status==='approved'&&source.status!=='verified-embedded-av')fail();
    return {schemaVersion:2,...bound,source,review};
  }
  const recording=proof(value.recording,['verified-recording'],bound),review=proof(value.review,['approved','rejected'],bound);
  if(review.status==='approved'&&recording.status!=='verified-recording')fail();
  return {schemaVersion:1,...bound,recording,review};
}
function sourceVerified(value){
  return value.schemaVersion===2?value.source.status==='verified-embedded-av':value.recording.status==='verified-recording';
}
// Form validation only. Writers must bind embedded AV verification to measured
// tracks in the exact MP4 bytes; it never attests filming origin or AV review.
export function recordedSpeechSourceVerified(value){
  try{return sourceVerified(normalizeRecordedSpeech(value));}catch{return false;}
}
function embeddedTimingMatches(video,speech){
  // Server boundaries validate the full timeline and recompute its identity
  // digest. Portable selection rechecks the measured source binding after DTOs.
  const timing=video.mediaTiming;
  exact(timing,['schemaVersion','mediaId','sha256','size','recordedSpeechIdentitySha256','video','audio','endUs','audioTailUs']);
  exact(timing.video,['trackId','frameCount','fps','firstPtsUs','lastPtsUs','endUs']);
  const audio=timing.audio,first=audio&&Object.getOwnPropertyDescriptor(audio,'0');
  if(!Array.isArray(audio)||Object.getPrototypeOf(audio)!==Array.prototype||audio.length!==1
    ||Object.getOwnPropertySymbols(audio).length||Object.getOwnPropertyNames(audio).length!==2
    ||!first?.enumerable||!Object.hasOwn(first,'value'))return false;
  exact(first.value,['trackId','firstPtsUs','endUs']);
  return timing.schemaVersion===1&&typeof timing.mediaId==='string'&&timing.mediaId===video.id
    &&timing.sha256===speech.videoSha256&&hash(timing.recordedSpeechIdentitySha256)
    &&Number.isSafeInteger(timing.size)&&timing.size>=16&&timing.size<=128*1024*1024
    &&(video.bytes===undefined||timing.size===video.bytes)&&(video.size===undefined||timing.size===video.size)
    &&timing.video.trackId===speech.videoTrackId&&timing.video.frameCount===speech.frameCount
    &&Number.isFinite(timing.video.fps)&&Math.abs(timing.video.fps-speech.fps)<=1e-9
    &&first.value.trackId===speech.audioTrackId;
}

// A new tuple is never selected by approximate length or a different locale.
// Deliberate rehearsal may opt into a verified source whose review is pending.
export function recordedSpeechForVideo(video,{dealerId,lineId,language,takeId,requireApproved=true}={}){
  try{
    if(!video||!isDealerId(dealerId)||!key(lineId)||typeof language!=='string'||!hash(video.sha256)
      ||video.available===false||video.archived===true||video.classification?.archived===true
      ||video.contentType!==undefined&&!['video/mp4','video/webm'].includes(video.contentType))return null;
    const value=video.recordedSpeech??video.classification?.recordedSpeech;
    if(value===undefined)return null;
    const checked=normalizeRecordedSpeech(value,{dealerId,lineId,videoSha256:video.sha256});
    if(checked.schemaVersion===2&&(video.contentType!=='video/mp4'||!embeddedTimingMatches(video,checked))
      ||[video.dealer,video.dealerId,video.classification?.dealerId].some(owner=>owner!==undefined&&owner!==dealerId)
      ||video.classification?.situation!==undefined&&video.classification.situation!==lineId
      ||checked.language!==language||takeId!==undefined&&checked.takeId!==takeId
      ||!sourceVerified(checked)||checked.review.status==='rejected'
      ||requireApproved&&checked.review.status!=='approved')return null;
    if(video.recordedSpeech!==undefined&&video.classification?.recordedSpeech!==undefined
      &&JSON.stringify(normalizeRecordedSpeech(video.classification.recordedSpeech,{dealerId,lineId,videoSha256:video.sha256}))!==JSON.stringify(checked))return null;
    return checked;
  }catch{return null;}
}
export function selectRecordedSpeech(videos,selection){
  if(!Array.isArray(videos)||!key(selection?.takeId))return null;
  const matching=videos.filter(video=>recordedSpeechForVideo(video,selection));
  return matching.length===1?matching[0]:null;
}
