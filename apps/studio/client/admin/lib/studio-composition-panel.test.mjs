import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext,runInThisContext} from 'node:vm';
import {createSeedProject,defaultPresentationLane,validateProject} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import * as anchors from '../../../../../packages/presentation/runtime/composition-anchors.mjs';
import * as settings from '../../../../../packages/presentation/contracts/composition-settings.mjs';
import {layerAssetFitsGame,layerAssetPath} from '../../../../../packages/presentation/contracts/layer-asset-contract.mjs';
import {defaultLayerRule,selectableLayerBases} from '../../../../../packages/presentation/contracts/background-playback-policy.mjs';
import {rouletteReferencePreview} from './roulette-clip-map.mjs';
import {setTemplateDealers} from './dealer-directory.mjs';
import {effectiveDealerCompositing} from '../../../../../packages/presentation/contracts/dealer-compositing.mjs';
import {aiTableFitsTemplate} from './ai-background.mjs';
import * as scenePreviewMedia from './scene-preview-media.mjs';
const require=createRequire(import.meta.url),React=require('react'),{transformSync}=require('esbuild');
const nodes=(node,predicate)=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(child=>nodes(child,predicate)):[...(predicate(node)?[node]:[]),...nodes(node.props?.children,predicate)];
const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
function panelHarness(){
  const source=readFileSync(new URL('../components/studio/studio-composition-panel.tsx',import.meta.url),'utf8'),output=transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'});
  const slots=[],module={exports:{}};let cursor=0;
  const hooks={...React,useState(initial){const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],next=>slots[index]=typeof next==='function'?next(slots[index]):next];},useRef(initial){const index=cursor++;return slots[index]??={current:initial};}};
  const LayerAssetSelect=()=>null;
  const components=Object.fromEntries(['EnvironmentPicture','ScenePublication','LayerLibrary','LayerAssetManager','CompositionPreview','CompositionZoomControls','BackgroundPlaybackEditor','LayerPlaybackEditor','BlackjackScenePlacementEditor'].map(key=>[key,()=>null]));
  const componentRequire=name=>{
    if(name==='./scene-publication')return {ScenePublication:components.ScenePublication};
    if(name==='./environment-picture')return {EnvironmentPicture:components.EnvironmentPicture};
    if(name==='react')return hooks;
    if(name.includes('studio-model.mjs'))return {validateProject};
    if(name.includes('composition-settings.mjs'))return settings;
    if(name.includes('composition-anchors.mjs'))return anchors;
    if(name.includes('dealer-compositing.mjs'))return {effectiveDealerCompositing};
    if(name.includes('layer-asset-contract.mjs'))return {layerAssetFitsGame};
    if(name.includes('background-playback-policy.mjs'))return {selectableLayerBases};
    if(name.includes('roulette-clip-map.mjs'))return {rouletteReferencePreview};
    if(name.includes('scene-preview-media.mjs'))return scenePreviewMedia;
    if(name.includes('dealer-directory.mjs'))return {setTemplateDealers};
    if(name.endsWith('/layer-selectors'))return {LayerAssetSelect};
    if(name.includes('/components/'))return components;
    return require(name);
  };
  // Browser components and validators share one realm. A separate VM realm
  // makes valid object literals fail the contract's plain-object check.
  runInThisContext(`(function(module,exports,require,structuredClone){${output.code}\n})`)(module,module.exports,componentRequire,structuredClone);
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

