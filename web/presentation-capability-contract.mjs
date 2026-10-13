// Portable feature metadata shared by the endpoint, native preflight and UI.
// It grants no dealer registration, media ownership or package authorization.
export const PRESENTATION_CAPABILITY_VERSION_HEADER = 'X-Presentation-Capability-Version';
export const PRESENTATION_CAPABILITY_DEFAULT_VERSION = 2;
const legacyDealerIds = Object.freeze(['nora']);
const common = { registeredDealerIds: legacyDealerIds, compositing: 'per-clip' };
const baselineContracts = {
  1: Object.freeze({ schemaVersion: 1, ...common }),
  2: Object.freeze({ schemaVersion: 2, ...common, rooms: 'operator-owned-v2' }),
  3: Object.freeze({ schemaVersion: 3, ...common, rooms: 'operator-owned-v2',
    registeredDealerMode: 'saved-registry-idle-v1', frozenDealerIdle: 'operator-package-v2' }),
  4: Object.freeze({ schemaVersion: 4, ...common, rooms: 'operator-owned-v2',
    registeredDealerMode: 'saved-registry-idle-v1', frozenDealerIdle: 'operator-package-v2', frozenDealerEvents: 'operator-package-v3' }),
  5: Object.freeze({schemaVersion:5,...common,rooms:'operator-owned-v2',registeredDealerMode:'saved-registry-idle-v1',frozenDealerIdle:'operator-package-v2',frozenDealerEvents:'operator-package-v3',dealerLifecycle:'trash-v1'}),
  6: Object.freeze({schemaVersion:6,...common,rooms:'operator-owned-v2',registeredDealerMode:'saved-registry-idle-v1',frozenDealerIdle:'operator-package-v2',frozenDealerEvents:'operator-package-v3',dealerLifecycle:'trash-v1',resourceLifecycle:'operator-room-archive-v1'}),
  7: Object.freeze({schemaVersion:7,...common,rooms:'operator-owned-v2',registeredDealerMode:'saved-registry-idle-v1',frozenDealerIdle:'operator-package-v2',frozenDealerEvents:'operator-package-v3',dealerLifecycle:'trash-v1',resourceLifecycle:'operator-room-archive-v1',dealerArchiveCascade:'dealer-compositions-rooms-v1'}),
  8: Object.freeze({schemaVersion:8,...common,rooms:'operator-owned-v2',registeredDealerMode:'saved-registry-idle-v1',frozenDealerIdle:'operator-package-v2',frozenDealerEvents:'operator-package-v3',dealerLifecycle:'trash-v1',resourceLifecycle:'operator-room-archive-v1',dealerArchiveCascade:'dealer-compositions-rooms-v1',backgroundPlayback:'rules-v1'}),
  9: Object.freeze({schemaVersion:9,...common,rooms:'operator-owned-v2',registeredDealerMode:'saved-registry-idle-v1',frozenDealerIdle:'operator-package-v2',frozenDealerEvents:'operator-package-v3',dealerLifecycle:'trash-v1',resourceLifecycle:'operator-room-archive-v1',dealerArchiveCascade:'dealer-compositions-rooms-v1',backgroundPlayback:'rules-v1',rouletteRooms:'european-single-zero-v1'}),
  10: Object.freeze({schemaVersion:10,...common,rooms:'operator-owned-v2',registeredDealerMode:'saved-registry-idle-v1',frozenDealerIdle:'operator-package-v2',frozenDealerEvents:'operator-package-v3',dealerLifecycle:'trash-v1',resourceLifecycle:'operator-room-archive-v1',dealerArchiveCascade:'dealer-compositions-rooms-v1',backgroundPlayback:'rules-v1',rouletteRooms:'european-single-zero-v1',dealerSets:'authoring-categories-v1'}),
  11: Object.freeze({schemaVersion:11,...common,rooms:'operator-owned-v2',registeredDealerMode:'saved-registry-idle-v1',frozenDealerIdle:'operator-package-v2',frozenDealerEvents:'operator-package-v3',dealerLifecycle:'trash-v1',resourceLifecycle:'operator-room-archive-v1',dealerArchiveCascade:'dealer-compositions-rooms-v1',backgroundPlayback:'rules-v1',rouletteRooms:'european-single-zero-v1',dealerSets:'authoring-categories-v1',materialTrash:'detached-assets-v1'}),
  12: Object.freeze({schemaVersion:12,...common,rooms:'operator-owned-v2',registeredDealerMode:'saved-registry-idle-v1',frozenDealerIdle:'operator-package-v2',frozenDealerEvents:'operator-package-v3',dealerLifecycle:'trash-v1',resourceLifecycle:'operator-room-archive-v1',dealerArchiveCascade:'dealer-compositions-rooms-v1',backgroundPlayback:'rules-v1',rouletteRooms:'european-single-zero-v1',dealerSets:'authoring-categories-v1',materialTrash:'detached-assets-v1',mediaAlpha:'png-vp9-v1',rouletteMedia:'action-pose-slots-v1'}),
  13: Object.freeze({schemaVersion:13,...common,rooms:'operator-owned-v2',registeredDealerMode:'saved-registry-idle-v1',frozenDealerIdle:'operator-package-v2',frozenDealerEvents:'operator-package-v3',dealerLifecycle:'trash-v1',resourceLifecycle:'operator-room-archive-v1',dealerArchiveCascade:'dealer-compositions-rooms-v1',backgroundPlayback:'rules-v1',rouletteRooms:'european-single-zero-v1',dealerSets:'authoring-categories-v1',materialTrash:'detached-assets-v1',mediaAlpha:'png-vp9-v1',rouletteMedia:'action-pose-slots-v1',tableGame:'immutable-game-v1'}),
};
// v14 is the already shipped category-trash contract. Roulette opts into v15.
const categoryContract=Object.freeze({...baselineContracts[13],schemaVersion:14,dealerCategoryTrash:'retained-categories-v1'});
const contracts=Object.freeze({...baselineContracts,14:categoryContract,
  15:Object.freeze({...categoryContract,schemaVersion:15,rouletteIdle:'explicit-game-idle-v1',rouletteStart:'explicit-game-start-v1'})});
