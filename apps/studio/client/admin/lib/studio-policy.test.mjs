import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedProject,addDealer,addVariant,validateProject,allowedPathDescriptors } from '../../../../../packages/presentation/contracts/studio-model.mjs';
import { idleRotationSource } from '../../../lib/idle-rotation-sources.mjs';
import { kindForEvent } from '../../../../../packages/presentation/contracts/video-intake.mjs';
import { clipSlots } from './connected-studio.mjs';
import { addStudioIdleClip,applyStudioIdlePolicy,applyStudioVariantPolicy,setStudioBaseWeight,studioPolicyContext,studioClipUsage,applyStudioIdleVariantPolicy,applyStudioIdleEventRule,studioIdleEventRule,IDLE_EVENT_RULES } from './studio-policy.mjs';
import {selectRegisteredIdleRule} from '../../../../../services/game/presentation-selection.mjs';

const ids=[1,2,3,4,5,6].map(number=>`${String(number).repeat(8)}-${String(number).repeat(4)}-4${String(number).repeat(3)}-8${String(number).repeat(3)}-${String(number).repeat(12)}`);

// The real Admin kit (components/ui), compiled like the panel.
async function adminKit(require) {
  const {readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm'),cache=new Map();
  const load=name=>{
    if(cache.has(name))return cache.get(name).exports;
    const module={exports:{}};cache.set(name,module);
    runInNewContext(require('esbuild').transformSync(readFileSync(new URL(`../components/ui/${name}.tsx`,import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,
      {module,exports:module.exports,require:dependency=>dependency==='./kit'?load('kit'):require(dependency)});
    return module.exports;
  };
  return name=>load(name.slice(name.lastIndexOf('/')+1));
}
// Renders the real panel with inert hooks. Edits are recorded, local state is not.
async function policyPanel() {
  const {createRequire}=await import('node:module'),{readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');
  const require=createRequire(import.meta.url),React=require('react'),policy=await import('./studio-policy.mjs'),kit=await adminKit(require);
  const module={exports:{}},hooks={...React,useState:value=>[value,()=>{}],useRef:value=>({current:value}),useEffect(){}};
  runInNewContext(require('esbuild').transformSync(readFileSync(new URL('../components/studio/studio-policy-panel.tsx',import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,
    {module,exports:module.exports,require:name=>name==='react'?hooks:name.startsWith('../ui/')?kit(name):name==='../../lib/studio-policy.mjs'?policy:name.includes('idle-video-duration')?{readIdleVideoDuration(){assert.fail('Original duration is verified without a new media request');}}:name.includes('video-intake')?require('../../../../../packages/presentation/contracts/video-intake.mjs'):require(name)});
  return module.exports.StudioPolicyPanel;
}
const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
// The panel's own hook-free parts render in place; kit controls stay elements with their props.
const PANEL_PARTS=new Set(['BehaviourClip','RotationClipRule','DescriptionField']);
const rendered=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(rendered)
  :typeof node.type==='function'&&PANEL_PARTS.has(node.type.name)?rendered(node.type(node.props)):[node,...rendered(node.props?.children)];
const text=node=>node==null?'':Array.isArray(node)?node.map(text).join(''):typeof node==='object'?text(node.props?.children):String(node);
const button=(tree,label)=>nodes(tree).find(row=>row.type==='button'&&text(row)===label);
const clipBox=(tree,id)=>nodes(nodes(tree).find(row=>row.type==='label'&&text(row).startsWith(id+' ·'))).find(row=>row.type==='input');
// Native /videos has registered clips without a derived idle family.
function idleBank(dealerId,clips) {
  const project=addDealer(createSeedProject(),dealerId,dealerId.toUpperCase());
  const inventory={families:[],videos:clips.map((take,index)=>({id:`${dealerId==='paow'?'00000000':'11111111'}-0000-4000-8000-${String(index+1).padStart(12,'0')}`,
    dealer:dealerId,label:take.id,fileName:take.id+'.mp4',available:true,integrity:'verified',previewUrl:'/studio/api/videos/'+take.id,
    sha256:take.sha256,bytes:take.bytes,classification:{dealerId,eventId:'idle.ready',kind:'idle',role:index?'alternative':'standard',playback:'once',situation:'',label:take.id,notes:'',compositing:{mode:'green-screen',threshold:.2,softness:.1,despill:0}}}))};
  const slot=clipSlots(project,inventory,dealerId).find(row=>row.eventId==='idle.ready');
  return {project:addStudioIdleClip(project,inventory,dealerId,slot,inventory.videos[0].id,1625,true),inventory,dealerId,slot};
}

test('the idle panel binds each dealer\'s whole frozen source through its button and protects unavailable or blocked edits',async()=>{
  const Panel=await policyPanel();
  for(const dealerId of ['paow','dragan']) {
    const source=idleRotationSource(dealerId),total=source.clips.length,label=`Koppla ${total} viloklipp`;
    const {project:saved,inventory,slot}=idleBank(dealerId,source.clips),changes=[];
    const props={project:saved,inventory,dealerId,slot,blocked:false,onEdit:next=>changes.push(next)},render=patch=>Panel({...props,...patch});
    const first=render({});assert.match(text(first),new RegExp(`${total} av ${total} original finns i biblioteket \\(källa de31659c\\)`));
    assert.equal(nodes(first).filter(row=>row.type==='input'&&row.props.type==='checkbox').length,total);
    assert.equal(clipBox(first,'andas').props.disabled,true,'the baseline is always part of the sequence');
    const bind=button(first,label);assert.ok(bind);assert.equal(bind.props.disabled,false);assert.equal(changes.length,0);
    bind.props.onClick();assert.equal(changes.length,1);
    const next=validateProject(JSON.parse(JSON.stringify(changes[0]))),rotation=next.dealerIdlePolicies.find(row=>row.dealerId===dealerId).policy;
    assert.equal(rotation.rotation.clips.length,total);assert.equal(rotation.variants.length,total-1);assert.deepEqual(next.lines,saved.lines);
    assert.deepEqual(next.idlePolicy,saved.idlePolicy);assert.equal(saved.dealerIdlePolicies[0].policy.variants.length,0);
    const active=render({project:next});assert.match(text(active),new RegExp(`${total} klipp är kopplade`));assert.equal(nodes(active).some(row=>row.type==='select'),false);
    assert.equal(button(active,label),undefined);assert.equal(button(active,'Uppdatera till urvalet'),undefined);
    button(active,'Återgå till enbart basklippet').props.onClick();assert.equal(changes[1].dealerIdlePolicies[0].policy.rotation,undefined);
    assert.equal(changes[1].dealerIdlePolicies[0].policy.variants.length,0);
    for(const patch of [{blocked:true},{inventory:{...inventory,videos:inventory.videos.slice(1)}}]){
      const before=changes.length,blocked=button(render(patch),label);assert.equal(blocked.props.disabled,true);blocked.props.onClick();assert.equal(changes.length,before);
    }
  }
});

test('a saved sequence changes by subset; the last exit from clasped hands is refused and missing media is named',async()=>{
  const Panel=await policyPanel(),source=idleRotationSource('paow');
  const {project:saved,inventory,dealerId,slot}=idleBank('paow',source.clips),changes=[];
  const render=project=>Panel({project,inventory,dealerId,slot,blocked:false,onEdit:next=>changes.push(next)});
  button(render(saved),'Koppla 21 viloklipp').props.onClick();
  const clips=project=>project.dealerIdlePolicies[0].policy.rotation.clips.map(row=>inventory.videos.find(video=>video.id===row.videoId).label);
  clipBox(render(changes[0]),'knapput5101').props.onChange({target:{checked:false}});
  assert.equal(changes.length,2);assert.equal(clips(validateProject(structuredClone(changes[1]))).includes('knapput5101'),false);assert.equal(clips(changes[1]).length,20);
  const fewer=render(changes[1]);assert.equal(clipBox(fewer,'knapput5101').props.checked,false);assert.match(text(fewer),/20 klipp är kopplade/);
  clipBox(fewer,'knapput5102').props.onChange({target:{checked:false}});assert.equal(changes.length,2,'clasped hands without an exit are never saved');
  clipBox(fewer,'knapput5101').props.onChange({target:{checked:true}});assert.equal(clips(changes[2]).length,21);
  // Dragan before his originals are uploaded: an older idle is the base, every source clip is named missing and nothing binds.
  const dragan=idleBank('dragan',[{id:'breath',sha256:'d'.repeat(64),bytes:4096}]),draganChanges=[];
  const tree=Panel({...dragan,blocked:false,onEdit:next=>draganChanges.push(next)});
  assert.match(text(tree),/0 av 16 original finns i biblioteket/);assert.match(text(tree),/16 valda original saknas i biblioteket eller har ändrats: andas, djupandetag/);
  assert.match(text(nodes(tree).find(row=>row.type==='label'&&text(row).startsWith('knappin5101 ·'))),/vila → knäppta händer · insatsfas · lugn · saknas i biblioteket/);
  const blocked=button(tree,'Koppla 16 viloklipp');assert.equal(blocked.props.disabled,true);blocked.props.onClick();assert.equal(draganChanges.length,0);
});

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
test('frequency is no editable policy field, not even in a deal family',()=>{
  for(const f of [fixture(),fixture('deal.player.left','box0')])
    assert.throws(()=>applyStudioVariantPolicy(f.project,f.inventory,f.dealerId,f.slot,ids[1],{frequencyPercent:10}),/Okända policyfält/);
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

test('usage exposes exact automatic timing, manual status and OpenClaw with its description',()=>{
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
  assert.match(studioClipUsage(project,f.inventory,f.dealerId,f.slot,ids[1]).rules[0],/OpenClaw kan föreslå klippet vid tur eller resultat när/);
  policy.variants[0].description='ler mot spelaren';
  assert.deepEqual(studioClipUsage(project,f.inventory,f.dealerId,f.slot,ids[1]).rules.slice(1),['Beskrivning för OpenClaw: ler mot spelaren']);
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
  const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),policy=await import('./studio-policy.mjs'),kit=await adminKit(require);
  const module={exports:{}};
  runInNewContext(require('esbuild').transformSync(readFileSync(new URL('../components/studio/studio-policy-panel.tsx',import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,
    {module,exports:module.exports,require:name=>name.startsWith('../ui/')?kit(name):name==='../../lib/studio-policy.mjs'?policy:name.includes('idle-video-duration')?{readIdleVideoDuration(){throw Error('No duration read while rendering');}}:name.includes('video-intake')?require('../../../../../packages/presentation/contracts/video-intake.mjs'):require(name)});
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

test('idle rule view lists the four start modes and reads the schedule in plain language',async()=>{
  const {createRequire}=await import('node:module'),{readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');
  const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),policy=await import('./studio-policy.mjs'),kit=await adminKit(require);
  const module={exports:{}};
  runInNewContext(require('esbuild').transformSync(readFileSync(new URL('../components/studio/studio-policy-panel.tsx',import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,
    {module,exports:module.exports,require:name=>name.startsWith('../ui/')?kit(name):name==='../../lib/studio-policy.mjs'?policy:name.includes('idle-video-duration')?{readIdleVideoDuration(){throw Error('No duration read while rendering');}}:name.includes('video-intake')?require('../../../../../packages/presentation/contracts/video-intake.mjs'):require(name)});
  const f=fixture('idle.ready','',false);f.inventory.videos.forEach(video=>video.dealer=f.dealerId);
  let project=addStudioIdleClip(f.project,f.inventory,f.dealerId,f.slot,ids[0],1000,true);
  project=addStudioIdleClip(project,f.inventory,f.dealerId,f.slot,ids[1],1000,false);
  project=applyStudioIdleVariantPolicy(project,f.inventory,f.dealerId,f.slot,ids[1],{use:'automatic',automatic:{averageEveryMs:25000,jitterMs:7000,cooldownMs:15000,maxPerMinute:3}});
  const html=renderToStaticMarkup(React.createElement(module.exports.StudioPolicyPanel,{...f,project,blocked:false,onEdit(){assert.fail('render must not write');}}));
  assert.match(html,/Körregler · Vila/);assert.match(html,/Basloop/);assert.match(html,/Beteendeklipp/);assert.match(html,/Huvudklipp/);
  for(const label of ['Av','Ibland · intervall','Vid spelhändelse','OpenClaw'])assert.ok(html.includes('>'+label+'</button>'),label);
  assert.match(html,/aria-pressed="true">Ibland · intervall</);
  assert.match(html,/Spelas i snitt var 25:e sekund, ± 7 s. Minst 15 s paus och högst 3 gånger per minut/);
  assert.match(html,/value="25"/);assert.match(html,/value="7"/);assert.match(html,/value="15"/);
  assert.match(html,/Lägg till som beteendeklipp/);
  assert.equal(module.exports.scheduleSummary({averageEveryMs:20000,jitterMs:0,cooldownMs:0,maxPerMinute:1}),'Spelas i snitt var 20:e sekund. Högst 1 gång per minut. Spelhändelser kan skjuta upp starten.');
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

// OpenClaw in the sequence: a saved clip at rest gets the choice and a description of at most 80 characters.
test('a saved sequence clip at rest can be left to OpenClaw with a description; the choice survives a new subset',async()=>{
  const Panel=await policyPanel(),source=idleRotationSource('paow');
  const {project:saved,inventory,dealerId,slot}=idleBank('paow',source.clips),changes=[];
  const render=project=>Panel({project,inventory,dealerId,slot,blocked:false,onEdit:next=>changes.push(next)});
  const toggle=(tree,id)=>rendered(tree).find(row=>row.props?.['aria-label']===`OpenClaw får föreslå ${id}`);
  const field=(tree,id)=>rendered(tree).find(row=>row.props?.['aria-label']===`Vad ${id} visar`);
  const variant=(project,id)=>project.dealerIdlePolicies[0].policy.variants.find(row=>row.videoId===inventory.videos.find(video=>video.label===id).id);
  assert.equal(toggle(render(saved),'djupandetag'),undefined,'no choice before the sequence is bound');
  button(render(saved),'Koppla 21 viloklipp').props.onClick();
  const bound=render(changes[0]);
  for(const id of ['andas','knappin5101','knappandas5101','knapput5101'])assert.equal(toggle(bound,id),undefined,id+' is the base or leaves rest');
  for(const id of ['djupandetag','blickvanster','plattandas5101'])assert.equal(toggle(bound,id).props.checked,false,id);
  assert.equal(field(bound,'djupandetag'),undefined,'the description belongs to an OpenClaw clip');
  toggle(bound,'djupandetag').props.onCheckedChange(true);
  const chosen=validateProject(structuredClone(changes[1]));assert.equal(variant(chosen,'djupandetag').use,'openclaw');
  const open=render(chosen);assert.equal(toggle(open,'djupandetag').props.checked,true);
  const input=field(open,'djupandetag');assert.equal(input.props.value,'djupandetag');assert.equal(input.props.maxLength,80);
  input.props.onChange({target:{value:'tar ett djupt andetag och sänker axlarna'}});
  assert.equal(variant(changes[2],'djupandetag').description,'tar ett djupt andetag och sänker axlarna');
  input.props.onChange({target:{value:'x'.repeat(120)+'\n'}});assert.equal(variant(changes[3],'djupandetag').description,'x'.repeat(80));
  input.props.onChange({target:{value:'   '}});assert.equal(Object.hasOwn(variant(changes[4],'djupandetag'),'description'),false);
  // Leaving a clip out of the sequence keeps the other clips' choices and descriptions.
  clipBox(render(changes[2]),'fingrar').props.onChange({target:{checked:false}});
  const fewer=validateProject(structuredClone(changes[5]));
  assert.deepEqual([variant(fewer,'djupandetag').use,variant(fewer,'djupandetag').description],['openclaw','tar ett djupt andetag och sänker axlarna']);
  assert.equal(fewer.dealerIdlePolicies[0].policy.rotation.clips.length,20);
  toggle(render(fewer),'djupandetag').props.onCheckedChange(false);assert.equal(variant(changes[6],'djupandetag').use,'rotation');
  assert.match(studioClipUsage(fewer,inventory,dealerId,slot,variant(fewer,'djupandetag').videoId).rules.join(' '),/ingår också i vilosekvensen\. Beskrivning för OpenClaw: tar ett djupt/i);
  assert.equal(studioClipUsage(fewer,inventory,dealerId,slot,variant(fewer,'blickvanster').videoId).rules[0],'Ingår i vilosekvensen.');
});

test('a sequence clip a game rule proposes keeps its rule: shown as Regler, without the OpenClaw switch',async()=>{
  const Panel=await policyPanel(),source=idleRotationSource('paow');
  const {project:saved,inventory,dealerId,slot}=idleBank('paow',source.clips),changes=[];
  const render=project=>Panel({project,inventory,dealerId,slot,blocked:false,onEdit:next=>changes.push(next)});
  const toggle=(tree,id)=>rendered(tree).find(row=>row.props?.['aria-label']===`OpenClaw får föreslå ${id}`);
  const videoId=id=>inventory.videos.find(video=>video.label===id).id;
  button(render(saved),'Koppla 21 viloklipp').props.onClick();
  const ruled=structuredClone(changes[0]);
  ruled.dealerIdlePolicies[0].policy.variants.find(row=>row.videoId===videoId('fingrar')).use='rules';
  const tree=render(validateProject(ruled));
  assert.equal(toggle(tree,'fingrar'),undefined,'the switch never turns a rule into OpenClaw or the sequence');
  assert.match(text(rendered(tree)),/Regler · en spelregel får föreslå klippet\./);
  assert.equal(toggle(tree,'djupandetag').props.checked,false,'other clips at rest keep the switch');
  assert.equal(changes.length,1);
});

test('an OpenClaw behaviour clip outside a sequence gets the same description field',async()=>{
  const Panel=await policyPanel(),f=fixture('idle.ready','',false),changes=[];
  let project=addStudioIdleClip(f.project,f.inventory,f.dealerId,f.slot,ids[0],1000,true);
  project=addStudioIdleClip(project,f.inventory,f.dealerId,f.slot,ids[1],1000,false);
  const render=value=>Panel({...f,project:value,blocked:false,onEdit:next=>changes.push(next)});
  const describe=tree=>rendered(tree).find(row=>typeof row.props?.['aria-label']==='string'&&row.props['aria-label'].startsWith('Vad ')&&row.props.maxLength===80);
  assert.equal(describe(render(project)),undefined);
  rendered(render(project)).find(row=>row.type==='button'&&text(row)==='OpenClaw').props.onClick();
  const openclaw=changes[0];assert.equal(openclaw.dealerIdlePolicies[0].policy.variants[0].use,'openclaw');
  describe(render(openclaw)).props.onChange({target:{value:'blinkar åt spelaren'}});
  assert.equal(validateProject(structuredClone(changes[1])).dealerIdlePolicies[0].policy.variants[0].description,'blinkar åt spelaren');
});
