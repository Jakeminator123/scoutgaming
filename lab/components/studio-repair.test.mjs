import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject } from '../lib/studio-model.mjs';
import manifest from '../../emil/dealklipp-v1/lab-video-manifest.json' with { type: 'json' };

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const empty = () => null;
const mocks = {
  './studio-guide': { StudioGuide: empty },
  './event-tree': { EventTree: empty },
  './activity-log': { ActivityLog: empty },
  './stage': { Stage: () => React.createElement('section', { 'data-testid': 'table-preview' }) },
  './social-chat-panel': { SocialChatPanel: ({compact}) => React.createElement('section', { 'data-testid': 'table-chat', 'data-compact': String(compact) }) },
  './trigger-editor': { TriggerEditor: empty, categoryLabels: {}, defaultValue: () => null },
  './video-library': { VideoLibrary: empty, VariantVideoBinding: empty },
  './variant-selection': { VariantSelectionEditor: empty },
  './gateway-panel': { GatewayPanel: empty, modeLabels: { off: 'Bara standard', rules: 'Regler', random: 'Slumpvariation', shadow: 'Skuggläge', active: 'OpenClaw' }, modeExplanations: { off: 'Alltid standardvarianten. Ingen modell kontaktas.' } },
  './idle-policy-editor': { IdlePolicyEditor: empty },
  './test-context': { TestContextPanel: empty, neutralContext: {} },
};
function loadComponent(relativeFile) {
  const source = readFileSync(new URL(relativeFile, import.meta.url), 'utf8');
  const output = transformSync(source, { filename: relativeFile, jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone,
    require: name => name.endsWith('.module.css') ? { __esModule: true, default: {} }
      : name === './studio-types' ? loadComponent('./studio-types.ts')
      : name === './event-test-panel' ? loadComponent('./event-test-panel.tsx')
      : name === './speech-source' ? loadComponent('./speech-source.tsx')
      : name === './media-family-editor' ? loadComponent('./media-family-editor.tsx')
      : name === './family-video-library' ? loadComponent('./family-video-library.tsx')
        : mocks[name] ?? require(name),
  }, { filename: relativeFile });
  return module.exports;
}
const { Studio } = loadComponent('./studio.tsx');
const render = project => renderToStaticMarkup(React.createElement(Studio, { initialProject: project, initialVideos: { videos: [] }, initialStatus: {} }));

test('manifest-owned studio displays real files and zero folder variants instead of the seed demos', () => {
  const inventory = { families: manifest.families, videos: manifest.items.map(item => ({ ...item, fileName: item.relativePath.split('/').at(-1), available: true })) };
  const project = createSeedProject(), before = JSON.stringify(project);
  const html = renderToStaticMarkup(React.createElement(Studio, { initialProject: project, initialVideos: inventory, initialStatus: {} }));
  assert.match(html, /Standard och varianter/);
  assert.match(html, /goodluck.mp4/);
  assert.match(html, /0 varianter — standardfilen används/);
  assert.doesNotMatch(html, /Rodnande tack|Lekfull dubbelvink|Välkommen tillbaka · tyska|Lägg till variant/);
  assert.equal(JSON.stringify(project), before);
  const overview = renderToStaticMarkup(React.createElement(Studio, { initialProject: project, initialVideos: inventory, initialStatus: {}, initialView: 'tree' }));
  assert.match(overview, /deal\/deal_pos3/);
  assert.match(overview, /repliker\/goodluck/);
});

test('event test has one mode selector, explicit run action and result only after a real test', () => {
  const { EventTestPanel } = loadComponent('./event-test-panel.tsx');
  const props = { open: true, onOpen() {}, mode: 'off', onMode() {}, configured: false, context: {}, onContext() {}, dealer: 'Astrid', eventLabel: 'Bordet väntar', sourceType: 'idle', result: null, previewKind: null, busy: false, onRun() {} };
  const html = renderToStaticMarkup(React.createElement(EventTestPanel, props));
  assert.equal((html.match(/<option /g) ?? []).length, 5);
  assert.match(html, /<details><summary>Avancerade jämförelsetester/);
  assert.match(html, /Återgå till OpenClaw/);
  assert.match(html, /Inget test kört/);
  assert.doesNotMatch(html, /VALD VARIANT|Tekniskt beslutsspår/);
  assert.match(html, /Lokalt test. Inget modellanrop/);
  const active = renderToStaticMarkup(React.createElement(EventTestPanel, { ...props, mode: 'active', busy: true }));
  assert.match(active, /OpenClaw är inte konfigurerat/);
  assert.match(active, /disabled="">Testar/);
  const result = renderToStaticMarkup(React.createElement(EventTestPanel, { ...props, result: { variant: { label: 'Standard' }, decision: { reason: 'ai_disabled' }, provider: 'off', eligible: [] } }));
  assert.match(result, /VALD VARIANT/);
  assert.match(result, /Tekniskt beslutsspår/);
  const original = renderToStaticMarkup(React.createElement(EventTestPanel, { ...props, originalLabel: 'Astrid · blackjack', result: { variant: { label: 'Standard' }, decision: { reason: 'accepted' }, provider: 'responded', eligible: [] } }));
  assert.match(original, /Originalförval · Astrid · blackjack/);
  assert.doesNotMatch(original, /ingen video vald/);
});

