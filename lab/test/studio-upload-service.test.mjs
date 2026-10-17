import test from 'node:test';
import { seedSavedVideoProject } from './fixtures/video-dealer-project.mjs';
import assert from 'node:assert/strict';
import { createHash,createHmac,randomUUID } from 'node:crypto';
import { mkdtemp,rm } from 'node:fs/promises';
import { basename,dirname,join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createStudioUploadService } from '../lib/studio-upload-service.mjs';
import {wrapNativePresentationRepository} from '../lib/presentation-runtime-readiness.mjs';
import {presentationCapabilitiesForVersion} from '../../packages/presentation/capability-contract.mjs';
import {extendedDealerMediaFeatures} from '../../packages/presentation/contracts/dealer-media-features.mjs';
import { createStudioRepository } from '../../packages/studio-registry/server/document-repository.mjs';
import { createStudioMemoryPool } from '../../test/fixtures/studio-memory-pool.mjs';
import {RETAINED_BANK_VARIANTS,createRetainedStudioMedia,canonicalStudioJson} from '../../packages/studio-registry/server/document-contract.mjs';
import sharp from 'sharp';
import {inspectWebmAlpha,assertMediaAlpha} from '../lib/media-alpha.mjs';

test('an upload grant cannot register retained bank status even with a valid server signature',async t=>{
  const {settings,context,pool}=await fixture(t),record=createRetainedStudioMedia(RETAINED_BANK_VARIANTS[0].id);
  let providerReads=0;
  const service=createStudioUploadService({...settings,privateMedia:async()=>{providerReads++;throw Error('must not read');}});
  const payload=Buffer.from(canonicalStudioJson({v:1,actor:'Operator',scope,record,expiresAt:2000})).toString('base64url');
  const ticket=`${payload}.${createHmac('sha256',key).update(`studio-upload-v1\0${payload}`).digest('base64url')}`;
  await assert.rejects(service.commit({operation:'commit',ticket},context),error=>error.code==='studio_upload_grant_invalid'&&error.statusCode===403);
  await assert.rejects(service.prepare({operation:'prepare',sha256:record.sha256,size:record.size,contentType:record.contentType,classification:record.classification,retainedBank:record.retainedBank},{actor:'Operator'}),error=>error.statusCode===400);
  assert.equal(providerReads,0);assert.equal(pool.snapshot().media.size,0);assert.equal(pool.snapshot().audits.length,0);
});

const scope=Object.freeze({environment:'test',workspaceId:'studio-test'}),key=Buffer.alloc(32,8),origin='https://studio.example.invalid';
const classification={dealerId:'astrid',eventId:'idle.ready',kind:'idle',role:'alternative',situation:'',label:'Uploaded clip',notes:''};

function speechFixture(){
  const bytes=Buffer.from('0000ftypisom00000private-speech-fixture'),sha256=createHash('sha256').update(bytes).digest('hex');
  const recordedSpeech={schemaVersion:1,dealerId:'astrid',lineId:'goodluck',takeId:'goodluck_1',language:'sv',exactText:'En exakt testreplik.',
    videoSha256:sha256,audioSha256:'b'.repeat(64),indexSha256:'c'.repeat(64),fps:24,frameCount:72,audioDelayMs:0,
    entryPose:'VILA',exitPose:'VILA',calibrationRevision:'fixture-v1',recording:{status:'pending'},review:{status:'pending'}};
  return {bytes,metadata:{...classification,eventId:'speak.goodluck',kind:'speech',situation:'goodluck',playback:'once',recordedSpeech}};
}

test('recorded speech requires v17 before Blob grants; commit binds exact bytes without auto-approving pending review',async t=>{
  const input=speechFixture(),old=await fixture(t,{...input,runtimeVersion:16}),before=old.pool.calls.length;
  await assert.rejects(old.prepare(),e=>e.code==='studio_presentation_runtime_update_required');
  assert.equal(old.pool.calls.length,before);assert.equal(old.tokenCalls.length,0);
  assert.equal(old.capabilityCalls[0]['X-Presentation-Capability-Version'],'17');
  const current=await fixture(t,{...input,runtimeVersion:17}),grant=await current.prepare();current.objects.set(grant.pathname,current.bytes);
  await current.service.commit({operation:'commit',ticket:grant.ticket},current.context);
  const stored=await current.repository.getMedia(grant.id);
  assert.deepEqual(stored.classification.recordedSpeech,input.metadata.recordedSpeech);
  assert.equal(stored.classification.recordedSpeech.videoSha256,stored.sha256);
  assert.equal(current.pool.snapshot().audits.length,1);assert.ok(current.capabilityCalls.every(headers=>headers['X-Presentation-Capability-Version']==='17'));
});

