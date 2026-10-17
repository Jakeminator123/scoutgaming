import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createSeedProject} from '../../packages/presentation/contracts/studio-model.mjs';
import {changeMaterialTrash} from '../lib/material-trash.mjs';
import {layerAssetPath} from '../../web/presentation-layers.mjs';
const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
const url=new URL('../components/layer-asset-manager.tsx',import.meta.url),localRequire=createRequire(url);
const output=transformSync(readFileSync(url,'utf8'),{filename:fileURLToPath(url),jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
function fixture(){
 const project=createSeedProject(),asset={schemaVersion:1,id:'11111111-1111-4111-8111-111111111111',role:'background',label:'Bakgrund',sha256:'a'.repeat(64),size:128,contentType:'image/png',width:100,height:100};
 asset.pathname=layerAssetPath(asset);project.layerAssets=[asset];
 const impact={id:asset.id,role:asset.role,label:asset.label,archived:true,token:'a'.repeat(64),compositions:[],rooms:[],operators:[]};
 return {project,asset,impact};
}
function harness(props={}){
 const f=fixture(),slots=[],effects=[],requests=[],saved=[],busy=[];let cursor=0,queued=[];
 const input={project:f.project,role:'background',disabled:false,onSaved:value=>saved.push(value),onBusyChange:value=>busy.push(value),...props};
 const react={...React,useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
  useRef(value){return slots[cursor++]??={current:value};},useEffect(fn,deps){const i=cursor++,old=effects[i];if(!old||deps.some((v,j)=>v!==old.deps[j]))queued.push(()=>{old?.cleanup?.();effects[i]={deps,cleanup:fn()};});}};
 const module={exports:{}};
 vm.runInNewContext(output.code,{module,exports:module.exports,require:name=>name==='react'?react:name==='./studio-types'?{requestJson:(path,options)=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}))}:localRequire(name)});
 const render=()=>{cursor=0;queued=[];const tree=module.exports.LayerAssetManager(input);for(const fn of queued)fn();return tree;};
 const all=node=>!node||typeof node!=='object'?[]:[node,...React.Children.toArray(node.props?.children).flatMap(all)];
 return {...f,input,requests,saved,busy,render,button:label=>all(render()).find(node=>node.type==='button'&&node.props.children===label),html:()=>renderToStaticMarkup(render()),
  async reply(i,value){requests[i].resolve(value);await new Promise(resolve=>setImmediate(resolve));},
  async reject(i){requests[i].reject(Error('failure'));await new Promise(resolve=>setImmediate(resolve));},
  unmount(){effects.forEach(effect=>effect?.cleanup?.());}};
}
test('material trash requires an authoritative impact, binds confirmation and verifies saved state before replacing the editor',async()=>{
 const h=harness();const button=h.button('Flytta till papperskorgen');button.props.onClick();button.props.onClick();assert.equal(h.requests.length,1);
 assert.deepEqual(JSON.parse(h.requests[0].options.body),{id:h.asset.id,archived:true,expectedRevision:h.project.revision});
 await h.reply(0,{impact:h.impact});assert.ok(h.button('Bekräfta'));h.button('Bekräfta').props.onClick();
 assert.equal(JSON.parse(h.requests[1].options.body).impactToken,h.impact.token);
 const project=changeMaterialTrash(h.project,{id:h.asset.id,archived:true});project.revision='saved-trash';
 await h.reply(1,{ok:true,impact:h.impact,project});assert.equal(h.requests[2].path,'/api/project');assert.equal(h.saved.length,0);
 await h.reply(2,{project});assert.equal(h.saved.length,1);assert.equal(h.saved[0].revision,'saved-trash');assert.equal(h.busy.at(-1),false);
});
test('foreign impact, failed receipt and failed readback never enable blind retries',async()=>{
 const h=harness();h.button('Flytta till papperskorgen').props.onClick();await h.reply(0,{impact:{...h.impact,id:'other'}});
 assert.equal(h.button('Bekräfta'),undefined);assert.equal(h.button('Flytta till papperskorgen').props.disabled,true);assert.ok(h.button('Läs in aktuella uppgifter'));
 h.button('Läs in aktuella uppgifter').props.onClick();await h.reply(1,{project:h.project});h.render();assert.equal(h.button('Flytta till papperskorgen').props.disabled,false);
 h.button('Flytta till papperskorgen').props.onClick();await h.reply(2,{impact:h.impact});h.button('Bekräfta').props.onClick();
 const project=changeMaterialTrash(h.project,{id:h.asset.id,archived:true});project.revision='new';await h.reply(3,{ok:true,impact:h.impact,project});await h.reject(4);
 assert.equal(h.saved.length,1,'only the explicit refresh was accepted');assert.equal(h.button('Flytta till papperskorgen').props.disabled,true);
});
test('new editor revision, disabled drafts and unmount prevent stale material actions',async()=>{
 const h=harness();h.button('Flytta till papperskorgen').props.onClick();await h.reply(0,{impact:h.impact});
 h.input.project={...h.project,revision:'external-change'};h.render();h.render();assert.equal(h.button('Bekräfta'),undefined);
 h.input.disabled=true;h.button('Flytta till papperskorgen').props.onClick();assert.equal(h.requests.length,1);
 h.input.disabled=false;h.button('Flytta till papperskorgen').props.onClick();h.unmount();await h.reply(1,{impact:h.impact});assert.equal(h.saved.length,0);
});
test('persisted trash remains visible and restoration also requires an explicit confirmation',async()=>{
 const f=fixture(),project=changeMaterialTrash(f.project,{id:f.asset.id,archived:true}),h=harness({project});
 assert.match(h.html(),/Papperskorg · 1/);h.button('Återställ').props.onClick();assert.equal(JSON.parse(h.requests[0].options.body).archived,false);
 await h.reply(0,{impact:{...h.impact,archived:false}});assert.ok(h.button('Bekräfta'));assert.match(h.html(),/Filen blir valbar igen/);
});

