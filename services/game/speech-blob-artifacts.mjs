import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { putPrivateMedia, getPrivateMedia, deletePrivateMedia, validatePrivateMedia, mediaBlobPath,
  isCloudMediaConfigured } from './blob-media.mjs';
import { normalizeSpeechPackage } from '../../packages/presentation/contracts/speech-package.mjs';
import { GENERATED_SPEECH_LIMITS } from '../../packages/presentation/server/generated-speech-provider.mjs';

const idPattern = /^[a-f0-9]{32}$/, hashPattern = /^[a-f0-9]{64}$/;
const kinds = { audio: { extension: 'wav', contentType: 'audio/wav', limit: 44 + 24000 * 2 * 25 },
  video: { extension: 'mp4', contentType: 'video/mp4', limit: GENERATED_SPEECH_LIMITS.videoBytes } };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
class SpeechBlobArtifactError extends Error {
  constructor(code = 'generated_speech_blob_unavailable', statusCode = 503) { super(code); this.code = code; this.statusCode = statusCode; }
}
const fail = (code, statusCode) => { throw new SpeechBlobArtifactError(code,statusCode); };
const safeFailure = error => error instanceof SpeechBlobArtifactError ? error : new SpeechBlobArtifactError();
function identity(artifactId, ownerHash) {
  if (typeof artifactId !== 'string' || !idPattern.test(artifactId)
    || typeof ownerHash !== 'string' || !hashPattern.test(ownerHash)) fail('generated_speech_not_found', 404);
}
function pathname(artifactId, ownerHash, hash, kind) {
  const uuid = `${artifactId.slice(0,8)}-${artifactId.slice(8,12)}-${artifactId.slice(12,16)}-${artifactId.slice(16,20)}-${artifactId.slice(20)}`;
  return mediaBlobPath(`dealers/astrid/runtime/generated/${ownerHash}`, uuid, hash, kinds[kind].extension);
}
function checkedPackage(value, artifactId) {
  let speechPackage;
  try { speechPackage = normalizeSpeechPackage(value); } catch { fail('generated_speech_corrupt_artifact', 409); }
  if (speechPackage.schemaVersion !== 2 || speechPackage.packageId !== `generated-${artifactId}`
    || speechPackage.generation.textSha256 !== digest(speechPackage.exactText)) fail('generated_speech_corrupt_artifact', 409);
  return speechPackage;
}
function reference(value, artifactId, ownerHash, speechPackage, kind) {
  let record;
  try { record = structuredClone(validatePrivateMedia(value)); } catch { fail('generated_speech_corrupt_artifact', 409); }
  if (record.pathname !== pathname(artifactId,ownerHash,speechPackage[kind].sha256,kind)
    || record.sha256 !== speechPackage[kind].sha256 || record.contentType !== kinds[kind].contentType
    || record.size > kinds[kind].limit) fail('generated_speech_corrupt_artifact', 409);
  return record;
}
function completed(value, artifactId, ownerHash) {
  if (!exact(value,['speechPackage','artifacts']) || !exact(value.artifacts,['schemaVersion','artifactId','ownerHash','audio','video'])
    || value.artifacts.schemaVersion !== 1) fail('generated_speech_corrupt_artifact', 409);
  if (value.artifacts.artifactId !== artifactId || value.artifacts.ownerHash !== ownerHash) fail('generated_speech_not_found', 404);
  const speechPackage = checkedPackage(value.speechPackage,artifactId), artifacts = {};
  for (const kind of Object.keys(kinds)) artifacts[kind] = reference(value.artifacts[kind],artifactId,ownerHash,speechPackage,kind);
  return { speechPackage, artifacts };
}

// The existing Blob implementation hashes exact readback bytes. Its file cache
// is deliberately confined to a new OS temporary directory for each operation,
// never a persistent product directory or an alternate artifact source.
async function withCache(options, work) {
  const cacheRoot = resolve(tmpdir()), cacheDir = await mkdtemp(join(cacheRoot,'croupier-speech-blob-'));
  try { return await work({ ...options, cacheDir }); }
  finally {
    if (dirname(cacheDir) !== cacheRoot || !basename(cacheDir).startsWith('croupier-speech-blob-')) fail();
    await rm(cacheDir,{ recursive:true, force:true });
  }
}

