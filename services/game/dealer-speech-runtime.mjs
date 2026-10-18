import { createHash } from 'node:crypto';
import { normalizeDealerSpeechProfile, validateDealerSpeechReference } from '../../packages/presentation/contracts/dealer-speech-profile.mjs';
import { effectiveDealerCompositing } from '../../packages/presentation/contracts/dealer-compositing.mjs';
import { dealerSpeechProfileRevision } from './dealer-speech-reference.mjs';
import { assertMovingSpeechSource, validateMovingSpeechSourceSet } from './moving-speech-bank.mjs';
import { createCartesiaSource } from '../astrid-gpu-worker/gateway/cartesia-source.mjs';
import { createElevenLabsSource } from '../astrid-gpu-worker/gateway/elevenlabs-source.mjs';

const fail = code => { throw Object.assign(Error(code), {code,statusCode:503}); };
async function verifyVoice(voice, apiKey, fetchImpl, signal) {
  const combined = signal ? AbortSignal.any([signal,AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000);
  const eleven = voice.provider === 'elevenlabs';
  const url = (eleven ? 'https://api.elevenlabs.io/v1/voices/' : 'https://api.cartesia.ai/voices/') + encodeURIComponent(voice.voiceId);
  let reader, abort;
  try {
    const response = await fetchImpl(url,{method:'GET',redirect:'error',signal:combined,headers:eleven
      ? {'xi-api-key':apiKey} : {authorization:`Bearer ${apiKey}`,'Cartesia-Version':'2026-08-14'}});
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) { await response.body?.cancel(); fail('generated_speech_voice_unavailable'); }
    if (!response.body?.getReader || Number(response.headers.get('content-length') ?? 0) > 131072) { await response.body?.cancel(); fail('generated_speech_voice_unavailable'); }
    reader = response.body.getReader(); let size = 0; const chunks = [];
    const stopped = new Promise((_,reject)=>{abort=()=>reject(Error('cancelled'));combined.addEventListener('abort',abort,{once:true});});
    for (;;) {
      combined.throwIfAborted(); const {value,done} = await Promise.race([reader.read(),stopped]);
      if (done) break; size += value.byteLength;
      if (size > 131072) fail('generated_speech_voice_unavailable'); chunks.push(Buffer.from(value));
    }
    const metadata=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if ((eleven ? metadata.voice_id : metadata.id) !== voice.voiceId || !eleven && metadata.status !== 'active') fail('generated_speech_voice_unavailable');
  } catch { fail('generated_speech_voice_unavailable'); }
  finally { if(abort)combined.removeEventListener('abort',abort);if(reader){await reader.cancel().catch(()=>{});reader.releaseLock();} }
}
/** Private Studio intent is read afresh; browser fields never choose a voice,
 * provider key or avatar. Publication/session ownership remains the chat guard. */
