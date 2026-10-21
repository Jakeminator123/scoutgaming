import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject as createBaseProject , addDealer} from '../../../packages/presentation/contracts/studio-model.mjs';
import { modeLabels, modeExplanations } from '../lib/director-modes.mjs';
import manifest from '../../../media/dealers/astrid/runtime/presentation/lab-video-manifest.json' with { type: 'json' };

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const empty = () => null;
let activityProps;
const navigationUrls = [];
const mocks = {
  'next/navigation': { usePathname: () => '/admin/events', useSearchParams: () => new URLSearchParams() },
  './studio-guide': { StudioGuide: empty },
  './event-tree': { EventTree: empty },
  './activity-log': { ActivityLog: props => { activityProps = props; return null; } },
  './stage': { Stage: () => React.createElement('section', { 'data-testid': 'table-preview' }) },
  './social-chat-panel': { SocialChatPanel: ({compact}) => React.createElement('section', { 'data-testid': 'table-chat', 'data-compact': String(compact) }) },
  './trigger-editor': { TriggerEditor: empty, categoryLabels: {}, defaultValue: () => null },
  './video-library': { VideoLibrary: empty, VariantVideoBinding: empty },
  './variant-selection': { VariantSelectionEditor: empty },
  './gateway-panel': { GatewayPanel: empty, modeLabels, modeExplanations },
  './idle-policy-editor': { IdlePolicyEditor: empty },
  './probe-editor': { ProbeEditor: empty },
  './project-conflict': { ProjectConflict: empty },
  './test-context': { TestContextPanel: empty, neutralContext: {} },
};
const componentCache = new Map();
function loadComponent(relativeFile) {
  const url = relativeFile instanceof URL ? relativeFile : new URL(relativeFile, import.meta.url);
  if (componentCache.has(url.href)) return componentCache.get(url.href);
  const source = readFileSync(url, 'utf8');
  const output = transformSync(source, { filename: fileURLToPath(url), jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  componentCache.set(url.href, module.exports);
  const localRequire = createRequire(url);
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams,
    window: { location: { assign: href => navigationUrls.push(href) } },
    require: name => {
      if (name.endsWith('.module.css') || name.endsWith('.css')) return { __esModule: true, default: {} };
      if (mocks[name]) return mocks[name];
      if (name.startsWith('./') || name.startsWith('../')) {
        for (const suffix of ['', '.tsx', '.ts', '.mjs', '.js']) {
          const candidate = new URL(name + suffix, url);
          if (!existsSync(candidate)) continue;
          const path = fileURLToPath(candidate);
          if (path.endsWith('.mjs') || path.endsWith('.js')) return localRequire(path);
          return loadComponent(candidate);
        }
      }
      return localRequire(name);
    },
  }, { filename: fileURLToPath(url) });
  return module.exports;
}
const { ControlEventsPage } = loadComponent('./control-events-page.tsx');
const selectedClip = { initialDealerId: 'astrid', initialEventId: 'speak.goodluck' };
const render = project => renderToStaticMarkup(React.createElement(ControlEventsPage, { ...selectedClip, initialProject: project, initialVideos: { videos: [] }, initialStatus: {} }));

test('manifest-owned studio displays real files and zero folder variants instead of the seed demos', () => {
  const inventory = { families: manifest.families, videos: manifest.items.map(item => ({ ...item, fileName: item.relativePath.split('/').at(-1), available: true })) };
  const project = createSeedProject(), before = JSON.stringify(project);
  const html = renderToStaticMarkup(React.createElement(ControlEventsPage, { ...selectedClip, initialProject: project, initialVideos: inventory, initialStatus: {} }));
  assert.match(html, /Standard och varianter/);
  const realClip = inventory.videos.find(video => video.relativePath === 'repliker/goodluck/goodluck.mp4');
  assert.ok(realClip);
  assert.ok(html.includes('title="' + realClip.id + '"'), 'friendly clip name retains the manifest-owned identity');
  assert.match(html, /Lycka till/);
  assert.match(html, /0 varianter — standardfilen används/);
  assert.doesNotMatch(html, /Rodnande tack|Lekfull dubbelvink|Välkommen tillbaka · tyska|Lägg till variant/);
  assert.equal(JSON.stringify(project), before);
  const { ControlTreePage } = loadComponent('./control-tree-page.tsx');
  const overview = renderToStaticMarkup(React.createElement(ControlTreePage, { ...selectedClip, initialProject: project, initialVideos: inventory, initialStatus: {} }));
  assert.match(overview, /deal\/deal_pos3/);
  assert.match(overview, /repliker\/goodluck/);
});

