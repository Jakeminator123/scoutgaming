import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PARTNER_PREVIEW_OPERATORS } from '../lib/partner-preview-policy.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

function loadTs(fileUrl, overrides = {}) {
  const source = readFileSync(fileUrl, 'utf8');
  const output = transformSync(source, { filename: fileURLToPath(fileUrl), jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  const localRequire = createRequire(fileUrl);
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams,
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

const { ControlWorkspace } = loadTs(new URL('../components/control-workspace.tsx', import.meta.url));

function render(props) {
  return renderToStaticMarkup(React.createElement(ControlWorkspace, props));
}

test('overview lists fixture operators alphabetically and makes composition primary with three Studio destinations', () => {
  const operators = [...PARTNER_PREVIEW_OPERATORS].reverse().map(item => ({
    id: item.id, slug: item.slug, name: item.name, privateField: 'never-pass',
  }));
  const html = render({ user: 'fixture-admin', operators, operatorStatus: 'demo' });
  assert.match(html, /SG test game provider/);
  assert.match(html, /href="\/partner\/sg-test"/);
  assert.equal((html.match(/sg-btn-primary/g) ?? []).length, 1);
  assert.match(html, /<a class="sg-btn sg-btn-secondary" href="\/partner\/demo-north">Öppna arbetsyta →<\/a>/);
  assert.match(html, /<option value="demo-north" selected="">Demo North<\/option>/);
  assert.doesNotMatch(html, /never-pass|\/studio\/partner/);
  const list = html.slice(html.indexOf('operatorList'));
  const order = ['Demo North', 'Demo South', 'SG test game provider'];
  let cursor = -1;
  for (const name of order) {
    const at = list.indexOf(name);
    assert.ok(at > cursor, name);
    cursor = at;
  }
  assert.match(html, /<a class="sg-btn sg-btn-primary" href="\/control\/preview">/);
  assert.match(html, /Innehåll/);
  assert.match(html, /Publicering/);
  assert.doesNotMatch(html, /Konfigurera spelets bord|N2\.4/);
  assert.match(html, /href="\/control\/lanes"/);
  assert.match(html, /Nivå 2 · Spelbolag/);
  assert.match(html, /href="\/partner\/demo-north">Öppna spelbolagens arbetsytor →/);
  assert.match(html, /Nivå 3 · Spelare/);
  assert.match(html, /href="\/play">Öppna spelarytan →/);
  assert.equal((html.match(/class="quickItem"/g) ?? []).length, 3);
});

test('overview without operators shows an empty company list and keeps the level links', () => {
  const html = render({ user: 'fixture-admin', operatorStatus: 'live' });
  assert.match(html, /Anslutna bolag/);
  assert.match(html, /Inga bolag ännu\./);
  assert.doesNotMatch(html, /<select|Öppna arbetsyta/);
  assert.match(html, /href="\/partner">Öppna spelbolagens arbetsytor →/);
  assert.match(html, /href="\/play">Öppna spelarytan →/);
  assert.equal((html.match(/sg-btn-primary/g) ?? []).length, 1);
});


test('live, empty, unavailable and demonstration company states are visibly distinct', () => {
  const operators = [{ id: 'real', slug: 'real', name: 'Real Company' }];
  const live = render({ user: 'internal-admin', operators, operatorStatus: 'live' });
  assert.match(live, /Anslutna bolag/);
  assert.match(live, /href="\/play\?operator=real"/);
  assert.match(live, /förhandsvisning.*partnerinloggning och aktivt medlemskap/);
  assert.match(live, /href="\/partner\/login"/);
  const demo = render({ user: 'internal-admin', operators, operatorStatus: 'demo' });
  assert.match(demo, /Demonstrationsbolag/);
  assert.doesNotMatch(demo, /Anslutna bolag|\/play\?operator=/);
  const failure = render({ user: 'internal-admin', operators, operatorStatus: 'unavailable' });
  assert.match(failure, /Bolagslistan kunde inte hämtas/);
  assert.doesNotMatch(failure, /Real Company|Inga bolag ännu|<select/);
  const empty = render({ user: 'internal-admin', operators: [], operatorStatus: 'live' });
  assert.match(empty, /Inga bolag ännu/);
  assert.doesNotMatch(empty, /kunde inte hämtas|Demonstration/);
});

test('changing the selected live company updates both level links without carrying demos into player context', () => {
  let selected, setSelected;
  const hooks = { ...React, useEffect() {}, useState: initial => {
    selected ??= initial;
    setSelected = value => { selected = value; };
    return [selected, setSelected];
  } };
  const { ControlWorkspace: InteractiveWorkspace } = loadTs(new URL('../components/control-workspace.tsx', import.meta.url), { react: hooks });
  const props = { user: 'internal-admin', operatorStatus: 'live', operators: [{ id: 'north', slug: 'north', name: 'North' }, { id: 'south', slug: 'south', name: 'South' }] };
  const first = InteractiveWorkspace(props);
  let select;
  const visit = node => { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(visit); if (node.type === 'select') select = node; visit(node.props?.children); };
  visit(first);
  select.props.onChange({ target: { value: 'south' } });
  const html = renderToStaticMarkup(InteractiveWorkspace(props));
  assert.match(html, /href="\/play\?operator=south"/);
  assert.match(html, /href="\/partner\/south">Öppna spelbolagens arbetsytor/);
  assert.doesNotMatch(html, /\/play\?operator=north/);
});

test('built-in guide describes published company design and the current room publication workflow', () => {
  const guide = JSON.parse(readFileSync(new URL('../docs/guide.json', import.meta.url), 'utf8'));
  const publishing = guide.surfaces.find(item => item.name.startsWith('Publicering'));
  assert.match(publishing.purpose, /Skapa spelrum/);
  assert.doesNotMatch(publishing.purpose, /JSON-export/);
  const partner = guide.surfaces.find(item => item.name.startsWith('Partnerportal'));
  assert.match(partner.purpose, /bord och bakgrunder sparas på servern/);
  assert.doesNotMatch(partner.purpose, /kort och bord.*lokala prov/);
});
