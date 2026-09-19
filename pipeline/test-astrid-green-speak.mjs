import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {speakManifestErrors} from '../web/public/astrid-green-speak.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../web/public');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const speakPath=path.join(root,'review/astrid-green-speak/speak.json');
const speak=JSON.parse(fs.readFileSync(speakPath));
const dealer=JSON.parse(fs.readFileSync(path.join(root,'review/astrid-table-v2/take.json')));

test('the installed greeting speak manifest is valid and its media is the reviewed bytes',()=>{
  assert.deepEqual(speakManifestErrors(speak),[]);
  assert.equal(speak.dealer,'astrid');assert.equal(speak.action,'speak');assert.equal(speak.status,'review');
  assert.equal(sha(path.join(root,speak.media.src)),speak.media.sha256,'packed media changed since the matte review');
  const line=speak.lines.greeting;
  assert.equal(sha(path.join(root,line.audio)),line.audioSha256,'greeting.mp3 changed since the sync measurement');
  assert.equal(speak.media.layout,'rgb-over-alpha');
});

test('the greeting cuts in at the first frame and out at the last, both ready poses, on the dealer take placement',()=>{
  const line=speak.lines.greeting;
  assert.equal(line.cutIn,0);
  assert.equal(line.cutOut,speak.media.frames-1);
  assert.match(line.readyPose,/frame 0 and the last frame/);
  const p=speak.camera.placement,d=dealer.camera.placement;
  assert.deepEqual([p.width,p.height,p.scale,p.framingScale],[d.width,d.height,d.scale,d.framingScale]);
  assert.deepEqual([p.x,p.y],speak.media.crop.slice(0,2),'placement origin is the packed crop origin');
  assert.deepEqual([speak.camera.width,speak.camera.height],[speak.media.width,speak.media.height]);
  assert.equal(speak.media.fps,24);
});

test('audio starts on the first presented frame: the measured offset is the cross-correlation lag of the embedded track',()=>{
  const line=speak.lines.greeting;
  assert.equal(line.audioOffsetSeconds,line.audioMeasurement.lagSamples/44100);
  assert.ok(line.audioMeasurement.normalisedPeak>.99,'embedded track is the greeting recording');
  assert.equal(line.audioOffsetSeconds,0);
});

test('the validator rejects broken manifests',()=>{
  const broken=structuredClone(speak);
  broken.lines.greeting.cutOut=broken.media.frames;
  assert.ok(speakManifestErrors(broken).some(e=>e.includes('cut range')));
  const other=structuredClone(speak);other.dealer='vera';
  assert.ok(speakManifestErrors(other).some(e=>e.includes('Astrid')));
  const noOffset=structuredClone(speak);delete noOffset.lines.greeting.audioOffsetSeconds;
  assert.ok(speakManifestErrors(noOffset).some(e=>e.includes('audioOffsetSeconds')));
  const mismatch=structuredClone(speak);mismatch.camera.width+=2;
  assert.ok(speakManifestErrors(mismatch).some(e=>e.includes('camera')));
});

test('the runtime is opt-in for Astrid on the Blender table only',()=>{
  const app=fs.readFileSync(path.join(root,'app.mjs'),'utf8');
  assert.match(app,/if\(astridGreenTake&&astridBlender\)try\{const speak=await loadGreenSpeak\(\)/);
  assert.match(app,/if\(!astridSpeak\?\.has\(t\)\|\|this\.muted\|\|speaking\)return;/);
  const module=fs.readFileSync(path.join(root,'astrid-green-speak.mjs'),'utf8');
  assert.match(module,/holdAtBoundary\(\)/,'the idle is held at a ready frame before the take starts');
  assert.match(module,/performance-playing/,'the idle resumes through the shared performance class');
});
