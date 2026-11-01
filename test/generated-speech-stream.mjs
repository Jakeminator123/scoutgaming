import { fileURLToPath as speechRootPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGeneratedSpeechStreamService, generatedSpeechStreamConfiguration } from '../services/game/generated-speech-stream.mjs';
import { createGeneratedSpeechService } from '../packages/presentation/server/generated-speech-service.mjs';
import { createSpeechJournal } from '../services/game/postgres-speech-journal.mjs';
import { speechMemoryPool } from './fixtures/speech-memory-pool.mjs';

const speechRepositoryRoot = speechRootPath(new URL('../', import.meta.url));

const secret = 'isolated-stream-secret-at-least-32-characters';
const digest = value => createHash('sha256').update(value).digest('hex');
const avatar = dealerId => { const bytes = Buffer.from('synthetic ' + dealerId); return {
  schemaVersion:1, dealerId, profileRevision:digest(dealerId), imageSha256:digest(bytes), imageBase64:bytes.toString('base64'),
}; };
async function fixture(t, options = {}) {
  const pool = speechMemoryPool(Date.now), journal = await createSpeechJournal({ pool, environmentId:'isolated-stream-fixture' });
  await journal.initializeBudgetPolicy({ dailyBudgetMicroUsd:1000000, confirmation:'verified-new-empty-cost-journal' });
  await journal.initializeFullfileBudgetPolicy({ reserveMicroUsd:200000,currentBudgetMicroUsd:1000000,confirmation:'verified-new-empty-cost-journal' });
  const managed = options.session || options.overlapAudio;
  let relayOptions, service, fresh = true, sourceCalls = 0, aborted = false, written = 0, available = managed ? 0 : 1;
  let workerId, jobStatus = 'IN_PROGRESS', providerCalls = 0;
  const config = { workerSecret: secret, ticketSecret: secret, origin: 'https://stream.example.test', apiKey: 'fixture', voiceId: 'voice', modelId: 'model',
    ...(managed ? {session:{apiKey:'synthetic-provider',endpointId:'stream-fixture',reserveUsd:'0.20',dailyBudgetUsd:'1'}} : {}),
    ...(options.overlapAudio ? { overlapAudio: true } : {}) };
  const services = [];
  const state = () => ({ workers:Number(available > 0), busy:0, available });
  const relay = { status:state, workerStatus:id => id === workerId ? state() : {workers:0,busy:0,available:0},
    stopWorker(id) { assert.equal(id,workerId); options.onStop?.(id); available=0; jobStatus='COMPLETED'; return true; },
    close() { options.onRelayClose?.(); }, openSource: () => ({ writePCM: async b => { written += b.length; await options.onWrite?.(b); }, end() {}, abort() { aborted = true; } }) };
  const response = value => new Response(JSON.stringify(value), {headers:{'content-type':'application/json'}});
  const fetchImpl = async (url, init) => {
    assert.ok(url.startsWith('https://api.runpod.ai/v2/stream-fixture/'));
    if(url.endsWith('/run')) {
      providerCalls++; const input=JSON.parse(init.body).input; workerId=input.worker_id;
      assert.equal(pool.state.requests.size,1,'request identity is durable before paid work');
      const replacement=await options.onSubmit?.(input,init);
      return replacement ?? response({id:'stream-job',status:'IN_QUEUE'});
    }
    if(url.endsWith('/status/stream-job')) { await options.onStatus?.(init); if(jobStatus==='IN_PROGRESS')available=1; return response({id:'stream-job',status:jobStatus}); }
    if(url.endsWith('/cancel/stream-job')) { available=0;jobStatus='CANCELLED';return response({id:'stream-job',status:jobStatus}); }
    assert.fail('unexpected fixture provider route');
  };
  const construct = () => createGeneratedSpeechStreamService({}, config, { freshnessIntervalMs: 10, journal, fetchImpl,
    resolveOwner: req => req.owner,
    attachRelay: (_, value) => { relayOptions = value; return relay; },
    pcmSource: options.pcmSource ?? (async function*({ beforeCostly }) { await beforeCostly(); sourceCalls++; yield new Uint8Array(48); }),
    dealerRuntime: options.dealerRuntime, replyLibrary:options.replyLibrary, onLibraryStatus:options.onLibraryStatus, replyCaptureBytes:options.replyCaptureBytes,
  }).then(value => { services.push(value); return value; });
  service = await construct();
  const input = (requestId = 'test-request') => ({ requestId, dealerId: 'astrid', text: 'A test reply.', owner:'owner-one', playerId: 'player-one', beforeCostly: async () => { if (!fresh) throw Error('stale'); } });
  const request = (d, who = 'owner-one') => ({ owner: who, headers: { 'sec-websocket-protocol': `astrid-v2, ticket.${d.ticket}` } });
  t.after(async () => {
    if(!options.uncertainSubmission){await Promise.all(services.map(s=>s.close()));return;}
    const outcomes=await Promise.allSettled(services.map(s=>s.close()));
    assert.ok(outcomes.some(outcome=>outcome.status==='rejected'));
    for(const outcome of outcomes)if(outcome.status==='rejected')assert.equal(outcome.reason.code,'generated_speech_stream_shutdown_incomplete');
    assert.equal([...pool.state.sessions.values()][0].state,'submission_uncertain');
  });
  return { config, pool, journal, service, construct, input, request, get relayOptions() { return relayOptions; },
    get workerId(){return workerId;}, get providerCalls(){return providerCalls;},
    get sourceCalls() { return sourceCalls; }, get aborted() { return aborted; }, get written() { return written; }, stale() { fresh = false; } };
}

