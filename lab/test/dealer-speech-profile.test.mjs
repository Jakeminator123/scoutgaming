import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDealerSpeechProfile,validateDealerSpeechReference,dealerSpeechPreparation} from '../../web/public/dealer-speech-profile.mjs';
import {addDealer,createSeedProject,validateProject} from '../lib/studio-model.mjs';
import {createStudioProjectBindings} from '../lib/studio-project-bindings.mjs';
import {captureFrozenRegisteredDealers} from '../../web/storage/frozen-dealer-idle.mjs';
const voice={provider:'elevenlabs',voiceId:'paow-own-voice',modelId:'fixture-model'};
const reference={kind:'video-frame',videoId:'own-idle',sha256:'a'.repeat(64),offsetMs:200};
const profile=()=>({schemaVersion:1,state:'preparation',voice:{...voice},reference:{...reference}});
const video=()=>({id:'own-idle',dealer:'paow',available:true,integrity:'verified',bytes:100,sha256:'a'.repeat(64),duration:3});
test('new registered dealer can persist preparation without changing runtime activation',()=>{
  const project=addDealer(createSeedProject(),'paow','PAOW');
  project.dealers.find(row=>row.id==='paow').speechProfile=profile();
  assert.equal(validateProject(project),project);
  assert.equal(dealerSpeechPreparation(profile()).active,false);
  assert.deepEqual(dealerSpeechPreparation(undefined).missing,['röstprofil','referensvideo']);
  const incomplete={schemaVersion:1,state:'preparation',voice:null,reference:null};
  assert.deepEqual(normalizeDealerSpeechProfile(incomplete),incomplete);
});
test('credentials, endpoints, active flags and forged reference shapes cannot enter the draft profile',()=>{
  for(const patch of [{state:'active'},{apiKey:'secret'},{endpoint:'https://worker.invalid'},{voice:{...voice,apiKey:'secret'}},{voice:{...voice,provider:'unknown'}},
    {reference:{...reference,videoId:'https://private.invalid/video'}},{reference:{...reference,offsetMs:-1}},{reference:{...reference,frameIndex:2}}]){
    assert.throws(()=>normalizeDealerSpeechProfile({...profile(),...patch}));
  }
});
test('own unchanged available video plus in-range selected timestamp are required',()=>{
  assert.doesNotThrow(()=>validateDealerSpeechReference(profile(),video(),'paow'));
  assert.doesNotThrow(()=>validateDealerSpeechReference(profile(),{...video(),duration:undefined},'paow'));
  for(const patch of [{dealer:'astrid'},{sha256:'b'.repeat(64)},{available:false},{integrity:'unavailable'},{duration:.2},{classification:{mediaType:'audio'}},{classification:{archived:true}}]){
    assert.throws(()=>validateDealerSpeechReference(profile(),{...video(),...patch},'paow'));
  }
});
test('save binding checks own source, hash and archive state on authoritative registry',async()=>{
  const project=addDealer(createSeedProject(),'paow','PAOW');delete project.idlePolicy;
  project.dealers.find(row=>row.id==='paow').speechProfile=profile();
  const source=video(),registry={videos:[source],families:[]};
  const verify=createStudioProjectBindings({videoRegistry:async()=>registry});
  await verify(project);
  for(const [key,value] of [['dealer','astrid'],['sha256','b'.repeat(64)],['available',false]]){
    const previous=source[key];source[key]=value;
    await assert.rejects(verify(project),error=>error.code==='studio_speech_reference_invalid');source[key]=previous;
  }
});
test('frozen dealer capture projects id/label/idle only and omits speech preparation',()=>{
  const project=addDealer(createSeedProject(),'paow','PAOW');delete project.idlePolicy;
  project.dealers.find(row=>row.id==='paow').speechProfile=profile();
  const lane=project.lanes[0];lane.dealers.push('paow');lane.layers.dealer.allowed.push('paow');
  const captured=captureFrozenRegisteredDealers({project,selectedLaneIds:[lane.id],inventory:{videos:[],families:[]},mediaRows:[]});
  const dealer=captured.registeredDealers.find(row=>row.id==='paow');
  assert.deepEqual(dealer,{id:'paow',label:'PAOW',idle:null});
  assert.doesNotMatch(JSON.stringify(captured),/voiceId|elevenlabs|own-idle|speechProfile/);
});

test('speech settings shows only own video and requires a decoded reference before saving',async()=>{
  const {createRequire}=await import('node:module'),{readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');
  const require=createRequire(import.meta.url),React=require('react'),{transformSync}=require('next/dist/build/swc');
  const helpers=await import('../../web/public/dealer-speech-profile.mjs');
  const source=readFileSync(new URL('../components/dealer-speech-settings.tsx',import.meta.url),'utf8');
  const output=transformSync(source,{filename:'dealer-speech-settings.tsx',jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
  let cursor=0,refCursor=0;const states=[],refs=[],module={exports:{}};
  const fakeReact={...React,useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];},useRef(initial){return refs[refCursor++]??={current:initial};},useEffect(){}};
  runInNewContext(output.code,{module,exports:module.exports,require:name=>name==='react'?fakeReact:name.includes('dealer-speech-profile')?helpers:require(name)});
  const project=addDealer(createSeedProject(),'paow','PAOW'),dealer=project.dealers.find(row=>row.id==='paow');
  dealer.speechProfile=profile();
  const own={...video(),label:'Egen neutral video',previewUrl:'/studio/api/videos/own-idle'};
  let edited=null;
  const props={dealer,inventory:{videos:[own,{...own,id:'other',dealer:'astrid',label:'ANNAN DEALER'}]},onEdit:change=>{edited=change(project);}};
  const render=()=>{cursor=refCursor=0;return module.exports.DealerSpeechSettings(props);};
  const nodes=(node,predicate)=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(child=>nodes(child,predicate)):[...(predicate(node)?[node]:[]),...nodes(node.props?.children,predicate)];
  let tree=render(),button=nodes(tree,node=>node.type==='button')[0];
  assert.equal(button.props.disabled,true);
  assert.equal(nodes(tree,node=>node.type==='option'&&node.props.children==='ANNAN DEALER').length,0);
  const preview=nodes(tree,node=>node.type==='video')[0];
  preview.props.ref.current={readyState:2,seeking:false,currentTime:.2,duration:3};
  preview.props.onLoadedMetadata();preview.props.onLoadedData();tree=render();button=nodes(tree,node=>node.type==='button')[0];
  assert.equal(button.props.disabled,false);button.props.onClick();
  assert.deepEqual(edited.dealers.find(row=>row.id==='paow').speechProfile,profile());
  assert.equal(edited.dealers.find(row=>row.id==='paow').speechProfile.state,'preparation');
});
