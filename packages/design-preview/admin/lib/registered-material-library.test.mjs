import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {setImmediate} from 'node:timers/promises';
import {createSeedProject,validateProject} from '../../../../lab/lib/studio-model.mjs';
import {materialLabel} from '../../../../web/public/material-catalog.mjs';
import {layerAssetFitsGame,layerAssetPath} from '../../../../web/layer-asset-contract.mjs';
const require=createRequire(import.meta.url),React=require('react');
const nodes=(node,predicate)=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(child=>nodes(child,predicate)):[...(predicate(node)?[node]:[]),...nodes(node.props?.children,predicate)];
const text=node=>typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
async function harness(search='?game=roulette') {
  const project=createSeedProject();
  project.layerAssets=[['roulette','Roulette board','table'],['blackjack','Blackjack board','table'],[undefined,'Legacy board','table'],[undefined,'Shared background','background']].map(([game,label,role],index)=>{
    const asset={schemaVersion:1,id:`10000000-0000-4000-8000-00000000000${index}`,role,label,sha256:'a'.repeat(64),size:128,contentType:'image/png',width:1920,height:1080,...(game?{game}:{})};
    return {...asset,pathname:layerAssetPath(asset)};
  });
  const states=[],effects=[],queue=[];let cursor=0,changed=0;
  const hooks={...React,useState(initial){const index=cursor++;if(!(index in states))states[index]=typeof initial==='function'?initial():initial;return [states[index],value=>states[index]=typeof value==='function'?value(states[index]):value];},
    useRef(value){const index=cursor++;return states[index]??={current:value};},
    useEffect(callback,deps){const index=cursor++;if(!effects[index]||deps.some((value,i)=>value!==effects[index].deps[i])){queue.push(()=>{effects[index]?.cleanup?.();effects[index]={deps,cleanup:callback()};});}}};
  const LayerLibrary=()=>null,LayerAssetManager=()=>null,module={exports:{}};
  const source=readFileSync(new URL('../components/studio/registered-material-library.tsx',import.meta.url),'utf8');
  runInNewContext(require('esbuild').transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,URLSearchParams,AbortController,location:{search},window:{addEventListener(){},removeEventListener(){}},require:name=>{
    if(name==='react')return hooks;
    if(name.includes('studio-model.mjs'))return {validateProject};
    if(name.includes('material-catalog.mjs'))return {materialLabel};
    if(name.includes('layer-asset-contract.mjs'))return {layerAssetFitsGame};
    if(name.endsWith('/layer-library'))return {LayerLibrary};
    if(name.endsWith('/layer-asset-manager'))return {LayerAssetManager};
    if(name.includes('connected-studio.mjs'))return {createStudioClient:()=>({load:async()=>({project})})};
    return require(name);
  }});
  const props={disabled:false,refreshKey:'1',onChanged:()=>changed++};
  const render=()=>{cursor=0;const tree=module.exports.RegisteredMaterialLibrary(props);while(queue.length)queue.shift()();return tree;};
  render();await setImmediate();
  return {project,props,render,LayerLibrary,LayerAssetManager,changed:()=>changed,close:()=>effects.forEach(effect=>effect?.cleanup?.())};
}

test('real assets page scopes table upload and visible library to explicit game, with shared backgrounds',async()=>{
  const h=await harness();try {
    let tree=h.render(),uploader=nodes(tree,node=>node.type===h.LayerLibrary)[0];
    assert.equal(uploader.props.game,'roulette');assert.equal(uploader.props.disabled,false);
    assert.deepEqual(nodes(tree,node=>node.type==='li').map(text),['Roulette board1920 × 1080']);
    assert.equal(nodes(tree,node=>node.type===h.LayerAssetManager)[0].props.project,h.project,'lifecycle manager retains complete dependency graph');
    nodes(tree,node=>node.type==='select')[0].props.onChange({target:{value:'blackjack'}});tree=h.render();
    assert.equal(nodes(tree,node=>node.type===h.LayerLibrary)[0].props.game,'blackjack');
    assert.deepEqual(nodes(tree,node=>node.type==='li').map(text),['Blackjack board1920 × 1080','Legacy board1920 × 1080']);
    nodes(tree,node=>node.props.role==='tab'&&text(node)==='Bakgrunder')[0].props.onClick();tree=h.render();
    assert.equal(nodes(tree,node=>node.type==='select').length,0);
    assert.equal(nodes(tree,node=>node.type===h.LayerLibrary)[0].props.role,'background');
    assert.deepEqual(nodes(tree,node=>node.type==='li').map(text),['Shared background1920 × 1080']);
  } finally{h.close();}
});

test('upload readback cannot accept a table registered for another game; unspecified game preserves blackjack',async()=>{
  const h=await harness();try {
    nodes(h.render(),node=>node.type===h.LayerLibrary)[0].props.onRegistered(h.project,h.project.layerAssets[1].id);
    assert.match(text(h.render()),/Registreringen kunde inte bekräftas för valt spel/);assert.equal(h.changed(),0);
  } finally{h.close();}
  const legacy=await harness('');try {
    const uploader=nodes(legacy.render(),node=>node.type===legacy.LayerLibrary)[0];assert.equal(uploader.props.game,'blackjack');
    uploader.props.onRegistered(legacy.project,legacy.project.layerAssets[1].id);assert.equal(legacy.changed(),1);
  } finally{legacy.close();}
});
