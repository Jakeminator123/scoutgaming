import test from 'node:test';
import assert from 'node:assert/strict';
import { inkOf } from '../public/felt-logo.js';

// w x h RGBA image filled with one colour, then a block of another in the middle
const image = (w, h, bg, fg) => { const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(x > w / 4 && x < 3 * w / 4 && y > h / 4 && y < 3 * h / 4 ? fg : bg, (y * w + x) * 4); return d; };

test('a transparent dark logo inks its own shape and reads as dark (shown light in the header)', () => {
  const { alpha, dark } = inkOf(image(8, 8, [0, 0, 0, 0], [20, 20, 30, 255]), 8, 8);
  assert.equal(dark, true);
  assert.equal(alpha[0], 0); assert.equal(alpha[4 * 8 + 4], 255);
});

test('a logo on a solid white plate inks only what differs from the plate, never the plate itself', () => {
  const { alpha, dark } = inkOf(image(8, 8, [255, 255, 255, 255], [10, 10, 10, 255]), 8, 8);
  assert.equal(alpha[0], 0); assert.equal(alpha[4 * 8 + 4], 255); assert.equal(dark, true);
});

test('a light logo is not dark, so the header keeps its own colours', () => {
  const { dark } = inkOf(image(8, 8, [0, 0, 0, 0], [240, 220, 120, 255]), 8, 8);
  assert.equal(dark, false);
});
