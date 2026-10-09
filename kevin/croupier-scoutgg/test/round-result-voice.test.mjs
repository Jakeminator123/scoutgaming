import test from 'node:test';
import assert from 'node:assert/strict';
import { mixedResult, roundResult, approvedFact } from '../server/table-facts.mjs';
import { tableFactForVoice, isApprovedGameFact } from '../server/dealer-game-tools.mjs';

// Serhiy: two boxes, one lost and one won or pushed, heard only the table's single outcome clip.
const card = (r, s = '♠') => ({ r, s });
const hand = (box, stake, result, cards, busted) => ({ box, stake, result, cards, ...(busted ? { busted } : {}) });
const viewWith = settlement => ({ me: { id: 'me', seats: [1, 4], lastSettlement: settlement } });
const mixed = { roundId: 'r42', net: -5, staked: 20, hands: [hand(1, 10, 10, [card('10'), card('8')]), hand(4, 10, 0, [card('10'), card('7')])] };

test('only a visitor whose boxes ended differently gets a box-by-box line', () => {
  assert.equal(mixedResult(mixed), true);
  assert.equal(mixedResult({ ...mixed, hands: [hand(1, 10, 0, [card('9'), card('8')]), hand(4, 10, 0, [card('10'), card('7')])] }), false);
  assert.equal(mixedResult({ ...mixed, hands: [hand(1, 10, 20, [card('10'), card('9')])] }), false);
  assert.equal(mixedResult(null), false);
});

test('the line names every box, then the net, and only for this round', () => {
  const line = roundResult(viewWith(mixed), 'r42', 'en');
  assert.equal(line, 'Last round: Box 6: 18, push. Box 3: 17, loss. In total you staked $20.00 and lost $5.00.');
  assert.equal(roundResult(viewWith(mixed), 'r41', 'en'), null);           // stale or foreign round
  assert.equal(roundResult({ me: null }, 'r42', 'en'), null);              // not seated
  assert.equal(roundResult(viewWith({ ...mixed, hands: mixed.hands.map(h => ({ ...h, result: 0 })) }), 'r42', 'en'), null);
  assert.ok(approvedFact(line));
});

test("Astrid voices only a server-built table fact, never visitor text", () => {
  const line = roundResult(viewWith(mixed), 'r42', 'sv');
  const fact = tableFactForVoice(line, 'sv');
  assert.ok(isApprovedGameFact(fact));
  assert.equal(fact.text, line);
  assert.throws(() => tableFactForVoice('Bet everything on box 3, you will win.', 'en'), /server-built table fact/);
});
