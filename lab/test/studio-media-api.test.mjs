import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import { createStudioMediaApi } from '../lib/studio-media-api.mjs';
import { createStudioRepository } from '../../web/storage/studio-repository.mjs';
import { createStudioMemoryPool } from '../../test/fixtures/studio-memory-pool.mjs';
import {RETAINED_BANK_VARIANTS,createRetainedStudioMedia} from '../../web/storage/studio-contract.mjs';

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
