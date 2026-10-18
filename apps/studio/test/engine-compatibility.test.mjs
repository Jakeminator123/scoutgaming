import assert from 'node:assert/strict';
import test from 'node:test';
import { presentationEvents } from '../../../services/game/partner-presentation.mjs';
import { prepareDecision, finalizeDecision } from '../../../packages/director/engine.mjs';
import { normalizeProject, buildRuntimeCatalog, validateProject, DEALER_IDS } from '../../../packages/presentation/contracts/studio-model.mjs';
import { createLegacyProject } from './fixtures/legacy-project.mjs';

// Explicit historical document: current seeds intentionally register only active dealers.
const historicalProject = () => normalizeProject(createLegacyProject());

// Exercise the real presentation producer against synthetic PUBLIC views.
// No RNG, player database, model, network, media bytes or saved project is used.
const card = (r, s, shoeDraw) => ({ r, s, shoeDraw });
const clone = value => structuredClone(value);
const catalogs = DEALER_IDS.map(id => buildRuntimeCatalog(historicalProject(), id));

function opening() {
  return { round: {
    phase: 'decisions', holeDraw: 15, active: 3,
    legalActions: ['hit', 'stand', 'double', 'split'],
    dealer: [card('6', '♠', 7)],
    hands: Array.from({ length: 7 }, (_, box) => ({
      box, stake: 5, cards: [card('8', '♣', box), card('9', '♥', box + 8)]
    }))
  } };
}

// This explicit expected projection is independent of normalizeInput().
// It must preserve public presentation facts while omitting money and hints
// that the bounded director does not need. It does not approve a video.
function expectedProjection(event) {
  if (event.type === 'deal') return {
    type: 'deal', to: event.to, faceDown: event.faceDown,
    box: event.box, handIndex: event.handIndex,
    clip: { action: event.clip.action }, card: event.faceDown ? null : clone(event.card),
    shoeDraw: event.shoeDraw
  };
  if (event.type === 'settle') return {
    type: 'settle', dealerTotal: event.dealerTotal, dealerBlackjack: event.dealerBlackjack,
    hands: event.hands.map(({ box, outcome }) => ({ box, outcome }))
  };
  return clone(event);
}

function assertDecisionsPreserve(events, catalog = catalogs[0]) {
  const before = clone(events);
  const results = events.map((event, index) => {
    const prepared = prepareDecision(catalog, {
      requestId: `compatibility.${index}`, event,
      context: { chat: { signal: 'praise' }, playerHistory: { returning: true, preferredLanguage: 'de' } }
    });
    const advice = {
      requestId: prepared.requestId, catalogRevision: prepared.catalogRevision,
      variantId: prepared.eligible[0].id
    };
    for (const mode of ['off', 'shadow', 'active']) {
      const result = finalizeDecision(prepared, advice, mode);
      assert.deepEqual(result.event, expectedProjection(event), `${mode}: ${event.type}`);
      assert.equal(result.gate.accepted, mode === 'active');
      if (mode !== 'active') assert.equal(result.selected.id, prepared.baseline.id);
    }
    return prepared;
  });
  assert.deepEqual(events, before, 'presentation[] must not be mutated');
  assert.deepEqual(results.map(result => result.event.type), events.map(event => event.type), 'source order remains unchanged');
  return results;
}

