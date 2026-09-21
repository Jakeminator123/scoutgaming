import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { createSeedProject } from '../lib/studio-model.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
function component(file, name, props) {
  const slots = [], effects = [], timers = new Map(), nodes = new Map(); let cursor = 0, timerId = 0;
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useEffect(fn, deps) { const i = cursor++; if (!sameDeps(slots[i]?.deps, deps)) { const old = slots[i]; slots[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); }); } },
    useEffectEvent(fn) { const i = cursor++; slots[i] = fn; return (...args) => slots[i](...args); }, useDeferredValue(value) { return value; },
  };
  const module = { exports: {} };
  const code = transformSync(readFileSync(new URL(file, import.meta.url), 'utf8'), { filename: file, jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } }).code;
  vm.runInNewContext(code, { module, exports: module.exports, window: { setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); }, matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {} }; } }, require: id => id === 'react' ? hooks : id.endsWith('.css') ? { __esModule: true, default: {} } : id === './original-media-player' ? { OriginalMediaPlayer: () => null } : id === './video-classification' ? { VideoClassification: () => null } : id === './video-upload' ? { VideoUpload: () => null } : id === './video-coverage' ? { VideoCoverage: () => null } : require(id) });
  function bindRefs(tree) {
    if (!tree || typeof tree !== 'object') return;
    if (Array.isArray(tree)) { tree.forEach(bindRefs); return; }
    if (tree.props?.ref) {
      const key = `${tree.type}:${tree.key ?? ''}:${tree.props.className ?? ''}`;
      if (!nodes.has(key)) nodes.set(key, { dataset: {}, paused: !tree.props.autoPlay, duration: 3, currentTime: 3, pauseCalls: 0, pause() { this.paused = true; this.pauseCalls++; } });
      tree.props.ref.current = nodes.get(key);
    }
    bindRefs(tree.props?.children);
  }
  return { props, timers, exports: module.exports, render() { cursor = 0; const tree = module.exports[name](props); bindRefs(tree); while (effects.length) effects.shift()(); return tree; } };
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const item of node) { const result = find(item, predicate); if (result) return result; } return; }
  return predicate(node) ? node : find(node.props?.children, predicate);
}
const byType = (tree, type) => find(tree, node => node.type === type);
const button = (tree, label) => find(tree, node => node.type === 'button' && node.props.children === label);
function videoEvent(video, name) { const element = video.props.ref.current; if (name === 'onPlaying') element.paused = false; video.props[name]({ currentTarget: element }); }
const project = createSeedProject();
function stage(extra = {}) {
  return component('./stage.tsx', 'Stage', { event: project.events[0], asset: project.assets[0], dealer: 'Astrid', variantLabel: 'Standard', playId: 0, playing: false, hasResult: false, busy: false, onPlay() {}, onPreview() {}, ...extra });
}
test('video is preferred automatically but does not autoplay just by choosing a binding', () => {
  const h = stage({ videoUrl: '/api/videos/one' });
  assert.equal(byType(h.render(), 'video').props.autoPlay, false);
  h.props.playing = true; h.props.playId++;
  const first = byType(h.render(), 'video');
  assert.equal(first.props.autoPlay, true);
  assert.equal(first.props.loop, undefined);
  h.props.playId++;
  assert.notEqual(byType(h.render(), 'video').key, first.key);
});
test('missing/unbound variant falls back to its 2D asset even after a video variant', () => {
  const h = stage({ videoUrl: '/api/videos/one' });
  assert.ok(byType(h.render(), 'video'));
  h.props.videoUrl = undefined; h.props.videoMissing = true;
  assert.equal(byType(h.render(), 'video'), undefined);
  assert.ok(find(h.render(), node => node.props['data-motion-asset']));
});
test('decode failure falls back; explicit replay retries, another film is not poisoned', () => {
  let previews = 0;
  const h = stage({ videoUrl: '/api/videos/one', onPreview() { previews++; } });
  videoEvent(byType(h.render(), 'video'), 'onError');
  assert.equal(byType(h.render(), 'video'), undefined);
  find(h.render(), node => node.type === 'button' && Array.isArray(node.props.children) && node.props.children.includes('Spela vald variant')).props.onClick();
  assert.equal(previews, 1);
  assert.ok(byType(h.render(), 'video'));
  videoEvent(byType(h.render(), 'video'), 'onError'); h.props.videoUrl = '/api/videos/two';
  assert.ok(byType(h.render(), 'video'));
});
test('Bara 2D is an explicit override; switching back restores exact bound video', () => {
  const h = stage({ videoUrl: '/api/videos/one' });
  button(h.render(), 'Bara 2D').props.onClick();
  assert.equal(byType(h.render(), 'video'), undefined);
  button(h.render(), 'Video / 2D-reserv').props.onClick();
  assert.equal(byType(h.render(), 'video').props.src, '/api/videos/one');
});
test('video completion is governed by the video event, not the 2D duration', () => {
  let ended = 0;
  const h = stage({ videoUrl: '/api/videos/one', onPlaybackEnd() { ended++; } });
  const video = byType(h.render(), 'video');
  videoEvent(video, 'onPlaying'); videoEvent(video, 'onEnded');
  assert.equal(ended, 1);
});
test('stale video callbacks cannot end or replace the next replay or selection', () => {
  for (const change of ['replay', 'selection']) {
    const receipts = []; let ended = 0;
    const h = stage({ videoUrl: '/api/videos/one', playing: true, playId: 1, onPlaybackEvent(value) { receipts.push(value); }, onPlaybackEnd() { ended++; } });
    const first = byType(h.render(), 'video'), oldElement = first.props.ref.current;
    videoEvent(first, 'onPlaying');
    if (change === 'replay') h.props.playId++;
    else h.props.videoUrl = '/api/videos/two';
    const second = byType(h.render(), 'video');
    for (const name of ['onPlaying', 'onEnded', 'onError']) first.props[name]({ currentTarget: oldElement });
    assert.equal(receipts.length, 1); assert.equal(ended, 0); assert.ok(byType(h.render(), 'video'));
    videoEvent(second, 'onPlaying'); videoEvent(second, 'onEnded'); videoEvent(second, 'onEnded');
    assert.deepEqual(receipts.map(item => item.phase), ['started', 'started', 'completed']); assert.equal(ended, 1);
  }
});
test('social takeover pauses existing video and drops its late receipts', () => {
  const receipts = []; let ended = 0;
  const h = stage({ videoUrl: '/api/videos/one', playing: true, playId: 1, onPlaybackEvent(value) { receipts.push(value); }, onPlaybackEnd() { ended++; } });
  const first = byType(h.render(), 'video'), element = first.props.ref.current;
  videoEvent(first, 'onPlaying'); h.props.blocked = true;
  const blocked = byType(h.render(), 'video');
  assert.equal(blocked.props.controls, false); assert.equal(element.paused, true);
  for (const name of ['onPlaying', 'onEnded', 'onError']) first.props[name]({ currentTarget: element });
  assert.equal(receipts.length, 1); assert.equal(ended, 0); assert.ok(byType(h.render(), 'video'));
});
test('an old callback cannot pause a current play on the same reused video element', () => {
  const receipts = [];
  const h = stage({ videoUrl: '/api/videos/one', playing: true, playId: 1, onPlaybackEvent(value) { receipts.push(value); } });
  const first = byType(h.render(), 'video'), element = first.props.ref.current; videoEvent(first, 'onPlaying');
  h.props.dealer = 'Vera'; const current = byType(h.render(), 'video'); videoEvent(current, 'onPlaying');
  assert.equal(current.props.ref.current, element);
  first.props.onPlaying({ currentTarget: element }); first.props.onEnded({ currentTarget: element }); first.props.onError({ currentTarget: element });
  assert.equal(element.paused, false); assert.deepEqual(receipts.map(item => item.phase), ['started', 'started']);
  videoEvent(current, 'onEnded'); assert.equal(receipts.at(-1).phase, 'completed');
});
test('clearing playing pauses same-bound video, invalidates queued end, and permits explicit native replay', () => {
  const receipts = []; let ended = 0;
  const h = stage({ videoUrl: '/api/videos/one', playing: true, playId: 1, onPlaybackEvent(value) { receipts.push(value); }, onPlaybackEnd() { ended++; } });
  const first = byType(h.render(), 'video'); videoEvent(first, 'onPlaying');
  h.props.playing = false; const stopped = byType(h.render(), 'video');
  assert.equal(stopped.props.ref.current.paused, true); videoEvent(first, 'onEnded');
  assert.equal(ended, 0); assert.deepEqual(receipts.map(item => item.phase), ['started']);
  videoEvent(stopped, 'onPlaying'); videoEvent(stopped, 'onEnded');
  assert.equal(ended, 1); assert.deepEqual(receipts.map(item => item.phase), ['started', 'started', 'completed']);
});
test('test result with no video and social reply never borrow selected standard film', () => {
  const { previewVideoIdFor } = component('./studio-types.ts', '', {}).exports;
  const variant = { videoGenerationId: 'standard-film' };
  assert.equal(previewVideoIdFor(variant, null, false), 'standard-film');
  assert.equal(previewVideoIdFor(variant, { videoGenerationId: null }, false), null);
  assert.equal(previewVideoIdFor(variant, {}, false), undefined);
  assert.equal(previewVideoIdFor(variant, { videoGenerationId: 'alternative-film' }, false), 'alternative-film');
  assert.equal(previewVideoIdFor(variant, null, true), undefined);
});
test('inline picker binds and removes an exact film without a model or upload', () => {
  const edits = [];
  const one = { id: 'one', label: 'Astrid höger', dealer: 'astrid', available: true, verdict: 'want', classification: { label: 'Astrid höger', dealerId: 'astrid', eventId: 'deal.player.right', kind: 'action', role: 'standard', situation: 'box5', notes: '' } };
  const h = component('./video-library.tsx', 'VariantVideoBinding', { inventory: { videos: [one, { ...one, id: 'two', dealer: 'vera' }] }, dealerId: 'astrid', eventId: 'deal.player.right', variant: { videoGenerationId: null }, isBaseline: true, onBind: id => edits.push(id), onInspect() {} });
  const select = byType(h.render(), 'select');
  assert.ok(find(select, node => node.type === 'option' && node.props.value === 'one'));
  assert.equal(find(select, node => node.type === 'option' && node.props.value === 'two'), undefined);
  select.props.onChange({ target: { value: 'one' } });
  assert.deepEqual(edits, ['one']);
  h.props.variant.videoGenerationId = 'one';
  byType(h.render(), 'input').props.onChange({ target: { value: 'no match' } });
  assert.ok(find(h.render(), node => node.type === 'option' && node.props.value === 'one'));
  button(h.render(), 'Koppla loss video').props.onClick();
  assert.deepEqual(edits, ['one', null]);
});
