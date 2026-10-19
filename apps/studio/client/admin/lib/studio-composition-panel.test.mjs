import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createSeedProject,defaultPresentationLane,validateProject} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import * as anchors from '../../../../../packages/presentation/runtime/composition-anchors.mjs';
import * as settings from '../../../../../packages/presentation/contracts/composition-settings.mjs';
import {layerAssetFitsGame,layerAssetPath} from '../../../../../packages/presentation/contracts/layer-asset-contract.mjs';
import {rouletteReferencePreview} from './roulette-clip-map.mjs';
import {setTemplateDealers} from './dealer-directory.mjs';
const require=createRequire(import.meta.url),React=require('react'),{transformSync}=require('esbuild');
const nodes=(node,predicate)=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(child=>nodes(child,predicate)):[...(predicate(node)?[node]:[]),...nodes(node.props?.children,predicate)];
const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
function panelHarness(){
  const source=readFileSync(new URL('../components/studio/studio-composition-panel.tsx',import.meta.url),'utf8'),output=transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'});
  const slots=[],module={exports:{}};let cursor=0;
  const hooks={...React,useState(initial){const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],next=>slots[index]=typeof next==='function'?next(slots[index]):next];},useRef(initial){const index=cursor++;return slots[index]??={current:initial};}};
  const LayerAssetSelect=()=>null;
  const components=Object.fromEntries(['LayerLibrary','LayerAssetManager','CompositionPreview','CompositionZoomControls','BackgroundPlaybackEditor','BlackjackScenePlacementEditor'].map(key=>[key,()=>null]));
  runInNewContext(output.code,{module,exports:module.exports,structuredClone,require:name=>{
    if(name==='react')return hooks;
    if(name.includes('studio-model.mjs'))return {validateProject};
    if(name.includes('composition-settings.mjs'))return settings;
    if(name.includes('composition-anchors.mjs'))return anchors;
    if(name.includes('dealer-compositing.mjs'))return {effectiveDealerCompositing:()=>({})};
    if(name.includes('layer-asset-contract.mjs'))return {layerAssetFitsGame};
    if(name.includes('roulette-clip-map.mjs'))return {rouletteReferencePreview};
    if(name.includes('dealer-directory.mjs'))return {setTemplateDealers};
    if(name.endsWith('/layer-selectors'))return {LayerAssetSelect};
    if(name.includes('/components/'))return components;
    return require(name);
  }});
  const project=createSeedProject(),lane=defaultPresentationLane('astrid');project.lanes=[lane];
  const edits=[],props={project,savedProject:structuredClone(project),inventory:{videos:[]},room:{id:'room-a',name:'Main',compositionId:lane.id,game:'blackjack'},dealerId:'astrid',
    uses:[{roomId:'room-a',roomName:'Main',operatorName:'North'},{roomId:'room-b',roomName:'VIP',operatorName:'South'}],roomChoicesPath:'/admin/rooms?view=registered&operator=north&table=room-a',
    blocked:false,projectDirty:false,onEdit:next=>{edits.push(next);props.project=next;},onRegistered(){},onSaved(){},onBusyChange(){}};
  return {props,edits,LayerAssetSelect,...components,render:()=>{cursor=0;return module.exports.StudioCompositionPanel(props);}};
}
test('local roulette VILA replaces the editor idle without leaking into blackjack or saved state',()=>{
  const h=panelHarness(),before=structuredClone(h.props.project);
  h.props.room.game='roulette';h.props.localReferenceUrl='blob:local-vila';
  let preview=nodes(h.render(),node=>node.type===h.CompositionPreview)[0];
  assert.equal(preview.props.dealer.url,'blob:local-vila');assert.equal(preview.props.dealer.contentType,'image/png');
  assert.equal(preview.props.compositing.mode,'alpha');assert.deepEqual(h.props.project,before);assert.equal(h.edits.length,0);
  h.props.room.game='blackjack';preview=nodes(h.render(),node=>node.type===h.CompositionPreview)[0];
  assert.equal(preview.props.dealer,null);
});

