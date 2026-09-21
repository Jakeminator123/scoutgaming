import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { webcrypto } from 'node:crypto';
import { createSeedProject } from '../lib/studio-model.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const source = readFileSync(new URL('../components/game-stream.tsx', import.meta.url), 'utf8');
const compiled = transformSync(source, { filename: 'game-stream.tsx', jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
const Stage = () => null, Sequence = () => null, Reference = () => null;
const record = (events, version = 1, requestId = `command.${version}`) => ({ id: `observation:${version}`, source: 'partner', time: '2026-09-21T12:00:00Z', data: { type: 'round', requestId, version, events } });
const tick = () => new Promise(resolve => setImmediate(resolve));
const outcome = promise => promise.then(() => ({ completed: true }), error => ({ error }));

// This harness commits state/effects and invokes real GameStream handlers. Media
// and the network remain explicit deferred boundaries; no live commands or media.
function setup(records = [record([{ type: 'idle' }, { type: 'speak', line: 'goodluck' }])]) {
  const hooks = []; let cursor = 0, dirty = false, tree; const effects = [], requests = [], activity = [];
  const project = createSeedProject();
  let props = { trace: { records, bytes: 0, limited: false }, project, videos: { videos: [] }, originals: null, dealerId: 'astrid', active: true, onActivity: entry => activity.push(entry), onOpenEvent() {} };
  const same = (a, b) => a && b && a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
  const react = { ...React,
    useState(initial) { const index = cursor++; hooks[index] ??= { value: typeof initial === 'function' ? initial() : initial }; return [hooks[index].value, value => { const next = typeof value === 'function' ? value(hooks[index].value) : value; if (!Object.is(next, hooks[index].value)) { hooks[index].value = next; dirty = true; } }]; },
    useRef(initial) { const index = cursor++; hooks[index] ??= { current: initial }; return hooks[index]; },
    useMemo(factory, deps) { const index = cursor++; if (!hooks[index] || !same(hooks[index].deps, deps)) hooks[index] = { deps, value: factory() }; return hooks[index].value; },
    useEffect(effect, deps) { const index = cursor++; if (!hooks[index] || !same(hooks[index].deps, deps)) { const previous = hooks[index]; hooks[index] = { deps, cleanup: previous?.cleanup }; effects.push(() => { previous?.cleanup?.(); hooks[index].cleanup = effect(); }); } },
  };
  const mocks = {
    '../lib/presentation-sequence.mjs': require('../lib/presentation-sequence.mjs'),
    '../lib/original-media.mjs': require('../lib/original-media.mjs'),
    '../lib/video-intake.mjs': require('../lib/video-intake.mjs'),
    './test-context': { neutralContext: {} },
    './studio-types': { requestJson: (url, init) => new Promise((resolve, reject) => {
      const body = JSON.parse(init.body); const entry = { url, body, signal: init.signal, resolve, reject }; requests.push(entry);
      init.signal.addEventListener('abort', () => reject(new Error('Request aborted')), { once: true });
    }) },
    './stage': { Stage }, './presentation-sequence': { PresentationSequence: Sequence }, './reference-capture': { ReferenceCapture: Reference },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled.code, { module, exports: module.exports, AbortController, Error, Promise, crypto: webcrypto,
    require: name => name === 'react' ? react : name.endsWith('.module.css') ? { __esModule: true, default: {} } : mocks[name] ?? require(name) });
  function flush() {
    for (let count = 0; count < 20; count++) {
      dirty = false; cursor = 0; tree = module.exports.GameStream(props);
      for (const effect of effects.splice(0)) effect();
      if (!dirty) return;
    }
    throw new Error('Render did not settle');
  }
  function nodes(node, found = []) { if (Array.isArray(node)) node.forEach(child => nodes(child, found)); else if (node?.props) { found.push(node); nodes(node.props.children, found); } return found; }
  const find = type => nodes(tree).find(node => node.type === type)?.props;
  function button(label) { return nodes(tree).find(node => node.type === 'button' && node.props.children === label)?.props; }
  function update(next) { props = { ...props, ...next }; flush(); }
  function append(next) { update({ trace: { ...props.trace, records: [...props.trace.records, next] } }); }
  function resolve(index = requests.length - 1) {
    const request = requests[index]; const line = project.lines.find(line => line.dealerId === 'astrid' && line.eventId === request.body.eventId);
    const variant = line.variants.find(variant => variant.id === line.baselineVariantId);
    request.resolve({ variant, asset: project.assets.find(asset => asset.id === variant.assetId), videoGenerationId: null,
      decision: { sourceEvent: request.body.sourceEvent, simulated: false } });
  }
  function play(index = 0) { const seq = find(Sequence); const controller = new AbortController(); const result = outcome(seq.onPlay(seq.sequence.steps[index], { signal: controller.signal, mode: 'replay' })); flush(); return { result, controller }; }
  flush(); return { flush, find, button, update, append, resolve, play, requests, activity, project,
    unmount() { for (const hook of hooks) hook?.cleanup?.(); } };
}

test('replay from the original view waits for the matching player completion and preserves exact source data', async () => {
  const ui = setup(); assert.equal(ui.requests.length, 0);
  const run = ui.play(1); assert.equal(ui.requests.length, 1);
  assert.equal(ui.requests[0].url, '/api/presentation/decision');
  assert.equal(ui.requests[0].body.sourceRef.requestId, 'command.1');
  assert.equal(ui.requests[0].body.sourceRef.presentationIndex, 1);
  assert.match(ui.requests[0].body.requestId, /^[a-f0-9-]{36}$/);
  assert.deepEqual(ui.requests[0].body.sourceEvent, { type: 'speak', line: 'goodluck' });
  ui.resolve(); await tick(); ui.flush();
  assert.equal(ui.find(Stage).playing, true);
  let complete = false; run.result.then(() => { complete = true; }); await tick(); assert.equal(complete, false);
  ui.find(Stage).onPlaybackEvent({ phase: 'started', medium: '2d' }); await tick(); assert.equal(complete, false);
  ui.find(Stage).onPlaybackEvent({ phase: 'completed', medium: '2d' });
  assert.deepEqual(await run.result, { completed: true }); ui.flush(); assert.equal(ui.find(Stage).playing, false);
});

test('cancelled model requests cannot start playback after a late response', async () => {
  const ui = setup(); const run = ui.play();
  run.controller.abort(); ui.resolve(); await tick(); ui.flush();
  assert.equal(ui.requests[0].signal.aborted, true);
  assert.ok((await run.result).error);
  assert.equal(ui.find(Stage).playing, false);
  assert.equal(ui.find(Stage).busy, false);
  assert.equal(ui.activity.filter(entry => entry.stage === 'decision').length, 0);
});

test('an old player receipt cannot complete or stop a later playback generation', async () => {
  const ui = setup(); const first = ui.play(); ui.resolve(); await tick(); ui.flush();
  const oldReceipt = ui.find(Stage).onPlaybackEvent;
  const second = ui.play(1); ui.resolve(); await tick(); ui.flush();
  assert.ok((await first.result).error);
  let completed = false; second.result.then(() => { completed = true; });
  oldReceipt({ phase: 'completed', medium: '2d' }); await tick(); ui.flush();
  assert.equal(completed, false); assert.equal(ui.find(Stage).playing, true);
  ui.find(Stage).onPlaybackEvent({ phase: 'completed', medium: '2d' });
  assert.deepEqual(await second.result, { completed: true });
});

test('a conflicting receipt stops active playback and old selected objects cannot bypass the conflict', async () => {
  const ui = setup([record([{ type: 'idle' }])]); const stale = ui.find(Sequence).sequence.steps[0];
  const run = ui.play(); ui.resolve(); await tick(); ui.flush();
  ui.append(record([{ type: 'speak', line: 'double' }])); await tick(); ui.flush();
  assert.ok((await run.result).error); assert.equal(ui.find(Stage).playing, false);
  assert.equal(ui.find(Sequence).sequence.steps[0].blocked, true);
  const attempt = outcome(ui.find(Sequence).onPlay(stale, { signal: new AbortController().signal, mode: 'replay' }));
  assert.ok((await attempt).error); assert.equal(ui.requests.length, 1);
});

test('navigation during playback rejects the queue wait and late completion is ignored', async () => {
  const ui = setup(); const run = ui.play(); ui.resolve(); await tick(); ui.flush();
  const receipt = ui.find(Stage).onPlaybackEvent; const count = ui.activity.length;
  ui.update({ active: false }); await tick();
  assert.ok((await run.result).error);
  receipt({ phase: 'completed', medium: '2d' }); ui.flush();
  assert.equal(ui.find(Stage).playing, false); assert.equal(ui.activity.length, count);
});

test('live follow ignores past instructions and drains new instructions only after each actual completion', async () => {
  const ui = setup([record([{ type: 'idle' }])]);
  ui.button('Labbets presentation').onClick(); ui.flush();
  ui.button('Följ nya instruktioner').onClick(); ui.flush(); assert.equal(ui.requests.length, 0);
  ui.append(record([{ type: 'speak', line: 'goodluck' }, { type: 'idle' }], 2)); assert.equal(ui.requests.length, 1);
  ui.resolve(); await tick(); ui.flush(); assert.equal(ui.requests.length, 1);
  ui.append(record([{ type: 'speak', line: 'double' }], 3)); assert.equal(ui.requests.length, 1);
  ui.find(Stage).onPlaybackEvent({ phase: 'completed', medium: '2d' }); await tick(); ui.flush(); assert.equal(ui.requests.length, 2);
  ui.resolve(); await tick(); ui.flush(); ui.find(Stage).onPlaybackEvent({ phase: 'completed', medium: '2d' }); await tick(); ui.flush(); assert.equal(ui.requests.length, 3);
  ui.resolve(); await tick(); ui.flush(); ui.find(Stage).onPlaybackEvent({ phase: 'completed', medium: '2d' }); await tick(); ui.flush();
  assert.deepEqual(ui.requests.map(request => request.body.sourceEvent), [{ type: 'speak', line: 'goodluck' }, { type: 'idle' }, { type: 'speak', line: 'double' }]);
  ui.button('Stoppa följning').onClick(); ui.flush();
});

test('new connection gaps stop live follow instead of replaying a partial continuation', async () => {
  const ui = setup([record([{ type: 'idle' }])]);
  ui.button('Labbets presentation').onClick(); ui.flush(); ui.button('Följ nya instruktioner').onClick(); ui.flush();
  ui.append(record([{ type: 'speak', line: 'double' }, { type: 'idle' }], 2));
  ui.resolve(); await tick(); ui.flush();
  ui.append({ kind: 'status', data: { state: 'disconnected', gap: true, reason: 'transport-error' } }); await tick(); ui.flush();
  assert.ok(ui.button('Följ nya instruktioner')); assert.equal(ui.find(Stage).playing, false); assert.equal(ui.requests.length, 1);
});

test('model failure releases busy state and stops follow without playing a later event', async () => {
  const ui = setup([record([{ type: 'idle' }])]);
  ui.button('Labbets presentation').onClick(); ui.flush(); ui.button('Följ nya instruktioner').onClick(); ui.flush();
  ui.append(record([{ type: 'speak', line: 'goodluck' }, { type: 'idle' }], 2));
  ui.requests[0].reject(new Error('Model request failed')); await tick(); ui.flush();
  assert.ok(ui.button('Följ nya instruktioner')); assert.equal(ui.find(Stage).busy, false); assert.equal(ui.find(Stage).playing, false);
  assert.equal(ui.requests.length, 1);
});

test('unmount aborts outstanding work and a stopped prior signal cannot cancel a newer run', async () => {
  const ui = setup(); const first = ui.play(); ui.resolve(); await tick(); ui.flush();
  const second = ui.play(1); ui.resolve(); await tick(); ui.flush();
  assert.ok((await first.result).error);
  first.controller.abort(); ui.flush(); assert.equal(ui.find(Stage).playing, true);
  ui.unmount(); assert.ok((await second.result).error); assert.equal(ui.requests[1].signal.aborted, true);
});
