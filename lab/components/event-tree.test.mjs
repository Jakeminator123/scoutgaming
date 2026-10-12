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
const mediaManifest = JSON.parse(readFileSync(new URL('../../media/dealers/astrid/runtime/presentation/lab-video-manifest.json', import.meta.url), 'utf8'));
const mediaInventory = {
  families: mediaManifest.families,
  videos: mediaManifest.items.map(item => ({ ...item, available: true, fileName: item.relativePath.split('/').at(-1) })),
};

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
  assert.match(html, new RegExp(`${project.events.length} labbnoder över 6 presentationstyper`));
  assert.match(html, /inte nya händelser i Kevins spelmotor/);
  assert.match(html, /STANDARD \/ FALLBACK/);
  assert.equal(JSON.stringify(project), before, 'rendering must not mutate policy');
});

test('tree renders actual saved variant count without filling missing demo alternatives', () => {
  const project = createSeedProject();
  const line = project.lines.find(item => item.dealerId === 'astrid');
  line.variants.push({ ...structuredClone(line.variants[0]), id: line.variants[0].id + '-custom', label: 'Own saved variant' });
  const html = render(project);
  assert.match(html, /06 · 2 VARIANTER FÖR SAMMA BEHOV/);
  assert.equal((html.match(/class="variantNode/g) ?? []).length, 2);
});

test('tree shows two high-level trigger groups and bounded OpenClaw fallback, not a third UI group', () => {
  const html = render(createSeedProject());
  assert.match(html, /Spelstyrda/);
  assert.match(html, /Sociala \/ uttryck/);
  assert.match(html, /Får föreslå endast bland tillåtna varianter/);
  assert.match(html, /Fel \/ inget svar → standard/);
  assert.doesNotMatch(html, />Temperament</);
  const triggerSection = html.match(/<section class="controlPanel"[\s\S]*?<\/section>/)?.[0];
  assert.ok(triggerSection);
  assert.doesNotMatch(triggerSection, /OpenClaw/);
  assert.match(html, /Beslut &amp; ansvar · OpenClaw är ingen triggerkategori/);
  assert.match(triggerSection, /före uppspelning — inte som ett extra klipp efteråt/);
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
  assert.equal(viewPaths.tree, '/control/tree');
  assert.equal(studioViewForPath('/control/tree'), 'tree');
  assert.equal(studioViewForPath('/tree'), 'tree');
  assert.equal(studioViewForPath('/tree/'), 'tree');
  assert.equal(studioViewForPath('/control/videos'), 'videos');
  assert.equal(studioViewForPath('/videos'), 'videos');
  assert.equal(viewPaths.openclaw, '/control/openclaw?tab=chat');
  assert.equal(studioViewForPath(viewPaths.openclaw), 'openclaw');
  assert.equal(studioViewForPath('/control/operator-chat'), 'openclaw');
  assert.equal(studioViewForPath('/operator-chat'), 'openclaw');
  assert.equal(studioViewForPath('/control/openclaw'), 'lab', 'model settings are a separate document page');
  assert.equal(studioViewForPath('/openclaw'), 'lab', 'model settings are a separate document page');
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

test('tree keeps event groups and exposes exact media families, pools and inactive variants beneath them', () => {
  const project = createSeedProject();
  const event = project.events.find(item => item.id === 'speak.other');
  const line = project.lines.find(item => item.dealerId === 'astrid' && item.eventId === event.id);
  const html = render(project, { event, line, variant: line.variants[0], inventory: mediaInventory });
  assert.match(html, /14 exakta mediefamiljer/);
  for (const situation of ['greeting', 'placebets', 'blackjack']) assert.match(html, new RegExp(`Mediefamilj ${situation}`));
  assert.match(html, /3 exakta mediefamiljer/);
  for (const situation of ['box2', 'box3', 'box4']) assert.match(html, new RegExp(`Mediefamilj ${situation}`));
  assert.match(html, /0 varianter — standard används/);
  assert.match(html, /Standardpool · engångsvarianter återgår till poolen/);
  assert.match(html, /idle_insulted_f73_s301\.mp4/);
  assert.match(html, /Manuell\/inaktiv tills en explicit granskad projektpolicy/);
  assert.match(html, /Mappplacering aktiverar aldrig OpenClaw/);
});

function renderEvent(project, id) {
  const event = project.events.find(item => item.id === id);
  const line = project.lines.find(item => item.dealerId === 'astrid' && item.eventId === id);
  return render(project, { event, line, variant: line.variants[0] });
}

test('concrete deal example precedes expression choice and preserves zero and false fields', () => {
  const project = createSeedProject();
  const html = renderEvent(project, 'deal.player.left');
  assert.match(html, /LABBEXEMPEL · INTE LIVE/);
  assert.match(html, /<code>type<\/code><\/dt><dd>deal<\/dd>/);
  assert.match(html, /<code>box<\/code><\/dt><dd>0<\/dd>/);
  assert.match(html, /<code>handIndex<\/code><\/dt><dd>0<\/dd>/);
  assert.match(html, /<code>faceDown<\/code><\/dt><dd>false<\/dd>/);
  assert.match(html, /<code>shoeDraw<\/code><\/dt><dd>2<\/dd>/);
  assert.ok(html.indexOf('03 · INDATA OCH FÖRVÄNTAT RESULTAT') < html.indexOf('04 · EN STANDARD + DINA ALTERNATIV'));
  assert.match(html, /Kortposition behöver härledas/);
  assert.match(html, /är dragets ID, inte kortets ordningsnummer i handen/);
  assert.doesNotMatch(html, /<code>cardPosition<\/code>/);
});

test('dealer example preserves null destinations without inventing a box or hand', () => {
  const html = renderEvent(createSeedProject(), 'deal.dealer');
  assert.match(html, /<code>to<\/code><\/dt><dd>dealer<\/dd>/);
  assert.match(html, /<code>box<\/code><\/dt><dd>null<\/dd>/);
  assert.match(html, /<code>handIndex<\/code><\/dt><dd>null<\/dd>/);
  assert.match(html, /<code>faceDown<\/code><\/dt><dd>true<\/dd>/);
});

test('goodluck clarifies exact speech without overwriting an existing greeting label', () => {
  const project = createSeedProject();
  const line = project.lines.find(item => item.dealerId === 'astrid' && item.eventId === 'speak.goodluck');
  line.variants.find(item => item.id === line.baselineVariantId).label = 'Min sparade hälsning';
  const before = JSON.stringify(project);
  const html = renderEvent(project, 'speak.goodluck');
  assert.match(html, /<code>line<\/code><\/dt><dd>goodluck<\/dd>/);
  assert.match(html, /betyder ”Lycka till” inför spel, inte en separat välkomsthändelse/);
  assert.match(html, /Min sparade hälsning/);
  assert.doesNotMatch(html, /<code>shoeDraw<\/code><\/dt>/);
  assert.equal(JSON.stringify(project), before);
});

test('output groups retain all technical event identities and distinguish context from selection', () => {
  const html = renderEvent(createSeedProject(), 'deal.player.centre');
  for (const label of ['Idle / bakgrund', 'Handling / engång', 'Tal / exakt replik', 'Tur / resultat']) assert.ok(html.includes(label));
  assert.match(html, /Filtrera efter presentationssätt/);
  assert.match(html, /Box 0–6 är plats 1–7/);
  assert.match(html, /Detta är inget playerId/);
  assert.match(html, /Markerad variant · ännu inget testbeslut/);
  assert.match(html, /2D-längd från materialets metadata/);
  assert.match(html, /variantId<\/code> är urvalets svar/);
  assert.match(html, /Saknas i detta exempel/);
  assert.match(html, /<code>clip.prefer<\/code>/);
});

test('idle presentation does not claim loops or chat are triggered by an idle event', () => {
  const html = renderEvent(createSeedProject(), 'idle.ready');
  assert.match(html, /Dagens videopreview spelas en gång/);
  assert.match(html, /Ett idle-event startar inte i sig en chatt eller ett nytt talat svar/);
  assert.match(html, /högst 6 sekunder/);
});

test('tree distinguishes current single-clip binding from proposed take pools and video coverage', () => {
  const project = createSeedProject();
  const html = render(project);
  assert.match(html, new RegExp(`${project.events.length} grupper är inte ${project.events.length} videobehov`));
  assert.match(html, /Ett klippval per variant/);
  assert.match(html, /Inget viktat takeval görs/);
  assert.match(html, /SENARE \/ FÖRSLAG/);
  assert.match(html, /Pooler, vikter och extra reaktionssekvenser finns inte i dagens schema/);
  assert.match(html, /En standardpost bevisar inte att dess video passar situationen eller är godkänd/);
});
