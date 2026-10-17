import assert from 'node:assert/strict';
import test from 'node:test';
import { firstAutomaticDelayMs, nextAutomaticDelayMs } from './background-zone-schedule.mjs';

test('automatic zones start within ten seconds and never exceed two starts in a rolling minute', () => {
  assert.equal(firstAutomaticDelayMs(() => 0), 0);
  assert.equal(firstAutomaticDelayMs(() => .999999), 10_000);
  const starts = [0];
  for (let i = 0; i < 20; i++) {
    const last = starts.at(-1);
    starts.push(last + nextAutomaticDelayMs(last, last, () => i % 2 ? .999999 : 0));
  }
  for (const start of starts) {
    assert.ok(starts.filter(other => other >= start && other < start + 60_000).length <= 2);
  }
  assert.equal(nextAutomaticDelayMs(0, 45_000, () => 0), 0, 'a long clip may finish after its next due time');
});
