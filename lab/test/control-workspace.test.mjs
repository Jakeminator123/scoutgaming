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

const { ControlWorkspace } = loadTs(new URL('../components/control-workspace.tsx', import.meta.url));

function render(props) {
  return renderToStaticMarkup(React.createElement(ControlWorkspace, props));
}

test('overview lists fixture operators alphabetically and makes composition primary with three Studio destinations', () => {
  const operators = [...PARTNER_PREVIEW_OPERATORS].reverse().map(item => ({
    id: item.id, slug: item.slug, name: item.name, privateField: 'never-pass',
  }));
  const html = render({ user: 'fixture-admin', operators });
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
  assert.match(html, /href="\/partner">Öppna spelbolagens arbetsytor →/);
  assert.match(html, /Nivå 3 · Spelare/);
  assert.match(html, /href="\/play">Öppna spelarytan →/);
  assert.equal((html.match(/class="quickItem"/g) ?? []).length, 3);
});

test('overview without operators shows an empty company list and keeps the level links', () => {
  const html = render({ user: 'fixture-admin' });
  assert.match(html, /Anslutna bolag/);
  assert.match(html, /Inga bolag ännu\./);
  assert.doesNotMatch(html, /<select|Öppna arbetsyta/);
  assert.match(html, /href="\/partner">Öppna spelbolagens arbetsytor →/);
  assert.match(html, /href="\/play">Öppna spelarytan →/);
  assert.equal((html.match(/sg-btn-primary/g) ?? []).length, 1);
});