test('prepare is unpaid, exact expiry is signed, cookie owner required; ready begins source', async t => {
  const f = await fixture(t), timings = [];
  const descriptor = await f.service.prepare({ ...f.input(), onTiming: (stage, ms) => timings.push([stage, ms]) });
  assert.equal(f.sourceCalls, 0); assert.match(descriptor.id, /^[a-f0-9]{32}$/);
  assert.equal(JSON.parse(Buffer.from(descriptor.ticket.split('.')[0], 'base64url')).exp, descriptor.expiresAt);
  const identity = await f.relayOptions.authenticateClient(f.request(descriptor));
  assert.equal(identity.sessionId, descriptor.id);
  await f.relayOptions.onSessionReady({ ...identity, id: 'wire-id', signal: new AbortController().signal });
  assert.equal(f.sourceCalls, 1); assert.equal(f.written, 48);
  f.relayOptions.onFirstMedia(identity);
  f.relayOptions.onTransport(identity, 3);
  assert.deepEqual(timings.map(([stage]) => stage), ['tts_first_audio_ms', 'tts_complete_ms',
    'worker_first_media_ms', 'server_transport_enqueue_ms']);
  assert.ok(timings.every(([, ms]) => Number.isSafeInteger(ms) && ms >= 0));
});

test('registered stream binds own source and exact worker, then invalidates on profile change after preparation',async t=>{
  let fresh=true, paid=0, avatarSeen;
  const selected=avatar('paow');
  const runtime={profileRevision:selected.profileRevision,imageSha256:selected.imageSha256,compositing:null,avatar:selected,
    assertFresh:async()=>{if(!fresh)throw Error('profile changed');},
    source:async function*({beforeCostly}){await beforeCostly();paid++;yield new Uint8Array(48);}};
  const f=await fixture(t,{session:true,dealerRuntime:{prepare:async()=>runtime},onSubmit:input=>{avatarSeen=input.avatar;}});
  const descriptor=await f.service.prepare({...f.input(),dealerId:'paow'});
  assert.equal(descriptor.schemaVersion,2);assert.equal(descriptor.dealerId,'paow');assert.equal(descriptor.profileRevision,runtime.profileRevision);
  assert.equal(descriptor.compositing,null);assert.deepEqual(avatarSeen,runtime.avatar);assert.equal(paid,0);
  const identity=await f.relayOptions.authenticateClient(f.request(descriptor));assert.equal(identity.workerId,f.workerId);
  await f.relayOptions.onSessionReady({...identity,id:'wire',signal:new AbortController().signal});
  assert.equal(paid,1);assert.equal(f.sourceCalls,0);assert.equal(f.written,48);
  fresh=false;await new Promise(resolve=>setTimeout(resolve,40));assert.equal(f.aborted,true);
});
test('mismatched worker attestation cannot join the registered session or start TTS',async t=>{
  let paid=0;
  const selected=avatar('paow');
  const runtime={profileRevision:selected.profileRevision,imageSha256:selected.imageSha256,compositing:null,avatar:selected,assertFresh:async()=>{},source:async function*(){paid++;yield new Uint8Array(48);}};
  const f=await fixture(t,{session:true,dealerRuntime:{prepare:async()=>runtime}});
  await f.service.prepare({...f.input(),dealerId:'paow'});
  assert.equal(f.relayOptions.authenticateWorker({headers:{'x-dealer-id':'astrid','x-speech-protocol':'3'}},f.workerId),false);
  assert.equal(f.relayOptions.authenticateWorker({headers:{}},'foreign'),false);
  assert.equal(paid,0);assert.equal(f.sourceCalls,0);
});
test('a prewarmed base worker cannot claim a profile-bound avatar',async t=>{
  const f=await fixture(t);
  assert.equal(f.relayOptions.authenticateWorker({headers:{}},'legacy'),true);
  assert.equal(f.relayOptions.authenticateWorker({headers:{'x-dealer-id':'paow','x-speech-protocol':'3'}},'foreign'),false);
});

