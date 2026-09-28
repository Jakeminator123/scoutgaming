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
  if (name === './gateway-panel') return { modeLabels: {}, modeExplanations: {} };
  if (name === './test-context') return { TestContextPanel: () => React.createElement('span', null, 'legacy language and social context') };
  return require(name);
} });
const render = props => renderToStaticMarkup(React.createElement(module.exports.EventTestPanel, {
  open: true, onOpen() {}, mode: 'active', onMode() {}, configured: true, context: {}, onContext() {},
  dealer: 'Astrid', eventLabel: 'Utdelning', sourceType: 'deal', result: null, previewKind: null, busy: false, onRun() {}, ...props,
}));

test('Eventstudion exposes the complete held-for-pose chat simulation in order', () => {
  const stages = [
    'chat received',
    'response ready',
    'held for pose',
    'action completed',
    'standard idle presented',
    'chat displayed',
    'speech started',
    'speech completed',
  ];
  let previous = -1;
  for (const stage of stages) {
    const index = source.indexOf(`['${stage}'`);
    assert.ok(index > previous, `${stage} should be present after the preceding stage`);
    previous = index;
  }
  assert.match(source, /Pedagogisk demo, inte ett livetest/);
  assert.match(source, /Timern nedan läser inga spel- eller uppspelningskvitton/);
  assert.match(source, /Verklig uppspelning verifieras i Händelselogg/);
});

test('the real test action precedes the optional educational pose demo', () => {
  assert.ok(source.indexOf('onClick={onRun}') < source.indexOf('Visa principen: tal först i startposition'));
  assert.match(source, /<details className=\{styles\.advanced\}><summary>Visa principen/);
  assert.doesNotMatch(source, /Sekvens klar\. Ingen assistenttext eller media släpptes/);
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
