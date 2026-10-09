import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./idle-policy-editor.tsx', import.meta.url), 'utf8');
const events = readFileSync(new URL('./control-events-page.tsx', import.meta.url), 'utf8');
const preview = readFileSync(new URL('./events-preview.tsx', import.meta.url), 'utf8');

test('idle editor presents one base loop with variations and preserves advanced controls', () => {
  for (const label of ['Grundloop', 'Basklipp', 'Variationer', 'Spela en minut', 'Avancerat · basklipp och fördelning', 'Avancerat · slump och gränser', 'Avancerat · uppspelningsplan']) assert.match(source, new RegExp(label));
  for (const owner of ['Manuell', 'Automatisk', 'Regelstyrd', 'OpenClaw']) assert.match(source, new RegExp(owner));
  assert.match(source, /idle\/variant\//);
  assert.doesNotMatch(source, /Huvudloop|Reservloop/);
});

test('idle preview has deterministic evidence and yields playback ownership', () => {
  for (const state of ['scheduled', 'started', 'completed', 'base resumed']) assert.match(source, new RegExp(state));
  assert.match(source, /createIdlePreviewPlan/);
  assert.match(source, /onBusyChange\(true\)/);
  assert.match(source, /onBusyChange\(false\)/);
  assert.doesNotMatch(`${events}\n${preview}`, /IdlePolicyEditor|idle-editor-active/);
  assert.match(preview, /href=\{labUrl\('\/control\/clips#idle'\)\}/);
});
