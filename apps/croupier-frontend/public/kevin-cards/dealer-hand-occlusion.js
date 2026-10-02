import { DEALER_HAND_TRACKS } from './dealer-hand-tracks.js';

const FULL_TABLE = 'M0 0H1080V1920H0Z';
// Precompute once, not for each draw or animation callback. The holes in this
// even-odd path expose the source-video fingers in front of every game card.
const paths = Object.fromEntries(Object.entries(DEALER_HAND_TRACKS).map(([seat, frames]) => [seat,
  frames.map(polygons => FULL_TABLE + polygons.map(p => `M${p.map(v=>v.join(' ')).join('L')}Z`).join('')),
]));

export function dealerHandClip(seat, time) {
  const frames = paths[seat];
  if (!frames || !Number.isFinite(time) || time < 0) return FULL_TABLE;
  return frames[Math.min(Math.floor(time * 24 + 1e-5), frames.length - 1)];
}