test('changing the preview dealer uses that dealers roulette media and framing instead of another dealers local VILA',()=>{
  const h=panelHarness(),lane=h.props.project.lanes[0];
  h.props.room.game='roulette';h.props.localReferenceUrl='blob:astrid-local-vila';
  h.props.project.dealers.push({...h.props.project.dealers[0],id:'dragan',label:'Dragan'});
  lane.layers.dealer.allowed.push('dragan');
  const framing={scale:1.35,x:.12,y:-.08},compositing={mode:'green-screen',threshold:.3,softness:.1,despill:.2};
  h.props.inventory.videos=[{id:'dragan-roulette-idle',label:'Dragan idle',available:true,integrity:'verified',contentType:'video/webm',previewUrl:'/dragan-roulette-idle.webm',
    classification:{dealerId:'dragan',eventId:'roulette.idle',situation:'breathing',game:'roulette',action:'breathing',startPose:'VILA',endPose:'VILA',kind:'idle',role:'standard',playback:'once',label:'Andning',notes:'',framing,compositing}}];
  const before=structuredClone(h.props.project),room=structuredClone(h.props.room);
  const preview=()=>nodes(h.render(),node=>node.type===h.CompositionPreview)[0].props;
  const choose=dealer=>nodes(h.render(),node=>node.props?.['aria-label']==='Dealer att förhandsvisa')[0].props.onChange({target:{value:dealer}});
  assert.equal(preview().dealer.url,'blob:astrid-local-vila');assert.equal(preview().framing,undefined);
  choose('dragan');
  assert.equal(preview().dealer.url,'/dragan-roulette-idle.webm');
  assert.deepEqual(preview().framing,framing);assert.deepEqual(preview().compositing,compositing);
  choose('astrid');
  assert.equal(preview().dealer.url,'blob:astrid-local-vila');assert.equal(preview().framing,undefined);assert.equal(preview().compositing.mode,'alpha');
  assert.deepEqual(h.props.project,before);assert.deepEqual(h.props.room,room);assert.equal(h.edits.length,0);
});

test('shared template preview lists uses and requires its explicit edit action before changing any field',()=>{
  const h=panelHarness();let tree=h.render();
  assert.ok(text(tree).includes('North'));assert.ok(text(tree).includes('South'));
  const roomLink=nodes(tree,node=>node.type==='a')[0];assert.equal(roomLink.props.href,h.props.roomChoicesPath);assert.equal(roomLink.props.target,undefined);
  assert.ok(nodes(tree,node=>node.type==='fieldset').every(node=>node.props.disabled));
  const next=structuredClone(h.props.project.lanes[0]);next.openclaw.idle='rules';
  nodes(tree,node=>node.type===h.LayerAssetSelect)[0].props.onChange(next);assert.equal(h.edits.length,0);
  nodes(tree,node=>node.type==='button'&&text(node)==='Redigera gemensam miljö')[0].props.onClick();tree=h.render();
  nodes(tree,node=>node.type===h.LayerAssetSelect)[0].props.onChange(next);
  assert.equal(h.edits.length,1);assert.equal(h.edits[0].lanes[0].openclaw.idle,'rules');
  h.props.blocked=true;tree=h.render();nodes(tree,node=>node.type===h.LayerAssetSelect)[0].props.onChange(next);assert.equal(h.edits.length,1);
});
test('changing composition returns the next shared template to preview mode while retaining the project draft',()=>{
  const h=panelHarness();let tree=h.render();nodes(tree,node=>node.type==='button')[0].props.onClick();
  const other={...structuredClone(h.props.project.lanes[0]),id:'other-composition'};
  h.props.project.lanes.push(other);h.props.room={...h.props.room,compositionId:other.id};tree=h.render();
  assert.ok(nodes(tree,node=>node.type==='fieldset').every(node=>node.props.disabled));
  assert.ok(text(tree).includes('Redigera gemensam miljö'));assert.equal(h.props.project.lanes.length,2);
});

