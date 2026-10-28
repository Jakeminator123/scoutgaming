import assert from 'node:assert/strict';
import {command,newGame,gameView} from '../services/game/shoe-game.mjs';
import { SHOE_RULES } from '../packages/shared/blackjack-shoe-rules.mjs';
let checks=0;
const check=(v,msg)=>{assert.ok(v,msg);checks++;};
const bets=[{main:5,pp:0,tp:0},...Array.from({length:6},()=>({main:0,pp:0,tp:0}))];
let g=newGame(),wallet=1000;
function send(op,extra={}) {
  // Models transactional copy/rollback and persisted JSON reload; no database is opened.
  const next=JSON.parse(JSON.stringify(g));
  const req={op,version:next.version,requestId:crypto.randomUUID(),...extra};
  const out=command(next,req,wallet); wallet+=out.delta; g=JSON.parse(JSON.stringify(next));return {out,req};
}
send('state');
check(g.shoe.cards.length===415,'one face-down burn');
const counts=new Map();for(const c of g.shoe.cards) counts.set(c.r+c.s,(counts.get(c.r+c.s)||0)+1);
check([...counts.values()].every(n=>n===7||n===8),'eight decks less one burn');
const oldId=g.shoe.id;
let {out,req}=send('start',{bets});
check(wallet===995,'server debit');
check(!JSON.stringify(out.view).includes('holeCard')&&!JSON.stringify(out.view).includes('shoeDraw":1,'),'private hole excluded');
check(!('cards' in out.view.shoe),'no future deck order');
const repeated=command(g,req,wallet);check(repeated.delta===0&&g.version===req.version+1,'duplicate start idempotent');
assert.throws(()=>send('start',{bets}));checks++;
function complete() {
  if(g.round.phase==='insurance') send('insurance',{take:false});
  while(g.round.phase==='decisions') send('act',{action:'stand'});
  send('collect');
}
complete();send('start',{bets});check(g.shoe.id===oldId,'same shoe across rounds');complete();
// Reach cut in the initial deal. No replacement during that round.
g.shoe.dealt=310;g.shoe.cards=g.shoe.cards.slice(0,106);
send('start',{bets});check(g.shoe.cutReached,'cut crossed');check(g.shoe.id===oldId,'no mid-round shuffle');
complete();const next=send('start',{bets});check(g.shoe.id!==oldId&&next.out.view.shuffled,'next round changes shoe');
check(g.shoe.dealt<20&&g.shoe.cards.length+g.shoe.dealt===416,'new burn and exact draw counts');complete();
assert.throws(()=>send('act',{action:'hit'}));checks++;
assert.throws(()=>send('start',{bets:[{main:-5,pp:0,tp:0},...bets.slice(1)]}));checks++;
assert.throws(()=>send('start',{bets:bets.map(b=>({...b,main:2001}))}));checks++;
assert.throws(()=>send('start',{bets,version:-1}));checks++;
// Exercise persisted games across cut boundaries and verify conservation.
for(let i=0;i<180;i++) {send('start',{bets});complete();check(g.shoe.cards.length+g.shoe.dealt===SHOE_RULES.total,'card conservation');}
// Exhaustion must fail rather than quietly replacing the shoe.
g.shoe.cards=[];g.shoe.cutReached=false;
const before=JSON.stringify(g);assert.throws(()=>send('start',{bets}),/exhausted/);check(JSON.stringify(g)===before,'rollback on exhaustion');
console.log(`${checks} shoe/service checks passed`);
// Split and double through JSON persistence, including hidden hole consumption.
g=newGame();wallet=1000;send('state');
const stack=[['8','♠'],['6','♦'],['8','♥'],['10','♣'],['3','♦'],['2','♣'],['9','♦'],['K','♥'],['5','♠']].map(([r,s])=>({r,s}));
g.shoe.cards.splice(-stack.length,stack.length,...stack.reverse());
send('start',{bets});send('act',{action:'split'});
assert.equal(g.shoe.dealt,7);assert.equal(wallet,990);assert.equal(g.round.hands.length,2);
send('act',{action:'hit'});send('act',{action:'stand'});send('act',{action:'double'});
assert.equal(g.shoe.dealt,10);assert.equal(wallet,985);assert.equal(g.round.phase,'settled');
const paid=send('collect');const paidWallet=wallet;
assert.equal(command(g,paid.req,wallet).delta,0);assert.equal(wallet,paidWallet);
assert.equal(g.round.boxes[0].sideReturn,g.round.hands[0].sideReturn);
// Insurance's cost and reveal must also survive persistence.
g=newGame();wallet=1000;send('state');
g.shoe.cards.splice(-4,4,...[{r:'8',s:'♠'},{r:'A',s:'♦'},{r:'8',s:'♥'},{r:'K',s:'♣'}].reverse());
const insurance=send('start',{bets});assert.equal(insurance.out.view.round.dealer.length,1);
send('insurance',{take:true});assert.equal(wallet,992.5);assert.equal(g.round.dealer.length,2);
send('collect');assert.equal(wallet,1000);
console.log('Persisted split, double, insurance and duplicate payout checks passed');

