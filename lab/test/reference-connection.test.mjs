import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { webcrypto } from 'node:crypto';
import { buildPlaybackTrace } from '../lib/playback-trace.mjs';
import { appendPartnerTrace, createPartnerTrace, restartPartnerTrace } from '../lib/partner-trace.mjs';
import { buildPresentationSequence } from '../lib/presentation-sequence.mjs';
import { createSeedProject } from '../lib/studio-model.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const code = transformSync(readFileSync(new URL('../components/partner-reference.tsx', import.meta.url), 'utf8'), {
  filename: 'partner-reference.tsx', jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' },
}).code;
const tick = () => new Promise(resolve => setImmediate(resolve));
const speechContext = React.createContext(null);
function setup({ origin = 'http://127.0.0.1:4194', connect = async () => {}, launchOrigin = origin } = {}) {
  const hooks = [], effects = [], calls = [], received = [], activity = [];
  let cursor = 0, dirty = false, tree;
  const listeners = new Map();
  const popup = { closed: false, location: { replace(url) { calls.push('navigate'); popup.url = url; } }, focus() {}, close() { this.closed = true; } };
  let props = { trace: { records: [], limited: false }, connected: false, connection: 'Frånkopplad', dealerId: 'astrid', onActivity: entry => activity.push(entry), onNative: record => received.push(record),
    onConnect: async () => { calls.push('connect'); await connect(); }, onDisconnect: () => calls.push('disconnect'), onNewObservation: () => calls.push('new-observation') };
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = { ...React,
    useState(initial) { const i = cursor++; hooks[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [hooks[i].value, value => { hooks[i].value = typeof value === 'function' ? value(hooks[i].value) : value; dirty = true; }]; },
    useRef(initial) { const i = cursor++; hooks[i] ??= { current: initial }; return hooks[i]; },
    useEffect(fn, deps) { const i = cursor++; if (!hooks[i] || !same(deps, hooks[i].deps)) { const old = hooks[i]; hooks[i] = { deps }; effects.push(() => { old?.cleanup?.(); hooks[i].cleanup = fn(); }); } },
  };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, URL, Promise, Error, crypto: webcrypto,
    window: { location: { origin: 'http://127.0.0.1:4192' }, open() { calls.push('open'); return popup; }, addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) },
    fetch: async (_url, options) => {
      if (!options?.method) return Response.json({ configured: true, mappingConfigured: false, playerId: 'fixture', origin });
      const { action } = JSON.parse(options.body); calls.push(action);
      return Response.json(action === 'verify' ? { scopes: ['events', 'launch'], playerId: 'fixture' } : { url: `${launchOrigin}/?launch=PRIVATE`, expiresIn: 60 });
    },
    require: name => name === 'react' ? react : name === './native-speech-context' ? { NativeSpeechContext: speechContext }
      : name.endsWith('.module.css') ? { __esModule: true, default: {} } : require(name),
  });
  function flush() { for (let i = 0; i < 20; i++) { dirty = false; cursor = 0; tree = module.exports.PartnerReference(props); for (const effect of effects.splice(0)) effect(); if (!dirty) return; } throw Error('Render failed to settle'); }
  function nodes(node, found = []) { if (Array.isArray(node)) node.forEach(child => nodes(child, found)); else if (node?.props) { found.push(node); nodes(node.props.children, found); } return found; }
  function button(label) { return nodes(tree).find(node => node.type === 'button' && node.props.children === label)?.props; }
  flush();
  return { calls, popup, received, activity, flush, button, update(next) { props = { ...props, ...next }; flush(); },
    speech: () => nodes(tree).find(node => node.type === speechContext.Provider).props.value,
    receive(data, overrides = {}) { listeners.get('message')({ source: popup, origin, data, ...overrides }); },
    message(kind, payload, sequence = 1) { return { type: 'croupier-native-observation', version: 1, channel: new URL(popup.url).searchParams.get('labObserverChannel'), sequence, at: '2026-09-22T12:00:00Z', kind, payload }; },
  };
}

test('Anslut opens synchronously, verifies then connects before launching exact dealer with private observer channel', async () => {
  const ui = setup(); await tick(); ui.flush();
  ui.button('Anslut').onClick(); assert.equal(ui.calls[0], 'open');
  await tick(); ui.flush();
  assert.deepEqual(ui.calls, ['open', 'verify', 'connect', 'launch', 'navigate']);
  const url = new URL(ui.popup.url);
  assert.equal(url.searchParams.get('dealer'), 'astrid');
  assert.equal(url.searchParams.get('labObserverOrigin'), 'http://127.0.0.1:4192');
  assert.ok(url.searchParams.get('labObserverChannel'));
  assert.ok(!JSON.stringify(ui.activity).includes('PRIVATE'));
  const message = ui.message('status', { state: 'attached' });
  ui.receive(message, { origin: 'https://evil.test' }); assert.equal(ui.received.length, 0);
  ui.receive(message); assert.equal(ui.received.length, 1);
  ui.update({ connected: true }); ui.button('Koppla från').onClick();
  ui.receive(ui.message('chat', { role: 'user', text: 'After disconnect' }, 2));
  assert.equal(ui.received.length, 1);
});

test('missing upstream SSE still opens native observation and reports the missing transport', async () => {
  const ui = setup({ connect: async () => { throw Error('Unavailable'); } }); await tick(); ui.flush();
  ui.button('Anslut').onClick(); await tick(); ui.flush();
  assert.ok(ui.popup.url); assert.equal(ui.popup.closed, false);
  assert.ok(ui.activity.some(entry => entry.source === 'partner' && entry.status === 'failed'));
});

