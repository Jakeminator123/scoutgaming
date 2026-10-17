import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { createSeedProject } from '../../packages/presentation/contracts/studio-model.mjs';
import { createDefaultIdlePolicy } from '../../packages/presentation/runtime/idle-policy.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
function component(file, name, props) {
  // Minimal commit/effect renderer, not a FileVideo stub: every function child
  // gets its own hook slots and keyed lifecycle, and host refs are bound before
  // effects run. Removed keys execute cleanup and detach their actual refs.
  const instances = new Map(), nodes = new Map(), modules = new Map(), effects = [], timers = new Map(), intervals = new Set();
  let current, timerId = 0, now = 0, seenInstances, seenNodes;
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
  const hooks = {
    useState(initial) { const owner = current, { slots } = owner, i = owner.cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { if (owner.mounted) slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(value) { const i = current.cursor++; return current.slots[i] ??= { current: value }; },
    useMemo(fn, deps) { const { slots } = current, i = current.cursor++; if (!sameDeps(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value; },
    useEffect(fn, deps) { const owner = current, { slots } = owner, i = owner.cursor++; if (!sameDeps(slots[i]?.deps, deps)) { const old = slots[i]; slots[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { if (!owner.mounted) return; old?.cleanup?.(); slots[i].cleanup = fn(); }); } },
    useEffectEvent(fn) { const { slots } = current, i = current.cursor++; slots[i] = fn; return (...args) => slots[i](...args); }, useDeferredValue(value) { return value; },
  };
  const clock = {
    setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); intervals.delete(id); },
    setInterval(fn) { const id = ++timerId; timers.set(id, fn); intervals.add(id); return id; },
    clearInterval(id) { timers.delete(id); intervals.delete(id); },
  };
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} }; modules.set(filename, module);
    const code = transformSync(readFileSync(new URL(filename, import.meta.url), 'utf8'), { filename, jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } }).code;
    vm.runInNewContext(code, { module, exports: module.exports, ...clock, performance: { now: () => now }, window: { ...clock, matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {} }; } }, require: id => id === 'react' ? hooks : id.endsWith('.css') ? { __esModule: true, default: {} } : id === './dealer-video-surface' ? { DealerVideoSurface: ({children}) => children } : id === './presentation-frame' ? load('./presentation-frame.tsx') : id === './file-video' ? load('./file-video.tsx') : id === './video-classification' ? { VideoClassification: () => null } : id === './video-upload' ? { VideoUpload: () => null } : id === './video-coverage' ? { VideoCoverage: () => null } : require(id) });
    return module.exports;
  }
  function renderFunction(fn, values, path) {
    let owner = instances.get(path);
    if (!owner) { owner = { slots: [], cursor: 0, mounted: true }; instances.set(path, owner); }
    seenInstances.add(path); owner.cursor = 0;
    const parent = current; current = owner;
    let tree;
    try { tree = fn(values); } finally { current = parent; }
    return expand(tree, path);
  }
  function expand(tree, path) {
    if (!tree || typeof tree !== 'object') return tree;
    if (Array.isArray(tree)) return tree.map((child, index) => expand(child, `${path}/${child?.key ?? index}`));
    const ownPath = `${path}/${typeof tree.type === 'function' ? tree.type.name : String(tree.type)}:${tree.key ?? ''}`;
    if (typeof tree.type === 'function') return renderFunction(tree.type, tree.props, ownPath);
    if (tree.props?.ref) {
      seenNodes.add(ownPath);
      if (!nodes.has(ownPath)) nodes.set(ownPath, { ref: tree.props.ref, element: {
        dataset: {}, paused: !tree.props.autoPlay, ended: false, duration: 3, currentTime: 0, pauseCalls: 0, playCalls: 0,
        pause() { this.paused = true; this.pauseCalls++; },
        play() { this.paused = false; this.ended = false; this.playCalls++; return this.playResult?.() ?? Promise.resolve(); },
      } });
      tree.props.ref.current = nodes.get(ownPath).element;
    }
    return tree.props ? { ...tree, props: { ...tree.props, children: expand(tree.props.children, ownPath) } } : tree;
  }
  function cleanupMissing() {
    for (const [path, owner] of instances) if (!seenInstances.has(path)) {
      owner.mounted = false; for (const slot of owner.slots) slot?.cleanup?.(); instances.delete(path);
    }
    for (const [path, node] of nodes) if (!seenNodes.has(path)) {
      // A stable hook ref may already point at its newly keyed host element.
      if (node.ref.current === node.element) node.ref.current = null;
      nodes.delete(path);
    }
  }
  const exports = load(file);
  return { props, timers, exports,
    render() { seenInstances = new Set(); seenNodes = new Set(); const tree = renderFunction(exports[name], props, '$root'); cleanupMissing(); while (effects.length) effects.shift()(); return tree; },
    unmount() { seenInstances = new Set(); seenNodes = new Set(); cleanupMissing(); },
    advance(ms) { now += ms; for (const [id, callback] of [...timers]) { if (!timers.has(id)) continue; if (!intervals.has(id)) timers.delete(id); callback(); } },
  };
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const item of node) { const result = find(item, predicate); if (result) return result; } return; }
  return predicate(node) ? node : find(node.props?.children, predicate);
}
const byType = (tree, type) => find(tree, node => node.type === type);
const button = (tree, label) => find(tree, node => node.type === 'button' && node.props.children === label);
function videoEvent(video, name) {
  const element = video.props.ref.current;
  if (name === 'onPlaying') { element.paused = false; element.ended = false; }
  if (name === 'onEnded') { element.ended = true; element.paused = true; element.currentTime = element.duration; }
  video.props[name]({ currentTarget: element });
}
const project = createSeedProject();
function stage(extra = {}) {
  return component('./stage.tsx', 'Stage', { event: project.events[0], asset: project.assets[0], dealer: 'Astrid', variantLabel: 'Standard', playId: 0, playing: false, hasResult: false, busy: false, onPlay() {}, onPreview() {}, ...extra });
}

