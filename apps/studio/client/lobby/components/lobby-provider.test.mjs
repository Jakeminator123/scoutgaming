import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import * as catalogModule from '../lib/catalog.mjs';
import * as historyModule from '../../../lib/studio-history.mjs';

const require = createRequire(import.meta.url), React = require('react');
const source = transformSync(readFileSync(new URL('./lobby-provider.tsx', import.meta.url), 'utf8'),
  { loader: 'tsx', format: 'cjs', jsx: 'automatic' }).code;
function catalog() {
  const room = (operatorId, id) => ({ id, key: operatorId + ':' + id, operatorId, name: id, game: 'blackjack',
    dealers: [{ id: 'nora', name: 'Nora' }], playUrl: '/play/blackjack?operator=' + operatorId + '&table=' + id });
  return {
    operators: ['alpha', 'beta'].map(id => ({ id, name: id, roomIds: [id + ':shared-room'], dealerIds: ['nora'] })),
    rooms: [room('alpha', 'shared-room'), room('beta', 'shared-room')],
    dealers: [{ id: 'nora', name: 'Nora' }],
  };
}
function harness(href = '/lobby?operator=alpha&room=shared-room', state = { consumer: 'preserved' }) {
  const origin = 'https://lobby.fixture.invalid', entries = [{ href, state }], listeners = new Map(), requests = [];
  let entry = 0, url = new URL(href, origin), cursor = 0, queue = [], tree;
  const slots = [], effects = [];
  const window = {
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    dispatchEvent(event) { for (const fn of listeners.get(event.type) ?? []) fn(event); return !event.defaultPrevented; },
  };
  const location = { get pathname() { return url.pathname; }, get search() { return url.search; },
    get hash() { return url.hash; }, get href() { return url.href; }, origin };
  const write = (next, href = url.href) => {
    url = new URL(href, url);
    return { href: url.pathname + url.search + url.hash, state: structuredClone(next) };
  };
  const history = {
    get state() { return entries[entry].state; }, get length() { return entries.length; },
    pushState(next, unused, href) { entries.splice(entry + 1); entries.push(write(next, href)); entry++; },
    replaceState(next, unused, href) { entries[entry] = write(next, href); },
    go(delta) {
      if (entry + delta < 0 || entry + delta >= entries.length) return;
      entry += delta; url = new URL(entries[entry].href, origin);
      window.dispatchEvent(new Event('popstate'));
    },
  };
  Object.assign(window, { location, history });
  const hooks = { ...React, useCallback: fn => fn,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!effects[index] || deps.some((value, i) => !Object.is(value, effects[index].deps[i]))) { queue = queue.filter(item => item.index !== index); queue.push({ index, effect, deps }); }
    },
  };
  const module = { exports: {} };
  runInNewContext(source, { module, exports: module.exports, window, URL, URLSearchParams, AbortController,
    require: name => name === 'react' ? hooks : name.includes('catalog.mjs') ? {
      ...catalogModule, loadLobbyCatalog: options => new Promise(resolve => requests.push({ options, resolve })),
    } : name.includes('studio-history.mjs') ? historyModule : require(name) });
  const render = () => { cursor = 0; tree = module.exports.LobbyProvider({ children: null }); return tree.props.value; };
  const settle = async () => {
    render(); const pending = queue; queue = [];
    for (const item of pending) {
      effects[item.index]?.cleanup?.();
      effects[item.index] = { deps: item.deps, cleanup: item.effect() };
    }
    await new Promise(setImmediate); return render();
  };
  return { window, history, location, requests, render, settle, get tree() { return tree; },
    async ready(value = catalog()) { await settle(); requests.at(-1).resolve(value); await new Promise(setImmediate); return render(); },
    unmount() { for (const effect of effects) effect?.cleanup?.(); },
  };
}