test('foreign websocket cookie and stale state never enter paid source', async t => {
  const f = await fixture(t), descriptor = await f.service.prepare(f.input());
  assert.equal(await f.relayOptions.authenticateClient(f.request(descriptor, 'foreign-owner')), null);
  const second = await f.service.prepare(f.input('second'));
  f.stale(); assert.equal(await f.relayOptions.authenticateClient(f.request(second)), null);
  assert.equal(f.sourceCalls, 0);
});

test('durable request is exclusive after restart and across fullfile capability', async t => {
  const f = await fixture(t); await f.service.prepare(f.input()); await f.service.close();
  const restarted = await f.construct();
  await assert.rejects(restarted.prepare(f.input()), /already_attempted/);
  let fullfileCalls = 0;
  const oldService = createGeneratedSpeechService({reserveMicroUsd:200000,dailyBudgetMicroUsd:1000000}, { repositoryRoot: speechRepositoryRoot, journal:f.journal, artifacts:{save(){assert.fail('no new artifact');},get(){assert.fail('no artifact read');}}, provider: { generate() { fullfileCalls++; throw Error('must not call'); } } });
  await assert.rejects(oldService.generate({ ...f.input(), text: 'A test reply.' }), /conflict|attempted/);
  assert.equal(fullfileCalls, 0); assert.equal(f.pool.state.requests.size, 1);
});

test('an earlier fullfile paid attempt blocks same request in streaming mode', async t => {
  const f = await fixture(t); let fullfileCalls = 0;
  const oldService = createGeneratedSpeechService({reserveMicroUsd:200000,dailyBudgetMicroUsd:1000000}, { repositoryRoot: speechRepositoryRoot, journal:f.journal, artifacts:{save(){assert.fail('failed provider cannot save');},get(){assert.fail('no artifact read');}}, provider: { generate() { fullfileCalls++; throw Error('simulated provider failure'); } } });
  await assert.rejects(oldService.generate(f.input()));
  await assert.rejects(f.service.prepare(f.input()), {code:'generated_speech_request_conflict'});
  assert.equal(fullfileCalls, 1); assert.equal(f.sourceCalls, 0);
});

test('concurrent prepares for same owner preserve only newest reservation', async t => {
  const f = await fixture(t);
  const results = await Promise.allSettled([f.service.prepare(f.input('older')), f.service.prepare(f.input('newer'))]);
  assert.equal(results[0].status, 'rejected'); assert.equal(results[1].status, 'fulfilled'); assert.equal(f.service.status().pending, 1);
});

test('pending prepares count toward bounded capacity before journal awaits', async t => {
  const f = await fixture(t); let release;
  const held = new Promise(resolve => { release = resolve; });
  const pending = Array.from({ length: 32 }, (_, i) => f.service.prepare({ ...f.input(`request-${i}`), owner: `owner-${i}`, beforeCostly: () => held }));
  await assert.rejects(f.service.prepare({ ...f.input('excess'), owner: 'owner-excess' }), /stream_busy/);
  release(); await Promise.all(pending); assert.equal(f.service.status().pending, 32);
});

