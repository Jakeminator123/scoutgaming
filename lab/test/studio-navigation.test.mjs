import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject } from '../lib/studio-model.mjs';
import { labUrl } from '../lib/lab-url.mjs';
import { SCOUT_FOOTER_NAVIGATION, SCOUT_LEVELS, SCOUT_NAVIGATION, scoutNavigationItem } from '../lib/scout-navigation.mjs';
import { normalizeView } from '../components/kevin-bo/navigation.mjs';

// Addresses copied from STUDIO_PRIMARY_NAVIGATION and STUDIO_TOOL_NAVIGATION at HEAD a2c07702.
const OLD_HEADER_DESTINATIONS = Object.freeze([
  '/control', '/control/clips', '/control/administration', '/control/openclaw',
  '/control/operator-chat', '/control/tree', '/control/activity', '/control/guide',
]);
const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

test('visible staff menu names Översikt and old header routes still have pages', () => {
  const visible = [...SCOUT_NAVIGATION.flatMap(group => group.items), ...SCOUT_FOOTER_NAVIGATION];
  assert.equal(visible.find(item => item.href === '/control').label, 'Översikt');
  assert.equal(visible.some(item => item.label === 'Kontrollpanel'), false);
  for (const href of OLD_HEADER_DESTINATIONS) {
    const page = href === '/control' ? 'control/[[...path]]/page.tsx' : `${href.slice(1)}/page.tsx`;
    assert.match(readFileSync(new URL(`../app/${page}`, import.meta.url), 'utf8'), /export default/, href);
  }
});

test('legacy dealer paths highlight the current page in the visible menu', () => {
  const expectLabel = (path, label) => {
    assert.equal(scoutNavigationItem(path, '')?.label, label, path);
    assert.equal(scoutNavigationItem(path, '/studio')?.label, label, path);
    assert.equal(scoutNavigationItem(path === '/' ? '/studio' : `/studio${path}`, '/studio')?.label, label, path);
  };
  expectLabel('/', 'Dealers & klipp');
  expectLabel('/control/clips', 'Dealers & klipp');
  expectLabel('/videos', 'Klippbibliotek');
  expectLabel('/control/videos', 'Klippbibliotek');
  expectLabel('/zones', 'Bakgrundszoner');
  expectLabel('/control/zones', 'Bakgrundszoner');
  expectLabel('/events', 'Händelser');
  expectLabel('/control/events', 'Händelser');
  expectLabel('/probe', 'Talgranskning');
  expectLabel('/control/probe', 'Talgranskning');
  expectLabel('/clips', 'Dealers & klipp');
  expectLabel('/administration', 'Administration');
  expectLabel('/openclaw', 'Agentmodeller');
  expectLabel('/operator-chat', 'Operatörschatt');
  expectLabel('/control/operator-chat', 'Operatörschatt');
  expectLabel('/tree', 'Händelser → klipp');
  expectLabel('/activity', 'Uppspelning');
  expectLabel('/guide', 'Guide & hjälp');
});

test('exact active-page lookup handles canonical paths and rejects a doubled studio prefix', () => {
  const items = [...SCOUT_NAVIGATION.flatMap(group => group.items), ...SCOUT_FOOTER_NAVIGATION];
  for (const item of items) {
    assert.equal(scoutNavigationItem(item.href, ''), item);
    assert.equal(scoutNavigationItem(item.href, '/studio'), item);
    assert.equal(scoutNavigationItem(`/studio${item.href}`, '/studio'), item);
    assert.equal(item.href.startsWith('/studio'), false);
  }
  assert.equal(scoutNavigationItem('/studio', ''), null);
  assert.equal(scoutNavigationItem('/studio/studio/videos', '/studio'), null);
});

