import test from 'node:test';
import assert from 'node:assert/strict';
import { scopeNativeSession } from '../lib/native-session-channel.mjs';
import { buildPresentationSequence } from '../lib/presentation-sequence.mjs';
import { createSeedProject } from '../lib/studio-model.mjs';
import { appendPartnerTrace, createPartnerTrace, restartPartnerTrace } from '../lib/partner-trace.mjs';

test('native session separates observations after Web reload and local profile version reset', () => {
  let epoch = 0;
  const records = [];
  for (const input of [
    { kind: 'status', data: { state: 'attached' } },
    { kind: 'round', data: { type: 'round', requestId: 'first', version: 8, events: [{ type: 'idle' }] } },
    { kind: 'status', data: { state: 'attached' } },
    { kind: 'round', data: { type: 'round', requestId: 'second', version: 1, events: [{ type: 'idle' }] } },
  ]) {
    const scoped = scopeNativeSession({ source: 'native', time: '2026-09-29T00:00:00Z', ...input }, epoch);
    epoch = scoped.epoch;
    records.push(scoped.record);
  }
  assert.deepEqual(records.map(record => record.channel), [
    'native-session-1', 'native-session-1', 'native-session-2', 'native-session-2',
  ]);
  const result = buildPresentationSequence(records, createSeedProject());
  assert.equal(result.steps.length, 2);
  assert.deepEqual(result.steps.map(step => step.requestId), ['first', 'second']);
  assert.equal(result.notices.some(notice => notice.kind === 'gap' && notice.message.includes('Versionslucka')), false);

  // A user may clear the Lab observation between profiles. The reset stores
  // the previous channel's version floor so delayed events cannot replay.
  let trace = createPartnerTrace({ rolling: true });
  for (const record of records.slice(0, 2)) trace = appendPartnerTrace(trace, record);
  trace = restartPartnerTrace(trace);
  for (const record of records.slice(2)) trace = appendPartnerTrace(trace, record);
  const afterReset = buildPresentationSequence(trace.records, createSeedProject());
  assert.deepEqual(afterReset.steps.map(step => step.requestId), ['second']);
});
