import test from 'node:test';
import { seedSavedVideoProject } from './fixtures/video-dealer-project.mjs';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import { createStudioMediaApi } from '../lib/studio-media-api.mjs';
import { createStudioRepository } from '../../packages/studio-registry/server/document-repository.mjs';
import { createStudioMemoryPool } from '../../test/fixtures/studio-memory-pool.mjs';
import {RETAINED_BANK_VARIANTS,createRetainedStudioMedia} from '../../packages/studio-registry/server/document-contract.mjs';
import { addDealer, createSeedProject } from '../../packages/presentation/contracts/studio-model.mjs';
import { wrapNativePresentationRepository } from '../lib/presentation-runtime-readiness.mjs';
import { negotiatePresentationCapabilityVersion, presentationCapabilitiesForVersion, PRESENTATION_CAPABILITY_VERSION_HEADER } from '../../packages/presentation/capability-contract.mjs';

test('native classify blocks alpha and roulette on v11 before SQL, bytes or transaction admission',async()=>{
  for(const change of [{compositing:{mode:'alpha'}},{kind:'action',eventId:'roulette.wheel-start',situation:'wheel-start',game:'roulette',action:'wheel-start',startPose:'VILA',endPose:'WHEEL'}]){
    const f=await fixture(),before=f.pool.calls.length;let bytes=0,admissions=0;
    const repository=wrapNativePresentationRepository(f.repository,{env:{CROUPIER_BACKEND_ORIGIN:'https://render.fixture.invalid'},fetchImpl:async(_url,init)=>{assert.equal(init.headers[PRESENTATION_CAPABILITY_VERSION_HEADER],'12');return Response.json(presentationCapabilitiesForVersion(11));}});
    const api=createStudioMediaApi({repository,config,authorize:async()=>({user:'Operator',role:'admin',scope}),videoRegistry:async()=>({videos:[]}),videoResponse:async()=>{bytes++;assert.fail('must not fetch bytes');},mutationTransaction:async()=>{admissions++;assert.fail('must not begin SQL');}});
    const response=await api.handle(request('/studio/api/videos/classify','POST',{id:f.record.id,sha256:f.record.sha256,previous:f.record.classification,metadata:{...f.record.classification,...change}}));
    assert.equal(response.status,503);assert.equal((await response.json()).code,'studio_presentation_runtime_update_required');
    assert.equal(bytes,0);assert.equal(admissions,0);assert.equal(f.pool.calls.length,before);assert.equal(f.pool.snapshot().audits.length,1);
  }
});
test('native roulette classify with v12 reuses exact readiness inside SQL and preserves file identity',async()=>{
  const f=await fixture(),before=f.pool.snapshot();let probes=0;
  const repository=wrapNativePresentationRepository(f.repository,{env:{CROUPIER_BACKEND_ORIGIN:'https://render.fixture.invalid'},fetchImpl:async()=>{probes++;return Response.json(presentationCapabilitiesForVersion(12));}});
  const api=createStudioMediaApi({repository,config,authorize:async()=>({user:'Operator',role:'admin',scope}),videoRegistry:async()=>({videos:await repository.listMedia()}),mutationTransaction:(work,options)=>repository.withMutationContext(work,options.presentationMutation)});
  const metadata={...f.record.classification,kind:'action',eventId:'roulette.wheel-start',situation:'wheel-start',game:'roulette',action:'wheel-start',startPose:'VILA',endPose:'WHEEL'};
  const response=await api.handle(request('/studio/api/videos/classify','POST',{id:f.record.id,sha256:f.record.sha256,previous:f.record.classification,metadata}));
  assert.equal(response.status,200);const row=await repository.getMedia(f.record.id);
  assert.deepEqual({...row.classification,compositing:undefined},{...metadata,compositing:undefined});
  assert.equal(row.sha256,f.record.sha256);assert.equal(row.pathname,f.record.pathname);assert.equal(row.size,f.record.size);
  assert.equal(probes,2,'one outer preflight, one admission probe, none while SQL is active');
  assert.equal(f.pool.snapshot().audits.length,before.audits.length+1);
});

test('native classification cannot rewrite a retained original identity or bank family',async()=>{
  const {api,repository,pool}=await fixture(),record=createRetainedStudioMedia(RETAINED_BANK_VARIANTS[0].id);
  await repository.registerMedia(record,{actor:'explicit-import'});const before=pool.snapshot();
  for(const metadata of [record.classification,{...record.classification,familyId:'astrid/deal.player.left/box1'}]){
    assert.equal((await api.handle(request('/studio/api/videos/classify','POST',{id:record.id,sha256:record.sha256,previous:record.classification,metadata}))).status,409);
  }
  assert.deepEqual(pool.snapshot(),before);
});