test('event test has one mode selector, explicit run action and result only after a real test', () => {
  const { EventTestPanel } = loadComponent('./event-test-panel.tsx');
  const props = { open: true, onOpen() {}, mode: 'off', onMode() {}, configured: false, context: {}, onContext() {}, dealer: 'Astrid', eventLabel: 'Bordet väntar', sourceType: 'idle', result: null, previewKind: null, busy: false, onRun() {} };
  const html = renderToStaticMarkup(React.createElement(EventTestPanel, props));
  assert.equal((html.match(/<option /g) ?? []).length, 5);
  assert.match(html, /Vem väljer klippet\?/);
  assert.match(html, /<details><summary>Vad betyder lägena\?/);
  assert.match(html, /Automatik, regler och OpenClaw/);
  assert.match(html, /Dessa testvärden hämtas inte från spelaren/);
  assert.doesNotMatch(html, /Visa exempelförlopp|Visa principen: tal först i startposition/);
  assert.doesNotMatch(html, /Återgå till OpenClaw/);
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

test('Guide, activity and OpenClaw stay free of the event sidebar', () => {
  const props = { ...selectedClip, initialProject: createSeedProject(), initialVideos: { videos: [] }, initialStatus: {} };
  const { ControlOpenClawChat } = loadComponent('./control-openclaw-chat.tsx');
  const openclaw = renderToStaticMarkup(React.createElement(ControlOpenClawChat, { ...props, standaloneVoicePreviewAvailable: true }));
  assert.doesNotMatch(openclaw, /class="event-sidebar"/);
  assert.doesNotMatch(openclaw, /aria-label="Huvudnavigation"|class="main-nav"|Backoffice\/Lab/);
  assert.doesNotMatch(openclaw, /<button[^>]*>[^<]*Spara projekt/);
  assert.match(openclaw, /href="\/admin\/dealer-agent(?:\?|"|&)/);
  const { ControlGuidePage } = loadComponent('./control-guide-page.tsx');
  const { ControlActivityPage } = loadComponent('./control-activity-page.tsx');
  for (const Page of [ControlGuidePage, ControlActivityPage]) {
    const html = renderToStaticMarkup(React.createElement(Page, props));
    assert.doesNotMatch(html, /class="event-sidebar"/);
    assert.doesNotMatch(html, /studio-chat-shortcuts/);
    assert.doesNotMatch(html, /<button[^>]*>[^<]*Spara projekt/);
    assert.doesNotMatch(html, /Osparade ändringar/);
    if (Page === ControlGuidePage) {
      assert.match(html, /<h1>Guide &amp; hjälp<\/h1>/);
      assert.doesNotMatch(html, /dealer=astrid/);
    } else {
      assert.match(html, /href="\/control\/clips\?dealer=astrid"/);
      assert.equal(activityProps.streamView.dealerId, 'astrid');
      navigationUrls.length = 0;
      activityProps.streamView.onOpenEvent('speak.goodluck', { eventId: 'speak.goodluck', blocked: false });
      assert.deepEqual(navigationUrls, ['/admin/events?dealer=astrid&event=speak.goodluck']);
    }
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
  for (const dealerId of ['elin', 'saga']) {
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
  assert.doesNotMatch(html, /studio-chat-shortcuts|Spelarchatt vid bordet →|Fråga OpenClaw om labbet →/);
  assert.equal(loadComponent('./studio-types.ts').viewPaths.activity, '/admin/rehearsal');
  assert.equal(loadComponent('./studio-types.ts').viewPaths.openclaw, '/admin/dealer-agent');
  assert.match(html, /<option value="off" selected="">Standard/);
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

// Explicit active dealers used by this isolated component fixture.
function createSeedProject(){return addDealer(addDealer(createBaseProject(),'elin','Elin'),'saga','Saga');}
