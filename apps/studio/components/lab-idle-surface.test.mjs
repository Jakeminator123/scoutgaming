import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const code = transformSync(readFileSync(new URL('./lab-idle-surface.tsx', import.meta.url), 'utf8'), {
  filename: 'lab-idle-surface.tsx', jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' },
}).code;
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
function fixture({ kind = 'base', standardBase = true, repeat = false, frameApi = true, failPlay = false } = {}) {
  const hooks = [], effects = [], ready = [], receipts = [], frames = new Map(), listeners = new Map(); let cursor = 0, frameId = 0, pauses = 0, tree;
  const video = { paused: true, readyState: 0, ended: false,
    play() { if (failPlay) return Promise.reject(Error('autoplay')); this.paused = false; this.readyState = 3; listeners.get('playing')?.(); return Promise.resolve(); },
    pause() { this.paused = true; pauses++; }, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name),
    ...(frameApi ? { requestVideoFrameCallback(fn) { const id = ++frameId; frames.set(id, fn); return id; }, cancelVideoFrameCallback: id => frames.delete(id) } : {}),
  };
  const props = { url: '/video.mp4', videoId: 'fixture-idle', kind, standardBase, repeat,
    onReady: value => ready.push(value), onReceipt: value => receipts.push(value) };
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = { useRef(initial) { return hooks[cursor++] ??= { current: initial }; },
    useEffect(effect, deps) { const i = cursor++; if (!hooks[i] || !same(hooks[i].deps, deps)) { const old = hooks[i]; hooks[i] = { deps }; effects.push(() => { old?.cleanup?.(); hooks[i].cleanup = effect(); }); } } };
  const module = { exports: {} }; vm.runInNewContext(code, { module, exports: module.exports, Promise, require: name => name === 'react' ? react : name === './dealer-video-surface' ? { DealerVideoSurface: ({children}) => children } : require(name) });
  function nodes(node, found = []) { if (Array.isArray(node)) node.forEach(child => nodes(child, found)); else if (node?.props) { found.push(node); nodes(node.props.children, found); } return found; }
  function render() { cursor = 0; tree = module.exports.LabIdleSurface(props); nodes(tree).find(node => node.type === 'video').props.ref.current = video; for (const effect of effects.splice(0)) effect(); }
  render();
  return { video, ready, receipts, frames, listeners, props, render,
    get videoProps() { return nodes(tree).find(node => node.type === 'video').props; }, get pauses() { return pauses; },
    frame() { const [id, fn] = frames.entries().next().value; frames.delete(id); fn(); },
    end() { video.ended = true; listeners.get('ended')?.(); }, error() { listeners.get('error')?.(); },
    unmount() { hooks.forEach(hook => hook?.cleanup?.()); } };
}

test('only a primary base presented frame opens the speech gate; playback start alone never does', async () => {
  const f = fixture(); await flush(); assert.deepEqual(f.ready, [false]);
  assert.deepEqual(f.receipts.map(item => item.phase), ['started']);
  assert.equal(f.videoProps.loop, false); assert.equal(f.videoProps.muted, true);
  f.frame(); assert.deepEqual(f.ready, [false, true]);
  assert.deepEqual(f.receipts.map(item => item.phase), ['started', 'presented']); f.unmount();
});

test('idle variants, server-chain clips and secondary weighted bases never issue a standard-position proof', async () => {
  for (const props of [{ kind: 'variant' }, { kind: 'server' }, { kind: 'base', standardBase: false }]) {
    const f = fixture(props); await flush(); f.frame();
    assert.deepEqual(f.ready, [false]); assert.equal(f.receipts.at(-1).phase, 'presented');
    assert.ok(f.receipts.every(receipt => receipt.kind === props.kind), 'receipts preserve the actual clip kind');
    f.end(); assert.equal(f.receipts.at(-1).phase, 'completed');
    assert.ok(f.ready.every(value => value === false)); f.unmount();
  }
});

test('actual ended advances a one-shot exactly once; repeat mode never manufactures completion', async () => {
  const f = fixture(); await flush(); f.frame(); f.end(); f.end(); f.unmount();
  assert.deepEqual(f.receipts.map(item => item.phase), ['started', 'presented', 'completed']);
  const loop = fixture({ repeat: true }); await flush(); assert.equal(loop.videoProps.loop, true); loop.frame(); loop.end();
  assert.ok(loop.receipts.every(item => item.phase !== 'completed')); loop.unmount();
  assert.equal(loop.receipts.at(-1).phase, 'cancelled');
});

test('errors, missing frame API and unmount cannot leave a ready proof or late receipt behind', async () => {
  const unavailable = fixture({ frameApi: false }); await flush(); assert.deepEqual(unavailable.ready, [false]); unavailable.unmount();
  const rejected = fixture({ failPlay: true }); await flush(); assert.equal(rejected.receipts.at(-1).phase, 'failed'); assert.ok(rejected.ready.every(value => value === false)); rejected.unmount();
  const f = fixture(); await flush(); const lateFrame = [...f.frames.values()][0]; f.unmount(); const count = f.receipts.length;
  lateFrame(); assert.equal(f.receipts.length, count); assert.equal(f.frames.size, 0); assert.equal(f.listeners.size, 0); assert.ok(f.pauses > 0);
  const broken = fixture(); await flush(); broken.frame(); broken.error(); broken.error(); broken.end();
  assert.equal(broken.ready.at(-1), false); assert.deepEqual(broken.receipts.map(item => item.phase), ['started', 'presented', 'failed']); broken.unmount();
});
