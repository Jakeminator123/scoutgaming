import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, basename, join, resolve } from 'node:path';
import { createGeneratedSpeechStreamService, generatedSpeechStreamConfiguration } from '../web/generated-speech-stream.mjs';
import { createGeneratedSpeechService } from '../web/generated-speech.mjs';

const secret = 'isolated-stream-secret-at-least-32-characters';
async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-stream-test-'));
  let relayOptions, service, owner = 'owner-one', fresh = true, sourceCalls = 0, aborted = false, written = 0, available = options.initialAvailable ?? 1;
  const config = { directory, workerSecret: secret, ticketSecret: secret, origin: 'http://127.0.0.1:4173', apiKey: 'fixture', voiceId: 'voice', modelId: 'model', ...(options.overlapAudio ? { overlapAudio: true } : {}) };
  const services = [];
  const relay = { status: () => ({ available }), close() { options.onRelayClose?.(); }, openSource: () => ({ writePCM: async b => { written += b.length; await options.onWrite?.(b); }, end() {}, abort() { aborted = true; } }) };
  const construct = () => createGeneratedSpeechStreamService({}, config, { freshnessIntervalMs: 10,
    resolveOwner: req => req.owner,
    attachRelay: (_, value) => { relayOptions = value; return relay; },
    pcmSource: options.pcmSource ?? (async function*({ beforeCostly }) { await beforeCostly(); sourceCalls++; yield new Uint8Array(48); }),
    sessionManager: options.sessionManager,
    dealerRuntime: options.dealerRuntime, replyLibrary:options.replyLibrary, onLibraryStatus:options.onLibraryStatus, replyCaptureBytes:options.replyCaptureBytes,
  }).then(value => { services.push(value); return value; });
  service = await construct();
  const input = (requestId = 'test-request') => ({ requestId, dealerId: 'astrid', text: 'A test reply.', owner, playerId: 'player-one', beforeCostly: async () => { if (!fresh) throw Error('stale'); } });
  const request = (d, who = owner) => ({ owner: who, headers: { 'sec-websocket-protocol': `astrid-v2, ticket.${d.ticket}` } });
  t.after(async () => { await Promise.allSettled(services.map(s => s.close())); assert.equal(dirname(directory), resolve(tmpdir())); assert.match(basename(directory), /^croupier-stream-test-/); await rm(directory, { recursive: true, force: true }); });
  return { config, directory, service, construct, input, request, get relayOptions() { return relayOptions; },
    get sourceCalls() { return sourceCalls; }, get aborted() { return aborted; }, get written() { return written; }, stale() { fresh = false; }, setAvailable(value) { available = value; } };
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
  const runtime={profileRevision:'a'.repeat(64),imageSha256:'b'.repeat(64),compositing:null,avatar:{dealerId:'paow'},
    assertFresh:async()=>{if(!fresh)throw Error('profile changed');},
    source:async function*({beforeCostly}){await beforeCostly();paid++;yield new Uint8Array(48);}};
  const f=await fixture(t,{dealerRuntime:{prepare:async()=>runtime},sessionManager:{supportsAvatars:true,
    async ensure({avatar,beforeCostly}){await beforeCostly();avatarSeen=avatar;return {ready:true,workerId:'paow-worker',binding:{dealerId:'paow',profileRevision:runtime.profileRevision,imageSha256:runtime.imageSha256,protocolVersion:3}};},close(){}}});
  const descriptor=await f.service.prepare({...f.input(),dealerId:'paow'});
  assert.equal(descriptor.schemaVersion,2);assert.equal(descriptor.dealerId,'paow');assert.equal(descriptor.profileRevision,runtime.profileRevision);
  assert.equal(descriptor.compositing,null);assert.equal(avatarSeen,runtime.avatar);assert.equal(paid,0);
  const identity=await f.relayOptions.authenticateClient(f.request(descriptor));assert.equal(identity.workerId,'paow-worker');
  await f.relayOptions.onSessionReady({...identity,id:'wire',signal:new AbortController().signal});
  assert.equal(paid,1);assert.equal(f.sourceCalls,0);assert.equal(f.written,48);
  fresh=false;await new Promise(resolve=>setTimeout(resolve,40));assert.equal(f.aborted,true);
});
test('mismatched worker attestation produces no registered ticket or TTS',async t=>{
  let paid=0;
  const runtime={profileRevision:'a'.repeat(64),imageSha256:'b'.repeat(64),compositing:null,avatar:{dealerId:'paow'},assertFresh:async()=>{},source:async function*(){paid++;yield new Uint8Array(48);}};
  const f=await fixture(t,{dealerRuntime:{prepare:async()=>runtime},sessionManager:{supportsAvatars:true,
    ensure:async()=>({ready:true,workerId:'foreign',binding:{dealerId:'astrid'}}),close(){}}});
  await assert.rejects(f.service.prepare({...f.input(),dealerId:'paow'}),{code:'generated_speech_worker_binding_mismatch'});
  assert.equal(paid,0);assert.equal(f.sourceCalls,0);assert.equal(f.service.status().pending,0);
});
test('legacy local streaming still admits its worker but cannot accept a profile-bound avatar',async t=>{
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
  const f = await fixture(t); await f.service.prepare(f.input()); f.service.close();
  const restarted = await f.construct();
  await assert.rejects(restarted.prepare(f.input()), /already_attempted/);
  let fullfileCalls = 0;
  const oldService = createGeneratedSpeechService({ directory: f.directory }, { provider: { generate() { fullfileCalls++; throw Error('must not call'); } } });
  await assert.rejects(oldService.generate({ ...f.input(), text: 'A test reply.' }), /conflict|attempted/);
  assert.equal(fullfileCalls, 0); assert.equal((await readdir(f.directory)).filter(v => v.endsWith('.request.json')).length, 1);
});