test('unknown, malformed and injected paths have no active item or default destination', () => {
  const resolved = new Map([
    ['/videos?token=secret', 'Klippbibliotek'],
  ]);
  for (const basePath of ['', '/studio']) {
    for (const path of [null, undefined, 1, {}, [], 'constructor', '__proto__', '', '/unknown',
      '//evil.test/videos', 'https://scoutgaming.tech/studio/videos', '/videos?token=secret',
      '/videos#users', '/videos/', '/Videos', '/studio-other/videos', '/studio//videos',
      '/studio/videos?token=secret', '/studio/videos#users', '/studio/videos/',
      '/studio/../videos', '/studio/%2fvideos', '/studio\\videos', '<script>',
    ]) {
      const item = scoutNavigationItem(path, basePath);
      const label = typeof path === 'string' ? resolved.get(path) : undefined;
      if (label && basePath === '') assert.equal(item?.label, label, `${basePath}: ${path}`);
      else if (basePath === '/studio' && path === '/studio/videos?token=secret') assert.equal(item?.label, 'Klippbibliotek', path);
      else if (basePath === '/studio' && path === '/videos?token=secret') assert.equal(item?.label, 'Klippbibliotek', path);
      else assert.equal(item, null, `${basePath}: ${String(path)}`);
    }
  }
  for (const basePath of [null, {}, [], '/studio/', '/other']) assert.equal(scoutNavigationItem('/videos', basePath), null);
});

function loadComponent(file, overrides = {}, browser) {
  const url = new URL(`../components/${file}`, import.meta.url);
  const source = readFileSync(url, 'utf8');
  const output = transformSync(source, { filename: file, jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const localRequire = createRequire(url), module = { exports: {} };
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams, window: browser,
    require: name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name.endsWith('.mjs') || name.endsWith('.js') || name.endsWith('.json')) return localRequire(name);
      if (name === './studio-types') return loadComponent('studio-types.ts', overrides, browser);
      if (name === './studio-session' || name === './studio-session.tsx') return loadComponent('studio-session.tsx', overrides, browser);
      if (name === './test-context') return loadComponent('test-context.tsx', overrides, browser);
      if (name.startsWith('./')) return new Proxy({}, { get: () => () => null });
      return localRequire(name);
    },
  }, { filename: file });
  return module.exports;
}

