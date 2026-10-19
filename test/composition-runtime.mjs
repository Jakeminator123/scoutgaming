import {cloudPresentationFixture} from '../apps/studio/test/fixtures/cloud-presentation.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPresentationApi} from '../services/game/presentation-api.mjs';
import {presentationCapabilitiesResponse} from '../services/game/presentation-capabilities.mjs';
import {defaultCompositionSettings,defaultBlackjackTableGeometry,validateCompositionSettings,sceneForComposition} from '../packages/presentation/contracts/composition-settings.mjs';
import {validateComposition,createLayerComposition,clipCompositing} from '../packages/presentation/runtime/presentation-composition.mjs';
import {compositionRuntimeResponse} from '../services/game/composition-runtime.mjs';
import {stageGeometry,tableRect,backgroundRect} from '../packages/presentation/compositor/geometry.js';
import {zoomComposition} from '../apps/studio/lib/composition-zoom.mjs';
import {Compositor} from '../packages/presentation/compositor/compositor.js';
import {createSeedProject,addDealer,defaultPresentationLane,validateProject} from '../packages/presentation/contracts/studio-model.mjs';
import {buildPresentationPackage,layerAssetPath} from '../packages/presentation/contracts/presentation-layers.mjs';
import {withPackagePresentation,readPackagePresentation} from '../packages/presentation/server/presentation-package.mjs';
import {createGameEntrySelector} from '../packages/presentation/server/game-entry-selector.mjs';
import {decorateGameEntryHtml} from '../services/game/public/game-entry-contract.mjs';
import { validateGameLanes } from '../packages/presentation/contracts/game-lanes.mjs';
import {gameLaneFromDocument} from '../packages/presentation/contracts/game-selection.mjs';
import {layoutGameOverlay,BLACKJACK_COMPACT_QUERY} from '../packages/presentation/runtime/game-overlay-layout.mjs';
const key={mode:'green-screen',threshold:.23,softness:.15,despill:0};
test('independent anchors survive project save and frozen publication; later drafts cannot move published cards',()=>{
  const settings=defaultCompositionSettings(),board=defaultBlackjackTableGeometry(asset('table',2).id);settings.blackjackTables=[board];
  board.mobile.anchors={cards:{target:'dealer',rect:{x:-.3,y:.2,width:1.6,height:.8}}};
  board.desktop.anchors={bets:{target:'scene',rect:{x:.1,y:.2,width:.5,height:.4}}};
  const {project,pack,descriptor}=fixture('nora','Nora',settings);
  validateProject(JSON.parse(JSON.stringify(project)));
  assert.deepEqual(validateComposition(descriptor).settings,settings);
  const frozen=structuredClone(readPackagePresentation(pack));
  project.lanes[0].composition.blackjackTables[0].mobile.anchors.cards.rect.x=.9;
  assert.deepEqual(readPackagePresentation(pack),frozen);
  assert.equal(frozen.lanes[0].composition.blackjackTables[0].mobile.anchors.cards.rect.x,-.3);
});

test('saved scene zoom keeps all layer coordinates around the same centre at every viewport size',()=>{
  const settings=defaultCompositionSettings();settings.tableFront=true;
  for(const layout of ['mobile','desktop']) {
    Object.assign(settings[layout].dealer,{scale:1.2,x:.08,y:-.03});
    Object.assign(settings[layout].background,{scale:1.1,x:-.05,y:.06});
    Object.assign(settings[layout].table,{width:.8,x:.02,y:.2});
    const original=structuredClone(settings),factor=1.1;
    const zoomed=zoomComposition(settings,layout,factor);
    const before=sceneForComposition(settings,layout),after=sceneForComposition(zoomed,layout);
    const a=stageGeometry(before),b=stageGeometry(after);
    for(const asset of [{width:1672,height:941},{width:720,height:1280}]) {
      const rects=[[[a.x,a.y,1080*a.s,1920*a.s],[b.x,b.y,1080*b.s,1920*b.s]],
        [backgroundRect(before,asset,a.dims),backgroundRect(after,asset,b.dims)],
        [tableRect(before,asset,a),tableRect(after,asset,b)]];
      for(const viewportWidth of [390,768,1440]) for(const [oldRect,newRect] of rects) {
        const viewportScale=viewportWidth/a.dims[0];
        for(let i=0;i<4;i++) {
          const pivot=i<2?a.dims[i]/2:0;
          assert.ok(Math.abs(newRect[i]*viewportScale-(pivot+(oldRect[i]-pivot)*factor)*viewportScale)<1e-8);
        }
      }
    }
    const restored=zoomComposition(zoomed,layout,1/factor);
    for(const role of ['dealer','background','table']) for(const field of Object.keys(settings[layout][role]))
      assert.ok(Math.abs(restored[layout][role][field]-settings[layout][role][field])<1e-12);
    assert.deepEqual(zoomed[layout==='mobile'?'desktop':'mobile'],settings[layout==='mobile'?'desktop':'mobile']);
    assert.deepEqual(settings,original);assert.equal(zoomed.tableFront,true);
  }
});

