import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import * as timing from './media-timing.mjs';

const sha=char=>(char.charCodeAt(0)%16).toString(16).repeat(64);
const clip=(id,extra={})=>({id,label:'Klipp '+id,available:true,integrity:'verified',previewUrl:'',contentType:'video/mp4',sha256:sha(id[0]),revision:'rev-'+id,
  classification:{dealerId:'paow',eventId:'deal.player'},...extra});
const reply=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});
function fakeFetch(answer){
  const calls=[];
  const fetchImpl=async(url,options)=>{calls.push({url,options,body:JSON.parse(options.body)});return answer(calls.at(-1));};
  return {calls,fetchImpl};
}
const ok=({body})=>reply(200,{media:{id:body.id,revision:'next-'+body.id,mediaTiming:{schemaVersion:1,mediaId:body.id}}});

test('only the dealer\'s own unmeasured MP4 clips with a revision are counted',()=>{
  const inventory={videos:[clip('a'),clip('b',{mediaTiming:{schemaVersion:1}}),clip('c',{retainedBank:true}),clip('d',{contentType:'video/webm'}),
    clip('e',{classification:{dealerId:'paow',archived:true}}),clip('f',{revision:undefined}),clip('g',{classification:{dealerId:'dragan'}}),clip('h',{deletion:{state:'pending'}}),clip('i')]};
  assert.deepEqual(timing.unmeasuredClips(inventory,'paow').map(row=>row.id),['a','i']);
  assert.equal(timing.unmeasuredClips({videos:[]},'paow').length,0);
  assert.equal(timing.timingMeasured(inventory.videos[1]),true);
});

test('measure-timing posts exactly {id, sha256, expectedRevision} and returns the clip with the new revision',async()=>{
  const {calls,fetchImpl}=fakeFetch(ok);
  const measured=await timing.measureClipTiming(clip('a'),{fetchImpl});
  assert.equal(calls.length,1);assert.equal(calls[0].url,'/studio/api/videos/measure-timing');assert.equal(calls[0].options.method,'POST');
  assert.deepEqual(calls[0].body,{id:'a',sha256:sha('a'),expectedRevision:'rev-a'});
  assert.equal(measured.revision,'next-a');assert.ok(timing.timingMeasured(measured));
});

test('a revision conflict and other refusals become plain Swedish errors',async()=>{
  for(const [status,body,pattern] of [[409,{error:'studio_native_unavailable'},/ändrats sedan registret lästes in/],[409,{error:'studio_retained_media_immutable',code:'studio_retained_media_immutable'},/bevarade banken/],
    [422,{error:'studio_native_unavailable'},/Bara registrerade MP4-klipp/],[404,{},/finns inte längre/],[403,{},/Logga in igen/],[503,{},/kunde inte bekräftas \(503\)/]]){
    const {fetchImpl}=fakeFetch(()=>reply(status,body));
    await assert.rejects(timing.measureClipTiming(clip('a'),{fetchImpl}),error=>error instanceof timing.TimingError&&pattern.test(error.message)&&!/studio_/.test(error.message));
  }
});

test('all unmeasured clips are measured one at a time; a failure is listed and the rest continue',async()=>{
  let open=0,peak=0;
  const {calls,fetchImpl}=fakeFetch(async call=>{open++;peak=Math.max(peak,open);await new Promise(resolve=>setImmediate(resolve));open--;return call.body.id==='b'?reply(409,{}):ok(call);});
  const progress=[];
  const result=await timing.measureClipsInOrder([clip('a'),clip('b'),clip('c')],{fetchImpl,onProgress:value=>progress.push(value)});
  assert.equal(peak,1,'sequential');assert.deepEqual(calls.map(call=>call.body.id),['a','b','c']);
  assert.deepEqual(result.measured.map(row=>row.id),['a','c']);
  assert.deepEqual(result.failed.map(row=>[row.id,row.label]),[['b','Klipp b']]);assert.match(result.failed[0].message,/ändrats sedan registret/);
  assert.deepEqual(progress.map(row=>row.done),[1,2,3]);
});

