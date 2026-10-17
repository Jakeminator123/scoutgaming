import { validateRegisteredIdlePolicies } from '../runtime/registered-idle-policy.mjs';
import seed from './policies/project.seed.json' with { type: 'json' };
import { validateProject } from './studio-model.mjs';
import { validateManagedStudioMedia } from '../../studio-registry/server/managed-media-contract.mjs';

// Portable frozen selection policy. No filesystem, registry or provider reads.
const fail = () => { throw Object.assign(new Error('studio_invalid_presentation'), { code: 'studio_invalid_presentation', statusCode: 422 }); };
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
function data(value, depth = 0) {
  if (depth > 24) fail();
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') { if (value.includes('\0') || !value.isWellFormed()) fail(); return value; }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object') fail();
  const array = Array.isArray(value), keys = Object.keys(value);
  if (array ? Object.getPrototypeOf(value) !== Array.prototype : ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail();
  if (Object.getOwnPropertySymbols(value).length || Object.getOwnPropertyNames(value).length !== keys.length + (array ? 1 : 0)
    || array && (keys.length !== value.length || keys.some((key, index) => key !== String(index)))) fail();
  const next = array ? [] : {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!Object.hasOwn(descriptor ?? {}, 'value') || ['__proto__', 'constructor', 'prototype'].includes(key)) fail();
    next[key] = data(descriptor.value, depth + 1);
  }
  return next;
}
function emptyLines(dealerId) {
  return seed.events.map(event => {
    const template = seed.lines.find(line => line.eventId === event.id), baseline = template.variants.find(row => row.id === template.baselineVariantId);
    const id = dealerId + '.' + event.id + '.standard';
    return { dealerId, eventId: event.id, label: template.label, baselineVariantId: id,
      variants: [{ id, label: 'Standard', priority: 0, triggerIds: [], assetId: baseline.assetId, videoGenerationId: null }] };
  });
}
function projectFrom(playback, { registeredDealers, projectRevision }) {
  const project = structuredClone(seed);
  // Published packages keep the event set they captured. The optional shoe slot
  // is present only when the frozen lines include it; mandatory events stay required.
  const eventIds = new Set(playback.lines.map(line => line?.eventId));
  project.events = project.events.filter(event => event.id !== 'transition.shoe' || eventIds.has(event.id));
  project.revision = projectRevision;
  project.dealers = registeredDealers.map(({ id, label }) => ({ id, label }));
  project.lines = structuredClone(playback.lines);
  project.triggers = structuredClone(playback.triggers);
  project.assets = [...new Map([...project.assets, ...playback.assets].map(asset => [asset.id, structuredClone(asset)])).values()];
  if (playback.dealerIdlePolicies !== undefined) project.dealerIdlePolicies = structuredClone(playback.dealerIdlePolicies);
  return project;
}
export function validateFrozenDealerPlayback(value, { registeredDealers, projectRevision = 'frozen-playback' } = {}) {
  const checked = data(value);
  if (!checked || !['assets,lines,media,triggers','assets,dealerIdlePolicies,lines,media,triggers'].includes(Object.keys(checked).sort().join(','))
    || !Array.isArray(registeredDealers) || !registeredDealers.length
    || !Array.isArray(checked.lines) || checked.lines.length > 2048
    || !Array.isArray(checked.triggers) || checked.triggers.length > 128
    || !Array.isArray(checked.assets) || checked.assets.length > 1024
    || !Array.isArray(checked.media) || checked.media.length > 5000) fail();
  const ids = new Set(registeredDealers.map(row => row.id));
  if (checked.lines.some(line => !ids.has(line.dealerId))) fail();
  try { validateProject(projectFrom(checked, { registeredDealers, projectRevision })); } catch { fail(); }
  if (checked.dealerIdlePolicies !== undefined) {
    try { validateRegisteredIdlePolicies(checked.dealerIdlePolicies,{dealers:registeredDealers,lines:checked.lines,requireBaseline:true}); } catch { fail(); }
  }
  const refs = new Map(), triggerIds = new Set(), assetIds = new Set();
  for (const line of checked.lines) for (const variant of line.variants) {
    assetIds.add(variant.assetId); for (const id of variant.triggerIds) triggerIds.add(id);
    if (variant.videoGenerationId !== null) {
      const existing = refs.get(variant.videoGenerationId);
      if (existing && (existing.dealerId !== line.dealerId || existing.eventId !== line.eventId)) fail();
      refs.set(variant.videoGenerationId, { dealerId: line.dealerId, eventId: line.eventId });
    }
  }
  for (const {dealerId,policy} of checked.dealerIdlePolicies ?? []) for (const item of [...policy.base,...policy.variants]) {
    const existing = refs.get(item.videoId);
    if (existing && (existing.dealerId !== dealerId || existing.eventId !== 'idle.ready')) fail();
    refs.set(item.videoId,{dealerId,eventId:'idle.ready'});
  }
  if (checked.triggers.length !== triggerIds.size || checked.triggers.some(row => !triggerIds.has(row.id))
    || checked.assets.length !== assetIds.size || new Set(checked.assets.map(row => row.id)).size !== assetIds.size
    || checked.assets.some(row => !assetIds.has(row.id))) fail();
  const seen = new Map();
  checked.media = checked.media.map(row => {
    let record; try { record = validateManagedStudioMedia(row); } catch { fail(); }
    const ref = refs.get(record.id);
    if (!ref || seen.has(record.id) || record.classification.dealerId !== ref.dealerId
      || record.classification.eventId !== ref.eventId || (record.classification.playback ?? 'once') !== 'once') fail();
    seen.set(record.id, record); return record;
  });
  if (seen.size !== refs.size) fail();
  for (const dealer of registeredDealers) {
    const line = checked.lines.find(row => row.dealerId === dealer.id && row.eventId === 'idle.ready');
    const mediaId = line?.variants.find(row => row.id === line.baselineVariantId)?.videoGenerationId;
    if (dealer.idle ? mediaId !== dealer.idle.id || canonical(seen.get(mediaId)) !== canonical(dealer.idle) : mediaId !== null) fail();
  }
  return checked;
}
export function frozenPlaybackProject(playback, options) {
  return validateProject(projectFrom(validateFrozenDealerPlayback(playback, options), options));
}
function scopedPlayback(presentation, dealer) {
  const lines = presentation.playback?.lines.filter(line => line.dealerId === dealer.id) ?? emptyLines(dealer.id);
  if (!presentation.playback && dealer.idle) lines.find(line => line.eventId === 'idle.ready').variants[0].videoGenerationId = dealer.idle.id;
  const variants = lines.flatMap(line => line.variants), assets = new Set(variants.map(row => row.assetId));
  const triggers = new Set(variants.flatMap(row => row.triggerIds)), media = new Set(variants.map(row => row.videoGenerationId).filter(Boolean));
  const dealerIdlePolicies = (presentation.playback?.dealerIdlePolicies ?? []).filter(row => row.dealerId === dealer.id);
  for (const {policy} of dealerIdlePolicies) for (const item of [...policy.base,...policy.variants]) media.add(item.videoId);
  return { lines, dealerIdlePolicies, assets: (presentation.playback?.assets ?? seed.assets).filter(row => assets.has(row.id)),
    triggers: (presentation.playback?.triggers ?? []).filter(row => triggers.has(row.id)),
    media: (presentation.playback?.media ?? (dealer.idle ? [dealer.idle] : [])).filter(row => media.has(row.id)) };
}
/** Adding a room retains previous frozen dealers and rejects differing definitions
 * shared by retained and newly selected presentation lanes. */