test('zoom rejects a whole step at scale or position limits without mutating saved profiles',()=>{
  const settings=defaultCompositionSettings();
  settings.blackjackTables=[defaultBlackjackTableGeometry('10000000-0000-4000-8000-000000000001')];
  assert.deepEqual(zoomComposition(settings,'desktop',1.1).blackjackTables,settings.blackjackTables);
  for(const [role,field,value,factor] of [['dealer','scale',4,1.1],['background','scale',.1,1/1.1],['table','width',4,1.1],['table','y',-2,1.1],['dealer','x',2,1.1]]) {
    const source=structuredClone(settings);source.desktop[role][field]=value;const original=structuredClone(source);
    assert.throws(()=>zoomComposition(source,'desktop',factor));assert.deepEqual(source,original);
  }
  for(const factor of [NaN,Infinity,0,-1])assert.throws(()=>zoomComposition(settings,'desktop',factor));
  assert.throws(()=>zoomComposition(settings,'unknown',1.1));
});
function asset(role,n){const value={schemaVersion:1,id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,role,label:role,sha256:'a'.repeat(64),size:128,contentType:'image/png',width:720,height:1280};return {...value,pathname:layerAssetPath(value)};}
function fixture(dealerId='nora',label='Nora',settings=defaultCompositionSettings()){
  let project=addDealer(createSeedProject(),dealerId,label); const lane=defaultPresentationLane(dealerId),background=asset('background',1),table=asset('table',2);
  lane.id=`${dealerId}-lane`;lane.dealers=[dealerId];lane.layers.dealer={enabled:true,default:dealerId,allowed:[dealerId]};
  lane.layers.background={enabled:true,mode:'image',default:background.id,allowed:[background.id]};
  lane.layers.table={enabled:true,default:table.id,allowed:[table.id]};lane.composition=settings;
  project.lanes=[lane];project.layerAssets=[background,table];
  const serverLane={schemaVersion:1,id:lane.id,label,renderer:'portrait-video',dealer:dealerId,mediaCollection:`${dealerId}-presentation`};
  const administration={gameLane:lane.id,gameLanes:[serverLane]};
  const cloud=cloudPresentationFixture({project,lanes:[lane]});project=cloud.project;const presentation=cloud.presentation;
  const pack={operatorId:'north',revision:1,lanes:[lane.id],games:['blackjack'],tables:[],branding:withPackagePresentation({},presentation)};
  const descriptor={schemaVersion:1,dealer:{enabled:true,compatibility:'per-clip'},background:lane.layers.background,table:lane.layers.table,settings:lane.composition,
    assets:presentation.assets.map(({id,role,label,contentType})=>({id,role,label,contentType,src:`/api/presentation/layers/north/${id}`}))};
  return {project,lane,administration,presentation,pack,descriptor};
}
test('shared placements reject nonfinite or unknown fields and table placement stays independent of dealer',()=>{
  const settings=defaultCompositionSettings();assert.equal(settings.tableFront,false);
  for(const change of [s=>s.mobile.dealer.x=Infinity,s=>s.desktop.table.width=0,s=>s.tableFront=1,s=>s.mobile.background.provider='secret']){
    const changed=structuredClone(settings);change(changed);assert.throws(()=>validateCompositionSettings(changed));}
  const scene=sceneForComposition(settings,'desktop'),table={width:720,height:1280};
  const initial=tableRect(scene,table,stageGeometry(scene));scene.stage.desktop={scale:3,x:1,y:-1};
  assert.deepEqual(tableRect(scene,table,stageGeometry(scene)),initial);
  assert.equal(initial[2],607.5);assert.equal(scene.show.cards,false);
});

test('optional table geometry is strict, frozen with publication, and absent from legacy defaults',()=>{
  assert.equal(Object.hasOwn(defaultCompositionSettings(),'blackjackTables'),false);
  const settings=defaultCompositionSettings();settings.blackjackTables=[defaultBlackjackTableGeometry(asset('table',2).id)];
  assert.deepEqual(validateCompositionSettings(settings),settings);
  for(const change of [s=>s.blackjackTables.push(s.blackjackTables[0]),s=>s.blackjackTables[0].tableId='oak',
    s=>s.blackjackTables[0].mobile.seats.pop(),s=>s.blackjackTables[0].desktop.seats.push({}),
    s=>s.blackjackTables[0].mobile.dealer.x=NaN,s=>s.blackjackTables[0].mobile.cardWidth=0,
    s=>s.blackjackTables[0].mobile.seats[0].bet.y=1.01,s=>s.blackjackTables[0].mobile.seats[0].dealClip='unreviewed']){
    const invalid=structuredClone(settings);change(invalid);assert.throws(()=>validateCompositionSettings(invalid));
  }
  const {project,pack,descriptor}=fixture('nora','Nora',settings);
  assert.deepEqual(validateComposition(descriptor).settings.blackjackTables,settings.blackjackTables);
  const frozen=structuredClone(readPackagePresentation(pack));
  project.lanes[0].composition.blackjackTables[0].mobile.dealer.x=.8;
  assert.deepEqual(readPackagePresentation(pack),frozen);
  assert.equal(frozen.lanes[0].composition.blackjackTables[0].mobile.dealer.x,.5);
  for(const change of [p=>p.lanes[0].layers.table.allowed=[],p=>p.layerAssets=p.layerAssets.filter(row=>row.role!=='table'),
    p=>p.layerAssets.find(row=>row.role==='table').game='roulette']){
    const invalid=structuredClone(project);change(invalid);assert.throws(()=>validateProject(invalid));
  }
  const invalid=structuredClone(descriptor);invalid.settings.blackjackTables[0].tableId=asset('table',9).id;
  assert.throws(()=>validateComposition(invalid));
});