export function createDealerSpeechRuntime({readProject, referenceService, readVideoRegistry, env = process.env, fetchImpl = fetch, clock = Date.now, voiceVerificationTtlMs = 60000} = {}) {
  if (typeof readProject !== 'function' || typeof referenceService?.prepare !== 'function') throw Error('Invalid dealer speech runtime');
  const enabled = env.CROUPIER_DEALER_SPEECH_PROFILES === '1';
  const keys = {cartesia:env.CARTESIA_API_KEY,elevenlabs:env.ELEVENLABS_API_KEY};
  const verifiedVoices = new Map();
  async function verifyCurrentVoice(voice,apiKey,signal) {
    signal?.throwIfAborted();
    const key = createHash('sha256').update(JSON.stringify([voice.provider,voice.voiceId,voice.modelId,apiKey])).digest('hex');
    const at = clock(), last = verifiedVoices.get(key);
    if (last !== undefined && at >= last && at-last < Math.min(60000,Math.max(0,voiceVerificationTtlMs))) return;
    await verifyVoice(voice,apiKey,fetchImpl,signal); signal?.throwIfAborted();
    verifiedVoices.set(key,clock()); while (verifiedVoices.size > 32) verifiedVoices.delete(verifiedVoices.keys().next().value);
  }
  async function profileFor(dealerId) {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(dealerId ?? '')) fail('generated_speech_dealer_invalid');
    const matches = (await readProject())?.dealers?.filter(dealer => dealer.id === dealerId);
    if (matches?.length !== 1) fail('generated_speech_dealer_unavailable');
    if (!matches[0].speechProfile) return null;
    try { return normalizeDealerSpeechProfile(matches[0].speechProfile); }
    catch { fail('generated_speech_profile_invalid'); }
  }
  async function prepareProfile({dealerId,beforeCostly,signal},referenceKind) {
    await beforeCostly(); signal?.throwIfAborted();
    const profile = await profileFor(dealerId);
    if (!enabled) fail('generated_speech_profiles_not_configured');
    if (profile?.state !== 'enabled') fail('generated_speech_profile_not_enabled');
    if (profile.reference.kind !== referenceKind) fail('generated_speech_reference_kind');
    const revision = dealerSpeechProfileRevision(profile);
    const assertFresh = async () => {
      signal?.throwIfAborted(); await beforeCostly();
      const current = await profileFor(dealerId);
      if (!current || current.state !== 'enabled' || dealerSpeechProfileRevision(current) !== revision) fail('generated_speech_profile_changed');
      signal?.throwIfAborted();
    };
    return {profile,revision,assertFresh};
  }
  async function prepareVoice(profile,assertFresh,signal) {
    const apiKey = keys[profile.voice.provider];
    if (typeof apiKey !== 'string' || !apiKey.length || /[\s\u0000-\u001f]/.test(apiKey)) fail('generated_speech_voice_not_configured');
    await assertFresh();
    await verifyCurrentVoice(profile.voice,apiKey,signal);
    await assertFresh();
    const createSource = profile.voice.provider === 'cartesia' ? createCartesiaSource : createElevenLabsSource;
    return createSource({...profile.voice,apiKey},{fetchImpl});
  }
  return Object.freeze({
    async requested(dealerId) { return (await profileFor(dealerId))?.state === 'enabled'; },
    async prepare({dealerId,beforeCostly,signal}) {
      const {profile,revision,assertFresh} = await prepareProfile({dealerId,beforeCostly,signal},'video-frame');
      const source = await prepareVoice(profile,assertFresh,signal);
      const reference = await referenceService.prepare({dealerId,profile,profileRevision:revision,beforeCostlyStep:assertFresh,signal});
      if (reference.dealerId !== dealerId || reference.profileRevision !== revision) fail('generated_speech_reference_mismatch');
      await assertFresh();
      return Object.freeze({source,assertFresh,profileRevision:revision,imageSha256:reference.image.sha256,
        compositing:reference.compositing ?? null,
        avatar:Object.freeze({schemaVersion:1,dealerId,profileRevision:revision,imageSha256:reference.image.sha256,imageBase64:reference.image.bytes.toString('base64')})});
    },
    async prepareMoving({dealerId,beforeCostly,signal,sourceSet}) {
      const {profile,revision,assertFresh:assertProfileFresh} = await prepareProfile({dealerId,beforeCostly,signal},'motion-video');
      if (typeof readVideoRegistry !== 'function') fail('generated_speech_moving_not_configured');
      let sources;
      try { sources = validateMovingSpeechSourceSet(sourceSet); }
      catch { fail('generated_speech_moving_sources_invalid'); }
      const expected = sources.clips.find(clip => clip.videoId === profile.reference.videoId && clip.sha256 === profile.reference.sha256);
      if (sources.dealerId !== dealerId || !expected) fail('generated_speech_reference_mismatch');
      // Offset selects the frame containing that timestamp in this exact 24fps
      // original. It does not change the bank's independently explicit rest.
      if (Math.floor(profile.reference.offsetMs * expected.fps / 1000) >= expected.frameCount) fail('generated_speech_reference_out_of_range');
      const readSource = async () => {
        signal?.throwIfAborted();
        const registry = await readVideoRegistry();
        signal?.throwIfAborted();
        const matches = registry?.videos?.filter(video => video.id === expected.videoId);
        if (matches?.length !== 1) fail('generated_speech_moving_reference_unavailable');
        const video = matches[0];
        let compositing;
        try {
          assertMovingSpeechSource(video,dealerId,expected);
          validateDealerSpeechReference(profile,video,dealerId);
          if (typeof video.revision !== 'string' || !video.revision) throw Error('Unversioned source');
          compositing = effectiveDealerCompositing(video.compositing ?? video.classification?.compositing);
        } catch { fail('generated_speech_moving_reference_unavailable'); }
        return {compositing,identity:JSON.stringify([video.revision,video.classification,video.compositing ?? null])};
      };
      const original = await readSource();
      const assertFresh = async () => {
        await assertProfileFresh();
        if ((await readSource()).identity !== original.identity) fail('generated_speech_reference_changed');
      };
      const source = await prepareVoice(profile,assertFresh,signal);
      return Object.freeze({source,assertFresh,profileRevision:revision,compositing:Object.freeze(original.compositing)});
    },
  });
}
