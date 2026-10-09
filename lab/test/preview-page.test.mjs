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

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');

function loadTs(fileUrl,overrides={}) {
  const source = readFileSync(fileUrl, 'utf8');
  const output = transformSync(source, { filename: fileURLToPath(fileUrl), jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  const localRequire = createRequire(fileUrl);
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams, Request, Headers,
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

function previewHarness({dirty=true,conflict=false,saveResult=true,project:initialProject,inventory={videos:[]}}={}) {
  const project=initialProject??createSeedProject(),state=[],refs=[],effects=[];let stateIndex=0,refIndex=0,saves=0;
  const session={project,projectRef:{current:project},videos:inventory,setVideos:value=>{session.videos=value;},savedJson:JSON.stringify(project),dirty,saving:false,conflict,
    save:async()=>{saves++;if(saveResult)session.dirty=false;return saveResult;},
    setSavedJson:value=>{session.savedJson=value;},setProject:value=>{session.project=value;},setConflict:value=>{session.conflict=value;},setError:value=>{session.error=value;},setNotice:value=>{session.notice=value;}};
  const hooks={useState:initial=>{const index=stateIndex++;if(!Object.hasOwn(state,index))state[index]=typeof initial==='function'?initial():initial;return [state[index],value=>{state[index]=typeof value==='function'?value(state[index]):value;}];},
    useRef:initial=>{const index=refIndex++;return refs[index]??=({current:initial});},useEffect:callback=>effects.push(callback)};
  const {ControlPreviewPage}=loadTs(new URL('../components/control-preview-page.tsx',import.meta.url),{react:hooks,'./studio-session':{useStudioSession:()=>session}});
  function render(){stateIndex=0;refIndex=0;effects.length=0;return ControlPreviewPage({initialProject:project,initialVideos:inventory,initialStatus:{provider:'neon'}});}
  function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children,node.props?.primary].flat(Infinity)){const found=find(child,predicate);if(found)return found;}return null;}
  return {session,render,find,effects,saves:()=>saves};
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

test('Nora without own families uses a locked generic upload and previews its receipt without runtime binding',()=>{
  const project=addDealer(createSeedProject(),'nora','Nora');project.lanes[0].dealers.push('nora');project.lanes[0].layers.dealer.allowed.push('nora');project.lanes[0].layers.dealer.default='nora';
  const inventory={videos:[],families:[{id:'astrid/idle.ready/ready',dealerId:'astrid',eventId:'idle.ready',situation:'',playbackType:'idle-pool',standardIds:[],variantIds:[]}]};
  const harness=previewHarness({project,inventory}),tree=harness.render(),original=structuredClone(project);
  const upload=harness.find(tree,node=>node.type?.name==='VideoUpload');
  assert.ok(upload);assert.equal(upload.props.dealerId,'nora');assert.equal(upload.props.lockDealer,true);assert.equal(upload.props.previewOnly,true);
  assert.equal(upload.props.eventId,'idle.ready');assert.equal(harness.find(tree,node=>node.type?.name==='FamilyVideoUpload'),null);
  const video={id:'nora-upload-receipt',label:'Nora nytt klipp',dealer:'nora',available:true,previewUrl:'/api/videos/nora-upload-receipt',classification:{dealerId:'nora',eventId:'idle.ready',situation:'',compositing:{mode:'green-screen',threshold:.23,softness:.15,despill:0}}};
  upload.props.onUploaded({...inventory,videos:[video]},video,{role:'standard',selection:{rules:true,model:true,random:true},triggerIds:[]});
  const rerender=harness.render(),preview=harness.find(rerender,node=>node.type?.name==='CompositionPreview');
  assert.equal(preview.props.dealer.url,'/api/videos/nora-upload-receipt');assert.equal(preview.props.compositing.mode,'green-screen');
  assert.deepEqual(harness.session.project,original);
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