test('v17 speech grants cannot commit after downgrade, at SQL admission, or through an unwrapped repository',async t=>{
  for(const mode of ['before-blob','at-sql','unwrapped']){
    const f=await fixture(t,{...speechFixture(),runtimeVersion:17}),grant=await f.prepare();f.objects.set(grant.pathname,f.bytes);
    let reads=0;const before=f.pool.calls.length;
    const service=createStudioUploadService({...f.settings,...(mode==='unwrapped'?{repository:f.repository}:{})});
    let context=f.context;
    if(mode==='before-blob'){
      f.setRuntime(16);
      const noBlob=createStudioUploadService({...f.settings,privateMedia:async()=>{reads++;assert.fail('no Blob read after downgrade');}});
      await assert.rejects(noBlob.commit({operation:'commit',ticket:grant.ticket},context),e=>e.code==='studio_presentation_runtime_update_required');
      assert.equal(reads,0);assert.equal(f.pool.calls.length,before);
    }else{
      if(mode==='at-sql')context={...context,mutationTransaction:(work,options)=>{f.setRuntime(16);return f.context.mutationTransaction(work,options);}};
      if(mode==='unwrapped')await assert.rejects(service.prepare({operation:'prepare',sha256:grant.pathname.split('/').at(-1).split('.')[0],size:f.bytes.length,contentType:'video/mp4',classification:speechFixture().metadata},{actor:'Operator'}),e=>e.code==='studio_presentation_runtime_update_required');
      await assert.rejects(service.commit({operation:'commit',ticket:grant.ticket},context),e=>e.code==='studio_presentation_runtime_update_required');
    }
    assert.equal(f.pool.snapshot().media.size,0);assert.equal(f.pool.snapshot().audits.length,0);assert.equal(f.tokenCalls.length,1);
  }
});

