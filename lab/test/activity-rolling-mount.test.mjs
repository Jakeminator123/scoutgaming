import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject } from '../lib/studio-model.mjs';

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

test('Uppspelning mounts the rolling observation window and keeps Ny observation', () => {
  const pageSource = readFileSync(new URL('../components/control-activity-page.tsx', import.meta.url), 'utf8');
  const logSource = readFileSync(new URL('../components/activity-log.tsx', import.meta.url), 'utf8');
  // Rolling without focused: the page keeps Partner SSE and the reference capture.
  assert.match(pageSource, /<ActivityLog[\s\S]*?\brolling\b/);
  assert.doesNotMatch(pageSource, /<ActivityLog[\s\S]*?\bfocused\b/);
  assert.match(logSource, /createPartnerTrace\(\{\s*rolling\s*\}\)/);
  const { ControlActivityPage } = loadTs(new URL('../components/control-activity-page.tsx', import.meta.url));
  const html = renderToStaticMarkup(React.createElement(ControlActivityPage, {
    initialProject: createSeedProject(),
    initialVideos: { videos: [] },
    initialStatus: { configured: false },
  }));
  assert.match(html, /<h1>Uppspelning<\/h1>/);
  assert.match(html, /Live-observationen fortsätter löpande/);
  assert.match(html, /0 senaste poster/);
  assert.match(html, />Ny observation</);
  assert.doesNotMatch(html, /Protokollet finns kvar mellan labbets vyer/);
  // Nothing reachable before this change may disappear.
  assert.match(html, /Visa spelfliken här/);
  assert.match(html, /Partner SSE är kompletterande instruktioner/);
  assert.match(html, /0\/150/);
  assert.match(html, /href="\/control\/events\?dealer=astrid&amp;event=speak\.goodluck"/);
});
