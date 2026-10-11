import { createPcmSource, validTtsIdentifier } from './pcm-source.mjs';

/** Complete transcript -> bounded raw PCM. Credentials remain server-only. */
export function createCartesiaSource({ apiKey, voiceId, modelId, timeoutMs = 30000 }, dependencies = {}) {
  if (typeof apiKey !== 'string' || !apiKey.length || apiKey.length > 2048 || /[\s\u0000-\u001f]/.test(apiKey)
    || !validTtsIdentifier(voiceId) || !validTtsIdentifier(modelId)) throw new Error('Invalid TTS configuration');
  return createPcmSource({ timeoutMs, request: text => ({
    url: 'https://api.cartesia.ai/tts/bytes',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + apiKey, 'Cartesia-Version': '2026-08-14' },
    body: { transcript: text, voice: voiceId, model_id: modelId, output_format: { container: 'raw', encoding: 'pcm_s16le', sample_rate: 24000 } },
  }) }, dependencies);
}
