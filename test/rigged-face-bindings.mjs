import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareFacialPerformance,verifyFacialSource} from '../web/public/dealer-face.mjs';
const base=new URL('../web/public/',import.meta.url),folder=new URL('dealers/astrid/rig/face-study/',base);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,folder)));
const manifest=read('speech-manifest.json');
const bank=JSON.parse(fs.readFileSync(new URL('dealers/astrid/audio/en/bank.json',base)));
const index=JSON.parse(fs.readFileSync(new URL('dealers/astrid/streams/index.json',base)));
const native=JSON.parse(fs.readFileSync(new URL('speech-media.json',base))).astrid;
test('all Astrid lines bind measured frames to the shipped media, wording and calibration',async()=>{
 assert.deepEqual(Object.keys(manifest.lines).sort(),Object.keys(bank).sort());
 for(const [id,entry] of Object.entries(manifest.lines)){
  const data=read(entry.file),binding=data.binding;
  assert.equal(binding.lineId,id);assert.equal(binding.text,native?.[id]?.text??bank[id].text);
  assert.equal(data.missingTimes.length,0,`${id} detection gap`);
  prepareFacialPerformance(data);
  await verifyFacialSource(data,fs.readFileSync(new URL(binding.videoUrl,base)));
  await verifyFacialSource({sha256:binding.audioSha256},fs.readFileSync(new URL(binding.audioUrl,base)));
  if(native?.[id]){
   assert.equal(binding.kind,'embedded-video');assert.equal(binding.audioDelayMs,0);
   assert.equal(new URL(binding.videoUrl,base).pathname,new URL(native[id].src,base).pathname);
  }else{
   const clip=index.clips['idle-1/speak/'+id];assert.equal(binding.kind,'indexed-audio');
   assert.equal(binding.videoUrl,'dealers/astrid/streams/'+clip.file);
   assert.equal(binding.audioUrl,'dealers/astrid/audio/en/'+id+'.mp3');
   assert.equal(binding.audioDelayMs,clip.audioDelayMs??0);assert.equal(data.fps,clip.fps);assert.equal(data.sourceFrameCount,clip.frameCount);
  }
 }
});
test('review model revision names the actual exported geometry',()=>{
 const hash=createHash('sha256').update(fs.readFileSync(new URL('astrid-rigged.glb',folder))).digest('hex');assert.equal(manifest.modelSha256,hash);
});
