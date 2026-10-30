import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInThisContext} from 'node:vm';
import * as placement from '../lib/composition-placement.mjs';
import {zoomComposition} from '../lib/composition-zoom.mjs';
import {defaultCompositionSettings,defaultBlackjackTableGeometry,validateCompositionSettings,sceneForComposition} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {tableRect,stageGeometry} from '../../../packages/presentation/compositor/geometry.js';

const require=createRequire(import.meta.url),React=require('react'),{transformSync}=require('esbuild');
const nodes=(node,p)=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(n=>nodes(n,p)):[...(p(node)?[node]:[]),...nodes(node.props?.children,p)];
const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const table={width:1672,height:941};
function settings(){const value=defaultCompositionSettings();value.blackjackTables=[defaultBlackjackTableGeometry('10000000-0000-4000-8000-000000000001')];return value;}

for(const layout of ['mobile','desktop'])test(`${layout}: existing table y is the top edge; explicit bottom alignment uses the asset aspect and keeps cards untouched`,()=>{
  const original=settings(),saved=structuredClone(original),scene=sceneForComposition(original,layout),g=stageGeometry(scene);
  const originalRect=tableRect(scene,table,g);close(originalRect[1],g.dims[1]*.04);
  const aligned=placement.alignCompositionLayer(original,layout,'table','bottom',table),rect=placement.compositionLayerRect(aligned,layout,'table',table);
  close(rect.y+rect.height,1);assert.notEqual(aligned[layout].table.y,.04);
  const plain=placement.sizeCompositionLayer(aligned,layout,'table',aligned[layout].table.width*1.2,{asset:table});
  close(plain[layout].table.y,aligned[layout].table.y,'without explicit keepBottom the stored origin stays unchanged');
  const kept=placement.sizeCompositionLayer(aligned,layout,'table',aligned[layout].table.width*1.2,{asset:table,keepBottom:true});
  const resized=placement.compositionLayerRect(kept,layout,'table',table);close(resized.y+resized.height,1);
  assert.deepEqual(kept.blackjackTables,original.blackjackTables);assert.deepEqual(kept[layout==='mobile'?'desktop':'mobile'],original[layout==='mobile'?'desktop':'mobile']);
  assert.deepEqual(validateCompositionSettings(JSON.parse(JSON.stringify(kept))),kept);
  assert.deepEqual(original,saved,'merely opening or inspecting an existing scene never moves it');
});

test('layer operations keep the other layers, formats, game UI and manual points intact; limits reject atomically',()=>{
  const before=settings();before.mobile.gameUi={actions:{x:.5,y:.7},chat:{x:1,y:0,width:.8,height:.45}};
  const moved=placement.translateCompositionLayer(before,'mobile','dealer',.1,.2);
  assert.deepEqual(moved.mobile.table,before.mobile.table);assert.deepEqual(moved.mobile.background,before.mobile.background);
  assert.deepEqual(moved.mobile.gameUi,before.mobile.gameUi);assert.deepEqual(moved.blackjackTables,before.blackjackTables);
  const restored=placement.restoreCompositionLayer(moved,before,'mobile','dealer');assert.deepEqual(restored,before);
  const changed=settings();changed.mobile.dealer.x=2;const copy=structuredClone(changed);
  assert.throws(()=>placement.translateCompositionLayer(changed,'mobile','dealer',.1,0));assert.deepEqual(changed,copy);
  const linked=placement.translateCompositionLayer(before,'desktop','table',.1,.05,true);
  for(const role of ['table','dealer','background']){close(linked.desktop[role].x-before.desktop[role].x,.1);close(linked.desktop[role].y-before.desktop[role].y,.05);}
  assert.deepEqual(linked.blackjackTables,before.blackjackTables);
});

