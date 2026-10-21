import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { labUrl } from '../lib/lab-url.mjs';
import { renderToStaticMarkup } from 'react-dom/server';
import { SCOUT_FOOTER_NAVIGATION, SCOUT_LEVELS, SCOUT_NAVIGATION, isScoutAuthPath, scoutNavigationItem } from '../lib/scout-navigation.mjs';

const OLD_HEADER_DESTINATIONS = Object.freeze([
  '/control', '/control/clips', '/control/administration', '/control/openclaw',
  '/control/operator-chat', '/control/tree', '/control/activity', '/control/guide',
]);
const groups = SCOUT_NAVIGATION;
const sidebar = [...groups.flatMap(group => group.items), ...SCOUT_FOOTER_NAVIGATION];
const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

test('work groups expose unique labelled destinations that resolve to their active menu item', () => {
  assert.ok(groups.length > 0);
  for (const group of groups) {
    assert.ok(group.label.trim());
    assert.ok(group.items.length > 0, group.id);
  }
  for (const item of sidebar) {
    assert.ok(item.label.trim(), item.href);
    for (const base of ['', '/studio']) {
      assert.equal(scoutNavigationItem(`${base}${item.href}`, base), item, item.href);
    }
  }
  assert.deepEqual(SCOUT_FOOTER_NAVIGATION.map(item => [item.href, item.label]), [
    ['/control', 'Översikt'], ['/admin/guide', 'Guide & hjälp'],
  ]);
  assert.equal(new Set(sidebar.map(item => item.href)).size, sidebar.length);
  assert.equal(new Set(groups.map(group => group.id)).size, groups.length);
  assert.deepEqual(SCOUT_LEVELS.map(item => [item.href, item.label]), [
    ['/control', '1 · Admin'], ['/partner', '2 · Spelbolag'], ['/play', '3 · Spelare'],
  ]);
});

test('old direct routes and content aliases retain a visible navigation destination', () => {
  const covered = new Set(sidebar.map(item => item.href));
  for (const href of [...OLD_HEADER_DESTINATIONS, '/control/videos', '/control/events', '/control/probe']) {
    const active = scoutNavigationItem(href, '');
    assert.equal(covered.has(active?.href), true, href);
  }
  for (const href of ['/control/videos', '/control/events', '/control/probe', '/control/tree']) {
    assert.equal(sidebar.some(item => item.href === href), false, href);
    assert.equal(scoutNavigationItem(`${href}?dealer=astrid&event=idle.ready`, '')?.label, 'Dealers & klipp');
  }
  assert.equal(SCOUT_LEVELS.some(item => item.href === '/partner'), true);
  assert.equal(SCOUT_LEVELS.some(item => item.href === '/play'), true);
});

test('active item resolves public and native paths with content aliases and the administration default', () => {
  for (const base of ['', '/studio']) {
    for (const [path, label] of [
      ['/control', 'Översikt'], ['/control/clips', 'Dealers & klipp'], ['/activity', 'Dealers & klipp'],
      ['/control/administration', 'Spelstatus & integritet'], ['/control/zones', 'Sammansättningar'],
      ['/control/backgrounds', 'Sammansättningar'], ['/control/events', 'Dealers & klipp'],
      ['/control/replies', 'Dealers & klipp'],
      ['/control/administration?tab=not-a-group', 'Spelstatus & integritet'],
      ['/control/administration?tab=media-review', 'Dealers & klipp'],
    ]) {
      assert.equal(scoutNavigationItem(path, base)?.label, label, path);
      assert.equal(scoutNavigationItem(`${base}${path}`, base)?.label, label, `${base}${path}`);
    }
    assert.equal(scoutNavigationItem('/studio/studio/videos', base), null);
  }
  assert.equal(scoutNavigationItem('/', '')?.label, 'Dealers & klipp');
  assert.equal(scoutNavigationItem('/studio', '/studio')?.label, 'Dealers & klipp');
  assert.equal(scoutNavigationItem('/studio', ''), null);
  for (const base of [null, {}, [], '/studio/', '/other']) assert.equal(scoutNavigationItem('/control/clips', base), null);
});

