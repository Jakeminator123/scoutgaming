import test from 'node:test';
import assert from 'node:assert/strict';
import {studioContext} from './studio-context.mjs';
const catalog={administration:{operators:[{id:'a'},{id:'b'}],rooms:[
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
test('operator owns the selectable rooms before their game is resolved',()=>{
  const context=studioContext(catalog,project,{operatorId:'a',roomId:'roulette',dealerId:'astrid'});
  assert.deepEqual(context.rooms.map(row=>row.id),['bj','roulette']);
  assert.equal(context.game,'roulette');assert.equal(context.dealer.id,'paow-v2');
  assert.deepEqual(context.dealers.map(row=>row.id),['paow-v2']);
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