test('under-cards is optional per board layout, strictly validated and preserved in the frozen package',()=>{
  for(const layout of ['mobile','desktop']){
    const settings=defaultCompositionSettings(),tableId=asset('table',2).id,board=defaultBlackjackTableGeometry(tableId);
    assert.equal(Object.hasOwn(board.mobile,'betMode'),false);assert.equal(Object.hasOwn(board.desktop,'betMode'),false);
    board[layout].betMode='under-cards';settings.blackjackTables=[board];
    assert.deepEqual(validateCompositionSettings(settings,{tableIds:[tableId],assets:[asset('table',2)]}),settings);
    const {project,pack,descriptor}=fixture('nora','Nora',settings);
    assert.equal(validateComposition(descriptor).settings.blackjackTables[0][layout].betMode,'under-cards');
    delete project.lanes[0].composition.blackjackTables[0][layout].betMode;
    assert.equal(readPackagePresentation(pack).lanes[0].composition.blackjackTables[0][layout].betMode,'under-cards');
    for(const betMode of [undefined,null,'','manual','under_cards',false,{}]){
      const invalid=structuredClone(settings);invalid.blackjackTables[0][layout].betMode=betMode;
      assert.throws(()=>validateCompositionSettings(invalid));
    }
  }
});

test('room-specific table A uses its exact geometry without rewriting a shared A+B composition',async()=>{
  const f=fixture(),a=f.project.layerAssets.find(row=>row.role==='table'),b=asset('table',3),lane=f.project.lanes[0];
  f.project.layerAssets.push(b);lane.layers.table.allowed.push(b.id);
  lane.composition.blackjackTables=[defaultBlackjackTableGeometry(a.id),defaultBlackjackTableGeometry(b.id)];
  lane.composition.blackjackTables[1].mobile.dealer.y=.3;
  const cloud=cloudPresentationFixture({project:f.project,lanes:[lane],assets:f.project.layerAssets});
  f.pack.branding=withPackagePresentation({roomOverrides:{'room-a':{table:a.id}}},cloud.presentation);f.pack.tables=['room-a'];
  f.administration.rooms=[{schemaVersion:2,id:'room-a',name:'A',operatorId:'north',presentationLaneId:lane.id,gameLaneId:f.administration.gameLanes[0].id,state:'live'}];
  const before=structuredClone({project:f.project,pack:f.pack});
  const select=createGameEntrySelector({policy:{readGameConfiguration(){},readSaved:async()=>({project:f.project,administration:f.administration})},packages:{resolve:async()=>({operator:{id:'north'},package:f.pack})}});
  const result=await select('operator=north&table=room-a');assert.equal(result.status,200);
  assert.equal(result.selection.branding.table,a.id);
  assert.equal(validateComposition(result.selection.composition).settings.blackjackTables.length,2);
  assert.deepEqual({project:f.project,pack:f.pack},before);
});

test('runtime geometry follows only the selected exact table and warns for unconfigured choices',async()=>{
  const settings=defaultCompositionSettings(),tableId=asset('table',2).id;
  settings.blackjackTables=[defaultBlackjackTableGeometry(tableId)];
  const {descriptor}=fixture('nora','Nora',settings),other=asset('table',3);
  descriptor.assets.push({id:other.id,role:'table',label:'Other',contentType:other.contentType,src:`/api/presentation/layers/north/${other.id}`});
  descriptor.table.allowed.push(other.id);
  const host={dataset:{},clientWidth:390,clientHeight:844,append(){}};
  const document={documentElement:{dataset:{}},querySelector:()=>host,createElement:tag=>({tagName:tag.toUpperCase(),dataset:{},style:{setProperty(){}},complete:true,naturalWidth:1672,naturalHeight:941,
    setAttribute(){},remove(){},addEventListener(){},removeEventListener(){},getContext:()=>({clearRect(){},drawImage(){}})})};
  class SharedCompositor{constructor(canvas){this.canvas=canvas;}geometry(scene){return stageGeometry(scene);}tableGeometry(scene,image){return Compositor.prototype.tableGeometry.call(this,scene,image);}render(){}dispose(){}}
  const c=createLayerComposition(document,descriptor,{loadRuntime:async()=>({Compositor:SharedCompositor})});
  await c.prepareClip(key,undefined,{kind:'idle'});c.renderFrame({videoWidth:1080,videoHeight:1920});
  assert.equal(c.referencePlane().tableGeometry.tableId,tableId);
  c.setTable(other.id);assert.equal(c.referencePlane().tableGeometry,undefined);assert.match(c.referencePlane().geometryWarning,/saknar egna/);
  assert.equal(c.referencePlane().sourceAligned,false);
  c.setTable(tableId);assert.equal(c.referencePlane().tableGeometry.tableId,tableId);
  c.close();
});

