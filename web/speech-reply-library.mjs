import { createHash, randomUUID } from 'node:crypto';
import { isDealerId } from '../packages/presentation/contracts/dealer-identity.mjs';
import { validateStudioScope } from '../packages/studio-registry/server/document-contract.mjs';
import { validateReplyCategories } from './public/speech-reply-library.mjs';
import { mediaBlobPath, validatePrivateMedia, isCloudMediaConfigured } from '../packages/studio-registry/server/private-media-contract.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
const TYPES = { audio: { extension: 'wav', contentType: 'audio/wav', max: 44 + 24000 * 2 * 30 }, video: { extension: 'mp4', contentType: 'video/mp4', max: 128 * 1024 * 1024 } };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export class SpeechReplyLibraryError extends Error {
  constructor(code = 'reply_library_unavailable', status = 503) { super(code); this.code = code; this.status = status; this.statusCode = status; }
}
const fail = (code, status) => { throw new SpeechReplyLibraryError(code, status); };
function identity(dealerId, id) {
  if (!isDealerId(dealerId) || (id !== undefined && !UUID.test(id))) fail('reply_library_invalid_identity', 400);
}
export const speechReplyScopeHash = scope => { const valid=validateStudioScope(scope);return digest(JSON.stringify([valid.environment,valid.workspaceId])); };
const mediaPath = (scopeHash, dealerId, id, hash, kind) => mediaBlobPath(`dealers/${dealerId}/runtime/conversation-replies/${scopeHash}`, id, hash, TYPES[kind].extension);
function checked(value, scopeHash, dealerId, id) {
  identity(dealerId, id);
  if (!value || value.schemaVersion !== 1 || value.dealerId !== dealerId || value.id !== id
    || Object.keys(value).some(key => !['schemaVersion','id','dealerId','exactText','language','createdAt','profileRevision','revision','categories','reviewStatus','media'].includes(key))
    || typeof value.exactText !== 'string' || !value.exactText.trim() || value.exactText.length > 4000
    || typeof value.language !== 'string' || !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(value.language)
    || !HASH.test(value.profileRevision) || !Number.isSafeInteger(value.revision) || value.revision < 1
    || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || value.reviewStatus !== 'pending'
    || !value.media || Object.keys(value.media).length !== 2) fail('reply_library_corrupt', 409);
  try {
    validateReplyCategories(value.categories);
    for (const kind of Object.keys(TYPES)) {
      const record = validatePrivateMedia(value.media[kind]);
      if (record.pathname !== mediaPath(scopeHash,dealerId,id,record.sha256,kind) || record.contentType !== TYPES[kind].contentType || record.size > TYPES[kind].max) throw Error();
    }
  } catch { fail('reply_library_corrupt', 409); }
  return value;
}
export function validateSpeechReplyRecord(value,scope) {
  if(Buffer.byteLength(JSON.stringify(value)??'')>65536)fail('reply_library_corrupt',409);
  return checked(value,speechReplyScopeHash(scope),value?.dealerId,value?.id);
}
function item(value) {
  const { schemaVersion, media, ...publicValue } = value;
  return structuredClone({ ...publicValue, media: Object.fromEntries(Object.entries(media).map(([kind, record]) => [kind, { available: true, sha256: record.sha256, contentType: record.contentType, size: record.size }])) });
}
// Neon owns metadata and category CAS; private Blob owns only immutable media.
export function createSpeechReplyLibrary({ repository, mediaStore, env = process.env, blobClient, cacheDir, environment, workspaceId, now = () => new Date() } = {}) {
  let scope;
  try { scope = validateStudioScope({ environment, workspaceId }); } catch { fail('reply_library_invalid_scope',400); }
  const scopeHash = speechReplyScopeHash(scope);
  if(!repository||['read','list','create','update'].some(key=>typeof repository[key]!=='function'))fail('reply_library_repository_required');
  if(repository.scope?.environment!==scope.environment||repository.scope?.workspaceId!==scope.workspaceId)fail('reply_library_invalid_scope',400);
  if (!mediaStore || ['putPrivateMedia','getPrivateMedia','deletePrivateMedia'].some(key => typeof mediaStore[key] !== 'function')) fail();
  const { putPrivateMedia, getPrivateMedia, deletePrivateMedia } = mediaStore;
  const options = { env: { CROUPIER_MEDIA_STORAGE: env.CROUPIER_MEDIA_STORAGE, BLOB_READ_WRITE_TOKEN: env.BLOB_READ_WRITE_TOKEN }, ...(blobClient ? { blobClient } : {}), ...(cacheDir ? { cacheDir } : {}) };
  function requireMedia() { if (!isCloudMediaConfigured(options.env)) fail(); }
  async function read(dealerId, id) {
    identity(dealerId,id);
    const value=await repository.read(dealerId,id);
    if(!value)fail('reply_library_not_found',404);
    return {value:checked(value,scopeHash,dealerId,id)};
  }
  return Object.freeze({
    async save({ dealerId, id = randomUUID(), exactText, language = 'en', profileRevision, audio, video } = {}) {
      identity(dealerId,id); requireMedia();
      const media = {}, buffers = {};
      for (const [kind, input] of [['audio',audio],['video',video]]) {
        if (!Buffer.isBuffer(input?.bytes) || !input.bytes.length || input.bytes.length > TYPES[kind].max || input.contentType !== TYPES[kind].contentType) fail('reply_library_invalid_media',400);
        const bytes = Buffer.from(input.bytes), sha256 = digest(bytes);
        buffers[kind] = bytes;
        media[kind] = { provider:'vercel-blob',pathname:mediaPath(scopeHash,dealerId,id,sha256,kind),sha256,size:bytes.length,contentType:TYPES[kind].contentType };
      }
      const value = checked({ schemaVersion:1,id,dealerId,exactText,language,profileRevision,createdAt:now().toISOString(),revision:1,categories:[],reviewStatus:'pending',media },scopeHash,dealerId,id);
      const uploaded = []; let metadataAttempted = false;
      try {
        for (const kind of Object.keys(TYPES)) { const record = media[kind]; await putPrivateMedia(record.pathname,buffers[kind],{ ...options,...record }); uploaded.push(record); }
        metadataAttempted = true; await repository.create(value); return item(value);
      } catch (error) {
        // Roll back only files created by this save. Existing replies are never removed.
        if (!metadataAttempted) await Promise.allSettled(uploaded.map(record => deletePrivateMedia(record,options)));
        throw error instanceof SpeechReplyLibraryError ? error : new SpeechReplyLibraryError();
      } finally { for (const bytes of Object.values(buffers)) bytes.fill(0); }
    },
    async list({ dealerId, category, cursor } = {}) {
      identity(dealerId);
      if (category !== undefined) validateReplyCategories([category]);
      if (cursor !== undefined && (typeof cursor !== 'string' || !cursor || cursor.length > 2048 || /[\u0000-\u001f]/.test(cursor))) fail('reply_library_invalid_cursor',400);
      const page=await repository.list({dealerId,category,cursor});
      if(!Array.isArray(page?.values)||page.values.length>50)fail();
      return {items:page.values.map(value=>item(checked(value,scopeHash,dealerId,value.id))),nextCursor:page.nextCursor};
    },
    async get({dealerId,id} = {}) { return item((await read(dealerId,id)).value); },
    async categorize({dealerId,id,categories,expectedRevision,stillAuthorized} = {}) {
      const next = validateReplyCategories(categories);
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) fail('reply_library_invalid_revision',400);
      const { value } = await read(dealerId,id);
      if (value.revision !== expectedRevision) fail('reply_library_revision_conflict',409);
      const updated = { ...value,categories:next,revision:value.revision+1 };
      if (stillAuthorized !== undefined) { if (typeof stillAuthorized !== 'function') fail('reply_library_invalid_authorization',400); await stillAuthorized(); }
      await repository.update(updated,expectedRevision); return item(updated);
    },
    async media({dealerId,id,kind,request} = {}) {
      if (!Object.hasOwn(TYPES,kind) || !(request instanceof Request) || !['GET','HEAD'].includes(request.method)) fail('reply_library_invalid_media',400);
      const { value } = await read(dealerId,id);
      return getPrivateMedia(value.media[kind],request,options);
    },
  });
}
