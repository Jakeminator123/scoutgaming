import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedProject,addVariant,validateProject,allowedPathDescriptors } from '../../../../lab/lib/studio-model.mjs';
import { kindForEvent } from '../../../../lab/lib/video-intake.mjs';
import { clipSlots } from './connected-studio.mjs';
import { addStudioIdleClip,applyStudioIdlePolicy,applyStudioVariantPolicy,setStudioBaseWeight,studioPolicyContext } from './studio-policy.mjs';

const ids=[1,2,3,4,5,6].map(number=>`${String(number).repeat(8)}-${String(number).repeat(4)}-4${String(number).repeat(3)}-8${String(number).repeat(3)}-${String(number).repeat(12)}`);
function fixture(eventId='transition.shoe',situation='to-shoe',managed=true){
  const project=createSeedProject(),dealerId='astrid',event=project.events.find(row=>row.id===eventId);
  const descriptor=allowedPathDescriptors.find(row=>row.values?.length&&row.operators.includes('eq'));
  project.triggers.push({id:'policy.test.trigger',label:'Testvillkor',category:descriptor.category,path:descriptor.path,op:'eq',value:descriptor.values[0]});
  const family={id:`${dealerId}/${eventId}/${situation||'ready'}`,dealerId,eventId,situation:situation||'ready',playbackType:eventId==='idle.ready'?'idle-pool':'once',standardIds:[ids[0]],variantIds:ids.slice(1)};
  const inventory={videos:ids.map((id,index)=>({id,label:`Klipp ${index+1}`,available:true,integrity:'verified',previewUrl:'/studio/api/videos/'+id,
    ...(managed?{familyId:family.id}:{}),classification:{label:`Klipp ${index+1}`,dealerId,eventId,kind:kindForEvent(event),role:index?'alternative':'standard',situation,playback:'once',notes:'',compositing:{mode:'opaque'}}})),families:managed?[family]:[]};
  const slot=clipSlots(project,inventory,dealerId).find(row=>managed?row.family?.id===family.id:row.eventId===eventId&&row.situation===situation);
  return {project,inventory,dealerId,family,slot};
}
test('managed policy edits preserve unrelated families, triggers, priority and original project',()=>{
  const f=fixture(), trigger=f.project.triggers[0].id;
  f.project.mediaPolicy=[{familyId:f.family.id,variants:[{videoId:ids[1],selection:{rules:true,model:false,random:false},priority:37,triggerIds:[trigger]}]},
    {familyId:'astrid/transition.shoe/from-shoe',variants:[{videoId:ids[2],selection:{rules:false,model:true,random:false},priority:81,triggerIds:[]}]}];
  const before=structuredClone(f.project),next=applyStudioVariantPolicy(f.project,f.inventory,f.dealerId,f.slot,ids[1],{selection:{rules:true,model:true,random:false}});
  assert.deepEqual(f.project,before);
  assert.equal(next.mediaPolicy[0].variants[0].priority,37);assert.deepEqual(next.mediaPolicy[0].variants[0].triggerIds,[trigger]);
  assert.deepEqual(next.mediaPolicy[1],before.mediaPolicy[1]);assert.deepEqual(next.lines,before.lines);
});
test('family policy rejects another exact situation, the standard and invalid trigger/priority/type',()=>{
  const f=fixture();
  assert.throws(()=>applyStudioVariantPolicy(f.project,f.inventory,f.dealerId,f.slot,ids[0],{priority:3}),/alternativ/);
  assert.throws(()=>applyStudioVariantPolicy(f.project,f.inventory,f.dealerId,{...f.slot,situation:'from-shoe'},ids[1],{priority:3}),/Kortplats/);
  assert.throws(()=>applyStudioVariantPolicy(f.project,f.inventory,f.dealerId,f.slot,ids[1],{triggerIds:['invented.trigger']}));
  assert.throws(()=>applyStudioVariantPolicy(f.project,f.inventory,f.dealerId,f.slot,ids[1],{priority:101}));
  f.family.playbackType='unknown';assert.throws(()=>studioPolicyContext(f.project,f.inventory,f.dealerId,f.slot),/Mediefamilj/);
});
test('unavailable, archived and different-dealer videos cannot acquire a policy',()=>{
  for(const change of [video=>video.available=false,video=>video.classification.archived=true,video=>video.classification.dealerId='vera',video=>video.classification.kind='unknown']){
    const f=fixture();change(f.inventory.videos[1]);
    assert.throws(()=>applyStudioVariantPolicy(f.project,f.inventory,f.dealerId,f.slot,ids[1],{priority:3}),/tillgängligt alternativ/);
  }
});
test('Astrid deal percentages retain exact slots and reject totals over 100 or a fifth active variant',()=>{
  const f=fixture('deal.player.left','box0');
  let next=applyStudioVariantPolicy(f.project,f.inventory,f.dealerId,f.slot,ids[1],{frequencyPercent:61});
  next=applyStudioVariantPolicy(next,f.inventory,f.dealerId,f.slot,ids[2],{frequencyPercent:39});
  assert.equal(next.mediaPolicy[0].variants.reduce((sum,row)=>sum+row.frequencyPercent,0),100);
  assert.throws(()=>applyStudioVariantPolicy(next,f.inventory,f.dealerId,f.slot,ids[2],{frequencyPercent:40}),/100/);
  assert.throws(()=>applyStudioVariantPolicy(next,f.inventory,f.dealerId,f.slot,ids[1],{frequencyPercent:1.5}));
  assert.throws(()=>applyStudioVariantPolicy(next,f.inventory,f.dealerId,f.slot,ids[1],{selection:{rules:true,model:false,random:false}}),/frekvenser/);
  next=f.project;for(const id of ids.slice(1,5))next=applyStudioVariantPolicy(next,f.inventory,f.dealerId,f.slot,id,{frequencyPercent:20});
  assert.throws(()=>applyStudioVariantPolicy(next,f.inventory,f.dealerId,f.slot,ids[5],{frequencyPercent:10}),/fyra/);
});
test('frequency cannot leak into a different dealer or non-deal family',()=>{
  const f=fixture();assert.throws(()=>applyStudioVariantPolicy(f.project,f.inventory,f.dealerId,f.slot,ids[1],{frequencyPercent:10}),/Astrid/);
});
test('own idle schema uses supplied measured duration and preserves global policy and other dealer lines',()=>{
  const f=fixture('idle.ready','',false),before=structuredClone(f.project);
  let next=addStudioIdleClip(f.project,f.inventory,f.dealerId,f.slot,ids[0],4321,true);
  next=addStudioIdleClip(next,f.inventory,f.dealerId,f.slot,ids[1],7654,false);
  const policy=next.dealerIdlePolicies[0].policy;
  assert.equal(policy.base[0].durationMs,4321);assert.equal(policy.variants[0].durationMs,7654);
  const automatic={averageEveryMs:27000,jitterMs:4000,cooldownMs:18000,maxPerMinute:2};
  policy.variants[0]={...policy.variants[0],use:'automatic',automatic,description:'Behåll denna notering'};
  next=applyStudioIdlePolicy(next,f.inventory,f.dealerId,f.slot,policy);
  next=addStudioIdleClip(next,f.inventory,f.dealerId,f.slot,ids[2],9876,true);
  assert.deepEqual(next.dealerIdlePolicies[0].policy.variants[0],policy.variants[0]);
  assert.deepEqual(next.idlePolicy,before.idlePolicy);
  assert.deepEqual(next.lines.filter(row=>row.dealerId!=='astrid'),before.lines.filter(row=>row.dealerId!=='astrid'));
  assert.deepEqual(f.project,before);
});
test('idle weights sum to 100 and invalid timing/ownership cannot edit the draft',()=>{
  const f=fixture('idle.ready','',false);
  let next=addStudioIdleClip(f.project,f.inventory,f.dealerId,f.slot,ids[0],2000,true);
  next=addStudioIdleClip(next,f.inventory,f.dealerId,f.slot,ids[1],3000,true);
  const policy=next.dealerIdlePolicies[0].policy,weighted=setStudioBaseWeight(policy,ids[1],43);
  assert.deepEqual(weighted.base.map(row=>row.weight),[57,43]);assert.deepEqual(policy.base.map(row=>row.weight),[99,1]);
  for(const duration of [undefined,199,60001,4042.5])assert.throws(()=>addStudioIdleClip(next,f.inventory,f.dealerId,f.slot,ids[2],duration));
  assert.throws(()=>applyStudioIdlePolicy(next,f.inventory,f.dealerId,f.slot,{...policy,familyId:'vera/idle.ready/ready'}));
  assert.throws(()=>applyStudioIdlePolicy(next,f.inventory,f.dealerId,f.slot,{...policy,base:policy.base.map(row=>({...row,weight:20}))}));
  f.inventory.videos[0].available=false;assert.throws(()=>applyStudioIdlePolicy(next,f.inventory,f.dealerId,f.slot,policy),/schemaklipp/);
});
test('Astrid idle manifest roles remain fixed and malformed automatic policies are rejected',()=>{
  const f=fixture('idle.ready','',true);
  const initial={schemaVersion:1,familyId:f.family.id,base:[{videoId:ids[0],weight:100,durationMs:2000}],variants:[]};
  let next=applyStudioIdlePolicy(f.project,f.inventory,f.dealerId,f.slot,initial);
  assert.throws(()=>addStudioIdleClip(next,f.inventory,f.dealerId,f.slot,ids[1],3000,true),/roller/);
  next=addStudioIdleClip(next,f.inventory,f.dealerId,f.slot,ids[1],3000,false);
  const policy=next.idlePolicy;
  for(const patch of [{use:'unknown',automatic:null},{use:'automatic',automatic:{averageEveryMs:5000,jitterMs:5000,cooldownMs:0,maxPerMinute:1}}]){
    assert.throws(()=>applyStudioIdlePolicy(next,f.inventory,f.dealerId,f.slot,{...policy,variants:[{...policy.variants[0],...patch}]}));
  }
  assert.equal(validateProject(next),next);
});
test('legacy variant policies edit only the exact bound nonstandard clip',()=>{
  const f=fixture('transition.shoe','to-shoe',false);
  f.project=addVariant(f.project,f.dealerId,f.slot.eventId,'Own alternative');
  const line=f.project.lines.find(row=>row.dealerId===f.dealerId&&row.eventId===f.slot.eventId),variant=line.variants.at(-1);
  variant.videoGenerationId=ids[1];variant.priority=38;
  const before=structuredClone(f.project),next=applyStudioVariantPolicy(f.project,f.inventory,f.dealerId,f.slot,variant.id,{triggerIds:[f.project.triggers[0].id],selection:{rules:true,model:false,random:false}});
  assert.equal(next.lines.find(row=>row.dealerId===f.dealerId&&row.eventId===f.slot.eventId).variants.at(-1).priority,38);
  assert.deepEqual(f.project,before);
  assert.throws(()=>applyStudioVariantPolicy(f.project,f.inventory,f.dealerId,f.slot,line.baselineVariantId,{priority:3}),/Standard/);
  assert.throws(()=>applyStudioVariantPolicy(f.project,f.inventory,f.dealerId,{...f.slot,situation:'from-shoe'},variant.id,{priority:3}),/Kortplats/);
});
