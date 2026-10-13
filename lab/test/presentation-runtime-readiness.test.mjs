import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapNativePresentationRepository, PRESENTATION_RUNTIME_UPDATE_REQUIRED as CODE } from '../lib/presentation-runtime-readiness.mjs';
import { nativeStudioErrorResponse } from '../lib/studio-native-runtime.mjs';
import { StudioStorageError } from '../../web/storage/studio-contract.mjs';
import {presentationCapabilitiesForVersion} from '../../web/presentation-capability-contract.mjs';

const env = { CROUPIER_BACKEND_ORIGIN: 'https://render.example.invalid' };
const capability = { schemaVersion: 1, registeredDealerIds: ['nora'], compositing: 'per-clip' };
const dealers = ['vera', 'astrid', 'amira', 'mei'];
const project = () => ({ dealers: [...dealers, 'nora'].map(id => ({ id })), lanes: [] });
const blocked = error => error instanceof StudioStorageError && error.code === CODE && error.statusCode === 503 && error.message === CODE;
function fixture({ config = env, fetcher = async () => Response.json(capability) } = {}) {
  const writes = [], fetches = [];
  const repository = {
    marker: 'original',
    async saveDocument(...args) { assert.equal(this, repository); writes.push(['saveDocument', ...args]); return 'document-result'; },
    async registerMedia(...args) { assert.equal(this, repository); writes.push(['registerMedia', ...args]); return 'register-result'; },
    async classifyMedia(...args) { assert.equal(this, repository); writes.push(['classifyMedia', ...args]); return 'classify-result'; },
    transaction(work, options) { assert.equal(this, repository); assert.equal(options?.fixture, true); return work(repository); },
    readDocument: async () => 'read-result',
  };
  const wrapped = wrapNativePresentationRepository(repository, { env: config, fetchImpl: async (...args) => {
    fetches.push(args); return fetcher(...args);
  } });
  return { repository, wrapped, writes, fetches };
}
const writesForNewFeatures = [
  repo => repo.saveDocument('project', { value: project(), actor: 'trusted' }),
  repo => repo.saveDocument('project', { value: { dealers: dealers.map(id => ({ id })), lanes: [{ composition: {} }] } }),
  repo => repo.saveDocument('administration', { value: { gameLanes: [{ dealer: 'nora' }] } }),
  repo => repo.registerMedia({ classification: { dealerId: 'nora' } }, { actor: 'trusted' }),
  repo => repo.registerMedia({ classification: { dealerId: 'astrid', compositing: { mode: 'opaque' } } }),
  repo => repo.classifyMedia('id', { metadata: { dealerId: 'nora' } }),
  repo => repo.classifyMedia('id', { metadata: { dealerId: 'astrid', compositing: { mode: 'green-screen' } } }),
];

