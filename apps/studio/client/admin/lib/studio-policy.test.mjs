import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedProject,addVariant,validateProject,allowedPathDescriptors } from '../../../../../packages/presentation/contracts/studio-model.mjs';
import { kindForEvent } from '../../../../../packages/presentation/contracts/video-intake.mjs';
import { clipSlots } from './connected-studio.mjs';
import { addStudioIdleClip,applyStudioIdlePolicy,applyStudioVariantPolicy,setStudioBaseWeight,studioPolicyContext,studioClipUsage,applyStudioIdleVariantPolicy,applyStudioIdleEventRule,studioIdleEventRule,IDLE_EVENT_RULES } from './studio-policy.mjs';
import {selectRegisteredIdleRule} from '../../../../../services/game/presentation-selection.mjs';

const ids=[1,2,3,4,5,6].map(number=>`${String(number).repeat(8)}-${String(number).repeat(4)}-4${String(number).repeat(3)}-8${String(number).repeat(3)}-${String(number).repeat(12)}`);

test('idle presets save ordinary event predicates, survive readback and select only matching own behaviour',()=>{
  for(const rule of IDLE_EVENT_RULES){
    const f=fixture('idle.ready','',false);
    f.inventory.videos.forEach(video=>video.dealer=f.dealerId);
    let next=addStudioIdleClip(f.project,f.inventory,f.dealerId,f.slot,ids[0],1000,true);
    next=addStudioIdleClip(next,f.inventory,f.dealerId,f.slot,ids[1],1000,false);
    const before=structuredClone(next);
    next=applyStudioIdleEventRule(next,f.inventory,f.dealerId,f.slot,ids[1],rule.id);
    assert.equal(studioIdleEventRule(next,f.dealerId,ids[1]),rule.id);
    const saved=JSON.parse(JSON.stringify(next));validateProject(saved);
    const sourceEvent=rule.type==='turn'?{type:'turn',box:3,handIndex:0,legalActions:['hit','stand']}
      :{type:'settle',dealerTotal:rule.id==='dealer-bust'?23:18,dealerBlackjack:false,hands:[{box:3,outcome:['blackjack','push','lose'].includes(rule.id)?rule.id:'win'}]};
    assert.equal(selectRegisteredIdleRule({project:saved,dealerId:f.dealerId,sourceEvent,mode:'rules'},{inventory:f.inventory}).videoId,ids[1]);
    assert.equal(selectRegisteredIdleRule({project:saved,dealerId:f.dealerId,sourceEvent:{type:'speak',line:'win'},mode:'rules'},{inventory:f.inventory}),null);
    assert.deepEqual(saved.lines.filter(row=>row.eventId!=='idle.ready'),before.lines.filter(row=>row.eventId!=='idle.ready'));
    assert.deepEqual(next.dealerIdlePolicies[0].policy.base,before.dealerIdlePolicies[0].policy.base);
    assert.throws(()=>applyStudioIdleEventRule(next,f.inventory,f.dealerId,f.slot,ids[0],rule.id),/beteendeklipp/);
  }
});

test('more than four idle behaviours can have rules without changing the speech limit',()=>{
  const f=fixture('idle.ready','',false);
  let next=addStudioIdleClip(f.project,f.inventory,f.dealerId,f.slot,ids[0],1000,true);
  for(const id of ids.slice(1)){
    next=addStudioIdleClip(next,f.inventory,f.dealerId,f.slot,id,1000,false);
    next=applyStudioIdleEventRule(next,f.inventory,f.dealerId,f.slot,id,'turn');
  }
  assert.equal(next.lines.find(row=>row.dealerId===f.dealerId&&row.eventId==='idle.ready').variants.length,6);
});
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


test('usage describes the selected take, never borrowing another bound take or an approximate situation',()=>{
  const f=fixture(),before=structuredClone(f.project);
  assert.equal(studioClipUsage(f.project,f.inventory,f.dealerId,f.slot,ids[0]).configured,true);
  assert.deepEqual(studioClipUsage(f.project,f.inventory,f.dealerId,f.slot,ids[1]).rules,['Vald för prov; inte kopplad i projektutkastet.']);
  assert.equal(studioClipUsage(f.project,f.inventory,f.dealerId,{...f.slot,situation:'from-shoe'},ids[0]).configured,false);
  assert.equal(studioClipUsage(f.project,f.inventory,'vera',f.slot,ids[0]).configured,false);
  assert.deepEqual(f.project,before);
});