for(const [width,height]of [[844,390],[900,1200]])test(`board scene, saved format and visible server seats agree at ${width}x${height}; legacy orientation stays unchanged`,async()=>{
  for(const configured of [false,true]){
    const settings=defaultCompositionSettings();
    if(configured)settings.blackjackTables=[defaultBlackjackTableGeometry(asset('table',2).id)];
    const {descriptor}=fixture('nora','Nora',settings),renders=[];
    const host={dataset:{},clientWidth:width,clientHeight:height,append(){}};
    const compact=width<=860;
    const document={defaultView:{matchMedia(query){assert.equal(query,BLACKJACK_COMPACT_QUERY);return {matches:compact};}},documentElement:{dataset:{}},querySelector:()=>host,
      createElement:tag=>({tagName:tag.toUpperCase(),dataset:{},style:{setProperty(){}},complete:true,naturalWidth:1672,naturalHeight:941,setAttribute(){},remove(){},addEventListener(){},removeEventListener(){},getContext:()=>({clearRect(){},drawImage(){}})})};
    class SharedCompositor{constructor(canvas){this.canvas=canvas;}geometry(scene){return stageGeometry(scene);}tableGeometry(scene,image){return tableRect(scene,image,this.geometry(scene));}render(scene){renders.push(scene);}dispose(){}}
    const c=createLayerComposition(document,descriptor,{loadRuntime:async()=>({Compositor:SharedCompositor})});
    await c.prepareClip(key,undefined,{kind:'idle'});c.renderFrame({videoWidth:1080,videoHeight:1920});
    const expected=configured?(compact?'mobile':'desktop'):(width<height?'mobile':'desktop');
    assert.equal(renders.at(-1).layout,expected);
    if(configured){
      const plane=c.referencePlane();assert.equal(plane.tableLayout,expected);
      const boxes=compact?[4,5,6]:[0,1,2,3,4,5,6];
      const result=layoutGameOverlay(plane,boxes,{left:12,right:width-12,top:80,bottom:height-12},{compact});
      assert.deepEqual(result.seats.map(row=>row.box),boxes);
      assert.equal(Object.keys(result.positions).length,boxes.length+1);
    }
    c.close();
  }
});

test('alpha layers stay visible with or without board geometry; disabled layers stay hidden',async()=>{
  for(const withBoard of [false,true])for(const [clientWidth,clientHeight]of [[390,844],[1920,1080]])for(const enabled of [true,false]){
    const settings=defaultCompositionSettings();if(withBoard)settings.blackjackTables=[defaultBlackjackTableGeometry(asset('table',2).id)];
    const {descriptor}=fixture('nora','Nora',settings);descriptor.table.enabled=enabled;
    const renders=[],host={dataset:{},clientWidth,clientHeight,append(){}};
    const document={documentElement:{dataset:{}},querySelector:()=>host,createElement:tag=>({tagName:tag.toUpperCase(),dataset:{},style:{setProperty(){}},complete:true,naturalWidth:1672,naturalHeight:941,
      setAttribute(){},remove(){},addEventListener(){},removeEventListener(){},getContext:()=>({clearRect(){},drawImage(){}})})};
    class SharedCompositor{constructor(canvas){this.canvas=canvas;}geometry(scene){return stageGeometry(scene);}tableGeometry(scene,image){return tableRect(scene,image,this.geometry(scene));}render(scene){renders.push(scene);}dispose(){}}
    const c=createLayerComposition(document,descriptor,{loadRuntime:async()=>({Compositor:SharedCompositor})});
    await c.prepareClip({mode:'alpha'},undefined,{kind:'idle'});c.renderFrame({videoWidth:1080,videoHeight:1920});
    assert.equal(renders.at(-1).key.enabled,false);assert.equal(renders.at(-1).show.table,enabled);assert.equal(renders.at(-1).show.background,true);
    assert.equal(Boolean(c.referencePlane().tableGeometry),enabled&&withBoard);
    descriptor.background.enabled=false;c.replace(descriptor);
    await c.prepareClip({mode:'alpha'},undefined,{kind:'idle'});c.renderFrame({videoWidth:1080,videoHeight:1920});
    assert.equal(renders.at(-1).show.background,false);assert.equal(renders.at(-1).show.table,enabled);
    c.close();
  }
});
test('compositor uses the same actor frame with explicit table order and never paints game cards',()=>{
  for(const tableFront of [false,true]){const calls=[],settings=defaultCompositionSettings();settings.tableFront=tableFront;
    const scene=sceneForComposition(settings,'mobile',{background:false},{enabled:true});
    const actor={},table={el:{table:true},width:720,height:1280};
    const compositor={ready:true,gl:{COLOR_BUFFER_BIT:1,viewport(){},clearColor(){},clear(){}},canvas:{},geometry:stageGeometry,draw:source=>calls.push(source===actor?'actor':'table'),paintCards(){calls.push('project-cards');}};
    Compositor.prototype.render.call(compositor,scene,actor,new Map([['table',table]]),[],null);
    assert.deepEqual(calls,tableFront?['actor','table','project-cards']:['table','project-cards','actor']);}
});