const extendedMedia=[
  {dealerId:'astrid',compositing:{mode:'alpha'}},
  {dealerId:'astrid',mediaType:'image'},
  {dealerId:'astrid',eventId:'roulette.wheel-start',game:'roulette',action:'wheel-start',startPose:'VILA',endPose:'WHEEL',compositing:{mode:'green-screen'}},
  ...['game','action','startPose','endPose'].map(key=>({dealerId:'astrid',[key]:'unverified'})),
];
test('alpha, PNG and every new roulette record field require exact v12 before register/classify',async()=>{
  for(const metadata of extendedMedia)for(const version of [2,11,12])for(const operation of ['register','classify']){
    const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});
    const write=()=>operation==='register'?f.wrapped.registerMedia({classification:metadata}):f.wrapped.classifyMedia('id',{metadata});
    if(version===12){await write();assert.equal(f.writes.length,1);}else{await assert.rejects(write(),blocked);assert.equal(f.writes.length,0);}
    assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'12');
  }
});
test('legacy verified transaction cannot inherit alpha or roulette permissions after SQL begins',async()=>{
  for(const metadata of extendedMedia){
    const f=fixture({fetcher:async(_url,init)=>Response.json(presentationCapabilitiesForVersion(Number(init.headers['X-Presentation-Capability-Version']??2)))});
    await f.wrapped.withMutationContext(async()=>{
      await assert.rejects(f.wrapped.registerMedia({classification:metadata}),blocked);
      await assert.rejects(f.wrapped.classifyMedia('id',{metadata}),blocked);
    },{metadata:{dealerId:'astrid',compositing:{mode:'green-screen'}}});
    assert.equal(f.fetches.length,1);assert.equal(f.writes.length,0);
  }
  const metadata={dealerId:'astrid',compositing:{mode:'alpha'}};
  const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(12))});
  await f.wrapped.withMutationContext(()=>f.wrapped.registerMedia({classification:metadata}),{metadata});
  assert.equal(f.fetches.length,1);assert.equal(f.writes.length,1);
});
test('frozen alpha and roulette media require v12 even when the package format itself is older',async()=>{
  for(const metadata of extendedMedia.slice(0,3))for(const location of ['idle','playback'])for(const version of [11,12]){
    const value={schemaVersion:3,registeredDealers:[{id:'astrid',...(location==='idle'?{idle:{classification:metadata}}:{})}],playback:{media:location==='playback'?[{classification:metadata}]:[]}};
    const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});
    if(version===12)await f.wrapped.saveDocument('presentation-package',{value});else await assert.rejects(f.wrapped.saveDocument('presentation-package',{value}),blocked);
    assert.equal(f.writes.length,version===12?1:0);assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'12');
  }
});

test('authoring sets, including an empty explicit field, require exact v10 before any SQL mutation', async () => {
  for (const dealerSets of [[], [{ id: 'paow3', name: 'PAOW3', dealerId: 'paow-v2', clipIds: [], archived: true }]]) {
    for (const version of [9, 10]) {
      const input = fixture({ fetcher: async () => Response.json(presentationCapabilitiesForVersion(version)) });
      const descriptor = { kind: 'project', value: { dealers: [], lanes: [], dealerSets } };
      let begun = 0;
      input.repository.transaction = async work => { begun++; return work(input.repository); };
      const write = () => input.wrapped.transaction(repo => repo.saveDocument('project', { value: descriptor.value }), { presentationMutation: descriptor });
      if (version === 9) { await assert.rejects(write(), blocked); assert.equal(begun, 0); assert.equal(input.writes.length, 0); }
      else { await write(); assert.equal(begun, 1); assert.equal(input.writes.length, 1); }
      assert.equal(input.fetches.length, 1);
      assert.equal(input.fetches[0][1].headers['X-Presentation-Capability-Version'], '10');
    }
  }
});
test('a preflight without set support cannot introduce membership after SQL begins', async () => {
  const input = fixture({ fetcher: async () => Response.json(presentationCapabilitiesForVersion(9)) });
  await input.wrapped.withMutationContext(async () => {
    await assert.rejects(input.wrapped.saveDocument('project', { value: { dealers: [], dealerSets: [] } }), blocked);
  }, { kind: 'administration', value: { rooms: [{ schemaVersion: 2, game: 'roulette' }] } });
  assert.equal(input.fetches.length, 1); assert.equal(input.writes.length, 0);
});
test('persistent material trash requires exact runtime v11 before a mutation or later project save',async()=>{
 for(const descriptor of [{kind:'material-trash',value:{}},{kind:'project',value:{layerAssetTrash:[]}}]){
  for(const accepted of [false,true]){
   const f=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(accepted?11:9))});
   const work=()=>f.wrapped.withMutationContext(()=>f.wrapped.saveDocument('project',{value:{layerAssetTrash:[]}}),descriptor);
   if(accepted){await work();assert.equal(f.writes.length,1);}else{await assert.rejects(work,blocked);assert.equal(f.writes.length,0);}
   assert.equal(f.fetches[0][1].headers['X-Presentation-Capability-Version'],'11');
  }
 }
});

