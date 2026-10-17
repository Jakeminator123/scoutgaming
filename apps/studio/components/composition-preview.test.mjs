import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import React from 'react';
import {createBackgroundPlayback} from '../../../packages/presentation/runtime/background-playback.mjs';
import {defaultBackgroundRule} from '../../../packages/presentation/contracts/background-playback-policy.mjs';
import {defaultCompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';

const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
const source=new URL('./composition-preview.tsx',import.meta.url);
const {code}=transformSync(readFileSync(source,'utf8'),{filename:fileURLToPath(source),
  jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
function nodes(tree,predicate){if(Array.isArray(tree))return tree.flatMap(node=>nodes(node,predicate));if(!tree||typeof tree!=='object')return [];return [...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)];}
const text=tree=>Array.isArray(tree)?tree.map(text).join(''):tree&&typeof tree==='object'?text(tree.props?.children):String(tree??'');
const id='00000000-0000-4000-8000-000000000002';

// Render the actual transpiled component, including dependency-sensitive effect
// cleanup. The browser boundary supplies controllable media promises and time;
// the real background scheduler retains its rolling budget and cancellation.
function fixture(t){
  let time=0,serial=0,cursor=0,dirty=true,mounted=true,tree,props,renderedBackground=null;
  const slots=[],pending=new Map(),timers=new Map(),frames=new Map(),videos=[],renderers=[],players=[],draws=[];
  const schedule=(fn,ms)=>{const token=++serial;timers.set(token,{fn,at:time+ms});return token;};
  const cancel=token=>timers.delete(token);
  class Video extends EventTarget {
    tagName='VIDEO';src='';videoWidth=1920;videoHeight=1080;readyState=2;currentTime=0;duration=2;paused=true;deferred=null;playCalls=0;
    get currentSrc(){return this.src;}
    load(){if(this.src)queueMicrotask(()=>this.dispatchEvent(new Event('loadeddata')));}
    play(){this.playCalls++;this.paused=false;if(this.deferred){const value=this.deferred;this.deferred=null;return value.promise;}return Promise.resolve();}
    pause(){this.paused=true;}
    removeAttribute(name){if(name==='src')this.src='';}
    holdNextPlay(){let resolve;const promise=new Promise(done=>{resolve=done;});this.deferred={promise};return resolve;}
  }
  class ImageElement extends EventTarget {
    tagName='IMG';naturalWidth=1920;naturalHeight=1080;value='';
    set src(value){this.value=value;if(value)queueMicrotask(()=>this.dispatchEvent(new Event('load')));}
    get src(){return this.value;}
    removeAttribute(name){if(name==='src')this.value='';}
  }
  class Canvas {width=0;height=0;getContext(){return {};}}
  const document=new EventTarget();document.hidden=false;
  document.createElement=tag=>{if(tag==='video'){const video=new Video();videos.push(video);return video;}if(tag==='canvas')return new Canvas();throw Error('Unexpected DOM '+tag);};
  class Compositor {
    released=[];disposed=false;
    constructor(){renderers.push(this);}
    render(_scene,_actor,assets){renderedBackground=assets.get('background')?.el??null;}
    release(video){this.released.push(video);}
    dispose(){this.disposed=true;}
  }
  const changed=(left,right)=>!left||!right||left.length!==right.length||left.some((value,index)=>!Object.is(value,right[index]));
  const hooks={...React,
    useRef(initial){const n=cursor++;return slots[n]??={current:initial};},
    useState(initial){const n=cursor++;if(!slots[n])slots[n]={value:typeof initial==='function'?initial():initial};return[slots[n].value,value=>{if(!mounted)return;const next=typeof value==='function'?value(slots[n].value):value;if(!Object.is(next,slots[n].value)){slots[n].value=next;dirty=true;}}];},
    useMemo(fn,deps){const n=cursor++;if(!slots[n]||changed(slots[n].deps,deps))slots[n]={deps,value:fn()};return slots[n].value;},
    useEffect(fn,deps){const n=cursor++;if(!slots[n]||changed(slots[n].deps,deps))pending.set(n,{fn,deps});},
  };
  const overrides={react:hooks,'../lib/lab-url.mjs':{labUrl:path=>path},
    '../../../packages/presentation/contracts/dealer-framing.mjs':{drawDealerFrame(_context,source,width,height,framing){draws.push({source,width,height,framing});}},
    '../../../packages/presentation/runtime/background-playback.mjs':{createBackgroundPlayback(policy,options){
      const player=createBackgroundPlayback(policy,{...options,now:()=>time,setTimeout:schedule,clearTimeout:cancel});
      const observed={starts:0,closes:0};players.push(observed);
      return {...player,start(){observed.starts++;player.start();},close(){observed.closes++;player.close();}};
    }},'/preview/compositor.js':{Compositor},
  };
  const module={exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,console,structuredClone,URL,AbortController,
    document,Image:ImageElement,HTMLVideoElement:Video,queueMicrotask,
    setTimeout:schedule,clearTimeout:cancel,requestAnimationFrame:fn=>{const token=++serial;frames.set(token,fn);return token;},cancelAnimationFrame:token=>frames.delete(token),
    require:name=>Object.hasOwn(overrides,name)?overrides[name]:require(name)});
  const {CompositionPreview}=module.exports;
  props={dealer:{url:'/dealer.mp4',label:'Dealer',contentType:'video/mp4'},
    background:{url:'/base.png',label:'Base',contentType:'image/png'},table:null,
    settings:defaultCompositionSettings(),layout:'desktop',show:{dealer:true,background:true,table:false},
    backgroundPlayback:{schemaVersion:1,rules:[defaultBackgroundRule(id,'celebrate')]},
    backgroundAssets:[{id,url:'/event.mp4',label:'Celebration',contentType:'video/mp4'}]};
  let canvasKey,stage;
  function render(){
    if(!mounted)return;cursor=0;dirty=false;tree=CompositionPreview(props);
    const canvas=nodes(tree,node=>node.type==='canvas')[0];
    if(!stage||canvas.key!==canvasKey){stage=new Canvas();canvasKey=canvas.key;}canvas.props.ref.current=stage;
    const effects=[...pending.entries()];pending.clear();
    for(const [n]of effects)slots[n]?.cleanup?.();
    for(const [n,{fn,deps}]of effects)slots[n]={deps,cleanup:fn()};
  }
  async function flush(){
    for(let n=0;n<12;n++){if(dirty)render();await Promise.resolve();}
    if(dirty)render();
  }
  function button(label){const value=nodes(tree,node=>node.type==='button'&&text(node)===label)[0];assert.ok(value,label);return value;}
  function frame(){const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(time));}
  function advance(ms){const end=time+ms;let loops=0;for(;;){const next=[...timers.entries()].filter(([,row])=>row.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;assert.ok(++loops<100,'timer spin');time=next[1].at;timers.delete(next[0]);next[1].fn();}time=end;}
  function unmount(){if(!mounted)return;mounted=false;for(const slot of slots)slot?.cleanup?.();pending.clear();}
  t.after(unmount);
  return {async ready(){await flush();assert.equal(button('Spela').props.disabled,false);assert.equal(players.length,1);},
    click(label){const value=button(label);assert.equal(Boolean(value.props.disabled),false);value.props.onClick();},
    async update(patch){props={...props,...patch};dirty=true;await flush();},flush,frame,advance,unmount,
    hide(){document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));},
    show(){document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));},
    get dealer(){return videos.find(video=>video.src==='/dealer.mp4');},get eventVideos(){return videos.filter(video=>video.playCalls&&video!==this.dealer);},
    videos,players,renderers,draws,button,get background(){return renderedBackground;},get pendingTimers(){return timers.size;},get pendingFrames(){return frames.size;}};
}