test('compact file controls start and pause the exact video and respect blocked playback', () => {
  const receipts = [], h = stage({ videoUrl: '/wide-clip', playId: 7, onPlaybackEvent: value => receipts.push(value) });
  const tree = h.render(), video = byType(tree, 'video'), toggle = button(tree, 'Spela / pausa');
  assert.equal(toggle.props['aria-label'], 'Spela eller pausa klippet');
  assert.equal(video.props.ref.current.paused, true);
  toggle.props.onClick(); videoEvent(video, 'onPlaying');
  assert.equal(video.props.ref.current.paused, false);
  toggle.props.onClick(); assert.equal(video.props.ref.current.paused, true);
  toggle.props.onClick(); videoEvent(video, 'onPlaying'); videoEvent(video, 'onEnded');
  assert.equal(receipts.at(-1).phase, 'completed');
  h.props.blocked = true; const locked = h.render();
  assert.equal(button(locked, 'Spela / pausa').props.disabled, true);
  button(locked, 'Spela / pausa').props.onClick(); toggle.props.onClick();
  assert.equal(byType(locked, 'video').props.ref.current.paused, true);
});
test('idle format switches preserve the playing base and do not edit the policy', () => {
  const policy = createDefaultIdlePolicy(), changes = [];
  const inventory = { families: [{ id: policy.familyId, standardIds: policy.base.map(row => row.videoId), variantIds: policy.variants.map(row => row.videoId) }],
    videos: [...policy.base, ...policy.variants].map(row => ({ id: row.videoId, available: true, fileName: row.videoId + '.mp4', previewUrl: '/api/videos/' + row.videoId })) };
  const h = component('./idle-policy-editor.tsx', 'IdlePolicyEditor', { policy, inventory, blocked: false, onChange: value => changes.push(value), onBusyChange() {} });
  button(h.render(), 'Spela basklipp').props.onClick();
  const video = byType(h.render(), 'video'), element = video.props.ref.current;
  videoEvent(video, 'onPlaying');
  for (const label of ['Mobil · 9:16', 'Dator · 16:9']) {
    button(h.render(), label).props.onClick();
    assert.equal(byType(h.render(), 'video').props.ref.current, element);
    assert.equal(element.paused, false);
    assert.equal(find(h.render(), node => node.props?.['data-presentation-format']).props['data-presentation-format'], label.startsWith('Mobil') ? 'mobile' : 'desktop');
  }
  assert.deepEqual(changes, []);
});

