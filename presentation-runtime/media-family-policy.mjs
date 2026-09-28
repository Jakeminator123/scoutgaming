import { mediaSituationForEvent, resolveMediaFamily, resolveMediaFamilySelection } from './media-family-resolver.mjs';

export const manualMediaSelection = Object.freeze({ rules: false, model: false, random: false });
const familyId = /^[a-z][a-z0-9_-]*\/[a-z][a-z0-9._-]*\/[a-z][a-z0-9_-]*$/;
const videoId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

export function validateMediaPolicy(policy, triggerIds = []) {
  const fail = () => { throw new Error('Ogiltig mediepolicy: använd en exakt familj och högst fyra unika filvarianter med kända villkor.'); };
  if (!Array.isArray(policy) || policy.length > 256) fail();
  const families = new Set();
  for (const row of policy) {
    if (!exact(row, ['familyId', 'variants']) || !familyId.test(row.familyId) || families.has(row.familyId)
      || !Array.isArray(row.variants) || row.variants.length > 4) fail();
    families.add(row.familyId);
    const ids = new Set();
    for (const variant of row.variants) {
      if (!exact(variant, ['videoId', 'selection', 'priority', 'triggerIds']) || !videoId.test(variant.videoId) || ids.has(variant.videoId)
        || !exact(variant.selection, ['rules', 'model', 'random']) || Object.values(variant.selection).some(value => typeof value !== 'boolean')
        || !Number.isInteger(variant.priority) || variant.priority < -100 || variant.priority > 100
        || !Array.isArray(variant.triggerIds) || variant.triggerIds.length > 16 || new Set(variant.triggerIds).size !== variant.triggerIds.length
        || variant.triggerIds.some(id => !triggerIds.includes(id))) fail();
      ids.add(variant.videoId);
    }
  }
  return policy;
}

export const usesMediaFamilies = (inventory, dealerId) => Boolean(dealerId === 'astrid' && ['emil-default', 'environment'].includes(inventory?.summary?.archiveSource)) || (inventory?.families ?? []).some(family => family.dealerId === dealerId);

export function mediaVariantPolicy(project, family, id) {
  return project.mediaPolicy?.find(row => row.familyId === family.id)?.variants.find(row => row.videoId === id)
    ?? { videoId: id, priority: 10, triggerIds: [], selection: { ...manualMediaSelection } };
}

// A disposable view of one concrete instruction. Saved legacy lines remain
// intact, but cannot contribute demo variants to a manifest-owned dealer.
export function mediaLineForEvent(project, inventory, dealerId, eventId, event) {
  const saved = project.lines.find(line => line.dealerId === dealerId && line.eventId === eventId);
  if (!saved || !usesMediaFamilies(inventory, dealerId)) return { managed: false, family: null, line: saved };
  const family = resolveMediaFamily(inventory, { dealerId, eventId, event });
  const media = resolveMediaFamilySelection(inventory, family);
  const baseline = saved.variants.find(variant => variant.id === saved.baselineVariantId);
  // Idle timing/eligibility remains owned by the idle policy, not a second
  // rules/model selector. This path presents its configured primary base only.
  const idleBase = family?.playbackType === 'idle-pool'
    ? media.standardPool.find(video => video.id === project.idlePolicy?.base[0]?.videoId) : null;
  const standard = idleBase ?? media.standard;
  const variants = family?.playbackType === 'idle-pool' ? [] : media.variants.slice(0, 4).map(video => {
    const policy = mediaVariantPolicy(project, family, video.id);
    return { id: `${dealerId}.${eventId}.file-${video.id}`, label: video.fileName, assetId: baseline.assetId,
      videoGenerationId: video.id, priority: policy.priority, triggerIds: [...policy.triggerIds], selection: { ...policy.selection } };
  });
  return { managed: true, family, line: { ...saved, label: family?.situation ?? saved.label,
    variants: [{ ...baseline, label: standard?.fileName ?? 'Ingen video för situationen', videoGenerationId: standard?.id ?? null }, ...variants] } };
}

// The server result owns its chosen ID (including null). Never substitute the
// editor's selection for a missing result or borrow a neighbouring family.
export function mediaVideoForEvent(inventory, dealerId, eventId, event, id) {
  if (!id) return null;
  const family = resolveMediaFamily(inventory, { dealerId, eventId, event });
  if (!family || ![...family.standardIds, ...family.variantIds].includes(id)) return null;
  return inventory.videos.find(video => video.id === id && video.familyId === family.id && video.available) ?? null;
}

export function mediaFamilyFolder(family) {
  if (!family) return null;
  if (family.playbackType === 'idle-pool') return 'idle';
  if (family.eventId.startsWith('speak.')) return `repliker/${family.situation}`;
  if (/^box[0-6]$/.test(family.situation)) return `deal/deal_pos${Number(family.situation.slice(3)) + 1}`;
  return family.situation === 'dealer-up' ? 'deal/deal_posdealer' : null;
}

export function mediaSituationLabel(situation) {
  if (/^box[0-6]$/.test(situation)) return `Plats ${Number(situation.slice(3)) + 1} · ${situation}`;
  if (situation === 'dealer-up') return 'Croupierns öppna kort';
  if (situation === 'dealer-hole') return 'Croupierns dolda kort';
  return situation;
}

export function mediaExampleEvent(definition, situation) {
  const event = { ...definition.exampleEvent };
  if (!situation) return event;
  if (definition.sourceType === 'speak') event.line = situation;
  else if (definition.sourceType === 'deal' && /^box[0-6]$/.test(situation)) event.box = Number(situation.slice(3));
  else if (definition.id === 'deal.dealer' && ['dealer-up', 'dealer-hole'].includes(situation)) {
    event.faceDown = situation === 'dealer-hole';
    if (event.faceDown) delete event.card;
  }
  return event;
}

export { mediaSituationForEvent };
