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
const modeLabels = { off: 'Standard', rules: 'Regler', shadow: 'Skuggläge', active: 'Aktivt', random: 'Slump' };

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
      if (name === './gateway-panel') return { modeLabels, modeExplanations: modeLabels, GatewayPanel() { return null; } };
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
const base = { initialProject: project, initialVideos: { videos: [] }, initialStatus: { configured: false } };
const { ControlEventsPage } = loadTs(new URL('../components/control-events-page.tsx', import.meta.url));
const render = props => renderToStaticMarkup(React.createElement(ControlEventsPage, { ...base, ...props }));

test('events page drops the inner menu, game switch and chat shortcuts', () => {
  const html = render();
  assert.doesNotMatch(html, /class="event-sidebar"|studio-chat-shortcuts|Croupier Lab|Osparade ändringar|Roulette/);
  assert.match(html, /<h1>Händelser<\/h1>/);
  assert.match(html, /href="\/control\/events\?dealer=astrid">Tillbaka till översikten/);
  assert.match(html, /aria-label="Välj dealer"/);
  assert.match(html, /class="sg-chip"/);
  assert.match(html, /aria-label="Sök event"/);
  assert.match(html, /<button type="button" class="sg-btn sg-btn-primary" disabled="">Spara projekt<\/button>/);
  assert.match(html, /Exportera projekt/);
  assert.doesNotMatch(html, /class="studio-footer"/);
});

test('tab=triggers selects the condition library', () => {
  const html = render({ initialTab: 'triggers' });
  assert.match(html, /role="tab" aria-selected="true">Villkor/);
  assert.match(html, /aria-label="Triggerkategori"/);
  assert.match(html, /role="tab" aria-selected="false">Event/);
});

test('video review link keeps the selected variant', () => {
  const draft = createSeedProject();
  const line = draft.lines.find(item => item.dealerId === 'astrid' && item.eventId === 'speak.goodluck');
  line.variants[0].videoGenerationId = 'missing-video';
  const html = render({ initialProject: draft, initialEventId: 'speak.goodluck' });
  assert.match(html, /href="\/control\/videos\?dealer=astrid&amp;event=speak\.goodluck&amp;variant=/);
});

test('Astrid keeps the media-family editor and a Villkor tab', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../media/dealers/astrid/runtime/presentation/lab-video-manifest.json', import.meta.url), 'utf8'));
  const inventory = { families: manifest.families, videos: manifest.items.map(item => ({ ...item, available: true, fileName: item.relativePath.split('/').at(-1) })) };
  const html = render({ initialVideos: inventory, initialDealerId: 'astrid', initialEventId: 'speak.goodluck' });
  assert.match(html, /<h2>Klipp<\/h2>/);
  assert.match(html, /role="tab"[^>]*>Villkor/);
  assert.match(html, /aria-label="Välj dealer"/);
});

test('Grundloop links to content without duplicating the policy editor', () => {
  const html = render({ initialDealerId: 'astrid', initialEventId: 'idle.ready' });
  assert.match(html, /href="\/control\/clips#idle"/);
  assert.match(html, /Grundloop och klipp/);
  assert.doesNotMatch(html, /Spela en minut/);
});

test('Vera variants are stored but not used by the game yet', () => {
  const html = render({ initialDealerId: 'vera' });
  assert.match(html, /Varianter för Vera sparas i projektet men används inte av spelet ännu\./);
});
