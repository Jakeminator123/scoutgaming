// Public presentation choices. They never change game rules or grant access.
export const GAME_LANES = Object.freeze([
  Object.freeze({ id: 'original', label: 'Original Lane' }),
  Object.freeze({ id: 'mobile-phone', label: 'Mobile Phone Lane' }),
]);
export const isGameLane = value => GAME_LANES.some(lane => lane.id === value);

export function gameLaneSelection(query, activeLane = 'original') {
  if (!isGameLane(activeLane)) throw new Error('Invalid active game lane');
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(query);
  const one = key => params.getAll(key).length === 1 ? params.get(key) : null;
  const dealer = ['vera', 'astrid', 'amira', 'mei'].includes(one('dealer')) ? one('dealer') : null;
  const presentation = ['local', 'original'].includes(one('presentation')) ? one('presentation') : null;
  const explicitLane = isGameLane(one('lane')) ? one('lane') : null;
  // Existing dealer/rehearsal links retain their exact renderer. A clean
  // /blackjack entry uses the shared Studio choice instead of hardcoded Vera.
  const lane = explicitLane ?? (dealer || presentation
    ? dealer === 'astrid' && presentation === 'local' ? 'mobile-phone' : 'original'
    : activeLane);
  if (lane === 'mobile-phone') return { lane, dealer: 'astrid', presentation: 'local' };
  return { lane, dealer: dealer ?? 'vera', presentation: presentation ?? 'original' };
}
