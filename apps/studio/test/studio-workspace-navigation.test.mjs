import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { studioNavigationHref, studioNavigationTabs, studioNavigationContextFromQuery } from '../lib/studio-navigation.mjs';

const selection = { dealerId: 'paow', eventId: 'speak.goodluck', variantId: 'paow.goodluck.alt-2', situation: 'goodluck', laneId: 'studio/main' };
const query = href => new URL(href, 'https://scoutgaming.test').searchParams;

function loadNavigation(search = '') {
  const url = new URL('../components/studio-navigation.tsx', import.meta.url);
  const require = createRequire(url);
  const { transformSync } = require('next/dist/build/swc');
  const result = transformSync(readFileSync(url, 'utf8'), {
    filename: 'studio-navigation.tsx',
    jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  });
  const module = { exports: {} };
  vm.runInNewContext(result.code, {
    module, exports: module.exports, URL,
    require: name => name === 'next/navigation' ? { useSearchParams: () => new URLSearchParams(search) } : name.endsWith('.module.css')
      ? { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
      : require(name),
  });
  return module.exports.StudioNavigation;
}
const StudioNavigation = loadNavigation();

function anchors(node) {
  if (Array.isArray(node)) return node.flatMap(anchors);
  if (!node || typeof node !== 'object') return [];
  return [...(node.type === 'a' ? [node] : []), ...anchors(node.props?.children)];
}

test('switching dealer tabs keeps the selected event, variant, situation and composition', () => {
  const tabs = studioNavigationTabs(selection);
  for (const tab of tabs) {
    const params = query(tab.href);
    assert.equal(params.get('dealer'), selection.dealerId);
    assert.equal(params.get('event'), selection.eventId);
    assert.equal(params.get('variant'), selection.variantId);
    assert.equal(params.get('situation'), selection.situation);
    assert.equal(params.get('composition'), selection.laneId);
    assert.equal(params.get('view'), tab.id === 'generate' ? 'generate' : null);
  }
  assert.equal(tabs.some(tab => tab.href.startsWith('/admin/compositions')), false);
});

test('custom tab destinations keep their own query and hash while encoding selection safely', () => {
  const href = studioNavigationTabs({ ...selection, dealerId: 'dealer & two' }, {
    speech: '/admin/probe?mode=recorded#settings',
  }).find(tab => tab.id === 'speech').href;
  assert.equal(query(href).get('dealer'), 'dealer & two');
  assert.equal(query(href).get('mode'), 'recorded');
  assert.ok(href.endsWith('#settings'));
  assert.equal(query(studioNavigationHref('/admin/dealer-studio', { ...selection, tab: 'triggers', token: 'not-a-context-value' })).has('token'), false);
});

test('public Studio tabs use their active destinations with either lab base path', () => {
  const before = process.env.NEXT_PUBLIC_LAB_BASE_PATH;
  try {
    for (const base of ['', '/studio']) {
      process.env.NEXT_PUBLIC_LAB_BASE_PATH = base;
      for (const tab of studioNavigationTabs(selection)) {
        const target = {replies:'/admin/replies?',generate:'/admin/dealer-studio?'}[tab.id] ?? '/admin/clips?';
        assert.ok(tab.href.startsWith(target), tab.href);
      }
      assert.equal(studioNavigationHref('/studio/control/clips?view=idle', { dealerId: 'paow' }), '/admin/clips?dealer=paow');
    }
  } finally {
    if (before === undefined) delete process.env.NEXT_PUBLIC_LAB_BASE_PATH;
    else process.env.NEXT_PUBLIC_LAB_BASE_PATH = before;
  }
});

test('speech tab opens the selected dealer workspace rather than an Astrid-only setting', () => {
  for (const dealerId of ['astrid', 'paow', 'new-dealer']) {
    assert.equal(studioNavigationTabs({ dealerId }).find(tab => tab.id === 'speech').href, `/admin/clips?panel=room&dealer=${dealerId}`);
  }
});



test('rendered tabs and ancestors preserve repeated and mixed room scope for destination validation', () => {
  const queryText='dealer=paow&operator=north&operator=south&table=one&table=two&room=three&room=four&token=private';
  const Navigation=loadNavigation(queryText);
  for(const active of ['clips','speech','settings']) {
    const tree=Navigation({...selection,active,crumbs:[{label:'Klipp',href:'/admin/dealer-studio?view=clips#selected'},{label:'Detalj'}]});
    const links=anchors(tree);assert.ok(links.length);
    for(const link of links) {
      const params=query(link.props.href);
      assert.deepEqual(params.getAll('operator'),['north','south']);
      assert.deepEqual(params.getAll('table'),['one','two']);
      assert.deepEqual(params.getAll('room'),['three','four']);
      assert.equal(params.has('token'),false);
    }
  }
});



test('every ancestor and tab delegates ordinary clicks to the editor guard without taking over navigation', () => {
  const calls = [];
  const tree = StudioNavigation({ ...selection, dealerLabel: 'PAOW', active: 'clips',
    onNavigate: (event, href) => { event.preventDefault(); calls.push(href); },
  });
  for (const anchor of anchors(tree)) {
    const event = { button: 0, preventDefault() { this.defaultPrevented = true; } };
    anchor.props.onClick(event);
    assert.equal(event.defaultPrevented, true);
    assert.equal(calls.at(-1), anchor.props.href);
  }
  const count = calls.length;
  for (const extra of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { defaultPrevented: true }]) {
    anchors(tree)[0].props.onClick({ button: 0, ...extra });
  }
  assert.equal(calls.length, count);
});




test('query context reader includes only Studio selection keys and omits empty values',()=>{
  const query=new URLSearchParams({dealer:'paow',event:'speak.goodluck',variant:'paow.goodluck.alt-2',situation:'goodluck',lane:'studio/main',category:'player-kind',token:'private',tab:'triggers',cursor:'opaque'});assert.deepEqual(studioNavigationContextFromQuery(query),selection);assert.deepEqual(studioNavigationContextFromQuery(new URLSearchParams('dealer=&event=&token=x')),{});
});