test('after TTS EOF later round or memory staleness still cancels rendering', async t => {
  const f = await fixture(t), descriptor = await f.service.prepare(f.input());
  const identity = await f.relayOptions.authenticateClient(f.request(descriptor));
  await f.relayOptions.onSessionReady({ ...identity, id: 'wire-id', signal: new AbortController().signal });
  assert.equal(f.sourceCalls, 1); f.stale();
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(f.aborted, true); assert.equal(f.service.status().pending, 0);
});

test('disconnect and logout cancel exact prepared request', async t => {
  const f = await fixture(t); const controller = new AbortController();
  const descriptor = await f.service.prepare({ ...f.input(), signal: controller.signal });
  controller.abort(); assert.equal(await f.relayOptions.authenticateClient(f.request(descriptor)), null);
  const next = await f.service.prepare(f.input('next')); f.service.cancelPlayer('player-one');
  assert.equal(await f.relayOptions.authenticateClient(f.request(next)), null); assert.equal(f.sourceCalls, 0);
});

test('opt-in preserves local/cloud guards and never enables cloud guests', () => {
  const env = { CROUPIER_GENERATED_SPEECH_STREAMING: '1', CROUPIER_GENERATED_SPEECH: '1', CROUPIER_GENERATED_SPEECH_PREVIEW: '1', HOST: '127.0.0.1', CROUPIER_GENERATED_SPEECH_DIR: join(tmpdir(), 'stream-fixture'), CARTESIA_API_KEY: 'fixture', CROUPIER_SPEECH_STREAM_WORKER_SECRET: secret, CROUPIER_SPEECH_STREAM_TICKET_SECRET: `ticket-${secret}` };
  assert.equal(generatedSpeechStreamConfiguration(env).configured, true);
  assert.equal(generatedSpeechStreamConfiguration({ ...env, CROUPIER_GENERATED_SPEECH_STREAMING: '' }).enabled, false);
  assert.equal(generatedSpeechStreamConfiguration({ ...env, HOST: '0.0.0.0', NODE_ENV: 'production', PUBLIC_URL: 'https://example.test', CROUPIER_CLOUD_GENERATED_SPEECH: '1', DEMO_GUEST_ACCESS: '1' }).configured, false);
  const cloud = { ...env, CROUPIER_CLOUD_RUNTIME: '1', CROUPIER_GENERATED_SPEECH_PREVIEW: '', CROUPIER_CLOUD_GENERATED_SPEECH: '1', NODE_ENV: 'production', PUBLIC_URL: 'https://game.example.test',
    RUNPOD_API_KEY: 'fixture', CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID: 'fixture-endpoint',
    CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD: '0.50', CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD: '9.94' };
  assert.equal(generatedSpeechStreamConfiguration(env).configuration.overlapAudio, undefined);
  assert.equal(generatedSpeechStreamConfiguration(cloud).configured, true);
  assert.equal(generatedSpeechStreamConfiguration(cloud).configuration.overlapAudio, true);
  assert.equal(generatedSpeechStreamConfiguration({ ...cloud, CROUPIER_GENERATED_SPEECH_DIR:undefined }).configured, true,
    'Neon session/request journals replace the cloud stream directory');
  for (const patch of [{ CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD: '' }, { CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD: '' }, { CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD: '20.000001' }, { RUNPOD_API_KEY: '' }]) {
    assert.equal(generatedSpeechStreamConfiguration({ ...cloud, ...patch }).configured, false);
  }
});

test('service closes the session manager before terminating the relay', async t => {
  const order = [];
  const f = await fixture(t, {
    session:true,
    onRelayClose: () => order.push('relay'),
    onStop: () => order.push('manager'),
  });
  await f.service.prepare(f.input());
  await f.service.close();
  assert.deepEqual(order, ['manager', 'relay']);
});

test('verified request reserves identity before starting/reusing worker; TTS waits for socket admission', async t => {
  let starts = 0, f;
  f = await fixture(t, { session:true,onSubmit() { assert.equal(f.pool.state.requests.size,1); starts++; } });
  const descriptor = await f.service.prepare(f.input());
  assert.equal(starts, 1); assert.equal(f.sourceCalls, 0); assert.equal(descriptor.kind, 'generated-speech-stream');
  await assert.rejects(f.service.prepare(f.input()), /already_attempted/);
  assert.equal(starts, 1, 'duplicate request cannot restart a paid worker');
  f.relayOptions.onWorkerIdle(f.workerId);
  assert.equal(starts, 1, 'completion notification does not submit another job');
});

