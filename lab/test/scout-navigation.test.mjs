import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { STUDIO_PRIMARY_NAVIGATION, STUDIO_TOOL_NAVIGATION } from '../lib/studio-navigation.mjs';
import { SCOUT_FOOTER_NAVIGATION, SCOUT_LEVELS, SCOUT_NAVIGATION, isScoutAuthPath, scoutNavigationItem } from '../lib/scout-navigation.mjs';

const groups = SCOUT_NAVIGATION;
const sidebar = [...groups.flatMap(group => group.items), ...SCOUT_FOOTER_NAVIGATION];
const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

test('sidebar groups stay in Spec 02 order and point at real pages', () => {
  assert.deepEqual(groups.map(group => group.label), ['', 'Studio', 'OpenClaw', 'Drift', 'Åtkomst']);
  assert.deepEqual(groups.map(group => group.items.map(item => [item.href, item.label])), [
    [['/control', 'Översikt']],
    [['/control/clips', 'Dealers & klipp'], ['/control/tree', 'Händelser → klipp'], ['/control/videos', 'Klippbibliotek'], ['/control/zones', 'Bakgrundszoner'], ['/control/events', 'Händelser']],
    [['/control/openclaw', 'Agentmodeller'], ['/control/operator-chat', 'Operatörschatt']],
    [['/control/administration', 'Administration'], ['/control/activity', 'Uppspelning'], ['/control/probe', 'Talgranskning']],
    [['/partner', 'Partners']],
  ]);
  assert.deepEqual(SCOUT_FOOTER_NAVIGATION.map(item => [item.href, item.label]), [
    ['/control/guide', 'Guide & hjälp'],
  ]);
  // Every page keeps exactly one menu label; the administration page gets tabs before it gets more.
  const hrefs = sidebar.map(item => item.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
  assert.deepEqual(SCOUT_LEVELS.map(item => [item.href, item.label]), [
    ['/control', '1 · Admin'], ['/partner', '2 · Spelbolag'], ['/play', '3 · Spelare'],
  ]);
  for (const item of sidebar) {
    const page = item.href === '/control' ? 'control/[[...path]]/page.tsx'
      : item.href === '/partner' ? 'partner/[[...path]]/page.tsx'
      : `${item.href.slice(1)}/page.tsx`;
    assert.match(readFileSync(new URL(`../app/${page}`, import.meta.url), 'utf8'), /export default/, item.href);
  }
  assert.match(readFileSync(new URL('../../apps/croupier-frontend/app/play/page.tsx', import.meta.url), 'utf8'), /export default/);
});

test('old header destinations stay reachable from the sidebar or the level switcher', () => {
  const covered = new Set([...sidebar.map(item => item.href), ...SCOUT_LEVELS.map(item => item.href)]);
  for (const item of [...STUDIO_PRIMARY_NAVIGATION, ...STUDIO_TOOL_NAVIGATION]) assert.equal(covered.has(item.href), true, item.href);
  assert.equal(covered.has('/partner'), true);
  assert.equal(covered.has('/play'), true);
});

test('active item resolves for empty and /studio base paths and keeps the first shared label', () => {
  for (const base of ['', '/studio']) {
    assert.equal(scoutNavigationItem('/control', base)?.label, 'Översikt');
    assert.equal(scoutNavigationItem(`${base}/control`.replace('//', '/'), base)?.label, 'Översikt');
    assert.equal(scoutNavigationItem('/control/clips', base)?.label, 'Dealers & klipp');
    assert.equal(scoutNavigationItem(`${base}/control/clips`.replace('//', '/'), base)?.label, 'Dealers & klipp');
    assert.equal(scoutNavigationItem('/activity', base)?.label, 'Uppspelning');
    assert.equal(scoutNavigationItem(`${base}/activity`.replace('//', '/'), base)?.label, 'Uppspelning');
    assert.equal(scoutNavigationItem('/control/administration', base)?.label, 'Administration');
    assert.equal(scoutNavigationItem('/control/zones', base)?.label, 'Bakgrundszoner');
    assert.equal(scoutNavigationItem('/control/events', base)?.label, 'Händelser');
    assert.equal(scoutNavigationItem('/studio/studio/videos', base), null);
  }
  assert.equal(scoutNavigationItem('/', '')?.label, 'Dealers & klipp');
  assert.equal(scoutNavigationItem('/studio', '/studio')?.label, 'Dealers & klipp');
  assert.equal(scoutNavigationItem('/studio', ''), null);
  for (const base of [null, {}, [], '/studio/', '/other']) assert.equal(scoutNavigationItem('/control/clips', base), null);
});

function loadNavigation(pathname) {
  const file = 'workspace-navigation.tsx';
  const url = new URL(`../components/${file}`, import.meta.url);
  const output = transformSync(readFileSync(url, 'utf8'), { filename: file, jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const localRequire = createRequire(url), module = { exports: {} };
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone,
    require: name => {
      if (name === 'next/navigation') return { usePathname: () => pathname };
      if (name.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name.startsWith('./')) return new Proxy({}, { get: () => () => null });
      return localRequire(name);
    },
  }, { filename: file });
  return module.exports;
}

test('login pages render without the staff menu under empty and /studio base paths', () => {
  for (const base of ['', '/studio']) {
    for (const path of ['/login', '/set-password', '/control/login', '/control/set-password', '/partner/login']) {
      assert.equal(isScoutAuthPath(`${base}${path}`, base), true, `${base}${path}`);
      assert.equal(isScoutAuthPath(`${base}${path}/`, base), true, `${base}${path}/`);
    }
    assert.equal(isScoutAuthPath(`${base}/control/clips`, base), false);
    assert.equal(isScoutAuthPath(`${base}/control/login-history`, base), false);
  }
  assert.equal(isScoutAuthPath('/login', '/studio'), true);
  assert.equal(isScoutAuthPath('/studio/login', ''), false);
  // usePathname() never includes the basePath, so the shell sees the bare path.
  for (const path of ['/control/login', '/control/set-password', '/login']) {
    const { WorkspaceNavigation } = loadNavigation(path);
    assert.equal(renderToStaticMarkup(React.createElement(WorkspaceNavigation, null, React.createElement('main', null, 'login-form'))), '<main>login-form</main>', path);
  }
});

test('partner documents render no staff shell and administration highlights only the first label', () => {
  for (const path of ['/partner', '/studio/partner', '/partner/demo-north/overview', '/studio/partner/demo-south/team']) {
    const { WorkspaceNavigation } = loadNavigation(path);
    assert.equal(renderToStaticMarkup(WorkspaceNavigation()), '', path);
  }
  const { WorkspaceNavigation, ShellStatus } = loadNavigation('/control/administration');
  const html = renderToStaticMarkup(WorkspaceNavigation());
  assert.match(html, /aria-current="page"[^>]*>Administration/);
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /status-marker/);
  const withStatus = renderToStaticMarkup(React.createElement(ShellStatus.Provider, { value: 'status-marker' }, React.createElement(WorkspaceNavigation)));
  assert.match(withStatus, /status-marker/);
  const source = readFileSync(new URL('../components/workspace-navigation.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /onClick|onNavigate|next\/link|history\.(?:pushState|replaceState)/);
  assert.doesNotMatch(html, /type="search"|Sök dealer, klipp, bord, konto…|Inte ansluten ännu/);
});