// The components with a fake fetch: hooks are stubbed so a click can run without a DOM.
const fileUrl=new URL('../components/studio/clip-timing.tsx',import.meta.url),require=createRequire(fileUrl);
const {transformSync}=require('esbuild');
const code=transformSync(readFileSync(fileUrl,'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
const walk=(node,predicate)=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(n=>walk(n,predicate)):[...(predicate(node)?[node]:[]),...walk(node.props?.children,predicate)];
const text=node=>typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
const settle=async()=>{for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve));};
function harness(name,props){
  const states=[];let cursor=0;
  const React=require('react');
  const hooks={...React,useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];},useRef(initial){const i=cursor++;return states[i]??={current:initial};}};
  const Stub=tag=>({children,...rest})=>({type:tag,props:{...rest,children}});
  const kit={Button:Stub('button'),Badge:Stub('badge'),plural:(n,one,many)=>n+' '+(n===1?one:many)};
  const module={exports:{}};
  runInNewContext(code,{module,exports:module.exports,require:id=>id==='react'?hooks:id==='lucide-react'?new Proxy({},{get:()=>()=>null}):id==='../ui/kit'?kit:id==='../../lib/media-timing.mjs'?timing:require(id)},{filename:fileURLToPath(fileUrl)});
  const render=()=>{cursor=0;return module.exports[name](props);};
  // Expand stub components so text and data-action are visible to walk().
  const expand=node=>!node||typeof node!=='object'?node:Array.isArray(node)?node.map(expand):typeof node.type==='function'?expand(node.type(node.props)):{...node,props:{...node.props,children:expand(node.props?.children)}};
  return {render:()=>expand(render()),button(action){return walk(expand(render()),n=>n.type==='button'&&n.props['data-action']===action)[0];},text:()=>text(expand(render()))};
}

test('Mät speltid on the clip posts the clip identity, shows a 409 and reports a measured clip',async()=>{
  const measured=[];
  const {calls,fetchImpl}=fakeFetch(()=>reply(409,{}));
  const h=harness('ClipTimingAction',{video:clip('a'),fetchImpl,onMeasured:video=>measured.push(video)});
  assert.match(text(h.button('measure-timing')),/Mät speltid/);
  h.button('measure-timing').props.onClick();await settle();
  assert.deepEqual(calls[0].body,{id:'a',sha256:sha('a'),expectedRevision:'rev-a'});
  assert.match(h.text(),/ändrats sedan registret lästes in/);assert.equal(measured.length,0);
  assert.equal(harness('ClipTimingAction',{video:clip('a',{mediaTiming:{schemaVersion:1}})}).button('measure-timing'),undefined);
  assert.match(harness('ClipTimingAction',{video:clip('a',{mediaTiming:{schemaVersion:1}})}).text(),/Uppmätt/);
});

test('Mät omätta klipp (N) counts the dealer\'s clips, runs them in order and lists failures; disabled at N=0',async()=>{
  const inventory={videos:[clip('a'),clip('b'),clip('c',{mediaTiming:{schemaVersion:1}}),clip('d',{classification:{dealerId:'dragan'}})]};
  const done=[];
  const {calls,fetchImpl}=fakeFetch(call=>call.body.id==='b'?reply(409,{}):ok(call));
  const h=harness('DealerTimingAction',{inventory,dealerId:'paow',fetchImpl,onDone:count=>done.push(count)});
  const button=h.button('measure-unmeasured');
  assert.match(text(button),/Mät omätta klipp \(2\)/);assert.equal(button.props.disabled,false);
  button.props.onClick();await settle();
  assert.deepEqual(calls.map(call=>call.body.id),['a','b']);assert.deepEqual(done,[1]);
  assert.match(h.text(),/1 klipp uppmätta, 1 klipp kunde inte mätas/);assert.match(h.text(),/Klipp b: Klippet har ändrats/);
  const none=harness('DealerTimingAction',{inventory:{videos:[clip('c',{mediaTiming:{schemaVersion:1}})]},dealerId:'paow'}).button('measure-unmeasured');
  assert.match(text(none),/Mät omätta klipp \(0\)/);assert.equal(none.props.disabled,true);
});