test('shared template preview lists uses and requires its explicit edit action before changing any field',()=>{
  const h=panelHarness();let tree=h.render();
  assert.ok(text(tree).includes('North'));assert.ok(text(tree).includes('South'));
  const roomLink=nodes(tree,node=>node.type==='a')[0];assert.equal(roomLink.props.href,h.props.roomChoicesPath);assert.equal(roomLink.props.target,undefined);
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

test('explicit shared template edits never follow or reassign a different room template',()=>{
  const h=panelHarness(),originalRoom=structuredClone(h.props.room),original=structuredClone(h.props.project.lanes[0]);
  const other={...structuredClone(original),id:'other-composition',label:'Other shared scene'};
  h.props.project.lanes.push(other);h.props.compositionId=other.id;h.props.game='blackjack';
  let tree=h.render();assert.equal(nodes(tree,node=>node.type==='h2')[0].props.children,other.label);
  assert.equal(nodes(tree,node=>node.type==='a')[0].props.href,h.props.roomChoicesPath);
  nodes(tree,node=>node.type==='button'&&text(node)==='Redigera gemensam mall')[0].props.onClick();
  tree=h.render();const updated={...structuredClone(other),openclaw:{...other.openclaw,idle:'rules'}};
  nodes(tree,node=>node.type===h.LayerAssetSelect)[0].props.onChange(updated);
  assert.deepEqual(h.props.project.lanes[0],original);assert.equal(h.props.project.lanes[1].openclaw.idle,'rules');
  assert.deepEqual(h.props.room,originalRoom);
  h.props.compositionId='missing';tree=h.render();
  assert.ok(text(tree).includes('Den valda sammansättningen finns inte.'));
  assert.equal(nodes(tree,node=>node.type===h.LayerAssetSelect).length,0);
});

test('a selected library composition is editable without inventing a room context',()=>{
  const h=panelHarness();h.props.compositionId=h.props.project.lanes[0].id;h.props.game='blackjack';
  h.props.room=undefined;h.props.roomChoicesPath=null;
  let tree=h.render();assert.ok(nodes(tree,node=>node.type==='fieldset').every(node=>node.props.disabled));
  nodes(tree,node=>node.type==='button'&&text(node)==='Redigera gemensam mall')[0].props.onClick();
  tree=h.render();const lane=structuredClone(h.props.project.lanes[0]);lane.openclaw.idle='rules';
  nodes(tree,node=>node.type===h.LayerAssetSelect)[0].props.onChange(lane);
  assert.equal(h.edits.length,1);assert.equal(h.props.room,undefined);
});

test('roulette preview never borrows blackjack idle or a blackjack table and keeps video upload game-scoped',()=>{
  const h=panelHarness();h.props.room.game='roulette';
  h.props.project.lines=[{dealerId:'astrid',eventId:'idle.ready',baselineVariantId:'base',variants:[{id:'base',videoGenerationId:'blackjack-idle'}]}];
  h.props.inventory.videos=[{id:'blackjack-idle',label:'BJ',available:true,contentType:'video/mp4',previewUrl:'/blackjack',classification:{dealerId:'astrid',eventId:'idle.ready'}}];
  const table={schemaVersion:1,id:'00000000-0000-4000-8000-000000000001',role:'table',label:'Roulette label alone',sha256:'a'.repeat(64),size:128,contentType:'video/webm',width:1920,height:1080};
  h.props.project.layerAssets=[{...table,pathname:layerAssetPath(table)}];h.props.project.lanes[0].layers.table.default=table.id;
  let tree=h.render(),preview=nodes(tree,node=>node.type===h.CompositionPreview)[0];
  assert.equal(preview.props.dealer,null);assert.equal(preview.props.table,null);
  assert.ok(nodes(tree,node=>node.type===h.LayerAssetSelect).every(node=>node.props.game==='roulette'));
  nodes(tree,node=>node.type==='button'&&text(node)==='Redigera gemensam mall')[0].props.onClick();tree=h.render();
  const uploader=nodes(tree,node=>node.type===h.LayerLibrary&&node.props.role==='table')[0];
  assert.equal(uploader.props.disabled,false);assert.equal(uploader.props.game,'roulette');
  h.props.project.layerAssets[0].game='roulette';
  const classification={dealerId:'astrid',eventId:'roulette.idle',situation:'breathing',game:'roulette',action:'breathing',startPose:'VILA',endPose:'VILA',kind:'idle',role:'standard',playback:'once',label:'Andning',notes:'',compositing:{mode:'alpha'}};
  h.props.inventory.videos.push({id:'roulette-idle',label:'Andning',available:true,integrity:'verified',contentType:'video/webm',previewUrl:'/roulette-idle',classification});
  tree=h.render();preview=nodes(tree,node=>node.type===h.CompositionPreview)[0];
  assert.equal(preview.props.dealer.url,'/roulette-idle');assert.equal(preview.props.dealer.contentType,'video/webm');assert.equal(preview.props.table.contentType,'video/webm');
  h.props.inventory.videos.push({id:'roulette-rest',label:'VILA',available:true,contentType:'image/png',previewUrl:'/roulette-rest',classification:{...classification,eventId:'roulette.reference',situation:'VILA',action:'reference',mediaType:'image'}});
  preview=nodes(h.render(),node=>node.type===h.CompositionPreview)[0];assert.equal(preview.props.dealer.contentType,'image/png');assert.equal(preview.props.dealer.url,'/roulette-rest');
});

test('the real layer selector offers only matching tables and removes incompatible choices only on explicit action',()=>{
  const source=readFileSync(new URL('../../../components/layer-selectors.tsx',import.meta.url),'utf8');
  const output=transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}),module={exports:{}};
  runInNewContext(output.code,{module,exports:module.exports,structuredClone,require:name=>name.includes('layer-asset-contract')?{layerAssetFitsGame}:name.includes('composition-settings.mjs')?settings:require(name)});
  const assets=[{id:'legacy',role:'table',label:'Roulette filename',contentType:'image/png'},{id:'roulette',role:'table',game:'roulette',label:'Roulette',contentType:'video/webm'},{id:'blackjack',role:'table',game:'blackjack',label:'Blackjack',contentType:'video/mp4'}];
  const lane=defaultPresentationLane('astrid');lane.layers.table={...lane.layers.table,default:'legacy',allowed:['legacy','roulette','blackjack']};
  const before=structuredClone(lane),edits=[];
  const tree=module.exports.LayerAssetSelect({role:'table',lane,assets,game:'roulette',onChange:value=>edits.push(value)});
  assert.deepEqual(nodes(tree,node=>node.type==='option').map(node=>node.props.value),['','roulette']);
  assert.deepEqual(lane,before);assert.equal(edits.length,0);
  nodes(tree,node=>node.type==='button')[0].props.onClick();
  assert.deepEqual(edits[0].layers.table.allowed,['roulette']);assert.equal(edits[0].layers.table.default,null);assert.deepEqual(lane,before);
});