test('usage exposes exact automatic timing, manual status and unverified OpenClaw wiring',()=>{
  const f=fixture('idle.ready','',false);
  let project=addStudioIdleClip(f.project,f.inventory,f.dealerId,f.slot,ids[0],4321,true);
  project=addStudioIdleClip(project,f.inventory,f.dealerId,f.slot,ids[1],7654,false);
  const policy=project.dealerIdlePolicies[0].policy;
  assert.match(studioClipUsage(project,f.inventory,f.dealerId,f.slot,ids[0]).rules[0],/100 % av basurvalet · 4,321 s/);
  assert.match(studioClipUsage(project,f.inventory,f.dealerId,f.slot,ids[1]).rules[0],/Endast manuellt/);
  policy.variants[0].use='automatic';policy.variants[0].automatic={averageEveryMs:27000,jitterMs:4000,cooldownMs:18000,maxPerMinute:2};
  const before=structuredClone(project),usage=studioClipUsage(project,f.inventory,f.dealerId,f.slot,ids[1]);
  assert.equal(usage.configured,true);assert.match(usage.rules.join(' '),/var 27 s, variation ±4 s/);assert.match(usage.rules.join(' '),/paus 18 s; högst 2/);
  assert.deepEqual(project,before);
  policy.variants[0].use='openclaw';policy.variants[0].automatic=null;
  assert.match(studioClipUsage(project,f.inventory,f.dealerId,f.slot,ids[1]).rules[0],/inte verifierad/);
  assert.equal(studioClipUsage(project,f.inventory,f.dealerId,f.slot,ids[2]).configured,false);
});

test('usage reports actual predicates and priority even when the default display selection resolves an alternative',()=>{
  const f=fixture('reveal.dealer','dealer-hole',false);
  f.project=addVariant(f.project,f.dealerId,f.slot.eventId,'Egen tagning');
  const line=f.project.lines.find(row=>row.dealerId===f.dealerId&&row.eventId===f.slot.eventId),variant=line.variants.at(-1);
  const trigger=f.project.triggers.find(row=>row.id==='policy.test.trigger');
  variant.videoGenerationId=ids[1];variant.selection={rules:true,model:true,random:false};variant.triggerIds=[trigger.id];variant.priority=38;
  const usage=studioClipUsage(f.project,f.inventory,f.dealerId,f.slot,ids[1],line.baselineVariantId);
  assert.equal(usage.configured,true);assert.match(usage.rules.join(' '),/alla villkor:/);assert.ok(usage.rules.join(' ').includes(String(trigger.value)));
  assert.match(usage.rules.join(' '),/Prioritet 38/);assert.match(usage.rules.join(' '),/inte verifierad/);assert.doesNotMatch(usage.rules.join(' '),/Standard\/reserv/);
  line.variants.find(row=>row.id===line.baselineVariantId).videoGenerationId=ids[1];
  const exact=studioClipUsage(f.project,f.inventory,f.dealerId,f.slot,ids[1],variant.id);
  assert.match(exact.rules.join(' '),/Prioritet 38/);assert.doesNotMatch(exact.rules.join(' '),/Standard\/reserv/);
});

test('saved shoe choices explain publication and the standard-only pose sequence',()=>{
  for(const situation of ['to-shoe','from-shoe']){
    const f=fixture('transition.shoe',situation,false);
    const line=f.project.lines.find(row=>row.dealerId===f.dealerId&&row.eventId===f.slot.eventId);
    line.variants[0].videoGenerationId=ids[0];
    const usage=studioClipUsage(f.project,f.inventory,f.dealerId,f.slot,ids[0]);
    assert.equal(usage.configured,true);
    assert.match(usage.rules.join(' '),/publicerade standardklippet.*känd poskedja/);
    assert.match(usage.rules.join(' '),/alternativ väljs inte automatiskt/);
    assert.equal(studioClipUsage(f.project,f.inventory,f.dealerId,f.slot,ids[1]).configured,false);
  }
});

test('usage keeps exact frequency and unavailable alternatives share as standard fallback',()=>{
  const f=fixture('deal.player.left','box0');
  let project=applyStudioVariantPolicy(f.project,f.inventory,f.dealerId,f.slot,ids[1],{frequencyPercent:61});
  project=applyStudioVariantPolicy(project,f.inventory,f.dealerId,f.slot,ids[2],{frequencyPercent:20});
  f.inventory.videos[2].available=false;
  assert.match(studioClipUsage(project,f.inventory,f.dealerId,f.slot,ids[1]).rules[0],/^61 %/);
  assert.match(studioClipUsage(project,f.inventory,f.dealerId,f.slot,ids[0]).rules[0],/minst 19 %.*Otillgängliga alternativ/);
  assert.equal(studioClipUsage(project,f.inventory,f.dealerId,f.slot,ids[2]).configured,false);
});

test('idle usage flags non-event predicates as disconnected instead of claiming a working trigger',()=>{
  const f=fixture('idle.ready','',false);
  let project=addStudioIdleClip(f.project,f.inventory,f.dealerId,f.slot,ids[0],2000,true);
  project=addStudioIdleClip(project,f.inventory,f.dealerId,f.slot,ids[1],3000,false);
  project.dealerIdlePolicies[0].policy.variants[0].use='rules';
  project=addVariant(project,f.dealerId,f.slot.eventId,'Reaktion');
  const line=project.lines.find(row=>row.dealerId===f.dealerId&&row.eventId===f.slot.eventId),variant=line.variants.at(-1);
  variant.videoGenerationId=ids[1];variant.selection={rules:true,model:false,random:false};
  project.triggers.push({id:'local.state',label:'Vilseledande namn',category:'test',path:'session.count',op:'gte',value:7});variant.triggerIds=['local.state'];
  const usage=studioClipUsage(project,f.inventory,f.dealerId,f.slot,ids[1]);
  assert.match(usage.rules.join(' '),/session.count minst 7/);assert.match(usage.rules.join(' '),/inte ansluten/);assert.doesNotMatch(usage.rules.join(' '),/Vilseledande namn/);
});


