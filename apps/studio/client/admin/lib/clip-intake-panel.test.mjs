import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
const fileUrl=new URL('../components/studio/clip-intake-panel.tsx',import.meta.url),require=createRequire(fileUrl);
const React=require('react'),{transformSync}=require('esbuild');
const code=transformSync(readFileSync(fileUrl,'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
const walk=(node,predicate)=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(n=>walk(n,predicate)):[...(predicate(node)?[node]:[]),...walk(node.props?.children,predicate)];
const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
const catalog={dealers:[{id:'dragan',label:'Dragan'}],limits:{maxFiles:30,maxFileBytes:134217728},slots:[{id:'idle.ready/',eventId:'idle.ready',situation:'',kind:'idle',label:'Vila'}]};
function harness(upload){
  const states=[],effects=[];let cursor=0;
  const hooks={...React,useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];},useRef(initial){const i=cursor++;return states[i]??={current:initial};},useEffect(fn,deps){const i=cursor++,old=states[i];if(!old||deps.some((value,j)=>value!==old.deps[j])){states[i]={deps,cleanup:old?.cleanup};effects.push(()=>{states[i].cleanup?.();states[i].cleanup=fn();});}},useImperativeHandle(ref,create){ref.current=create();}};
  const module={exports:{}},ref={current:null};
  const fetch=async url=>({ok:true,status:200,json:async()=>url.includes('import-proposal')?catalog:{uploadMode:'private-client-blob',videos:[]}});
  runInNewContext(code,{module,exports:module.exports,fetch,AbortController,URL,File,console,require:name=>name==='react'?hooks:name==='lucide-react'?new Proxy({},{get:()=>()=>null}):name.includes('upload-native-video')?{uploadNativeVideo:upload}:require(name)},{filename:fileURLToPath(fileUrl)});
  const props={ref,dealer:{id:'dragan',label:'Dragan'},groups:[],active:true,blocked:false,hasStandard:()=>false,onBusyChange(){},onPendingChange(){},onInventory(){},onDragChange(){},onBind(){},onOpenSlot(){},onChooseDealer(){}};
  const h={ref,render(){cursor=0;return module.exports.ClipIntakePanel(props);},async settle(){for(let i=0;i<5;i++){h.render();while(effects.length)effects.shift()();await new Promise(resolve=>setImmediate(resolve));}},button(label){return walk(h.render(),n=>n.type==='button'&&text(n).startsWith(label))[0];},remove(name){return walk(h.render(),n=>n.type==='button'&&n.props['aria-label']==='Ta bort '+name+' ur listan')[0];}};
  return h;
}

test('pending rows stay visible and cannot be removed while an approved upload batch is running',async()=>{
  const uploaded=[];let release;
  const h=harness(async file=>{uploaded.push(file.name);if(uploaded.length===1)await new Promise(resolve=>{release=resolve;});return{id:'11111111-1111-4111-8111-111111111111'};});
  await h.settle();
  const files=['first.mp4','second.mp4'].map(name=>new File([new Uint8Array(64)],name,{type:'video/mp4'}));
  h.ref.current.addFiles(files.map(file=>({file})),'idle.ready/');await h.settle();
  const oldRemove=h.remove('second.mp4');assert.equal(oldRemove.props.disabled,false);
  h.button('Godkänn och spara').props.onClick();
  oldRemove.props.onClick();await h.settle();
  assert.deepEqual(uploaded,['first.mp4']);
  assert.ok(h.remove('second.mp4'),'the pending file remains visible');
  assert.equal(h.remove('second.mp4').props.disabled,true);
  h.remove('second.mp4').props.onClick();await h.settle();assert.ok(h.remove('second.mp4'));
  release();await h.settle();
  assert.deepEqual(uploaded,['first.mp4','second.mp4']);
  assert.ok(h.remove('second.mp4'),'the saved receipt stays visible');
  assert.equal(h.remove('second.mp4').props.disabled,false);
});
