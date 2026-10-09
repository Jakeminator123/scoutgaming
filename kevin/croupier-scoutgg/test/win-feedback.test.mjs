import test from 'node:test';import assert from 'node:assert/strict';
import {visibleSideResults,visibleSideWins,createWinTracker,mainWin,boxResults,currentReceipt,mainResults} from '../public/win-feedback.js';
import {Round} from '../vendor/croupier/public/blackjack.mjs';
const hand={box:3,sideResults:{pp:{stake:5,returned:130,profit:125,label:'Perfect Pair',draws:[1,3]},tp:{stake:5,returned:505,profit:500,label:'Suited Three of a Kind',draws:[1,3,2]}}};
const state={roundId:'one',me:{seats:[3]},round:{hands:[hand]}};
test('side wins wait for the exact visible cards and belong only to the owner',()=>{
 assert.equal(visibleSideWins(state,new Set([1,2])).length,0);
 assert.equal(visibleSideWins(state,new Set([1,3])).length,1);
 assert.deepEqual(visibleSideWins(state,new Set([1,2,3])).map(w=>w.profit),[125,500]);
 assert.equal(visibleSideWins({...state,me:{seats:[4]}},new Set([1,2,3])).length,0);
 assert.equal(visibleSideWins({...state,round:{hands:[{box:3,sideResults:{pp:{...hand.sideResults.pp,profit:0}}}]}},new Set([1,2,3])).length,0);
});
test('notifications occur once, suppress restored results and reset for a new round',()=>{
 const events=[],track=createWinTracker(w=>events.push(w));track(state,new Set([1]),true);track(state,new Set([1,2,3]),true);track(state,new Set([1,2,3]),true);assert.equal(events.length,2);
 const restored=createWinTracker(w=>events.push(w));restored(state,new Set([1,2,3]),false);restored(state,new Set([1,2,3]),true);assert.equal(events.length,2);restored({...state,roundId:'two'},new Set([1,2,3]),true);assert.equal(events.length,4);
});
test('main notifications exclude side awards, losses and pushes',()=>{
 const h={stake:10,insured:0,result:20,sideReturn:505,splitFrom:null,cards:[{r:'10'},{r:'9'}]};assert.equal(mainWin({hands:[h]}).profit,10);
 assert.equal(mainWin({hands:[{...h,result:10}]}),null);assert.equal(mainWin({hands:[{...h,result:0}]}),null);assert.equal(mainWin({hands:[h,{...h,result:0}]}),null);
 const bj=mainWin({hands:[{...h,result:25,cards:[{r:'A'},{r:'K'}]}]});assert.equal(bj.profit,15);assert.equal(bj.big,true);
});
test('server supplies separate profit/return and original draw identities without duplicating split awards',()=>{
 const c=(r,s,shoeDraw)=>({r,s,shoeDraw});const r=new Round([{main:5,pp:5,tp:5}],[c('10','♥',6),c('10','♦',5),c('10','♣',4),c('8','♠',3),c('8','♠',2),c('8','♠',1)]);r.deal();
 assert.equal(r.hands[0].sideReturn,635);assert.deepEqual(r.hands[0].sideResults.pp,{stake:5,returned:130,profit:125,label:'Perfect Pair',draws:[1,3]});assert.equal(r.hands[0].sideResults.tp.profit,500);
 r.act('split');assert.equal(r.hands.filter(h=>h.sideResults?.pp).length,1);assert.deepEqual(r.hands[0].sideResults.pp.draws,[1,3]);assert.equal(r.hands.reduce((n,h)=>n+h.sideReturn,0),635);
});

test('losing side bets reveal only with their cards and never celebrate',()=>{
 const c=(r,s,shoeDraw)=>({r,s,shoeDraw});const r=new Round([{main:5,pp:5,tp:5}],[c('10','♦',4),c('7','♣',3),c('8','♠',2),c('10','♥',1)]);r.deal();
 const h=r.hands[0],s={roundId:'loss',me:{seats:[h.box]},round:{hands:[h]}};
 assert.equal(h.sideReturn,0);assert.equal(h.sideResults.pp.returned,0);assert.equal(h.sideResults.tp.profit,-5);
 assert.equal(visibleSideResults(s,new Set([1,2])).length,0);assert.equal(visibleSideResults(s,new Set([1,2,3])).length,2);
 assert.equal(visibleSideWins(s,new Set([1,2,3])).length,0);const events=[];createWinTracker(w=>events.push(w))(s,new Set([1,2,3]),true);assert.deepEqual(events,[]);
});

test('each box gets its own verdict, so a push beside a bust reads as a push (CH report)',()=>{
 const c=r=>({r,s:'♠'});
 const receipt={hands:[
  {box:5,stake:10,insured:0,result:0,splitFrom:null,cards:[c('7'),c('6'),c('2'),c('10')]},
  {box:6,stake:10,insured:0,result:10,splitFrom:null,cards:[c('K'),c('J')]}]};
 assert.deepEqual(boxResults(receipt),[{box:5,net:-10,outcome:'bust'},{box:6,net:0,outcome:'push'}]);
 assert.deepEqual(boxResults({hands:[{...receipt.hands[1],result:20}]}),[{box:6,net:10,outcome:'win'}]);
 assert.deepEqual(boxResults({hands:[{...receipt.hands[1],result:0}]}),[{box:6,net:-10,outcome:'lose'}]);
 // a split box is ONE verdict: the sum of its hands
 const split=[{box:2,stake:10,insured:0,result:10,splitFrom:2,cards:[c('10'),c('Q')]},{box:2,stake:10,insured:0,result:0,splitFrom:2,cards:[c('10'),c('9'),c('5')]}];
 assert.deepEqual(boxResults({hands:split}),[{box:2,net:-10,outcome:'lose'}]);
 assert.deepEqual(boxResults(null),[]);
});

test('a player who sat the hand out sees no result: the stored receipt is the previous round (CH report)',()=>{
 const receipt={roundId:'r1',staked:100,returned:0,net:-100,hands:[]};
 assert.equal(currentReceipt({roundId:'r1',me:{lastSettlement:receipt}}),receipt);
 assert.equal(currentReceipt({roundId:'r2',me:{lastSettlement:receipt}}),null);
 assert.equal(currentReceipt({roundId:null,plan:{id:'r1'},me:{lastSettlement:receipt}}),receipt);
 assert.equal(currentReceipt({roundId:'r2',me:{lastSettlement:null}}),null);
 assert.equal(currentReceipt(null),null);
});

test('main bets settle per box for everyone at the table: split hands summed, empty boxes left out (#10)',()=>{
  const round={hands:[
    {box:3,stake:10,result:20,splitFrom:null},{box:3,stake:10,result:0,splitFrom:0},
    {box:4,stake:25,result:0,splitFrom:null},{box:5,stake:5,result:5,splitFrom:null},{box:6,stake:0,result:0,splitFrom:null}]};
  assert.deepEqual(mainResults(round,'r1'),[
    {box:3,stake:20,returned:20,key:'r1:3:main'},{box:4,stake:25,returned:0,key:'r1:4:main'},{box:5,stake:5,returned:5,key:'r1:5:main'}]);
  assert.deepEqual(mainResults(null,'r1'),[]);
});
