import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { brandingApiBase, PartnerAppearanceLoader } from '../components/partner-appearance-loader.mjs';

test('branding api base sits beside the partner snapshot action', () => {
  assert.equal(brandingApiBase('/studio/api/partner/snapshot'), '/studio/api/partner');
  assert.equal(brandingApiBase('/api/partner/snapshot'), '/api/partner');
  assert.equal(brandingApiBase('/studio/api/partner-preview'), '/studio/api/partner-preview');
  assert.equal(brandingApiBase(undefined), '');
});

test('loader renders a status line on the server and no lime before the first read', () => {
  const html = renderToStaticMarkup(React.createElement(PartnerAppearanceLoader, {
    apiBase: '/studio/api/partner/snapshot', operatorSlug: 'demo-north',
  }));
  assert.match(html, /Hämtar utseende/);
  assert.doesNotMatch(html, /sg-btn-primary|Spara utseende/);
});

import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
const loaderUrl=new URL('../components/partner-appearance-loader.mjs',import.meta.url),localRequire=createRequire(loaderUrl);
const loaderCode=transformSync(readFileSync(loaderUrl,'utf8'),{filename:fileURLToPath(loaderUrl),jsc:{parser:{syntax:'ecmascript'}},module:{type:'commonjs'}}).code;
function loaderHarness(fetcher){const slots=[],effects=[];let cursor=0;const hooks={...React,useState:value=>{const index=cursor++;if(!(index in slots))slots[index]=typeof value==='function'?value():value;return [slots[index],next=>slots[index]=typeof next==='function'?next(slots[index]):next];},useRef:value=>{const index=cursor++;if(!(index in slots))slots[index]={current:value};return slots[index];},useEffect:(callback,deps)=>{const index=cursor++,previous=slots[index];if(!previous||deps.some((v,i)=>v!==previous.deps[i])){previous?.cleanup?.();slots[index]={deps};effects.push(()=>{slots[index].cleanup=callback();});}}};const output={exports:{}};
 vm.runInNewContext(loaderCode,{module:output,exports:output.exports,AbortController,fetch:fetcher,require:name=>name==='react'?hooks:name==='./partner-appearance'?{PartnerAppearance:()=>null}:localRequire(name)},{filename:fileURLToPath(loaderUrl)});
 return {render:props=>{cursor=0;return output.exports.PartnerAppearanceLoader(props);},flush:async()=>{while(effects.length)effects.shift()();await new Promise(resolve=>setImmediate(resolve));}};
}
const receipt=operatorId=>({operatorId,packageRevision:7,adjustable:[],lanes:[],branding:{},presentation:{}});
const ok=data=>({status:200,ok:true,json:async()=>data});
test('loader immediately hides previous company and suppresses old publication callbacks',async()=>{
 const saved=[],pending=[],h=loaderHarness(()=>new Promise(resolve=>pending.push(resolve))),first={apiBase:'/studio/api/partner/snapshot',operatorId:'op-a',operatorSlug:'alpha',onSaved:value=>saved.push(value)};
 h.render(first);await h.flush();pending[0](ok(receipt('op-a')));await h.flush();const ready=h.render(first),oldCallback=ready.props.children.props.onSaved;
 const next={...first,operatorId:'op-b',operatorSlug:'beta',language:'en'},loading=h.render(next);assert.equal(loading.props.role,'status');assert.match(loading.props.children,/Loading appearance/);
 oldCallback({...receipt('op-a'),packageRevision:8});assert.equal(saved.length,0);
 await h.flush();pending[1](ok(receipt('op-b')));await h.flush();assert.equal(h.render(next).props.children.props.initial.operatorId,'op-b');
});
test('late read from previous company cannot replace a newer scoped package',async()=>{
 const pending=[],h=loaderHarness(()=>new Promise(resolve=>pending.push(resolve))),first={apiBase:'/api/partner',operatorId:'op-a',operatorSlug:'alpha'};
 h.render(first);await h.flush();const next={...first,operatorId:'op-b',operatorSlug:'beta'};h.render(next);await h.flush();
 pending[1](ok(receipt('op-b')));await h.flush();pending[0](ok(receipt('op-a')));await h.flush();assert.equal(h.render(next).props.children.props.initial.operatorId,'op-b');
});
test('loader rejects a foreign operator response instead of mounting controls',async()=>{
 const h=loaderHarness(async()=>ok(receipt('op-foreign'))),props={apiBase:'/api/partner',operatorId:'op-a',operatorSlug:'alpha'};h.render(props);await h.flush();const view=h.render(props);assert.equal(view.props.role,'alert');
});
test('an explicit room missing from the fresh package never mounts company-default controls',async()=>{
 const data={...receipt('op-a'),rooms:[{id:'available-room'}]},h=loaderHarness(async()=>ok(data));
 const props={apiBase:'/api/partner',operatorId:'op-a',operatorSlug:'alpha',roomId:'withdrawn-room'};
 h.render(props);await h.flush();const unavailable=h.render(props);assert.equal(unavailable.props.role,'alert');assert.match(unavailable.props.children,/Rummet är inte tillgängligt/);
 const valid=h.render({...props,roomId:'available-room'});assert.equal(valid.props.children.props.roomId,'available-room');
 assert.equal(valid.props.children.props.initial.operatorId,'op-a');
});


test('Admin room mode forwards exact room, disabled state and operation callbacks without changing the operator',async()=>{
 const data={...receipt('op-a'),rooms:[{id:'room-a'}]},h=loaderHarness(async()=>ok(data));
 const dirty=()=>{},busy=()=>{},props={apiBase:'/studio/api/partner',operatorId:'op-a',operatorSlug:'alpha',roomId:'room-a',roomLayout:true,disabled:true,onDirtyChange:dirty,onBusyChange:busy};
 h.render(props);await h.flush();const panel=h.render(props).props.children.props;
 assert.equal(panel.roomId,'room-a');assert.equal(panel.initial.operatorId,'op-a');
 assert.equal(panel.roomLayout,true);assert.equal(panel.disabled,true);assert.equal(panel.onDirtyChange,dirty);assert.equal(panel.onBusyChange,busy);
});
