import { AsyncLocalStorage } from 'node:async_hooks';
import { StudioStorageError } from '../../packages/studio-registry/server/document-contract.mjs';
import { PRESENTATION_CAPABILITY_VERSION_HEADER, validatePresentationCapabilities } from '../../packages/presentation/capability-contract.mjs';
import { BASE_DEALER_IDS } from '../../packages/presentation/contracts/dealer-identity.mjs';
import {extendedDealerMediaFeatures} from '../../packages/presentation/contracts/dealer-media-features.mjs';
import {maxVariantsForEvent} from '../../packages/presentation/contracts/studio-model.mjs';
import {encodePresentationPackage} from '../../packages/presentation/server/presentation-package.mjs';

export const PRESENTATION_RUNTIME_UPDATE_REQUIRED = 'studio_presentation_runtime_update_required';
export const PRESENTATION_RUNTIME_UPDATE_MESSAGE = 'Spelservern beh\u00f6ver uppdateras innan presentationen kan sparas. Ditt utkast \u00e4r kvar.';
const baseDealers = new Set(BASE_DEALER_IDS);
const CAPABILITY_PATH = '/api/presentation/capabilities';
const JSON_LIMIT = 1024;
const fail = () => { throw new StudioStorageError(PRESENTATION_RUNTIME_UPDATE_REQUIRED, 503); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const extraDealer = value => typeof value === 'string' && !baseDealers.has(value);
function documentFeatures(kind, value) {
  // A publication descriptor is the complete candidate, never a feature hint.
  // Use the actual encoder so malformed or oversized candidates fail closed.
  // Lifecycle can retain or re-encode any current frozen package. Its explicit
  // descriptor negotiates both codecs and the current table layout before SQL;
  // stored project trash fields alone do not imply that operation.
  const lifecycleOperation = ['material-trash','resource-lifecycle','dealer-archive'].includes(kind);
  const presentationCompression = lifecycleOperation
    || kind === 'presentation-package' && encodePresentationPackage(value).encoding === 'br-base64url';
  const media=kind==='presentation-package'
    ? [...(value?.registeredDealers??[]).flatMap(row=>[row?.idle,row?.rouletteIdle?.base,...(row?.rouletteIdle?.variants??[]),row?.rouletteStart?.clip]),...(value?.playback?.media??[])]
      .map(row=>extendedDealerMediaFeatures(row?.classification)) : [];
  const mediaAlpha=media.some(row=>row.mediaAlpha),rouletteMedia=media.some(row=>row.rouletteMedia),recordedSpeech=media.some(row=>row.recordedSpeech);
  const rouletteIdle=['project','presentation-package'].includes(kind)
    && [...(value?.dealers??[]),...(value?.registeredDealers??[]),...(value?.dealerTrash??[]).map(row=>row?.dealer)]
      .some(row=>object(row)&&Object.hasOwn(row,'rouletteIdle'));
  const rouletteStart=['project','presentation-package'].includes(kind)
    && [...(value?.dealers??[]),...(value?.registeredDealers??[]),...(value?.dealerTrash??[]).map(row=>row?.dealer)]
      .some(row=>object(row)&&Object.hasOwn(row,'rouletteStart'));
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
  const dealerCategoryTrash=['project','dealer-archive'].includes(kind)&&Boolean(value?.dealerTrash?.some?.(entry=>Object.hasOwn(entry,'dealerSets')));
  const generic = dealers.some(id => id !== 'nora');
  const backgroundPlayback = ['project', 'presentation-package'].includes(kind)
    && [...(Array.isArray(value?.lanes) ? value.lanes : []), ...(Array.isArray(value?.dealerTrash) ? value.dealerTrash : [])
      .flatMap(entry => Array.isArray(entry?.compositions) ? entry.compositions : [])]
      .some(lane => object(lane) && Object.hasOwn(lane, 'backgroundPlayback'));
  const compositionLanes=['project','presentation-package','dealer-archive'].includes(kind)
    ?[...(value?.lanes??[]),...(value?.dealerTrash??[]).flatMap(entry=>entry.compositions??[])]:[];
  const blackjackTableGeometry=compositionLanes.some(lane=>object(lane?.composition)&&Object.hasOwn(lane.composition,'blackjackTables'));
  // Presence matters even if validation later rejects the value: older readers
  // do not accept this optional field in either active or archived geometry.
  const blackjackBetMode=lifecycleOperation||compositionLanes.some(lane=>Array.isArray(lane?.composition?.blackjackTables)
    &&lane.composition.blackjackTables.some(table=>['mobile','desktop'].some(layout=>object(table?.[layout])&&Object.hasOwn(table[layout],'betMode'))));
  // The previous deployed validator accepts at most five variants on every row.
  const lines=['project','presentation-package','dealer-archive'].includes(kind)
    ?[...(kind==='presentation-package'?value?.playback?.lines??[]:value?.lines??[]),...(value?.dealerTrash??[]).flatMap(entry=>entry.lines??[])]:[];
  const filmedDealVariants=lines.some(line=>line?.eventId?.startsWith('deal.')&&maxVariantsForEvent(line.eventId)>5&&Array.isArray(line?.variants)&&line.variants.length>5);
  // Detect actual saved slot data, including archived rows and frozen packages.
  // Unrelated lifecycle operations retain their existing capability requirement.
  const speechSlots=lines.some(line=>Array.isArray(line?.variants)
    &&(line.eventId==='speak.other'&&line.variants.length>5||line.variants.some(variant=>typeof variant?.id==='string'&&variant.id.includes('.slot-'))));
  return { required: dealers.length > 0 || composition || rooms || frozen || lifecycle || resourceLifecycle || backgroundPlayback || dealerSets || materialTrash || mediaAlpha || rouletteMedia || tableGame || dealerCategoryTrash || rouletteIdle || rouletteStart || blackjackTableGeometry || blackjackBetMode || recordedSpeech || filmedDealVariants || presentationCompression || speechSlots,
    dealers, composition, rooms, generic, frozen, frozenEvents, lifecycle, resourceLifecycle, cascade, backgroundPlayback, roulette, dealerSets, materialTrash,mediaAlpha,rouletteMedia,tableGame,dealerCategoryTrash,rouletteIdle,rouletteStart,blackjackTableGeometry,blackjackBetMode,recordedSpeech,filmedDealVariants,presentationCompression,speechSlots };
}
function mediaFeatures(metadata) {
  const {mediaAlpha,rouletteMedia,recordedSpeech}=extendedDealerMediaFeatures(metadata);
  const dealers = extraDealer(metadata?.dealerId) ? [metadata.dealerId] : [];
  const composition = Boolean(object(metadata) && Object.hasOwn(metadata, 'compositing'));
  return { required: dealers.length > 0 || composition || mediaAlpha || rouletteMedia || recordedSpeech, dealers, composition, generic: dealers.some(id => id !== 'nora'), frozen: false,mediaAlpha,rouletteMedia,recordedSpeech };
}
function mutationFeatures(input) {
  const entries = Array.isArray(input) ? input : [input];
  const features = entries.filter(Boolean).map(value => Object.hasOwn(value, 'metadata')
    ? mediaFeatures(value.metadata) : documentFeatures(value.kind, value.value));
  return {
    required: features.some(value => value.required),
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
    filmedDealVariants:features.some(value=>value.filmedDealVariants),
    presentationCompression:features.some(value=>value.presentationCompression),
    speechSlots:features.some(value=>value.speechSlots),
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
      && (!features.filmedDealVariants || active.features.filmedDealVariants)
      && (!features.presentationCompression || active.features.presentationCompression)
      && (!features.speechSlots || active.features.speechSlots)
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
      const requiredVersion = features.speechSlots ? 20 : features.blackjackBetMode ? 19 : features.presentationCompression ? 18 : features.recordedSpeech || features.filmedDealVariants ? 17 : features.blackjackTableGeometry ? 16 : features.rouletteStart || features.rouletteIdle ? 15 : features.dealerCategoryTrash ? 14 : features.tableGame ? 13 : features.mediaAlpha || features.rouletteMedia ? 12 : features.materialTrash ? 11 : features.dealerSets ? 10 : features.roulette ? 9 : features.backgroundPlayback ? 8 : features.cascade ? 7 : features.resourceLifecycle ? 6 : features.lifecycle ? 5 : features.frozenEvents ? 4 : features.generic || features.frozen ? 3 : undefined;
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
    return mutationContext.run({ verified: features.required, features }, () => work(wrapped));
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
      const features = mediaFeatures(record?.classification);
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
    ...(typeof repository.transaction === 'function' ? {
      transaction(work, options = {}) {
        return withMutationContext(() => repository.transaction.call(repository, () => work(wrapped), options),
          options.presentationMutation);
      },
    } : {}),
  });
  return wrapped;
}