test('Admin table profile edits only the selected table and format behind template edit ownership',()=>{
  const h=panelHarness(),table={schemaVersion:1,id:'00000000-0000-4000-8000-000000000002',role:'table',game:'blackjack',label:'Oak',sha256:'a'.repeat(64),size:1024,contentType:'image/png',width:1672,height:941};
  h.props.project.layerAssets=[{...table,pathname:layerAssetPath(table)}];
  const lane=h.props.project.lanes[0];lane.layers.table={enabled:true,default:table.id,allowed:[table.id]};lane.composition=settings.defaultCompositionSettings();
  let tree=h.render(),editor=nodes(tree,node=>node.type===h.BlackjackScenePlacementEditor)[0];
  assert.equal(editor.props.disabled,true);assert.equal(editor.props.tableId,table.id);
  const profile=settings.defaultBlackjackTableGeometry(table.id);profile.mobile.betMode='under-cards';
  editor.props.onChange(profile);assert.equal(h.edits.length,0);
  nodes(tree,node=>node.type==='button'&&text(node)==='Redigera gemensam mall')[0].props.onClick();tree=h.render();
  editor=nodes(tree,node=>node.type===h.BlackjackScenePlacementEditor)[0];assert.equal(editor.props.disabled,false);
  editor.props.onChange(profile);assert.equal(h.edits.length,1,text(h.render()));
  assert.equal(h.edits[0].lanes[0].composition.blackjackTables[0].mobile.betMode,'under-cards');
  assert.equal(h.edits[0].lanes[0].composition.blackjackTables[0].desktop.betMode,undefined);
  const beforeDesktop=structuredClone(h.props.project.lanes[0].composition.desktop);
  tree=h.render();const width=nodes(tree,node=>node.type==='label'&&text(node).startsWith('Bordsbredd'))[0];
  nodes(width,node=>node.type==='input')[0].props.onChange({target:{valueAsNumber:165}});
  assert.equal(h.edits.at(-1).lanes[0].composition.mobile.table.width,1.65);
  assert.deepEqual(h.edits.at(-1).lanes[0].composition.desktop,beforeDesktop);
  h.props.room.game='roulette';assert.equal(nodes(h.render(),node=>node.type===h.BlackjackScenePlacementEditor).length,0);
});


test('roulette uses the player desktop format and zoom requires explicit shared-template editing',()=>{
  const h=panelHarness();h.props.room.game='roulette';const original=structuredClone(h.props.project);
  let tree=h.render();let zoom=nodes(tree,node=>node.type===h.CompositionZoomControls)[0];
  assert.equal(zoom.props.disabled,true);
  assert.equal(nodes(tree,node=>node.type===h.CompositionPreview)[0].props.layout,'desktop');
  assert.equal(nodes(tree,node=>node.props?.role==='tab'&&text(node)==='Mobil').length,0);
  nodes(tree,node=>node.type==='button'&&text(node)==='Redigera gemensam mall')[0].props.onClick();
  tree=h.render();zoom=nodes(tree,node=>node.type===h.CompositionZoomControls)[0];assert.equal(zoom.props.disabled,false);
  const next=settings.defaultCompositionSettings();next.desktop.dealer.scale=1.1;
  zoom.props.onChange(next);
  assert.equal(h.props.project.lanes[0].composition.desktop.dealer.scale,1.1);
  assert.deepEqual(h.props.project.layerAssets,original.layerAssets);
  assert.equal(h.edits.length,1);assert.equal(h.props.room.id,'room-a');
  h.props.blocked=true;tree=h.render();assert.equal(nodes(tree,node=>node.type===h.CompositionZoomControls)[0].props.disabled,true);
});
