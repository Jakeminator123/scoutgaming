export const SPEECH_PACKAGE_SCHEMA_VERSION = 1;
export const GENERATED_SPEECH_PACKAGE_SCHEMA_VERSION = 2;
export const SPEECH_PACKAGE_SOURCES = Object.freeze(['recordedLine', 'generatedText']);
export const SPEECH_REVIEW_STATUSES = Object.freeze(['pending', 'approved', 'rejected']);

export class SpeechPackageError extends Error {
  constructor(code) { super(code); this.name = 'SpeechPackageError'; this.code = code; }
}

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const id = (value, max = 128) => typeof value === 'string' && value.length > 0 && value.length <= max && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const canonicalText = value => typeof value === 'string' ? value.trim().replace(/\r\n?/g, '\n') : value;
const speechText = value => typeof value === 'string' && value.length > 0 && value.length <= 1000
  && value === canonicalText(value) && !/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/.test(value);
const fail = code => { throw new SpeechPackageError(code); };

function mediaUrl(value) {
  if (typeof value !== 'string' || !value || value.length > 2048 || value.includes('\\') || /(?:^|\/)\.\.(?:\/|$)/.test(value)) fail('invalid_media_url');
  if (value.startsWith('/')) {
    if (value.startsWith('//')) fail('invalid_media_url');
    return value;
  }
  let parsed;
  try { parsed = new URL(value); } catch { fail('invalid_media_url'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) fail('invalid_media_url');
  return parsed.href;
}

function normalizeSource(value) {
  if (!object(value) || !SPEECH_PACKAGE_SOURCES.includes(value.kind)) fail('invalid_speech_source');
  if (value.kind === 'recordedLine') {
    if (!exact(value, ['kind', 'lineId']) || !id(value.lineId, 64)) fail('invalid_speech_source');
    return { kind: 'recordedLine', lineId: value.lineId };
  }
  if (!exact(value, ['kind', 'voiceId']) || !id(value.voiceId)) fail('invalid_speech_source');
  return { kind: 'generatedText', voiceId: value.voiceId };
}

function normalizeAudio(value) {
  if (!exact(value, ['url', 'sha256', 'durationMs']) || !hash(value.sha256)
    || !Number.isInteger(value.durationMs) || value.durationMs < 1 || value.durationMs > 120000) fail('invalid_speech_audio');
  return { url: mediaUrl(value.url), sha256: value.sha256, durationMs: value.durationMs };
}

function normalizeVideo(value) {
  if (!exact(value, ['videoId', 'url', 'sha256', 'fps', 'frameCount', 'presentation']) || !id(value.videoId)
    || !hash(value.sha256) || typeof value.fps !== 'number' || !Number.isFinite(value.fps) || value.fps <= 0 || value.fps > 240
    || !Number.isInteger(value.frameCount) || value.frameCount < 1 || value.frameCount > 1000000
    || !['lipsync', 'neutral'].includes(value.presentation)) fail('invalid_speech_video');
  return { videoId: value.videoId, url: mediaUrl(value.url), sha256: value.sha256, fps: value.fps,
    frameCount: value.frameCount, presentation: value.presentation };
}

// Structural validation deliberately returns a fresh object. No renderer-only
// fields, callbacks or path hints survive into the playback contract.
export function normalizeSpeechPackage(value) {
  const fields = ['schemaVersion', 'packageId', 'revision', 'dealerId', 'exactText', 'source', 'audio', 'video',
    'audioDelayMs', 'entryPose', 'exitPose', 'calibrationRevision', 'reviewStatus'];
  const generatedLipsync = value?.schemaVersion === GENERATED_SPEECH_PACKAGE_SCHEMA_VERSION;
  if (generatedLipsync) fields.push('generation');
  if (!exact(value, fields) || ![SPEECH_PACKAGE_SCHEMA_VERSION, GENERATED_SPEECH_PACKAGE_SCHEMA_VERSION].includes(value.schemaVersion) || !id(value.packageId)
    || !id(value.revision) || !id(value.dealerId, 64) || !speechText(value.exactText)
    || !Number.isInteger(value.audioDelayMs) || value.audioDelayMs < -5000 || value.audioDelayMs > 5000
    || !id(value.entryPose) || !id(value.exitPose) || !id(value.calibrationRevision)
    || !SPEECH_REVIEW_STATUSES.includes(value.reviewStatus)) fail('invalid_speech_package');
  const source = normalizeSource(value.source);
  const audio = normalizeAudio(value.audio);
  const video = normalizeVideo(value.video);
  let generation;
  if (generatedLipsync) {
    const metadata = value.generation;
    const artifactId = /^generated-([a-f0-9]{32})$/.exec(value.packageId)?.[1];
    if (source.kind !== 'generatedText' || source.voiceId !== 'EXAVITQu4vr4xnSDxMaL' || video.presentation !== 'lipsync' || value.dealerId !== 'astrid'
      || !artifactId || audio.url !== `/api/generated-speech/${artifactId}/audio` || video.url !== `/api/generated-speech/${artifactId}/video`
      || value.entryPose !== 'standard-idle' || value.exitPose !== 'standard-idle' || value.audioDelayMs !== 0
      || value.reviewStatus !== 'pending' || value.calibrationRevision !== 'unreviewed-fixed-24fps'
      || !exact(metadata, ['requestId', 'provider', 'modelId', 'avatarId', 'profileRevision', 'textSha256', 'audioSha256'])
      || !id(metadata.requestId) || metadata.provider !== 'elevenlabs-runpod' || metadata.modelId !== 'eleven_multilingual_v2'
      || metadata.avatarId !== 'astrid_spel2x' || metadata.profileRevision !== 'astrid-spel2x-preview-v1' || !hash(metadata.textSha256)
      || metadata.audioSha256 !== audio.sha256 || audio.durationMs > 25000
      || video.fps !== 24 || Math.abs(video.frameCount / video.fps * 1000 - audio.durationMs) > 1000) fail('invalid_generated_lipsync_package');
    generation = { requestId: metadata.requestId, provider: metadata.provider, modelId: metadata.modelId, avatarId: metadata.avatarId,
      profileRevision: metadata.profileRevision, textSha256: metadata.textSha256, audioSha256: metadata.audioSha256 };
  }
  if (source.kind === 'recordedLine' && video.presentation !== 'lipsync') fail('recorded_line_requires_lipsync_video');
  if (source.kind === 'generatedText' && !generatedLipsync) {
    if (video.presentation !== 'neutral') fail('generated_text_requires_neutral_video');
    if (!['standard-idle', 'neutral'].includes(value.entryPose) || !['standard-idle', 'neutral'].includes(value.exitPose)) {
      fail('generated_text_requires_neutral_pose');
    }
  }
  return {
    schemaVersion: value.schemaVersion, packageId: value.packageId, revision: value.revision,
    dealerId: value.dealerId, exactText: value.exactText, source, audio, video,
    audioDelayMs: value.audioDelayMs, entryPose: value.entryPose, exitPose: value.exitPose,
    calibrationRevision: value.calibrationRevision, reviewStatus: value.reviewStatus,
    ...(generation ? { generation } : {}),
  };
}

function sameTuple(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

// Playback must validate against the server-selected registry tuple. A changed
// text, audio/video hash, revision, frame index, calibration or approval state
// rejects the entire package; there is no partial fallback inside a package.
export function validateSpeechPackage(value, { expected = null, requireApproved = true } = {}) {
  const actual = normalizeSpeechPackage(value);
  if (expected !== null) {
    const canonicalExpected = normalizeSpeechPackage(expected);
    if (!sameTuple(actual, canonicalExpected)) fail('speech_package_tuple_mismatch');
  }
  if (requireApproved && actual.reviewStatus !== 'approved') fail('speech_package_not_approved');
  return actual;
}

export function createSpeechPackageRegistry(entries) {
  if (!Array.isArray(entries)) fail('invalid_speech_package_registry');
  const packages = new Map();
  for (const entry of entries) {
    const value = normalizeSpeechPackage(entry);
    if (packages.has(value.packageId)) fail('duplicate_speech_package_id');
    packages.set(value.packageId, value);
  }
  return Object.freeze({
    get size() { return packages.size; },
    validate(candidate, options = {}) {
      if (!object(candidate) || !id(candidate.packageId) || !packages.has(candidate.packageId)) fail('unknown_speech_package');
      return validateSpeechPackage(candidate, { ...options, expected: packages.get(candidate.packageId) });
    },
  });
}
