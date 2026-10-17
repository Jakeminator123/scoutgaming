import { lstat, readFile } from 'node:fs/promises';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const FAMILY_ID = /^[a-z][a-z0-9_-]*\/[a-z][a-z0-9._-]*\/[a-z][a-z0-9_-]*$/;
const SITUATION = /^[a-z][a-z0-9_-]{0,79}$/;
const VARIANT_FILE = /^[a-z0-9][a-z0-9._-]*\.mp4$/;
const MAX_MANIFEST_BYTES = 5 * 1024 * 1024;
const ROOT_KEYS = ['schemaVersion', 'source', 'families', 'items'];
const FAMILY_KEYS = ['id', 'dealerId', 'eventId', 'situation', 'playbackType', 'standardIds', 'variantIds'];
const ITEM_KEYS = ['id', 'familyId', 'role', 'relativePath', 'extension', 'size', 'sha256'];

import { MEDIA_FAMILY_DEFINITIONS } from '../../presentation/runtime/media-families.mjs';
export { MEDIA_FAMILY_DEFINITIONS };

const definitionsById = new Map(MEDIA_FAMILY_DEFINITIONS.map(definition => [definition.id, definition]));
const standardPaths = new Map(MEDIA_FAMILY_DEFINITIONS.flatMap(definition => definition.standardPaths.map(path => [path, definition])));

export class LabVideoManifestError extends Error {
  constructor(message) { super(message); this.name = 'LabVideoManifestError'; }
}

function fail(message) { throw new LabVideoManifestError(message); }
function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function exactKeys(value, allowed, at) {
  if (!isObject(value)) fail(`${at} must be an object.`);
  const keys = Object.keys(value);
  const unknown = keys.filter(key => !allowed.includes(key));
  const missing = allowed.filter(key => !Object.hasOwn(value, key));
  if (unknown.length || missing.length) fail(`${at} has invalid fields.`);
}
function unique(values, at) {
  if (new Set(values).size !== values.length) fail(`${at} contains duplicates.`);
}

export function videoIdFromSha256(sha256) {
  if (typeof sha256 !== 'string' || !SHA256.test(sha256)) fail('Invalid SHA-256.');
  return `${sha256.slice(0, 8)}-${sha256.slice(8, 12)}-${sha256.slice(12, 16)}-${sha256.slice(16, 20)}-${sha256.slice(20, 32)}`;
}

export function mediaDefinitionForPath(relativePath) {
  if (typeof relativePath !== 'string' || relativePath.length > 240 || relativePath.includes('\\') || relativePath.startsWith('/') || relativePath.split('/').some(part => !part || part === '.' || part === '..')) return null;
  const standard = standardPaths.get(relativePath);
  if (standard) return { definition: standard, role: 'standard' };
  for (const definition of MEDIA_FAMILY_DEFINITIONS) {
    const prefix = `${definition.variantDirectory}/`;
    if (!relativePath.startsWith(prefix)) continue;
    const file = relativePath.slice(prefix.length);
    if (!file.includes('/') && VARIANT_FILE.test(file)) return { definition, role: 'variant' };
  }
  return null;
}

