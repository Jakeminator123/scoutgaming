import test from 'node:test';
import assert from 'node:assert/strict';
import { splitObservationEntries, observationActivity } from '../lib/activity-session.mjs';
import { appendActivity } from '../lib/activity-log.mjs';

test('an observation never attributes earlier page or dealer events to its own session', () => {
  const preview = { id: 'preview', source: 'player', data: { dealerId: 'vera', evidence: 'presented-frame' } };
  const earlier = { id: 'older', observationId: 'earlier', data: { dealerId: 'astrid' } };
  const current = { id: 'current', observationId: 'current', data: { dealerId: 'mei' } };
  const entries = [preview, earlier, current];
  assert.deepEqual(splitObservationEntries(entries, 'current'), { current: [current], previous: [preview, earlier] });
  assert.deepEqual(splitObservationEntries(entries, null), { current: [], previous: entries });
  assert.deepEqual(splitObservationEntries(entries, 'next'), { current: [], previous: entries });
});

test('session metadata survives the existing bounded log without replacing raw event evidence', () => {
  const data = { evidence: 'presented-frame', state: 'presented', mediaId: 'vera:goodluck' };
  const context = { dealerId: 'vera', operatorSlug: 'operator-one', tableId: 'room-1' };
  const original = { id: 'one', time: '2026-10-12T00:00:00Z', data };
  const tagged = observationActivity(original, 'session-a', context);
  assert.equal(tagged.data, data); assert.equal(original.observationId, undefined);
  context.tableId = 'changed';
  assert.equal(tagged.observationContext.tableId, 'room-1');
  const entries = appendActivity([], tagged);
  assert.equal(entries[0].observationId, 'session-a');
  assert.deepEqual(entries[0].data, data);
  assert.deepEqual(splitObservationEntries(entries, 'session-b').previous, entries);
});
