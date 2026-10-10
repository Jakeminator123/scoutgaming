import { CARD_FACE_TRACKS } from './card-face-tracks.js';
import { dealer, isAlternative } from './dealers.js';

// Astrid's flip: frames 25-30 the filmed card is already face-up (blank white) but still sliding and
// tilting into its resting spot. Per-corner offsets (tl, tr, br, bl) from its frame-31 rest pose,
// tracked on deal/flip.mp4 (optical flow + white-outline lock), so the face follows the filmed card's
// shape in perspective instead of only sliding.
const FLIP_CORNERS = [[[48,-11],[30,-24],[20,-35],[37,-21]],[[32,-12],[21,-12],[19,-18],[21,-15]],[[25,-9],[18,-9],[16,-11],[16,-11]],
  [[16,-6],[13,-5],[10,-5],[11,-9]],[[10,-3],[7,-1],[5,-2],[5,-6]],[[5,-1],[2,2],[2,-1],[-1,-3]]];
export function flipFace(time, width, height) {
  if (isAlternative) return null;
  const frame = Math.floor(time * 24 + 1e-5), d = FLIP_CORNERS[frame - 25];
  if (!d) return null;
  const rest = [[-width/2,-height/2],[width/2,-height/2],[width/2,height/2],[-width/2,height/2]];
  const q = rest.map(([x, y], i) => [x + d[i][0], y + d[i][1]]);
  return { frame, q, p: q, body: q, paper: [234, 241, 242] };
}

export function firstFaceTime(seat) {
  if (isAlternative) return (dealer.faceTracks?.[seat]?.firstFrame ?? dealer.land[seat] ?? 0) / 24;
  if (seat === "hole") return 45/24;
  if (seat === "flip") return 25/24;   // the filmed card is face-up and blank from frame 25 (#9)
  return CARD_FACE_TRACKS[seat].firstFrame / 24;
}

// Match the decoded video frame exactly: interpolating against the wall clock
// moves ink between frames while the filmed fingers remain stationary.
export function faceAtTime(seat, time) {
  // Emil's hole card is filmed face down; a ready dealer's stand-in hole prop is tracked so its back is painted over it.
  // Astrid's flip has its own corner offsets (flipFace); a ready dealer's turned card follows its filmed track.
  if ((seat === "flip" && !isAlternative) || (seat === "hole" && !(isAlternative && dealer.faceTracks?.hole))) return null;
  const track = (isAlternative ? dealer.faceTracks : CARD_FACE_TRACKS)?.[seat];
  if (!track) return null;
  const index = Math.floor(time * 24 + 1e-5) - track.firstFrame;
  return index < 0 ? null : track.frames[Math.min(index, track.frames.length - 1)];
}

// Corner pin: the printed artwork follows the measured face as a plane in perspective (the homography of
// its four corners), drawn as a GRID x GRID mesh of affine triangles; two triangles bent the artwork along
// the diagonal on a card held in perspective. An outer visible-paper clip preserves the fingers in front.
export const GRID = 3;
// The face's local triangles (card coordinates, centred), two per grid cell: [a,b,c] and [a,c,d].
export function faceTriangles(width, height, n = GRID) {
  const at = (i, j) => [-width / 2 + width * i / n, -height / 2 + height * j / n], out = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
    out.push([a, b, c], [a, c, d]);
  }
  return out;
}
// Unit square -> the quad tl,tr,br,bl (Heckbert's square-to-quad homography).
function squareToQuad([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) {
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = Math.abs(den) < 1e-9 ? 0 : (dx3 * dy2 - dx2 * dy3) / den, h = Math.abs(den) < 1e-9 ? 0 : (dx1 * dy3 - dx3 * dy1) / den;
  return (u, v) => {
    const w = g * u + h * v + 1;
    return [((x1 - x0 + g * x1) * u + (x3 - x0 + h * x3) * v + x0) / w, ((y1 - y0 + g * y1) * u + (y3 - y0 + h * y3) * v + y0) / w];
  };
}
// One SVG matrix per face triangle, mapping its local corners onto their place on the measured plane.
export function triangleMatrices(q, width, height, n = GRID) {
  const H = squareToQuad(q), to = ([x, y]) => H(x / width + .5, y / height + .5);
  return faceTriangles(width, height, n).map(([l0, l1, l2]) => {
    const [p0, p1, p2] = [l0, l1, l2].map(to);
    const u = [l1[0] - l0[0], l1[1] - l0[1]], v = [l2[0] - l0[0], l2[1] - l0[1]], det = u[0] * v[1] - u[1] * v[0];
    const U = [p1[0] - p0[0], p1[1] - p0[1]], V = [p2[0] - p0[0], p2[1] - p0[1]];
    const a = (U[0] * v[1] - V[0] * u[1]) / det, c = (V[0] * u[0] - U[0] * v[0]) / det;
    const b = (U[1] * v[1] - V[1] * u[1]) / det, d = (V[1] * u[0] - U[1] * v[0]) / det;
    return [a, b, c, d, p0[0] - a * l0[0] - c * l0[1], p0[1] - b * l0[0] - d * l0[1]];
  });
}
