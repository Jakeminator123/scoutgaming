import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {validateContactTake,calibrationPayload,selectContactTake,contactCueClock} from '../web/public/performance-contact.mjs';
import {canRetargetTake} from '../web/public/dealer-reach.mjs';
const root=new URL('../web/public/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('dealers/astrid/performance/smooth60/manifest.json',root)));
const original=JSON.parse(fs.readFileSync(new URL('dealers/astrid/performance/rhythm/manifest.json',root)));
const sha=b=>createHash('sha256').update(b).digest('hex');
test('60 fps native RGB and interpolated frame records preserve the source clock',()=>{
  for(const t of manifest.takes){
    assert.deepEqual(validateContactTake(t),[]);
    assert.equal(sha(calibrationPayload(t)),t.calibrationSha256);
    const file=new URL(t.media.src,root);
    assert.equal(sha(fs.readFileSync(file)),t.media.sha256);
    const p=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,nb_read_frames,r_frame_rate,has_b_frames','-of','json',file.pathname])).streams[0];
    assert.equal(p.width,t.media.width);assert.equal(p.height,t.media.height*2);
    assert.equal(Number(p.nb_read_frames),t.media.frames);assert.equal(p.r_frame_rate,'60/1');assert.equal(p.has_b_frames,0);
    assert.equal(p.width,1920);assert.equal(p.height,2160);
    const old=original.takes.find(x=>x.action===t.action),r=t.tracking.resampling;
    assert.equal(r.inputMediaSha256,old.media.sha256);assert.equal(r.inputCalibrationSha256,old.calibrationSha256);
    assert.equal(r.nativeRGB,true);assert.equal(r.speed,.8);
    assert.equal(t.media.frames,Math.ceil((old.media.frames-1)/.32)+1);
    assert.ok(Math.abs(t.events.rest/60-old.events.rest/24/.8)<1/60);
    for(const key of ['pickup','release','land'])assert.ok(Math.abs(t.events[key]/60-old.events[key]/24/.8)<=1/120);
    const hashes=execFileSync('ffmpeg',['-v','error','-i',file.pathname,'-f','framemd5','-']).toString().split('\n').filter(x=>x&&!x.startsWith('#')).map(x=>x.split(',').at(-1).trim());
    assert.equal(new Set(hashes).size,t.media.frames,'intermediate frames must not be duplicated');
  }
});
test('estimated card footprints cannot masquerade as contact-approved takes',()=>{
  for(const t of manifest.takes){
    assert.ok(selectContactTake(manifest,t.action,{staged:true}));
    assert.equal(selectContactTake(manifest,t.action),null);
    assert.ok(validateContactTake(t,{approved:true}).length);
    const forged=structuredClone(t);forged.status='approved';assert.ok(validateContactTake(forged).length);
    const changed=structuredClone(t);changed.tracking.sourceStart++;assert.notEqual(sha(calibrationPayload(changed)),t.calibrationSha256);
  }
});
test('rhythm footage cannot stretch even with the old reach query; landing fires once',()=>{
  for(const t of manifest.takes){
    assert.equal(canRetargetTake(t,true),false);
    assert.equal(canRetargetTake(t,false),false);
    const cues=[],clock=contactCueClock(t.events,x=>cues.push(x));
    for(let f=0;f<t.media.frames;f++){clock(f);clock(f);}
    assert.deepEqual(cues,['pickup','land']);
  }
});
