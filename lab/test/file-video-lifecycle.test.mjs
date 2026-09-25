import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const compiled = transformSync(readFileSync(new URL('../components/file-video.tsx', import.meta.url), 'utf8'), {
  filename: 'file-video.tsx', jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' },
});
function mount(playId = 1) {
  const hooks = [], effects = [], timers = new Map(), receipts = [];
  let cursor = 0, tree, clock = 0, nextTimer = 0, failures = 0, ends = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = { ...React,
    useRef(value) { return hooks[cursor++] ??= { current: value }; },
    useEffect(effect, deps) { const i = cursor++; if (!hooks[i] || !same(hooks[i].deps, deps)) {
      const previous = hooks[i]; hooks[i] = { deps, cleanup: previous?.cleanup };
      effects.push(() => { previous?.cleanup?.(); hooks[i].cleanup = effect(); });
    } },
  };
  const element = { ended: false, paused: true, currentTime: 0, duration: 3,
    play() { this.paused = false; tree.props.onPlaying({ currentTarget: this }); return Promise.resolve(); }, pause() { this.paused = true; } };
  let props = { url: '/clip.mp4', name: 'clip.mp4', playId, playing: true, blocked: false,
    onReceipt: receipt => receipts.push(receipt), onFailure: () => { failures++; }, onEnd: () => { ends++; } };
  const module = { exports: {} };
  vm.runInNewContext(compiled.code, { module, exports: module.exports, performance: { now: () => clock },
    window: { setInterval(fn) { timers.set(++nextTimer, fn); return nextTimer; }, clearInterval(id) { timers.delete(id); } },
    require: name => name === 'react' ? react : require(name) });
  function render(patch = {}) { props = { ...props, ...patch }; cursor = 0; tree = module.exports.FileVideo(props); tree.props.ref.current = element; for (const effect of effects.splice(0)) effect(); }
  render();
  return { receipts, element, render, get handlers() { return tree.props; }, get failures() { return failures; }, get ends() { return ends; },
    poll(ms = 250) { clock += ms; for (const timer of timers.values()) timer(); },
    unmount() { for (const hook of hooks) hook?.cleanup?.(); } };
}

test('actual ended completes once even if the browser omits the ended event', () => {
  const ui = mount();
  ui.render(); ui.render(); // unrelated parent activity updates cannot reset the media turn
  ui.element.currentTime = 3; ui.poll();
  assert.deepEqual(ui.receipts.map(r => r.phase), ['started']);
  ui.element.ended = true; ui.element.paused = true; ui.poll();
  ui.handlers.onEnded({ currentTarget: ui.element }); ui.poll();
  assert.deepEqual(ui.receipts.map(r => r.phase), ['started', 'completed']);
  assert.equal(ui.ends, 1); assert.equal(ui.receipts[1].playId, 1);
  ui.unmount();
});

test('consecutive files retain separate IDs and cancelled clips cannot complete later', () => {
  const first = mount(1), lateEnd = first.handlers.onEnded;
  first.render({ playing: false }); first.element.ended = true;
  lateEnd({ currentTarget: first.element }); first.poll(); first.unmount();
  assert.equal(first.ends, 0);
  const second = mount(2); second.element.currentTime = 3; second.element.ended = true;
  second.handlers.onEnded({ currentTarget: second.element });
  assert.equal(second.ends, 1); assert.equal(second.receipts.at(-1).playId, 2); second.unmount();
});

test('a stalled file fails, never invents completion from elapsed duration', () => {
  const ui = mount(); ui.poll(19000); ui.poll(19000);
  assert.deepEqual(ui.receipts.map(r => r.phase), ['started', 'fallback']);
  assert.equal(ui.failures, 1); assert.equal(ui.ends, 0); ui.unmount();
});

test('unmount clears the media completion observer', () => {
  const ui = mount(); ui.unmount(); ui.element.ended = true;
  ui.handlers.onEnded({ currentTarget: ui.element }); ui.poll();
  assert.equal(ui.ends, 0);
});
