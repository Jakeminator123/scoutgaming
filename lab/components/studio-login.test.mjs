import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as loginClient from '../lib/studio-login-client.mjs';
const require = createRequire(import.meta.url), {transformSync} = require('next/dist/build/swc');
const source = readFileSync(new URL('./studio-login.tsx',import.meta.url),'utf8');
const compiled = transformSync(source,{filename:'studio-login.tsx',jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}).code;
class Input {constructor(value){this.value=value;}}
class Form {
  constructor(fields) {this.fields=fields;this.inputs=Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,new Input(value)]));this.elements={namedItem:name=>this.inputs[name]};}
}
class FormData {constructor(form){this.form=form;}get(name){return this.form.fields[name]??null;}}
function harness() {
  let cursor=0; const hooks=[],pending=[],destinations=[],history=[];
  const module={exports:{}}, fakeReact={...React,
    useState(initial){const index=cursor++;if(!hooks[index])hooks[index]={kind:'state',value:initial};return[hooks[index].value,value=>hooks[index].value=typeof value==='function'?value(hooks[index].value):value];},
    useRef(initial){const index=cursor++;if(!hooks[index])hooks[index]={kind:'ref',value:{current:initial}};return hooks[index].value;},
    useMemo(fn,deps){const index=cursor++;if(!hooks[index]||deps.some((value,i)=>value!==hooks[index].deps[i]))hooks[index]={kind:'memo',value:fn(),deps};return hooks[index].value;},
    useEffect(fn,deps){const index=cursor++;if(!hooks[index]||deps.some((value,i)=>value!==hooks[index].deps[i]))pending.push(()=>{hooks[index]?.cleanup?.();hooks[index]={kind:'effect',fn,deps,cleanup:fn()};});},
  };
  vm.runInNewContext(compiled,{module,exports:module.exports,FormData,HTMLInputElement:Input,
    window:{location:{pathname:'/studio/set-password',assign:value=>destinations.push(value)},history:{replaceState:(...args)=>history.push(args)}},
    require:name=>name==='react'?fakeReact:name==='../lib/studio-login-client.mjs'?loginClient:name.endsWith('.module.css')?{__esModule:true,default:{}}:require(name)});
  return {destinations,history,render(props){cursor=0;return module.exports.StudioLogin(props);},effects(){while(pending.length)pending.shift()();},
    replayEffects(){for(const hook of hooks)if(hook.kind==='effect'){hook.cleanup?.();hook.cleanup=hook.fn();}},
    state(){return hooks.filter(hook=>hook.kind==='state').map(hook=>hook.value);},unmount(){for(const hook of hooks)hook.cleanup?.();}};
}
function nodes(node,predicate){if(!node||typeof node!=='object')return[];if(Array.isArray(node))return node.flatMap(value=>nodes(value,predicate));return[...(predicate(node)?[node]:[]),...nodes(node.props?.children,predicate)];}
const forms=tree=>nodes(tree,node=>node.type==='form');
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('login render has no request, accessible username/password/reset forms and no stored credentials',()=>{
  const h=harness();let calls=0;
  const html=renderToStaticMarkup(h.render({authBase:'/studio/api/auth',resetAvailable:true,fetchImpl:async()=>{calls++;throw Error('no');}}));
  assert.equal(calls,0);assert.match(html,/autoComplete="username"|autoComplete="current-password"|autocomplete="username"/);
  assert.match(html,/Glömt lösenordet/);assert.doesNotMatch(html,/localStorage|sessionStorage|type="hidden"/);
});