test('internal menu keeps native Studio anchors and adds public control and partner entrances', () => {
  const before = process.env.NEXT_PUBLIC_LAB_BASE_PATH;
  try {
    for (const basePath of ['', '/studio']) {
      process.env.NEXT_PUBLIC_LAB_BASE_PATH = basePath;
      const { WorkspaceNavigation } = loadComponent('workspace-navigation.tsx', {
        'next/navigation': { usePathname: () => basePath + '/activity', useSearchParams: () => new URLSearchParams() },
      });
      const html = renderToStaticMarkup(WorkspaceNavigation());
      const links = [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map(match => match[1].replaceAll('&amp;', '&'));
      assert.deepEqual(links, ['/control',
        ...SCOUT_NAVIGATION.flatMap(group => group.items.map(item => labUrl(item.href))),
        ...SCOUT_FOOTER_NAVIGATION.map(item => labUrl(item.href)),
        ...SCOUT_LEVELS.map(item => labUrl(item.href))]);
      assert.doesNotMatch(html, /onClick|onNavigate/);
      assert.equal(links.filter(link => link === labUrl('/control/administration')).length, 1);
      assert.match(html, /aria-label="ScoutGamingGroup administration"/);
      assert.match(html, /Nivå 1 </);
      assert.match(html, /CROUPIER STUDIO · AI LIVE CASINO/);
      assert.doesNotMatch(html, /<details|<summary[^>]*>Verktyg/);
      assert.match(html, /aria-current="page"[^>]*>Uppspelning/);
      assert.doesNotMatch(html, /Backoffice\/Lab|Administration<\/summary>|#ops|#users|\/studio\/studio/);
      assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    }
  } finally {
    if (before === undefined) delete process.env.NEXT_PUBLIC_LAB_BASE_PATH;
    else process.env.NEXT_PUBLIC_LAB_BASE_PATH = before;
  }
});

test('partner documents never render internal workspace links under public or native paths', () => {
  for (const path of ['/partner', '/studio/partner', '/partner/demo-north/overview', '/studio/partner/demo-south/team', '/partner/unknown']) {
    const { WorkspaceNavigation } = loadComponent('workspace-navigation.tsx', {
      'next/navigation': { usePathname: () => path, useSearchParams: () => new URLSearchParams() },
    });
    assert.equal(renderToStaticMarkup(WorkspaceNavigation()), '', path);
  }
});

test('level-two entrance separates demonstrations and preserves only valid old hash destinations', () => {
  const demonstrations = [{ slug: 'demo-north', name: 'Demo North' }, { slug: 'demo-south', name: 'Demo South' }];
  for (const [hash, destination] of [['', null], ['#theme', '/partner/demo-north/presentation'],
    ['#tables', '/partner/demo-north/tables'], ['#voice', null], ['#https://outside.invalid', null]]) {
    const effects = [], paths = [], listeners = new Map();
    const browser = { location: { hash, replace: path => paths.push(path) },
      addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: (name, callback) => { if (listeners.get(name) === callback) listeners.delete(name); } };
    const { PartnerWorkspace } = loadComponent('partner-workspace.tsx', {
      react: { ...React, useEffect: effect => effects.push(effect) }, './kevin-bo/navigation.mjs': { normalizeView },
    }, browser);
    const tree = PartnerWorkspace({ user: 'fixture-admin', demonstrations }), links = [];
    visit(tree, node => { if (node.type === 'a') links.push(node.props.href); });
    assert.deepEqual(links, ['/partner/login', '/partner/demo-north', '/partner/demo-south', '/control', '/play', labUrl('/guide')]);
    const html = renderToStaticMarkup(tree);
    assert.match(html, /Partnerportal/);
    assert.match(html, /De är inte anslutna kunder/);
    assert.match(html, /nivå 1, 2 och 3 med samma konto/);
    assert.doesNotMatch(html, /Svenska Spel|<select|<form/);
    const cleanup = effects[0]();
    assert.deepEqual(paths, destination ? [destination] : []);
    cleanup(); assert.equal(listeners.size, 0);
  }
});

test('control landing and imported views highlight the control entrance through either rewrite path', () => {
  for (const path of ['/control', '/studio/control', '/control/voice', '/studio/control/voice']) {
    const { WorkspaceNavigation } = loadComponent('workspace-navigation.tsx', {
      'next/navigation': { usePathname: () => path, useSearchParams: () => new URLSearchParams() },
    });
    const html = renderToStaticMarkup(WorkspaceNavigation());
    assert.match(html, /href="\/control"[^>]*aria-current="page"[^>]*>Översikt/);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
  }
});

test('the global menu cannot introduce SPA history that bypasses existing beforeunload draft guards', () => {
  const source = readFileSync(new URL('../components/workspace-navigation.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /next\/link|router\.(?:push|replace)|history\.(?:pushState|replaceState)|onNavigate|onClick/);
  assert.match(source, /href=\{labUrl\(item\.href\)\}/);
});

function visit(node, callback) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(child => visit(child, callback)); return; }
  callback(node);
  visit(node.props?.children, callback);
}

test('internal landing links real tools and old clip hashes no longer open a second preview editor', () => {
  const effects = [], paths = [], browser = { location: { hash: '#clips', replace: path => paths.push(path) },
    history: { replaceState: () => assert.fail('a real tool needs native navigation') },
    addEventListener: () => {}, removeEventListener: () => {} };
  const hooks = { ...React, useState: initial => [initial, () => {}], useEffect: effect => effects.push(effect) };
  const { ControlWorkspace } = loadComponent('control-workspace.tsx', { react: hooks }, browser);
  const html = renderToStaticMarkup(ControlWorkspace({ user: 'fixture-admin' }));
  assert.match(html, /Lanes, bord &amp; konton/);
  assert.match(html, /Dealers &amp; klipp/);
  assert.match(html, /Nivå 2 · Spelbolag/);
  assert.doesNotMatch(html, /Exempeloperatör|Casino live|API keys|data-preview=/);
  const cleanup = effects[0]();
  assert.deepEqual(paths, [labUrl('/control/clips#deal')]);
  cleanup();
});

test('OpenClaw chat is a document route and keeps the Gateway panel and project context', () => {
  const saved = process.env.NEXT_PUBLIC_LAB_BASE_PATH;
  try {
    for (const basePath of ['', '/studio']) {
      process.env.NEXT_PUBLIC_LAB_BASE_PATH = basePath;
      const events = readFileSync(new URL('../components/control-events-page.tsx', import.meta.url), 'utf8');
      assert.doesNotMatch(events, /changeView\(|history\.pushState/);
      const routes = loadComponent('studio-types.ts');
      assert.equal(routes.viewPaths.openclaw, '/control/openclaw?tab=chat');
      assert.equal(routes.studioViewForPath(routes.viewPaths.openclaw), 'openclaw');
      const project = createSeedProject();
      const hooks = {...React, useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
        useEffect: () => {}, useRef: current => ({current}), useMemo: fn => fn(), useCallback: fn => fn};
      function GatewayPanel() { return null; }
      const {ControlOpenClawChat} = loadComponent('control-openclaw-chat.tsx', {react: hooks, './gateway-panel': {GatewayPanel}});
      const props = {initialProject: project, initialVideos: {videos: []}, initialStatus: {configured: false}, standaloneVoicePreviewAvailable: true};
      const tree = ControlOpenClawChat(props);
      let panel;
      visit(tree, node => {if (node.type === GatewayPanel) panel = node;});
      assert.ok(panel); assert.equal(panel.props.dealerId, 'astrid');
      assert.equal(panel.props.dirty, false); assert.equal(panel.props.status, props.initialStatus);
      assert.equal(typeof panel.props.onModeChange, 'function'); assert.equal(typeof panel.props.onPlayerChat, 'function');
      assert.equal(panel.props.standaloneVoicePreviewAvailable, true);
      visit(ControlOpenClawChat({...props, standaloneVoicePreviewAvailable: false}), node => {if (node.type === GatewayPanel) panel = node;});
      assert.equal(panel.props.standaloneVoicePreviewAvailable, false);
      const html = renderToStaticMarkup(tree);
      assert.match(html, /href="\/control\/openclaw\?tab=chat"/);
      assert.doesNotMatch(html, /ISOLERAT LABB|DITT LABB|LOCAL \/ 01|Fråga OpenClaw om labbet →/);
    }
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_LAB_BASE_PATH;
    else process.env.NEXT_PUBLIC_LAB_BASE_PATH = saved;
  }
});

test('both real page guards protect dirty project drafts on native leave and clean up without mutating them', () => {
  for (const [file, name] of [['lab-studio.tsx', 'LabStudio'], ['control-events-page.tsx', 'ControlEventsPage']]) {
    for (const dirty of [false, true]) {
      const project = createSeedProject(), before = JSON.stringify(project), effects = [];
      const browser = new EventTarget();
      const hooks = { ...React,
        useState: initial => {
          const value = typeof initial === 'function' ? initial() : initial;
          return [value === project && dirty ? { ...project, label: 'Osparat utkast' } : value, () => {}];
        },
        useEffect: effect => effects.push(effect), useRef: current => ({ current }),
        useMemo: fn => fn(), useCallback: fn => fn,
      };
      const component = loadComponent(file, { react: hooks }, browser)[name];
      const tree = component({ initialProject: project, initialVideos: { videos: [] }, initialStatus: {}, connectedLane: true });
      const guardEffects = effects.filter(effect => effect.toString().includes('beforeunload'));
      assert.equal(guardEffects.length, 1);
      const release = guardEffects[0]();
      assert.equal(browser.dispatchEvent(new Event('beforeunload', { cancelable: true })), !dirty);
      if (name === 'ControlEventsPage' && !dirty) {
        let social;
        visit(tree, node => { const cache = node.props?.draftCache ?? node.props?.social?.draftCache; if (cache) social = cache; });
        assert.ok(social, 'the social policy draft remains covered by the events page guard');
        social.current = { draft: { text: 'Osparad policy' }, status: { policy: { text: 'Sparad policy' } } };
        assert.equal(browser.dispatchEvent(new Event('beforeunload', { cancelable: true })), false);
        social.current.draft = { ...social.current.status.policy };
        assert.equal(browser.dispatchEvent(new Event('beforeunload', { cancelable: true })), true);
      }
      release();
      assert.equal(browser.dispatchEvent(new Event('beforeunload', { cancelable: true })), true);
      assert.equal(JSON.stringify(project), before);
    }
  }
});
