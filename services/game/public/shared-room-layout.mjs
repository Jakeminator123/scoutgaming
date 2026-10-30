// Pure layout rules of the shared table: which seats a phone shows, which own seat carries the full
// bet controls, where a seat sits without Admin geometry, and the name of the room's stake profile.
// Nothing here reads or writes game state; every input is the server's snapshot or the dealer's film.
import { calibration } from '../../../packages/presentation/contracts/calibration.mjs';
import { ROOM_LIMIT_PRESETS } from '../../../packages/presentation/contracts/room-game-config.mjs';
import { cardViewDepth } from '../../../packages/presentation/contracts/card-view.mjs';

export const SEAT_COUNT = 7, WINDOW_SIZE = 3;
// The seat circle ("Du" or the seat number) is 44 px tall at every scale (styles.css .seat-shared-join),
// so its place below the box's hand total is measured from its fixed half height.
export const SEAT_HALF_PX = 22;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const seat = value => Number.isInteger(value) && value >= 0 && value < SEAT_COUNT;

// A phone shows three boxes around the active hand, else the chosen seat, else the player's first seat.
export function seatWindow(snapshot, focusSeat) {
  const active = snapshot?.round?.hands?.[snapshot.round.active]?.box;
  const centre = seat(active) ? active : seat(focusSeat) ? focusSeat : snapshot?.me?.seats?.[0] ?? 3;
  const start = clamp(centre - 1, 0, SEAT_COUNT - WINDOW_SIZE);
  return { centre, start, boxes: Array.from({ length: WINDOW_SIZE }, (_, i) => start + i) };
}
export const windowLabel = start => `Visa platser ${start + 1}–${start + WINDOW_SIZE}`;

// The own seat whose Par, 21+3 and Lämna show: the chosen one, else the first one on screen, else the first.
// Other own seats keep their main bet (desktop) or their marker (phone).
export function primarySeat(snapshot, focusSeat, visible = null) {
  const own = snapshot?.me?.seats ?? [];
  if (own.includes(focusSeat)) return focusSeat;
  return own.find(box => !visible || visible.includes(box)) ?? own[0] ?? null;
}

// Own seats closer than one full bet row (Par, Insats, 21+3) to another own seat share the row space:
// each keeps its main bet within the gap, and only the primary seat adds its side bets on a line below.
export const FULL_ROW_PX = 184, MIN_TARGET_PX = 44, MAIN_BET_PX = 84;
export function crowding(points) {
  const result = new Map();
  for (const [box, x] of points) {
    let gap = Infinity;
    for (const [other, ox] of points) if (other !== box) gap = Math.min(gap, Math.abs(ox - x));
    result.set(box, { crowded: gap < FULL_ROW_PX, betWidth: Math.round(clamp(gap - 6, MIN_TARGET_PX, MAIN_BET_PX)) });
  }
  return result;
}

// Without Admin table geometry the seats stand on the landings of the room dealer's filmed profile:
// the place where the dealer's film lays each card. A dealer without a profile keeps the calibrated row.
// The seat's circle sits just below its landed card and hand total, as under-cards bets do on a table
// (game-overlay-layout.mjs betGap), so it never covers the player's own cards.
// A phone's three boxes are narrower on the film than one touch target, so they spread over the width with
// their cards, as on a composition plane without table geometry (game-overlay-layout.mjs, compact).
export function fallbackSeatLayout({ width, height, boxes, filmedProfile = null, compact = false }) {
  const positions = filmedProfile?.positions ?? calibration.positions;
  const scale = Math.min(width / 1080, height / 1920), x = (width - 1080 * scale) / 2, y = (height - 1920 * scale) / 2;
  // A phone draws its cards larger than the film's prop card, so its circle keeps a whole card height clear.
  const card = filmedProfile?.card?.height ?? calibration.height, controlScale = Math.max(.65, scale);
  const below = Math.max((calibration.height / 2 * cardViewDepth('table') + 38) * scale + SEAT_HALF_PX + 6, compact ? card * scale + 34 : 0);
  const seats = boxes.map(box => ({ box, x: x + positions[String(box + 1)].cx * scale, y: y + positions[String(box + 1)].cy * scale + below }));
  const offsets = {};
  if (compact && seats.length > 1) {
    const left = 12 + Math.max(49, 144 * scale), right = width - 12 - Math.max(49, 90 * scale);
    seats.forEach((seat, i) => { seat.x = left + (right - left) * i / (seats.length - 1); offsets[String(seat.box + 1)] = (seat.x - x) / scale - positions[String(seat.box + 1)].cx; });
  }
  return { x, y, scale, positions, offsets, cardView: 'table', followCards: true, boxes, source: filmedProfile ? 'filmed-profile' : 'calibration',
    ...(compact && seats.length > 1 ? { adjusted: true } : {}), seats,
    dealer: { x: x + positions.dealer.cx * scale, y: y + positions.dealer.cy * scale }, controlScale };
}

// The heading names the room's stake profile (Admin: Casual, Privé, High): its `limitPreset` when the snapshot
// carries one, else the preset whose limits, chips and refill the snapshot's settings match exactly.
const PROFILE_NAMES = Object.freeze({ casual: 'Casual', prive: 'Privé', high: 'High' });
export function tableProfileName(settings) {
  if (Object.hasOwn(PROFILE_NAMES, settings?.limitPreset ?? '')) return `${PROFILE_NAMES[settings.limitPreset]} Blackjack`;
  const limits = settings?.limits, chips = settings?.chips;
  const match = Object.entries(ROOM_LIMIT_PRESETS).find(([, preset]) => limits && Array.isArray(chips)
    && preset.min === limits.min && preset.max === limits.max && preset.sideMax === limits.sideMax && preset.refill === settings.refill
    && preset.chips.length === chips.length && preset.chips.every((chip, i) => chip === chips[i]));
  return match ? `${PROFILE_NAMES[match[0]]} Blackjack` : 'Blackjack';
}
