import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {newRoom,roomCommand,validateBets} from '../services/game/games/roulette/room.mjs';
import {describePocket} from '../services/game/games/roulette/index.mjs';
import {BETS,WHEEL,pocketColor} from '../services/game/games/roulette/rules.mjs';

const command=(bets=[{id:'red',amount:5}],version=0)=>({op:'spin',requestId:randomUUID(),version,bets});
const draw=number=>context=>({...context,eventId:randomUUID(),type:'roulette.spin.resolved',occurredAt:new Date().toISOString(),outcome:describePocket(number)});
test('every legal wager settles all 37 outcomes, including zero, with exact integer-cent payouts',()=>{
  assert.deepEqual([...WHEEL].sort((a,b)=>a-b),Array.from({length:37},(_,i)=>i));
  assert.equal(new Set(BETS.map(b=>b.id)).size,BETS.length);
  for(const bet of BETS) {
    assert.equal(new Set(bet.numbers).size,bet.numbers.length);
    assert.ok([1,2,3,4,6,12,18].includes(bet.numbers.length));
    let total=0;
    for(let number=0;number<=36;number++) {
      assert.equal(pocketColor(number),describePocket(number).color);
      const result=roomCommand(newRoom(),command([{id:bet.id,amount:1.25}]),100,{draw:draw(number)});
      const payout=bet.numbers.includes(number)?1.25*36/bet.numbers.length:0;
      assert.equal(result.round.returned,payout,`${bet.id} on ${number}`);
      assert.equal(result.round.balanceAfter,98.75+payout);total+=payout;
    }
    assert.equal(total,45); // 36 stakes returned across 37 equally likely pockets.
  }
  for(const id of ['red','black','odd','even','low','high']) assert.equal(BETS.find(b=>b.id===id).numbers.includes(0),false);
});
test('limits and closed commands reject invalid or client-selected outcomes before drawing',()=>{
  for(const bets of [[],[{id:'fake',amount:1}],[{id:['red'],amount:1}],[{id:'red',amount:0}],
    [{id:'red',amount:-1}],[{id:'red',amount:1.001}],[{id:'red',amount:2001}],[{id:'red',amount:'5'}],
    [{id:'red',amount:NaN}],[{id:'red',amount:Infinity}],[{id:'red',amount:5,outcome:1}],
    [{id:'red',amount:1},{id:'red',amount:2}],BETS.slice(0,6).map(b=>({id:b.id,amount:2000}))]) assert.throws(()=>validateBets(bets));
  const forbidden=()=>{throw Error('must not draw');};
  for(const request of [{...command(),seed:1},{...command(),number:7},{...command(),version:-1},{...command(),requestId:'repeat'},{op:'reset'},{op:'state',balance:100}]) {
    assert.throws(()=>roomCommand(newRoom(),request,100,{draw:forbidden}),/invalid_command/);
  }
  assert.throws(()=>roomCommand(newRoom(),command(),4,{draw:forbidden}),/insufficient_balance/);
});
test('same request replays the persisted receipt without entropy, while stale or changed commands cannot spin',()=>{
  const state=newRoom(),request=command([{id:'red',amount:5},{id:'straight-0',amount:2}]);let calls=0;
  const options={draw:context=>{calls++;return draw(0)(context);}};
  const first=roomCommand(state,request,100,options);
  assert.equal(first.round.balanceAfter,165);assert.equal(state.version,1);
  const replay=roomCommand(state,{...request,bets:[...request.bets].reverse()},165,options);
  assert.equal(replay.replayed,true);assert.deepEqual(replay.round,first.round);assert.equal(calls,1);
  assert.throws(()=>roomCommand(state,{...request,bets:[{id:'red',amount:6}]},165,options),/request_id_reused/);
  assert.throws(()=>roomCommand(state,command(),165,options),/room_changed/);assert.equal(calls,1);
  assert.equal('fingerprint' in replay.view.rounds[0],false);assert.equal('requestId' in replay.view.rounds[0],false);
  for(let i=1;i<=21;i++) roomCommand(state,command(undefined,i),1000,options);
  assert.equal(state.rounds.length,20);
  assert.throws(()=>roomCommand(state,request,1000,options),/room_changed/);assert.equal(calls,22);
});
test('entropy failures and inconsistent outcomes do not mutate the round',()=>{
  const state=newRoom();
  assert.throws(()=>roomCommand(state,command(),100,{draw:()=>{throw Error('entropy unavailable');}}),/entropy unavailable/);
  assert.deepEqual(state,newRoom());
  assert.throws(()=>roomCommand(state,command(),100,{draw:()=>({outcome:{number:0,color:'red'}})}),/invalid_outcome/);
  assert.deepEqual(state,newRoom());
});
test('currency changes reject a new stake but preserve an already committed receipt',()=>{
  const state=newRoom(),request={...command(),currency:'USD'};
  const first=roomCommand(state,request,100,{currency:'USD',draw:draw(0)});
  assert.equal(roomCommand(state,request,95,{currency:'EUR'}).round.currency,'USD');
  assert.throws(()=>roomCommand(state,{...request,requestId:randomUUID(),version:1},95,{currency:'EUR'}),/currency_changed/);
  assert.equal(state.version,1);assert.equal(first.round.wagered,5);
});