test('combined material trash and authoring sets negotiate v11 before SQL and reject a v9-only payload',async()=>{
  for(const accepted of [false,true]){
    const input=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(accepted?11:9))});
    const value={dealers:[],lanes:[],dealerSets:[],layerAssetTrash:[]};
    let begun=0;input.repository.transaction=async work=>{begun++;return work(input.repository);};
    const write=()=>input.wrapped.transaction(repo=>repo.saveDocument('project',{value}),{presentationMutation:{kind:'project',value}});
    if(accepted){await write();assert.equal(begun,1);assert.equal(input.writes.length,1);}
    else{await assert.rejects(write,blocked);assert.equal(begun,0);assert.equal(input.writes.length,0);}
    assert.equal(input.fetches.length,1);
    assert.equal(input.fetches[0][1].headers['X-Presentation-Capability-Version'],'11');
  }
});

test('background policy in project, archived composition and frozen package requires exact v8 before writes',async()=>{
  const lane={backgroundPlayback:{schemaVersion:1,rules:[]}};
  const descriptors=[{kind:'project',value:{lanes:[lane]}},
    {kind:'project',value:{dealerTrash:[{schemaVersion:2,compositions:[lane]}]}},
    {kind:'presentation-package',value:{schemaVersion:3,registeredDealers:[],lanes:[lane]}}];
  for(const descriptor of descriptors) {
    for(const version of [7,8]) {
      const input=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(version))});
      let begun=0;input.repository.transaction=async work=>{begun++;return work(input.repository);};
      const write=()=>input.wrapped.transaction(repo=>repo.saveDocument(descriptor.kind,{value:descriptor.value}),{presentationMutation:descriptor});
      if(version===7){await assert.rejects(write(),blocked);assert.equal(begun,0);assert.equal(input.writes.length,0);}
      else {await write();assert.equal(begun,1);assert.equal(input.writes.length,1);}
      assert.equal(input.fetches.length,1);assert.equal(input.fetches[0][1].headers['X-Presentation-Capability-Version'],'8');
    }
  }
});

test('a v7 mutation cannot add background automation after the SQL boundary',async()=>{
  const input=fixture({fetcher:async()=>Response.json(presentationCapabilitiesForVersion(7))});
  await input.wrapped.withMutationContext(async()=>{
    await assert.rejects(input.wrapped.saveDocument('project',{value:{lanes:[{backgroundPlayback:{schemaVersion:1,rules:[]}}]}}),blocked);
  },{kind:'dealer-archive',value:{}});
  assert.equal(input.fetches.length,1);assert.equal(input.writes.length,0);
});

test('old document and media writes stay local with unchanged arguments, results and original this', async () => {
  const input = fixture({ config: {}, fetcher: () => { throw Error('must not fetch'); } });
  assert.equal(Object.isFrozen(input.wrapped), true);
  assert.equal(input.wrapped.readDocument, input.repository.readDocument);
  const options = { value: { dealers: dealers.map(id => ({ id })), lanes: [] }, actor: 'trusted' };
  assert.equal(await input.wrapped.saveDocument('project', options), 'document-result');
  assert.equal(input.writes[0][2], options);
  assert.equal(await input.wrapped.saveDocument('administration', { value: { gameLanes: [{ dealer: 'astrid' }, { dealer: 'paow' }] } }), 'document-result');
  assert.equal(await input.wrapped.saveDocument('social-policy', { value: {} }), 'document-result');
  const record = { classification: { dealerId: 'astrid' } };
  assert.equal(await input.wrapped.registerMedia(record), 'register-result');
  assert.equal(input.writes[3][1], record);
  assert.equal(await input.wrapped.classifyMedia('id', { metadata: { dealerId: 'mei' } }), 'classify-result');
  assert.equal(input.fetches.length, 0);
  assert.equal(input.writes.length, 5);
});

test('every new document and metadata feature rejects old or absent capabilities before any writer', async () => {
  for (const fetcher of [async () => new Response(null, { status: 404 }), async () => Response.json({ schemaVersion: 0 })]) {
    const input = fixture({ fetcher });
    for (const write of writesForNewFeatures) await assert.rejects(write(input.wrapped), blocked);
    assert.equal(input.writes.length, 0);
    assert.equal(input.fetches.length, writesForNewFeatures.length);
  }
});

