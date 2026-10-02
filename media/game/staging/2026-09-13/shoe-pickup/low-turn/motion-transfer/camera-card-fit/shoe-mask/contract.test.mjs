import test from 'node:test';
import assert from 'node:assert/strict';
import { shoeMaskEnabled } from './contract.mjs';

test('resampled extraction keeps the shoe mask on between native frames', () => {
  for (const [id, start, end] of [[1,4,11],[2,31,37],[3,55,62],[4,83,89]]) {
    for (let tenth = start * 10; tenth <= end * 10; tenth++) {
      assert.equal(shoeMaskEnabled({id,nativeFrame:tenth/10,status:'active'}),true);
    }
    for (const nativeFrame of [start-.01,end+.01]) {
      assert.equal(shoeMaskEnabled({id,nativeFrame,status:'active'}),false);
    }
  }
});

test('non-active cards, invalid clocks and unsupported deliveries cannot enable the mask', () => {
  for (const nativeFrame of [NaN,Infinity,-Infinity,null,undefined,'34.4']) {
    assert.equal(shoeMaskEnabled({id:2,nativeFrame,status:'active'}),false);
  }
  for (const status of ['landed','hidden',undefined]) {
    assert.equal(shoeMaskEnabled({id:2,nativeFrame:34.4,status}),false);
  }
  assert.equal(shoeMaskEnabled({id:5,nativeFrame:34.4,status:'active'}),false);
});
