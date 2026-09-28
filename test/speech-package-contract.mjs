import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechPackageRegistry, normalizeSpeechPackage, validateSpeechPackage } from '../web/public/speech-package.mjs';

const sha = character => character.repeat(64);
const recorded = () => ({
  schemaVersion: 1, packageId: 'astrid.goodluck.v1', revision: 'speech-revision-7', dealerId: 'astrid', exactText: 'Good luck.',
  source: { kind: 'recordedLine', lineId: 'goodluck' },
  audio: { url: '/dealers/astrid/audio/en/goodluck.mp3', sha256: sha('a'), durationMs: 1830 },
  video: { videoId: 'astrid.goodluck.video', url: '/dealers/astrid/speech/goodluck.mp4', sha256: sha('b'), fps: 30, frameCount: 55, presentation: 'lipsync' },
  audioDelayMs: 80, entryPose: 'standard-idle', exitPose: 'standard-idle', calibrationRevision: 'calibration-4', reviewStatus: 'approved',
});

const generated = () => ({
  schemaVersion: 1, packageId: 'astrid.tts.request-1', revision: 'tts-revision-1', dealerId: 'astrid', exactText: 'Tack för att du väntade.',
  source: { kind: 'generatedText', voiceId: 'astrid-tts-v1' },
  audio: { url: 'https://media.example/speech/request-1.mp3', sha256: sha('c'), durationMs: 2100 },
  video: { videoId: 'astrid.standard-idle', url: '/dealers/astrid/idle/standard.mp4', sha256: sha('d'), fps: 30, frameCount: 90, presentation: 'neutral' },
  audioDelayMs: 0, entryPose: 'standard-idle', exitPose: 'standard-idle', calibrationRevision: 'neutral-calibration-1', reviewStatus: 'approved',
});

test('approved recorded package validates as one complete immutable tuple', () => {
  assert.deepEqual(validateSpeechPackage(recorded(), { expected: recorded() }), recorded());
});

test('wrong text, hashes, revision, frame index, calibration or approval reject the whole tuple', () => {
  const expected = recorded();
  const mutations = [
    value => { value.exactText = 'Other words'; },
    value => { value.audio.sha256 = sha('e'); },
    value => { value.video.sha256 = sha('f'); },
    value => { value.revision = 'speech-revision-8'; },
    value => { value.video.frameCount = 56; },
    value => { value.calibrationRevision = 'calibration-5'; },
  ];
  for (const mutate of mutations) {
    const candidate = structuredClone(expected); mutate(candidate);
    assert.throws(() => validateSpeechPackage(candidate, { expected }), { code: 'speech_package_tuple_mismatch' });
  }
  const pending = recorded(); pending.reviewStatus = 'pending';
  assert.throws(() => validateSpeechPackage(pending), { code: 'speech_package_not_approved' });
});

test('generated OpenClaw text requires neutral video and neutral start/end poses', () => {
  assert.equal(validateSpeechPackage(generated()).video.presentation, 'neutral');
  const oldMouth = generated();
  oldMouth.video = recorded().video;
  assert.throws(() => normalizeSpeechPackage(oldMouth), { code: 'generated_text_requires_neutral_video' });
  const actionPose = generated(); actionPose.entryPose = 'deal-left';
  assert.throws(() => normalizeSpeechPackage(actionPose), { code: 'generated_text_requires_neutral_pose' });
});

test('registry rejects unknown and duplicate package IDs and validates registered bytes', () => {
  const registry = createSpeechPackageRegistry([recorded(), generated()]);
  assert.equal(registry.size, 2);
  assert.equal(registry.validate(recorded()).packageId, 'astrid.goodluck.v1');
  const unknown = generated(); unknown.packageId = 'astrid.tts.unknown';
  assert.throws(() => registry.validate(unknown), { code: 'unknown_speech_package' });
  assert.throws(() => createSpeechPackageRegistry([recorded(), recorded()]), { code: 'duplicate_speech_package_id' });
});

const generatedLipsync = () => {
  const value = generated(), artifactId = 'a'.repeat(32);
  return { ...value, schemaVersion: 2, packageId: `generated-${artifactId}`, dealerId: 'astrid', reviewStatus: 'pending',
    source: { kind: 'generatedText', voiceId: 'dc30854e-e398-4579-9dc8-16f6cb2c19b9' },
    audio: { ...value.audio, url: `/api/generated-speech/${artifactId}/audio`, durationMs: 2000 },
    video: { ...value.video, url: `/api/generated-speech/${artifactId}/video`, presentation: 'lipsync', fps: 24, frameCount: 48 },
    calibrationRevision: 'unreviewed-fixed-24fps',
    generation: { requestId: 'test-request', provider: 'cartesia-runpod', modelId: 'sonic-3.5', avatarId: 'astrid_spel2x', profileRevision: 'astrid-spel2x-victoria-v1', textSha256: sha('e'), audioSha256: value.audio.sha256 } };
};

test('v2 generated lipsync is an explicit pending-only preview; v1 remains neutral-only', () => {
  const value = generatedLipsync();
  assert.deepEqual(validateSpeechPackage(value, { requireApproved: false }), value);
  assert.throws(() => validateSpeechPackage(value), { code: 'speech_package_not_approved' });
  const v1 = generated(); v1.video.presentation = 'lipsync';
  assert.throws(() => normalizeSpeechPackage(v1), { code: 'generated_text_requires_neutral_video' });
  const approved = generatedLipsync(); approved.reviewStatus = 'approved';
  assert.throws(() => normalizeSpeechPackage(approved), { code: 'invalid_generated_lipsync_package' });
});

test('older generated Sarah packages remain readable without changing their voice or hashes', () => {
  const old = generatedLipsync();
  old.source.voiceId = 'EXAVITQu4vr4xnSDxMaL';
  old.generation.provider = 'elevenlabs-runpod';
  old.generation.modelId = 'eleven_multilingual_v2';
  old.generation.profileRevision = 'astrid-spel2x-preview-v1';
  assert.deepEqual(normalizeSpeechPackage(old), old);
});

test('v2 rejects cross-origin/cross-artifact media, wrong profile, dealer, hashes and timing', () => {
  for (const mutate of [value => { value.audio.url = 'https://external.invalid/audio'; },
    value => { value.video.url = '/api/generated-speech/' + 'b'.repeat(32) + '/video'; },
    value => { value.dealerId = 'vera'; }, value => { value.generation.avatarId = 'unknown'; },
    value => { value.source.voiceId = 'other-voice'; }, value => { value.generation.modelId = 'other-model'; },
    value => { value.generation.audioSha256 = sha('f'); }, value => { value.video.fps = 30; },
    value => { value.video.frameCount = 96; }, value => { value.entryPose = 'deal'; },
    value => { value.generation.path = '/private/path'; }]) {
    const value = generatedLipsync(); mutate(value);
    assert.throws(() => normalizeSpeechPackage(value), { code: 'invalid_generated_lipsync_package' });
  }
  const expected = generatedLipsync(), changed = generatedLipsync(); changed.exactText = 'Other text.';
  assert.throws(() => validateSpeechPackage(changed, { expected, requireApproved: false }), { code: 'speech_package_tuple_mismatch' });
});
