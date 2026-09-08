import assert from 'node:assert/strict';
import {command,newGame,gameView,SHOE_RULES} from '../web/shoe-game.mjs';
let checks=0;
const check=(v,msg)=>{assert.ok(v,msg);checks++;};
const bets=[{main:5,pp:0,tp:0},...Array.from({length:6},()=>({main:0,pp:0,tp:0}))];
let g=newGame(),wallet=1000;
function send(op,extra={}) {
  // Mimics SQLite commit/rollback + persisted JSON reload each request.
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
