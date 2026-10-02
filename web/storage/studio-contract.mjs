import { createHash } from 'node:crypto';
import { validateProject } from '../../lab/lib/studio-model.mjs';
import { validateSocialPolicy } from '../../open-claw/lab/src/social.mjs';
import { validateVideoMetadata, MAX_VIDEO_BYTES } from '../../lab/lib/video-intake.mjs';

export const STUDIO_DOCUMENT_KINDS = Object.freeze(['project', 'social-policy', 'administration']);
export const STUDIO_SNAPSHOT_FORMAT = 'croupier-studio-documents-v1';
export const STUDIO_JSON_LIMIT = 1024 * 1024;
export const STUDIO_SNAPSHOT_LIMIT = STUDIO_JSON_LIMIT * STUDIO_DOCUMENT_KINDS.length + 4096;
const kinds = new Set(STUDIO_DOCUMENT_KINDS);
const safeCode = /^(?:studio_|generated_speech_|operator_speech_|invalid_generated_|speech_|gpu_)[a-z0-9_]{1,100}$/;
const id = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const sha = /^[a-f0-9]{64}$/;
const adminKeys = new Set(['tiers', 'rooms', 'pitboss', 'tournaments', 'voiceReview', 'genVerdicts', 'genLandings']);

// Public failures contain a fixed code only, never a database/provider message.
export class StudioStorageError extends Error {
  constructor(code, statusCode = 503) {
    const bounded = typeof code === 'string' && safeCode.test(code) ? code : 'studio_storage_unavailable';
    super(bounded);
    this.name = 'StudioStorageError';
    this.code = bounded;
    this.statusCode = Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599 ? statusCode : 503;
  }
}

export function studioStorageFailure(error) {
  if (error instanceof StudioStorageError) return error;
  if (['23505', '23503', '40001', '40P01'].includes(error?.code)) return new StudioStorageError('studio_conflict', 409);
  if (['23514', '22P02'].includes(error?.code)) return new StudioStorageError('studio_invalid_data', 422);
  if (error?.code === '55P03') return new StudioStorageError('studio_busy', 423);
  return new StudioStorageError('studio_storage_unavailable');
}

export function validateStudioEnvironmentId(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]{0,62}$/.test(value)) throw new StudioStorageError('studio_invalid_scope', 422);
  return value;
}

export function validateStudioScope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== 'environment,workspaceId'
    || !['environment', 'workspaceId'].every(key => Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, 'value'))
    || typeof value.workspaceId !== 'string' || !id.test(value.workspaceId)) throw new StudioStorageError('studio_invalid_scope', 422);
  return Object.freeze({ environment: validateStudioEnvironmentId(value.environment), workspaceId: value.workspaceId });
}

export function validateDocumentKind(kind) {
  if (!kinds.has(kind)) throw new StudioStorageError('studio_invalid_document_kind', 422);
  return kind;
}

export function validateRevision(value) {
  if (typeof value !== 'string' || !id.test(value)) throw new StudioStorageError('studio_invalid_revision', 422);
  return value;
}

export function validateActor(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 128 || /[\u0000-\u001f\u007f-\u009f]/.test(value)) throw new StudioStorageError('studio_invalid_actor', 422);
  return value;
}

export function cloneStudioJson(value, { maxBytes = STUDIO_JSON_LIMIT, maxNodes = 20000, maxDepth = 24 } = {}) {
  const seen = new Set(); let count = 0;
  function clone(item, depth) {
    if (++count > maxNodes || depth > maxDepth) throw new StudioStorageError('studio_invalid_data', 422);
    if (typeof item === 'string') {
      if (item.includes('\0') || !item.isWellFormed()) throw new StudioStorageError('studio_invalid_data', 422);
      return item;
    }
    if (item === null || typeof item === 'boolean') return item;
    if (typeof item === 'number' && Number.isFinite(item)) return item;
    if (!item || typeof item !== 'object' || seen.has(item)) throw new StudioStorageError('studio_invalid_data', 422);
    const array = Array.isArray(item), prototype = Object.getPrototypeOf(item);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new StudioStorageError('studio_invalid_data', 422);
    seen.add(item);
    const output = array ? [] : {};
    const keys = Object.keys(item);
    if (Object.getOwnPropertySymbols(item).length || Object.getOwnPropertyNames(item).length !== keys.length + (array ? 1 : 0)
      || array && (keys.length !== item.length || keys.some((key, index) => key !== String(index)))) throw new StudioStorageError('studio_invalid_data', 422);
    for (const key of keys.sort()) {
      const property = Object.getOwnPropertyDescriptor(item, key);
      if (!property || !Object.hasOwn(property, 'value') || ['__proto__', 'constructor', 'prototype'].includes(key)
        || key.length > 128 || key.includes('\0')) throw new StudioStorageError('studio_invalid_data', 422);
      output[key] = clone(property.value, depth + 1);
    }
    seen.delete(item);
    return output;
  }
  const result = clone(value, 0);
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > maxBytes) throw new StudioStorageError('studio_invalid_data', 422);
  return result;
}

