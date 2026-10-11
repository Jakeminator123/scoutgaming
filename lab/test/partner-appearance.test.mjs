import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {defaultPresentationLane} from '../lib/studio-model.mjs';
import {defaultCompositionSettings} from '../../web/public/composition-settings.mjs';
const require = createRequire(import.meta.url);
const {transformSync} = require('next/dist/build/swc');
const fileUrl = new URL('../components/partner-appearance.tsx', import.meta.url);
const localRequire = createRequire(fileUrl);
const compiled = transformSync(readFileSync(fileUrl,'utf8'), {filename:fileURLToPath(fileUrl),jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
const css = {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
function load(hooks=React, fetcher) {
  const output={exports:{}};
  vm.runInNewContext(compiled.code,{module:output,exports:output.exports,fetch:fetcher,require:name=>name==='react'?hooks:name==='./partner-appearance-preview'?{PartnerAppearancePreview:()=>null}:name.endsWith('.css')?css:localRequire(name)},{filename:fileURLToPath(fileUrl)});
  return output.exports.PartnerAppearance;
}
const Panel=load();
const initialState = (extra={}) => {
  const lane={...defaultPresentationLane(),composition:defaultCompositionSettings(),operatorAdjustable:['background','table','table.color','dealer','branding']};
  lane.layers.background={enabled:true,mode:'image',default:'bg-one',allowed:['bg-one','bg-two']};
  lane.layers.table={enabled:true,default:'table-one',allowed:['table-one','table-two'],colors:['#112233','#445566']};
  lane.layers.dealer={enabled:true,default:'astrid',allowed:['astrid','vera']};
  return {operatorId:'op-1',packageRevision:7,lanes:['mobile-phone'],branding:{color:'#112233'},adjustable:lane.operatorAdjustable,canConfigure:true,dealerChoices:{'mobile-phone':['astrid','vera']},roomDealerChoices:{'north-main':['astrid','vera'],'north-vip':['astrid']},
    presentation:{schemaVersion:1,projectRevision:'r1',assets:[],lanes:[lane]},draft:null,draftRevision:0,history:[{revision:7,publishedAt:1000,branding:{color:'#112233'}},{revision:5,publishedAt:900,branding:{color:'#445566'}}],
    rooms:[{id:'north-main',label:'Huvudrum',presentationLaneId:'mobile-phone'},{id:'north-vip',label:'VIP',presentationLaneId:'mobile-phone'}],...extra};
};
const withDraft=(extra={})=>initialState({draftRevision:2,draft:{revision:2,basePackageRevision:7,branding:{color:'#445566'},updatedAt:1000},...extra});
function walk(tree,predicate) {
  if(!tree||typeof tree!=='object')return [];
  return [...(predicate(tree)?[tree]:[]),...[tree.props?.children].flat(Infinity).flatMap(child=>walk(child,predicate))];
}
const byAction=(tree,name)=>walk(tree,node=>node.props?.['data-action']===name)[0];
const select=(tree,label)=>walk(tree,node=>node.type==='select'&&node.props?.['aria-label']===label)[0];
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
const reviewed=(initial,extra={})=>({reviewToken:'a-valid-review-token',draftRevision:initial.draftRevision,packageRevision:initial.packageRevision,branding:initial.draft.branding,changes:[{roomId:null,key:'color',before:'#112233',after:'#445566'}],affectedRooms:['north-main'],...extra});
function stateful(initial,fetcher,options={}) {
  const slots=[],cleanups=[];let cursor=0;
  const hooks={...React,useState:value=>{const index=cursor++;if(!(index in slots))slots[index]=typeof value==='function'?value():value;return [slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next;}];},
    useRef:value=>{const index=cursor++;if(!(index in slots))slots[index]={current:value};return slots[index];},
    useEffect:callback=>{const index=cursor++;if(!(index in slots)){slots[index]=true;cleanups.push(callback());}}};
  const Component=load(hooks,fetcher);
  const render=()=>{cursor=0;return Component({initial,apiBase:'/studio/api/partner',operatorSlug:'north',...options});};
  return {render,unmount:()=>cleanups.forEach(fn=>fn?.())};
}
function html(initial,options={}) {return renderToStaticMarkup(React.createElement(Panel,{initial,apiBase:'/api/partner',operatorSlug:'north',...options}));}

test('saved draft is loaded separately from the live version with SV and EN workflow labels',()=>{
  const sv=html(withDraft()),en=html(withDraft(),{language:'en'});
  assert.match(sv,/Publicerad version.*7/);assert.match(sv,/Sparat utkast 2/);assert.match(sv,/#445566/);
  assert.match(en,/Save draft/);assert.match(en,/Review publication/);assert.match(en,/Restore to draft/);
  assert.doesNotMatch(sv,/<input[^>]+(?:name|logo|primary)|type="range"|Placering|Ordmarke/);
});
test('read-only and pre-draft backends fail closed but can inspect room scope',async()=>{
  for(const initial of [initialState({canConfigure:false}),initialState({draftRevision:undefined})]){
    const {render}=stateful(initial,()=>assert.fail('unauthorized write'));
    assert.equal(byAction(render(),'save-draft').props.disabled,true);
    await byAction(render(),'save-draft').props.onClick();
    assert.equal(select(render(),'Gäller för').props.disabled,false);
  }
  assert.match(html(initialState({canConfigure:false})),/<fieldset[^>]*disabled=""/);
});
test('full-frame and section views only expose effective supported adjustments',()=>{
  const initial=initialState();delete initial.presentation.lanes[0].composition;
  assert.match(html(initial,{section:'design'}),/Fullbildsklipp/);assert.doesNotMatch(html(initial,{section:'design'}),/aria-label="Bordsfärg"/);
  const background=html(initialState(),{section:'background'});
  assert.match(background,/aria-label="Bakgrund"/);assert.doesNotMatch(background,/aria-label="Bord"|aria-label="Dealer"|aria-label="Bordsfärg"/);
});
test('save creates a draft with full supported state, preserves hidden choices and never reports a live publication',async()=>{
  const initial=initialState({branding:{color:'#112233',dealer:'vera',roomOverrides:{'north-vip':{table:'table-two'}},name:'unused'}}),calls=[],published=[];
  const {render}=stateful(initial,async(url,request)=>{const body=JSON.parse(request.body);calls.push({url,body,request});return response({...initial,draftRevision:1,draft:{revision:1,basePackageRevision:7,branding:body.branding}});},{section:'background',onSaved:receipt=>published.push(receipt)});
  select(render(),'Bakgrund').props.onChange({target:{value:'bg-two'}});
  await byAction(render(),'save-draft').props.onClick();
  assert.deepEqual(calls[0].body,{action:'save-draft',expectedDraftRevision:0,expectedPackageRevision:7,branding:{background:'bg-two',dealer:'vera',color:'#112233',roomOverrides:{'north-vip':{table:'table-two'}}}});
  assert.equal(calls[0].request.credentials,'same-origin');assert.equal(calls[0].url,'/studio/api/partner/branding?operator=north');
  assert.equal(published.length,0);assert.equal(byAction(render(),'save-draft').props.disabled,true);assert.equal(byAction(render(),'review').props.disabled,false);
});
test('publish requires successful exact review and invalidates it immediately after editing',async()=>{
  const initial=withDraft(),calls=[];
  const {render}=stateful(initial,async(_url,request)=>{calls.push(JSON.parse(request.body));return response(reviewed(initial));});
  await byAction(render(),'publish').props.onClick();assert.equal(calls.length,0);
  await byAction(render(),'review').props.onClick();assert.equal(byAction(render(),'publish').props.disabled,false);
  select(render(),'Bordsfärg').props.onChange({target:{value:'#112233'}});
  assert.equal(byAction(render(),'publish').props.disabled,true);await byAction(render(),'publish').props.onClick();assert.equal(calls.length,1);
});
test('published receipt advances live only once and keeps tombstone revision for the next draft',async()=>{
  const initial=withDraft(),calls=[],published=[];
  const {render}=stateful(initial,async(_url,request)=>{const body=JSON.parse(request.body);calls.push(body);
    if(body.action==='review')return response(reviewed(initial));
    if(body.action==='publish')return response({...initial,packageRevision:8,branding:initial.draft.branding,draft:null,draftRevision:3});
    return response({...initial,packageRevision:8,branding:initial.draft.branding,draftRevision:4,draft:{revision:4,basePackageRevision:8,branding:body.branding}});
  },{onSaved:value=>published.push(value)});
  await byAction(render(),'review').props.onClick();await byAction(render(),'publish').props.onClick();
  assert.deepEqual(calls[1],{action:'publish',expectedDraftRevision:2,expectedPackageRevision:7,reviewToken:'a-valid-review-token'});assert.equal(published.length,1);
  select(render(),'Bordsfärg').props.onChange({target:{value:'#112233'}});await byAction(render(),'save-draft').props.onClick();
  assert.equal(calls[2].expectedDraftRevision,3);assert.equal(calls[2].expectedPackageRevision,8);assert.equal(published.length,1);
});
for(const status of [403,409]) test(`${status} retains local edits and blocks publication until explicit fresh reconciliation`,async()=>{
  const initial=initialState(),calls=[],latest=withDraft({draftRevision:5,draft:{revision:5,basePackageRevision:7,branding:{color:'#112233',background:'bg-one'}}});
  const {render}=stateful(initial,async(_url,request)=>{calls.push(request);return request.method==='POST'?response({},status):response(latest);});
  select(render(),'Bordsfärg').props.onChange({target:{value:'#445566'}});await byAction(render(),'save-draft').props.onClick();
  assert.equal(select(render(),'Bordsfärg').props.value,'#445566');assert.equal(byAction(render(),'save-draft').props.disabled,true);
  await byAction(render(),'refresh').props.onClick();assert.equal(select(render(),'Bordsfärg').props.value,'#445566');assert.equal(byAction(render(),'publish').props.disabled,true);
  byAction(render(),'keep-local').props.onClick();assert.equal(select(render(),'Bordsfärg').props.value,'#445566');assert.equal(byAction(render(),'save-draft').props.disabled,false);
  await byAction(render(),'save-draft').props.onClick();assert.equal(JSON.parse(calls.at(-1).body).expectedDraftRevision,5);
});
test('fresh revocation never re-enables saving and explicit loading can discard local input',async()=>{
  const latest=initialState({canConfigure:false}),{render}=stateful(initialState(),async()=>response(latest));
  select(render(),'Bordsfärg').props.onChange({target:{value:'#445566'}});await byAction(render(),'refresh').props.onClick();
  assert.equal(byAction(render(),'keep-local').props.disabled,true);
  byAction(render(),'load-latest').props.onClick();assert.equal(select(render(),'Bordsfärg').props.value,'#112233');assert.equal(byAction(render(),'save-draft').props.disabled,true);
});
test('restore creates a draft only, protects unsaved input and requires a new review',async()=>{
  const initial=initialState(),published=[],calls=[];
  const {render}=stateful(initial,async(_url,request)=>{calls.push(JSON.parse(request.body));return response(withDraft());},{onSaved:value=>published.push(value)});
  select(render(),'Bordsfärg').props.onChange({target:{value:'#445566'}});await byAction(render(),'restore-5').props.onClick();assert.equal(calls.length,0);
  select(render(),'Bordsfärg').props.onChange({target:{value:'#112233'}});await byAction(render(),'restore-5').props.onClick();
  assert.deepEqual(calls[0],{action:'restore',sourcePackageRevision:5,expectedDraftRevision:0,expectedPackageRevision:7});assert.equal(published.length,0);
  assert.equal(byAction(render(),'publish').props.disabled,true);assert.equal(select(render(),'Bordsfärg').props.value,'#445566');
});
test('room reset removes only that override and room presentation remains server-owned',async()=>{
  const initial=initialState({branding:{color:'#112233',roomOverrides:{'north-main':{color:'#445566'},'north-vip':{table:'table-two'}}}}),calls=[];
  const {render}=stateful(initial,async(_url,request)=>{const body=JSON.parse(request.body);calls.push(body);return response({...initial,draftRevision:1,draft:{revision:1,basePackageRevision:7,branding:body.branding}});});
  select(render(),'Gäller för').props.onChange({target:{value:'north-main'}});assert.equal(select(render(),'Presentation').props.disabled,true);
  byAction(render(),'reset-room').props.onClick();await byAction(render(),'save-draft').props.onClick();
  assert.deepEqual(calls[0].branding,{color:'#112233',roomOverrides:{'north-vip':{table:'table-two'}}});
});
test('synchronous lock ignores double clicks, freezes input and suppresses completion after unmount',async()=>{
  let finish;const initial=withDraft(),calls=[],published=[];
  const {render,unmount}=stateful(initial,(_url,request)=>{calls.push(JSON.parse(request.body));return new Promise(resolve=>{finish=resolve;});},{onSaved:value=>published.push(value)});
  const first=byAction(render(),'review').props.onClick();await byAction(render(),'review').props.onClick();assert.equal(calls.length,1);
  select(render(),'Bordsfärg').props.onChange({target:{value:'#112233'}});assert.equal(select(render(),'Bordsfärg').props.value,'#445566');
  finish(response(reviewed(initial)));await first;
  const publish=byAction(render(),'publish').props.onClick();unmount();finish(response({...initial,packageRevision:8,draft:null,draftRevision:3}));await publish;assert.equal(published.length,0);
});
test('foreign receipt and mismatched review fail closed without replacing input or publishing',async()=>{
  for(const invalid of [reviewed(withDraft(),{draftRevision:10}),reviewed(withDraft(),{branding:{color:'#112233'}})]){
    const {render}=stateful(withDraft(),async()=>response(invalid));await byAction(render(),'review').props.onClick();assert.equal(byAction(render(),'publish').props.disabled,true);assert.equal(select(render(),'Bordsfärg').props.value,'#445566');
  }
  const {render}=stateful(initialState(),async()=>response(withDraft({operatorId:'op-foreign'})));
  select(render(),'Bordsfärg').props.onChange({target:{value:'#445566'}});await byAction(render(),'save-draft').props.onClick();assert.equal(select(render(),'Bordsfärg').props.value,'#445566');assert.equal(byAction(render(),'review').props.disabled,true);
});
test('stale base requires saving again before review and history is not silently published',async()=>{
  const initial=withDraft({packageRevision:9}),requests=[];
  const {render}=stateful(initial,async(_url,request)=>{requests.push(JSON.parse(request.body));return response({...initial,draftRevision:3,draft:{...initial.draft,revision:3,basePackageRevision:9}});});
  assert.equal(byAction(render(),'review').props.disabled,true);assert.equal(byAction(render(),'save-draft').props.disabled,false);
  await byAction(render(),'save-draft').props.onClick();assert.equal(requests[0].expectedPackageRevision,9);assert.equal(byAction(render(),'review').props.disabled,false);
});

test('inherited room override changes appear in review even without an immediate visual change',async()=>{
  const initial=withDraft(),{render}=stateful(initial,async()=>response(reviewed(initial,{changes:[{roomId:'north-main',key:'roomOverrides.color',before:'#112233',after:null}],affectedRooms:[]})));
  await byAction(render(),'review').props.onClick();assert.equal(byAction(render(),'publish').props.disabled,false);
  assert.match(renderToStaticMarkup(render()),/Bordsfärg \(rumsval\)/);assert.doesNotMatch(renderToStaticMarkup(render()),/roomOverrides.color/);
});
test('room dealers use room-specific choices and frozen schema3 labels',()=>{
  const initial=initialState();initial.presentation={...initial.presentation,schemaVersion:3,registeredDealers:[{id:'astrid',label:'Frozen Astrid',idle:null},{id:'vera',label:'Frozen Vera',idle:null}],playback:{}};
  const {render}=stateful(initial,()=>assert.fail('no request'));select(render(),'Gäller för').props.onChange({target:{value:'north-vip'}});
  const options=select(render(),'Dealer').props.children.flat(Infinity).filter(Boolean);
  assert.equal(options.some(row=>row.props?.value==='vera'),false);assert.equal(options.find(row=>row.props?.value==='astrid').props.children,'Frozen Astrid');
});

test('oversized packages explain how to reduce scope and preserve the draft for another save',async()=>{
  for(const language of ['sv','en']){
    const {render}=stateful(initialState(),async()=>response({},413),{language});
    const label=language==='en'?'Table colour':'Bordsfärg';
    select(render(),label).props.onChange({target:{value:'#445566'}});
    await byAction(render(),'save-draft').props.onClick();
    assert.equal(select(render(),label).props.value,'#445566');assert.equal(byAction(render(),'save-draft').props.disabled,false);assert.equal(byAction(render(),'publish').props.disabled,true);
    const markup=renderToStaticMarkup(render());assert.match(markup,language==='en'?/Reduce the number of room overrides/:/Minska antalet rumsundantag/);assert.match(markup,language==='en'?/20 latest published/:/20 senaste publicerade/);
  }
});