test('idle minute keeps base loops alive and rejects late start/finish after stop or action takeover', () => {
  for (const reason of ['stop', 'action']) {
    const policy = createDefaultIdlePolicy(), busy = [];
    const inventory = { families: [{ id: policy.familyId, standardIds: policy.base.map(row => row.videoId), variantIds: policy.variants.map(row => row.videoId) }],
      videos: [...policy.base, ...policy.variants].map(row => ({ id: row.videoId, available: true, fileName: row.videoId + '.mp4', previewUrl: '/api/videos/' + row.videoId })) };
    const h = component('./idle-policy-editor.tsx', 'IdlePolicyEditor', { policy, inventory, blocked: false, onChange() {}, onBusyChange: value => busy.push(value) });
    button(h.render(), 'Spela en minut').props.onClick();
    const video = byType(h.render(), 'video'), oldElement = video.props.ref.current;
    assert.equal(video.props.loop, true, 'base lasts until its planned segment ends, not just one MP4 iteration');
    if (reason === 'stop') button(h.render(), 'Stoppa').props.onClick();
    else { h.props.blocked = true; h.render(); }
    video.props.onPlaying({ currentTarget: oldElement });
    video.props.onEnded({ currentTarget: oldElement });
    assert.equal(oldElement.paused, true);
    assert.ok(!busy.includes(true), 'late callback cannot reacquire ownership');
    assert.equal(h.timers.size, 0);
  }
});

test('video is preferred automatically but does not autoplay just by choosing a binding', () => {
  const h = stage({ videoUrl: '/api/videos/one' });
  const selected = byType(h.render(), 'video').props.ref.current;
  assert.equal(selected.playCalls, 0); assert.equal(selected.paused, true);
  h.props.playing = true; h.props.playId++;
  const first = byType(h.render(), 'video');
  assert.equal(first.props.ref.current.playCalls, 1); assert.equal(first.props.ref.current.paused, false);
  assert.equal(first.props.loop, undefined);
  const oldElement = first.props.ref.current;
  h.props.playId++;
  assert.notEqual(byType(h.render(), 'video').props.ref.current, oldElement);
  assert.equal(oldElement.paused, true, 'keyed child unmount cleans up old playback');
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
  find(h.render(), node => node.type === 'button' && Array.isArray(node.props.children) && node.props.children.includes('Spela valt klipp')).props.onClick();
  assert.equal(previews, 1);
  assert.ok(byType(h.render(), 'video'));
  videoEvent(byType(h.render(), 'video'), 'onError'); h.props.videoUrl = '/api/videos/two';
  assert.ok(byType(h.render(), 'video'));
});
test('a failed file variant tries its exact family standard once, then 2D; new play retries', () => {
  const receipts = [];
  const h = stage({ playing: true, playId: 1, videoUrl: '/variant', videoId: 'variant', familyId: 'same',
    fallbackVideo: { available: true, previewUrl: '/standard', id: 'standard', familyId: 'same', fileName: 'standard.mp4' }, onPlaybackEvent: r => receipts.push(r) });
  videoEvent(byType(h.render(), 'video'), 'onError');
  const standard = byType(h.render(), 'video');
  assert.equal(standard.props.src, '/standard');
  videoEvent(standard, 'onPlaying');
  assert.equal(receipts.at(-1).fileName, 'standard.mp4');
  videoEvent(standard, 'onError');
  assert.equal(byType(h.render(), 'video'), undefined);
  h.props.playId++;
  assert.equal(byType(h.render(), 'video').props.src, '/variant');
  h.props.fallbackVideo.familyId = 'other';
  videoEvent(byType(h.render(), 'video'), 'onError');
  assert.equal(byType(h.render(), 'video'), undefined, 'never borrow a different family');
});

