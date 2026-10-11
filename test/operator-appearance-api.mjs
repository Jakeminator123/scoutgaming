import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperatorAppearanceApi} from '../web/operator-appearance-api.mjs';
const entry = {status:200,selection:{operator:'north',roomId:'table-one',packageRevision:4,branding:{private:'never exposed'}}};
const req = (query='operator=north&table=table-one',method='GET') => new Request('https://game.test/api/operator/appearance?'+query,{method});
test('appearance revision is fresh, read-only and exposes no package/media payload', async()=>{
  let reads=0;
  const api=createOperatorAppearanceApi({selectGameEntry:async query=>{reads++;assert.equal(query.get('operator'),'north');return entry;}});
  for(let i=0;i<2;i++){const r=await api(req());assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.deepEqual(await r.json(),{operator:'north',roomId:'table-one',packageRevision:4});}
  assert.equal(reads,2);
});
test('rejects malformed scope and method before any selection',async()=>{
  const api=createOperatorAppearanceApi({selectGameEntry:()=>{throw Error('must not read');}});
  for(const query of ['operator=north&operator=south','operator=north&table=x&table=y','operator=north&private=yes','table=one','operator=../other','operator=north&lane=bad/path'])assert.equal((await api(req(query))).status,400);
  assert.equal((await api(req(undefined,'POST'))).status,405);
  assert.equal(await api(new Request('https://game.test/api/other')),null);
});
test('denies unavailable, foreign, missing or stale fallback package contexts',async()=>{
  for(const selected of [{status:404},{status:200,selection:{operator:'south',roomId:'table-one',packageRevision:4}},{status:200,selection:{operator:'north',roomId:'other',packageRevision:4}},{status:200,selection:{operator:'north'}},null]){
    const api=createOperatorAppearanceApi({selectGameEntry:async()=>selected});assert.ok([404,503].includes((await api(req())).status));
  }
});
