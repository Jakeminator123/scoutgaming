import {validateCompositionSettings} from './public/composition-settings.mjs';
// Portable presentation data. No game outcomes, provider tokens or mutable URLs.
export const LAYER_ASSET_ROLES = Object.freeze(['background', 'table']);
export const LAYER_ASSET_TYPES = Object.freeze({
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/webm': 'webm',
});
export const MAX_LAYER_ASSET_BYTES = 128 * 1024 * 1024;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const hash = /^[a-f0-9]{64}$/;
const token = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const dealers = new Set(['astrid', 'vera', 'amira', 'mei', 'nora']);
const reject = () => { throw Object.assign(new Error('studio_invalid_presentation'), { statusCode: 422 }); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function exact(value, required, optional = []) {
  if (!plain(value) || Object.getOwnPropertySymbols(value).length
    || Object.getOwnPropertyNames(value).length !== Object.keys(value).length
    || required.some(key => !Object.hasOwn(value, key))
    || Object.keys(value).some(key => ![...required, ...optional].includes(key))) reject();
  for (const key of Object.keys(value)) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) reject();
}
function text(value, max = 80) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()
    || value.length > max || /[\u0000-\u001f\u007f-\u009f<>]/u.test(value)) reject();
  return value;
}
function list(value, check, max = 32) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
    || Object.keys(value).length !== value.length || value.length > max || new Set(value).size !== value.length || value.some(item => !check(item))) reject();
  return [...value];
}
const assetId = value => typeof value === 'string' && uuid.test(value);
export function layerAssetPath(asset) {
  const extension = Object.hasOwn(LAYER_ASSET_TYPES,asset.contentType)?LAYER_ASSET_TYPES[asset.contentType]:null;
  if (!LAYER_ASSET_ROLES.includes(asset.role) || !assetId(asset.id) || !hash.test(asset.sha256) || !extension) reject();
  return `croupier/media/${asset.role === 'background' ? 'backgrounds' : 'tables'}/${asset.id}/${asset.sha256}.${extension}`;
}
export function validateLayerAsset(value) {
  exact(value, ['schemaVersion', 'id', 'role', 'label', 'sha256', 'size', 'contentType', 'pathname', 'width', 'height']);
  if (value.schemaVersion !== 1 || !Number.isSafeInteger(value.size) || value.size < 16 || value.size > MAX_LAYER_ASSET_BYTES
    || ![value.width, value.height].every(n => Number.isSafeInteger(n) && n >= 1 && n <= 16384)
    || value.pathname !== layerAssetPath(value)) reject();
  text(value.label);
  return structuredClone(value);
}
function layer(value, role) {
  exact(value, ['enabled', 'default', 'allowed'], role === 'background' ? ['mode', 'zones'] : role === 'table' ? ['colors'] : []);
  if (typeof value.enabled !== 'boolean') reject();
  const allowed = list(value.allowed, role === 'dealer' ? id => dealers.has(id) : assetId);
  if (value.default !== null && !allowed.includes(value.default)) reject();
  if (role === 'dealer' && (!allowed.length || !dealers.has(value.default))) reject();
  if (role === 'background' && !['baked', 'image', 'video'].includes(value.mode)) reject();
  if (value.zones !== undefined) list(value.zones, id => typeof id === 'string' && token.test(id));
  if (value.colors !== undefined) list(value.colors, color => typeof color === 'string' && /^#[a-f0-9]{6}$/.test(color));
  return structuredClone(value);
}
export function validatePresentationLane(value) {
  exact(value, ['id', 'label', 'dealers', 'layers', 'openclaw', 'operatorAdjustable'], ['probe', 'idle', 'renderer', 'composition']);
  if (typeof value.id !== 'string' || value.id.length > 63 || !token.test(value.id)
    || ['original', 'constructor', 'prototype'].includes(value.id)) reject();
  text(value.label);
  const ids = list(value.dealers, id => dealers.has(id), 5);
  if (!ids.length || value.renderer !== undefined && !['layered', 'portrait-video'].includes(value.renderer)) reject();
  exact(value.layers, ['background', 'dealer', 'table']);
  const layers = Object.fromEntries(['background', 'dealer', 'table'].map(role => [role, layer(value.layers[role], role)]));
  if (layers.dealer.allowed.some(id => !ids.includes(id))) reject();
  exact(value.openclaw, ['idle', 'deal', 'reveal', 'speak', 'probe']);
  if (Object.values(value.openclaw).some(mode => !['off', 'rules', 'random', 'shadow', 'active'].includes(mode))) reject();
  list(value.operatorAdjustable, item => ['table.color', 'table', 'background', 'dealer', 'branding'].includes(item));
  if (value.probe !== undefined) {
    exact(value.probe, ['mode'], ['model']);
    if (!['off', 'shadow', 'active'].includes(value.probe.mode)) reject();
    // Detailed probe policy stays with the existing project validator.
    if (value.probe.model !== undefined && typeof value.probe.model !== 'string') reject();
  }
  if (value.idle !== undefined) {
    exact(value.idle, [], ['frequencyPercent', 'variants']);
    if (value.idle.frequencyPercent !== undefined && (!Number.isInteger(value.idle.frequencyPercent)
      || value.idle.frequencyPercent < 0 || value.idle.frequencyPercent > 100)) reject();
    if (value.idle.variants !== undefined) list(value.idle.variants, id => typeof id === 'string' && id.length <= 200);
  }
  if(value.composition!==undefined)validateCompositionSettings(value.composition);
  return { ...structuredClone(value), layers };
}
export function validatePresentationPackage(value) {
  exact(value, ['schemaVersion', 'projectRevision', 'lanes', 'assets']);
  if (value.schemaVersion !== 1 || typeof value.projectRevision !== 'string'
    || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(value.projectRevision)
    || !Array.isArray(value.lanes) || !value.lanes.length || value.lanes.length > 32
    || !Array.isArray(value.assets) || value.assets.length > 128) reject();
  const lanes = value.lanes.map(validatePresentationLane), assets = value.assets.map(validateLayerAsset);
  if (new Set(lanes.map(row => row.id)).size !== lanes.length || new Set(assets.map(row => row.id)).size !== assets.length) reject();
  const byId = new Map(assets.map(asset => [asset.id, asset]));
  const used = new Set();
  for (const lane of lanes) for (const role of LAYER_ASSET_ROLES) {
    for (const id of lane.layers[role].allowed) {
      if (byId.get(id)?.role !== role) reject();
      used.add(id);
    }
  }
  if (assets.some(asset => !used.has(asset.id))) reject();
  return { schemaVersion: 1, projectRevision: value.projectRevision, lanes, assets };
}
export function buildPresentationPackage(project, selectedLaneIds, library) {
  const selected = list(selectedLaneIds, id => typeof id === 'string' && token.test(id));
  const lanes = selected.map(id => project.lanes?.find(lane => lane.id === id));
  if (lanes.some(lane => !lane || lane.dealers.some(id=>!project.dealers?.some(dealer=>dealer.id===id)))) reject();
  const used = new Set(lanes.flatMap(lane => LAYER_ASSET_ROLES.flatMap(role => lane.layers[role].allowed)));
  return validatePresentationPackage({ schemaVersion: 1, projectRevision: project.revision, lanes,
    assets: library.filter(asset => used.has(asset.id)) });
}
export function presentationLaneFromPackage(pack, id) {
  const checked = validatePresentationPackage(pack);
  return checked.lanes.find(lane => lane.id === id) ?? checked.lanes[0];
}
