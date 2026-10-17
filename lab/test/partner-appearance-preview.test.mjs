import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {defaultCompositionSettings} from '../../packages/presentation/contracts/composition-settings.mjs';
import {previewMediaPath} from '../../web/public/operator-preview-contract.mjs';
import {defaultPresentationLane} from '../../packages/presentation/contracts/studio-model.mjs';
const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
const fileUrl=new URL('../components/partner-appearance-preview.tsx',import.meta.url),localRequire=createRequire(fileUrl);
const compiled=transformSync(readFileSync(fileUrl,'utf8'),{filename:fileURLToPath(fileUrl),jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
const table1='00000000-0000-4000-8000-000000000001',table2='00000000-0000-4000-8000-000000000002',bg='00000000-0000-4000-8000-000000000003',dealer='00000000-0000-4000-8000-000000000004';
function props(){const lane={...defaultPresentationLane('linnea'),composition:defaultCompositionSettings()};lane.layers.table={enabled:true,default:table1,allowed:[table1,table2]};lane.layers.background={enabled:true,mode:'image',default:bg,allowed:[bg]};lane.layers.dealer={enabled:true,default:'linnea',allowed:['linnea']};return {server:{operatorId:'op-1',packageRevision:7,lanes:['mobile-phone'],branding:{},adjustable:[],rooms:[{id:'north-main',label:'Main',presentationLaneId:'mobile-phone',game:'blackjack'},{id:'north-vip',label:'VIP',presentationLaneId:'mobile-phone',game:'blackjack'}],presentation:{schemaVersion:2,projectRevision:'r1',lanes:[lane],assets:[],registeredDealers:[{id:'linnea',label:'Linnea',idle:null}]}},branding:{table:table2},scope:'north-main',operatorSlug:'north',onStale:()=>{}};}
function descriptor(roomId='north-main') {const context={operatorSlug:'north',roomId,packageRevision:7,dealerId:'linnea'};return {schemaVersion:1,operatorSlug:'north',roomId,packageRevision:7,dealer:{id:'linnea',label:'Linnea'},independentLayers:true,settings:defaultCompositionSettings(),media:{dealer:{src:previewMediaPath(context,'dealer',dealer),contentType:'video/mp4'},tables:[table1,table2].map(id=>({id,label:id===table1?'Default table':'Chosen table',src:previewMediaPath(context,'table',id),contentType:'image/png'})),backgrounds:[{id:bg,label:'Backdrop',src:previewMediaPath(context,'background',bg),contentType:'image/png'}]}};}
function walk(tree,predicate){if(!tree||typeof tree!=='object')return [];return [...(predicate(tree)?[tree]:[]),...[tree.props?.children].flat(Infinity).flatMap(row=>walk(row,predicate))];}
function harness(fetcher){const slots=[],effects=[];let cursor=0;const hooks={...React,useState:value=>{const index=cursor++;if(!(index in slots))slots[index]=typeof value==='function'?value():value;return [slots[index],next=>slots[index]=typeof next==='function'?next(slots[index]):next];},useRef:value=>{const index=cursor++;if(!(index in slots))slots[index]={current:value};return slots[index];},useEffect:(callback,deps)=>{const index=cursor++,previous=slots[index];if(!previous||deps.some((v,i)=>v!==previous.deps[i])){previous?.cleanup?.();slots[index]={deps};effects.push(()=>{slots[index].cleanup=callback();});}}};
 const output={exports:{}};const CompositionPreview=()=>null;
 vm.runInNewContext(compiled.code,{module:output,exports:output.exports,AbortController,fetch:fetcher,require:name=>name==='react'?hooks:name==='./composition-preview'?{CompositionPreview}:name==='./dealer-video-surface'?{DealerClipPreview:()=>null}:name.endsWith('.css')?{__esModule:true,default:{}}:localRequire(name)},{filename:fileURLToPath(fileUrl)});
 return {render:p=>{cursor=0;return output.exports.PartnerAppearancePreview(p);},flush:async()=>{while(effects.length)effects.shift()();await new Promise(resolve=>setImmediate(resolve));},compositions:tree=>walk(tree,node=>node.type===CompositionPreview)};
}
const open=tree=>walk(tree,node=>node.props?.['data-action']==='open-preview')[0];
const response=(value,status=200)=>({ok:status===200,status,json:async()=>value});
test('preview requests only the scoped frozen descriptor on demand and renders exact chosen layers in both layouts',async()=>{
 const calls=[],p=props(),h=harness(async(url,request)=>{calls.push({url,request});return response(descriptor());});
 h.render(p);await h.flush();assert.equal(calls.length,0);
 open(h.render(p)).props.onClick();h.render(p);await h.flush();let tree=h.render(p),composition=h.compositions(tree)[0];
 assert.equal(calls[0].url,'/api/operators/north/rooms/north-main/preview?dealer=linnea&revision=7');assert.equal(calls[0].request.cache,'no-store');
 assert.equal(composition.props.table.label,'Chosen table');assert.equal(composition.props.table.url,descriptor().media.tables[1].src);assert.equal(composition.props.layout,'desktop');
 walk(tree,node=>node.type==='button'&&node.props.children==='Mobil')[0].props.onClick();tree=h.render(p);assert.equal(h.compositions(tree)[0].props.layout,'mobile');assert.equal(calls.length,1);
});

test('switching from blackjack mobile to roulette uses desktop and keeps each room choice isolated',async()=>{
 const p=props(),calls=[];p.server.rooms[0].game='roulette';
 p.branding={roomOverrides:{'north-main':{table:table2},'north-vip':{table:table1}}};
 const original=structuredClone({server:p.server,branding:p.branding});
 const h=harness(async url=>{calls.push(url);return response(descriptor(url.includes('/north-vip/')?'north-vip':'north-main'));});
 const blackjack={...p,scope:'north-vip'};
 open(h.render(blackjack)).props.onClick();h.render(blackjack);await h.flush();
 let tree=h.render(blackjack);walk(tree,node=>node.type==='button'&&node.props.children==='Mobil')[0].props.onClick();
 tree=h.render(blackjack);assert.equal(h.compositions(tree)[0].props.layout,'mobile');assert.equal(h.compositions(tree)[0].props.table.label,'Default table');
 h.render(p);await h.flush();tree=h.render(p);
 assert.equal(h.compositions(tree)[0].props.layout,'desktop');assert.equal(h.compositions(tree)[0].props.table.label,'Chosen table');
 assert.equal(walk(tree,node=>node.type==='button'&&node.props.children==='Mobil').length,0);
 assert.match(calls.at(-1),/rooms\/north-main\/preview\?dealer=linnea&revision=7$/);
 assert.match(renderToStaticMarkup(tree),/Roulette använder Desktop 16:9/);
 h.render(blackjack);await h.flush();tree=h.render(blackjack);
 assert.equal(h.compositions(tree)[0].props.layout,'mobile');assert.equal(h.compositions(tree)[0].props.table.label,'Default table');
 assert.deepEqual({server:p.server,branding:p.branding},original);
});

test('older responses without room game use desktop without guessing from labels',async()=>{
 const p=props();delete p.server.rooms[0].game;p.server.rooms[0].label='Blackjack';
 const h=harness(async()=>response(descriptor()));open(h.render(p)).props.onClick();h.render(p);await h.flush();
 const tree=h.render(p);assert.equal(h.compositions(tree)[0].props.layout,'desktop');
 assert.equal(walk(tree,node=>node.type==='button'&&node.props.children==='Mobil').length,0);
});
test('stale and foreign-context descriptors invalidate parent review and never render their media',async()=>{
 for(const [data,status]of [[{},409],[{...descriptor(),operatorSlug:'foreign'},200]]){let stale=0;const p={...props(),onStale:()=>stale++},h=harness(async()=>response(data,status));open(h.render(p)).props.onClick();h.render(p);await h.flush();assert.equal(stale,1);assert.equal(h.compositions(h.render(p)).length,0);assert.equal(walk(h.render(p),node=>node.props?.role==='alert').length,1);}
});
test('late responses from previous room never display in the next room',async()=>{
 const pending=[],p=props(),h=harness(()=>new Promise(resolve=>pending.push(resolve)));
 open(h.render(p)).props.onClick();h.render(p);await h.flush();const next={...p,scope:'north-vip'};h.render(next);await h.flush();
 pending[0](response(descriptor()));await h.flush();assert.equal(h.compositions(h.render(next)).length,0);
 pending[1](response(descriptor('north-vip')));await h.flush();assert.match(h.compositions(h.render(next))[0].props.dealer.url,/north-vip/);
});
test('base dealer without frozen idle is disclosed and never replaced by another dealer clip',async()=>{
 const p=props(),data=descriptor();data.media.dealer=null;const h=harness(async()=>response(data));open(h.render(p)).props.onClick();h.render(p);await h.flush();
 const tree=h.render(p),html=renderToStaticMarkup(tree);assert.match(html,/saknar tillgänglig fryst grundloop/);assert.equal(h.compositions(tree)[0].props.dealer,null);
});
test('English preview explains incomplete layers and permits retry after a temporary failure',async()=>{
 let count=0;const p={...props(),language:'en'},h=harness(async()=>response(count++?descriptor():{},count===1?503:200));
 open(h.render(p)).props.onClick();h.render(p);await h.flush();assert.match(renderToStaticMarkup(h.render(p)),/Your draft is preserved/);
 open(h.render(p)).props.onClick();h.render(p);await h.flush();assert.equal(h.compositions(h.render(p))[0].props.language,'en');
});

test('shared composition controls keep Swedish default and translate English without alternate media sources',()=>{
 const url=new URL('../components/composition-preview.tsx',import.meta.url),source=transformSync(readFileSync(url,'utf8'),{filename:fileURLToPath(url),jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}),output={exports:{}};
 vm.runInNewContext(source.code,{module:output,exports:output.exports,require:createRequire(url)},{filename:fileURLToPath(url)});
 const common={dealer:null,table:null,background:null,settings:defaultCompositionSettings(),layout:'mobile',show:{dealer:false,table:false,background:false}};
 const sv=renderToStaticMarkup(React.createElement(output.exports.CompositionPreview,common)),en=renderToStaticMarkup(React.createElement(output.exports.CompositionPreview,{...common,language:'en'}));
 assert.match(sv,/Spela två gånger/);assert.match(en,/Play twice/);assert.match(en,/Choose a clip or layer/);assert.match(en,/Mobile 9:16/);assert.doesNotMatch(en,/Spela|Avancerat/);
});

test('an unavailable published default never falls back to the first room dealer',async()=>{
 const calls=[],p=props();p.server.presentation.lanes[0].layers.dealer.default='astrid';p.server.presentation.lanes[0].layers.dealer.allowed=['astrid','linnea'];p.server.roomDealerChoices={'north-main':['linnea']};
 const h=harness(async url=>{calls.push(url);return response(descriptor());});
 let tree=h.render(p);assert.equal(open(tree).props.disabled,true);assert.match(renderToStaticMarkup(tree),/Det sparade dealervalet kan inte användas/);
 open(tree).props.onClick();h.render(p);await h.flush();tree=h.render(p);
 assert.equal(calls.length,0);assert.equal(h.compositions(tree).length,0);assert.doesNotMatch(renderToStaticMarkup(tree),/Hämtar frysta lager/);
 assert.equal(p.server.presentation.lanes[0].layers.dealer.default,'astrid','a blocked preview does not rewrite the saved choice');
});

test('a missing published dealer choice requires an explicit choice and does not select a room dealer',async()=>{
 const calls=[],p=props();p.server.presentation.lanes[0].layers.dealer.default=null;p.server.roomDealerChoices={'north-main':['linnea']};
 const h=harness(async url=>{calls.push(url);return response(descriptor());});
 open(h.render(p)).props.onClick();h.render(p);await h.flush();assert.equal(calls.length,0);
 assert.match(renderToStaticMarkup(h.render(p)),/saknar ett publicerat dealerval/);
 assert.match(renderToStaticMarkup(h.render({...p,language:'en'})),/no published dealer choice/);
});

test('explicit company and room dealer choices remain authoritative when the published default is unavailable',async()=>{
 for(const explicit of [{dealer:'linnea'},{roomOverrides:{'north-main':{dealer:'linnea'}}}]){
  const calls=[],p=props();p.server.presentation.lanes[0].layers.dealer.default='astrid';p.server.roomDealerChoices={'north-main':['linnea']};p.branding={...p.branding,...explicit};
  const h=harness(async url=>{calls.push(url);return response(descriptor());});
  assert.equal(open(h.render(p)).props.disabled,false);open(h.render(p)).props.onClick();h.render(p);await h.flush();
  assert.equal(calls.length,1);assert.match(calls[0],/dealer=linnea&revision=7$/);assert.equal(h.compositions(h.render(p))[0].props.dealer.label,'Linnea');
 }
});

test('a saved explicit choice outside the room grant remains unchanged and cannot show another dealer',async()=>{
 const calls=[],p=props();p.branding={...p.branding,dealer:'astrid'};p.server.presentation.lanes[0].layers.dealer.allowed=['linnea','astrid'];p.server.roomDealerChoices={'north-main':['linnea']};
 const h=harness(async url=>{calls.push(url);return response(descriptor());});open(h.render(p)).props.onClick();h.render(p);await h.flush();
 assert.equal(calls.length,0);assert.equal(p.branding.dealer,'astrid');assert.match(renderToStaticMarkup(h.render({...p,language:'en'})),/saved dealer choice cannot be used/);
});

test('leaving the retained room workspace removes playing preview media without changing draft choices',async()=>{
  const p=props(),h=harness(async()=>response(descriptor()));
  open(h.render(p)).props.onClick();h.render(p);await h.flush();assert.equal(h.compositions(h.render(p)).length,1);
  h.render({...p,active:false});await h.flush();assert.equal(h.compositions(h.render({...p,active:false})).length,0);
  assert.equal(h.compositions(h.render({...p,active:true})).length,0,'preview resumes only on an explicit user action');
});


test('Admin preview loads the exact frozen descriptor initially, while inactive panels stay idle',async()=>{
 for(const active of [true,false]){
  const calls=[],p={...props(),active,initiallyEnabled:true},h=harness(async(url,request)=>{calls.push({url,request});return response(descriptor());});
  h.render(p);await h.flush();const tree=h.render(p);
  assert.equal(calls.length,active?1:0);assert.equal(h.compositions(tree).length,active?1:0);
  if(active){assert.equal(calls[0].url,'/api/operators/north/rooms/north-main/preview?dealer=linnea&revision=7');assert.equal(calls[0].request.method??'GET','GET');assert.equal(calls[0].request.body,undefined);}
 }
});
