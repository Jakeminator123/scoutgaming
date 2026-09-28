import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptNativeObservation } from '../lib/native-observation.mjs';
import { buildPresentationSequence } from '../lib/presentation-sequence.mjs';
import { observationContext, observedTable } from '../lib/observation-context.mjs';
import { createSeedProject } from '../lib/studio-model.mjs';
import { createPartnerTrace, appendPartnerTrace, exportPartnerTrace, restartPartnerTrace } from '../lib/partner-trace.mjs';
import { SPEECH_POSE_STAGES } from '../../web/public/speech-pose-gate.mjs';

const source = {}, expected = { source, origin: 'https://bettalotto.se', channel: 'fixture-channel', lastSequence: 0 };
const project = createSeedProject();
const presentation = [{ type: 'speak', line: 'goodluck' }, { type: 'idle' }];
const message = (kind = 'command', payload = { requestId: 'r1', op: 'start', view: { version: 1, round: null }, presentation }) => ({ source, origin: expected.origin,
  data: { type: 'croupier-native-observation', version: 1, channel: expected.channel, sequence: 1, at: '2026-09-22T12:00:00Z', kind, payload } });

test('Probe decisions and played receipts survive the native observer as separate records',()=>{
  for(const stage of ['decision','played','failed']){
    const record=acceptNativeObservation(message('status',{state:'probe',stage,requestId:'probe-1',reason:'no_memory'}),expected);
    assert.equal(record.data.stage,stage);assert.equal(record.data.gap,false);assert.equal(record.kind,'status');
  }
  assert.equal(acceptNativeObservation(message('status',{state:'probe',stage:'invented',requestId:'probe-1'}),expected),null);
});

test('native messages require exact popup, configured origin, channel and monotonic sequence', () => {
  const good = message(); assert.ok(acceptNativeObservation(good, expected));
  for (const bad of [{ ...good, source: {} }, { ...good, origin: 'https://evil.test' }, { ...good, data: { ...good.data, channel: 'wrong' } },
    { ...good, data: { ...good.data, sequence: -1 } }, { ...good, data: { ...good.data, kind: 'execute' } },
    { ...good, data: { ...good.data, at: 'invalid' } }]) assert.equal(acceptNativeObservation(bad, expected), null);
  assert.equal(acceptNativeObservation(good, { ...expected, lastSequence: 1 }), null);
  assert.ok(acceptNativeObservation(message('status', { state: 'attached' }), { ...expected, lastSequence: 100 }));
});

test('oversize and malformed commands are discarded; credentials and signed addresses are redacted', () => {
  assert.equal(acceptNativeObservation(message('chat', { text: 'x'.repeat(300000) }), expected), null);
  assert.equal(acceptNativeObservation(message('command', { requestId: 'r1', op: 'start', view: {}, presentation }), expected), null);
  const result = acceptNativeObservation(message('playback', { state: 'selected', token: 'private', src: 'https://bettalotto.se/a.mp4?secret=hidden' }), expected);
  assert.equal(result.data.token, '[dolt]'); assert.equal(result.data.src, 'https://bettalotto.se/a.mp4');
});

test('bounded pose diagnostics keep the native sequence contiguous without inventing game events or playback', () => {
  const connection = { ...expected };
  const records = [];
  const payloads = [{ kind: 'status', payload: { state: 'attached' } },
    ...SPEECH_POSE_STAGES.map(stage => ({ kind: 'status', payload: { state: 'chat-pose', jobId: 'chat:job.1', stage, at: 1234,
      gap: true, events: [{ type: 'idle' }], actualPlaybackCaptured: true, token: 'PRIVATE' } })),
    { kind: 'command', payload: { requestId: 's1', op: 'state', view: { version: 0, round: null }, presentation: [] } }];
  for (const [index, entry] of payloads.entries()) {
    const incoming = message(entry.kind, entry.payload); incoming.data.sequence = index + 1;
    const accepted = acceptNativeObservation(incoming, connection);
    assert.ok(accepted, `${entry.kind}/${entry.payload.stage ?? entry.payload.state ?? entry.payload.op}`);
    assert.equal(accepted.nativeSequence, connection.lastSequence + 1);
    connection.lastSequence = accepted.nativeSequence;
    assert.equal(accepted.actualPlaybackCaptured, false);
    if (entry.payload.state === 'chat-pose') assert.deepEqual(accepted.data,
      { state: 'chat-pose', jobId: 'chat:job.1', stage: entry.payload.stage, at: 1234, gap: false });
    records.push(accepted);
  }
  const sequence = buildPresentationSequence(records, project);
  assert.deepEqual(sequence.steps, []);
  assert.ok(sequence.notices.every(notice => notice.kind === 'connection'));
  let trace = createPartnerTrace(); for (const record of records) trace = appendPartnerTrace(trace, record);
  assert.equal(exportPartnerTrace(trace).evidence.actualVideoPlaybackCaptured, false);
});