test('failed worker startup cannot issue a stream ticket or pay again for the same request', async t => {
  let starts = 0;
  const f = await fixture(t, { session:true,uncertainSubmission:true,onSubmit() { starts++; return new Response('synthetic rejected request',{status:403}); } });
  await assert.rejects(f.service.prepare(f.input()), { code: 'generated_speech_session_provider_forbidden' });
  await assert.rejects(f.service.prepare(f.input()), /already_attempted/);
  assert.equal(starts, 1); assert.equal(f.service.status().pending, 0); assert.equal(f.sourceCalls, 0);
});

test('only a completed exact audio/video pair enters reply library; save never gates first media',async t=>{
  const saved=[],statuses=[];let releaseSave;const saving=new Promise(resolve=>releaseSave=resolve);
  const f=await fixture(t,{replyLibrary:{async save(value){saved.push(value);await saving;}},onLibraryStatus:value=>statuses.push(value)});
  const descriptor=await f.service.prepare(f.input());assert.equal(saved.length,0);
  const identity=await f.relayOptions.authenticateClient(f.request(descriptor));await f.relayOptions.onSessionReady({...identity,id:'wire',signal:new AbortController().signal});
  f.relayOptions.onMedia(identity,Buffer.from('first MP4 fragment'));f.relayOptions.onComplete(identity,{frames:0,aborted:true});assert.equal(saved.length,0);
  f.relayOptions.onMedia(identity,Buffer.from('last MP4 fragment'));f.relayOptions.onComplete(identity,{frames:12});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(saved.length,1);assert.equal(saved[0].exactText,f.input().text);
  assert.equal(saved[0].language,'en');
  assert.equal(saved[0].audio.bytes.toString('ascii',0,4),'RIFF');assert.equal(saved[0].audio.bytes.length,44+48);
  assert.equal(saved[0].video.bytes.toString(),'first MP4 fragmentlast MP4 fragment');
  f.relayOptions.onComplete(identity,{frames:12});assert.equal(saved.length,1);
  releaseSave();await new Promise(resolve=>setImmediate(resolve));assert.equal(statuses[0].state,'saved');
});
for(const [dealerId,language] of [['paow','sv'],['dragan','sv'],['nova','en']])
test(`reply library stores the ${dealerId} chat persona language`,async t=>{
  const saved=[];
  const selected=avatar(dealerId);
  const runtime={profileRevision:selected.profileRevision,imageSha256:selected.imageSha256,compositing:null,avatar:selected,assertFresh:async()=>{},
    source:async function*({beforeCostly}){await beforeCostly();yield new Uint8Array(48);}};
  const f=await fixture(t,{session:true,replyLibrary:{async save(value){saved.push(value);}},dealerRuntime:{prepare:async()=>runtime}});
  const descriptor=await f.service.prepare({...f.input(),dealerId,text:'Lugnt, korten har ingen brådska.'});
  const identity=await f.relayOptions.authenticateClient(f.request(descriptor));
  await f.relayOptions.onSessionReady({...identity,id:'wire',signal:new AbortController().signal});
  f.relayOptions.onMedia(identity,Buffer.from('MP4 fragment'));f.relayOptions.onComplete(identity,{frames:12});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(saved.length,1);assert.equal(saved[0].dealerId,dealerId);assert.equal(saved[0].language,language);
  assert.equal(saved[0].profileRevision,runtime.profileRevision);
});
test('cancelled or incomplete streams cannot be archived as completed replies',async t=>{
  const saved=[];const f=await fixture(t,{replyLibrary:{async save(value){saved.push(value);}}});
  const descriptor=await f.service.prepare(f.input());const identity=await f.relayOptions.authenticateClient(f.request(descriptor));
  f.relayOptions.onMedia(identity,Buffer.from('partial'));f.relayOptions.onComplete(identity,{frames:12});assert.equal(saved.length,0);
  f.service.cancelOwner(f.input().owner);f.relayOptions.onComplete(identity,{frames:12});assert.equal(saved.length,0);
});