export function mergeFrozenDealerPlayback(previous, selected, { registeredDealers, preservedDealerIds = previous.registeredDealers?.map(row => row.id) ?? [] } = {}) {
  if (!previous.playback && !selected.playback) return null;
  const output = { lines: [], assets: [], triggers: [], media: [] };
  for (const dealer of registeredDealers) {
    const oldDealer = previous.registeredDealers?.find(row => row.id === dealer.id), newDealer = selected.registeredDealers?.find(row => row.id === dealer.id);
    const old = oldDealer ? scopedPlayback(previous, oldDealer) : null, next = newDealer ? scopedPlayback(selected, newDealer) : null;
    if (old && next && preservedDealerIds.includes(dealer.id) && canonical(old) !== canonical(next))
      throw Object.assign(new Error('studio_shared_dealer_playback_conflict'), { code: 'studio_shared_dealer_playback_conflict', statusCode: 422 });
    const chosen = next ?? old; if (!chosen) fail();
    output.lines.push(...chosen.lines);
    if (chosen.dealerIdlePolicies.length) (output.dealerIdlePolicies ??= []).push(...chosen.dealerIdlePolicies);
    for (const key of ['assets', 'triggers', 'media']) for (const row of chosen[key]) {
      const existing = output[key].find(item => item.id === row.id);
      if (existing && canonical(existing) !== canonical(row)) fail();
      if (!existing) output[key].push(row);
    }
  }
  return validateFrozenDealerPlayback(output, { registeredDealers });
}
