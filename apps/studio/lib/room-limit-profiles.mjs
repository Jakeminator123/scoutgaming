import {ROOM_LIMIT_PRESETS} from '../../../packages/presentation/contracts/room-game-config.mjs';

// The three bet profiles as Admin shows them: a name, the lobby's room illustration and the engine's own
// numbers (read from ROOM_LIMIT_PRESETS, never copied). Same game and rules; only stakes, chips and refill differ.
// Presentation only: the stored value stays the contract key, which is never shown.
const lobbyImage = file => `/admin/_assets/lobby/images/lobby/${file}`;
const presentation = Object.freeze({
  casual: Object.freeze({label: 'Casual', place: 'Studion', image: lobbyImage('room-studion.png'), alt: 'Nordisk studio med limegrön ljuslinje'}),
  prive: Object.freeze({label: 'Privé', place: 'Salongen', image: lobbyImage('room-salongen.png'), alt: 'Klassiskt blackjackrum i valnöt och mässing'}),
  high: Object.freeze({label: 'High', place: 'Loungen', image: lobbyImage('room-loungen.png'), alt: 'Neonlounge med blackjackbord'}),
});
export const roomLimitProfileNote = 'Samma spel och regler. Skillnaden är insatsnivå, marker och påfyllning av spelpengar.';

const amount = value => value.toLocaleString('sv-SE');
export const formatAmount = amount;

/** Profiles in contract order with display text; unknown contract keys are skipped rather than guessed. */
export function roomLimitProfiles() {
  return Object.entries(ROOM_LIMIT_PRESETS).filter(([id]) => Object.hasOwn(presentation, id)).map(([id, preset]) => ({
    id, ...presentation[id], min: preset.min, max: preset.max, sideMax: preset.sideMax, chips: [...preset.chips], refill: preset.refill,
    stakes: `${amount(preset.min)}–${amount(preset.max)}`,
  }));
}

/** The profile's room illustration, or undefined for anything that is not a known profile key. */
export function roomLimitProfileImage(id) {
  return typeof id === 'string' && Object.hasOwn(presentation, id) && Object.hasOwn(ROOM_LIMIT_PRESETS, id) ? presentation[id].image : undefined;
}
