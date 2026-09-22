import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptNativeObservation } from '../lib/native-observation.mjs';
import { buildPresentationSequence } from '../lib/presentation-sequence.mjs';
import { observationContext, observedTable } from '../lib/observation-context.mjs';
import { createSeedProject } from '../lib/studio-model.mjs';
import { createPartnerTrace, appendPartnerTrace, exportPartnerTrace, restartPartnerTrace } from '../lib/partner-trace.mjs';

const source = {}, expected = { source, origin: 'https://bettalotto.se', channel: 'fixture-channel', lastSequence: 0 };
const project = createSeedProject();
const presentation = [{ type: 'speak', line: 'goodluck' }, { type: 'idle' }];
const message = (kind = 'command', payload = { requestId: 'r1', op: 'start', view: { version: 1, round: null }, presentation }) => ({ source, origin: expected.origin,
  data: { type: 'croupier-native-observation', version: 1, channel: expected.channel, sequence: 1, at: '2026-09-22T12:00:00Z', kind, payload } });

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
