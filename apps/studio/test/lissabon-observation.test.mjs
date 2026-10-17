import test from 'node:test';
import assert from 'node:assert/strict';
import { createPartnerTrace, appendPartnerTrace, exportPartnerTrace, restartPartnerTrace, TRACE_RECORD_LIMIT, TRACE_BYTE_LIMIT } from '../lib/partner-trace.mjs';
import { createIdleLogFilter } from '../lib/activity-log.mjs';
import { buildPresentationSequence } from '../lib/presentation-sequence.mjs';
import { createSeedProject } from '../../../packages/presentation/contracts/studio-model.mjs';

test('partner trace keeps receiving past the limit and exports a visible boundary with complete events', () => {
  let trace = createPartnerTrace({ rolling: true });
  const events = Array.from({ length: 65 }, (_, index) => ({ type: 'deal', shoeDraw: index }));
  for (let version = 0; version < 650; version++) trace = appendPartnerTrace(trace, {
    source: 'native', kind: 'round', channel: 'configured-partner', time: '2026-09-25T22:00:00Z',
    data: { type: 'round', requestId: `round-${version}`, version, events },
  });
  assert.equal(trace.limited, false); assert.equal(trace.records.length, TRACE_RECORD_LIMIT);
  assert.equal(trace.records.at(-1).data.version, 649);
  assert.equal(trace.droppedRecords, 351);
  const exported = exportPartnerTrace(trace);
  assert.equal(exported.limits.mode, 'rolling'); assert.equal(exported.limits.droppedRecords, 351);
  assert.equal(exported.evidence.source, 'native popup observation');
  assert.equal(exported.records[0].data.gap, true);
  assert.equal(exported.records[0].data.previousVersionByChannel['configured-partner'], 350);
  assert.equal(exported.records[1].data.events.length, 65);
  const late = { source: 'native', kind: 'round', data: { type: 'round', requestId: 'late', version: 3, events: [{ type: 'idle' }] } };
  assert.deepEqual(buildPresentationSequence([exported.records[0], late], createSeedProject()).steps, []);
  const reset = restartPartnerTrace(trace);
  assert.equal(reset.rolling, true); assert.equal(reset.droppedRecords, 0);
  assert.equal(reset.records[0].data.previousVersionByChannel['configured-partner'], 649);
});

test('rolling observations respect the byte budget without clipping a retained payload', () => {
  let trace = createPartnerTrace({ rolling: true });
  for (let index = 0; index < 12; index++) trace = appendPartnerTrace(trace, { kind: 'chat', data: { index, text: 'x'.repeat(700000) } });
  assert.equal(trace.limited, false); assert.ok(trace.droppedRecords > 0);
  assert.ok(trace.bytes <= TRACE_BYTE_LIMIT);
  assert.equal(trace.bytes, trace.records.reduce((sum, record) => sum + new TextEncoder().encode(JSON.stringify(record)).length, 0));
  assert.equal(trace.records.at(-1).data.index, 11);
  for (const record of trace.records.slice(1)) assert.equal(record.data.text.length, 700000);
});

test('screen log collapses repeat idle loops but shows changed media, errors and return after speech', () => {
  const keep = createIdleLogFilter();
  const idle = (state, mediaId = 'idle-a') => ({ kind: 'playback', data: { event: 'idle', state, mediaId } });
  for (const state of ['start', 'presented', 'end']) assert.equal(keep(idle(state)), true);
  for (const state of ['start', 'presented', 'end']) assert.equal(keep(idle(state)), false);
  assert.equal(keep(idle('error')), true);
  assert.equal(keep(idle('start', 'idle-b')), true);
  assert.equal(keep({ kind: 'playback', data: { event: 'speech', state: 'start' } }), true);
  assert.equal(keep(idle('start', 'idle-b')), true);
  keep.reset();
  assert.equal(keep(idle('start', 'idle-b')), true);
});
