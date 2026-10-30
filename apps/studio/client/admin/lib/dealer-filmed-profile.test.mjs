import test from 'node:test';
import assert from 'node:assert/strict';
import {readFilmedProfileFile,importDealerFilmedProfile,MAX_FILMED_PROFILE_BYTES} from './dealer-filmed-profile.mjs';
import {addDealer,createSeedProject} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import {studioCopyProfile} from '../../../../../test/fixtures/native-room-game-material.mjs';

test('profile file parsing bounds input and rejects missing take inventories',async()=>{
  let read=false;
  await assert.rejects(()=>readFilmedProfileFile({size:MAX_FILMED_PROFILE_BYTES+1,text:async()=>{read=true;return '{}';}}),/2 MB/);
  assert.equal(read,false);
  for(const text of ['broken','{}','{"derivedFrom":"seed","takes":[]}'])
    await assert.rejects(()=>readFilmedProfileFile({size:text.length,text:async()=>text}),/profil|filmed_profile/);
  const value={derivedFrom:'seed',takes:[{key:'1:v',sourceTakeKey:'1:base'}]};
  assert.deepEqual(await readFilmedProfileFile({size:100,text:async()=>JSON.stringify(value)}),value);
});

test('import keeps the dealer and revision in one authenticated request and never retries or publishes',async()=>{
  const project=addDealer(createSeedProject(),'factory-test','Factory');
  project.dealers.find(row=>row.id==='factory-test').filmedProfile=studioCopyProfile('factory-test','paow');
  let calls=0;
  const profile={derivedFrom:'seed',takes:[]};
  const saved=await importDealerFilmedProfile('factory-test','revision-before',profile,{fetchImpl:async(url,init)=>{
    calls++;
    assert.equal(url,'/studio/api/dealers/factory-test/filmed-profile');
    assert.equal(init.method,'PUT');assert.equal(init.credentials,'same-origin');assert.equal(init.redirect,'error');
    assert.deepEqual(JSON.parse(init.body),{expectedRevision:'revision-before',profile});
    return Response.json({project});
  }});
  assert.deepEqual(saved,project);assert.equal(calls,1);
  for(const [status,body,pattern] of [
    [409,{code:'studio_conflict'},/senaste revisionen/],
    [503,{code:'studio_presentation_runtime_update_required'},/Spelmotorn behöver uppdateras/],
    [422,{code:'studio_filmed_profile_mismatch',mismatch:[{key:'1:v',reason:'frames'}]},/1:v: mät/],
    [422,{code:'studio_filmed_profile_sha_missing',missing:[{}]},/Ladda upp rätt filer/],
  ]){
    calls=0;
    await assert.rejects(()=>importDealerFilmedProfile('factory-test','revision-before',profile,{fetchImpl:async()=>{calls++;return Response.json(body,{status});}}),pattern);
    assert.equal(calls,1);
  }
});
