import { MEDIA_FILE_TYPES } from '../lab/lib/media-file-types.mjs';
import { validateVideoMetadata, MAX_VIDEO_BYTES } from '../lab/lib/video-intake.mjs';

// The normal managed StudioMediaRecord contract is shared by browser package
// decoding and server storage. Retained bank provenance stays server-only.
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const sha = /^[a-f0-9]{64}$/;
const fail = () => { throw Object.assign(new Error('studio_invalid_media'), { code: 'studio_invalid_media', statusCode: 422 }); };
function data(value, depth = 0) {
  if (depth > 24) fail();
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') { if (value.includes('\0') || !value.isWellFormed()) fail(); return value; }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object') fail();
  const isArray = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Object.keys(value);
  if (isArray ? prototype !== Array.prototype : ![Object.prototype, null].includes(prototype)) fail();
  if (Object.getOwnPropertySymbols(value).length || Object.getOwnPropertyNames(value).length !== keys.length + (isArray ? 1 : 0)
    || isArray && (keys.length !== value.length || keys.some((key, index) => key !== String(index)))) fail();
  const output = isArray ? [] : {};
  for (const key of keys.sort()) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || ['__proto__', 'constructor', 'prototype'].includes(key) || key.length > 128) fail();
    output[key] = data(descriptor.value, depth + 1);
  }
  return output;
}
export function validateManagedStudioMedia(record) {
  const copy = data(record);
  if (!copy || Array.isArray(copy) || Object.keys(copy).sort().join(',') !== 'classification,contentType,id,pathname,sha256,size'
    || typeof copy.id !== 'string' || !uuid.test(copy.id) || typeof copy.sha256 !== 'string' || !sha.test(copy.sha256)
    || !Number.isSafeInteger(copy.size) || copy.size < 16 || copy.size > MAX_VIDEO_BYTES
    || !Object.hasOwn(MEDIA_FILE_TYPES,copy.contentType)) fail();
  try { copy.classification = validateVideoMetadata(copy.classification); } catch { fail(); }
  if (copy.contentType.startsWith('audio/') !== (copy.classification.mediaType === 'audio')) fail();
  const extension = MEDIA_FILE_TYPES[copy.contentType];
  const expected = `croupier/media/dealers/${copy.classification.dealerId}/review/uploads/${copy.id}/${copy.sha256}.${extension}`;
  if (copy.pathname !== expected) fail();
  return copy;
}