test('reply capture memory is bounded without stopping playback and cancellation releases it',async t=>{
  const saved=[],statuses=[];
  const f=await fixture(t,{replyCaptureBytes:60,replyLibrary:{async save(value){saved.push(value);}},onLibraryStatus:v=>statuses.push(v)});
  const start=async id=>{const d=await f.service.prepare(f.input(id));const i=await f.relayOptions.authenticateClient(f.request(d));await f.relayOptions.onSessionReady({...i,id:'wire-'+id,signal:new AbortController().signal});return i;};
  let identity=await start('oversized');f.relayOptions.onMedia(identity,Buffer.alloc(13));f.relayOptions.onComplete(identity,{frames:12});
  assert.equal(f.written,48);assert.equal(saved.length,0);assert.equal(statuses[0].state,'skipped');
  f.service.cancelOwner(f.input().owner);
  identity=await start('cancelled');f.relayOptions.onMedia(identity,Buffer.alloc(12));f.service.cancelOwner(f.input().owner);
  identity=await start('completed');f.relayOptions.onMedia(identity,Buffer.alloc(12));f.relayOptions.onComplete(identity,{frames:12});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(saved.length,1);assert.equal(f.written,144);
});
test('pending Blob writes count toward reply capture memory until they settle',async t=>{
  let release;const pending=new Promise(resolve=>release=resolve),saved=[],statuses=[];
  const f=await fixture(t,{replyCaptureBytes:60,replyLibrary:{async save(value){saved.push(value);await pending;}},onLibraryStatus:v=>statuses.push(v)});
  const start=async id=>{const d=await f.service.prepare(f.input(id));const i=await f.relayOptions.authenticateClient(f.request(d));await f.relayOptions.onSessionReady({...i,id:'wire-'+id,signal:new AbortController().signal});return i;};
  try{
    let identity=await start('saving');f.relayOptions.onMedia(identity,Buffer.alloc(12));f.relayOptions.onComplete(identity,{frames:12});
    await new Promise(resolve=>setImmediate(resolve));f.service.cancelOwner(f.input().owner);
    identity=await start('plays-during-save');f.relayOptions.onMedia(identity,Buffer.alloc(12));f.relayOptions.onComplete(identity,{frames:12});
    assert.equal(f.written,96);assert.equal(saved.length,1);assert.equal(statuses[0].state,'skipped');
    release();await new Promise(resolve=>setImmediate(resolve));f.service.cancelOwner(f.input().owner);
    identity=await start('after-save');f.relayOptions.onMedia(identity,Buffer.alloc(12));f.relayOptions.onComplete(identity,{frames:12});
    await new Promise(resolve=>setImmediate(resolve));assert.equal(saved.length,2);
  }finally{release();}
});

test('prewarm reads only the selected dealer runtime; no GPU session or audio is started',async t=>{
  let references=0;
  const f=await fixture(t,{session:true,dealerRuntime:{async prepare({dealerId,beforeCostly}){await beforeCostly();assert.equal(dealerId,'paow');references++;return {}; }}});
  assert.equal(await f.service.prewarm({...f.input(),dealerId:'paow'}),true);
  assert.equal(references,1);assert.equal(f.providerCalls,0);assert.equal(f.sourceCalls,0);assert.equal(f.service.status().pending,0);
  f.stale();assert.equal(await f.service.prewarm({...f.input(),dealerId:'paow'}),false);assert.equal(references,1);assert.equal(f.providerCalls,0);
});

