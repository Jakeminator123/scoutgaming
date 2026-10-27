import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioMediaApi} from '../lib/studio-media-api.mjs';
import {createStudioRepository} from '../../../packages/studio-registry/server/document-repository.mjs';
import {createStudioMemoryPool} from '../../../test/fixtures/studio-memory-pool.mjs';
import {addDealer,createEmptyProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {normalizeRecordedSpeech,recordedSpeechForVideo,recordedSpeechIdentity} from '../../../packages/presentation/contracts/recorded-speech.mjs';
import {mediaTimingSpeechIdentity} from '../../../packages/presentation/contracts/media-timing.mjs';
import {wrapNativePresentationRepository} from '../lib/presentation-runtime-readiness.mjs';
import {presentationCapabilitiesForVersion,PRESENTATION_CAPABILITY_VERSION_HEADER} from '../../../packages/presentation/capability-contract.mjs';

const origin='https://studio.example.invalid',scope=Object.freeze({environment:'test',workspaceId:'speech-review'});
const config={scope,apiBase:'/studio/api/admin',authBase:'/studio/api/auth',
  allowedOrigins:['https://public.example.invalid',origin],publicHosts:['public.example.invalid','studio.example.invalid']};
const id='50000000-0000-4000-8000-000000000001',sha256='a'.repeat(64),path='/studio/api/videos/speech-review';
const request=(body,headers={},target=path)=>new Request(origin+target,{method:'POST',
  headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json',...headers},body:JSON.stringify(body)});
const selection={dealerId:'paow',lineId:'goodluck',language:'sv'};
const stable=record=>{const {revision,updatedAt,...rest}=record;return rest;};

async function fixture({measured=true,speech=true,authorize}={}) {
  const pool=createStudioMemoryPool(),repository=createStudioRepository({pool,scope}),descriptors=[];
  await repository.initializeDocument('project',{value:addDealer(createEmptyProject(),'paow','PAOW'),actor:'Fixture'});
  const declared={schemaVersion:2,sourceKind:'embedded-mp4-av',dealerId:'paow',lineId:'goodluck',takeId:'goodluck_1',language:'sv',
    exactText:'Lycka till.',videoSha256:sha256,fps:24,frameCount:72,videoTrackId:1,audioTrackId:2,entryPose:'VILA',exitPose:'VILA',
    source:{status:'pending'},review:{status:'pending'}};
  const classification={dealerId:'paow',eventId:speech?'speak.goodluck':'idle.ready',kind:speech?'speech':'idle',role:'alternative',
    situation:speech?'goodluck':'',label:'Synthetic take',notes:'',playback:'once',...(speech?{recordedSpeech:declared}:{})};
  let record=(await repository.registerMedia({id,sha256,size:4096,contentType:'video/mp4',
    pathname:`croupier/media/dealers/paow/review/uploads/${id}/${sha256}.mp4`,classification},{actor:'Uploader'})).media;
  if(measured)record=await repository.saveMediaTiming(id,{sha256,expectedRevision:record.revision,actor:'Inspector',mediaTiming:{schemaVersion:1,mediaId:id,sha256,size:4096,
    recordedSpeechIdentitySha256:speech?createHash('sha256').update(mediaTimingSpeechIdentity(declared)).digest('hex'):null,
    video:{trackId:1,frameCount:72,fps:24,firstPtsUs:0,lastPtsUs:2958333,endUs:3000000},audio:[{trackId:2,firstPtsUs:0,endUs:3200000}],endUs:3200000,audioTailUs:200000}});
  // The real readiness wrapper probes a synthetic runtime before SQL admission.
  const native=wrapNativePresentationRepository(repository,{env:{CROUPIER_BACKEND_ORIGIN:'https://render.fixture.invalid'},
    fetchImpl:async(_url,init)=>Response.json(presentationCapabilitiesForVersion(Number(init.headers[PRESENTATION_CAPABILITY_VERSION_HEADER])))});
  const api=createStudioMediaApi({repository:native,config,authorize:authorize??(async()=>({user:'Jakob',role:'admin',scope})),
    videoRegistry:async()=>({videos:await repository.listMedia()}),
    mutationTransaction:async(work,descriptor)=>{descriptors.push(structuredClone(descriptor));return native.withMutationContext(work,descriptor.presentationMutation);}});
  const body=verdict=>({id,sha256,...selection,expectedIdentity:speech?recordedSpeechIdentity(declared):null,verdict});
  return {pool,repository,api,record,descriptors,body};
}

test('approval stamps only the trusted reviewer verdict and leaves bytes, source and timing unchanged',async()=>{
  const f=await fixture(),audits=f.pool.snapshot().audits.length;
  assert.equal(recordedSpeechForVideo(f.record,selection),null,'a measured take still waits for review');
  const started=Date.now(),response=await f.api.handle(request(f.body('approved')));
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
  const payload=await response.json(),saved=await f.repository.getMedia(id),review=saved.classification.recordedSpeech.review;
  assert.equal(payload.attestation,'human-av-review');assert.deepEqual(payload.review,review);
  assert.deepEqual(payload.inventory.videos.find(row=>row.id===id),saved);
  assert.equal(review.status,'approved');assert.equal(review.by,'Jakob');
  assert.ok(Date.parse(review.at)>=started&&Date.parse(review.at)<=Date.now());
  assert.deepEqual(review.identity,recordedSpeechIdentity(saved.classification.recordedSpeech));
  const expected=structuredClone(stable(f.record));expected.classification.recordedSpeech.review=review;
  assert.deepEqual(stable(saved),expected,'sha256, size, pathname, source proof and mediaTiming are unchanged');
  assert.notEqual(saved.revision,f.record.revision);
  assert.deepEqual(normalizeRecordedSpeech(saved.classification.recordedSpeech,{dealerId:'paow',lineId:'goodluck',videoSha256:sha256}),saved.classification.recordedSpeech);
  assert.ok(recordedSpeechForVideo(saved,selection),'the approved take is selectable for publication');
  const audit=f.pool.snapshot().audits;
  assert.equal(audit.length,audits+1);assert.equal(audit.at(-1).actor,'Jakob');assert.equal(audit.at(-1).action,'classify_media');
  assert.equal(audit.at(-1).revision,saved.revision);
  assert.deepEqual(f.descriptors,[{presentationMutation:{metadata:f.record.classification}}]);
});

test('rejection and clearing reuse the same CAS writer; clearing restores the pending state exactly',async()=>{
  const f=await fixture();
  assert.equal((await f.api.handle(request(f.body('approved')))).status,200);
  assert.equal((await f.api.handle(request(f.body('rejected')))).status,200);
  let saved=await f.repository.getMedia(id);
  assert.equal(saved.classification.recordedSpeech.review.status,'rejected');
  assert.equal(recordedSpeechForVideo(saved,{...selection,requireApproved:false}),null,'a rejected take is never played');
  assert.equal((await f.api.handle(request(f.body(null)))).status,200);
  saved=await f.repository.getMedia(id);
  assert.deepEqual(stable(saved),stable(f.record));
  assert.equal(f.pool.snapshot().audits.filter(row=>row.subject===id).length,5);
});

test('unknown media, a different slot and media without a speech take are 404 without writes',async()=>{
  const f=await fixture(),before=f.pool.snapshot();
  assert.equal((await f.api.handle(request({...f.body('approved'),id:'50000000-0000-4000-8000-000000000099'}))).status,404);
  for(const change of [{lineId:'win'},{language:'en'},{dealerId:'dragan'}]){
    const response=await f.api.handle(request({...f.body('approved'),...change}));
    assert.equal(response.status,404);assert.equal((await response.json()).code,'studio_speech_take_missing');
  }
  assert.deepEqual(f.pool.snapshot(),before);
  const idle=await fixture({speech:false}),idleBefore=idle.pool.snapshot();
  const response=await idle.api.handle(request({...idle.body('rejected'),expectedIdentity:{}}));
  assert.equal(response.status,404);assert.equal((await response.json()).code,'studio_speech_take_missing');
  assert.deepEqual(idle.pool.snapshot(),idleBefore);
});

test('approval requires a server-verified embedded AV source; rejection does not',async()=>{
  const f=await fixture({measured:false}),before=f.pool.snapshot();
  const response=await f.api.handle(request(f.body('approved')));
  assert.equal(response.status,409);assert.equal((await response.json()).code,'studio_speech_source_unverified');
  assert.deepEqual(f.pool.snapshot(),before);
  assert.equal((await f.api.handle(request(f.body('rejected')))).status,200);
  const saved=await f.repository.getMedia(id);
  assert.equal(saved.classification.recordedSpeech.review.status,'rejected');
  assert.deepEqual(saved.classification.recordedSpeech.source,{status:'pending'});
});

test('a changed take identity or stale bytes are 409 without writes',async()=>{
  const f=await fixture(),before=f.pool.snapshot(),body=f.body('approved');
  for(const change of [{exactText:'Annan replik.'},{takeId:'goodluck_2'},{frameCount:73}]){
    const response=await f.api.handle(request({...body,expectedIdentity:{...body.expectedIdentity,...change}}));
    assert.equal(response.status,409);assert.equal((await response.json()).code,'studio_speech_identity_changed');
  }
  assert.equal((await f.api.handle(request({...body,sha256:'b'.repeat(64)}))).status,409);
  assert.deepEqual(f.pool.snapshot(),before);
});

test('only a current same-origin admin in this scope can review',async()=>{
  for(const authorize of [async()=>null,async()=>({user:'Viewer',role:'operator',scope}),
    async()=>({user:'Jakob',role:'admin',scope:{...scope,workspaceId:'other'}})]){
    const f=await fixture({authorize}),before=f.pool.snapshot();
    const response=await f.api.handle(request(f.body('approved')));
    assert.equal(response.status,403);assert.deepEqual(f.pool.snapshot(),before);
  }
  const f=await fixture(),before=f.pool.snapshot();
  for(const headers of [{origin:'https://foreign.invalid'},{'sec-fetch-site':'cross-site'}])
    assert.equal((await f.api.handle(request(f.body('approved'),headers))).status,403);
  let calls=0;
  const revoked=await fixture({authorize:async()=>++calls===1?{user:'Jakob',role:'admin',scope}:{user:'Jakob',role:'operator',scope}});
  const revokedBefore=revoked.pool.snapshot();
  assert.equal((await revoked.api.handle(request(revoked.body('approved')))).status,403);
  assert.deepEqual(revoked.pool.snapshot(),revokedBefore,'a changed role before SQL admission writes nothing');
  for(const body of [{...f.body('approved'),extra:true},{...f.body('maybe')},{...f.body('approved'),by:'Someone else'}])
    assert.equal((await f.api.handle(request(body))).status,400);
  assert.deepEqual(f.pool.snapshot(),before);
});

test('ordinary classification can keep or clear a review but never mint or reattribute one',async()=>{
  const f=await fixture(),classify=(previous,metadata)=>f.api.handle(request({id,sha256,previous,metadata},{},'/studio/api/videos/classify'));
  const forged=structuredClone(f.record.classification);
  forged.recordedSpeech.review={status:'approved',by:'Jakob',at:'2026-10-27T00:00:00.000Z',identity:recordedSpeechIdentity(forged.recordedSpeech)};
  const before=f.pool.snapshot();
  assert.equal((await classify(f.record.classification,forged)).status,422);
  assert.deepEqual(f.pool.snapshot(),before);
  assert.equal((await f.api.handle(request(f.body('approved')))).status,200);
  const approved=(await f.repository.getMedia(id)).classification;
  assert.equal((await classify(approved,{...approved,label:'Renamed take'})).status,200,'an exact review survives a label edit');
  let saved=await f.repository.getMedia(id);
  assert.deepEqual(saved.classification.recordedSpeech.review,approved.recordedSpeech.review);
  const reattributed=structuredClone(saved.classification);reattributed.recordedSpeech.review.by='Someone else';
  assert.equal((await classify(saved.classification,reattributed)).status,422);
  const cleared=structuredClone(saved.classification);cleared.recordedSpeech.review={status:'pending'};
  assert.equal((await classify(saved.classification,cleared)).status,200);
  saved=await f.repository.getMedia(id);
  assert.deepEqual(saved.classification.recordedSpeech.review,{status:'pending'});
  assert.deepEqual(saved.mediaTiming,f.record.mediaTiming);
});

function nextReviewRoute(api,native=true) {
  const file=new URL('../app/api/videos/speech-review/route.ts',import.meta.url),require=createRequire(import.meta.url);
  const {transformSync}=require('next/dist/build/swc');
  const {autoImplementMethods}=require('next/dist/server/route-modules/app-route/helpers/auto-implement-methods.js');
  const {code}=transformSync(readFileSync(file,'utf8'),{filename:file.pathname,jsc:{parser:{syntax:'typescript'}},module:{type:'commonjs'}});
  const module={exports:{}};
  runInNewContext(code,{module,exports:module.exports,Response,require:name=>{
    if(name==='@/lib/studio-native-runtime.mjs')return {nativeStudioAdminEnabled:()=>native};
    if(name==='@/lib/studio-media-api.mjs')return {handleNativeStudioMedia:request=>api.handle(request)};
    throw new Error('Unexpected route dependency: '+name);
  }},{filename:file.pathname});
  return autoImplementMethods(module.exports);
}

test('Next speech-review route reaches the native writer and has no fallback writer',async()=>{
  const f=await fixture(),route=nextReviewRoute(f.api);
  assert.equal((await route.POST(request(f.body('approved'),{'sec-fetch-site':'cross-site'}))).status,403);
  assert.equal((await route.POST(request(f.body('approved')))).status,200);
  assert.equal((await f.repository.getMedia(id)).classification.recordedSpeech.review.by,'Jakob');
  const fallback=nextReviewRoute({handle:()=>assert.fail('no fallback writer')},false);
  assert.equal((await fallback.POST(request({}))).status,503);
  assert.equal((await fallback.GET(new Request(origin+path))).status,405);
});
