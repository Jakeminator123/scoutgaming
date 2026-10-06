import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject } from '../lib/studio-model.mjs';
import { labUrl } from '../lib/lab-url.mjs';
import { STUDIO_PRIMARY_NAVIGATION, STUDIO_TOOL_NAVIGATION, studioNavigationItem } from '../lib/studio-navigation.mjs';

const items = [...STUDIO_PRIMARY_NAVIGATION, ...STUDIO_TOOL_NAVIGATION];
const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

test('Studio has three main areas without a second global clip library or background menu', () => {
  assert.deepEqual(STUDIO_PRIMARY_NAVIGATION.map(item => [item.href, item.label]), [
    ['/', 'Dealer & klipp'], ['/administration', 'Administration'], ['/openclaw', 'OpenClaw'],
  ]);
  assert.deepEqual(STUDIO_TOOL_NAVIGATION.map(item => item.href), ['/operator-chat', '/tree', '/activity', '/guide']);
  assert.equal(new Set(items.map(item => item.href)).size, 7);
  for (const item of items) {
    assert.equal(Object.isFrozen(item), true);
    const page = item.href === '/' ? 'page.tsx' : `${item.href.slice(1)}/page.tsx`;
    assert.match(readFileSync(new URL(`../app/${page}`, import.meta.url), 'utf8'), /export default/);
  }
});

test('existing dealer deep links highlight the one dealer area without creating extra main tabs', () => {
  for (const path of ['/videos', '/zones', '/events', '/probe']) {
    assert.equal(studioNavigationItem(path, ''), STUDIO_PRIMARY_NAVIGATION[0]);
    assert.equal(studioNavigationItem(`/studio${path}`, '/studio'), STUDIO_PRIMARY_NAVIGATION[0]);
  }
});

test('exact active-page lookup handles local and mounted Studio without double-prefixing paths', () => {
  for (const item of items) {
    assert.equal(studioNavigationItem(item.href, ''), item);
    assert.equal(studioNavigationItem(item.href, '/studio'), item);
    assert.equal(studioNavigationItem(item.href === '/' ? '/studio' : `/studio${item.href}`, '/studio'), item);
    assert.equal(item.href.startsWith('/studio'), false);
  }
  assert.equal(studioNavigationItem('/studio', ''), null);
  assert.equal(studioNavigationItem('/studio/studio/videos', '/studio'), null);
});

test('unknown, malformed and injected paths have no active item or default destination', () => {
  for (const basePath of ['', '/studio']) {
    for (const path of [null, undefined, 1, {}, [], 'constructor', '__proto__', '', '/unknown',
      '//evil.test/videos', 'https://scoutgaming.tech/studio/videos', '/videos?token=secret',
      '/videos#users', '/videos/', '/Videos', '/studio-other/videos', '/studio//videos',
      '/studio/videos?token=secret', '/studio/videos#users', '/studio/videos/',
      '/studio/../videos', '/studio/%2fvideos', '/studio\\videos', '<script>',
    ]) assert.equal(studioNavigationItem(path, basePath), null, `${basePath}: ${String(path)}`);
  }
  for (const basePath of [null, {}, [], '/studio/', '/other']) assert.equal(studioNavigationItem('/videos', basePath), null);
});

function loadComponent(file, overrides = {}, browser) {
  const url = new URL(`../components/${file}`, import.meta.url);
  const source = readFileSync(url, 'utf8');
  const output = transformSync(source, { filename: file, jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const localRequire = createRequire(url), module = { exports: {} };
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, window: browser,
    require: name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name === './studio-types') return loadComponent('studio-types.ts', overrides, browser);
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
      const links = [];
      const { WorkspaceNavigation } = loadComponent('workspace-navigation.tsx', {
        'next/navigation': { usePathname: () => basePath + '/activity' },
      });
      const tree = WorkspaceNavigation();
      visit(tree, node => { if (node.type === 'a') links.push(node.props); });
      const html = renderToStaticMarkup(tree);
      assert.deepEqual(links.map(link => link.href), ['/control', '/control', ...items.map(item => labUrl(item.href)), '/partner', '/play']);
      assert.ok(links.every(link => !link.onNavigate && !link.onClick));
      assert.equal(links.filter(link => link.href === labUrl('/administration')).length, 1);
      assert.match(html, /aria-label="ScoutGamingGroup administration"/);
      assert.match(html, /Nivå 1 · ScoutGamingGroup/);
      assert.match(html, /<details class="tools"><summary data-active="true">Verktyg/);
      assert.match(html, /aria-current="page"[^>]*>Uppspelningsdiagnostik/);
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
      'next/navigation': { usePathname: () => path },
    });
    assert.equal(renderToStaticMarkup(WorkspaceNavigation()), '', path);
  }
});

