import test from 'node:test';
import assert from 'node:assert/strict';
import {MATERIALS,materialById,materialSource,materialForAsset,materialFitsGame} from '../web/public/material-catalog.mjs';
test('supplied table designs have unique portable IDs and retain canonical names',()=>{
  assert.equal(new Set(MATERIALS.map(row=>row.id)).size,MATERIALS.length);
  assert.deepEqual(MATERIALS.filter(row=>row.role==='table').map(row=>row.label),['Blackjack · grön filt','Blackjack · svart filt']);
  assert.equal(materialById('missing'),null);
});
test('registered layer UUIDs bind by exact immutable media identity, not names',()=>{
  const source=materialSource('blackjack-green-felt');
  const asset={id:'11111111-1111-4111-8111-111111111111',role:'table',label:'legacy label',...source};
  assert.equal(materialForAsset(asset).id,'blackjack-green-felt');
  for(const patch of [{sha256:'0'.repeat(64)},{size:source.size-1},{width:1920},{role:'background'},{contentType:'image/jpeg'}])assert.equal(materialForAsset({...asset,...patch}),null);
  assert.equal(materialForAsset({...asset,sha256:'0'.repeat(64),label:'Blackjack · grön filt'}),null);
});
test('a blackjack table cannot acquire Roulette eligibility from its label',()=>{
  const asset={role:'table',...materialSource('blackjack-black-felt')};
  assert.equal(materialFitsGame(asset,'blackjack'),true);assert.equal(materialFitsGame(asset,'roulette'),false);
});