test('a published room URL selects its exact company and room after loading, without a dealer or launch', async () => {
  const h = harness('/lobby?operator=beta&room=shared-room');
  assert.equal(h.render().room, null);
  const value = await h.ready();
  assert.equal(value.operator.id, 'beta'); assert.equal(value.room.key, 'beta:shared-room');
  assert.equal(value.dealer, null); assert.equal(value.step, 3);
  assert.equal(h.requests.length, 1); assert.equal(h.history.length, 1);
  assert.equal(h.history.state.consumer, 'preserved');
  h.unmount();
});

test('explicit invalid, duplicate and stale room links never select another published room', async () => {
  for (const query of ['operator=alpha&room=missing', 'operator=missing&room=shared-room',
    'operator=alpha&room=shared-room&room=missing', 'operator=alpha&operator=beta&room=shared-room',
    'room=shared-room', 'operator=alpha&room=beta%3Ashared-room']) {
    const h = harness('/lobby?' + query), value = await h.ready();
    assert.equal(value.room, null, query); assert.equal(value.dealer, null, query);
    assert.match(JSON.stringify(h.tree.props.children), /inte tillgängligt/, query);
    assert.equal(h.location.search, '?' + query, 'invalid links must not be rewritten to a default');
    h.unmount();
  }
});

test('company changes clear room and dealer while reload and back/forward retain scoped URL context', async () => {
  const h = harness();
  let value = await h.ready();
  value.selectDealer('nora'); assert.equal(h.render().dealer.id, 'nora');
  value.selectOperator('beta'); value = h.render();
  assert.equal(value.operator.id, 'beta'); assert.equal(value.room, null); assert.equal(value.dealer, null);
  assert.equal(h.location.search, '?operator=beta');
  value.selectRoom('beta:shared-room'); value = h.render();
  assert.equal(value.room.key, 'beta:shared-room');
  assert.equal(h.location.search, '?operator=beta&room=shared-room');
  value.selectDealer('nora');
  h.history.go(-1); value = h.render();
  assert.equal(value.room.key, 'beta:shared-room'); assert.equal(value.dealer, null);
  h.history.go(-1); value = h.render();
  assert.equal(value.operator.id, 'beta'); assert.equal(value.room, null); assert.equal(value.dealer, null);
  h.history.go(-2); value = h.render();
  assert.equal(value.room.key, 'alpha:shared-room'); assert.equal(value.dealer, null);
  h.history.go(4); value = h.render();
  assert.equal(value.room.key, 'beta:shared-room'); assert.equal(value.dealer.id, 'nora');
  const reloaded = harness(h.location.href);
  assert.equal((await reloaded.ready()).room.key, 'beta:shared-room');
  assert.equal(h.history.state.consumer, 'preserved');
  h.unmount(); reloaded.unmount();
});

test('catalog refresh revokes a removed room and cancelled responses cannot restore it', async () => {
  const h = harness();
  await h.ready();
  h.render().reload(); await h.settle();
  assert.equal(h.requests[0].options.signal.aborted, true);
  assert.equal(h.render().room, null, 'no selection is exposed against a loading catalog');
  h.render().reload(); await h.settle();
  assert.equal(h.requests[1].options.signal.aborted, true);
  const next = catalog(); next.rooms = next.rooms.filter(room => room.operatorId !== 'alpha');
  next.operators[0].roomIds = [];
  h.requests[2].resolve(next); await new Promise(setImmediate);
  assert.equal(h.render().room, null);
  h.requests[1].resolve(catalog()); await new Promise(setImmediate);
  assert.equal(h.render().room, null);
  assert.match(JSON.stringify(h.tree.props.children), /inte tillgängligt/);
  assert.equal(h.location.search, '?operator=alpha&room=shared-room');
  h.unmount();
});

test('game return uses only a saved dealer still present in the selected room, never an invalid explicit selector',async()=>{
  for(const [query,saved,expected]of [
    ['', 'nora', 'nora'],['','foreign',null],['&dealer=foreign','nora',null],['&dealer=nora&dealer=foreign','nora',null],
  ]) {
    const h=harness('/lobby?operator=alpha&room=shared-room'+query);
    h.window.localStorage={getItem:()=>JSON.stringify({dealer:saved})};
    assert.equal((await h.ready()).dealer?.id??null,expected);h.unmount();
  }
});
