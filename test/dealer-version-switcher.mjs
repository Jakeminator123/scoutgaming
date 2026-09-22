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
test('version switching keeps only the explicit observation channel, never launch credentials',()=>{
  const search='?launch=private&labObserverOrigin=http%3A%2F%2F127.0.0.1%3A4188&labObserverChannel=channel-1234567890';
  const path=dealerVersionPath('astrid','v2',search),url=new URL(path,'http://localhost');
  assert.equal(url.pathname,'/v2/');
  assert.equal(url.searchParams.get('labObserverOrigin'),'http://127.0.0.1:4188');
  assert.equal(url.searchParams.get('labObserverChannel'),'channel-1234567890');
  assert.equal(url.searchParams.has('launch'),false);
});