test('a stale missing variant URL falls back to its same-family standard without borrowing for null decisions', () => {
  const h = stage({ playing: true, playId: 1, videoMissing: true, videoId: 'missing', familyId: 'same',
    fallbackVideo: { available: true, previewUrl: '/standard', id: 'standard', familyId: 'same', fileName: 'standard.mp4' } });
  assert.equal(byType(h.render(), 'video').props.src, '/standard');
  h.props.videoId = undefined;
  assert.equal(byType(h.render(), 'video'), undefined);
});

test('missing registered video without a 2D fallback shows the existing status text', () => {
  const h = stage({ allow2dFallback: false });
  const status = find(h.render(), node => node.type === 'div' && node.props.role === 'status');
  assert.match(String(status.props.children), /Ingen spelbar video för den här situationen/);
  assert.equal(byType(h.render(), 'iframe'), undefined);
  assert.equal(button(h.render(), 'Bara 2D'), undefined);
});
test('missing required video emits failure without starting or completing a 2D animation', () => {
  const receipts = []; let ended = 0;
  const h = stage({ allow2dFallback: false, playing: true, hasResult: true, playId: 1,
    onPlaybackEvent: value => receipts.push(value), onPlaybackEnd() { ended++; } });
  const tree = h.render();
  assert.match(String(find(tree, node => node.props?.role === 'status').props.children), /Ingen spelbar video/);
  h.advance(10000);
  assert.deepEqual(receipts.map(({ phase, medium }) => ({ phase, medium })), [{ phase: 'failed', medium: 'video' }]);
  assert.equal(ended, 1, 'the editor stops the attempted preview without a completed receipt');
  assert.equal(h.timers.size, 0);
});