test('existing policy panel opens the selected take and never silently edits a different alternative',async()=>{
  const {createRequire}=await import('node:module'),{readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');
  const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),policy=await import('./studio-policy.mjs');
  const module={exports:{}};
  runInNewContext(require('esbuild').transformSync(readFileSync(new URL('../components/studio/studio-policy-panel.tsx',import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,
    {module,exports:module.exports,require:name=>name==='../../lib/studio-policy.mjs'?policy:name.includes('idle-video-duration')?{readIdleVideoDuration(){throw Error('No duration read while rendering');}}:name.includes('video-intake')?require('../../../../../packages/presentation/contracts/video-intake.mjs'):require(name)});
  const f=fixture();f.project=applyStudioVariantPolicy(f.project,f.inventory,f.dealerId,f.slot,ids[2],{priority:43});
  const render=(id,patch={})=>renderToStaticMarkup(React.createElement(module.exports.StudioPolicyPanel,{...f,selectedVideoId:id,blocked:false,onEdit(){assert.fail('render must not write');},...patch}));
  const selected=render(ids[2]);assert.ok(selected.includes(`value="${ids[2]}" selected=""`));assert.match(selected,/value="43"/);
  const standard=render(ids[0]);assert.match(standard,/saknar en redigerbar alternativregel/);assert.doesNotMatch(standard,/value="43"/);
  const missing=render('not-in-this-slot');assert.match(missing,/Välj en alternativ tagning/);assert.doesNotMatch(missing,/type="checkbox"/);
  const own=fixture('transition.shoe','to-shoe',false);
  own.project=addVariant(addVariant(own.project,own.dealerId,own.slot.eventId,'First rule'),own.dealerId,own.slot.eventId,'Second rule');
  const line=own.project.lines.find(row=>row.dealerId===own.dealerId&&row.eventId===own.slot.eventId);
  for(const row of line.variants.slice(-2))row.videoGenerationId=ids[1];
  line.variants.at(-1).priority=62;
  const exact=render(ids[1],{...own,selectedVariantId:line.variants.at(-1).id});
  assert.ok(exact.includes(`value="${line.variants.at(-1).id}" selected=""`));assert.match(exact,/value="62"/);
});


test('switching a custom idle rule off and on preserves its predicates, selection and priority',()=>{
  const f=fixture('idle.ready','',false);
  let project=addStudioIdleClip(f.project,f.inventory,f.dealerId,f.slot,ids[0],1000,true);
  project=addStudioIdleClip(project,f.inventory,f.dealerId,f.slot,ids[1],1000,false);
  project=applyStudioIdleVariantPolicy(project,f.inventory,f.dealerId,f.slot,ids[1],{use:'rules'});
  const variant=project.lines.find(row=>row.dealerId===f.dealerId&&row.eventId==='idle.ready').variants.at(-1);
  variant.triggerIds=['policy.test.trigger'];variant.priority=37;variant.selection.model=true;
  const before=structuredClone(project.lines);
  for(const use of ['manual','automatic','openclaw']){
    const policy=project.dealerIdlePolicies[0].policy;policy.variants[0].use=use;
    policy.variants[0].automatic=use==='automatic'?{averageEveryMs:20000,jitterMs:0,cooldownMs:10000,maxPerMinute:2}:null;
    project=applyStudioIdleVariantPolicy(project,f.inventory,f.dealerId,f.slot,ids[1],{use:'rules',automatic:null});
    assert.deepEqual(project.lines,before);assert.equal(studioIdleEventRule(project,f.dealerId,ids[1]),'');
  }
});

test('specific settlement presets win over generic ones and equal candidates share selection',()=>{
  const f=fixture('idle.ready','',false);f.inventory.videos.forEach(video=>video.dealer=f.dealerId);
  let project=addStudioIdleClip(f.project,f.inventory,f.dealerId,f.slot,ids[0],1000,true);
  for(const [id,rule] of [[ids[1],'settle'],[ids[2],'win'],[ids[3],'win']]){
    project=addStudioIdleClip(project,f.inventory,f.dealerId,f.slot,id,1000,false);
    project=applyStudioIdleEventRule(project,f.inventory,f.dealerId,f.slot,id,rule);
  }
  const sourceEvent={type:'settle',dealerTotal:18,dealerBlackjack:false,hands:[{box:3,outcome:'win'}]};
  const selected=new Set(Array.from({length:20},(_,i)=>selectRegisteredIdleRule({project,dealerId:f.dealerId,sourceEvent,mode:'rules',requestId:'round-'+i},{inventory:f.inventory}).videoId));
  assert.deepEqual(selected,new Set([ids[2],ids[3]]));
});