function loadNavigation(pathname, search = '', hooks = React) {
  const file = 'workspace-navigation.tsx';
  const url = new URL(`../components/${file}`, import.meta.url);
  const output = transformSync(readFileSync(url, 'utf8'), { filename: file, jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const localRequire = createRequire(url), module = { exports: {} };
  vm.runInNewContext(`${output.code}\nmodule.exports.NavigationGroup = NavigationGroup; module.exports.MobileNavigation = MobileNavigation; module.exports.ItemLink = ItemLink;`, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams,
    require: name => {
      if (name === 'react') return hooks;
      if (name === 'next/navigation') return { usePathname: () => pathname, useSearchParams: () => new URLSearchParams(search) };
      if (name.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name.startsWith('./')) return new Proxy({}, { get: () => () => null });
      return localRequire(name);
    },
  }, { filename: file });
  return module.exports;
}

test('login and password pages render without a staff menu under either base path', () => {
  for (const base of ['', '/studio']) {
    for (const path of ['/login', '/set-password', '/control/login', '/control/set-password', '/partner/login', '/partner/set-password']) {
      assert.equal(isScoutAuthPath(`${base}${path}`, base), true, `${base}${path}`);
      assert.equal(isScoutAuthPath(`${base}${path}/`, base), true, `${base}${path}/`);
    }
    assert.equal(isScoutAuthPath(`${base}/control/clips`, base), false);
    assert.equal(isScoutAuthPath(`${base}/control/login-history`, base), false);
  }
  assert.equal(isScoutAuthPath('/login', '/studio'), true);
  assert.equal(isScoutAuthPath('/studio/login', ''), false);
  for (const path of ['/control/login', '/control/set-password', '/login']) {
    const { WorkspaceNavigation } = loadNavigation(path);
    assert.equal(renderToStaticMarkup(React.createElement(WorkspaceNavigation, null, React.createElement('main', null, 'login-form'))), '<main>login-form</main>', path);
  }
});

test('partner pages retain their own shell and the staff shell retains its shared status', () => {
  for (const path of ['/partner', '/studio/partner', '/partner/demo-north/overview', '/studio/partner/demo-south/team']) {
    assert.equal(renderToStaticMarkup(loadNavigation(path).WorkspaceNavigation()), '', path);
  }
  const { WorkspaceNavigation, ShellStatus } = loadNavigation('/control/administration');
  const html = renderToStaticMarkup(WorkspaceNavigation());
  assert.match(html, /aria-current="page"[^>]*>Spelstatus &amp; integritet/);
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /status-marker/);
  const withStatus = renderToStaticMarkup(React.createElement(ShellStatus.Provider, { value: 'status-marker' }, React.createElement(WorkspaceNavigation)));
  assert.match(withStatus, /status-marker/);
  assert.doesNotMatch(html, /type="search"|Sök dealer, klipp, bord, konto…|Inte ansluten ännu/);
});

test('query-specific links win without losing the chat alias or selecting publicering for bolag', () => {
  const cases = [
    ['/control/openclaw', 'Agentmodeller'], ['/control/openclaw?tab=chat', 'Intern agentchatt'],
    ['/control/openclaw?dealer=astrid&event=idle.ready&tab=chat', 'Intern agentchatt'],
    ['/control/openclaw?dealer=astrid', 'Agentmodeller'], ['/operator-chat', 'Intern agentchatt'],
    ['/control/operator-chat', 'Intern agentchatt'], ['/control/lanes?lane=t10', 'Spelrum & publicering'],
    ['/control/lanes?dealer=astrid&lane=t10&tab=companies', 'Bolag & team'],
    ['/control/lanes?tab=companies#operator-directory', 'Bolag & team'],
    ['/control/administration?tab=tables', 'Spelrum & publicering'],
    ['/control/administration?tab=operations', 'Spelstatus & integritet'],
    ['/control/administration?tab=finance', 'Betalningar & journal'],
    ['/control/administration?tab=accounts', 'Konton & åtkomst'],
    ['/control/administration?tab=partners', 'API & integrationer'],
  ];
  for (const base of ['', '/studio']) for (const [path, label] of cases) {
    assert.equal(scoutNavigationItem(path, base)?.label, label, path);
    assert.equal(scoutNavigationItem(`${base}${path}`, base)?.label, label, `${base}${path}`);
  }
});