function withCpuCompositor(run) {
  const names=['document','HTMLVideoElement','ImageData'],previous=names.map(name=>Object.getOwnPropertyDescriptor(globalThis,name));
  let reads=0;
  class Canvas {
    width=360;height=640;
    context={clearRect(){},setTransform(){},fillRect(){},scale(){},drawImage(source){this.source=source;},
      getImageData(){reads++;return {data:Uint8ClampedArray.from(this.source.pixels)};},putImageData(image){this.output=image.data;}};
    getContext(kind){return kind==='webgl'?null:this.context;}
  }
  // A one-pixel fixture exercises the real alpha split without allocating full frames.
  class Pixels {constructor(source){this.data=source instanceof Uint8ClampedArray?source:new Uint8ClampedArray(4);}}
  try {
    globalThis.document={createElement:()=>new Canvas()};globalThis.HTMLVideoElement=class {};globalThis.ImageData=Pixels;
    const compositor=new Compositor(new Canvas(),()=>{});
    const scene=sceneForComposition(defaultCompositionSettings(),'desktop',{background:false,table:false});scene.layerMode='split';scene.handmatte='hands';
    const actor={src:'actor-1',width:1920,height:1080,pixels:[180,130,90,255]};
    const hand={src:'hand-1',width:480,height:270,pixels:[0,0,0,255]},assets=new Map([['hands',{el:hand}]]);
    return run({compositor,scene,actor,hand,assets,get reads(){return reads;},render:()=>compositor.render(scene,actor,assets,[],null)});
  } finally {names.forEach((name,index)=>{if(previous[index])Object.defineProperty(globalThis,name,previous[index]);else delete globalThis[name];});}
}

test('Canvas2D follows moving hand-mask frames and retains unchanged mask caches',()=>withCpuCompositor(f=>{
  const {cpu}=f.compositor;f.render();
  assert.equal(cpu.hands.context.output[3],0);assert.equal(cpu.body.context.output[3],255);
  const cached=cpu.mask(f.hand),initialReads=f.reads;f.render();
  assert.equal(f.reads,initialReads);assert.equal(cpu.mask(f.hand),cached);
  f.actor.src='actor-2';f.hand.src='hand-2';f.hand.pixels=[255,255,255,255];f.render();
  assert.equal(cpu.hands.context.output[3],255);assert.equal(cpu.body.context.output[3],0);
  assert.notEqual(cpu.mask(f.hand),cached);
  // A mask-only update must invalidate the prepared actor, even while it is paused.
  f.hand.src='hand-3';f.hand.pixels=[0,0,0,255];f.render();
  assert.equal(cpu.hands.context.output[3],0);assert.equal(cpu.body.context.output[3],255);
}));

