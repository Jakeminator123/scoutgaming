// Server-only boundary: StudioMediaRecord is validated by the existing storage
// contract. Do not import this module into presentation-layers/studio-model.
import { BASE_DEALER_IDS, MAX_DEALERS, isDealerId } from '../dealer-identity.mjs';
import { ownDealerIdle } from '../../presentation-runtime/registered-idle.mjs';
import {validateFrozenRegisteredDealers as validatePortableRegistry} from '../presentation-layers.mjs';
import {
  StudioStorageError, canonicalStudioJson, cloneStudioJson,
  validateDocumentValue, validateRevision, validateStudioMedia,
} from './studio-contract.mjs';

const base = new Set(BASE_DEALER_IDS);
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
export function captureFrozenRegisteredDealers({ project, selectedLaneIds, inventory, mediaRows, requiredIdleDealerIds = [] } = {}) {
  const snapshot = cloneStudioJson(project);
  const saved = validateDocumentValue('project', snapshot, snapshot?.revision, { allowLegacyRead: true });
  const selected = cloneStudioJson(array(selectedLaneIds, 32));
  if (!selected.length || selected.some(id => typeof id !== 'string') || new Set(selected).size !== selected.length) fail();
  const lanes = selected.map(id => saved.lanes?.find(lane => lane.id === id));
  if (lanes.some(lane => !lane)) fail();
  const selectedDealers = [...new Set(lanes.flatMap(lane => [...lane.dealers, ...lane.layers.dealer.allowed]))];
  const extras = dealerIds(selectedDealers).filter(id => !base.has(id));
  const required = dealerIds(requiredIdleDealerIds);
  if (required.some(id => !extras.includes(id))) fail();
  if (!extras.length) return freeze({ registeredDealers: [], mediaPreconditions: [] });
  if (!inventory || !Array.isArray(inventory.videos) || inventory.summary?.readable === false || inventory.summary?.snapshotReadable === false)
    fail('studio_media_registry_unavailable', 503);
  const videos = array(inventory.videos, 10000);
  if (videos.some(video => !video || typeof video.id !== 'string') || new Set(videos.map(video => video.id)).size !== videos.length)
    fail('studio_media_registry_unavailable', 503);
  const rows = rowMap(mediaRows), mediaPreconditions = [], used = new Set();
  const registeredDealers = extras.map(id => {
    const dealer = saved.dealers.find(row => row.id === id);
    if (!dealer) fail();
    const video = ownDealerIdle(saved, inventory, id);
    if (!video) {
      if (required.includes(id)) fail('studio_dealer_idle_required');
      return { id, label: dealer.label, idle: null };
    }
    const captured = rows.get(video.id);
    if (!captured || captured.record.sha256 !== video.sha256 || captured.record.size !== video.bytes
      || canonicalStudioJson(captured.record.classification) !== canonicalStudioJson(video.classification)
      || video.integrity === 'unavailable') fail('studio_media_binding_invalid');
    const record = idleRecord(captured.record, id);
    if (!used.has(record.id)) { used.add(record.id); mediaPreconditions.push({ id: record.id, revision: captured.revision, record }); }
    return { id, label: dealer.label, idle: record };
  });
  return freeze({ registeredDealers: validateFrozenRegisteredDealers(registeredDealers, { dealerIds: selectedDealers }), mediaPreconditions });
}

/** The caller passes allowedDealerIds from the EXACT frozen lane resolved for
 * this operator/room. Neither this list nor entries may come from the browser. */
export function resolveFrozenDealerIdle(entries, { dealerId, allowedDealerIds } = {}) {
  const allowed = dealerIds(allowedDealerIds);
  if (!isDealerId(dealerId) || base.has(dealerId) || !allowed.includes(dealerId)) return null;
  const copied = cloneStudioJson(array(entries));
  const ids = copied.map(entry => entry?.id);
  const checked = validateFrozenRegisteredDealers(copied, { dealerIds: ids });
  return checked.find(entry => entry.id === dealerId)?.idle ?? null;
}

/** Run against rows reread on the bound transaction's SQL client. A changed
 * classification is a conflict even when the uploaded bytes/hash are unchanged. */
export function assertFrozenMediaPreconditions(preconditions, currentMediaRows) {
  const expected = cloneStudioJson(array(preconditions)), seen = new Set();
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