test('reload on a deep route expands only its work group and marks exactly one sublink', () => {
  for (const [pathname, search, label] of [
    ['/control/preview', 'lane=t10', 'Sammansättningar'],
    ['/control/events', 'dealer=astrid&event=idle.ready', 'Dealers &amp; klipp'],
    ['/control/administration', 'tab=tables', 'Spelrum &amp; publicering'],
    ['/control/openclaw', 'tab=chat&dealer=astrid', 'Intern agentchatt'],
    ['/control/lanes', 'tab=companies&lane=t10', 'Bolag &amp; team'],
  ]) {
    const active = scoutNavigationItem(`${pathname}?${search}`);
    const currentGroup = groups.find(group => group.items.includes(active));
    assert.ok(currentGroup, pathname);
    const html = renderToStaticMarkup(loadNavigation(pathname, search).WorkspaceNavigation());
    assert.match(html, new RegExp(`aria-current="page"[^>]*>${label}`), pathname);
    assert.equal((html.match(/aria-expanded="true"/g) ?? []).length, 1, pathname);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1, pathname);
    for (const group of groups) {
      assert.match(html, new RegExp(`id="scout-navigation-${group.id}"[^>]*aria-expanded="${group === currentGroup}"`), pathname);
      assert.match(html, new RegExp(`aria-controls="scout-navigation-${group.id}-items"`));
      assert.match(html, new RegExp(`id="scout-navigation-${group.id}-items"[^>]*aria-labelledby="scout-navigation-${group.id}"`));
      const panel = html.match(new RegExp(`id="scout-navigation-${group.id}-items"[^>]*`))?.[0];
      assert.equal(/\bhidden=""/.test(panel), group !== currentGroup, `${pathname}: ${group.id}`);
    }
  }
});

test('group controls toggle without navigation and reopen on route changes including same-group queries', () => {
  let state, previousDeps, pendingEffect;
  const hooks = { ...React,
    useState: initial => {
      if (state === undefined) state = initial;
      return [state, value => { state = typeof value === 'function' ? value(state) : value; }];
    },
    useEffect: (effect, deps) => {
      if (!previousDeps || deps.some((value, index) => value !== previousDeps[index])) pendingEffect = effect;
      previousDeps = [...deps];
    },
  };
  const { NavigationGroup } = loadNavigation('/control/clips', '', hooks);
  const group = groups.find(group => group.items.some(item => item.href === '/control/clips'));
  function render(active, routeKey) {
    let tree = NavigationGroup({ group, active, routeKey });
    if (pendingEffect) { const effect = pendingEffect; pendingEffect = null; effect(); tree = NavigationGroup({ group, active, routeKey }); }
    return tree.props.children;
  }
  let [button, panel] = render(null, '/control');
  assert.equal(button.type, 'button');
  assert.equal(button.props.type, 'button');
  assert.equal(button.props.onKeyDown, undefined, 'native button semantics support Enter and Space');
  assert.equal(button.props['aria-expanded'], false);
  assert.equal(panel.props.hidden, true);
  button.props.onClick();
  [button, panel] = render(null, '/control');
  assert.equal(button.props['aria-expanded'], true);
  assert.equal(panel.props.hidden, false);
  button.props.onClick();
  [button, panel] = render(group.items[1], '/control/clips?dealer=astrid');
  assert.equal(button.props['aria-expanded'], true);
  button.props.onClick();
  [button, panel] = render(group.items[1], '/control/clips?dealer=astrid');
  assert.equal(button.props['aria-expanded'], false, 'the active group can still be collapsed');
  [button, panel] = render(group.items[1], '/control/clips?dealer=astrid&tab=deal');
  assert.equal(button.props['aria-expanded'], true, 'a query change reopens the current group');
  button.props.onClick();
  [button, panel] = render(group.items[0], '/control/preview?lane=t10');
  assert.equal(button.props['aria-expanded'], true, 'Back/Forward or a new subroute reopens the group');
});