test('storage MIME or v11 readiness blocks prepare before any SQL read, Blob grant or registry write',async t=>{
  const candidates=[
    {contentType:'image/png',metadata:{...classification,eventId:'roulette.reference',situation:'VILA',mediaType:'image',game:'roulette',action:'reference',startPose:'VILA',endPose:'VILA',compositing:{mode:'alpha'}}},
    {contentType:'video/webm',metadata:{...classification,compositing:{mode:'alpha'}}},
    {contentType:'video/mp4',metadata:{...classification,kind:'action',eventId:'roulette.wheel-start',situation:'wheel-start',game:'roulette',action:'wheel-start',startPose:'VILA',endPose:'WHEEL',compositing:{mode:'green-screen',threshold:.23,softness:.15,despill:0}}},
  ];
  for(const input of candidates){
    const f=await fixture(t,{...input,runtimeVersion:11}),before=f.pool.calls.length;
    const unsupported=input.contentType==='image/png';
    await assert.rejects(f.prepare(),e=>e.code===(unsupported?'studio_media_content_type_unsupported':'studio_presentation_runtime_update_required'));
    assert.equal(f.pool.calls.length,before);assert.equal(f.tokenCalls.length,0);assert.equal(f.objects.size,0);
    assert.equal(f.pool.snapshot().media.size,0);assert.equal(f.pool.snapshot().audits.length,0);
    if(unsupported)assert.equal(f.capabilityCalls.length,0);
    else assert.equal(f.capabilityCalls[0]['X-Presentation-Capability-Version'],'12');
  }
});
test('v12 grant cannot commit after Render returns v11; no Blob fetch or SQL executes',async t=>{
  const f=await fixture(t,{contentType:'video/webm',metadata:{...classification,compositing:{mode:'alpha'}},runtimeVersion:12});
  const grant=await f.prepare();f.setRuntime(11);const before=f.pool.calls.length;let reads=0;
  const service=createStudioUploadService({...f.settings,privateMedia:async()=>{reads++;assert.fail('must not read Blob');}});
  await assert.rejects(service.commit({operation:'commit',ticket:grant.ticket},f.context),e=>e.code==='studio_presentation_runtime_update_required');
  assert.equal(reads,0);assert.equal(f.pool.calls.length,before);assert.equal(f.pool.snapshot().media.size,0);
});
test('new media cannot bypass readiness through an unwrapped upload repository',async t=>{
  const f=await fixture(t,{contentType:'video/webm',metadata:{...classification,compositing:{mode:'alpha'}},runtimeVersion:12});
  const grant=await f.prepare(),before=f.pool.calls.length;
  const service=createStudioUploadService({...f.settings,repository:f.repository});
  await assert.rejects(service.prepare({operation:'prepare',sha256:'a'.repeat(64),size:32,contentType:'video/webm',classification:{...classification,compositing:{mode:'alpha'}}},{actor:'Operator'}),e=>e.code==='studio_presentation_runtime_update_required');
  await assert.rejects(service.commit({operation:'commit',ticket:grant.ticket},f.context),e=>e.code==='studio_presentation_runtime_update_required');
  assert.equal(f.pool.calls.length,before);assert.equal(f.tokenCalls.length,1);assert.equal(f.pool.snapshot().media.size,0);
});
test('Render downgrade at transaction admission cannot register roulette video',async t=>{
  const metadata={...classification,kind:'action',eventId:'roulette.wheel-start',situation:'wheel-start',game:'roulette',action:'wheel-start',startPose:'VILA',endPose:'WHEEL'};
  const f=await fixture(t,{metadata,runtimeVersion:12}),grant=await f.prepare();f.objects.set(grant.pathname,f.bytes);
  const context={...f.context,mutationTransaction:(work,options)=>{f.setRuntime(11);return f.context.mutationTransaction(work,options);}};
  await assert.rejects(f.service.commit({operation:'commit',ticket:grant.ticket},context),e=>e.code==='studio_presentation_runtime_update_required');
  assert.equal(f.pool.snapshot().media.size,0);assert.equal(f.pool.snapshot().audits.length,0);
});

