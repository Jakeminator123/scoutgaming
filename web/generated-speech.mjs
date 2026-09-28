import { createHash, randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, realpath, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGeneratedSpeechProvider, GENERATED_SPEECH_DEFAULTS, GENERATED_SPEECH_LIMITS } from './generated-speech-provider.mjs';
import { normalizeSpeechPackage } from './public/speech-package.mjs';
import { ASTRID_VOICE_PROFILE } from './public/astrid-voice-profile.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const PROFILE = ASTRID_VOICE_PROFILE.profileRevision;
const REPOSITORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO_LIMIT = 44 + 24000 * 2 * 25;
const STORE_LIMIT = 256 * 1024 * 1024;
const MEDIA_ID = /^[a-f0-9]{32}$/;
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const equalPath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const privateDirectory = directory => {
  if (typeof directory !== 'string' || !isAbsolute(directory)) return false;
  const path = resolve(directory), inside = relative(REPOSITORY, path);
  return ![parse(path).root, homedir(), process.cwd()].some(value => equalPath(path, resolve(value)))
    && (inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside));
};
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

function configuration(env) {
  const enabled = env.CROUPIER_GENERATED_SPEECH === '1' && env.CROUPIER_GENERATED_SPEECH_PREVIEW === '1'
    && ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(env.HOST);
  const value = { directory: env.CROUPIER_GENERATED_SPEECH_DIR,
    cartesiaApiKey: env.CARTESIA_API_KEY,
    runpodApiKey: env.RUNPOD_API_KEY, runpodEndpointId: env.CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID,
    voiceId: GENERATED_SPEECH_DEFAULTS.voiceId, modelId: GENERATED_SPEECH_DEFAULTS.modelId };
  const token = input => typeof input === 'string' && input.length > 0 && input.length <= 2048 && !/\s/.test(input);
  const configured = enabled && privateDirectory(value.directory)
    && token(value.cartesiaApiKey) && token(value.runpodApiKey) && /^[A-Za-z0-9_-]{1,100}$/.test(value.runpodEndpointId ?? '');
  return { enabled, configured, value };
}

export function generatedSpeechStatus(env = process.env) {
  const { enabled, configured } = configuration(env);
  return { enabled, configured, preview: true, dealerId: 'astrid', reviewStatus: 'pending' };
}

let singleton = null;
let singletonKey = null;
export function getGeneratedSpeechService() {
  const { configured, value } = configuration(process.env);
  if (!configured) return null;
  const key = digest(JSON.stringify(value));
  if (key !== singletonKey) { singleton = createGeneratedSpeechService(value); singletonKey = key; }
  return singleton;
}

