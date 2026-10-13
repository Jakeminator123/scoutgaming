import test from 'node:test';
import assert from 'node:assert/strict';
import {studioContext} from './studio-context.mjs';
const catalog={administration:{operators:[{id:'a',status:'active',archivedAt:null},{id:'b',status:'active',archivedAt:null}],rooms:[
  {id:'bj',operatorId:'a',game:'blackjack',compositionId:'one'},
  {id:'roulette',operatorId:'a',game:'roulette',compositionId:'two'},
  {id:'other',operatorId:'b',game:'blackjack',compositionId:'three'},
  {id:'archived',operatorId:'a',state:'archived',game:'roulette',compositionId:'three'},
],dealers:[{id:'astrid'},{id:'paow-v2'},{id:'removed',archived:true}]}};
const project={dealers:[{id:'astrid'},{id:'paow-v2'},{id:'removed'}],lanes:[
  {id:'one',layers:{dealer:{allowed:['astrid'],default:'astrid'}}},
  {id:'two',layers:{dealer:{allowed:['paow-v2','removed'],default:'paow-v2'}}},
  {id:'three',layers:{dealer:{allowed:['removed'],default:'removed'}}},
]};
test('a selected game limits rooms before dealer selection',()=>{
  const context=studioContext(catalog,project,{operatorId:'a',game:'roulette',roomId:'roulette',dealerId:'astrid'});
  assert.deepEqual(context.rooms.map(row=>row.id),['roulette']);
  assert.equal(context.game,'roulette');assert.equal(context.dealer.id,'paow-v2');
  assert.deepEqual(context.dealers.map(row=>row.id),['paow-v2']);
  const blackjack=studioContext(catalog,project,{operatorId:'a',game:'blackjack',roomId:'roulette'});
  assert.equal(blackjack.room.id,'bj');assert.equal(blackjack.dealer.id,'astrid');
});
test('a direct archived company link cannot reopen its room or inherit an active dealer bank',()=>{
  const saved=structuredClone(catalog);saved.administration.operators[0].status='suspended';saved.administration.operators[0].archivedAt='2026-10-13T00:00:00Z';
  const context=studioContext(saved,project,{operatorId:'a',roomId:'bj',dealerId:'astrid'});
  assert.equal(context.operator,undefined);assert.equal(context.room,undefined);assert.equal(context.dealer,undefined);assert.deepEqual(context.rooms,[]);
});
test('a cross-operator room cannot redirect the selected operator or dealer',()=>{
  const context=studioContext(catalog,project,{operatorId:'a',roomId:'other',dealerId:'removed'});
  assert.equal(context.room.id,'bj');assert.equal(context.operator.id,'a');assert.equal(context.dealer.id,'astrid');
});
test('a direct room link establishes its registered owner, never a name match',()=>{
  const context=studioContext(catalog,project,{roomId:'other'});
  assert.equal(context.operator.id,'b');assert.equal(context.room.id,'other');assert.equal(context.dealer,undefined);
});
test('missing composition has no automatic fallback dealer bank',()=>{
  const context=studioContext(catalog,{...project,lanes:[]},{roomId:'bj'});
  assert.equal(context.dealer,undefined);assert.deepEqual(context.dealers,[]);
});
