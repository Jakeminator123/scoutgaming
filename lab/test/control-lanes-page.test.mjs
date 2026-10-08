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
  const { ControlLanesPage } = loadTs(new URL('../components/control-lanes-page.tsx', import.meta.url));
  const html = renderToStaticMarkup(React.createElement(ControlLanesPage, {
    initialProject: createSeedProject(),
    operators: fixtureLaneOperators(),
    storeAvailable: false,
  }));
  assert.match(html, /<h1>Lanes<\/h1>/);
  assert.match(html, /SG test game provider/);
  assert.match(html, /mobile-phone/);
  assert.match(html, /Demo North/);
  assert.match(html, /Demo South/);
  assert.match(html, /Ingen skrivbar Neon-pool/);
  assert.equal(html.match(/primary-button/g).length, 1);
  assert.match(html, /<button class="primary-button"[^>]*disabled[^>]*>Publicera paket<\/button>/);
  assert.match(html, /<button class="sg-btn sg-btn-ghost"[^>]*disabled[^>]*>Skapa SG test game provider<\/button>/);
});
