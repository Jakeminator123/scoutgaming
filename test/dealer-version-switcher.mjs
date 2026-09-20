import test from 'node:test';
import assert from 'node:assert/strict';
import {dealerVersionPath} from '../web/public/dealer-version-switcher.mjs';
test('comparison routes keep original and V2 presentations separate',()=>{
  for(const key of ['astrid','amira']){
    assert.equal(dealerVersionPath(key,'v2'),`/v2/?dealer=${key}`);
    assert.equal(dealerVersionPath(key,'original'),`/?dealer=${key}`);
  }
});
test('dealers without V2 stay on their original presentation',()=>{
  for(const key of ['vera','mei'])assert.equal(dealerVersionPath(key,'v2'),`/?dealer=${key}`);
  assert.equal(dealerVersionPath('unknown','v2'),'/?dealer=vera');
});
