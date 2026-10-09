import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TABLE_COLOR_BRANDING_KEY } from '../lib/partner-branding-api.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const fileUrl = new URL('../components/partner-appearance.tsx', import.meta.url);
const compiled = transformSync(readFileSync(fileUrl, 'utf8'), {
  filename: fileURLToPath(fileUrl),
  jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } },
  module: { type: 'commonjs' },
});
const module = { exports: {} };
const localRequire = createRequire(fileUrl);
vm.runInNewContext(compiled.code, {
  module,
  exports: module.exports,
  require: name => name.endsWith('.module.css') || name.endsWith('.css')
    ? { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
    : localRequire(name),
}, { filename: fileURLToPath(fileUrl) });

test('appearance renders a disabled lane field and exactly one lime save button', () => {
  const html = renderToStaticMarkup(React.createElement(module.exports.PartnerAppearance, {
    apiBase: '/studio/api/partner',
    operatorSlug: 'demo-north',
    initial: {
      operatorId: 'operator-demo-north',
      packageRevision: 4,
      lanes: ['mobile-phone'],
      branding: { [TABLE_COLOR_BRANDING_KEY]: '#112233', name: 'North' },
      adjustable: ['table.color'],
    },
  }));
  assert.match(html, /Tillåts inte av lanen/);
  assert.equal((html.match(/sg-btn-primary/g) || []).length, 1);
  assert.match(html, /class="sg-btn sg-btn-primary"/);
  assert.match(html, /Spara utseende/);
  assert.equal((html.match(/<button\b/g) || []).length, 1);
  assert.match(html, /type="color"/);
  assert.match(html, /#112233/);
  assert.match(html, /Revision 4/);
  assert.match(html, /mobile-phone/);
  assert.match(html, /disabled=""/);
});

import {defaultPresentationLane} from '../lib/studio-model.mjs';
import {defaultCompositionSettings} from '../../web/public/composition-settings.mjs';
const canonicalInitial=(layered=true)=>({
  operatorId:'op-1',packageRevision:7,lanes:['mobile-phone'],branding:{},adjustable:['background','table.color','branding'],canConfigure:true,dealerChoices:{'mobile-phone':['astrid']},
  presentation:{schemaVersion:1,projectRevision:'r1',assets:[],lanes:[{...defaultPresentationLane(),operatorAdjustable:['background','table.color','branding'],...(layered?{composition:defaultCompositionSettings()}: {})}]}
});
test('read-only roles see the assigned choices with saving and editing disabled',()=>{
  const html=renderToStaticMarkup(React.createElement(module.exports.PartnerAppearance,{apiBase:'/api/partner',operatorSlug:'north',initial:{...canonicalInitial(),canConfigure:false}}));
  assert.match(html,/Din roll kan läsa paketet/);
  assert.match(html,/<fieldset disabled=""/);
  assert.match(html,/<button[^>]*disabled=""/);
});
test('full-frame package cannot offer an ineffective table colour control',()=>{
  const html=renderToStaticMarkup(React.createElement(module.exports.PartnerAppearance,{apiBase:'/api/partner',operatorSlug:'north',initial:canonicalInitial(false),section:'design'}));
  assert.match(html,/Fullbildsklipp/);
  assert.doesNotMatch(html,/type="color"/);
  assert.match(html,/<button[^>]*disabled=""/);
});
test('a connected background destination exposes only the background adjustment',()=>{
  const initial=canonicalInitial();
  initial.presentation.lanes[0].layers.background.mode='image';
  const html=renderToStaticMarkup(React.createElement(module.exports.PartnerAppearance,{apiBase:'/api/partner',operatorSlug:'north',initial,section:'background'}));
  assert.match(html,/aria-label="Bakgrund"/);
  assert.doesNotMatch(html,/type="color"|Ordmarke|Primärfärg|aria-label="Bord"|aria-label="Dealer"/);
});

function actionPanel(initial,section,fetcher) {
  const output={exports:{}};
  vm.runInNewContext(compiled.code,{
    module:output,exports:output.exports,fetch:fetcher,
    require:name=>name==='react'?{...React,useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useRef:initial=>({current:initial})}
      :name.endsWith('.css')?{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})}:localRequire(name)
  },{filename:fileURLToPath(fileUrl)});
  return output.exports.PartnerAppearance({initial,section,apiBase:'/studio/api/partner',operatorSlug:'north'});
}
function saveButton(tree) {
  if(!tree||typeof tree!=='object')return null;
  if(tree.type==='button')return tree;
  for(const child of [tree.props?.children].flat(Infinity)){const found=saveButton(child);if(found)return found;}
  return null;
}
test('background save submits only its lane choice and revision, preserving other package settings',async()=>{
  const requests=[],initial=canonicalInitial();
  const id='22222222-2222-4222-8222-222222222222';
  initial.presentation.lanes[0].layers.background={enabled:true,mode:'video',default:id,allowed:[id]};
  initial.branding={lane:'mobile-phone',background:id,name:'North',dealer:'astrid',color:'#112233'};
  const panel=actionPanel(initial,'background',async(url,request)=>{
    requests.push({url,request});
    return {ok:true,status:200,json:async()=>({...initial,packageRevision:8})};
  });
  await saveButton(panel).props.onClick();
  assert.equal(requests.length,1);
  assert.equal(requests[0].url,'/studio/api/partner/branding?operator=north');
  assert.deepEqual(JSON.parse(requests[0].request.body),{expectedRevision:7,branding:{lane:'mobile-phone',background:id}});
  assert.equal(requests[0].request.credentials,'same-origin');
});
test('read-only save handler performs no network mutation even when invoked directly',async()=>{
  const panel=actionPanel({...canonicalInitial(),canConfigure:false},'theme',()=>assert.fail('read-only mutation'));
  const button=saveButton(panel);
  assert.equal(button.props.disabled,true);
  await button.props.onClick();
});


