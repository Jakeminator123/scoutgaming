import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const navigation = readFileSync(new URL('./workspace-navigation.tsx', import.meta.url), 'utf8');
const shells = ['control-events-page.tsx', 'control-videos-page.tsx', 'control-tree-page.tsx', 'control-activity-page.tsx', 'control-guide-page.tsx', 'control-probe-page.tsx', 'control-openclaw-chat.tsx', 'page-template.mjs']
  .map(file => readFileSync(new URL(`./${file}`, import.meta.url), 'utf8'));

test('dashboard uses the Scout palette and code-native wordmark', () => {
  assert.match(css, /--scout-ink:#0a0b0d/);
  assert.match(css, /--scout-off:#f2f1ed/);
  assert.match(css, /--scout-lime:#d6ff3a/);
  assert.match(navigation, /aria-label="ScoutGamingGroup · Administration"/);
  assert.match(navigation, /scout<b>\/</);
  for (const source of shells) assert.doesNotMatch(source, /Backoffice\/Lab|BACKOFFICE\/LAB|className="main-nav"|className="studio-brand"/);
});

test('dashboard motion has a reduced-motion fallback', () => {
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /scout-stage-in/);
  assert.match(css, /scout-slash-swing/);
  assert.match(css, /\.stage-panel,.stage-panel:hover,.stage-panel:focus-within\{transform:none!important\}/);
});
