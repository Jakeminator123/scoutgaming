import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { open,writeFile,mkdtemp,rm } from 'node:fs/promises';
import { join,dirname,resolve,basename } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectLayerMedia,inspectVerifiedLayerFile,LAYER_INSPECTION_LIMITS } from '../apps/studio/lib/layer-media-inspection.mjs';
import { layerImage,layerAnimation,layerVideo,layerBlobFixture } from './fixtures/layer-media.mjs';
import { createLayerUploadService } from '../apps/studio/lib/layer-upload-service.mjs';
import { createStudioMemoryPool } from './fixtures/studio-memory-pool.mjs';
import { createStudioRepository } from '../packages/studio-registry/server/document-repository.mjs';
import { createSeedProject } from '../packages/presentation/contracts/studio-model.mjs';
import { nativeStudioErrorResponse } from '../apps/studio/lib/studio-native-runtime.mjs';

async function media(t,bytes,contentType='image/png') {
  const fixture=await layerBlobFixture(cleanup=>t.after(cleanup),bytes,contentType);
  const extension={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'}[contentType];
  return {...fixture,record:{provider:'vercel-blob',pathname:`croupier/media/backgrounds/${randomUUID()}/${fixture.sha256}.${extension}`,
    sha256:fixture.sha256,size:fixture.size,contentType}};
}
const rejected=error=>['studio_invalid_media_format','studio_media_inspection_limit'].includes(error.code);

test('actual PNG/JPEG/WebP pixels and oriented JPEG dimensions are inspected',async t=>{
  for(const [format,type,orientation,width,height]of [['png','image/png',undefined,32,24],['jpeg','image/jpeg',undefined,32,24],['webp','image/webp',undefined,32,24],['jpeg','image/jpeg',6,24,32]]){
    const f=await media(t,await layerImage(format,32,24,orientation),type);
    assert.deepEqual(await inspectLayerMedia(f.record,f.options),{width,height,contentType:type});
  }
  const animated=await media(t,await layerAnimation(),'image/webp');
  assert.deepEqual(await inspectLayerMedia(animated.record,animated.options),{width:32,height:24,contentType:'image/webp'});
});

test('MP4/WebM actual video samples, rotation and non-square pixels retain format freedom',async t=>{
  const rotated=layerVideo(),matrix=rotated.indexOf('tkhd')+44;
  rotated.writeInt32BE(0,matrix);rotated.writeInt32BE(65536,matrix+4);rotated.writeInt32BE(-65536,matrix+12);rotated.writeInt32BE(0,matrix+16);
  const wide=layerVideo();wide.writeUInt32BE(2,wide.indexOf('pasp')+4);
  for(const [bytes,type,width,height]of [[layerVideo(),'video/mp4',32,24],[layerVideo('webm'),'video/webm',32,24],[rotated,'video/mp4',24,32],[wide,'video/mp4',64,24]]){
    const f=await media(t,bytes,type);assert.deepEqual(await inspectLayerMedia(f.record,f.options),{width,height,contentType:type});
  }
});

test('signatures, truncated pixels/container, wrong format and absent video samples are rejected',async t=>{
  const png=await layerImage(),video=layerVideo(),noVideo=layerVideo(),empty=layerVideo();
  noVideo.write('soun',noVideo.indexOf('vide'));empty.writeUInt32BE(0,empty.indexOf('stsz')+12);
  const giant=Buffer.alloc(32);giant.writeUInt32BE(0xffffffff);giant.write('ftyp',4);
  for(const [bytes,type]of [[png.subarray(0,32),'image/png'],[png.subarray(0,png.length-16),'image/png'],[png,'image/jpeg'],
    [video.subarray(0,video.length-5),'video/mp4'],[layerVideo('webm').subarray(0,510),'video/webm'],[giant,'video/mp4'],[noVideo,'video/mp4'],[empty,'video/mp4']]){
    const f=await media(t,bytes,type);await assert.rejects(inspectLayerMedia(f.record,f.options),rejected);
  }
});

test('client dimension mismatch is rejected before any project read/mutation transaction',async t=>{
  const f=await media(t,await layerImage()),scope={environment:'test',workspaceId:'layer-bytes'},actor='fixture';
  const pool=createStudioMemoryPool(),repository=createStudioRepository({pool,scope});
  await repository.initializeDocument('project',{actor,value:createSeedProject()});const before=pool.snapshot();let locks=0;
  const service=createLayerUploadService({repository,scope,ticketKey:new Uint8Array(32).fill(7),env:f.options.env,options:f.options,clientToken:async()=> 'fixture-token'});
  const prepared=await service.prepare({operation:'prepare',sha256:f.sha256,size:f.size,contentType:'image/png',role:'background',label:'Fixture',width:33,height:24},{actor});
  await assert.rejects(service.commit({operation:'commit',ticket:prepared.ticket},{actor,request:new Request('https://fixture.invalid/upload'),stillAuthorized:async()=>true,
    mutationTransaction:()=>{locks++;assert.fail('invalid media must not acquire SQL');}}),error=>error.code==='studio_media_dimensions_mismatch');
  assert.equal(locks,0);assert.deepEqual(pool.snapshot(),before);
});

test('oversized metadata and excessive box reads fail within the inspection budget',async t=>{
  const free=Buffer.alloc(8);free.writeUInt32BE(8);free.write('free',4);
  const excessive=Buffer.concat([layerVideo().subarray(0,32),...Array.from({length:LAYER_INSPECTION_LIMITS.reads},()=>free)]);
  const hugeMoov=Buffer.alloc(LAYER_INSPECTION_LIMITS.readBytes+32);hugeMoov.writeUInt32BE(hugeMoov.length);hugeMoov.write('moov',4);
  const mdat=Buffer.from([0,0,0,9,109,100,97,116,0]);
  for(const bytes of [excessive,Buffer.concat([layerVideo().subarray(0,32),hugeMoov,mdat])]){
    const f=await media(t,bytes,'video/mp4');
    await assert.rejects(inspectLayerMedia(f.record,f.options),error=>error.code==='studio_media_inspection_limit');
  }
});

test('worker deadline and cancellation finish before returning the borrowed descriptor',async t=>{
  const folder=await mkdtemp(join(tmpdir(),'croupier-layer-fd-'));
  t.after(async()=>{assert.equal(dirname(resolve(folder)),resolve(tmpdir()));assert.match(basename(folder),/^croupier-layer-fd-/);await rm(folder,{recursive:true,force:true});});
  const bytes=await layerImage(),path=join(folder,'fixture.png');await writeFile(path,bytes);const handle=await open(path,'r');t.after(()=>handle.close());
  const record={size:bytes.length,contentType:'image/png'};
  await assert.rejects(inspectVerifiedLayerFile(handle,record,{timeoutMs:1}),error=>error.code==='studio_media_inspection_timeout');
  const first=inspectVerifiedLayerFile(handle,record);
  await assert.rejects(inspectVerifiedLayerFile(handle,record),error=>error.code==='studio_media_inspection_busy');
  assert.deepEqual(await first,{width:32,height:24,contentType:'image/png'});
  const controller=new AbortController(),cancelled=inspectVerifiedLayerFile(handle,record,{signal:controller.signal});controller.abort();
  await assert.rejects(cancelled,error=>error.code==='studio_media_inspection_cancelled');
  await assert.rejects(inspectVerifiedLayerFile(handle,{...record,size:LAYER_INSPECTION_LIMITS.fileBytes+1}),error=>error.code==='studio_media_inspection_limit');
  assert.equal((await handle.stat()).size,bytes.length,'worker never closes the parent-owned fd');
});

test('inspection errors remain actionable without echoing parser or provider details',async()=>{
  for(const [code,status]of [['studio_media_dimensions_mismatch',422],['studio_invalid_media_format',415],['studio_media_inspection_limit',422],['studio_media_inspection_busy',503],['studio_media_inspection_timeout',422],['studio_media_inspection_cancelled',408],['studio_media_inspection_failed',503]]){
    const response=nativeStudioErrorResponse({code,statusCode:status,message:'https://private.invalid/person-file?secret=fixture'});
    assert.equal(response.status,status);const body=await response.json();assert.equal(body.code,code);
    assert.match(body.error,/fil/i);assert.doesNotMatch(JSON.stringify(body),/private\.invalid|secret|person-file/);
  }
});

import {createHash} from 'node:crypto';
import {inspectMediaTiming} from '../apps/studio/lib/layer-media-inspection.mjs';
import {normalizeMediaTiming,mediaTimingSpeechIdentity} from '../packages/presentation/contracts/media-timing.mjs';
import {timingVideo} from './fixtures/layer-media.mjs';

async function timedMedia(t,bytes=timingVideo()) {
  const f=await media(t,bytes,'video/mp4');
  return {...f,record:{...f.record,id:randomUUID()}};
}
function speech(sha256) {
  return {schemaVersion:1,dealerId:'linnea',lineId:'greeting',takeId:'take-one',language:'sv',exactText:'Hej.',
    videoSha256:sha256,audioSha256:'a'.repeat(64),indexSha256:'b'.repeat(64),fps:24,frameCount:6,audioDelayMs:0,
    entryPose:'VILA',exitPose:'VILA',calibrationRevision:'fixture-1',recording:{status:'pending'},review:{status:'pending'}};
}
test('timing measures presentation order, CFR frames and every audio tail from verified bytes',async t=>{
  const silent=await timedMedia(t,layerVideo()),a=await inspectMediaTiming(silent.record,silent.options);
  assert.deepEqual(a.video,{trackId:1,frameCount:2,fps:2,firstPtsUs:0,lastPtsUs:500000,endUs:1000000});
  assert.deepEqual(a.audio,[]);assert.equal(a.audioTailUs,0);
  const f=await timedMedia(t),result=await inspectMediaTiming(f.record,f.options);
  assert.equal(result.mediaId,f.record.id);assert.equal(result.sha256,f.sha256);assert.equal(result.size,f.size);
  assert.deepEqual(result.video,{trackId:1,frameCount:6,fps:24,firstPtsUs:0,lastPtsUs:208333,endUs:250000});
  assert.deepEqual(result.audio,[{trackId:2,firstPtsUs:0,endUs:500000},{trackId:3,firstPtsUs:0,endUs:750000}]);
  assert.equal(result.endUs,750000);assert.equal(result.audioTailUs,500000);
  assert.equal(result.recordedSpeechIdentitySha256,null);
  assert.deepEqual(normalizeMediaTiming(result,{mediaId:f.record.id,sha256:f.sha256,size:f.size,recordedSpeechIdentitySha256:null}),result);
});
test('timing binds the unchanged speech tuple without creating or rewriting approvals',async t=>{
  const f=await timedMedia(t),declared=speech(f.sha256),before=structuredClone(declared);
  f.record.classification={recordedSpeech:declared};
  const result=await inspectMediaTiming(f.record,f.options),digest=createHash('sha256').update(mediaTimingSpeechIdentity(declared)).digest('hex');
  assert.equal(result.recordedSpeechIdentitySha256,digest);assert.deepEqual(declared,before);
  assert.equal(Object.hasOwn(result,'review'),false);assert.equal(Object.hasOwn(result,'recording'),false);
  assert.deepEqual(normalizeMediaTiming(result,{recordedSpeechIdentitySha256:digest}),result);
  const changed={...declared,exactText:'Annat.'};
  const changedDigest=createHash('sha256').update(mediaTimingSpeechIdentity(changed)).digest('hex');
  assert.throws(()=>normalizeMediaTiming(result,{recordedSpeechIdentitySha256:changedDigest}),/invalid_media_timing/);
  for(const field of [{frameCount:5},{fps:25},{videoSha256:'c'.repeat(64)}]){
    await assert.rejects(inspectMediaTiming({...f.record,classification:{recordedSpeech:{...declared,...field}}},f.options),error=>error.code==='studio_media_timing_mismatch');
  }
});
test('timing rejects wrong identities, forged ends and extra data, and returns detached values',async t=>{
  const f=await timedMedia(t),result=await inspectMediaTiming(f.record,f.options);
  for(const binding of [{mediaId:randomUUID()},{sha256:'f'.repeat(64)},{size:f.size+1},{recordedSpeechIdentitySha256:'e'.repeat(64)}])
    assert.throws(()=>normalizeMediaTiming(result,binding),/invalid_media_timing/);
  for(const mutated of [{...result,endUs:250000},{...result,audioTailUs:0},{...result,approval:'approved'},
    {...result,video:{...result.video,frameCount:7}},{...result,audio:[...result.audio].reverse()}])
    assert.throws(()=>normalizeMediaTiming(mutated),/invalid_media_timing/);
  const copy=normalizeMediaTiming(result);copy.audio[0].endUs=3;copy.video.endUs=3;
  assert.equal(result.audio[0].endUs,500000);assert.equal(result.video.endUs,250000);
});
test('timing rejects unsupported containers and edits without restricting existing dimension inspection',async t=>{
  const webm=await media(t,layerVideo('webm'),'video/webm');
  assert.deepEqual(await inspectLayerMedia(webm.record,webm.options),{width:32,height:24,contentType:'video/webm'});
  await assert.rejects(inspectMediaTiming({...webm.record,id:randomUUID()},webm.options),error=>error.code==='studio_media_timing_unsupported');
  const malformed=[];
  const multi=timingVideo();multi.writeUInt32BE(2,multi.indexOf('elst')+8);malformed.push(multi);
  const speed=timingVideo();speed.writeUInt32BE(0x20000,speed.indexOf('elst')+20);malformed.push(speed);
  const partial=timingVideo();partial.writeUInt32BE(230,partial.indexOf('elst')+12);malformed.push(partial);
  const pts=timingVideo();const ctts=pts.indexOf('ctts');assert.ok(ctts>0);pts.writeUInt32BE(pts.readUInt32BE(ctts+16)+1,ctts+16);malformed.push(pts);
  for(const bytes of malformed){
    const f=await timedMedia(t,bytes);
    await assert.rejects(inspectMediaTiming(f.record,f.options),error=>error.code==='studio_media_timing_unsupported');
  }
});
test('timing ignores catalogue durations and rejects incompatible container ends, sample bounds and hashes',async t=>{
  const f=await timedMedia(t);f.record.duration=90000;
  assert.equal((await inspectMediaTiming(f.record,f.options)).endUs,750000);
  const bytes=timingVideo();bytes.writeUInt32BE(90000,bytes.indexOf('mvhd')+20);
  const incompatible=await timedMedia(t,bytes);await assert.rejects(inspectMediaTiming(incompatible.record,incompatible.options));
  const corrupt=timingVideo();corrupt.writeUInt32BE(corrupt.length+100,corrupt.indexOf('stco')+12);
  const bad=await timedMedia(t,corrupt);await assert.rejects(inspectMediaTiming(bad.record,bad.options));
  const wrong=await timedMedia(t);wrong.record.sha256='0'.repeat(64);wrong.record.pathname=wrong.record.pathname.replace(wrong.sha256,wrong.record.sha256);
  await assert.rejects(inspectMediaTiming(wrong.record,wrong.options));
});
test('timing rejects conflicting movie, track and edit ends even within one movie tick',async t=>{
  const coarse=layerVideo();
  coarse.writeUInt32BE(1,coarse.indexOf('mvhd')+16);
  coarse.writeUInt32BE(2,coarse.indexOf('mvhd')+20);
  coarse.writeUInt32BE(2,coarse.indexOf('tkhd')+24);
  coarse.writeUInt32BE(1,coarse.indexOf('elst')+12);
  const values=[coarse];
  for(const delta of [-1,1])for(const types of [['mvhd'],['tkhd'],['mvhd','tkhd']]){
    const bytes=layerVideo();
    for(const type of types){const at=bytes.indexOf(type)+(type==='mvhd'?20:24);bytes.writeUInt32BE(bytes.readUInt32BE(at)+delta,at);}
    values.push(bytes);
  }
  // No edit: two 3/4-second samples cannot be rounded to a 2-second header.
  const fractional=layerVideo();fractional.write('free',fractional.indexOf('edts'),'ascii');
  fractional.writeUInt32BE(1,fractional.indexOf('mvhd')+16);fractional.writeUInt32BE(2,fractional.indexOf('mvhd')+20);
  fractional.writeUInt32BE(2,fractional.indexOf('tkhd')+24);
  fractional.writeUInt32BE(32768,fractional.indexOf('mdhd')+16);fractional.writeUInt32BE(49152,fractional.indexOf('mdhd')+20);
  fractional.writeUInt32BE(24576,fractional.indexOf('stts')+16);values.push(fractional);
  for(const bytes of values){const f=await timedMedia(t,bytes);await assert.rejects(inspectMediaTiming(f.record,f.options),{code:'studio_media_timing_unsupported'});}
});

test('timing compares every audio track end and the movie maximum without rounding tolerances',async t=>{
  const source=timingVideo(),tracks=[];let at=-1;
  while((at=source.indexOf('tkhd',at+1))!==-1)tracks.push(at);
  assert.equal(tracks.length,3);
  for(const index of [1,2])for(const delta of [-1,1]){
    const bytes=Buffer.from(source),position=tracks[index]+24;bytes.writeUInt32BE(bytes.readUInt32BE(position)+delta,position);
    const f=await timedMedia(t,bytes);await assert.rejects(inspectMediaTiming(f.record,f.options),{code:'studio_media_timing_unsupported'});
  }
  const bytes=Buffer.from(source);bytes.writeUInt32BE(24000,bytes.indexOf('mvhd')+20);
  const f=await timedMedia(t,bytes);await assert.rejects(inspectMediaTiming(f.record,f.options),{code:'studio_media_timing_unsupported'});
});

test('timing rejects media-duration summaries that contradict the sample decode durations',async t=>{
  const source=timingVideo(),tracks=[];let offset=-1;
  while((offset=source.indexOf('mdhd',offset+1))!==-1)tracks.push(offset);
  assert.equal(tracks.length,3);
  for(const track of tracks)for(const delta of [-1,1]){
    const bytes=Buffer.from(source),at=track+20;bytes.writeUInt32BE(bytes.readUInt32BE(at)+delta,at);
    const f=await timedMedia(t,bytes);await assert.rejects(inspectMediaTiming(f.record,f.options),{code:'studio_media_timing_unsupported'});
  }
});

test('exact rational presentation ends are rounded upward only at the microsecond boundary',async t=>{
  const bytes=layerVideo();bytes.write('free',bytes.indexOf('edts'),'ascii');
  bytes.writeUInt32BE(3,bytes.indexOf('mvhd')+16);bytes.writeUInt32BE(4,bytes.indexOf('mvhd')+20);
  bytes.writeUInt32BE(4,bytes.indexOf('tkhd')+24);
  bytes.writeUInt32BE(3,bytes.indexOf('mdhd')+16);bytes.writeUInt32BE(4,bytes.indexOf('mdhd')+20);
  bytes.writeUInt32BE(2,bytes.indexOf('stts')+16);
  const f=await timedMedia(t,bytes),result=await inspectMediaTiming(f.record,f.options);
  assert.equal(result.video.fps,1.5);assert.equal(result.video.lastPtsUs,666667);
  assert.equal(result.video.endUs,1333334);assert.equal(result.endUs,1333334);
});

test('timing mode preserves worker deadline, cancellation and exclusive descriptor ownership',async t=>{
  const folder=await mkdtemp(join(tmpdir(),'croupier-timing-fd-'));
  t.after(async()=>{assert.equal(dirname(resolve(folder)),resolve(tmpdir()));assert.match(basename(folder),/^croupier-timing-fd-/);await rm(folder,{recursive:true,force:true});});
  const bytes=timingVideo(),file=join(folder,'fixture.mp4');await writeFile(file,bytes);
  const handle=await open(file,'r');t.after(()=>handle.close());const record={size:bytes.length,contentType:'video/mp4'};
  await assert.rejects(inspectVerifiedLayerFile(handle,record,{timing:true,timeoutMs:1}),error=>error.code==='studio_media_inspection_timeout');
  const controller=new AbortController(),first=inspectVerifiedLayerFile(handle,record,{timing:true,signal:controller.signal});
  await assert.rejects(inspectVerifiedLayerFile(handle,record,{timing:true}),error=>error.code==='studio_media_inspection_busy');
  controller.abort();await assert.rejects(first,error=>error.code==='studio_media_inspection_cancelled');
  assert.equal((await handle.stat()).size,bytes.length);
});