const origin = 'https://studio.example.invalid', scope = Object.freeze({environment:'test',workspaceId:'studio-test'});
const config = {scope,apiBase:'/studio/api/admin',authBase:'/studio/api/auth',
  allowedOrigins:['https://public.example.invalid',origin],publicHosts:['public.example.invalid','studio.example.invalid']};
const mediaId = '00000000-0000-4000-8000-000000000001', sha256 = 'd'.repeat(64);
const request = (path = '/studio/api/videos', method = 'GET', body, headers = {}) => new Request(`${origin}${path}`,{method,
  headers:{...(body === undefined ? {} : {origin,'sec-fetch-site':'same-origin','content-type':'application/json'}),...headers},
  ...(body === undefined ? {} : {body:JSON.stringify(body)}),
});
async function fixture(options = {}) {
  const pool = createStudioMemoryPool(), repository = createStudioRepository({pool,scope});
  seedSavedVideoProject(pool,scope);
  const classification = {dealerId:'astrid',eventId:'idle.ready',kind:'idle',role:'alternative',situation:'',label:'Existing clip',notes:''};
  const record = {id:mediaId,sha256,size:32,contentType:'video/mp4',pathname:`croupier/media/dealers/astrid/review/uploads/${mediaId}/${sha256}.mp4`,classification};
  await repository.registerMedia(record,{actor:'migration'});
  const api = createStudioMediaApi({repository,config,authorize:async () => ({user:'Operator',role:'admin',scope}),
    mutationTransaction:async work => work(),
    videoRegistry:async () => ({videos:await repository.listMedia()}),
    videoResponse:async (id,req) => new Response(req.method === 'HEAD' ? null : id,{headers:{'Cache-Control':'private, no-store'}}),...options,
  });
  return {pool,repository,api,record};
}
test('native list/HEAD/preview authenticate current admin and resolve only exact UUID paths',async () => {
  const {api} = await fixture();
  assert.equal((await api.handle(request())).status,200);
  assert.equal((await api.handle(request(`/studio/api/videos/${mediaId}`,'HEAD'))).status,200);
  assert.equal(await (await api.handle(request(`/studio/api/videos/${mediaId}`))).text(),mediaId);
  for (const path of ['/studio/api/videos/https://evil.invalid/file','/studio/api/videos/classify','/studio/api/videos/%2e%2e','/studio/api/videos/unknown']) {
    assert.ok([403,404].includes((await api.handle(request(path))).status));
  }
  for (const role of ['reader','staff','player','partner']) {
    const {api} = await fixture({authorize:async () => ({user:'Reader',role,scope})});
    assert.equal((await api.handle(request())).status,403);
  }
});
test('native classification cannot save an opaque dealer while preserving the old record and journal',async()=>{
  const {api,record,repository,pool}=await fixture(),before=await repository.getMedia(mediaId),audits=pool.snapshot().audits.length;
  const response=await api.handle(request('/studio/api/videos/classify','POST',{id:record.id,sha256:record.sha256,previous:record.classification,
    metadata:{...record.classification,compositing:{mode:'opaque'}}}));
  assert.equal(response.status,422);assert.equal((await response.json()).error,'studio_dealer_background_required');
  assert.deepEqual(await repository.getMedia(mediaId),before);assert.equal(pool.snapshot().audits.length,audits);
});
test('native metadata CAS uses prior exact classification and byte hash, audits authenticated actor and rejects stale writers',async () => {
  const {api,record,repository,pool} = await fixture();
  const changed = {...record.classification,label:'Changed clip'};
  const body = {id:record.id,sha256:record.sha256,previous:record.classification,metadata:changed};
  const first = await api.handle(request('/studio/api/videos/classify','POST',body)); assert.equal(first.status,200);
  assert.equal((await repository.getMedia(mediaId)).classification.label,'Changed clip');
  assert.equal(pool.snapshot().audits.at(-1).actor,'Operator'); assert.equal(pool.snapshot().audits.at(-1).action,'classify_media');
  assert.equal((await api.handle(request('/studio/api/videos/classify','POST',body))).status,409);
  assert.equal(pool.snapshot().audits.length,2);
});
test('two native classification writers have one winner; failed audit rolls back metadata',async () => {
  const {api,record,repository,pool} = await fixture();
  const responses = await Promise.all(['First','Second'].map(label => api.handle(request('/studio/api/videos/classify','POST',{
    id:record.id,sha256:record.sha256,previous:record.classification,metadata:{...record.classification,label},
  }))));
  assert.deepEqual(responses.map(row => row.status).sort(),[200,409]);
  const current = await repository.getMedia(mediaId), before = pool.snapshot(); pool.failNext('audit',new Error('private DB detail'));
  const response = await api.handle(request('/studio/api/videos/classify','POST',{id:record.id,sha256:record.sha256,previous:current.classification,metadata:{...current.classification,label:'Must rollback'}}));
  assert.equal(response.status,503); assert.deepEqual(pool.snapshot(),before);
});
test('native raw upload cannot execute old disk writes and cross-site metadata is rejected',async () => {
  const {api,record,pool} = await fixture();
  assert.equal((await api.handle(request('/studio/api/videos','POST',{}))).status,503);
  const body = {id:record.id,sha256:record.sha256,previous:record.classification,metadata:record.classification};
  for (const headers of [{origin:'https://evil.invalid'},{'sec-fetch-site':'same-site'},{'sec-fetch-site':'cross-site'}]) {
    assert.equal((await api.handle(request('/studio/api/videos/classify','POST',body,headers))).status,403);
  }
  assert.equal((await api.handle(request('/studio/api/videos/classify','POST',{...body,actor:'forged'}))).status,400);
  assert.equal(pool.snapshot().audits.length,1);
});

