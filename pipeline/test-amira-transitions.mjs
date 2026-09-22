import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {speakManifestErrors} from '../web/public/astrid-green-speak.mjs';
const pub=new URL('../web/public/',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,pub)));
const idle=read('review/amira-green-waiting/idle.json'),speak=read('review/amira-green-speak/speak.json');
test('every Amira join matches unchanged native endpoints and the actual camera registrations',()=>{
 assert.deepEqual(speakManifestErrors(speak,'amira'),[]);
 for(const [id,line] of Object.entries(speak.lines)){
  const j=line.transition,m=line.media,p=line.camera.placement,q=idle.camera.placement;
  assert.ok(j.composited,`${id}: a graded endpoint must not be graded twice`);
  assert.equal(j.mediaSha256,m.sha256);assert.equal(j.idleSha256,idle.base.sha256);
  assert.deepEqual(j.idleRegistration,{scale:q.scale/p.scale,x:(q.x-p.x)/p.scale,y:(q.y-p.y)/p.scale});
  assert.ok(j.idleRegistration.x+idle.base.width*j.idleRegistration.scale<=j.width);
  assert.ok(j.idleRegistration.y+idle.base.height*j.idleRegistration.scale<=j.height);
  assert.equal(line.cutIn,0);assert.equal(line.cutOut,m.frames-1);assert.equal(m.fps,25);
  for(const edge of ['enter','exit']){
   const b=fs.readFileSync(new URL(j[edge].src,pub));
   assert.equal(crypto.createHash('sha256').update(b).digest('hex'),j[edge].sha256);
   assert.equal(b.readUInt32BE(16),j.width/2);assert.equal(b.readUInt32BE(20),j.height);
  }
 }
 const bad=structuredClone(speak);bad.lines.greeting.transition.idleRegistration.scale=0;
 assert.ok(speakManifestErrors(bad,'amira').some(e=>e.includes('idle registration')));
});
