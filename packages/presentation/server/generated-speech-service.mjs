import { createHash, randomBytes } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { createGeneratedSpeechProvider, GENERATED_SPEECH_DEFAULTS, GENERATED_SPEECH_LIMITS } from './generated-speech-provider.mjs';
import { normalizeSpeechPackage } from '../contracts/speech-package.mjs';
import { ASTRID_VOICE_PROFILE } from '../contracts/astrid-voice-profile.mjs';
import { createSpeechJournalLease, requireSpeechJournal } from './speech-journal-lease.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const PROFILE = ASTRID_VOICE_PROFILE.profileRevision;
const AUDIO_LIMIT = 44 + 24000 * 2 * 25;
const MEDIA_ID = /^[a-f0-9]{32}$/;
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const ownerDigest = owner => {
  if (typeof owner !== 'string' || !owner || owner.length > 512 || /[\u0000-\u001f\u007f]/.test(owner)) fail('invalid_generated_speech_owner', 400);
  return digest(owner);
};

export class GeneratedSpeechServiceError extends Error {
  constructor(code, statusCode = 503) { super(code); this.name = 'GeneratedSpeechServiceError'; this.code = code; this.statusCode = statusCode; }
}
const fail = (code, statusCode) => { throw new GeneratedSpeechServiceError(code, statusCode); };
const safeFailure = error => error instanceof GeneratedSpeechServiceError ? error : new GeneratedSpeechServiceError(
  /^(?:generated_speech_|invalid_generated_speech_)[a-z_]+$/.test(error?.code ?? '') ? error.code : 'generated_speech_failed',
  [400, 409, 429, 499, 502, 503, 504].includes(error?.statusCode) ? error.statusCode : 503);

