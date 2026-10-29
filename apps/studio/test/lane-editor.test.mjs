import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject as createEmptyProject, addDealer, defaultPresentationLane, validateLanes, validateProject, LANE_ID } from '../../../packages/presentation/contracts/studio-model.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

function loadTs(fileUrl, overrides = {}) {
  const source = readFileSync(fileUrl, 'utf8');
  const output = transformSync(source, { filename: fileURLToPath(fileUrl), jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  const localRequire = createRequire(fileUrl);
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams, crypto: globalThis.crypto,
    window: new Proxy({}, { get: (_target, key) => globalThis.window?.[key] }),
    require: name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.endsWith('.module.css') || name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name.startsWith('./') || name.startsWith('../')) {
        for (const suffix of ['', '.tsx', '.ts', '.mjs', '.js']) {
          const candidate = new URL(name + suffix, fileUrl);
          const path = fileURLToPath(candidate);
          if (!existsSync(path)) continue;
          if (path.endsWith('.mjs') || path.endsWith('.js') || path.endsWith('.json')) return localRequire(path);
          return loadTs(pathToFileURL(path), overrides);
        }
      }
      return localRequire(name);
    },
  }, { filename: fileURLToPath(fileUrl) });
  return module.exports;
}

const editor = loadTs(new URL('../components/lane-editor.tsx', import.meta.url));
const { newCompositionId, addLane, addDefaultLane, removeLane, replaceLane, CompositionMetadata, LANE_ID_HELP } = editor;

function modelEdit(project, edit) {
  try { return { project: edit(project), error: '' }; }
  catch (cause) { return { project, error: cause instanceof Error ? cause.message : '' }; }
}

test('a new composition uses the explicitly selected dealer and validates', () => {
  const project = createSeedProject();
  const before = structuredClone(project.lanes);
  const applied = modelEdit(project, current => addLane(current, 'tablet-lane', 'Surfplatta', 'astrid'));
  const added = applied.project.lanes.at(-1);
  const base = defaultPresentationLane('astrid');
  assert.equal(applied.error, '');
  assert.equal(validateProject(applied.project), applied.project);
  assert.equal(added.id, 'tablet-lane');
  assert.equal(added.label, 'Surfplatta');
  assert.deepEqual(added.dealers, base.dealers);
  assert.deepEqual(added.layers, base.layers);
  assert.deepEqual(added.openclaw, base.openclaw);
  assert.deepEqual(added.operatorAdjustable, base.operatorAdjustable);
  assert.deepEqual(project.lanes, before);
  assert.equal(LANE_ID.test('tablet-lane'), true);
});

test('invalid lane ids are rejected and lanes stay unchanged', () => {
  const project = createSeedProject();
  const before = structuredClone(project.lanes);
  for (const id of ['Original', 'MOBILE', 'a b']) {
    const applied = modelEdit(project, current => addLane(current, id, 'Namn', 'astrid'));
    assert.match(applied.error, /lane-id/);
    assert.equal(applied.project, project);
    assert.deepEqual(project.lanes, before);
    assert.equal(LANE_ID.test(id), false);
  }
});

test('a dealer outside project.dealers is rejected and lanes stay unchanged', () => {
  const project = createSeedProject();
  const before = structuredClone(project.lanes);
  const lane = structuredClone(project.lanes[0]);
  lane.dealers = ['paow'];
  lane.layers.dealer.default = 'paow';
  lane.layers.dealer.allowed = ['paow'];
  const applied = modelEdit(project, current => replaceLane(current, lane.id, lane));
  assert.match(applied.error, /okänd dealer/);
  assert.equal(applied.project, project);
  assert.deepEqual(project.lanes, before);
  const dealerIds = new Set(project.dealers.map(dealer => dealer.id));
  assert.match(validateLanes([lane], dealerIds).join('\n'), /okänd dealer/);
});

test('layers.dealer.default outside the lane dealers is rejected and lanes stay unchanged', () => {
  const project = createSeedProject();
  const before = structuredClone(project.lanes);
  const lane = structuredClone(project.lanes[0]);
  lane.dealers = ['astrid', 'vera'];
  lane.layers.dealer.default = 'mei';
  lane.layers.dealer.allowed = ['astrid', 'vera'];
  const applied = modelEdit(project, current => replaceLane(current, lane.id, lane));
  assert.match(applied.error, /lane\.dealers/);
  assert.equal(applied.project, project);
  assert.deepEqual(project.lanes, before);
});

test('removing a lane leaves the project valid and the original list untouched', () => {
  const project = createSeedProject();
  const before = structuredClone(project.lanes);
  const added = addLane(project, 'tablet-lane', 'Surfplatta', 'astrid');
  const removed = removeLane(added, 'tablet-lane');
  assert.equal(validateProject(removed), removed);
  assert.deepEqual(removed.lanes.map(lane => lane.id), project.lanes.map(lane => lane.id));
  const cleared = removeLane(project, project.lanes[0].id);
  assert.deepEqual(cleared.lanes, []);
  assert.equal(validateProject(cleared), cleared);
  assert.deepEqual(project.lanes, before);
});

