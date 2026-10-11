import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {createSeedProject,addDealer,defaultPresentationLane} from '../lib/studio-model.mjs';
import {layerAssetPath} from '../../web/presentation-layers.mjs';
import {defaultCompositionSettings} from '../../web/public/composition-settings.mjs';
import {createStudioPreview} from '../lib/studio-preview-client.mjs';
import {compositionPreviewLayers} from '../lib/studio-composition.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

function loadTs(fileUrl,overrides={}) {
  const source = readFileSync(fileUrl, 'utf8');
  const output = transformSync(source, { filename: fileURLToPath(fileUrl), jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  const localRequire = createRequire(fileUrl);
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams, Request, Headers, AbortController, Error,
    window: new Proxy({}, { get: (_target, key) => globalThis.window?.[key] }),
    require: name => {
      if(Object.hasOwn(overrides,name))return overrides[name];
      if (name.endsWith('.module.css') || name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name.startsWith('./') || name.startsWith('../')) {
        for (const suffix of ['', '.tsx', '.ts', '.mjs', '.js']) {
          const candidate = new URL(name + suffix, fileUrl);
          const path = fileURLToPath(candidate);
          if (!existsSync(path)) continue;
          if (path.endsWith('.mjs') || path.endsWith('.js') || path.endsWith('.json')) return localRequire(path);
          return loadTs(pathToFileURL(path),overrides);
        }
      }
      return localRequire(name);
    },
  }, { filename: fileURLToPath(fileUrl) });
  return module.exports;
}

