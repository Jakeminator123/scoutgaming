import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

function harness(extra = {}) {
  const slots = [], effects = [], listeners = new Set(), timers = new Map(), nodes = new Map(); let cursor = 0, timerId = 0;
  const receipts = [], posted = []; let ends = 0, failures = 0;
  const props = { mediaId: 'original:astrid:speech:double', playId: 1, playing: true, onPlaybackEvent: value => receipts.push(value), onPlaybackEnd: () => ends++, onFailure: () => failures++, ...extra };
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = value; }]; },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useEffect(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) { const old = slots[i]; slots[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); }); } },
    useEffectEvent(fn) { const i = cursor++; slots[i] = fn; return (...args) => slots[i](...args); },
  };
  const origin = 'http://127.0.0.1:4188';
  const module = { exports: {} };
  const code = transformSync(readFileSync(new URL('./original-media-player.tsx', import.meta.url), 'utf8'), { filename: 'original-media-player.tsx', jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } }).code;
  vm.runInNewContext(code, { module, exports: module.exports, crypto: { randomUUID: () => 'session-1' }, window: { location: { origin }, addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn), setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id) }, require: id => id === 'react' ? hooks : id.endsWith('.css') ? { __esModule: true, default: {} } : require(id) });
  let frame;
  const result = { props, receipts, posted, get ends() { return ends; }, get failures() { return failures; }, get frame() { return frame; },
    render() {
      cursor = 0; const tree = module.exports.OriginalMediaPlayer(props); frame = tree.props.children[0];
      if (!nodes.has(frame.key)) nodes.set(frame.key, { contentWindow: { postMessage: data => posted.push(data) } });
      frame.props.ref.current = nodes.get(frame.key); while (effects.length) effects.shift()(); return frame;
    },
    message(phase, override = {}) { const f = override.frame ?? frame; for (const fn of listeners) fn({ origin, source: f.props.ref.current.contentWindow, data: { type: 'croupier-original-media', channel: decodeURIComponent(f.props.src.split('&channel=')[1]), mediaId: props.mediaId, phase, reason: 'decode failed', ...override.data }, ...override }); },
    timeout() { for (const fn of timers.values()) fn(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
  return result;
}

test('original iframe accepts only current same-origin sender and starts once after ready', () => {
  const h = harness(); h.render();
  h.message('ready', { origin: 'https://other.example' }); h.message('ready', { source: {} });
  h.message('ready', { data: { channel: 'old-session' } }); assert.equal(h.posted.length, 0);
  h.message('ready'); h.message('ready'); assert.equal(h.posted.filter(p => p.command === 'play').length, 1);
  h.message('started'); h.message('started'); assert.equal(h.receipts.length, 1);
  h.message('completed'); h.message('completed'); assert.equal(h.ends, 1); assert.equal(h.receipts.length, 2);
});

test('completion before painted start and messages after stop never advance the sequence', () => {
  const h = harness(); h.render(); h.message('ready'); h.message('completed'); assert.equal(h.ends, 0);
  h.props.playing = false; h.render(); h.message('started'); h.message('completed'); assert.equal(h.receipts.length, 0);
  assert.equal(h.posted.at(-1).command, 'stop'); h.unmount();
});

test('choosing an original does not autoplay, changing play identity rejects stale playback', () => {
  const h = harness({ playing: false }); const old = h.render(); h.message('ready'); assert.equal(h.posted.filter(p => p.command === 'play').length, 0);
  h.props.playing = true; h.props.playId++; const next = h.render(); assert.notEqual(old.key, next.key);
  const staleChannel = decodeURIComponent(old.props.src.split('&channel=')[1]);
  h.message('ready', { data: { channel: staleChannel } }); assert.equal(h.posted.filter(p => p.command === 'play').length, 0);
  h.message('ready'); h.message('started', { data: { channel: staleChannel } }); assert.equal(h.receipts.length, 0);
  h.message('started'); assert.equal(h.receipts.length, 1); h.unmount();
});

test('error and startup timeout each report one fallback and preserve sequence completion ownership', () => {
  const failed = harness(); failed.render(); failed.message('ready'); failed.message('failed'); failed.message('failed');
  assert.equal(failed.failures, 1); assert.equal(failed.receipts[0].phase, 'fallback'); assert.equal(failed.ends, 0);
  failed.timeout(); assert.equal(failed.failures, 1);
  const timed = harness(); timed.render(); timed.timeout(); timed.timeout();
  assert.equal(timed.failures, 1); assert.equal(timed.posted.at(-1).command, 'stop'); assert.equal(timed.ends, 0);
});
