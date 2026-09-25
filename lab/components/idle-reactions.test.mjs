import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { idleReactionInput } from '../lib/idle-reaction-input.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const code = transformSync(readFileSync(new URL('./idle-reactions.tsx', import.meta.url), 'utf8'), {
  filename: 'idle-reactions.tsx', jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' },
}).code;
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function fixture() {
  const hooks = [], effects = [], requests = [], offers = [], activities = [], timers = new Map(), listeners = new Map();
  let cursor = 0, ids = 0, timerId = 0;
  const now = Date.now();
  const context = { binding: { channel: 'bound-channel' }, connected: true };
  const document = { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = { useContext: () => context, useRef(initial) { return hooks[cursor++] ??= { current: initial }; },
    useEffect(effect, deps) { const index = cursor++; if (!hooks[index] || !same(hooks[index].deps, deps)) {
      const prior = hooks[index]; hooks[index] = { deps }; effects.push(() => { prior?.cleanup?.(); hooks[index].cleanup = effect(); });
    } } };
  const props = { records: [], project: { idlePolicy: { variants: [{ use: 'openclaw' }] } }, dealerId: 'astrid', mode: 'active', revision: 1, boundary: 'one', active: true,
    onOffer: value => { offers.push(value); return true; }, onActivity: entry => activities.push(entry) };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, AbortController, Date, Object, Set, Promise, performance: { now: () => 500 },
    crypto: { randomUUID: () => `request-${++ids}` }, document,
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id),
    fetch: (url, options) => new Promise((resolve, reject) => requests.push({ url, options, body: JSON.parse(options.body), resolve, reject })),
    require: name => name === 'react' ? react : name === './native-speech-context' ? { NativeSpeechContext: {} }
      : name === '../lib/idle-reaction-input.mjs' ? { idleReactionInput } : require(name),
  });
  function render() { cursor = 0; module.exports.IdleReactions(props); for (const effect of effects.splice(0)) effect(); }
  function message(id) { props.records = [...props.records, { id: `native:bound-channel:${id}`, time: new Date(now).toISOString(), source: 'native', kind: 'chat', data: { role: 'user', text: `fixture ${id}` } }]; render(); }
  function answer(index = requests.length - 1, overrides = {}) {
    const request = requests[index]; request.resolve({ ok: true, json: async () => ({ requestId: request.body.requestId, sourceRef: request.body.sourceRef,
      videoId: 'allowed-video', expiresAt: new Date(now + 25000).toISOString(), provider: 'responded', ...overrides }) });
  }
  return { props, context, document, listeners, timers, requests, offers, activities, render, message, answer,
    unmount() { hooks.forEach(hook => hook?.cleanup?.()); } };
}

test('ISO expiry becomes monotonic TTL, offers once and never claims actual playback', async () => {
  const f = fixture(); f.message('one'); f.answer(); await flush();
  assert.equal(f.offers.length, 1); assert.ok(f.offers[0].expiresAt > 500 && f.offers[0].expiresAt <= 25500);
  assert.equal(f.activities[0].data.playbackConfirmed, false);
  f.props.records = [...f.props.records]; f.render(); assert.equal(f.requests.length, 1); f.unmount();
});

test('new user chat supersedes pending advice, even when aborted fetch answers late', async () => {
  const f = fixture(); f.message('one'); f.message('two');
  assert.equal(f.requests.length, 2); assert.equal(f.requests[0].options.signal.aborted, true);
  f.answer(0); await flush(); assert.equal(f.offers.length, 0);
  f.answer(1); await flush(); assert.equal(f.offers.length, 1); assert.equal(f.offers[0].requestId, f.requests[1].body.requestId); f.unmount();
});

test('mode, revision, pause, observation and binding changes cancel an outstanding offer', async () => {
  for (const change of [f => f.props.mode = 'off', f => f.props.revision++, f => f.props.active = false,
    f => f.props.boundary = 'two', f => f.context.binding = { channel: 'replacement' }, f => f.context.connected = false]) {
    const f = fixture(); f.message('one'); change(f); f.render();
    assert.equal(f.requests[0].options.signal.aborted, true); f.answer(0); await flush(); assert.equal(f.offers.length, 0); f.unmount();
  }
});

test('hidden/unmounted tabs cancel, failures are consumed without paid retry', async () => {
  for (const cancel of [f => { f.document.hidden = true; f.listeners.get('visibilitychange')(); }, f => f.unmount()]) {
    const f = fixture(); f.message('one'); cancel(f); f.answer(); await flush(); assert.equal(f.offers.length, 0);
  }
  const f = fixture(); f.message('one'); f.requests[0].reject(Error('private provider detail')); await flush();
  assert.equal(f.activities.length, 1); assert.doesNotMatch(JSON.stringify(f.activities), /private provider detail/);
  f.props.records = [...f.props.records]; f.render(); assert.equal(f.requests.length, 1); f.unmount();
});

test('shadow mode and mismatched, expired or invalid replies cannot offer clips', async () => {
  for (const override of [{ requestId: 'wrong' }, { sourceRef: {} }, { expiresAt: 'bad' }, { expiresAt: new Date(0).toISOString() }, { expiresAt: new Date(Date.now() + 60000).toISOString() }]) {
    const f = fixture(); f.message('one'); f.answer(0, override); await flush(); assert.equal(f.offers.length, 0); f.unmount();
  }
  const f = fixture(); f.props.mode = 'shadow'; f.message('one'); f.answer(); await flush(); assert.equal(f.offers.length, 0); assert.equal(f.activities.length, 1); f.unmount();
});
