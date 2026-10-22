// Catalogue links carry selectors only. Keep ambiguous values so the lobby can
// reject them; an alias must never silently pick a different company or room.
/** @param {string | URLSearchParams | Record<string, string | string[] | undefined>} input */
export function playerLobbyPath(input = '', hash = '') {
  const source = input instanceof URLSearchParams ? input : typeof input === 'string'
    ? new URLSearchParams(input) : new URLSearchParams(Object.entries(input).flatMap(([key, value]) =>
      (Array.isArray(value) ? value : typeof value === 'string' ? [value] : []).map(item => [key, item])));
  const query = new URLSearchParams();
  for (const key of ['operator', 'room', 'table', 'dealer', 'tableAsset', 'background'])
    for (const value of source.getAll(key)) query.append(key === 'table' && !source.has('room') ? 'room' : key, value);
  return '/lobby' + (query.size ? '?' + query : '') + hash;
}
