import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const compiled = transformSync(readFileSync(new URL('../components/activity-log.tsx', import.meta.url), 'utf8'), {
  filename: 'activity-log.tsx', jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' },
});

test('Web ownership prevents a second player before attachment and survives observation resets', () => {
  const hooks = []; let cursor = 0;
  const react = { ...React,
    useState(initial) { const index = cursor++; hooks[index] ??= { value: typeof initial === 'function' ? initial() : initial }; return [hooks[index].value, next => { hooks[index].value = typeof next === 'function' ? next(hooks[index].value) : next; }]; },
    useRef(initial) { const index = cursor++; hooks[index] ??= { current: initial }; return hooks[index]; },
    useEffect() {},
  };
  const Partner = () => null, Player = () => null, Capture = () => null;
  const mocks = { react, './partner-reference': { PartnerReference: Partner }, './game-stream': { GameStream: Player }, './reference-capture': { ReferenceCapture: Capture } };
  const module = { exports: {} };
  vm.runInNewContext(compiled.code, { module, exports: module.exports, TextEncoder, clearTimeout,
    require: name => name.endsWith('.css') ? {} : mocks[name] ?? require(name),
  });
  const props = { entries: [], full: true, onActivity() {}, onClear() {}, onOpen() {}, streamView: { dealerId: 'astrid' } };
  const flatten = node => !node || typeof node !== 'object' ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(flatten)];
  const render = () => { cursor = 0; return flatten(module.exports.ActivityLog(props)); };
  const partner = tree => tree.find(node => node.type === Partner);
  const hasPlayer = tree => tree.some(node => node.type === Player);
  let tree = render(); assert.equal(hasPlayer(tree), false);
  partner(tree).props.onNative({ source: 'native', kind: 'status', data: { state: 'attached', presentationOwner: 'web-local' } });
  tree = render(); partner(tree).props.onNewObservation();
  props.streamView.dealerId = 'vera'; // Changing editor selection cannot start a competing stream.
  tree = render(); assert.equal(hasPlayer(tree), false);
  partner(tree).props.onNative({ source: 'native', kind: 'status', data: { state: 'attached', presentationOwner: 'legacy' } });
  tree = render(); assert.equal(hasPlayer(tree), false);
  const preview = tree.find(node => node.type === 'button' && node.props.children === 'Öppna separat Lab-preview');
  assert.ok(preview); preview.props.onClick();
  tree = render(); assert.equal(hasPlayer(tree), true);
  assert.equal(tree.find(node => node.type === Player).props.autoFollow, false);
  assert.equal(tree.find(node => node.type === Player).props.followFromRecord, 2);
  partner(tree).props.onNewObservation();
  assert.equal(hasPlayer(render()), false);
  tree = render();
  partner(tree).props.onImport([
    { source: 'native', kind: 'round', data: { requestId: 'same', version: 1, events: [{ type: 'idle' }] } },
    { source: 'partner', kind: 'round', data: { requestId: 'same', version: 1, events: [{ type: 'idle' }] } },
  ]);
  tree = render(); tree.find(node => node.type === 'button' && node.props.children === 'Öppna separat Lab-preview').props.onClick();
  const player = render().find(node => node.type === Player);
  assert.equal(player.props.trace.records.length, 1);
  assert.equal(player.props.trace.records[0].source, 'native');
  assert.equal(player.props.followFromRecord, 1);
});
