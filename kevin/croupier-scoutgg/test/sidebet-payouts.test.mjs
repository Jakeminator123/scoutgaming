import test from 'node:test';
import assert from 'node:assert/strict';
import {Round} from '../vendor/croupier/public/blackjack.mjs';
const c=(r,s)=>({r,s});
const cases=[
 ['perfect pair',c('8','♠'),c('8','♠'),c('2','♥'),130,0],
 ['colored pair',c('8','♠'),c('8','♣'),c('2','♥'),65,0],
 ['mixed pair',c('8','♠'),c('8','♥'),c('2','♦'),35,0],
 ['suited trips',c('8','♠'),c('8','♠'),c('8','♠'),130,505],
 ['straight flush',c('A','♠'),c('2','♠'),c('3','♠'),0,205],
 ['trips',c('8','♠'),c('8','♥'),c('8','♦'),35,155],
 ['straight',c('Q','♠'),c('K','♥'),c('A','♦'),0,55],
 ['flush',c('2','♠'),c('7','♠'),c('J','♠'),0,30],
 ['no wrapping straight',c('K','♠'),c('A','♥'),c('2','♦'),0,0],
 ['lost side bets',c('9','♠'),c('7','♥'),c('5','♦'),0,0],
];
for(const [label,first,second,up,pp,tp] of cases)test(`server paytable: ${label}, total return includes winning stake`,()=>{
 for(const field of ['pp','tp']){
  const r=new Round([{main:5,pp:field==='pp'?5:0,tp:field==='tp'?5:0}],[c('10','♣'),second,up,first]);r.deal();
  assert.equal(r.hands[0].sideReturn,field==='pp'?pp:tp);
 }
});