test('control landing and imported views highlight the control entrance through either rewrite path', () => {
  for (const path of ['/control', '/studio/control', '/control/voice', '/studio/control/voice']) {
    const { WorkspaceNavigation } = loadComponent('workspace-navigation.tsx', {
      'next/navigation': { usePathname: () => path },
    });
    const html = renderToStaticMarkup(WorkspaceNavigation());
    assert.match(html, /href="\/control" aria-current="page">Kontrollpanel/);
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
  assert.match(html, /Dealer &amp; klipp/);
  assert.match(html, /Nivå 2 · Spelbolag/);
  assert.doesNotMatch(html, /Exempeloperatör|Casino live|API keys|data-preview=/);
  const cleanup = effects[0]();
  assert.deepEqual(paths, [labUrl('/#deal')]);
  cleanup();
});

test('actual editor shortcut uses the operator chat route and keeps the existing Gateway panel and project context', () => {
  const saved = process.env.NEXT_PUBLIC_LAB_BASE_PATH;
  try {
    for (const basePath of ['', '/studio']) {
      process.env.NEXT_PUBLIC_LAB_BASE_PATH = basePath;
      const paths = [], project = createSeedProject();
      const browser = {history: {pushState: (_state, _title, path) => paths.push(path)}};
      const hooks = {...React, useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
        useEffect: () => {}, useRef: current => ({current}), useMemo: fn => fn(), useCallback: fn => fn};
      function GatewayPanel() { return null; }
      const {Studio} = loadComponent('studio.tsx', {react: hooks, './gateway-panel': {GatewayPanel}}, browser);
      const props = {initialProject: project, initialVideos: {videos: []}, initialStatus: {configured: false}};
      const tree = Studio(props);
      let shortcut;
      visit(tree, node => { if (node.type === 'button' && node.props.children === 'Fråga OpenClaw om labbet →') shortcut = node; });
      assert.ok(shortcut); shortcut.props.onClick();
      assert.deepEqual(paths, [basePath + '/operator-chat']);
      const routes = loadComponent('studio-types.ts');
      assert.equal(routes.studioViewForPath(paths[0]), 'openclaw');
      let panel;
      visit(Studio({...props, initialView: 'openclaw'}), node => {if (node.type === GatewayPanel) panel = node;});
      assert.ok(panel); assert.equal(panel.props.dealerId, 'astrid');
      assert.equal(panel.props.dirty, false); assert.equal(panel.props.status, props.initialStatus);
      assert.equal(typeof panel.props.onModeChange, 'function'); assert.equal(typeof panel.props.onPlayerChat, 'function');
      assert.equal(panel.props.standaloneVoicePreviewAvailable, true);
      visit(Studio({...props, initialView: 'openclaw', standaloneVoicePreviewAvailable: false}), node => {if (node.type === GatewayPanel) panel = node;});
      assert.equal(panel.props.standaloneVoicePreviewAvailable, false);
      const html = renderToStaticMarkup(tree);
      assert.doesNotMatch(html, /ISOLERAT LABB|DITT LABB|LOCAL \/ 01/);
    }
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_LAB_BASE_PATH;
    else process.env.NEXT_PUBLIC_LAB_BASE_PATH = saved;
  }
});

test('both real page guards protect dirty project drafts on native leave and clean up without mutating them', () => {
  for (const [file, name] of [['lab-studio.tsx', 'LabStudio'], ['studio.tsx', 'Studio']]) {
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
      if (name === 'Studio' && !dirty) {
        let social;
        visit(tree, node => { if (node.props?.draftCache) social = node.props.draftCache; });
        assert.ok(social, 'the social policy draft remains covered by the Studio guard');
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
