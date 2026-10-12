import { createHash, randomUUID } from 'node:crypto';
import { isDealerId } from './dealer-identity.mjs';
import { validateStudioScope } from './storage/studio-contract.mjs';
import { validateReplyCategories } from './public/speech-reply-library.mjs';
import { speechReplyBlobClient } from '../lab/lib/speech-reply-blob-client.mjs';
import { mediaBlobPath, putPrivateMedia, getPrivateMedia, deletePrivateMedia, validatePrivateMedia, isCloudMediaConfigured } from '../lab/lib/cloud-media-store.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
const LIMIT = 65536;
const TYPES = { audio: { extension: 'wav', contentType: 'audio/wav', max: 44 + 24000 * 2 * 30 }, video: { extension: 'mp4', contentType: 'video/mp4', max: 128 * 1024 * 1024 } };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export class SpeechReplyLibraryError extends Error {
  constructor(code = 'reply_library_unavailable', status = 503) { super(code); this.code = code; this.status = status; this.statusCode = status; }
}
const fail = (code, status) => { throw new SpeechReplyLibraryError(code, status); };
function identity(dealerId, id) {
  if (!isDealerId(dealerId) || (id !== undefined && !UUID.test(id))) fail('reply_library_invalid_identity', 400);
}
const pathFor = (scopeHash, dealerId, id) => `croupier/reply-library/${scopeHash}/${dealerId}/${id}.json`;
const mediaPath = (scopeHash, dealerId, id, hash, kind) => mediaBlobPath(`dealers/${dealerId}/runtime/conversation-replies/${scopeHash}`, id, hash, TYPES[kind].extension);
function privateResult(result, pathname) {
  let url;
  try { url = new URL(result?.url); } catch { fail(); }
  if (result.pathname !== pathname || url.protocol !== 'https:' || !/^[a-z0-9]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname)
    || url.pathname !== `/${pathname}` || url.port || url.username || url.password || url.search || url.hash) fail();
}
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
function item(value) {
  const { schemaVersion, media, ...publicValue } = value;
  return structuredClone({ ...publicValue, media: Object.fromEntries(Object.entries(media).map(([kind, record]) => [kind, { available: true, sha256: record.sha256, contentType: record.contentType, size: record.size }])) });
}
async function boundedJSON(result, pathname) {
  if (result.statusCode !== 200 || !result.stream || !result.blob || result.blob.size > LIMIT || !/^application\/json(?:;\s*charset=utf-8)?$/i.test(result.blob.contentType)) fail();
  privateResult(result.blob, pathname);
  const reader = result.stream.getReader(); let size = 0; const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > LIMIT) fail('reply_library_corrupt', 409); chunks.push(Buffer.from(value));
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('reply_library_corrupt', 409); }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
// Metadata is private Blob JSON. Only categories/revision may change, through
// the provider's atomic ETag precondition; media and exact text never change.
export function createSpeechReplyLibrary({ env = process.env, blobClient, cacheDir, environment, workspaceId, now = () => new Date() } = {}) {
  let scope;
  try { scope = validateStudioScope({ environment, workspaceId }); } catch { fail('reply_library_invalid_scope',400); }
  const scopeHash = digest(JSON.stringify([scope.environment,scope.workspaceId]));
  const options = { env: { CROUPIER_MEDIA_STORAGE: env.CROUPIER_MEDIA_STORAGE, BLOB_READ_WRITE_TOKEN: env.BLOB_READ_WRITE_TOKEN }, ...(blobClient ? { blobClient } : {}), ...(cacheDir ? { cacheDir } : {}) };
  async function client() { if (!isCloudMediaConfigured(options.env)) fail(); return blobClient ?? speechReplyBlobClient(); }
  const auth = () => ({ token: options.env.BLOB_READ_WRITE_TOKEN, abortSignal: AbortSignal.timeout(60000) });
  async function read(dealerId, id) {
    identity(dealerId,id); const c = await client(), pathname = pathFor(scopeHash,dealerId,id);
    let result;
    try { result = await c.get(pathname,{ ...auth(), access:'private', useCache:false }); } catch { fail(); }
    if (!result) fail('reply_library_not_found',404);
    const value = checked(await boundedJSON(result,pathname),scopeHash,dealerId,id);
    const etag = result.blob.etag;
    if (typeof etag !== 'string' || !etag || etag.length > 256) fail();
    return { value, etag };
  }
  async function strongWriteETag(dealerId,id,etag) {
    if (!etag.startsWith('W/')) return etag;
    // Compressed JSON delivery may expose a weak ETag. Only writes need HEAD;
    // it must match the exact downloaded version before the CAS can proceed.
    const c = await client(), pathname = pathFor(scopeHash,dealerId,id); let head;
    try { head = await c.head(pathname,auth()); } catch { fail(); }
    privateResult(head,pathname);
    if (typeof head.etag !== 'string' || !head.etag || head.etag.startsWith('W/') || head.etag.length > 256) fail();
    if (head.etag !== etag.slice(2)) fail('reply_library_revision_conflict',409);
    return head.etag;
  }
  async function write(value, etag) {
    const c = await client(), pathname = pathFor(scopeHash,value.dealerId,value.id), bytes = Buffer.from(JSON.stringify(value));
    if (bytes.length > LIMIT) fail('reply_library_corrupt',409);
    try {
      const result = await c.put(pathname,bytes,{ ...auth(), access:'private', addRandomSuffix:false, allowOverwrite:Boolean(etag), contentType:'application/json', cacheControlMaxAge:60, ...(etag ? { ifMatch:etag } : {}) });
      privateResult(result,pathname);
    } catch (error) {
      const providerConflict = ['BlobPreconditionFailedError','BlobAlreadyExistsError'].some(name =>
        typeof c[name] === 'function' && error instanceof c[name]);
      if (providerConflict || error.name === 'BlobPreconditionFailedError' || error.name === 'BlobAlreadyExistsError' || error.statusCode === 412) fail('reply_library_revision_conflict',409);
      if (error instanceof SpeechReplyLibraryError) throw error;
      fail();
    }
  }
  return Object.freeze({
    async save({ dealerId, id = randomUUID(), exactText, language = 'en', profileRevision, audio, video } = {}) {
      identity(dealerId,id); await client();
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
        metadataAttempted = true; await write(value); return item(value);
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
      const prefix = `croupier/reply-library/${scopeHash}/${dealerId}/`, c = await client(); let page;
      try { page = await c.list({ ...auth(),prefix,limit:50,...(cursor ? { cursor } : {}) }); } catch { fail(); }
      if (!Array.isArray(page?.blobs) || page.blobs.length > 50) fail();
      const items = [];
      for (const record of page.blobs) {
        if (typeof record.pathname !== 'string' || !record.pathname.startsWith(prefix)) fail();
        const id = record.pathname.slice(prefix.length).replace(/\.json$/,'');
        if (!UUID.test(id) || record.pathname !== pathFor(scopeHash,dealerId,id)) fail('reply_library_corrupt',409);
        const { value } = await read(dealerId,id);
        if (!category || value.categories.includes(category)) items.push(item(value));
      }
      return { items, nextCursor:page.hasMore && typeof page.cursor === 'string' ? page.cursor : null };
    },
    async get({dealerId,id} = {}) { return item((await read(dealerId,id)).value); },
    async categorize({dealerId,id,categories,expectedRevision,stillAuthorized} = {}) {
      const next = validateReplyCategories(categories);
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) fail('reply_library_invalid_revision',400);
      const { value, etag } = await read(dealerId,id);
      if (value.revision !== expectedRevision) fail('reply_library_revision_conflict',409);
      const updated = { ...value,categories:next,revision:value.revision+1 };
      const writeETag = await strongWriteETag(dealerId,id,etag);
      if (stillAuthorized !== undefined) { if (typeof stillAuthorized !== 'function') fail('reply_library_invalid_authorization',400); await stillAuthorized(); }
      await write(updated,writeETag); return item(updated);
    },
    async media({dealerId,id,kind,request} = {}) {
      if (!Object.hasOwn(TYPES,kind) || !(request instanceof Request) || !['GET','HEAD'].includes(request.method)) fail('reply_library_invalid_media',400);
      const { value } = await read(dealerId,id);
      return getPrivateMedia(value.media[kind],request,options);
    },
  });
}
