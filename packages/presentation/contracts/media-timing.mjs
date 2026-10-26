import { recordedSpeechIdentity } from './recorded-speech.mjs';

export const MAX_MEDIA_TIMING_US = 120_000_000;
const fail = () => { throw Object.assign(Error('invalid_media_timing'), {code:'invalid_media_timing'}); };
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const uint = (value,max=MAX_MEDIA_TIMING_US) => Number.isSafeInteger(value) && value>=0 && value<=max;
function exact(value,keys) {
  if(!value || ![Object.prototype,null].includes(Object.getPrototypeOf(value)) || Object.getOwnPropertySymbols(value).length
    || Object.getOwnPropertyNames(value).length!==keys.length) fail();
  for(const key of keys) { const d=Object.getOwnPropertyDescriptor(value,key); if(!d?.enumerable || !Object.hasOwn(d,'value')) fail(); }
}
// Fixed key order comes from the existing identity normalizer. Review/recording
// statuses are deliberately excluded: a measurement never grants approval.
export function mediaTimingSpeechIdentity(recordedSpeech) {
  return JSON.stringify(recordedSpeechIdentity(recordedSpeech));
}
export function normalizeMediaTiming(value,{mediaId,sha256,size,recordedSpeechIdentitySha256,recordedSpeech}={}) {
  exact(value,['schemaVersion','mediaId','sha256','size','recordedSpeechIdentitySha256','video','audio','endUs','audioTailUs']);
  if(value.schemaVersion!==1 || typeof value.mediaId!=='string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value.mediaId)
    || !hash(value.sha256) || !uint(value.size,128*1024*1024) || value.size<16
    || value.recordedSpeechIdentitySha256!==null && !hash(value.recordedSpeechIdentitySha256)) fail();
  if(mediaId!==undefined && value.mediaId!==mediaId || sha256!==undefined && value.sha256!==sha256 || size!==undefined && value.size!==size) fail();
  // Shape-only reads are not evidence of origin. Writers/readers bind these
  // fields to the trusted record and server-computed identity digest.
  const v=value.video;
  exact(v,['trackId','frameCount','fps','firstPtsUs','lastPtsUs','endUs']);
  if(!uint(v.trackId,0xffffffff) || !v.trackId || !uint(v.frameCount,28_800) || !v.frameCount
    || !Number.isFinite(v.fps) || v.fps<=0 || v.fps>240 || v.firstPtsUs!==0
    || !uint(v.lastPtsUs) || !uint(v.endUs) || v.endUs<=v.lastPtsUs
    || Math.abs(v.lastPtsUs-Math.round((v.frameCount-1)*1e6/v.fps))>1
    || Math.abs(v.endUs-Math.ceil(v.frameCount*1e6/v.fps))>1) fail();
  if(!Array.isArray(value.audio) || Object.getPrototypeOf(value.audio)!==Array.prototype || value.audio.length>8
    || Object.getOwnPropertySymbols(value.audio).length || Object.getOwnPropertyNames(value.audio).length!==value.audio.length+1) fail();
  for(let i=0;i<value.audio.length;i++){const d=Object.getOwnPropertyDescriptor(value.audio,String(i));if(!d?.enumerable || !Object.hasOwn(d,'value'))fail();}
  let prior=0;
  const audio=value.audio.map(a=>{
    exact(a,['trackId','firstPtsUs','endUs']);
    if(!uint(a.trackId,0xffffffff) || !a.trackId || a.trackId===v.trackId || a.trackId<=prior
      || !uint(a.firstPtsUs) || !uint(a.endUs) || a.endUs<=a.firstPtsUs) fail();
    prior=a.trackId; return {...a};
  });
  const endUs=Math.max(v.endUs,...audio.map(a=>a.endUs)),audioTailUs=endUs-v.endUs;
  if(value.endUs!==endUs || value.audioTailUs!==audioTailUs) fail();
  const result={schemaVersion:1,mediaId:value.mediaId,sha256:value.sha256,size:value.size,
    recordedSpeechIdentitySha256:value.recordedSpeechIdentitySha256,video:{...v},audio,endUs,audioTailUs};
  if(recordedSpeechIdentitySha256!==undefined && result.recordedSpeechIdentitySha256!==recordedSpeechIdentitySha256) fail();
  if(recordedSpeech!=null) {
    let identity;
    try {identity=recordedSpeechIdentity(recordedSpeech);} catch {fail();}
    if(result.sha256!==identity.videoSha256 || v.frameCount!==identity.frameCount || Math.abs(v.fps-identity.fps)>1e-9) fail();
    if(identity.sourceKind==='embedded-mp4-av' && (v.trackId!==identity.videoTrackId
      || audio.length!==1 || audio[0].trackId!==identity.audioTrackId)) fail();
  }
  return result;
}
