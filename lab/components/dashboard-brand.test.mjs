import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('dashboard motion has a reduced-motion fallback', () => {
  const reducedMotion = [...css.matchAll(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{([\s\S]*?)\}\s*\}/g)];
  assert.ok(reducedMotion.some(([, body]) =>
    /\banimation\s*:\s*none\b/.test(body) && /\btransform\s*:\s*none\b/.test(body)),
  'the dashboard disables animation and transforms for reduced motion');
});
