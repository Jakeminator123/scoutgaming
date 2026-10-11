// Draft preparation only. Provider credentials, endpoints and activation never live here.
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key));
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const videoId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(value) && !value.includes('..') && !value.includes('://');
const fail = () => { throw Error('Ogiltig talprofil: endast förberedelse med egen röst och egen videoreferens stöds.'); };
export function normalizeDealerSpeechProfile(value) {
  if (!exact(value,['schemaVersion','state','voice','reference']) || value.schemaVersion !== 1 || value.state !== 'preparation') fail();
  let voice = null, reference = null;
  if (value.voice !== null) {
    if (!exact(value.voice,['provider','voiceId','modelId']) || !['cartesia','elevenlabs'].includes(value.voice.provider) || !id(value.voice.voiceId) || !id(value.voice.modelId)) fail();
    voice = {...value.voice};
  }
  if (value.reference !== null) {
    const ref = value.reference;
    if (!exact(ref,['kind','videoId','sha256','offsetMs']) || !['video-frame','motion-video'].includes(ref.kind) || !videoId(ref.videoId)
      || !/^[a-f0-9]{64}$/.test(ref.sha256) || !Number.isSafeInteger(ref.offsetMs) || ref.offsetMs < 0 || ref.offsetMs > 3600000) fail();
    reference = {...ref};
  }
  return {schemaVersion:1,state:'preparation',voice,reference};
}
export function dealerSpeechPreparation(value) {
  const profile = value ? normalizeDealerSpeechProfile(value) : null;
  const missing = [];
  if (!profile?.voice) missing.push('röstprofil');
  if (!profile?.reference) missing.push('referensvideo');
  return {active:false, missing, message: missing.length
    ? 'Saknar ' + missing.join(' och ') + '. Genererad röst och läppsynk är inte aktiverade.'
    : 'Underlaget är sparat. Avatarberedning, verifierad driftkoppling och visuell kontroll återstår. Genererad röst och läppsynk är inte aktiverade.'};
}
export function isSpeechReferenceVideo(video,dealerId) {
  return Boolean(video && video.dealer === dealerId && video.available === true && video.integrity !== 'unavailable'
    && video.classification?.mediaType !== 'audio' && !video.classification?.archived
    && /^[a-f0-9]{64}$/.test(video.sha256) && Number.isSafeInteger(video.bytes) && video.bytes > 0
    );
}
// Uploaded registries may not carry duration. This stores a bounded candidate
// timestamp; avatar preparation must decode it again before any activation.
export function validateDealerSpeechReference(profile,video,dealerId) {
  const ref = normalizeDealerSpeechProfile(profile).reference;
  if (!ref) return;
  if (!isSpeechReferenceVideo(video,dealerId) || ref.videoId !== video.id || ref.sha256 !== video.sha256
    || (Number.isFinite(video.duration) && ref.offsetMs >= video.duration * 1000)) throw Error('studio_speech_reference_invalid');
}
