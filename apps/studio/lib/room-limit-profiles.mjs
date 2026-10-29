import {ROOM_LIMIT_PRESETS} from '../../../packages/presentation/contracts/room-game-config.mjs';

// The three bet profiles as Admin shows them: a name and the engine's own numbers (read from
// ROOM_LIMIT_PRESETS, never copied). Same game and rules; only stakes, chips and refill differ.
// A profile is stakes only: no place name and no picture (Jakob 2026-10-29). A room's picture is its
// environment's miljöbild. Presentation only: the stored value stays the contract key, which is never shown.
const presentation = Object.freeze({
  casual: Object.freeze({label: 'Casual'}),
  prive: Object.freeze({label: 'Privé'}),
  high: Object.freeze({label: 'High'}),
});
export const roomLimitProfileNote = 'Samma spel och regler. Skillnaden är insatsnivå, marker och påfyllning av spelpengar.';

const amount = value => value.toLocaleString('sv-SE');
export const formatAmount = amount;

/** Profiles in contract order with display text; unknown contract keys are skipped rather than guessed. */
export function roomLimitProfiles() {
  return Object.entries(ROOM_LIMIT_PRESETS).filter(([id]) => Object.hasOwn(presentation, id)).map(([id, preset]) => ({
    id, label: presentation[id].label,
    min: preset.min, max: preset.max, sideMax: preset.sideMax, chips: [...preset.chips], refill: preset.refill,
    stakes: `${amount(preset.min)}–${amount(preset.max)}`,
  }));
}
