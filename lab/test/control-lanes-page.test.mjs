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
  assert.match(laneChoice,/disabled/,'pick an explicit company before editing its package selection');
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


test('a composition link selects the presentation without silently adding it to a company package',()=>{
  const {ControlLanesPage}=loadTs(new URL('../components/control-lanes-page.tsx',import.meta.url));
  const project=createSeedProject();
  const second=structuredClone(project.lanes[0]);second.id='evening';second.label='Kväll';project.lanes.push(second);
  const html=renderToStaticMarkup(React.createElement(ControlLanesPage,{initialProject:project,initialVideos:{videos:[]},initialStatus:{configured:false},initialLaneId:'evening',operators:[{id:'john',slug:'john',name:'John',publishedPackage:{revision:7,lanes:['mobile-phone']}}],storeAvailable:false}));
  assert.match(html,/<h3>Kväll<\/h3>/);
  assert.match(html,/href="[^"]*\/control\/preview\?lane=evening"/);
  assert.doesNotMatch(html.match(/<input[^>]*name="lanes"[^>]*value="evening"[^>]*>/)?.[0] ?? '',/checked/);
  assert.match(html,/<input[^>]*name="lanes"[^>]*checked=""[^>]*value="mobile-phone"/);
  assert.match(html,/<option value="evening" selected="">Kväll<\/option>/);
  assert.match(html,/John · Kväll/);
  assert.match(html,/Kväll är inte markerad/);
  assert.doesNotMatch(html,/Bakgrundszoner|control\/zones|package_revision/);
});

test('publishing locks before React rerenders and unlocks after a failed request', async () => {
  const project = createSeedProject(), pending = [];
  const { ControlLanesPage } = loadTs(new URL('../components/control-lanes-page.tsx', import.meta.url), {
    react: { ...React, useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useRef: current => ({current}) },
    './studio-session': { useStudioSession: () => ({ project, dirty: false, saving: false, conflict: false, savedJson: JSON.stringify(project), setError() {}, setNotice() {} }) },
    fetch: () => new Promise(resolve => pending.push(resolve)),
  });
  const tree = ControlLanesPage({ initialProject: project, initialVideos: {videos: []}, initialStatus: {}, operators: [{id:'sg-test',slug:'sg-test',name:'SG test',publishedPackage:{revision:1,lanes:['mobile-phone']}}], storeAvailable: true });
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

function pageHarness({ operators, initialLaneId, initialOperatorId, dirty = false, savedProject } = {}) {
  const project = createSeedProject(), other = structuredClone(project.lanes[0]);
  other.id = 'johns-johanna'; other.label = 'Johannas presentation'; project.lanes.push(other);
  const slots = [], requests = []; let cursor = 0;
  const react = { ...React,
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], update => { slots[i] = typeof update === 'function' ? update(slots[i]) : update; }]; },
    useRef(value) { return slots[cursor++] ??= { current: value }; },
  };
  function Room() { return null; }
  const props = { initialProject: project, initialVideos: { videos: [] }, initialStatus: {}, operators,
    initialLaneId, initialOperatorId, storeAvailable: true };
  const { ControlLanesPage } = loadTs(new URL('../components/control-lanes-page.tsx', import.meta.url), {
    react,
    './studio-session': { useStudioSession: () => ({ project, dirty, saving: false, conflict: false,
      savedJson: JSON.stringify(savedProject ?? project), setError() {}, setNotice() {} }) },
    './presentation-room-create': { PresentationRoomCreate: Room },
    './lane-editor': { LaneEditor: () => null },
    fetch: (path, options) => new Promise(resolve => requests.push({ path, options, resolve })),
  });
  const render = () => { cursor = 0; return ControlLanesPage(props); };
  const all = (node, match) => {
    if (!node || typeof node !== 'object') return [];
    return [...(match(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(child => all(child, match))];
  };
  const nodes = match => all(render(), match);
  return { project, render, requests,
    html: () => renderToStaticMarkup(render()),
    operator: () => nodes(node => node.type === 'select')[0],
    presentation: () => nodes(node => node.type === 'select')[1],
    checkbox: id => nodes(node => node.type === 'input' && node.props.value === id)[0],
    submit: () => nodes(node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }),
    room: () => nodes(node => node.type === Room)[0],
    async reply(index, body, status = 200) { requests[index].resolve(Response.json(body, { status })); await new Promise(resolve => setImmediate(resolve)); },
  };
}
const twoOperators = () => [
  { id: 'sg-test', slug: 'sg-test', name: 'SG test', publishedPackage: { revision: 4, lanes: ['mobile-phone'] } },
  { id: 'john', slug: 'john', name: 'John', publishedPackage: { revision: 7, lanes: ['johns-johanna'] } },
];

