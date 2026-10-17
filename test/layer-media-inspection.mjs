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