export function validateLabVideoManifest(manifest) {
  exactKeys(manifest, ROOT_KEYS, 'manifest');
  if (manifest.schemaVersion !== 2 || manifest.source !== 'emil/dealklipp-v1') fail('Unsupported lab video manifest.');
  if (!Array.isArray(manifest.families) || manifest.families.length !== MEDIA_FAMILY_DEFINITIONS.length) fail(`Manifest must contain exactly ${MEDIA_FAMILY_DEFINITIONS.length} media families.`);
  if (!Array.isArray(manifest.items) || manifest.items.length < 1 || manifest.items.length > 10_000) fail('Manifest items are invalid.');

  const families = new Map();
  const familyTuples = new Set();
  for (const [index, family] of manifest.families.entries()) {
    const at = `families[${index}]`;
    exactKeys(family, FAMILY_KEYS, at);
    if (!FAMILY_ID.test(family.id) || families.has(family.id)) fail(`${at}.id is invalid or duplicated.`);
    const definition = definitionsById.get(family.id);
    if (!definition || family.dealerId !== definition.dealerId || family.eventId !== definition.eventId || family.situation !== definition.situation || family.playbackType !== definition.playbackType) fail(`${at} does not match the locked family definition.`);
    if (!SITUATION.test(family.situation)) fail(`${at}.situation is invalid.`);
    if (!Array.isArray(family.standardIds) || !family.standardIds.length || family.standardIds.length > 32 || !Array.isArray(family.variantIds) || family.variantIds.length > 128) fail(`${at} has invalid media lists.`);
    if (family.playbackType === 'once' && family.standardIds.length !== 1) fail(`${at} must have exactly one standard video.`);
    for (const id of [...family.standardIds, ...family.variantIds]) if (!UUID.test(id)) fail(`${at} contains an invalid media ID.`);
    unique(family.standardIds, `${at}.standardIds`); unique(family.variantIds, `${at}.variantIds`);
    if (family.standardIds.some(id => family.variantIds.includes(id))) fail(`${at} reuses an ID across roles.`);
    const tuple = `${family.dealerId}\0${family.eventId}\0${family.situation}`;
    if (familyTuples.has(tuple)) fail(`${at} duplicates another exact family.`);
    familyTuples.add(tuple); families.set(family.id, family);
  }

  const items = new Map(), paths = new Set(), hashes = new Set();
  for (const [index, item] of manifest.items.entries()) {
    const at = `items[${index}]`;
    exactKeys(item, ITEM_KEYS, at);
    if (!UUID.test(item.id) || items.has(item.id)) fail(`${at}.id is invalid or duplicated.`);
    if (!SHA256.test(item.sha256) || hashes.has(item.sha256) || item.id !== videoIdFromSha256(item.sha256)) fail(`${at} has an invalid or duplicated content identity.`);
    if (!Number.isSafeInteger(item.size) || item.size < 1 || item.extension !== 'mp4') fail(`${at} has invalid file metadata.`);
    if (paths.has(item.relativePath)) fail(`${at}.relativePath is duplicated.`);
    const placement = mediaDefinitionForPath(item.relativePath);
    if (!placement || placement.definition.id !== item.familyId || placement.role !== item.role) fail(`${at} is outside the allowed media roots or family.`);
    if (!families.has(item.familyId)) fail(`${at}.familyId is unknown.`);
    paths.add(item.relativePath); hashes.add(item.sha256); items.set(item.id, item);
  }

  const referenced = new Set();
  for (const definition of MEDIA_FAMILY_DEFINITIONS) {
    const family = families.get(definition.id);
    const standards = family.standardIds.map(id => items.get(id));
    const variants = family.variantIds.map(id => items.get(id));
    if (standards.some(item => !item || item.familyId !== family.id || item.role !== 'standard') || variants.some(item => !item || item.familyId !== family.id || item.role !== 'variant')) fail(`${family.id} has broken item references.`);
    const actualStandardPaths = standards.map(item => item.relativePath).sort();
    const expectedStandardPaths = [...definition.standardPaths].sort();
    if (JSON.stringify(actualStandardPaths) !== JSON.stringify(expectedStandardPaths)) fail(`${family.id} has the wrong standard media set.`);
    for (const id of [...family.standardIds, ...family.variantIds]) {
      if (referenced.has(id)) fail(`Media ID ${id} is referenced by more than one family.`);
      referenced.add(id);
    }
  }
  if (referenced.size !== items.size) fail('Manifest contains unreferenced media items.');
  return manifest;
}

export async function readLabVideoManifest(path) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_MANIFEST_BYTES) fail('Lab video manifest is unavailable.');
  let manifest;
  try { manifest = JSON.parse(await readFile(path, 'utf8')); }
  catch { fail('Lab video manifest is not valid JSON.'); }
  return validateLabVideoManifest(manifest);
}