test('login sends one event only, clears password DOM immediately and navigates exact allowlisted page',async()=>{
  const h=harness(),writes=[];let release;
  const ready=new Promise(resolve=>{release=resolve;});
  const props={authBase:'/studio/api/auth',returnTo:'/studio/administration',fetchImpl:async(url,init)=>{writes.push({url,body:JSON.parse(init.body)});await ready;return Response.json({ok:true,secret:'SERVER_SECRET'});}};
  let tree=h.render(props);h.effects();
  const form=new Form({user:' Operator ',pass:' PRIVATE-PASSWORD '});
  forms(tree)[0].props.onSubmit({preventDefault(){},currentTarget:form});forms(tree)[0].props.onSubmit({preventDefault(){},currentTarget:form});
  assert.equal(form.inputs.pass.value,'');assert.equal(writes.length,1);assert.deepEqual(writes[0].body,{user:'Operator',pass:' PRIVATE-PASSWORD ',returnTo:'/studio/administration'});
  release();await flush();tree=h.render(props);
  assert.deepEqual(h.destinations,['/studio/administration']);assert.equal(JSON.stringify(h.state()).includes('PRIVATE-PASSWORD'),false);
  assert.doesNotMatch(renderToStaticMarkup(tree),/PRIVATE-PASSWORD|SERVER_SECRET/);h.unmount();
});

test('password token is removed from URL, stays outside DOM/state and survives strict effect replay',async()=>{
  const h=harness(),token='b'.repeat(43),writes=[];
  const props={authBase:'/studio/api/auth',mode:'set-password',token,fetchImpl:async(url,init)=>{writes.push({url,body:JSON.parse(init.body)});return Response.json({ok:true});}};
  let tree=h.render(props);h.effects();h.replayEffects();
  assert.deepEqual(h.history[0],[null,'','/studio/set-password']);assert.doesNotMatch(renderToStaticMarkup(tree),new RegExp(token));
  const form=new Form({pass:'new-private-pass',confirm:'new-private-pass'});
  forms(tree)[0].props.onSubmit({preventDefault(){},currentTarget:form});await flush();tree=h.render(props);
  assert.equal(writes[0].body.token,token);assert.equal(writes[0].body.pass,'new-private-pass');
  assert.equal(form.inputs.pass.value,'');assert.equal(form.inputs.confirm.value,'');
  assert.equal(JSON.stringify(h.state()).includes(token),false);assert.match(renderToStaticMarkup(tree),/Lösenordet är sparat/);
  assert.equal(forms(tree).length,0);h.unmount();
});

test('password mismatch or invalid link does not issue a request and reset response reveals no account existence',async()=>{
  const h=harness(),writes=[],props={authBase:'/studio/api/auth',mode:'set-password',token:'b'.repeat(32),fetchImpl:async(...args)=>{writes.push(args);return Response.json({ok:true});}};
  let tree=h.render(props);h.effects();forms(tree)[0].props.onSubmit({preventDefault(){},currentTarget:new Form({pass:'private-pass',confirm:'different-pass'})});
  tree=h.render(props);assert.match(renderToStaticMarkup(tree),/stämmer inte överens/);assert.equal(writes.length,0);h.unmount();
  const invalid=harness();tree=invalid.render({...props,token:'invalid'});invalid.effects();assert.equal(forms(tree).length,0);assert.match(renderToStaticMarkup(tree),/Länken saknas eller är ogiltig/);invalid.unmount();
  const reset=harness(),login={authBase:'/studio/api/auth',resetAvailable:true,fetchImpl:async()=>Response.json({ok:true,accountExists:true,secret:'PRIVATE_TOKEN'})};
  tree=reset.render(login);reset.effects();forms(tree)[1].props.onSubmit({preventDefault(){},currentTarget:new Form({user:'operator'})});await flush();tree=reset.render(login);
  assert.match(renderToStaticMarkup(tree),/Om ett aktivt konto/);assert.doesNotMatch(renderToStaticMarkup(tree),/accountExists|PRIVATE_TOKEN/);reset.unmount();
});

test('unmount prevents late credential response from navigating or changing UI state',async()=>{
  const h=harness();let release;const ready=new Promise(resolve=>{release=resolve;});
  const props={authBase:'/studio/api/auth',fetchImpl:async()=>{await ready;return Response.json({ok:true});}};
  const tree=h.render(props);h.effects();forms(tree)[0].props.onSubmit({preventDefault(){},currentTarget:new Form({user:'operator',pass:'private-pass'})});
  h.unmount();release();await flush();assert.deepEqual(h.destinations,[]);
});