function walk(tree,predicate) {
  if(!tree||typeof tree!=='object')return [];
  return [...(predicate(tree)?[tree]:[]),...[tree.props?.children].flat(Infinity).flatMap(child=>walk(child,predicate))];
}
function statefulPanel(initial,section,fetcher,onSaved) {
  const output={exports:{}},slots=[];let cursor=0;
  const hooks={...React,useState:value=>{
    const index=cursor++;if(!(index in slots))slots[index]=typeof value==='function'?value():value;
    return [slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next;}];
  },useRef:value=>{const index=cursor++;if(!(index in slots))slots[index]={current:value};return slots[index];}};
  vm.runInNewContext(compiled.code,{module:output,exports:output.exports,fetch:fetcher,
    require:name=>name==='react'?hooks:name.endsWith('.css')?{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})}:localRequire(name)
  },{filename:fileURLToPath(fileUrl)});
  return ()=>{cursor=0;return output.exports.PartnerAppearance({initial,section,apiBase:'/studio/api/partner',operatorSlug:'north',onSaved});};
}
function twoLanes() {
  const initial=canonicalInitial(),first=initial.presentation.lanes[0],second=structuredClone(first);
  first.operatorAdjustable=['table','table.color','background','dealer','branding'];first.dealers=['astrid','vera'];
  first.layers.dealer={enabled:true,default:'astrid',allowed:['astrid','vera']};
  first.layers.table.colors=['#112233','#445566'];
  second.id='vip';second.label='VIP';second.operatorAdjustable=first.operatorAdjustable;second.layers.table.colors=['#112233','#445566'];
  initial.presentation.lanes.push(second);initial.lanes.push('vip');initial.dealerChoices={'mobile-phone':['astrid','vera'],vip:['astrid']};
  initial.branding={dealer:'vera',color:'#445566',name:'North'};
  return initial;
}

test('first presentation defaults restore saved dealer and colour after browsing another lane without explicit branding.lane',async()=>{
  for(const section of ['dealers','design']){
    const initial=twoLanes(),requests=[];
    const render=statefulPanel(initial,section,async(_url,request)=>{const body=JSON.parse(request.body);requests.push(body);return {ok:true,status:200,json:async()=>({...initial,packageRevision:8,branding:body.branding})};});
    const presentation=tree=>walk(tree,node=>node.type==='select')[0];
    presentation(render()).props.onChange({target:{value:'vip'}});
    presentation(render()).props.onChange({target:{value:'mobile-phone'}});
    await saveButton(render()).props.onClick();
    assert.equal(requests[0].expectedRevision,7);assert.equal(requests[0].branding.lane,'mobile-phone');
    assert.equal(section==='dealers'?requests[0].branding.dealer:requests[0].branding.color,section==='dealers'?'vera':'#445566');
  }
});
test('dealer options use frozen display labels and exactly the server room intersection',()=>{
  const initial=canonicalInitial(),lane=initial.presentation.lanes[0];
  initial.presentation={...initial.presentation,schemaVersion:2,registeredDealers:[{id:'johanna',label:'Johanna fryst',idle:null},{id:'nora',label:'Nora fryst',idle:null}]};
  lane.operatorAdjustable=['dealer'];lane.dealers=['johanna','nora'];lane.layers.dealer={enabled:true,default:'johanna',allowed:['johanna','nora']};
  initial.dealerChoices={'mobile-phone':['johanna']};
  const html=renderToStaticMarkup(React.createElement(module.exports.PartnerAppearance,{initial,apiBase:'/api/partner',operatorSlug:'north',section:'dealers'}));
  assert.match(html,/Johanna fryst/);assert.doesNotMatch(html,/value="nora"|Nora fryst/);
  assert.doesNotMatch(html,/type="range"|Storlek|Placering/,'N1 owns geometry');
  const readonly=renderToStaticMarkup(React.createElement(module.exports.PartnerAppearance,{initial:{...initial,canConfigure:false},apiBase:'/api/partner',operatorSlug:'north'}));
  assert.match(readonly,/<select disabled=""/);
});
test('save locks synchronously, freezes presentation selection and accepts only the own operator receipt',async()=>{
  const initial=twoLanes(),requests=[],receipts=[];let finish;
  const render=statefulPanel(initial,'dealers',(_url,request)=>{requests.push(JSON.parse(request.body));return new Promise(resolve=>{finish=resolve;});},receipt=>receipts.push(receipt));
  const first=saveButton(render()).props.onClick();
  await saveButton(render()).props.onClick();assert.equal(requests.length,1);
  const selector=walk(render(),node=>node.type==='select')[0];assert.equal(selector.props.disabled,true);
  selector.props.onChange({target:{value:'vip'}});assert.equal(walk(render(),node=>node.type==='select')[0].props.value,'mobile-phone');
  finish({ok:true,status:200,json:async()=>({...initial,operatorId:'another-company',packageRevision:8})});await first;
  assert.equal(receipts.length,0);assert.equal(walk(render(),node=>node.props?.role==='alert').length,1);
  const retry=saveButton(render()).props.onClick();assert.equal(requests.length,2);assert.equal(requests[1].expectedRevision,7);
  finish({ok:true,status:200,json:async()=>({...initial,packageRevision:8,branding:requests[1].branding})});await retry;
  assert.equal(receipts.length,1);assert.equal(receipts[0].operatorId,initial.operatorId);
  assert.equal(receipts[0].branding.dealer,'vera');assert.equal(walk(render(),node=>node.props?.role==='status')[0].props.children[1],'8');
});
