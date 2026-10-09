import { AsyncLocalStorage } from 'node:async_hooks';
import { StudioStorageError } from '../../web/storage/studio-contract.mjs';
import { BASE_DEALER_IDS } from '../../web/dealer-identity.mjs';

export const PRESENTATION_RUNTIME_UPDATE_REQUIRED = 'studio_presentation_runtime_update_required';
export const PRESENTATION_RUNTIME_UPDATE_MESSAGE = 'Spelservern beh\u00f6ver uppdateras innan Nora eller tre lager kan sparas. Ditt utkast \u00e4r kvar.';
const baseDealers = new Set(BASE_DEALER_IDS);
const CAPABILITY_PATH = '/api/presentation/capabilities';
const JSON_LIMIT = 1024;
const fail = () => { throw new StudioStorageError(PRESENTATION_RUNTIME_UPDATE_REQUIRED, 503); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const extraDealer = value => typeof value === 'string' && !baseDealers.has(value);
function documentFeatures(kind, value) {
  const dealers = kind === 'project' && Array.isArray(value?.dealers)
    ? value.dealers.map(row => row?.id).filter(extraDealer)
    : kind === 'administration' && Array.isArray(value?.gameLanes)
      ? value.gameLanes.map(row => row?.dealer).filter(id => id === 'nora') : [];
  const composition = Boolean(kind === 'project' && Array.isArray(value?.lanes)
    && value.lanes.some(lane => object(lane) && Object.hasOwn(lane, 'composition')));
  const rooms = Boolean(kind === 'administration' && value?.rooms?.some?.(room => room?.schemaVersion === 2));
  return { required: dealers.length > 0 || composition || rooms, dealers, composition, rooms };
}
function mediaFeatures(metadata) {
  const dealers = extraDealer(metadata?.dealerId) ? [metadata.dealerId] : [];
  const composition = Boolean(object(metadata) && Object.hasOwn(metadata, 'compositing'));
  return { required: dealers.length > 0 || composition, dealers, composition };
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
async function boundedCapabilities(response) {
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
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const expectedKeys = value?.schemaVersion === 2 ? 'compositing,registeredDealerIds,rooms,schemaVersion' : 'compositing,registeredDealerIds,schemaVersion';
    if (!object(value) || Object.keys(value).sort().join(',') !== expectedKeys
      || ![1, 2].includes(value.schemaVersion) || value.schemaVersion === 2 && value.rooms !== 'operator-owned-v2' || value.compositing !== 'per-clip'
      || !Array.isArray(value.registeredDealerIds) || value.registeredDealerIds.length !== 1
      || value.registeredDealerIds[0] !== 'nora') fail();
    return value;
  } finally { reader.releaseLock(); }
}
/** Native-only gate: all HTTP preflight finishes before either SQL transaction. */
export function wrapNativePresentationRepository(repository, { env = process.env, fetchImpl = fetch } = {}) {
  const origin = trustedOrigin(env), mutationContext = new AsyncLocalStorage();
  function covered(features, active) {
    return !features.required || Boolean(active?.verified
      && (!features.composition || active.features.composition)
      && (!features.rooms || active.features.rooms)
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
      response = await fetchImpl(endpoint, {
        method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store',
        headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(3000),
      });
      if (response.url && response.url !== endpoint) fail();
      const capabilities = await boundedCapabilities(response);
      if (features.dealers.some(id => !capabilities.registeredDealerIds.includes(id))
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
