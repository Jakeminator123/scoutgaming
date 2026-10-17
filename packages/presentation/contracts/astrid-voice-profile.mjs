// Non-secret voice choice for Astrid's generated chat speech. Recorded takes
// keep their own embedded audio and are never silently regenerated.
export const ASTRID_VOICE_PROFILE = Object.freeze({
  name: 'Victoria',
  provider: 'cartesia-runpod',
  modelId: 'sonic-3.5',
  voiceId: 'dc30854e-e398-4579-9dc8-16f6cb2c19b9',
  profileRevision: 'astrid-spel2x-victoria-v1',
  sampleRate: 24000,
});

// Already generated preview packages retain their original, immutable profile.
export const LEGACY_ASTRID_VOICE_PROFILE = Object.freeze({
  provider: 'elevenlabs-runpod',
  modelId: 'eleven_multilingual_v2',
  voiceId: 'EXAVITQu4vr4xnSDxMaL',
  profileRevision: 'astrid-spel2x-preview-v1',
});
