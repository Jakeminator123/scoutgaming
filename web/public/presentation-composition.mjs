import {defaultCompositionSettings,validateCompositionSettings,sceneForComposition} from './composition-settings.mjs';
import {drawDealerFrame,validateDealerFraming} from './dealer-framing.mjs';
import {effectiveDealerCompositing} from './dealer-compositing.mjs';
const idPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const fail = () => {throw Error('Invalid layer composition');};
export function validateComposition(value) {
  if (!value || value.schemaVersion!==1 || Object.keys(value).filter(key=>key!=='settings').sort().join(',')!=='assets,background,dealer,schemaVersion,table'
    || !Array.isArray(value.assets) || value.assets.length>64) fail();
  if (Object.keys(value.dealer??{}).sort().join(',')!=='compatibility,enabled' || !['full-frame','per-clip'].includes(value.dealer.compatibility) || typeof value.dealer.enabled!=='boolean') fail();
  if(value.settings!==undefined)validateCompositionSettings(value.settings);
  const ids=new Set();
  for(const asset of value.assets) {
    if(Object.keys(asset).sort().join(',')!=='contentType,id,label,role,src' || !idPattern.test(asset.id)||ids.has(asset.id)
      || !['background','table'].includes(asset.role)||typeof asset.label!=='string'||asset.label.length>80
      || !['image/png','image/jpeg','image/webp','video/mp4','video/webm'].includes(asset.contentType)
      || !(new RegExp(`^/api/presentation/layers/[a-z][a-z0-9-]{0,62}/${asset.id}$`).test(asset.src)
        || new RegExp(`^/api/studio-preview/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/layers/${asset.id}$`).test(asset.src)))fail();
    ids.add(asset.id);
  }
  for(const role of ['background','table']) {
    const layer=value[role];
    if(!layer||Object.keys(layer).sort().join(',')!== (role==='background'?'allowed,default,enabled,mode':'allowed,default,enabled')
      ||typeof layer.enabled!=='boolean'||!Array.isArray(layer.allowed)||layer.allowed.length>32||new Set(layer.allowed).size!==layer.allowed.length
      ||layer.allowed.some(id=>!value.assets.some(asset=>asset.id===id&&asset.role===role))
      ||layer.default!==null&&!layer.allowed.includes(layer.default))fail();
    if(role==='background'&&!['baked','image','video'].includes(layer.mode))fail();
  }
  return structuredClone(value);
}
export function clipCompositing(value) {
  value=effectiveDealerCompositing(value);
  if(!value||Object.keys(value).sort().join(',')!=='despill,mode,softness,threshold'||value.mode!=='green-screen'
    ||!Number.isFinite(value.threshold)||value.threshold<0||value.threshold>1
    ||!Number.isFinite(value.softness)||value.softness<=0||value.softness>1
    ||!Number.isFinite(value.despill)||value.despill<0||value.despill>1)fail();
  return {enabled:true,mode:'composite',threshold:value.threshold,softness:value.softness,despill:value.despill};
}
// Same exact decoded dealer frame and clock as local-film-player. The shared
// Nora compositor only changes pixels; card, speech and clip selection stay owned.
export function createLayerComposition(document, initial, {loadRuntime=()=>import(/* webpackIgnore: true */ '/composition-runtime/compositor.js')}={}) {
  const host=document.querySelector('#scene');if(!host)return null;
  document.documentElement.dataset.presentationStandard='three-layer';
  let current=initial?validateComposition(initial):null,compositor=null,runtime=null,key=null,framing=null,frameNumber=0,preparation=0,raf=null,closed=false;
  const mounts=new Map(),selected=new Map(),pending=new Map();
  const view=document.defaultView??globalThis;
  const actorFrame=document.createElement('canvas');
  function assets() {
    const map=new Map();
    for(const [role,node]of mounts){const width=node.videoWidth||node.naturalWidth,height=node.videoHeight||node.naturalHeight;if(width&&height)map.set(role,{el:node,width,height});}
    return map;
  }
  function paintHeld() {
    if(!compositor||!key||!actorFrame.width||closed)return;
    const layout=host.clientWidth<host.clientHeight?'mobile':'desktop';
    const scene=sceneForComposition(current?.settings??defaultCompositionSettings(),layout,
      {dealer:current?.dealer.enabled??true,background:Boolean(key.enabled&&current?.background.enabled&&mounts.has('background')),table:Boolean(key.enabled&&current?.table.enabled)},key);
    scene.dealerAspect=16/9;
    compositor.render(scene,actorFrame,assets(),[],null);
  }
  function animate() {paintHeld();if(!closed&&key&&view.requestAnimationFrame)raf=view.requestAnimationFrame(animate);}
  function stopAnimation(){if(raf!==null)view.cancelAnimationFrame?.(raf);raf=null;}
  function render(role,id) {
    mounts.get(role)?.pause?.();mounts.get(role)?.remove();mounts.delete(role);pending.delete(role);
    selected.set(role,id);
    if(!current||!current[role].enabled)return;
    const asset=current.assets.find(row=>row.id===id&&row.role===role);if(!asset)return;
    const node=document.createElement(asset.contentType.startsWith('video/')?'video':'img');
    node.className=`presentation-plane presentation-${role}`;node.dataset.layerAsset=asset.id;node.setAttribute('aria-hidden','true');
    if(node.tagName==='VIDEO'){node.muted=true;node.loop=true;node.playsInline=true;node.preload='auto';node.autoplay=true;}
    else node.alt='';
    // Independent source planes appear through the mandatory keyed dealer layer.
    if(node.style)node.style.visibility=current.dealer.enabled?'hidden':'';node.src=asset.src;host.append(node);mounts.set(role,node);
    if(node.addEventListener){const event=node.tagName==='VIDEO'?'loadeddata':'load';pending.set(role,new Promise((resolve,reject)=>{
      if(node.tagName==='VIDEO'?node.readyState>=2:node.complete&&node.naturalWidth){resolve();return;}
      const timer=setTimeout(()=>finish(Error('Layer media unavailable')),12000);
      function finish(error){clearTimeout(timer);node.removeEventListener(event,ready);node.removeEventListener('error',bad);error?reject(error):resolve();}
      const ready=()=>finish(),bad=()=>finish(Error('Layer media unavailable'));node.addEventListener(event,ready,{once:true});node.addEventListener('error',bad,{once:true});
    }));void pending.get(role).catch(()=>{});}
  }
  function set(role,id) {if(current&&current[role].allowed.includes(id)){render(role,id);paintHeld();}}
  function replace(value) {
    ++preparation;current=validateComposition(value);key=null;stopAnimation();compositor?.canvas?.style.setProperty('visibility','hidden');
    for(const role of ['background','table'])render(role,current[role].default);
    host.dataset.dealerLayerEnabled=String(current.dealer.enabled);host.dataset.presentationClipMode='pending';
  }
  async function prepareClip(compositing,sourceFraming) {
    const revision=++preparation;stopAnimation();key=null;framing=sourceFraming?validateDealerFraming(sourceFraming):null;
    const nextKey=clipCompositing(compositing);
    runtime??=loadRuntime();const {Compositor}=await runtime;
    await Promise.all(pending.values());if(closed||revision!==preparation)return false;
    if(!compositor){const canvas=document.createElement('canvas');canvas.className='presentation-composed-film';host.append(canvas);compositor=new Compositor(canvas);}
    key=nextKey;return true;
  }
  function renderFrame(video) {
    if(closed)return false;
    if(!key||!compositor){host.dataset.presentationClipMode='unavailable';if(compositor)compositor.canvas.style.visibility='hidden';throw Error('Dealer background removal unavailable');}
    if(!video.videoWidth||!video.videoHeight)throw Error('Dealer frame unavailable');
    const targetWidth=1920,targetHeight=1080;
    if(actorFrame.width!==targetWidth||actorFrame.height!==targetHeight){actorFrame.width=targetWidth;actorFrame.height=targetHeight;}
    const context=actorFrame.getContext('2d');
    drawDealerFrame(context,video,targetWidth,targetHeight,framing??undefined);
    actorFrame.src=`presented-frame-${++frameNumber}`;
    paintHeld();compositor.canvas.style.visibility='';host.dataset.presentationClipMode='green-screen';
    if(raf===null&&view.requestAnimationFrame)raf=view.requestAnimationFrame(animate);
    return true;
  }
  if(current)replace(current);
  return {setBackground:id=>set('background',id),setTable:id=>set('table',id),replace,prepareClip,renderFrame,
    hold:()=>{if(key)paintHeld();},
    close(){closed=true;++preparation;stopAnimation();for(const node of mounts.values()){node.pause?.();node.remove();}mounts.clear();compositor?.dispose();compositor?.canvas.remove();}};
}