test('exact trusted capability permits each new writer without caching readiness between writes', async () => {
  const input = fixture();
  for (const write of writesForNewFeatures) await write(input.wrapped);
  assert.equal(input.writes.length, writesForNewFeatures.length);
  assert.equal(input.fetches.length, writesForNewFeatures.length);
  for (const [url, options] of input.fetches) {
    assert.equal(url, env.CROUPIER_BACKEND_ORIGIN + '/api/presentation/capabilities');
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
    assert.equal(options.credentials, 'omit'); assert.equal(options.cache, 'no-store');
    assert.deepEqual(options.headers, { Accept: 'application/json' });
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.signal.aborted, false);
  }
});

test('trusted server origin must be exact HTTPS origin and invalid preferred origin never falls back', async () => {
  for (const origin of [undefined, 'http://render.example.invalid', 'https://render.example.invalid/',
    'https://render.example.invalid/path', 'https://render.example.invalid?ready=1',
    'https://render.example.invalid#ready', 'https://user:pass@render.example.invalid']) {
    const config = origin === undefined ? {} : { CROUPIER_BACKEND_ORIGIN: origin, RENDER_EXTERNAL_URL: env.CROUPIER_BACKEND_ORIGIN };
    const input = fixture({ config });
    await assert.rejects(writesForNewFeatures[0](input.wrapped), blocked);
    assert.equal(input.fetches.length, 0); assert.equal(input.writes.length, 0);
  }
  const fallback = fixture({ config: { RENDER_EXTERNAL_URL: env.CROUPIER_BACKEND_ORIGIN } });
  await writesForNewFeatures[0](fallback.wrapped); assert.equal(fallback.writes.length, 1);
});

test('client readiness, capability and backend fields never substitute for trusted configuration', async () => {
  const input = fixture({ config: {} });
  const value = { ...project(), capabilities: capability, runtimeReady: true, CROUPIER_BACKEND_ORIGIN: env.CROUPIER_BACKEND_ORIGIN };
  await assert.rejects(input.wrapped.saveDocument('project', { value, runtimeReady: true, capability,
    env, backendOrigin: env.CROUPIER_BACKEND_ORIGIN }), blocked);
  assert.equal(input.writes.length, 0); assert.equal(input.fetches.length, 0);
});

test('capability must match all exact fields and supported dealer IDs', async () => {
  for (const body of [null, [], { ...capability, schemaVersion: 2 }, { ...capability, compositing: 'global' },
    { ...capability, registeredDealerIds: [] }, { ...capability, registeredDealerIds: ['nora', 'nora'] },
    { ...capability, registeredDealerIds: ['nora', 'eva'] }, { ...capability, ready: true }]) {
    const input = fixture({ fetcher: async () => Response.json(body) });
    await assert.rejects(writesForNewFeatures[0](input.wrapped), blocked);
    assert.equal(input.writes.length, 0);
  }
  const unsupported = fixture();
  await assert.rejects(unsupported.wrapped.saveDocument('project', { value: { dealers: [...dealers, 'eva'].map(id => ({ id })) } }), blocked);
  await assert.rejects(unsupported.wrapped.registerMedia({ classification: { dealerId: 'eva' } }), blocked);
  assert.equal(unsupported.writes.length, 0);
});

test('transport, redirects, invalid JSON, wrong MIME and bounded payload failures reveal only fixed code', async () => {
  for (const fetcher of [
    async () => { throw Error('PRIVATE transport details'); },
    async () => { throw new DOMException('PRIVATE timeout details', 'TimeoutError'); },
    async () => Response.redirect('https://other.example.invalid', 302),
    async () => new Response('{broken', { headers: { 'content-type': 'application/json' } }),
    async () => new Response(JSON.stringify(capability), { headers: { 'content-type': 'text/html' } }),
    async () => new Response(' '.repeat(1025), { headers: { 'content-type': 'application/json' } }),
    async () => new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': '999999' } }),
    async () => { const response = Response.json(capability); Object.defineProperty(response, 'url', { value: 'https://other.example.invalid/api/presentation/capabilities' }); return response; },
  ]) {
    const input = fixture({ fetcher });
    await assert.rejects(writesForNewFeatures[0](input.wrapped), blocked);
    assert.equal(input.writes.length, 0);
  }
});

