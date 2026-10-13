import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeedProject} from '../../../../lab/lib/studio-model.mjs';
import {clipSlots} from './connected-studio.mjs';
import {groupSlots,affectedRooms,slotCaption} from './studio-layout.mjs';

test('visual cards preserve every exact server slot and discover all 17 speech variants',()=>{
  const slots=clipSlots(createSeedProject(),{videos:[]},'astrid'),groups=groupSlots(slots);
  assert.equal(groups.length,8);assert.equal(groups.filter(row=>row.title==='Tal').flatMap(row=>row.slots).length,17);
  assert.equal(groups.find(row=>row.id==='players').slots.length,7);
  assert.deepEqual(groups.flatMap(row=>row.slots).map(row=>row.id).sort(),slots.map(row=>row.id).sort());
  assert.equal(slotCaption(groups.find(row=>row.id==='players').slots[6]),'Plats 7');
});
test('save impact covers shared banks, earlier contexts and only changed compositions',()=>{
  const before=createSeedProject(),after=structuredClone(before);
  const rooms=[{id:'a',dealerIds:['astrid'],compositionId:'one'},{id:'b',dealerIds:['astrid'],compositionId:'two'},{id:'c',dealerIds:['vera'],compositionId:'three'}];
  after.lines.find(row=>row.dealerId==='astrid').variants[0].videoGenerationId='11111111-1111-4111-8111-111111111111';
  assert.deepEqual(affectedRooms(before,after,rooms).map(row=>row.id),['a','b']);
  assert.deepEqual(affectedRooms(before,before,rooms),[]);
});
test('removed family policies remain visible in save impact',()=>{
  const before=createSeedProject(),after=structuredClone(before),rooms=[{id:'a',dealerIds:['astrid'],compositionId:'one'}];
  before.mediaPolicy=[{familyId:'astrid/deal.player.left/box0',variants:[]}];after.mediaPolicy=[];
  assert.deepEqual(affectedRooms(before,after,rooms).map(row=>row.id),['a']);
});
