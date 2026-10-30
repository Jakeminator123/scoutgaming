import { AsyncLocalStorage } from 'node:async_hooks';
import { canonicalStudioJson, StudioStorageError } from '../../../packages/studio-registry/server/document-contract.mjs';
import { PRESENTATION_CAPABILITY_VERSION_HEADER, validatePresentationCapabilities } from '../../../packages/presentation/capability-contract.mjs';
import { BASE_DEALER_IDS } from '../../../packages/presentation/contracts/dealer-identity.mjs';
import {extendedDealerMediaFeatures} from '../../../packages/presentation/contracts/dealer-media-features.mjs';
import {maxVariantsForEvent} from '../../../packages/presentation/contracts/studio-model.mjs';
import {encodePresentationPackage} from '../../../packages/presentation/server/presentation-package.mjs';
import {EXTENDED_PRESENTATION_FORMAT} from '../../../packages/presentation/server/presentation-storage.mjs';
import {normalizeMediaTiming} from '../../../packages/presentation/contracts/media-timing.mjs';
import {withNativeFilmedPlanningReadiness} from '../../../packages/presentation/server/native-filmed-readiness-context.mjs';
import {playbackUsesJitter} from '../../../packages/presentation/contracts/background-playback-policy.mjs';

export const PRESENTATION_RUNTIME_UPDATE_REQUIRED = 'studio_presentation_runtime_update_required';
export const PRESENTATION_RUNTIME_UPDATE_MESSAGE = 'Spelservern beh\u00f6ver uppdateras innan presentationen kan sparas. Ditt utkast \u00e4r kvar.';
const baseDealers = new Set(BASE_DEALER_IDS);
const CAPABILITY_PATH = '/api/presentation/capabilities';
// Bounds the capability read; the exact v34 representation is well below this limit.
const JSON_LIMIT = 2048;
const fail = () => { throw new StudioStorageError(PRESENTATION_RUNTIME_UPDATE_REQUIRED, 503); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const extraDealer = value => typeof value === 'string' && !baseDealers.has(value);
function packageRecords(value) {
  return [...(value?.registeredDealers??[]).flatMap(row=>[row?.idle,row?.rouletteIdle?.base,...(row?.rouletteIdle?.variants??[]),row?.rouletteStart?.clip]),...(value?.playback?.media??[])];
}
const hasMediaTiming=records=>records.some(row=>object(row)&&Object.hasOwn(row,'mediaTiming'));
function packageFeatures(value) {
  const envelope = encodePresentationPackage(value,{allowExtended:true}),records=packageRecords(value);
  return {envelope,records,mediaTiming:hasMediaTiming(records),
    extendedPresentation:envelope.format===EXTENDED_PRESENTATION_FORMAT};
}
export function presentationPackageRequiresV29(value) {
  // Select the required version; validation still runs on the complete candidate
  // at preflight. Measured banks need no extra compression pass just to select v29.
  return hasMediaTiming(packageRecords(value))
    || encodePresentationPackage(value,{allowExtended:true}).format===EXTENDED_PRESENTATION_FORMAT;
}
export function presentationPackageRequiresV30(value) {
  // Version selection only; preflight validates the complete frozen candidate.
  return packageRecords(value).some(row=>extendedDealerMediaFeatures(row?.classification).recordedEmbeddedAv);
}
// Binding presence is conservative: republishing a v1 shared room also
// negotiates v31, while packages without shared configurations remain legacy.
export const NATIVE_FILMED_PLANNING_MUTATION = Object.freeze({kind:'native-film-planning',value:Object.freeze({})});
export function nativeFilmedPlanningMutations(pack) {
  const bindings=pack?.branding?.roomGameConfigVersions;
  return bindings&&typeof bindings==='object'&&Object.keys(bindings).length
    ? [NATIVE_FILMED_PLANNING_MUTATION] : [];
}
function timingIdentity(value) {
  try { return canonicalStudioJson(normalizeMediaTiming(value)); } catch { return null; }
}
function documentFeatures(kind, value) {
  // A publication descriptor is the complete candidate, never a feature hint.
  // Use the actual encoder so malformed or oversized candidates fail closed.
  // Lifecycle can retain or re-encode any current frozen package. Its explicit
  // descriptor negotiates both codecs and the current table layout before SQL;
  // stored project trash fields alone do not imply that operation.
  const nativeFilmedPlanning=kind==='native-film-planning';
  const lifecycleOperation = ['material-trash','resource-lifecycle','dealer-archive'].includes(kind);
  const packed=kind==='presentation-package'?packageFeatures(value):null;
  const presentationCompression=lifecycleOperation||packed?.envelope.encoding==='br-base64url';
  const mediaTiming=packed?.mediaTiming===true,extendedPresentation=packed?.extendedPresentation===true;
  const media=(packed?.records??[]).map(row=>extendedDealerMediaFeatures(row?.classification));
  const mediaAlpha=media.some(row=>row.mediaAlpha),rouletteMedia=media.some(row=>row.rouletteMedia),recordedSpeech=media.some(row=>row.recordedSpeech);
  const recordedEmbeddedAv=media.some(row=>row.recordedEmbeddedAv);
  const clipPoses=media.some(row=>row.clipPoses);
  const rouletteIdle=['project','presentation-package'].includes(kind)
    && [...(value?.dealers??[]),...(value?.registeredDealers??[]),...(value?.dealerTrash??[]).map(row=>row?.dealer)]
      .some(row=>object(row)&&Object.hasOwn(row,'rouletteIdle'));
  const rouletteStart=['project','presentation-package'].includes(kind)
    && [...(value?.dealers??[]),...(value?.registeredDealers??[]),...(value?.dealerTrash??[]).map(row=>row?.dealer)]
      .some(row=>object(row)&&Object.hasOwn(row,'rouletteStart'));
  // v34: a dealer's own frozen filmed profile, active, archived or in a package row.
  const filmedProfiles=['project','presentation-package','dealer-archive'].includes(kind)
    && [...(value?.dealers??[]),...(value?.registeredDealers??[]),...(value?.dealerTrash??[]).map(row=>row?.dealer)]
      .some(row=>object(row)&&Object.hasOwn(row,'filmedProfile'));
  const filmedTakeSources=filmedProfiles
    && [...(value?.dealers??[]),...(value?.registeredDealers??[]),...(value?.dealerTrash??[]).map(row=>row?.dealer)]
      .some(row=>Object.values(row?.filmedProfile?.takes??{}).some(take=>object(take)&&Object.hasOwn(take,'sourceTakeKey')));
  const tableGame=['project','presentation-package'].includes(kind)
    && [...(value?.layerAssets??[]),...(value?.assets??[]),...(value?.layerAssetTrash??[]).map(row=>row?.asset)]
      .some(asset=>object(asset)&&Object.hasOwn(asset,'game'));
  const dealers = kind === 'project' && Array.isArray(value?.dealers)
    ? value.dealers.map(row => row?.id).filter(extraDealer)
    : kind === 'administration' && Array.isArray(value?.gameLanes)
      ? value.gameLanes.filter(row => row?.dealer === 'nora' || row?.renderer === 'portrait-video').map(row => row?.dealer).filter(extraDealer)
      : kind === 'presentation-package' && Array.isArray(value?.registeredDealers)
        ? value.registeredDealers.map(row => row?.id).filter(extraDealer) : [];
  const composition = Boolean(kind === 'project' && Array.isArray(value?.lanes)
    && value.lanes.some(lane => object(lane) && Object.hasOwn(lane, 'composition')));
  const cascade = kind === 'dealer-archive' || kind === 'project' && value?.dealerTrash?.some?.(entry=>entry?.schemaVersion===2);
  const materialTrash = kind === 'material-trash' || kind === 'project' && Object.hasOwn(value ?? {}, 'layerAssetTrash');
  const resourceLifecycle = materialTrash || cascade || kind === 'resource-lifecycle';
  const rooms = resourceLifecycle || Boolean(kind === 'administration' && value?.rooms?.some?.(room => room?.schemaVersion === 2));
  const roulette = Boolean(kind === 'administration' && value?.rooms?.some?.(room => room?.game === 'roulette'));
  const frozen = kind === 'presentation-package' && [2, 3].includes(value?.schemaVersion);
  const frozenEvents = kind === 'presentation-package' && value?.schemaVersion === 3;
  const lifecycle = cascade || kind === 'project' && Object.hasOwn(value ?? {}, 'dealerTrash');
  // Even an empty field is rejected by the older strict project validator.
  const dealerSets = kind === 'project' && Object.hasOwn(value ?? {}, 'dealerSets');
  // Same rule for J08 room drafts: older strict readers reject the whole administration document.
  const roomGameConfigs = kind === 'administration' && Object.hasOwn(value ?? {}, 'roomGameConfigs');
  // Older strict readers reject both the optional rotation field and rotation use.
  const idlePolicies = ['project','dealer-archive'].includes(kind)
    ? [value?.idlePolicy,...(value?.dealerIdlePolicies??[]).map(row=>row?.policy),
      ...(value?.dealerTrash??[]).flatMap(row=>[row?.idlePolicy,row?.globalIdlePolicy])]
    : kind === 'presentation-package' ? (value?.playback?.dealerIdlePolicies??[]).map(row=>row?.policy) : [];
  const idleRotation = idlePolicies.some(policy=>object(policy)&&(Object.hasOwn(policy,'rotation')
    ||Array.isArray(policy.variants)&&policy.variants.some(row=>row?.use==='rotation')));
  // v32: a rotation clip that OpenClaw or a game rule may also propose. Older
  // rotation readers accept only use 'rotation' inside a sequence.
  const idleRotationOffers = idlePolicies.some(policy=>object(policy)&&Object.hasOwn(policy,'rotation')
    &&Array.isArray(policy.variants)&&policy.variants.some(row=>row?.use!=='rotation'));
  const dealerCategoryTrash=['project','dealer-archive'].includes(kind)&&Boolean(value?.dealerTrash?.some?.(entry=>Object.hasOwn(entry,'dealerSets')));
  const generic = dealers.some(id => id !== 'nora');
  const backgroundPlayback = ['project', 'presentation-package'].includes(kind)
    && [...(Array.isArray(value?.lanes) ? value.lanes : []), ...(Array.isArray(value?.dealerTrash) ? value.dealerTrash : [])
      .flatMap(entry => Array.isArray(entry?.compositions) ? entry.compositions : [])]
      .some(lane => object(lane) && Object.hasOwn(lane, 'backgroundPlayback'));
  const compositionLanes=['project','presentation-package','dealer-archive'].includes(kind)
    ?[...(value?.lanes??[]),...(value?.dealerTrash??[]).flatMap(entry=>entry.compositions??[])]:[];
  // v24: a table playback policy or a jittered timer is rejected by older strict readers.
  const layerPlayback=compositionLanes.some(lane=>object(lane)&&(Object.hasOwn(lane,'tablePlayback')
    ||playbackUsesJitter(lane.backgroundPlayback)||playbackUsesJitter(lane.tablePlayback)));
  const blackjackTableGeometry=compositionLanes.some(lane=>object(lane?.composition)&&Object.hasOwn(lane.composition,'blackjackTables'));
  // v33: a lane's miljöbild or an `illustration` material, in active, archived or frozen data.
  const laneIllustration=compositionLanes.some(lane=>object(lane)&&Object.hasOwn(lane,'illustration'))
    ||(['project','presentation-package'].includes(kind)&&[...(value?.layerAssets??[]),...(value?.assets??[]),...(value?.layerAssetTrash??[]).map(row=>row?.asset)]
      .some(asset=>object(asset)&&asset.role==='illustration'));
  // Presence matters even if validation later rejects the value: older readers
  // do not accept this optional field in either active or archived geometry.
  const blackjackBetMode=lifecycleOperation||compositionLanes.some(lane=>Array.isArray(lane?.composition?.blackjackTables)
    &&lane.composition.blackjackTables.some(table=>['mobile','desktop'].some(layout=>object(table?.[layout])&&Object.hasOwn(table[layout],'betMode'))));
  const blackjackAnchors=compositionLanes.some(lane=>Array.isArray(lane?.composition?.blackjackTables)
    &&lane.composition.blackjackTables.some(table=>['mobile','desktop'].some(layout=>object(table?.[layout])&&Object.hasOwn(table[layout],'anchors'))));
  // v25: dealer-following autoScale, in active, archived or frozen geometry.
  const blackjackAutoScale=compositionLanes.some(lane=>Array.isArray(lane?.composition?.blackjackTables)
    &&lane.composition.blackjackTables.some(table=>['mobile','desktop'].some(layout=>object(table?.[layout])&&Object.hasOwn(table[layout],'autoScale'))));
  // v26: saved card display, including archived and frozen layouts.
  const blackjackCardView=compositionLanes.some(lane=>Array.isArray(lane?.composition?.blackjackTables)
    &&lane.composition.blackjackTables.some(table=>['mobile','desktop'].some(layout=>object(table?.[layout])&&Object.hasOwn(table[layout],'cardView'))));
  // v27 adds per-format controls and card fan spacing to strict compositions.
  const blackjackGameUi=compositionLanes.some(lane=>['mobile','desktop'].some(layout=>
    Object.hasOwn(lane?.composition?.[layout]??{},'gameUi')
    ||lane?.composition?.blackjackTables?.some(table=>Object.hasOwn(table?.[layout]??{},'fanSpread'))));
  // The previous deployed validator accepts at most five variants on every row.
  const lines=['project','presentation-package','dealer-archive'].includes(kind)
    ?[...(kind==='presentation-package'?value?.playback?.lines??[]:value?.lines??[]),...(value?.dealerTrash??[]).flatMap(entry=>entry.lines??[])]:[];
  const filmedDealVariants=lines.some(line=>line?.eventId?.startsWith('deal.')&&maxVariantsForEvent(line.eventId)>5&&Array.isArray(line?.variants)&&line.variants.length>5);
  // Detect actual saved slot data, including archived rows and frozen packages.
  // Unrelated lifecycle operations retain their existing capability requirement.
  const speechSlots=lines.some(line=>Array.isArray(line?.variants)
    &&(line.eventId==='speak.other'&&line.variants.length>5||line.variants.some(variant=>typeof variant?.id==='string'&&variant.id.includes('.slot-'))));
  return { required: laneIllustration || nativeFilmedPlanning || dealers.length > 0 || composition || rooms || frozen || lifecycle || resourceLifecycle || backgroundPlayback || dealerSets || materialTrash || mediaAlpha || rouletteMedia || tableGame || dealerCategoryTrash || rouletteIdle || rouletteStart || blackjackTableGeometry || blackjackBetMode || recordedSpeech || recordedEmbeddedAv || filmedDealVariants || presentationCompression || speechSlots || blackjackAnchors || clipPoses || roomGameConfigs || layerPlayback || blackjackAutoScale || blackjackCardView || blackjackGameUi || idleRotation || idleRotationOffers || mediaTiming || extendedPresentation || filmedProfiles,
    filmedTakeSources, filmedProfiles, laneIllustration, nativeFilmedPlanning, dealers, composition, rooms, generic, frozen, frozenEvents, lifecycle, resourceLifecycle, cascade, backgroundPlayback, roulette, dealerSets, materialTrash,mediaAlpha,rouletteMedia,tableGame,dealerCategoryTrash,rouletteIdle,rouletteStart,blackjackTableGeometry,blackjackBetMode,recordedSpeech,recordedEmbeddedAv,filmedDealVariants,presentationCompression,speechSlots,blackjackAnchors,clipPoses,roomGameConfigs,layerPlayback,blackjackAutoScale,blackjackCardView,blackjackGameUi,idleRotation,idleRotationOffers,mediaTiming,extendedPresentation };
}
function mediaFeatures(metadata, hasTiming=false, timing) {
  const {mediaAlpha,rouletteMedia,recordedSpeech,recordedEmbeddedAv,clipPoses}=extendedDealerMediaFeatures(metadata);
  const dealers = extraDealer(metadata?.dealerId) ? [metadata.dealerId] : [];
  const composition = Boolean(object(metadata) && Object.hasOwn(metadata, 'compositing'));
  return { required: dealers.length > 0 || composition || mediaAlpha || rouletteMedia || recordedSpeech || recordedEmbeddedAv || clipPoses || hasTiming, dealers, composition, generic: dealers.some(id => id !== 'nora'), frozen: false,mediaAlpha,rouletteMedia,recordedSpeech,recordedEmbeddedAv,clipPoses,mediaTiming:hasTiming,mediaTimings:hasTiming?[timingIdentity(timing)].filter(Boolean):[] };
}
function mutationFeatures(input) {
  const entries = Array.isArray(input) ? input : [input];
  const features = entries.filter(Boolean).map(value => Object.hasOwn(value, 'metadata')
    ? mediaFeatures(value.metadata,Object.hasOwn(value,'mediaTiming'),value.mediaTiming) : documentFeatures(value.kind, value.value));
  return {
    required: features.some(value => value.required),
    nativeFilmedPlanning: features.some(value => value.nativeFilmedPlanning),
    filmedTakeSources: features.some(value => value.filmedTakeSources),
    filmedProfiles: features.some(value => value.filmedProfiles),
    laneIllustration: features.some(value => value.laneIllustration),
    dealers: [...new Set(features.flatMap(value => value.dealers))],
    composition: features.some(value => value.composition),
    rooms: features.some(value => value.rooms),
    generic: features.some(value => value.generic),
    frozen: features.some(value => value.frozen),
    frozenEvents: features.some(value => value.frozenEvents),
    lifecycle: features.some(value => value.lifecycle),
    resourceLifecycle: features.some(value => value.resourceLifecycle),
    cascade: features.some(value => value.cascade),
    backgroundPlayback: features.some(value => value.backgroundPlayback),
    roulette: features.some(value => value.roulette),
    dealerSets: features.some(value => value.dealerSets),
    materialTrash: features.some(value => value.materialTrash),
    mediaAlpha: features.some(value => value.mediaAlpha),
    rouletteMedia: features.some(value => value.rouletteMedia),
    tableGame: features.some(value => value.tableGame),
    dealerCategoryTrash: features.some(value => value.dealerCategoryTrash),
    rouletteIdle: features.some(value => value.rouletteIdle),
    rouletteStart: features.some(value => value.rouletteStart),
    blackjackTableGeometry:features.some(value=>value.blackjackTableGeometry),
    blackjackBetMode:features.some(value=>value.blackjackBetMode),
    recordedSpeech:features.some(value=>value.recordedSpeech),
    recordedEmbeddedAv:features.some(value=>value.recordedEmbeddedAv),
    filmedDealVariants:features.some(value=>value.filmedDealVariants),
    presentationCompression:features.some(value=>value.presentationCompression),
    speechSlots:features.some(value=>value.speechSlots),
    blackjackAnchors:features.some(value=>value.blackjackAnchors),
    clipPoses:features.some(value=>value.clipPoses),
    roomGameConfigs:features.some(value=>value.roomGameConfigs),
    layerPlayback:features.some(value=>value.layerPlayback),
    blackjackAutoScale:features.some(value=>value.blackjackAutoScale),
    blackjackCardView:features.some(value=>value.blackjackCardView),
    blackjackGameUi:features.some(value=>value.blackjackGameUi),
    idleRotation:features.some(value=>value.idleRotation),
    idleRotationOffers:features.some(value=>value.idleRotationOffers),
    mediaTiming:features.some(value=>value.mediaTiming),
    extendedPresentation:features.some(value=>value.extendedPresentation),
    mediaTimings:[...new Set(features.flatMap(value=>value.mediaTimings??[]))],
  };
}
function trustedOrigin(env) {
  const value = env.CROUPIER_BACKEND_ORIGIN || env.RENDER_EXTERNAL_URL;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password
      || url.search || url.hash || url.pathname !== '/') return null;
    return url.origin;
  } catch { return null; }
}
async function boundedCapabilities(response, expectedVersion) {
  if (response.status !== 200 || response.redirected || !response.body
    || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')
    || Number(response.headers.get('content-length')) > JSON_LIMIT) fail();
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > JSON_LIMIT) { await reader.cancel(); fail(); }
      chunks.push(Buffer.from(value));
    }
    return validatePresentationCapabilities(JSON.parse(Buffer.concat(chunks).toString('utf8')), { expectedVersion });
  } finally { reader.releaseLock(); }
}
/** Native-only gate: all HTTP preflight finishes before either SQL transaction. */
export function wrapNativePresentationRepository(repository, { env = process.env, fetchImpl = fetch } = {}) {
  const origin = trustedOrigin(env), mutationContext = new AsyncLocalStorage();
  function covered(features, active) {
    return !features.required || Boolean(active?.verified
      && (!features.nativeFilmedPlanning || active.features.nativeFilmedPlanning)
      && (!features.filmedTakeSources || active.features.filmedTakeSources)
      && (!features.filmedProfiles || active.features.filmedProfiles)
      && (!features.laneIllustration || active.features.laneIllustration)
      && (!features.composition || active.features.composition)
      && (!features.rooms || active.features.rooms)
      && (!features.generic || active.features.generic)
      && (!features.frozen || active.features.frozen)
      && (!features.frozenEvents || active.features.frozenEvents)
      && (!features.lifecycle || active.features.lifecycle)
      && (!features.resourceLifecycle || active.features.resourceLifecycle)
      && (!features.cascade || active.features.cascade)
      && (!features.backgroundPlayback || active.features.backgroundPlayback)
      && (!features.roulette || active.features.roulette)
      && (!features.dealerSets || active.features.dealerSets)
      && (!features.materialTrash || active.features.materialTrash)
      && (!features.mediaAlpha || active.features.mediaAlpha)
      && (!features.rouletteMedia || active.features.rouletteMedia)
      && (!features.tableGame || active.features.tableGame)
      && (!features.dealerCategoryTrash || active.features.dealerCategoryTrash)
      && (!features.rouletteIdle || active.features.rouletteIdle)
      && (!features.rouletteStart || active.features.rouletteStart)
      && (!features.blackjackTableGeometry || active.features.blackjackTableGeometry)
      && (!features.blackjackBetMode || active.features.blackjackBetMode)
      && (!features.recordedSpeech || active.features.recordedSpeech)
      && (!features.recordedEmbeddedAv || active.features.recordedEmbeddedAv)
      && (!features.filmedDealVariants || active.features.filmedDealVariants)
      && (!features.presentationCompression || active.features.presentationCompression)
      && (!features.speechSlots || active.features.speechSlots)
      && (!features.blackjackAnchors || active.features.blackjackAnchors)
      && (!features.clipPoses || active.features.clipPoses)
      && (!features.roomGameConfigs || active.features.roomGameConfigs)
      && (!features.layerPlayback || active.features.layerPlayback)
      && (!features.blackjackAutoScale || active.features.blackjackAutoScale)
      && (!features.blackjackCardView || active.features.blackjackCardView)
      && (!features.blackjackGameUi || active.features.blackjackGameUi)
      && (!features.idleRotation || active.features.idleRotation)
      && (!features.idleRotationOffers || active.features.idleRotationOffers)
      && (!features.mediaTiming || active.features.mediaTiming)
      && (!features.extendedPresentation || active.features.extendedPresentation)
      && (features.mediaTimings??[]).every(value=>active.features.mediaTimings.includes(value))
      && features.dealers.every(id => active.features.dealers.includes(id)));
  }
  async function ready(features) {
    if (!features.required) return;
    const active = mutationContext.getStore();
    if (active) {
      if (!covered(features, active)) fail();
      return; // Never fetch from inside a request's SQL mutation context.
    }
    if (!origin || typeof fetchImpl !== 'function') fail();
    let response;
    try {
      const endpoint = origin + CAPABILITY_PATH;
      const requiredVersion = features.filmedTakeSources ? 35 : features.filmedProfiles ? 34 : features.laneIllustration ? 33 : features.idleRotationOffers ? 32 : features.nativeFilmedPlanning ? 31 : features.recordedEmbeddedAv ? 30 : features.mediaTiming || features.extendedPresentation ? 29 : features.idleRotation ? 28 : features.blackjackGameUi ? 27 : features.blackjackCardView ? 26 : features.blackjackAutoScale ? 25 : features.layerPlayback ? 24 : features.roomGameConfigs ? 23 : features.clipPoses ? 22 : features.blackjackAnchors ? 21 : features.speechSlots ? 20 : features.blackjackBetMode ? 19 : features.presentationCompression ? 18 : features.recordedSpeech || features.filmedDealVariants ? 17 : features.blackjackTableGeometry ? 16 : features.rouletteStart || features.rouletteIdle ? 15 : features.dealerCategoryTrash ? 14 : features.tableGame ? 13 : features.mediaAlpha || features.rouletteMedia ? 12 : features.materialTrash ? 11 : features.dealerSets ? 10 : features.roulette ? 9 : features.backgroundPlayback ? 8 : features.cascade ? 7 : features.resourceLifecycle ? 6 : features.lifecycle ? 5 : features.frozenEvents ? 4 : features.generic || features.frozen ? 3 : undefined;
      response = await fetchImpl(endpoint, {
        method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store',
        headers: { Accept: 'application/json', ...(requiredVersion ? { [PRESENTATION_CAPABILITY_VERSION_HEADER]: String(requiredVersion) } : {}) }, signal: AbortSignal.timeout(3000),
      });
      if (response.url && response.url !== endpoint) fail();
      const capabilities = await boundedCapabilities(response, requiredVersion);
      if (!requiredVersion && features.dealers.some(id => !capabilities.registeredDealerIds.includes(id))
        || features.rooms && capabilities.rooms !== 'operator-owned-v2') fail();
    } catch {
      try { await response?.body?.cancel(); } catch { /* Keep only the fixed public code. */ }
      fail();
    }
  }
  let wrapped;
  async function withMutationContext(work, descriptor) {
    // Derive immutable scalar feature permissions before the first await.
    const features = mutationFeatures(descriptor), active = mutationContext.getStore();
    if (active) {
      if (!covered(features, active)) fail();
      return work(wrapped);
    }
    await ready(features);
    const context={verified:features.required,features,measurementOpen:true};
    return withNativeFilmedPlanningReadiness(features.nativeFilmedPlanning,()=>mutationContext.run(context,async()=>{
      try { return await work(wrapped); }
      finally { context.measurementOpen=false; }
    }));
  }
  wrapped = Object.freeze({
    ...repository,
    withMutationContext,
    async saveDocument(kind, options = {}) {
      const features = documentFeatures(kind, options.value);
      const proposed = features.required ? structuredClone(options) : options;
      if (features.required) await ready(features);
      return repository.saveDocument.call(repository, kind, proposed);
    },
    ...(typeof repository.saveDealerLifecycle === 'function' ? {
      async saveDealerLifecycle(value, options = {}) {
        const features=documentFeatures('project',value),proposed=features.required?structuredClone(value):value;
        if(features.required)await ready(features);
        return repository.saveDealerLifecycle.call(repository,proposed,options);
      },
    } : {}),
    async registerMedia(record, options = {}) {
      const features = mediaFeatures(record?.classification,object(record)&&Object.hasOwn(record,'mediaTiming'),record?.mediaTiming);
      const proposed = features.required ? structuredClone(record) : record;
      if (features.required) await ready(features);
      return repository.registerMedia.call(repository, proposed, options);
    },
    async classifyMedia(id, options = {}) {
      const features = mediaFeatures(options.metadata);
      const proposed = features.required ? structuredClone(options) : options;
      if (features.required) await ready(features);
      return repository.classifyMedia.call(repository, id, proposed);
    },
    ...(typeof repository.saveMediaTiming === 'function' ? {
      async saveMediaTiming(id, options = {}) {
        // This writer may run under SQL locks: only an already verified exact
        // measurement descriptor can authorize it, never a new HTTP preflight.
        const active=mutationContext.getStore(),identity=timingIdentity(options.mediaTiming);
        if(!active?.verified || !active.measurementOpen || !active.features.mediaTiming || !identity
          || !active.features.mediaTimings.includes(identity)
          || options.mediaTiming.mediaId!==id || options.mediaTiming.sha256!==options.sha256) fail();
        const proposed=structuredClone(options);
        if(timingIdentity(proposed.mediaTiming)!==identity
          || proposed.mediaTiming.mediaId!==id || proposed.mediaTiming.sha256!==proposed.sha256)fail();
        // The descriptor is not authority for the stored row's source format.
        // A scoped getMedia reader is required, including in test adapters. This
        // local read may share the SQL transaction; it never starts HTTP preflight.
        if(typeof repository.getMedia!=='function')fail();
        const record=await repository.getMedia.call(repository,id);
        if(!active.measurementOpen || !record || record.id!==id || record.sha256!==proposed.sha256
          || !covered(mediaFeatures(record.classification,true,proposed.mediaTiming),active))fail();
        return repository.saveMediaTiming.call(repository,id,proposed);
      },
    } : {}),
    ...(typeof repository.transaction === 'function' ? {
      transaction(work, options = {}) {
        return withMutationContext(() => repository.transaction.call(repository, () => work(wrapped), options),
          options.presentationMutation);
      },
    } : {}),
  });
  return wrapped;
}