test('the empty editor requires a named composition and an explicit dealer', () => {
  const source = readFileSync(new URL('../components/lane-editor.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /window\.confirm/);
  assert.equal(LANE_ID_HELP, 'Unikt id: små bokstäver, siffror och bindestreck.');
  const empty = createSeedProject();
  empty.lanes = [];
  const editorHtml = renderToStaticMarkup(React.createElement(CompositionMetadata, { project: empty, selectedId: "", onSelect() {}, onEdit() {} }));
  assert.doesNotMatch(editorHtml, /Skapa standardsammansättning/);
  assert.match(editorHtml, /Dealer för ny miljö/);
  assert.match(editorHtml, /tekniskt ID skapas automatiskt/);
  assert.equal(validateProject(addDefaultLane(empty, 'astrid')).lanes[0].id, 'mobile-phone');
});

test('new compositions ask for a name and dealer while technical IDs remain automatic', () => {
  const empty = createSeedProject();
  empty.lanes = [];
  const editorHtml = renderToStaticMarkup(React.createElement(CompositionMetadata, { project: empty, selectedId: "", onSelect() {}, onEdit() {} }));
  assert.match(editorHtml, /<option value="" selected="">Välj dealer<\/option>/);
  assert.doesNotMatch(editorHtml, /<dt>Id|new-lane-id-help|Tekniskt ID<input/);
  assert.equal((editorHtml.match(/<input/g) ?? []).length, 1);
  assert.match(editorHtml, /Namn på ny miljö/);
});

test('replaceLane stores the new fields and rejects an invalid table color', () => {
  const project = createSeedProject();
  const before = structuredClone(project.lanes);
  const lane = structuredClone(project.lanes[0]);
  lane.layers.background.zones = ['zone-a'];
  lane.layers.table.colors = ['#112233'];
  lane.probe = { mode: 'shadow', model: 'gateway-default' };
  lane.idle = { frequencyPercent: 20, variants: ['gasp'] };
  const applied = modelEdit(project, current => replaceLane(current, lane.id, lane));
  assert.equal(applied.error, '');
  assert.deepEqual(applied.project.lanes[0].layers.background.zones, ['zone-a']);
  assert.deepEqual(applied.project.lanes[0].probe, { mode: 'shadow', model: 'gateway-default' });
  assert.equal(applied.project.lanes[0].idle.frequencyPercent, 20);
  const bad = structuredClone(lane);
  bad.layers.table.colors = ['#ggg'];
  const rejected = modelEdit(project, current => replaceLane(current, bad.id, bad));
  assert.match(rejected.error, /lanes\[0\]\.layers\.table\.colors\[0\]/);
  assert.equal(rejected.project, project);
  assert.deepEqual(project.lanes, before);
});

test('composition metadata is disabled during writes', () => {
  const project = createSeedProject();
  const metadata = renderToStaticMarkup(React.createElement(CompositionMetadata, { project, selectedId: project.lanes[0].id, onSelect() {}, onEdit() {}, disabled: true }));
  assert.match(metadata, /<fieldset[^>]*disabled=""[^>]*aria-label="Välj och namnge miljö"/);
});

function compositionControls(initialProject = createSeedProject(), disabled = false) {
  let project = structuredClone(initialProject), selectedId = project.lanes?.[0]?.id ?? '', error = '';
  const slots = []; let cursor = 0;
  const hooks = { ...React, useRef(initial) { const i=cursor++; return slots[i]??=({current:initial}); }, useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
    return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; } };
  const controls = loadTs(new URL('../components/lane-editor.tsx', import.meta.url), { react: hooks });
  const onEdit = change => { const result = modelEdit(project, change); project = result.project; error = result.error; };
  const onSelect = id => { selectedId = id; };
  const find = (node, predicate) => {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const child of React.Children.toArray(node.props?.children)) { const result = find(child, predicate); if (result) return result; }
    return null;
  };
  return { get project() { return project; }, get selectedId() { return selectedId; }, get error() { return error; }, find,
    metadata() { cursor = 0; return controls.CompositionMetadata({ project, onEdit, selectedId, onSelect, disabled }); },
  };
}

test('composition metadata creates and selects explicitly while renaming preserves every policy and other composition', () => {
  const project = createSeedProject();
  project.lanes[0].probe = { mode: 'shadow', model: 'gateway-default' };
  project.lanes[0].idle = { frequencyPercent: 31, variants: ['exact-own-clip'] };
  project.lanes[0].layers.table.colors = ['#112233'];
  const before = structuredClone(project), h = compositionControls(project);
  let tree = h.metadata();
  h.find(tree, node => node.type === 'input' && node.props.value === 'Standardsammansättning').props.onChange({ target: { value: 'Ny scen' } });
  assert.equal(h.error, '');
  assert.deepEqual(h.project, { ...before, lanes: [{ ...before.lanes[0], label: 'Ny scen' }] });
  tree = h.metadata();
  h.find(tree, node => node.type === 'input' && node.props.required && node.props.maxLength === 80).props.onChange({ target: { value: 'Kvällsscenen' } });
  tree = h.metadata(); h.find(tree, node => node.type === 'select' && node.props.required).props.onChange({target:{value:'astrid'}}); tree = h.metadata(); h.find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(h.error, ''); assert.match(h.selectedId, /^kvallsscenen-[0-9a-f-]{36}$/);
  assert.equal(h.project.lanes.length, 2); assert.equal(h.project.lanes[1].label, 'Kvällsscenen');
  assert.deepEqual(h.project.lanes[0], { ...before.lanes[0], label: 'Ny scen' });
  assert.deepEqual(project, before, 'the original saved snapshot stays unchanged');
});

