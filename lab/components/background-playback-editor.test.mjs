import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import React from 'react';
import {createSeedProject,defaultPresentationLane} from '../lib/studio-model.mjs';
import {defaultBackgroundRule,validateBackgroundPlayback,BACKGROUND_EVENT_IDS} from '../../web/public/background-playback-policy.mjs';
import {layerAssetPath} from '../../web/layer-asset-contract.mjs';

const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
function load(file,overrides={},globals={}){
  const url=new URL(file,import.meta.url),localRequire=createRequire(url),module={exports:{}};
  const {code}=transformSync(readFileSync(url,'utf8'),{filename:fileURLToPath(url),jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
  vm.runInNewContext(code,{module,exports:module.exports,structuredClone,URL,URLSearchParams,...globals,require:name=>{
    if(Object.hasOwn(overrides,name))return overrides[name];
    if(name.endsWith('.css'))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
    if(name==='./studio-types')return load('./studio-types.ts',overrides,globals);
    if(name.startsWith('./')&&!/\.(mjs|js)$/.test(name))return new Proxy({},{get:(_,key)=>key});
    return localRequire(name);
  }});return module.exports;
}
function nodes(tree,predicate){if(Array.isArray(tree))return tree.flatMap(node=>nodes(node,predicate));if(!tree||typeof tree!=='object')return [];return [...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)];}
const text=tree=>Array.isArray(tree)?tree.map(text).join(''):tree&&typeof tree==='object'?text(tree.props?.children):String(tree??'');
const button=(tree,label)=>{const found=nodes(tree,node=>node.type==='button'&&text(node)===label)[0];assert.ok(found,label);return found;};
const field=(tree,label)=>{const found=nodes(tree,node=>node.props?.['aria-label']===label)[0];assert.ok(found,label);return found;};
const asset=(n,role='background',contentType='video/mp4')=>{const row={schemaVersion:1,id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,role,label:`Media ${n}`,sha256:'a'.repeat(64),size:32,contentType,width:640,height:360};return {...row,pathname:layerAssetPath(row)};};
const assets=[asset(1,'background','image/png'),asset(2),asset(3),asset(4,'table')];
const {BackgroundPlaybackEditor}=load('./background-playback-editor.tsx');
function editor(extra={}){
  let policy=extra.policy,calls=0;const previews=[];
  const props={assets,allowed:[assets[0].id,assets[1].id,assets[3].id],baseSelected:true,...extra,onChange(value){calls++;policy=value?structuredClone(value):undefined;if(policy)validateBackgroundPlayback(policy,{assets,allowed:props.allowed,defaultAssetId:assets[0].id});},onPreview:id=>previews.push(id)};
  return {render:()=>BackgroundPlaybackEditor({...props,policy}),get policy(){return policy;},get calls(){return calls;},previews,props};
}

test('background editor creates only allowed video rules and previews without saving, using the shared defaults',()=>{
  const h=editor();button(h.render(),'Lägg till bakgrundsklipp').props.onClick();
  assert.deepEqual(h.policy.rules,[defaultBackgroundRule(assets[1].id,'background-1')]);
  const tree=h.render(),choices=nodes(field(tree,'Video för bakgrundsklipp 1'),node=>node.type==='option').map(node=>node.props.value);
  assert.equal(field(tree,'Minsta tid mellan starter för bakgrundsklipp 1').props.value,25);assert.match(text(tree),/Minsta tid mellan starter \(sekunder\)/);assert.doesNotMatch(text(tree),/Minsta paus/);
  assert.deepEqual(choices,[assets[1].id]);
  button(tree,'Prova klipp 1').props.onClick();assert.deepEqual(h.previews,['background-1']);assert.equal(h.calls,1);
  field(tree,'Video för bakgrundsklipp 1').props.onChange({target:{value:assets[2].id}});assert.equal(h.calls,1,'foreign asset rejected');
  field(tree,'Start för bakgrundsklipp 1').props.onChange({target:{value:'event'}});
  assert.deepEqual(h.policy.rules[0].trigger,{eventId:'speak.goodluck'});
  assert.deepEqual(nodes(field(h.render(),'Händelse för bakgrundsklipp 1'),node=>node.type==='option').map(node=>node.props.value),[...BACKGROUND_EVENT_IDS]);
  field(h.render(),'Händelse för bakgrundsklipp 1').props.onChange({target:{value:'speak.win'}});assert.deepEqual(h.policy.rules[0].trigger,{eventId:'speak.win'});
  field(h.render(),'Händelse för bakgrundsklipp 1').props.onChange({target:{value:'unknown'}});assert.deepEqual(h.policy.rules[0].trigger,{eventId:'speak.win'});
  button(h.render(),'Ta bort klipp 1').props.onClick();assert.equal(h.policy,undefined);
});

test('background editor bounds timer and playback budgets and preserves disabled or missing-base drafts',()=>{
  const original={schemaVersion:1,rules:[defaultBackgroundRule(assets[1].id,'background-1')]},h=editor({policy:original});
  for(const [label,value,expected] of [['Intervall',Infinity,25000],['Intervall',1,5000],['Intervall',999,300000]]){
    field(h.render(),`${label} för bakgrundsklipp 1`).props.onChange({target:{valueAsNumber:value}});assert.equal(h.policy.rules[0].trigger.everyMs,expected);
  }
  field(h.render(),'Maxlängd för bakgrundsklipp 1').props.onChange({target:{valueAsNumber:59}});assert.equal(h.policy.rules[0].maxDurationMs,20000);
  field(h.render(),'Sekunder per minut för bakgrundsklipp 1').props.onChange({target:{valueAsNumber:1}});assert.equal(h.policy.rules[0].maxSecondsPerMinute,20);
  field(h.render(),'Starter per minut för bakgrundsklipp 1').props.onChange({target:{valueAsNumber:99}});assert.equal(h.policy.rules[0].maxPerMinute,12);
  assert.equal(original.rules[0].maxDurationMs,10000,'input was not mutated');
  const blocked=editor({policy:original,disabled:true});button(blocked.render(),'Lägg till bakgrundsklipp').props.onClick();button(blocked.render(),'Prova klipp 1').props.onClick();button(blocked.render(),'Ta bort klipp 1').props.onClick();assert.equal(blocked.calls,0);assert.deepEqual(blocked.previews,[]);
  const noBase=editor({baseSelected:false});assert.equal(button(noBase.render(),'Lägg till bakgrundsklipp').props.disabled,true);button(noBase.render(),'Lägg till bakgrundsklipp').props.onClick();assert.equal(noBase.calls,0);
  const full=editor({policy:{schemaVersion:1,rules:Array.from({length:16},(_,n)=>defaultBackgroundRule(assets[1].id,`background-${n+1}`))}});button(full.render(),'Lägg till bakgrundsklipp').props.onClick();assert.equal(full.calls,0);
});

test('layer grants used by background rules cannot be removed accidentally while other layer choices remain editable',()=>{
  const {LayerAssetSelect}=load('./layer-selectors.tsx'),changes=[];
  const lane=defaultPresentationLane('astrid');lane.layers.background={enabled:true,mode:'image',default:assets[0].id,allowed:assets.slice(0,3).map(row=>row.id)};
  lane.backgroundPlayback={schemaVersion:1,rules:[defaultBackgroundRule(assets[1].id,'one')]};
  const tree=LayerAssetSelect({role:'background',lane,assets,onChange:value=>changes.push(value)});
  const checks=nodes(tree,node=>node.type==='input'&&node.props.type==='checkbox');
  assert.equal(checks[0].props.disabled,true);assert.equal(checks[1].props.disabled,true);assert.equal(checks[2].props.disabled,false);
  checks[0].props.onChange({target:{checked:false}});checks[1].props.onChange({target:{checked:false}});assert.equal(changes.length,0);
  nodes(tree,node=>node.type==='select')[0].props.onChange({target:{value:''}});assert.equal(changes.length,0);
  checks[2].props.onChange({target:{checked:false}});assert.equal(changes.length,1);assert.equal(changes[0].layers.background.allowed.includes(assets[2].id),false);
  assert.equal(lane.layers.background.allowed.length,3);
});

function hooks(){
  const states=[],refs=[],effects=[];let cursor=0,refCursor=0,effectCursor=0,pending=[];
  return {react:{...React,useRef:initial=>refs[refCursor++]??={current:initial},useState(initial){const key=cursor++;if(!(key in states))states[key]=typeof initial==='function'?initial():initial;return [states[key],value=>states[key]=typeof value==='function'?value(states[key]):value];},useEffect(fn,deps){const key=effectCursor++,old=effects[key];if(!old||!deps||deps.some((value,index)=>value!==old.deps[index]))pending.push(()=>{old?.cleanup?.();effects[key]={deps,cleanup:fn()};});}},render(Component,props){cursor=refCursor=effectCursor=0;return Component(props);},effects(){const next=pending;pending=[];next.forEach(fn=>fn());},unmount(){effects.forEach(effect=>effect?.cleanup?.());}};
}

test('composition background rules remain drafts and table size is bounded per format with preview requests separate from saves',()=>{
  let project=createSeedProject(),saves=0;
  const lane=defaultPresentationLane('astrid');lane.layers.background={enabled:true,mode:'image',default:assets[0].id,allowed:[assets[0].id,assets[1].id]};
  project.layerAssets=assets;project.lanes=[lane,{...structuredClone(lane),id:'second'}];
  const baseline=JSON.stringify(project),projectRef={current:project};
  const session={get project(){return project;},projectRef,videos:{videos:[]},get dirty(){return JSON.stringify(project)!==baseline;},saving:false,save:async()=>{saves++;return true;},savedJson:baseline,modelEdit(fn){project=fn(project);projectRef.current=project;},setSavedJson(){},setProject(){},setConflict(){},setError(){},setNotice(){},conflict:false};
  const h=hooks(),window={addEventListener(){},removeEventListener(){},location:{href:'https://qa.invalid/control/compositions'},history:{replaceState(){}}};
  const {ControlPreviewPage}=load('./control-preview-page.tsx',{react:h.react,'./studio-session':{useStudioProjectSession:()=>session}},{window});
  const props={initialProject:project,initialVideos:{videos:[]},initialStatus:{provider:'neon'},initialLaneId:lane.id};
  const render=()=>{let tree=h.render(ControlPreviewPage,props);h.effects();return h.render(ControlPreviewPage,props);};
  let tree=render();const editor=nodes(tree,node=>node.type==='BackgroundPlaybackEditor')[0];assert.equal(editor.props.baseSelected,true,'image base supported');
  editor.props.onChange({schemaVersion:1,rules:[defaultBackgroundRule(assets[1].id,'test-rule')]});tree=render();
  const backgroundVisibility=()=>nodes(nodes(tree,node=>node.type==='fieldset'&&nodes(node,row=>row.type==='legend'&&text(row)==='Synliga lager').length)[0],node=>node.type==='input'&&node.props.type==='checkbox')[2];
  assert.equal(backgroundVisibility().props.disabled,true);backgroundVisibility().props.onChange({target:{checked:false}});assert.equal(project.lanes[0].layers.background.enabled,true,'active rule base survives even a directly dispatched disabled callback');
  const preview=()=>nodes(tree,node=>node.type==='CompositionPreview')[0].props;
  assert.equal(preview().backgroundPlayback.rules[0].id,'test-rule');assert.deepEqual(preview().backgroundAssets.map(row=>row.id),[assets[0].id,assets[1].id]);
  nodes(tree,node=>node.type==='BackgroundPlaybackEditor')[0].props.onPreview('test-rule');tree=render();assert.equal(preview().previewBackgroundRuleId,'test-rule');assert.equal(preview().previewBackgroundRequest,1);assert.equal(saves,0);
  const mobile=project.lanes[0].composition.mobile.table.width,desktop=project.lanes[0].composition.desktop.table.width;
  button(tree,'Förstora bord').props.onClick();tree=render();assert.equal(project.lanes[0].composition.mobile.table.width,Math.round((mobile+.1)*100)/100);assert.equal(project.lanes[0].composition.desktop.table.width,desktop);
  field(tree,'Bordets storlek i procent').props.onChange({target:{valueAsNumber:999}});tree=render();assert.equal(project.lanes[0].composition.mobile.table.width,4);assert.equal(button(tree,'Förstora bord').props.disabled,true);
  button(tree,'Desktop 16:9').props.onClick();tree=render();field(tree,'Bordets storlek i procent').props.onChange({target:{valueAsNumber:1}});tree=render();assert.equal(project.lanes[0].composition.desktop.table.width,.1);assert.equal(button(tree,'Förminska bord').props.disabled,true);assert.equal(project.lanes[0].composition.mobile.table.width,4);
  nodes(tree,node=>node.type==='BackgroundPlaybackEditor')[0].props.onChange(undefined);tree=render();assert.equal(backgroundVisibility().props.disabled,false);backgroundVisibility().props.onChange({target:{checked:false}});assert.equal(project.lanes[0].layers.background.enabled,false,'background can be hidden after removing its rules');
  nodes(tree,node=>node.type==='CompositionMetadata')[0].props.onSelect('second');tree=render();assert.equal(preview().previewBackgroundRuleId,undefined);assert.equal(preview().previewBackgroundRequest,0);assert.equal(saves,0);h.unmount();
});
