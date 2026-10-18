import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {handValue} from '../services/game/public/blackjack.mjs';
import { sideBetWin, roundWin } from '../services/game/public/blackjack-feedback.mjs';

const hand = overrides => ({ stake: 10, result: 20, pp: 0, tp: 0, sideReturn: 0,
  insured: 0, splitFrom: null, cards: [{ r: '10' }, { r: '9' }], ...overrides });

// Execute the application's actual settlement announcement boundary; a correct
// profit helper alone must not leave audio and dealer speech using anyWin.
const app = readFileSync(new URL('../services/game/public/app.mjs', import.meta.url), 'utf8');
const announcementStart = app.indexOf('  const dealerTotal = handValue(round.dealer).total;', app.indexOf("  syncBalance('settle');"));
const announcementEnd = app.indexOf('  await Promise.all([sleep(1800), speechQueue.idle]);', announcementStart);
assert.ok(announcementStart >= 0 && announcementEnd > announcementStart, 'settlement announcement boundary exists');
function announce(hands, dealer = [{r:'10'}, {r:'8'}]) {
  const speech = [], sounds = [], flashes = [];
  const net = h => h.result + h.sideReturn - h.stake - h.pp - h.tp - (h.insured ?? 0);
  runInNewContext(app.slice(announcementStart, announcementEnd), {
    live: hands, round: {dealer}, handValue, win: roundWin(hands),
    anyWin: hands.some(h => net(h) > 0), anyPush: hands.some(h => net(h) === 0), anyLose: hands.some(h => net(h) < 0),
    anyPlayerBJ: hands.some(h => h.splitFrom === null && h.cards.length === 2 && handValue(h.cards).total === 21),
    voice: {say: line => speech.push(line)}, sfx: {play: sound => sounds.push(sound)}, bjFlash: value => flashes.push(value),
  });
  return {speech, sounds, flashes};
}

test('actual settlement audio and speech never celebrate a net-losing multi-box or side-bet round', () => {
  const before = [hand({cards:[{r:'A'},{r:'K'}],result:25}), hand({stake:100,result:0})];
  const snapshot = structuredClone(before);
  for (const hands of [before, [hand({pp:20})], [hand(), hand({result:0,insured:5})]]) {
    for (const dealer of [[{r:'10'},{r:'8'}], [{r:'10'},{r:'8'},{r:'5'}]])
      assert.deepEqual(announce(hands,dealer), {speech:['lose'], sounds:[], flashes:[]});
  }
  assert.deepEqual(before, snapshot, 'announcements never change the server settlement');
  assert.deepEqual(announce([hand({cards:[{r:'A'},{r:'K'}],result:25})]),
    {speech:['blackjack'], sounds:['bigwin'], flashes:['BLACKJACK']});
});

test('a returned stake, a loss, and mixed boxes with no net profit do not celebrate', () => {
  assert.equal(roundWin([hand({ result: 10 })]), null);
  assert.equal(roundWin([hand({ result: 0 })]), null);
  assert.equal(roundWin([hand(), hand({ result: 0 })]), null);
  assert.equal(roundWin([hand({ stake: 100, result: 0 }), hand()]), null);
  assert.equal(roundWin([]), null);
});

test('round feedback reports profit after all main, side and insurance stakes', () => {
  assert.deepEqual(roundWin([hand()]), { profit: 10, blackjack: false });
  assert.deepEqual(roundWin([hand({ stake: 20, result: 40, insured: 5 })]), { profit: 15, blackjack: false });
  // A winning main hand can still lose overall because of side bets.
  assert.equal(roundWin([hand({ pp: 10, tp: 5 })]), null);
  assert.deepEqual(roundWin([hand({ result: 0, pp: 5, sideReturn: 130 })]), { profit: 115, blackjack: false });
});

test('split hands account for each stake and carry side returns only on the original hand', () => {
  const hands = [hand({ splitFrom: 3, pp: 5, tp: 5, sideReturn: 130 }), hand({ splitFrom: 3, result: 0 })];
  const original = structuredClone(hands);
  assert.deepEqual(roundWin(hands), { profit: 120, blackjack: false });
  assert.deepEqual(hands, original, 'presentation must not change the server receipt');
});

test('natural blackjack is highlighted only when its own main return beats its stake', () => {
  const cards = [{ r: 'A' }, { r: 'K' }];
  assert.deepEqual(roundWin([hand({ cards, result: 25 })]), { profit: 15, blackjack: true });
  assert.deepEqual(roundWin([hand({ cards, splitFrom: 3 })]), { profit: 10, blackjack: false });
  assert.deepEqual(roundWin([hand({ cards, result: 10, pp: 5, sideReturn: 130 })]), { profit: 125, blackjack: false });
});

test('side notification subtracts both side stakes and suppresses zero or negative net returns', () => {
  assert.deepEqual(sideBetWin(hand({ pp: 5, sideReturn: 130 })), { profit: 125 });
  assert.deepEqual(sideBetWin(hand({ pp: 5, tp: 5, sideReturn: 130 })), { profit: 120 });
  assert.equal(sideBetWin(hand({ pp: 5, tp: 200, sideReturn: 130 })), null);
  assert.equal(sideBetWin(hand({ pp: 5, tp: 125, sideReturn: 130 })), null);
  assert.equal(sideBetWin(hand({ pp: 5 })), null);
  assert.equal(sideBetWin(hand()), null);
});