test('explicit shared template edits never follow or reassign a different room template',()=>{
  const h=panelHarness(),originalRoom=structuredClone(h.props.room),original=structuredClone(h.props.project.lanes[0]);
  const other={...structuredClone(original),id:'other-composition',label:'Other shared scene'};
  h.props.project.lanes.push(other);h.props.compositionId=other.id;h.props.game='blackjack';
  let tree=h.render();assert.equal(nodes(tree,node=>node.type==='h2')[0].props.children,other.label);
  assert.equal(nodes(tree,node=>node.type==='a')[0].props.href,h.props.roomChoicesPath);
  nodes(tree,node=>node.type==='button'&&text(node)==='Redigera gemensam miljö')[0].props.onClick();
  tree=h.render();const updated={...structuredClone(other),openclaw:{...other.openclaw,idle:'rules'}};
  nodes(tree,node=>node.type===h.LayerAssetSelect)[0].props.onChange(updated);
  assert.deepEqual(h.props.project.lanes[0],original);assert.equal(h.props.project.lanes[1].openclaw.idle,'rules');
  assert.deepEqual(h.props.room,originalRoom);
  h.props.compositionId='missing';tree=h.render();
  assert.ok(text(tree).includes('Den valda miljön finns inte.'));
  assert.equal(nodes(tree,node=>node.type===h.LayerAssetSelect).length,0);
});

test('a selected library composition is editable without inventing a room context',()=>{
  const h=panelHarness();h.props.compositionId=h.props.project.lanes[0].id;h.props.game='blackjack';
  h.props.room=undefined;h.props.roomChoicesPath=null;
  let tree=h.render();assert.ok(nodes(tree,node=>node.type==='fieldset').every(node=>node.props.disabled));
  nodes(tree,node=>node.type==='button'&&text(node)==='Redigera gemensam miljö')[0].props.onClick();
  tree=h.render();const lane=structuredClone(h.props.project.lanes[0]);lane.openclaw.idle='rules';
  nodes(tree,node=>node.type===h.LayerAssetSelect)[0].props.onChange(lane);
  assert.equal(h.edits.length,1);assert.equal(h.props.room,undefined);
});

test('roulette preview never borrows blackjack idle or a blackjack table and keeps video upload game-scoped',()=>{
  const h=panelHarness();h.props.room.game='roulette';
  h.props.project.lines=[{dealerId:'astrid',eventId:'idle.ready',baselineVariantId:'base',variants:[{id:'base',videoGenerationId:'blackjack-idle'}]}];
  h.props.inventory.videos=[{id:'blackjack-idle',label:'BJ',available:true,contentType:'video/mp4',previewUrl:'/blackjack',classification:{dealerId:'astrid',eventId:'idle.ready'}}];
  const table={schemaVersion:1,id:'00000000-0000-4000-8000-000000000001',role:'table',label:'Roulette label alone',sha256:'a'.repeat(64),size:128,contentType:'video/webm',width:1920,height:1080};
  h.props.project.layerAssets=[{...table,pathname:layerAssetPath(table)}];h.props.project.lanes[0].layers.table.default=table.id;h.props.project.lanes[0].layers.table.allowed=[table.id];
  let tree=h.render(),preview=nodes(tree,node=>node.type===h.CompositionPreview)[0];
  assert.equal(preview.props.dealer,null);assert.equal(preview.props.table,null);
  assert.ok(nodes(tree,node=>node.type===h.LayerAssetSelect).every(node=>node.props.game==='roulette'));
  nodes(tree,node=>node.type==='button'&&text(node)==='Redigera gemensam miljö')[0].props.onClick();tree=h.render();
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
  runInNewContext(output.code,{module,exports:module.exports,structuredClone,require:name=>name.includes('layer-asset-contract')?{layerAssetFitsGame}:name.includes('composition-settings.mjs')?settings:name.endsWith('/ai-background.mjs')?{aiTableFitsTemplate}:require(name)});
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
  nodes(tree,node=>node.type==='button'&&text(node)==='Redigera gemensam miljö')[0].props.onClick();tree=h.render();
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
  nodes(tree,node=>node.type==='button'&&text(node)==='Redigera gemensam miljö')[0].props.onClick();
  tree=h.render();zoom=nodes(tree,node=>node.type===h.CompositionZoomControls)[0];assert.equal(zoom.props.disabled,false);
  const next=settings.defaultCompositionSettings();next.desktop.dealer.scale=1.1;
  zoom.props.onChange(next);
  assert.equal(h.props.project.lanes[0].composition.desktop.dealer.scale,1.1);
  assert.deepEqual(h.props.project.layerAssets,original.layerAssets);
  assert.equal(h.edits.length,1);assert.equal(h.props.room.id,'room-a');
  h.props.blocked=true;tree=h.render();assert.equal(nodes(tree,node=>node.type===h.CompositionZoomControls)[0].props.disabled,true);
});