export function requireGeneratedSpeechArtifacts(artifacts) {
  if (!artifacts || typeof artifacts.save !== 'function' || typeof artifacts.get !== 'function') fail('generated_speech_artifacts_unavailable');
  return artifacts;
}
// Neon owns request identity and budget; the artifact adapter owns private bytes.
// Artifacts never inherit visual acceptance. Request reservations survive failed
// jobs/restarts: an uncertain paid request is not automatically charged again.
export function createGeneratedSpeechService(config, { repositoryRoot, provider = null, journal = null, artifacts = null, fetchImpl = fetch } = {}) {
  if (typeof repositoryRoot !== 'string' || !isAbsolute(repositoryRoot)) throw new TypeError('Explicit repositoryRoot required');
  requireSpeechJournal(journal);
  if (typeof journal.assertFullfileReservation !== 'function') fail('generated_speech_journal_unavailable');
  requireGeneratedSpeechArtifacts(artifacts);
  if (!config) fail('generated_speech_not_configured');
  const voiceId = config.voiceId ?? GENERATED_SPEECH_DEFAULTS.voiceId;
  const modelId = config.modelId ?? GENERATED_SPEECH_DEFAULTS.modelId;
  if (voiceId !== GENERATED_SPEECH_DEFAULTS.voiceId || modelId !== GENERATED_SPEECH_DEFAULTS.modelId) fail('generated_speech_unknown_profile');
  let runtime = provider;
  const pending = new Map();
  const ownership = createSpeechJournalLease({ journal, resource:'fullfile-provider' });

  function outputPackage(result, input, artifactId) {
    if (result?.exactText !== input.text || result?.voiceId !== voiceId || result?.modelId !== modelId || result?.provider?.kind !== ASTRID_VOICE_PROFILE.provider) fail('generated_speech_output_mismatch', 502);
    for (const [kind, max, contentType] of [['audio', AUDIO_LIMIT, 'audio/wav'], ['video', GENERATED_SPEECH_LIMITS.videoBytes, 'video/mp4']]) {
      const media = result[kind];
      if (!Buffer.isBuffer(media?.bytes) || !media.bytes.length || media.bytes.length > max || media.contentType !== contentType || digest(media.bytes) !== media.sha256) fail('generated_speech_output_mismatch', 502);
    }
    return normalizeSpeechPackage({ schemaVersion: 2, packageId: `generated-${artifactId}`, revision: `generated-${digest(input.text + result.audio.sha256 + result.video.sha256)}`,
      dealerId: 'astrid', exactText: input.text, source: { kind: 'generatedText', voiceId },
      audio: { url: `/api/generated-speech/${artifactId}/audio`, sha256: result.audio.sha256, durationMs: result.audio.durationMs },
      video: { videoId: `generated-${artifactId}.video`, url: `/api/generated-speech/${artifactId}/video`, sha256: result.video.sha256, fps: result.video.fps, frameCount: result.video.frameCount, presentation: 'lipsync' },
      audioDelayMs: 0, entryPose: 'standard-idle', exitPose: 'standard-idle', calibrationRevision: 'unreviewed-fixed-24fps', reviewStatus: 'pending',
      generation: { requestId: input.requestId, provider: ASTRID_VOICE_PROFILE.provider, modelId, avatarId: 'astrid_spel2x', profileRevision: PROFILE, textSha256: digest(input.text), audioSha256: result.audio.sha256 } });
  }
  async function execute(input, ownerHash, key, fingerprint) {
    const identity = { ownerHash, requestId:input.requestId, fingerprint, capability:'fullfile' };
    const existing = await journal.findRequest(identity);
    if (existing) {
      if (existing.state !== 'completed') fail('generated_speech_request_already_attempted', 409);
      const cached = normalizeSpeechPackage(existing.packageMetadata.speechPackage);
      const id = existing.packageId?.replace(/^generated-/, '');
      if (!MEDIA_ID.test(id ?? '') || cached.packageId !== existing.packageId) fail('generated_speech_corrupt_artifact', 409);
      return cached;
    }
    let claimed = false;
    try {
      const lease = await ownership.get();
      input.signal?.throwIfAborted(); await input.beforeCostly?.(); input.signal?.throwIfAborted();
      const budget = { reserveMicroUsd:config.reserveMicroUsd, currentBudgetMicroUsd:config.dailyBudgetMicroUsd };
      const claim = await journal.claimRequest({ ...identity, lease, ...budget });
      if (claim.status !== 'new') fail('generated_speech_request_already_attempted', 409);
      claimed = true;
      await journal.markRequestSubmissionStarted({ key, lease:await ownership.get(), ...budget });
      runtime ??= createGeneratedSpeechProvider({ ...config, voiceId, modelId }, { fetchImpl });
      const result = await runtime.generate({ requestId:`speech-${key}`, text:input.text, signal:input.signal,
        beforeCostly:async () => {
          input.signal?.throwIfAborted(); await input.beforeCostly?.();
          const currentLease = await ownership.get();
          await journal.assertFullfileReservation({ key, lease:currentLease, ...budget });
          input.signal?.throwIfAborted();
        }, onProgress:input.onProgress });
      if (input.signal?.aborted) fail('generated_speech_cancelled', 499);
      const id = randomBytes(16).toString('hex'), speechPackage = outputPackage(result, input, id);
      const saved = await artifacts.save({ artifactId:id, ownerHash, speechPackage, audio:result.audio, video:result.video });
      if (!saved || JSON.stringify(normalizeSpeechPackage(saved.speechPackage)) !== JSON.stringify(speechPackage)
        || !saved.artifacts || typeof saved.artifacts !== 'object') fail('generated_speech_corrupt_artifact', 409);
      await journal.completeRequest({ key, lease:await ownership.get(), packageId:speechPackage.packageId, packageMetadata:saved });
      return speechPackage;
    } catch (error) {
      const safe = safeFailure(error);
      if (claimed) { try { await journal.failRequest({ key, lease:await ownership.get(), safeCode:safe.code }); } catch {} }
      throw safe;
    } finally { try { await ownership.release(); } catch {} }
  }
  return Object.freeze({
    generate(input) {
      let ownerHash, key, fingerprint;
      try {
        ownerHash = ownerDigest(input?.owner);
        if (!identifier(input?.requestId) || input.dealerId !== 'astrid' || typeof input.text !== 'string' || !input.text.trim()
          || input.text !== input.text.trim().replace(/\r\n?/g, '\n') || input.text.length > GENERATED_SPEECH_LIMITS.textChars
          || /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/.test(input.text)
          || (input.signal !== undefined && !(input.signal instanceof AbortSignal))) fail('invalid_generated_speech_request', 400);
        key = digest(`${ownerHash}\0${input.requestId}`);
        fingerprint = digest(JSON.stringify({ ownerHash, text: input.text, dealerId: input.dealerId, voiceId, modelId, profile: PROFILE }));
        const previous = pending.get(key);
        if (previous) {
          if (previous.fingerprint !== fingerprint) fail('generated_speech_request_conflict', 409);
          return previous.promise.then(structuredClone);
        }
      } catch (error) { return Promise.reject(safeFailure(error)); }
      const promise = execute(input, ownerHash, key, fingerprint).catch(error => { throw safeFailure(error); });
      pending.set(key, { fingerprint, promise });
      promise.finally(() => pending.delete(key)).catch(() => {});
      return promise.then(structuredClone);
    },
    async media({ id, kind, owner, request } = {}) {
      try {
        const ownerHash = ownerDigest(owner);
        if (!['audio', 'video'].includes(kind)) fail('generated_speech_not_found', 404);
        if (!MEDIA_ID.test(id ?? '')) fail('generated_speech_not_found', 404);
        const saved = await journal.getCompletedPackageById({ ownerHash, packageId:`generated-${id}` });
        const speechPackage = normalizeSpeechPackage(saved.packageMetadata.speechPackage);
        if (speechPackage.packageId !== saved.packageId) fail('generated_speech_corrupt_artifact', 409);
        const media = await artifacts.get({ artifactId:id, kind, ownerHash, completedPackage:saved.packageMetadata, request });
        if (!Buffer.isBuffer(media?.bytes) || digest(media.bytes) !== speechPackage[kind].sha256
          || media.contentType !== (kind === 'audio' ? 'audio/wav' : 'video/mp4')) fail('generated_speech_corrupt_artifact', 409);
        return media;
      } catch (error) {
        if (error.code === 'ENOENT') fail('generated_speech_not_found', 404);
        throw safeFailure(error);
      }
    },
  });
}