test('Admin material cards share the game filter and authoritative trash confirmation without a second action list',async()=>{
 const h=harness({role:'table',filterAsset:asset=>asset.game==='blackjack',
  renderAsset:(asset,actions)=>React.createElement('article',null,asset.label,React.createElement('button',{disabled:actions.disabled,onClick:actions.onTrash},'Kortets papperskorg'))});
 const blackjack={...h.asset,role:'table',game:'blackjack',label:'Blackjackbord'},roulette={...h.asset,id:'22222222-2222-4222-8222-222222222222',role:'table',game:'roulette',label:'Roulettebord'};
 h.input.project={...h.project,layerAssets:[blackjack,roulette]};
 const html=h.html();assert.match(html,/Blackjackbord/);assert.doesNotMatch(html,/Roulettebord/);assert.doesNotMatch(html,/Oanvänd i utkast/);
 assert.equal(h.button('Flytta till papperskorgen'),undefined,'the separate action list is replaced by the card');
 h.button('Kortets papperskorg').props.onClick();assert.equal(h.requests.length,1);
 assert.deepEqual(JSON.parse(h.requests[0].options.body),{id:blackjack.id,archived:true,expectedRevision:h.project.revision});
 await h.reply(0,{impact:{...h.impact,role:'table',label:blackjack.label}});
 assert.ok(h.button('Bekräfta'),'card action still requires the server impact and explicit confirmation');
 h.input.disabled=true;assert.equal(h.button('Kortets papperskorg').props.disabled,true);
 h.button('Kortets papperskorg').props.onClick();assert.equal(h.requests.length,1,'disabled draft cannot start another action');
});

test('material trash restoration follows the selected game without hiding its protected stored entries',()=>{
 const h=harness({role:'table',filterAsset:asset=>asset.game==='roulette'});
 const blackjack={...h.asset,role:'table',game:'blackjack',label:'Arkiverat blackjackbord'},roulette={...h.asset,id:'22222222-2222-4222-8222-222222222222',role:'table',game:'roulette',label:'Arkiverat roulettebord'};
 h.input.project={...h.project,layerAssets:[],layerAssetTrash:[{asset:blackjack,archivedAt:'2026-10-15T00:00:00.000Z'},{asset:roulette,archivedAt:'2026-10-15T00:00:00.000Z'}]};
 assert.match(h.html(),/Arkiverat roulettebord/);assert.doesNotMatch(h.html(),/Arkiverat blackjackbord/);
 h.button('Återställ').props.onClick();assert.equal(JSON.parse(h.requests[0].options.body).id,roulette.id);
 assert.equal(h.input.project.layerAssetTrash.length,2,'filtering does not mutate stored material');
});