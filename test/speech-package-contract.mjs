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
