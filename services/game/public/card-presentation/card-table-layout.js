// Presentation calibration for Emil's 1080 x 1920, 24 fps deal clips.
// Contact = the incoming card first touches the existing card's footprint,
// BEFORE the wrist turn. Clear = fingers off the released face-up prop.
// Zero-based source-video frames, not wall-clock delays or clip percentages.
export const DEAL_FPS = 24;
const frames = (contactFrame, clearFrame) => Object.freeze({
  contactFrame, clearFrame, contact: contactFrame / DEAL_FPS, clear: clearFrame / DEAL_FPS,
});
export const DEAL_CONTACT = Object.freeze({
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
export function splitHandAnchor(anchor, slot, depth=1, rowSpacing=110*depth) {
  return { cx: anchor.cx - (slot % 2 ? 71 : 0), cy: anchor.cy - Math.floor(slot / 2) * rowSpacing };
}
function splitFanOffset(index, count, splitCount) {
  const older = count - 1 - index, steps = Math.max(1, count - 1);
  // Three/four hands use a second row. Compact the overlap, never the card.
  return { x: 0, y: -older * Math.min(24, (splitCount > 2 ? 12 : 72) / steps) };
}

// Reserve the landing position as the new card makes contact. The old nodes
// move once; revealing the new card does not restart or double their movement.
export function cardPose({ index, count, anchor, width = 63, incomingIndex = -1, time = 0, contact = 0, splitCount = 1, seat, depth=1, fanSpread=1 }) {
  const offset = (i,n) => seat === 'dealer' ? dealerFanOffset(i,n)
    : splitCount > 1 ? splitFanOffset(i,n,splitCount) : fanOffset(i,n,width);
  const to = offset(index, count);
  const oldCount = incomingIndex < 0 ? count : count - 1;
  const from = incomingIndex < 0 || index === incomingIndex ? to : offset(index, oldCount);
  const p = incomingIndex < 0 ? 1 : slideEase((time - contact) / SLIDE_SECONDS);
  return { x: anchor.cx + (from.x + (to.x - from.x) * p) * fanSpread,
    y: anchor.cy + (from.y + (to.y - from.y) * p) * depth * fanSpread };
}

export function feltMatrix(depth=FELT_DEPTH) {
  return [1, 0, 0, depth, 0, 0];
}
