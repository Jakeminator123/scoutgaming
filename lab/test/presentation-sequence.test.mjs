import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPresentationSequence, SEQUENCE_STEP_LIMIT } from '../lib/presentation-sequence.mjs';
import { normalizeProject, buildRuntimeCatalog, DEALER_IDS, isDirectorSourceType } from '../lib/studio-model.mjs';
import { createLegacyProject } from './fixtures/legacy-project.mjs';
import { retireDemoExamples } from '../lib/retire-demo-examples.mjs';

import { prepareDecision } from '../../open-claw/lab/src/engine.mjs';
import { presentationEvents } from '../../web/partner-presentation.mjs';

// Explicit historical document: current seeds intentionally register only active dealers.
const historicalProject = () => normalizeProject(retireDemoExamples(createLegacyProject()));

const project = historicalProject();
const receipt = (events, extra = {}) => ({ id: 'connection:1', time: '2026-09-21T12:00:00.000Z', source: 'partner', kind: 'round',
  data: { type: 'round', requestId: 'round.start', version: 1, op: 'start', phase: 'decisions', events }, ...extra });
const sequence = records => buildPresentationSequence(records, project);

test('connection-only observations never generate a round or presentation', () => {
  const result = sequence([{ kind: 'status', source: 'partner', data: { state: 'connected', reason: 'no-replay', gap: true } }]);
  assert.deepEqual(result.steps, []);
  assert.equal(result.batchCount, 0);
  assert.equal(result.notices[0].kind, 'gap');
  assert.equal(result.receivedCount, 0);
});

test('every existing event groups identically to the real resolver for all four dealers', () => {
  const director = project.events.filter(node => isDirectorSourceType(node.sourceType));
  assert.equal(director.length, 16);
  assert.ok(project.events.some(node => node.id === 'transition.shoe'));
  const events = director.map(node => structuredClone(node.exampleEvent));
  const result = sequence([receipt(events)]);
  assert.deepEqual(result.steps.map(step => step.event), events);
  for (const dealerId of DEALER_IDS) {
    const catalog = buildRuntimeCatalog(project, dealerId);
    for (const step of result.steps) {
      const prepared = prepareDecision(catalog, { requestId: 'sequence.test', event: step.event });
      assert.equal(step.eventId, prepared.node.id);
      assert.equal(step.blocked, false);
      assert.equal(step.evidence, 'instruction');
      assert.equal(step.actualPlaybackCaptured, false);
    }
  }
});