test('table clips edit lanes[0].tablePlayback behind template edit ownership and reach the preview beside the background rules',()=>{
  const h=panelHarness(),still={schemaVersion:1,id:'00000000-0000-4000-8000-000000000011',role:'table',game:'blackjack',label:'Oak',sha256:'a'.repeat(64),size:1024,contentType:'image/png',width:1672,height:941};
  const clip={...still,id:'00000000-0000-4000-8000-000000000012',label:'Flower',contentType:'video/mp4',width:1920,height:1080};
  h.props.project.layerAssets=[still,clip].map(row=>({...row,pathname:layerAssetPath(row)}));
  const lane=h.props.project.lanes[0];lane.layers.table={enabled:true,default:still.id,allowed:[still.id,clip.id]};
  let tree=h.render(),editor=nodes(tree,node=>node.type===h.LayerPlaybackEditor&&node.props.role==='table')[0];
  assert.equal(editor.props.disabled,true);assert.equal(editor.props.baseSelected,true);assert.deepEqual(editor.props.allowed,[still.id,clip.id]);
  const policy={schemaVersion:1,rules:[defaultLayerRule(clip.id,'table-1',{role:'table'})]};
  editor.props.onChange(policy);assert.equal(h.edits.length,0,'preview mode never writes');
  nodes(tree,node=>node.type==='button'&&text(node)==='Redigera gemensam miljö')[0].props.onClick();tree=h.render();
  editor=nodes(tree,node=>node.type===h.LayerPlaybackEditor&&node.props.role==='table')[0];assert.equal(editor.props.disabled,false);
  editor.props.onChange(policy);assert.equal(h.edits.length,1);
  assert.deepEqual(h.edits[0].lanes[0].tablePlayback,policy);assert.equal(h.edits[0].lanes[0].backgroundPlayback,undefined);
  // With a blackjack table the preview is rendered through the placement editor's render prop.
  const previewOf=tree=>nodes(tree,node=>node.type===h.CompositionPreview)[0]??nodes(tree,node=>node.type===h.BlackjackScenePlacementEditor)[0].props.renderPreview();
  tree=h.render();let preview=previewOf(tree);
  assert.deepEqual(preview.props.tablePlayback,policy);assert.deepEqual(preview.props.tableAssets.map(row=>row.id),[still.id,clip.id]);
  assert.deepEqual(nodes(tree,n=>n.props?.['aria-label']==='Bord att placera kort på').flatMap(select=>nodes(select,n=>n.type==='option').map(option=>option.props.value)),[still.id]);
  assert.equal(preview.props.previewTableRequest,0);assert.equal(preview.props.previewBackgroundRequest,0);
  nodes(tree,node=>node.type===h.LayerPlaybackEditor&&node.props.role==='table')[0].props.onPreview('table-1');tree=h.render();
  preview=previewOf(tree);assert.equal(preview.props.previewTableRuleId,'table-1');assert.equal(preview.props.previewTableRequest,1);
  assert.equal(preview.props.previewBackgroundRequest,0,'the table preview does not trigger the background preview');
  nodes(tree,node=>node.type===h.LayerPlaybackEditor&&node.props.role==='table')[0].props.onChange(undefined);
  assert.equal(h.edits.at(-1).lanes[0].tablePlayback,undefined);assert.equal(h.edits.length,2);
});

