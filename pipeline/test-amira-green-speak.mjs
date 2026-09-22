import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {speakManifestErrors} from '../web/public/astrid-green-speak.mjs';
import {idleSegmentErrors} from '../web/public/astrid-idle-scheduler.mjs';

const pub=new URL('../web/public/',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,pub)));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,pub))).digest('hex');
const take=read('review/amira-green-speak/speak.json');
const bank=read('dealers/amira/audio/en/bank.json');

test('Amira has all seventeen original recordings paired with their keyed native takes',()=>{
  assert.deepEqual(speakManifestErrors(take,'amira'),[]);
  assert.equal(Object.keys(take.lines).length,17);
  for(const [id,line] of Object.entries(take.lines)){
    assert.equal(line.text,bank[id].text,id);
    assert.equal(line.audio,`dealers/amira/audio/en/${id}.mp3`,id);
    assert.equal(sha(line.audio),line.audioSha256,`${id}: paired recording changed`);
    assert.equal(sha(line.media.src),line.media.sha256,`${id}: mask changed`);
    assert.equal(line.media.fps,25,`${id}: preserve native video clock`);
    assert.equal(line.cutIn,0);assert.equal(line.cutOut,line.media.frames-1);
    assert.ok(line.audioMeasurement.normalisedPeak>.99,`${id}: mismatched embedded recording`);
  }
});

test('a dealer manifest cannot silently load another dealer or another voice',()=>{
  assert.ok(speakManifestErrors(take,'astrid').length);
  const wrong=structuredClone(take);
  wrong.lines.greeting.audio='dealers/astrid/audio/en/greeting.mp3';
  assert.ok(speakManifestErrors(wrong,'amira').some(e=>e.includes('another dealer')));
});

test('Amira uses the supplied native waiting loop without synthetic glance segments',()=>{
  const idle=read('review/amira-green-waiting/idle.json');
  assert.deepEqual(idleSegmentErrors(idle),[]);
  assert.equal(idle.mode,'loop');
  assert.equal(idle.base.jobId,'5f2929a3-384e-4632-862c-96b1a3f6bfb1');
  assert.equal(idle.base.frames,121);assert.equal(idle.base.fps,24);
  assert.equal(sha(idle.base.src),idle.base.sha256);
  assert.ok(idleSegmentErrors({...idle,camera:{...idle.camera,width:1}}).includes('loop camera mismatch'));
  assert.ok(idleSegmentErrors({...idle,base:{...idle.base,fps:0}}).includes('loop media invalid'));
  assert.ok(idleSegmentErrors({...idle,segments:{fake:{start:0,end:120}}}).includes('single loop cannot include glance segments'));
});