test('Canvas2D invalidates resized, replaced, timed and removed masks without changing the actor source',()=>withCpuCompositor(f=>{
  const {cpu}=f.compositor;f.render();
  f.hand.width++;f.hand.pixels=[255,255,255,255];f.render();assert.equal(cpu.hands.context.output[3],255);
  f.hand.height++;f.hand.pixels=[0,0,0,255];f.render();assert.equal(cpu.hands.context.output[3],0);
  const next={...f.hand,pixels:[255,255,255,255]};f.assets.set('hands',{el:next});f.render();assert.equal(cpu.hands.context.output[3],255);
  next.currentTime=1;next.pixels=[0,0,0,255];f.render();assert.equal(cpu.hands.context.output[3],0);
  f.scene.matte='cutout';f.assets.set('cutout',{el:{src:'matte',width:1,height:1,pixels:[0,0,0,255]}});f.render();assert.equal(cpu.full.context.output[3],0);
  f.assets.delete('cutout');f.render();assert.equal(cpu.full.context.output[3],255);
  f.assets.delete('hands');f.render();assert.equal(cpu.mask(null),null);assert.equal(cpu.lastHand,null);
}));
test('published Nora uses the frozen named registry and rejects query requests for another dealer',async()=>{
  const {project,administration,pack,presentation}=fixture();
  const policy={readGameConfiguration(){},readSaved:async()=>({project,administration})};
  const select=createGameEntrySelector({policy,packages:{resolve:async()=>({operator:{id:'north'},package:pack})}});
  assert.equal((await select('operator=north&lane=nora-lane&dealer=astrid')).status,404);
  const {selection}=await select('operator=north&lane=nora-lane');
  assert.equal(selection.dealer,'nora');assert.equal(selection.presentation,'local');assert.equal(selection.localDealer,'nora');
  assert.equal(selection.composition.dealer.compatibility,'per-clip');
  project.lanes[0].composition.mobile.dealer.scale=3;
  assert.deepEqual(readPackagePresentation(pack),presentation);
  assert.equal(selection.composition.settings.mobile.dealer.scale,1);
  const ownLane=administration.gameLanes[0];
  administration.gameLanes=[{...ownLane,dealer:'astrid',mediaCollection:'astrid-presentation'}];
  await assert.rejects(select('operator=north'),error=>error.statusCode===503&&error.message==='presentation_dealer_mismatch');
  administration.gameLanes=[ownLane];
  const html=decorateGameEntryHtml('<html></html>',{CROUPIER_STUDIO_NEON_POLICY:'1'},selection);
  assert.match(html,/data-game-local-dealer="nora"/);
  assert.equal(gameLaneFromDocument({gameLane:'nora-lane',gameDealer:'nora',gamePresentation:'local',gameLocalDealer:'nora',gameRegisteredDealers:JSON.stringify([{id:'nora',label:'Nora'}])}).dealer,'nora');
  assert.throws(()=>gameLaneFromDocument({gameLane:'nora-lane',gameDealer:'nora',gamePresentation:'local'}));
  project.dealers=project.dealers.filter(row=>row.id!=='nora');
  assert.equal((await select('operator=north')).selection.dealer,'nora','frozen registration survives mutable Studio edits');
  assert.throws(()=>buildPresentationPackage(project,['nora-lane'],project.layerAssets));
  assert.doesNotThrow(()=>validateGameLanes([{...administration.gameLanes[0],dealer:'unregistered',mediaCollection:'unregistered-presentation'}])); // syntax is not server registration
});
test('runtime serves only the two shared code files and refuses data, queries and writes',async()=>{
  const response=await compositionRuntimeResponse(new Request('https://local/composition-runtime/compositor.js'));
  assert.equal(response.status,200);assert.equal(await response.text(),await readFile(new URL('../packages/presentation/compositor/compositor.js',import.meta.url),'utf8'));
  assert.equal(await compositionRuntimeResponse(new Request('https://local/composition-runtime/catalog.json')),null);
  assert.equal(await compositionRuntimeResponse(new Request('https://local/composition-runtime/../../.env')),null);
  assert.equal((await compositionRuntimeResponse(new Request('https://local/composition-runtime/geometry.js?file=.env'))).status,400);
  assert.equal((await compositionRuntimeResponse(new Request('https://local/composition-runtime/geometry.js',{method:'POST'}))).status,405);
});
test('two exact dealer plays and legacy metadata always use the shared keyed compositor',async()=>{
  const {descriptor}=fixture(),painted=[],rectangles=[],nodes=new Set(),host={dataset:{},clientWidth:1080,clientHeight:1920,append:node=>nodes.add(node)};
  const document={documentElement:{dataset:{}},querySelector:()=>host,createElement:tag=>({tagName:tag.toUpperCase(),dataset:{},style:{setProperty(){}},complete:true,naturalWidth:720,naturalHeight:1280,
    setAttribute(){},remove(){nodes.delete(this);},addEventListener(){},removeEventListener(){},getContext:()=>({clearRect(){},drawImage:(video,...rect)=>{painted.push(video.id);rectangles.push(rect);}})})};
  const renders=[];class SharedCompositor{constructor(canvas){this.canvas=canvas;}render(scene,actor,assets,cards){renders.push({scene,frame:actor.src,roles:[...assets.keys()],cards});}dispose(){}}
  const composition=createLayerComposition(document,descriptor,{loadRuntime:async()=>({Compositor:SharedCompositor})});
  for(const id of ['exact-nora-1','exact-nora-2']){
    assert.equal(await composition.prepareClip(key),true);
    assert.equal(composition.renderFrame({id,videoWidth:1080,videoHeight:1920}),true);composition.hold();
  }
  composition.renderFrame({id:'wide-nora',videoWidth:1920,videoHeight:1080});
  assert.deepEqual(rectangles,[[656.25,0,607.5,1080],[656.25,0,607.5,1080],[0,0,1920,1080]]);
  assert.equal(renders.every(row=>row.scene.dealerAspect===16/9),true);
  assert.deepEqual(painted,['exact-nora-1','exact-nora-2','wide-nora']);assert.equal(host.dataset.presentationClipMode,'green-screen');
  assert.equal(renders.every(row=>row.scene.show.cards===false&&row.cards.length===0),true);
  assert.equal(await composition.prepareClip(undefined),true);assert.equal(host.dataset.presentationClipMode,'green-screen');
  assert.equal(composition.renderFrame({id:'legacy-astrid',videoWidth:1080,videoHeight:1920}),true);
  assert.equal(clipCompositing({mode:'opaque'}).enabled,true);assert.throws(()=>clipCompositing({...key,threshold:Infinity}));
  composition.close();
  let complete;const waiting=createLayerComposition(document,descriptor,{loadRuntime:()=>new Promise(resolve=>{complete=resolve;})});
  const stale=waiting.prepareClip(key),latest=waiting.prepareClip(undefined);
  assert.throws(()=>waiting.renderFrame({id:'not-ready'}),/background removal unavailable/);
  complete({Compositor:SharedCompositor});assert.equal(await stale,false);assert.equal(await latest,true);
  assert.equal(waiting.renderFrame({id:'latest-keyed',videoWidth:1080,videoHeight:1920}),true);
  assert.equal(host.dataset.presentationClipMode,'green-screen');waiting.close();
});

test('game plane follows scene resize but stays anchored to the base idle during speech crops',async()=>{
  const {descriptor}=fixture(),host={dataset:{},clientWidth:1920,clientHeight:1080,append(){}};
  const document={documentElement:{dataset:{}},querySelector:()=>host,createElement:tag=>({tagName:tag.toUpperCase(),dataset:{},style:{setProperty(){}},complete:true,naturalWidth:720,naturalHeight:1280,
    setAttribute(){},remove(){},addEventListener(){},removeEventListener(){},getContext:()=>({clearRect(){},drawImage(){}})})};
  class SharedCompositor{constructor(canvas){this.canvas=canvas;}geometry(scene){return stageGeometry(scene);}render(){}dispose(){}}
  const c=createLayerComposition(document,descriptor,{loadRuntime:async()=>({Compositor:SharedCompositor})});
  let changed=0;c.onGeometryChange(()=>changed++);
  const source={videoWidth:1080,videoHeight:1920},base={scale:.75,x:.1,y:0};
  await c.prepareClip(key,base,{kind:'idle'});c.renderFrame(source);const p=c.referencePlane();
  assert.equal(changed,1);c.renderFrame(source);assert.equal(changed,1);
  await c.prepareClip(key,{scale:1.5,x:0,y:.1},{kind:'speech'});c.renderFrame(source);
  assert.deepEqual({...c.referencePlane(),sourceAligned:true},p);assert.equal(c.referencePlane().sourceAligned,false);
  host.clientWidth=390;host.clientHeight=844;c.hold();assert.notEqual(c.referencePlane().scale,p.scale);
  await c.prepareClip(key,base,{kind:'idle'});c.renderFrame(source);assert.equal(c.referencePlane().sourceAligned,true);
  c.close();
});