test('composition background preview and placement overlay receive the same baseline framing',()=>{
 const h=panelHarness(),line=h.props.project.lines.find(row=>row.dealerId==='astrid'&&row.eventId==='idle.ready');
 const framing={scale:1.4,x:.1,y:.05};line.variants.find(row=>row.id===line.baselineVariantId).videoGenerationId='reference-film';
 h.props.inventory.videos=[{id:'reference-film',available:true,previewUrl:'/reference.mp4',contentType:'video/mp4',classification:{framing}}];
 const lane=h.props.project.lanes[0];lane.layers.table.default='00000000-0000-4000-8000-000000000002';lane.layers.table.allowed=[lane.layers.table.default];
 h.props.project.layerAssets=[{id:lane.layers.table.default,role:'table',width:1672,height:941,game:'blackjack',contentType:'image/png',label:'Table'}];
 const editor=nodes(h.render(),n=>n.type===h.BlackjackScenePlacementEditor)[0];assert.ok(editor);
 assert.deepEqual(editor.props.scene.framing,framing);assert.deepEqual(editor.props.renderPreview().props.framing,framing);
});

test('every allowed board can be edited without changing defaults or room bindings, with matching preview',()=>{
 const h=panelHarness(),base={schemaVersion:1,role:'table',game:'blackjack',sha256:'a'.repeat(64),size:1024,contentType:'image/png',width:1672,height:941};
 const assets=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'].map((id,i)=>{const row={...base,id,label:'Board '+i};return {...row,pathname:layerAssetPath(row)};});
 h.props.project.layerAssets=assets;const lane=h.props.project.lanes[0];lane.layers.table={enabled:true,default:assets[0].id,allowed:assets.map(a=>a.id)};
 const room=structuredClone(h.props.room),defaults=structuredClone(lane.layers),original=structuredClone(h.props.project);
 let tree=h.render();nodes(tree,n=>n.props?.['aria-label']==='Bord att placera kort på')[0].props.onChange({target:{value:assets[1].id}});
 tree=h.render();const editor=nodes(tree,n=>n.type===h.BlackjackScenePlacementEditor)[0];assert.equal(editor.props.tableId,assets[1].id);
 assert.equal(editor.props.renderPreview().props.table.url,'/studio/api/layer-assets/'+assets[1].id);assert.deepEqual(h.props.project,original);assert.deepEqual(h.props.room,room);
 nodes(tree,n=>n.type==='button'&&text(n)==='Redigera gemensam miljö')[0].props.onClick();tree=h.render();
 nodes(tree,n=>n.type===h.BlackjackScenePlacementEditor)[0].props.onChange(settings.defaultBlackjackTableGeometry(assets[1].id));
 assert.equal(h.props.project.lanes[0].composition.blackjackTables[0].tableId,assets[1].id);assert.deepEqual(h.props.project.lanes[0].layers,defaults);
 tree=h.render();nodes(tree,n=>n.props?.['aria-label']==='Chatt width')[0].props.onChange({target:{valueAsNumber:70}});
 assert.equal(h.props.project.lanes[0].composition.mobile.gameUi.chat.width,.7);assert.equal(h.props.project.lanes[0].composition.desktop.gameUi,undefined);
});

test('background and dealer preview choices do not edit the shared template or room defaults',()=>{
 const h=panelHarness(),lane=h.props.project.lanes[0],other={...h.props.project.dealers[0],id:'dragan',label:'Dragan'};
 h.props.project.dealers.push(other);
 lane.layers.dealer.allowed.push(other.id);
 const assets=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'].map((id,i)=>({id,role:'background',label:'Background '+i,contentType:'image/png'}));
 h.props.project.layerAssets=assets;lane.layers.background={enabled:true,default:assets[0].id,allowed:assets.map(row=>row.id)};
 const line=structuredClone(h.props.project.lines.find(row=>row.dealerId==='astrid'&&row.eventId==='idle.ready'));line.dealerId=other.id;h.props.project.lines.push(line);
 line.variants.find(row=>row.id===line.baselineVariantId).videoGenerationId='other-idle';
 h.props.inventory.videos=[{id:'other-idle',available:true,previewUrl:'/other-idle',contentType:'video/mp4'}];
 const before=structuredClone(h.props.project),room=structuredClone(h.props.room);
 let tree=h.render();nodes(tree,n=>n.props?.['aria-label']==='Bakgrund att förhandsvisa')[0].props.onChange({target:{value:assets[1].id}});
 tree=h.render();nodes(tree,n=>n.props?.['aria-label']==='Dealer att förhandsvisa')[0].props.onChange({target:{value:other.id}});
 const preview=nodes(h.render(),n=>n.type===h.CompositionPreview)[0];assert.equal(preview.props.background.url,'/studio/api/layer-assets/'+assets[1].id);assert.equal(preview.props.dealer.url,'/other-idle');
 assert.deepEqual(h.props.project,before);assert.deepEqual(h.props.room,room);assert.equal(h.edits.length,0);
});