// Only an explicitly isolated, private preview store. Artifacts never enter the
// dealer bank or inherit visual acceptance. Request reservations survive failed
// jobs/restarts: an uncertain paid request is not automatically charged again.
export function createGeneratedSpeechService(config, { provider = null } = {}) {
  if (!config || !privateDirectory(config.directory)) fail('generated_speech_invalid_directory');
  const directory = resolve(config.directory);
  const voiceId = config.voiceId ?? GENERATED_SPEECH_DEFAULTS.voiceId;
  const modelId = config.modelId ?? GENERATED_SPEECH_DEFAULTS.modelId;
  if (voiceId !== GENERATED_SPEECH_DEFAULTS.voiceId || modelId !== GENERATED_SPEECH_DEFAULTS.modelId) fail('generated_speech_unknown_profile');
  let runtime = provider;
  const pending = new Map();

  async function store() {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink() || !equalPath(await realpath(directory), directory)) fail('generated_speech_invalid_directory');
    return directory;
  }
  async function boundedFile(path, max) {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > max) fail('generated_speech_corrupt_artifact', 409);
    const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.size > max) fail('generated_speech_corrupt_artifact', 409);
      const bytes = await handle.readFile();
      if (bytes.length > max) fail('generated_speech_corrupt_artifact', 409);
      return bytes;
    } finally { await handle.close(); }
  }
  async function json(path) {
    const bytes = await boundedFile(path, 16384);
    try { return JSON.parse(bytes.toString('utf8')); } catch { fail('generated_speech_corrupt_artifact', 409); }
  }
  async function artifact(id, ownerHash) {
    if (!MEDIA_ID.test(id ?? '')) fail('generated_speech_not_found', 404);
    const target = join(directory, id);
    const info = await lstat(target);
    if (!info.isDirectory() || info.isSymbolicLink() || !equalPath(await realpath(target), target)) fail('generated_speech_not_found', 404);
    const record = await json(join(target, 'metadata.json'));
    if (record.ownerHash !== ownerHash) fail('generated_speech_not_found', 404);
    const speechPackage = normalizeSpeechPackage(record.speechPackage);
    if (speechPackage.packageId !== `generated-${id}` || speechPackage.generation.textSha256 !== digest(speechPackage.exactText)) fail('generated_speech_corrupt_artifact', 409);
    return { target, speechPackage };
  }
  async function assertCapacity() {
    let bytes = 0, requests = 0;
    for (const name of await readdir(directory)) {
      if (/^[a-f0-9]{64}\.request\.json$/.test(name)) requests++;
      if (!MEDIA_ID.test(name)) continue;
      const target = join(directory, name), info = await lstat(target);
      if (!info.isDirectory() || info.isSymbolicLink()) fail('generated_speech_corrupt_artifact', 409);
      for (const file of ['audio.wav', 'video.mp4']) {
        try { bytes += (await lstat(join(target, file))).size; } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
    }
    if (requests >= GENERATED_SPEECH_LIMITS.requestLedger || bytes + AUDIO_LIMIT + GENERATED_SPEECH_LIMITS.videoBytes > STORE_LIMIT) fail('generated_speech_store_full', 503);
  }
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
    await store();
    const reservation = join(directory, `${key}.request.json`);
    try {
      const existing = await json(reservation);
      if (existing.fingerprint !== fingerprint || existing.ownerHash !== ownerHash) fail('generated_speech_request_conflict', 409);
      try {
        const done = await json(join(directory, `${key}.done.json`));
        const { speechPackage } = await artifact(done.id, ownerHash);
        if (speechPackage.exactText !== input.text || speechPackage.generation.requestId !== input.requestId
          || speechPackage.source.voiceId !== voiceId || speechPackage.generation.modelId !== modelId) fail('generated_speech_corrupt_artifact', 409);
        return speechPackage;
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      fail('generated_speech_request_already_attempted', 409);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    // Lock covers the budget check and paid request across native/lab processes.
    // A crashed lock intentionally needs operator recovery rather than a retry.
    const lockPath = join(directory, 'provider.lock');
    let lock;
    try { lock = await open(lockPath, 'wx', 0o600); } catch (error) { if (error.code === 'EEXIST') fail('generated_speech_busy', 429); throw error; }
    let reserved = false;
    try {
      await assertCapacity();
      if (input.signal?.aborted) fail('generated_speech_cancelled', 499);
      await writeFile(reservation, JSON.stringify({ fingerprint, ownerHash }), { flag: 'wx', mode: 0o600 });
      reserved = true;
      runtime ??= createGeneratedSpeechProvider({ ...config, voiceId, modelId });
      const result = await runtime.generate({ requestId: `speech-${key}`, text: input.text, signal: input.signal, onProgress: input.onProgress });
      if (input.signal?.aborted) fail('generated_speech_cancelled', 499);
      const id = randomBytes(16).toString('hex');
      const speechPackage = outputPackage(result, input, id);
      const target = join(directory, id);
      await mkdir(target, { mode: 0o700 });
      await writeFile(join(target, 'audio.wav'), result.audio.bytes, { flag: 'wx', mode: 0o600 });
      await writeFile(join(target, 'video.mp4'), result.video.bytes, { flag: 'wx', mode: 0o600 });
      await writeFile(join(target, 'metadata.json'), JSON.stringify({ ownerHash, speechPackage }), { flag: 'wx', mode: 0o600 });
      await writeFile(join(directory, `${key}.done.json`), JSON.stringify({ id }), { flag: 'wx', mode: 0o600 });
      return speechPackage;
    } catch (error) {
      const safe = safeFailure(error);
      if (reserved) { try { await writeFile(join(directory, `${key}.failed.json`), JSON.stringify({ code: safe.code }), { flag: 'wx', mode: 0o600 }); } catch {} }
      throw safe;
    } finally { await lock.close(); await unlink(lockPath); }
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
    async media({ id, kind, owner } = {}) {
      try {
        const ownerHash = ownerDigest(owner);
        if (!['audio', 'video'].includes(kind)) fail('generated_speech_not_found', 404);
        await store();
        const { target, speechPackage } = await artifact(id, ownerHash);
        const bytes = await boundedFile(join(target, kind === 'audio' ? 'audio.wav' : 'video.mp4'), kind === 'audio' ? AUDIO_LIMIT : GENERATED_SPEECH_LIMITS.videoBytes);
        if (digest(bytes) !== speechPackage[kind].sha256) fail('generated_speech_corrupt_artifact', 409);
        return { bytes, contentType: kind === 'audio' ? 'audio/wav' : 'video/mp4' };
      } catch (error) {
        if (error.code === 'ENOENT') fail('generated_speech_not_found', 404);
        throw safeFailure(error);
      }
    },
  });
}
