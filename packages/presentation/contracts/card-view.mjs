// A local viewing preference, never a game rule or a media calibration.
export const CARD_VIEW_KEY = 'scoutgaming.blackjack.card-view';
export const normalizeCardView = value => value === 'table' ? 'table' : 'raised';
export const cardViewDepth = value => normalizeCardView(value) === 'table' ? .62 : 1;
export function readCardView(storage) {
  try { return normalizeCardView(storage?.getItem(CARD_VIEW_KEY)); } catch { return 'raised'; }
}
export function saveCardView(storage, value) {
  const mode=normalizeCardView(value);
  try { storage?.setItem(CARD_VIEW_KEY, mode); } catch {}
  return mode;
}
