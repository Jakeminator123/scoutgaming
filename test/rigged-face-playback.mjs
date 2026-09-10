import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from '../web/public/vendor/three/three.module.js';
import {createRiggedFacePlayback} from '../web/public/rigged-face-playback.mjs';
import {FACE_SHAPES} from '../web/public/dealer-face.mjs';
const bytes=Buffer.from('measured source'),sha256=createHash('sha256').update(bytes).digest('hex');
function harness({kind='indexed-audio',delay=100,source=bytes,modelSha256}={}){
 const mesh={morphTargetDictionary:{jawOpen:0},morphTargetInfluences:[0]};
 const head=new T.Bone(),eye=new T.Bone();eye.name='EyeLeft';head.add(eye);head.rotation.set(.1,.2,-.1);head.updateMatrixWorld(true);
 const data={schemaVersion:1,sha256,duration:1,frames:[{time:0,weights:{jawOpen:0}},{time:.1,weights:{jawOpen:1}},{time:.2,weights:{jawOpen:0}}],
  binding:{lineId:'line',kind,videoUrl:'video.mp4',audioUrl:kind==='embedded-video'?'video.mp4':'line.mp3',audioSha256:sha256,audioDelayMs:delay}};
 const media={src:'https://table.test/'+data.binding.audioUrl,currentTime:0,paused:false,ended:false};
 const player=createRiggedFacePlayback({root:{traverse:fn=>{fn(mesh);fn(eye);}},modelSha256,baseURL:'https://table.test/',loadPerformance:async()=>data,loadBytes:async()=>source});
 return {player,media,mesh,data,eye,head,request:{id:'line',media,kind,audioDelayMs:delay}};
}
test('silent action gaze follows a world-space card in the posed head without changing speech',async()=>{
 const h=harness(),target=new T.Vector3(.2,1,-.15).normalize().applyQuaternion(h.head.quaternion);
 for(let frame=0;frame<90;frame++)h.player.sample(frame/30,target.toArray());
 h.head.updateMatrixWorld(true);
 const forward=new T.Vector3(0,1,0).applyQuaternion(h.eye.getWorldQuaternion(new T.Quaternion()));
 assert.ok(forward.dot(target)>.999,'Eye must face the card using the posed head basis');
 const before=h.eye.quaternion.clone();h.player.sample(3);assert.ok(before.angleTo(h.eye.quaternion)<.10,'Return to player must ease');
 h.player.start(await h.player.prepare(h.request));h.player.sample(4,target.toArray());assert.ok(h.eye.quaternion.angleTo(new T.Quaternion())<1e-9);assert.equal(h.mesh.morphTargetInfluences[0],1);
});
test('indexed speech samples actual media time plus the exact shipped delay, including pause and seeking',async()=>{
 const h=harness(),token=await h.player.prepare(h.request);h.player.start(token);h.player.sample(100);assert.equal(h.mesh.morphTargetInfluences[0],1);
 h.media.currentTime=.05;h.player.sample(200);assert.ok(Math.abs(h.mesh.morphTargetInfluences[0]-.5)<1e-6);
 h.media.paused=true;h.player.sample(300);assert.ok(Math.abs(h.mesh.morphTargetInfluences[0]-.5)<1e-6);
 h.media.currentTime=0;h.player.sample(400);assert.equal(h.mesh.morphTargetInfluences[0],1);
});
test('native speech uses the embedded video clock without adding a separate offset',async()=>{
 const h=harness({kind:'embedded-video',delay:0});h.media.currentTime=.05;h.player.start(await h.player.prepare(h.request));h.player.sample(20);assert.equal(h.mesh.morphTargetInfluences[0],.5);
 h.media.ended=true;h.player.sample(21);assert.equal(h.player.currentLine,null);assert.equal(h.mesh.morphTargetInfluences[0],0);
});
test('cancelled preparation and late completion cannot animate or stop a repeated line',async()=>{
 const h=harness(),abort=new AbortController(),old=await h.player.prepare(h.request,abort.signal);h.player.start(old);abort.abort();h.player.sample(0);assert.equal(h.player.currentLine,null);
 const next=await h.player.prepare(h.request);h.player.start(next);h.player.stop(old);assert.equal(h.player.currentLine,'line');
 assert.equal(h.player.start(old),false);h.player.stop(next);assert.equal(h.mesh.morphTargetInfluences[0],0);
 await assert.rejects(h.player.prepare(h.request,abort.signal),/cancelled/);
});
test('mismatched video, audio, line identity or calibration cannot start a face performance',async()=>{
 const changed=harness({source:Buffer.from('changed source')});await assert.rejects(changed.player.prepare(changed.request),/does not match/);
 for(const override of [{id:'other'},{audioDelayMs:0},{kind:'embedded-video'},{media:{src:'https://elsewhere.test/line.mp3'}}]){
  const h=harness();await assert.rejects(h.player.prepare({...h.request,...override}),/differs/);assert.equal(h.player.currentLine,null);
 }
});
test('game playback uses calibrated articulation only for the loaded dealer geometry',async()=>{
 const model='a'.repeat(64),h=harness({modelSha256:model});
 h.data.rigCalibration={schemaVersion:1,targetModelSha256:model};
 for(const frame of h.data.frames)frame.rigWeights=Object.fromEntries(FACE_SHAPES.map(name=>[name,name==='jawOpen'?.25:0]));
 const raw=structuredClone(h.data.frames.map(f=>f.weights));
 h.player.start(await h.player.prepare(h.request));h.player.sample(0);
 assert.equal(h.mesh.morphTargetInfluences[0],.25);
 assert.deepEqual(h.data.frames.map(f=>f.weights),raw,'Source measurements must remain intact');
 h.player.stop();h.data.rigCalibration.targetModelSha256='b'.repeat(64);
 await assert.rejects(h.player.prepare(h.request),/does not match this dealer model/);
 assert.equal(h.player.currentLine,null);assert.equal(h.mesh.morphTargetInfluences[0],0);
});
