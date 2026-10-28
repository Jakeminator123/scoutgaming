import {ROOM_LIMIT_PRESETS} from '../../../packages/presentation/contracts/room-game-config.mjs';

// The three bet profiles as Admin shows them: a name, the lobby's room illustration and the engine's own
// numbers (read from ROOM_LIMIT_PRESETS, never copied). Same game and rules; only stakes, chips and refill differ.
// Presentation only: the stored value stays the contract key, which is never shown.
// The illustration is a file name without a base path: each surface adds its own asset base, because the
// signed-in Admin serves the lobby's images under /admin/_assets/lobby/ and the public lobby under /lobby/_assets/lobby/.
const presentation = Object.freeze({
  casual: Object.freeze({label: 'Casual', place: 'Studion', file: 'room-studion.png', alt: 'Nordisk studio med limegrön ljuslinje'}),
  prive: Object.freeze({label: 'Privé', place: 'Salongen', file: 'room-salongen.png', alt: 'Klassiskt blackjackrum i valnöt och mässing'}),
  high: Object.freeze({label: 'High', place: 'Loungen', file: 'room-loungen.png', alt: 'Neonlounge med blackjackbord'}),
});
// Admin's own pages (profile cards, room picture) are always signed in.
const adminImage = file => `/admin/_assets/lobby/images/lobby/${file}`;
export const roomLimitProfileNote = 'Samma spel och regler. Skillnaden är insatsnivå, marker och påfyllning av spelpengar.';

const amount = value => value.toLocaleString('sv-SE');
export const formatAmount = amount;

/** Profiles in contract order with display text and Admin's image URL; unknown contract keys are skipped rather than guessed. */
export function roomLimitProfiles() {
  return Object.entries(ROOM_LIMIT_PRESETS).filter(([id]) => Object.hasOwn(presentation, id)).map(([id, preset]) => ({
    id, label: presentation[id].label, place: presentation[id].place, image: adminImage(presentation[id].file), alt: presentation[id].alt,
    min: preset.min, max: preset.max, sideMax: preset.sideMax, chips: [...preset.chips], refill: preset.refill,
    stakes: `${amount(preset.min)}–${amount(preset.max)}`,
  }));
}

/** The profile's illustration file name (no base path) and alt text, or undefined for anything that is not a known profile key. */
export function roomLimitProfileArtwork(id) {
  if (typeof id !== 'string' || !Object.hasOwn(presentation, id) || !Object.hasOwn(ROOM_LIMIT_PRESETS, id)) return undefined;
  return {file: presentation[id].file, alt: presentation[id].alt};
}

/** The profile's room illustration on Admin's pages, or undefined for anything that is not a known profile key. */
export function roomLimitProfileImage(id) {
  const artwork = roomLimitProfileArtwork(id);
  return artwork ? adminImage(artwork.file) : undefined;
}