// Native compatibility and V3 share hand mathematics, not wallet or shoe-state formats.
import test from 'node:test';
import { Round, freshShoe, handValue } from '../services/game/public/blackjack.mjs';
import { Round as RuleRound, handValue as ruleValue } from '../services/game/games/blackjack/round.mjs';
import { presentationPublicSource } from '../packages/presentation/public-modules.mjs';

const card = value => ({ r: value.slice(0, -1), s: value.slice(-1) });
const shoe = order => [...Array.from({ length: 100 }, () => card('5♣')), ...order.map(card).reverse()];
const plain = value => JSON.parse(JSON.stringify(value));
const nativeShape = value => {
  const copy = plain(value);
  for (const hand of [...copy.boxes, ...copy.hands]) delete hand.sideResults;
  return copy;
};

test('native compatibility delegates all hand decisions and payouts to the V3 rule class', () => {
  assert.equal(Object.getPrototypeOf(Round.prototype), RuleRound.prototype);
  assert.equal(handValue, ruleValue);
  for (const method of ['deal', 'draw', 'legal', 'act', 'split', 'dealerPlay', 'settle', 'resolveInsurance']) {
    assert.equal(Round.prototype[method], RuleRound.prototype[method], method);
  }
});

test('native default shoe keeps eight decks and does not affect explicit V3 shoes', t => {
  let calls = 0;
  t.mock.method(globalThis.crypto, 'getRandomValues', buffer => {
    buffer[0] = calls++ === 0 ? 0xFFFFFFFF : 0;
    return buffer;
  });
  const cards = freshShoe();
  assert.equal(cards.length, 416);
  assert.equal(calls, 416, 'one rejected sample plus the existing 415 swaps');
  const counts = new Map();
  for (const c of cards) {
    assert.deepEqual(Object.keys(c), ['r', 's'], 'no new persisted physical-card field');
    counts.set(c.r + c.s, (counts.get(c.r + c.s) ?? 0) + 1);
  }
  assert.equal(counts.size, 52);
  assert.ok([...counts.values()].every(count => count === 8));
  const before = calls, explicit = shoe(['8♠', '6♦', '8♥', '9♣']);
  assert.equal(new RuleRound([10], explicit).shoe, explicit);
  assert.equal(calls, before, 'pure V3 Round consumes no ambient randomness');
  assert.equal(new Round([10]).shoe.length, 416, 'old standalone constructor remains supported');
});

