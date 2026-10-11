import { createPcmSource, validTtsIdentifier } from './pcm-source.mjs';

// Complete text, one paid request, bounded raw PCM24k mono. No provider fallback.
export function createElevenLabsSource({ apiKey, voiceId, modelId, language, settings, timeoutMs = 30000 }, dependencies = {}) {
  if (typeof apiKey !== 'string' || !apiKey.length || apiKey.length > 2048 || /[\s\u0000-\u001f]/.test(apiKey)
    || !validTtsIdentifier(voiceId) || !validTtsIdentifier(modelId)) throw new Error('Invalid TTS configuration');
  if (language !== undefined && (typeof language !== 'string' || !/^[a-z]{2}$/.test(language))) throw new Error('Invalid TTS language');
  const numericSettings = ['stability','similarity_boost','style'];
  if (settings !== undefined && (!settings || typeof settings !== 'object' || Array.isArray(settings) || !Object.keys(settings).length
    || Object.keys(settings).some(key => numericSettings.includes(key)
      ? !Number.isFinite(settings[key]) || settings[key] < 0 || settings[key] > 1
      : key !== 'use_speaker_boost' || typeof settings[key] !== 'boolean'))) throw new Error('Invalid TTS settings');
  const voiceSettings = settings === undefined ? undefined : Object.freeze({...settings});
  return createPcmSource({ timeoutMs, request: text => ({
    url: `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=pcm_24000`,
    headers: { 'content-type': 'application/json', 'xi-api-key': apiKey },
    body: { text, model_id: modelId, ...(voiceSettings ? {voice_settings:voiceSettings} : {}),
      // multilingual_v2 does not accept language_code; v3 preserves the
      // verified clone request contract. Language stays explicit profile intent.
      ...(language && !['eleven_v3','eleven_multilingual_v2'].includes(modelId) ? {language_code:language} : {}) },
  }) }, dependencies);
}