function fixture({layout='mobile',disabled=false,width=360,height=640}={}){
  const slots=[],effects=new Map();let cursor=0;
  const hooks={...React,useState(initial){const i=cursor++;if(!(i in slots))slots[i]={value:initial};return[slots[i].value,v=>{slots[i].value=typeof v==='function'?v(slots[i].value):v;}];},useRef(v){return slots[cursor++]??={current:v};},useEffect(fn,deps){const i=cursor++;if(!slots[i]||deps.some((v,n)=>v!==slots[i].deps[n]))effects.set(i,{fn,deps});}};
  const overrides={react:hooks,'../lib/composition-placement.mjs':placement,'./composition-zoom-controls':{CompositionZoomControls:()=>null}};
  const module={exports:{}},source=readFileSync(new URL('./composition-placement-editor.tsx',import.meta.url),'utf8');
  const code=transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
  runInThisContext(`(function(module,exports,require){${code}\n})`)(module,module.exports,name=>name.endsWith('.css')?{}:overrides[name]??require(name));
  const edits=[],value=settings(),preview=()=>null;
  const props={settings:value,savedSettings:structuredClone(value),layout,disabled,available:{dealer:true,table:true,background:true},tableAsset:table,backgroundAsset:{width:1920,height:1080},
    children:React.createElement(preview,{overlay:'cards'}),cardEditing:false,onCardEditingChange:active=>{props.cardEditing=active;},onChange:next=>{props.settings=validateCompositionSettings(next);edits.push(structuredClone(next));}};
  const render=()=>{cursor=0;const tree=module.exports.CompositionPlacementEditor(props);for(const [i,effect]of effects){slots[i]={deps:effect.deps};effect.fn();}effects.clear();return tree;};
  const button=label=>{const result=nodes(render(),n=>n.type==='button'&&text(n)===label)[0];assert.ok(result,label);return result;};
  const field=label=>{const result=nodes(render(),n=>n.props?.['aria-label']===label)[0];assert.ok(result,label);return result;};
  const previewNode=()=>nodes(render(),n=>n.type===preview)[0];
  const handle=()=>nodes(previewNode().props.overlay,n=>n.props?.role==='group')[0];
  let captured=null;
  const target={parentElement:{getBoundingClientRect:()=>({width,height})},focus(){},setPointerCapture(id){captured=id;},hasPointerCapture(id){return captured===id;},releasePointerCapture(){captured=null;}};
  const pointer=(x,y,extra={})=>({pointerId:1,clientX:x,clientY:y,isPrimary:true,button:0,preventDefault(){},currentTarget:target,...extra});
  return {props,edits,render,button,field,handle,previewNode,pointer,select(role){field(`Välj ${{background:'bakgrund',dealer:'dealer',table:'bord'}[role]}`).props.onClick();}};
}

for(const [layout,width,height]of [['mobile',180,320],['mobile',360,640],['desktop',960,540]])test(`${layout} ${width}x${height}: captured touch drag uses preview coordinates and preserves the grab offset`,()=>{
  const h=fixture({layout,width,height});h.select('table');const before=structuredClone(h.props.settings);
  h.handle().props.onPointerDown(h.pointer(20,40));
  h.handle().props.onPointerMove(h.pointer(20+width*.12,40+height*.08));
  close(h.props.settings[layout].table.x,before[layout].table.x+.12);close(h.props.settings[layout].table.y,before[layout].table.y+.08);
  h.handle().props.onPointerUp(h.pointer(20+width*.2,40+height*.15));
  close(h.props.settings[layout].table.x,before[layout].table.x+.2);close(h.props.settings[layout].table.y,before[layout].table.y+.15);
  assert.deepEqual(h.props.settings.blackjackTables,before.blackjackTables);
  const count=h.edits.length;h.handle().props.onPointerMove(h.pointer(0,0));assert.equal(h.edits.length,count);
});

test('keyboard, slider and reset act on the selected layer only; card mode does not expose a scene drag target',()=>{
  const h=fixture();h.select('table');const saved=structuredClone(h.props.settings);
  h.handle().props.onKeyDown({key:'ArrowDown',shiftKey:false,preventDefault(){}});close(h.props.settings.mobile.table.y,.041);
  h.handle().props.onKeyDown({key:'ArrowRight',shiftKey:true,preventDefault(){}});close(h.props.settings.mobile.table.x,.01);
  h.field('Bord storlek').props.onChange({target:{value:'165'}});close(h.props.settings.mobile.table.width,1.65);
  h.button('Återställ lagret').props.onClick();assert.deepEqual(h.props.settings,saved);
  h.button('Kort och marker').props.onClick();assert.equal(h.previewNode().props.overlay,'cards');assert.equal(h.handle(),undefined);
  h.button('Scenens lager').props.onClick();assert.ok(h.handle());
});