test('unknown or malformed pose statuses remain rejected and cannot reset the native sequence', () => {
  const pose = { state: 'chat-pose', jobId: 'chat.1', stage: 'speech-completed', at: 1234 };
  for (const patch of [{ state: 'unknown' }, { stage: 'execute' }, { jobId: '' }, { jobId: 'x'.repeat(129) },
    { jobId: '../unsafe' }, { at: undefined }, { at: '1234' }, { at: -1 }, { at: Infinity }, { at: 1.5 }]) {
    assert.equal(acceptNativeObservation(message('status', { ...pose, ...patch }), expected), null);
  }
  assert.equal(acceptNativeObservation(message('status', pose), { ...expected, lastSequence: 1 }), null);
  assert.equal(acceptNativeObservation(message('status', pose), { ...expected, lastSequence: 100 }), null);
  assert.ok(acceptNativeObservation(message('status', { state: 'attached' }), { ...expected, lastSequence: 100 }));
});

test('chat progress keeps only bounded timing fields and never claims media playback', () => {
  const progress = { state: 'chat-progress', requestId: 'chat.1', stage: 'video-render', elapsedMs: 1234 };
  const accepted = acceptNativeObservation(message('status', { ...progress, token: 'PRIVATE', events: [{ type: 'deal' }], actualPlaybackCaptured: true }), expected);
  assert.deepEqual(accepted.data, { ...progress, gap: false });
  assert.equal(accepted.actualPlaybackCaptured, false);
  for (const patch of [{ stage: 'execute' }, { requestId: '../bad' }, { elapsedMs: -1 }, { elapsedMs: Infinity }, { elapsedMs: '3' }]) {
    assert.equal(acceptNativeObservation(message('status', { ...progress, ...patch }), expected), null);
  }
  const failure = { state: 'chat-failed', requestId: 'chat.1', reason: 'generated_speech_timeout' };
  assert.deepEqual(acceptNativeObservation(message('status', failure), expected).data, { ...failure, gap: false });
});

test('native and SSE instructions deduplicate; playback, chat and state never become extra game events', () => {
  const native = acceptNativeObservation(message(), expected);
  const records = [{ source: 'partner', kind: 'round', time: native.time, data: { type: 'round', requestId: 'r1', version: 1, events: presentation } }, native,
    acceptNativeObservation(message('playback', { state: 'start', event: 'speech' }), expected),
    acceptNativeObservation(message('chat', { role: 'user', text: 'Hej' }), expected),
    acceptNativeObservation(message('command', { requestId: 's1', op: 'state', view: { version: 1, round: null }, presentation: [] }), expected)];
  const sequence = buildPresentationSequence(records, project);
  assert.equal(sequence.steps.length, 2); assert.equal(sequence.duplicates, 2); assert.deepEqual(sequence.notices, []);
  let trace = createPartnerTrace(); for (const record of records) trace = appendPartnerTrace(trace, record);
  assert.equal(exportPartnerTrace(trace).evidence.actualVideoPlaybackCaptured, true);
});

