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

test('Lanes renders the title and disables write buttons when no store is connected', () => {
  const pageSource = readFileSync(new URL('../app/control/lanes/page.tsx', import.meta.url), 'utf8');
  const componentSource = readFileSync(new URL('../components/control-lanes-page.tsx', import.meta.url), 'utf8');
  assert.match(pageSource, /title: 'Lanes · Croupier Studio'/);
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
  assert.match(html, /<h1>Lanes<\/h1>/);
  assert.match(html, /SG test game provider/);
  assert.match(html, /mobile-phone/);
  assert.match(html, /Demo North/);
  assert.match(html, /Demo South/);
  assert.match(html, /Publicering kräver anslutning till den sparade studion/);
  assert.match(html, />Exportera lanes \(JSON\)<\/button>/);
  const laneChoice=html.match(/<input[^>]*name="lanes"[^>]*value="mobile-phone"[^>]*>/)?.[0];
  assert.ok(laneChoice);
  assert.doesNotMatch(laneChoice,/disabled/,'offline can select saved lanes for export while publishing stays disabled');
  assert.match(html, /Administration → Spel, lanes &amp; bord/);
  assert.doesNotMatch(html, /\(osparad\)/);
  assert.match(componentSource, /\(osparad\)/);
  assert.doesNotMatch(componentSource, /window\.confirm/);
  assert.equal(html.match(/sg-btn-primary/g)?.length, 1);
  assert.equal(html.match(/primary-button/g)?.length ?? 0, 0);
  assert.match(html, /<button class="sg-btn sg-btn-primary"[^>]*disabled[^>]*>Spara projekt<\/button>/);
  assert.match(html, /<button class="sg-btn sg-btn-secondary"[^>]*disabled[^>]*>Publicera paket<\/button>/);
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
