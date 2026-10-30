import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { studioNavigationContextFromQuery } from '../lib/studio-navigation.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

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
  for(const operator of operators)assert.ok(links.some(href=>href.endsWith('/'+operator.slug)));
  assert.match(html, /Johnsspelbolag/);
  assert.doesNotMatch(html, /Demo North|Demo South|demo-north|demo-south|partner\/login|Kundinloggning.*återstår/);

});

test('level-two member entrance is scoped and empty access never selects a fixture', () => {
  const { PartnerWorkspace } = loadComponent('partner-workspace.tsx');
  const render = operators => renderToStaticMarkup(React.createElement(PartnerWorkspace, { user: 'john', operators, accessClass: 'partner' }));
  const member = render([{ slug: 'johnsspelbolag', name: 'Johnsspelbolag' }]);
  assert.match(member, /href="\/partner\/johnsspelbolag"/);
  assert.doesNotMatch(member, /href="\/(?:admin|lobby|control|play)"|sg-test|Demo North|Demo South|Intern administratör/);
  for (const operators of [[], [{ slug: 'login', name: 'Invalid destination' }], [{ slug: '../sg-test', name: 'Invalid destination' }]]) {
    const empty = render(operators);
    assert.match(empty, /Inga tillgängliga bolag/);
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

test('dealer dialog receives selected identity, draft state and voice availability', () => {
  const saved = process.env.NEXT_PUBLIC_LAB_BASE_PATH;
  try {
    for (const basePath of ['', '/studio']) {
      process.env.NEXT_PUBLIC_LAB_BASE_PATH = basePath;
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
    }
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_LAB_BASE_PATH;
    else process.env.NEXT_PUBLIC_LAB_BASE_PATH = saved;
  }
});

test('Öppna spelrum i Dialogtest följer single() för tvetydiga spelrum', () => {
  const hooks = {...React, useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {}, useRef: current => ({current}), useMemo: fn => fn(), useCallback: fn => fn};
  function GatewayPanel() { return null; }
  const open = search => {
    const assigned = [];
    const browser = {location: {pathname: '/admin/dealers/astrid', search, hash: '', assign: href => assigned.push(href)}};
    const {ControlOpenClawChat} = loadComponent('control-openclaw-chat.tsx', {react: hooks, './gateway-panel': {GatewayPanel},
      '../lib/studio-history.mjs': {studioHistory: () => ({canNavigate: () => true})}}, browser);
    let panel;
    visit(mountSelectedPage(ControlOpenClawChat, {initialProject: createSeedProject(), initialDealerId: 'astrid', initialVideos: {videos: []}, initialStatus: {configured: false}, standaloneVoicePreviewAvailable: true}), node => {if (node.type === GatewayPanel) panel = node;});
    panel.props.onPlayerChat();
    assert.equal(assigned.length, 1);
    return new URL(assigned[0], 'https://studio.invalid');
  };
  const mixed = open('?dealer=astrid&operator=operator-a&table=room-a&table=room-b&room=room-c');
  assert.equal(mixed.pathname, '/admin/companies');
  assert.equal(mixed.searchParams.get('tab'), 'spelbord');
  assert.equal(mixed.searchParams.get('operator'), 'operator-a');
  assert.deepEqual(mixed.searchParams.getAll('table'), ['room-a', 'room-b']);
  assert.deepEqual(mixed.searchParams.getAll('room'), ['room-c']);
  assert.equal(open('?dealer=astrid&operator=operator-a&table=room-a').pathname, '/admin/rooms/room-a');
});

test('unavailable search params leave Studio navigation unselected', () => {
  assert.deepEqual(studioNavigationContextFromQuery(null), {});
  assert.deepEqual(studioNavigationContextFromQuery(undefined), {});
  assert.deepEqual(studioNavigationContextFromQuery(new URLSearchParams()), {});
  assert.deepEqual(studioNavigationContextFromQuery(new URLSearchParams('dealer=vera&event=speak.goodluck&lane=explicit-layout&token=private')), { dealerId: 'vera', eventId: 'speak.goodluck', laneId: 'explicit-layout' });
});
