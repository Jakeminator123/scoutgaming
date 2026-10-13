import {validateFrozenDealerPlayback} from './frozen-dealer-playback.mjs';
import {validateCompositionSettings} from './public/composition-settings.mjs';
import {validateBackgroundPlayback} from './public/background-playback-policy.mjs';
import {BASE_DEALER_IDS, MAX_DEALERS, isDealerId} from './dealer-identity.mjs';
import {validateManagedStudioMedia} from './managed-media-contract.mjs';
import {validateFrozenRouletteIdle} from './public/roulette-idle-contract.mjs';
// Portable presentation data. No game outcomes, provider tokens or mutable URLs.
export {LAYER_ASSET_ROLES, LAYER_ASSET_TYPES, MAX_LAYER_ASSET_BYTES, layerAssetPath, validateLayerAsset} from './layer-asset-contract.mjs';
import {LAYER_ASSET_ROLES, validateLayerAsset} from './layer-asset-contract.mjs';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
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
function dataArray(value, max) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max
    || Object.getOwnPropertySymbols(value).length || Object.getOwnPropertyNames(value).length !== value.length + 1
    || Object.keys(value).length !== value.length) reject();
  for (let index = 0; index < value.length; index++) {
    if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, index) ?? {}, 'value')) reject();
  }
  return value;
}
const assetId = value => typeof value === 'string' && uuid.test(value);
function layer(value, role, authorisedDealers = dealers) {
  exact(value, ['enabled', 'default', 'allowed'], role === 'background' ? ['mode', 'zones'] : role === 'table' ? ['colors'] : []);
  if (typeof value.enabled !== 'boolean') reject();
  const allowed = list(value.allowed, role === 'dealer' ? id => authorisedDealers.has(id) : assetId);
  if (value.default !== null && !allowed.includes(value.default)) reject();
  if (role === 'dealer' && (!allowed.length || !authorisedDealers.has(value.default))) reject();
  if (role === 'background' && !['baked', 'image', 'video'].includes(value.mode)) reject();
  if (value.zones !== undefined) list(value.zones, id => typeof id === 'string' && token.test(id));
  if (value.colors !== undefined) list(value.colors, color => typeof color === 'string' && /^#[a-f0-9]{6}$/.test(color));
  return structuredClone(value);
}
export function validatePresentationLane(value, {dealerIds = [...dealers]} = {}) {
  const authorisedDealers = new Set(list(dealerIds, isDealerId, MAX_DEALERS));
  exact(value, ['id', 'label', 'dealers', 'layers', 'openclaw', 'operatorAdjustable'], ['probe', 'idle', 'renderer', 'composition', 'backgroundPlayback']);
  if (typeof value.id !== 'string' || value.id.length > 63 || !token.test(value.id)
    || ['original', 'constructor', 'prototype'].includes(value.id)) reject();
  text(value.label);
  const ids = list(value.dealers, id => authorisedDealers.has(id), MAX_DEALERS);
  if (!ids.length || value.renderer !== undefined && !['layered', 'portrait-video'].includes(value.renderer)) reject();
  exact(value.layers, ['background', 'dealer', 'table']);
  const layers = Object.fromEntries(['background', 'dealer', 'table'].map(role => [role, layer(value.layers[role], role, authorisedDealers)]));
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
  if (Object.hasOwn(value, 'backgroundPlayback')) {
    const policy = validateBackgroundPlayback(value.backgroundPlayback,
      { allowed: layers.background.allowed, defaultAssetId: layers.background.default });
    if (policy.rules.length && !layers.background.enabled) reject();
  }
  return { ...structuredClone(value), layers };
}
/** All and only extras in the selected frozen lane union have an entry.
 * A descriptor is storage metadata, never authority to register a runtime ID. */
export function validateFrozenRegisteredDealers(entries, {dealerIds} = {}) {
  const selected = list(dealerIds, isDealerId, MAX_DEALERS);
  dataArray(entries, MAX_DEALERS);
  // Old packages may omit their built-in profiles. New packages capture every selected dealer.
  const expected = selected.filter(id => !BASE_DEALER_IDS.includes(id) || entries.some(row => row?.id === id));
  const checked = [], seen = new Set();
  for (const entry of entries) {
    exact(entry, ['id', 'label', 'idle'], ['rouletteIdle']);
    if (!expected.includes(entry.id) || seen.has(entry.id) || typeof entry.label !== 'string'
      || !entry.label.trim() || entry.label.length > 120 || /[\u0000-\u001f\u007f-\u009f]/u.test(entry.label)) reject();
    seen.add(entry.id);
    let idle = null;
    if (entry.idle !== null) {
      try { idle = validateManagedStudioMedia(entry.idle); } catch { reject(); }
      const metadata = idle.classification;
      if (metadata.dealerId !== entry.id || metadata.eventId !== 'idle.ready' || metadata.kind !== 'idle'
        || (metadata.playback ?? 'once') !== 'once') reject();
    }
    let rouletteIdle;
    if(Object.hasOwn(entry,'rouletteIdle')) {
      try {rouletteIdle=validateFrozenRouletteIdle(entry.rouletteIdle,entry.id,validateManagedStudioMedia);} catch {reject();}
    }
    checked.push({id:entry.id, label:entry.label, idle,...(rouletteIdle?{rouletteIdle}:{})});
  }
  if (seen.size !== expected.length) reject();
  return checked;
}
export function validatePresentationPackage(value) {
  const version = value && typeof value === 'object' ? Object.getOwnPropertyDescriptor(value, 'schemaVersion')?.value : null;
  const v2 = [2, 3].includes(version), v3 = version === 3;
  exact(value, ['schemaVersion', 'projectRevision', 'lanes', 'assets', ...(v2 ? ['registeredDealers'] : []), ...(v3 ? ['playback'] : [])]);
  if (![1, 2, 3].includes(value.schemaVersion) || typeof value.projectRevision !== 'string'
    || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(value.projectRevision)
    || !Array.isArray(value.lanes) || !value.lanes.length || value.lanes.length > 32
    || !Array.isArray(value.assets) || value.assets.length > 128) reject();
  let registry = [];
  if (v2) {
    dataArray(value.registeredDealers, MAX_DEALERS);
    dataArray(value.lanes, 32); dataArray(value.assets, 128);
    registry = validateFrozenRegisteredDealers(value.registeredDealers, {dealerIds:value.registeredDealers.map(row => row && typeof row === 'object' ? Object.getOwnPropertyDescriptor(row, 'id')?.value : null)});
  }
  const authorised = v2 ? [...new Set([...BASE_DEALER_IDS, ...registry.map(row => row.id)])] : [...dealers];
  const lanes = value.lanes.map(lane => validatePresentationLane(lane, {dealerIds:authorised})), assets = value.assets.map(validateLayerAsset);
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
  for (const lane of lanes) if (Object.hasOwn(lane, 'backgroundPlayback')) {
    validateBackgroundPlayback(lane.backgroundPlayback, { assets,
      allowed: lane.layers.background.allowed, defaultAssetId: lane.layers.background.default });
  }
  const selectedDealers = [...new Set(lanes.flatMap(lane => [...lane.dealers, ...lane.layers.dealer.allowed]))];
  if (v2) registry = validateFrozenRegisteredDealers(registry, {dealerIds:selectedDealers});
  const playback = v3 ? validateFrozenDealerPlayback(value.playback, {registeredDealers:registry, projectRevision:value.projectRevision}) : null;
  return { schemaVersion:value.schemaVersion, projectRevision:value.projectRevision, lanes, assets, ...(v2 ? {registeredDealers:registry} : {}), ...(v3 ? {playback} : {}) };
}
export function buildPresentationPackage(project, selectedLaneIds, library, options = {}) {
  const selected = list(selectedLaneIds, id => typeof id === 'string' && token.test(id));
  const lanes = selected.map(id => project.lanes?.find(lane => lane.id === id));
  if (lanes.some(lane => !lane || lane.dealers.some(id=>!project.dealers?.some(dealer=>dealer.id===id)))) reject();
  const used = new Set(lanes.flatMap(lane => LAYER_ASSET_ROLES.flatMap(role => lane.layers[role].allowed)));
  const v2 = Object.hasOwn(options, 'registeredDealers');
  return validatePresentationPackage({ schemaVersion:Object.hasOwn(options, 'playback') ? 3 : v2 ? 2 : 1, projectRevision:project.revision, lanes,
    assets:library.filter(asset => used.has(asset.id)), ...(v2 ? {registeredDealers:options.registeredDealers} : {}), ...(Object.hasOwn(options, 'playback') ? {playback:options.playback} : {}) });
}
export function presentationLaneFromPackage(pack, id) {
  const checked = validatePresentationPackage(pack);
  return checked.lanes.find(lane => lane.id === id) ?? checked.lanes[0];
}
