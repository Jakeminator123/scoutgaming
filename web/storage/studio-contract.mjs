import { StudioStorageError, validateStudioScope } from '../../packages/studio-access/studio-scope.mjs';
export { StudioStorageError, validateStudioEnvironmentId, validateStudioScope } from '../../packages/studio-access/studio-scope.mjs';
import { createHash } from 'node:crypto';
import { validateProject } from '../../lab/lib/studio-model.mjs';
import { validateSocialPolicy } from '../../open-claw/lab/src/social.mjs';
import { validateManagedStudioMedia } from '../managed-media-contract.mjs';
import { gameLaneConfiguration } from '../public/game-lanes.mjs';

export const STUDIO_DOCUMENT_KINDS = Object.freeze(['project', 'social-policy', 'administration']);
export const STUDIO_SNAPSHOT_FORMAT = 'croupier-studio-documents-v1';
export const STUDIO_JSON_LIMIT = 1024 * 1024;
export const STUDIO_SNAPSHOT_LIMIT = STUDIO_JSON_LIMIT * STUDIO_DOCUMENT_KINDS.length + 4096;
const kinds = new Set(STUDIO_DOCUMENT_KINDS);
const id = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const sha = /^[a-f0-9]{64}$/;
const adminKeys = new Set(['tiers', 'rooms', 'pitboss', 'tournaments', 'voiceReview', 'genVerdicts', 'genLandings', 'legacyClipReview', 'gameLane', 'gameLanes']);

export function studioStorageFailure(error) {
  if (error instanceof StudioStorageError) return error;
  if (['23505', '23503', '40001', '40P01'].includes(error?.code)) return new StudioStorageError('studio_conflict', 409);
  if (['23514', '22P02'].includes(error?.code)) return new StudioStorageError('studio_invalid_data', 422);
  if (error?.code === '55P03') return new StudioStorageError('studio_busy', 423);
  return new StudioStorageError('studio_storage_unavailable');
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
    gameLaneConfiguration(copy);
    return copy;
  } catch { throw new StudioStorageError('studio_invalid_document', 422); }
}

// These six saved identities predate the replacement manifest. The exact
// original Git bytes were checked against this source manifest before retention.
// Current bank files and saved policies are never renamed or rewritten.
export const RETAINED_BANK_PROVENANCE = Object.freeze({
  sourceCommit: '365f283b4005f0ca2f52312f745af9bfe05fa5e3',
  sourceManifestSha256: '31b92271aeb2a4cda066306cbf2a141ff5201b26c642fd5cec814312747feff7',
});
export const RETAINED_BANK_VARIANTS = Object.freeze([
  { id:'1ee28b41-f9f1-0879-ff42-8ecd604540f5', sha256:'1ee28b41f9f10879ff428ecd604540f537ad2c359fcf4849d7308966c7aaff53', size:599221,
    originalRelativePath:'deal/deal_pos1/variant/box_1_variant.mp4', familyId:'astrid/deal.player.left/box0', role:'variant' },
  { id:'9512c0af-c38e-46d3-a4d0-04428d0388db', sha256:'9512c0afc38e46d3a4d004428d0388dbe9113ba84298df8fa1634074049d8061', size:568868,
    originalRelativePath:'deal/deal_pos2/variant/box_2_variant.mp4', familyId:'astrid/deal.player.left/box1', role:'variant' },
  { id:'d3dd14f4-3940-5249-b65d-4f6678a54822', sha256:'d3dd14f439405249b65d4f6678a5482295817a36e115a3fc26055609b5356f61', size:1879487,
    originalRelativePath:'deal/deal_pos4/variant/box_4_varaint.mp4', familyId:'astrid/deal.player.centre/box3', role:'variant' },
  { id:'c9b09866-50f7-2e05-0301-7e02499f50a2', sha256:'c9b0986650f72e0503017e02499f50a2ff36881999ff5f57c5d0998e05aeda51', size:315478,
    originalRelativePath:'idle/variant/idle_smile.mp4', familyId:'astrid/idle.ready/ready', role:'variant' },
  { id:'15748c18-f7b6-912a-639f-55e632db34d3', sha256:'15748c18f7b6912a639f55e632db34d3102a63677a45ec192a591469261c8abd', size:309588,
    originalRelativePath:'idle/variant/idle_yawn.mp4', familyId:'astrid/idle.ready/ready', role:'variant' },
  { id:'0b76ac59-cbb8-657b-cf2e-675aa9db71a4', sha256:'0b76ac59cbb8657bcf2e675aa9db71a4cac9753f134562e5b3bd3ddbc02a2ac6', size:4589527,
    originalRelativePath:'idle/variant/idle_resa_sig.mp4', familyId:'astrid/idle.ready/ready', role:'variant' },
].map(Object.freeze));
export function createRetainedStudioMedia(mediaId) {
  const original = RETAINED_BANK_VARIANTS.find(row => row.id === mediaId);
  if (!original) throw new StudioStorageError('studio_invalid_retained_media',422);
  const [,eventId,situation] = original.familyId.split('/');
  return { id:original.id,sha256:original.sha256,size:original.size,contentType:'video/mp4',
    pathname:`croupier/media/dealers/astrid/runtime/retained-bank/${original.id}/${original.sha256}.mp4`,
    retainedBank:{...RETAINED_BANK_PROVENANCE,originalRelativePath:original.originalRelativePath,familyId:original.familyId,role:original.role},
    classification:{dealerId:'astrid',eventId,kind:eventId==='idle.ready'?'idle':'action',role:'alternative',
      situation:eventId==='idle.ready'?'':situation,familyId:original.familyId,
      label:`Bevarat original · ${original.originalRelativePath.split('/').at(-1)}`,notes:''},
  };
}

// Review uploads plus an explicit, bounded retention of six exact bank originals.
// No provider I/O, automatic import or alternate source selection occurs here.
export function validateStudioMedia(record) {
  const copy = cloneStudioJson(record);
  if (copy && !Array.isArray(copy) && (Object.hasOwn(copy,'retainedBank') || RETAINED_BANK_VARIANTS.some(row => row.id === copy.id))) {
    const expected = createRetainedStudioMedia(copy.id);
    if (canonicalStudioJson(copy) !== canonicalStudioJson(expected)) throw new StudioStorageError('studio_invalid_retained_media',422);
    return copy;
  }
  try {
    const deletion = copy?.deletion;
    if (deletion !== undefined) {
      if (!deletion || Array.isArray(deletion) || !['pending','deleted'].includes(deletion.state)
        || Object.keys(deletion).sort().join(',') !== (deletion.state === 'deleted' ? 'completedAt,requestedAt,state' : 'requestedAt,state')
        || copy.classification?.archived !== true) throw Error();
      for (const key of deletion.state === 'deleted' ? ['requestedAt','completedAt'] : ['requestedAt']) {
        if (typeof deletion[key] !== 'string' || !Number.isFinite(Date.parse(deletion[key])) || new Date(deletion[key]).toISOString() !== deletion[key]) throw Error();
      }
      if (deletion.completedAt && deletion.completedAt < deletion.requestedAt) throw Error();
      delete copy.deletion;
    }
    const checked = validateManagedStudioMedia(copy);
    return deletion === undefined ? checked : {...checked,deletion};
  }
  catch { throw new StudioStorageError('studio_invalid_media', 422); }
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
