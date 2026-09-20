import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject } from '../lib/studio-model.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

function loadTs(relativeFile) {
  const source = readFileSync(new URL(relativeFile, import.meta.url), 'utf8');
  const output = transformSync(source, { filename: relativeFile, jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  vm.runInNewContext(output.code, {
    module,
    exports: module.exports,
    require: name => name.endsWith('.module.css') ? { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
      : name === './gateway-panel' ? { modeLabels: { off: 'Standard', rules: 'Regler', shadow: 'Skuggläge', active: 'Aktivt' } }
        : require(name),
  }, { filename: relativeFile });
  return module.exports;
}

const { EventTree } = loadTs('./event-tree.tsx');
const { studioViewForPath, viewPaths } = loadTs('./studio-types.ts');

function render(project, overrides = {}) {
  const line = project.lines.find(item => item.dealerId === 'astrid');
  return renderToStaticMarkup(React.createElement(EventTree, {
    project, inventory: { videos: [] }, dealerId: 'astrid',
    event: project.events.find(item => item.id === line.eventId), line, variant: line.variants[0], mode: 'rules',
    onSelectDealer() {}, onSelectEvent() {}, onSelectVariant() {}, onEdit() {}, onVideos() {}, onOpenClaw() {},
    ...overrides,
  }));
}

test('node tree displays all four dealers, sixteen lab nodes and the fixed six-type distinction', () => {
  const project = createSeedProject();
  const before = JSON.stringify(project);
  const html = render(project);
  for (const dealer of project.dealers) assert.ok(html.includes(dealer.label));
  for (const event of project.events) assert.ok(html.includes(event.label));
  assert.match(html, /16 labbnoder över 6 motortyper/);
  assert.match(html, /inte nya händelser i Kevins spelmotor/);
  assert.match(html, /STANDARD \/ FALLBACK/);
  assert.equal(JSON.stringify(project), before, 'rendering must not mutate policy');
});

test('tree renders actual saved variant count without filling missing demo alternatives', () => {
  const project = createSeedProject();
  const line = project.lines.find(item => item.dealerId === 'astrid');
  line.variants = line.variants.slice(0, 2);
  const html = render(project);
  assert.match(html, /05 · 2 VARIANTER I DEN HÄR LINJEN/);
  assert.equal((html.match(/class="variantNode/g) ?? []).length, 2);
});

test('tree shows two high-level trigger groups and bounded OpenClaw fallback, not a third UI group', () => {
  const html = render(createSeedProject());
  assert.match(html, /Spelstyrda/);
  assert.match(html, /Sociala \/ uttryck/);
  assert.match(html, /Får föreslå endast bland tillåtna varianter/);
  assert.match(html, /Fel \/ inget svar → standard/);
  assert.doesNotMatch(html, />Temperament</);
});

test('bound video is shown by exact ID and unavailable files are not represented as usable or approved', () => {
  const project = createSeedProject();
  const line = project.lines.find(item => item.dealerId === 'astrid');
  const id = '12345678-1234-4321-8765-123456789abc';
  line.variants[0].videoGenerationId = id;
  const html = render(project);
  assert.match(html, /EXAKT VIDEOMÅL/);
  assert.ok(html.includes(id));
  assert.match(html, /Original saknas \/ inte tillgängligt lokalt/);
  assert.doesNotMatch(html, /Original tillgängligt/);
});

test('available original is explicitly not a visual approval', () => {
  const project = createSeedProject();
  const line = project.lines.find(item => item.dealerId === 'astrid');
  const id = '12345678-1234-4321-8765-123456789abc';
  line.variants[0].videoGenerationId = id;
  const html = render(project, { inventory: { videos: [{ id, available: true, label: 'Exakt original', fileName: `${id}.mp4` }] } });
  assert.match(html, /Exakt original/);
  assert.match(html, /Original tillgängligt · ej visuellt godkänt/);
});

test('history route mapping includes tree without matching unrelated prefixes', () => {
  assert.equal(viewPaths.tree, '/tree');
  assert.equal(studioViewForPath('/tree'), 'tree');
  assert.equal(studioViewForPath('/tree/'), 'tree');
  assert.equal(studioViewForPath('/videos'), 'videos');
  assert.equal(studioViewForPath('/openclaw'), 'openclaw');
  assert.equal(studioViewForPath('/'), 'lab');
  assert.equal(studioViewForPath('/treehouse'), 'lab');
});

test('generic speech lab node warns that one file cannot serve every exact source line', () => {
  const project = createSeedProject();
  const event = project.events.find(item => item.id === 'speak.other');
  const line = project.lines.find(item => item.dealerId === 'astrid' && item.eventId === event.id);
  const html = render(project, { event, line, variant: line.variants[0] });
  assert.match(html, /samlar flera exakta replik-ID:n/);
  assert.match(html, /Riktigt tal kräver exakt text, ljud, video och godkänd synk/);
});