test('keystone draws once, reframes without reload and switches to video and back without stale playback',async t=>{
  const h=fixture(t);await h.ready();
  const initialVideo=h.dealer;
  const still={url:'/vila.png',label:'VILA',contentType:'image/png'};
  await h.update({dealer:still});h.frame();
  const image=h.draws.at(-1).source;
  assert.equal(image.src,still.url);assert.equal(image.tagName,'IMG');
  assert.equal(initialVideo.src,'');assert.equal(initialVideo.paused,true);
  assert.equal(h.button('Spela två gånger').props.disabled,true);
  const count=h.draws.length;h.frame();assert.equal(h.draws.length,count,'unchanged still is cached');
  const framing={scale:1.4,x:.1,y:-.2};
  await h.update({framing});h.frame();
  assert.equal(h.draws.at(-1).source,image);assert.deepEqual(h.draws.at(-1).framing,framing);
  await h.update({dealer:{url:'/dealer.mp4',label:'Spin',contentType:'video/mp4'}});h.frame();
  const video=h.dealer;assert.notEqual(video,initialVideo);assert.equal(h.draws.at(-1).source,video);
  assert.equal(h.button('Spela två gånger').props.disabled,false);
  const release=video.holdNextPlay();h.click('Spela');
  await h.update({dealer:still});release();await h.flush();h.frame();
  assert.equal(video.paused,true);assert.equal(video.src,'');
  assert.equal(h.draws.at(-1).source.tagName,'IMG');assert.equal(h.draws.at(-1).source.src,still.url);
  assert.equal(h.button('Spela').props.disabled,true);assert.equal(h.pendingTimers,0);
});

