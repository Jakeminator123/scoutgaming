import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePresentationPackage } from '../../../packages/presentation/contracts/presentation-layers.mjs';
import { defaultCompositionSettings } from '../../../packages/presentation/contracts/composition-settings.mjs';
import { canonicalStudioJson } from '../../../packages/studio-registry/server/document-contract.mjs';
import { mergeOperatorMaterials, withoutOperatorMaterials, MAX_LANE_LAYER_CHOICES } from '../../../packages/presentation/server/operator-material-merge.mjs';
import { withPackagePresentation, readPackagePresentation, PRESENTATION_PACKAGE_KEY } from '../../../packages/presentation/server/presentation-package.mjs';
import { operatorTableBinding, operatorTableFits, mergeOperatorMaterialsForPublication, brandingPackageWithMaterials, presentationFits,
  operatorMaterialFingerprint } from '../lib/operator-material-publication.mjs';

// Bolagets eget material at publication, as pure data: which lanes receive a
// company's approved backgrounds and table graphics, and what is refused.
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const asset = (n, role = 'background') => ({ schemaVersion: 1, id: uuid(n), role, label: `Material ${n}`, sha256: String(n % 10).repeat(64),
  size: 4096, contentType: 'image/png', width: 1920, height: 1080,
  pathname: `croupier/media/${role === 'background' ? 'backgrounds' : 'tables'}/${uuid(n)}/${String(n % 10).repeat(64)}.png` });
const material = (n, { role = 'background', state = 'approved', laneId = 'open', at = n } = {}) => ({ materialId: uuid(n), revision: state === 'pending' ? 1 : 2,
  state, source: 'upload', role, asset: asset(n, role), occurredAtMs: at,
  tableBinding: role === 'table' ? { dealerId: 'astrid', profileId: 'profile', laneId, templateSha256: 'f'.repeat(64) } : null });
const lane = (id, patch = {}) => ({ id, label: `Mall ${id}`, renderer: 'layered', dealers: ['astrid'],
  layers: { background: { enabled: true, mode: 'image', default: null, allowed: [] }, table: { enabled: true, default: null, allowed: [] },
    dealer: { enabled: true, default: 'astrid', allowed: ['astrid'] } },
  openclaw: { idle: 'active', deal: 'active', reveal: 'active', speak: 'active', probe: 'off' },
  operatorAdjustable: ['background', 'table', 'branding'], composition: defaultCompositionSettings(), ...patch });
function presentation() {
  const open = lane('open'), locked = lane('locked', { operatorAdjustable: ['branding'] }), baked = lane('baked'), flat = lane('flat');
  baked.layers.background.mode = 'baked'; delete flat.composition;
  open.layers.background = { ...open.layers.background, default: uuid(900), allowed: [uuid(900)] };
  return validatePresentationPackage({ schemaVersion: 1, projectRevision: 'project-1', lanes: [open, locked, baked, flat], assets: [asset(900)] });
}
const rooms = [{ id: 'room-a', name: 'Rum A', state: 'live', presentationLaneId: 'open', game: 'blackjack' },
  { id: 'room-b', name: 'Rum B', state: 'paused', presentationLaneId: 'locked', game: 'blackjack' }];
const fits = () => ({ ok: true });
const allowed = (value, laneId, role = 'background') => value.lanes.find(row => row.id === laneId).layers[role].allowed;

test('an approved background joins only lanes that unlock an image background, after Admin\'s own material', () => {
  const rows = [material(1), material(2, { state: 'pending' }), material(3, { state: 'rejected' }), material(4, { state: 'revoked' })];
  const { presentation: merged, warnings, changed } = mergeOperatorMaterials({ presentation: presentation(), materials: rows, rooms, tableFits: fits });
  assert.equal(changed, true); assert.deepEqual(warnings, []);
  assert.deepEqual(merged.assets.map(row => row.id), [uuid(900), uuid(1)], 'only approved material, after Admin\'s assets');
  assert.deepEqual(allowed(merged, 'open'), [uuid(900), uuid(1)]);
  for (const id of ['locked', 'baked', 'flat']) assert.deepEqual(allowed(merged, id), [], `${id} keeps Admin's lock`);
  assert.equal(merged.lanes.find(row => row.id === 'open').layers.background.default, uuid(900), 'the default stays Admin\'s');
  const onlyLocked = presentation(); onlyLocked.lanes = onlyLocked.lanes.filter(row => row.id !== 'open'); onlyLocked.assets = [];
  const none = mergeOperatorMaterials({ presentation: onlyLocked, materials: [material(1)], rooms, tableFits: fits });
  assert.equal(none.changed, false);
  assert.deepEqual(none.warnings.map(row => [row.materialId, row.code]), [[uuid(1), 'operator_material_locked']]);
});

