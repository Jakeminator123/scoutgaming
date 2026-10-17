export const REPLY_CATEGORIES = Object.freeze([
  { id: 'player-kind', label: 'Vänlig spelare' },
  { id: 'player-rude', label: 'Otrevlig spelare' },
  { id: 'player-complaining', label: 'Klagomål' },
  { id: 'player-question', label: 'Frågor' },
  { id: 'player-help', label: 'Hjälp' },
  { id: 'player-greeting', label: 'Hälsningar' },
  { id: 'player-thanks', label: 'Tack' },
  { id: 'game-win', label: 'Vinst' },
  { id: 'game-loss', label: 'Förlust' },
  { id: 'game-general', label: 'Allmänt om spelet' },
].map(Object.freeze));
const ids = new Set(REPLY_CATEGORIES.map(category => category.id));
export function validateReplyCategories(value) {
  if (!Array.isArray(value) || value.length > ids.size || value.some(id => !ids.has(id)) || new Set(value).size !== value.length) {
    throw Object.assign(new Error('reply_library_invalid_categories'), { code: 'reply_library_invalid_categories', status: 400, statusCode: 400 });
  }
  return [...value].sort();
}