test('old idle refresh rereads newly registered clips without changing data and keeps native authorization',async () => {
  const {api,record,repository,pool} = await fixture();
  const first = await (await api.handle(request('/studio/api/videos/rescan','POST',{}))).json();
  assert.equal(first.videos.length,1);
  const id = '00000000-0000-4000-8000-000000000002';
  await repository.registerMedia({...record,id,pathname:record.pathname.replace(record.id,id)},{actor:'Uploader'});
  const before = pool.snapshot();
  const response = await api.handle(request('/studio/api/videos/rescan','POST',{}));
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal((await response.json()).videos.length,2);
  assert.deepEqual(pool.snapshot(),before,'refresh does not import, rewrite or audit a mutation');
  for (const headers of [{origin:'https://evil.invalid'},{'sec-fetch-site':'same-site'},{'sec-fetch-site':'cross-site'}]) {
    assert.equal((await api.handle(request('/studio/api/videos/rescan','POST',{},headers))).status,403);
  }
  const {api:reader} = await fixture({authorize:async () => ({user:'Reader',role:'reader',scope})});
  assert.equal((await reader.handle(request('/studio/api/videos/rescan','POST',{}))).status,403);
});

test('native client upload dispatch refreshes live authorization before prepare and after Blob verification',async () => {
  const calls = [];
  let revoked = false;
  const {api,pool} = await fixture({
    authorize:async () => revoked ? null : ({user:'Operator',role:'admin',scope}),
    uploads:{
      prepare:async (body,{actor}) => {calls.push({operation:body.operation,actor}); return {ticket:'signed',id:mediaId};},
      commit:async (body,{actor,request:actual,stillAuthorized}) => {
        calls.push({operation:body.operation,actor,url:actual.url});
        revoked = true;
        await stillAuthorized();
        throw new Error('must not persist after session revocation');
      },
    },
  });
  assert.equal((await (await api.handle(request())).json()).uploadMode,'private-client-blob');
  const prepared = await api.handle(request('/studio/api/videos/upload','POST',{operation:'prepare'}));
  assert.equal(prepared.status,200); assert.equal((await prepared.json()).ticket,'signed');
  const committed = await api.handle(request('/studio/api/videos/upload','POST',{operation:'commit',ticket:'signed'}));
  assert.equal(committed.status,403);
  assert.deepEqual(calls.map(({operation,actor}) => ({operation,actor})),[{operation:'prepare',actor:'Operator'},{operation:'commit',actor:'Operator'}]);
  assert.equal(pool.snapshot().audits.length,1);
  assert.equal((await api.handle(request('/studio/api/videos/upload','POST',{operation:'prepare'}))).status,403);
});

test('classification requires the product lock and cannot use a revoked or changed principal after waiting',async () => {
  for (const change of [principal => {principal.role = 'superadmin';},principal => {principal.scope = {...scope,workspaceId:'other'};}]) {
    const principal = {user:'Operator',role:'admin',scope};
    const {api,record,pool} = await fixture({authorize:async () => principal,mutationTransaction:async work => {change(principal);return work();}});
    const response = await api.handle(request('/studio/api/videos/classify','POST',{id:record.id,sha256:record.sha256,previous:record.classification,metadata:{...record.classification,label:'Rejected'}}));
    assert.equal(response.status,403);assert.equal(pool.snapshot().audits.length,1);
  }
  const {api,record,pool} = await fixture({mutationTransaction:undefined});
  assert.equal((await api.handle(request('/studio/api/videos/classify','POST',{id:record.id,sha256:record.sha256,previous:record.classification,metadata:record.classification}))).status,503);
  assert.equal(pool.snapshot().audits.length,1);
});

