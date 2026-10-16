import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject as createBaseProject, addDealer, addVariant } from '../lib/studio-model.mjs';

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
      if (name === 'next/navigation') return { usePathname: () => '/control/events', useSearchParams: () => new URLSearchParams() };
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
const base = { initialProject: project, initialVideos: { videos: [] }, initialStatus: { configured: false }, initialDealerId: 'astrid' };
const { ControlEventsPage } = loadTs(new URL('../components/control-events-page.tsx', import.meta.url));
const render = props => renderToStaticMarkup(React.createElement(ControlEventsPage, { ...base, ...props }));

test('events page drops the inner menu, game switch and chat shortcuts', () => {
  const html = render();
  assert.doesNotMatch(html, /class="event-sidebar"|studio-chat-shortcuts|Croupier Lab|Osparade ändringar|Roulette/);
  assert.match(html, /<h1>Klippval &amp; villkor<\/h1>/);
  assert.match(html, /aria-label="Brödsmulor i Studio"/);
  assert.match(html, /aria-label="Studio för Astrid"/);
  assert.match(html, /href="\/control\/clips\?view=clips&amp;dealer=astrid&amp;event=speak\.goodluck&amp;variant=astrid\.speak\.goodluck\.standard"/);
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

test('normal event previews show missing-video status for registered and unbound dealers', () => {
  for (const dealerId of ['astrid', 'elin', 'linnea']) {
    for (const videoGenerationId of [null, 'missing-video']) {
      const draft = addDealer(createSeedProject(), 'linnea', 'Linnea');
      const line = draft.lines.find(item => item.dealerId === dealerId && item.eventId === 'speak.goodluck');
      line.variants[0].videoGenerationId = videoGenerationId;
      const html = render({ initialProject: draft, initialDealerId: dealerId, initialEventId: 'speak.goodluck' });
      assert.ok(/role="status">Ingen spelbar video för den här situationen/.test(html), `${dealerId}: missing video must show status`);
      assert.doesNotMatch(html, /2D-RESERV · LABB|Bara 2D|data-motion-asset|<iframe/);
    }
  }
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

test('retired Vera links require an active dealer before opening the event editor', () => {
  const html = render({ initialDealerId: 'vera' });
  assert.match(html, /<h2>Välj dealer<\/h2>/);
  assert.doesNotMatch(html, /Varianter för Vera|dealer=vera/);
});

test('own dealer event bindings explain save and republish and expose explicit condition editing',()=>{
  const draft=addDealer(createSeedProject(),'linnea','Linnea');
  const html=render({initialProject:draft,initialDealerId:'linnea',initialEventId:'idle.ready'});
  assert.match(html,/Varianter för Linnea sparas i utkastet/);
  assert.match(html,/Spara och publicera paketet igen/);
  assert.doesNotMatch(html,/Varianter för Linnea sparas i projektet men används inte/);
  assert.match(html,/role="tab"[^>]*>Villkor/);
});

test('dealing editor can add past five variants and clearly stops at sixteen; speech still stops at five',()=>{
  for(const [eventId,count,disabled] of [['deal.player.centre',5,false],['deal.player.centre',16,true],['speak.goodluck',5,true]]){
    let draft=addDealer(createSeedProject(),'dragan','Dragan');
    for(let index=1;index<count;index++)draft=addVariant(draft,'dragan',eventId);
    const html=render({initialProject:draft,initialDealerId:'dragan',initialEventId:eventId});
    const button=html.match(/<button[^>]*class="text-button add-variant"[^>]*>[\s\S]*?<\/button>/)?.[0];
    assert.ok(button,eventId);assert.equal(button.includes('disabled=""'),disabled,eventId+' '+count);
    assert.ok(button.includes(`${count-1}/${eventId.startsWith('deal.')?15:4}`));
  }
});

test('clip slot menu keeps the exact seat or dealer card when selecting an action', () => {
  const { EventsCatalog } = loadTs(new URL('./events-catalog.tsx', import.meta.url));
  const calls = [];
  const tree = EventsCatalog({ project, videos: { videos: [] }, dealerId: 'astrid', eventId: 'deal.player.right', situation: 'box6', managed: false, filter: '', onFilter() {}, onSelectDealer() {}, onSelectEvent: (...args) => calls.push(args) });
  const flatten = node => Array.isArray(node) ? node.flatMap(flatten) : !node || typeof node !== 'object' ? [] : [node, ...flatten(node.props?.children)];
  const select = flatten(tree).find(node => node.type === 'select' && node.props['aria-label'] === 'Välj klippfack');
  assert.ok(select);
  assert.equal(select.props.value, 'deal.player.right|box6');
  const options = flatten(select).filter(node => node.type === 'option');
  assert.equal(options.find(node => node.props.value === 'deal.player.right|box6')?.props.children, 'Spelarplats 7');
  assert.equal(options.find(node => node.props.value === 'deal.dealer|dealer-hole')?.props.children, 'Dealer · dolt kort');
  for (const value of ['deal.player.right|box6', 'deal.dealer|dealer-hole', 'reveal.dealer|dealer-hole']) select.props.onChange({ target: { value } });
  assert.deepEqual(calls, [['deal.player.right', 'box6'], ['deal.dealer', 'dealer-hole'], ['reveal.dealer', 'dealer-hole']]);
  const html = renderToStaticMarkup(tree);
  assert.doesNotMatch(html, /event-tree|role="tree"|Eventträd/);
  assert.match(html, /Ett klippfack per situation/);
});

test('events page requires an explicit dealer and handles an empty dealer register',()=>{
  const unselected=render({initialDealerId:undefined});
  assert.match(unselected,/<h2>Välj dealer<\/h2>/);assert.doesNotMatch(unselected,/aria-label="Sök event"/);
  const empty=render({initialDealerId:undefined,initialProject:{...project,dealers:[],lines:[]}});
  assert.match(empty,/Inga dealers har registrerats ännu/);assert.doesNotMatch(empty,/dealer=astrid/);
});

// Explicit active dealers used by this isolated component fixture.
function createSeedProject(){return addDealer(addDealer(createBaseProject(),'elin','Elin'),'saga','Saga');}
