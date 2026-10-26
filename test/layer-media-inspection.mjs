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
import { createSeedProject,createEmptyProject,addDealer } from '../packages/presentation/contracts/studio-model.mjs';
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
import {recordedSpeechIdentity,recordedSpeechForVideo} from '../packages/presentation/contracts/recorded-speech.mjs';
import {recordedSpeechProjection} from '../packages/presentation/runtime/recorded-speech-selection.mjs';
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
function embeddedSpeech(sha256) {
  return {schemaVersion:2,sourceKind:'embedded-mp4-av',dealerId:'linnea',lineId:'greeting',takeId:'take-one',language:'sv',exactText:'Hej.',
    videoSha256:sha256,fps:24,frameCount:6,videoTrackId:1,audioTrackId:2,entryPose:'VILA',exitPose:'VILA',
    source:{status:'pending'},review:{status:'pending'}};
}
function singleAudioTimingVideo() {
  // Retain the existing synthetic samples and their byte offsets. Turn the
  // second audio track's entire container into padding, then bind movie duration
  // to the remaining half-second track (48000 movie ticks per second).
  const bytes=timingVideo(),tracks=[];let at=-1;
  while((at=bytes.indexOf('trak',at+1))!==-1)tracks.push(at);
  assert.equal(tracks.length,3);
  bytes.write('free',tracks[2]);bytes.writeUInt32BE(24000,bytes.indexOf('mvhd')+20);
  return bytes;
}
test('embedded AV timing binds one actual audio track and preserves independent pending proofs',async t=>{
  const f=await timedMedia(t,singleAudioTimingVideo()),declared=embeddedSpeech(f.sha256),before=structuredClone(declared);
  f.record.classification={recordedSpeech:declared};
  const result=await inspectMediaTiming(f.record,f.options);
  assert.deepEqual(result.audio,[{trackId:2,firstPtsUs:0,endUs:500000}]);
  assert.equal(result.video.trackId,1);assert.equal(result.video.frameCount,6);assert.equal(result.video.fps,24);
  assert.equal(result.recordedSpeechIdentitySha256,createHash('sha256').update(mediaTimingSpeechIdentity(declared)).digest('hex'));
  assert.deepEqual(declared,before);assert.equal(Object.hasOwn(result,'source'),false);assert.equal(Object.hasOwn(result,'review'),false);
  assert.deepEqual(normalizeMediaTiming(result,{recordedSpeech:declared}),result);
  for(const fields of [{videoTrackId:7},{audioTrackId:3},{fps:25},{frameCount:5},{videoSha256:'c'.repeat(64)}]){
    const changed={...declared,...fields};
    assert.throws(()=>normalizeMediaTiming(result,{recordedSpeech:changed}),/invalid_media_timing/);
    await assert.rejects(inspectMediaTiming({...f.record,classification:{recordedSpeech:changed}},f.options),{code:'studio_media_timing_mismatch'});
  }
});
test('embedded AV timing rejects silent or ambiguous MP4 sources even when declared video timing matches',async t=>{
  for(const bytes of [layerVideo(),timingVideo()]){
    const f=await timedMedia(t,bytes),measured=await inspectMediaTiming(f.record,f.options);
    const declared={...embeddedSpeech(f.sha256),frameCount:measured.video.frameCount,fps:measured.video.fps};
    f.record.classification={recordedSpeech:declared};
    await assert.rejects(inspectMediaTiming(f.record,f.options),{code:'studio_media_timing_mismatch'});
  }
});
test('verified embedded MP4 bytes bind the persisted source and client selection without granting AV approval',async t=>{
  const f=await timedMedia(t,singleAudioTimingVideo()),pool=createStudioMemoryPool();
  const repository=createStudioRepository({pool,scope:{environment:'test',workspaceId:'embedded-av-bytes'}});
  await repository.initializeDocument('project',{value:addDealer(createEmptyProject(),'nora','Nora'),actor:'Fixture uploader'});
  const declared={...embeddedSpeech(f.sha256),dealerId:'nora',lineId:'goodluck',exactText:'Lycka till.'};
  const input={id:f.record.id,sha256:f.sha256,size:f.size,contentType:'video/mp4',
    pathname:`croupier/media/dealers/nora/review/uploads/${f.record.id}/${f.sha256}.mp4`,
    classification:{dealerId:'nora',eventId:'speak.goodluck',kind:'speech',role:'alternative',situation:'goodluck',
      label:'Synthetic embedded AV fixture',notes:'',playback:'once',recordedSpeech:declared}};
  const registered=(await repository.registerMedia(input,{actor:'Fixture uploader'})).media;
  const mediaTiming=await inspectMediaTiming(registered,f.options);
  const measured=await repository.saveMediaTiming(registered.id,{sha256:f.sha256,expectedRevision:registered.revision,mediaTiming,actor:'Fixture inspector'});
  const selection={dealerId:'nora',lineId:'goodluck',language:'sv'},speech=measured.classification.recordedSpeech;
  assert.equal(speech.source.status,'verified-embedded-av');assert.equal(speech.source.by,'Fixture inspector');
  assert.deepEqual(speech.source.identity,recordedSpeechIdentity(declared));assert.deepEqual(speech.review,{status:'pending'});
  assert.equal(recordedSpeechForVideo(measured,selection),null);
  const metadata=structuredClone(measured.classification);
  metadata.recordedSpeech.review={status:'approved',by:'Synthetic fixture reviewer',at:'2026-10-26T00:00:00.000Z',identity:recordedSpeechIdentity(speech)};
  const reviewed=await repository.classifyMedia(measured.id,{sha256:f.sha256,expectedRevision:measured.revision,metadata,actor:'Synthetic fixture reviewer'});
  const read=await repository.getMedia(reviewed.id),publicVideo={id:read.id,sha256:read.sha256,...recordedSpeechProjection(read)};
  assert.deepEqual(read.mediaTiming,mediaTiming);assert.deepEqual(read.classification.recordedSpeech.source,speech.source);
  assert.deepEqual(recordedSpeechForVideo(publicVideo,selection),read.classification.recordedSpeech);
  assert.equal(recordedSpeechForVideo({...publicVideo,mediaTiming:undefined},selection),null);
});
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