test('broken required variant tries only its registered family standard, then reports no playable video', () => {
  const receipts = [];
  const h = stage({ allow2dFallback: false, playing: true, hasResult: true, playId: 1,
    videoUrl: '/variant', videoId: 'variant', familyId: 'same',
    fallbackVideo: { available: true, previewUrl: '/standard', id: 'standard', familyId: 'same', fileName: 'standard.mp4' },
    onPlaybackEvent: value => receipts.push(value) });
  videoEvent(byType(h.render(), 'video'), 'onError');
  const standard = byType(h.render(), 'video');
  assert.equal(standard.props.src, '/standard');
  videoEvent(standard, 'onError');
  const tree = h.render();
  assert.match(String(find(tree, node => node.props?.role === 'status').props.children), /Ingen spelbar video/);
  assert.equal(byType(tree, 'video'), undefined);
  assert.equal(button(tree, 'Bara 2D'), undefined);
  h.advance(10000);
  assert.equal(receipts.at(-1).phase, 'failed');
  assert.equal(receipts.some(value => value.medium === '2d' || value.phase === 'completed'), false);
  h.props.playId++;
  assert.equal(byType(h.render(), 'video').props.src, '/variant', 'an explicit retry gets a fresh video attempt');
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
test('dealer switch remounts the file child; old callbacks cannot pause or complete its successor', () => {
  const receipts = [];
  const h = stage({ videoUrl: '/api/videos/one', playing: true, playId: 1, onPlaybackEvent(value) { receipts.push(value); } });
  const first = byType(h.render(), 'video'), element = first.props.ref.current; videoEvent(first, 'onPlaying');
  h.props.dealer = 'Vera'; const current = byType(h.render(), 'video'); videoEvent(current, 'onPlaying');
  assert.notEqual(current.props.ref.current, element);
  assert.equal(element.paused, true, 'dealer key change unmounts and pauses old child');
  first.props.onPlaying({ currentTarget: element }); first.props.onEnded({ currentTarget: element }); first.props.onError({ currentTarget: element });
  assert.equal(current.props.ref.current.paused, false); assert.deepEqual(receipts.map(item => item.phase), ['started', 'started']);
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

test('stopped file drops late playing/error/ended callbacks without selecting a fallback', () => {
  const receipts = [];
  const h = stage({ videoUrl: '/one', playing: true, playId: 1, onPlaybackEvent: receipt => receipts.push(receipt) });
  const first = byType(h.render(), 'video'), element = first.props.ref.current;
  videoEvent(first, 'onPlaying');
  h.props.playing = false; h.render();
  first.props.onPlaying({ currentTarget: element });
  first.props.onError({ currentTarget: element });
  first.props.onEnded({ currentTarget: element });
  assert.deepEqual(receipts.map(receipt => receipt.phase), ['started']);
  assert.equal(byType(h.render(), 'video').props.src, '/one');
  assert.equal(element.paused, true);
});

test('late rejected play promise cannot fail a newer effect generation on the same child', async () => {
  const receipts = [];
  const h = stage({ videoUrl: '/one', playId: 1, onPlaybackEvent: receipt => receipts.push(receipt) });
  const selected = byType(h.render(), 'video'), element = selected.props.ref.current;
  let rejectOld;
  const oldPlay = new Promise((_resolve, reject) => { rejectOld = reject; });
  let playCalls = 0;
  element.playResult = () => ++playCalls === 1 ? oldPlay : Promise.resolve();
  h.props.playing = true; h.render();
  h.props.playing = false; h.render();
  h.props.playing = true; const current = byType(h.render(), 'video');
  assert.strictEqual(current.props.ref.current, element, 'no key change: this tests effect generation, not remount cleanup');
  videoEvent(current, 'onPlaying');
  rejectOld(new Error('old interrupted play'));
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(receipts.map(receipt => receipt.phase), ['started']);
  assert.equal(byType(h.render(), 'video').props.src, '/one');
  assert.equal(element.paused, false);
});

test('completion requires actual ended media evidence; watchdog/timeupdate and duplicate events finish once', () => {
  const receipts = []; let ended = 0;
  const h = stage({ videoUrl: '/one', playing: true, playId: 1, onPlaybackEvent: receipt => receipts.push(receipt), onPlaybackEnd: () => ended++ });
  const video = byType(h.render(), 'video'), element = video.props.ref.current;
  videoEvent(video, 'onPlaying'); videoEvent(video, 'onPlaying');
  video.props.onEnded({ currentTarget: element });
  h.advance(3500);
  assert.deepEqual(receipts.map(receipt => receipt.phase), ['started'], 'duration elapsed is not an ended receipt');
  element.ended = true; element.currentTime = element.duration;
  video.props.onTimeUpdate({ currentTarget: element });
  h.advance(250); video.props.onEnded({ currentTarget: element });
  assert.equal(ended, 1);
  assert.deepEqual(receipts.map(receipt => receipt.phase), ['started', 'completed']);
});

test('unmount cleans up the real file child timer and video and rejects every late callback', () => {
  const receipts = [];
  const h = stage({ videoUrl: '/one', playing: true, playId: 1, onPlaybackEvent: receipt => receipts.push(receipt) });
  const video = byType(h.render(), 'video'), element = video.props.ref.current;
  videoEvent(video, 'onPlaying'); assert.equal(h.timers.size, 1);
  h.unmount();
  assert.equal(element.paused, true); assert.equal(h.timers.size, 0);
  element.ended = true;
  for (const name of ['onPlaying', 'onEnded', 'onError', 'onTimeUpdate']) video.props[name]({ currentTarget: element });
  assert.deepEqual(receipts.map(receipt => receipt.phase), ['started']);
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
