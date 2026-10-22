import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { studioNavigationContextFromQuery } from '../lib/studio-navigation.mjs';
import { SCOUT_FOOTER_NAVIGATION, SCOUT_NAVIGATION, scoutNavigationItem } from '../lib/scout-navigation.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');


test('legacy dealer paths retain their current guide label', () => {
  const expectLabel = (path, label) => {
    assert.equal(scoutNavigationItem(path, '')?.label, label, path);
    assert.equal(scoutNavigationItem(path, '/studio')?.label, label, path);
    assert.equal(scoutNavigationItem(path === '/' ? '/studio' : `/studio${path}`, '/studio')?.label, label, path);
  };
  expectLabel('/', 'Klippkarta');
  expectLabel('/control/clips', 'Klippkarta');
  expectLabel('/videos', 'Klippkarta');
  expectLabel('/control/videos', 'Klippkarta');
  expectLabel('/zones', 'Klippkarta');
  expectLabel('/control/zones', 'Klippkarta');
  expectLabel('/events', 'Klippkarta');
  expectLabel('/control/events', 'Klippkarta');
  expectLabel('/admin/events', 'Klippkarta');
  expectLabel('/probe', 'Klippkarta');
  expectLabel('/control/probe', 'Klippkarta');
  expectLabel('/admin/probe', 'Klippkarta');
  expectLabel('/admin/replies', 'Klippkarta');
  expectLabel('/clips', 'Klippkarta');
  expectLabel('/administration', 'Drift');
  expectLabel('/openclaw', 'Systeminställningar');
  expectLabel('/operator-chat', 'Klippkarta');
  expectLabel('/control/operator-chat', 'Klippkarta');
  expectLabel('/tree', 'Klippkarta');
  expectLabel('/control/tree', 'Klippkarta');
  expectLabel('/activity', 'Spelbolag & rum');
  expectLabel('/admin/rehearsal', 'Spelbolag & rum');
  expectLabel('/control/rehearsal', 'Spelbolag & rum');
  expectLabel('/admin/compositions', 'Klippkarta');
  expectLabel('/control/compositions', 'Klippkarta');
  expectLabel('/guide', 'Hjälp');
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
    ['/videos?token=secret', 'Klippkarta'],
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
      else if (basePath === '/studio' && path === '/studio/videos?token=secret') assert.equal(item?.label, 'Klippkarta', path);
      else if (basePath === '/studio' && path === '/videos?token=secret') assert.equal(item?.label, 'Klippkarta', path);
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
    module, exports: module.exports, structuredClone, URL, URLSearchParams, URL, URLSearchParams, window: browser,
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


test('level-two entrance lists real supplied partners and preserves the administrator login', () => {
  const { PartnerWorkspace } = loadComponent('partner-workspace.tsx');
  const operators = [{ slug: 'johnsspelbolag', name: 'Johnsspelbolag' }, { slug: 'sg-test', name: 'SG test game provider' }];
  const html = renderToStaticMarkup(React.createElement(PartnerWorkspace, { user: 'jakob', operators, accessClass: 'internal-admin' }));
  const links = [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map(match => match[1]);
  assert.deepEqual(links, ['/partner', '/partner', '/admin', '/lobby', '/partner/johnsspelbolag', '/partner/sg-test']);
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
  assert.doesNotMatch(member, /href="\/(?:admin|lobby|control|play)"|sg-test|Demo North|Demo South|Intern administratör/);
  for (const operators of [[], [{ slug: 'login', name: 'Invalid destination' }], [{ slug: '../sg-test', name: 'Invalid destination' }]]) {
    const empty = render(operators);
    assert.match(empty, /Inga tillgängliga spelbolag/);
    assert.doesNotMatch(empty, /href="\/partner\/[^\"]+"|Invalid destination/);
  }
});


function mountSelectedPage(component, props) {
  const element = component(props);
  return typeof element.type === 'function' && element.type.name.startsWith('SelectedControl')
    ? element.type(element.props) : element;
}

function visit(node, callback) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(child => visit(child, callback)); return; }
  callback(node);
  visit(node.props?.children, callback);
}


test('OpenClaw chat is a document route and keeps the Gateway panel and project context', () => {
  const saved = process.env.NEXT_PUBLIC_LAB_BASE_PATH;
  try {
    for (const basePath of ['', '/studio']) {
      process.env.NEXT_PUBLIC_LAB_BASE_PATH = basePath;
      const events = readFileSync(new URL('../components/control-events-page.tsx', import.meta.url), 'utf8');
      assert.doesNotMatch(events, /changeView\(|history\.pushState/);
      const routes = loadComponent('studio-types.ts');
      assert.equal(routes.viewPaths.openclaw, '/admin/dealer-agent');
      assert.equal(routes.studioViewForPath(routes.viewPaths.openclaw), 'openclaw');
      const project = createSeedProject();
      const hooks = {...React, useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
        useEffect: () => {}, useRef: current => ({current}), useMemo: fn => fn(), useCallback: fn => fn};
      function GatewayPanel() { return null; }
      const {ControlOpenClawChat} = loadComponent('control-openclaw-chat.tsx', {react: hooks, './gateway-panel': {GatewayPanel}});
      const props = {initialProject: project, initialDealerId: 'astrid', initialVideos: {videos: []}, initialStatus: {configured: false}, standaloneVoicePreviewAvailable: true};
      const tree = mountSelectedPage(ControlOpenClawChat, props);
      let panel;
      visit(tree, node => {if (node.type === GatewayPanel) panel = node;});
      assert.ok(panel); assert.equal(panel.props.dealerId, 'astrid');
      assert.equal(panel.props.dirty, false); assert.equal(panel.props.status, props.initialStatus);
      assert.equal(typeof panel.props.onModeChange, 'function'); assert.equal(typeof panel.props.onPlayerChat, 'function');
      assert.equal(panel.props.standaloneVoicePreviewAvailable, true);
      visit(mountSelectedPage(ControlOpenClawChat, {...props, standaloneVoicePreviewAvailable: false}), node => {if (node.type === GatewayPanel) panel = node;});
      assert.equal(panel.props.standaloneVoicePreviewAvailable, false);
      const html = renderToStaticMarkup(tree);
      assert.doesNotMatch(html, /ISOLERAT LABB|DITT LABB|LOCAL \/ 01|Fråga OpenClaw om labbet →/);
    }
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_LAB_BASE_PATH;
    else process.env.NEXT_PUBLIC_LAB_BASE_PATH = saved;
  }
});



test('unavailable search params leave Studio navigation unselected', () => {
  assert.deepEqual(studioNavigationContextFromQuery(null), {});
  assert.deepEqual(studioNavigationContextFromQuery(undefined), {});
  assert.deepEqual(studioNavigationContextFromQuery(new URLSearchParams()), {});
  assert.deepEqual(studioNavigationContextFromQuery(new URLSearchParams('dealer=vera&event=speak.goodluck&lane=explicit-layout&token=private')), { dealerId: 'vera', eventId: 'speak.goodluck', laneId: 'explicit-layout' });
});
test('query-specific links win without losing the chat alias or selecting rooms for bolag', () => {
  const cases = [
    ['/admin/ai/models?dealer=saga&operator=north', 'Systeminställningar'], ['/admin/dealer-agent?dealer=saga', 'Klippkarta'],
    ['/openclaw?tab=chat&dealer=saga', 'Klippkarta'], ['/control/ops?tab=chat', 'Drift'],
    ['/control/openclaw', 'Systeminställningar'], ['/control/openclaw?tab=chat', 'Klippkarta'],
    ['/control/openclaw?dealer=astrid&event=idle.ready&tab=chat', 'Klippkarta'],
    ['/control/openclaw?dealer=astrid', 'Systeminställningar'], ['/operator-chat', 'Klippkarta'],
    ['/control/operator-chat', 'Klippkarta'], ['/admin/probe?dealer=saga', 'Klippkarta'], ['/control/lanes?lane=t10', 'Spelbolag & rum'],
    ['/control/lanes?dealer=astrid&lane=t10&tab=companies', 'Bolag & team'],
    ['/control/lanes?tab=companies#operator-directory', 'Bolag & team'],
    ['/control/administration?tab=tables', 'Spelbolag & rum'],
    ['/control/administration?tab=operations', 'Drift'],
    ['/control/administration?tab=finance', 'Ekonomi'],
    ['/control/administration?tab=accounts', 'Konton & åtkomst'],
    ['/control/administration?tab=partners', 'Integrationer'],
  ];
  for (const base of ['', '/studio']) for (const [path, label] of cases) {
    assert.equal(scoutNavigationItem(path, base)?.label, label, path);
    assert.equal(scoutNavigationItem(`${base}${path}`, base)?.label, label, `${base}${path}`);
  }
});
