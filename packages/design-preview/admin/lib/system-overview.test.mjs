import test from 'node:test';
import assert from 'node:assert/strict';
import { systemOverview, systemHref } from './system-overview.mjs';

const workspace = () => ({ catalog: { source: 'registered', administration: {
  operators: [{ id:'a',name:'A' }, { id:'b',name:'B' }],
  dealers: [{ id:'one',archived:false }, { id:'two',archived:false }, { id:'old',archived:true }],
  rooms: [
    {id:'a-1',operatorId:'a',game:'blackjack',compositionId:'scene-a',dealerIds:['one'],published:true,playable:false},
    {id:'a-2',operatorId:'a',game:'blackjack',compositionId:'scene-a',dealerIds:['one'],published:false,playable:false},
    {id:'b-1',operatorId:'b',game:'roulette',compositionId:'scene-b',dealerIds:['two'],published:true,playable:true},
  ],
} }, project: { dealers:[{id:'one'},{id:'two'},{id:'old'}],lanes:[{id:'scene-a',dealers:['one']},{id:'scene-b',dealers:['two']}] } });

test('registered game and room counts distinguish publication from playable rooms', () => {
  const value = systemOverview(workspace());
  assert.deepEqual(value.counts, { operators:2,rooms:3,gameTypes:2,dealers:2,compositions:2,published:2,playable:1 });
  assert.deepEqual(value.games, [ {kind:'blackjack',name:'Blackjack',rooms:2,playable:0}, {kind:'roulette',name:'Roulette',rooms:1,playable:1} ]);
});
test('links retain the requested real room and derive its own operator, composition and dealer', () => {
  const { context } = systemOverview(workspace(), '?table=b-1&dealer=one&composition=scene-a');
  assert.deepEqual(context,{operator:'b',table:'b-1',composition:'scene-b',dealer:'two'});
  assert.equal(systemHref('/admin/clips',context),'/admin/clips?operator=b&table=b-1&composition=scene-b&dealer=two');
});
test('a selected operator cannot inherit another operator room or invalid identifiers', () => {
  const { context } = systemOverview(workspace(), '?operator=a&table=b-1&dealer=old&lane=made-up');
  assert.deepEqual(context,{operator:'a',table:'a-1',composition:'scene-a',dealer:'one'});
});
test('empty registered data stays empty; named game cards do not create registered game types', () => {
  const data = workspace();
  data.catalog.administration = {operators:[],rooms:[],dealers:[]};
  data.project = {dealers:[],lanes:[]};
  const value = systemOverview(data);
  assert.deepEqual(value.context,{});
  assert.equal(value.counts.gameTypes,0);
  assert.equal(value.counts.rooms,0);
  assert.ok(value.games.every(game => game.rooms === 0 && game.playable === 0));
});
test('an absent composition cannot select a dealer from a different room', () => {
  const data = workspace();
  data.project.lanes = [];
  assert.deepEqual(systemOverview(data,'?table=b-1&dealer=one').context,{operator:'b',table:'b-1',dealer:'two'});
});
test('demo sources and links outside the administration are rejected', () => {
  const data = workspace(); data.catalog.source = 'demo';
  assert.throws(() => systemOverview(data),/Registrerade/);
  for (const path of ['/control/clips','/partner','https://example.com/admin','//example.com/admin','/admin/../play']) {
    assert.throws(() => systemHref(path,{}),/administrationen/);
  }
});
