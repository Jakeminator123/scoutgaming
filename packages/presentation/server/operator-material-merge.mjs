// Bolagets eget material at publication: a company's approved backgrounds and
// table graphics join its own frozen package, nobody else's. Pure: storage,
// the table landing check and the package size check are supplied by the
// publisher. Publishers that rebuild the presentation merge (Admin's package,
// scene layout, idle refresh, new room, the company's branding); all others
// preserve the frozen package as it is (resource lifecycle, material trash,
// dealer archive, room game config), so revoked material leaves only with the
// next merging publication: revoking must republish at once. Without material
// the result equals the input.
import {validatePresentationPackage, validateLayerAsset} from '../contracts/presentation-layers.mjs';
import {canonicalStudioJson} from '../../studio-registry/server/document-contract.mjs';

export const MAX_PACKAGE_ASSETS = 128;
export const MAX_LANE_LAYER_CHOICES = 32;
export const OPERATOR_MATERIAL_WARNING_CODES = Object.freeze([
  'operator_material_locked', 'operator_material_no_room', 'operator_material_table_mismatch', 'operator_material_game_mismatch',
  'operator_material_package_full', 'operator_material_conflict', 'operator_material_corrupt']);
// Only material that has been in a package can be taken out again; a waiting
// or rejected row never touches the package, whatever id or file it names.
const MERGED_STATES = new Set(['approved', 'revoked']);

const same = (a, b) => canonicalStudioJson(a) === canonicalStudioJson(b);
// Admin's lock applies: only a lane that unlocks the role, with separate layers.
// A still image background needs an image background layer.
export function laneAcceptsOperatorMaterial(lane, role) {
  if (!lane?.composition || !lane.operatorAdjustable?.includes(role)) return false;
  const layer = lane.layers[role];
  return role === 'background' ? layer.enabled && layer.mode === 'image' : layer.enabled;
}
// A material id that Admin itself references (default, playback rule, table
// geometry) is Admin's asset, never stripped or re-added as company material.
function adminReferences(lane, id) {
  const rest = {...lane, layers: {...lane.layers, background: {...lane.layers.background, allowed: []},
    table: {...lane.layers.table, allowed: []}}};
  return canonicalStudioJson(rest).includes(`"${id}"`);
}

/** The presentation without this company's merged (approved or revoked) material. */
export function withoutOperatorMaterials(presentation, materials = []) {
  const next = structuredClone(validatePresentationPackage(presentation));
  const owned = new Map(materials.filter(row => MERGED_STATES.has(row.state)).map(row => [row.materialId, row]));
  const removable = next.assets.filter(asset => owned.has(asset.id) && same(asset, owned.get(asset.id).asset)
    && !next.lanes.some(lane => adminReferences(lane, asset.id))).map(asset => asset.id);
  if (!removable.length) return next;
  next.assets = next.assets.filter(asset => !removable.includes(asset.id));
  for (const lane of next.lanes) for (const role of ['background', 'table'])
    lane.layers[role].allowed = lane.layers[role].allowed.filter(id => !removable.includes(id));
  return validatePresentationPackage(next);
}

/**
 * Add the approved material to its lanes. materials: the company's current
 * rows (latest revision of each, any state), oldest first. rooms: the
 * package's rooms ({id, name, state, presentationLaneId, game}); material only
 * goes to lanes with at least one of them, so the 32 choices are not used up.
 * tableFits(material, lane) -> {ok} | {ok:false, reason}: the landing template
 * check. fits(presentation) -> boolean: the package and branding limits.
 * Returns {presentation, warnings, changed}; warnings name the affected rooms.
 */
export function mergeOperatorMaterials({presentation, materials = [], rooms = [], tableFits, fits = () => true} = {}) {
  if (typeof tableFits !== 'function' || typeof fits !== 'function' || !Array.isArray(materials) || !Array.isArray(rooms)) {
    throw Object.assign(Error('operator_material_merge_invalid'), {statusCode: 503});
  }
  const input = validatePresentationPackage(presentation);
  const base = withoutOperatorMaterials(input, materials), warnings = [];
  const roomLanes = new Set(rooms.map(room => room.presentationLaneId));
  const roomsOn = laneIds => rooms.filter(room => laneIds.includes(room.presentationLaneId))
    .map(({id, name, state}) => ({id, name, state}));
  const warn = (row, code, laneIds, extra = {}) => warnings.push({materialId: row.materialId, role: row.asset?.role ?? null, code,
    laneIds: [...laneIds], rooms: roomsOn(laneIds), ...extra});
  // A row the store could not read is skipped, never trusted and never stripped.
  for (const row of materials.filter(item => item.state === 'corrupt')) {
    warn(row, 'operator_material_corrupt', input.lanes.filter(lane => ['background', 'table']
      .some(role => lane.layers[role].allowed.includes(row.materialId))).map(lane => lane.id));
  }
  const added = [];
  let next = structuredClone(base);
  for (const row of materials.filter(item => item.state === 'approved')) {
    const asset = validateLayerAsset(row.asset), role = asset.role;
    if (asset.id !== row.materialId) throw Object.assign(Error('operator_material_merge_invalid'), {statusCode: 503});
    if (next.assets.some(item => item.id === asset.id)) { warn(row, 'operator_material_conflict', []); continue; }
    let lanes = next.lanes.filter(lane => laneAcceptsOperatorMaterial(lane, role));
    if (role === 'table') {
      const bound = next.lanes.find(lane => lane.id === row.tableBinding?.laneId);
      if (!bound || !lanes.includes(bound)) { warn(row, bound ? 'operator_material_locked' : 'operator_material_table_mismatch', bound ? [bound.id] : [], bound ? {} : {reason: 'lane'}); continue; }
      // Untagged tables are blackjack tables; a roulette room on the lane cannot show one.
      if (rooms.some(room => room.presentationLaneId === bound.id && (room.game ?? 'blackjack') !== 'blackjack')) { warn(row, 'operator_material_game_mismatch', [bound.id]); continue; }
      const fit = tableFits(row, bound);
      if (fit?.ok !== true) { warn(row, 'operator_material_table_mismatch', [bound.id], {reason: typeof fit?.reason === 'string' ? fit.reason : 'template'}); continue; }
      lanes = [bound];
    }
    if (!lanes.length) { warn(row, 'operator_material_locked', []); continue; }
    const used = lanes.filter(lane => roomLanes.has(lane.id));
    if (!used.length) { warn(row, 'operator_material_no_room', lanes.map(lane => lane.id)); continue; }
    lanes = used;
    const full = lanes.filter(lane => lane.layers[role].allowed.length >= MAX_LANE_LAYER_CHOICES);
    lanes = lanes.filter(lane => !full.includes(lane));
    if (full.length) warn(row, 'operator_material_package_full', full.map(lane => lane.id));
    if (!lanes.length) continue;
    if (next.assets.length >= MAX_PACKAGE_ASSETS) { warn(row, 'operator_material_package_full', lanes.map(lane => lane.id)); continue; }
    next.assets.push(asset);
    for (const lane of lanes) lane.layers[role].allowed.push(asset.id);
    added.push({row, laneIds: lanes.map(lane => lane.id)});
  }
  next = validatePresentationPackage(next);
  // Size limits: drop the newest additions until the package fits again.
  while (added.length && !fits(next)) {
    const {row, laneIds} = added.pop();
    next = withoutOperatorMaterials(next, [row]);
    warn(row, 'operator_material_package_full', laneIds);
  }
  if (!added.length && same(base, input)) return {presentation: input, warnings, changed: false};
  return {presentation: next, warnings, changed: !same(next, input)};
}