function timingTrackOffsets(bytes,type) {
  const result=[];let at=-1;
  while((at=bytes.indexOf(type,at+1))!==-1)result.push(at);
  return result;
}
function primedTimingVideo() {
  const bytes=timingVideo();
  for(const at of timingTrackOffsets(bytes,'mdhd').slice(1))bytes.writeUInt32BE(bytes.readUInt32BE(at+20)-1024,at+20);
  return bytes;
}
function roundedTimingVideo(movieScale=1000) {
  const bytes=primedTimingVideo(),factor=movieScale/48000;
  bytes.writeUInt32BE(movieScale,bytes.indexOf('mvhd')+16);
  const durationAt=[bytes.indexOf('mvhd')+20,...timingTrackOffsets(bytes,'tkhd').map(at=>at+24),...timingTrackOffsets(bytes,'elst').map(at=>at+12)];
  for(const at of durationAt)bytes.writeUInt32BE(Math.ceil(bytes.readUInt32BE(at)*factor),at);
  // Preserve six CFR B-frames, changing 1000-tick samples to 1001 ticks.
  bytes.writeUInt32BE(1001,bytes.indexOf('stts')+16);
  bytes.writeUInt32BE(6006,bytes.indexOf('mdhd')+20);
  const ctts=bytes.indexOf('ctts'),entries=bytes.readUInt32BE(ctts+8);
  for(let i=0;i<entries;i++){const at=ctts+16+i*8;bytes.writeUInt32BE(bytes.readUInt32BE(at)/1000*1001,at);}
  bytes.writeUInt32BE(2002,bytes.indexOf('elst')+16);
  for(const at of [bytes.indexOf('elst')+12,bytes.indexOf('tkhd')+24])bytes.writeUInt32BE(Math.ceil(6006/24000*movieScale),at);
  return bytes;
}

test('AAC edit and roll groups identify the exact priming excluded by the media header',async t=>{
  const f=await timedMedia(t,primedTimingVideo()),result=await inspectMediaTiming(f.record,f.options);
  assert.deepEqual(result.audio,[{trackId:2,firstPtsUs:0,endUs:500000},{trackId:3,firstPtsUs:0,endUs:750000}]);
  assert.equal(result.endUs,750000);
});

test('priming requires the complete declared roll mapping and cannot hide changed durations',async t=>{
  const malformed=[];
  for(const type of ['sgpd','sbgp']){const bytes=primedTimingVideo();bytes.write('free',bytes.indexOf(type),'ascii');malformed.push(bytes);}
  for(const [type,offset,value]of [['sgpd',20,0],['sbgp',16,1],['sbgp',20,2],['elst',16,1023]]){
    const bytes=primedTimingVideo(),at=type==='elst'?timingTrackOffsets(bytes,type)[1]:bytes.indexOf(type);
    if(type==='sgpd')bytes.writeInt16BE(value,at+offset);else bytes.writeUInt32BE(value,at+offset);malformed.push(bytes);
  }
  for(const delta of [-1,1]){const bytes=primedTimingVideo(),at=timingTrackOffsets(bytes,'mdhd')[1]+20;bytes.writeUInt32BE(bytes.readUInt32BE(at)+delta,at);malformed.push(bytes);}
  for(const bytes of malformed){const f=await timedMedia(t,bytes);await assert.rejects(inspectMediaTiming(f.record,f.options),{code:'studio_media_timing_unsupported'});}
});

test('exact ceiling to a millisecond-dividing movie clock preserves sample timing and budget',async t=>{
  for(const scale of [1000,2000,48000]){
    const f=await timedMedia(t,roundedTimingVideo(scale)),result=await inspectMediaTiming(f.record,f.options);
    assert.equal(result.video.frameCount,6);assert.equal(result.video.fps,24000/1001);
    assert.equal(result.video.endUs,250250);assert.equal(result.video.lastPtsUs,208542);
    const declaredMs=Math.ceil(6006/24000*scale)*1000/scale;
    assert.ok(Math.ceil(result.video.endUs/1000)>=declaredMs,'per-clip milliseconds cover the declared movie end');
  }
});

