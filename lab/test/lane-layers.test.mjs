import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedProject, defaultPresentationLane, validateProject } from '../../packages/presentation/contracts/studio-model.mjs';
import { PROBE_MODELS } from '../../packages/presentation/contracts/probe-policy.mjs';

const color = index => `#${index.toString(16).padStart(6, '0')}`;

function withLane() {
  const project = createSeedProject();
  project.lanes = [defaultPresentationLane('astrid')];
  return project;
}

test('seed and the default lane stay valid without zones, colors, probe or idle', () => {
  const lane = defaultPresentationLane('astrid');
  assert.equal(Object.hasOwn(lane, 'probe'), false);
  assert.equal(Object.hasOwn(lane, 'idle'), false);
  assert.equal(Object.hasOwn(lane.layers.background, 'zones'), false);
  assert.equal(Object.hasOwn(lane.layers.table, 'colors'), false);
  assert.equal(lane.openclaw.probe, 'off');
  const seeded = withLane();
  assert.equal(seeded.schemaVersion, 1);
  assert.deepEqual(seeded.lanes, [lane]);
  assert.equal(validateProject(seeded), seeded);
  const legacy = withLane();
  delete legacy.lanes;
  assert.equal(validateProject(legacy), legacy);
  assert.equal(Object.hasOwn(legacy, 'lanes'), false);
});

test('optional zone, color, probe and idle fields validate', () => {
  const project = withLane();
  const lane = project.lanes[0];
  lane.layers.background.zones = ['zone-a', 'Zone_2', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'];
  lane.layers.table.colors = Array.from({ length: 16 }, (_, index) => color(index));
  lane.probe = { mode: 'shadow', model: PROBE_MODELS[0].id };
  lane.idle = { frequencyPercent: 0, variants: ['gasp', 'deal-left'] };
  assert.equal(validateProject(project), project);
  lane.probe = { mode: 'active' };
  lane.idle = { frequencyPercent: 100 };
  lane.layers.background.zones = [];
  lane.layers.table.colors = [];
  assert.equal(validateProject(project), project);
  lane.idle = {};
  delete lane.probe;
  assert.equal(validateProject(project).lanes[0].openclaw.probe, 'off');
  assert.equal(Object.hasOwn(project.lanes[0], 'probe'), false);
});

test('invalid zones, colors, probe model and idle frequency are rejected on the lane path', () => {
  const colors = withLane();
  colors.lanes[0].layers.table.colors = Array.from({ length: 17 }, (_, index) => color(index));
  assert.throws(() => validateProject(colors), /lanes\[0\]\.layers\.table\.colors: ska vara en lista med högst 16 färger/);

  const duplicateZone = withLane();
  duplicateZone.lanes[0].layers.background.zones = ['zone-a', 'zone-a'];
  assert.throws(() => validateProject(duplicateZone), /lanes\[0\]\.layers\.background\.zones\[1\]: dubblerat värde zone-a/);

  const badColor = withLane();
  badColor.lanes[0].layers.table.colors = ['#ggg'];
  assert.throws(() => validateProject(badColor), /lanes\[0\]\.layers\.table\.colors\[0\]: ska vara en färg #rrggbb/);

  const upper = withLane();
  upper.lanes[0].layers.table.colors = ['#AABBCC'];
  assert.throws(() => validateProject(upper), /lanes\[0\]\.layers\.table\.colors\[0\]/);

  const duplicateColor = withLane();
  duplicateColor.lanes[0].layers.table.colors = ['#112233', '#112233'];
  assert.throws(() => validateProject(duplicateColor), /lanes\[0\]\.layers\.table\.colors\[1\]: dubblerat värde #112233/);

  const model = withLane();
  model.lanes[0].probe = { mode: 'shadow', model: 'not-a-model' };
  assert.throws(() => validateProject(model), /lanes\[0\]\.probe\.model: okänd modell/);

  const mode = withLane();
  mode.lanes[0].probe = { mode: 'rules' };
  assert.throws(() => validateProject(mode), /lanes\[0\]\.probe\.mode: ska vara off, shadow eller active/);

  const idle = withLane();
  idle.lanes[0].idle = { frequencyPercent: 101 };
  assert.throws(() => validateProject(idle), /lanes\[0\]\.idle\.frequencyPercent: ska vara ett heltal 0–100/);

  const fraction = withLane();
  fraction.lanes[0].idle = { frequencyPercent: 50.5 };
  assert.throws(() => validateProject(fraction), /lanes\[0\]\.idle\.frequencyPercent/);

  const tooManyZones = withLane();
  tooManyZones.lanes[0].layers.background.zones = Array.from({ length: 33 }, (_, index) => `zone-${index}`);
  assert.throws(() => validateProject(tooManyZones), /lanes\[0\]\.layers\.background\.zones: ska vara en lista med högst 32 zon-id/);
});
