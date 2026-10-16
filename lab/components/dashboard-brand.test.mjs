import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('dashboard motion has a reduced-motion fallback', () => {
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /scout-stage-in/);
  assert.match(css, /scout-slash-swing/);
  assert.match(css, /\.stage-panel,.stage-panel:hover,.stage-panel:focus-within\{transform:none!important\}/);
});