test('Next stripped videos routes pass the logical public request through preview ranges and upload CSRF',async()=>{
  const publicOrigin=config.allowedOrigins[0],headers={host:'studio.example.invalid','x-forwarded-host':'public.example.invalid',
    'x-forwarded-proto':'https',origin:publicOrigin,'sec-fetch-site':'same-origin',cookie:'bo_jwt=fixture'};
  let previews=0,prepared=0;
  const {api,pool}=await fixture({authorize:async actual=>{
    assert.equal(new URL(actual.url).origin,publicOrigin);assert.equal(actual.headers.get('cookie'),'bo_jwt=fixture');
    return {user:'Operator',role:'admin',scope};
  },videoResponse:async(id,actual)=>{
    previews++;assert.equal(id,mediaId);assert.equal(actual.url,publicOrigin+'/studio/api/videos/'+mediaId);
    assert.equal(actual.headers.get('range'),'bytes=0-3');return new Response(null,{status:206});
  },uploads:{prepare:async(body,{actor})=>{prepared++;assert.deepEqual(body,{operation:'prepare'});assert.equal(actor,'Operator');return {ticket:'fixture'};}}});
  assert.equal((await api.handle(new NextRequest(origin+'/api/videos',{headers}))).status,200);
  assert.equal((await api.handle(new NextRequest(origin+'/api/videos/'+mediaId,{headers:{...headers,range:'bytes=0-3'}}))).status,206);
  const upload=change=>new NextRequest(origin+'/api/videos/upload',{method:'POST',headers:{...headers,'content-type':'application/json',...change},body:'{"operation":"prepare"}'});
  assert.equal((await api.handle(upload())).status,200);assert.equal(prepared,1);assert.equal(previews,1);
  for(const change of [{origin},{origin:'https://evil.invalid'},{'x-forwarded-host':'public.example.invalid,evil.invalid'},{'sec-fetch-site':'same-site'}]){
    assert.equal((await api.handle(upload(change))).status,403);
  }
  assert.equal((await api.handle(new NextRequest(origin+'/api/videos/unknown',{headers}))).status,404);
  assert.equal(prepared,1);assert.equal(previews,1);assert.equal(pool.snapshot().audits.length,1);
});

test('archive is authenticated, reversible and stale-safe; it keeps the immutable file reference',async()=>{
  const {api,record,repository}=await fixture();
  const body={id:record.id,sha256:record.sha256,previous:record.classification,archived:true};
  assert.equal((await api.handle(request('/studio/api/videos/archive','POST',body,{origin:'https://evil.invalid'}))).status,403);
  assert.equal((await api.handle(request('/studio/api/videos/archive','POST',body))).status,200);
  const saved=await repository.getMedia(record.id);assert.equal(saved.classification.archived,true);assert.equal(saved.pathname,record.pathname);
  assert.equal((await api.handle(request('/studio/api/videos/archive','POST',body))).status,409);
  assert.equal((await api.handle(request('/studio/api/videos/archive','POST',{...body,previous:saved.classification,archived:false}))).status,200);
});
test('archive refuses current references and classification cannot bypass the archive guard',async()=>{
  const {api,record,repository}=await fixture();
  const document=await repository.readDocument('project'),value=structuredClone(document.value);
  const line=value.lines.find(row=>row.dealerId==='astrid'&&row.eventId==='idle.ready');line.variants[0].videoGenerationId=record.id;
  await repository.saveDocument('project',{value,expectedRevision:document.revision,actor:'fixture'});
  const body={id:record.id,sha256:record.sha256,previous:record.classification};
  const blocked=await api.handle(request('/studio/api/videos/archive','POST',{...body,archived:true}));
  assert.equal(blocked.status,409);assert.equal((await blocked.json()).error,'studio_media_in_use');
  assert.equal((await api.handle(request('/studio/api/videos/classify','POST',{...body,metadata:{...record.classification,archived:true}}))).status,400);
});

