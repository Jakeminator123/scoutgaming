import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createVoicePool, SILENT_WAV } from '../public/voice-pool.js';

// Kevin 20 Oct: no sound on the phone when the dealer spoke (a new Audio per line, started outside the gesture).
const fakeAudio = () => { const a = { dataset: {}, muted: false, src: '', readyState: 0, duration: NaN, currentTime: 0, loads: 0, plays: 0, listeners: {},
  load() { this.loads++; }, play() { this.plays++; return Promise.resolve(); }, pause() { this.paused = true; },
  addEventListener(ev, f) { (this.listeners[ev] ??= []).push(f); }, fire(ev) { for (const f of this.listeners[ev] ?? []) f(); this.listeners[ev] = []; } }; return a; };

test('the pool is started once in the gesture, muted on a silent source, and never again', () => {
  const busy = new Set(), v = createVoicePool({ busy: a => busy.has(a), create: fakeAudio });
  assert.equal(v.pool.length, 3);
  v.unlock(); v.unlock();
  for (const a of v.pool) { assert.equal(a.plays, 1, 'played once in the gesture'); assert.equal(a.src, SILENT_WAV); assert.equal(a.muted, true); }
  assert.equal(SILENT_WAV, '/media/silent.wav');
  assert.ok(existsSync(new URL('../public/media/silent.wav', import.meta.url)), 'the silent file is served with the media');
});

test('a line warmed ahead is spoken with the element that holds it, without loading again; a sound nobody warmed takes a free element and loads', () => {
  const busy = new Set(), v = createVoicePool({ busy: a => busy.has(a), create: fakeAudio });
  const w = v.warm('/l/lose_1.mp4');
  assert.ok(w && w.dataset.warm === '1' && w.src === '/l/lose_1.mp4' && w.loads === 1);
  assert.equal(v.warm('/l/lose_1.mp4'), null, 'warmed once');
  const a = v.take('/l/lose_1.mp4');
  assert.equal(a, w); assert.equal(a.loads, 1, 'not loaded again'); assert.equal(a.dataset.warm, undefined);
  busy.add(a);
  const b = v.take('/l/win_3.mp4');
  assert.notEqual(b, a, 'a speaking element is never taken'); assert.equal(b.src, '/l/win_3.mp4'); assert.equal(b.loads, 1);
});

test('a free element holding another warmed line is the last choice, and with all three speaking a fresh element is made', () => {
  const busy = new Set(), v = createVoicePool({ busy: a => busy.has(a), create: fakeAudio });
  const w = v.warm('/l/goodluck_1.mp4');
  const a = v.take('/l/greet.mp4'); assert.notEqual(a, w, 'the warmed line is kept for its own time');
  busy.add(a); const b = v.take('/l/x.mp4'); assert.notEqual(b, w); busy.add(b);
  const c = v.take('/l/y.mp4'); assert.equal(c, w, 'only the warmed one left: it is used'); busy.add(c);
  const d = v.take('/l/z.mp4'); assert.ok(!v.pool.includes(d) && d.src === '/l/z.mp4', 'a fresh element when all three speak');
  busy.delete(a); assert.equal(v.take('/l/goodluck_1.mp4'), a, 'a freed element loads the line again');
});

test('a sound starts at its offset: now when its metadata is here, else when it arrives; a reused element rewinds', () => {
  const v = createVoicePool({ create: fakeAudio });
  const a = fakeAudio(); a.readyState = 0;
  v.seek(a, () => 0.8); assert.equal(a.currentTime, 0, 'waits for the metadata');
  a.readyState = 1; a.duration = 3; a.fire('loadedmetadata'); assert.equal(a.currentTime, 0.8);
  v.seek(a, () => 0.05); assert.equal(a.currentTime, 0, 'a small offset: from the start, rewound');
  v.seek(a, () => 9); assert.equal(a.currentTime, 3, 'never past the end');
});