test('an earlier fullfile paid attempt blocks same request in streaming mode', async t => {
  const f = await fixture(t); let fullfileCalls = 0;
  const oldService = createGeneratedSpeechService({ directory: f.directory }, { provider: { generate() { fullfileCalls++; throw Error('simulated provider failure'); } } });
  await assert.rejects(oldService.generate(f.input()));
  await assert.rejects(f.service.prepare(f.input()), /already_attempted/);
  assert.equal(fullfileCalls, 1); assert.equal(f.sourceCalls, 0);
});

test('concurrent prepares for same owner preserve only newest reservation', async t => {
  const f = await fixture(t);
  const results = await Promise.allSettled([f.service.prepare(f.input('older')), f.service.prepare(f.input('newer'))]);
  assert.equal(results[0].status, 'rejected'); assert.equal(results[1].status, 'fulfilled'); assert.equal(f.service.status().pending, 1);
});

test('pending prepares count toward bounded capacity before disk awaits', async t => {
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
  assert.equal(generatedSpeechStreamConfiguration({ ...cloud, CROUPIER_STUDIO_NEON_POLICY:'1', CROUPIER_GENERATED_SPEECH_DIR:undefined }).configured, true,
    'Neon session/request journals replace the cloud stream directory');
  for (const patch of [{ CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD: '' }, { CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD: '' }, { CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD: '10.01' }, { RUNPOD_API_KEY: '' }]) {
    assert.equal(generatedSpeechStreamConfiguration({ ...cloud, ...patch }).configured, false);
  }
});

test('service closes the session manager before terminating the relay', async t => {
  const order = [];
  const f = await fixture(t, {
    onRelayClose: () => order.push('relay'),
    sessionManager: { close: async () => { order.push('manager'); } },
  });
  await f.service.close();
  assert.deepEqual(order, ['manager', 'relay']);
});

