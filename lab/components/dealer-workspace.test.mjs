import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject } from '../lib/studio-model.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const empty = () => null;
const marker = name => props => React.createElement('div', { 'data-component': name, 'data-dealer': props.dealerId });
function harness(file, initialStates = [], overrides = {}) {
  const values = [...initialStates]; let cursor = 0;
  const fakeReact = { ...React, useEffect() {}, useCallback: callback => callback,
    useState(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial;
      return [values[index], next => { values[index] = typeof next === 'function' ? next(values[index]) : next; }];
    },
  };
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const output = transformSync(source, { filename: file, jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const mocks = {
    './activity-log': { ActivityLog: marker('observation') },
    './idle-policy-editor': { IdlePolicyEditor: marker('idle') },
    './family-video-library': { FamilyVideoLibrary: marker('families') },
    './legacy-clip-editor': { LegacyClipEditor: marker('legacy') },
    './family-video-upload': { FamilyVideoUpload: marker('upload') },
    './media-family-editor': { MediaFamilyEditor: empty },
    './probe-editor': { ProbeEditor: empty }, './project-conflict': { ProjectConflict: empty },
    './studio-types': { requestJson() { throw new Error('Unexpected request'); } },
    ...overrides,
  };
  const module = { exports: {} };
  vm.runInNewContext(output.code, { module, exports: module.exports, structuredClone,
    window: { location: { hash: '' } },
    require: name => name === 'react' ? fakeReact : name.endsWith('.module.css') ? { __esModule: true, default: {} } : mocks[name] ?? require(name),
  });
  return { render(props) { cursor = 0; return Object.values(module.exports)[0](props); }, values };
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function pressDealer(tree, label) {
  const chip = nodes(tree, node => node.type === 'button' && node.props.className === 'sg-chip' && [].concat(node.props.children).join('').includes(label))[0];
  assert.ok(chip, label);
  assert.equal(chip.props['aria-pressed'], false);
  chip.props.onClick();
  return chip;
}
const props = () => ({ initialProject: createSeedProject(), initialVideos: { videos: [] }, connectedLane: true });

test('cloud idle refresh reads the shared registry even when imported media has an old archive label', async () => {
  const calls = [], refreshed = { videos: [{ id:'new-idle-variant' }] };
  const h = harness('./lab-studio.tsx', [], {
    '../lib/lab-url.mjs': { labBasePath: () => '/studio', labUrl: path => `/studio${path}` },
    './studio-types': { async requestJson(...args) { calls.push(args); return refreshed; } },
  });
  const p = props(); p.initialVideos.summary = { archiveSource:'emil-default' };
  const tree = h.render(p);
  const refresh = nodes(tree, node => node.type === 'button' && node.props.children === 'Läs in nya idle-klipp')[0];
  refresh.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls,[['/api/videos',undefined]]);
  assert.equal(h.values[2],refreshed);
  assert.equal(h.values[0],p.initialProject,'loading clips preserves the project draft');
});

test('focused workspace uses dealer chips, three categories and links instead of a hidden dealer list', () => {
  const h = harness('./lab-studio.tsx'); const tree = h.render(props());
  const html = renderToStaticMarkup(tree);
  assert.equal(nodes(tree, node => node.type === 'select' && node.props['aria-label'] === 'Dealer').length, 0);
  const chips = nodes(tree, node => node.type === 'button' && node.props.className === 'sg-chip');
  assert.equal(chips.length, 4);
  assert.equal(chips.filter(node => node.props['aria-pressed'] === true).length, 1);
  const nav = nodes(tree, node => node.type === 'nav')[0];
  assert.deepEqual(nodes(nav, node => node.type === 'button').map(node => node.props.children), ['Idle', 'Kort & deal', 'Fasta repliker / ljud']);
  assert.match(html, /href="\/control\/zones"/);
  assert.match(html, /Öppna Bakgrundszoner →/);
  assert.match(html, /href="\/control\/probe"/);
  assert.match(html, /Öppna Talgranskning →/);
  assert.match(html, /href="\/control\/activity"/);
  assert.match(html, /Öppna Uppspelning →/);
  assert.doesNotMatch(html, /href="[^"]*openclaw|Spel &amp; uppspelning|Sparat i Lab|aria-label="Dealer"|Granska i spel|sg-pill|Förhandsvisa bakgrundszoner/);
  assert.equal(nodes(tree, node => node.props?.streamView).length, 0, 'playback log is a link, not an embed');
});

test('draft survives dealer chip and category changes', () => {
  const h = harness('./lab-studio.tsx'); const p = props();
  let tree = h.render(p);
  const draft = structuredClone(h.values[0]); draft.revision = 'unsaved-draft'; h.values[0] = draft;
  pressDealer(tree, 'Vera');
  tree = h.render(p);
  const categories = nodes(tree, node => node.type === 'nav')[0];
  nodes(categories, node => node.type === 'button')[1].props.onClick(); tree = h.render(p);
  assert.equal(h.values[0], draft);
  assert.equal(h.values[4], 'deal');
  const legacy = nodes(tree, node => node.props?.section === 'deal')[0];
  assert.equal(legacy.props.dealerId, 'vera');
  assert.equal(nodes(tree, node => node.props?.inventory && !node.props?.section).length, 0, 'Astrid family tools not rendered for Vera');
  const html = renderToStaticMarkup(tree);
  assert.doesNotMatch(html, /Bakgrundsredigering stöds/);
  assert.match(html, /href="\/control\/zones"/);
  assert.match(html, /href="\/control\/activity"/);
  assert.equal(nodes(tree, node => node.props?.streamView).length, 0);
  assert.equal(nodes(tree, node => node.type === 'button' && node.props.className === 'sg-chip' && node.props['aria-pressed'] === true)[0].props.children.join(''), 'V Vera');
});

test('controlled legacy editor lists only selected dealer exact speech and no second dealer selector', () => {
  const controls = { clips: ['astrid', 'vera'].map(dealerId => ({ id: `${dealerId}:line`, dealerId, kind: 'recorded-speech', exactParts: [], lineId: 'goodluck', text: `${dealerId} exact text`, available: true, source: 'speech-media.json', route: '/', reviewStatus: 'registered' })), legacy: [], routes: [] };
  const h = harness('./legacy-clip-editor.tsx', [controls, 'astrid', '']);
  const html = renderToStaticMarkup(h.render({ project: createSeedProject(), dealerId: 'vera', section: 'clips', showLegacyReview: false, onChange() { throw new Error('Unexpected edit'); } }));
  assert.match(html, /vera exact text/); assert.doesNotMatch(html, /astrid exact text|<select/);
});

test('another dealer keeps idle tools and the draft without a probe tab', () => {
  const h = harness('./lab-studio.tsx'); const p = props();
  let tree = h.render(p);
  const draft = structuredClone(h.values[0]); draft.revision = 'unsaved-draft'; h.values[0] = draft;
  pressDealer(tree, 'Vera');
  tree = h.render(p);
  const nav = nodes(tree, node => node.type === 'nav')[0];
  assert.deepEqual(nodes(nav, node => node.type === 'button').map(node => node.props.children), ['Idle', 'Kort & deal', 'Fasta repliker / ljud']);
  assert.equal(nodes(nav, node => node.type === 'button' && node.props.children === 'Probe').length, 0);
  assert.equal(nodes(nav, node => node.props['aria-pressed'] === true)[0].props.children, 'Idle');
  assert.equal(nodes(tree, node => node.props?.section === 'idle')[0].props.dealerId, 'vera');
  assert.equal(nodes(tree, node => node.type === 'button' && node.props.children === 'Ladda upp klipp').length, 0);
  assert.match(renderToStaticMarkup(tree), /href="\/control\/probe"/);
  assert.equal(h.values[0], draft);
});

test('save still uses revisions and beforeunload; navigation does not replace project state', () => {
  const source = readFileSync(new URL('./lab-studio.tsx', import.meta.url), 'utf8');
  assert.match(source, /expectedRevision: submitted\.revision/);
  assert.match(source, /window\.addEventListener\('beforeunload', guard\)/);
  assert.match(source, /current === submitted \? response\.project/);
  assert.doesNotMatch(source, /history\.pushState|router\.push|setProject\(initialProject\)/);
});
