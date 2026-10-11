import { normalizeDealerSpeechProfile } from './public/dealer-speech-profile.mjs';
import { dealerSpeechProfileRevision } from './dealer-speech-reference.mjs';
import { createCartesiaSource } from '../services/astrid-gpu-worker/gateway/cartesia-source.mjs';
import { createElevenLabsSource } from '../services/astrid-gpu-worker/gateway/elevenlabs-source.mjs';

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
export function createDealerSpeechRuntime({readProject, referenceService, env = process.env, fetchImpl = fetch} = {}) {
  if (typeof readProject !== 'function' || typeof referenceService?.prepare !== 'function') throw Error('Invalid dealer speech runtime');
  const enabled = env.CROUPIER_DEALER_SPEECH_PROFILES === '1';
  const keys = {cartesia:env.CARTESIA_API_KEY,elevenlabs:env.ELEVENLABS_API_KEY};
  async function profileFor(dealerId) {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(dealerId ?? '')) fail('generated_speech_dealer_invalid');
    const matches = (await readProject())?.dealers?.filter(dealer => dealer.id === dealerId);
    if (matches?.length !== 1) fail('generated_speech_dealer_unavailable');
    if (!matches[0].speechProfile) return null;
    try { return normalizeDealerSpeechProfile(matches[0].speechProfile); }
    catch { fail('generated_speech_profile_invalid'); }
  }
  return Object.freeze({
    async requested(dealerId) { return (await profileFor(dealerId))?.state === 'enabled'; },
    async prepare({dealerId,beforeCostly,signal}) {
      await beforeCostly(); signal?.throwIfAborted();
      const profile = await profileFor(dealerId);
      if (!enabled) fail('generated_speech_profiles_not_configured');
      if (profile?.state !== 'enabled') fail('generated_speech_profile_not_enabled');
      const revision = dealerSpeechProfileRevision(profile);
      const assertFresh = async () => {
        signal?.throwIfAborted(); await beforeCostly();
        const current = await profileFor(dealerId);
        if (!current || current.state !== 'enabled' || dealerSpeechProfileRevision(current) !== revision) fail('generated_speech_profile_changed');
        signal?.throwIfAborted();
      };
      const apiKey = keys[profile.voice.provider];
      if (typeof apiKey !== 'string' || !apiKey.length || /[\s\u0000-\u001f]/.test(apiKey)) fail('generated_speech_voice_not_configured');
      const createSource = profile.voice.provider === 'cartesia' ? createCartesiaSource : createElevenLabsSource;
      const source = createSource({...profile.voice,apiKey},{fetchImpl});
      await verifyVoice(profile.voice,apiKey,fetchImpl,signal);
      await assertFresh();
      const reference = await referenceService.prepare({dealerId,profile,profileRevision:revision,beforeCostlyStep:assertFresh,signal});
      if (reference.dealerId !== dealerId || reference.profileRevision !== revision) fail('generated_speech_reference_mismatch');
      await assertFresh();
      return Object.freeze({source,assertFresh,profileRevision:revision,imageSha256:reference.image.sha256,
        compositing:reference.compositing ?? null,
        avatar:Object.freeze({schemaVersion:1,dealerId,profileRevision:revision,imageSha256:reference.image.sha256,imageBase64:reference.image.bytes.toString('base64')})});
    },
  });
}
