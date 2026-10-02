import {resolveMediaAbsolutePath} from '../tools/media-layout.mjs';
const mediaUrl=(value,base)=>{const old=new URL(value,base),result=pathToFileURL(resolveMediaAbsolutePath(fileURLToPath(old)));if(old.pathname.endsWith('/')&&!result.pathname.endsWith('/'))result.pathname+='/';return result;};
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {validateContactTake,calibrationPayload,selectContactTake,contactCueClock} from '../web/public/performance-contact.mjs';
import {canRetargetTake} from '../web/public/dealer-reach.mjs';
const root=mediaUrl('../web/public/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(mediaUrl('dealers/astrid/performance/rhythm/manifest.json',root)));
const sha=b=>createHash('sha256').update(b).digest('hex');
test('rhythm footage and frame records stay bound, with subsecond shoe returns',()=>{
  for(const t of manifest.takes){
    assert.deepEqual(validateContactTake(t),[]);
    assert.equal(sha(calibrationPayload(t)),t.calibrationSha256);
    const file=mediaUrl(t.media.src,root);
    assert.equal(sha(fs.readFileSync(file)),t.media.sha256);
    const p=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,nb_read_frames,r_frame_rate,has_b_frames','-of','json',fileURLToPath(file)])).streams[0];
    assert.equal(p.width,t.media.width);assert.equal(p.height,t.media.height*2);
    assert.equal(Number(p.nb_read_frames),t.media.frames);assert.equal(p.r_frame_rate,'24/1');assert.equal(p.has_b_frames,0);
    assert.ok(t.events.rest/24<.8);assert.equal(t.tracking.sourceStop-t.tracking.sourceStart,t.media.frames);
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
