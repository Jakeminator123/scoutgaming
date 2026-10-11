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
  expectLabel('/videos', 'Dealers & klipp');
  expectLabel('/control/videos', 'Dealers & klipp');
  expectLabel('/zones', 'Sammansättning');
  expectLabel('/control/zones', 'Sammansättning');
  expectLabel('/events', 'Dealers & klipp');
  expectLabel('/control/events', 'Dealers & klipp');
  expectLabel('/probe', 'Dealers & klipp');
  expectLabel('/control/probe', 'Dealers & klipp');
  expectLabel('/clips', 'Dealers & klipp');
  expectLabel('/administration', 'Spelintegritet');
  expectLabel('/openclaw', 'Agentmodeller');
  expectLabel('/operator-chat', 'Operatörschatt');
  expectLabel('/control/operator-chat', 'Operatörschatt');
  expectLabel('/tree', 'Dealers & klipp');
  expectLabel('/control/tree', 'Dealers & klipp');
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
    ['/videos?token=secret', 'Dealers & klipp'],
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
      else if (basePath === '/studio' && path === '/studio/videos?token=secret') assert.equal(item?.label, 'Dealers & klipp', path);
      else if (basePath === '/studio' && path === '/videos?token=secret') assert.equal(item?.label, 'Dealers & klipp', path);
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
      assert.equal(links.filter(link => link === labUrl('/control/administration?tab=operations')).length, 1);
      assert.match(html, /aria-label="ScoutGamingGroup administration"/);
      assert.match(html, /Nivå 1 </);
      assert.match(html, /CROUPIER STUDIO/);
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

test('level-two entrance lists real supplied partners and preserves the administrator login', () => {
  const { PartnerWorkspace } = loadComponent('partner-workspace.tsx');
  const operators = [{ slug: 'johnsspelbolag', name: 'Johnsspelbolag' }, { slug: 'sg-test', name: 'SG test game provider' }];
  const html = renderToStaticMarkup(React.createElement(PartnerWorkspace, { user: 'jakob', operators, accessClass: 'internal-admin' }));
  const links = [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map(match => match[1]);
  assert.deepEqual(links, ['/partner', '/partner', '/control', '/play', '/partner/johnsspelbolag', '/partner/sg-test']);
  assert.match(html, /Johnsspelbolag/);
  assert.match(html, /Intern administratör/);
  assert.match(html, /samma administratörskonto/);
  assert.match(html, /data-theme="light" lang="sv"/);
  assert.doesNotMatch(html, /Demo North|Demo South|demo-north|demo-south|partner\/login|Kundinloggning.*återstår/);
  const source = readFileSync(new URL('../components/partner-workspace.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /normalizeView|location\.hash|location\.replace|demonstrations/);
});

test('level-two member entrance is scoped and empty access never selects a fixture', () => {
  const { PartnerWorkspace } = loadComponent('partner-workspace.tsx');
  const render = operators => renderToStaticMarkup(React.createElement(PartnerWorkspace, { user: 'john', operators, accessClass: 'partner' }));
  const member = render([{ slug: 'johnsspelbolag', name: 'Johnsspelbolag' }]);
  assert.match(member, /href="\/partner\/johnsspelbolag"/);
  assert.doesNotMatch(member, /href="\/(?:control|play)"|sg-test|Demo North|Demo South|Intern administratör/);
  for (const operators of [[], [{ slug: 'login', name: 'Invalid destination' }], [{ slug: '../sg-test', name: 'Invalid destination' }]]) {
    const empty = render(operators);
    assert.match(empty, /Inga tillgängliga spelbolag/);
    assert.doesNotMatch(empty, /href="\/partner\/[^\"]+"|Invalid destination/);
  }
});

test('control landing and imported views highlight the control entrance through either rewrite path', () => {
  for (const path of ['/control', '/studio/control', '/control/voice', '/studio/control/voice']) {
    const { WorkspaceNavigation } = loadComponent('workspace-navigation.tsx', {
      'next/navigation': { usePathname: () => path, useSearchParams: () => new URLSearchParams() },
    });
    const html = renderToStaticMarkup(WorkspaceNavigation());
    assert.match(html, /aria-current="page"[^>]*>Översikt/);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
  }
});

test('the global menu cannot introduce SPA history that bypasses existing beforeunload draft guards', () => {
  const source = readFileSync(new URL('../components/workspace-navigation.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /next\/link|router\.(?:push|replace)|history\.(?:pushState|replaceState)|onNavigate/);
  assert.match(source, /href=\{labUrl\(item\.href\)\}/);
  const anchors = [...source.matchAll(/<a\b[\s\S]*?>/g)].map(match => match[0]);
  for (const anchor of anchors) assert.doesNotMatch(anchor, /onClick|onNavigate/);
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
  const hooks = { ...React, useState: initial => [initial, () => {}], useEffect: effect => effects.push(effect), useRef: current => ({ current }), useSyncExternalStore: (_subscribe, _get, getServerSnapshot) => getServerSnapshot() };
  const { ControlWorkspace } = loadComponent('control-workspace.tsx', { react: hooks }, browser);
  const html = renderToStaticMarkup(ControlWorkspace({ user: 'fixture-admin' }));
  assert.match(html, /Sammansättning/);
  assert.match(html, /Dealer &amp; klipp/);
  assert.match(html, /Publicering/);
  assert.match(html, /Bolagets arbetsyta/);
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
      const guardEffects = effects.filter(effect => effect.toString().includes('beforeunload') && effect.toString().includes('addEventListener'));
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
