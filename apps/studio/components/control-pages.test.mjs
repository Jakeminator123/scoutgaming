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
  assert.equal(studioHref('/control/openclaw', { dealerId: 'astrid', eventId: 'idle.ready', tab: 'chat' }), '/admin/openclaw?tab=agent&dealer=astrid&event=idle.ready');
  assert.equal(studioHref('/admin/events', { dealerId: 'astrid', eventId: 'idle.ready', tab: 'nope' }), '/admin/events?dealer=astrid&event=idle.ready');
  assert.equal(selectionHref('/admin/events', '?tab=variants&filter=x', 'saga', 'idle.ready'), '/admin/events?dealer=saga&event=idle.ready&tab=variants');
  assert.equal(studioHref('/admin/videos', { dealerId: 'saga', eventId: 'idle.ready', variantId: 'v2' }), '/admin/videos?dealer=saga&event=idle.ready&variant=v2');
  assert.equal(selectionHref('/admin/events', '?tab=variants', 'saga', 'idle.ready', 'v2'), '/admin/events?dealer=saga&event=idle.ready&variant=v2&tab=variants');
  assert.equal(selectionHref('/admin/videos', '', 'saga', 'idle.ready', 'v2'), '/admin/videos?dealer=saga&event=idle.ready&variant=v2');
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

test('recorded media guidance keeps old groups optional and distinguishes models from timed variation', () => {
  const html = renderPage('control-tree-page.tsx');
  assert.match(html, /<details[^>]*><summary>Avancerat · äldre händelsegrupper/);
  assert.doesNotMatch(html, /<details[^>]*open[^>]*><summary>Avancerat · äldre/);
  assert.match(html, /Automatisk grundloopvariation/);
  assert.match(html, /högst 8, totalt 3 200 tecken/);
  assert.match(html, /Dessa testvärden hämtas inte från spelaren/);
  assert.match(html, /<a href="\/admin\/dealer-studio\?dealer=astrid">/);
  const activity = renderPage('control-activity-page.tsx');
  assert.match(activity, /<summary>Klippförhandsvisning och provspelning<\/summary>/);
  assert.match(activity, /AI-tal: inget förlopp observerat/);
  assert.match(activity, /Inspelade klipp: inga uppspelningskvitton ännu/);
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
    assert.deepEqual(destinations,['/admin/openclaw?tab=agent&dealer=saga&event=idle.ready']);
  } finally {
    if(previous===undefined)delete globalThis.window;else globalThis.window=previous;
  }
});

test('rehearsal requires an explicit dealer or room and never starts a default observation',()=>{
 for(const initialDealerId of [undefined,'','unknown','amira']) {
  const html=renderPage('control-activity-page.tsx',{initialDealerId,initialOperatorSlug:'operator-42',initialLaneId:'mobile-phone'});
  assert.match(html,/Välj en dealer att provspela/);assert.doesNotMatch(html,/Anslut &amp; följ|Klippförhandsvisning och provspelning|Dealerprov/);
  for(const dealer of project.dealers.filter(row=>row.id!=='amira'))assert.ok(html.includes('/admin/rehearsal?dealer='+dealer.id+'&amp;composition=mobile-phone&amp;operator=operator-42'));
 }
 const room=renderPage('control-activity-page.tsx',{initialDealerId:undefined,initialOperatorSlug:'operator-42',initialTableId:'room-7'});
 assert.match(room,/Spelrummets publicerade dealer/);assert.match(room,/<h2>Valt spelrum<\/h2>/);assert.match(room,/Spelbolag: Valt spelbolag/);assert.doesNotMatch(room,/<h2>room-7<\/h2>|Spelbolag: operator-42/);assert.doesNotMatch(room,/Välj en dealer att provspela|Separat Lab-preview/);
});

