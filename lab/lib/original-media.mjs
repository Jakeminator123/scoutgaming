// Local original defaults use exact source events. They never replace an explicit
// project video binding or select another sentence with a similar duration.
export const ORIGINAL_MEDIA_PREFIX = 'original:';
export function originalMediaId(dealer, kind, key) { return `${ORIGINAL_MEDIA_PREFIX}${dealer}:${kind}:${key}`; }
export function isOriginalMediaId(id) { return typeof id === 'string' && /^original:(astrid|vera|amira|mei):(idle|speech|action):[a-z0-9_-]+$/.test(id); }
export function originalEventId(event) {
  if (event?.type === 'idle') return 'idle.ready';
  if (event?.type === 'speak') return ['goodluck', 'insurance', 'double'].includes(event.line) ? `speak.${event.line}` : 'speak.other';
  if (event?.type !== 'deal') return null;
  if (event.to === 'dealer') return 'deal.dealer';
  if (event.to !== 'box' || !Number.isInteger(event.box) || event.box < 0 || event.box > 6) return null;
  return `deal.player.${event.box < 2 ? 'left' : event.box > 4 ? 'right' : 'centre'}`;
}
export function resolveOriginalDefault(catalog, dealerId, event) {
  const eventId = originalEventId(event);
  // The supplied footage registers three canonical directions, not exact
  // contact for every seat or split fan. Other destinations keep the 2D path.
  if (event?.type === 'deal' && event.to === 'box' && ![0, 3, 6].includes(event.box)) return null;
  return (catalog?.entries ?? []).find(entry => entry.dealerId === dealerId && entry.available && entry.eventId === eventId &&
    (entry.kind !== 'speech' || entry.situation === event.line)) ?? null;
}
