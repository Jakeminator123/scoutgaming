import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import {createEmptyProject} from '../lib/studio-model.mjs';
import * as rebase from '../lib/project-rebase.mjs';

const require = createRequire(import.meta.url);
const {transformSync} = require('next/dist/build/swc');
const output = transformSync(readFileSync(new URL('./project-conflict.tsx', import.meta.url), 'utf8'), {
  filename: 'project-conflict.tsx', jsc: {parser: {syntax: 'typescript', tsx: true}, transform: {react: {runtime: 'automatic'}}}, module: {type: 'commonjs'},
});
function harness() {
  const hooks = [], requests = []; let cursor = 0;
  const react = {...React,
    useState(initial) {const index = cursor++; hooks[index] ??= {value: initial}; return [hooks[index].value, value => {hooks[index].value = value;}];},
    useRef(initial) {const index = cursor++; return hooks[index] ??= {current: initial};},
  };
  const module = {exports: {}};
  vm.runInNewContext(output.code, {module, exports: module.exports, structuredClone,
    require: name => name === 'react' ? react : name === '../lib/project-rebase.mjs' ? rebase
      : name === './studio-types' ? {requestJson: url => {assert.equal(url, '/api/project'); return new Promise(resolve => {requests.push({resolve});});}}
        : require(name),
  });
  return {requests, render(props) {cursor = 0; return module.exports.ProjectConflict(props);}};
}
function buttons(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(buttons);
  return [...(node.type === 'button' ? [node] : []), ...buttons(node.props?.children)];
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('a delayed revision read rebases the latest draft and calls the current resolution handler', async () => {
  const h = harness(), base = createEmptyProject(), draft = {...base, title: 'Earlier draft'};
  const remote = structuredClone(base); remote.revision = 'remote-revision'; remote.events[0].label = 'Remote event name';
  const staleCalls = [], currentCalls = [];
  let props = {base, draft, onResolve: (...args) => staleCalls.push(args)};
  buttons(h.render(props))[0].props.onClick();
  assert.equal(h.requests.length, 1);
  const latest = {...draft, title: 'New text entered while loading'};
  props = {...props, draft: latest, onResolve: (...args) => currentCalls.push(args)};
  h.render(props);
  h.requests[0].resolve({project: remote}); await flush();
  assert.equal(staleCalls.length, 0, 'the resolution uses the current props, not the old callback');
  assert.equal(currentCalls.length, 1);
  assert.deepEqual(currentCalls[0], [remote, {...latest, revision: remote.revision, events: remote.events}]);
  assert.equal(latest.revision, base.revision, 'rebasing leaves the caller draft unchanged');
});

for (const preference of ['local', 'remote']) test(`a real field conflict still requires the explicit ${preference} choice`, async () => {
  const h = harness(), base = createEmptyProject(), draft = {...base, title: 'Local choice'};
  const remote = structuredClone(base); remote.revision = 'remote-revision'; remote.title = 'Saved choice'; remote.events[0].label = 'Independent remote edit';
  const resolutions = [];
  let props = {base, draft, onResolve: (...args) => resolutions.push(args)};
  buttons(h.render(props))[0].props.onClick();
  h.requests[0].resolve({project: remote}); await flush();
  assert.deepEqual(resolutions, [], 'reading a conflicting revision never resolves silently');
  props = {...props, draft: {...draft, title: 'Latest local choice'}};
  const tree = h.render(props);
  const label = preference === 'local' ? 'Behåll mina val där det krockar' : 'Använd sparade val där det krockar';
  buttons(tree).find(button => button.props.children === label).props.onClick();
  assert.equal(resolutions.length, 1);
  const [loaded, merged] = resolutions[0];
  assert.deepEqual(loaded, remote);
  assert.equal(merged.title, preference === 'local' ? 'Latest local choice' : 'Saved choice');
  assert.deepEqual(merged.events, remote.events);
  assert.equal(merged.revision, remote.revision);
});
