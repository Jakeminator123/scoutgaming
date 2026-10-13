export function mediaSituationForEvent(eventId, event) {
  if (!event || typeof event !== 'object') return null;
  if (eventId?.startsWith('speak.') && event.type === 'speak' && typeof event.line === 'string') return event.line;
  if (eventId === 'deal.dealer' && event.type === 'deal' && event.to === 'dealer') return event.faceDown === false ? 'dealer-up' : event.faceDown === true ? 'dealer-hole' : null;
  if (eventId === 'reveal.dealer' && event.type === 'reveal' && event.to === 'dealer') return 'dealer-hole';
  if (eventId?.startsWith('deal.player.') && event.type === 'deal' && event.to === 'box' && Number.isInteger(event.box) && event.box >= 0 && event.box <= 6) return `box${event.box}`;
  if (eventId === 'idle.ready' && event.type === 'idle') return 'ready';
  if (eventId === 'transition.shoe' && (event.pose === 'to-shoe' || event.pose === 'from-shoe')) return event.pose;
  return null;
}

export function resolveMediaFamily(inventory, { dealerId, eventId, event }) {
  const situation = mediaSituationForEvent(eventId, event);
  if (!situation) return null;
  return (inventory?.families ?? []).find(family => family.dealerId === dealerId && family.eventId === eventId && family.situation === situation) ?? null;
}

/**
 * Resolve only inside one exact family. A folder variant is never automatically
 * eligible: callers must pass its reviewed ID explicitly after project policy.
 */
export function resolveMediaFamilySelection(inventory, family, requestedVariantId = null) {
  if (!family) return { family: null, selected: null, standard: null, standardPool: [], variants: [], usedStandard: false, reason: 'family_missing' };
  const items = new Map((inventory?.videos ?? []).map(item => [item.id, item]));
  const belongs = (item, role) => Boolean(item?.available && item.familyId === family.id && item.role === role);
  const standardPool = family.standardIds.map(id => items.get(id)).filter(item => belongs(item, 'standard'));
  const variants = family.variantIds.map(id => items.get(id)).filter(item => belongs(item, 'variant'));
  const standard = standardPool[0] ?? null;
  const requested = requestedVariantId == null ? null : variants.find(item => item.id === requestedVariantId) ?? null;
  if (requested) return { family, selected: requested, standard, standardPool, variants, usedStandard: false, reason: 'reviewed_variant' };
  return {
    family,
    selected: standard,
    standard,
    standardPool,
    variants,
    usedStandard: Boolean(standard),
    reason: standard ? requestedVariantId == null ? 'standard' : 'invalid_variant_standard' : 'standard_unavailable_2d',
  };
}
