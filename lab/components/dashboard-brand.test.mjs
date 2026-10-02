import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const studio = readFileSync(new URL('./studio.tsx', import.meta.url), 'utf8');

test('dashboard uses the Scout palette and code-native wordmark', () => {
  assert.match(css, /--scout-ink:#0a0b0d/);
  assert.match(css, /--scout-off:#f2f1ed/);
  assert.match(css, /--scout-lime:#d6ff3a/);
  assert.match(studio, /Scout Gaming · Backoffice\/Lab/);
  assert.match(studio, /className="brand-wordmark"/);
  assert.match(studio, /scout<span>\/</);
});

test('dashboard motion has a reduced-motion fallback', () => {
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /scout-stage-in/);
  assert.match(css, /scout-slash-swing/);
  assert.match(css, /\.stage-panel,.stage-panel:hover,.stage-panel:focus-within\{transform:none!important\}/);
});
