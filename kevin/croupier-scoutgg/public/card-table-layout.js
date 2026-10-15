// Presentation calibration for Emil's 1080 x 1920, 24 fps deal clips.
// Contact = the incoming card first touches the existing card's footprint,
// BEFORE the wrist turn. Clear = fingers off the released face-up prop.
// Zero-based source-video frames, not wall-clock delays or clip percentages.
import { dealer, isAlternative } from './dealers.js';
export const DEAL_FPS = 24;
const frames = (contactFrame, clearFrame) => Object.freeze({
  contactFrame, clearFrame, contact: contactFrame / DEAL_FPS, clear: clearFrame / DEAL_FPS,
});
const EMIL_CONTACT = Object.freeze({
  '1': frames(39, 68),
  '2': frames(38, 63),
  '3': frames(34, 64),
  '4': frames(31, 64),
  '5': frames(27, 60),
  '6': frames(26, 60),
  '7': frames(31, 67),
  dealer: frames(26, 51),
  hole: frames(28, 45),
  flip: frames(31, 33),
});
// The alternative dealer's card touches down where its track first comes within 6 px of where it rests (it may still
// creep a few px after that); without a track, two frames before it rests.
const centre = q => [(q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4];
function touchFrame(seat, land) {
  const track = dealer.faceTracks?.[seat];
  if (!track) return Math.max(0, land - 2);
  const [x, y] = centre(track.frames.at(-1).q);
  const i = track.frames.findIndex(f => { const [a, b] = centre(f.q); return Math.hypot(a - x, b - y) < 6; });
  return Math.min(land, track.firstFrame + Math.max(0, i));
}
export const DEAL_CONTACT = isAlternative
  ? Object.freeze(Object.fromEntries(Object.entries(dealer.land).map(([k, f]) => [k, frames(touchFrame(k, f), f)])))
  : EMIL_CONTACT;

// The manifest dimensions are ALREADY projected pixels measured in the video.
// Foreshortening them again made the game cards 37.5% shorter than the props.
export const FELT_DEPTH = 1;

export const SLIDE_SECONDS = .38;
// Contact gives the stack an immediate push; friction eases it to a stop.
const slideEase = t => { const p = Math.max(0, Math.min(1, t)); return 1 - (1 - p) ** 3; };

export function fanOffset(index, count) {
  const older = count - 1 - index;
  const steps = Math.max(1, count - 1);
  // A compact diagonal fan keeps the incoming card at the filmed landing.
  // Bound the entire hand, not the card size: adjacent seats are 143 px apart.
  return { x: -older * Math.min(30, 60 / steps),
    y: -older * Math.min(26, 110 / steps) };
}

// Keyed ready dealers lay their cards out with table-layout.js (Emil 16 Oct: diagonal A + split D, the table's width
// shared by need): game-cards.js uses it for them instead of the fans below, which stay for Astrid's filmed table.
export const FIXED_LAYOUT = isAlternative && !!dealer.ready;

export function dealerFanOffset(index, count) {
  const older = count - 1 - index;
  if (count === 2) return { x: -older * 66, y: 0 };
  const steps = Math.max(1, count - 1);
  // Her hands occupy the felt above the landing point. Keep the entire stack
  // on its landing row, spreading left instead of climbing into the footage.
  // The newest card stays at the filmed contact; long hands stay on the felt.
  return { x: -older * Math.min(30, 180 / steps), y: 0 };
}

// Split hands share a seat, not a single visible stack. The receiving hand
// keeps the filmed landing; the others stay in narrow lanes inside that seat.
export function splitHandAnchor(anchor, slot) {
  return { cx: anchor.cx - (slot % 2 ? 71 : 0), cy: anchor.cy - Math.floor(slot / 2) * 110 };
}
function splitFanOffset(index, count, splitCount) {
  const older = count - 1 - index, steps = Math.max(1, count - 1);
  // Three/four hands use a second row. Compact the overlap, never the card.
  return { x: 0, y: -older * Math.min(24, (splitCount > 2 ? 12 : 72) / steps) };
}

// Reserve the landing position as the new card makes contact. The old nodes
// move once; revealing the new card does not restart or double their movement.
// How far the incoming card has travelled along its filmed track, 0 at its first face frame and 1 at rest. Its lean into
// its own place follows this, not the clock (Kevin 11 Oct: "then it goes up"): when her card stands still, so does the face.
const travel = new Map();
export function trackLean(track, time) {
  const t = dealer.faceTracks?.[track];
  if (!t) return 1;
  if (!travel.has(track)) {
    let s = 0; const sums = [0];
    for (let i = 1; i < t.frames.length; i++) {
      const a = t.frames[i - 1].q, b = t.frames[i].q;
      const d = Math.hypot((b[0][0] + b[2][0] - a[0][0] - a[2][0]) / 2, (b[0][1] + b[2][1] - a[0][1] - a[2][1]) / 2);
      sums.push(s += Math.max(0, d - .8));   // the track's sub-pixel jitter on a card at rest is no travel
    }
    travel.set(track, sums);
  }
  const sums = travel.get(track), i = Math.floor(time * DEAL_FPS + 1e-5) - t.firstFrame, total = sums.at(-1);
  return i < 0 ? 0 : total < 1 ? 1 : sums[Math.min(i, sums.length - 1)] / total;
}

export function cardPose({ index, count, anchor, width = 63, incomingIndex = -1, time = 0, contact = 0, splitCount = 1, seat }) {
  const offset = (i,n) => seat === 'dealer' ? dealerFanOffset(i,n)
    : splitCount > 1 ? splitFanOffset(i,n,splitCount) : fanOffset(i,n,width);
  const to = offset(index, count);
  const oldCount = incomingIndex < 0 ? count : count - 1;
  const from = incomingIndex < 0 || index === incomingIndex ? to : offset(index, oldCount);
  const p = incomingIndex < 0 ? 1 : slideEase((time - contact) / SLIDE_SECONDS);
  return { x: anchor.cx + from.x + (to.x - from.x) * p,
    y: anchor.cy + from.y + (to.y - from.y) * p };
}

export function feltMatrix() {
  return [1, 0, 0, FELT_DEPTH, 0, 0];
}