test('failed capability responses cancel unread bodies before rejecting the mutation', async () => {
  let cancelled = false;
  const input = fixture({ fetcher: async () => new Response(new ReadableStream({
    cancel() { cancelled = true; },
  }), { status: 404 }) });
  await assert.rejects(writesForNewFeatures[0](input.wrapped), blocked);
  assert.equal(cancelled, true); assert.equal(input.writes.length, 0);
});

test('transaction callbacks receive the gated API so policy writes cannot bypass readiness', async () => {
  const input = fixture({ fetcher: async () => new Response(null, { status: 404 }) });
  await assert.rejects(input.wrapped.transaction(async repo => {
    assert.equal(repo, input.wrapped);
    return repo.saveDocument('project', { value: project() });
  }, { fixture: true }), blocked);
  assert.equal(input.writes.length, 0); assert.equal(input.fetches.length, 0);
});

test('new input is snapshotted before the remote await so edits cannot change the persisted proposal', async () => {
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const input = fixture({ fetcher: async () => { await waiting; return Response.json(capability); } });
  const options = { value: project(), actor: 'trusted' }, original = structuredClone(options);
  const result = input.wrapped.saveDocument('project', options);
  options.value.dealers.push({ id: 'eva' }); release();
  await result;
  assert.deepEqual(input.writes[0][2], original);
  assert.notEqual(input.writes[0][2], options);
});

test('readiness cannot be reused after Render rolls back', async () => {
  let current = capability;
  const input = fixture({ fetcher: async () => Response.json(current) });
  await writesForNewFeatures[0](input.wrapped);
  current = { schemaVersion: 0 };
  await assert.rejects(writesForNewFeatures[1](input.wrapped), blocked);
  assert.equal(input.writes.length, 1); assert.equal(input.fetches.length, 2);
});

test('fixed Native response exposes actionable code without exception or provider details', async () => {
  const error = new StudioStorageError(CODE, 503);
  error.message = 'PRIVATE backend details';
  const response = nativeStudioErrorResponse(error);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const body = await response.json();
  assert.equal(body.code, CODE);
  assert.equal(body.error, 'Spelservern beh\u00f6ver uppdateras innan presentationen kan sparas. Ditt utkast \u00e4r kvar.');
  assert.equal(JSON.stringify(body).includes('PRIVATE'), false);
});

test('server-owned preflight completes before outer and nested SQL; undeclared features never fetch inside SQL', async () => {
  let inside = false, transactions = 0;
  const input = fixture({ fetcher: async () => {
    assert.equal(inside, false, 'capability HTTP must precede BEGIN');
    return Response.json(capability);
  } });
  input.repository.transaction = async function(work) {
    assert.equal(this, input.repository); transactions++;
    const previous = inside; inside = true;
    try { return await work(input.repository); } finally { inside = previous; }
  };
  const descriptor = { kind: 'project', value: project() };
  await input.wrapped.withMutationContext(async () => {
    inside = true;
    try {
      return await input.wrapped.transaction(repo => repo.saveDocument('project', { value: project() }),
        { presentationMutation: descriptor });
    } finally { inside = false; }
  }, descriptor);
  assert.equal(input.fetches.length, 1); assert.equal(input.writes.length, 1); assert.equal(transactions, 1);
  await assert.rejects(input.wrapped.transaction(repo => repo.registerMedia({
    classification: {dealerId:'nora',compositing:{mode:'opaque'}},
  }), {fixture:true}), blocked);
  assert.equal(input.fetches.length, 1, 'undeclared mutation cannot perform HTTP after BEGIN');
  assert.equal(input.writes.length, 1);
});

test('direct repository preflight snapshots features before BEGIN and rejection never starts SQL', async () => {
  let started = 0;
  const input = fixture({ fetcher: async () => new Response(null, {status:503}) });
  input.repository.transaction = async work => { started++; return work(input.repository); };
  await assert.rejects(input.wrapped.transaction(repo => repo.saveDocument('project',{value:project()}),
    { presentationMutation:{kind:'project',value:project()} }), blocked);
  assert.equal(started,0); assert.equal(input.writes.length,0); assert.equal(input.fetches.length,1);
});