test('merging is idempotent; revoked material leaves and Admin\'s own references are never stripped', () => {
  const rows = [material(1), material(2, { at: 5 })];
  const once = mergeOperatorMaterials({ presentation: presentation(), materials: rows, rooms, tableFits: fits }).presentation;
  const twice = mergeOperatorMaterials({ presentation: once, materials: rows, rooms, tableFits: fits });
  assert.equal(twice.changed, false); assert.equal(canonicalStudioJson(twice.presentation), canonicalStudioJson(once));
  const revoked = mergeOperatorMaterials({ presentation: once, materials: [material(1, { state: 'revoked' }), rows[1]], rooms, tableFits: fits });
  assert.deepEqual(revoked.presentation.assets.map(row => row.id), [uuid(900), uuid(2)]);
  assert.deepEqual(allowed(revoked.presentation, 'open'), [uuid(900), uuid(2)]);
  assert.equal(canonicalStudioJson(withoutOperatorMaterials(once, rows)), canonicalStudioJson(presentation()));
  // The same id as Admin's own default is Admin's asset: kept, never duplicated.
  const collision = { ...material(900), asset: asset(900) };
  const kept = mergeOperatorMaterials({ presentation: presentation(), materials: [collision], rooms, tableFits: fits });
  assert.equal(kept.changed, false); assert.deepEqual(kept.warnings.map(row => row.code), ['operator_material_conflict']);
  assert.equal(canonicalStudioJson(withoutOperatorMaterials(presentation(), [collision])), canonicalStudioJson(presentation()));
});

test('a table graphic joins only its bound lane when the landing check passes; misfits warn with the affected rooms', () => {
  const table = material(7, { role: 'table' });
  const good = mergeOperatorMaterials({ presentation: presentation(), materials: [table], rooms, tableFits: fits }).presentation;
  assert.deepEqual(allowed(good, 'open', 'table'), [uuid(7)]);
  for (const id of ['locked', 'baked', 'flat']) assert.deepEqual(allowed(good, id, 'table'), []);
  const misfit = mergeOperatorMaterials({ presentation: presentation(), materials: [table], rooms, tableFits: () => ({ ok: false, reason: 'placement' }) });
  assert.equal(misfit.changed, false);
  assert.deepEqual(misfit.warnings, [{ materialId: uuid(7), role: 'table', code: 'operator_material_table_mismatch', laneIds: ['open'],
    rooms: [{ id: 'room-a', name: 'Rum A', state: 'live' }], reason: 'placement' }]);
  const stale = mergeOperatorMaterials({ presentation: good, materials: [table], rooms, tableFits: () => ({ ok: false, reason: 'dealer' }) });
  assert.deepEqual(allowed(stale.presentation, 'open', 'table'), [], 'a binding that no longer fits leaves the next package');
  const roulette = mergeOperatorMaterials({ presentation: presentation(), materials: [table], rooms: [{ ...rooms[0], game: 'roulette' }], tableFits: fits });
  assert.deepEqual(roulette.warnings.map(row => row.code), ['operator_material_game_mismatch']);
  const missing = mergeOperatorMaterials({ presentation: presentation(), materials: [material(8, { role: 'table', laneId: 'gone' })], rooms, tableFits: fits });
  assert.deepEqual(missing.warnings.map(row => [row.code, row.reason]), [['operator_material_table_mismatch', 'lane']]);
  const locked = mergeOperatorMaterials({ presentation: presentation(), materials: [material(9, { role: 'table', laneId: 'locked' })], rooms, tableFits: fits });
  assert.deepEqual(locked.warnings.map(row => [row.code, row.rooms.map(room => room.id)]), [['operator_material_locked', ['room-b']]]);
});

