// Server-only boundary: StudioMediaRecord is validated by the existing storage
// contract. Do not import this module into presentation-layers/studio-model.
import { MAX_DEALERS, isDealerId, isActiveDealerId } from '../contracts/dealer-identity.mjs';
import { validateRegisteredIdlePolicies, registeredIdlePolicy } from '../runtime/registered-idle-policy.mjs';
import { validateFrozenDealerPlayback } from '../contracts/frozen-dealer-playback.mjs';
import { videoFitsLine } from '../contracts/video-intake.mjs';
import { ownDealerIdle } from '../runtime/registered-idle.mjs';
import {validateFrozenRegisteredDealers as validatePortableRegistry} from '../contracts/presentation-layers.mjs';
import {validateRouletteIdleBinding, validateFrozenRouletteIdle} from '../contracts/roulette-idle-contract.mjs';
import {validateRouletteStartBinding, validateFrozenRouletteStart} from '../contracts/roulette-start-contract.mjs';
import {speechSlotSituation} from '../contracts/speech-slot-bindings.mjs';
import {
  StudioStorageError, canonicalStudioJson, cloneStudioJson,
  validateDocumentValue, validateRevision, validateStudioMedia,
} from '../../studio-registry/server/document-contract.mjs';

const IDLE_EVENT = 'idle.ready';
const fail = (code = 'studio_invalid_presentation', status = 422) => { throw new StudioStorageError(code, status); };
function freeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function array(value, max = MAX_DEALERS) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max
    || Object.keys(value).length !== value.length) fail();
  for (let index = 0; index < value.length; index++) {
    if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, index) ?? {}, 'value')) fail();
  }
  return value;
}
function dealerIds(value) {
  const ids = cloneStudioJson(array(value));
  if (ids.some(id => !isDealerId(id)) || new Set(ids).size !== ids.length) fail();
  return ids;
}
function idleRecord(record, dealerId) {
  const checked = validateStudioMedia(record), metadata = checked.classification;
  if (metadata.dealerId !== dealerId || metadata.eventId !== IDLE_EVENT || metadata.kind !== 'idle'
    || (metadata.playback ?? 'once') !== 'once') fail();
  // Metadata role describes intake. The saved unconditional baseline, checked
  // during capture, is authoritative even for a record uploaded as alternative.
  return checked;
}
function rowMap(rows) {
  const result = new Map();
  for (const source of array(rows, 5000)) {
    const row = cloneStudioJson(source), { revision, updatedAt: _updatedAt, ...record } = row;
    validateRevision(revision);
    const checked = validateStudioMedia(record);
    if (result.has(checked.id)) fail('studio_media_registry_unavailable', 503);
    result.set(checked.id, { revision, record: checked });
  }
  return result;
}

/** Validate v2's entire selected dealer union, without reading mutable Studio.
 * The enclosing server-authored package supplies registration authority. */
export function validateFrozenRegisteredDealers(entries, { dealerIds: selectedIds } = {}) {
  const ids = dealerIds(selectedIds), copied = cloneStudioJson(array(entries));
  try { return freeze(validatePortableRegistry(copied, {dealerIds:ids})); }
  catch { fail(); }
}

/** Pure capture from ONE project/media snapshot. Provider availability must be
 * established outside SQL before calling; publication must recheck returned
 * mediaPreconditions inside its write transaction after any provider I/O. */