test('settlement context counts once, excludes future records and resets at gaps', () => {
  const settle = { type: 'settle', dealerTotal: 21, dealerBlackjack: false, hands: [{ box: 3, outcome: 'lose' }] };
  const round = (events, version) => ({ source: 'partner', kind: 'round', time: '2026-09-22T12:00:00Z', data: { type: 'round', requestId: `r${version}`, version, events } });
  const records = [round([settle, { type: 'speak', line: 'lose' }], 1), round([settle, { type: 'speak', line: 'lose' }], 1),
    { source: 'native', kind: 'chat', data: { text: 'a future message', signal: 'praise' } },
    { kind: 'status', data: { state: 'disconnected', gap: true } }, round([{ type: 'idle' }], 2)];
  const sequence = buildPresentationSequence(records, project);
  const before = observationContext(sequence, sequence.steps[1], records);
  assert.deepEqual(before.context.session, { recentWins: 0, recentLosses: 1 });
  assert.equal(before.context.chat.signal, 'none'); assert.equal(before.evidence.chatMessagesObserved, 0);
  const after = observationContext(sequence, sequence.steps.at(-1), records);
  assert.deepEqual(after.context.session, { recentWins: 0, recentLosses: 0 }); assert.equal(after.evidence.gapBefore, true);
});

test('table prefers authoritative public snapshot and never invents hidden card identities', () => {
  const view = { version: 5, round: { dealer: [{ r: 'A', s: '♠', shoeDraw: 1 }], holeDraw: 4, hands: [{ box: 3, cards: [{ r: '7', s: '♥' }] }] } };
  const native = acceptNativeObservation(message('command', { requestId: 'r5', op: 'state', view, presentation: [] }), expected);
  const table = observedTable([native], buildPresentationSequence([native], project));
  assert.equal(table.partial, false); assert.deepEqual(table.round, view.round); assert.equal(table.round.holeCard, undefined);
  const events = [{ type: 'deal', to: 'dealer', box: null, handIndex: null, faceDown: true, shoeDraw: 4, card: { r: 'K', s: '♥' }, clip: { action: 'deal-dealer' } }];
  const sequence = buildPresentationSequence([{ data: { type: 'round', requestId: 'r1', version: 1, op: 'start', events } }], project);
  const partial = observedTable([], sequence);
  assert.equal(partial.partial, true); assert.equal(partial.round.dealer[0].r, undefined);
});

test('chat context uses only bounded received messages preceding the event, never later chat or history fields', () => {
  const earlier = { source: 'native', kind: 'chat', time: '2026-09-22T11:59:00Z', data: { role: 'user', text: 'Hej'.repeat(300), playerId: 'PRIVATE_ID' } };
  const native = acceptNativeObservation(message(), expected);
  const later = { ...earlier, time: '2026-09-22T12:01:00Z', data: { role: 'assistant', text: 'Future reply' } };
  const records = [earlier, native, later];
  const sequence = buildPresentationSequence(records, project);
  const context = observationContext(sequence, sequence.steps[0], records).context;
  assert.equal(context.observedChat.messages.length, 1);
  assert.equal(context.observedChat.messages[0].text.length, 600);
  assert.equal(context.observedChat.before, native.time);
  assert.ok(!JSON.stringify(context).includes('PRIVATE_ID'));
  assert.ok(!JSON.stringify(context).includes('Future reply'));
});

test('explicit reset exports a visible history boundary and reopens capacity without retaining old conversation data', () => {
  const old = appendPartnerTrace(createPartnerTrace(), { source: 'native', kind: 'round', data: { version: 4, events: [], text: 'OLD_PRIVATE_CHAT' } });
  old.limited = true;
  const reset = restartPartnerTrace(old, { time: '2026-09-22T12:00:00Z', observedVersions: { 'configured-partner': 6 } });
  assert.equal(reset.limited, false); assert.equal(reset.records.length, 1);
  assert.equal(reset.records[0].data.state, 'observation-reset');
  assert.equal(reset.records[0].data.discardedRecords, 1);
  assert.equal(reset.records[0].data.previousLimited, true);
  assert.equal(reset.records[0].data.previousVersionByChannel['configured-partner'], 6);
  assert.equal(restartPartnerTrace(reset).records[0].data.previousVersionByChannel['configured-partner'], 6);
  const after = appendPartnerTrace(reset, { source: 'native', kind: 'chat', time: '2026-09-22T12:01:00Z', data: { role: 'user', text: 'NEW_CHAT' } });
  const exported = exportPartnerTrace(after);
  assert.equal(exported.records.length, 2); assert.equal(exported.limits.reached, false);
  assert.ok(JSON.stringify(exported).includes('NEW_CHAT'));
  assert.ok(!JSON.stringify(exported).includes('OLD_PRIVATE_CHAT'));
  assert.equal(old.records[0].data.text, 'OLD_PRIVATE_CHAT');
});