test('verified feature permissions do not leak to another concurrent mutation', async () => {
  const input = fixture();
  let release, entered;
  const waiting = new Promise(resolve => { release = resolve; });
  const active = new Promise(resolve => { entered = resolve; });
  const first = input.wrapped.withMutationContext(async repo => {
    entered(); await waiting; return repo.saveDocument('project',{value:project()});
  }, {kind:'project',value:project()});
  await active;
  await assert.rejects(input.wrapped.transaction(repo => repo.saveDocument('project',{value:project()}),{fixture:true}),blocked);
  assert.equal(input.fetches.length,1); release(); await first;
  assert.equal(input.writes.length,1);
});

const roomV2 = { schemaVersion: 2, id: 'room-one', name: 'Room', operatorId: 'north', presentationLaneId: 'mobile-phone', gameLaneId: 'mobile-phone', state: 'live' };
const capabilityV2 = { ...capability, schemaVersion: 2, rooms: 'operator-owned-v2' };
test('v2 capability stays compatible with old presentation writes while old Render blocks new rooms before SQL', async () => {
  const input = fixture({ fetcher: async () => Response.json(capabilityV2) });
  for (const write of writesForNewFeatures) await write(input.wrapped);
  await input.wrapped.saveDocument('administration', { value: { rooms: [roomV2] } });
  assert.equal(input.writes.length, writesForNewFeatures.length + 1);
  for (const response of [capability, { ...capabilityV2, rooms: 'unknown' }, { ...capabilityV2, trusted: true }]) {
    const old = fixture({ fetcher: async () => Response.json(response) });
    await assert.rejects(old.wrapped.transaction(repo => repo.saveDocument('administration', { value: { rooms: [roomV2] } }),
      { fixture: true, presentationMutation: { kind: 'administration', value: { rooms: [roomV2] } } }), blocked);
    assert.equal(old.writes.length, 0);
  }
});
test('a room capability cannot be reused after rollback or smuggled into a weaker transaction descriptor', async () => {
  let capable = true;
  const input = fixture({ fetcher: async () => Response.json(capable ? capabilityV2 : capability) });
  const save = () => input.wrapped.saveDocument('administration', { value: { rooms: [roomV2] } });
  await save(); capable = false; await assert.rejects(save(), blocked); assert.equal(input.writes.length, 1);
  capable = true;
  await assert.rejects(input.wrapped.withMutationContext(save, { kind: 'project', value: project() }), blocked);
  assert.equal(input.writes.length, 1);
});

test('generic saved-registry dealer writes negotiate v3; the legacy Nora list grants no registry authority', async () => {
  const cap3 = { schemaVersion: 3, registeredDealerIds: ['nora'], compositing: 'per-clip', rooms: 'operator-owned-v2',
    registeredDealerMode: 'saved-registry-idle-v1', frozenDealerIdle: 'operator-package-v2' };
  const input = fixture({ fetcher: async () => Response.json(cap3) });
  const genericProject = { dealers: [...dealers, 'johanna'].map(id => ({ id })), lanes: [] };
  await input.wrapped.saveDocument('project', { value: genericProject });
  await input.wrapped.saveDocument('administration', { value: { gameLanes: [{ dealer: 'johanna', renderer: 'portrait-video' }] } });
  await input.wrapped.registerMedia({ classification: { dealerId: 'johanna' } });
  assert.equal(input.writes.length, 3);
  for (const [, options] of input.fetches) assert.equal(options.headers['X-Presentation-Capability-Version'], '3');
  for (const cap of [capability, { schemaVersion: 2, registeredDealerIds: ['nora'], compositing: 'per-clip', rooms: 'operator-owned-v2' }]) {
    const old = fixture({ fetcher: async () => Response.json(cap) });
    await assert.rejects(old.wrapped.saveDocument('project', { value: genericProject }), blocked); assert.equal(old.writes.length, 0);
  }
});

