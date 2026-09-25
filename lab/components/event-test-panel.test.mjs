import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./event-test-panel.tsx', import.meta.url), 'utf8');

test('Eventstudion exposes the complete held-for-pose chat simulation in order', () => {
  const stages = [
    'chat received',
    'response ready',
    'held for pose',
    'action completed',
    'standard idle presented',
    'chat displayed',
    'speech started',
    'speech completed',
  ];
  let previous = -1;
  for (const stage of stages) {
    const index = source.indexOf(`['${stage}'`);
    assert.ok(index > previous, `${stage} should be present after the preceding stage`);
    previous = index;
  }
  assert.match(source, /Ingen assistenttext eller media släpptes före standard-idle/);
});
