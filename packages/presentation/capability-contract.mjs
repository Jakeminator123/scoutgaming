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
const rouletteContract=Object.freeze({...categoryContract,schemaVersion:15,rouletteIdle:'explicit-game-idle-v1',rouletteStart:'explicit-game-start-v1'});
const geometryContract=Object.freeze({...rouletteContract,schemaVersion:16,blackjackTableGeometry:'asset-static-anchors-v1'});
const speechContract=Object.freeze({...geometryContract,schemaVersion:17,recordedSpeech:'exact-take-review-v1',filmedDealVariants:'sixteen-explicit-v1'});
const compressionContract=Object.freeze({...speechContract,schemaVersion:18,presentationCompression:'gzip-brotli-v1'});
const tableBetContract=Object.freeze({...compressionContract,schemaVersion:19,blackjackBetMode:'under-cards-v1'});
const speechSlotContract=Object.freeze({...tableBetContract,schemaVersion:20,speechSlots:'explicit-line-standard-v1'});
const anchorsContract=Object.freeze({...speechSlotContract,schemaVersion:21,blackjackAnchors:'v1'});
// v22 lets blackjack deal/reveal/transition clips declare a VILA/REDO hand pose
// chain; older readers reject REDO and any pose field outside roulette.
const clipPoseContract=Object.freeze({...anchorsContract,schemaVersion:22,clipPoses:'vila-redo-v1'});
// v23 accepts the administration field roomGameConfigs (J08 room drafts). Older
// strict readers reject the whole administration document when it is present.
const contracts=Object.freeze({...baselineContracts,14:categoryContract,15:rouletteContract,16:geometryContract,17:speechContract,
  18:compressionContract,19:tableBetContract,20:speechSlotContract,21:anchorsContract,
  22:clipPoseContract,
  23:Object.freeze({...clipPoseContract,schemaVersion:23,roomGameConfigs:'administration-drafts-v1'}),
  // v24 accepts a timer jitter on background clips and a tablePlayback policy on
  // lanes. Older strict readers reject the trigger field and the lane field.
  24:Object.freeze({...clipPoseContract,schemaVersion:24,roomGameConfigs:'administration-drafts-v1',layerPlayback:'table-and-jitter-v1'}),
  // v25 accepts blackjackTables[].mobile|desktop.autoScale: landing, card size
  // and chips follow the composited dealer. Older strict readers reject it.
  25:Object.freeze({...clipPoseContract,schemaVersion:25,roomGameConfigs:'administration-drafts-v1',layerPlayback:'table-and-jitter-v1',blackjackAutoScale:'dealer-source-v1'}),
  // v26 stores card display with each table and format; old readers reject the field.
  26:Object.freeze({...clipPoseContract,schemaVersion:26,roomGameConfigs:'administration-drafts-v1',layerPlayback:'table-and-jitter-v1',blackjackAutoScale:'dealer-source-v1',blackjackCardView:'saved-layout-v1'}),
  27:Object.freeze({...clipPoseContract,schemaVersion:27,roomGameConfigs:'administration-drafts-v1',layerPlayback:'table-and-jitter-v1',blackjackAutoScale:'dealer-source-v1',blackjackCardView:'saved-layout-v1',blackjackGameUi:'responsive-controls-v1'}),
  // v28 accepts pose-graph rotation and rotation variants in saved/frozen idle policies.
  // Deploy the reader advertisement before enabling the corresponding Admin gate.
  28:Object.freeze({...clipPoseContract,schemaVersion:28,roomGameConfigs:'administration-drafts-v1',layerPlayback:'table-and-jitter-v1',blackjackAutoScale:'dealer-source-v1',blackjackCardView:'saved-layout-v1',blackjackGameUi:'responsive-controls-v1',idleRotation:'pose-graph-v1'}),
  // v29 reads exact byte-bound media timelines and the bounded extended envelope.
  29:Object.freeze({...clipPoseContract,schemaVersion:29,roomGameConfigs:'administration-drafts-v1',layerPlayback:'table-and-jitter-v1',blackjackAutoScale:'dealer-source-v1',blackjackCardView:'saved-layout-v1',blackjackGameUi:'responsive-controls-v1',idleRotation:'pose-graph-v1',mediaTiming:'byte-bound-timeline-v1',extendedPresentation:'bounded-envelope-v2'}),
  // v30 reads a distinct recorded source with its own embedded MP4 audio track.
  // Older contracts retain their exact representations and v1 speech semantics.
  30:Object.freeze({...clipPoseContract,schemaVersion:30,roomGameConfigs:'administration-drafts-v1',layerPlayback:'table-and-jitter-v1',blackjackAutoScale:'dealer-source-v1',blackjackCardView:'saved-layout-v1',blackjackGameUi:'responsive-controls-v1',idleRotation:'pose-graph-v1',mediaTiming:'byte-bound-timeline-v1',extendedPresentation:'bounded-envelope-v2',recordedEmbeddedAv:'embedded-mp4-av-v2'})});
function failure(code, statusCode) { return Object.assign(new Error(code), { code, statusCode }); }
const invalid = () => { throw failure('presentation_capability_invalid', 503); };
function version(value) {
  if (!Number.isInteger(value) || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].includes(value)) invalid();
  return value;
}

// v1 is read compatibility for older deployments. The current endpoint keeps
// its v2 representation unless a caller explicitly negotiates v3-v30. Malformed,
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
  if (header === '16') return 16;
  if (header === '17') return 17;
  if (header === '18') return 18;
  if (header === '19') return 19;
  if (header === '20') return 20;
  if (header === '21') return 21;
  if (header === '22') return 22;
  if (header === '23') return 23;
  if (header === '24') return 24;
  if (header === '25') return 25;
  if (header === '26') return 26;
  if (header === '27') return 27;
  if (header === '28') return 28;
  if (header === '29') return 29;
  if (header === '30') return 30;
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
