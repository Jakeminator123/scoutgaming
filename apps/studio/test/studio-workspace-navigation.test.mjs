import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
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

// Every dealer tab is a tab of that dealer's nav: the dealer sits in the path, the selection in the query.
const pathOf = href => new URL(href, 'https://scoutgaming.test').pathname;
const flikOf = { clips: 'klipp', speech: 'tal', replies: 'tal', generate: 'klipp', settings: 'installningar' };

test('switching dealer tabs keeps the selected event, variant, situation and composition', () => {
  const tabs = studioNavigationTabs(selection);
  for (const tab of tabs) {
    const params = query(tab.href);
    assert.equal(pathOf(tab.href), '/admin/dealers/' + selection.dealerId, tab.id);
    assert.equal(params.has('dealer'), false, tab.id);
    assert.equal(params.get('flik'), flikOf[tab.id], tab.id);
    assert.equal(params.get('panel'), tab.id === 'generate' ? 'generera' : null, tab.id);
    assert.equal(params.get('event'), selection.eventId);
    assert.equal(params.get('variant'), selection.variantId);
    assert.equal(params.get('situation'), selection.situation);
    assert.equal(params.get('composition'), selection.laneId);
  }
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

test('dealer navigation never substitutes another dealer identity', () => {
  for (const dealerId of ['astrid', 'paow', 'new-dealer']) {
    for(const tab of studioNavigationTabs({dealerId})){assert.equal(pathOf(tab.href),'/admin/dealers/'+dealerId,tab.id);assert.equal(query(tab.href).has('dealer'),false,tab.id);}
  }
  // An identity that cannot be a path segment stays a query selector on the dealer list for downstream validation.
  for(const tab of studioNavigationTabs({dealerId:'dealer & two'})){assert.equal(pathOf(tab.href),'/admin/dealers',tab.id);assert.equal(query(tab.href).get('dealer'),'dealer & two',tab.id);}
});

test('a selected company filters the company list and does not open the company nav', () => {
  assert.equal(studioNavigationHref('/admin/companies', { operatorId: 'north' }), '/admin/companies?tab=spelbord&operator=north');
  assert.equal(studioNavigationHref('/admin/companies?tab=papperskorg', { operatorId: 'north' }), '/admin/companies?tab=papperskorg&operator=north');
  assert.equal(studioNavigationHref('/admin/companies'), '/admin/companies');
  // Retired bookmarks keep their one-step redirect to the company's nav.
  assert.equal(studioNavigationHref('/control/lanes?tab=companies', { operatorId: 'north' }), '/admin/companies/north');
});

test('rendered navigation preserves repeated and mixed room scope for destination validation', () => {
  const queryText='dealer=paow&operator=north&operator=south&table=one&table=two&room=three&room=four&token=private';
  const Navigation=loadNavigation(queryText);
  for(const {id:active} of studioNavigationTabs()) {
    const tree=Navigation({...selection,active});
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

test('navigation delegates ordinary clicks to the editor guard without taking over navigation', () => {
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