test('testsituation selection is derived from actual values, including custom edits', () => {
  const { TestContextPanel, neutralContext, contextPresets } = loadComponent('./test-context.tsx');
  const renderContext = value => renderToStaticMarkup(React.createElement(TestContextPanel, { value, onChange() {} }));
  for (const preset of contextPresets) {
    const html = renderContext(preset.value);
    assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
  }
  const custom = renderContext({ ...neutralContext, session: { recentWins: 7, recentLosses: 3 } });
  assert.match(custom, /Egna testvärden/);
  assert.doesNotMatch(custom, /aria-pressed="true"/);
});

test('Guide and OpenClaw are full-width surfaces without the unrelated event sidebar', () => {
  for (const initialView of ['guide', 'openclaw', 'activity']) {
    const html = renderToStaticMarkup(React.createElement(Studio, { initialProject: createSeedProject(), initialVideos: { videos: [] }, initialStatus: {}, initialView }));
    assert.doesNotMatch(html, /class="event-sidebar"/);
    assert.match(html, /href="\/guide"/);
  }
  assert.equal(loadComponent('./studio-types.ts').studioViewForPath('/guide'), 'guide');
  assert.equal(loadComponent('./studio-types.ts').studioViewForPath('/activity'), 'activity');
});

test('legacy incompatible selections are visible with a repair action and are not silently changed', () => {
  const project = createSeedProject();
  const event = project.events[0];
  const line = project.lines.find(item => item.dealerId === 'astrid' && item.eventId === event.id);
  const incompatible = project.assets.find(item => item.animation === 'deal-left');
  line.variants[0].assetId = incompatible.id;
  const before = JSON.stringify(project);
  const html = render(project);
  assert.match(html, /1 animationskopplingar behöver rättas/);
  assert.match(html, /Rätta första kopplingen/);
  assert.match(html, /Inget har ändrats automatiskt/);
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /disabled="" selected=""/);
  assert.match(html, /behöver bytas \(matchar inte eventet\)/);
  assert.equal(JSON.stringify(project), before);
});

test('normal seed does not show a repair warning or invalid animation option', () => {
  const html = render(createSeedProject());
  assert.doesNotMatch(html, /animationskopplingar behöver rättas/);
  assert.doesNotMatch(html, /behöver bytas \(matchar inte eventet\)/);
  assert.match(html, /aria-invalid="false"/);
});

test('repair banner counts problems outside the currently selected dealer and event', () => {
  const project = createSeedProject();
  const wave = project.assets.find(item => item.animation === 'wave');
  for (const dealerId of ['vera', 'mei']) {
    const line = project.lines.find(item => item.dealerId === dealerId && item.eventId === 'deal.player.left');
    line.variants[0].assetId = wave.id;
  }
  assert.match(render(project), /2 animationskopplingar behöver rättas/);
});

test('editor labels align with the selected node and distinguish event-test context from social chat', () => {
  const html = render(createSeedProject());
  assert.match(html, /data-testid="table-chat" data-compact="true"/);
  assert.ok(html.indexOf('data-testid="table-preview"') < html.indexOf('data-testid="table-chat"'));
  assert.ok(html.indexOf('data-testid="table-chat"') < html.indexOf('<strong>Testa event</strong>'));
  assert.equal((html.match(/data-testid="table-chat"/g) ?? []).length, 1);
  assert.match(html, /Redigera vald nod/);
  assert.match(html, /Valt event: Lycka till · Astrid/);
  assert.match(html, /<strong>Testa event<\/strong>/);
  assert.match(html, /Urvalsläge för eventtest/);
  assert.doesNotMatch(html, /decision-chain|Regeltest &amp; OpenClaw/);
  assert.match(html, /Spelarchatt med Astrid →/);
  assert.match(html, /Fråga OpenClaw om labbet →/);
  assert.match(html, /<option value="off" selected="">Bara standard/);
  assert.match(html, /kör jämförelseläget Bara standard/);
  assert.doesNotMatch(html, /Din regi|En tydlig kedja, hela vägen/);
  const { TestContextPanel, neutralContext } = loadComponent('./test-context.tsx');
  const contextHtml = renderToStaticMarkup(React.createElement(TestContextPanel, { value: neutralContext, onChange() {} }));
  assert.match(contextHtml, /Välj testsituation/);
  assert.match(contextHtml, /simulerad kontext för variantvalet/);
  assert.match(contextHtml, /hämtar inga livesignaler och styr inte Astrid-chatten/);
  assert.match(contextHtml, /<details><summary>Justera testvärden/);
  assert.match(contextHtml, /aria-pressed="true">Neutral/);
  assert.doesNotMatch(contextHtml, /Vad vet croupiern just nu/);
});