test('moving mouth stays inside the framed dealer; cancellation restores the held body and preserves card geometry',async()=>{
  const {descriptor}=fixture(),host={dataset:{},clientWidth:1920,clientHeight:1080,append(){}};
  const canvases=[],renders=[];
  const document={documentElement:{dataset:{}},querySelector:()=>host,createElement:tag=>{
    const context={draws:[],clearRect(){},drawImage(...args){this.draws.push(args);}};
    const node={tagName:tag.toUpperCase(),dataset:{},style:{setProperty(){}},complete:true,
      ...(tag==='canvas'?{}:{naturalWidth:720,naturalHeight:1280}),
      setAttribute(){},remove(){},addEventListener(){},removeEventListener(){},getContext:()=>context};
    if(tag==='canvas')canvases.push(node);return node;
  }};
  class SharedCompositor{constructor(canvas){this.canvas=canvas;}geometry(scene){return stageGeometry(scene);}render(scene,actor,assets){renders.push({scene,actor,assets});}dispose(){}}
  const c=createLayerComposition(document,descriptor,{loadRuntime:async()=>({Compositor:SharedCompositor})});
  const body={videoWidth:1080,videoHeight:1920},patched={width:1080,height:1920},presented={exact:'frame'};
  await c.prepareClip(key,{scale:.75,x:.1,y:0},{kind:'idle'});c.renderFrame(body);
  const plane=c.referencePlane(),actor=renders.at(-1).actor;let closed=0;
  const layer={paint(source,evidence){assert.equal(source,body);assert.equal(evidence,presented);return patched;},close(){closed++;}};
  c.setMovingSpeechLayer(layer);c.renderFrame(body,presented);
  assert.equal(actor.getContext().draws.at(-1)[0],patched);
  assert.deepEqual(actor.getContext().draws.at(-1).slice(1),actor.getContext().draws[0].slice(1),'same source framing');
  assert.deepEqual(c.referencePlane(),plane);
  assert.deepEqual([...renders.at(-1).assets.keys()],['background','table'],'no fourth scene plane');
  c.setMovingSpeechLayer(null);assert.equal(closed,1);
  const restored=actor.getContext().draws.at(-1)[0];
  assert.equal(restored.getContext().draws.at(-1)[0],body,'held frame restores original body');
  c.setMovingSpeechLayer(layer);c.replace(descriptor);assert.equal(closed,2);
  c.setMovingSpeechLayer(layer);c.close();assert.equal(closed,3);
});

test('public capability metadata is exact and cannot read data, select media or authorize writes',async()=>{
  let reads=0;const handler=createPresentationApi({store:{load:async()=>{reads++;throw Error('must not read');}},registryLoader:async()=>{reads++;}});
  for(const [method,query,status]of [['GET','',200],['HEAD','',200],['GET','?registeredDealerIds=astrid',400],['POST','',405]]){
    const req={method,url:'/api/presentation/capabilities'+query},res={writeHead(s,h){this.status=s;this.headers=h;},end(body){this.body=body;}};
    assert.equal(await handler(req,res,'/api/presentation/capabilities',null),true);assert.equal(res.status,status);
    assert.equal(res.headers['cache-control'],'no-store');
    if(method==='GET'&&status===200)assert.deepEqual(JSON.parse(res.body),{schemaVersion:2,registeredDealerIds:['nora'],compositing:'per-clip',rooms:'operator-owned-v2'});
    else assert.equal(res.body,method==='HEAD'?undefined:'');
  }
  assert.equal(reads,0);assert.equal(presentationCapabilitiesResponse(new Request('https://local/api/presentation/capabilities/media')),null);
});

test('authenticated config projects only an exactly bound own Nora idle with retained compositing',async()=>{
  const {project}=fixture(),id='00000000-0000-4000-8000-000000000010';
  const line=project.lines.find(row=>row.dealerId==='nora'&&row.eventId==='idle.ready');
  line.variants.find(row=>row.id===line.baselineVariantId).videoGenerationId=id;
  const video={id,dealer:'nora',fileName:'own-nora.mp4',sha256:'a'.repeat(64),available:true,
    classification:{dealerId:'nora',eventId:'idle.ready',kind:'idle',role:'standard',situation:'',label:'Nora idle',notes:'',playback:'once',compositing:key}};
  const inventory={families:[],videos:[video]};
  const handler=createPresentationApi({env:{},store:{load:async()=>project},registryLoader:async()=>inventory});
  const get=async player=>{const res={writeHead(s){this.status=s;},end(body){this.body=JSON.parse(body);}};await handler({method:'GET',url:'/api/presentation/config?dealerId=nora'},res,'/api/presentation/config',player);return res;};
  assert.equal((await get(null)).status,401);
  const response=await get('own-fixture');assert.equal(response.status,200);
  assert.deepEqual(response.body.dealerIdle.nora,{id,sha256:video.sha256,fileName:video.fileName,src:'/api/presentation/videos/'+id,compositing:key});
  video.dealer='astrid';assert.equal((await get('own-fixture')).body.dealerIdle.nora,null);
});