function failure(code, statusCode) { return Object.assign(new Error(code), { code, statusCode }); }
const invalid = () => { throw failure('presentation_capability_invalid', 503); };
function version(value) {
  if (!Number.isInteger(value) || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].includes(value)) invalid();
  return value;
}

// v1 is read compatibility for older deployments. The current endpoint keeps
// its v2 representation unless a caller explicitly negotiates v3-v15. Malformed,
// duplicate or unsupported version headers never silently choose another version.
export function negotiatePresentationCapabilityVersion(header) {
  if (header === null || header === undefined) return PRESENTATION_CAPABILITY_DEFAULT_VERSION;
  if (header === '2') return 2;
  if (header === '3') return 3;
  if (header === '4') return 4;
  if (header === '5') return 5;
  if (header === '6') return 6;
  if (header === '7') return 7;
  if (header === '8') return 8;
  if (header === '9') return 9;
  if (header === '10') return 10;
  if (header === '11') return 11;
  if (header === '12') return 12;
  if (header === '13') return 13;
  if (header === '14') return 14;
  if (header === '15') return 15;
  throw failure('presentation_capability_version_unsupported', 406);
}
export function presentationCapabilitiesForVersion(requestedVersion) {
  return contracts[version(requestedVersion)];
}

// Validate an already parsed, bounded payload. HTTP status, redirects, content
// type, response size, trusted origin and authentication stay with the caller.
export function validatePresentationCapabilities(value, { expectedVersion } = {}) {
  if (expectedVersion !== undefined) version(expectedVersion);
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
  const names = Object.getOwnPropertyNames(value);
  if (Object.getOwnPropertySymbols(value).length || names.length !== Object.keys(value).length
    || names.some(name => !Object.hasOwn(Object.getOwnPropertyDescriptor(value, name), 'value'))) invalid();
  const contract = presentationCapabilitiesForVersion(value.schemaVersion);
  if (expectedVersion !== undefined && value.schemaVersion !== expectedVersion) invalid();
  const keys = Object.keys(contract);
  if (names.length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) invalid();
  if (!Array.isArray(value.registeredDealerIds) || Object.getPrototypeOf(value.registeredDealerIds) !== Array.prototype
    || value.registeredDealerIds.length !== 1 || Object.keys(value.registeredDealerIds).join(',') !== '0'
    || Object.getOwnPropertyNames(value.registeredDealerIds).sort().join(',') !== '0,length'
    || Object.getOwnPropertySymbols(value.registeredDealerIds).length
    || !Object.hasOwn(Object.getOwnPropertyDescriptor(value.registeredDealerIds, '0'), 'value')
    || value.registeredDealerIds[0] !== 'nora') invalid();
  for (const key of keys) if (key !== 'registeredDealerIds' && value[key] !== contract[key]) invalid();
  // Return immutable server-authored feature metadata, never caller-owned data.
  // The legacy Nora list is not the saved/frozen registry authority for v3.
  return contract;
}
