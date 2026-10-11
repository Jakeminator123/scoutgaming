import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join,dirname,basename,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createDealerSpeechReferenceService,dealerSpeechProfileRevision} from '../web/dealer-speech-reference.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const media=Buffer.from('bounded private video');
const profile=()=>({schemaVersion:2,state:'enabled',voice:{provider:'elevenlabs',voiceId:'own-voice',modelId:'eleven_multilingual_v2'},reference:{kind:'video-frame',videoId:'own-video',sha256:hash(media),offsetMs:200}});
const video=()=>({id:'own-video',dealer:'paow',available:true,bytes:media.length,sha256:hash(media),duration:1});
function png(){
  const bytes=Buffer.alloc(45);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);
  bytes.writeUInt32BE(13,8);bytes.write('IHDR',12);bytes.writeUInt32BE(1080,16);bytes.writeUInt32BE(1920,20);bytes[24]=8;bytes[25]=2;bytes.write('IEND',37);return bytes;
}
function fixture(extra={}){
  let calls=0,decodes=0,source=video(),content=media,guards=0;
  const service=createDealerSpeechReferenceService({
    readVideoRegistry:async()=>({videos:[source]}),
    readVideoResponse:async(id,request)=>{assert.equal(id,'own-video');assert.equal(new URL(request.url).origin,'https://studio.invalid');calls++;return new Response(content,{headers:{'content-type':'video/mp4'}});},
    runProcess:async(exe,args)=>{decodes++;if(exe==='ffprobe')return Buffer.from(JSON.stringify({streams:[{width:64,height:96}],format:{duration:1}}));await writeFile(args.at(-1),png());return Buffer.alloc(0);},
    ...extra
  });
  return {service,options:()=>({dealerId:'paow',profile:profile(),beforeCostlyStep:async()=>{guards++;}}),stats:()=>({calls,decodes,guards}),setSource:value=>{source=value;},setContent:value=>{content=value;}};
}
test('revision ignores input key order and changes on voice, frame, source and state',()=>{
  const p=profile(),r=dealerSpeechProfileRevision(p);
  assert.equal(dealerSpeechProfileRevision({...p,voice:{modelId:p.voice.modelId,voiceId:p.voice.voiceId,provider:p.voice.provider}}),r);
  for(const next of [{...p,voice:{...p.voice,voiceId:'another'}},{...p,reference:{...p.reference,offsetMs:0}},{...p,reference:{...p.reference,sha256:'f'.repeat(64)}},{...p,state:'preparation'}])assert.notEqual(dealerSpeechProfileRevision(next),r);
});
test('extracts one exact private source, caches by profile and rechecks ownership on cache hits',async()=>{
  const f=fixture(),first=await f.service.prepare(f.options());assert.equal(first.image.sha256,hash(png()));assert.equal(first.profileRevision,dealerSpeechProfileRevision(profile()));
  assert.equal(first.image.width,1080);assert.equal(first.image.height,1920);
  first.image.bytes.fill(0);const second=await f.service.prepare(f.options());assert.equal(hash(second.image.bytes),second.image.sha256);
  assert.equal(f.stats().calls,1);assert.equal(f.stats().decodes,2);assert.ok(f.stats().guards>=5);
  f.setSource({...video(),dealer:'astrid'});await assert.rejects(f.service.prepare(f.options()));
  assert.equal(f.stats().calls,1);
});
test('hash mismatch, wrong dealer, missing readiness intent and stale revision stop before decoding',async()=>{
  for(const mutate of [f=>f.setSource({...video(),dealer:'astrid'}),f=>f.setContent(Buffer.alloc(media.length,1))]){
    const f=fixture();mutate(f);await assert.rejects(f.service.prepare(f.options()));assert.equal(f.stats().decodes,0);
  }
  const f=fixture();
  await assert.rejects(f.service.prepare({...f.options(),profileRevision:'a'.repeat(64)}));
  await assert.rejects(f.service.prepare({...f.options(),profile:{...profile(),state:'preparation'}}));
  assert.equal(f.stats().calls,0);
});
test('freshness and cancellation prevent later extraction or return after source changes',async()=>{
  const f=fixture();let n=0;
  await assert.rejects(f.service.prepare({...f.options(),beforeCostlyStep:async()=>{if(++n===3)throw Error('publication_changed');}}),/publication_changed/);
  const abort=new AbortController();abort.abort();await assert.rejects(f.service.prepare({...f.options(),signal:abort.signal}),/cancelled/);
  const changed=fixture({runProcess:async(exe,args)=>{if(exe==='ffprobe')return Buffer.from(JSON.stringify({streams:[{width:64,height:96}],format:{duration:1}}));await writeFile(args.at(-1),png());changed.setSource({...video(),sha256:'f'.repeat(64)});}});
  await assert.rejects(changed.service.prepare(changed.options()));
});
test('decoder checks actual duration and image dimensions instead of trusting registry',async()=>{
  const badDuration=fixture({runProcess:async()=>Buffer.from(JSON.stringify({streams:[{width:64,height:96}],format:{duration:.1}}))});
  await assert.rejects(badDuration.service.prepare(badDuration.options()),/out_of_range/);
  const badImage=fixture({runProcess:async(exe,args)=>{if(exe==='ffprobe')return Buffer.from(JSON.stringify({streams:[{width:64,height:96}],format:{duration:1}}));const bytes=png();bytes.writeUInt32BE(100,16);await writeFile(args.at(-1),bytes);}});
  await assert.rejects(badImage.service.prepare(badImage.options()),/image_invalid/);
});
test('real FFmpeg extracts a bounded portrait PNG from a synthetic video',async t=>{
  if(spawnSync('ffmpeg',['-version'],{windowsHide:true}).status!==0||spawnSync('ffprobe',['-version'],{windowsHide:true}).status!==0)return t.skip('FFmpeg/ffprobe unavailable; guarded mocked decoding still covered');
  const directory=await mkdtemp(join(tmpdir(),'croupier-reference-test-')),file=join(directory,'fixture.mp4');
  try{
    const result=spawnSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=64x96:r=24','-t','0.5','-threads','2','-pix_fmt','yuv420p',file],{windowsHide:true,timeout:20000});
    assert.equal(result.status,0);const bytes=await readFile(file),p=profile();p.reference.sha256=hash(bytes);
    const service=createDealerSpeechReferenceService({readVideoRegistry:async()=>({videos:[{...video(),sha256:hash(bytes),bytes:bytes.length,duration:.5}]}),readVideoResponse:async()=>new Response(bytes,{headers:{'content-type':'video/mp4'}})});
    const image=(await service.prepare({dealerId:'paow',profile:p,beforeCostlyStep:async()=>{}})).image;
    assert.equal(image.bytes.readUInt32BE(16),1080);assert.equal(image.bytes.readUInt32BE(20),1920);assert.equal(hash(image.bytes),image.sha256);
  }finally{assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('croupier-reference-test-'));await rm(directory,{recursive:true,force:true});}
});

test('explicit voice tuning and language participate in immutable revision',()=>{
  const p={...profile(),voice:{...profile().voice,language:'sv',settings:{stability:.5,similarity_boost:.85,use_speaker_boost:true}}};
  const revision=dealerSpeechProfileRevision(p);
  assert.equal(dealerSpeechProfileRevision({...p,voice:{...p.voice,settings:{use_speaker_boost:true,similarity_boost:.85,stability:.5}}}),revision);
  assert.notEqual(dealerSpeechProfileRevision({...p,voice:{...p.voice,language:'en'}}),revision);
  assert.notEqual(dealerSpeechProfileRevision({...p,voice:{...p.voice,settings:{...p.voice.settings,stability:.6}}}),revision);
});