test('real start projection keeps seven boxes, shoe order, hidden card and all four dealer catalogues', () => {
  const view = opening(), before = clone(view);
  const events = presentationEvents(null, view, 'start');
  assert.deepEqual(events.map(event => event.type), ['speak', ...Array(16).fill('deal'), 'turn']);
  assert.deepEqual(events[0], { type: 'speak', line: 'goodluck', blocking: true });
  const deals = events.filter(event => event.type === 'deal');
  assert.deepEqual(deals.map(event => event.shoeDraw), Array.from({ length: 16 }, (_, i) => i));
  const directions = ['deal-left', 'deal-left', 'deal-centre', 'deal-centre', 'deal-centre', 'deal-right', 'deal-right'];
  assert.deepEqual(deals.slice(0, 7).map(event => event.clip.action), directions);
  assert.deepEqual(deals.slice(0, 7).map(event => event.box), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(deals.at(-1).card, null);
  assert.equal(deals.at(-1).faceDown, true);
  for (const catalog of catalogs) {
    const mapped = assertDecisionsPreserve(events, catalog);
    assert.equal(mapped[0].node.id, 'speak.goodluck');
    assert.equal(mapped.at(-1).node.id, 'turn.player');
    assert.deepEqual(mapped.at(-1).event.legalActions, view.round.legalActions);
    assert.ok(mapped.every(item => !item.node.id.startsWith('unmapped.')));
  }
  assert.deepEqual(view, before, 'the producer and lab must not change the public view');
});

test('insurance, accepted double and collect keep distinct authoritative speech and event order', () => {
  const original = opening();
  const insured = clone(original); insured.round.phase = 'insurance';
  const insurance = presentationEvents(original, insured, 'insurance');
  assert.deepEqual(insurance, [{ type: 'speak', line: 'insurance' }]);
  assert.equal(assertDecisionsPreserve(insurance)[0].node.id, 'speak.insurance');

  const doubled = clone(original);
  doubled.round.hands[3].cards.push(card('2', '♦', 16));
  doubled.round.hands[3].stake = 10;
  const double = presentationEvents(original, doubled, 'act', { action: 'double' });
  assert.deepEqual(double.map(event => event.type), ['deal', 'speak', 'turn']);
  assert.equal(double[1].line, 'double');
  assert.deepEqual(assertDecisionsPreserve(double).map(item => item.node.id), ['deal.player.centre', 'speak.double', 'turn.player']);

  const collect = presentationEvents(doubled, { round: null }, 'collect');
  assert.deepEqual(collect, [{ type: 'speak', line: 'placebets' }, { type: 'idle' }]);
  assert.deepEqual(assertDecisionsPreserve(collect).map(item => item.node.id), ['speak.other', 'idle.ready']);
});

test('settlement reveals the existing hole card once, before fresh deal and separate settle/speak', () => {
  const original = opening(), settled = clone(original);
  settled.round.phase = 'settled';
  settled.round.dealer.push(card('K', '♠', 15), card('5', '♦', 16));
  for (const hand of settled.round.hands) hand.result = 0;
  const events = presentationEvents(original, settled, 'act', { action: 'stand' });
  assert.deepEqual(events.map(event => event.type), ['reveal', 'deal', 'settle', 'speak']);
  assert.equal(events[0].shoeDraw, 15);
  assert.deepEqual(events[0].card, { r: 'K', s: '♠' });
  assert.equal(events.filter(event => event.type === 'deal' && event.shoeDraw === 15).length, 0);
  assert.equal(events[1].shoeDraw, 16);
  const mapped = assertDecisionsPreserve(events);
  assert.deepEqual(mapped.map(item => item.node.id), ['reveal.dealer', 'deal.dealer', 'settle.other', 'speak.other']);
  assert.equal(mapped.at(-1).event.line, 'lose');
  assert.ok(events[2].hands.every(hand => Object.hasOwn(hand, 'stake') && Object.hasOwn(hand, 'returned')));
  assert.ok(mapped[2].event.hands.every(hand => !Object.hasOwn(hand, 'stake') && !Object.hasOwn(hand, 'returned')));
});

const resultCases = [
  { name: 'dealer blackjack with natural push', dealer: ['A', 'K'], hands: [{ ranks: ['A', 'K'], result: 5 }], node: 'settle.push', line: 'dealerblackjack' },
  { name: 'mixed winning and losing hands', dealer: ['10', '8'], hands: [{ ranks: ['10', 'K'], result: 10 }, { ranks: ['6', '7'], result: 0 }], node: 'settle.win', line: 'win' },
  // This verifies producer/projection behavior for a supplied public view,
  // not that every such view is reachable from the real blackjack engine.
  { name: 'dealer bust with only already busted losing hand', dealer: ['10', '8', '5'], hands: [{ ranks: ['10', 'K', '4'], result: 0, busted: true }], node: 'settle.dealerBust', line: 'lose' },
  { name: 'dealer bust with a winning hand', dealer: ['10', '8', '5'], hands: [{ ranks: ['10', 'K'], result: 10 }], node: 'settle.dealerBust', line: 'dealerbust' },
  { name: 'player natural', dealer: ['10', '8'], hands: [{ ranks: ['A', 'K'], result: 12.5 }], node: 'settle.blackjack', line: 'blackjack' },
  { name: 'all pushes', dealer: ['10', '8'], hands: [{ ranks: ['10', '8'], result: 5 }], node: 'settle.push', line: 'push' },
  { name: 'push mixed with loss', dealer: ['10', '8'], hands: [{ ranks: ['10', '8'], result: 5 }, { ranks: ['6', '7'], result: 0 }], node: 'settle.other', line: 'lose' },
  { name: 'empty public result list', dealer: ['10', '8'], hands: [], node: 'settle.other', line: 'lose' }
];

for (const scenario of resultCases) test(`semantic grouping never rewrites the producer's speech: ${scenario.name}`, () => {
  const round = {
    phase: 'settled', holeDraw: 1,
    dealer: scenario.dealer.map((rank, i) => card(rank, '♠', i)),
    hands: scenario.hands.map((hand, box) => ({
      box, stake: 5, result: hand.result, ...(hand.busted && { busted: true }),
      cards: hand.ranks.map((rank, i) => card(rank, '♥', 10 + box * 4 + i))
    }))
  };
  const previous = { round: { ...clone(round), phase: 'decisions' } };
  const view = { round }, untouched = clone(view);
  const events = presentationEvents(previous, view, 'act', { action: 'stand' });
  assert.deepEqual(events.map(event => event.type), ['settle', 'speak']);
  assert.equal(events[1].line, scenario.line);
  for (const catalog of catalogs) {
    const mapped = assertDecisionsPreserve(events, catalog);
    assert.equal(mapped[0].node.id, scenario.node);
    assert.equal(mapped[1].node.id, 'speak.other');
    assert.equal(mapped[1].event.line, scenario.line);
  }
  assert.deepEqual(view, untouched);
});

test('illustration binding cannot reverse a deal direction or replace a reveal', () => {
  for (const [eventId, wrongAssetId] of [
    ['deal.player.left', 'deal.player.right.standard'],
    ['deal.dealer', 'deal.player.centre.standard'],
    ['reveal.dealer', 'idle.ready.standard']
  ]) {
    const project = historicalProject();
    const line = project.lines.find(item => item.dealerId === 'astrid' && item.eventId === eventId);
    line.variants.find(item => item.id === line.baselineVariantId).assetId = wrongAssetId;
    assert.throws(() => validateProject(project), /delningsriktning|kortvändning/);
  }
});
