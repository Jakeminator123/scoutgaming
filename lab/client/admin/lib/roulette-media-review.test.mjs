import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {setImmediate} from 'node:timers/promises';
import {rouletteReviewForm,rouletteReviewMetadata,saveRouletteReview} from './roulette-media-review.mjs';
const video=()=>({id:'11111111-1111-4111-8111-111111111111',sha256:'a'.repeat(64),available:true,integrity:'verified',contentType:'video/webm',classification:{dealerId:'astrid',game:'roulette',eventId:'roulette.wheel-start',situation:'wheel-start',action:'wheel-start',kind:'action',role:'standard',label:'Anna start',notes:'',playback:'once',startPose:'unverified',endPose:'unverified',compositing:{mode:'alpha'}}});
const reviewed={startPose:'VILA',endPose:'VILA',scale:'1',x:'.12',y:'0'};
test('review leaves poses unverified and framing blank until explicit input',()=>{
  assert.deepEqual(rouletteReviewForm(video()),{startPose:'unverified',endPose:'unverified',scale:'',x:'',y:''});
  assert.throws(()=>rouletteReviewMetadata(video(),'astrid',rouletteReviewForm(video())),/Ange granskad inramning/);
  for(const patch of [{x:''},{scale:'NaN'},{y:'3'},{startPose:'inferred'}])assert.throws(()=>rouletteReviewMetadata(video(),'astrid',{...reviewed,...patch}));
  const original=video();assert.throws(()=>rouletteReviewMetadata(original,'vera',reviewed));assert.equal(original.classification.startPose,'unverified');
});
test('review saves through real metadata CAS route and rechecks exact hash and classification',async()=>{
  const input=video(),before=structuredClone(input);let calls=0;
  const fetchImpl=async(url,options)=>{calls++;assert.equal(url,'/studio/api/videos/classify');assert.equal(options.method,'POST');assert.equal(options.credentials,'same-origin');
    const body=JSON.parse(options.body);assert.equal(body.sha256,input.sha256);assert.deepEqual(body.previous,input.classification);assert.equal(body.metadata.startPose,'VILA');assert.deepEqual(body.metadata.framing,{scale:1,x:.12,y:0});
    return Response.json({videos:[{...input,classification:{...body.metadata,framing:{y:0,x:.12,scale:1}}}]});};
  const saved=await saveRouletteReview(input,'astrid',reviewed,{fetchImpl});assert.equal(calls,1);assert.equal(saved.videos[0].classification.endPose,'VILA');assert.deepEqual(input,before);
  await assert.rejects(saveRouletteReview(input,'astrid',reviewed,{fetchImpl:async()=>Response.json({error:'conflict'},{status:409})}),/ändrats/);
  for(const patch of [{sha256:'b'.repeat(64)},{classification:input.classification}])await assert.rejects(saveRouletteReview(input,'astrid',reviewed,{fetchImpl:async()=>Response.json({videos:[{...saved.videos[0],...patch}]})}),/återläsas exakt/);
});
test('same review applies to idle but never reclassifies blackjack or another person',async()=>{
  const idle=video();Object.assign(idle.classification,{eventId:'roulette.idle',action:'breathing',situation:'breathing',kind:'idle'});
  assert.equal(rouletteReviewMetadata(idle,'astrid',reviewed).eventId,'roulette.idle');
  for(const mutate of [row=>row.classification.game=undefined,row=>row.available=false,row=>delete row.sha256,row=>row.classification.compositing={mode:'opaque'},row=>row.contentType='video/mp4']){
    const row=video();mutate(row);await assert.rejects(saveRouletteReview(row,'astrid',reviewed,{fetchImpl:()=>assert.fail('must fail before network')}));
  }
});

test('review form saves explicit inputs and normalizes readback without leaving a false unsaved state',async()=>{
  const require=createRequire(import.meta.url),React=require('react'),module={exports:{}},states=[],effects=[],queue=[];let cursor=0;
  const nodes=(node,predicate)=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(child=>nodes(child,predicate)):[...(predicate(node)?[node]:[]),...nodes(node.props?.children,predicate)];
  const hooks={...React,useState(initial){const index=cursor++;if(!(index in states))states[index]=typeof initial==='function'?initial():initial;return [states[index],value=>states[index]=typeof value==='function'?value(states[index]):value];},
    useRef(value){const index=cursor++;return states[index]??={current:value};},useEffect(callback,deps){const index=cursor++;if(!effects[index]||deps.some((value,i)=>value!==effects[index].deps[i]))queue.push(()=>{effects[index]?.cleanup?.();effects[index]={deps,cleanup:callback()};});}};
  const source=readFileSync(new URL('../components/studio/roulette-media-review.tsx',import.meta.url),'utf8');
  const saved=[],dirty=[],busy=[];
  const props={video:video(),dealerId:'astrid',blocked:false,onDirtyChange:value=>dirty.push(value),onBusyChange:value=>busy.push(value),onSaved:inventory=>{saved.push(inventory);props.video=inventory.videos[0];}};
  runInNewContext(require('esbuild').transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,AbortController,require:name=>name==='react'?hooks:name.endsWith('/roulette-media-review.mjs')?{rouletteReviewForm,rouletteReviewMetadata,saveRouletteReview:(v,d,f,options)=>saveRouletteReview(v,d,f,{...options,fetchImpl:async(url,request)=>Response.json({videos:[{...v,classification:JSON.parse(request.body).metadata}]})})}:require(name)});
  const render=()=>{cursor=0;const tree=module.exports.RouletteMediaReview(props);while(queue.length)queue.shift()();return tree;};
  try {
    const tree=render();for(const select of nodes(tree,node=>node.type==='select'))select.props.onChange({target:{value:'VILA'}});
    nodes(tree,node=>node.type==='input').forEach((input,i)=>input.props.onChange({target:{value:['1','.12','0'][i]}}));
    let button=nodes(render(),node=>node.type==='button')[0];assert.equal(button.props.disabled,false);assert.equal(dirty.at(-1),true);
    button.props.onClick();await setImmediate();button=nodes(render(),node=>node.type==='button')[0];
    assert.equal(saved.length,1);assert.equal(dirty.at(-1),false);assert.equal(button.props.disabled,true);
    assert.equal(props.video.classification.framing.x,.12);assert.deepEqual(busy,[true,false]);
  } finally{effects.forEach(effect=>effect?.cleanup?.());}
});