test('pointer cancel and Escape restore the gesture start; secondary touches, lost capture and locks cannot move a layer',()=>{
  const h=fixture();const saved=structuredClone(h.props.settings);
  h.handle().props.onPointerDown(h.pointer(20,40,{isPrimary:false}));h.handle().props.onPointerMove(h.pointer(200,200));assert.equal(h.edits.length,0);
  h.handle().props.onPointerDown(h.pointer(20,40));h.handle().props.onPointerMove(h.pointer(70,80));
  h.handle().props.onPointerCancel(h.pointer(70,80));assert.deepEqual(h.props.settings,saved);
  h.handle().props.onPointerDown(h.pointer(20,40));h.handle().props.onPointerMove(h.pointer(70,80));
  const escapeTarget=h.pointer(0,0).currentTarget;
  h.handle().props.onKeyDown({key:'Escape',currentTarget:escapeTarget,preventDefault(){}});assert.deepEqual(h.props.settings,saved);assert.equal(escapeTarget.hasPointerCapture(1),false);
  h.handle().props.onPointerDown(h.pointer(20,40));h.handle().props.onLostPointerCapture();h.handle().props.onPointerMove(h.pointer(70,80));assert.deepEqual(h.props.settings,saved);
  h.handle().props.onPointerDown(h.pointer(20,40));h.props.disabled=true;
  h.handle().props.onPointerMove(h.pointer(70,80));h.handle().props.onKeyDown({key:'ArrowDown',preventDefault(){}});
  h.field('Dealer storlek').props.onChange({target:{value:'150'}});h.button('Centrera vågrätt').props.onClick();assert.deepEqual(h.props.settings,saved);
});

test('bottom anchoring is opt-in and rejected edits do not drop the current draft',()=>{
  const h=fixture();h.select('table');h.button('Lägg mot nederkanten').props.onClick();
  const checkbox=nodes(h.render(),n=>n.type==='label'&&text(n).includes('Behåll bordets nederkant'))[0];
  nodes(checkbox,n=>n.type==='input')[0].props.onChange({target:{checked:true}});
  h.field('Bord storlek').props.onChange({target:{value:'170'}});
  const rect=placement.compositionLayerRect(h.props.settings,'mobile','table',table);close(rect.y+rect.height,1);
  const before=structuredClone(h.props.settings);h.field('Bord storlek').props.onChange({target:{value:'500'}});assert.deepEqual(h.props.settings,before);
  assert.equal(nodes(h.render(),n=>n.props?.role==='alert').length,1);
  h.props.available={dealer:false,table:false,background:false};assert.equal(h.handle(),undefined);
});

test('whole-scene zoom controls use the currently selected format and retain the disabled guard',()=>{
  const module={exports:{}},source=readFileSync(new URL('./composition-zoom-controls.tsx',import.meta.url),'utf8');
  const code=transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
  runInThisContext(`(function(module,exports,require){${code}\n})`)(module,module.exports,name=>name==='../lib/composition-zoom.mjs'?{zoomComposition}:require(name));
  const before=settings(),edits=[],props={settings:before,layout:'mobile',disabled:false,onChange:value=>edits.push(value)};
  const buttons=()=>nodes(module.exports.CompositionZoomControls(props),n=>n.type==='button');
  buttons()[1].props.onClick();close(edits[0].mobile.dealer.scale,1.1);assert.deepEqual(edits[0].desktop,before.desktop);
  props.disabled=true;buttons()[1].props.onClick();assert.equal(edits.length,1);
});

test('missing or invalid table dimensions disable its placement without crashing the preview or changing the draft',()=>{
  for(const dimensions of [undefined,{width:0,height:941},{width:1672,height:NaN},{width:Infinity,height:941}]){
    const h=fixture(),before=structuredClone(h.props.settings);h.props.tableAsset=dimensions;
    assert.equal(h.field('Välj bord').props.disabled,true);
    assert.equal(nodes(h.render(),node=>node.props?.role==='status').length,1);
    h.props.available={dealer:false,table:true,background:false};assert.equal(h.handle(),undefined);
    assert.deepEqual(h.props.settings,before);assert.equal(h.edits.length,0);
    assert.throws(()=>placement.compositionLayerRect(before,'mobile','table',dimensions));
  }
});
