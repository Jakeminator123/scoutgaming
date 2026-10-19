import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import * as contract from '../../../packages/presentation/contracts/composition-settings.mjs';
import * as anchors from '../../../packages/presentation/runtime/composition-anchors.mjs';
import * as overlay from '../../../packages/presentation/runtime/game-overlay-layout.mjs';
const require=createRequire(new URL('../client/package.json',import.meta.url)),React=require('react'),{transformSync}=require('esbuild');
const nodes=(node,p)=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(n=>nodes(n,p)):[...(p(node)?[node]:[]),...nodes(node.props?.children,p)];
const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
function fixture(){
  const slots=[],module={exports:{}};let cursor=0;
  const hooks={...React,useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useRef(v){return slots[cursor++]??={current:v};},useEffect(){}};
  const source=readFileSync(new URL('./blackjack-scene-placement-editor.tsx',import.meta.url),'utf8');
  runInNewContext(transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,structuredClone,require:name=>{
    if(name==='react')return hooks;if(name.endsWith('.css'))return {};
    if(name.includes('composition-settings'))return contract;if(name.includes('composition-anchors'))return anchors;
    if(name.includes('game-overlay-layout'))return overlay;return require(name);
  }});
  const value=contract.defaultBlackjackTableGeometry('00000000-0000-4000-8000-000000000002'),settings=contract.defaultCompositionSettings();settings.blackjackTables=[value];
  const edits=[],props={tableId:value.tableId,value,savedValue:structuredClone(value),layout:'desktop',disabled:false,scene:{settings,width:1672,height:941},renderPreview:overlay=>React.createElement('div',{},overlay),onChange:next=>{next=structuredClone(next);const settings={...props.scene.settings,blackjackTables:next?[next]:[]};contract.validateCompositionSettings(settings);edits.push(next);props.value=next;props.scene.settings=settings;}};
  return {props,edits,render:()=>{cursor=0;return module.exports.BlackjackScenePlacementEditor(props);},field:(tree,label)=>nodes(tree,n=>n.props?.['aria-label']===label)[0],button:(tree,label)=>nodes(tree,n=>n.type==='button'&&text(n)===label)[0]};
}
test('real editor rebinds without a jump, retains manual markers through follow-cards and resets only saved cards',()=>{
  const h=fixture(),before=structuredClone(h.props.value),frames=anchors.compositionAnchorFrames(h.props.scene.settings,'desktop',h.props.scene);let tree=h.render();
  h.field(tree,'Korten följer').props.onChange({target:{value:'dealer'}});tree=h.render();
  const r=anchors.resolveAnchorRect(h.props.value.desktop.anchors.cards,frames);for(const k of Object.keys(r))assert.ok(Math.abs(r[k]-frames.table[k])<1e-8);
  h.field(tree,'Markerna följer').props.onChange({target:{value:'scene'}});tree=h.render();
  h.field(tree,'Marker grupp x').props.onChange({target:{valueAsNumber:15}});tree=h.render();
  const manual=structuredClone(h.props.value.desktop.anchors.bets);
  nodes(tree,n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:true}});tree=h.render();
  assert.equal(h.field(tree,'Markerna följer').props.disabled,true);
  nodes(tree,n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:false}});tree=h.render();
  assert.deepEqual(h.props.value.desktop.anchors.bets,manual);
  h.button(tree,'Återställ sparade kort').props.onClick();assert.deepEqual(h.props.value.desktop.dealer,before.desktop.dealer);
  assert.equal(h.props.value.desktop.anchors.cards,undefined);assert.deepEqual(h.props.value.desktop.anchors.bets,manual);assert.deepEqual(h.props.value.mobile,before.mobile);
});
test('drag callback and numeric editing change only the selected point; locked editor cannot stage changes',()=>{
  const h=fixture();let tree=h.render();const frames=anchors.compositionAnchorFrames(h.props.scene.settings,'desktop',h.props.scene);
  const scene=nodes(tree,n=>typeof n.type==='function'&&n.type.name==='SceneOverlay')[0];
  scene.props.onPlace('card:2',{x:frames.table.x+frames.table.width*.7,y:frames.table.y+frames.table.height*.6});
  assert.deepEqual(h.props.value.desktop.seats[2].card,{x:.7,y:.6});assert.equal(h.props.value.desktop.seats[1].card.y,h.props.savedValue.desktop.seats[1].card.y);
  h.props.disabled=true;tree=h.render();const before=structuredClone(h.props.value);
  h.field(tree,'Korten följer').props.onChange({target:{value:'scene'}});h.button(tree,'Ta bort bordets placering').props.onClick();assert.deepEqual(h.props.value,before);
});
