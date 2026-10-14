import test from 'node:test';
import assert from 'node:assert/strict';
import {readCardView,saveCardView,CARD_VIEW_KEY} from '../web/public/card-view.mjs';
test('view preferences survive storage failure without blocking the player',()=>{
  const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
  assert.equal(readCardView(denied),'raised');assert.equal(saveCardView(denied,'table'),'table');
  assert.equal(readCardView({getItem:()=> 'stale-format'}),'raised');
  const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  saveCardView(storage,'table');assert.equal(readCardView(storage),'table');assert.equal(values.get(CARD_VIEW_KEY),'table');
});