test('verified roulette PNG remains blocked by storage before capability, SQL and Blob grant',async t=>{
  const bytes=await sharp(Buffer.from([10,200,30,255,20,220,40,0]),{raw:{width:2,height:1,channels:4}}).png().toBuffer();
  const metadata={...classification,eventId:'roulette.reference',situation:'VILA',mediaType:'image',game:'roulette',action:'reference',startPose:'VILA',endPose:'VILA',compositing:{mode:'alpha'}};
  await assertMediaAlpha(bytes,'image/png');
  const f=await fixture(t,{bytes,contentType:'image/png',metadata}),before=f.pool.calls.length;
  await assert.rejects(f.prepare(),error=>error.code==='studio_media_content_type_unsupported'&&error.statusCode===415);
  assert.equal(f.pool.calls.length,before);assert.equal(f.capabilityCalls.length,0);assert.equal(f.tokenCalls.length,0);assert.equal(f.objects.size,0);
  assert.equal(f.pool.snapshot().media.size,0);assert.equal(f.pool.snapshot().audits.length,0);
});
test('opaque PNG and MP4 cannot be labelled as verified alpha',async t=>{
  const bytes=await sharp({create:{width:2,height:2,channels:4,background:{r:20,g:20,b:20,alpha:1}}}).png().toBuffer();
  const metadata={...classification,eventId:'roulette.reference',situation:'VILA',mediaType:'image',game:'roulette',action:'reference',startPose:'VILA',endPose:'VILA',compositing:{mode:'alpha'}};
  await assert.rejects(assertMediaAlpha(bytes,'image/png'),error=>error.code==='studio_media_alpha_required');
  const wrong=await fixture(t,{metadata:{...classification,compositing:{mode:'alpha'}}});await assert.rejects(wrong.prepare(),error=>error.code==='studio_invalid_media');
  assert.throws(()=>inspectWebmAlpha(Buffer.from('filename_spin_transparent.webm')),error=>error.code==='studio_media_alpha_required');
});
async function fixture(t,{bytes=Buffer.from('0000ftypisom00000private-upload-fixture'),contentType='video/mp4',metadata=classification,runtimeVersion}={}) {
  const cacheDir=await mkdtemp(join(tmpdir(),'croupier-upload-service-'));
  t.after(() => {assert.equal(dirname(resolve(cacheDir)),resolve(tmpdir()));assert.match(basename(cacheDir),/^croupier-upload-service-/);return rm(cacheDir,{recursive:true,force:true});});
  const pool=createStudioMemoryPool(),repository=createStudioRepository({pool,scope}),objects=new Map(),tokenCalls=[];
  seedSavedVideoProject(pool,scope);
  const env={CROUPIER_MEDIA_STORAGE:'blob',BLOB_READ_WRITE_TOKEN:'fixture-read-write-secret'},options={cacheDir,blobClient:{
    async get(path) {
      const content=objects.get(path);if(!content)return null;
      return {statusCode:200,stream:new Response(content).body,blob:{pathname:path,url:`https://fixture.private.blob.vercel-storage.com/${path}`,contentType,size:content.length}};
    },
  }};
  let at=1000;
  const capabilityCalls=[],features=extendedDealerMediaFeatures(metadata);let runtime=runtimeVersion??12;
  const nativeRepository=runtimeVersion!==undefined||features.mediaAlpha||features.rouletteMedia||features.recordedSpeech
    ?wrapNativePresentationRepository(repository,{env:{CROUPIER_BACKEND_ORIGIN:'https://render.fixture.invalid'},fetchImpl:async(_url,init)=>{capabilityCalls.push(init.headers);return Response.json(presentationCapabilitiesForVersion(runtime));}}):repository;
  const settings={repository:nativeRepository,scope,ticketKey:key,env,options,clientToken:async args => {tokenCalls.push(args);return 'fixture-only-client-capability';},now:() => at};
  const service=createStudioUploadService(settings),sha256=createHash('sha256').update(bytes).digest('hex');
  const prepare=() => service.prepare({operation:'prepare',sha256,size:bytes.length,contentType,classification:metadata},{actor:'Operator'});
  const context={actor:'Operator',request:new Request(`${origin}/studio/api/videos/upload`,{method:'POST'}),stillAuthorized:async () => true,mutationTransaction:(work,options)=>nativeRepository.withMutationContext?nativeRepository.withMutationContext(work,options.presentationMutation):work()};
  return {pool,repository,nativeRepository,service,settings,bytes,objects,tokenCalls,capabilityCalls,prepare,context,setTime:value => {at=value;},setRuntime:value=>{runtime=value;}};
}
test('prepare issues only an immutable private path capability with MIME/byte/time bounds and no metadata commit',async t => {
  const {prepare,tokenCalls,pool,bytes}=await fixture(t),grant=await prepare(),token=tokenCalls[0];
  assert.equal(token.pathname,grant.pathname);assert.equal(token.maximumSizeInBytes,bytes.length);assert.deepEqual(token.allowedContentTypes,['video/mp4']);
  assert.equal(token.addRandomSuffix,false);assert.equal(token.allowOverwrite,false);assert.equal(token.validUntil,grant.expiresAt);
  assert.equal(pool.snapshot().media.size,0);assert.equal(pool.snapshot().audits.length,0);
  assert.ok(!JSON.stringify(grant).includes('fixture-read-write-secret'));
  const signed=JSON.parse(Buffer.from(grant.ticket.split('.')[0],'base64url').toString('utf8'));
  assert.equal(signed.record.classification.compositing.mode,'green-screen');
});
test('new explicit opaque upload is rejected before granting provider access or writing media',async t=>{
  const {prepare,tokenCalls,pool}=await fixture(t,{metadata:{...classification,compositing:{mode:'opaque'}}});
  await assert.rejects(prepare(),error=>error.code==='studio_dealer_background_required'&&error.statusCode===422);
  assert.equal(tokenCalls.length,0);assert.equal(pool.snapshot().media.size,0);
});
test('commit verifies actual Blob hash/header then atomically registers and audits; restart/replay is idempotent',async t => {
  const {prepare,service,settings,objects,bytes,context,pool,repository}=await fixture(t),grant=await prepare();
  objects.set(grant.pathname,bytes);
  assert.deepEqual(await service.commit({operation:'commit',ticket:grant.ticket},context),{id:grant.id,duplicate:false});
  const stored=await repository.getMedia(grant.id);assert.equal(stored.sha256,createHash('sha256').update(bytes).digest('hex'));
  assert.equal(pool.snapshot().audits.length,1);assert.equal(pool.snapshot().audits[0].actor,'Operator');
  const restarted=createStudioUploadService({...settings,repository:createStudioRepository({pool,scope})});
  assert.deepEqual(await restarted.commit({operation:'commit',ticket:grant.ticket},context),{id:grant.id,duplicate:true});
  assert.equal(pool.snapshot().media.size,1);assert.equal(pool.snapshot().audits.length,1);
});
test('forged, expired, another actor/scope grant and public URL injection cannot register media',async t => {
  const {prepare,service,settings,objects,bytes,context,setTime,pool}=await fixture(t),grant=await prepare();objects.set(grant.pathname,bytes);
  const changed=grant.ticket.slice(0,-1)+(grant.ticket.endsWith('A')?'B':'A');
  await assert.rejects(service.commit({operation:'commit',ticket:changed},context),error => error.statusCode===403);
  await assert.rejects(service.commit({operation:'commit',ticket:grant.ticket},{...context,actor:'Other'}),error => error.statusCode===403);
  const otherScope={...scope,workspaceId:'other'},other=createStudioUploadService({...settings,scope:otherScope,repository:createStudioRepository({pool,scope:otherScope})});
  await assert.rejects(other.commit({operation:'commit',ticket:grant.ticket},context),error => error.statusCode===403);
  await assert.rejects(service.commit({operation:'commit',ticket:grant.ticket,url:'https://evil.invalid'},context),error => error.statusCode===400);
  setTime(grant.expiresAt);await assert.rejects(service.commit({operation:'commit',ticket:grant.ticket},context),error => error.statusCode===403);
  assert.equal(pool.snapshot().media.size,0);
});
test('changed actual bytes, invalid format and revoked identity fail before metadata/audit',async t => {
  const {prepare,service,objects,bytes,context,pool}=await fixture(t),grant=await prepare();
  const corrupt=Buffer.from(bytes);corrupt[corrupt.length-1]^=1;objects.set(grant.pathname,corrupt);
  await assert.rejects(service.commit({operation:'commit',ticket:grant.ticket},context),error => error.statusCode===503);
  assert.equal(pool.snapshot().media.size,0);
  objects.set(grant.pathname,bytes);
  await assert.rejects(service.commit({operation:'commit',ticket:grant.ticket},{...context,stillAuthorized:async () => false}),error => error.statusCode===403);
  const wrong=await fixture(t,{bytes:Buffer.from('invalid-mp4-header-with-enough-fixture-bytes')}),wrongGrant=await wrong.prepare();wrong.objects.set(wrongGrant.pathname,wrong.bytes);
  await assert.rejects(wrong.service.commit({operation:'commit',ticket:wrongGrant.ticket},wrong.context),error => error.statusCode===415);
  assert.equal(wrong.pool.snapshot().media.size,0);assert.equal(pool.snapshot().audits.length,0);
});
test('audit failure leaves verified private bytes for explicit retry without an ambiguous automatic deletion',async t => {
  const {prepare,service,objects,bytes,context,pool}=await fixture(t),grant=await prepare();objects.set(grant.pathname,bytes);
  pool.failNext('audit',new Error('private connection detail'));
  await assert.rejects(service.commit({operation:'commit',ticket:grant.ticket},context),error => error.statusCode===503);
  assert.equal(pool.snapshot().media.size,0);assert.equal(objects.size,1);
  assert.deepEqual(await service.commit({operation:'commit',ticket:grant.ticket},context),{id:grant.id,duplicate:false});
});
test('parallel commit of one grant registers exactly one media record and one audit',async t => {
  const {prepare,service,objects,bytes,context,pool}=await fixture(t),grant=await prepare();objects.set(grant.pathname,bytes);
  const results=await Promise.all([service.commit({operation:'commit',ticket:grant.ticket},context),service.commit({operation:'commit',ticket:grant.ticket},context)]);
  assert.equal(results.filter(row => !row.duplicate).length,1);assert.equal(pool.snapshot().media.size,1);assert.equal(pool.snapshot().audits.length,1);
});

