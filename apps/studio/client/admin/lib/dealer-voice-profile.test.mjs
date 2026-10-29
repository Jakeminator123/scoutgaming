import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as voices from '../../../../../packages/presentation/contracts/dealer-voice-profile.mjs';

// Röstprofil i Admin › Dealers › Röst och tal: renders the saved voice, the
// catalog suggestion or nothing, validates the id and posts only to the
// server writer. Fields and actions are found by data hooks, not by words.
const PAOW='WZVEBKUreb9jAKojf0QF',OTHER='AbCdEfGhIjKlMnOpQrSt';
let compiled;
function harness({dealer,projectDirty=false,respond}){
  const require=createRequire(import.meta.url),React=require('react'),{transformSync}=require('esbuild');
  compiled??=transformSync(readFileSync(new URL('../components/studio/dealer-voice-profile.tsx',import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
  const slots=[],calls=[],saved=[];let cursor=0;const module={exports:{}};
  const fakeReact={...React,useState(initial){const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next}]},useEffect(){cursor++}};
  runInNewContext(compiled,{module,exports:module.exports,require:name=>name==='react'?fakeReact:name.includes('dealer-voice-profile.mjs')?voices:require(name),
    fetch:async(url,init)=>{calls.push({url,body:JSON.parse(init.body),method:init.method});return respond?respond(init):{ok:true,json:async()=>({project:{revision:'r2',dealers:[]}})}}});
  const props={project:{revision:'r1',dealers:[dealer]},dealer,projectDirty,onSaved:project=>saved.push(project)};
  const render=()=>{cursor=0;return module.exports.DealerVoiceProfile(props)};
  const nodes=(node,predicate)=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(child=>nodes(child,predicate)):[...(predicate(node)?[node]:[]),...nodes(node.props?.children,predicate)];
  const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
  const field=(tree,key)=>nodes(tree,node=>node.type==='input'&&node.props['data-field']===key)[0];
  const button=(tree,action)=>nodes(tree,node=>node.type==='button'&&node.props['data-action']===action)[0];
  const form=tree=>nodes(tree,node=>node.type==='form')[0];
  return {render,field,button,form,text,calls,saved,props};
}
const savedDealer=voiceId=>({id:'paow',label:'Paow',speechProfile:{schemaVersion:2,state:'preparation',voice:{provider:'elevenlabs',voiceId,modelId:'eleven_v3'},reference:null}});
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('saved profile shows name and full voice id; catalog suggestion is marked unsaved',()=>{
  let h=harness({dealer:savedDealer(PAOW)}),tree=h.render();
  assert.equal(tree.props['data-voice-source'],'saved');
  assert.equal(h.field(tree,'voice-profile-id'),undefined,'no input before Ändra');
  assert.match(h.text(tree),new RegExp('Paow · ID '+PAOW));
  assert.equal(h.button(tree,'save-suggested-voice'),undefined);
  h=harness({dealer:{id:'dragan',label:'Dragan'}});tree=h.render();
  assert.equal(tree.props['data-voice-source'],'catalog');assert.match(h.text(tree),/7f95xPL4S3ySZ4OS1pw8/);
  assert.ok(h.button(tree,'save-suggested-voice'));
  h=harness({dealer:{id:'nova',label:'Nova'}});tree=h.render();
  assert.equal(tree.props['data-voice-source'],'none');assert.equal(h.button(tree,'save-suggested-voice'),undefined);
});

test('Ändra validates the id format and posts dealer, revision and voice to the server writer',async()=>{
  const h=harness({dealer:savedDealer(PAOW)});let tree=h.render();
  h.button(tree,'edit-voice').props.onClick();tree=h.render();
  assert.equal(h.field(tree,'voice-profile-id').props.value,PAOW);assert.equal(h.field(tree,'voice-profile-model').props.value,'eleven_v3');
  h.field(tree,'voice-profile-id').props.onChange({target:{value:'too-short'}});tree=h.render();
  assert.equal(h.button(tree,'save-voice').props.disabled,true);
  h.field(tree,'voice-profile-id').props.onChange({target:{value:OTHER}});h.field(tree,'voice-profile-model').props.onChange({target:{value:'gpt-4'}});tree=h.render();
  assert.equal(h.button(tree,'save-voice').props.disabled,true,'model must be an eleven_ id');
  h.field(tree,'voice-profile-model').props.onChange({target:{value:''}});tree=h.render();
  assert.equal(h.button(tree,'save-voice').props.disabled,false);
  h.form(tree).props.onSubmit({preventDefault(){}});await settle();
  assert.deepEqual(h.calls,[{url:'/studio/api/dealers/voice',method:'POST',body:{dealerId:'paow',expectedRevision:'r1',voice:{provider:'elevenlabs',voiceId:OTHER}}}]);
  assert.equal(h.saved[0].revision,'r2');
});

test('unsaved draft blocks the direct save; server refusal is shown and nothing is reported saved',async()=>{
  let h=harness({dealer:savedDealer(PAOW),projectDirty:true}),tree=h.render();
  assert.equal(h.button(tree,'edit-voice').props.disabled,true);
  h=harness({dealer:{id:'paow',label:'Paow'},respond:async()=>({ok:false,json:async()=>({error:'studio_request_rejected'})})});tree=h.render();
  h.button(tree,'save-suggested-voice').props.onClick();await settle();tree=h.render();
  assert.deepEqual(h.calls[0].body.voice,{provider:'elevenlabs',voiceId:PAOW,modelId:'eleven_v3'});
  assert.equal(h.saved.length,0);assert.match(h.text(tree),/behörighet/);
});
