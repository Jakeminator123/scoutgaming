import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyGrade,compositeProfileErrors,trackedContacts} from '../web/public/actor-grade.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(`../web/public/${p}`,import.meta.url)));
const profile=read('review/amira-composite/profile.json'),tracks=read(profile.contacts);
const speak=read('review/amira-green-speak/speak.json'),idle=read('review/amira-green-waiting/idle.json');

test('profile curves stay finite and monotonic without crushing black or reversing highlights',()=>{
 assert.deepEqual(compositeProfileErrors(profile),[]);
 for(const kind of ['speech','waiting']){
  let previous=-1;
  for(let i=0;i<=1000;i++){
   const rgb=applyGrade([i/1000,i/1000,i/1000],profile[kind]);
   assert.ok(rgb.every(x=>Number.isFinite(x)&&x>=0&&x<=1));
   const l=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;assert.ok(l>=previous);previous=l;
  }
 }
 const bad=structuredClone(profile);bad.speech.curve[2]=.9;
 assert.ok(compositeProfileErrors(bad).length);
 const identity={curve:[0,.25,.5,.75,1],saturation:1,temperatureRGB:[1,1,1]};
 const input=[.8,.5,.3];applyGrade(input,identity).forEach((v,i)=>assert.ok(Math.abs(v-input[i])<1e-6));
});

test('all speech and idle contacts belong to the exact current media and remain within native crops',()=>{
 const bank={waiting:idle.base,...Object.fromEntries(Object.entries(speak.lines).map(([k,l])=>[k,l.media]))};
 assert.deepEqual(Object.keys(tracks.clips).sort(),Object.keys(bank).sort());
 for(const [id,media] of Object.entries(bank)){
  const track=tracks.clips[id];assert.equal(track.sha256,media.sha256,id);
  assert.equal(track.frames,media.frames,id);assert.equal(track.fps,media.fps,id);
  assert.deepEqual([track.width,track.height],[media.width,media.height]);
  assert.ok(track.confidenceMin.every(v=>v>.9),`${id}: lost tracker`);
  for(let i=0;i<track.frames;i++){
   const points=trackedContacts(track,i,media.sha256);assert.equal(points.length,4);
   points.forEach(([x,y],j)=>{
    assert.ok(x>=0&&x<track.width&&y>=0&&y<track.height);
    if(i)assert.ok(Math.hypot(x-track.points[i-1][j][0],y-track.points[i-1][j][1])<8,`${id}: shadow jump ${i}`);
   });
  }
  assert.equal(trackedContacts(track,0,'stale'),null);
  assert.deepEqual(trackedContacts(track,99999,media.sha256),track.points.at(-1));
 }
});

test('hand contact interpolation is continuous between native frames',()=>{
 const t=tracks.clips.waiting;
 const a=trackedContacts(t,10,t.sha256),b=trackedContacts(t,11,t.sha256),m=trackedContacts(t,10.5,t.sha256);
 m.forEach((p,i)=>p.forEach((v,j)=>assert.equal(v,(a[i][j]+b[i][j])/2)));
});