test('creation generates only one identity for double submit and renaming preserves that identity', () => {
  const h = compositionControls(), original = structuredClone(h.project);
  let tree = h.metadata();
  h.find(tree, node => node.type === 'input' && node.props.required).props.onChange({ target: { value: 'Ny scen' } });
  tree = h.metadata(); h.find(tree, node => node.type === 'select' && node.props.required).props.onChange({target:{value:'astrid'}}); tree = h.metadata(); const submit = h.find(tree, node => node.type === 'form').props.onSubmit;
  submit({ preventDefault() {} }); submit({ preventDefault() {} });
  const id = h.selectedId;
  assert.equal(h.project.lanes.length, 2); assert.equal(h.error, '');
  tree = h.metadata();
  h.find(tree, node => node.type === 'input' && node.props.value === 'Ny scen' && !node.props.required).props.onChange({ target: { value: 'Annat namn' } });
  assert.equal(h.selectedId, id); assert.equal(h.project.lanes[1].id, id);
  assert.deepEqual(h.project.lanes[0], original.lanes[0]);
  tree = h.metadata();
  h.find(tree, node => node.type === 'input' && node.props.required).props.onChange({ target: { value: 'Ny scen' } });
  tree = h.metadata(); h.find(tree, node => node.type === 'select' && node.props.required).props.onChange({target:{value:'astrid'}}); tree = h.metadata(); h.find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(h.project.lanes.length, 3); assert.notEqual(h.selectedId, id);
});

test('generated composition IDs normalize names, obey the model limit and retry collisions', () => {
  const project = createSeedProject(), key = '11111111-2222-4333-8444-555555555555', other = '11111111-2222-4333-8444-666666666666';
  for (const label of ['ÅÄÖ fin scen', '123 kväll', '🔥', 'original', 'a'.repeat(80)]) {
    const id = newCompositionId(project, label, () => key);
    assert.ok(LANE_ID.test(id)); assert.ok(id.length <= 63);
    assert.equal(addLane(project,id,label,'astrid').lanes.at(-1).id,id);
  }
  const id = newCompositionId(project, 'Ny scen', () => key);
  const occupied = addLane(project, id, 'Ny scen', 'astrid'); let calls = 0;
  assert.equal(newCompositionId(occupied, 'Ny scen', () => ++calls === 1 ? key : other), 'ny-scen-' + other);
  assert.equal(calls, 2);
  assert.throws(() => newCompositionId(occupied, 'Ny scen', () => key), /unikt ID/);
  assert.throws(() => newCompositionId(project, 'Ny scen', () => '../unsafe'), /unikt ID/);
});

test('disabled composition metadata rejects direct callbacks as well as disabling native inputs', () => {
  const h = compositionControls(createSeedProject(), true), before = structuredClone(h.project);
  const tree = h.metadata();
  h.find(tree, node => node.type === 'input' && node.props.value === 'Standardsammansättning').props.onChange({ target: { value: 'Blocked' } });
  h.find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.deepEqual(h.project, before);
});

 test('editing a visible presentation property preserves every hidden playback value', () => {
  const project=createSeedProject(), lane=project.lanes[0];
  lane.openclaw={idle:'random',deal:'rules',reveal:'shadow',speak:'active',probe:'off'};
  lane.probe={mode:'shadow',model:'gateway-default'};
  lane.idle={frequencyPercent:27,variants:['saved-variation']};
  const original=structuredClone(project);
  const changed=structuredClone(lane);changed.layers.table.colors=['#112233'];
  const next=replaceLane(project,lane.id,changed);
  for(const key of ['openclaw','probe','idle'])assert.deepEqual(next.lanes[0][key],original.lanes[0][key]);
  assert.deepEqual(project,original);
});

// This suite exercises a saved composition, not an automatically populated new project.
function createSeedProject() { const project = createEmptyProject(); project.lanes = [defaultPresentationLane('astrid')]; return project; }

test('new compositions never infer a dealer from the project list', () => {
  const project = addDealer(createSeedProject(), 'elin', 'Elin');
  assert.throws(() => addLane(project, 'new-room', 'New room'), /dealer/i);
  assert.deepEqual(addLane(project, 'new-room', 'New room', 'elin').lanes.at(-1).dealers, ['elin']);
});
