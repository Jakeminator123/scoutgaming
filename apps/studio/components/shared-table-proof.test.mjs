import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
const compiled=transformSync(readFileSync(new URL('./shared-table-proof.tsx',import.meta.url),'utf8'),{filename:'shared-table-proof.tsx',jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}).code;
const nodes=(node,predicate)=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(n=>nodes(n,predicate)):[...(predicate(node)?[node]:[]),...nodes(node.props?.children,predicate)];
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness() {
 const hooks=[],calls=[];let cursor=0;
 const react={...React,useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=initial;return[hooks[i],value=>hooks[i]=value];},useRef(initial){return hooks[cursor++]??={current:initial};},useEffect(){}};
 const module={exports:{}};vm.runInNewContext(compiled,{module,exports:module.exports,AbortController,Error,encodeURIComponent,require:name=>name==='react'?react:name.endsWith('.css')?{default:{}}:require(name)});
 const read=(query,signal)=>new Promise((resolve,reject)=>calls.push({query,signal,resolve,reject}));
 const render=()=>{cursor=0;return module.exports.SharedTableProof({read});};
 return {calls,render,nodes:predicate=>nodes(render(),predicate),html:()=>renderToStaticMarkup(render()),
 change(id){this.nodes(n=>n.type==='input')[0].props.onChange({target:{value:id}});},
 submit(){this.nodes(n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});},
 async answer(i,value){calls[i].resolve(value);await flush();}};
}
const data=(closed=false,selected=null,complete=true)=>({roomId:'room-1',shoes:[{shoeId:'shoe-1',commitment:'commit',...(closed?{closedAt:1792630800000}:{})}],selected,chain:{ok:complete,complete,count:1,total:complete?1:2}});
test('proof reads are explicit and an open shoe never exposes raw proof even in a malformed server projection',async()=>{
 const h=harness();h.render();assert.equal(h.calls.length,0);h.change('room-1');h.submit();await h.answer(0,data());
 h.nodes(n=>n.type==='button'&&String(n.props.children).startsWith('Visa'))[0].props.onClick();
 assert.deepEqual({...h.calls[1].query},{roomId:'room-1',shoeId:'shoe-1'});
 await h.answer(1,data(false,{shoeId:'shoe-1',commitment:'commit',rawProof:'PRIVATE'}));
 assert.doesNotMatch(h.html(),/PRIVATE|data:application/);assert.match(h.html(),/lämnas inte ut medan skon är öppen/);
});
test('closed exact JSON is downloadable and a partial audit is never presented as verified',async()=>{
 const raw='{"second":2,"first":1}',h=harness();h.change('room-1');h.submit();await h.answer(0,data(true));
 h.nodes(n=>n.type==='button'&&String(n.props.children).startsWith('Visa'))[0].props.onClick();
 await h.answer(1,data(true,{shoeId:'shoe-1',commitment:'commit',closedAt:1792630800000,rawProof:raw,verification:{status:'incomplete'}},false));
 const link=h.nodes(n=>n.type==='a')[0];assert.equal(decodeURIComponent(link.props.href.split(',')[1]),raw);
 assert.match(h.html(),/Auditkedjan är ofullständig/);assert.doesNotMatch(h.html(),/Auditkedjan är verifierad/);
});
test('changing the room aborts reads and old data cannot appear under the new room',async()=>{
 const h=harness();h.change('room-1');h.submit();h.change('room-2');assert.equal(h.calls[0].signal.aborted,true);
 await h.answer(0,data());assert.doesNotMatch(h.html(),/shoe-1|commit/);
});


test('epoch zero is a closed shoe and retains its exact proof download',async()=>{
 const h=harness(),value=data(true);value.shoes[0].closedAt=0;h.change('room-1');h.submit();await h.answer(0,value);
 assert.match(h.html(),/Stängd/);assert.doesNotMatch(h.html(),/· Öppen/);
 h.nodes(n=>n.type==='button'&&String(n.props.children).startsWith('Visa'))[0].props.onClick();
 await h.answer(1,{...value,selected:{shoeId:'shoe-1',commitment:'commit',closedAt:0,rawProof:'{"epoch":0}'}});
 assert.match(h.html(),/Stängd sko/);assert.doesNotMatch(h.html(),/lämnas inte ut medan skon är öppen/);
 assert.equal(decodeURIComponent(h.nodes(n=>n.type==='a')[0].props.href.split(',')[1]),'{"epoch":0}');
});

test('invalid closure timestamps are rejected in both summary and selected shoe',async()=>{
 for(const closedAt of ['2026-10-22T01:00:00Z',-1,1.5,NaN,Infinity,8640000000000001]) {
  const h=harness(),value=data(true);value.shoes[0].closedAt=closedAt;h.change('room-1');h.submit();await h.answer(0,value);
  assert.match(h.html(),/stämmer inte med det valda rummet/);assert.doesNotMatch(h.html(),/data:application/);
 }
 const h=harness();h.change('room-1');h.submit();await h.answer(0,data(true));
 h.nodes(n=>n.type==='button'&&String(n.props.children).startsWith('Visa'))[0].props.onClick();
 await h.answer(1,data(true,{shoeId:'shoe-1',commitment:'commit',closedAt:'1792630800000',rawProof:'PRIVATE'}));
 assert.match(h.html(),/stämmer inte med det valda rummet/);assert.doesNotMatch(h.html(),/PRIVATE|data:application/);
});