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
      if (name === 'next/navigation') return {useSearchParams:()=>new URLSearchParams(globalThis.window?.location?.search ?? ''),usePathname:()=>globalThis.window?.location?.pathname ?? '/control/clips'};
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
const props = { initialProject: project, initialVideos: { videos: [] }, initialStatus: { configured: false }, initialDealerId: 'astrid' };

function renderPage(file, override = {}) {
  const page = loadTs(new URL(`../components/${file}`, import.meta.url));
  const name = Object.keys(page).find(key => key.startsWith('Control'));
  return renderToStaticMarkup(React.createElement(page[name], {...props,...override}));
}

test('dealer and event query helpers ignore unknown values and keep only allowlisted tabs', () => {
  const { studioHref, resolveStudioDealerId, resolveStudioEventId, selectionHref } = loadTs(new URL('../components/studio-types.ts', import.meta.url));
  assert.equal(resolveStudioDealerId(project, 'vera'), 'vera');
  assert.equal(resolveStudioDealerId(project, 'nope'), '');
  assert.equal(resolveStudioDealerId(project), '');
  assert.equal(resolveStudioEventId(project, 'idle.ready'), 'idle.ready');
  assert.equal(resolveStudioEventId(project, 'missing'), 'speak.goodluck');
  assert.equal(studioHref('/control/events', { dealerId: 'astrid', eventId: 'idle.ready', tab: 'triggers' }), '/control/events?dealer=astrid&event=idle.ready&tab=triggers');
  assert.equal(studioHref('/control/openclaw', { dealerId: 'astrid', eventId: 'idle.ready', tab: 'chat' }), '/control/openclaw?dealer=astrid&event=idle.ready&tab=chat');
  assert.equal(studioHref('/control/tree', { dealerId: 'astrid', eventId: 'idle.ready', tab: 'nope' }), '/control/tree?dealer=astrid&event=idle.ready');
  assert.equal(selectionHref('/control/events', '?tab=variants&filter=x', 'mei', 'idle.ready'), '/control/events?dealer=mei&event=idle.ready&tab=variants');
  assert.equal(selectionHref('/control/tree', '?tab=variants', 'mei', 'idle.ready'), '/control/tree?dealer=mei&event=idle.ready');
  assert.equal(studioHref('/control/videos', { dealerId: 'mei', eventId: 'idle.ready', variantId: 'v2' }), '/control/videos?dealer=mei&event=idle.ready&variant=v2');
  assert.equal(selectionHref('/control/events', '?tab=variants', 'mei', 'idle.ready', 'v2'), '/control/events?dealer=mei&event=idle.ready&variant=v2&tab=variants');
  assert.equal(selectionHref('/control/videos', '', 'mei', 'idle.ready', 'v2'), '/control/videos?dealer=mei&event=idle.ready&variant=v2');
  assert.equal(selectionHref('/control/tree', '', 'mei', 'idle.ready', 'v2'), '/control/tree?dealer=mei&event=idle.ready');
});

test('tree, guide and activity pages drop the inner studio chrome and link the selected event', () => {
  for (const file of ['control-tree-page.tsx', 'control-guide-page.tsx']) {
    const html = renderPage(file);
    assert.doesNotMatch(html, /class="event-sidebar"|studio-chat-shortcuts|Croupier Lab|Osparade ändringar/, file);
    assert.doesNotMatch(html, /<button[^>]*>[^<]*Spara projekt/, file);
    if (file === 'control-tree-page.tsx') assert.ok(html.includes('/control/events?dealer=astrid&amp;event=speak.goodluck'), file);
    assert.match(html, /\/\/ STUDIO/, file);
  }
  const tree = renderPage('control-tree-page.tsx');
  assert.match(tree, /<h1>Spelhändelser &amp; villkor<\/h1>/);
  assert.doesNotMatch(tree, /Roulette/);
  const guide = renderPage('control-guide-page.tsx');
  assert.match(guide, /<h1>Guide &amp; hjälp<\/h1>/);
  const activity = renderPage('control-activity-page.tsx');
  assert.match(activity, /<h1>Provspelning &amp; logg<\/h1>/);
  assert.doesNotMatch(activity, /Lycka till|event=speak\.goodluck/);
  assert.match(activity, /Dealerprov/);
});

