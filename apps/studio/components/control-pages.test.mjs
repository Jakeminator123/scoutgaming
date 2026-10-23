import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject as createBaseProject , addDealer} from '../../../packages/presentation/contracts/studio-model.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const modeLabels = { off: 'Standard', rules: 'Regler', shadow: 'Skuggläge', active: 'Aktivt', random: 'Slump' };

function loadTs(fileUrl, overrides = {}) {
  const source = readFileSync(fileUrl, 'utf8');
  const output = transformSync(source, { filename: fileURLToPath(fileUrl), jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  const localRequire = createRequire(fileUrl);
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams, AbortController,
    window: new Proxy({}, { get: (_target, key) => globalThis.window?.[key] }),
    require: name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.endsWith('.module.css') || name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name === 'next/navigation') return {useSearchParams:()=>new URLSearchParams(globalThis.window?.location?.search ?? ''),usePathname:()=>globalThis.window?.location?.pathname ?? '/admin/dealer-studio'};
      if (name === './gateway-panel') return { modeLabels, modeExplanations: modeLabels, GatewayPanel() { return null; } };
      if (name.startsWith('./') || name.startsWith('../')) {
        for (const suffix of ['', '.tsx', '.ts', '.mjs', '.js']) {
          const candidate = new URL(name + suffix, fileUrl);
          const path = fileURLToPath(candidate);
          if (!existsSync(path)) continue;
          if (path.endsWith('.mjs') || path.endsWith('.js') || path.endsWith('.json')) return localRequire(path);
          return loadTs(pathToFileURL(path), overrides);
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
  assert.equal(resolveStudioDealerId(project, 'elin'), 'elin');
  assert.equal(resolveStudioDealerId(project, 'nope'), '');
  assert.equal(resolveStudioDealerId(project), '');
  assert.equal(resolveStudioEventId(project, 'idle.ready'), 'idle.ready');
  assert.equal(resolveStudioEventId(project, 'missing'), 'speak.goodluck');
  assert.equal(studioHref('/admin/events', { dealerId: 'astrid', eventId: 'idle.ready', tab: 'triggers' }), '/admin/events?dealer=astrid&event=idle.ready&tab=triggers');
  assert.equal(studioHref('/control/openclaw', { dealerId: 'astrid', eventId: 'idle.ready', tab: 'chat' }), '/admin/dealer-agent?dealer=astrid&event=idle.ready');
  assert.equal(studioHref('/admin/events', { dealerId: 'astrid', eventId: 'idle.ready', tab: 'nope' }), '/admin/events?dealer=astrid&event=idle.ready');
  assert.equal(selectionHref('/admin/events', '?tab=variants&filter=x', 'saga', 'idle.ready'), '/admin/events?dealer=saga&event=idle.ready&tab=variants');
  assert.equal(studioHref('/admin/videos', { dealerId: 'saga', eventId: 'idle.ready', variantId: 'v2' }), "/admin/clips?dealer=saga&event=idle.ready&variant=v2");
  assert.equal(selectionHref('/admin/events', '?tab=variants', 'saga', 'idle.ready', 'v2'), '/admin/events?dealer=saga&event=idle.ready&variant=v2&tab=variants');
  assert.equal(selectionHref('/admin/videos', '', 'saga', 'idle.ready', 'v2'), "/admin/clips?dealer=saga&event=idle.ready&variant=v2");
  assert.equal(selectionHref('/admin/events', '', 'saga', 'idle.ready', 'v2'), '/admin/events?dealer=saga&event=idle.ready&variant=v2');
});

test('managed tree folders are real event links and dealer changes replace the query', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../../media/dealers/astrid/runtime/presentation/lab-video-manifest.json', import.meta.url), 'utf8'));
  const inventory = { families: manifest.families, videos: manifest.items.map(item => ({ ...item, available: true, fileName: item.relativePath.split('/').at(-1) })) };
  const { ControlTreePage } = loadTs(new URL('../components/control-tree-page.tsx', import.meta.url));
  const html = renderToStaticMarkup(React.createElement(ControlTreePage, { ...props, initialVideos: inventory, initialDealerId: 'astrid', initialEventId: 'missing' }));
  assert.match(html, /href="\/admin\/events\?dealer=astrid&amp;event=/);
  assert.match(html, /deal\/deal_pos3|repliker\/goodluck/);
  for (const family of manifest.families.filter(item => item.dealerId === 'astrid')) {
    const target = '/admin/events?' + new URLSearchParams({dealer:'astrid',event:family.eventId,situation:family.situation});
    assert.ok(html.includes(target.replaceAll('&','&amp;')), 'exact family situation must survive: '+family.id);
  }
  const paths = [];
  const previous = globalThis.window;
  const location = new URL('https://studio.fixture.invalid/admin/events');
  let historyState = { foreign: 'keep', __NA: true, __scoutAdminHistory: {session:'existing-admin',index:7,href:'/admin/events'} };
  globalThis.window = { location, history: {
    get state() { return historyState; },
    replaceState(state, _title, path) { historyState = state; if(path !== undefined) { paths.push(path); location.href = new URL(path, location).href; } },
  }, addEventListener() {}, removeEventListener() {} };
  const session = loadTs(new URL('../components/studio-session.tsx', import.meta.url));
  try {
    let api;
    function Harness() { api = session.useStudioSession({ ...props, initialDealerId: 'astrid', initialEventId: 'speak.goodluck' }); return null; }
    renderToStaticMarkup(React.createElement(Harness));
    api.selectDealer('elin');
    api.selectDealer('unknown');
    assert.deepEqual(paths, ['/admin/events?dealer=elin&event=speak.goodluck']);
    globalThis.window.location.pathname = '/admin/events';
    let overview;
    function Overview() { overview = session.useStudioSession({ ...props, overview: true, initialDealerId: 'astrid', initialEventId: 'speak.goodluck' }); return null; }
    renderToStaticMarkup(React.createElement(Overview));
    overview.selectDealer('saga');
    assert.equal(paths.at(-1), '/admin/events?dealer=saga');
    assert.equal(historyState.foreign, 'keep');
    assert.equal(historyState.__NA, true);
    assert.equal(historyState.__scoutAdminHistory.session, 'existing-admin');
    assert.equal(historyState.__scoutAdminHistory.index, 7);
    assert.equal(historyState.__scoutAdminHistory.href, '/admin/events?dealer=saga');
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});



test('event tree opens the Admin dealer agent with the selected dealer and event', () => {
  const previous = globalThis.window, destinations = [];
  globalThis.window = {location:{pathname:'/admin/events',search:'?dealer=saga&event=idle.ready',assign:href=>destinations.push(href)}};
  try {
    let tree;
    const {ControlTreePage} = loadTs(new URL('../components/control-tree-page.tsx',import.meta.url), {
      './event-tree': {EventTree: props => {tree=props;return null;}},
    });
    renderToStaticMarkup(React.createElement(ControlTreePage,{...props,initialDealerId:'saga',initialEventId:'idle.ready'}));
    assert.equal(typeof tree?.onOpenClaw,'function');
    tree.onOpenClaw();
    assert.deepEqual(destinations,['/admin/dealer-agent?dealer=saga&event=idle.ready']);
  } finally {
    if(previous===undefined)delete globalThis.window;else globalThis.window=previous;
  }
});






const namesSnapshot = {
  operators: [{ id: 'company-john', slug: 'johns-spelbolag', name: 'Johns spelbolag' }, { id: 'company-other', slug: 'other', name: 'Annat bolag' }],
  rooms: [{ id: 'room-a', name: 'Linneas blackjack', operatorId: 'company-john' }, { id: 'room-b', name: 'Andra rummet', operatorId: 'company-other' }],
};
const settleNames = () => new Promise(resolve => setImmediate(resolve));







// Explicit active dealers used by this isolated component fixture.
function createSeedProject(){return addDealer(addDealer(createBaseProject(),'elin','Elin'),'saga','Saga');}