test('Sammansättning edits three saved lane choices and keeps the separated dealer trial available', () => {
  const pageSource = readFileSync(new URL('../app/control/preview/page.tsx', import.meta.url), 'utf8');
  assert.match(pageSource, /title: 'Sammansättning · Croupier Studio'/);
  assert.match(pageSource, /studioUiInitialData\(/);
  const { ControlPreviewPage } = loadTs(new URL('../components/control-preview-page.tsx', import.meta.url));
  const html = renderToStaticMarkup(React.createElement(ControlPreviewPage,{
    initialProject:createSeedProject(),initialVideos:{videos:[]},initialStatus:{configured:false},
  }));
  assert.match(html, /\/\/ STUDIO/);
  assert.match(html, /<h1>Sammansättning<\/h1>/);
  assert.match(html, /Förhandsvisa klipp/);
  assert.match(html, /aria-label="Tre lager"/);
  assert.match(html, /<legend>Bord<\/legend>/);
  assert.match(html, /<legend>Bakgrund<\/legend>/);
  assert.match(html, /Fullbildsklippet behåller sin bild/);
  assert.match(html, /Frilagda dealerpaket · Paow och Dragge/);
  assert.match(html, /<button[^>]*disabled[^>]*>Spara<\/button>/);
  assert.match(html, /<iframe[^>]*title="Förhandsvisning · lagerprov"[^>]*src="[^"]*\/preview\/index\.html"/);
});

test('shared preview data authorization rejects unauthenticated and partner access before reading any Studio data',async()=>{
  let role='partner',unauthenticated=false,reads=0;
  const config={apiBase:'/studio/api/admin',publicOrigin:'https://studio.example.invalid'};
  const native={authorize:async()=>{if(unauthenticated)throw Object.assign(Error('unauthenticated'),{statusCode:401});return {role};},
    gamePolicy:{readSaved:async()=>{reads++;return {project:createSeedProject()};}},
    videoRegistry:async()=>{reads++;return {videos:[]};}};
  const shared=loadTs(new URL('../lib/ui-server.ts',import.meta.url),{
    'next/navigation':{redirect:url=>{throw Object.assign(Error('redirect'),{redirect:url});}},
    './http-guard.mjs':{assertLocalPageRequest:()=>{throw Error('native must not reach the local fallback');}},
    './studio-server.mjs':{studioInitialData:()=>{throw Error('native must not read the legacy store');}},
    './remote-ui.mjs':{remoteUiConfiguration:()=>null},
    './studio-native-runtime.mjs':{nativeStudioAdminEnabled:()=>true,nativeStudioAdminConfiguration:()=>config,assertNativeStudioRequest:()=>{},studioNativeRuntime:async()=>native},
    './studio-native-request.mjs':{normalizeNativeStudioPageRequest:request=>request},
  });
  const request=new Request('https://studio.example.invalid/control/preview');
  await assert.rejects(shared.studioUiInitialData(request),error=>error.statusCode===403);
  assert.equal(reads,0);
  unauthenticated=true;
  await assert.rejects(shared.studioUiInitialData(request),error=>{
    if(typeof error.redirect!=='string')return false;
    const target=new URL(error.redirect,'https://studio.example.invalid');
    return target.pathname==='/login'&&target.searchParams.get('returnTo')==='/control/preview';
  });
  assert.equal(reads,0);
  role='admin';unauthenticated=false;
  const data=await shared.studioUiInitialData(request);
  assert.equal(reads,2);assert.equal(data.status.provider,'neon');assert.equal(data.project.dealers.length,4);
});

test('registered Nora gets her own clip preview and intake link without borrowing Astrid media',()=>{
  const {ControlPreviewPage}=loadTs(new URL('../components/control-preview-page.tsx',import.meta.url));
  const project=addDealer(createSeedProject(),'nora','Nora');
  const lane=defaultPresentationLane();lane.dealers.push('nora');lane.layers.dealer.allowed.push('nora');lane.layers.dealer.default='nora';
  project.lanes=[lane];
  const original=structuredClone(project);
  const videos=[
    {id:'nora-test',label:'Nora greenscreenprov',available:true,dealer:'nora',previewUrl:'/api/videos/nora-test',classification:{dealerId:'nora',eventId:'speak.goodluck',compositing:{mode:'green-screen',threshold:.23,softness:.15,despill:0}}},
    {id:'astrid-other',label:'ASTRID_SPEECH_SHOULD_NOT_BORROW',available:true,dealer:'astrid',previewUrl:'/api/videos/astrid-other'},
    {id:'nora-missing',label:'UNAVAILABLE_NORA_TAKE',available:false,dealer:'nora',previewUrl:'/api/videos/nora-missing'},
  ];
  const html=renderToStaticMarkup(React.createElement(ControlPreviewPage,{initialProject:project,initialVideos:{videos},initialStatus:{provider:'neon'}}));
  assert.match(html,/<option value="nora" selected="">Nora<\/option>/);
  assert.match(html,/Nora greenscreenprov/);
  assert.doesNotMatch(html,/ASTRID_SPEECH_SHOULD_NOT_BORROW|UNAVAILABLE_NORA_TAKE/);
  assert.match(html,/\/control\/videos\?dealer=nora&amp;event=speak.goodluck/);
  assert.match(html,/Tröskel 0.23 · Mjukhet 0.15/);
  assert.deepEqual(project,original);
});


test('a requested second lane keeps its dealer and its lane id when continuing to publication',()=>{
  const {ControlPreviewPage}=loadTs(new URL('../components/control-preview-page.tsx',import.meta.url));
  const project=addDealer(createSeedProject(),'nora','Nora');
  const nora=defaultPresentationLane();nora.id='nora-evening';nora.label='Nora kväll';nora.dealers=['nora'];nora.layers.dealer={enabled:true,default:'nora',allowed:['nora']};
  project.lanes.push(nora);
  const render=initialLaneId=>renderToStaticMarkup(React.createElement(ControlPreviewPage,{initialProject:project,initialVideos:{videos:[]},initialStatus:{configured:false},initialLaneId}));
  const html=render(nora.id);
  assert.match(html,/<option value="nora-evening" selected="">Nora kväll<\/option>/);
  assert.match(html,/<option value="nora" selected="">Nora<\/option>/);
  assert.match(html,/href="[^"]*\/control\/lanes\?lane=nora-evening"/);
  assert.doesNotMatch(html,/control\/zones|Bakgrundszoner/);
  assert.match(render('unknown-lane'),/href="[^"]*\/control\/lanes\?lane=mobile-phone"/);
});

test('unsaved composition invokes guarded save before the next-step navigation',async()=>{
  const project=createSeedProject();let saves=0;
  const {ControlPreviewPage}=loadTs(new URL('../components/control-preview-page.tsx',import.meta.url),{
    react:{useState:value=>[typeof value==='function'?value():value,()=>{}],useRef:value=>({current:value}),useEffect:()=>{}},
    './studio-session':{useStudioSession:()=>({project,projectRef:{current:project},videos:{videos:[]},dirty:true,saving:false,conflict:false,save:async()=>{saves++;return false;}})},
  });
  const tree=ControlPreviewPage({initialProject:project,initialVideos:{videos:[]},initialStatus:{configured:false}});
  function find(node){if(!node||typeof node!=='object')return null;if(node.type==='a'&&node.props.href?.includes('/control/lanes?lane='))return node;for(const child of [node.props?.children,node.props?.primary].flat(Infinity)){const match=find(child);if(match)return match;}return null;}
  const next=find(tree);assert.ok(next);assert.equal(next.props['aria-disabled'],false);assert.equal(next.props.children,'Spara och fortsätt');
  let prevented=false;next.props.onClick({preventDefault(){prevented=true;}});await Promise.resolve();assert.equal(prevented,true);assert.equal(saves,1);
});

function previewHarness({dirty=true,conflict=false,saveResult=true,project:initialProject,inventory={videos:[]},previewClient=createStudioPreview}={}) {
  const project=initialProject??createSeedProject(),state=[],refs=[],effects=[],savedProjects=[];let stateIndex=0,refIndex=0,saves=0;
  const session={project,projectRef:{current:project},videos:inventory,setVideos:value=>{session.videos=value;},savedJson:JSON.stringify(project),dirty,saving:false,conflict,
    save:async()=>{saves++;savedProjects.push(structuredClone(session.projectRef.current));if(saveResult)session.dirty=false;return saveResult;},
    modelEdit:edit=>{const next=structuredClone(edit(session.projectRef.current));session.project=next;session.projectRef.current=next;session.dirty=JSON.stringify(next)!==session.savedJson;},
    setSavedJson:value=>{session.savedJson=value;},setProject:value=>{session.project=value;},setConflict:value=>{session.conflict=value;},setError:value=>{session.error=value;},setNotice:value=>{session.notice=value;}};
  const hooks={useState:initial=>{const index=stateIndex++;if(!Object.hasOwn(state,index))state[index]=typeof initial==='function'?initial():initial;return [state[index],value=>{state[index]=typeof value==='function'?value(state[index]):value;}];},
    useRef:initial=>{const index=refIndex++;return refs[index]??=({current:initial});},useEffect:callback=>effects.push(callback)};
  // The SWC fixture runs UI callbacks in a VM, while model validators run in
  // the parent realm. Clone at this test boundary to match one browser realm.
  const model=require('../lib/studio-model.mjs');
  const {ControlPreviewPage}=loadTs(new URL('../components/control-preview-page.tsx',import.meta.url),{
    react:hooks,'./studio-session':{useStudioSession:()=>session},
    '../lib/studio-preview-client.mjs':{createStudioPreview:previewClient},
    '../lib/studio-model.mjs':{...model,validateProject:value=>model.validateProject(structuredClone(value))},
  });
  function render(){stateIndex=0;refIndex=0;effects.length=0;return ControlPreviewPage({initialProject:project,initialVideos:inventory,initialStatus:{provider:'neon'}});}
  function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children,node.props?.primary].flat(Infinity)){const found=find(child,predicate);if(found)return found;}return null;}
  return {session,render,find,effects,savedProjects,saves:()=>saves};
}

