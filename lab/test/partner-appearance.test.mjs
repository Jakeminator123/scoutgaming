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
  operatorId:'op-1',packageRevision:7,lanes:['mobile-phone'],branding:{},adjustable:['background','table.color','branding'],canConfigure:true,
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
    require:name=>name==='react'?{...React,useState:initial=>[typeof initial==='function'?initial():initial,()=>{}]}
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
    return {ok:true,status:200,json:async()=>({packageRevision:8})};
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
