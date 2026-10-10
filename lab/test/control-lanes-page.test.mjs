import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject } from '../lib/studio-model.mjs';
import { fixtureLaneOperators } from '../lib/operator-package-api.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

function loadTs(fileUrl, overrides = {}) {
  const source = readFileSync(fileUrl, 'utf8');
  const output = transformSync(source, { filename: fileURLToPath(fileUrl), jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  const localRequire = createRequire(fileUrl);
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams, fetch: overrides.fetch ?? globalThis.fetch,
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

test('Lanes renders the title and disables write buttons when no store is connected', () => {
  const pageSource = readFileSync(new URL('../app/control/lanes/page.tsx', import.meta.url), 'utf8');
  const componentSource = readFileSync(new URL('../components/control-lanes-page.tsx', import.meta.url), 'utf8');
  assert.match(pageSource, /title: 'Publicering · Croupier Studio'/);
  assert.doesNotMatch(pageSource, /createOperator|operator-create-demo/);
  assert.match(componentSource, /operator-create-demo/);
  assert.doesNotMatch(componentSource, /useEffect/);
  assert.match(pageSource, /initialVideos=\{data\.videos\}/);
  assert.match(pageSource, /initialStatus=\{data\.status\}/);
  assert.match(pageSource, /operators=\{operators\}/);
  assert.match(pageSource, /storeAvailable=\{storeAvailable\}/);
  const { ControlLanesPage } = loadTs(new URL('../components/control-lanes-page.tsx', import.meta.url));
  const html = renderToStaticMarkup(React.createElement(ControlLanesPage, {
    initialProject: createSeedProject(),
    initialVideos: { videos: [] },
    initialStatus: { configured: false },
    operators: fixtureLaneOperators(),
    storeAvailable: false,
  }));
  assert.match(html, /<h1>Publicering<\/h1>/);
  assert.match(html, /SG test game provider/);
  assert.match(html, /mobile-phone/);
  assert.match(html, /Demo North/);
  assert.match(html, /Demo South/);
  assert.match(html, /Publicering kräver anslutning till den sparade studion/);
  const laneChoice=html.match(/<input[^>]*name="lanes"[^>]*value="mobile-phone"[^>]*>/)?.[0];
  assert.ok(laneChoice);
  assert.doesNotMatch(laneChoice,/disabled/,'offline can select saved lanes for export while publishing stays disabled');
  assert.match(html, /<summary>Avancerat: bolag och spellanes<\/summary>/);
  assert.doesNotMatch(html, /\(osparad\)/);
  assert.match(componentSource, /\(osparad\)/);
  assert.doesNotMatch(componentSource, /window\.confirm/);
  assert.match(html, /<button class="sg-btn sg-btn-primary"[^>]*disabled[^>]*>Skapa spelrum<\/button>/);
  assert.equal(html.match(/primary-button/g)?.length ?? 0, 0);
  assert.match(html, /<button class="sg-btn sg-btn-primary"[^>]*disabled[^>]*>Spara presentationer<\/button>/);
  assert.match(html, /<button class="sg-btn sg-btn-primary"[^>]*disabled[^>]*>Publicera paket<\/button>/);
  assert.match(html, /<button class="sg-btn sg-btn-ghost"[^>]*disabled[^>]*>Skapa SG test game provider<\/button>/);
});

test('a project without saved lanes still offers the standard lane for publishing, as the API allows', () => {
  const { publishLaneRows } = loadTs(new URL('../components/control-lanes-page.tsx', import.meta.url));
  // The vm realm has its own Array; compare through JSON.
  const plain = value => JSON.parse(JSON.stringify(value));
  const empty = publishLaneRows([], JSON.stringify({ lanes: [] }), false);
  assert.deepEqual(plain(empty.map(row => [row.id, row.unsaved])), [['mobile-phone', false]]);
  const missing = publishLaneRows(undefined, JSON.stringify({}), false);
  assert.deepEqual(plain(missing.map(row => row.id)), ['mobile-phone']);
  // An unsaved draft of the standard lane replaces the implicit row instead of duplicating it.
  const draft = publishLaneRows([{ id: 'mobile-phone', label: 'Utkast', dealers: ['astrid'] }], JSON.stringify({ lanes: [] }), true);
  assert.deepEqual(plain(draft.map(row => [row.id, row.unsaved])), [['mobile-phone', true]]);
  // Saved lanes are authoritative: no implicit standard row beside them.
  const saved = [{ id: 'vip', label: 'VIP', dealers: ['vera'] }];
  assert.deepEqual(plain(publishLaneRows(saved, JSON.stringify({ lanes: saved }), false).map(row => row.id)), ['vip']);
});


test('a lane selected in composition is selected for editing and publishing, with a matching return link',()=>{
  const {ControlLanesPage}=loadTs(new URL('../components/control-lanes-page.tsx',import.meta.url));
  const project=createSeedProject();
  const second=structuredClone(project.lanes[0]);second.id='evening';second.label='Kväll';project.lanes.push(second);
  const html=renderToStaticMarkup(React.createElement(ControlLanesPage,{initialProject:project,initialVideos:{videos:[]},initialStatus:{configured:false},initialLaneId:'evening',operators:fixtureLaneOperators(),storeAvailable:false}));
  assert.match(html,/<h3>Kväll<\/h3>/);
  assert.match(html,/href="[^"]*\/control\/preview\?lane=evening"/);
  assert.match(html,/<input[^>]*name="lanes"[^>]*checked=""[^>]*value="evening"/);
  assert.match(html,/<option value="evening" selected="">Kväll<\/option>/);
  assert.match(html,/SG test game provider · Kväll/);
  assert.doesNotMatch(html,/Bakgrundszoner|control\/zones|package_revision/);
});

test('publishing locks before React rerenders and unlocks after a failed request', async () => {
  const project = createSeedProject(), pending = [];
  const { ControlLanesPage } = loadTs(new URL('../components/control-lanes-page.tsx', import.meta.url), {
    react: { ...React, useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useRef: current => ({current}) },
    './studio-session': { useStudioSession: () => ({ project, dirty: false, saving: false, conflict: false, savedJson: JSON.stringify(project), setError() {}, setNotice() {} }) },
    fetch: () => new Promise(resolve => pending.push(resolve)),
  });
  const tree = ControlLanesPage({ initialProject: project, initialVideos: {videos: []}, initialStatus: {}, operators: fixtureLaneOperators(), storeAvailable: true });
  function findForm(node) {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'form') return node;
    for (const child of [node.props?.primary, ...[node.props?.children].flat(Infinity)]) {
      const found = findForm(child); if (found) return found;
    }
    return null;
  }
  const form = findForm(tree); assert.ok(form);
  const first = form.props.onSubmit({ preventDefault() {} });
  await form.props.onSubmit({ preventDefault() {} });
  assert.equal(pending.length, 1, 'same-tick double submission creates only one package request');
  pending[0]({ok: false, status: 503, json: async () => ({})}); await first;
  await new Promise(resolve => setImmediate(resolve));
  const retry = form.props.onSubmit({ preventDefault() {} });
  assert.equal(pending.length, 2, 'failure releases lock for a deliberate retry');
  pending[1]({ok: true, json: async () => ({packageRevision: 1})}); await retry;
  await new Promise(resolve => setImmediate(resolve));
});