test('initial company follows an unambiguous published assignment or explicit query, never a fixture guess', () => {
  const { initialPackageOperator } = loadTs(new URL('../components/control-lanes-page.tsx', import.meta.url));
  assert.equal(initialPackageOperator(twoOperators(), 'johns-johanna'), 'john');
  assert.equal(initialPackageOperator(twoOperators(), 'johns-johanna', 'sg-test'), 'sg-test');
  assert.equal(initialPackageOperator(twoOperators(), 'johns-johanna', 'missing'), '');
  assert.equal(initialPackageOperator(twoOperators(), 'new-presentation'), '');
  assert.equal(initialPackageOperator(twoOperators()), '');
  assert.equal(initialPackageOperator(twoOperators().map(value => ({ ...value, publishedPackage: { revision: 1, lanes: ['shared'] } })), 'shared'), '');
  const source = readFileSync(new URL('../app/control/lanes/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /initialOperatorId=\{firstQueryValue\(query.operator\)\}/);
  assert.match(source, /\['tab', 'lane', 'operator'\]/);
});

test('company switches preserve separate draft selections and never carry another company revision or error', async () => {
  const h = pageHarness({ operators: twoOperators(), initialLaneId: 'johns-johanna' });
  assert.equal(h.operator().props.value, 'john');
  assert.equal(h.checkbox('johns-johanna').props.checked, true); assert.equal(h.checkbox('mobile-phone').props.checked, false);
  h.checkbox('mobile-phone').props.onChange({ target: { checked: true } });
  h.operator().props.onChange({ target: { value: 'sg-test' } });
  assert.equal(h.checkbox('mobile-phone').props.checked, true); assert.equal(h.checkbox('johns-johanna').props.checked, false);
  assert.match(h.html(), /Senast publicerade version: 4/); assert.doesNotMatch(h.html(), /version: 7/);
  h.submit(); assert.equal(h.requests.length, 1);
  assert.deepEqual(JSON.parse(h.requests[0].options.body), { operatorId: 'sg-test', lanes: ['mobile-phone'] });
  await h.reply(0, { error: 'studio_conflict' }, 409);
  assert.match(h.html(), /Paketet kunde inte uppdateras/);
  h.operator().props.onChange({ target: { value: 'john' } });
  assert.equal(h.checkbox('mobile-phone').props.checked, true); assert.equal(h.checkbox('johns-johanna').props.checked, true);
  assert.match(h.html(), /version: 7/); assert.doesNotMatch(h.html(), /Paketet kunde inte uppdateras/);
  h.submit(); assert.deepEqual(JSON.parse(h.requests[1].options.body), { operatorId: 'john', lanes: ['johns-johanna', 'mobile-phone'] });
  await h.reply(1, { packageRevision: 8 });
  assert.match(h.html(), /Paketet är publicerat. Version 8/);
});

test('empty assignments remain empty and an unknown assignment requires rereading before replacement', () => {
  for (const publishedPackage of [null, undefined]) {
    const h = pageHarness({ operators: [{ id: 'new', slug: 'new', name: 'Nytt', publishedPackage }], initialLaneId: 'johns-johanna' });
    assert.equal(h.checkbox('johns-johanna').props.checked, false);
    assert.equal(h.checkbox('mobile-phone').props.checked, false);
    h.submit(); assert.equal(h.requests.length, 0);
    if (publishedPackage === undefined) {
      h.checkbox('johns-johanna').props.onChange({ target: { checked: true } });
      h.submit(); assert.equal(h.requests.length, 0);
      assert.match(h.html(), /Läs in publicerat paket/);
    }
  }
});

test('an unsaved selected lane stays checked and blocks the entire package write instead of being silently omitted', () => {
  const savedProject = createSeedProject();
  const h = pageHarness({ operators: [{ id: 'john', slug: 'john', name: 'John', publishedPackage: { revision: 7, lanes: ['mobile-phone', 'johns-johanna'] } }], dirty: true, savedProject });
  assert.equal(h.checkbox('johns-johanna').props.checked, true);
  assert.equal(h.checkbox('johns-johanna').props.disabled, true);
  h.submit(); assert.equal(h.requests.length, 0); assert.match(h.html(), /Alla markerade presentationer/);
});

test('room creation invalidates only its company package editor until exact assignments are reread', () => {
  const h = pageHarness({ operators: twoOperators(), initialOperatorId: 'john' });
  h.room().props.onCreated({ packageRevision: 8, room: { operatorId: 'john' } });
  h.submit(); assert.equal(h.requests.length, 0);
  assert.match(h.html(), /Läs in publicerat paket/);
  assert.match(h.html(), /operator=john&amp;lane=mobile-phone/);
  h.operator().props.onChange({ target: { value: 'sg-test' } });
  assert.doesNotMatch(h.html(), /Läs in publicerat paket/);
  assert.match(h.html(), /version: 4/);
});

test('same-tick company changes cannot relabel an in-flight publish receipt', async () => {
  const h = pageHarness({ operators: twoOperators(), initialOperatorId: 'john' });
  const picker = h.operator(); h.submit(); picker.props.onChange({ target: { value: 'sg-test' } });
  assert.equal(h.operator().props.value, 'john');
  await h.reply(0, { packageRevision: 8 });
  assert.match(h.html(), /Version 8/);
  h.operator().props.onChange({ target: { value: 'sg-test' } });
  assert.doesNotMatch(h.html(), /Version 8/); assert.match(h.html(), /version: 4/);
});

test('a published lane missing from the project requires visible explicit removal before replacement', async () => {
  const h = pageHarness({ operators: [{ id: 'john', slug: 'john', name: 'John', publishedPackage: { revision: 7, lanes: ['mobile-phone', 'retired-lane'] } }] });
  assert.equal(h.checkbox('retired-lane').props.checked, true);
  assert.equal(h.checkbox('retired-lane').props.disabled, false);
  assert.match(h.html(), /retired-lane · Saknas bland presentationerna/);
  h.submit(); assert.equal(h.requests.length, 0, 'missing published selections cannot be dropped implicitly');
  h.checkbox('retired-lane').props.onChange({ target: { checked: false } });
  h.submit(); assert.equal(h.requests.length, 1);
  assert.deepEqual(JSON.parse(h.requests[0].options.body), { operatorId: 'john', lanes: ['mobile-phone'] });
  await h.reply(0, { error: 'studio_conflict' }, 409);
  assert.match(h.html(), /ett befintligt spelrum/);
  assert.match(h.html(), /Läs in publicerat paket/);
});
