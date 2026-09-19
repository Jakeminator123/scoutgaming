import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {speakManifestErrors} from '../web/public/astrid-green-speak.mjs';
import {SPEECH_LINES} from '../web/public/speech-lines.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../web/public');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const speakPath=path.join(root,'review/astrid-green-speak/speak.json');
const speak=JSON.parse(fs.readFileSync(speakPath));
const dealer=JSON.parse(fs.readFileSync(path.join(root,'review/astrid-table-v2/take.json')));
const ids=Object.keys(speak.lines);

test('the installed speak manifest is valid and every line\'s media and recording are the reviewed bytes',()=>{
  assert.deepEqual(speakManifestErrors(speak),[]);
  assert.equal(speak.dealer,'astrid');assert.equal(speak.action,'speak');assert.equal(speak.status,'review');
  assert.ok(ids.includes('greeting'));
  for(const [id,line] of Object.entries(speak.lines)){
    assert.equal(sha(path.join(root,line.media.src)),line.media.sha256,`${id}: packed media changed since the matte review`);
    assert.equal(sha(path.join(root,line.audio)),line.audioSha256,`${id}: mp3 changed since the sync measurement`);
    assert.equal(line.media.layout,'rgb-over-alpha');
    assert.equal(line.text,SPEECH_LINES[id],`${id}: caption is the bank text`);
  }
});

test('every line cuts in at the first frame and out at the last, both ready poses, on the dealer take placement',()=>{
  const d=dealer.camera.placement;
  for(const [id,line] of Object.entries(speak.lines)){
    assert.equal(line.cutIn,0,id);
    assert.equal(line.cutOut,line.media.frames-1,id);
    assert.match(line.readyPose,/frame 0 and the last frame/);
    const p=line.camera.placement;
    assert.deepEqual([p.width,p.height,p.scale,p.framingScale],[d.width,d.height,d.scale,d.framingScale],id);
    assert.deepEqual([p.x,p.y],line.media.crop.slice(0,2),`${id}: placement origin is the packed crop origin`);
    assert.deepEqual([line.camera.width,line.camera.height],[line.media.width,line.media.height],id);
    assert.equal(line.media.fps,24,id);
    assert.deepEqual([line.registration.scale,line.registration.offset],[1.5,[0,15]],`${id}: one shared rigid registration`);
  }
});

test('audio starts on the first presented frame: each offset is the cross-correlation lag of the embedded track',()=>{
  for(const [id,line] of Object.entries(speak.lines)){
    assert.equal(line.audioOffsetSeconds,line.audioMeasurement.lagSamples/44100,id);
    assert.ok(line.audioMeasurement.normalisedPeak>.99,`${id}: embedded track is the recording`);
    assert.ok(Math.abs(line.audioOffsetSeconds)<=1/24,`${id}: offset within a frame`);
  }
});

test('speech joins are bound to the current repaired take and waiting source, without replacing speech frames',()=>{
  const idle=JSON.parse(fs.readFileSync(path.join(root,'review/astrid-green-waiting/idle.json')));
  for(const [id,line] of Object.entries(speak.lines)){
    const j=line.transition;
    assert.equal(j.mediaSha256,line.media.sha256,id);
    assert.equal(j.idleSha256,idle.base.sha256,id);
    assert.equal(j.width,idle.base.width,id);assert.equal(j.height,idle.base.height,id);
    assert.deepEqual(line.media.crop.slice(0,2),idle.base.crop.slice(0,2),id);
    assert.equal(j.durationMs,220,id);
    for(const edge of ['enter','exit'])assert.equal(sha(path.join(root,j[edge].src)),j[edge].sha256,`${id}: ${edge} motion map`);
  }
  const stale=structuredClone(speak);stale.lines.goodluck.transition.mediaSha256='old';
  assert.ok(speakManifestErrors(stale).some(e=>e.includes('transition binding')));
});

test('the validator rejects broken manifests',()=>{
  const broken=structuredClone(speak);
  broken.lines.greeting.cutOut=broken.lines.greeting.media.frames;
  assert.ok(speakManifestErrors(broken).some(e=>e.includes('cut range')));
  const other=structuredClone(speak);other.dealer='vera';
  assert.ok(speakManifestErrors(other).some(e=>e.includes('Astrid')));
  const noOffset=structuredClone(speak);delete noOffset.lines.greeting.audioOffsetSeconds;
  assert.ok(speakManifestErrors(noOffset).some(e=>e.includes('audioOffsetSeconds')));
  const mismatch=structuredClone(speak);mismatch.lines.greeting.camera.width+=2;
  assert.ok(speakManifestErrors(mismatch).some(e=>e.includes('camera')));
  const v1=structuredClone(speak);v1.version=1;
  assert.ok(speakManifestErrors(v1).some(e=>e.includes('version')));
});

test('the runtime is opt-in for Astrid on the Blender table only and generic over lines',()=>{
  const app=fs.readFileSync(path.join(root,'app.mjs'),'utf8');
  assert.match(app,/if\(astridGreenTake&&astridBlender\)try\{const speak=await loadGreenSpeak\(\)/);
  assert.match(app,/if\(!astridSpeak\?\.has\(t\)\|\|this\.muted\|\|speaking\)return;/);
  const module=fs.readFileSync(path.join(root,'astrid-green-speak.mjs'),'utf8');
  assert.match(module,/holdAtBoundary\(\)/,'the idle is held at a ready frame before the take starts');
  assert.match(module,/performance-playing/,'the idle resumes through the shared performance class');
  assert.doesNotMatch(module,/greeting/,'no line is special-cased in the runtime');
});
