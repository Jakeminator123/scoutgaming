import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./idle-policy-editor.tsx', import.meta.url), 'utf8');
const studio = readFileSync(new URL('./studio.tsx', import.meta.url), 'utf8');

test('idle editor exposes one simple three-step workflow and the four explicit owners', () => {
  for (const label of ['Grundloop', 'Korta variationer', 'Prova en minut']) assert.match(source, new RegExp(label));
  for (const owner of ['Manuell', 'Automatisk', 'Regelstyrd', 'OpenClaw']) assert.match(source, new RegExp(owner));
  assert.match(source, /idle\/variant\//);
});

test('idle preview has deterministic evidence and yields playback ownership', () => {
  for (const state of ['scheduled', 'started', 'completed', 'base resumed']) assert.match(source, new RegExp(state));
  assert.match(source, /createIdlePreviewPlan/);
  assert.match(source, /onBusyChange\(true\)/);
  assert.match(source, /onBusyChange\(false\)/);
  assert.match(studio, /isIdleEditor \? 'idle-editor-active'/);
  assert.match(studio, /blocked=\{socialBusyState \|\| simulating \|\| playing\}/);
});
