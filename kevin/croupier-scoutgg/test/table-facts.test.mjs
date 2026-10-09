import test from 'node:test';
import assert from 'node:assert/strict';
import { factId, tableFact, approvedFact } from '../server/table-facts.mjs';

const card = (r, s = '♠') => ({ r, s });
const view = {
  phase: 'round', actionMs: 15000, owners: ['me', null, 'bo'], players: [{ id: 'me', name: 'Kevin' }, { id: 'bo', name: 'Bo' }],
  shoe: { remaining: 114, decks: 8 },
  round: { phase: 'decisions', active: 0, dealer: [card('10', '♥'), { r: null }],
    hands: [{ box: 0, cards: [card('10'), card('6')] }, { box: 2, cards: [card('9'), card('9')] }] },
  me: { id: 'me', seats: [0], balance: 1422.5, lastSettlement: { net: 5, staked: 25, hands: [
    { box: 0, stake: 10, result: 20, cards: [card('Q'), card('9')] }, { box: 2, stake: 5, result: 0, busted: true, cards: [card('K'), card('4'), card('9')] }] } },
};

test('the dealer answers questions about the visitor\'s own game from the table', () => {
  assert.equal(factId('vad har jag?'), 'hand');
  assert.equal(factId('What happened last round?'), 'last');
  assert.equal(factId('ska jag ta kort?'), 'decide');
  assert.equal(factId('hej hur mår du'), null);
  assert.equal(tableFact('hand', view, 'sv'), 'Box 7: 10♠ 6♠, 16. Dealern har 10♥.');
  assert.equal(tableFact('turn', view, 'en'), 'It is your turn on box 7. You have 15 seconds.');
  assert.equal(tableFact('last', view, 'sv'), 'Förra rundan: Box 7: 19, vinst. Box 5: 23, tjock. Totalt satsade du $25.00 och vann $5.00.');
  assert.equal(tableFact('table', view, 'en'), '2 players at the table and 114 cards left in the 8-deck shoe.');
  assert.ok(approvedFact(tableFact('balance', view, 'sv')));
});

test('advice and predictions get the facts and a firm no, never a recommendation', () => {
  const d = tableFact('decide', view, 'sv');
  assert.match(d, /^Det beslutet är ditt, jag ger inga råd\./);
  assert.doesNotMatch(d, /borde|should|ta kort|hit|stand|stanna/i);
  assert.match(tableFact('predict', view, 'en'), /^Nobody can know the next card/);
  assert.equal(approvedFact('Take a card, you will win.'), false);
});

test('two boxes with different results: every box is named before the net (Serhiy)', () => {
  // view.me.lastSettlement: box 7 won, box 5 bust, net +5
  assert.equal(tableFact('last', view, 'en'), 'Last round: Box 7: 19, win. Box 5: 23, bust. In total you staked $25.00 and won $5.00.');
  const lostOne = { ...view, me: { ...view.me, lastSettlement: { net: -5, staked: 20, hands: [
    { box: 1, stake: 10, result: 10, cards: [card('10'), card('8')] }, { box: 4, stake: 10, result: 0, cards: [card('10'), card('7')] }] } } };
  assert.equal(tableFact('last', lostOne, 'sv'), 'Förra rundan: Box 6: 18, lika. Box 3: 17, förlust. Totalt satsade du $20.00 och förlorade $5.00.');
  const sameResult = { ...view, me: { ...view.me, lastSettlement: { net: -20, staked: 20, hands: [
    { box: 1, stake: 10, result: 0, cards: [card('10'), card('8')] }, { box: 4, stake: 10, result: 0, cards: [card('10'), card('7')] }] } } };
  assert.match(tableFact('last', sameResult, 'en'), /^Last round you staked \$20\.00 and lost \$20\.00\. Box 6: 18, loss\. Box 3: 17, loss\.$/);
});