test('save and continue navigates only after a clean rendered save, and repeated clicks share one request',async()=>{
  const harness=previewHarness(),navigations=[];
  globalThis.window={location:{assign:href=>navigations.push(href)}};
  try {
    const tree=harness.render(),next=harness.find(tree,node=>node.type==='a'&&node.props.href?.includes('/control/lanes?lane='));
    const event={preventDefault(){}};next.props.onClick(event);next.props.onClick(event);
    assert.equal(harness.saves(),1);assert.deepEqual(navigations,[]);
    await new Promise(setImmediate);harness.render();harness.effects[1]();
    assert.deepEqual(navigations,['/control/lanes?lane=mobile-phone']);
  }finally{delete globalThis.window;}
});

test('failed save, revision conflict and active upload all preserve the draft and prevent continuation',async()=>{
  const navigations=[];globalThis.window={location:{assign:href=>navigations.push(href)}};
  try {
    for(const option of [{saveResult:false},{conflict:true},{upload:true}]) {
      const harness=previewHarness(option),tree=harness.render();
      if(option.upload)harness.find(tree,node=>node.type?.name==='LayerLibrary').props.onBusyChange(true);
      harness.find(tree,node=>node.type==='a'&&node.props.href?.includes('/control/lanes?lane=')).props.onClick({preventDefault(){}});
      await new Promise(setImmediate);harness.render();harness.effects[1]();
      assert.equal(harness.session.dirty,true);assert.equal(harness.saves(),option.saveResult===false?1:0);
    }
    assert.deepEqual(navigations,[]);
  }finally{delete globalThis.window;}
});

test('registered upload uses the latest draft and keeps its lane choice unsaved until explicit save',()=>{
  const harness=previewHarness(),tree=harness.render(),baseline=JSON.parse(harness.session.savedJson),remote=structuredClone(baseline);
  const row={schemaVersion:1,id:'11111111-2222-4333-8444-555555555555',role:'table',label:'Nytt bord',sha256:'a'.repeat(64),size:24,contentType:'image/png',width:640,height:360};
  row.pathname=layerAssetPath(row);remote.layerAssets=[row];remote.revision='registered-upload';
  const latest=structuredClone(harness.session.project);latest.lanes[0].label='Ändrat under uppladdningen';harness.session.projectRef.current=latest;
  harness.find(tree,node=>node.type?.name==='LayerLibrary'&&node.props.role==='table').props.onRegistered(remote,row.id);
  assert.equal(harness.session.project.lanes[0].label,'Ändrat under uppladdningen');
  assert.equal(harness.session.project.lanes[0].layers.table.default,row.id);assert.equal(harness.session.project.revision,remote.revision);
  assert.equal(harness.session.savedJson,JSON.stringify(remote));assert.notEqual(JSON.stringify(harness.session.project),harness.session.savedJson);
});

test('composition links own dealer upload and sequencing to Dealers and clips without mounting upload editors', async () => {
  const project=addDealer(createSeedProject(),'nora','Nora');project.lanes[0].dealers.push('nora');project.lanes[0].layers.dealer.allowed.push('nora');project.lanes[0].layers.dealer.default='nora';
  const harness=previewHarness({project}),tree=harness.render(),original=structuredClone(project),navigations=[];
  assert.equal(harness.find(tree,node=>['VideoUpload','FamilyVideoUpload'].includes(node.type?.name)),null);
  const link=harness.find(tree,node=>node.type==='a'&&node.props.href==='/control/clips?dealer=nora');
  assert.ok(link);globalThis.window={location:{assign:href=>navigations.push(href)}};
  try {
    link.props.onClick({preventDefault(){}});await new Promise(setImmediate);harness.render();harness.effects[1]();
    assert.equal(harness.saves(),1);assert.deepEqual(navigations,['/control/clips?dealer=nora']);
    assert.deepEqual(harness.session.project,original);
  } finally {delete globalThis.window;}
});

test('composition initially previews the selected dealer exact idle baseline and uses display names without writing any binding',()=>{
  const {ControlPreviewPage}=loadTs(new URL('../components/control-preview-page.tsx',import.meta.url),{
    './composition-preview':{CompositionPreview:props=>React.createElement('div',{'data-preview-url':props.dealer?.url,'data-preview-name':props.dealer?.label})},
  });
  const manifest=JSON.parse(readFileSync(new URL('../../media/dealers/astrid/runtime/presentation/lab-video-manifest.json',import.meta.url),'utf8'));
  const project=createSeedProject();
  const lane=defaultPresentationLane();lane.layers.dealer.default='astrid';project.lanes=[lane];
  const idleFamily=manifest.families.find(row=>row.playbackType==='idle-pool');
  const idleId=project.idlePolicy.base.find(row=>idleFamily.standardIds.includes(row.videoId))?.videoId??idleFamily.standardIds[0];
  const videos=manifest.items.map(item=>({...item,dealer:'astrid',available:true,previewUrl:'/api/videos/'+item.id,label:'RAW_LABEL_'+item.situation}));
  project.clipLabels={[idleId]:'Min lugna blick'};
  const before=structuredClone(project);
  const html=renderToStaticMarkup(React.createElement(ControlPreviewPage,{initialProject:project,initialVideos:{videos,families:manifest.families},initialStatus:{provider:'neon'}}));
  assert.match(html,new RegExp('<option value="'+idleId+'" selected="">Min lugna blick</option>'));
  assert.match(html,new RegExp('data-preview-url="/api/videos/'+idleId+'"'));
  assert.match(html,/Ge kort · Spelarplats 5/);assert.doesNotMatch(html,/RAW_LABEL_box4/);
  assert.deepEqual(project,before);
});