test('cloud overlap buffers TTS while the GPU session starts and writes it once', async t => {
  let release, seen;
  const opened = new Promise(resolve => { seen = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const f = await fixture(t, {
    overlapAudio: true,
    pcmSource: async function* ({ beforeCostly }) {
      await beforeCostly(); calls++; seen();
      yield new Uint8Array(24);
      await gate;
      yield new Uint8Array(24);
    },
    onStatus:async()=>{await gate;},
  });
  const pending = f.service.prepare(f.input());
  await opened;
  assert.equal(calls, 1);
  release();
  const descriptor = await pending;
  const identity = await f.relayOptions.authenticateClient(f.request(descriptor));
  await f.relayOptions.onSessionReady({ ...identity, id: 'wire', signal: new AbortController().signal });
  assert.equal(calls, 1); assert.equal(f.written, 48);
});

test('buffered PCM drains in bounded blocks independent of provider packet sizes', async t => {
  let finished;
  const ready = new Promise(resolve => { finished = resolve; });
  const expected = Buffer.from(Array.from({length:150000}, (_, i) => i % 251)), writes = [];
  const f = await fixture(t, {
    overlapAudio: true, onWrite: bytes => writes.push(Buffer.from(bytes)),
    pcmSource: async function* ({ beforeCostly }) {
      await beforeCostly();
      // Tiny packets followed by one packet larger than a relay write.
      for (let i=0; i<24000; i+=240) yield expected.subarray(i,i+240);
      yield expected.subarray(24000); finished();
    },
    onStatus:async()=>{await ready;},
  });
  const descriptor = await f.service.prepare(f.input());
  const identity = await f.relayOptions.authenticateClient(f.request(descriptor));
  await f.relayOptions.onSessionReady({...identity,id:'wire',signal:new AbortController().signal});
  assert.deepEqual(writes.map(bytes=>bytes.length),[65536,65536,18928]);
  assert.deepEqual(Buffer.concat(writes),expected);
});

test('a partial PCM block flows before the provider finishes', async t => {
  let release, seen;
  const gate = new Promise(resolve=>{release=resolve;}), firstWrite = new Promise(resolve=>{seen=resolve;});
  t.after(()=>release());
  const writes=[];
  const f=await fixture(t,{
    overlapAudio:true, onWrite:bytes=>{writes.push(bytes.length);seen();},
    pcmSource:async function*({beforeCostly}){await beforeCostly();yield new Uint8Array(24);await gate;yield new Uint8Array(24);},
  });
  const descriptor=await f.service.prepare(f.input());
  const identity=await f.relayOptions.authenticateClient(f.request(descriptor));
  const completed=f.relayOptions.onSessionReady({...identity,id:'wire',signal:new AbortController().signal});
  await firstWrite; assert.deepEqual(writes,[24]); release(); await completed;
  assert.deepEqual(writes,[24,24]);
});

test('freshness rejection between buffered blocks prevents remaining PCM delivery', async t => {
  let finished;
  const ready=new Promise(resolve=>{finished=resolve;});
  const f=await fixture(t,{
    overlapAudio:true, onWrite:()=>f.stale(),
    pcmSource:async function*({beforeCostly}){await beforeCostly();yield new Uint8Array(100000);finished();},
    onStatus:async()=>{await ready;},
  });
  const descriptor=await f.service.prepare(f.input());
  const identity=await f.relayOptions.authenticateClient(f.request(descriptor));
  await assert.rejects(f.relayOptions.onSessionReady({...identity,id:'wire',signal:new AbortController().signal}),/Speech source unavailable/);
  assert.equal(f.written,65536); assert.equal(f.aborted,true);
});

test('a rejected GPU job never starts overlapped TTS', async t => {
  let calls = 0;
  const f = await fixture(t, {
    overlapAudio: true,
    uncertainSubmission:true,
    pcmSource: async function* () { calls++; yield new Uint8Array(24); },
    onSubmit:()=>new Response('synthetic denied GPU job',{status:403}),
  });
  await assert.rejects(f.service.prepare(f.input()), { code: 'generated_speech_session_provider_forbidden' });
  assert.equal(calls, 0); assert.equal(f.service.status().pending, 0);
});

test('owner cancellation aborts overlapped TTS while the GPU worker is still connecting', async t => {
  let calls = 0, aborted = false, release, seen;
  const gate = new Promise(resolve => { release = resolve; });
  const opened = new Promise(resolve => { seen = resolve; });
  const f = await fixture(t, {
    overlapAudio: true,
    pcmSource: async function* ({ signal, beforeCostly }) {
      await beforeCostly(); calls++; seen();
      await new Promise((_, reject) => signal.addEventListener('abort', () => { aborted = true; reject(Object.assign(Error('aborted'), { code: 'generated_speech_stream_cancelled' })); }));
    },
    onStatus:async()=>{await gate;},
  });
  const pending = f.service.prepare(f.input());
  await opened;
  f.service.cancelOwner(f.input().owner);
  assert.equal(aborted, true);
  release();
  await assert.rejects(pending, { code: 'generated_speech_stream_cancelled' });
  assert.equal(calls, 1); assert.equal(f.service.status().pending, 0);
});
