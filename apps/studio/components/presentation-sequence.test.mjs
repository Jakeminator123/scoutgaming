import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildPresentationSequence } from '../lib/presentation-sequence.mjs';
import { createSeedProject } from '../../../packages/presentation/contracts/studio-model.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const source = readFileSync(new URL('./presentation-sequence.tsx', import.meta.url), 'utf8');
const compiled = transformSync(source, { filename: 'presentation-sequence.tsx', jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
function component(react = React) {
  const module = { exports: {} };
  vm.runInNewContext(compiled.code, { module, exports: module.exports, AbortController, Error, Promise,
    require: name => name === 'react' ? react : name.endsWith('.module.css') ? { __esModule: true, default: {} } : require(name) });
  return module.exports.PresentationSequence;
}
const project = createSeedProject();
const sequence = (events = [{ type: 'speak', line: 'goodluck' }, { type: 'idle' }]) => buildPresentationSequence([{ id: 'test:1', source: 'partner', time: '2026-09-21T12:00:00Z',
  data: { type: 'round', requestId: 'test-command', version: 1, events } }], project);
const render = data => renderToStaticMarkup(React.createElement(component(), { sequence: data, onSelect() {}, onPlay: async () => {}, onOpenEvent() {} }));

test('empty stream is explicit and presents no fake round or playback control', () => {
  const html = render(buildPresentationSequence([], project));
  assert.match(html, /Inga spelinstruktioner har mottagits/);
  assert.doesNotMatch(html, /Spela steget i labbet|Spela från detta steg|Öppna linjen/);
});

test('received instructions retain correlation, bounded editing labels and explicit replay evidence', () => {
  const html = render(sequence());
  assert.match(html, /2 instruktioner · 1 kommandosvar/);
  assert.match(html, /Redigeringsgrupp:/);
  assert.match(html, /Originalspelarens klippval, bildrutor och tidpunkter är inte verifierade/);
  assert.match(html, /test-command/);
  assert.match(html, /presentationIndex/);
  assert.match(html, /actualPlaybackCaptured/);
  assert.match(html, /aria-current="step"/);
});

test('unknown signals remain inspectable with blocked replay', () => {
  const html = render(sequence([{ type: 'native-unknown' }]));
  assert.match(html, /Omappad signal/);
  assert.match(html, /Okänd signal/);
  assert.match(html, /disabled="">Spela steget i labbet/);
  assert.doesNotMatch(html, /Öppna linjen/);
});

// Small hook harness exercises event handlers and deferred player completion;
// it does not model DOM rendering or claim browser audiovisual verification.
function harness(props) {
  const hooks = []; let cursor = 0;
  const react = { ...React,
    useState(initial) { const index = cursor++; hooks[index] ??= { value: initial }; return [hooks[index].value, next => { hooks[index].value = typeof next === 'function' ? next(hooks[index].value) : next; }]; },
    useRef(initial) { const index = cursor++; hooks[index] ??= { current: initial }; return hooks[index]; },
    useEffect() { cursor++; },
  };
  const Component = component(react);
  function render() { cursor = 0; return Component(props); }
  function elements(node, result = []) {
    if (Array.isArray(node)) for (const child of node) elements(child, result);
    else if (node?.props) { result.push(node); elements(node.props.children, result); }
    return result;
  }
  function button(label) { return elements(render()).find(item => item.type === 'button' && item.props.children === label); }
  return { button, render };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('sequence playback awaits actual completion before the next instruction', async () => {
  const calls = []; let finish;
  const ui = harness({ sequence: sequence(), onSelect() {}, onPlay: step => { calls.push(step.presentationIndex); return calls.length === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(); } });
  ui.button('Spela från detta steg').props.onClick();
  await tick(); assert.deepEqual(calls, [0]);
  assert.ok(ui.button('Stoppa återspelning'));
  finish(); await tick();
  assert.deepEqual(calls, [0, 1]);
  assert.ok(ui.button('Spela från detta steg'));
});

test('stop aborts the player signal and never schedules the next recorded instruction', async () => {
  const calls = []; let signal;
  const ui = harness({ sequence: sequence(), onSelect() {}, onPlay: (step, options) => { calls.push(step.presentationIndex); signal = options.signal; return new Promise(() => {}); } });
  ui.button('Spela från detta steg').props.onClick(); await tick();
  ui.button('Stoppa återspelning').props.onClick(); await tick();
  assert.equal(signal.aborted, true);
  assert.deepEqual(calls, [0]);
  assert.ok(ui.button('Spela från detta steg'));
});

test('a playback failure or unsupported later step stops the sequence', async () => {
  for (const rejected of [true, false]) {
    const calls = [];
    const ui = harness({ sequence: rejected ? sequence() : sequence([{ type: 'idle' }, { type: 'unmapped' }, { type: 'idle' }]), onSelect() {},
      onPlay: step => { calls.push(step.presentationIndex); return rejected ? Promise.reject(new Error('Media kunde inte spelas.')) : Promise.resolve(); } });
    ui.button('Spela från detta steg').props.onClick(); await tick();
    assert.deepEqual(calls, [0]);
    assert.ok(ui.button('Spela från detta steg'));
  }
});