test('composition idle preview stays within the chosen dealer and respects an explicit later clip selection',()=>{
  const project=addDealer(createSeedProject(),'nora','Nora'),lane=defaultPresentationLane();
  lane.layers.dealer.default='nora';lane.dealers.push('nora');lane.layers.dealer.allowed.push('nora');project.lanes=[lane];
  const videos=[
    {id:'nora-card',dealer:'nora',available:true,previewUrl:'/nora/card',label:'Nora kort',classification:{dealerId:'nora',eventId:'deal.dealer',role:'standard',situation:'dealer-hole'}},
    {id:'astrid-idle',dealer:'astrid',available:true,previewUrl:'/astrid/idle',label:'FOREIGN_IDLE',classification:{dealerId:'astrid',eventId:'idle.ready',role:'standard'}},
    {id:'nora-idle',dealer:'nora',available:true,previewUrl:'/nora/idle',label:'Nora väntar',classification:{dealerId:'nora',eventId:'idle.ready',role:'standard'}},
  ];
  const {ControlPreviewPage}=loadTs(new URL('../components/control-preview-page.tsx',import.meta.url),{
    './composition-preview':{CompositionPreview:props=>React.createElement('div',{'data-preview-url':props.dealer?.url})},
  });
  const html=renderToStaticMarkup(React.createElement(ControlPreviewPage,{initialProject:project,initialVideos:{videos},initialStatus:{provider:'neon'}}));
  assert.match(html,/<option value="nora-idle" selected="">Nora väntar<\/option>/);
  assert.match(html,/data-preview-url="\/nora\/idle"/);assert.doesNotMatch(html,/FOREIGN_IDLE/);
  const harness=previewHarness({project,inventory:{videos},dirty:false}),tree=harness.render(),before=structuredClone(project);
  harness.find(tree,node=>node.type==='select'&&node.props.value==='nora-idle').props.onChange({target:{value:'nora-card'}});
  const selected=harness.find(harness.render(),node=>node.type?.name==='CompositionPreview');
  assert.equal(selected.props.dealer.url,'/nora/card');assert.deepEqual(project,before);
});


test('opaque clips keep all primary layer selectors discoverable while the preview retains full-frame protection',()=>{
  const inventory={videos:[{id:'opaque-astrid',dealer:'astrid',available:true,previewUrl:'/opaque-astrid',label:'Astrid original'}]};
  const harness=previewHarness({inventory,dirty:false}),tree=harness.render();
  const controls=harness.find(tree,node=>node.type==='section'&&node.props['aria-label']==='Tre lager');
  const advanced=harness.find(tree,node=>node.type==='details'&&node.props.className==='advanced');
  assert.ok(controls);
  for(const role of ['table','background']){
    assert.ok(harness.find(controls,node=>node.type?.name==='LayerAssetSelect'&&node.props.role===role));
    assert.equal(harness.find(advanced,node=>node.type?.name==='LayerAssetSelect'&&node.props.role===role),null);
  }
  const dealerPanel=harness.find(controls,node=>node.type==='section'&&harness.find(node,child=>child.type==='select'&&child.props.value==='astrid'));
  assert.ok(harness.find(dealerPanel,node=>node.type==='select'&&node.props.value==='opaque-astrid'));
  const placement=harness.find(dealerPanel,node=>node.type==='fieldset'&&node.props.className==='placementControls');
  assert.ok(placement);
  assert.ok(harness.find(placement,node=>node.type==='input'&&node.props['aria-label']==='Dealer storlek'));
  assert.equal(harness.find(placement,node=>node.type==='input'&&node.props['aria-label']==='Bord bredd'),null);
  const preview=harness.find(tree,node=>node.type?.name==='CompositionPreview');
  assert.deepEqual(compositionPreviewLayers(preview.props.show,preview.props.compositing,Boolean(preview.props.dealer)),{dealer:true,background:false,table:false});
  assert.equal(harness.session.dirty,false);
});

