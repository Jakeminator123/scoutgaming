// Bolagets eget material in the publishers that rebuild a presentation: Admin's
// package, the saved scene layout and the idle refresh (operator-package-api.mjs),
// a new room (presentation-room-api.mjs) and the company's branding
// (partner-branding-api.mjs). Each reads the company's current material, merges
// it with packages/presentation/server/operator-material-merge.mjs and publishes
// the result; every other package writer preserves the frozen package as is.
// No material store, no rows (021 missing) or no change: the publisher keeps
// its original presentation object untouched.
import {createHash} from 'node:crypto';
import {filmedTableTemplate} from './filmed-table-template.mjs';
import {registeredFilmedProfile} from '../../../packages/presentation/contracts/filmed-profiles/registry.mjs';
import {defaultCompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {canonicalStudioJson} from '../../../packages/studio-registry/server/document-contract.mjs';
import {mergeOperatorMaterials} from '../../../packages/presentation/server/operator-material-merge.mjs';
import {encodePresentationPackage, withPackagePresentation} from '../../../packages/presentation/server/presentation-package.mjs';
import {EXTENDED_PRESENTATION_FORMAT} from '../../../packages/presentation/server/presentation-storage.mjs';

const sha256 = text => createHash('sha256').update(text).digest('hex');
function template(dealerId, lane) {
  return filmedTableTemplate(dealerId, {composition: lane?.composition ?? defaultCompositionSettings()});
}
// Where the boxes are, independent of which dealer's name is on the template.
function landing(dealerId, lane) {
  const found = template(dealerId, lane);
  if (!found) return null;
  const {dealerId: _dealer, profileId: _profile, ...geometry} = found;
  return canonicalStudioJson(geometry);
}

/** The server's binding for a table graphic drawn for one dealer in one lane, or null. */
export function operatorTableBinding(dealerId, lane) {
  const found = template(dealerId, lane);
  return found ? {dealerId, profileId: found.profileId, laneId: lane.id, templateSha256: sha256(canonicalStudioJson(found))} : null;
}

/** A table graphic fits only its own lane, dealer and current placement. */
export function operatorTableFits(material, lane) {
  const binding = material?.tableBinding;
  if (!binding || binding.laneId !== lane?.id) return {ok: false, reason: 'lane'};
  if (!lane.dealers?.includes(binding.dealerId) || registeredFilmedProfile(binding.dealerId)?.id !== binding.profileId) return {ok: false, reason: 'dealer'};
  // No template (phone and desktop disagree) or another template: the placement moved.
  const current = operatorTableBinding(binding.dealerId, lane);
  if (current?.templateSha256 !== binding.templateSha256) return {ok: false, reason: 'placement'};
  // Every dealer this lane can show must land on the same boxes.
  const drawn = landing(binding.dealerId, lane);
  if (lane.dealers.some(id => landing(id, lane) !== drawn)) return {ok: false, reason: 'dealer'};
  return {ok: true};
}

/** The company's rooms in this package, for warnings and the roulette check. */
export function publicationRooms(administration, operatorId, pack) {
  return (Array.isArray(administration?.rooms) ? administration.rooms : [])
    .filter(room => room?.operatorId === operatorId && pack?.tables?.includes(room.id))
    .map(room => ({id: room.id, name: room.name, state: room.state, presentationLaneId: room.presentationLaneId, game: room.game ?? 'blackjack'}));
}

/** Rows that decide a merge; a changed fingerprint between preparation and commit is a conflict. */
export function operatorMaterialFingerprint(rows) {
  return sha256(canonicalStudioJson((rows ?? []).map(row => [row.materialId, row.revision, row.state])));
}

// Material never pushes a package into the extended envelope (020, runtime v29):
// it is allowed only when the publication's own presentation already needs it.
export function presentationFits({branding = {}, base, allowExtended = false}) {
  let extended = false;
  try { extended = allowExtended === true && encodePresentationPackage(base, {allowExtended: true}).format === EXTENDED_PRESENTATION_FORMAT; }
  catch { /* An oversized base fails exactly as it does without material. */ }
  return candidate => {
    try { withPackagePresentation(branding, candidate, {allowExtended: extended}); return true; } catch { return false; }
  };
}

/** Merge for one publication. Unchanged results return the caller's own presentation. */
export function mergeOperatorMaterialsForPublication({presentation, rows = [], rooms = [], fits}) {
  if (!rows.length) return {presentation, warnings: [], changed: false};
  const result = mergeOperatorMaterials({presentation, materials: rows, rooms, tableFits: operatorTableFits, fits});
  return result.changed ? result : {presentation, warnings: result.warnings, changed: false};
}

/** The company's current material through an optional store; none without one. */
export async function readOperatorMaterialRows(store, operatorId) {
  if (typeof store?.listMaterials !== 'function') return [];
  return store.listMaterials(operatorId);
}