test('rounded clock support rejects earlier ends, added ticks, coarse clocks and non-dividing clocks',async t=>{
  const malformed=[roundedTimingVideo(100),roundedTimingVideo(1500)];
  for(const delta of [-1,1])for(const types of [['elst'],['tkhd'],['elst','tkhd']]){
    const bytes=roundedTimingVideo();for(const type of types){const at=bytes.indexOf(type)+(type==='elst'?12:24);bytes.writeUInt32BE(bytes.readUInt32BE(at)+delta,at);}malformed.push(bytes);
  }
  const extraMovie=roundedTimingVideo();extraMovie.writeUInt32BE(751,extraMovie.indexOf('mvhd')+20);malformed.push(extraMovie);
  for(const bytes of malformed){const f=await timedMedia(t,bytes);await assert.rejects(inspectMediaTiming(f.record,f.options),{code:'studio_media_timing_unsupported'});}
});
function splitRoundedAudioVideo() {
  const bytes=roundedTimingVideo(),stts=timingTrackOffsets(bytes,'stts')[1];
  const count=bytes.readUInt32BE(stts+8),last=stts+16+(count-1)*8;
  bytes.writeUInt32BE(bytes.readUInt32BE(last)+16,last);
  const mdhd=timingTrackOffsets(bytes,'mdhd')[1]+20;
  bytes.writeUInt32BE(bytes.readUInt32BE(mdhd)+16,mdhd);
  bytes.writeUInt32BE(501,timingTrackOffsets(bytes,'tkhd')[1]+24);
  // ceil(25040/48) - ceil(1024/48) = 500, while ceil(24016/48) = 501.
  bytes.writeUInt32BE(500,timingTrackOffsets(bytes,'elst')[1]+12);
  return bytes;
}

test('separately rounded AAC priming retains the full conservative sample envelope',async t=>{
  const f=await timedMedia(t,splitRoundedAudioVideo()),result=await inspectMediaTiming(f.record,f.options);
  assert.equal(result.audio[0].endUs,500334);
  assert.equal(Math.ceil(result.audio[0].endUs/1000),501,'budget covers the track header despite the separately rounded edit');
  for(const [type,value]of [['elst',499],['tkhd',500],['tkhd',502]]){
    const bytes=splitRoundedAudioVideo();bytes.writeUInt32BE(value,timingTrackOffsets(bytes,type)[1]+(type==='elst'?12:24));
    const bad=await timedMedia(t,bytes);await assert.rejects(inspectMediaTiming(bad.record,bad.options),{code:'studio_media_timing_unsupported'});
  }
});

function compositionHeaderTimingVideo() {
  const bytes=timingVideo();
  // Six reordered video samples: PTS span 2000..8000; the smallest CTS
  // among the first three (DTS <= edit start 2000) is 1000. Older FFmpeg
  // writes mdhd=8000-1000, while the edit still shows all six frames.
  bytes.writeUInt32BE(7000,bytes.indexOf('mdhd')+20);
  return bytes;
}

test('reordered video accepts the exact unedited FFmpeg composition header while preserving all media',async t=>{
  const f=await timedMedia(t,compositionHeaderTimingVideo()),result=await inspectMediaTiming(f.record,f.options);
  assert.deepEqual(result.video,{trackId:1,frameCount:6,fps:24,firstPtsUs:0,lastPtsUs:208333,endUs:250000});
  assert.deepEqual(result.audio,[{trackId:2,firstPtsUs:0,endUs:500000},{trackId:3,firstPtsUs:0,endUs:750000}]);
  assert.equal(result.endUs,750000);
});

test('composition-header support cannot conceal a changed header, missing evidence or discarded video frames',async t=>{
  const malformed=[];
  for(const duration of [6999,7001,8000]){
    const bytes=compositionHeaderTimingVideo();bytes.writeUInt32BE(duration,bytes.indexOf('mdhd')+20);malformed.push(bytes);
  }
  for(const type of ['ctts','edts']){
    const bytes=compositionHeaderTimingVideo();bytes.write('free',bytes.indexOf(type),'ascii');malformed.push(bytes);
  }
  const trimmed=compositionHeaderTimingVideo();
  for(const [type,offset]of [['elst',12],['tkhd',24]])trimmed.writeUInt32BE(10000,trimmed.indexOf(type)+offset);
  malformed.push(trimmed);
  const changedComposition=compositionHeaderTimingVideo();changedComposition.writeUInt32BE(2001,changedComposition.indexOf('ctts')+16);malformed.push(changedComposition);
  for(const bytes of malformed){const f=await timedMedia(t,bytes);await assert.rejects(inspectMediaTiming(f.record,f.options),{code:'studio_media_timing_unsupported'});}
});