test('the package limits hold: 32 choices per lane, 128 files and the branding size predicate', () => {
  const full = presentation(), open = full.lanes.find(row => row.id === 'open');
  for (let n = 100; open.layers.background.allowed.length < MAX_LANE_LAYER_CHOICES; n++) { full.assets.push(asset(n)); open.layers.background.allowed.push(uuid(n)); }
  const crowded = mergeOperatorMaterials({ presentation: full, materials: [material(1)], rooms, tableFits: fits });
  assert.equal(crowded.changed, false); assert.deepEqual(crowded.warnings.map(row => row.code), ['operator_material_package_full']);
  // 1 + 96 table + 31 background files: the 128-file package is full.
  const many = presentation(), others = many.lanes.filter(row => row.id !== 'open');
  for (let n = 200; n < 296; n++) { many.assets.push(asset(n, 'table')); others[Math.floor((n - 200) / 32)].layers.table.allowed.push(uuid(n)); }
  for (let n = 300; n < 331; n++) { many.assets.push(asset(n)); others[0].layers.background.allowed.push(uuid(n)); }
  assert.equal(many.assets.length, 128);
  const capped = mergeOperatorMaterials({ presentation: validatePresentationPackage(many), materials: [material(1)], rooms, tableFits: fits });
  assert.equal(capped.changed, false); assert.deepEqual(capped.warnings.map(row => row.code), ['operator_material_package_full']);
  const rows = [material(1), material(2), material(3)];
  let budget = 2;
  const sized = mergeOperatorMaterials({ presentation: presentation(), materials: rows, rooms, tableFits: fits,
    fits: candidate => candidate.assets.length <= 1 + budget });
  assert.deepEqual(sized.presentation.assets.map(row => row.id), [uuid(900), uuid(1), uuid(2)], 'the newest addition leaves first');
  assert.deepEqual(sized.warnings.map(row => [row.materialId, row.code]), [[uuid(3), 'operator_material_package_full']]);
  budget = 0;
  assert.equal(mergeOperatorMaterials({ presentation: presentation(), materials: rows, rooms, tableFits: fits, fits: candidate => candidate.assets.length <= 1 + budget }).changed, false);
});
test('the server binds a table graphic to the filmed landing template of its lane, dealer and placement', () => {
  const paow = { id: 'paow-lane', dealers: ['paow'], composition: defaultCompositionSettings() };
  const binding = operatorTableBinding('paow', paow);
  assert.deepEqual(Object.keys(binding).sort(), ['dealerId', 'laneId', 'profileId', 'templateSha256']);
  assert.equal(binding.profileId, 'kevin-paow-c7138759'); assert.match(binding.templateSha256, /^[a-f0-9]{64}$/);
  assert.equal(operatorTableBinding('astrid', paow), null, 'no filmed profile, no table graphic');
  const row = { tableBinding: binding };
  assert.deepEqual(operatorTableFits(row, paow), { ok: true });
  const gameUi = structuredClone(paow); gameUi.composition.tableFront = true;
  assert.deepEqual(operatorTableFits(row, gameUi), { ok: true }, 'only dealer and table placement matter');
  const moved = structuredClone(paow); moved.composition.desktop.table.x = .05; moved.composition.mobile.table.x = .05;
  assert.deepEqual(operatorTableFits(row, moved), { ok: false, reason: 'placement' }, 'phone and desktop no longer share one template');
  assert.deepEqual(operatorTableFits({ tableBinding: { ...binding, templateSha256: '0'.repeat(64) } }, paow), { ok: false, reason: 'placement' });
  assert.deepEqual(operatorTableFits(row, { ...paow, id: 'other-lane' }), { ok: false, reason: 'lane' });
  assert.deepEqual(operatorTableFits(row, { ...paow, dealers: ['dragan'] }), { ok: false, reason: 'dealer' });
  // Kevin's PAOW and Dragan land on the same boxes; a dealer without landings does not.
  assert.deepEqual(operatorTableFits(row, { ...paow, dealers: ['paow', 'dragan'] }), { ok: true });
  assert.deepEqual(operatorTableFits(row, { ...paow, dealers: ['paow', 'astrid'] }), { ok: false, reason: 'dealer' }, 'every dealer must land on the same boxes');
  assert.deepEqual(operatorTableFits({ tableBinding: { ...binding, profileId: 'kevin-paow-older' } }, paow), { ok: false, reason: 'dealer' });
});

test('without rows the publisher keeps its own presentation object and branding package byte for byte', async () => {
  const base = presentation();
  assert.equal(mergeOperatorMaterialsForPublication({ presentation: base, rows: [], rooms, fits: () => true }).presentation, base);
  const pack = { operatorId: 'north', revision: 4, lanes: base.lanes.map(row => row.id), tables: ['room-a'], branding: withPackagePresentation({ name: 'North' }, base) };
  for (const store of [undefined, { listMaterials: async () => [] }]) {
    assert.equal((await brandingPackageWithMaterials({ store, pack, presentation: readPackagePresentation(pack), administration: { rooms: [] } })).pack, pack);
  }
  const merged = await brandingPackageWithMaterials({ store: { listMaterials: async () => [material(1)] }, pack, presentation: readPackagePresentation(pack), administration: { rooms: [] } });
  assert.notEqual(merged.pack.branding[PRESENTATION_PACKAGE_KEY], pack.branding[PRESENTATION_PACKAGE_KEY]);
  assert.deepEqual(allowed(readPackagePresentation(merged.pack), 'open'), [uuid(900), uuid(1)]);
  assert.equal(merged.pack.branding.name, 'North', 'every other branding field is kept');
  assert.equal(presentationFits({ branding: {}, base })(base), true);
  assert.notEqual(operatorMaterialFingerprint([material(1)]), operatorMaterialFingerprint([material(1, { state: 'revoked' })]));
  assert.equal(operatorMaterialFingerprint([]), operatorMaterialFingerprint(undefined));
});
