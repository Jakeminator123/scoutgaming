import {effectiveDealerCompositing} from './dealer-compositing.mjs';
// Private editable intent. Only a verified server session can establish readiness.
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key));
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const videoId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(value) && !value.includes('..') && !value.includes('://');
const fail = () => { throw Error('Ogiltig talprofil: egen röst och egen videoreferens krävs.'); };
export function normalizeDealerSpeechProfile(value) {
  if (!exact(value,['schemaVersion','state','voice','reference']) || ![1,2].includes(value.schemaVersion) || !(value.state === 'preparation' || value.schemaVersion === 2 && value.state === 'enabled')) fail();
  let voice = null, reference = null;
  if (value.voice !== null) {
    const input=value.voice,keys=['provider','voiceId','modelId'];
    if(!object(input))fail();
    if(value.schemaVersion===2&&input.provider==='elevenlabs'){
      if(Object.hasOwn(input,'language'))keys.push('language');
      if(Object.hasOwn(input,'settings'))keys.push('settings');
    }
    if (!exact(input,keys) || !['cartesia','elevenlabs'].includes(input.provider) || !id(input.voiceId) || !id(input.modelId)) fail();
    voice = {provider:input.provider,voiceId:input.voiceId,modelId:input.modelId};
    if(Object.hasOwn(input,'language')){
      if(typeof input.language!=='string'||!(/^[a-z]{2}$/).test(input.language))fail();
      voice.language=input.language;
    }
    if(Object.hasOwn(input,'settings')){
      const allowed=['stability','similarity_boost','style','use_speaker_boost'];
      if(!object(input.settings)||!Object.keys(input.settings).length||Object.keys(input.settings).some(key=>!allowed.includes(key)))fail();
      voice.settings={};
      for(const key of allowed)if(Object.hasOwn(input.settings,key)){
        const field=input.settings[key];
        if(key==='use_speaker_boost'?typeof field!=='boolean':!Number.isFinite(field)||field<0||field>1)fail();
        voice.settings[key]=field;
      }
    }
  }
  if (value.reference !== null) {
    const ref = value.reference;
    if (!exact(ref,['kind','videoId','sha256','offsetMs']) || !['video-frame','motion-video'].includes(ref.kind) || !videoId(ref.videoId)
      || !/^[a-f0-9]{64}$/.test(ref.sha256) || !Number.isSafeInteger(ref.offsetMs) || ref.offsetMs < 0 || ref.offsetMs > 3600000) fail();
    reference = {kind:ref.kind,videoId:ref.videoId,sha256:ref.sha256,offsetMs:ref.offsetMs};
  }
  if (value.state === 'enabled' && (!voice || !reference)) fail();
  return {schemaVersion:value.schemaVersion,state:value.state,voice,reference};
}
export function dealerSpeechPreparation(value) {
  const profile = value ? normalizeDealerSpeechProfile(value) : null;
  const missing = [];
  if (!profile?.voice) missing.push('röstprofil');
  if (!profile?.reference) missing.push('referensvideo');
  return {active:false, requested:profile?.state === 'enabled', missing, message: profile?.state === 'enabled'
    ? 'AI-tal är valt. Varje talsession måste verifiera just denna röst och videoreferens innan ljud och läppsynk kan spelas. Visuell kvalitet behöver fortfarande granskas.'
    : missing.length
    ? 'Saknar ' + missing.join(' och ') + '. Genererad röst och läppsynk är inte aktiverade.'
    : 'Underlaget är sparat. Avatarberedning, verifierad driftkoppling och visuell kontroll återstår. Genererad röst och läppsynk är inte aktiverade.'};
}
export function isSpeechReferenceVideo(video,dealerId) {
  return Boolean(video && video.dealer === dealerId && video.available === true && video.integrity !== 'unavailable'
    && video.classification?.mediaType !== 'audio' && !video.classification?.archived
    && /^[a-f0-9]{64}$/.test(video.sha256) && Number.isSafeInteger(video.bytes) && video.bytes > 0
    );
}
// The current avatar worker emits opaque video. Alpha sources may be kept as
// preparation, but cannot safely reveal the separate background/table in speech.
export function dealerSpeechReferenceCheck(video,dealerId) {
  const result=(canEnable,message)=>({canEnable,message});
  if(!isSpeechReferenceVideo(video,dealerId))return result(false,'Välj en tillgänglig video som tillhör denna dealer.');
  if(video.classification?.dealerId!==undefined&&video.classification.dealerId!==dealerId)
    return result(false,'Referensens ägare stämmer inte med den valda dealern.');
  if(video.bytes>256*1024*1024)return result(false,'Talreferensen är för stor. Välj ett eget klipp under 256 MB.');
  if(video.contentType!==undefined&&!/^video\/(mp4|webm|quicktime)$/.test(video.contentType))
    return result(false,'Talreferensen måste vara en MP4-, WebM- eller QuickTime-video.');
  if(video.duration!==undefined&&(!Number.isFinite(video.duration)||video.duration<=0))
    return result(false,'Referensvideons längd är ogiltig. Kontrollera eller byt filen.');
  const candidate=video.compositing??video.classification?.compositing;
  try {
    if(candidate?.mode==='opaque')return result(false,'En inbakad miljö kan dölja bakgrund och bord. Välj dealerns egen gröna referens.');
    if(effectiveDealerCompositing(candidate).mode==='alpha')return result(false,'Alfa fungerar för vanliga klipp, men bevaras ännu inte av talmotorn. Välj en grön referens för AI-tal; denna kan sparas som förberedelse.');
  }catch{return result(false,'Referensens friläggning är ogiltig. Kontrollera klippets inställningar.');}
  return result(true,'Egen dealerreferens vald. Servern kontrollerar fil och röst före tal. Bakgrund och bord behåller sina egna lager.');
}
// Uploaded registries may not carry duration. This stores a bounded candidate
// timestamp; avatar preparation must decode it again before any activation.
export function validateDealerSpeechReference(profile,video,dealerId) {
  const normalized=normalizeDealerSpeechProfile(profile),ref=normalized.reference;
  if (!ref) return;
  if (!isSpeechReferenceVideo(video,dealerId) || ref.videoId !== video.id || ref.sha256 !== video.sha256
    || (Number.isFinite(video.duration) && ref.offsetMs >= video.duration * 1000)) throw Error('studio_speech_reference_invalid');
  if(normalized.state==='enabled'&&!dealerSpeechReferenceCheck(video,dealerId).canEnable)throw Error('studio_speech_reference_incompatible');
}
