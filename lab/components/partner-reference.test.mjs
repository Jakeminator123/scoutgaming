import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const output = transformSync(readFileSync(new URL('./partner-reference.tsx', import.meta.url), 'utf8'), {
  filename: 'partner-reference.tsx',
  jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } },
  module: { type: 'commonjs' },
});
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function harness(dealerQuery, dealerId = 'elin') {
  const values = [], refs = [], activities = [], calls = { focus: 0, navigate: 0, close: 0 };
  let stateCursor = 0, refCursor = 0;
  const fakeReact = { ...React, useEffect() {},
    useState(initial) { const index = stateCursor++; if (!(index in values)) values[index] = initial; return [values[index], next => { values[index] = typeof next === 'function' ? next(values[index]) : next; }]; },
    useRef(initial) { const index = refCursor++; return refs[index] ??= { current: initial }; },
  };
  const window = { location: { origin: 'https://game.example' }, open: () => game };
  const game = { closed: false, opener: window, focus: () => calls.focus++, close: () => calls.close++, location: {
    href: `https://game.example/game?${dealerQuery}&labObserverOrigin=https%3A%2F%2Fgame.example&labObserverChannel=cc1c94e5-4d2d-455b-a321-262fa4ea48be`,
    replace: () => calls.navigate++,
  } };
  const module = { exports: {} };
  vm.runInNewContext(output.code, { module, exports: module.exports, window, URL, URLSearchParams, Error,
    require: name => name === 'react' ? fakeReact : name.endsWith('.module.css') ? { __esModule: true, default: {} }
      : name === '../lib/lab-url.mjs' ? { labBasePath: () => '/studio', labUrl: path => `/studio${path}` }
      : name === './native-speech-context' ? { NativeSpeechContext: React.createContext(null) } : require(name),
  });
  const props = { trace: { records: [] }, connected: false, connection: '', dealerId, focused: true,
    onConnect: async () => {}, onDisconnect() {}, onNative() {}, onActivity: entry => activities.push(entry),
  };
  return { values, refs, activities, calls, render() { stateCursor = refCursor = 0; return module.exports.PartnerReference(props); } };
}

test('cloud reattachment rejects another, missing or ambiguous dealer without changing ongoing play', () => {
  for (const query of ['dealer=astrid', '', 'dealer=elin&dealer=astrid']) {
    const h = harness(query);
    nodes(h.render(), node => node.type === 'button' && node.props.children === 'Anslut & följ spelet')[0].props.onClick();
    assert.match(h.values[4], /annan dealer/);
    assert.deepEqual(h.calls, { focus: 0, navigate: 0, close: 0 });
    assert.equal(h.activities.length, 0);
    assert.equal(h.refs[1].current, null, 'no observer is attached to the wrong game');
  }
});

test('cloud reattachment keeps a matching dealer game and records observation only', () => {
  const h = harness('dealer=elin');
  nodes(h.render(), node => node.type === 'button' && node.props.children === 'Anslut & följ spelet')[0].props.onClick();
  assert.equal(h.values[4], '');
  assert.deepEqual(h.calls, { focus: 1, navigate: 0, close: 0 });
  assert.equal(h.activities.length, 1);
  assert.equal(h.refs[1].current.origin, 'https://game.example');
});
