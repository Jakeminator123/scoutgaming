import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import { createStudioDocumentApi } from '../lib/studio-document-api.mjs';
import { createSeedProject, addDealer, defaultPresentationLane } from '../../../packages/presentation/contracts/studio-model.mjs';
import { defaultCompositionSettings } from '../../../packages/presentation/contracts/composition-settings.mjs';
import { wrapNativePresentationRepository, PRESENTATION_RUNTIME_UPDATE_REQUIRED, PRESENTATION_RUNTIME_UPDATE_MESSAGE } from '../lib/presentation-runtime-readiness.mjs';
import { createSocialPolicy } from './fixtures/social-store.mjs';
import { createStudioRepository } from '../../../packages/studio-registry/server/document-repository.mjs';
import { createStudioMemoryPool } from '../../../test/fixtures/studio-memory-pool.mjs';

const origin = 'https://studio.example.invalid', scope = Object.freeze({ environment: 'test', workspaceId: 'studio-test' });
const config = { scope, apiBase: '/studio/api/admin', authBase: '/studio/api/auth',
  allowedOrigins: ['https://public.example.invalid', origin], publicHosts: ['public.example.invalid','studio.example.invalid'] };
const request = (path = '/studio/api/project', { method = 'GET', body, headers = {} } = {}) => new Request(`${origin}${path}`, {
  method, headers: { ...(body === undefined ? {} : { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' }), ...headers },
  ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
});
async function fixture(options = {}) {
  const pool = createStudioMemoryPool(), repository = createStudioRepository({ pool, scope });
  const initial = await repository.initializeDocument('project', { value: createSeedProject(), actor: 'migration' });
  const policy = await repository.initializeDocument('social-policy', { value: createSocialPolicy(), actor: 'migration' });
  const api = createStudioDocumentApi({ repository, config,
    authorize: async () => ({ user: 'Operator', role: 'admin', scope }),
    validateProjectBindings: async () => {}, mutationTransaction: async work => work(), ...options,
  });
  return { pool, repository, initial, policy, api };
}
test('native policy GET uses the shared repository and PUT records authenticated actor plus CAS history', async () => {
  const { api, initial, repository, pool } = await fixture();
  const loaded = await api.handle(request()); assert.equal(loaded.status, 200);
  assert.deepEqual((await loaded.json()).project, initial.value);
  assert.equal(loaded.headers.get('cache-control'), 'private, no-store');
  const draft = structuredClone(initial.value); draft.events[0].label = 'Native Studio label';
  const response = await api.handle(request(undefined, { method: 'PUT', body: { project: draft, expectedRevision: initial.revision } }));
  assert.equal(response.status, 200);
  const saved = (await response.json()).project;
  assert.equal(saved.events[0].label, 'Native Studio label'); assert.notEqual(saved.revision, initial.revision);
  assert.deepEqual((await repository.readDocument('project')).value, saved);
  assert.equal(pool.snapshot().audits.at(-1).actor, 'Operator');
  const stale = await api.handle(request(undefined, { method: 'PUT', body: { project: draft, expectedRevision: initial.revision } }));
  assert.equal(stale.status, 409); assert.equal(pool.snapshot().history.length, 1);
});
test('BO reader/staff and player identities never gain Studio document access', async () => {
  for (const role of ['reader', 'staff', 'player', 'partner', 'admin ']) {
    const { api, pool } = await fixture({ authorize: async () => ({ user: 'Reader', role, scope }) });
    const connects = pool.connects;
    assert.equal((await api.handle(request())).status, 403); assert.equal(pool.connects, connects);
  }
});
test('spoofed host/origin, cross-site, encoded paths and actor/scope body injection are rejected without writes', async () => {
  const { api, initial, pool } = await fixture();
  for (const headers of [{ origin: 'https://evil.invalid' }, { host: 'evil.invalid' }, { 'x-forwarded-host': 'evil.invalid' },
    { 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': 'same-site' }, { 'next-action': 'action' }, { origin: '' }]) {
    assert.equal((await api.handle(request(undefined, { method: 'PUT', body: { project: initial.value, expectedRevision: initial.revision }, headers }))).status, 403);
  }
  for (const path of ['/studio/api/%70roject', '/studio/api/project?scope=production', '/studio/api/social/profile']) {
    assert.ok([403,404].includes((await api.handle(request(path))).status));
  }
  for (const key of ['actor','scope','session','other']) {
    assert.equal((await api.handle(request(undefined, { method: 'PUT', body: { project: initial.value, expectedRevision: initial.revision, [key]: 'forged' } }))).status, 400);
  }
  assert.equal(pool.snapshot().audits.length, 2); assert.equal(pool.snapshot().history.length, 0);
});
test('scope mismatch, missing live account and changed identity during body validation fail closed', async () => {
  for (const authorize of [async () => ({ user: 'Operator', role: 'admin', scope: { ...scope, workspaceId: 'other' } }),
    async () => { throw Object.assign(new Error('secret account detail'), { statusCode: 401 }); }]) {
    const { api, initial } = await fixture({ authorize });
    assert.ok([401,403].includes((await api.handle(request(undefined, { method: 'PUT', body: { project: initial.value, expectedRevision: initial.revision } }))).status));
  }
  let authorizations = 0;
  const { api, initial, pool } = await fixture({ authorize: async () => ({ user: ++authorizations === 1 ? 'Operator' : 'Other', role: 'admin', scope }) });
  assert.equal((await api.handle(request(undefined, { method: 'PUT', body: { project: initial.value, expectedRevision: initial.revision } }))).status, 403);
  assert.equal(pool.snapshot().history.length, 0);
});
test('unverified media verifier blocks native project writes; social saved policy has separate CAS', async () => {
  const { api, initial, policy, repository, pool } = await fixture({ validateProjectBindings: undefined });
  assert.equal((await api.handle(request(undefined, { method: 'PUT', body: { project: initial.value, expectedRevision: initial.revision } }))).status, 503);
  const draft = structuredClone(policy.value); draft.cooldownMs = 2000;
  const saved = await api.handle(request('/studio/api/social', { method: 'PUT', body: { policy: draft, expectedRevision: policy.revision } }));
  assert.equal(saved.status, 200); assert.equal((await saved.json()).policy.cooldownMs, 2000);
  assert.equal((await repository.readDocument('project')).revision, initial.revision);
  assert.equal(pool.snapshot().history.length, 1);
});
test('stream body bounds, invalid content type, UTF-8 and JSON are rejected without audit', async () => {
  const { api, initial, pool } = await fixture();
  const body = { project: initial.value, expectedRevision: initial.revision };
  for (const [headers, expected] of [[{ 'content-type': 'text/plain' },415], [{ 'content-length': '-1' },400], [{ 'content-length': '1048577' },413]]) {
    assert.equal((await api.handle(request(undefined, { method: 'PUT', body, headers }))).status, expected);
  }
  assert.equal((await api.handle(request(undefined, { method: 'PUT', body: '{invalid json' }))).status, 400);
  const invalid = new Request(`${origin}/studio/api/project`, { method: 'PUT', body: new Uint8Array([0xff]), headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' } });
  assert.equal((await api.handle(invalid)).status, 400);
  assert.equal((await api.handle(request(undefined, { method: 'PUT', body: ' '.repeat(1048577) }))).status, 413);
  assert.equal(pool.snapshot().audits.length, 2);
});
test('missing document and driver failures do not expose DB details or manufacture saved policy', async () => {
  const pool = createStudioMemoryPool(), repository = createStudioRepository({ pool, scope });
  const api = createStudioDocumentApi({ repository, config, authorize: async () => ({ user: 'Operator', role: 'admin', scope }) });
  assert.equal((await api.handle(request())).status, 503); assert.equal(pool.snapshot().documents.size, 0);
  pool.failNext('read-document', new Error('postgres://private:password@private.invalid'));
  const response = await api.handle(request()); assert.equal(response.status, 503);
  const body = await response.json();
  assert.deepEqual(body, { error: 'studio_native_unavailable', code: 'studio_storage_unavailable' });
  assert.equal(JSON.stringify(body).includes('private'), false);
});
test('native project writes dispatch through the shared game-policy store validation before a repository commit',async () => {
  let dispatched = 0;
  const gamePolicy = {projectStore:({actor}) => {
    assert.equal(actor,'Operator');
    return {save:async () => {dispatched++; throw Object.assign(new Error('shared tier validation failed'),{statusCode:409});}};
  }};
  const {api,initial,pool} = await fixture({gamePolicy});
  const response = await api.handle(request(undefined,{method:'PUT',body:{project:initial.value,expectedRevision:initial.revision}}));
  assert.equal(response.status,409); assert.equal(dispatched,1); assert.equal(pool.snapshot().history.length,0);
});

test('documents require the product transaction and recheck role/scope after its lock before saving',async () => {
  const missing = await fixture({mutationTransaction:undefined});
  assert.equal((await missing.api.handle(request())).status,200);
  assert.equal((await missing.api.handle(request(undefined,{method:'PUT',body:{project:missing.initial.value,expectedRevision:missing.initial.revision}}))).status,503);
  assert.equal(missing.pool.snapshot().history.length,0);
  for (const revoke of [session => {session.role = 'superadmin';},session => {session.scope = {...scope,workspaceId:'other'};},session => {session.user = 'Other';}]) {
    const session = {user:'Operator',role:'admin',scope};let locked = false;
    const {api,initial,pool} = await fixture({authorize:async () => session,
      validateProjectBindings:async () => {assert.equal(locked,false);},
      mutationTransaction:async work => {revoke(session);locked = true;try{return await work();}finally{locked = false;}},
    });
    assert.equal((await api.handle(request(undefined,{method:'PUT',body:{project:initial.value,expectedRevision:initial.revision}}))).status,403);
    assert.equal(pool.snapshot().history.length,0);assert.equal(pool.snapshot().audits.length,2);
  }
});

test('a paused request body cannot preserve authority revoked before the transaction is acquired',async () => {
  let ready;const initiallyAuthorized = new Promise(resolve => {ready = resolve;});let active = true,calls = 0;
  const {api,initial,pool} = await fixture({authorize:async () => {calls++;ready();return active ? {user:'Operator',role:'admin',scope} : null;}});
  let stream;
  const input = new Request(`${origin}/studio/api/project`,{method:'PUT',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json'},
    body:new ReadableStream({start(controller){stream = controller;}}),duplex:'half'});
  const result = api.handle(input);await initiallyAuthorized;
  active = false;stream.enqueue(new TextEncoder().encode(JSON.stringify({project:initial.value,expectedRevision:initial.revision})));stream.close();
  assert.equal((await result).status,403);assert.equal(calls,2);assert.equal(pool.snapshot().history.length,0);
});

test('Next stripped document routes use the logical public request for GET, PUT, credentials and CAS',async()=>{
  const publicOrigin=config.allowedOrigins[0],headers={host:'studio.example.invalid','x-forwarded-host':'public.example.invalid',
    'x-forwarded-proto':'https',origin:publicOrigin,'sec-fetch-site':'same-origin',cookie:'bo_jwt=fixture'};
  const {api,initial,policy,pool,repository}=await fixture({authorize:async actual=>{
    assert.equal(new URL(actual.url).origin,publicOrigin);assert.equal(actual.headers.get('origin'),publicOrigin);
    assert.equal(actual.headers.get('cookie'),'bo_jwt=fixture');return {user:'Operator',role:'admin',scope};
  }});
  for(const [path,field,saved] of [['/api/project','project',initial],['/api/social','policy',policy]]){
    const get=await api.handle(new NextRequest(origin+path,{headers}));assert.equal(get.status,200);
    assert.deepEqual((await get.json())[field],saved.value);
    const draft=structuredClone(saved.value);if(field==='project')draft.events[0].label='Forwarded saved';else draft.cooldownMs=2500;
    const put=await api.handle(new NextRequest(origin+path,{method:'PUT',headers:{...headers,'content-type':'application/json'},
      body:JSON.stringify({[field]:draft,expectedRevision:saved.revision})}));
    assert.equal(put.status,200);const value=(await put.json())[field];assert.notEqual(value.revision,saved.revision);
    assert.deepEqual((await repository.readDocument(field==='project'?'project':'social-policy')).value,value);
  }
  assert.equal(pool.snapshot().history.length,2);
  for(const path of ['/api/unknown','/api/project/unknown','/api/social/unknown']){
    assert.equal((await api.handle(new NextRequest(origin+path,{headers}))).status,404);
  }
  const current=await repository.readDocument('project'),body={project:current.value,expectedRevision:current.revision};
  for(const change of [{origin}, {origin:'https://evil.invalid'},{'x-forwarded-host':'public.example.invalid,evil.invalid'},
    {'x-forwarded-proto':'http'},{'sec-fetch-site':'same-site'}]){
    const result=await api.handle(new NextRequest(origin+'/api/project',{method:'PUT',headers:{...headers,...change,'content-type':'application/json'},body:JSON.stringify(body)}));
    assert.equal(result.status,403);
  }
  assert.equal((await api.handle(new NextRequest(origin+'/api/project',{method:'PUT',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({...body,actor:'forged'})}))).status,400);
  assert.equal(pool.snapshot().history.length,2);
});

test('Native Nora composition saves preflight before outer product SQL; old saves never fetch and old Render preserves data', async () => {
  const pool=createStudioMemoryPool(),raw=createStudioRepository({pool,scope});
  const initial=await raw.initializeDocument('project',{value:createSeedProject(),actor:'migration'});
  let productLocked=false,activeSql=0,fetches=0,ready=false;
  const originalConnect=pool.connect.bind(pool);
  pool.connect=async()=>{
    const client=await originalConnect(),originalQuery=client.query.bind(client);
    let begun=false;
    client.query=async(sql,...args)=>{
      if(/^BEGIN\b/.test(sql)){begun=true;activeSql++;}
      try{return await originalQuery(sql,...args);}
      finally{if(/^(COMMIT|ROLLBACK)\b/.test(sql)&&begun){activeSql--;begun=false;}}
    };
    return client;
  };
  const repository=wrapNativePresentationRepository(raw,{env:{CROUPIER_BACKEND_ORIGIN:'https://render.example.invalid'},fetchImpl:async()=>{
    assert.equal(productLocked,false);assert.equal(activeSql,0,'HTTP must precede all SQL BEGINs');fetches++;
    return ready ? Response.json({schemaVersion:1,registeredDealerIds:['nora'],compositing:'per-clip'}) : new Response(null,{status:503});
  }});
  const api=createStudioDocumentApi({repository,config,
    authorize:async()=>({user:'Operator',role:'admin',scope}),
    validateProjectBindings:async()=>{},
    mutationTransaction:(work,options)=>repository.withMutationContext(async()=>{
      productLocked=true;try{return await work();}finally{productLocked=false;}
    },options.presentationMutation),
  });
  const oldDraft=structuredClone(initial.value);oldDraft.events[0].label='Old baseline field';
  const old=await api.handle(request(undefined,{method:'PUT',body:{project:oldDraft,expectedRevision:initial.revision}}));
  assert.equal(old.status,200);assert.equal(fetches,0);
  const saved=await raw.readDocument('project'),draft=addDealer(saved.value,'nora','Nora');
  if(!draft.lanes?.length)draft.lanes=[defaultPresentationLane('astrid')];
  draft.lanes[0].composition=defaultCompositionSettings();
  const before=pool.snapshot(),connects=pool.connects;
  const denied=await api.handle(request(undefined,{method:'PUT',body:{project:draft,expectedRevision:saved.revision}}));
  assert.equal(denied.status,503);
  assert.deepEqual(await denied.json(),{error:PRESENTATION_RUNTIME_UPDATE_MESSAGE,code:PRESENTATION_RUNTIME_UPDATE_REQUIRED});
  assert.equal(pool.connects,connects,'missing runtime capability must not begin a write transaction');
  assert.equal(pool.snapshot().history.length,before.history.length);assert.equal(pool.snapshot().audits.length,before.audits.length);
  assert.deepEqual((await raw.readDocument('project')).value,saved.value);assert.equal(fetches,1);
  ready=true;
  const accepted=await api.handle(request(undefined,{method:'PUT',body:{project:draft,expectedRevision:saved.revision}}));
  assert.equal(accepted.status,200);assert.equal(fetches,2);
  const value=(await accepted.json()).project;
  assert.equal(value.dealers.some(row=>row.id==='nora'),true);
  assert.deepEqual(value.lanes[0].composition,draft.lanes[0].composition);
  assert.deepEqual((await raw.readDocument('project')).value,value);
  assert.equal(pool.snapshot().history.length,before.history.length+1);
  assert.equal(pool.snapshot().audits.at(-1).actor,'Operator');assert.equal(activeSql,0);
});

// Review of #647: the moving bank is the server's check, not only Admin's.
test('a project save refuses a new motion reference for a dealer without a moving bank, but keeps an unchanged active profile', async () => {
  const reference = { kind: 'motion-video', videoId: 'astrid-idle', sha256: 'a'.repeat(64), offsetMs: 0 };
  const voice = { provider: 'elevenlabs', voiceId: 'voice-a', modelId: 'eleven_v3' };
  const profile = (extra = {}) => ({ schemaVersion: 2, state: 'enabled', voice, reference, ...extra });
  const withProfile = (project, speechProfile) => ({ ...structuredClone(project), dealers: project.dealers.map(row => row.id === 'astrid' ? { ...row, speechProfile } : row) });
  let banks = [];
  const { api, initial } = await fixture({ movingSpeechDealers: () => banks });
  const put = async (project, expectedRevision) => {
    const response = await api.handle(request(undefined, { method: 'PUT', body: { project, expectedRevision } }));
    return { status: response.status, body: await response.json() };
  };
  let result = await put(withProfile(initial.value, profile()), initial.revision);
  assert.equal(result.status, 422); assert.equal(result.body.code, 'studio_speech_bank_missing');
  result = await put(withProfile(initial.value, profile({ reference: { ...reference, kind: 'video-frame' } })), initial.revision);
  assert.equal(result.status, 200, 'a still-frame reference needs no bank');
  result = await put(withProfile(result.body.project, profile({ state: 'preparation' })), result.body.project.revision);
  assert.equal(result.status, 200, 'a motion reference may be prepared without a bank');
  banks = ['astrid'];
  result = await put(withProfile(result.body.project, profile()), result.body.project.revision);
  assert.equal(result.status, 200, 'the dealer with a bank may request AI speech');
  // Dragan in production: an active profile saved before the check stays, and its voice may change.
  banks = ['paow'];
  let saved = result.body.project;
  result = await put(saved, saved.revision); assert.equal(result.status, 200, 'unchanged active profile');
  saved = result.body.project;
  result = await put(withProfile(saved, profile({ voice: { ...voice, voiceId: 'voice-b' } })), saved.revision);
  assert.equal(result.status, 200, 'voice-only change of an active profile');
  saved = result.body.project;
  result = await put(withProfile(saved, profile({ voice: { ...voice, voiceId: 'voice-b' }, reference: { ...reference, offsetMs: 125 } })), saved.revision);
  assert.equal(result.status, 422, 'a changed motion reference needs the bank'); assert.equal(result.body.code, 'studio_speech_bank_missing');
});
