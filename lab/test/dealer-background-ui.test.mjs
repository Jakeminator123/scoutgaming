import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import React from 'react';
import {addDealer,createSeedProject,defaultPresentationLane} from '../../packages/presentation/contracts/studio-model.mjs';
import {layerAssetPath} from '../../packages/presentation/contracts/presentation-layers.mjs';

const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
function load(file,overrides={},globals={}){
  const url=new URL(file,import.meta.url),localRequire=createRequire(url),module={exports:{}};
  const {code}=transformSync(readFileSync(url,'utf8'),{filename:fileURLToPath(url),jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
  vm.runInNewContext(code,{module,exports:module.exports,structuredClone,URL,URLSearchParams,...globals,require:name=>{
    if(Object.hasOwn(overrides,name))return overrides[name];
    if(name.endsWith('.css'))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
    if(name==='./studio-types')return load('../components/studio-types.ts',overrides,globals);
    if(name.startsWith('./')&&!/\.(mjs|js)$/.test(name))return new Proxy({},{get:(_,key)=>key});
    return localRequire(name);
  }});return module.exports;
}
function hooks(){
  const states=[],refs=[],effects=[];let stateCursor=0,refCursor=0,effectCursor=0,pending=[];
  const react={...React,useRef:initial=>refs[refCursor++]??={current:initial},useState(initial){const key=stateCursor++;if(!(key in states))states[key]=typeof initial==='function'?initial():initial;return [states[key],value=>states[key]=typeof value==='function'?value(states[key]):value];},useMemo:fn=>fn(),useEffect(fn,deps){const key=effectCursor++,old=effects[key];if(!old||!deps||deps.some((value,index)=>value!==old.deps[index]))pending.push(()=>{old?.cleanup?.();effects[key]={deps,cleanup:fn()};});}};
  return {react,render(Component,props){stateCursor=refCursor=effectCursor=0;return Component(props);},effects(){const next=pending;pending=[];next.forEach(fn=>fn());},unmount(){effects.forEach(effect=>effect?.cleanup?.());}};
}
function nodes(tree,predicate){if(Array.isArray(tree))return tree.flatMap(node=>nodes(node,predicate));if(!tree||typeof tree!=='object')return [];return [...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)];}
const text=tree=>Array.isArray(tree)?tree.map(text).join(''):tree&&typeof tree==='object'?text(tree.props?.children):String(tree??'');

test('the actual dealer canvas keys legacy and classified frames and clears failures without raw fallback',()=>{
  for(const compositing of [undefined,{mode:'opaque'},{mode:'green-screen',threshold:.23,softness:.15,despill:.5}]){
    const h=hooks(),frames=new Map(),events=new Map();let serial=0,pixels=new Uint8ClampedArray(8),broken=false,pauses=0;
    const video={src:'/first.mp4',currentTime:0,videoWidth:2,videoHeight:1,readyState:2,pause(){pauses++;}};
    const context={clearRect(){pixels.fill(0);},drawImage(){pixels.set(video.src==='/second.mp4'?[0,255,0,255,0,0,255,255]:[0,255,0,255,255,0,0,255]);},getImageData(){if(broken)throw Error('fixture cross-origin read denied');return {data:pixels.slice()};},putImageData(frame){pixels=frame.data.slice();}};
    const root={querySelector:()=>video,addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)},canvas={getContext:()=>context};
    const {DealerVideoSurface}=load('../components/dealer-video-surface.tsx',{react:h.react},{requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id)});
    let tree=h.render(DealerVideoSurface,{compositing,children:React.createElement('video',{src:video.src})});tree.props.ref.current=root;nodes(tree,node=>node.type==='canvas')[0].props.ref.current=canvas;h.effects();
    const paint=()=>{const [id,fn]=frames.entries().next().value;frames.delete(id);fn();};
    paint();assert.deepEqual([...pixels],[0,compositing?.despill===.5?128:255,0,0,255,0,0,255]);assert.equal(tree.props['data-keyed'],'true');
    video.src='/second.mp4';paint();assert.deepEqual([...pixels.slice(4)],[0,0,255,255],'same timestamp and dimensions still draw the new source');
    video.readyState=1;events.get('loadstart')();assert.equal(pixels.some(Boolean),false);paint();assert.equal(pixels.some(Boolean),false);
    video.readyState=2;broken=true;paint();assert.equal(pixels.some(Boolean),false);assert.equal(pauses,1);paint();assert.equal(pauses,1,'failed source is not retried every frame');
    tree=h.render(DealerVideoSurface,{compositing,children:React.createElement('video',{src:video.src})});assert.match(text(tree),/kunde inte friläggas/);
    broken=false;video.src='/recovered.mp4';events.get('loadstart')();paint();assert.equal(pixels[3],0);assert.equal(pixels[7],255);
    h.unmount();assert.equal(frames.size,0);assert.equal(events.size,0);
  }
  const css=readFileSync(new URL('../components/dealer-video-surface.module.css',import.meta.url),'utf8');assert.match(css,/video\{visibility:hidden/);
});

