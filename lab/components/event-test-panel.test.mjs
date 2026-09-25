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
  assert.match(source, /Pedagogisk demo, inte ett livetest/);
  assert.match(source, /Timern nedan läser inga spel- eller uppspelningskvitton/);
  assert.match(source, /Verklig uppspelning verifieras i Händelselogg/);
});

test('the real test action precedes the optional educational pose demo', () => {
  assert.ok(source.indexOf('onClick={onRun}') < source.indexOf('Visa principen: tal först i startposition'));
  assert.match(source, /<details className=\{styles\.advanced\}><summary>Visa principen/);
  assert.doesNotMatch(source, /Sekvens klar\. Ingen assistenttext eller media släpptes/);
});

test('mode help and test context are separate disclosures with no hidden mode selector', () => {
  assert.match(source, /Vem väljer klippet\?/);
  assert.match(source, /Vad betyder lägena\?/);
  assert.match(source, /Det byter inte AI för chatten/);
  assert.match(source, /<details className=\{styles\.testContext\}>/);
  assert.equal((source.match(/<select /g) ?? []).length, 1);
  assert.doesNotMatch(source, /Återgå till OpenClaw/);
});