test('manual background and table clip previews restore their own base and policy after alternative material selection',()=>{
  const h=panelHarness(),lane=h.props.project.lanes[0],materials={};
  h.props.project.layerAssets=[];
  for(const [roleIndex,role] of ['background','table'].entries()){
    const assets=['base','alternative','clip'].map((label,index)=>({id:`00000000-0000-4000-8000-${String(roleIndex*3+index+1).padStart(12,'0')}`,role,...(role==='table'?{game:'blackjack'}:{}),label:`${role} ${label}`,contentType:index===2?'video/mp4':'image/png',width:1672,height:941}));
    materials[role]=assets;
    h.props.project.layerAssets.push(...assets);
    lane.layers[role]={enabled:true,default:assets[0].id,allowed:assets.map(asset=>asset.id)};
    lane[role+'Playback']={schemaVersion:1,rules:[defaultLayerRule(assets[2].id,role+'-motion',{role})]};
  }
  const before=structuredClone(h.props.project),room=structuredClone(h.props.room);
  const choose=(role,id)=>nodes(h.render(),node=>node.props?.['aria-label']===(role==='background'?'Bakgrund att förhandsvisa':'Bord att placera kort på'))[0].props.onChange({target:{value:id}});
  const preview=()=>nodes(h.render(),node=>node.type===h.BlackjackScenePlacementEditor)[0].props.renderPreview().props;
  const start=role=>nodes(h.render(),node=>node.type===(role==='background'?h.BackgroundPlaybackEditor:h.LayerPlaybackEditor))[0].props.onPreview(role+'-motion');
  for(const request of [1,2]){
    for(const role of ['background','table'])choose(role,materials[role][1].id);
    assert.equal(preview().backgroundPlayback,undefined);assert.equal(preview().tablePlayback,undefined);
    start('background');
    let shown=preview();
    assert.equal(shown.background.url,'/studio/api/layer-assets/'+materials.background[0].id);
    assert.deepEqual(shown.backgroundPlayback,lane.backgroundPlayback);
    assert.equal(shown.previewBackgroundRuleId,'background-motion');assert.equal(shown.previewBackgroundRequest,request);
    assert.equal(shown.table.url,'/studio/api/layer-assets/'+materials.table[1].id);
    assert.equal(shown.tablePlayback,undefined);assert.equal(shown.previewTableRequest,request-1);
    start('table');shown=preview();
    assert.equal(shown.table.url,'/studio/api/layer-assets/'+materials.table[0].id);
    assert.deepEqual(shown.tablePlayback,lane.tablePlayback);
    assert.equal(shown.previewTableRuleId,'table-motion');assert.equal(shown.previewTableRequest,request);
    assert.equal(shown.previewBackgroundRequest,request);assert.deepEqual(shown.backgroundPlayback,lane.backgroundPlayback);
  }
  assert.deepEqual(h.props.project,before);assert.deepEqual(h.props.room,room);assert.equal(h.edits.length,0);
});