export function captureFrozenRegisteredDealers({ project, selectedLaneIds, inventory, mediaRows, requiredIdleDealerIds = [], requiredRouletteIdleDealerIds = [] } = {}) {
  const snapshot = cloneStudioJson(project);
  const saved = validateDocumentValue('project', snapshot, snapshot?.revision, { allowLegacyRead: true });
  const selected = cloneStudioJson(array(selectedLaneIds, 32));
  if (!selected.length || selected.some(id => typeof id !== 'string') || new Set(selected).size !== selected.length) fail();
  const lanes = selected.map(id => saved.lanes?.find(lane => lane.id === id));
  if (lanes.some(lane => !lane)) fail();
  const selectedDealers = [...new Set(lanes.flatMap(lane => [...lane.dealers, ...lane.layers.dealer.allowed]))];
  const extras = dealerIds(selectedDealers);
  if (extras.some(id => !isActiveDealerId(id))) fail();
  const required = dealerIds(requiredIdleDealerIds);
  const requiredRoulette = dealerIds(requiredRouletteIdleDealerIds);
  if ([...required,...requiredRoulette].some(id => !extras.includes(id))) fail();
  if (!extras.length) return freeze({ registeredDealers: [], mediaPreconditions: [] });
  if (!inventory || !Array.isArray(inventory.videos) || inventory.summary?.readable === false || inventory.summary?.snapshotReadable === false)
    fail('studio_media_registry_unavailable', 503);
  const videos = array(inventory.videos, 10000);
  if (videos.some(video => !video || typeof video.id !== 'string') || new Set(videos.map(video => video.id)).size !== videos.length)
    fail('studio_media_registry_unavailable', 503);
  const rows = rowMap(mediaRows), mediaPreconditions = [], used = new Set();
  function capture(video) {
    const captured=video&&rows.get(video.id);
    if(!captured||video.available!==true||video.integrity==='unavailable'
      ||captured.record.sha256!==video.sha256||captured.record.size!==video.bytes
      ||canonicalStudioJson(captured.record.classification)!==canonicalStudioJson(video.classification)) fail('studio_media_binding_invalid');
    const record=captured.record;
    if(!used.has(record.id)){used.add(record.id);mediaPreconditions.push({id:record.id,revision:captured.revision,record});}
    return record;
  }
  const registeredDealers = extras.map(id => {
    const dealer = saved.dealers.find(row => row.id === id);
    if (!dealer) fail();
    const video = ownDealerIdle(saved, inventory, id);
    if (!video && required.includes(id)) fail('studio_dealer_idle_required');
    const idle=video?idleRecord(capture(video),id):null;
    let rouletteIdle;
    if(Object.hasOwn(dealer,'rouletteIdle')) {
      const binding=validateRouletteIdleBinding(dealer.rouletteIdle);
      rouletteIdle=validateFrozenRouletteIdle({base:capture(videos.find(row=>row.id===binding.videoId)),
        variants:(binding.variantVideoIds??[]).map(videoId=>capture(videos.find(row=>row.id===videoId))),
        ...(binding.foregroundPolygons?{foregroundPolygons:binding.foregroundPolygons}:{})},id,validateStudioMedia);
    }
    if(requiredRoulette.includes(id)&&!rouletteIdle) fail('studio_roulette_idle_required');
    let rouletteStart;
    if(Object.hasOwn(dealer,'rouletteStart')) {
      if(!rouletteIdle)fail('studio_roulette_idle_required');
      const {videoId,...profile}=validateRouletteStartBinding(dealer.rouletteStart);
      rouletteStart=validateFrozenRouletteStart({clip:capture(videos.find(row=>row.id===videoId)),...profile},id,validateStudioMedia);
    }
    return { id, label: dealer.label, idle,...(rouletteIdle?{rouletteIdle}:{}),...(rouletteStart?{rouletteStart}:{}) };
  });
  return freeze({ registeredDealers: validateFrozenRegisteredDealers(registeredDealers, { dealerIds: selectedDealers }), mediaPreconditions });
}

/** The caller passes allowedDealerIds from the EXACT frozen lane resolved for
 * this operator/room. Neither this list nor entries may come from the browser. */
export function resolveFrozenDealerIdle(entries, { dealerId, allowedDealerIds, game = 'blackjack' } = {}) {
  const allowed = dealerIds(allowedDealerIds);
  if (!isActiveDealerId(dealerId) || !allowed.includes(dealerId)) return null;
  const copied = cloneStudioJson(array(entries));
  const ids = copied.map(entry => entry?.id);
  const checked = validateFrozenRegisteredDealers(copied, { dealerIds: ids });
  const entry=checked.find(entry => entry.id === dealerId);
  return game==='roulette'?entry?.rouletteIdle?.base??null:game==='blackjack'?entry?.idle??null:null;
}

/** Run against rows reread on the bound transaction's SQL client. A changed
 * classification is a conflict even when the uploaded bytes/hash are unchanged. */