test('schema2 package format requires v3 even when no extra dealer is included; no SQL begins on downgrade', async () => {
  const descriptor = { kind: 'presentation-package', value: { schemaVersion: 2, registeredDealers: [] } };
  let begun = 0;
  const old = fixture(); old.repository.transaction = async work => { begun++; return work(old.repository); };
  await assert.rejects(old.wrapped.transaction(async () => {}, { presentationMutation: descriptor }), blocked);
  assert.equal(begun, 0); assert.equal(old.fetches[0][1].headers['X-Presentation-Capability-Version'], '3');
  const cap3 = { schemaVersion: 3, registeredDealerIds: ['nora'], compositing: 'per-clip', rooms: 'operator-owned-v2',
    registeredDealerMode: 'saved-registry-idle-v1', frozenDealerIdle: 'operator-package-v2' };
  const modern = fixture({ fetcher: async () => Response.json(cap3) }); modern.repository.transaction = async work => { begun++; return work(modern.repository); };
  await modern.wrapped.transaction(async () => {}, { presentationMutation: descriptor }); assert.equal(begun, 1);
});

test('legacy mutation context cannot introduce generic or frozen-package features from inside SQL', async () => {
  const input = fixture();
  await input.wrapped.withMutationContext(async () => {
    await assert.rejects(input.wrapped.registerMedia({ classification: { dealerId: 'johanna' } }), blocked);
    await assert.rejects(input.wrapped.transaction(async () => {}, { presentationMutation: { kind: 'presentation-package', value: { schemaVersion: 2 } } }), blocked);
  }, { kind: 'project', value: project() });
  assert.equal(input.fetches.length, 1); assert.equal(input.writes.length, 0);
});

const cap4 = { schemaVersion: 4, registeredDealerIds: ['nora'], compositing: 'per-clip', rooms: 'operator-owned-v2',
  registeredDealerMode: 'saved-registry-idle-v1', frozenDealerIdle: 'operator-package-v2', frozenDealerEvents: 'operator-package-v3' };
const cap3 = { ...cap4, schemaVersion: 3 }; delete cap3.frozenDealerEvents;
test('frozen-event schema3 publication negotiates exact v4 before SQL even without a registered dealer', async () => {
  for(const registeredDealers of [[],[{id:'johanna'}]]) {
    const descriptor={kind:'presentation-package',value:{schemaVersion:3,registeredDealers}};
    for(const response of [capability,capabilityV2,cap3,{...cap4,frozenDealerEvents:'latest-draft'}]) {
      let begun=0;
      const input=fixture({fetcher:async()=>Response.json(response)});
      input.repository.transaction=async work=>{begun++;return work(input.repository);};
      await assert.rejects(input.wrapped.transaction(async()=>{}, {presentationMutation:descriptor}),blocked);
      assert.equal(begun,0);assert.equal(input.writes.length,0);
      assert.equal(input.fetches[0][1].headers['X-Presentation-Capability-Version'],'4');
    }
    let begun=0;
    const input=fixture({fetcher:async()=>Response.json(cap4)});
    input.repository.transaction=async work=>{begun++;return work(input.repository);};
    await input.wrapped.transaction(repo=>repo.saveDocument('presentation-package',{value:descriptor.value}), {presentationMutation:descriptor});
    assert.equal(begun,1);assert.equal(input.writes.length,1);assert.equal(input.fetches.length,1);
  }
});
test('v3 readiness cannot authorize schema3 events inside SQL and v4 readiness cannot survive rollback', async () => {
  const descriptor={kind:'presentation-package',value:{schemaVersion:3,registeredDealers:[]}};
  let ready=true,begun=0;
  const input=fixture({fetcher:async(_url,options)=>Response.json(options.headers['X-Presentation-Capability-Version']==='3' ? cap3 : ready ? cap4 : cap3)});
  input.repository.transaction=async work=>{begun++;return work(input.repository);};
  await input.wrapped.withMutationContext(async()=>{
    await assert.rejects(input.wrapped.saveDocument('presentation-package',{value:descriptor.value}),blocked);
  }, {kind:'presentation-package',value:{schemaVersion:2,registeredDealers:[]}});
  assert.equal(input.fetches.length,1);assert.equal(input.writes.length,0);
  await input.wrapped.transaction(async()=>{}, {presentationMutation:descriptor});
  assert.equal(begun,1);ready=false;
  await assert.rejects(input.wrapped.transaction(async()=>{}, {presentationMutation:descriptor}),blocked);
  assert.equal(begun,1);assert.equal(input.fetches.length,3);
});