test('close starts provider cleanup immediately, is idempotent and awaits a stale preparation even if manager fails', async t => {
  const activity = []; let release, entered;
  const held = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  const f = await fixture(t, { sessionManager: {
    ensure: async () => {}, close: async () => { activity.push('manager:close'); throw Error('fixture incomplete provider'); },
  }, onRelayClose: () => activity.push('relay:close') });
  const preparing = f.service.prepare({ ...f.input(), beforeCostly: async () => { entered(); await held; } });
  await started;
  const controller = new AbortController(), closing = f.service.close({ signal: controller.signal });
  assert.equal(f.service.close({ signal: controller.signal }), closing);
  let settled = false;
  const observedClose = closing.catch(error => { assert.equal(error.code, 'generated_speech_stream_shutdown_incomplete'); settled = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(activity, ['manager:close']); assert.equal(settled, false);
  await assert.rejects(f.service.prepare(f.input('after-close')), { code: 'generated_speech_stream_cancelled' });
  release();
  await assert.rejects(preparing, { code: 'generated_speech_stream_cancelled' });
  await observedClose;
  assert.deepEqual(activity, ['manager:close', 'relay:close']);
});

test('verified request reserves identity before starting/reusing worker; TTS waits for socket admission', async t => {
  let starts = 0, f;
  const activity = [];
  f = await fixture(t, { initialAvailable: 0, sessionManager: {
    async ensure({ beforeCostly }) {
      await beforeCostly();
      assert.equal((await readdir(f.directory)).filter(name => name.endsWith('.request.json')).length, 1);
      starts++; f.setAvailable(1);
    }, activity(workerId) { activity.push(workerId); }, close() {},
  } });
  const descriptor = await f.service.prepare(f.input());
  assert.equal(starts, 1); assert.equal(f.sourceCalls, 0); assert.equal(descriptor.kind, 'generated-speech-stream');
  await assert.rejects(f.service.prepare(f.input()), /already_attempted/);
  assert.equal(starts, 1, 'duplicate request cannot restart a paid worker');
  f.relayOptions.onWorkerIdle('owned-worker');
  assert.deepEqual(activity, ['owned-worker'], 'completed relay utterance resets its manager idle clock');
  assert.equal(starts, 1, 'completion notification does not submit another job');
});

test('failed worker startup cannot issue a stream ticket or pay again for the same request', async t => {
  let starts = 0;
  const f = await fixture(t, { initialAvailable: 0, sessionManager: {
    async ensure() { starts++; throw Object.assign(Error('blocked'), { code: 'generated_speech_daily_budget_exhausted' }); }, close() {},
  } });
  await assert.rejects(f.service.prepare(f.input()), { code: 'generated_speech_daily_budget_exhausted' });
  await assert.rejects(f.service.prepare(f.input()), /already_attempted/);
  assert.equal(starts, 1); assert.equal(f.service.status().pending, 0); assert.equal(f.sourceCalls, 0);
});

test('exclusive QA lease rejects product admission before reservation or costly work', async t => {
  const f = await fixture(t); let costly = 0;
  const release = f.service.acquireExclusive('operator-qa-one');
  assert.throws(() => f.service.acquireExclusive('operator-qa-two'), /stream_busy/);
  await assert.rejects(f.service.prepare({ ...f.input(), beforeCostly: async () => { costly++; } }), /stream_busy/);
  assert.equal(costly, 0); assert.deepEqual(await readdir(f.directory), []);
  release();
  await f.service.prepare(f.input());
  assert.equal(f.service.status().pending, 1);
});

test('in-flight product preparation and prepared records both block a QA lease', async t => {
  const f = await fixture(t); let release, entered;
  const held = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  const preparing = f.service.prepare({ ...f.input(), beforeCostly: async () => { entered(); await held; } });
  await started;
  assert.equal(f.service.status().pending, 1);
  assert.throws(() => f.service.acquireExclusive('operator-qa-one'), /stream_busy/);
  release(); await preparing;
  assert.throws(() => f.service.acquireExclusive('operator-qa-one'), /stream_busy/);
  f.service.cancelOwner('owner-one');
  const releaseQa = f.service.acquireExclusive('operator-qa-one'); releaseQa();
});

test('exclusive lease persists through TTS EOF and releases on stream terminal', async t => {
  const f = await fixture(t);
  f.service.acquireExclusive('owner-one');
  const descriptor = await f.service.prepare(f.input());
  const identity = await f.relayOptions.authenticateClient(f.request(descriptor));
  const wire = new AbortController();
  await f.relayOptions.onSessionReady({ ...identity, id: 'qa-wire', signal: wire.signal });
  await assert.rejects(f.service.prepare({ ...f.input('product'), owner: 'product' }), /stream_busy/);
  wire.abort();
  await f.service.prepare({ ...f.input('product'), owner: 'product' });
  assert.equal(f.sourceCalls, 1);
});

test('exclusive lease automatically releases on preparation error and explicit owner cancellation', async t => {
  const f = await fixture(t);
  f.service.acquireExclusive('owner-one');
  await assert.rejects(f.service.prepare({ ...f.input(), beforeCostly: async () => { throw Error('stale'); } }));
  const release = f.service.acquireExclusive('owner-one');
  await f.service.prepare(f.input('qa-next'));
  f.service.cancelOwner('owner-one'); release();
  await f.service.prepare({ ...f.input('product'), owner: 'product' });
});

test('QA abort retains exclusion until shared manager cancellation settles; product cannot join it', async t => {
  let starts = 0, entered, drain, f;
  const started = new Promise(resolve => { entered = resolve; });
  const cleanup = new Promise(resolve => { drain = resolve; });
  f = await fixture(t, { sessionManager: {
    async ensure({ signal }) {
      starts++;
      if (starts === 1) { entered(); await cleanup; signal.throwIfAborted(); }
    }, close() {},
  } });
  const abort = new AbortController(), release = f.service.acquireExclusive('owner-one');
  const qa = f.service.prepare({ ...f.input('qa'), signal: abort.signal });
  await started;
  abort.abort(); f.service.cancelOwner('owner-one'); release();
  assert.equal(f.service.status().pending, 1, 'cancelled work stays visible until cleanup ends');
  assert.throws(() => f.service.acquireExclusive('another-qa'), /stream_busy/);
  await assert.rejects(f.service.prepare({ ...f.input('product'), owner: 'product' }), /stream_busy/);
  assert.equal(starts, 1, 'product never enters the old ensure promise');
  drain(); await assert.rejects(qa);
  assert.equal(f.service.status().pending, 0);
  await f.service.prepare({ ...f.input('product'), owner: 'product' });
  assert.equal(starts, 2);
});

test('only a completed exact audio/video pair enters reply library; save never gates first media',async t=>{
  const saved=[],statuses=[];let releaseSave;const saving=new Promise(resolve=>releaseSave=resolve);
  const f=await fixture(t,{replyLibrary:{async save(value){saved.push(value);await saving;}},onLibraryStatus:value=>statuses.push(value)});
  const descriptor=await f.service.prepare(f.input());assert.equal(saved.length,0);
  const identity=await f.relayOptions.authenticateClient(f.request(descriptor));await f.relayOptions.onSessionReady({...identity,id:'wire',signal:new AbortController().signal});
  f.relayOptions.onMedia(identity,Buffer.from('first MP4 fragment'));f.relayOptions.onComplete(identity,{frames:0,aborted:true});assert.equal(saved.length,0);
  f.relayOptions.onMedia(identity,Buffer.from('last MP4 fragment'));f.relayOptions.onComplete(identity,{frames:12});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(saved.length,1);assert.equal(saved[0].exactText,f.input().text);
  assert.equal(saved[0].audio.bytes.toString('ascii',0,4),'RIFF');assert.equal(saved[0].audio.bytes.length,44+48);
  assert.equal(saved[0].video.bytes.toString(),'first MP4 fragmentlast MP4 fragment');
  f.relayOptions.onComplete(identity,{frames:12});assert.equal(saved.length,1);
  releaseSave();await new Promise(resolve=>setImmediate(resolve));assert.equal(statuses[0].state,'saved');
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
  let references=0,workers=0;
  const f=await fixture(t,{dealerRuntime:{async prepare({dealerId,beforeCostly}){await beforeCostly();assert.equal(dealerId,'paow');references++;return {}; }},sessionManager:{async ensure(){workers++;},close(){}}});
  assert.equal(await f.service.prewarm({...f.input(),dealerId:'paow'}),true);
  assert.equal(references,1);assert.equal(workers,0);assert.equal(f.sourceCalls,0);assert.equal(f.service.status().pending,0);
  f.stale();assert.equal(await f.service.prewarm({...f.input(),dealerId:'paow'}),false);assert.equal(references,1);assert.equal(workers,0);
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
    sessionManager: { async ensure({ beforeCostly, onSubmitted }) { await beforeCostly(); await onSubmitted(); await gate; return { ready: true }; }, close() {} },
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
    sessionManager: { async ensure({onSubmitted}) { await onSubmitted(); await ready; return {ready:true}; }, close() {} },
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
    sessionManager:{async ensure({onSubmitted}){await onSubmitted();return {ready:true};},close(){}},
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
    sessionManager:{async ensure({onSubmitted}){await onSubmitted();await ready;return {ready:true};},close(){}},
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
    pcmSource: async function* () { calls++; yield new Uint8Array(24); },
    sessionManager: {
      async ensure() { throw Object.assign(Error('blocked'), { code: 'generated_speech_session_worker_failed' }); },
      close() {},
    },
  });
  await assert.rejects(f.service.prepare(f.input()), { code: 'generated_speech_session_worker_failed' });
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
    sessionManager: {
      async ensure({ onSubmitted }) { await onSubmitted(); await gate; return { ready: true }; },
      close() {},
    },
  });
  const pending = f.service.prepare(f.input());
  await opened;
  f.service.cancelOwner(f.input().owner);
  assert.equal(aborted, true);
  release();
  await assert.rejects(pending, { code: 'generated_speech_stream_cancelled' });
  assert.equal(calls, 1); assert.equal(f.service.status().pending, 0);
});
