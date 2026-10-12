import test from 'node:test';
import assert from 'node:assert/strict';
import {cardLandingCorners} from '../web/public/performance-player.mjs';

// The Blender felt projector is gone with the review pages. This assertion
// stays because it is the only check of the live player's felt-corner landing.
test('a felt-corner dataset is the landing quad', () => {
  const quad = [[0, 0], [100, 0], [100, 143.5], [0, 143.5]];
  assert.deepEqual(cardLandingCorners({dataset: {feltCorners: JSON.stringify(quad)}}), quad);
});