test('dealer editor routes gate missing and invalid dealers before mounting their media session',()=>{
 const previous=globalThis.window;
 try {
  for(const [file,path] of [['control-tree-page.tsx','/admin/events'],['control-events-page.tsx','/admin/events'],['control-videos-page.tsx','/admin/videos'],['control-probe-page.tsx','/admin/openclaw'],['control-openclaw-chat.tsx','/admin/openclaw']])for(const initialDealerId of [undefined,'unknown','amira']) {
   globalThis.window={location:{pathname:path,search:'?composition=composition-1&operator=operator-42&table=room-7'}};
   const html=renderPage(file,{initialDealerId});assert.match(html,/<h2>Välj dealer<\/h2>/,file);assert.doesNotMatch(html,/<video|<audio|Klippförhandsvisning och provspelning/,file);
   for(const dealer of project.dealers.filter(row=>row.id!=='amira'))assert.ok(html.includes(path+'?dealer='+dealer.id+'&amp;composition=composition-1&amp;operator=operator-42&amp;table=room-7'),file+' keeps context for '+dealer.id);
  }
 } finally {if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});

function rehearsalNamesHarness() {
  const slots = [], effects = [], requests = []; let cursor = 0, queued = [];
  const input = { ...props, initialDealerId: undefined, initialOperatorSlug: 'johns-spelbolag', initialTableId: 'room-a' };
  const react = { ...React,
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useCallback: callback => callback,
    useEffect(fn, deps) { const index = cursor++, previous = effects[index];
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) queued.push(() => { previous?.cleanup?.(); effects[index] = { deps, cleanup: fn() }; }); },
  };
  function ActivityLog() { return null; }
  const studioTypes = loadTs(new URL('../components/studio-types.ts', import.meta.url));
  const { ControlActivityPage } = loadTs(new URL('../components/control-activity-page.tsx', import.meta.url), {
    react,
    './activity-log': { ActivityLog },
    './page-template.mjs': { PageTemplate() { return null; }, publishShellStatus() {} },
    '../lib/activity-store.mjs': { loadActivities: () => [], saveActivities() {} },
    './studio-types': { ...studioTypes, requestJson: (path, options) => new Promise((resolve, reject) => requests.push({ path, options, resolve, reject })) },
  });
  const flatten = node => !node || typeof node !== 'object' ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(flatten)];
  return { input, requests, render() { cursor = 0; queued = []; const tree = ControlActivityPage(input); for (const effect of queued) effect();
    return flatten(tree).find(node => node.type === ActivityLog); } };
}
const namesSnapshot = {
  operators: [{ id: 'company-john', slug: 'johns-spelbolag', name: 'Johns spelbolag' }, { id: 'company-other', slug: 'other', name: 'Annat bolag' }],
  rooms: [{ id: 'room-a', name: 'Linneas blackjack', operatorId: 'company-john' }, { id: 'room-b', name: 'Andra rummet', operatorId: 'company-other' }],
};
const settleNames = () => new Promise(resolve => setImmediate(resolve));

test('rehearsal uses saved scoped names without replacing the observation identity', async () => {
  const harness = rehearsalNamesHarness(), before = harness.render();
  assert.equal(before.props.observationContext.tableLabel, undefined);
  assert.equal(harness.requests.length, 1);
  assert.equal(harness.requests[0].path, '/api/admin/resource-lifecycle');
  assert.equal(harness.requests[0].options.credentials, 'same-origin');
  assert.equal(harness.requests[0].options.cache, 'no-store');
  harness.requests[0].resolve(namesSnapshot); await settleNames();
  const after = harness.render(), context = after.props.observationContext;
  assert.equal(after.key, before.key, 'loading labels cannot remount the log or disconnect the player');
  assert.equal(context.tableId, 'room-a'); assert.equal(context.operatorSlug, 'johns-spelbolag');
  assert.equal(context.tableLabel, 'Linneas blackjack'); assert.equal(context.operatorLabel, 'Johns spelbolag');
  const { ActivityLog } = loadTs(new URL('../components/activity-log.tsx', import.meta.url));
  const html = renderToStaticMarkup(React.createElement(ActivityLog, { ...after.props, observationContext: context }));
  assert.match(html, /<h2>Linneas blackjack<\/h2>/); assert.match(html, /Spelbolag: Johns spelbolag/);
  assert.doesNotMatch(html, /<h2>room-a<\/h2>|Spelbolag: johns-spelbolag/);
});

test('rehearsal cannot show another company room name and ignores stale name responses', async () => {
  const wrongOwner = rehearsalNamesHarness(); wrongOwner.render();
  wrongOwner.requests[0].resolve({ ...namesSnapshot, rooms: [{ id: 'room-a', name: 'Andra bolagets rum', operatorId: 'company-other' }] }); await settleNames();
  assert.equal(wrongOwner.render().props.observationContext.tableLabel, undefined);
  const harness = rehearsalNamesHarness(); harness.render();
  harness.input.initialTableId = 'room-b'; harness.input.initialOperatorSlug = 'other';
  const changed = harness.render(); assert.equal(harness.requests[0].options.signal.aborted, true);
  harness.requests[0].resolve(namesSnapshot); await settleNames();
  assert.equal(harness.render().props.observationContext.tableLabel, undefined);
  harness.requests[1].resolve(namesSnapshot); await settleNames();
  const after = harness.render();
  assert.equal(after.key, changed.key); assert.equal(after.props.observationContext.tableLabel, 'Andra rummet');
  assert.equal(after.props.observationContext.operatorLabel, 'Annat bolag');
});

test('rehearsal keeps its selected IDs when names are unavailable or not usable', async () => {
  for (const snapshot of [null, { operators: [], rooms: [] }, { operators: namesSnapshot.operators, rooms: [{ id: 'room-a', name: 'room-a', operatorId: 'company-john' }] }]) {
    const harness = rehearsalNamesHarness(), before = harness.render();
    if (snapshot === null) harness.requests[0].reject(new Error('unavailable')); else harness.requests[0].resolve(snapshot);
    await settleNames(); const after = harness.render();
    assert.equal(after.key, before.key); assert.equal(after.props.observationContext.tableId, 'room-a');
    assert.equal(after.props.observationContext.tableLabel, undefined);
  }
});

// Explicit active dealers used by this isolated component fixture.
function createSeedProject(){return addDealer(addDealer(createBaseProject(),'elin','Elin'),'saga','Saga');}