test('dealer PNG canvas preserves alpha and green pixels without depending on DOM constructors',()=>{
  const h=hooks(),frames=new Map(),events=new Map();let serial=0,pixels=new Uint8ClampedArray(8),draws=0;
  const image={tagName:'IMG',src:'/vila.png',naturalWidth:2,naturalHeight:1,complete:true};
  const expected=[0,255,0,255,255,0,0,0];
  const context={clearRect(){pixels.fill(0);},drawImage(){draws++;pixels.set(expected);},getImageData(){return {data:pixels.slice()};},putImageData(frame){pixels=frame.data.slice();}};
  const root={querySelector:()=>image,addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)},canvas={getContext:()=>context};
  const {DealerVideoSurface}=load('../components/dealer-video-surface.tsx',{react:h.react},{requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id)});
  const tree=h.render(DealerVideoSurface,{compositing:{mode:'alpha'},children:React.createElement('img',{src:image.src})});
  tree.props.ref.current=root;nodes(tree,node=>node.type==='canvas')[0].props.ref.current=canvas;h.effects();
  const paint=()=>{const [id,fn]=frames.entries().next().value;frames.delete(id);fn();};
  paint();assert.deepEqual([...pixels],expected);paint();assert.equal(draws,1,'a still image does not redraw as a video clock');
  image.complete=false;paint();assert.equal(pixels.some(Boolean),false);
  h.unmount();assert.equal(frames.size,0);assert.equal(events.size,0);
});

test('legacy clip settings require keyed output on explicit save without altering the old compare-and-swap value',async()=>{
  const h=hooks(),calls=[];
  const old={dealerId:'paow',eventId:'idle.ready',kind:'idle',role:'standard',situation:'',label:'Legacy',notes:'',compositing:{mode:'opaque'}};
  const {DealerFileSettings}=load('../components/dealer-file-settings.tsx',{react:h.react,'./studio-types':{requestJson:async(_url,init)=>{calls.push(JSON.parse(init.body));return {videos:[]};}}});
  const props={video:{id:'legacy',sha256:'a'.repeat(64),available:true,previewUrl:'/legacy',classification:old},onSaved(){}};
  let tree=h.render(DealerFileSettings,props);tree.props.onToggle({currentTarget:{open:true}});tree=h.render(DealerFileSettings,props);
  nodes(tree,node=>node.type==='button')[0].props.onClick();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls[0].previous,old);assert.equal(calls[0].metadata.compositing.mode,'green-screen');assert.equal(old.compositing.mode,'opaque');
});

test('table and background choices stay visible and save in a composition whose dealer has no legacy compositing metadata',async()=>{
  let project=addDealer(createSeedProject(),'paow','PAOW'),saved;
  const lane=defaultPresentationLane('paow');lane.id='johns-johanna';lane.layers.table.enabled=false;lane.layers.background.enabled=false;project.lanes=[lane];
  project.layerAssets=['table','background'].map((role,index)=>{const asset={schemaVersion:1,id:`00000000-0000-4000-8000-00000000000${index+1}`,role,label:role==='table'?'Nytt bord':'Ny miljö',sha256:'a'.repeat(64),size:24,contentType:'image/png',width:640,height:360};return {...asset,pathname:layerAssetPath(asset)};});
  const original=structuredClone(project),videos={videos:[{id:'paow-idle',label:'PAOW',available:true,dealer:'paow',previewUrl:'/fixture.mp4'}]},projectRef={current:project};let baseline=JSON.stringify(project);
  const session={get project(){return project;},projectRef,videos,get dirty(){return JSON.stringify(project)!==baseline;},saving:false,save:async()=>{saved=structuredClone(project);baseline=JSON.stringify(project);return true;},get savedJson(){return baseline;},modelEdit(fn){project=fn(project);projectRef.current=project;},setProject(value){project=value;projectRef.current=value;},setSavedJson(){},setConflict(){},setError(){},setNotice(){},conflict:false};
  const h=hooks(),window={addEventListener(){},removeEventListener(){},location:{href:'https://qa.invalid/control/compositions'},history:{replaceState(){}}};
  const {ControlPreviewPage}=load('../components/control-preview-page.tsx',{react:h.react,'./studio-session':{useStudioProjectSession:()=>session}},{window});
  const {LayerAssetSelect}=load('../components/layer-selectors.tsx');
  const props={initialProject:project,initialVideos:videos,initialStatus:{provider:'neon'},initialLaneId:lane.id,initialDealerId:'paow'};
  let tree=h.render(ControlPreviewPage,props);h.effects();
  assert.equal(nodes(tree,node=>node.type==='CompositionPreview')[0].props.compositing.mode,'green-screen');
  for(const role of ['table','background']){
    const selector=nodes(tree,node=>node.type==='LayerAssetSelect'&&node.props.role===role)[0];const fields=LayerAssetSelect(selector.props);
    const id=project.layerAssets.find(row=>row.role===role).id;nodes(fields,node=>node.type==='select')[0].props.onChange({target:{value:id}});
    tree=h.render(ControlPreviewPage,props);h.effects();
    const preview=nodes(tree,node=>node.type==='CompositionPreview')[0];assert.equal(preview.props.show[role],true);assert.equal(preview.props[role].url,`/api/layer-assets/${id}`);
    assert.ok(nodes(tree,node=>node.type==='input'&&node.props['aria-label']===(role==='table'?'Bord bredd':'Bakgrund storlek')).length,'layer placement is available with unclassified legacy dealer');
  }
  const save=nodes(tree.props.primary,node=>node.type==='button'&&text(node)==='Spara')[0];assert.equal(save.props.disabled,false);save.props.onClick();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(saved.lanes[0].layers.table.default,project.layerAssets[0].id);assert.equal(saved.lanes[0].layers.background.default,project.layerAssets[1].id);assert.deepEqual(videos.videos[0],{id:'paow-idle',label:'PAOW',available:true,dealer:'paow',previewUrl:'/fixture.mp4'});assert.equal(original.lanes[0].layers.table.default,null);
  h.unmount();
});
