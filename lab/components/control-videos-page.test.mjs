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

const { ControlVideosPage } = loadTs(new URL('./control-videos-page.tsx', import.meta.url));
const base = { initialProject: createSeedProject(), initialVideos: { videos: [] }, initialStatus: { configured: false } };
const manifest = JSON.parse(readFileSync(new URL('../../media/dealers/astrid/runtime/presentation/lab-video-manifest.json', import.meta.url), 'utf8'));
const astridVideos = {
  families: manifest.families,
  videos: manifest.items.map(item => ({ ...item, available: true, fileName: item.relativePath.split('/').at(-1) })),
};

function render(props) {
  return renderToStaticMarkup(React.createElement(ControlVideosPage, { ...base, ...props }));
}

test('clip library drops the inner sidebar, roulette and chat shortcuts', () => {
  const html = render({ initialVideos: astridVideos });
  assert.doesNotMatch(html, /class="event-sidebar"|studio-chat-shortcuts|Croupier Lab|Osparade ändringar|Exportera projekt/);
  assert.doesNotMatch(html, /Roulette/);
  assert.match(html, /class="sg-chip" aria-pressed="true"/);
  assert.match(html, /A Astrid/);
  assert.match(html, /<h1>Klippbibliotek<\/h1>/);
  assert.match(html, /\/\/ STUDIO/);
  assert.match(html, /<button[^>]*>Spara projekt<\/button>/);
  assert.match(html, /href="\/control\/events\?dealer=astrid&amp;event=speak\.goodluck"/);
  assert.match(html, /Dina videomappar/);
  assert.doesNotMatch(html, /Koppling för:/);
  assert.doesNotMatch(html, /Dina videor\. Ordning från början/);
});

test('unmanaged dealers keep the video library, binding row and exact variant', () => {
  const project = createSeedProject();
  const line = project.lines.find(item => item.dealerId === 'vera' && item.eventId === 'speak.goodluck');
  line.variants.push({
    id: 'vera.speak.goodluck.extra',
    label: 'Kvällshälsning',
    priority: 10,
    triggerIds: [],
    assetId: line.variants[0].assetId,
    videoGenerationId: null,
    selection: { rules: false, model: false, random: false },
  });
  line.variants[0].videoGenerationId = 'missing-video';
  const html = render({
    initialProject: project,
    initialDealerId: 'vera',
    initialEventId: 'speak.goodluck',
    initialVariantId: 'vera.speak.goodluck.extra',
  });
  assert.match(html, /Dina videor\. Ordning från början/);
  assert.match(html, /Koppling för: Vera · Lycka till · Kvällshälsning/);
  assert.match(html, /Händelse[\s\S]{0,120}<select/);
  assert.match(html, /Variant[\s\S]{0,120}<select/);
  assert.match(html, /<option value="vera\.speak\.goodluck\.extra" selected="">Kvällshälsning<\/option>/);
  assert.match(html, /href="\/control\/events\?dealer=vera&amp;event=speak\.goodluck"/);
  assert.match(html, /videokopplingar behöver kategoriseras eller kopplas loss/);
  assert.doesNotMatch(html, /Granska i Videobanken/);
  assert.doesNotMatch(html, /Dina videomappar/);
  assert.match(html, /Klippflöden och äldre kopplingar/);
  assert.match(html, /V Vera/);
});

test('videos page reads optional search params and the stream lane on the server', () => {
  const source = readFileSync(new URL('../app/control/videos/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /dynamic = 'force-dynamic'/);
  assert.match(source, /Klippbibliotek · Croupier Studio/);
  assert.match(source, /loadControlStudio\('\/control\/videos'\)/);
  assert.match(source, /props\?\.searchParams/);
  assert.match(source, /CROUPIER_STREAM_LANE === 'lissabon-stream-lane'/);
  assert.match(source, /initialVariantId/);
});