test('dealer choice is saved as the presentation default and allowed dealer, while a later preview clip leaves that binding intact',async()=>{
  const project=addDealer(createSeedProject(),'johanna','Johanna'),other=structuredClone(project.lanes[0]);other.id='vip';other.label='VIP';project.lanes.push(other);
  const inventory={videos:[
    {id:'johanna-idle',dealer:'johanna',available:true,previewUrl:'/johanna/idle',label:'Johanna grundloop',classification:{dealerId:'johanna',eventId:'idle.ready',role:'standard',compositing:{mode:'green-screen',threshold:.23,softness:.15,despill:0}}},
    {id:'johanna-card',dealer:'johanna',available:true,previewUrl:'/johanna/card',label:'Johanna kort',classification:{dealerId:'johanna',eventId:'deal.dealer',role:'standard'}},
  ]};
  const harness=previewHarness({project,inventory,dirty:false}),original=structuredClone(project);
  let tree=harness.render();
  harness.find(tree,node=>node.type==='select'&&node.props.value==='astrid').props.onChange({target:{value:'johanna'}});
  tree=harness.render();
  const selected=harness.session.project.lanes[0];
  assert.equal(selected.layers.dealer.default,'johanna');assert.ok(selected.dealers.includes('johanna'));assert.ok(selected.layers.dealer.allowed.includes('johanna'));
  assert.deepEqual(harness.session.project.lanes[1],original.lanes[1]);assert.deepEqual(project,original);assert.equal(harness.session.dirty,true);
  const content=harness.find(tree,node=>node.type==='a'&&node.props.href?.includes('/control/clips?dealer=johanna'));
  assert.equal(content.props.children,'Dealerklipp, grundloop och händelser \u2192');
  const beforePreview=structuredClone(harness.session.project);
  harness.find(tree,node=>node.type==='select'&&node.props.value==='johanna-idle').props.onChange({target:{value:'johanna-card'}});
  tree=harness.render();
  assert.equal(harness.find(tree,node=>node.type?.name==='CompositionPreview').props.dealer.url,'/johanna/card');
  assert.deepEqual(harness.session.project,beforePreview);
  const save=harness.find(tree,node=>node.type==='button'&&node.props.children==='Spara');
  assert.equal(save.props.disabled,false);save.props.onClick();await Promise.resolve();
  assert.equal(harness.savedProjects.length,1);
  assert.equal(harness.savedProjects[0].lanes[0].layers.dealer.default,'johanna');
  assert.ok(harness.savedProjects[0].lanes[0].layers.dealer.allowed.includes('johanna'));
  assert.deepEqual(harness.savedProjects[0].lanes[1],original.lanes[1]);
});

test('per-layer placement controls edit and reset only the selected format while preserving the exact clip and other presentation draft',()=>{
  const project=createSeedProject();project.lanes[0].composition=defaultCompositionSettings();project.lanes[0].label='Mitt utkast';
  project.lanes[0].composition.mobile.dealer.scale=.75;project.lanes[0].composition.desktop.dealer.scale=1.5;project.lanes[0].composition.mobile.table.x=.19;project.lanes[0].composition.mobile.background.y=-.12;
  const inventory={videos:[{id:'astrid-green',dealer:'astrid',available:true,previewUrl:'/astrid-green',label:'Astrid greenscreen',classification:{dealerId:'astrid',eventId:'idle.ready',role:'standard',compositing:{mode:'green-screen',threshold:.23,softness:.15,despill:0}}}]};
  const harness=previewHarness({project,inventory,dirty:false}),original=structuredClone(project);
  let tree=harness.render();
  const range=(node,name)=>harness.find(node,child=>child.type==='input'&&child.props['aria-label']===name);
  assert.equal(range(tree,'Dealer storlek').props.value,.75);
  assert.ok(range(tree,'Bord bredd'));assert.ok(range(tree,'Bakgrund storlek'));
  const format=harness.find(tree,node=>node.type==='div'&&node.props.role==='group'&&node.props['aria-label']==='Format');
  assert.ok(format);
  harness.find(format,node=>node.type==='button'&&node.props.children==='Desktop 16:9').props.onClick();
  tree=harness.render();
  assert.equal(range(tree,'Dealer storlek').props.value,1.5);
  range(tree,'Dealer storlek').props.onChange({target:{value:'1.7'}});
  tree=harness.render();
  range(tree,'Bord sidled').props.onChange({target:{value:'0.25'}});
  tree=harness.render();
  range(tree,'Bakgrund upp/ned').props.onChange({target:{value:'-0.16'}});
  tree=harness.render();
  const desktop=structuredClone(harness.session.project.lanes[0].composition.desktop);
  assert.equal(desktop.dealer.scale,1.7);assert.equal(desktop.table.x,.25);assert.equal(desktop.background.y,-.16);
  assert.deepEqual(harness.session.project.lanes[0].composition.mobile,original.lanes[0].composition.mobile);
  assert.equal(harness.session.project.lanes[0].label,'Mitt utkast');
  harness.find(tree,node=>node.type==='button'&&node.props.children==='Mobil 9:16').props.onClick();
  tree=harness.render();
  assert.equal(range(tree,'Dealer storlek').props.value,.75);
  harness.find(tree,node=>node.type==='button'&&[node.props.children].flat().join('')==='Återställ dealer').props.onClick();
  tree=harness.render();
  assert.deepEqual(harness.session.project.lanes[0].composition.mobile.dealer,defaultCompositionSettings().mobile.dealer);
  assert.deepEqual(harness.session.project.lanes[0].composition.mobile.table,original.lanes[0].composition.mobile.table);
  assert.deepEqual(harness.session.project.lanes[0].composition.mobile.background,original.lanes[0].composition.mobile.background);
  assert.deepEqual(harness.session.project.lanes[0].composition.desktop,desktop);
  assert.equal(harness.find(tree,node=>node.type?.name==='CompositionPreview').props.dealer.url,'/astrid-green');
  assert.deepEqual(project,original);
});

