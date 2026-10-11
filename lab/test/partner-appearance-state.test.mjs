import test from 'node:test';
import assert from 'node:assert/strict';
import {appearanceBranding, appearanceDraftRevision, appearanceReview, changeAppearance, resetAppearanceRoom, sameAppearance} from '../components/partner-appearance-state.mjs';
test('editable projection excludes N1 metadata and unused branding, preserves independent rooms',()=>{
  assert.deepEqual(appearanceBranding({lane:'main',logo:'never-live',composition:{secret:true},roomOverrides:{vip:{dealer:'vera',lane:'foreign',logo:'no'},main:{table:'table-a'}}}),{lane:'main',roomOverrides:{main:{table:'table-a'},vip:{dealer:'vera'}}});
  assert.equal(sameAppearance({color:'#112233',dealer:'vera'},{dealer:'vera',color:'#112233'}),true);
});
test('tombstone draft revision remains monotonic after publish and controls the next CAS',()=>{
  assert.equal(appearanceDraftRevision({draft:null,draftRevision:8}),8);
  assert.equal(appearanceDraftRevision({draft:{revision:9},draftRevision:9}),9);
});
test('room reset removes only its own override without mutating the source',()=>{
  const input={color:'#112233',roomOverrides:{main:{color:'#445566'},vip:{dealer:'vera'}}};
  assert.deepEqual(resetAppearanceRoom(input,'main'),{color:'#112233',roomOverrides:{vip:{dealer:'vera'}}});assert.equal(input.roomOverrides.main.color,'#445566');
  assert.deepEqual(changeAppearance(input,{roomId:'vip',key:'lane',selection:'forbidden'}),input);
});
test('global lane change clears mismatched layer choices but preserves room overrides',()=>{
  assert.deepEqual(changeAppearance({lane:'first',color:'#112233',dealer:'vera',roomOverrides:{vip:{dealer:'astrid'}}},{key:'lane',selection:'next'}),{lane:'next',roomOverrides:{vip:{dealer:'astrid'}}});
});
test('review rejects malformed or mismatched records before publication can be offered',()=>{
  const expected={draftRevision:4,packageRevision:8,branding:{color:'#112233'}},base={...expected,reviewToken:'token',changes:[{roomId:null,key:'color',before:null,after:'#112233'}],affectedRooms:['main']};
  assert.equal(appearanceReview(base,expected),true);
  for(const changed of [{draftRevision:3},{branding:{color:'#445566'}},{changes:[{roomId:null,key:'unsafe',before:null,after:'x'}]},{affectedRooms:[3]}])assert.equal(appearanceReview({...base,...changed},expected),false);
});