test('unexpected launch origin is never navigated or bound as a trusted message sender', async () => {
  const ui = setup({ launchOrigin: 'https://evil.test' }); await tick(); ui.flush();
  ui.button('Anslut').onClick(); await tick(); ui.flush();
  assert.equal(ui.popup.url, undefined); assert.equal(ui.popup.closed, true); assert.ok(ui.calls.includes('disconnect'));
});

test('Ny observation preserves the popup/native channel and does not open a connection or issue a launch', async () => {
  const ui = setup(); await tick(); ui.flush();
  ui.button('Anslut').onClick(); await tick(); ui.flush();
  const url = ui.popup.url, before = ui.calls.length;
  ui.button('Ny observation').onClick(); ui.flush();
  assert.deepEqual(ui.calls.slice(before), ['new-observation']);
  assert.equal(ui.popup.url, url); assert.equal(ui.popup.closed, false);
  ui.receive(ui.message('chat', { role: 'user', text: 'After reset' }));
  assert.equal(ui.received.length, 1);
});

test('pose diagnostics advance the real receiver cursor; true missing messages and page reloads still emit gaps', async () => {
  const ui = setup(); await tick(); ui.flush(); ui.button('Anslut').onClick(); await tick(); ui.flush();
  ui.receive(ui.message('status', { state: 'attached' }, 1));
  ui.receive(ui.message('status', { state: 'chat-pose', jobId: 'job.1', stage: 'held-for-pose', at: 1234 }, 2));
  ui.receive(ui.message('playback', { state: 'idle' }, 3));
  assert.equal(ui.received.filter(record => record.data?.gap).length, 0);
  ui.receive(ui.message('playback', { state: 'idle' }, 5));
  assert.deepEqual(ui.received.filter(record => record.data?.gap).map(record => record.data.reason), ['native-sequence-gap']);
  ui.receive(ui.message('status', { state: 'attached' }, 1));
  assert.deepEqual(ui.received.filter(record => record.data?.gap).map(record => record.data.reason), ['native-sequence-gap', 'original-page-reloaded']);
});

test('speech capability binds only after trusted attachment and renews on original reload, never exports a window', async () => {
  const ui = setup(); await tick(); ui.flush(); ui.button('Anslut').onClick(); await tick(); ui.flush();
  assert.equal(ui.speech().binding, null);
  const attached = ui.message('status', { state: 'attached' }, 1);
  ui.receive(attached, { source: {} }); ui.flush(); assert.equal(ui.speech().binding, null);
  ui.receive(attached, { origin: 'http://localhost:1234' }); ui.flush(); assert.equal(ui.speech().binding, null);
  ui.receive(attached); ui.update({ connected: true });
  const first = ui.speech().binding;
  assert.equal(first.source, ui.popup); assert.equal(first.origin, new URL(ui.popup.url).origin);
  assert.equal(first.channel, attached.channel); assert.equal(ui.speech().connected, true);
  ui.receive(ui.message('status', { state: 'chat-pose', jobId: 'job.1', stage: 'speech-completed', at: 1234 }, 2)); ui.flush();
  assert.equal(ui.speech().binding, first);
  ui.receive(attached); ui.flush(); assert.equal(ui.speech().binding.revision, first.revision + 1);
  assert.ok(!JSON.stringify(ui.received).includes('PRIVATE'));
  assert.ok(ui.received.every(record => record.data?.source !== ui.popup));
});

test('every dealer scopes reloads, accepts lower versions and excludes stale receipt sequences after reset', async () => {
  for (const dealerId of ['vera', 'astrid', 'amira', 'mei']) {
    const ui = setup(); ui.update({ dealerId }); await tick(); ui.flush();
    ui.button('Anslut').onClick(); await tick(); ui.flush();
    ui.receive(ui.message('status', { state: 'attached', dealer: dealerId }, 1));
    ui.receive(ui.message('command', { requestId: 'old', op: 'state', view: { version: 8 }, presentation: [{ type: 'idle' }], dealer: dealerId }, 2));
    let trace = createPartnerTrace(); for (const record of ui.received) trace = appendPartnerTrace(trace, record);
    trace = restartPartnerTrace(trace);
    const offset = ui.received.length;
    ui.receive({ ...ui.message('status', { state: 'attached', dealer: dealerId }, 1), at: '2026-10-02T12:00:00Z' });
    const command = ui.message('command', { requestId: 'new', op: 'state', view: { version: 0 }, presentation: [{ type: 'idle' }], dealer: dealerId }, 2);
    ui.receive(command);
    const accepted = ui.received.length;
    ui.receive(command);
    ui.receive(ui.message('playback', { event: 'idle', state: 'end', requestId: 'old', version: 8 }, 1));
    assert.equal(ui.received.length, accepted, dealerId);
    assert.deepEqual(ui.received.filter(record => record.kind === 'round').map(record => record.channel), ['native-session-1', 'native-session-2']);
    for (const record of ui.received.slice(offset)) trace = appendPartnerTrace(trace, record);
    trace = appendPartnerTrace(trace, { source: 'partner', kind: 'round', data: { requestId: 'new', version: 0, type: 'round', events: [{ type: 'idle' }] } });
    const report = buildPlaybackTrace(trace.records);
    assert.equal(report.rows.length, 1); assert.equal(report.rows[0].requestId, 'new');
    assert.equal(report.rows[0].played, false); assert.equal(report.inventory.played, 0);
    const nativePreview = { ...trace, records: trace.records.filter(record => record.source !== 'partner') };
    const sequence = buildPresentationSequence(nativePreview.records, createSeedProject());
    assert.deepEqual(sequence.steps.map(step => step.requestId), ['new']);
  }
});
