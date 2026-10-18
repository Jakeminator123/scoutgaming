import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createIdleScheduler,idleSegmentErrors,interruptFrame,mulberry32} from '../../services/game/public/astrid-idle-scheduler.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../../services/game/public');
const idlePath=path.join(root,'review/astrid-green-waiting/idle.json');
const idle=fs.existsSync(idlePath)?JSON.parse(fs.readFileSync(idlePath)):null;
const glanceSegments=idle?.segments??{glanceLeft:{start:0,end:41},glanceRight:{start:41,end:90},full:{start:0,end:120}};
const segments={base:{start:0,end:192},...glanceSegments};
test('folded resting clips bind to the current ready pose and retain a filmed bridge in both directions',{skip:!idle?.rest},()=>{
  const rest=idle.rest;assert.deepEqual(idleSegmentErrors(idle),[]);
  for(const key of ['loop','out','back']){
    const media=rest[key];assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,media.src))).digest('hex'),media.sha256,key);
  }
  assert.equal(rest.out.sourceSha256,rest.back.sourceSha256);
  assert.deepEqual(rest.out.sourceFrames,[...rest.back.sourceFrames].reverse());
  const stale=structuredClone(idle);stale.rest.readySha256='another-pose';
  assert.ok(idleSegmentErrors(stale).includes('folded rest ready pose mismatch'));
});

test('the waiting cadence never glances twice in a row and never idles more than 3 base loops',()=>{
  for(const seed of [1,7,42,2026,987654]){
    const s=createIdleScheduler({segments,random:mulberry32(seed)});
    const run=['base',...Array.from({length:2000},()=>s.next())];
    let baseRun=0,glances=0;
    for(let i=0;i<run.length;i++){
      const glance=run[i]!=='base';
      if(glance){assert.ok(i===0||run[i-1]==='base',`seed ${seed}: two glances in a row at ${i}`);glances++;baseRun=0;}
      else{baseRun++;assert.ok(baseRun<=3,`seed ${seed}: ${baseRun} base loops without a glance at ${i}`);}
      assert.ok(run[i] in segments,`unknown segment ${run[i]}`);
    }
    const share=glances/run.length;
    assert.ok(share>.2&&share<.5,`seed ${seed}: glance share ${share.toFixed(2)} is not roughly every 2nd or 3rd loop`);
    const kinds=new Set(run.filter(n=>n!=='base'));
    assert.ok(kinds.has('glanceLeft')&&kinds.has('glanceRight')&&kinds.has('full'),'all glance kinds are drawn');
  }
});

test('the cadence is not periodic: base holds vary in length',()=>{
  const s=createIdleScheduler({segments,random:mulberry32(3)});
  const runs=[];let run=0;
  for(let i=0;i<3000;i++){const n=s.next();if(n==='base')run++;else{if(run)runs.push(run);run=0;}}
  assert.ok(new Set(runs).size>=3,'base run lengths 1, 2 and 3 all occur');
});

test('glance segments only start and end on the waiting clip ready-pose frames; base is its own loop',()=>{
  const take={base:{src:'b.mp4',frames:193},glances:{src:'g.mp4',frames:121,readyFrames:[0,41,90,120]},segments:glanceSegments,spliceOffset:[0,15.3]};
  assert.deepEqual(idleSegmentErrors(take),[]);
  for(const s of Object.values(glanceSegments))assert.ok(take.glances.readyFrames.includes(interruptFrame(s)));
  assert.ok(idleSegmentErrors({...take,segments:{...glanceSegments,bad:{start:10,end:41}}}).some(e=>e.includes('bad')));
  assert.ok(idleSegmentErrors({...take,segments:{...glanceSegments,base:{start:90,end:120}}}).some(e=>e.includes('base must be')));
  assert.ok(idleSegmentErrors({...take,base:undefined}).some(e=>e.includes('base media')));
  assert.ok(idleSegmentErrors({...take,spliceOffset:[1]}).some(e=>e.includes('spliceOffset')));
});

test('the installed idle keeps the eye-contact loop as base and splices 15777d5f glances with the measured offset',{skip:!idle},()=>{
  const dealer=JSON.parse(fs.readFileSync(path.join(root,'review/astrid-table-v2/take.json')));
  const elevated=JSON.parse(fs.readFileSync(path.join(root,'review/astrid-elevated-idle/idle.json')));
  assert.equal(idle.action,'idle');assert.deepEqual(idleSegmentErrors(idle),[]);
  assert.equal(idle.base.jobId,'2a721f7d-c2da-4e7a-9812-9d9b4a087232');
  assert.equal(idle.base.src,elevated.src);assert.equal(idle.base.sha256,elevated.sha256);assert.equal(idle.base.frames,193);
  assert.equal(idle.glances.jobId,'15777d5f-4085-484e-a170-eb5c9a13d7b0');assert.equal(idle.glances.frames,121);
  assert.ok(!idle.segments.base,'no waiting-clip frames are used as base');
  assert.deepEqual(Object.keys(idle.segments).sort(),['full','glanceLeft','glanceRight']);
  assert.deepEqual(idle.camera.placement,dealer.camera.placement);assert.deepEqual(idle.glances.camera.placement,dealer.camera.placement);
  assert.deepEqual(idle.base.crop.slice(0,2),idle.glances.crop.slice(0,2),'shared crop origin');
  assert.equal(idle.spliceOffset[0],0);assert.ok(Math.abs(idle.spliceOffset[1]-15.3)<1e-9);
});