test('managed tree folders are real event links and dealer changes replace the query', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../media/dealers/astrid/runtime/presentation/lab-video-manifest.json', import.meta.url), 'utf8'));
  const inventory = { families: manifest.families, videos: manifest.items.map(item => ({ ...item, available: true, fileName: item.relativePath.split('/').at(-1) })) };
  const { ControlTreePage } = loadTs(new URL('../components/control-tree-page.tsx', import.meta.url));
  const html = renderToStaticMarkup(React.createElement(ControlTreePage, { ...props, initialVideos: inventory, initialDealerId: 'astrid', initialEventId: 'missing' }));
  assert.match(html, /href="\/control\/events\?dealer=astrid&amp;event=/);
  assert.match(html, /deal\/deal_pos3|repliker\/goodluck/);
  for (const family of manifest.families.filter(item => item.dealerId === 'astrid')) {
    const target = '/control/events?' + new URLSearchParams({dealer:'astrid',event:family.eventId,situation:family.situation});
    assert.ok(html.includes(target.replaceAll('&','&amp;')), 'exact family situation must survive: '+family.id);
  }
  const paths = [];
  const previous = globalThis.window;
  globalThis.window = { location: { pathname: '/control/tree', search: '' }, history: { replaceState: (_state, _title, path) => paths.push(path) }, addEventListener() {}, removeEventListener() {} };
  const session = loadTs(new URL('../components/studio-session.tsx', import.meta.url));
  try {
    let api;
    function Harness() { api = session.useStudioSession({ ...props, initialDealerId: 'astrid', initialEventId: 'speak.goodluck' }); return null; }
    renderToStaticMarkup(React.createElement(Harness));
    api.selectDealer('vera');
    api.selectDealer('unknown');
    assert.deepEqual(paths, ['/control/tree?dealer=vera&event=speak.goodluck']);
    globalThis.window.location.pathname = '/control/events';
    let overview;
    function Overview() { overview = session.useStudioSession({ ...props, overview: true, initialDealerId: 'astrid', initialEventId: 'speak.goodluck' }); return null; }
    renderToStaticMarkup(React.createElement(Overview));
    overview.selectDealer('mei');
    assert.equal(paths.at(-1), '/control/events?dealer=mei');
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});

test('recorded media guidance keeps old groups optional and distinguishes models from timed variation', () => {
  const html = renderPage('control-tree-page.tsx');
  assert.match(html, /<details[^>]*><summary>Avancerat · äldre händelsegrupper/);
  assert.doesNotMatch(html, /<details[^>]*open[^>]*><summary>Avancerat · äldre/);
  assert.match(html, /Automatisk grundloopvariation/);
  assert.match(html, /högst 8, totalt 3 200 tecken/);
  assert.match(html, /Dessa testvärden hämtas inte från spelaren/);
  assert.match(html, /<a href="\/control\/clips\?dealer=astrid">/);
  const activity = renderPage('control-activity-page.tsx');
  assert.match(activity, /<summary>Klippförhandsvisning och provspelning<\/summary>/);
  assert.match(activity, /AI-tal: inget förlopp observerat/);
  assert.match(activity, /Inspelade klipp: inga uppspelningskvitton ännu/);
});


test('rehearsal requires an explicit dealer or room and never starts a default observation',()=>{
 for(const initialDealerId of [undefined,'','unknown','amira']) {
  const html=renderPage('control-activity-page.tsx',{initialDealerId,initialOperatorSlug:'operator-42',initialLaneId:'mobile-phone'});
  assert.match(html,/Välj en dealer att provspela/);assert.doesNotMatch(html,/Anslut &amp; följ|Klippförhandsvisning och provspelning|Dealerprov/);
  for(const dealer of project.dealers.filter(row=>row.id!=='amira'))assert.ok(html.includes('/control/rehearsal?dealer='+dealer.id+'&amp;composition=mobile-phone&amp;operator=operator-42'));
 }
 const room=renderPage('control-activity-page.tsx',{initialDealerId:undefined,initialOperatorSlug:'operator-42',initialTableId:'room-7'});
 assert.match(room,/Spelrummets publicerade dealer/);assert.match(room,/room-7/);assert.doesNotMatch(room,/Välj en dealer att provspela|Separat Lab-preview/);
});


test('dealer editor routes gate missing and invalid dealers before mounting their media session',()=>{
 const previous=globalThis.window;
 try {
  for(const [file,path] of [['control-tree-page.tsx','/control/events'],['control-events-page.tsx','/control/events'],['control-videos-page.tsx','/control/videos'],['control-probe-page.tsx','/control/probe'],['control-openclaw-chat.tsx','/control/openclaw']])for(const initialDealerId of [undefined,'unknown','amira']) {
   globalThis.window={location:{pathname:path,search:'?composition=composition-1&operator=operator-42&table=room-7'}};
   const html=renderPage(file,{initialDealerId});assert.match(html,/<h2>Välj dealer<\/h2>/,file);assert.doesNotMatch(html,/<video|<audio|Klippförhandsvisning och provspelning/,file);
   for(const dealer of project.dealers.filter(row=>row.id!=='amira'))assert.ok(html.includes(path+'?dealer='+dealer.id+'&amp;composition=composition-1&amp;operator=operator-42&amp;table=room-7'),file+' keeps context for '+dealer.id);
  }
 } finally {if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