const cases = [
  { name: 'split and double', bets: [10], cards: ['8♠','6♦','8♥','9♣','3♦','2♠','9♥','K♦'],
    actions: ['split','double','stand'], returned: [20,40], sides: [0,0] },
  { name: 'split aces are not naturals', bets: [10], cards: ['A♠','6♦','A♥','9♣','K♦','Q♣'],
    actions: ['split'], returned: [20,20], sides: [0,0] },
  { name: 'natural pays three to two', bets: [10], cards: ['A♠','6♦','K♦','9♣'],
    actions: [], returned: [25], sides: [0] },
  { name: 'dealer blackjack and insurance', bets: [10], cards: ['8♠','A♦','8♥','K♣'],
    insurance: [true], actions: [], returned: [15], sides: [0] },
  { name: 'bust does not receive the main bet', bets: [10], cards: ['10♠','6♦','9♥','9♣','K♦'],
    actions: ['hit'], returned: [0], sides: [0] },
  { name: 'side bets stay on original hand after split', bets: [{ main:10, pp:5, tp:5 }],
    cards: ['8♥','8♣','8♦','9♠','3♦','2♠'], actions: ['split','stand','stand'],
    returned: [0,0], sides: [220,0] },
];
for (const scenario of cases) test(`same rules, native shape: ${scenario.name}`, () => {
  const old = new Round(scenario.bets, shoe(scenario.cards));
  const current = new RuleRound(scenario.bets, shoe(scenario.cards));
  const check = () => {
    assert.deepEqual(plain(old), nativeShape(current));
    assert.ok(old.hands.every(hand => !Object.hasOwn(hand, 'sideResults')));
  };
  old.deal(); current.deal(); check();
  assert.ok(Object.hasOwn(current.hands[0], 'sideResults'), 'V3 audit detail is retained');
  if (scenario.insurance) {
    old.resolveInsurance(scenario.insurance); current.resolveInsurance(scenario.insurance); check();
  }
  for (const action of scenario.actions) { old.act(action); current.act(action); check(); }
  assert.equal(old.phase, 'settled');
  assert.deepEqual(old.hands.map(hand => hand.result), scenario.returned);
  assert.deepEqual(old.hands.map(hand => hand.sideReturn), scenario.sides);
});

test('a native saved hand resumes after JSON reload; duplicate collection never pays twice', () => {
  let state = newGame(), balance = 1000, id = 0;
  state.shoe = { id:'saved-native-shoe', cards:shoe(['8♠','6♦','8♥','9♣','3♦','2♠','9♥','K♦']), dealt:1, cutReached:false };
  const send = input => {
    state = plain(state); // the same boundary as persisted blackjack_tables.state
    const request = { ...input, version:state.version, requestId:`compat-${++id}` };
    const result = command(state, request, balance);
    balance += result.delta;
    assert.ok(!Object.hasOwn(state.round, 'shoe'), 'draw adapter is never persisted');
    if (result.view.round) {
      assert.ok(!Object.hasOwn(result.view.round, 'holeCard'));
      assert.ok(!Object.hasOwn(result.view.shoe, 'cards'));
      assert.ok(result.view.round.hands.every(hand => !Object.hasOwn(hand, 'sideResults')));
    }
    return { request, result };
  };
  send({op:'start', bets:Array.from({length:7},(_,i)=>({main:i===0?10:0,pp:0,tp:0}))});
  send({op:'act',action:'split'});
  send({op:'act',action:'double'});
  send({op:'act',action:'stand'});
  const {request,result} = send({op:'collect'});
  assert.equal(balance, 1030);
  assert.equal(result.delta, 60);
  state = plain(state);
  const replay = command(state,request,balance);
  assert.equal(replay.delta,0);
  assert.deepEqual(replay.view,result.view);
  assert.throws(()=>command(state,{...request,requestId:'another',version:state.version},balance), /No active round/);
});

test('the browser exposes only the canonical pure rules, not the server engine or RNG', () => {
  const source = 'services/game/games/blackjack/round.mjs';
  assert.equal(presentationPublicSource('/games/blackjack/round.mjs'), source);
  assert.equal(presentationPublicSource('/' + source), source, 'build output has an exact canonical URL');
  for (const file of ['core.mjs','secure-random.mjs','shoe-proof.mjs','table/postgres-store.mjs']) {
    assert.equal(presentationPublicSource('/games/blackjack/' + file), null);
    assert.equal(presentationPublicSource('/services/game/games/blackjack/' + file), null);
  }
  assert.equal(presentationPublicSource('/games/blackjack/../blackjack/round.mjs'),null);
});
