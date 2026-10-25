import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultCompositionSettings,defaultBlackjackTableGeometry} from '../packages/presentation/contracts/composition-settings.mjs';
import {sceneLayoutPublication} from '../packages/presentation/contracts/scene-layout-publication.mjs';

const table1='00000000-0000-4000-8000-000000000001',table2='00000000-0000-4000-8000-000000000002',table3='00000000-0000-4000-8000-000000000003';
const lane=ids=>({layers:{table:{allowed:ids}},composition:{...defaultCompositionSettings(),blackjackTables:ids.map(defaultBlackjackTableGeometry)}});

test('publication copies both layouts, retains removed material geometry and excludes unpublished tables without mutation',()=>{
  const published=lane([table1,table2]),saved=lane([table1,table3]);
  published.composition.blackjackTables[1].mobile.cardWidth=.08;
  saved.composition.mobile.dealer.scale=1.2;saved.composition.desktop.table.width=.8;saved.composition.tableFront=true;
  saved.composition.mobile.gameUi={actions:{x:.5,y:.7},chat:{x:1,y:0,width:.8,height:.4}};
  saved.composition.blackjackTables[0].desktop.fanSpread=.75;
  const before=structuredClone({published,saved}),result=sceneLayoutPublication(published,saved);
  const expected=structuredClone(saved.composition);expected.blackjackTables=[saved.composition.blackjackTables[0],published.composition.blackjackTables[1]];
  assert.equal(result.changed,true);assert.deepEqual(result.composition,expected);assert.deepEqual({published,saved},before);
  result.composition.blackjackTables[1].mobile.cardWidth=.07;assert.deepEqual({published,saved},before);
});

test('only a table still allowed in the saved template can have its frozen manual profile reset',()=>{
  const published=lane([table1,table2]),saved=lane([table1]);delete saved.composition.blackjackTables;
  const result=sceneLayoutPublication(published,saved);
  assert.equal(result.changed,true);assert.deepEqual(result.composition.blackjackTables,[published.composition.blackjackTables[1]]);
});

test('profile order and empty profile lists do not cause a false publication',()=>{
  const published=lane([table1,table2]),saved=structuredClone(published);saved.composition.blackjackTables.reverse();
  const result=sceneLayoutPublication(published,saved);
  assert.equal(result.changed,false);assert.deepEqual(result.composition,published.composition);assert.notEqual(result.composition,published.composition);
  const empty=lane([]),missing=lane([]);delete missing.composition.blackjackTables;
  assert.equal(sceneLayoutPublication(empty,missing).changed,false);
});

test('missing or invalid saved geometry cannot become a publication candidate',()=>{
  const published=lane([table1]);
  for(const mutate of [value=>delete value.composition,value=>value.composition.mobile.dealer.scale=Infinity,
    value=>value.composition.blackjackTables[0].desktop.seats[0].card.y=1.1,
    value=>value.composition.mobile.gameUi={actions:null,chat:{x:1,y:0,width:.01,height:.4}},value=>value.layers.table.allowed=[]]){
    const saved=structuredClone(published);mutate(saved);assert.throws(()=>sceneLayoutPublication(published,saved),error=>error.statusCode===422);
  }
  const unpositioned={layers:published.layers};assert.equal(sceneLayoutPublication(unpositioned,published).changed,true);
});
