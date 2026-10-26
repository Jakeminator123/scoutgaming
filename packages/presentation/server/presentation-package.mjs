import { createHash } from 'node:crypto';
import { EXTENDED_PRESENTATION_FORMAT, EXTENDED_PRESENTATION_DATA_LIMIT, validatePresentationBranding } from './presentation-storage.mjs';
import { OPERATOR_LIFECYCLE_KEY } from '../contracts/operator-lifecycle-key.mjs';
import { gzipSync, gunzipSync, brotliCompressSync, brotliDecompressSync, constants } from 'node:zlib';
import { validatePresentationPackage } from '../contracts/presentation-layers.mjs';
import { canonicalStudioJson, StudioStorageError } from '../../studio-registry/server/document-contract.mjs';

// A reserved, server-authored part of the existing immutable operator package.
// Legacy encodings retain their exact bounds. The explicit extended envelope
// requires optional storage version 020 and runtime capability 29 before writing.
export const PRESENTATION_PACKAGE_KEY = '_scoutPresentation';
const GZIP_LIMIT = 6500, BROTLI_LIMIT = 7400, OUTPUT_LIMIT = 256 * 1024;
const fail = (status = 422) => { throw new StudioStorageError('studio_invalid_presentation', status); };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function encodePresentationPackage(value, {allowExtended=false} = {}) {
  const checked = validatePresentationPackage(value);
  const bytes = Buffer.from(canonicalStudioJson(checked));
  if (bytes.length > OUTPUT_LIMIT) fail();
  // Preserve historical bytes for packages that already fit the gzip contract.
  let data = gzipSync(bytes).toString('base64url'), encoding = 'gzip-base64url', format = 'croupier-lanes-v1';
  if (data.length > GZIP_LIMIT) {
    data = brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT } }).toString('base64url');
    encoding = 'br-base64url';
    // Mode is an encoder hint, not a different format. Try it only after text
    // overflow so all existing valid envelopes keep their original bytes.
    if (data.length > BROTLI_LIMIT) data = brotliCompressSync(bytes, { params: {
      [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_FONT } }).toString('base64url');
    if (data.length > BROTLI_LIMIT) {
      if (allowExtended !== true || data.length > EXTENDED_PRESENTATION_DATA_LIMIT) fail(413);
      format = EXTENDED_PRESENTATION_FORMAT;
    }
  }
  return Object.freeze({ format, encoding, sha256: digest(bytes), data });
}
export function decodePresentationPackage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== 'data,encoding,format,sha256'
    || !['croupier-lanes-v1',EXTENDED_PRESENTATION_FORMAT].includes(value.format) || !['gzip-base64url','br-base64url'].includes(value.encoding)
    || value.format === EXTENDED_PRESENTATION_FORMAT && value.encoding !== 'br-base64url'
    || typeof value.data !== 'string' || !value.data.length || value.data.length > (value.format === EXTENDED_PRESENTATION_FORMAT ? EXTENDED_PRESENTATION_DATA_LIMIT : value.encoding === 'br-base64url' ? BROTLI_LIMIT : GZIP_LIMIT)
    || !/^[A-Za-z0-9_-]+$/.test(value.data) || !/^[a-f0-9]{64}$/.test(value.sha256)) fail(503);
  try {
    const zipped = Buffer.from(value.data, 'base64url');
    if (zipped.toString('base64url') !== value.data) fail(503);
    const decompress = value.encoding === 'br-base64url' ? brotliDecompressSync : gunzipSync;
    const result = decompress(zipped, { maxOutputLength: OUTPUT_LIMIT, info: true });
    if (result.engine.bytesWritten !== zipped.length) fail(503);
    const bytes = result.buffer;
    if (digest(bytes) !== value.sha256) fail(503);
    const checked = validatePresentationPackage(JSON.parse(bytes.toString('utf8')));
    if (canonicalStudioJson(checked) !== bytes.toString('utf8')) fail(503);
    return checked;
  } catch { fail(503); }
}
export function readPackagePresentation(pack) {
  if (!pack?.branding || !Object.hasOwn(pack.branding, PRESENTATION_PACKAGE_KEY)) return null;
  const presentation = decodePresentationPackage(pack.branding[PRESENTATION_PACKAGE_KEY]);
  if (presentation.lanes.some(lane => !pack.lanes?.includes(lane.id))
    || pack.lanes?.some(id => !presentation.lanes.some(lane => lane.id === id))) fail(503);
  return presentation;
}
export function withPackagePresentation(branding, presentation, options) {
  const next = { ...normalizePresentationBranding(branding,presentation), ...(Object.hasOwn(branding ?? {}, OPERATOR_LIFECYCLE_KEY) ? { [OPERATOR_LIFECYCLE_KEY]: structuredClone(branding[OPERATOR_LIFECYCLE_KEY]) } : {}), [PRESENTATION_PACKAGE_KEY]: encodePresentationPackage(presentation,options) };
  try { validatePresentationBranding(next); } catch { fail(413); }
  return next;
}
export function normalizePresentationBranding(branding,presentation) {
  const next=publicPackageBranding(branding);
  const lane=presentation.lanes.find(row=>row.id===next.lane)??presentation.lanes[0];
  if(Object.hasOwn(next,'lane')&&next.lane!==lane.id)delete next.lane;
  for(const role of ['background','table','dealer']) {
    if(next[role]!==undefined&&next[role]!==null&&!lane.layers[role].allowed.includes(next[role]))delete next[role];
  }
  const colors=lane.layers.table.colors;
  if(colors?.length&&Object.hasOwn(next,'color')&&!colors.includes(next.color))delete next.color;
  return next;
}
export function publicPackageBranding(branding) {
  const copy = structuredClone(branding ?? {});
  delete copy[PRESENTATION_PACKAGE_KEY];
  delete copy[OPERATOR_LIFECYCLE_KEY];
  return copy;
}
