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
const sharedFilename = fileURLToPath(new URL('../../../web/public/published-scene.mjs',import.meta.url));
const sharedCode = ts.transpileModule(readFileSync(sharedFilename,'utf8'),{fileName:'published-scene.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const source = (name='dealer',contentType='video/mp4')=>({src:'/api/operators/fixture/preview/'+name,contentType});
const settle = ()=>new Promise(resolve=>setImmediate(resolve));

test('roulette action plays twice with its own framing and isolates a broken take',async()=>{
  const framing={scale:1,x:0,y:0}, actionFraming={scale:.75,x:.1,y:0};
  const view=mount({props:{settings:defaultCompositionSettings(),background:source('background'),dealer:{...source(),framing,wheelStart:{...source('start','video/webm'),framing:actionFraming,durationMs:10042}}}});
  try{
    await settle();await view.visible(true);await settle();
    const [base,background]=view.elements.filter(el=>el.src&&el.play);
    const start=view.elements.find(el=>el.src?.endsWith('/start'));
    assert.equal(start.playCalls,0);
    for(let i=0;i<2;i++){
      const times=[],play=view.scene.playWheelStart({onFrame:ms=>times.push(ms)});await settle();
      assert.equal(base.paused,true);assert.equal(start.paused,false);assert.equal(background.paused,false);assert.equal(start.loop,false);
      assert.equal(view.renders.at(-1).assets.get('dealer').profile.framing,actionFraming);
      start.currentTime=2;for(const cb of [...view.frames.values()])cb();assert.ok(times.includes(2000));
      start.dispatchEvent(new Event('ended'));assert.equal(await play,true);await settle();assert.equal(base.paused,false);
    }
    const play=view.scene.playWheelStart();await settle();start.dispatchEvent(new Event('error'));
    assert.equal(await play,false);await settle();assert.equal(await view.scene.playWheelStart(),false);
    assert.equal(base.paused,false);assert.equal(background.paused,false);assert.equal(view.failures,0);
  }finally{view.cleanup();}
});

test('roulette action validates decoded duration and completes when hidden or closed',async()=>{
  for(const durationMs of [9000,10042]){
    const view=mount({props:{settings:defaultCompositionSettings(),dealer:{...source(),framing:{scale:1,x:0,y:0},wheelStart:{...source('start','video/webm'),framing:{scale:1,x:0,y:0},durationMs}}}});
    try{await settle();await view.visible(true);await settle();const play=view.scene.playWheelStart();await settle();
      if(durationMs===9000)assert.equal(await play,false);
      else{await view.hidden(true);assert.equal(await play,false);await view.hidden(false);const again=view.scene.playWheelStart();await settle();view.cleanup();assert.equal(await again,false);}
    }finally{view.cleanup();}
  }
});

function mount({reduced=false,defer=false,deferVariants=false,props={},sharedOptions={},videoSize=[1080,1920],variantSize=videoSize}={}) {
  const refs=[],states=[],effects=[],elements=[],frames=new Map(),renders=[];
  let ready=0,failures=0,nextFrame=0,renderCalls=0,sharedScene;
  class Canvas extends EventTarget {
    width=720; height=1280;
    context={draws:[],clearRect(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},getImageData(){return {data:new Uint8ClampedArray([30,25,20,255,180,140,100,255])};},putImageData(pixels){this.pixels=pixels;},drawImage(...args){renderCalls++;this.lastDraw=args;this.draws.push({args,operation:this.globalCompositeOperation});}};
    getContext(){return this.context;}
  }
  class Video extends EventTarget {
    src=''; currentTime=0; duration=10.042; videoWidth=1080; videoHeight=1920; paused=true; muted=false; defaultMuted=false; loadCalls=0; playCalls=0;
    get currentSrc(){return this.src;}
    load(){this.loadCalls++;[this.videoWidth,this.videoHeight]=this.src.includes('variant')?variantSize:videoSize;if(this.src&&!defer&&!(deferVariants&&this.src.includes('variant')))queueMicrotask(()=>this.dispatchEvent(new Event('loadeddata')));}
    play(){this.playCalls++;this.paused=false;return Promise.resolve();}
    pause(){this.paused=true;}
    removeAttribute(name){if(name==='src')this.src='';}
  }
  class Picture extends EventTarget {
    value=''; naturalWidth=800; naturalHeight=1200;
    set src(value){this.value=value;if(value.includes('alpha-mask')){this.naturalWidth=1080;this.naturalHeight=1920;}if(value&&!defer)queueMicrotask(()=>this.dispatchEvent(new Event('load')));}
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
    if(specifier.endsWith('/published-scene.mjs')) {
      const shared={...context,module:{exports:{}},exports:null};shared.exports=shared.module.exports;
      vm.runInNewContext(sharedCode,shared,{filename:sharedFilename});return {mountPublishedScene:(canvas,options)=>(sharedScene=shared.module.exports.mountPublishedScene(canvas,{...options,...sharedOptions}))};
    }
    if(specifier==='react')return React;
    if(specifier==='react/jsx-runtime')return {jsx:(type,props,key)=>({type,props,key}),jsxs:(type,props,key)=>({type,props,key})};
    if(specifier==='/composition-runtime/compositor.js')return {Compositor};
    if(specifier.includes('composition-settings.mjs'))return require('../../../web/public/composition-settings.mjs');
    if(specifier.includes('dealer-framing.mjs'))return require('../../../web/public/dealer-framing.mjs');
    throw Error('Unexpected module: '+specifier);
  };
  const context={module:{exports:{}},exports:null,require:localRequire,document,window:{matchMedia:()=>motion,IntersectionObserver:Observer},Image:Picture,HTMLVideoElement:Video,IntersectionObserver:Observer,AbortController,Event,queueMicrotask,setTimeout,clearTimeout,
    requestAnimationFrame(callback){const id=++nextFrame;frames.set(id,callback);return id;},cancelAnimationFrame(id){frames.delete(id);}};
  context.exports=context.module.exports;
  vm.runInNewContext(code,context,{filename});
  const {PlayerSceneCanvas}=context.module.exports;
  const allProps={dealer:source(),background:null,table:null,settings:null,label:'Publicerad dealer',onReady:()=>ready++,onFailure:()=>failures++,...props};
  const root=PlayerSceneCanvas(allProps),tree=root.type(root.props);
  const cleanup=effects[0]();
  return {tree,root,PlayerSceneCanvas,allProps,states,refs,stage,elements,frames,renders,document,motion,observer:Observer.current,cleanup,
    get ready(){return ready;},get failures(){return failures;},get renderCalls(){return renderCalls;},get scene(){return sharedScene;},
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


test('landscape roulette can render shared background and table without a legacy dealer',async()=>{
  const view=mount({props:{settings:defaultCompositionSettings()},sharedOptions:{dealer:null,layout:'desktop',background:source('room','image/webp'),table:source('table','image/png')}});
  try{
    await settle();await view.visible(true);
    assert.equal(view.ready,1);assert.equal(view.failures,0);assert.equal(view.frames.size,0);
    assert.equal(view.renders[0].scene.layout,'desktop');assert.equal(view.renders[0].scene.show.dealer,false);
    assert.equal(view.renders[0].assets.has('dealer'),false);assert.equal(view.renders[0].assets.size,2);
  }finally{view.cleanup();}
});

test('MP4 table uses a registered alpha mask and playback follows visibility and user pause',async()=>{
  const view=mount({props:{settings:defaultCompositionSettings()},sharedOptions:{dealer:null,layout:'desktop',background:source('room-video'),table:source('table-video'),tableMask:source('alpha-mask','image/png')}});
  try{
    await settle();await view.visible(true);
    assert.equal(view.ready,1);assert.equal(view.failures,0);
    const assets=view.renders[0].assets,table=assets.get('table').el;
    assert.equal(table.context.draws[0].operation,'source-over');
    assert.equal(table.context.draws[1].operation,'destination-in');
    assert.equal(table.context.draws[1].args[0],assets.get('tableMask').el);
    const videos=view.elements.filter(element=>'playCalls' in element);
    assert.equal(videos.length,2);assert.ok(videos.every(video=>!video.paused&&video.muted&&video.loop));
    const tableVideo=videos.find(video=>video.src.endsWith('table-video'));tableVideo.currentTime=1;
    const callback=view.frames.values().next().value;view.frames.clear();callback();
    assert.equal(table.context.draws.length,4);assert.match(table.src,/@1$/);
    await view.hidden(true);assert.ok(videos.every(video=>video.paused));
    await view.hidden(false);await view.toggle();assert.ok(videos.every(video=>video.paused));
    assert.equal(view.frames.size,0);
  }finally{view.cleanup();}
});

test('misregistered or animated table masks fail closed',async()=>{
  for(const tableMask of [source('wrong-ratio','image/png'),source('mask-video')]){
    const view=mount({props:{settings:defaultCompositionSettings()},sharedOptions:{dealer:null,table:source('table-video'),tableMask}});
    try{await settle();assert.equal(view.ready,0);assert.equal(view.failures,1);assert.equal(view.frames.size,0);}
    finally{view.cleanup();}
  }
});

test('roulette hands share the framed actor and optional variants wait until a round ends',async()=>{
  const framing={scale:.66,x:.15,y:-.148},clips=[];
  const dealer={...source('base','video/webm'),framing,foregroundPolygons:[[[.5,0],[.9,0],[.9,.85],[.5,.85]]],variants:[{...source('variant','video/webm'),framing}]};
  const view=mount({videoSize:[1916,1080],props:{settings:defaultCompositionSettings()},sharedOptions:{dealer,layout:'desktop',background:source('background'),table:source('table','image/png'),onDealerClip:value=>clips.push(value)}});
  try{
    await settle();await view.visible(true);
    const rendered=view.renders.at(-1),base=view.elements.find(e=>e.src?.endsWith('/base')),variant=view.elements.find(e=>e.src?.endsWith('/variant'));
    assert.equal(rendered.actor.width,1920);assert.equal(rendered.actor.height,1080);
    assert.equal(rendered.scene.handmatte,'dealer-foreground');assert.equal(rendered.scene.layerMode,'split');
    assert.equal(rendered.assets.get('dealer-foreground').el.context.pixels.data[0],0);
    assert.equal(rendered.assets.get('dealer-foreground').el.context.pixels.data[4],255);
    assert.equal(rendered.actor.context.lastDraw[0],base);assert.equal(variant.playCalls,0);
    view.scene.setRoundActive(true);
    for(let i=0;i<4;i++){base.dispatchEvent(new Event('ended'));await settle();}
    assert.equal(variant.playCalls,0);assert.equal(base.paused,false);
    view.scene.setRoundActive(false);base.dispatchEvent(new Event('ended'));await settle();
    assert.equal(variant.paused,false);assert.equal(base.paused,true);assert.equal(clips.at(-1).variant,true);
    variant.dispatchEvent(new Event('ended'));await settle();
    assert.equal(base.paused,false);assert.equal(variant.paused,true);assert.equal(clips.at(-1).variant,false);
    variant.dispatchEvent(new Event('error'));await settle();
    assert.equal(view.failures,0);assert.equal(base.loop,true);
  }finally{view.cleanup();}
});

test('roulette rejects differently sized variants before playback without losing its base',async()=>{
  const framing={scale:1,x:0,y:0};
  const view=mount({videoSize:[1916,1080],variantSize:[1080,1920],props:{settings:defaultCompositionSettings()},sharedOptions:{dealer:{...source('base'),framing,variants:[{...source('variant'),framing}]}}});
  try{await settle();await view.visible(true);assert.equal(view.ready,1);assert.equal(view.failures,0);const videos=view.elements.filter(e=>'playCalls'in e);assert.equal(videos[0].paused,false);assert.equal(videos[1].playCalls,0);assert.equal(videos[1].src,'');}
  finally{view.cleanup();}
});

test('slow optional roulette takes do not delay base readiness and close aborts every load',async()=>{
  const framing={scale:1,x:0,y:0};
  const view=mount({deferVariants:true,props:{settings:defaultCompositionSettings()},sharedOptions:{dealer:{...source('base'),framing,variants:[1,2,3].map(i=>({...source('variant-'+i),framing}))}}});
  await settle();await view.visible(true);
  assert.equal(view.ready,1);assert.equal(view.elements.filter(e=>'playCalls'in e&&e.playCalls>0).length,1);
  const count=view.elements.length;view.cleanup();await settle();
  assert.equal(view.elements.length,count);assert.ok(view.elements.filter(e=>'playCalls'in e).every(e=>e.src===''&&e.paused));
  assert.equal(view.failures,0);
});
