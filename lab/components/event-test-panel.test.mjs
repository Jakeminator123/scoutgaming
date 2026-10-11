import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const source = readFileSync(new URL('./event-test-panel.tsx', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const compiled = require('next/dist/build/swc').transformSync(source, {
  filename: 'event-test-panel.tsx', jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' },
});
const module = { exports: {} };
vm.runInNewContext(compiled.code, { module, exports: module.exports, require: name => {
  if (name.endsWith('.css')) return {};
  if (name === './playback-guidance') return { ClipSelectionHelp: () => React.createElement('aside', null, 'Clip selection inputs') };
  if (name === './gateway-panel') return { modeLabels: {}, modeExplanations: {} };
  if (name === './test-context') return { TestContextPanel: () => React.createElement('span', null, 'legacy language and social context') };
  return require(name);
} });
const render = props => renderToStaticMarkup(React.createElement(module.exports.EventTestPanel, {
  open: true, onOpen() {}, mode: 'active', onMode() {}, configured: true, context: {}, onContext() {},
  dealer: 'Astrid', eventLabel: 'Utdelning', sourceType: 'deal', result: null, previewKind: null, busy: false, onRun() {}, ...props,
}));

test('recorded clip tests retain their real action and remove the timer-only generated-speech demo', () => {
  const html = render({});
  assert.match(html, /Testa event/);
  assert.match(html, /Clip selection inputs/);
  assert.doesNotMatch(source, /poseStages|poseStep|setTimeout|Visa exempelförlopp/);
  assert.match(source, /onClick=\{onRun\}/);
});

test('mode help and test context are separate disclosures with no hidden mode selector', () => {
  assert.match(source, /Vem väljer klippet\?/);
  assert.match(source, /Vad betyder lägena\?/);
  assert.match(source, /Det byter inte AI för chatten/);
  assert.match(source, /<details className=\{styles\.testContext\}>/);
  assert.equal((render({}).match(/<select /g) ?? []).length, 1);
  assert.doesNotMatch(source, /Återgå till OpenClaw/);
});

test('Astrid deal frequency test renders one relevant selector and no legacy context or speech simulation', () => {
  const html = render({ dealClips: true, dealFrequency: true });
  assert.equal((html.match(/<select /g) ?? []).length, 1);
  assert.match(html, /Valda frekvenser/);
  assert.doesNotMatch(html, /legacy language|Testsituation|startposition|modellanrop kan/);
  assert.match(render({ dealClips: false }), /legacy language and social context/);
});