test('layer inspector supports keyboard selection and keeps each choice with its format-specific placement',()=>{
  const harness=previewHarness({dirty:false}),original=structuredClone(harness.session.project);
  let tree=harness.render();
  const tab=label=>harness.find(tree,node=>node.props?.role==='tab'&&node.props.children===label);
  const panel=role=>harness.find(tree,node=>node.props?.role==='tabpanel'&&node.props.id==='composition-panel-'+role);
  assert.equal(tab('Dealer').props['aria-selected'],true);assert.equal(tab('Dealer').props.tabIndex,0);
  assert.equal(panel('dealer').props.hidden,false);assert.equal(panel('table').props.hidden,true);
  let focused=0,prevented=0;
  tab('Bord').props.ref({focus(){focused++;}});
  tab('Dealer').props.onKeyDown({key:'ArrowRight',preventDefault(){prevented++;}});
  tree=harness.render();
  assert.equal(focused,1);assert.equal(prevented,1);
  assert.equal(tab('Bord').props['aria-selected'],true);assert.equal(tab('Dealer').props.tabIndex,-1);
  assert.equal(panel('table').props.hidden,false);assert.equal(panel('dealer').props.hidden,true);
  assert.ok(harness.find(panel('table'),node=>node.type?.name==='LayerAssetSelect'&&node.props.role==='table'));
  assert.ok(harness.find(panel('table'),node=>node.type==='input'&&node.props['aria-label']==='Bord bredd'));
  assert.equal(harness.find(panel('table'),node=>node.type==='input'&&node.props['aria-label']==='Dealer storlek'),null);
  tab('Bord').props.onKeyDown({key:'End',preventDefault(){}});
  tree=harness.render();assert.equal(tab('Bakgrund').props['aria-selected'],true);
  tab('Bakgrund').props.onKeyDown({key:'ArrowRight',preventDefault(){}});
  tree=harness.render();assert.equal(tab('Dealer').props['aria-selected'],true);
  tab('Dealer').props.onKeyDown({key:'ArrowLeft',preventDefault(){}});
  tree=harness.render();assert.equal(tab('Bakgrund').props['aria-selected'],true);
  tab('Bakgrund').props.onKeyDown({key:'Home',preventDefault(){}});
  tree=harness.render();assert.equal(tab('Dealer').props['aria-selected'],true);
  assert.deepEqual(harness.session.project,original);assert.equal(harness.session.dirty,false);
});

test('switching layers preserves mounted upload controls and its receipt while the upload guard stays active',async()=>{
  const harness=previewHarness({dirty:false});let tree=harness.render();
  const panel=role=>harness.find(tree,node=>node.props?.role==='tabpanel'&&node.props.id==='composition-panel-'+role);
  const library=()=>harness.find(panel('table'),node=>node.type?.name==='LayerLibrary');
  const uploaded=library();uploaded.props.onBusyChange(true);
  tree=harness.render();
  harness.find(tree,node=>node.props?.role==='tab'&&node.props.children==='Bakgrund').props.onClick();
  tree=harness.render();
  assert.equal(panel('table').props.hidden,true);assert.equal(panel('background').props.hidden,false);
  assert.equal(library().type,uploaded.type);assert.equal(library().key,uploaded.key);assert.equal(library().props.disabled,true);
  // The inactive panel remains present, so its original callback can finish.
  const remote=JSON.parse(harness.session.savedJson),asset={schemaVersion:1,id:'11111111-2222-4333-8444-555555555555',role:'table',label:'Bevarat bord',sha256:'a'.repeat(64),size:24,contentType:'image/png',width:640,height:360};
  asset.pathname=layerAssetPath(asset);remote.layerAssets=[asset];remote.revision='tab-upload';
  uploaded.props.onRegistered(remote,asset.id);
  tree=harness.render();
  assert.equal(harness.session.project.lanes[0].layers.table.default,asset.id);
  harness.find(tree,node=>node.type==='a'&&node.props.href?.includes('/control/lanes?lane=')).props.onClick({preventDefault(){}});
  await Promise.resolve();assert.equal(harness.saves(),0);
  uploaded.props.onBusyChange(false);tree=harness.render();
  assert.equal(library().props.disabled,false);
  harness.find(tree,node=>node.type==='button'&&node.props.children==='Spara').props.onClick();
  await Promise.resolve();assert.equal(harness.saves(),1);
  assert.equal(harness.savedProjects[0].lanes[0].layers.table.default,asset.id);
});

test('composition makes dealer permission changes explicit and never silently enables the other built-in dealers',()=>{
  const project=addDealer(createSeedProject(),'johanna','Johanna'),harness=previewHarness({project,dirty:false});
  let tree=harness.render();
  const permission=name=>harness.find(tree,node=>node.type==='input'&&node.props['aria-label']==='Tillåt '+name);
  assert.equal(permission('Astrid').props.checked,true);assert.equal(permission('Astrid').props.disabled,true);
  assert.equal(permission('Johanna').props.checked,false);
  assert.deepEqual(harness.session.project.lanes[0].layers.dealer.allowed,['astrid']);
  harness.find(tree,node=>node.type==='select'&&node.props.value==='astrid').props.onChange({target:{value:'johanna'}});
  tree=harness.render();
  assert.equal(permission('Johanna').props.checked,true);assert.equal(permission('Johanna').props.disabled,true);
  assert.equal(permission('Astrid').props.checked,true,'previous choice remains visible until explicitly removed');
  permission('Astrid').props.onChange({target:{checked:false}});tree=harness.render();
  assert.deepEqual(harness.session.project.lanes[0].dealers,['johanna']);
  assert.deepEqual(harness.session.project.lanes[0].layers.dealer.allowed,['johanna']);
  assert.equal(harness.session.project.lanes[0].layers.dealer.default,'johanna');
  permission('Johanna').props.onChange({target:{checked:false}});
  assert.deepEqual(harness.session.project.lanes[0].layers.dealer.allowed,['johanna']);
  for(const name of ['Vera','Amira','Mei'])assert.equal(permission(name).props.checked,false);
  assert.equal(harness.session.dirty,true);
});