test('runtime selection accepts exactly saved registered dealers and rejects syntax-only identities',async()=>{
  for(const registered of [true,false]){
    let reads=0,selects=0;const handler=createPresentationApi({store:{load:async()=>{reads++;return registered?addDealer(createSeedProject(),'linnea','Linnea'):createSeedProject();}},
      registryLoader:async()=>({videos:[],families:[]}),db:{prepare:()=>({get:async()=>null})},select:async({dealerId})=>{selects++;assert.equal(dealerId,'linnea');return {status:'skipped',reason:'no_exact_media'};}});
    const req={method:'POST',url:'/api/presentation/select',async *[Symbol.asyncIterator](){yield JSON.stringify({dealerId:'linnea',version:1,mode:'off',event:{type:'speak',line:'goodluck'}});}};
    const res={once(){},removeListener(){},writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}};
    await handler(req,res,'/api/presentation/select','own-fixture');assert.equal(res.status,registered?200:400);
    assert.equal(reads,1);assert.equal(selects,registered?1:0);
  }
});

test('published Linnea follows her own room and frozen display label through actual HTML and document choices',async()=>{
  const f=fixture('linnea','Linnea vid publicering');
  const presentation=f.presentation;
  const pack={...f.pack,tables:['room-linnea'],branding:withPackagePresentation({},presentation)};
  const room={schemaVersion:2,id:'room-linnea',name:'Linneas rum',operatorId:'north',presentationLaneId:f.lane.id,gameLaneId:f.lane.id,state:'live'};
  f.administration.rooms=[room];f.project.dealers=f.project.dealers.filter(row=>row.id!=='linnea');
  const select=createGameEntrySelector({policy:{readGameConfiguration(){},readSaved:async()=>({project:f.project,administration:f.administration})},packages:{resolve:async()=>({operator:{id:'north',status:'active'},package:pack})}});
  assert.equal((await select('operator=north&table=room-linnea&dealer=astrid')).status,404);
  const {selection}=await select('operator=north&table=room-linnea');
  assert.equal(selection.dealer,'linnea');assert.equal(selection.roomId,room.id);assert.deepEqual(selection.registeredDealers,[{id:'linnea',label:'Linnea vid publicering'}]);
  assert.deepEqual(selection.choices.dealers,['linnea']);assert.equal(selection.packageRevision,1);
  const html=decorateGameEntryHtml('<html lang="sv"></html>',{CROUPIER_STUDIO_NEON_POLICY:'1'},selection),dataset={};
  for(const [,attribute,value]of html.matchAll(/data-(game-[a-z-]+)="([^"]*)"/g)) dataset[attribute.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=value.replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>');
  const restored=gameLaneFromDocument(dataset);assert.equal(restored.dealer,'linnea');assert.equal(restored.roomId,room.id);
  assert.equal(restored.registeredDealers[0].label,'Linnea vid publicering');assert.deepEqual(restored.choices.dealers,['linnea']);
  for(const change of [()=>dataset.gameRegisteredDealers='[]',()=>dataset.gameLocalDealer='nora']){const before={...dataset};change();assert.throws(()=>gameLaneFromDocument(dataset));Object.assign(dataset,before);}
  f.administration.gameLanes[0].dealer='nora';f.administration.gameLanes[0].mediaCollection='nora-presentation';
  await assert.rejects(select('operator=north&table=room-linnea'),error=>error.statusCode===503||error.statusCode===404);
});

test('presentation API forwards the opt-in capability header and preserves default v2 without reading Studio',async()=>{
  const handler=createPresentationApi({store:{load:async()=>{throw Error('must not read');}},registryLoader:async()=>{throw Error('must not read');}});
  for(const [headers,version]of [[{},2],[{'x-presentation-capability-version':'3'},3]]){
    const res={writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=JSON.parse(body);}};
    await handler({method:'GET',url:'/api/presentation/capabilities',headers},res,'/api/presentation/capabilities',null);
    assert.equal(res.status,200);assert.equal(res.body.schemaVersion,version);assert.equal(res.headers.vary,'X-Presentation-Capability-Version');
  }
});

test('historical v2 room entry rejects a drifted portrait adapter even when both dealers remain frozen and allowed',async()=>{
  const f=fixture('linnea','Linnea');f.project=addDealer(f.project,'nora','Nora');f.lane=f.project.lanes[0];
  f.lane.dealers=['linnea','nora'];f.lane.layers.dealer.allowed=['linnea','nora'];
  const presentation=cloudPresentationFixture({project:f.project,lanes:[f.lane]}).presentation;presentation.schemaVersion=2;delete presentation.playback;
  const pack={...f.pack,tables:['room-overlap'],branding:withPackagePresentation({},presentation)};
  f.administration.rooms=[{schemaVersion:2,id:'room-overlap',name:'Overlap',operatorId:'north',presentationLaneId:f.lane.id,gameLaneId:f.lane.id,state:'live'}];
  const select=createGameEntrySelector({policy:{readGameConfiguration(){},readSaved:async()=>({project:f.project,administration:f.administration})},packages:{resolve:async()=>({operator:{id:'north',status:'active'},package:pack})}});
  assert.equal((await select('operator=north&table=room-overlap')).selection.dealer,'linnea');
  f.administration.gameLanes[0].dealer='nora';f.administration.gameLanes[0].mediaCollection='nora-presentation';
  await assert.rejects(select('operator=north&table=room-overlap&dealer=nora'),error=>error.statusCode===503&&error.message==='presentation_dealer_mismatch');
});
