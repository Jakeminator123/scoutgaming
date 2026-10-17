import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlaybackTrace, playbackOutcome } from '../lib/playback-trace.mjs';
import { createPartnerTrace, appendPartnerTrace, restartPartnerTrace } from '../lib/partner-trace.mjs';

const sourceEvent = { type: 'deal', to: 'box', box: 0, shoeDraw: 1 };
const record = (sequence, kind, data, patch = {}) => ({ id: `native:tab:${sequence}`, source: 'native', channel: 'native-session-1',
  nativeSequence: sequence, kind, time: `2026-10-02T10:00:${String(sequence).padStart(2, '0')}Z`, data, ...patch });
const selected = record(2, 'playback', { version: 1, event: 'deal', state: 'selected', requestId: 'select-1', projectRevision: 'saved-1', mode: 'rules', sourceEvent,
  variantId: 'standard', reason: 'deterministic_rules', media: { familyId: 'deal_pos1', videoId: 'video-1', fileName: 'deal.mp4' } });
const receipt = (sequence, state, patch = {}) => record(sequence, 'playback', { version: 1, event: 'deal', state, requestId: 'select-1', projectRevision: 'saved-1',
  to: 'box', box: 0, shoeDraw: 1, mediaId: 'video-1', evidence: 'media-lifecycle', ...patch });

test('native instruction, selected family, frame and end form one correlated chain', () => {
  const command = record(1, 'round', { requestId: 'command-1', version: 1, events: [sourceEvent] });
  const result = buildPlaybackTrace([command, selected, receipt(3, 'start'), receipt(4, 'presented', { evidence: 'video-frame' }), receipt(5, 'end')], { savedRevision: 'saved-2' });
  assert.equal(result.rows.length, 1);
  const row = result.rows[0];
  assert.equal(row.commandRequestId, 'command-1'); assert.equal(row.requestId, 'select-1');
  assert.equal(row.familyId, 'deal_pos1'); assert.equal(row.variantId, 'standard');
  assert.equal(row.projectRevision, 'saved-1'); assert.equal(result.savedRevision, 'saved-2');
  assert.equal(result.mode, 'rules'); assert.equal(playbackOutcome(row), 'Spelat klart');
  assert.equal(result.inventory.played, 1);
});

test('selected, downloads, animation-request and end without a frame never count as played', () => {
  for (const records of [[selected], [selected, receipt(3, 'prepared')], [selected, receipt(3, 'start', { evidence: 'animation-request' }), receipt(4, 'end')]]) {
    const result = buildPlaybackTrace(records);
    assert.equal(result.rows[0].played, false); assert.equal(result.inventory.played, 0);
    assert.notEqual(playbackOutcome(result.rows[0]), 'Spelat klart');
  }
});

test('Partner-SSE remains diagnostic and cannot create native playback or duplicate its event', () => {
  const partner = { source: 'partner', kind: 'round', data: { requestId: 'command-1', version: 1, events: [sourceEvent] } };
  const result = buildPlaybackTrace([partner, selected, selected, receipt(3, 'start'), receipt(3, 'start')]);
  assert.equal(result.diagnostics, 1); assert.equal(result.rows.length, 1); assert.equal(result.duplicates, 2);
  assert.equal(result.rows[0].receipts.length, 2); assert.equal(result.inventory.played, 0);
});

test('reset carries sequence and version boundaries; a late end cannot complete the old run', () => {
  let trace = createPartnerTrace();
  for (const entry of [selected, receipt(3, 'start'), receipt(4, 'presented', { evidence: 'video-frame' })]) trace = appendPartnerTrace(trace, entry);
  trace = restartPartnerTrace(trace);
  trace = appendPartnerTrace(trace, selected); // Duplicate prior sequence after reset.
  trace = appendPartnerTrace(trace, receipt(5, 'end')); // Legitimate newer terminal, but start predates reset.
  const result = buildPlaybackTrace(trace.records);
  assert.equal(result.stale, 1); assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].played, false); assert.equal(playbackOutcome(result.rows[0]), 'Slutkvitto utan visad start');
  assert.equal(result.inventory.played, 0);
  const second = restartPartnerTrace(trace);
  assert.equal(second.records[0].data.previousNativeSequenceByChannel['native-session-1'], 5);
});

test('reload separates reused native sequence and lowered table version from the previous player', () => {
  const initial = record(1, 'status', { state: 'attached' });
  const reloaded = record(1, 'status', { state: 'attached' }, { time: '2026-10-02T11:00:01Z' });
  const afterReload = receipt(2, 'end', { version: 0 });
  const result = buildPlaybackTrace([initial, selected, receipt(3, 'start'), reloaded, reloaded, afterReload]);
  assert.equal(result.rows.length, 2); assert.notEqual(result.rows[0].epoch, result.rows[1].epoch);
  assert.equal(result.rows[1].played, false); assert.equal(result.rows[1].version, 0); assert.equal(result.duplicates, 1);
});