export const canonicalStudioJson = value => JSON.stringify(cloneStudioJson(value));
export const studioContentHash = value => createHash('sha256').update(canonicalStudioJson(value)).digest('hex');

export function validateDocumentValue(kind, value, revision, { allowLegacyRead = false } = {}) {
  validateDocumentKind(kind); validateRevision(revision);
  const copy = cloneStudioJson(value);
  if (!copy || typeof copy !== 'object' || Array.isArray(copy)) throw new StudioStorageError('studio_invalid_document', 422);
  try {
    if (kind === 'project') return validateProject({ ...copy, revision }, { allowIncompatibleAnimations: allowLegacyRead });
    if (kind === 'social-policy') return validateSocialPolicy({ ...copy, revision });
    if (Object.keys(copy).some(key => !adminKeys.has(key))) throw new Error('unsupported administration field');
    return copy;
  } catch { throw new StudioStorageError('studio_invalid_document', 422); }
}

// Only NEW review uploads. No legacy source/archive catalogue or Blob I/O here.
export function validateStudioMedia(record) {
  const copy = cloneStudioJson(record);
  if (!copy || Array.isArray(copy) || Object.keys(copy).sort().join(',') !== 'classification,contentType,id,pathname,sha256,size'
    || !uuid.test(copy.id) || !sha.test(copy.sha256) || !Number.isSafeInteger(copy.size)
    || copy.size < 16 || copy.size > MAX_VIDEO_BYTES || !['video/mp4', 'video/webm'].includes(copy.contentType)) throw new StudioStorageError('studio_invalid_media', 422);
  try { copy.classification = validateVideoMetadata(copy.classification); }
  catch { throw new StudioStorageError('studio_invalid_media', 422); }
  const extension = copy.contentType.slice(6);
  const expected = `croupier/media/dealers/${copy.classification.dealerId}/review/uploads/${copy.id}/${copy.sha256}.${extension}`;
  if (copy.pathname !== expected) throw new StudioStorageError('studio_invalid_media', 422);
  return copy;
}

export function validateMediaId(value) {
  if (typeof value !== 'string' || !uuid.test(value)) throw new StudioStorageError('studio_invalid_media', 422);
  return value;
}

export function validateSnapshot(snapshot, scope) {
  const copy = cloneStudioJson(snapshot, { maxBytes: STUDIO_SNAPSHOT_LIMIT, maxNodes: 60100, maxDepth: 28 }), checkedScope = validateStudioScope(scope);
  if (!copy || Array.isArray(copy) || Object.keys(copy).sort().join(',') !== 'documents,format,scope'
    || copy.format !== STUDIO_SNAPSHOT_FORMAT || canonicalStudioJson(validateStudioScope(copy.scope)) !== canonicalStudioJson(checkedScope)
    || !Array.isArray(copy.documents) || copy.documents.length > STUDIO_DOCUMENT_KINDS.length) throw new StudioStorageError('studio_invalid_snapshot', 422);
  const seen = new Set();
  for (const document of copy.documents) {
    if (!document || Object.keys(document).sort().join(',') !== 'checksum,kind,revision,updatedAt,value'
      || seen.has(document.kind) || typeof document.updatedAt !== 'string' || !Number.isFinite(Date.parse(document.updatedAt))
      || new Date(document.updatedAt).toISOString() !== document.updatedAt) throw new StudioStorageError('studio_invalid_snapshot', 422);
    const checked = validateDocumentValue(document.kind, document.value, document.revision);
    if (canonicalStudioJson(checked) !== canonicalStudioJson(document.value) || !sha.test(document.checksum)
      || document.checksum !== studioContentHash(document.value)) throw new StudioStorageError('studio_invalid_snapshot', 422);
    seen.add(document.kind);
  }
  return copy;
}
