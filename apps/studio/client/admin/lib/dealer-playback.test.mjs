import test from 'node:test';
import assert from 'node:assert/strict';
import { createPortraitPlayback, portraitIdleDelay } from './dealer-playback.mjs';

function fixture(random = () => 0.5) {
  let now = 0, nextId = 0, starts = 0, stops = 0;
  const timers = new Map();
  const playback = createPortraitPlayback({ random, start: () => starts++, stop: () => stops++,
    setTimer: (callback, delay) => { const id = ++nextId; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimer: id => timers.delete(id) });
  return { playback, get starts() { return starts; }, get stops() { return stops; }, get timers() { return timers.size; },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const entry = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry || entry[1].at > end) break;
        timers.delete(entry[0]); now = entry[1].at; entry[1].callback();
      }
      now = end;
    } };
}

test('portrait gestures wait 50 seconds with bounded five-second jitter, including first play', () => {
  assert.equal(portraitIdleDelay(() => 0), 45_000);
  assert.equal(portraitIdleDelay(() => 0.5), 50_000);
  assert.equal(portraitIdleDelay(() => 1), 55_000);
  assert.equal(portraitIdleDelay(() => NaN), 50_000);
  const f = fixture(); f.playback.setEligible(true); f.advance(49_999); assert.equal(f.starts, 0);
  f.advance(1); assert.equal(f.starts, 1);
  f.advance(4_042); f.playback.finish(); assert.equal(f.stops, 1);
  f.advance(49_999); assert.equal(f.starts, 1); f.advance(1); assert.equal(f.starts, 2);
});

test('offscreen, hidden-tab and reduced-motion eligibility cancels playback and starts a fresh interval', () => {
  const f = fixture(); f.advance(100_000); assert.equal(f.starts, 0);
  f.playback.setEligible(true); f.advance(49_000); f.playback.setEligible(false);
  f.advance(500_000); assert.equal(f.starts, 0); assert.equal(f.playback.request(), false);
  f.playback.setEligible(true); f.advance(50_000); assert.equal(f.starts, 1);
  f.playback.setEligible(false); assert.equal(f.stops, 1); assert.equal(f.timers, 0);
  f.playback.setEligible(true); f.advance(49_999); assert.equal(f.starts, 1);
  f.advance(1); assert.equal(f.starts, 2);
});

test('hover gestures do not overlap or loop and refused/stalled media recovers', () => {
  const f = fixture(); f.playback.setEligible(true);
  assert.equal(f.playback.request(), true); assert.equal(f.playback.request(), false);
  f.advance(15_000); assert.equal(f.stops, 1); assert.equal(f.starts, 1);
  f.advance(50_000); assert.equal(f.starts, 2);
  f.playback.dispose(); assert.equal(f.stops, 2); assert.equal(f.timers, 0);
  f.playback.setEligible(true); f.advance(100_000); assert.equal(f.starts, 2);
});

test('separate cards independently use jitter and dispose without another card losing its timer', () => {
  const a = fixture(() => 0), b = fixture(() => 1);
  a.playback.setEligible(true); b.playback.setEligible(true);
  a.advance(45_000); b.advance(45_000);
  assert.equal(a.starts, 1); assert.equal(b.starts, 0);
  a.playback.dispose(); b.advance(10_000); assert.equal(b.starts, 1);
});
