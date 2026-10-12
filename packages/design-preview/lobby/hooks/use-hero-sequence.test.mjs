import test from 'node:test';
import assert from 'node:assert/strict';
import { heroCanTakeOver, heroParallaxProgress, heroPlaybackScroll } from './use-hero-sequence.ts';

test('the 30 percent boundary scales with the full parallax span across viewport sizes', () => {
  for (const height of [400, 720, 1296]) {
    const boundary = height * 1.6 * 0.3;
    assert.ok(heroParallaxProgress(-boundary + 1, height) < 0.3);
    assert.ok(Math.abs(heroParallaxProgress(-boundary, height) - 0.3) < 1e-12);
    assert.ok(heroParallaxProgress(-boundary - 1, height) > 0.3);
    assert.equal(heroCanTakeOver(-boundary, height), true);
    assert.equal(heroCanTakeOver(-boundary - 0.001, height), false);
  }
  assert.equal(heroCanTakeOver(-345.6, 720), true);
  assert.equal(heroCanTakeOver(NaN, 720), false);
  assert.equal(heroParallaxProgress(100, 720), 0);
  assert.equal(heroParallaxProgress(-3000, 720), 1);
  assert.equal(heroParallaxProgress(0, 0), 1);
});

test('scroll begins with playback and traverses the remaining span over the remaining film', () => {
  assert.equal(heroPlaybackScroll(620, 2073.6, 0, 10), 620);
  assert.ok(heroPlaybackScroll(620, 2073.6, 0.1, 10) > 620);
  assert.equal(heroPlaybackScroll(200, 1200, 7, 10, 4), 700);
  assert.equal(heroPlaybackScroll(200, 1200, 10, 10, 4), 1200);
  assert.equal(heroPlaybackScroll(200, 1200, 12, 10, 4), 1200);
});

test('unchanged playback time cannot advance scrolling during buffering or a hidden-tab pause', () => {
  const paused = heroPlaybackScroll(0, 1152, 3, 10);
  assert.equal(heroPlaybackScroll(0, 1152, 3, 10), paused);
  assert.equal(heroPlaybackScroll(0, 1152, 0, NaN), null);
  assert.equal(heroPlaybackScroll(0, 1152, 0, Infinity), null);
  assert.equal(heroPlaybackScroll(0, 1152, 4, 4, 4), null);
});
