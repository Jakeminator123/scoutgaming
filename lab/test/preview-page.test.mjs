import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

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

test('Förhandsvisning shows the layer-trial title, intro and source line', () => {
  const pageSource = readFileSync(new URL('../app/control/preview/page.tsx', import.meta.url), 'utf8');
  assert.match(pageSource, /title: 'Förhandsvisning · Croupier Studio'/);
  assert.match(pageSource, /authorizeUiPage\(/);
  assert.doesNotMatch(pageSource, /loadControlStudio|studioUiInitialData/);
  const { ControlPreviewPage } = loadTs(new URL('../components/control-preview-page.tsx', import.meta.url));
  const html = renderToStaticMarkup(React.createElement(ControlPreviewPage));
  assert.match(html, /\/\/ STUDIO/);
  assert.match(html, /<h1>Förhandsvisning<\/h1>/);
  assert.match(html, /Lagerprov från grenen test-video-jakob: bakgrund, bord och dealer som separata lager \(Paow och Dragge, 720p\)\. Ett prov, inte en spelväg; ingen koppling till spelmotor, saldo eller produktion\./);
  assert.match(html, /Material: test-videoeditor\/preview\/site \(gren test-video-jakob\), hashar verifierade vid bygget\./);
  assert.match(html, /<iframe[^>]*title="Förhandsvisning · lagerprov"[^>]*src="[^"]*\/preview\/index\.html"/);
});
