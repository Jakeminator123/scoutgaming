import {normalizeCardView} from '../card-view.mjs';
// A measured face belongs to the dealer's source plane, never directly to a
// movable table. Bind both planes for one take; resizing revokes that binding.
const point = p => p && Number.isFinite(p.cx) && Number.isFinite(p.cy);
const plane = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.scale) && p.scale > 0;
export function filmedTableBinding(profile, projection) {
  const layout = projection?.filmedLayout, source = layout?.sourcePlane;
  if (!profile || profile.version !== 1 || layout?.profileId !== profile.id
    || !['mobile', 'desktop'].includes(layout.layout) || typeof layout.tableId !== 'string' || !layout.tableId
    || !plane(source) || !plane(projection) || !point(projection.positions?.dealer)
    || !Array.isArray(projection.boxes) || projection.boxes.length === 0
    || projection.geometryWarning || !Number.isFinite(profile.plane?.fps) || profile.plane.fps <= 0) return null;
  const boxes = projection.boxes;
  if (boxes.length !== (layout.layout === 'mobile' ? 3 : 7)
    || boxes.some(box => !Number.isInteger(box) || box < 0 || box > 6 || !point(projection.positions[String(box + 1)]))
    || new Set(boxes).size !== boxes.length) return null;
  const offsets = projection.offsets ?? {};
  if (['dealer', ...boxes.map(box => String(box + 1))].some(seat => !Number.isFinite(offsets[seat] ?? 0))) return null;
  const positions = Object.fromEntries(['dealer', ...boxes.map(box => String(box + 1))]
    .map(seat => [seat, {cx: projection.positions[seat].cx + (offsets[seat] ?? 0), cy: projection.positions[seat].cy}]));
  const value = {profileId: profile.id, tableId: layout.tableId, layout: layout.layout,
    source: {x: source.x, y: source.y, scale: source.scale},
    destination: {x: projection.x, y: projection.y, scale: projection.scale}, positions, boxes: [...boxes], cardView:normalizeCardView(projection.cardView)};
  return {...value, key: JSON.stringify(value)};
}

export function filmedTransferTiming(profile, take) {
  const release = take?.releaseFrame ?? take?.clearFrame;
  if (!Number.isInteger(release) || release < 0 || release < take.firstFaceFrame || !Number.isInteger(take?.frames) || release >= take.frames - 1
    || !Number.isFinite(profile?.plane?.fps) || profile.plane.fps <= 0) return null;
  // clearFrame is Kevin's runtime landing cue, not visual approval of fingers
  // releasing the prop. Acceptance must inspect that cue in the exact film.
  return {release, end: Math.min(take.frames - 1, release + 8), fps: profile.plane.fps};
}

const polygon = (value, size) => Array.isArray(value) && (!size || value.length === size)
  && value.length >= 3 && value.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite));

// Track points are relative to the source manifest's landing centre. Translate
// them through the actual composited dealer before expressing them relative to
// the rendered card node. No table movement can drag ink away from the fingers.
export function projectFilmedFace(profile, take, face, binding, pose, time, width, height, depth=1) {
  const timing = filmedTransferTiming(profile, take);
  const origin = profile?.positions?.[['hole', 'flip'].includes(take?.target) ? 'dealer' : take?.target];
  if (!timing || !point(origin) || !binding || !Number.isFinite(time) || time < 0
    || !Number.isFinite(pose?.x) || !Number.isFinite(pose?.y) || !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0
    || !polygon(face?.q, 4) || !polygon(face?.p) || !polygon(face?.body)
    || !Array.isArray(face.paper) || face.paper.length !== 3 || !face.paper.every(Number.isFinite)) return null;
  const frame = Math.floor(time * timing.fps + 1e-5);
  if (frame >= timing.end) return null;
  const {source, destination} = binding;
  const project = ([x, y]) => [
    (source.x + (origin.cx + x) * source.scale - destination.x) / destination.scale - pose.x,
    (source.y + (origin.cy + y) * source.scale - destination.y) / destination.scale - pose.y,
  ];
  const q = face.q.map(project);
  if (frame < timing.release) return {q, p: face.p.map(project), body: face.body.map(project), paper: face.paper};
  const progress = (frame - timing.release) / (timing.end - timing.release);
  const ease = 1 - (1 - progress) ** 3;
  const target = [[-width / 2, -height * depth / 2], [width / 2, -height * depth / 2], [width / 2, height * depth / 2], [-width / 2, height * depth / 2]];
  const released = q.map((p, i) => p.map((v, axis) => v + (target[i][axis] - v) * ease));
  return {q: released, p: released, body: released, paper: face.paper};
}
