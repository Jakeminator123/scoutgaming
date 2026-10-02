import {resolveMediaAbsolutePath} from '../tools/media-layout.mjs';
const mediaUrl=(value,base)=>{const old=new URL(value,base),result=pathToFileURL(resolveMediaAbsolutePath(fileURLToPath(old)));if(old.pathname.endsWith('/')&&!result.pathname.endsWith('/'))result.pathname+='/';return result;};
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {selectSceneJoin,validateSceneJoin,sceneJoinPayload} from '../web/public/scene-join.mjs';
import {PerformancePlayer} from '../web/public/performance-player.mjs';
const root=mediaUrl('../web/public/',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(mediaUrl(p,root)));
const manifest=read('dealers/astrid/performance/joins/manifest.json');
const takes=read('dealers/astrid/performance/smooth60/manifest.json').takes;
const idle=read('dealers/astrid/actor/provenance.json').sources['idle-1/idle/idle'];
const sha=b=>createHash('sha256').update(b).digest('hex');
test('each real take has a frame-bound entry and exit, with a 60 fps actor clock',()=>{
  for(const take of takes)for(const edge of ['entry','exit'])assert.ok(selectSceneJoin(manifest,take,edge,idle),`${take.id} ${edge}`);
  for(const j of manifest.joins){
    assert.deepEqual(validateSceneJoin(j),[]);assert.equal(sha(sceneJoinPayload(j)),j.calibrationSha256);
    const file=mediaUrl(j.media.src,root);assert.equal(sha(fs.readFileSync(file)),j.media.sha256);
    const p=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,nb_read_frames,r_frame_rate,has_b_frames','-of','json',fileURLToPath(file)])).streams[0];
    assert.equal(p.width,1920);assert.equal(p.height,2160);assert.equal(p.r_frame_rate,'60/1');assert.equal(p.has_b_frames,0);assert.equal(Number(p.nb_read_frames),j.media.frames);
  }
});
test('changed idle, actor source, or contact calibration cannot reuse a join',()=>{
  const take=takes[0];
  assert.equal(selectSceneJoin(manifest,take,'exit',{...idle,matteSha256:'1'.repeat(64)}),null);
  const changed=structuredClone(take);changed.media.sha256='1'.repeat(64);assert.equal(selectSceneJoin(manifest,changed,'exit',idle),null);
  const regraded=structuredClone(take);regraded.calibrationSha256='2'.repeat(64);assert.equal(selectSceneJoin(manifest,regraded,'entry',idle),null);
  assert.equal(selectSceneJoin(manifest,take,'unknown',idle),null);
});
test('the actor is not released until the return and matched idle have both finished',async()=>{
  const events=[];let returnDone,idleDone;
  const actor={staged:true,joins:manifest,idle,held:{take:takes[0]},
    playJoin:()=>{events.push('return');return new Promise(r=>returnDone=r);},
    prepareIdle:()=>{events.push('idle');return new Promise(r=>idleDone=r);},release:()=>events.push('release')};
  const finished=PerformancePlayer.prototype.finish.call(actor);
  assert.deepEqual(events,['return']);returnDone();await Promise.resolve();
  assert.deepEqual(events,['return','idle']);idleDone();await finished;
  assert.deepEqual(events,['return','idle','release']);
});
test('an interrupted return cleans up instead of freezing the actor over decisions',async()=>{
  let released=false;
  const actor={staged:true,joins:manifest,idle,held:{take:takes[0]},playJoin:async()=>{throw new Error('Interrupted');},prepareIdle:async()=>assert.fail('No idle preparation after failure'),release:()=>released=true};
  await assert.rejects(PerformancePlayer.prototype.finish.call(actor),/Interrupted/);assert.equal(released,true);
});
test('recorded speech waits across the entire dealing sequence, including media loading',async()=>{
  const actor={sequence:true,active:null,held:null,releaseWaiters:new Set(),host:{classList:{remove(){}}}};
  let speech=false;
  const ready=PerformancePlayer.prototype.whenReleased.call(actor).then(()=>speech=true);
  await Promise.resolve();assert.equal(speech,false);
  PerformancePlayer.prototype.release.call(actor);await ready;assert.equal(speech,true);assert.equal(actor.releaseWaiters.size,0);
});
test('cancelled speech leaves no waiting callback on a dealing sequence',async()=>{
  const actor={sequence:true,releaseWaiters:new Set()},controller=new AbortController();
  const ready=PerformancePlayer.prototype.whenReleased.call(actor,controller.signal);controller.abort();
  await assert.rejects(ready,{name:'AbortError'});assert.equal(actor.releaseWaiters.size,0);
});