test('scene publication and uploads share one operation lock until every operation finishes',()=>{
 const h=panelHarness(),states=[];h.props.onBusyChange=value=>states.push(value);
 nodes(h.render(),n=>n.type==='button'&&text(n)==='Redigera gemensam miljö')[0].props.onClick();
 let tree=h.render(),publication=nodes(tree,n=>n.type===h.ScenePublication)[0],upload=nodes(tree,n=>n.type===h.LayerLibrary)[0];
 publication.props.onBusyChange(true);tree=h.render();
 assert.ok(nodes(tree,n=>n.type===h.LayerLibrary).every(n=>n.props.disabled));
 assert.ok(nodes(tree,n=>n.type===h.LayerAssetManager).every(n=>n.props.disabled));
 upload.props.onBusyChange(true);publication.props.onBusyChange(false);tree=h.render();
 assert.equal(states.at(-1),true);assert.ok(nodes(tree,n=>n.type===h.LayerLibrary).every(n=>n.props.disabled));
 upload.props.onBusyChange(false);tree=h.render();
 assert.equal(states.at(-1),false);assert.ok(nodes(tree,n=>n.type===h.LayerLibrary).every(n=>!n.props.disabled));
});

test('copying placement updates only the selected allowed board in both formats',()=>{
 const h=panelHarness(),base={schemaVersion:1,role:'table',game:'blackjack',sha256:'a'.repeat(64),size:1024,contentType:'image/png',width:1672,height:941};
 const assets=[1,2].map(n=>{const row={...base,id:'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),label:'Board '+n};return {...row,pathname:layerAssetPath(row)};});
 h.props.project.layerAssets=assets;const lane=h.props.project.lanes[0];lane.layers.table={enabled:true,default:assets[0].id,allowed:assets.map(row=>row.id)};
 lane.composition=settings.defaultCompositionSettings();lane.composition.blackjackTables=assets.map(row=>settings.defaultBlackjackTableGeometry(row.id));
 lane.composition.blackjackTables[0].mobile.fanSpread=.65;lane.composition.blackjackTables[0].desktop.fanSpread=.7;
 assert.doesNotThrow(()=>validateProject(h.props.project),'fixture is a valid saved project');
 const source=structuredClone(lane.composition.blackjackTables[0]),layers=structuredClone(lane.layers);
 nodes(h.render(),n=>n.props?.['aria-label']==='Bord att placera kort på')[0].props.onChange({target:{value:assets[1].id}});
 let tree=h.render();const copy=()=>nodes(h.render(),n=>n.type==='button'&&text(n)==='Kopiera båda formaten till valt bord')[0];assert.equal(copy().props.disabled,true);
 nodes(tree,n=>n.type==='button'&&text(n)==='Redigera gemensam miljö')[0].props.onClick();copy().props.onClick();
 assert.deepEqual(nodes(h.render(),n=>n.props?.role==='alert').map(text),[]);assert.equal(h.edits.length,1,'copy commits one valid project edit');
 const next=h.props.project.lanes[0];assert.deepEqual(next.composition.blackjackTables.find(row=>row.tableId===assets[1].id),{...source,tableId:assets[1].id});
 assert.deepEqual(next.composition.blackjackTables.find(row=>row.tableId===assets[0].id),source);assert.deepEqual(next.layers,layers);
});

test('the miljöbild sits in the environment editor, locked until the shared environment is edited, and a picture is registered as an illustration',()=>{
  const harness=panelHarness(),registered=[];harness.props.onRegistered=(project,id,role)=>registered.push([id,role]);
  const picture=()=>nodes(harness.render(),node=>node.type===harness.EnvironmentPicture)[0];
  assert.equal(picture().props.laneId,harness.props.project.lanes[0].id);
  assert.equal(picture().props.blocked,true,'preview mode cannot choose or export a picture');
  assert.equal(picture().props.dirty,false);
  const edit=nodes(harness.render(),node=>node.type==='button'&&text(node)==='Redigera gemensam miljö')[0];edit.props.onClick();
  assert.equal(picture().props.blocked,false);
  picture().props.onExported(harness.props.project,'00000000-0000-4000-8000-0000000000a1');
  assert.deepEqual(registered,[['00000000-0000-4000-8000-0000000000a1','illustration']]);
  harness.props.projectDirty=true;assert.equal(picture().props.dirty,true,'an unsaved draft is never exported');
});