test('real producer order, all seven boxes and exact hole-card/reveal instructions survive multiple commands', () => {
  const card = (r, shoeDraw) => ({ r, s: '♠', shoeDraw });
  const opening = { round: { phase: 'decisions', active: 3, holeDraw: 15, legalActions: ['hit', 'stand'], dealer: [card('6', 7)],
    hands: Array.from({ length: 7 }, (_, box) => ({ box, stake: 5, cards: [card('8', box), card('9', box + 8)] })) } };
  const settled = structuredClone(opening);
  settled.round.phase = 'settled'; settled.round.dealer.push(card('K', 15), card('8', 16));
  for (const hand of settled.round.hands) hand.result = 10;
  const startEvents = presentationEvents(null, opening, 'start');
  const endEvents = presentationEvents(opening, settled, 'act', { action: 'stand' });
  const collectEvents = presentationEvents(settled, { round: null }, 'collect');
  const records = [receipt(startEvents), receipt(endEvents, { id: 'connection:2', data: { type: 'round', requestId: 'round.stand', version: 2, events: endEvents } }),
    receipt(collectEvents, { id: 'connection:3', data: { type: 'round', requestId: 'round.collect', version: 3, events: collectEvents } })];
  const before = structuredClone(records); const result = sequence(records);
  assert.deepEqual(result.steps.map(step => step.event), [...startEvents, ...endEvents, ...collectEvents]);
  assert.deepEqual(result.steps.filter(step => step.event.to === 'box').slice(0, 7).map(step => step.event.box), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(result.steps.find(step => step.event.faceDown)?.event.card, null);
  assert.equal(result.steps.find(step => step.event.type === 'reveal')?.event.card.r, 'K');
  assert.equal(result.batchCount, 3, 'batches are commands, not fabricated complete round counts');
  assert.deepEqual(records, before);
});

test('response and SSE correlate and deduplicate despite different sources, IDs and JSON key order', () => {
  const events = [{ type: 'speak', line: 'goodluck', blocking: true }, { type: 'idle' }];
  const response = { id: 'response:1', time: '2026-09-21T11:59:59.999Z', source: 'partner-response', data: {
    requestId: 'round.start', version: 1, presentation: [{ blocking: true, line: 'goodluck', type: 'speak' }, { type: 'idle' }] } };
  const result = sequence([response, receipt(events)]);
  assert.equal(result.steps.length, 2);
  assert.equal(result.batchCount, 1);
  assert.equal(result.receivedCount, 2);
  assert.equal(result.duplicates, 2);
  assert.deepEqual(result.steps[0].deliveries.map(item => item.source), ['partner-response', 'partner']);
  assert.equal(result.steps[0].requestId, 'round.start');
  assert.equal(result.steps[0].version, 1);
  assert.equal(result.steps[1].presentationIndex, 1);
  assert.equal(result.steps[0].receivedAt, response.time);
});

test('same event at different indices, versions, requests or configured channels stays distinct', () => {
  const events = [{ type: 'idle' }, { type: 'idle' }];
  const first = receipt(events);
  const records = [first, { ...first, channel: 'other-player' }, receipt(events, { id: 'other-version', data: { ...first.data, version: 2 } }),
    receipt(events, { id: 'other-command', data: { ...first.data, requestId: 'another-command' } })];
  const result = sequence(records);
  assert.equal(result.steps.length, 8);
  assert.equal(result.duplicates, 0);
});

test('conflicting payloads under one correlation remain visible and block both replay alternatives', () => {
  const first = receipt([{ type: 'speak', line: 'goodluck' }]);
  const conflict = receipt([{ type: 'speak', line: 'double' }], { id: 'connection:2' });
  const result = sequence([first, conflict, first]);
  assert.equal(result.steps.length, 2);
  assert.equal(result.duplicates, 1);
  assert.ok(result.steps.every(step => step.blocked && step.issue.includes('olika innehåll')));
  assert.equal(result.notices[0].kind, 'conflict');
  assert.deepEqual(result.steps.map(step => step.event.line), ['goodluck', 'double']);
});

test('unknown, invalid and direction-inconsistent events are visible without an invented fallback node', () => {
  const deal = project.events.find(node => node.id === 'deal.player.left').exampleEvent;
  const result = sequence([receipt([{ type: 'show.native-only', clip: 'some-native-take' }, null, { ...deal, box: 6 }, { type: 'turn', box: 0, legalActions: [] }])]);
  assert.equal(result.steps.length, 4);
  assert.ok(result.steps.every(step => step.blocked && step.eventId === null && step.issue));
  assert.equal(result.steps[0].event.clip, 'some-native-take');
});

test('partial observations keep uncertainties and receipt order without sorting or manufacturing missing events', () => {
  const first = receipt([{ type: 'idle' }]);
  const records = [first, { ...first, id: 'third', data: { ...first.data, requestId: 'third', version: 3 } },
    { ...first, id: 'late', data: { ...first.data, requestId: 'second', version: 2 } },
    { source: 'partner-response', data: { presentation: [{ type: 'idle' }] } }, { data: { presentation: [{ type: 'idle' }] } }];
  const result = sequence(records);
  assert.deepEqual(result.steps.map(step => step.version), [1, 3, 2, null, null]);
  assert.ok(result.notices.some(notice => notice.kind === 'gap'));
  assert.match(result.steps[2].uncertainty.join(' '), /Lägre version/);
  assert.match(result.steps[3].uncertainty.join(' '), /Request-ID eller version saknas/);
  assert.match(result.steps[3].uncertainty.join(' '), /Mottagningstid saknas/);
});

test('full settlement facts stay separate from the selected editor group', () => {
  const event = { type: 'settle', dealerTotal: 24, dealerBlackjack: false, hands: [{ box: 0, outcome: 'blackjack', stake: 5, returned: 12.5 }, { box: 1, outcome: 'win', stake: 10, returned: 20 }] };
  const result = sequence([receipt([event])]);
  assert.equal(result.steps[0].eventId, 'settle.blackjack');
  assert.ok(result.steps[0].candidateEventIds.includes('settle.dealerBust'));
  assert.deepEqual(result.steps[0].sourceEvent, event);
});

test('hidden cards and credentials cannot leak through a preview or its data inspector', () => {
  const event = { ...project.events.find(node => node.id === 'deal.dealer').exampleEvent, card: { r: 'A', s: '♠' }, authorization: 'private',
    clipUrl: 'https://example.test/take.mp4?launch=sensitive#session' };
  const result = sequence([receipt([event], { origin: 'import' })]);
  assert.equal(result.steps[0].event.card, null);
  assert.equal(result.steps[0].event.authorization, '[dolt]');
  assert.equal(result.steps[0].event.clipUrl, 'https://example.test/take.mp4');
  assert.equal(result.steps[0].replay, true);
  assert.ok(result.steps[0].uncertainty.some(message => message.includes('faceDown')));
  assert.equal(event.card.r, 'A', 'source is never mutated');
});

test('bounded sequences expose their truncation and never silently replace malformed batches', () => {
  assert.equal(sequence([receipt(Array.from({ length: 257 }, () => ({ type: 'idle' })))]).steps.length, 0);
  const records = Array.from({ length: 17 }, (_, index) => receipt(Array.from({ length: 256 }, () => ({ type: 'idle' })), {
    id: `batch:${index}`, data: { type: 'round', requestId: `batch.${index}`, version: index, events: Array.from({ length: 256 }, () => ({ type: 'idle' })) } }));
  const result = sequence(records);
  assert.equal(result.steps.length, SEQUENCE_STEP_LIMIT);
  assert.equal(result.truncated, true);
  assert.ok(result.notices.some(notice => notice.kind === 'limit'));
});
