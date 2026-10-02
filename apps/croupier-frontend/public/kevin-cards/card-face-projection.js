import { CARD_FACE_TRACKS } from './card-face-tracks.js';

export function firstFaceTime(seat) {
  if (seat === "hole") return 45/24;
  if (seat === "flip") return 31/24;
  return CARD_FACE_TRACKS[seat].firstFrame / 24;
}

// Match the decoded video frame exactly: interpolating against the wall clock
// moves ink between frames while the filmed fingers remain stationary.
export function faceAtTime(seat, time) {
  if (seat === "hole" || seat === "flip") return null;
  const track = CARD_FACE_TRACKS[seat];
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