test('hidden preview stays paused when an earlier dealer play promise resolves',async t=>{
  const h=fixture(t);await h.ready();const dealer=h.dealer,release=dealer.holdNextPlay();
  h.click('Spela');h.hide();release();await h.flush();h.show();h.advance(60000);await h.flush();
  assert.equal(h.players[0].starts,0);assert.equal(dealer.paused,true);assert.equal(h.videos.length,1);
  assert.ok(h.button('Spela'));assert.equal(h.pendingTimers,0);
});

test('explicit pause cancels a pending repeat-play attempt and does not restart automation',async t=>{
  const h=fixture(t);await h.ready();h.click('Spela');await h.flush();assert.equal(h.players[0].starts,1);
  const release=h.dealer.holdNextPlay();h.click('Spela två gånger');h.click('Pausa');release();await h.flush();
  h.advance(60000);await h.flush();assert.equal(h.players[0].starts,1);assert.equal(h.dealer.paused,true);
  assert.equal(h.videos.length,1);assert.ok(h.button('Spela'));assert.equal(h.pendingTimers,0);
});

test('unmount cancels media, animation and timers before a delayed play settles',async t=>{
  const h=fixture(t);await h.ready();const dealer=h.dealer,release=dealer.holdNextPlay();h.click('Spela');h.unmount();
  release();await h.flush();h.advance(60000);
  assert.equal(h.players[0].starts,0);assert.equal(h.players[0].closes,1);assert.equal(dealer.paused,true);assert.equal(dealer.src,'');
  assert.equal(h.renderers[0].disposed,true);assert.equal(h.pendingTimers,0);assert.equal(h.pendingFrames,0);
});

test('two manual background plays restore a still base and release each event without resetting dealer or budget',async t=>{
  const h=fixture(t);await h.ready();h.frame();const base=h.background,dealer=h.dealer;assert.equal(base.src,'/base.png');
  for(const request of [1,2]){
    if(request===2)h.advance(25000);
    await h.update({previewBackgroundRuleId:'celebrate',previewBackgroundRequest:request});h.frame();
    const video=h.background;assert.notEqual(video,base);assert.equal(video.src,'/event.mp4');assert.equal(video.muted,true);assert.equal(video.loop,false);
    video.dispatchEvent(new Event('ended'));await h.flush();h.frame();
    assert.equal(h.background,base);assert.equal(video.paused,true);assert.equal(video.src,'');assert.ok(h.renderers[0].released.includes(video));
  }
  assert.equal(dealer.playCalls,0);assert.equal(h.players.length,1);
  const before=h.videos.length;
  await h.update({settings:{...defaultCompositionSettings(),tableFront:true},previewBackgroundRequest:3});
  assert.equal(h.videos.length,before,'placement change and third immediate request cannot reset cooldown');
  assert.equal(h.players.length,1);assert.equal(h.pendingTimers,0);
});
