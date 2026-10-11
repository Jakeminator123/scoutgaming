import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {defaultCompositionSettings} from '../../../web/public/composition-settings.mjs';

const require = createRequire(import.meta.url), ts = require('typescript');
const filename = fileURLToPath(new URL('../components/player/player-scene-canvas.tsx',import.meta.url));
const code = ts.transpileModule(readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const source = (name='dealer',contentType='video/mp4')=>({src:'/api/operators/fixture/preview/'+name,contentType});
const settle = ()=>new Promise(resolve=>setImmediate(resolve));

function mount({reduced=false,defer=false,props={}}={}) {
  const refs=[],states=[],effects=[],elements=[],frames=new Map(),renders=[];
  let ready=0,failures=0,nextFrame=0,renderCalls=0;
  class Canvas extends EventTarget {
    width=720; height=1280;
    context={clearRect(){},drawImage(...args){renderCalls++;this.lastDraw=args;}};
    getContext(){return this.context;}
  }
  class Video extends EventTarget {
    src=''; currentTime=0; videoWidth=1080; videoHeight=1920; paused=true; muted=false; defaultMuted=false; loadCalls=0; playCalls=0;
    get currentSrc(){return this.src;}
    load(){this.loadCalls++;if(this.src&&!defer)queueMicrotask(()=>this.dispatchEvent(new Event('loadeddata')));}
    play(){this.playCalls++;this.paused=false;return Promise.resolve();}
    pause(){this.paused=true;}
    removeAttribute(name){if(name==='src')this.src='';}
  }
  class Picture extends EventTarget {
    value=''; naturalWidth=800; naturalHeight=1200;
    set src(value){this.value=value;if(value&&!defer)queueMicrotask(()=>this.dispatchEvent(new Event('load')));}
    get src(){return this.value;}
    removeAttribute(name){if(name==='src')this.value='';}
  }
  class Observer {
    static current;
    constructor(callback){this.callback=callback;Observer.current=this;}
    observe(){}
    disconnect(){this.disconnected=true;}
    change(isIntersecting){this.callback([{isIntersecting}]);}
  }
  class Compositor {
    constructor(stage){this.stage=stage;}
    render(scene,actor,assets,cards){renders.push({scene,actor,assets,cards});}
    dispose(){this.disposed=true;}
  }
  const stage=new Canvas(),document=new EventTarget(),motion=new EventTarget();
  document.hidden=false;
  document.createElement=tag=>{const element=tag==='video'?new Video():new Canvas();elements.push(element);return element;};
  motion.matches=reduced;
  const React={
    useRef(value){const ref={current:value===null?stage:value};refs.push(ref);return ref;},
    useState(value){const state={value};states.push(state);return [value,next=>{state.value=next;}];},
    useEffect(callback){effects.push(callback);},
  };
  const localRequire=specifier=>{
    if(specifier==='react')return React;
    if(specifier==='react/jsx-runtime')return {jsx:(type,props,key)=>({type,props,key}),jsxs:(type,props,key)=>({type,props,key})};
    if(specifier==='/composition-runtime/compositor.js')return {Compositor};
    if(specifier.includes('composition-settings.mjs'))return require('../../../web/public/composition-settings.mjs');
    throw Error('Unexpected module: '+specifier);
  };
  const context={module:{exports:{}},exports:null,require:localRequire,document,window:{matchMedia:()=>motion},Image:Picture,HTMLVideoElement:Video,IntersectionObserver:Observer,AbortController,Event,queueMicrotask,setTimeout,clearTimeout,
    requestAnimationFrame(callback){const id=++nextFrame;frames.set(id,callback);return id;},cancelAnimationFrame(id){frames.delete(id);}};
  context.exports=context.module.exports;
  vm.runInNewContext(code,context,{filename});
  const {PlayerSceneCanvas}=context.module.exports;
  const allProps={dealer:source(),background:null,table:null,settings:null,label:'Publicerad dealer',onReady:()=>ready++,onFailure:()=>failures++,...props};
  const root=PlayerSceneCanvas(allProps),tree=root.type(root.props);
  const cleanup=effects[0]();
  return {tree,root,PlayerSceneCanvas,allProps,states,refs,stage,elements,frames,renders,document,motion,observer:Observer.current,cleanup,
    get ready(){return ready;},get failures(){return failures;},get renderCalls(){return renderCalls;},
    async visible(value){Observer.current.change(value);await settle();},
    async hidden(value){document.hidden=value;document.dispatchEvent(new Event('visibilitychange'));await settle();},
    async toggle(){refs[1].current();await settle();},
  };
}

test('silent preview stops work when hidden/offscreen and respects an explicit pause',async()=>{
  const view=mount();
  try {
    await settle();
    const video=view.elements[0];
    assert.equal(view.ready,1);
    assert.equal(video.muted,true);assert.equal(video.defaultMuted,true);assert.equal(video.playsInline,true);
    assert.equal(video.playCalls,0);assert.equal(view.frames.size,0);
    assert.equal(view.renderCalls,1);
    await view.visible(true);
    assert.equal(video.paused,false);assert.equal(view.frames.size,1);
    await view.hidden(true);
    assert.equal(video.paused,true);assert.equal(view.frames.size,0);
    await view.hidden(false);
    assert.equal(video.paused,false);
    await view.visible(false);
    assert.equal(video.paused,true);assert.equal(view.frames.size,0);
    await view.visible(true);
    await view.toggle();
    assert.equal(video.paused,true);
    await view.hidden(true);await view.hidden(false);
    assert.equal(video.paused,true);assert.equal(view.frames.size,0);
  } finally {view.cleanup();}
});

test('reduced motion displays a first frame until the user explicitly starts playback',async()=>{
  const view=mount({reduced:true});
  try {
    await settle();await view.visible(true);
    const video=view.elements[0];
    assert.equal(video.playCalls,0);assert.equal(view.renderCalls,1);assert.equal(view.frames.size,0);
    await view.toggle();assert.equal(video.paused,false);
    view.motion.dispatchEvent(new Event('change'));await settle();
    assert.equal(video.paused,true);assert.equal(view.frames.size,0);
  } finally {view.cleanup();}
});

test('source replacement is keyed and aborts unfinished decoding without reporting a stale dealer ready',async()=>{
  const view=mount({defer:true});
  const next=view.PlayerSceneCanvas({...view.allProps,dealer:source('another')});
  assert.notEqual(next.key,view.root.key);
  const video=view.elements[0];
  view.cleanup();
  video.dispatchEvent(new Event('loadeddata'));
  await settle();
  assert.equal(video.src,'');assert.equal(video.paused,true);assert.equal(view.observer.disconnected,true);
  assert.equal(view.ready,0);assert.equal(view.failures,0);assert.equal(view.frames.size,0);
});

test('media decode errors produce one safe failure and stop playback',async()=>{
  const view=mount();
  try {
    await settle();await view.visible(true);
    const video=view.elements[0];
    video.dispatchEvent(new Event('error'));video.dispatchEvent(new Event('error'));
    await settle();
    assert.equal(view.failures,1);assert.equal(view.states[0].value,'error');
    assert.equal(video.paused,true);assert.equal(view.frames.size,0);
  } finally {view.cleanup();}
});

test('layered still images feed the published composition and never start a frame loop',async()=>{
  const settings=defaultCompositionSettings();settings.mobile.dealer.x=.12;settings.tableFront=true;
  const view=mount({props:{dealer:source('portrait','image/png'),background:source('background','image/webp'),table:source('table','image/png'),settings,
    compositing:{mode:'green-screen',threshold:.3,softness:.1,despill:.4}}});
  try {
    await settle();await view.visible(true);
    assert.equal(view.ready,1);assert.equal(view.renders.length,1);assert.equal(view.frames.size,0);
    const {scene,assets,actor,cards}=view.renders[0];
    assert.equal(scene.stage.mobile.x,.12);assert.equal(scene.tableFront,true);assert.equal(scene.key.enabled,true);
    assert.equal(scene.key.threshold,.3);assert.equal(assets.size,3);assert.equal(cards.length,0);
    assert.equal(actor.context.lastDraw[0],assets.get('dealer').el);
  } finally {view.cleanup();}
});

test('fullframe preview ignores independent layer sources and never loads the compositor',async()=>{
  const view=mount({props:{background:source('unused-background'),table:source('unused-table')}});
  try {
    await settle();
    assert.equal(view.elements.length,1);assert.equal(view.renders.length,0);assert.equal(view.ready,1);
  } finally {view.cleanup();}
});


test('still dealer cards draw one composited video frame and never play or schedule animation',async()=>{
  const view=mount({props:{settings:defaultCompositionSettings(),still:true,controls:false}});
  try {
    await settle();await view.visible(true);
    const video=view.elements.find(element=>'playCalls' in element);
    assert.equal(view.ready,1);assert.equal(view.renders.length,1);assert.equal(view.frames.size,0);
    assert.equal(video.playCalls,0);
    await view.toggle();await view.hidden(true);await view.hidden(false);
    assert.equal(video.playCalls,0);assert.equal(view.renders.length,1);assert.equal(view.frames.size,0);
    const moving=view.PlayerSceneCanvas({...view.allProps,still:false});
    assert.notEqual(moving.key,view.root.key);
  } finally {view.cleanup();}
});