test('resource archive writes require exact v6 before SQL and reuse verification for the complete room mutation',async()=>{
 const descriptor=[{kind:'resource-lifecycle',value:{}},{kind:'project',value:{dealers:[...dealers,'johanna'].map(id=>({id})),lanes:[]}}];
 const cap5={...cap4,schemaVersion:5,dealerLifecycle:'trash-v1'};
 const cap6={...cap5,schemaVersion:6,resourceLifecycle:'operator-room-archive-v1'};
 for(const response of [cap4,cap5,{...cap6,resourceLifecycle:'unsafe-delete'}]){
  let begun=0;const input=fixture({fetcher:async()=>Response.json(response)});
  input.repository.transaction=async work=>{begun++;return work(input.repository);};
  await assert.rejects(input.wrapped.transaction(async()=>{}, {presentationMutation:descriptor}),blocked);
  assert.equal(begun,0);assert.equal(input.fetches[0][1].headers['X-Presentation-Capability-Version'],'6');
 }
 let begun=0;const input=fixture({fetcher:async()=>Response.json(cap6)});
 input.repository.transaction=async work=>{begun++;return work(input.repository);};
 await input.wrapped.transaction(repo=>repo.saveDocument('administration',{value:{rooms:[{schemaVersion:2}],gameLanes:[{dealer:'johanna',renderer:'portrait-video'}]}}),{presentationMutation:descriptor});
 assert.equal(begun,1);assert.equal(input.fetches.length,1);assert.equal(input.writes.length,1);
});

test('an older verified mutation may not acquire resource lifecycle authority after SQL starts',async()=>{
 const cap5={...cap4,schemaVersion:5,dealerLifecycle:'trash-v1'};
 const input=fixture({fetcher:async()=>Response.json(cap5)});
 await input.wrapped.withMutationContext(async()=>{
  await assert.rejects(input.wrapped.withMutationContext(()=>assert.fail('must not run'),{kind:'resource-lifecycle',value:{}}),blocked);
 },{kind:'project',value:{dealers:[],dealerTrash:[]}});
 assert.equal(input.fetches.length,1);assert.equal(input.writes.length,0);
});
test('cascade archives and final v2 restore negotiate exact v7 before SQL, without widening a v6 transaction',async()=>{
 const cap6={...cap4,schemaVersion:6,dealerLifecycle:'trash-v1',resourceLifecycle:'operator-room-archive-v1'},cap7={...cap6,schemaVersion:7,dealerArchiveCascade:'dealer-compositions-rooms-v1'};
 for(const descriptor of [{kind:'project',value:{dealers:[],dealerTrash:[{schemaVersion:2}]}},{kind:'dealer-archive',value:{dealers:[],dealerTrash:[]}}]){
  let begun=0;const rejected=fixture({fetcher:async()=>Response.json(cap6)});rejected.repository.transaction=async()=>begun++;
  await assert.rejects(rejected.wrapped.transaction(async()=>{}, {presentationMutation:descriptor}),blocked);assert.equal(begun,0);assert.equal(rejected.fetches[0][1].headers['X-Presentation-Capability-Version'],'7');
  const accepted=fixture({fetcher:async()=>Response.json(cap7)});accepted.repository.transaction=async work=>{begun++;return work(accepted.repository);};
  await accepted.wrapped.transaction(repo=>repo.saveDocument('project',{value:{dealers:[],dealerTrash:[]}}),{presentationMutation:descriptor});assert.equal(begun,1);assert.equal(accepted.fetches.length,1);
 }
 const input=fixture({fetcher:async()=>Response.json(cap6)});
 await input.wrapped.withMutationContext(async()=>{await assert.rejects(input.wrapped.withMutationContext(()=>assert.fail('no widening'),{kind:'dealer-archive',value:{}}),blocked);},{kind:'resource-lifecycle',value:{}});assert.equal(input.fetches.length,1);
});