test('complete Blob verification stays outside the product lock; revocation at lock acquisition blocks registration',async t => {
  const {prepare,settings,objects,bytes,context,pool,repository}=await fixture(t),grant=await prepare();objects.set(grant.pathname,bytes);
  let locked = false,authorized = true,fetches = 0,reads = 0,writes = 0;
  const service = createStudioUploadService({...settings,
    options:{...settings.options,blobClient:{get:async path => {assert.equal(locked,false);fetches++;return settings.options.blobClient.get(path);}}},
    repository:{...repository,getMedia:async id => {assert.equal(locked,true);reads++;return repository.getMedia(id);},registerMedia:async (...args) => {assert.equal(locked,true);writes++;return repository.registerMedia(...args);}},
  });
  const commitContext = {...context,stillAuthorized:async () => {assert.equal(locked,true);return authorized;},
    mutationTransaction:async work => {authorized = false;locked = true;try{return await work();}finally{locked = false;}},
  };
  await assert.rejects(service.commit({operation:'commit',ticket:grant.ticket},commitContext),error => error.statusCode===403);
  assert.equal(fetches,1);assert.equal(reads,0);assert.equal(writes,0);assert.equal(pool.snapshot().media.size,0);assert.equal(pool.snapshot().audits.length,0);
  commitContext.mutationTransaction = async work => {authorized = true;locked = true;try{return await work();}finally{locked = false;}};
  assert.deepEqual(await service.commit({operation:'commit',ticket:grant.ticket},commitContext),{id:grant.id,duplicate:false});
  assert.equal(reads,1);assert.equal(writes,1);assert.equal(pool.snapshot().audits.length,1);
  await assert.rejects(service.commit({operation:'commit',ticket:grant.ticket},{...context,mutationTransaction:undefined}),error => error.statusCode===503);
  assert.equal(pool.snapshot().audits.length,1);
});

