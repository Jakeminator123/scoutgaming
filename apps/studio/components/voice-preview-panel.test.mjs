import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url), { transformSync } = require('next/dist/build/swc');
function load(file, overrides = {}) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const { code } = transformSync(source, { filename: file,
    jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' } });
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, AbortController,
    require: name => Object.hasOwn(overrides, name) ? overrides[name]
      : name.endsWith('.module.css') ? { __esModule: true, default: {} } : require(name) });
  return module.exports;
}

function harness(requestJson) {
  const hooks = [], pending = []; let cursor = 0;
  const fakeReact = { ...React,
    useState(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], next => { hooks[index] = typeof next === 'function' ? next(hooks[index]) : next; }]; },
    useRef(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = { current: initial }; return hooks[index]; },
    useCallback: fn => fn,
    useEffect(fn, deps) { const index = cursor++, old = hooks[index];
      if (!old || deps.some((value, i) => value !== old.deps[i])) pending.push(() => {
        old?.cleanup?.(); hooks[index] = { deps, cleanup: fn() };
      }); },
  };
  const { VoicePreviewPanel } = load('./voice-preview-panel.tsx', { react: fakeReact, './studio-types': { requestJson } });
  return { render(props = {}) { cursor = 0; return VoicePreviewPanel(props); },
    effects() { while (pending.length) pending.shift()(); },
    unmount() { for (const hook of hooks) hook?.cleanup?.(); } };
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const status = { configured: true, message: 'Fixture configuration', phrases: [{id: 'welcome', label: 'Välkommen', text: 'Hej!'}] };

test('unavailable voice UI has clear information, no actions and zero GET or POST requests', async () => {
  const calls = [], h = harness(async (...args) => { calls.push(args); throw Error('Unexpected request'); });
  let tree = h.render({available: false, latestReply: 'Ett färdigt chattsvar'}); h.effects(); await flush();
  tree = h.render({available: false}); h.effects();
  const html = renderToStaticMarkup(tree);
  assert.match(html, /fristående röstprovet är inte tillgängligt/);
  assert.doesNotMatch(html, /role="alert"|Läser lokal konfiguration|Generera röstprov|<audio/);
  assert.equal(nodes(tree, node => ['button', 'select', 'textarea', 'form'].includes(node.type)).length, 0);
  assert.equal(calls.length, 0); h.unmount();
});

test('default available voice reads status once and generates only after the explicit button', async () => {
  const calls = [], h = harness(async (url, init) => { calls.push({url, init}); return init.method === 'POST'
    ? {cached: true, audioUrl: '/api/voice/fixture', voiceName: 'Fixture voice'} : status; });
  let tree = h.render(); h.effects(); await flush(); tree = h.render(); h.effects();
  assert.equal(calls.length, 1); assert.equal(calls[0].url, '/api/voice');
  assert.equal(calls[0].init.method, undefined); assert.equal(calls[0].init.signal.aborted, false);
  const generate = nodes(tree, node => node.type === 'button' && node.props.children === 'Generera röstprov')[0];
  assert.ok(generate); assert.equal(generate.props.disabled, false); generate.props.onClick(); await flush();
  assert.equal(calls.length, 2); assert.equal(calls[1].url, '/api/voice'); assert.equal(calls[1].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].init.body), {text: 'Hej!'});
  assert.match(renderToStaticMarkup(h.render()), /<audio[^>]* controls=""/);
  h.unmount(); assert.equal(calls[0].init.signal.aborted, true);
});

test('revoked availability hides generation even after configured status, aborting status and pending generation', async () => {
  const calls = []; let finish;
  const h = harness(async (url, init) => { calls.push({url, init});
    return init.method === 'POST' ? new Promise(resolve => {finish = resolve;}) : status; });
  let tree = h.render({available: true}); h.effects(); await flush(); tree = h.render({available: true});
  nodes(tree, node => node.type === 'button' && node.props.children === 'Generera röstprov')[0].props.onClick();
  tree = h.render({available: false}); h.effects();
  assert.equal(calls.length, 2); assert.ok(calls.every(call => call.init.signal.aborted));
  assert.equal(nodes(tree, node => node.type === 'button').length, 0);
  finish({audioUrl: '/api/voice/late', cached: false}); await flush();
  assert.doesNotMatch(renderToStaticMarkup(h.render({available: false})), /<audio|role="alert"/);
  assert.equal(calls.length, 2);
  h.render({available: true}); h.effects(); await flush(); tree = h.render({available: true});
  const generate = nodes(tree, node => node.type === 'button' && node.props.children === 'Generera röstprov')[0];
  assert.ok(generate); assert.equal(generate.props.disabled, false);
  assert.equal(calls.length, 3); generate.props.onClick();
  assert.equal(calls.length, 4); assert.equal(calls[3].init.method, 'POST');
  finish({audioUrl: '/api/voice/reopened', voiceName: 'Fixture voice', cached: false}); await flush();
  assert.match(renderToStaticMarkup(h.render({available: true})), /reopened/);
  h.unmount();
});

test('Gateway preserves operator chat while forwarding the server voice capability unchanged', () => {
  const hooks = {...React, useState: initial => [initial, () => {}]};
  function VoicePreviewPanel() { return null; }
  const {GatewayPanel} = load('./gateway-panel.tsx', {
    react: hooks, './studio-types': {requestJson() {assert.fail('render cannot send chat or voice');}},
    './voice-preview-panel': {VoicePreviewPanel}, './openclaw-sources': {OpenClawSources() {return null;}},
  });
  for (const available of [undefined, false, true]) {
    const tree = GatewayPanel({status: {configured: true}, mode: 'off', onModeChange() {}, dealerId: 'astrid', dirty: false,
      onPlayerChat() {}, ...(available === undefined ? {} : {standaloneVoicePreviewAvailable: available})});
    const voice = nodes(tree, node => node.type === VoicePreviewPanel)[0];
    assert.equal(voice.props.available, available === undefined ? true : available);
    assert.equal(nodes(tree, node => node.type === 'form').length, 1, 'operator chat stays available');
    assert.equal(nodes(tree, node => node.props?.id === 'operator-message').length, 1);
  }
});
