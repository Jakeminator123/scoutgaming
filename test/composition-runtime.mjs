import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPresentationApi} from '../web/presentation-api.mjs';
import {presentationCapabilitiesResponse} from '../web/presentation-capabilities.mjs';
import {defaultCompositionSettings,validateCompositionSettings,sceneForComposition} from '../web/public/composition-settings.mjs';
import {validateComposition,createLayerComposition,clipCompositing} from '../web/public/presentation-composition.mjs';
import {compositionRuntimeResponse} from '../web/composition-runtime.mjs';
import {stageGeometry,tableRect} from '../test-videoeditor/program/web/geometry.js';
import {Compositor} from '../test-videoeditor/program/web/compositor.js';
import {createSeedProject,addDealer,defaultPresentationLane} from '../lab/lib/studio-model.mjs';
import {buildPresentationPackage,layerAssetPath} from '../web/presentation-layers.mjs';
import {withPackagePresentation,readPackagePresentation} from '../web/storage/presentation-package.mjs';
import {createGameEntrySelector} from '../web/game-entry-operator.mjs';
import {decorateGameEntryHtml} from '../web/public/game-entry-contract.mjs';
import {gameLaneFromDocument,validateGameLanes} from '../web/public/game-lanes.mjs';
const key={mode:'green-screen',threshold:.23,softness:.15,despill:0};
function asset(role,n){const value={schemaVersion:1,id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,role,label:role,sha256:'a'.repeat(64),size:128,contentType:'image/png',width:720,height:1280};return {...value,pathname:layerAssetPath(value)};}
function fixture(){
  const project=addDealer(createSeedProject(),'nora','Nora'),lane=defaultPresentationLane(),background=asset('background',1),table=asset('table',2);
  lane.id='nora-lane';lane.dealers=['nora'];lane.layers.dealer={enabled:true,default:'nora',allowed:['nora']};
  lane.layers.background={enabled:true,mode:'image',default:background.id,allowed:[background.id]};
  lane.layers.table={enabled:true,default:table.id,allowed:[table.id]};lane.composition=defaultCompositionSettings();
  project.lanes=[lane];project.layerAssets=[background,table];
  const serverLane={schemaVersion:1,id:lane.id,label:'Nora',renderer:'portrait-video',dealer:'nora',mediaCollection:'nora-presentation'};
  const administration={gameLane:lane.id,gameLanes:[serverLane]};
  const presentation=buildPresentationPackage(project,[lane.id],project.layerAssets);
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
test('compositor uses the same actor frame with explicit table order and never paints game cards',()=>{
  for(const tableFront of [false,true]){const calls=[],settings=defaultCompositionSettings();settings.tableFront=tableFront;
    const scene=sceneForComposition(settings,'mobile',{background:false},{enabled:true});
    const actor={},table={el:{table:true},width:720,height:1280};
    const compositor={ready:true,gl:{COLOR_BUFFER_BIT:1,viewport(){},clearColor(){},clear(){}},canvas:{},geometry:stageGeometry,draw:source=>calls.push(source===actor?'actor':'table'),paintCards(){calls.push('project-cards');}};
    Compositor.prototype.render.call(compositor,scene,actor,new Map([['table',table]]),[],null);
    assert.deepEqual(calls,tableFront?['actor','table','project-cards']:['table','project-cards','actor']);}
});
test('published Nora requires a saved named registry and ignores query requests for another dealer',async()=>{
  const {project,administration,pack,presentation}=fixture();
  const policy={readGameConfiguration(){},readSaved:async()=>({project,administration})};
  const select=createGameEntrySelector({policy,packages:{resolve:async()=>({operator:{id:'north'},package:pack})}});
  const {selection}=await select('operator=north&lane=nora-lane&dealer=astrid');
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
  assert.equal(gameLaneFromDocument({gameLane:'nora-lane',gameDealer:'nora',gamePresentation:'local',gameLocalDealer:'nora'}).dealer,'nora');
  assert.throws(()=>gameLaneFromDocument({gameLane:'nora-lane',gameDealer:'nora',gamePresentation:'local'}));
  project.dealers=project.dealers.filter(row=>row.id!=='nora');
  await assert.rejects(select('operator=north'),error=>error.statusCode===503);
  assert.throws(()=>buildPresentationPackage(project,['nora-lane'],project.layerAssets));
  assert.throws(()=>validateGameLanes([{...administration.gameLanes[0],dealer:'unregistered',mediaCollection:'unregistered-presentation'}]));
});
test('runtime serves only the two shared code files and refuses data, queries and writes',async()=>{
  const response=await compositionRuntimeResponse(new Request('https://local/composition-runtime/compositor.js'));
  assert.equal(response.status,200);assert.equal(await response.text(),await readFile(new URL('../test-videoeditor/program/web/compositor.js',import.meta.url),'utf8'));
  assert.equal(await compositionRuntimeResponse(new Request('https://local/composition-runtime/catalog.json')),null);
  assert.equal(await compositionRuntimeResponse(new Request('https://local/composition-runtime/../../.env')),null);
  assert.equal((await compositionRuntimeResponse(new Request('https://local/composition-runtime/geometry.js?file=.env'))).status,400);
  assert.equal((await compositionRuntimeResponse(new Request('https://local/composition-runtime/geometry.js',{method:'POST'}))).status,405);
});
test('two exact dealer plays reuse the shared compositor; absent classification always restores opaque pixels',async()=>{
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
  assert.deepEqual(rectangles,[[0,0,1080,1920],[0,0,1080,1920],[0,656.25,1080,607.5]]);
  assert.deepEqual(painted,['exact-nora-1','exact-nora-2','wide-nora']);assert.equal(host.dataset.presentationClipMode,'green-screen');
  assert.equal(renders.every(row=>row.scene.show.cards===false&&row.cards.length===0),true);
  assert.equal(await composition.prepareClip(undefined),false);assert.equal(host.dataset.presentationClipMode,'green-screen');
  assert.equal(composition.renderFrame({id:'opaque-astrid'}),false);assert.equal(host.dataset.presentationClipMode,'opaque');
  assert.equal(clipCompositing({mode:'opaque'}),null);assert.throws(()=>clipCompositing({...key,threshold:Infinity}));
  composition.close();
  let complete;const waiting=createLayerComposition(document,descriptor,{loadRuntime:()=>new Promise(resolve=>{complete=resolve;})});
  const stale=waiting.prepareClip(key);assert.equal(await waiting.prepareClip(undefined),false);
  complete({Compositor:SharedCompositor});assert.equal(await stale,false);
  assert.equal(waiting.renderFrame({id:'stale-keyed',videoWidth:1080,videoHeight:1920}),false);
  assert.equal(host.dataset.presentationClipMode,'opaque');waiting.close();
});

test('public capability metadata is exact and cannot read data, select media or authorize writes',async()=>{
  let reads=0;const handler=createPresentationApi({store:{load:async()=>{reads++;throw Error('must not read');}},registryLoader:async()=>{reads++;}});
  for(const [method,query,status]of [['GET','',200],['HEAD','',200],['GET','?registeredDealerIds=astrid',400],['POST','',405]]){
    const req={method,url:'/api/presentation/capabilities'+query},res={writeHead(s,h){this.status=s;this.headers=h;},end(body){this.body=body;}};
    assert.equal(await handler(req,res,'/api/presentation/capabilities',null),true);assert.equal(res.status,status);
    assert.equal(res.headers['cache-control'],'no-store');
    if(method==='GET'&&status===200)assert.deepEqual(JSON.parse(res.body),{schemaVersion:1,registeredDealerIds:['nora'],compositing:'per-clip'});
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
  const get=async player=>{const res={writeHead(s){this.status=s;},end(body){this.body=JSON.parse(body);}};await handler({method:'GET',url:'/api/presentation/config'},res,'/api/presentation/config',player);return res;};
  assert.equal((await get(null)).status,401);
  const response=await get('own-fixture');assert.equal(response.status,200);
  assert.deepEqual(response.body.dealerIdle.nora,{id,sha256:video.sha256,fileName:video.fileName,src:'/api/presentation/videos/'+id,compositing:key});
  video.dealer='astrid';assert.equal((await get('own-fixture')).body.dealerIdle.nora,null);
});

test('other prepared registered identities cannot dispatch the runtime selector',async()=>{
  let reads=0,selects=0;const handler=createPresentationApi({store:{load:async()=>{reads++;return addDealer(createSeedProject(),'future','Future');}},
    registryLoader:async()=>({videos:[],families:[]}),select:async()=>{selects++;throw Error('must not dispatch');}});
  const req={method:'POST',url:'/api/presentation/select',async *[Symbol.asyncIterator](){yield JSON.stringify({dealerId:'future',version:1,mode:'off',event:{type:'speak',line:'goodluck'}});}};
  const res={writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}};
  await handler(req,res,'/api/presentation/select','own-fixture');assert.equal(res.status,400);
  assert.equal(reads,0);assert.equal(selects,0);
});
