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
      if (name === 'next/navigation') return { usePathname: () => '/control/videos', useSearchParams: () => new URLSearchParams() };
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
const base = { initialDealerId: 'astrid', initialEventId: 'speak.goodluck', initialProject: createSeedProject(), initialVideos: { videos: [] }, initialStatus: { configured: false } };
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
  assert.match(html, /<h1>Dealerns media<\/h1>/);
  assert.match(html, /\/\/ STUDIO/);
  assert.match(html, /<button[^>]*>Spara projekt<\/button>/);
  assert.match(html, /href="\/control\/events\?dealer=astrid&amp;event=speak\.goodluck"/);
  assert.match(html, /aria-label="Klipp och situationer"/);
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
  assert.match(html, /aria-label="Vald videokoppling"/);
  assert.match(html, /Koppling för: Vera · Lycka till · Kvällshälsning/);
  assert.match(html, /Händelse[\s\S]{0,120}<select/);
  assert.match(html, /Variant[\s\S]{0,120}<select/);
  assert.match(html, /<option value="vera\.speak\.goodluck\.extra" selected="">Kvällshälsning<\/option>/);
  assert.match(html, /href="\/control\/events\?dealer=vera&amp;event=speak\.goodluck"/);
  assert.match(html, /videokopplingar behöver kategoriseras eller kopplas loss/);
  assert.doesNotMatch(html, /Granska i Videobanken/);
  assert.doesNotMatch(html, /Dina videomappar/);
  assert.match(html, /Klipp och kopplingar/);
  assert.match(html, /V Vera/);
});

test('clip library shows one display-name override and keeps the single save button', () => {
  const project = createSeedProject();
  const clip = astridVideos.videos[0];
  project.clipLabels = { [clip.id]: 'Eget namn' };
  const html = render({ initialProject: project, initialVideos: astridVideos });
  const fileName = clip.fileName;
  assert.match(html, new RegExp(`value="Eget namn"`));
  assert.match(html, new RegExp(fileName));
  assert.match(html, new RegExp(clip.id));
  assert.match(html, />Eget namn</);
  assert.match(html, /Visningsnamn/);
  assert.equal(html.match(/<button[^>]*sg-btn-primary/g)?.length, 1);
  assert.equal(html.match(/>Spara projekt</g)?.length, 1);
  assert.doesNotMatch(html, /clipLabels|sha256/);
});

test('an unmanaged clip keeps the override in the library detail without a second save button', () => {
  const project = createSeedProject();
  const id = '11111111-1111-4111-8111-111111111111';
  const line = project.lines.find(item => item.dealerId === 'vera' && item.eventId === 'speak.goodluck');
  line.variants[0].videoGenerationId = id;
  project.clipLabels = { [id]: 'Kvällsnamn' };
  const video = {
    id, label: 'Originalnamn', fileName: 'kvall.mp4', verdict: 'unrated', bytes: 2048,
    sha256: 'ab'.repeat(32), available: false, previewUrl: '/api/videos/x',
    reviewStatus: 'unreviewed', integrity: 'unchecked', bindingScope: 'lab-only', dealer: 'vera',
    classification: { label: 'Originalnamn', dealerId: 'vera', eventId: 'speak.goodluck', kind: 'speech', role: 'standard', situation: 'goodluck', notes: '' },
  };
  const html = render({
    initialProject: project,
    initialVideos: { videos: [video] },
    initialDealerId: 'vera',
    initialEventId: 'speak.goodluck',
  });
  assert.match(html, /value="Kvällsnamn"/);
  assert.match(html, /kvall\.mp4/);
  assert.match(html, /11111111-1111-4111-8111-111111111111/);
  assert.match(html, /<h2>Kvällsnamn<\/h2>/);
  assert.match(html, /<strong>Kvällsnamn<\/strong>/);
  assert.match(html, /Originalnamn/);
  assert.equal(html.match(/<button[^>]*sg-btn-primary/g)?.length, 1);
  assert.doesNotMatch(html, /<label[^>]*>\s*Klipp/);
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
