import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PARTNER_PREVIEW_OPERATORS } from '../lib/partner-preview-policy.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

function loadTs(fileUrl, overrides = {}) {
  const source = readFileSync(fileUrl, 'utf8');
  const output = transformSync(source, { filename: fileURLToPath(fileUrl), jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  const localRequire = createRequire(fileUrl);
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams,
    window: new Proxy({}, { get: (_target, key) => globalThis.window?.[key] }),
    require: name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.endsWith('.module.css') || name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name.startsWith('./') || name.startsWith('../')) {
        for (const suffix of ['', '.tsx', '.ts', '.mjs', '.js']) {
          const candidate = new URL(name + suffix, fileUrl);
          const path = fileURLToPath(candidate);
          if (!existsSync(path)) continue;
          if (path.endsWith('.mjs') || path.endsWith('.js') || path.endsWith('.json')) return localRequire(path);
          return loadTs(pathToFileURL(path), overrides);
        }
      }
      return localRequire(name);
    },
  }, { filename: fileURLToPath(fileUrl) });
  return module.exports;
}

const { ControlWorkspace } = loadTs(new URL('../components/control-workspace.tsx', import.meta.url));

function render(props) {
  return renderToStaticMarkup(React.createElement(ControlWorkspace, props));
}

test('overview distinguishes shared preparation from company publication and explicit demonstration data', () => {
  const operators = [...PARTNER_PREVIEW_OPERATORS].reverse().map(item => ({ id:item.id, slug:item.slug, name:item.name, privateField:'never-pass' }));
  const html = render({ user:'fixture-admin', operators, operatorStatus:'demo' });
  assert.match(html,/Demonstrationsbolag/); assert.match(html,/Utforska arbetsflödet/);
  assert.doesNotMatch(html,/never-pass|Hämtad från spellobbyn|href="\/play\?operator=/);
  for (const title of ['Dealer &amp; klipp','Sammansättning','Bolagets publicering','Spelrum']) assert.match(html,new RegExp('<h3>'+title+'</h3>'));
  assert.ok(html.indexOf('Demo North')<html.indexOf('Demo South'));
  assert.match(html,/Kräver partnerinloggning eller en aktiv administratörssession/);
  assert.match(html,/href="\/control\/administration\?tab=media-review"/);
});
test('an unavailable list is not presented as empty or as a demonstration', () => {
  const html=render({user:'admin',operatorStatus:'unavailable',operators:[{id:'secret',slug:'secret',name:'Private company'}]});
  assert.match(html,/Bolagslistan kunde inte hämtas/); assert.doesNotMatch(html,/Private company|Inga bolag ännu|Anslutna bolag · 0|<select/);
  const empty=render({user:'admin',operatorStatus:'live',operators:[]});
  assert.match(empty,/Börja med ett bolag/);assert.match(empty,/Skapa bolag/);assert.doesNotMatch(empty,/kunde inte hämtas/);
});
test('company links use the internal id for publication, the slug for players, and hide stale room data immediately', () => {
  let selected=null;
  const oldData={key:'north-slug',status:'ready',data:{packageRevision:3,rooms:[{id:'room-north',name:'North room',presentation:{id:'standard',label:'Standard'},dealers:[],playUrl:'/play/blackjack?operator=north-slug&table=room-north'}]}};
  const hooks={...React,useEffect(){},useState:initial=>[selected??initial,value=>{selected=value;}],useRef:()=>({current:null}),useSyncExternalStore:()=>oldData};
  const {ControlWorkspace:Interactive}=loadTs(new URL('../components/control-workspace.tsx',import.meta.url),{react:hooks});
  const props={user:'admin',operatorStatus:'live',operators:[{id:'north-id',slug:'north-slug',name:'North'},{id:'south-id',slug:'south-slug',name:'South'}]};
  let select; const visit=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node))return node.forEach(visit);if(node.type==='select')select=node;visit(node.props?.children);};
  visit(Interactive(props));
  let replaced; globalThis.window={location:{search:'?other=keep',pathname:'/control',hash:''},history:{replaceState(_s,_t,url){replaced=url;}}};
  try {select.props.onChange({target:{value:'south-id'}});}finally{delete globalThis.window;}
  const html=renderToStaticMarkup(Interactive(props));
  assert.match(replaced,/operator=south-id/);assert.match(replaced,/other=keep/);
  assert.match(html,/href="\/control\/rooms\?operator=south-id"/);
  assert.match(html,/href="\/partner\/south-slug"/);
  assert.doesNotMatch(html,/North room|room-north|Hämtad från spellobbyn/);
  assert.match(html,/Hämtar bolagets publicering/);
});

test('built-in guide describes published company design and the current room publication workflow', () => {
  const guide = JSON.parse(readFileSync(new URL('../docs/guide.json', import.meta.url), 'utf8'));
  const publishing = guide.surfaces.find(item => item.name.startsWith('Publicering'));
  assert.match(publishing.purpose, /Skapa spelrum/);
  assert.doesNotMatch(publishing.purpose, /JSON-export/);
  const partner = guide.surfaces.find(item => item.name.startsWith('Partnerportal'));
  assert.match(partner.purpose, /bord och bakgrunder sparas på servern/);
  assert.doesNotMatch(partner.purpose, /kort och bord.*lokala prov/);
});