// Construction does no provider, database or filesystem work. The caller alone
// reserves paid work and publishes these server-only references to a completed
// owner-bound Neon journal record; Blob never stores the authoritative metadata.
export function createSpeechBlobArtifacts({ env = process.env, blobClient } = {}) {
  const options = { env: Object.freeze({ CROUPIER_MEDIA_STORAGE: env.CROUPIER_MEDIA_STORAGE,
    BLOB_READ_WRITE_TOKEN: env.BLOB_READ_WRITE_TOKEN }), ...(blobClient ? { blobClient } : {}) };
  const configured = () => { if (!isCloudMediaConfigured(options.env)) fail(); };
  return Object.freeze({
    async save({ artifactId, ownerHash, speechPackage: value, audio, video } = {}) {
      try {
        configured(); identity(artifactId,ownerHash);
        const speechPackage = checkedPackage(value,artifactId), media = {};
        // Snapshot both byte buffers before the first await. A mutation during
        // upload cannot change any member of the text/audio/video package tuple.
        for (const [kind, input] of [['audio',audio],['video',video]]) {
          if (!Buffer.isBuffer(input?.bytes) || !input.bytes.length || input.bytes.length > kinds[kind].limit
            || input.contentType !== kinds[kind].contentType || input.sha256 !== speechPackage[kind].sha256
            || digest(input.bytes) !== input.sha256) fail('generated_speech_corrupt_artifact', 409);
          media[kind] = { bytes:Buffer.from(input.bytes), sha256:input.sha256, contentType:kinds[kind].contentType };
        }
        return await withCache(options,async cacheOptions => {
          const created = [], artifacts = { schemaVersion:1, artifactId, ownerHash };
          try {
            for (const kind of Object.keys(kinds)) {
              const input = media[kind];
              const record = await putPrivateMedia(pathname(artifactId,ownerHash,input.sha256,kind),input.bytes,
                { ...cacheOptions, sha256:input.sha256, size:input.bytes.length, contentType:input.contentType });
              created.push(record); artifacts[kind] = reference(record,artifactId,ownerHash,speechPackage,kind);
            }
            return { speechPackage, artifacts };
          } catch (error) {
            // Only this operation's successfully created immutable objects are
            // removed. A lost later SQL commit must preserve its paid evidence.
            for (const record of created) await deletePrivateMedia(record,cacheOptions).catch(() => {});
            throw error;
          }
        });
      } catch (error) { throw safeFailure(error); }
    },
    async get({ artifactId, kind, ownerHash, completedPackage, request } = {}) {
      try {
        configured(); identity(artifactId,ownerHash);
        if (!Object.hasOwn(kinds,kind)) fail('generated_speech_not_found', 404);
        // completedPackage is obtained by the caller's exact Neon query for the
        // current owner + package ID + completed fullfile state, never a request body.
        const saved = completed(completedPackage,artifactId,ownerHash), record = saved.artifacts[kind];
        if (request !== undefined && (!(request instanceof Request) || !['GET','HEAD'].includes(request.method))) fail('generated_speech_not_found', 404);
        const headers = new Headers();
        if (request) for (const header of ['origin','sec-fetch-site']) {
          const value = request.headers.get(header); if (value !== null) headers.set(header,value);
        }
        // The legacy media caller returns full verified bytes and handles HTTP
        // delivery itself. Client range/conditional headers cannot bypass proof.
        const readRequest = new Request(request?.url ?? `https://speech.invalid/api/generated-speech/${artifactId}/${kind}`, { headers });
        return await withCache(options,async cacheOptions => {
          const response = await getPrivateMedia(record,readRequest,cacheOptions);
          if (response.status !== 200 || response.headers.get('content-type') !== record.contentType) {
            await response.body?.cancel();
            fail(response.status === 403 ? 'generated_speech_not_found' : 'generated_speech_blob_unavailable', response.status === 403 ? 404 : 503);
          }
          const bytes = Buffer.from(await response.arrayBuffer());
          if (bytes.length !== record.size || digest(bytes) !== record.sha256) fail('generated_speech_corrupt_artifact', 409);
          return { bytes, contentType:record.contentType };
        });
      } catch (error) { throw safeFailure(error); }
    },
  });
}
