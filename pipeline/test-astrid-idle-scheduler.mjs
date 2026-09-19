import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createIdleScheduler,idleSegmentErrors,interruptFrame,mulberry32} from '../web/public/astrid-idle-scheduler.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const idlePath=path.resolve(dir,'../web/public/review/astrid-green-waiting/idle.json');
const idle=fs.existsSync(idlePath)?JSON.parse(fs.readFileSync(idlePath)):null;
const segments=idle?.segments??{base:{start:90,end:120},glanceLeft:{start:0,end:41},glanceRight:{start:41,end:90},full:{start:0,end:120}};

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

test('segments only start and end on ready-pose frames, so an interrupt waits for the segment end',()=>{
  const take={frames:121,readyFrames:[0,41,90,120],segments};
  assert.deepEqual(idleSegmentErrors(take),[]);
  for(const s of Object.values(segments))assert.ok(take.readyFrames.includes(interruptFrame(s)));
  assert.ok(idleSegmentErrors({...take,segments:{...segments,bad:{start:10,end:41}}}).some(e=>e.includes('bad')));
  assert.ok(idleSegmentErrors({...take,segments:{glanceLeft:segments.glanceLeft}}).some(e=>e.includes('base')));
});

test('the installed idle manifest validates against the takes it cuts to',{skip:!idle},()=>{
  const dealer=JSON.parse(fs.readFileSync(path.resolve(dir,'../web/public/review/astrid-table-v2/take.json')));
  assert.equal(idle.action,'idle');assert.equal(idle.frames,121);assert.equal(idle.fps,24);
  assert.deepEqual(idle.camera.placement,dealer.camera.placement);
  assert.deepEqual(idleSegmentErrors(idle),[]);
  assert.equal(idle.segments.base.end,idle.frames-1);
  assert.match(idle.sha256,/^[a-f0-9]{64}$/);
});
