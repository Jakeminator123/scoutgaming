import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject, defaultPresentationLane, validateLanes, validateProject, LANE_ID } from '../lib/studio-model.mjs';
import { fixtureLaneOperators } from '../lib/operator-package-api.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

function loadTs(fileUrl) {
  const source = readFileSync(fileUrl, 'utf8');
  const output = transformSync(source, { filename: fileURLToPath(fileUrl), jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  const localRequire = createRequire(fileUrl);
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams,
    window: new Proxy({}, { get: (_target, key) => globalThis.window?.[key] }),
    require: name => {
      if (name.endsWith('.module.css') || name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name.startsWith('./') || name.startsWith('../')) {
        for (const suffix of ['', '.tsx', '.ts', '.mjs', '.js']) {
          const candidate = new URL(name + suffix, fileUrl);
          const path = fileURLToPath(candidate);
          if (!existsSync(path)) continue;
          if (path.endsWith('.mjs') || path.endsWith('.js') || path.endsWith('.json')) return localRequire(path);
          return loadTs(pathToFileURL(path));
        }
      }
      return localRequire(name);
    },
  }, { filename: fileURLToPath(fileUrl) });
  return module.exports;
}

const editor = loadTs(new URL('../components/lane-editor.tsx', import.meta.url));
const page = loadTs(new URL('../components/control-lanes-page.tsx', import.meta.url));
const { addLane, addDefaultLane, removeLane, replaceLane, LaneEditor, LANE_ID_HELP } = editor;
const { publishLaneRows } = page;

function modelEdit(project, edit) {
  try { return { project: edit(project), error: '' }; }
  catch (cause) { return { project, error: cause instanceof Error ? cause.message : '' }; }
}

test('a new lane starts from the default and validateProject accepts it', () => {
  const project = createSeedProject();
  const before = structuredClone(project.lanes);
  const applied = modelEdit(project, current => addLane(current, 'tablet-lane', 'Surfplatta'));
  const added = applied.project.lanes.at(-1);
  const base = defaultPresentationLane();
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
    const applied = modelEdit(project, current => addLane(current, id, 'Namn'));
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
  const added = addLane(project, 'tablet-lane', 'Surfplatta');
  const removed = removeLane(added, 'tablet-lane');
  assert.equal(validateProject(removed), removed);
  assert.deepEqual(removed.lanes.map(lane => lane.id), project.lanes.map(lane => lane.id));
  const cleared = removeLane(project, project.lanes[0].id);
  assert.deepEqual(cleared.lanes, []);
  assert.equal(validateProject(cleared), cleared);
  assert.deepEqual(project.lanes, before);
});

test('unsaved lanes are marked until the project is clean', () => {
  const project = createSeedProject();
  const saved = JSON.stringify(project);
  const next = addLane(project, 'tablet-lane', 'Surfplatta');
  const dirty = publishLaneRows(next.lanes, saved, true);
  assert.equal(dirty.find(row => row.id === 'tablet-lane').unsaved, true);
  assert.equal(dirty.find(row => row.id === project.lanes[0].id).unsaved, false);
  const clean = publishLaneRows(next.lanes, JSON.stringify(next), false);
  assert.equal(clean.every(row => row.unsaved === false), true);
});

test('the editor shows the default lane suggestion, the administration hint and one save button on the page', () => {
  const source = readFileSync(new URL('../components/lane-editor.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /window\.confirm/);
  assert.equal(LANE_ID_HELP, 'Id ska vara samma som ett lane-id under Administration → Spel, lanes & bord för att spelet ska kunna köra lanen.');
  const empty = createSeedProject();
  empty.lanes = [];
  const editorHtml = renderToStaticMarkup(React.createElement(LaneEditor, { project: empty, onEdit() {} }));
  assert.match(editorHtml, /Lägg till standardlane/);
  assert.match(editorHtml, /mobile-phone/);
  assert.match(editorHtml, /Administration → Spel, lanes &amp; bord/);
  const html = renderToStaticMarkup(React.createElement(page.ControlLanesPage, {
    initialProject: empty,
    initialVideos: { videos: [] },
    initialStatus: { configured: false },
    operators: fixtureLaneOperators(),
    storeAvailable: false,
  }));
  assert.match(html, /Lägg till standardlane/);
  // No saved lanes: the publish list still offers the standard lane, which the API accepts.
  assert.match(html, /<input type="checkbox" disabled="" name="lanes" value="mobile-phone"\/>mobile-phone · Mobile Phone Lane · astrid<\/label>/);
  assert.doesNotMatch(html, /\(osparad\)/);
  assert.match(html, /Administration → Spel, lanes &amp; bord/);
  assert.equal(html.match(/sg-btn-primary/g).length, 1);
  assert.match(html, /<button class="sg-btn sg-btn-secondary"[^>]*>Publicera paket<\/button>/);
  assert.equal(validateProject(addDefaultLane(empty)).lanes[0].id, 'mobile-phone');
});

test('the suggestion row separates its values and the page keeps one primary button', () => {
  const empty = createSeedProject();
  empty.lanes = [];
  const editorHtml = renderToStaticMarkup(React.createElement(LaneEditor, { project: empty, onEdit() {} }));
  assert.match(editorHtml, /<dt>Id<\/dt><dd>mobile-phone<\/dd>/);
  assert.match(editorHtml, /<dd>mobile-phone<\/dd>[\s\S]*·[\s\S]*<dd>Mobile Phone Lane<\/dd>/);
  const splitAt = editorHtml.indexOf('Ny lane</h2>');
  assert.ok(splitAt > 0);
  const help = 'Administration → Spel, lanes &amp; bord';
  assert.equal(editorHtml.slice(0, splitAt).split(help).length - 1, 1);
  assert.equal(editorHtml.slice(splitAt).split(help).length - 1, 1);
  const html = renderToStaticMarkup(React.createElement(page.ControlLanesPage, {
    initialProject: empty,
    initialVideos: { videos: [] },
    initialStatus: { configured: false },
    operators: fixtureLaneOperators(),
    storeAvailable: false,
  }));
  assert.equal(html.match(/sg-btn-primary/g).length, 1);
});