test('WAV and MP3 speech fail before grants, capability probes and any SQL or Blob IO',async t=>{
  const metadata={...classification,eventId:'speak.goodluck',kind:'speech',situation:'goodluck',mediaType:'audio'};
  for(const contentType of ['audio/wav','audio/mpeg']){
    const f=await fixture(t,{contentType,metadata}),before=f.pool.calls.length;
    await assert.rejects(f.prepare(),error=>error.code==='studio_media_content_type_unsupported'&&error.statusCode===415);
    assert.equal(f.pool.calls.length,before);assert.equal(f.capabilityCalls.length,0);assert.equal(f.tokenCalls.length,0);assert.equal(f.objects.size,0);
  }
});
test('previously signed PNG and audio tickets cannot fetch bytes or register on the current schema',async t=>{
  for(const contentType of ['image/png','audio/wav','audio/mpeg']){
    const metadata=contentType==='image/png'?{...classification,eventId:'roulette.reference',situation:'VILA',mediaType:'image',game:'roulette',action:'reference',startPose:'VILA',endPose:'VILA',compositing:{mode:'alpha'}}:{...classification,eventId:'speak.goodluck',kind:'speech',situation:'goodluck',mediaType:'audio'};
    const f=await fixture(t,{contentType,metadata}),id=randomUUID(),sha256='a'.repeat(64),ext=contentType==='image/png'?'png':contentType==='audio/wav'?'wav':'mp3';
    const record={id,sha256,size:32,contentType,classification:metadata,pathname:`croupier/media/dealers/astrid/review/uploads/${id}/${sha256}.${ext}`};
    const payload=Buffer.from(canonicalStudioJson({v:1,actor:'Operator',scope,record,expiresAt:2000})).toString('base64url');
    const ticket=`${payload}.${createHmac('sha256',key).update(`studio-upload-v1\0${payload}`).digest('base64url')}`;
    let reads=0,transactions=0;const before=f.pool.calls.length;
    const service=createStudioUploadService({...f.settings,privateMedia:async()=>{reads++;assert.fail('must not fetch');}});
    await assert.rejects(service.commit({operation:'commit',ticket},{...f.context,mutationTransaction:async()=>{transactions++;assert.fail('must not write');}}),error=>error.code==='studio_media_content_type_unsupported'&&error.statusCode===415);
    assert.equal(reads,0);assert.equal(transactions,0);assert.equal(f.pool.calls.length,before);assert.equal(f.capabilityCalls.length,0);
  }
});
