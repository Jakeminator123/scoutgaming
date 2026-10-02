import {resolveMediaAbsolutePath} from '../tools/media-layout.mjs';
const mediaUrl=(value,base)=>{const old=new URL(value,base),result=pathToFileURL(resolveMediaAbsolutePath(fileURLToPath(old)));if(old.pathname.endsWith('/')&&!result.pathname.endsWith('/'))result.pathname+='/';return result;};
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {sceneJoinPayload} from '../web/public/scene-join.mjs';
import {readyMotionErrors} from '../web/public/ready-motion.mjs';
import {PerformancePlayer} from '../web/public/performance-player.mjs';
const pub=mediaUrl('../web/public/',import.meta.url),read=p=>JSON.parse(fs.readFileSync(mediaUrl(p,pub)));
const takes=read('dealers/astrid/performance/smooth60/manifest.json').takes,idle=read('dealers/astrid/actor/provenance.json').sources['idle-1/idle/idle'];
const old=read('dealers/astrid/performance/joins/manifest.json');
function fixture(){const loop=structuredClone(old.joins[0]);loop.ready={kind:'loop',loopSha256:loop.media.sha256};const speech=structuredClone(loop);speech.ready.kind='speech';return {status:'review',loop,speech,joins:old.joins.map(j=>({...structuredClone(j),ready:{kind:j.bindings[0].edge,loopSha256:loop.media.sha256}}))};}
test('ready lifecycle requires all take entries, exits, loop and paired speech',()=>{
 const m=fixture();assert.deepEqual(readyMotionErrors(m,takes,idle),[]);
 for(const broken of [null,{...m,speech:null},{...m,joins:m.joins.slice(1)}])assert.ok(readyMotionErrors(broken,takes,idle).length);
 const changed=structuredClone(m);changed.loop.media.sha256='0'.repeat(64);assert.ok(readyMotionErrors(changed,takes,idle).length);
 assert.ok(readyMotionErrors(m,takes,{...idle,sha256:'0'.repeat(64)}).length);
});
test('speech waits for the moving loop and filmed idle return before release',async()=>{
 const events=[];let stopDone;
 const actor={readyPose:true,ready:{speech:{}},leavingReady:null,stopWaiting:()=>new Promise(r=>stopDone=r),playJoin:async()=>events.push('bridge'),prepareIdle:async()=>events.push('idle'),release:()=>events.push('release')};
 const pending=PerformancePlayer.prototype.leaveReady.call(actor);assert.deepEqual(events,[]);stopDone();await pending;
 assert.deepEqual(events,['bridge','idle','release']);assert.equal(actor.leavingReady,null);
});
test('concurrent speech return requests share one transition',async()=>{
 let transitions=0,stopDone;
 const actor={readyPose:true,ready:{speech:{}},leavingReady:null,stopWaiting:()=>new Promise(r=>stopDone=r),playJoin:async()=>transitions++,prepareIdle:async()=>{},release:()=>{}};
 const a=PerformancePlayer.prototype.leaveReady.call(actor),b=PerformancePlayer.prototype.leaveReady.call(actor);stopDone();await Promise.all([a,b]);assert.equal(transitions,1);
});
test('a failed speech-return bridge releases actor ownership',async()=>{
 let released=false;
 const actor={readyPose:true,ready:{speech:{}},leavingReady:null,stopWaiting:async()=>{},playJoin:async()=>{throw Error('decode');},prepareIdle:async()=>assert.fail(),release:()=>released=true};
 await assert.rejects(PerformancePlayer.prototype.leaveReady.call(actor),/decode/);assert.ok(released);assert.equal(actor.leavingReady,null);
});
test('installed ready motion covers every actual take with a bounded loop',()=>{
 const m=read('dealers/astrid/performance/joins/ready/manifest.json');
 assert.deepEqual(readyMotionErrors(m,takes,idle),[]);
 assert.ok(m.loop.media.frames/m.loop.media.fps<=1.2,'waiting must not delay an action for a four-second source loop');
 for(const clip of [m.loop,m.speech,...m.joins]){
  const file=mediaUrl(clip.media.src,pub),sha=x=>createHash('sha256').update(x).digest('hex');
  assert.equal(sha(fs.readFileSync(file)),clip.media.sha256);assert.equal(sha(sceneJoinPayload(clip)),clip.calibrationSha256);
  const v=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-count_frames','-show_entries','stream=width,height,r_frame_rate,nb_read_frames,has_b_frames','-of','json',fileURLToPath(file)])).streams[0];
  assert.equal(v.width,1920);assert.equal(v.height,2160);assert.equal(v.r_frame_rate,'60/1');assert.equal(Number(v.nb_read_frames),clip.media.frames);assert.equal(v.has_b_frames,0);
 }
});