test('dealer context opens an existing matching presentation without changing allowed dealers',()=>{
  const project=addDealer(createSeedProject(),'johanna','Johanna');
  const common=defaultPresentationLane(),own=structuredClone(common);
  common.layers.dealer.allowed=['astrid','johanna'];common.dealers=['astrid','johanna'];
  own.id='johanna-room';own.label='Johannas miljö';own.layers.dealer.default='johanna';
  own.layers.dealer.allowed=['johanna'];own.dealers=['johanna'];project.lanes=[common,own];
  const before=JSON.stringify(project);
  const {initialCompositionLaneId,ControlPreviewPage}=loadTs(new URL('../components/control-preview-page.tsx',import.meta.url));
  assert.equal(initialCompositionLaneId(project,undefined,'johanna'),'johanna-room');
  assert.equal(initialCompositionLaneId(project,common.id,'johanna'),common.id,'explicit presentation wins');
  assert.equal(initialCompositionLaneId(project,undefined,'unknown'),common.id);
  const html=renderToStaticMarkup(React.createElement(ControlPreviewPage,{initialProject:project,initialVideos:{videos:[]},initialStatus:{configured:false},initialDealerId:'johanna'}));
  assert.match(html,/<option value="johanna-room" selected="">Johannas miljö<\/option>/);
  assert.match(html,/<option value="johanna" selected="">Johanna<\/option>/);
  assert.equal(JSON.stringify(project),before);
  const page=readFileSync(new URL('../app/control/preview/page.tsx',import.meta.url),'utf8');
  assert.match(page,/initialDealerId=\{firstQueryValue\(query.dealer\)\}/);
});

test('a library dealer outside the selected presentation has an explicit inclusion action',()=>{
  const project=addDealer(createSeedProject(),'johanna','Johanna');
  const before=JSON.stringify(project);
  const {ControlPreviewPage}=loadTs(new URL('../components/control-preview-page.tsx',import.meta.url));
  const html=renderToStaticMarkup(React.createElement(ControlPreviewPage,{initialProject:project,initialVideos:{videos:[]},initialStatus:{configured:false},initialDealerId:'johanna'}));
  assert.match(html,/Du valde Johanna i dealerbiblioteket/);
  assert.match(html,/Dealern ingår inte i den här presentationen ännu/);
  assert.match(html,/Använd Johanna som startdealer/);
  assert.equal(JSON.stringify(project),before);
});

const previewId='11111111-2222-4333-8444-555555555555';
const previewRequest={presentationLaneId:'mobile-phone',expectedProjectRevision:'revision-1'};
const previewReceipt=()=>({sessionId:previewId,presentationLaneId:'mobile-phone',projectRevision:'revision-1',expiresAt:new Date(Date.now()+60000).toISOString(),entryUrl:'/studio-preview/'+previewId});
const previewResponse=(body=previewReceipt(),status=201,contentType='application/json')=>new Response(typeof body==='string'?body:JSON.stringify(body),{status,headers:{'content-type':contentType}});

test('explicit Studio preview uses the root API and exact saved revision with safe same-origin JSON transport',async()=>{
  let call;
  const receipt=previewReceipt();
  const result=await createStudioPreview(previewRequest,{fetchImpl:async(...args)=>{call=args;return previewResponse(receipt);}});
  assert.deepEqual(result,receipt);
  assert.equal(call[0],'/api/studio-preview');
  assert.equal(call[1].method,'POST');assert.equal(call[1].credentials,'same-origin');
  assert.equal(call[1].redirect,'error');assert.equal(call[1].cache,'no-store');
  assert.deepEqual(JSON.parse(call[1].body),previewRequest);
  assert.equal(call[1].headers.Accept,'application/json');
});

test('preview rejects foreign, forged, expired, mismatched and non-JSON receipts',async()=>{
  const receipt=previewReceipt();
  for(const mutation of [
    {entryUrl:'https://www.scoutgaming.tech'+receipt.entryUrl},
    {entryUrl:'//evil.test/studio-preview/'+previewId},
    {entryUrl:receipt.entryUrl+'?next=https://evil.test'}, {entryUrl:receipt.entryUrl+'#x'},
    {entryUrl:'/studio-preview/%2e%2e/control'}, {entryUrl:'/play/blackjack'},
    {sessionId:previewId.toUpperCase().replace('111','ABC')}, {projectRevision:'other'}, {presentationLaneId:'other'},
    {expiresAt:new Date(0).toISOString()}, {expiresAt:{toString:null}}, {extra:'ignored'},
  ]) await assert.rejects(createStudioPreview(previewRequest,{fetchImpl:async()=>previewResponse({...receipt,...mutation})}),/ogiltigt svar/);
  for(const response of [previewResponse('<html>login</html>',200,'text/html'),previewResponse('{',201),previewResponse([],201),previewResponse(receipt,200),previewResponse('x'.repeat(16385),201)]){
    await assert.rejects(createStudioPreview(previewRequest,{fetchImpl:async()=>response}),/ogiltigt svar|kunde inte startas/);
  }
});

