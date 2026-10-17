// Browser-safe immutable layer assets, shared by project and package validation.
import {MATERIALS} from './material-catalog.mjs';
const knownSources = new Map(MATERIALS.flatMap(material=>material.sources.map(source=>[source.sha256,{material,source}])));
export const LAYER_ASSET_ROLES = Object.freeze(['background', 'table']);
export const LAYER_ASSET_TYPES = Object.freeze({
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/webm': 'webm',
});
export const MAX_LAYER_ASSET_BYTES = 128 * 1024 * 1024;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const hash = /^[a-f0-9]{64}$/;
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
const assetId = value => typeof value === 'string' && uuid.test(value);
export function layerAssetPath(asset) {
  const extension = Object.hasOwn(LAYER_ASSET_TYPES,asset.contentType)?LAYER_ASSET_TYPES[asset.contentType]:null;
  if (!LAYER_ASSET_ROLES.includes(asset.role) || !assetId(asset.id) || !hash.test(asset.sha256) || !extension) reject();
  return `croupier/media/${asset.role === 'background' ? 'backgrounds' : 'tables'}/${asset.id}/${asset.sha256}.${extension}`;
}
export function validateLayerAsset(value) {
  exact(value, ['schemaVersion', 'id', 'role', 'label', 'sha256', 'size', 'contentType', 'pathname', 'width', 'height'], ['game']);
  if (value.schemaVersion !== 1 || !Number.isSafeInteger(value.size) || value.size < 16 || value.size > MAX_LAYER_ASSET_BYTES
    || ![value.width, value.height].every(n => Number.isSafeInteger(n) && n >= 1 && n <= 16384)
    || value.pathname !== layerAssetPath(value)) reject();
  text(value.label);
  if (Object.hasOwn(value,'game') && (value.role !== 'table' || !['blackjack','roulette'].includes(value.game))) reject();
  const known=knownSources.get(value.sha256);
  if (known && (known.material.role!==value.role
    || ['size','contentType','width','height'].some(key=>value[key]!==known.source[key])
    || value.game!==undefined && value.game!==known.material.game)) reject();
  return structuredClone(value);
}

// Legacy tables remain blackjack-only. Labels never establish game identity.
export function layerAssetFitsGame(asset, game='blackjack') {
  if (!asset || !['blackjack','roulette'].includes(game)) return false;
  const known=knownSources.get(asset.sha256);
  if (known && (known.material.role!==asset.role
    || ['size','contentType','width','height'].some(key=>asset[key]!==known.source[key])
    || asset.game!==undefined && asset.game!==known.material.game)) return false;
  if (asset.role==='background') return asset.game===undefined;
  return asset.role==='table' && (asset.game ?? known?.material.game ?? 'blackjack')===game;
}
