import { mediaSituationForEvent, resolveMediaFamily, resolveMediaFamilySelection } from './media-family-resolver.mjs';
import { MEDIA_FAMILY_DEFINITIONS } from './media-families.mjs';

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
      const hasFrequency = object(variant) && Object.hasOwn(variant, 'frequencyPercent');
      if (!exact(variant, ['videoId', 'selection', 'priority', 'triggerIds', ...(hasFrequency ? ['frequencyPercent'] : [])]) || !videoId.test(variant.videoId) || ids.has(variant.videoId)
        || !exact(variant.selection, ['rules', 'model', 'random']) || Object.values(variant.selection).some(value => typeof value !== 'boolean')
        || !Number.isInteger(variant.priority) || variant.priority < -100 || variant.priority > 100
        || !Array.isArray(variant.triggerIds) || variant.triggerIds.length > 16 || new Set(variant.triggerIds).size !== variant.triggerIds.length
        || variant.triggerIds.some(id => !triggerIds.includes(id))) fail();
      if (hasFrequency && (!/^astrid\/deal\.(player\.(left|centre|right)|dealer)\//.test(row.familyId)
        || !Number.isInteger(variant.frequencyPercent) || variant.frequencyPercent < 0 || variant.frequencyPercent > 100)) fail();
      ids.add(variant.videoId);
    }
    if (row.variants.reduce((sum, variant) => sum + (variant.frequencyPercent ?? 0), 0) > 100) {
      throw new Error('Varianternas frekvenser får tillsammans vara högst 100 % för samma utdelningsplats.');
    }
  }
  return policy;
}

export const usesMediaFamilies = (inventory, dealerId) => Boolean(dealerId === 'astrid' && ['emil-default', 'environment'].includes(inventory?.summary?.archiveSource)) || (inventory?.families ?? []).some(family => family.dealerId === dealerId);

export function mediaVariantPolicy(project, family, id) {
  return project.mediaPolicy?.find(row => row.familyId === family.id)?.variants.find(row => row.videoId === id)
    ?? { videoId: id, priority: 10, triggerIds: [], selection: { ...manualMediaSelection } };
}

export const isAstridDealFamily = family => Boolean(family?.dealerId === 'astrid' && family.eventId.startsWith('deal.'));
export function dealFrequencyPolicies(project, family) {
  if (!isAstridDealFamily(family)) return null;
  const variants = project.mediaPolicy?.find(row => row.familyId === family.id)?.variants ?? [];
  return variants.some(variant => Object.hasOwn(variant, 'frequencyPercent')) ? variants : null;
}

export function upsertMediaVariantPolicy(rows = [], familyId, policy) {
  const current = rows.find(row => row.familyId === familyId) ?? { familyId, variants: [] };
  const frequency = Object.hasOwn(policy, 'frequencyPercent');
  // Opting into frequencies replaces legacy selection for this exact family.
  // Zero rows need no slot. Retain one zero marker when all variants are off,
  // so the family stays in frequency mode and newly imported files stay manual.
  const variants = current.variants.filter(row => row.videoId !== policy.videoId && (!frequency || (row.frequencyPercent ?? 0) > 0));
  if (!frequency || policy.frequencyPercent > 0 || variants.length === 0) variants.push(policy);
  const next = { ...current, variants };
  return rows.some(row => row.familyId === familyId) ? rows.map(row => row.familyId === familyId ? next : row) : [...rows, next];
}

// One draw for this exact destination. Missing/removed clips keep their share
// of the draw as standard; another alternative must not gain their frequency.
export function pickDealFrequency(policies, line, eligibleIds, random = Math.random) {
  const draw = random() * 100;
  let end = 0;
  for (const policy of policies) {
    end += policy.frequencyPercent ?? 0;
    if (draw < end) {
      return line.variants.find(variant => variant.videoGenerationId === policy.videoId && eligibleIds.includes(variant.id))?.id ?? line.baselineVariantId;
    }
  }
  return line.baselineVariantId;
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
  const frequency = dealFrequencyPolicies(project, family);
  const configured = new Set(frequency?.filter(row => (row.frequencyPercent ?? 0) > 0).map(row => row.videoId));
  // Any four folder variants may be configured, including files imported later.
  // Do not let the first four filenames displace a configured fifth file.
  const candidates = frequency ? [...media.variants].sort((a, b) => Number(configured.has(b.id)) - Number(configured.has(a.id))) : media.variants;
  const variants = family?.playbackType === 'idle-pool' ? [] : candidates.slice(0, 4).map(video => {
    const policy = mediaVariantPolicy(project, family, video.id);
    const enabled = (policy.frequencyPercent ?? 0) > 0;
    return { id: `${dealerId}.${eventId}.file-${video.id}`, label: video.fileName, assetId: baseline.assetId,
      videoGenerationId: video.id, priority: frequency ? 10 : policy.priority, triggerIds: frequency ? [] : [...policy.triggerIds],
      selection: frequency ? { rules: enabled, model: enabled, random: enabled } : { ...policy.selection } };
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
  return MEDIA_FAMILY_DEFINITIONS.find(row => row.id === family?.id)?.variantDirectory.replace(/\/variant$/, '') ?? null;
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
    if (event.faceDown) event.card = null;
  }
  return event;
}

export { mediaSituationForEvent };