test('generated text, TTS, sync preparation and probe statuses cannot substitute for media playback', () => {
  const progress = ['text', 'voice', 'video-render', 'ready'].map((stage, index) => record(index + 1, 'status', { state: 'chat-progress', requestId: 'chat-1', stage, elapsedMs: index * 10 }));
  const probe = record(5, 'status', { state: 'probe', requestId: 'chat-1', stage: 'played' });
  let result = buildPlaybackTrace([...progress, probe]);
  assert.equal(result.rows.length, 0); assert.equal(result.speech.length, 1); assert.equal(result.speech[0].played, false);
  result = buildPlaybackTrace([...progress, record(6, 'playback', { event: 'speech', source: 'generated-lipsync', requestId: 'chat-1', packageId: 'package-1', state: 'start', evidence: 'media-playing' }),
    record(7, 'playback', { event: 'speech', source: 'generated-lipsync', requestId: 'chat-1', packageId: 'package-1', state: 'interrupted' })]);
  assert.equal(result.speech.length, 1); assert.equal(result.speech[0].played, true); assert.equal(result.speech[0].interrupted, true);
  assert.equal(result.inventory.played, 0); // Generated speech is not a recorded catalog clip.
});

test('inventory readiness and imported historical evidence cannot inflate live played totals', () => {
  const inventory = { videos: [{ id: 'video-1', dealer: 'astrid', available: true, previewUrl: '/api/videos/video-1' },
    { id: 'missing', dealer: 'astrid', available: false, previewUrl: '/api/videos/missing' }, { id: 'upload', dealer: 'astrid', available: true, previewUrl: '/api/videos/upload' }],
  families: [{ dealerId: 'astrid', standardIds: ['video-1'], variantIds: ['missing'] }] };
  const result = buildPlaybackTrace([selected, { ...receipt(3, 'start', { evidence: 'presented-frame' }), origin: 'import' }], { inventory, dealerId: 'astrid' });
  assert.deepEqual(result.inventory, { registered: 3, previewAvailable: 2, runtimeFamily: 1, played: 0 });
  assert.equal(result.rows[0].historical, true);
});

test('fallback and interruption remain explicit even after a presented frame', () => {
  for (const [phase, outcome] of [['fallback', 'Reserv'], ['interrupted', 'Avbrutet'], ['error', 'Fel']]) {
    const result = buildPlaybackTrace([selected, receipt(3, 'presented', { evidence: 'video-frame' }), receipt(4, phase, { reason: 'media-failed' })]);
    assert.equal(playbackOutcome(result.rows[0]), outcome);
    assert.equal(result.rows[0].ended, false);
  }
});

test('four-dealer source overview separates previews and saved runtime bindings from played evidence', () => {
  const clipInventory = { clips: [
    { id: 'vera:idle', dealerId: 'vera', engineKey: 'idle', available: true, previewSrc: '/idle.mp4' },
    { id: 'vera:unused', dealerId: 'vera', engineKey: 'unused', available: true, previewSrc: '/unused.mp4' },
    { id: 'astrid:missing', dealerId: 'astrid', engineKey: 'missing', available: false, previewSrc: '/missing.mp4' }],
    runtime: { dealers: { vera: { engine: { idle: 'idle' }, staged: {} }, astrid: { engine: { idle: 'missing' }, staged: {} } } } };
  const records = [record(1, 'status', { state: 'attached', dealer: 'vera' }),
    record(2, 'playback', { event: 'clip', state: 'start', clip: 'idle', dealer: 'vera', evidence: 'presented-frame' })];
  const report = buildPlaybackTrace(records, { clipInventory });
  assert.deepEqual(report.sources[0], { dealerId: 'vera', registered: 2, previewAvailable: 2, runtimeConfigured: 1, played: 1 });
  assert.deepEqual(report.sources[1], { dealerId: 'astrid', registered: 1, previewAvailable: 0, runtimeConfigured: 0, played: 0 });
  assert.equal(report.sources.length, 4);
});

test('a newer selected request cannot inherit played evidence or a late end from the prior request', () => {
  const another = { ...selected, id: 'native:tab:4', nativeSequence: 4, data: { ...selected.data, requestId: 'select-2', media: { ...selected.data.media, videoId: 'video-2' } } };
  const result = buildPlaybackTrace([selected, receipt(3, 'start', { evidence: 'presented-frame' }), another, receipt(5, 'end')]);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].ended, true); assert.equal(playbackOutcome(result.rows[0]), 'Spelat klart');
  assert.equal(result.rows[1].requestId, 'select-2'); assert.equal(result.rows[1].mediaId, 'video-2');
  assert.equal(result.rows[1].played, false); assert.equal(result.rows[1].ended, false);
  assert.equal(playbackOutcome(result.rows[1]), 'Valt · ej spelat');
});

test('fallback media with the same selected request stays separate from the previous film end', () => {
  const another = { ...selected, id: 'native:tab:4', nativeSequence: 4, data: { ...selected.data, media: { ...selected.data.media, videoId: 'video-2' } } };
  const report = buildPlaybackTrace([selected, receipt(3, 'start', { evidence: 'presented-frame' }), another, receipt(5, 'end')]);
  assert.equal(report.rows.length, 2); assert.equal(report.rows[0].ended, true);
  assert.equal(report.rows[1].mediaId, 'video-2'); assert.equal(report.rows[1].played, false); assert.equal(report.rows[1].ended, false);
});