async function archiveReadinessFixture({dealerId='fixture-dealer',compositing,available=true,afterPreflight=()=>{}}={}) {
  const pool=createStudioMemoryPool(),rawRepository=createStudioRepository({pool,scope}),phases=[],versions=[];
  let project=createSeedProject(),insideTransaction=false;
  if(!project.dealers.some(row=>row.id===dealerId))project=addDealer(project,dealerId,'Fixture dealer');
  seedSavedVideoProject(pool,scope,project);
  const classification={dealerId,eventId:'idle.ready',kind:'idle',role:'alternative',situation:'',label:'Fixture clip',notes:'',
    ...(compositing?{compositing}:{})};
  const record={id:mediaId,sha256,size:32,contentType:'video/mp4',pathname:`croupier/media/dealers/${dealerId}/review/uploads/${mediaId}/${sha256}.mp4`,classification};
  await rawRepository.registerMedia(record,{actor:'fixture'});
  const principal={user:'Operator',role:'admin',scope};
  const repository=wrapNativePresentationRepository({...rawRepository,transaction:async(work,options)=>{
    assert.equal(insideTransaction,true);phases.push('media-transaction');
    return rawRepository.transaction(work,options);
  }},{env:{CROUPIER_BACKEND_ORIGIN:'https://runtime.example.invalid'},fetchImpl:async(url,options)=>{
    assert.equal(insideTransaction,false,'capability HTTP must precede either transaction');
    assert.equal(url,'https://runtime.example.invalid/api/presentation/capabilities');
    phases.push('capabilities');
    const version=negotiatePresentationCapabilityVersion(options.headers[PRESENTATION_CAPABILITY_VERSION_HEADER]);versions.push(version);
    afterPreflight(principal);
    return available?Response.json(presentationCapabilitiesForVersion(version)):new Response(null,{status:503});
  }});
  const api=createStudioMediaApi({repository,config,authorize:async()=>principal,
    videoRegistry:async()=>({videos:await repository.listMedia()}),
    mutationTransaction:(work,options={})=>repository.withMutationContext(async()=>{
      phases.push('product-transaction');insideTransaction=true;
      try{return await work();}finally{insideTransaction=false;}
    },options.presentationMutation),
  });
  const body={id:record.id,sha256:record.sha256,previous:record.classification,archived:true};
  return {api,body,record,repository:rawRepository,pool,phases,versions};
}

test('archive readiness preflights generic dealers and compositing before SQL, including restore',async()=>{
  for(const options of [{},{dealerId:'astrid',compositing:{mode:'green-screen',threshold:0.3,softness:0.1,despill:0.2}}]){
    const {api,body,record,repository,phases,versions}=await archiveReadinessFixture(options);
    assert.equal((await api.handle(request('/studio/api/videos/archive','POST',body))).status,200);
    const archived=await repository.getMedia(record.id);assert.equal(archived.classification.archived,true);
    assert.equal((await api.handle(request('/studio/api/videos/archive','POST',{...body,previous:archived.classification,archived:false}))).status,200);
    const restored=await repository.getMedia(record.id);assert.equal(restored.classification.archived,false);
    assert.equal(restored.pathname,record.pathname);assert.equal(restored.sha256,record.sha256);
    assert.deepEqual(phases,['capabilities','product-transaction','media-transaction','capabilities','product-transaction','media-transaction']);
    assert.deepEqual(versions,options.dealerId?[2,2]:[3,3]);
  }
});

test('archive readiness refuses an unavailable runtime before SQL without changing media or audits',async()=>{
  const {api,body,pool,phases}=await archiveReadinessFixture({available:false}),before=pool.snapshot();
  const response=await api.handle(request('/studio/api/videos/archive','POST',body));
  assert.equal(response.status,503);assert.equal((await response.json()).code,'studio_presentation_runtime_update_required');
  assert.deepEqual(phases,['capabilities']);assert.deepEqual(pool.snapshot(),before);
});

test('archive readiness preserves current authorization, metadata CAS and active-reference guards',async()=>{
  for(const guard of ['authorization','stale','references']){
    const {api,body,repository,pool}=await archiveReadinessFixture({
      afterPreflight:principal=>{if(guard==='authorization')principal.role='reader';},
    });
    if(guard==='stale')body.previous={...body.previous,label:'Stale clip'};
    if(guard==='references'){
      const document=await repository.readDocument('project'),value=structuredClone(document.value);
      value.lines.find(row=>row.dealerId===body.previous.dealerId&&row.eventId==='idle.ready').variants[0].videoGenerationId=body.id;
      await repository.saveDocument('project',{value,expectedRevision:document.revision,actor:'fixture'});
    }
    const before=pool.snapshot(),response=await api.handle(request('/studio/api/videos/archive','POST',body));
    assert.equal(response.status,guard==='authorization'?403:409);
    assert.deepEqual(pool.snapshot(),before);
  }
});
