import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const code=fs.readFileSync(new URL('../runtime/public/dealer-engine.mjs',import.meta.url),'utf8').replace("import {createActorCompositor} from './actor-compositor.mjs';",'const createActorCompositor=()=>{throw Error("unexpected rebuild")};');
const {DealerEngine}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('isolated lease survives awaited fetch, nested releases, duplicate start and resumes one cursor without catch-up paint',async()=>{
 const originals={setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:globalThis.requestAnimationFrame,EncodedVideoChunk:globalThis.EncodedVideoChunk};
 const sleeps=[],rafs=[],intervals=[];let paints=0,fetches=0,submits=0;
 globalThis.setTimeout=(fn)=>{sleeps.push(fn);return sleeps.length;};globalThis.clearTimeout=()=>{};
 globalThis.setInterval=(fn)=>{intervals.push(fn);return intervals.length;};globalThis.clearInterval=()=>{};
 globalThis.requestAnimationFrame=fn=>{rafs.push(fn);return rafs.length;};globalThis.EncodedVideoChunk=class {constructor(x){Object.assign(this,x);}};
 const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
 try {
  const e=new DealerEngine({width:1,height:1,getContext:()=>({clearRect(){},drawImage(){paints++;}})},'/fake');
  e.index={clips:{idle:{frames:Array.from({length:100},()=>[0,1])}}};e.frameUs=41667;e.fetchClip=()=>{fetches++;return new Promise(resolve=>{e.resolveFetch=resolve;});};
  e.decoder={decodeQueueSize:0,decode(){submits++;this.decodeQueueSize++;}};
  await e.start();assert.equal(fetches,1);const release1=e.suspendPresentation(),release2=e.suspendPresentation();
  e.resolveFetch(new ArrayBuffer(1));await flush();assert.equal(submits,0,'fetch continuation must not decode under lease');
  await e.start();assert.equal(rafs.length,1,'duplicate start must not add presenter');assert.equal(intervals.length,2,'duplicate start must not add watchdog/heartbeat');
  e.display.push({f:{close(){}},key:'idle',frame:0});rafs.shift()();assert.equal(paints,0,'suspended presenter must not draw');
  release1();release1();assert.equal(e.presentationSuspended,true);sleeps.shift()();await flush();assert.equal(submits,0,'nested lease still owns engine');
  release2();assert.equal(e.presentationSuspended,false);assert.equal(e.suspensionStats.released,2);
  sleeps.shift()();await flush();assert.equal(submits,23,'one feeder fills remaining capacity, original frame retained');assert.equal(fetches,1,'resume does not start another clip');
  e.presentHands=()=>{};e.display.push({f:{close(){}},key:'idle',frame:1});rafs.shift()();assert.equal(paints,1,'resume resets deadline instead of catch-up draining');assert.equal(e.display.length,1);
  assert.equal(e.decoder.decodeQueueSize,23);e.stop();
 } finally {for(const [k,v] of Object.entries(originals)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