export function assertFrozenMediaPreconditions(preconditions, currentMediaRows) {
  const expected = cloneStudioJson(array(preconditions, 5000)), seen = new Set();
  for (const entry of expected) {
    if (!entry || Object.keys(entry).sort().join(',') !== 'id,record,revision' || seen.has(entry.id)) fail();
    validateRevision(entry.revision);
    const record = validateStudioMedia(entry.record);
    if (record.id !== entry.id) fail();
    seen.add(entry.id);
  }
  if (!expected.length) return;
  let current;
  try { current = rowMap(currentMediaRows); } catch { fail('studio_conflict', 409); }
  for (const entry of expected) {
    const row = current.get(entry.id);
    if (!row || row.revision !== entry.revision || canonicalStudioJson(row.record) !== canonicalStudioJson(entry.record))
      fail('studio_conflict', 409);
  }
}

/** Capture playable bindings from the same project/media snapshot without changing drafts. */
export function captureFrozenDealerPlayback({ project, inventory, mediaRows, registeredDealers } = {}) {
  const source = cloneStudioJson(project);
  const saved = validateDocumentValue('project', source, source?.revision, { allowLegacyRead: true });
  const ids = registeredDealers.map(row => row.id), rows = rowMap(mediaRows);
  const lines = cloneStudioJson(saved.lines.filter(line => ids.includes(line.dealerId)));
  const dealerIdlePolicies = cloneStudioJson(ids.map(dealerId=>({dealerId,policy:registeredIdlePolicy(saved,dealerId)})).filter(row=>row.policy));
  try { validateRegisteredIdlePolicies(dealerIdlePolicies,{dealers:registeredDealers,lines,requireBaseline:true}); }
  catch { fail('studio_dealer_idle_policy_mismatch'); }
  const media = new Map(), preconditions = new Map(), assetIds = new Set(), triggerIds = new Set();
  function capture(mediaId, dealerId, eventId) {
    const video = inventory.videos.find(row => row.id === mediaId), captured = rows.get(mediaId);
    if (!video || !captured || video.available !== true || video.dealer !== dealerId
      || !videoFitsLine(video, dealerId, eventId) || video.integrity === 'unavailable'
      || captured.record.sha256 !== video.sha256 || captured.record.size !== video.bytes
      || canonicalStudioJson(captured.record.classification) !== canonicalStudioJson(video.classification))
      fail('studio_media_binding_invalid');
    preconditions.set(captured.record.id, { id: captured.record.id, revision: captured.revision, record: captured.record });
    // Unverified recordings cannot play, even in deliberate rehearsal. Keep the
    // exclusion bound to this exact media revision until publication commits.
    // Verified recordings awaiting review remain available for rehearsal.
    if (captured.record.classification.recordedSpeech?.recording.status === 'pending') return false;
    media.set(captured.record.id, captured.record);
    return true;
  }
  for (const line of lines) {
    const dealer = registeredDealers.find(row => row.id === line.dealerId);
    line.variants = line.variants.filter(variant => {
      if (line.eventId === IDLE_EVENT && variant.id === line.baselineVariantId && dealer.idle === null) {
        variant.videoGenerationId = null;
      } else if (variant.videoGenerationId !== null && !capture(variant.videoGenerationId,line.dealerId,line.eventId)) {
        // Reserved optional slots require a bound video; the baseline and
        // ordinary alternatives already support an explicitly empty binding.
        if (speechSlotSituation(line,variant)) return false;
        variant.videoGenerationId = null;
      }
      return true;
    });
    for (const variant of line.variants) {
      assetIds.add(variant.assetId); for (const id of variant.triggerIds) triggerIds.add(id);
    }
  }
  for (const {dealerId,policy} of dealerIdlePolicies) {
    if (!registeredDealers.find(row => row.id === dealerId)?.idle) fail('studio_dealer_idle_required');
    for (const item of [...policy.base,...policy.variants]) capture(item.videoId,dealerId,IDLE_EVENT);
  }
  const playback = validateFrozenDealerPlayback({ lines,
    triggers: saved.triggers.filter(row => triggerIds.has(row.id)), assets: saved.assets.filter(row => assetIds.has(row.id)),
    media: [...media.values()], ...(dealerIdlePolicies.length ? {dealerIdlePolicies} : {}) }, { registeredDealers, projectRevision: saved.revision });
  return freeze({ playback, mediaPreconditions: [...preconditions.values()] });
}
