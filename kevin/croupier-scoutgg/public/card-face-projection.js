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
  if (seat === "flip" || (seat === "hole" && !(isAlternative && dealer.faceTracks?.hole))) return null;
  const track = (isAlternative ? dealer.faceTracks : CARD_FACE_TRACKS)?.[seat];
  if (!track) return null;
  const index = Math.floor(time * 24 + 1e-5) - track.firstFrame;
  return index < 0 ? null : track.frames[Math.min(index, track.frames.length - 1)];
}

// Two affine triangles map the printed artwork into the measured white face.
// An outer visible-paper clip preserves the source fingers in front of the ink.
export function triangleMatrices(q, width, height) {
  const [tl,tr,br,bl] = q;
  return [[tl,tr,br], [tl,br,bl]].map((_, i) => {
    const u = i ? [br[0]-bl[0],br[1]-bl[1]] : [tr[0]-tl[0],tr[1]-tl[1]];
    const v = i ? [bl[0]-tl[0],bl[1]-tl[1]] : [br[0]-tr[0],br[1]-tr[1]];
    const a=u[0]/width,b=u[1]/width,c=v[0]/height,d=v[1]/height;
    return [a,b,c,d,tl[0]+a*width/2+c*height/2,tl[1]+b*width/2+d*height/2];
  });
}
