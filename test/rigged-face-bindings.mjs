import {resolveMediaAbsolutePath} from '../tools/media-layout.mjs';
const mediaUrl=(value,base)=>{const old=new URL(value,base),result=pathToFileURL(resolveMediaAbsolutePath(fileURLToPath(old)));if(old.pathname.endsWith('/')&&!result.pathname.endsWith('/'))result.pathname+='/';return result;};
import {fileURLToPath,pathToFileURL} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareFacialPerformance,verifyFacialSource} from '../web/public/dealer-face.mjs';
const base=mediaUrl('../web/public/',import.meta.url),folder=mediaUrl('dealers/astrid/rig/face-study/',base);
const read=name=>JSON.parse(fs.readFileSync(mediaUrl(name,folder)));
const manifest=read('speech-manifest.json');
const bank=JSON.parse(fs.readFileSync(mediaUrl('dealers/astrid/audio/en/bank.json',base)));
const index=JSON.parse(fs.readFileSync(mediaUrl('dealers/astrid/streams/index.json',base)));
const native=JSON.parse(fs.readFileSync(mediaUrl('speech-media.json',base))).astrid;
test('all Astrid lines bind measured frames to the shipped media, wording and calibration',async()=>{
 assert.deepEqual(Object.keys(manifest.lines).sort(),Object.keys(bank).sort());
 for(const [id,entry] of Object.entries(manifest.lines)){
  const data=read(entry.file),binding=data.binding;
  assert.equal(binding.lineId,id);assert.equal(binding.text,native?.[id]?.text??bank[id].text);
  assert.equal(data.missingTimes.length,0,`${id} detection gap`);
  prepareFacialPerformance(data,{modelSha256:manifest.modelSha256});
  await verifyFacialSource(data,fs.readFileSync(mediaUrl(binding.videoUrl,base)));
  await verifyFacialSource({sha256:binding.audioSha256},fs.readFileSync(mediaUrl(binding.audioUrl,base)));
  if(native?.[id]){
   assert.equal(binding.kind,'embedded-video');assert.equal(binding.audioDelayMs,0);
   assert.equal(mediaUrl(binding.videoUrl,base).pathname,mediaUrl(native[id].src,base).pathname);
  }else{
   const clip=index.clips['idle-1/speak/'+id];assert.equal(binding.kind,'indexed-audio');
   assert.equal(binding.videoUrl,'dealers/astrid/streams/'+clip.file);
   assert.equal(binding.audioUrl,'dealers/astrid/audio/en/'+id+'.mp3');
   assert.equal(binding.audioDelayMs,clip.audioDelayMs??0);assert.equal(data.fps,clip.fps);assert.equal(data.sourceFrameCount,clip.frameCount);
  }
 }
});
test('review model revision names the actual exported geometry',()=>{
 const hash=createHash('sha256').update(fs.readFileSync(mediaUrl('astrid-rigged.glb',folder))).digest('hex');assert.equal(manifest.modelSha256,hash);
});