test('preview maps known failures without exposing server text and never retries automatically',async()=>{
  for(const [status,code,phrase] of [
    [422,'studio_preview_idle_required','grundloop för startdealern'],
    [409,'studio_preview_revision_conflict','Projektet har ändrats'],
    [429,'studio_preview_limit','För många provspelningar'],
    [401,'studio_login_required','Logga in'],
    [403,'studio_preview_forbidden','saknar behörighet'],
    [503,'studio_preview_media_unavailable','medier kunde inte läsas'],
  ]) {
    let calls=0;
    await assert.rejects(createStudioPreview(previewRequest,{fetchImpl:async()=>{calls++;return previewResponse({error:code,detail:'DO NOT DISPLAY'},status);}}),new RegExp(phrase));
    assert.equal(calls,1);
  }
  for(const error of ['unknown server detail',{toString:null}])await assert.rejects(createStudioPreview(previewRequest,{fetchImpl:async()=>previewResponse({error},503)}),/kunde inte startas/);
  await assert.rejects(createStudioPreview(previewRequest,{fetchImpl:async()=>{throw Error('DO NOT DISPLAY');}}),/Kontrollera anslutningen/);
  let calls=0;
  await assert.rejects(createStudioPreview({...previewRequest,expectedProjectRevision:''},{fetchImpl:async()=>{calls++;}}),/Spara sammansättningen/);
  assert.equal(calls,0);
});

const previewButton=(h,tree)=>h.find(tree,node=>node.type==='button'&&node.props['aria-describedby']==='studio-preview-help');
test('preview waits for its receipt, locks repeated clicks and mutations, then navigates in the same tab',async()=>{
  let resolve,calls=0,request,signal;
  const h=previewHarness({dirty:false,previewClient:(value,options)=>{calls++;request=value;signal=options.signal;return new Promise(done=>resolve=done);}});
  const navigations=[];globalThis.window={location:{assign:href=>navigations.push(href)}};
  try{
    const original=structuredClone(h.session.project),tree=h.render(),button=previewButton(h,tree);
    assert.equal(button.props.disabled,false);
    button.props.onClick();button.props.onClick();
    assert.equal(calls,1);assert.equal(signal.aborted,false);assert.deepEqual(navigations,[]);
    assert.deepEqual(structuredClone(request),{presentationLaneId:original.lanes[0].id,expectedProjectRevision:original.revision});
    h.find(tree,node=>node.type?.name==='CompositionMetadata').props.onEdit(current=>({...current,revision:'changed'}));
    h.find(tree,node=>node.type==='a'&&node.props.href?.includes('/control/lanes?')).props.onClick({preventDefault(){}});
    assert.deepEqual(h.session.project,original);assert.equal(h.saves(),0);
    assert.equal(previewButton(h,h.render()).props.disabled,true);
    resolve(previewReceipt());await new Promise(setImmediate);
    assert.deepEqual(navigations,['/studio-preview/'+previewId]);
  }finally{delete globalThis.window;}
});

test('unsaved, absent, uploading, conflicting, temporary or saving compositions never start preview',async()=>{
  for(const condition of ['dirty','absent','upload','conflict','temporary','saving','same-tick-edit']){
    let calls=0;const project=createSeedProject();if(condition==='absent')project.lanes=[];
    const h=previewHarness({project,dirty:condition==='dirty',conflict:condition==='conflict',previewClient:async()=>{calls++;return previewReceipt();}});
    if(condition==='saving')h.session.saving=true;
    let tree=h.render();
    if(condition==='upload')h.find(tree,node=>node.type?.name==='LayerLibrary').props.onBusyChange(true);
    if(condition==='same-tick-edit')h.find(tree,node=>node.type?.name==='CompositionMetadata').props.onEdit(current=>({...current,revision:'changed'}));
    if(condition==='temporary'){
      h.find(tree,node=>node.type==='input'&&node.props.type==='file').props.onChange({target:{files:[new Blob(['fixture'],{type:'video/mp4'})]}});
      tree=h.render();
    }
    previewButton(h,tree).props.onClick();await new Promise(setImmediate);
    assert.equal(calls,0,condition);assert.equal(h.saves(),0,condition);
    h.effects[0]()();
  }
});

test('late preview responses cannot leave a changed context or an unmounted composer',async()=>{
  for(const change of ['project','unmount']){
    let resolve,signal;const navigations=[];
    const h=previewHarness({dirty:false,previewClient:(_request,options)=>{signal=options.signal;return new Promise(done=>resolve=done);}});
    globalThis.window={location:{assign:href=>navigations.push(href)}};
    try {
      previewButton(h,h.render()).props.onClick();
      if(change==='unmount')h.effects[3]()();
      else {h.session.project={...h.session.project,revision:'remote'};h.session.projectRef.current=h.session.project;h.render();}
      resolve(previewReceipt());await new Promise(setImmediate);
      assert.deepEqual(navigations,[]);
      assert.equal(signal.aborted,change==='unmount');
      if(change==='project')assert.match(h.find(h.render(),node=>node.props?.role==='alert').props.children,/har ändrats/);
    }finally{delete globalThis.window;}
  }
});

test('preview errors stay in the composer and an explicit new click can retry',async()=>{
  let calls=0;
  const h=previewHarness({dirty:false,previewClient:async()=>{calls++;throw Error('Välj en grundloop för startdealern före provspelning.');}});
  previewButton(h,h.render()).props.onClick();await new Promise(setImmediate);
  const tree=h.render();
  assert.match(h.find(tree,node=>node.props?.role==='alert').props.children,/grundloop för startdealern/);
  assert.equal(previewButton(h,tree).props.disabled,false);assert.equal(h.saves(),0);
  previewButton(h,tree).props.onClick();await new Promise(setImmediate);assert.equal(calls,2);
});
