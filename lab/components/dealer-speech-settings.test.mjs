import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const file=new URL('./dealer-speech-settings.tsx',import.meta.url),require=createRequire(file),React=require('react');
const {transformSync}=require('next/dist/build/swc');
const output=transformSync(readFileSync(file,'utf8'),{filename:file.pathname,jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
const VoicePicker=()=>null;
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
function fixture(kind='motion-video') {
  const video={id:'10000000-0000-4000-8000-000000000001',dealer:'dragan',label:'Egen vila',available:true,bytes:4096,sha256:'a'.repeat(64),
    contentType:'video/mp4',duration:5,previewUrl:'/studio/api/videos/own',classification:{dealerId:'dragan',compositing:{mode:'green-screen',threshold:.2,softness:.1,despill:0}}};
  const dealer={id:'dragan',label:'Dragan',speechProfile:{schemaVersion:2,state:'preparation',
    voice:{provider:'elevenlabs',voiceId:'own-voice',modelId:'eleven_multilingual_v2',language:'sv'},
    reference:{kind,videoId:video.id,sha256:video.sha256,offsetMs:0}}};
  return {dealer,inventory:{videos:[video]}};
}
function harness(initial=fixture()) {
  const hooks=[],effects=[],changes=[];let cursor=0,changed=false,props={...initial,onEdit:edit=>changes.push(edit)};
  const react={...React,
    useState(initial){const i=cursor++;hooks[i]??={value:typeof initial==='function'?initial():initial};return [hooks[i].value,value=>{
      const next=typeof value==='function'?value(hooks[i].value):value;if(!Object.is(next,hooks[i].value)){hooks[i].value=next;changed=true;}
    }];},
    useRef(initial){const i=cursor++;return hooks[i]??={current:initial};},
    useEffect(effect,deps){const i=cursor++,previous=hooks[i];if(!previous||!deps||deps.some((value,j)=>!Object.is(value,previous.deps?.[j]))){
      hooks[i]={deps};effects.push(()=>{previous?.cleanup?.();hooks[i].cleanup=effect();});
    }},
  };
  const module={exports:{}};
  runInNewContext(output.code,{module,exports:module.exports,require:name=>name==='react'?react:name==='./dealer-voice-picker'?{DealerVoicePicker:VoicePicker}:require(name)});
  function render(patch={}){
    props={...props,...patch};let tree;
    for(let attempts=0;attempts<10;attempts++){
      cursor=0;changed=false;tree=module.exports.DealerSpeechSettings(props);
      for(const effect of effects.splice(0))effect();
      if(!changed)return nodes(tree);
    }
    assert.fail('render did not settle');
  }
  const toggle=()=>render().find(node=>node.type==='input'&&node.props.type==='checkbox');
  const save=()=>render().find(node=>node.type==='button'&&node.props.children==='Använd talunderlag i utkastet');
  function ready(){const video=render().find(node=>node.type==='video');video.props.ref.current={duration:5,currentTime:0,readyState:2,seeking:false};video.props.onLoadedMetadata();render();video.props.onLoadedData();render();}
  return {render,toggle,save,ready,changes};
}

for(const kind of ['motion-video','video-frame']) test(`${kind} can be enabled only after its exact reference position is displayed`,()=>{
  const input=fixture(kind),before=structuredClone(input),h=harness(input);
  assert.equal(h.toggle().props.disabled,false);
  h.toggle().props.onChange({target:{checked:true}});
  assert.equal(h.save().props.disabled,true);
  h.save().props.onClick();assert.equal(h.changes.length,0,'save also rejects an unreviewed reference');
  h.ready();assert.equal(h.save().props.disabled,false);
  h.save().props.onClick();assert.equal(h.changes.length,1);
  const other={id:'astrid',label:'Astrid'},project={revision:'saved-1',dealers:[input.dealer,other]},saved=h.changes[0](project);
  assert.equal(saved.revision,'saved-1','the existing outer project writer owns persistence and revisions');
  assert.equal(saved.dealers[1],other);assert.deepEqual(saved.dealers[0].speechProfile,{...input.dealer.speechProfile,state:'enabled'});
  assert.deepEqual(input,before);
});

test('motion intent keeps missing voice, missing/foreign/unavailable reference and incompatible compositing blocked',()=>{
  for(const mutate of [
    input=>{input.inventory.videos=[];},input=>{input.inventory.videos[0].dealer='astrid';},
    input=>{input.inventory.videos[0].available=false;},input=>{input.inventory.videos[0].classification.compositing={mode:'opaque'};},
    input=>{input.inventory.videos[0].classification.compositing={mode:'alpha'};},
  ]) {
    const input=fixture();mutate(input);const h=harness(input);assert.equal(h.toggle().props.disabled,true);
    h.toggle().props.onChange({target:{checked:true}});h.save().props.onClick();assert.equal(h.changes.length,0);
  }
  for(const patch of [{provider:''},{voiceId:''},{modelId:''}]) {
    const h=harness(),picker=h.render().find(node=>node.type===VoicePicker);
    picker.props.onChange({...picker.props.value,...patch});assert.equal(h.toggle().props.disabled,true);
  }
});

test('load errors, unreviewed offsets and a locked form cannot apply enabled motion intent',()=>{
  const h=harness();h.ready();h.toggle().props.onChange({target:{checked:true}});
  h.render().find(node=>node.type==='video').props.onError();assert.equal(h.save().props.disabled,true);
  h.save().props.onClick();assert.equal(h.changes.length,0);
  const shifted=harness();shifted.ready();shifted.toggle().props.onChange({target:{checked:true}});
  shifted.render().find(node=>node.type==='input'&&node.props.type==='range').props.onChange({target:{value:'100'}});
  assert.equal(shifted.save().props.disabled,true);shifted.save().props.onClick();assert.equal(shifted.changes.length,0);
  const locked=harness({...fixture(),disabled:true});locked.ready();locked.toggle().props.onChange({target:{checked:true}});
  locked.save().props.onClick();assert.equal(locked.changes.length,0);
});
