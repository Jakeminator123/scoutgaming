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

const project = createSeedProject();
const props = { initialProject: project, initialVideos: { videos: [] }, initialStatus: { configured: false } };

test('speech review keeps the probe editor, a disabled save button and no old studio chrome', () => {
  const { ControlProbePage } = loadTs(new URL('./control-probe-page.tsx', import.meta.url));
  const html = renderToStaticMarkup(React.createElement(ControlProbePage, props));
  assert.match(html, /\/\/ DRIFT/);
  assert.match(html, /<h1>Talgranskning<\/h1>/);
  assert.match(html, /Astrids egna tal när spelaren är inaktiv/);
  assert.match(html, /aria-label="Probe för Astrid"/);
  assert.match(html, /<button[^>]*class="sg-btn sg-btn-primary"[^>]*disabled[^>]*>Spara projekt<\/button>/);
  assert.doesNotMatch(html, /class="event-sidebar"|studio-chat-shortcuts|studio-footer|Croupier Lab|sg-pill|Osparade ändringar/);
  const bare = { ...project };
  delete bare.probePolicy;
  const fallback = renderToStaticMarkup(React.createElement(ControlProbePage, { ...props, initialProject: bare }));
  assert.match(fallback, /aria-label="Probe för Astrid"/);
});

test('probe route loads studio data for /control/probe and tolerates a missing searchParams argument', () => {
  const source = readFileSync(new URL('../app/control/probe/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /loadControlStudio\('\/control\/probe'\)/);
  assert.match(source, /props\?\.searchParams/);
  assert.match(source, /firstQueryValue\(query\.dealer\)/);
  assert.match(source, /firstQueryValue\(query\.event\)/);
  assert.match(source, /title: 'Talgranskning · Croupier Studio'/);
  assert.match(source, /dynamic = 'force-dynamic'/);
});
