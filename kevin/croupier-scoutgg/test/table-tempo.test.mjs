import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSharedTable} from '../server/shared-table.mjs';
import {kartaFor} from '../server/rorlig-lipsync.mjs';
import {formatUrl} from '../public/clip-format.js';

// Emil 28 Oct: a studio table's tempo (Slow 1, Normal 1.5, Fast 2, Turbo 2.5) runs a ready dealer's deal takes that much
// faster. Each take keeps its own frames (media time); only its wall-clock slot shrinks.
const manifest={deal:[1,2,3,4,5,6,7,'dealer'].map(i=>({id:`deal_pos${i}`,url:`/${i}.mp4`,dur:.1})).concat(['hole','flip'].map(i=>({id:`deal_${i}`,url:`/${i}.mp4`,dur:.1}))),repliker:[],idle:[]};
const take={'-':26,'-i':53,'-u':53,'-iu':80},frames=Object.fromEntries(['1','2','3','4','5','6','7','dealer','hole','flip'].map(k=>[k,take]));
function opening(tempo){
  const dir=mkdtempSync(join(tmpdir(),'tempo-')),time=100000;
  const s=createSharedTable(join(dir,'t.sqlite'),{manifest,now:()=>time,readyFor:()=>({frames}),tempoFor:()=>tempo});
  try{
    const st=()=>s.run('kevin',{session:'t',op:'state'});const send=(op,extra={})=>s.run('kevin',{session:'t',op,version:st().version,requestId:crypto.randomUUID(),...extra});
    send('join',{name:'Kevin',seats:[3]});send('bet',{seat:3,field:'main',chip:5});send('ready');
    const plan=st().plan;return{plan,run:plan.steps.filter(x=>x.clip&&(x.kind==='deal'||x.kind==='reveal'))};
  }finally{s.close();rmSync(dir,{recursive:true,force:true});}
}

test('a table at tempo T gives each deal take frames/(24*T) of wall time, says the rate on the step, and keeps its frames', () => {
  const slow=opening(1);
  assert.ok(slow.run.every(x=>x.rate===undefined),'Slow (1x) is exactly as before: no rate on any step');
  assert.equal(slow.plan.tempo,undefined);
  for(const T of [1.5,2,2.5]){
    const {plan,run}=opening(T);
    assert.equal(plan.tempo,T);
    for(const x of run){
      assert.equal(x.rate,T);
      assert.equal(x.frames,frames[x.track??x.seat][`-${x.variant}`]);
      assert.ok(Math.abs((x.endAt-x.startAt)-x.frames/24/T*1000)<1e-6,'the slot is the take at T');
      assert.equal(x.clip.dur,x.frames/24,'the clip keeps its own length (media time)');
    }
    for(let i=1;i<run.length;i++)assert.equal(run[i].startAt,run[i-1].endAt,'the cards still join with no gap');
    // the whole run is its takes at T, back to back
    assert.ok(Math.abs((run.at(-1).endAt-run[0].startAt)-run.reduce((n,x)=>n+x.frames/24/T*1000,0))<1,`the run at ${T}x`);
  }
});

test('the lip-sync map follows the tempo: 24 map frames a second of audio sample his body frames T at a time', () => {
  const s={kind:'deal',seat:3,track:3,variant:'',clip:{url:'/media/deal/pos3.mp4'},startAt:1000,endAt:1000+26/24/2*1000,frames:26,rate:2};
  const map=kartaFor([s],1000,13,{});
  const shown=map.flatMap(([take,f,n])=>Array.from({length:n},(_,i)=>[take,f+i]));
  assert.ok(shown.every(x=>x[0]==='pos3'));
  assert.deepEqual(shown.map(x=>x[1]),[0,2,4,6,8,10,12,14,16,18,20,22,24],'every other body frame at 2x');
  // after the take (ends in REDO) the held frame is its last frame, not one derived from the shorter wall slot
  const after=kartaFor([s],s.endAt+50,2,{});
  assert.equal(after[0][1],25);
  // 1x unchanged
  const one={...s,endAt:1000+26/24*1000,rate:undefined};
  assert.deepEqual(kartaFor([one],1000,26,{}).map(x=>x.slice(1)),[[0,26]]);
});

test("Astrid 2.0's clips are fetched in the visit's format folder; other dealers and other files are untouched", () => {
  assert.equal(formatUrl('/media/dealers/astrid2/v2/pos3-iu.mp4?v=1','av1'),'/media/dealers/astrid2/v2-av1/pos3-iu.mp4?v=1');
  assert.equal(formatUrl('/media/dealers/astrid2/idle-v2/andas.mp4','hevc'),'/media/dealers/astrid2/idle-v2-hevc/andas.mp4');
  assert.equal(formatUrl('/media/dealers/astrid2/repliker/en/win_1.mp4','h264'),'/media/dealers/astrid2/repliker-h264/en/win_1.mp4');
  assert.equal(formatUrl('https://media.scoutgg.dev/media/dealers/astrid2/v2/pos1.mp4','av1'),'https://media.scoutgg.dev/media/dealers/astrid2/v2-av1/pos1.mp4');
  assert.equal(formatUrl('/media/dealers/paow/v2/pos3.mp4','av1'),'/media/dealers/paow/v2/pos3.mp4');
  assert.equal(formatUrl('/media/dealers/astrid2/v2/vila.png','av1').includes('v2-av1'),true,'a still in the folder is in every format folder too');
  assert.equal(formatUrl('/media/dealers/astrid2/v2/pos3.mp4','orig'),'/media/dealers/astrid2/v2/pos3.mp4');
});
