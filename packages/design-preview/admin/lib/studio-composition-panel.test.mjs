import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createSeedProject,defaultPresentationLane,validateProject} from '../../../../lab/lib/studio-model.mjs';
import * as settings from '../../../../web/public/composition-settings.mjs';
const require=createRequire(import.meta.url),React=require('react'),{transformSync}=require('esbuild');
const nodes=(node,predicate)=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(child=>nodes(child,predicate)):[...(predicate(node)?[node]:[]),...nodes(node.props?.children,predicate)];
const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
function panelHarness(){
  const source=readFileSync(new URL('../components/studio/studio-composition-panel.tsx',import.meta.url),'utf8'),output=transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'});
  const slots=[],module={exports:{}};let cursor=0;
  const hooks={...React,useState(initial){const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],next=>slots[index]=typeof next==='function'?next(slots[index]):next];},useRef(initial){const index=cursor++;return slots[index]??={current:initial};}};
  const LayerAssetSelect=()=>null;
  runInNewContext(output.code,{module,exports:module.exports,structuredClone,require:name=>{
    if(name==='react')return hooks;
    if(name.includes('studio-model.mjs'))return {validateProject};
    if(name.includes('composition-settings.mjs'))return settings;
    if(name.includes('dealer-compositing.mjs'))return {effectiveDealerCompositing:()=>({})};
    if(name.endsWith('/layer-selectors'))return {LayerAssetSelect};
    if(name.includes('/components/'))return Object.fromEntries(['LayerLibrary','LayerAssetManager','CompositionPreview','BackgroundPlaybackEditor'].map(key=>[key,()=>null]));
    return require(name);
  }});
  const project=createSeedProject(),lane=defaultPresentationLane('astrid');project.lanes=[lane];
  const edits=[],props={project,inventory:{videos:[]},room:{id:'room-a',name:'Main',compositionId:lane.id,game:'blackjack'},dealerId:'astrid',
    uses:[{roomId:'room-a',roomName:'Main',operatorName:'North'},{roomId:'room-b',roomName:'VIP',operatorName:'South'}],roomChoicesPath:'/partner/north/rooms?room=room-a',
    blocked:false,projectDirty:false,onEdit:next=>{edits.push(next);props.project=next;},onRegistered(){},onSaved(){},onBusyChange(){}};
  return {props,edits,LayerAssetSelect,render:()=>{cursor=0;return module.exports.StudioCompositionPanel(props);}};
}
test('shared template preview lists uses and requires its explicit edit action before changing any field',()=>{
  const h=panelHarness();let tree=h.render();
  assert.ok(text(tree).includes('North'));assert.ok(text(tree).includes('South'));
  const roomLink=nodes(tree,node=>node.type==='a')[0];assert.equal(roomLink.props.href,h.props.roomChoicesPath);assert.equal(roomLink.props.target,'_blank');
  assert.ok(nodes(tree,node=>node.type==='fieldset').every(node=>node.props.disabled));
  const next=structuredClone(h.props.project.lanes[0]);next.openclaw.idle='rules';
  nodes(tree,node=>node.type===h.LayerAssetSelect)[0].props.onChange(next);assert.equal(h.edits.length,0);
  nodes(tree,node=>node.type==='button'&&text(node)==='Redigera gemensam mall')[0].props.onClick();tree=h.render();
  nodes(tree,node=>node.type===h.LayerAssetSelect)[0].props.onChange(next);
  assert.equal(h.edits.length,1);assert.equal(h.edits[0].lanes[0].openclaw.idle,'rules');
  h.props.blocked=true;tree=h.render();nodes(tree,node=>node.type===h.LayerAssetSelect)[0].props.onChange(next);assert.equal(h.edits.length,1);
});
test('changing composition returns the next shared template to preview mode while retaining the project draft',()=>{
  const h=panelHarness();let tree=h.render();nodes(tree,node=>node.type==='button')[0].props.onClick();
  const other={...structuredClone(h.props.project.lanes[0]),id:'other-composition'};
  h.props.project.lanes.push(other);h.props.room={...h.props.room,compositionId:other.id};tree=h.render();
  assert.ok(nodes(tree,node=>node.type==='fieldset').every(node=>node.props.disabled));
  assert.ok(text(tree).includes('Redigera gemensam mall'));assert.equal(h.props.project.lanes.length,2);
});