test('mobile menu starts collapsed and closes with Escape or its native button while returning focus', () => {
  let state = false, focused = 0;
  const ref = { current: { focus: () => focused++, getClientRects: () => [1] } };
  const hooks = { ...React, useRef: () => ref, useState: () => [state, value => { state = value; }] };
  const { MobileNavigation } = loadNavigation('/control/preview', 'lane=preserved', hooks);
  const render = () => MobileNavigation({ brand: 'Scout', children: 'existing grouped links' });
  let tree = render();
  let button = tree.props.children[0].props.children[1];
  let panel = tree.props.children[1];
  assert.equal(button.type, 'button');
  assert.equal(button.props.type, 'button');
  assert.equal(button.props.onKeyDown, undefined, 'Enter and Space use native button semantics');
  assert.equal(button.props['aria-expanded'], false);
  assert.equal(button.props['aria-controls'], panel.props.id);
  assert.equal(panel.props['data-open'], false);
  button.props.onClick();
  tree = render();
  button = tree.props.children[0].props.children[1];
  assert.equal(button.props['aria-expanded'], true);
  let prevented = 0;
  tree.props.onKeyDown({ key: 'Tab', preventDefault: () => prevented++, stopPropagation() {} });
  assert.equal(state, true);
  assert.equal(prevented, 0, 'Tab remains free, without a focus trap');
  tree.props.onKeyDown({ key: 'Escape', preventDefault: () => prevented++, stopPropagation() {} });
  assert.equal(state, false);
  assert.equal(focused, 1);
  assert.equal(prevented, 1);
  render().props.children[0].props.children[1].props.onClick();
  render().props.children[0].props.children[1].props.onClick();
  assert.equal(state, false);
  assert.equal(focused, 2);
  ref.current.getClientRects = () => [];
  render().props.children[0].props.children[1].props.onClick();
  render().props.onKeyDown({ key: 'Escape', preventDefault: () => assert.fail('hidden desktop toggle must not receive focus'), stopPropagation() {} });
  assert.equal(focused, 2);
});

test('current document does not reload a draft and contextual tools still link back to their workspace', () => {
  const { ItemLink } = loadNavigation('/control/preview');
  const composition = sidebar.find(item => item.href === '/control/compositions'), content = sidebar.find(item => item.href === '/control/clips');
  for (const routeKey of ['/control/compositions?composition=saved', '/studio/control/compositions?composition=saved']) {
    const current = ItemLink({ item: composition, active: true, routeKey });
    assert.equal(current.type, 'span');
    assert.equal(current.props['aria-current'], 'page');
    assert.equal(current.props.href, undefined);
  }
  const contextual = ItemLink({ item: content, active: true, routeKey: '/control/events?dealer=astrid' });
  assert.equal(contextual.type, 'a');
  assert.equal(contextual.props.href, labUrl('/control/clips?dealer=astrid'));
  assert.equal(contextual.props.onClick, undefined);
});


test('server-rendered navigation keeps the mobile disclosure closed without reading viewport state', () => {
  const html = renderToStaticMarkup(loadNavigation('/control/preview', 'lane=draft').WorkspaceNavigation());
  assert.match(html, /aria-expanded="false" aria-controls="scout-mobile-navigation"[^>]*>Meny/);
  assert.match(html, /id="scout-mobile-navigation"[^>]*data-open="false"/);
  assert.doesNotMatch(html, /role="dialog"|aria-modal/);
});
