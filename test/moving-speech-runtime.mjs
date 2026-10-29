import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { setTimeout as pause } from 'node:timers/promises';
import { createMovingSpeechRuntime, movingSpeechFailureReceipt, movingSpeechPreparationFailureReceipt } from '../services/game/moving-speech-runtime.mjs';
import { createMovingSpeechSourceSet } from '../services/game/moving-speech-bank.mjs';
import { MOVING_SPEECH_MAX_PCM_BYTES } from '../services/game/moving-speech-timing.mjs';
import { validateMovingSpeechStream } from '../packages/presentation/runtime/moving-speech-player.mjs';
import {DRAGAN_KEVIN_PROFILE} from '../packages/presentation/contracts/filmed-profiles/kevin-dragan-f15b2af1.mjs';

const { WebSocket } = createRequire(new URL('../services/astrid-gpu-worker/gateway/package.json', import.meta.url))('ws');
const digest = bytes => createHash('sha256').update(bytes).digest('hex'), h = 'a'.repeat(64), sessionId = '1'.repeat(32);
const videoId = '11111111-1111-1111-1111-111111111111', origin = 'https://fixture.example';
const record = (extension, type, bytes) => ({ provider: 'vercel-blob',
  pathname: `croupier/media/dealers/dragan/runtime/moving-bank/${videoId}/${digest(bytes)}.${extension}`,
  contentType: type, size: bytes.length, sha256: digest(bytes) });
async function until(check) { for (let i = 0; i < 100; i++) { if (check()) return; await pause(5); } assert.fail('runtime fixture did not settle'); }
// The single-dealer fixture is one lane of the per-dealer runtime.
const oneLane = ({ bank, sessions, admissionCheck, ...options }) => ({ ...options, lanes: [{ bank, sessions, admissionCheck }] });

async function setup(t, options = {}) {
  const original = Buffer.from('synthetic-original'), pcm = options.pcm ?? Buffer.alloc(36000, 1), trace = [], sockets = [], failures = [], preparationFailures = [];
  const dealClips=options.deal?DRAGAN_KEVIN_PROFILE.takes.map((take,i)=>({videoId:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,
    sha256:take.sha256,bytes:100+i,fps:24,frameCount:take.frames,width:1080,height:1920})):[];
  const sourceSet = createMovingSpeechSourceSet({ dealerId: 'dragan', clips: [...dealClips,{ videoId, sha256: digest(original), bytes: original.length,
    fps: 24, frameCount: 24, width: 1080, height: 1920 }], rest: { videoId, frame: 7 } });
  const bank = { schemaVersion: 1, sourceSet, archive: record('bin', 'application/octet-stream', Buffer.from('bank')),
    receipt: record('json', 'application/json', Buffer.from('{}')) };
  const registry = { videos: [...dealClips.map(c=>({id:c.videoId,dealer:'dragan',sha256:c.sha256,bytes:c.bytes,size:c.bytes,available:true,
    storage:'private-blob',contentType:'video/mp4',classification:{dealerId:'dragan',kind:'action'}})),{ id: videoId, dealer: 'dragan', sha256: digest(original), bytes: original.length,
    available: true, storage: 'private-blob', contentType: 'video/mp4', classification: { dealerId: 'dragan', kind: 'idle' } }] };
  const state = { projectRevision: 1, profileChanged: false, now: Date.now(), cancelled: 0, dispatched: 0, reads: 0, chunks: 0 };
  state.receipt={version:7,payload:JSON.stringify([{type:'deal',to:'box',box:3,shoeDraw:1},{type:'deal',to:'dealer',faceDown:false,shoeDraw:2},
    {type:'deal',to:'box',box:3,shoeDraw:3},{type:'deal',to:'dealer',faceDown:true,shoeDraw:4}])};
  const evidence = () => ({ projectRevision: state.projectRevision, mediaReferences: [{ id: videoId, sha256: digest(original) }],
    frozenContext: { schemaVersion: 3, context: { dealerId: 'dragan' }, dealer: { id: 'dragan' },
      project:{lines:[{dealerId:'dragan',variants:dealClips.map(c=>({videoGenerationId:c.videoId}))}]},inventory:registry,
      records: [...registry.videos.filter(v=>v.id!==videoId),{ id: videoId,
      sha256: digest(original), size: original.length, contentType: 'video/mp4', classification: { dealerId: 'dragan', kind: 'idle' } }] } });
  let runtime, admitted;
  const server = createServer(async (req, res) => { if (!await runtime.handleHttp(req, res)) { res.writeHead(404); res.end(); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`, address = base.replace('http:', 'ws:') + '/moving-speech-stream';
  runtime = createMovingSpeechRuntime(oneLane({ server, origin, bank, releaseSha256: h, ticketSecret: 'fixture-only'.repeat(4), now: () => state.now,
    connectionMs: options.connectionMs ?? 15000, admissionCheck:options.admissionCheck,
    onCleanupError:()=>trace.push('cleanup-recovery'),
    onStreamFailure:receipt=>{failures.push(receipt);return options.onStreamFailure?.(receipt);},
    onPreparationFailure:receipt=>{preparationFailures.push(receipt);return options.onPreparationFailure?.(receipt);},
    resolveOwner: async req => req.headers.cookie === 'owner=one' ? 'owner-one' : 'other-owner',
    readEvidence: async context => { state.reads++; (state.contexts??=[]).push(context); const snapshot=evidence(); await options.onEvidence?.(state); return snapshot; }, readRegistry: async () => registry,
    readPresentation:async()=>{state.presentationReads=(state.presentationReads??0)+1;const snapshot=state.receipt;await options.onPresentation?.(state);return snapshot;},publicVideo:(_context,id)=>({id,sha256:registry.videos.find(v=>v.id===id).sha256,src:'/api/presentation/registered-video/fixture/'+id}),
    readRest: async () => new Response(original, { headers: { 'content-type': 'video/mp4', 'content-length': String(original.length), 'cache-control': 'private, no-store' } }),
    bankRead: options.bankRead ?? (async () => assert.fail('runtime fixture must never download bank bytes')),
    dealerRuntime: { async prepareMoving(input) {
      assert.equal(input.dealerId,'dragan'); assert.deepEqual(input.sourceSet,sourceSet);
      await options.onPrepare?.(input,state);
      trace.push('voice-prepared'); return { profileRevision: h, compositing: null,
        async assertFresh() { if (state.profileChanged) throw Error('generated_speech_profile_changed'); },
        async *source({ beforeCostly, signal }) { trace.push('tts'); await beforeCostly(); signal.throwIfAborted();
          await options.onTts?.(state);
          for (const chunk of options.pcmChunks ?? [pcm]) { options.onTtsChunk?.(chunk); yield chunk; } },
      };
    } },
    sessions: { async admit(args) {
      trace.push('admit'); admitted = args; await options.onAdmit?.(args,state); await args.beforeCostly();
      const binding = { ...args.binding, schemaVersion: 1, sessionId, attemptId: 'attempt-1', nonce: '2'.repeat(64) };
      return { sessionId, binding, warm: options.warm === true, async assertCurrent(admissionOptions){await options.assertSessionCurrent?.(state,admissionOptions);},
        async submit() { trace.push('submit'); state.submitting=true;
          try {await args.beforeCostly();} finally {state.submitting=false;} },
        async ready() { trace.push('ready'); await options.onReady?.(state); }, handleUpgrade() { return false; },
        async cancel() { trace.push('cancel'); state.cancelled++; if(options.cancelFails)throw Error('journal_unavailable'); },
        async dispatch(input, { onChunk }) {
          state.dispatched++; trace.push('dispatch');
          for (let from = 0; from < input.plan.timeline.length; from += 12) {
            const n = Math.min(12, input.plan.timeline.length - from);
            await onChunk({ t: 'lapp', id: input.plan.start.id, del: from / 12, fran: from,
              rutor: input.plan.timeline.slice(from,from+n).map(row => ({ tagning: row.take, ruta: row.frame, rect: [1, 2, 30, 40] })) }, Buffer.from([n, 0, 1, 9]));
            state.chunks++;
            await options.afterChunk?.(state,args.signal);
          }
        },
      };
    } },
  }));
  t.after(async () => { for (const socket of sockets) socket.terminate(); await runtime.close(); await new Promise(resolve => server.close(resolve)); });
  const input = { owner: 'owner-one', playerId: 'player-one', requestId: 'request-1', dealerId: 'dragan', text: 'Hej Jakob.',
    context: { dealerId: 'dragan' }, beforeCostly: async () => { trace.push('guard'); await options.beforeCostly?.(state); } };
  if(options.deal){input.presentationVersion=7;input.sessionRevision='browser-1';input.context={operatorSlug:'test',roomId:'one',packageRevision:1,dealerId:'dragan'};
    runtime.observeCommitted({playerId:input.playerId,command:{op:'start',dealer:'dragan'},view:{version:7},
      session:{movingSpeech:{ownerHash:digest(input.owner),context:input.context,sessionRevision:input.sessionRevision}}});}
  const connect = (descriptor, overrides = {}) => {
    const socket = new WebSocket(overrides.url ?? address, overrides.protocols ?? ['moving-v1', `ticket.${descriptor.ticket}`],
      { headers: { origin, cookie: 'owner=one', ...overrides.headers } });
    const messages = [], close = new Promise(resolve => socket.once('close', (code, reason) => resolve({ code, reason: reason.toString() })));
    socket.on('message', (data, binary) => messages.push(binary ? Buffer.from(data) : JSON.parse(data.toString())));
    socket.on('error', () => {}); sockets.push(socket);
    const opened = new Promise(resolve => {
      socket.once('open', () => resolve({ status: 101 }));
      socket.once('unexpected-response', (_req, res) => { res.resume(); resolve({ status: res.statusCode }); });
      socket.once('error', error => resolve({ error }));
    });
    return { socket, messages, opened, close, send: value => socket.send(JSON.stringify(value)) };
  };
  return { runtime, state, input, trace, failures, preparationFailures, original, pcm, registry, base, address, sourceSet, connect,
    prepare: overrides => runtime.prepare({ ...input, ...overrides }), get admitted() { return admitted; } };
}

test('preparation receipts allowlist codes and redact exceptions, phases and invalid identifiers', () => {
  const secret='https://private.example/?ticket=secret';
  const base={phase:'admission',requestId:'request-1',streamId:sessionId};
  const expected=code=>({event:'moving_speech_preparation_failed',code,...base});
  const error=Object.assign(Error(secret),{code:'generated_speech_moving_capacity_unverified',stack:secret,cause:{token:secret}});
  assert.deepEqual(movingSpeechPreparationFailureReceipt({...base,error}),expected(error.code));
  assert.deepEqual(movingSpeechPreparationFailureReceipt({...base,error:Error('generated_speech_voice_unavailable')}),expected('generated_speech_voice_unavailable'));
  assert.deepEqual(movingSpeechPreparationFailureReceipt({...base,error:new DOMException(secret,'AbortError')}),expected('moving_speech_cancelled'));
  for(const error of [Error(secret),{code:'generated_speech_voice_unavailable '+secret,message:secret},
    {get code(){throw Error(secret);}},secret,null]){
    assert.deepEqual(movingSpeechPreparationFailureReceipt({...base,error}),expected('moving_speech_unavailable'));
  }
  for(const invalid of [secret,'x'.repeat(129),sessionId+'\n',{},undefined]){
    assert.deepEqual(movingSpeechPreparationFailureReceipt({error,phase:invalid,requestId:invalid,streamId:invalid}),
      {event:'moving_speech_preparation_failed',code:error.code,phase:'unknown',requestId:null,streamId:null});
  }
});

test('voice and admission failures log once before TTS/submit and preserve the original error',async t=>{
  for(const [code,hook,phase] of [
    ['generated_speech_voice_unavailable','onPrepare','profile-voice'],
    ['generated_speech_profile_not_enabled','onPrepare','profile-voice'],
    ['generated_speech_moving_reference_unavailable','onPrepare','profile-voice'],
    ['generated_speech_moving_capacity_unverified','onAdmit','admission'],
    ['generated_speech_total_budget_exhausted','onAdmit','admission'],
    ['generated_speech_recovery_required','onAdmit','admission'],
  ]){
    const error=Object.assign(Error('private upstream detail'),{code}),seen=[];
    const f=await setup(t,{[hook]:async input=>{seen.push(input.signal);throw error;}});
    await assert.rejects(f.prepare(),actual=>actual===error);
    assert.deepEqual(f.preparationFailures,[{event:'moving_speech_preparation_failed',code,phase,streamId:null,requestId:f.input.requestId}]);
    assert.equal(seen[0].aborted,true);
    assert.equal(f.trace.includes('submit'),false);assert.equal(f.trace.includes('tts'),false);
    assert.equal(f.state.dispatched,0);assert.equal(f.state.cancelled,0);
  }
});

test('unknown preparation errors are generic in diagnostics, without replacing the exception',async t=>{
  const error=Object.assign(Error('private utterance'),{code:'provider-private-token',url:'https://private.example'});
  const f=await setup(t,{onAdmit:()=>{throw error;}});
  await assert.rejects(f.prepare(),actual=>actual===error);
  assert.deepEqual(f.preparationFailures,[{event:'moving_speech_preparation_failed',code:'moving_speech_unavailable',phase:'admission',streamId:null,requestId:f.input.requestId}]);
  assert.equal(f.admitted.signal.aborted,true);assert.equal(f.trace.includes('submit'),false);
});

test('throwing, rejecting or pending preparation loggers cannot prevent cancellation or replace the first failure',async t=>{
  for(const onPreparationFailure of [()=>{throw Error('logger unavailable');},()=>Promise.reject(Error('logger unavailable')),()=>new Promise(()=>{})]){
    const error=Error('moving_worker_read_timeout');
    const f=await setup(t,{onReady:()=>{throw error;},onPreparationFailure,cancelFails:true});
    await assert.rejects(f.prepare(),actual=>actual===error);
    assert.equal(f.state.cancelled,1);assert.equal(f.admitted.signal.aborted,true);
    assert.equal(f.trace.includes('cleanup-recovery'),true);assert.equal(f.trace.includes('tts'),false);
    assert.deepEqual(f.preparationFailures,[{event:'moving_speech_preparation_failed',code:error.message,phase:'worker-ready',streamId:sessionId,requestId:f.input.requestId}]);
  }
});

test('bank-ready admission precedes TTS; exact descriptor and plan survive real HTTP/WS credit flow and graceful done', async t => {
  const f = await setup(t), d = await f.prepare();
  assert.ok(f.trace.indexOf('admit') < f.trace.indexOf('submit')); assert.ok(f.trace.indexOf('ready') < f.trace.indexOf('tts'));
  assert.equal((await validateMovingSpeechStream(d, { dealerId: 'dragan', requestId: f.input.requestId, exactText: f.input.text, now: f.state.now })).id, sessionId);
  assert.equal(f.admitted.ownerHash, digest('owner-one'));
  const rest = await fetch(f.base + `/api/moving-speech/${d.id}/rest`, { headers: { cookie: 'owner=one' } });
  assert.equal(rest.status, 200); assert.deepEqual(Buffer.from(await rest.arrayBuffer()), f.original);
  const client = f.connect(d); assert.equal((await client.opened).status, 101);
  await until(() => client.messages.length === 3);
  const [ready, pcmMeta, pcm] = client.messages;
  assert.equal(ready.rest.sourceFrame, 7); assert.ok(ready.plan.timeline.every(r => r.take === 'vila' && r.frame === 0 && r.sourceSha256 === digest(f.original)));
  assert.deepEqual(pcmMeta, { t: 'pcm', id: d.id, byteLength: f.pcm.length }); assert.deepEqual(pcm, f.pcm);
  assert.equal(ready.plan.binding.audioSha256, digest(pcm)); assert.equal(f.state.chunks, 0);
  client.send({ t: 'credit', id: ready.plan.start.id, frames: 24 }); await until(() => f.state.chunks === 2);
  assert.equal(client.messages.filter(x => x.t === 'done').length, 0);
  client.send({ t: 'credit', id: ready.plan.start.id, frames: 12 });
  assert.equal((await client.close).code, 1000);
  assert.deepEqual(client.messages.at(-1), { t: 'done', id: ready.plan.start.id, frames: 36 });
  assert.equal(f.state.chunks, 3); assert.equal(f.state.cancelled, 1);
  assert.deepEqual(f.failures, []);
});

test('a shared-room context is accepted without presentationVersion: rest-frame speech, no deal reservation', async t => {
  const f = await setup(t), room = Object.freeze({ operatorSlug: 'kasino', roomId: 'room-a', packageRevision: 2, dealerId: 'dragan' });
  const d = await f.runtime.forContext(room, undefined, 's-room').prepare({ ...f.input, context: undefined, owner: 'player-' + 'f'.repeat(64) });
  assert.equal(d.kind, 'moving-speech-stream'); assert.equal(Object.hasOwn(d, 'presentationVersion'), false);
  assert.ok(f.state.contexts.length > 0 && f.state.contexts.every(context => context === room), 'evidence is read with the room context');
  assert.equal(f.state.presentationReads ?? 0, 0, 'no solo deal plan is read');
  assert.doesNotThrow(() => f.runtime.normalPresentation(f.input.playerId, 7), 'no deal reservation was taken');
  assert.equal(f.admitted.ownerHash, digest('player-' + 'f'.repeat(64)));
  // A context naming another dealer never reaches voice, publication or admission.
  const other = await setup(t);
  await assert.rejects(other.runtime.forContext({ ...room, dealerId: 'paow' }, undefined, 's-room').prepare(other.input), error => error.code === 'moving_speech_input');
  assert.deepEqual(other.trace, []); assert.equal(other.state.reads, 0);
});

test('room answer (PR 4): with a warm admission TTS starts after submit, before worker ready; one dispatch feeds the asker and another listener alike', async t => {
  const f = await setup(t, { warm: true }), room = Object.freeze({ operatorSlug: 'kasino', roomId: 'room-a', packageRevision: 2, dealerId: 'dragan' });
  const service = f.runtime.forContext(room, undefined, 's-room', { room: true });
  const d = await service.prepare({ ...f.input, context: undefined });
  assert.deepEqual(f.trace.filter(x => ['admit', 'submit', 'tts', 'ready'].includes(x)).slice(0, 4), ['admit', 'submit', 'tts', 'ready']);
  await until(() => f.state.chunks === 3);
  assert.equal(f.state.dispatched, 1, 'the worker streams into the relay without waiting for a listener');
  const other = service.issue(d, { owner: 'other-owner', playerId: 'player-two' });
  assert.notEqual(other.ticket, d.ticket);
  for (const descriptor of [d, other]) assert.equal((await validateMovingSpeechStream(descriptor, { dealerId: 'dragan', requestId: f.input.requestId, exactText: f.input.text, now: f.state.now })).id, d.id);
  assert.equal((await f.connect(other).opened).status, 403, 'the asker\'s session cannot redeem another listener\'s ticket');
  const second = service.issue(d, { owner: 'other-owner', playerId: 'player-two' });
  const asker = f.connect(d), listener = f.connect(second, { headers: { cookie: 'owner=two' } });
  assert.equal((await asker.opened).status, 101); assert.equal((await listener.opened).status, 101);
  const rest = await fetch(f.base + `/api/moving-speech/${d.id}/rest`, { headers: { cookie: 'owner=two' } });
  assert.equal(rest.status, 200); assert.deepEqual(Buffer.from(await rest.arrayBuffer()), f.original);
  await until(() => asker.messages.length === 3 && listener.messages.length === 3);
  for (const client of [asker, listener]) client.send({ t: 'credit', id: client.messages[0].plan.start.id, frames: 36 });
  assert.equal((await asker.close).code, 1000); assert.equal((await listener.close).code, 1000);
  assert.deepEqual(listener.messages, asker.messages); assert.deepEqual(asker.messages.at(-1), { t: 'done', id: asker.messages[0].plan.start.id, frames: 36 });
  assert.equal(f.state.dispatched, 1); assert.equal(f.state.cancelled, 1, 'the GPU session is released once its output is buffered');
  // A refused admission still never starts TTS in a room.
  const refused = await setup(t, { onAdmit: () => { throw Error('generated_speech_total_budget_exhausted'); } });
  await assert.rejects(refused.runtime.forContext(room, undefined, 's-room', { room: true }).prepare({ ...refused.input, context: undefined }));
  assert.equal(refused.trace.includes('tts'), false);
});

test('maximum PCM prepares 600 frames; the next sample stops TTS consumption before render dispatch', async t => {
  const f = await setup(t, { pcm: Buffer.alloc(MOVING_SPEECH_MAX_PCM_BYTES, 1) });
  const descriptor = await f.prepare(), client = f.connect(descriptor);
  assert.equal((await client.opened).status, 101);
  await until(() => client.messages.length === 3);
  assert.equal(client.messages[0].plan.timeline.length, 600);
  assert.deepEqual(client.messages[2], f.pcm);
  client.socket.close(); await client.close;

  let consumed = 0;
  const tooLong = await setup(t, { pcmChunks: [Buffer.alloc(MOVING_SPEECH_MAX_PCM_BYTES), Buffer.alloc(2), Buffer.alloc(2)],
    onTtsChunk: () => consumed++ });
  await assert.rejects(tooLong.prepare(), /moving_speech_audio_limit/);
  assert.equal(consumed, 2, 'stop reading at the first overflowing sample');
  assert.equal(tooLong.state.dispatched, 0, 'no PCM/plan dispatched to GPU rendering');
  assert.equal(tooLong.state.cancelled, 1);
  assert.equal(tooLong.admitted.signal.aborted, true);
  assert.deepEqual(tooLong.preparationFailures, [{event:'moving_speech_preparation_failed',code:'moving_speech_audio_limit',
    phase:'voice',streamId:sessionId,requestId:tooLong.input.requestId}]);
});

test('server interruption receipts allow only known reasons and valid correlation fields', () => {
  const secret = 'https://user:secret@fixture.example/?token=secret&ticket=secret\nspoken private text';
  const base = {phase:'dispatch',streamId:sessionId,requestId:'request-1'};
  const expected = code => ({event:'moving_speech_stream_interrupted',code,...base});
  assert.deepEqual(movingSpeechFailureReceipt({...base,error:Object.assign(Error(secret),
    {code:'moving_worker_read_timeout',stack:secret,cause:{token:secret},ticket:secret})}),expected('moving_worker_read_timeout'));
  assert.deepEqual(movingSpeechFailureReceipt({...base,error:Error('moving_worker_incomplete_result')}),expected('moving_worker_incomplete_result'));
  assert.deepEqual(movingSpeechFailureReceipt({...base,error:new DOMException(secret,'AbortError')}),expected('moving_speech_cancelled'));
  let reads = 0;
  assert.deepEqual(movingSpeechFailureReceipt({...base,error:{get code(){return reads++ ? secret : 'moving_worker_read_timeout';}}}),expected('moving_worker_read_timeout'));
  for (const error of [Error(secret),{code:'moving_worker_read_timeout '+secret,message:secret},secret,null,
    {get code(){throw Error(secret);}}]) {
    assert.deepEqual(movingSpeechFailureReceipt({...base,error}),expected('moving_speech_unavailable'));
  }
  for (const invalid of [secret,'x'.repeat(129),sessionId+'\n',{},undefined]) {
    assert.deepEqual(movingSpeechFailureReceipt({error:Error(secret),phase:invalid,streamId:invalid,requestId:invalid}),
      {event:'moving_speech_stream_interrupted',code:'moving_speech_unavailable',phase:'unknown',streamId:null,requestId:null});
  }
});

test('partial stream failure logs the server cause once and preserves generic client error and cleanup', async t => {
  for (const known of [true,false]) {
    const f = await setup(t,{afterChunk:()=>{throw known ? Error('moving_worker_incomplete_result')
      : Object.assign(Error('private spoken text'),{code:'provider-secret',token:'secret',url:'https://private.example'});}});
    const d = await f.prepare(), client = f.connect(d); await client.opened;
    await until(()=>client.messages.length===3);
    client.send({t:'credit',id:client.messages[0].plan.start.id,frames:12}); await client.close;
    assert.equal(f.state.chunks,1); assert.equal(f.state.cancelled,1);
    assert.deepEqual(f.failures,[{event:'moving_speech_stream_interrupted',code:known?'moving_worker_incomplete_result':'moving_speech_unavailable',
      phase:'dispatch',streamId:d.id,requestId:f.input.requestId}]);
    assert.equal(client.messages.filter(m=>m.t==='lapp').length,1);
    assert.equal(client.messages.some(m=>m.t==='done'),false);
    assert.deepEqual(client.messages.at(-1),{t:'error',code:'moving_speech_unavailable'});
  }
});

test('invalid credit keeps its first reason through cancellation and failed cleanup', async t => {
  const f = await setup(t,{cancelFails:true}), d = await f.prepare(), client = f.connect(d); await client.opened;
  await until(()=>client.messages.length===3);
  client.send({t:'credit',id:client.messages[0].plan.start.id,frames:49}); await client.close;
  await until(()=>f.trace.includes('cleanup-recovery'));
  assert.deepEqual(f.failures,[{event:'moving_speech_stream_interrupted',code:'moving_speech_invalid_credit',
    phase:'client-message',streamId:d.id,requestId:f.input.requestId}]);
  assert.equal(f.state.cancelled,1); assert.equal(f.state.chunks,0);
});

test('dispatch retains its original failure when transport cleanup closes the browser before rethrowing', async t => {
  const f = await setup(t,{afterChunk:async()=>{
    await f.runtime.cancelOwner(f.input.owner);
    throw Error('moving_worker_read_timeout');
  }}), d = await f.prepare(), client = f.connect(d); await client.opened;
  await until(()=>client.messages.length===3);
  client.send({t:'credit',id:client.messages[0].plan.start.id,frames:12}); await client.close;
  await until(()=>f.failures.length===1);
  assert.deepEqual(f.failures,[{event:'moving_speech_stream_interrupted',code:'moving_worker_read_timeout',
    phase:'dispatch',streamId:d.id,requestId:f.input.requestId}]);
  assert.equal(f.state.cancelled,1); assert.equal(f.state.chunks,1);
});

test('throwing or rejecting diagnostic sinks cannot prevent the existing stream error and cancellation', async t => {
  for (const onStreamFailure of [()=>{throw Error('logger unavailable');},()=>Promise.reject(Error('logger unavailable'))]) {
    const f = await setup(t,{afterChunk:()=>{throw Error('moving_worker_read_timeout');},onStreamFailure});
    const d = await f.prepare(), client = f.connect(d); await client.opened;
    await until(()=>client.messages.length===3);
    client.send({t:'credit',id:client.messages[0].plan.start.id,frames:12}); await client.close;
    assert.equal(f.state.cancelled,1); assert.equal(f.failures.length,1);
    assert.deepEqual(client.messages.at(-1),{t:'error',code:'moving_speech_unavailable'});
  }
});
test('fresh opening binds exact box3 sequence once; short speech retains reservation until played ACK',async t=>{
  const f=await setup(t,{deal:true}),d=await f.prepare();
  assert.equal(d.presentationVersion,7);assert.throws(()=>f.runtime.normalPresentation(f.input.playerId,7),/reserved/);
  await assert.rejects(f.prepare({requestId:'replay'}),/not_available/);
  const client=f.connect(d);await client.opened;await until(()=>client.messages.length===3);
  const ready=client.messages[0];assert.equal(ready.sequence.frames.length,183);
  assert.equal(d.sequenceSha256,digest(JSON.stringify(ready.sequence)));
  assert.deepEqual(ready.sequence.steps.map(s=>s.video.filmedTake.takeKey),['4:i','dealer:base','4:base','hole:base']);
  assert.ok(ready.plan.timeline.every((r,k)=>r.take===ready.sequence.frames[k].take&&r.frame===k));
  client.send({t:'credit',id:ready.plan.start.id,frames:36});await until(()=>client.messages.some(m=>m.t==='done'));
  assert.equal(f.state.cancelled,0);assert.throws(()=>f.runtime.normalPresentation(f.input.playerId,7),/reserved/);
  client.send({t:'played',id:ready.plan.start.id});assert.equal((await client.close).code,1000);
  assert.equal(f.state.cancelled,1);await assert.rejects(f.prepare({requestId:'after-play'}),/not_available/);
});
test('normal playback, other player, changed round and publication revoke a moving reservation before further output',async t=>{
  for(const mode of ['normal','other','other-room','other-session','other-owner','changed-before','changed-tail','publication-tail']){
    const f=await setup(t,{deal:true});
    if(mode==='normal'){f.runtime.normalPresentation(f.input.playerId,7);await assert.rejects(f.prepare(),/not_available/);continue;}
    if(mode==='other'){await assert.rejects(f.prepare({playerId:'other'}),/not_available/);assert.equal(f.trace.includes('tts'),false);continue;}
    if(mode.startsWith('other-')){await assert.rejects(f.prepare(mode==='other-room'?{context:{...f.input.context,roomId:'two'}}:
      mode==='other-session'?{sessionRevision:'browser-2'}:{owner:'owner-two'}),/not_available/);assert.equal(f.trace.includes('tts'),false);continue;}
    const d=await f.prepare();
    if(mode==='changed-before'){f.state.receipt.version++;assert.equal((await f.connect(d).opened).status,403);continue;}
    const client=f.connect(d);await client.opened;await until(()=>client.messages.length===3);
    client.send({t:'credit',id:client.messages[0].plan.start.id,frames:36});await until(()=>client.messages.some(m=>m.t==='done'));
    if(mode==='changed-tail')f.state.receipt.version++;else f.state.projectRevision++;
    await client.close;assert.equal(f.state.cancelled,1);
  }
});

test('committed deal changes during freshness reads stop admission, audio and subsequent frames',async t=>{
  for(const boundary of ['onPresentation','onEvidence'])for(const phase of ['admission','audio','frames']){
    await t.test(boundary+' before '+phase,async t=>{
      let armed=false,entered=false,remaining=phase==='audio'?2:1;
      const barrier=Promise.withResolvers();
      t.after(()=>barrier.resolve());
      const f=await setup(t,{deal:true,[boundary]:async()=>{
        if(armed&&--remaining===0){entered=true;await barrier.promise;}
      }}),d=await f.prepare();
      if(phase!=='frames')armed=true;
      const client=f.connect(d);
      if(phase==='frames'){
        assert.equal((await client.opened).status,101);
        await until(()=>client.messages.length===3);
        armed=true;client.send({t:'credit',id:client.messages[0].plan.start.id,frames:12});
      }
      await until(()=>entered);
      f.state.receipt={...f.state.receipt,version:8};
      f.runtime.observeCommitted({playerId:f.input.playerId,command:{op:'hit',dealer:'dragan'},view:{version:8},
        session:{movingSpeech:{ownerHash:digest(f.input.owner),context:f.input.context,sessionRevision:f.input.sessionRevision}}});
      barrier.resolve();
      if(phase==='admission')assert.equal((await client.opened).status,403);
      else{
        await until(()=>f.state.cancelled>0||client.messages.some(m=>m.t==='lapp')||(phase==='audio'&&client.messages.some(m=>m.t==='pcm')));
        assert.equal(client.messages.filter(Buffer.isBuffer).length,phase==='frames'?1:0);
        assert.equal(client.messages.some(m=>m.t==='lapp'||m.t==='done'),false);
        if(phase==='audio')assert.equal(client.messages.some(m=>m.t==='ready'||m.t==='pcm'),false);
      }
      await until(()=>f.state.cancelled===1);
      assert.equal(f.state.chunks,0);
      assert.equal(f.admitted.signal.aborted,true);
    });
  }
});

test('new committed deal aborts a waiting worker immediately without another chunk',async t=>{
  let waiting=false;
  const f=await setup(t,{deal:true,afterChunk:async(_state,signal)=>{
    waiting=true;
    await new Promise(resolve=>{
      signal.addEventListener('abort',resolve,{once:true});
      if(signal.aborted)resolve();
    });
  }}),d=await f.prepare(),client=f.connect(d);
  assert.equal((await client.opened).status,101);
  await until(()=>client.messages.length===3);
  client.send({t:'credit',id:client.messages[0].plan.start.id,frames:12});
  await until(()=>waiting&&client.messages.some(m=>m.t==='lapp'));
  const commit=(playerId,version)=>f.runtime.observeCommitted({playerId,command:{op:'hit',dealer:'dragan'},view:{version},
    session:{movingSpeech:{ownerHash:digest(f.input.owner),context:f.input.context,sessionRevision:f.input.sessionRevision}}});
  commit('other-player',8);commit(f.input.playerId,7);
  await Promise.resolve();
  assert.equal(f.admitted.signal.aborted,false);
  assert.equal(f.state.cancelled,0);
  f.state.receipt={...f.state.receipt,version:8};
  commit(f.input.playerId,8);
  await Promise.resolve();
  assert.equal(f.admitted.signal.aborted,true);
  assert.equal(f.state.cancelled,1);
  await client.close;
  assert.equal(f.state.chunks,1);
  assert.equal(client.messages.filter(m=>m.t==='lapp').length,1);
  assert.equal(client.messages.some(m=>m.t==='done'),false);
});

test('current owner is required for both rest HTTP and single-use WebSocket ticket, without dispatch', async t => {
  const f = await setup(t), d = await f.prepare();
  for (const path of [`/api/moving-speech/${d.id}/rest`, `/api/moving-speech/${d.id}/rest?other=1`]) {
    const response = await fetch(f.base + path, { headers: { cookie: 'owner=other' } }); assert.equal(response.status, 403);
  }
  const bad = f.connect(d, { headers: { cookie: 'owner=other' } }); assert.equal((await bad.opened).status, 403);
  const retry = f.connect(d); assert.equal((await retry.opened).status, 403); assert.equal(f.state.dispatched, 0);
});

test('wrong origin, substituted signature, protocol and expired ticket fail before dispatch', async t => {
  for (const change of [
    (f, d) => [d, { headers: { origin: 'https://other.example' } }],
    (f, d) => [{ ...d, ticket: d.ticket.slice(0, -1) + (d.ticket.endsWith('a') ? 'b' : 'a') }, {}],
    (f, d) => [d, { protocols: ['astrid-v2', `ticket.${d.ticket}`] }],
    (f, d) => { f.state.now = d.expiresAt + 1; return [d, {}]; },
  ]) {
    const f = await setup(t), d = await f.prepare(); const [descriptor, overrides] = change(f, d);
    const client = f.connect(descriptor, overrides); assert.equal((await client.opened).status, 403); assert.equal(f.state.dispatched, 0);
  }
});

test('a replay is rejected while the first socket owns the prepared session', async t => {
  const f = await setup(t), d = await f.prepare(), first = f.connect(d); assert.equal((await first.opened).status, 101);
  const again = f.connect(d); assert.equal((await again.opened).status, 403);
  first.send({ t: 'abort', id: d.id }); await first.close; await until(() => f.state.cancelled === 1);
  assert.equal(f.state.chunks, 0);
});

test('failed ready/profile/publication checks never start TTS and cancel admitted work', async t => {
  for (const onReady of [() => { throw Error('bank_unverified'); }, state => { state.profileChanged = true; }, state => { state.projectRevision++; }]) {
    const f = await setup(t, { onReady }); await assert.rejects(f.prepare(), /bank_unverified|profile_changed|context_changed/);
    assert.equal(f.trace.includes('tts'), false); assert.equal(f.state.cancelled, 1);
  }
});

test('profile/publication change while waiting for credit prevents the next patch and cancels the worker', async t => {
  for (const change of [state => state.profileChanged = true, state => state.projectRevision++]) {
    const f = await setup(t), d = await f.prepare(), client = f.connect(d); await client.opened; await until(() => client.messages.length === 3);
    change(f.state); client.send({ t: 'credit', id: client.messages[0].plan.start.id, frames: 12 }); await client.close;
    assert.equal(f.state.chunks, 0); assert.equal(f.state.cancelled, 1); assert.equal(client.messages.some(m => m.t === 'done'), false);
    assert.deepEqual(f.failures,[{event:'moving_speech_stream_interrupted',code:f.state.profileChanged?'generated_speech_profile_changed':'moving_speech_context_changed',
      phase:'chunk-current',streamId:d.id,requestId:f.input.requestId}]);
  }
});

test('profile/publication revocation at browser admission immediately cancels the already admitted worker', async t => {
  for (const change of [state => state.profileChanged = true, state => state.projectRevision++]) {
    const f = await setup(t), d = await f.prepare(); change(f.state);
    const client = f.connect(d); assert.equal((await client.opened).status, 403);
    assert.equal(f.state.dispatched, 0); assert.equal(f.state.cancelled, 1);
  }
});

test('a confirmed publication revocation while fetching the owned rest also cancels admitted work', async t => {
  const f = await setup(t), d = await f.prepare(); f.state.projectRevision++;
  const response = await fetch(f.base + `/api/moving-speech/${d.id}/rest`, { headers: { cookie: 'owner=one' } });
  assert.equal(response.status, 403); assert.equal(f.state.cancelled, 1);
});

test('oversized credit, wrong plan and explicit abort stop the session without another chunk', async t => {
  for (const make of [ready => ({ t: 'credit', id: ready.plan.start.id, frames: 49 }),
    () => ({ t: 'credit', id: 'wrong-plan', frames: 12 }), () => ({ t: 'abort', id: sessionId })]) {
    const f = await setup(t), d = await f.prepare(), client = f.connect(d); await client.opened; await until(() => client.messages.length === 3);
    client.send(make(client.messages[0])); await client.close; assert.equal(f.state.cancelled, 1); assert.equal(f.state.chunks, 0);
  }
});

test('owner cancellation invalidates unused descriptors and cannot affect another owner', async t => {
  const f = await setup(t), d = await f.prepare(); await f.runtime.cancelOwner('unrelated'); assert.equal(f.state.cancelled, 0);
  await f.runtime.cancelOwner('owner-one'); assert.equal(f.state.cancelled, 1);
  assert.equal((await f.connect(d).opened).status, 403);
});

test('failed cancellation on disconnect or ticket expiry is contained and requires durable recovery', async t => {
  for (const expiry of [false,true]) {
    const f=await setup(t,{cancelFails:true,connectionMs:expiry?20:15000}),d=await f.prepare();
    if(!expiry){const client=f.connect(d);await client.opened;await until(()=>client.messages.length===3);client.socket.terminate();}
    await until(()=>f.trace.includes('cleanup-recovery'));
    assert.equal(f.state.cancelled,1); assert.equal(f.state.chunks,0);
    assert.equal((await f.connect(d).opened).status,403);
    const rest=await fetch(f.base+`/api/moving-speech/${d.id}/rest`,{headers:{cookie:'owner=one'}});
    assert.equal(rest.status,403);
  }
});


test('296 second cold wait generates no TTS; bank transfer remains bound to the session abort',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000000});
  let attest;const attestation=new Promise(resolve=>attest=resolve);
  const f=await setup(t,{onReady:()=>attestation,bankRead:async record=>new Response(new Uint8Array(record.size),
    {headers:{'content-length':String(record.size)}})});
  const prepared=f.prepare();
  for(let i=0;i<100&&!f.trace.includes('ready');i++)await new Promise(setImmediate);
  assert.ok(f.trace.includes('ready'));const session=new AbortController();
  const bank=await f.admitted.bankDownload({sessionSignal:session.signal,ttlMs:480000});
  t.mock.timers.tick(296000);f.state.now+=296000;assert.equal(f.trace.includes('tts'),false);
  const local=path=>f.base+new URL(path).pathname;
  const late=await fetch(local(bank.archive.url));assert.equal(late.status,200);await late.arrayBuffer();
  session.abort();assert.equal((await fetch(local(bank.receipt.url))).status,403);
  attest();await prepared;assert.equal(f.trace.filter(x=>x==='tts').length,1);
});

test('owner abort during cold wait prevents late attestation from starting paid voice',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000000});
  let attest;const attestation=new Promise(resolve=>attest=resolve),abort=new AbortController();
  const f=await setup(t,{onReady:()=>attestation});const prepared=f.prepare({signal:abort.signal});
  const rejected=assert.rejects(prepared,/abort|cancel/i);
  for(let i=0;i<100&&!f.trace.includes('ready');i++)await new Promise(setImmediate);
  t.mock.timers.tick(296000);abort.abort();attest();await rejected;
  assert.equal(f.trace.includes('tts'),false);assert.ok(f.state.cancelled>0);
});

test('Off gates ordinary moving preparation before voice, and cancelActive preserves the service for later Saving',async t=>{
  let enabled=false,checks=0;
  const f=await setup(t,{admissionCheck:async()=>{checks++;if(!enabled)throw Error('drift_not_admitting');}});
  await assert.rejects(f.prepare(),/drift_not_admitting/);
  assert.equal(f.trace.includes('voice-prepared'),false);assert.equal(f.trace.includes('admit'),false);
  enabled=true;
  const first=await f.prepare();
  await f.runtime.cancelActive();assert.equal(f.state.cancelled,1);
  const old=f.connect(first);assert.equal((await old.opened).status,403);
  // This fixture deliberately has a fixed session ID; real sessions use fresh
  // random IDs. Verify revocation before creating the next fixture descriptor.
  await f.prepare({requestId:'request-2'});
  assert.equal(checks,3);assert.equal(f.state.cancelled,1);
});

test('beforeCostly uses the pinned session check before voice source after a late Off',async t=>{
  let valid=true;
  const f=await setup(t,{onReady:()=>{valid=false;},
    assertSessionCurrent:async()=>{if(!valid)throw Error('drift_not_admitting');}});
  await assert.rejects(f.prepare(),/drift_not_admitting/);
  assert.equal(f.trace.includes('tts'),false);assert.equal(f.state.cancelled,1);
});

test('product freshness inside submit does not reenter the ordinary reserved/running session check',async t=>{
  let checks=0;
  const f=await setup(t,{assertSessionCurrent:async state=>{
    assert.equal(state.submitting,false);checks++;
  }});
  await f.prepare();assert.ok(checks>0);assert.ok(f.trace.includes('submit'));assert.ok(f.trace.includes('tts'));
});

test('ordinary preparation retains its first admission token across slow profile preparation',async t=>{
  const admission=Object.freeze({revision:1,operationId:'original-op'});let revision=1,pins=0;
  const f=await setup(t,{admissionCheck:async()=>{pins++;return admission;},
    onPrepare:async()=>{revision=3;},
    onAdmit:async args=>{
      assert.equal(revision,3);assert.equal(args.driftAdmission,admission);
      throw Error('drift_not_admitting');
    }});
  await assert.rejects(f.prepare(),/drift_not_admitting/);
  assert.equal(pins,1);assert.equal(f.trace.includes('submit'),false);assert.equal(f.trace.includes('tts'),false);
});

test('private bank read keeps the pinned SQL fence while permitting submission_started before attach COMMIT',async t=>{
  let finish;const ready=new Promise(resolve=>finish=resolve);let allowed=true,checks=0;
  const f=await setup(t,{onReady:()=>ready,
    bankRead:async record=>new Response(new Uint8Array(record.size),{headers:{'content-length':String(record.size)}}),
    assertSessionCurrent:async(_state,options)=>{
      checks++;assert.equal(options.submissionPhase,true);
      if(!allowed)throw Error('drift_not_admitting');
    }});
  t.after(()=>finish());
  const prepared=f.prepare();prepared.catch(()=>{});
  await until(()=>f.trace.includes('ready'));
  const session=new AbortController();
  const bank=await f.admitted.bankDownload({sessionSignal:session.signal,ttlMs:1000});
  const local=path=>f.base+new URL(path).pathname;
  const archive=await fetch(local(bank.archive.url));assert.equal(archive.status,200);await archive.arrayBuffer();
  allowed=false;
  assert.equal((await fetch(local(bank.receipt.url))).status,403);assert.ok(checks>=2);
  await f.runtime.cancelActive();finish();await assert.rejects(prepared);
});

test('two dealers are two lanes: each attempt uses only its own bank, sessions, drift admission and bank capability', async t => {
  const { request: get } = await import('node:http');
  const lane = (dealerId, videoId) => {
    const original = Buffer.from('synthetic-original-' + dealerId), archive = Buffer.from('bank-' + dealerId);
    const artifact = (extension, type, bytes) => ({ provider: 'vercel-blob', contentType: type, size: bytes.length, sha256: digest(bytes),
      pathname: `croupier/media/dealers/${dealerId}/runtime/moving-bank/${videoId}/${digest(bytes)}.${extension}` });
    const sourceSet = createMovingSpeechSourceSet({ dealerId, clips: [{ videoId, sha256: digest(original), bytes: original.length,
      fps: 24, frameCount: 24, width: 1080, height: 1920 }], rest: { videoId, frame: 3 } });
    const bank = { schemaVersion: 1, sourceSet, archive: artifact('bin', 'application/octet-stream', archive),
      receipt: artifact('json', 'application/json', Buffer.from('{}')) };
    const video = { id: videoId, dealer: dealerId, sha256: digest(original), bytes: original.length, available: true,
      storage: 'private-blob', contentType: 'video/mp4', classification: { dealerId, kind: 'idle' } };
    const seen = { admitted: [], admissions: 0, cancelled: 0 };
    const sessions = { async admit(args) {
      seen.admitted.push(args);
      if (args.requestId.startsWith('hold')) await new Promise((_, reject) => args.signal.addEventListener('abort', () => reject(Error('moving_speech_cancelled')), { once: true }));
      seen.descriptor = await args.bankDownload({ sessionSignal: new AbortController().signal, ttlMs: 5000 });
      seen.fetched = await seen.fetch(new URL(seen.descriptor.archive.url).pathname);
      throw Error('fixture_stop_after_admission');
    } };
    return { dealerId, bank, archive, video, seen, sessions, admissionCheck: async () => { seen.admissions++; return { dealerId }; } };
  };
  const dragan = lane('dragan', '11111111-1111-4111-8111-111111111111'), paow = lane('paow', '22222222-2222-4222-8222-222222222222');
  const lanes = [dragan, paow], byDealer = id => lanes.find(entry => entry.dealerId === id);
  const evidenceFor = bank => ({ projectRevision: 1, mediaReferences: [{ id: bank.sourceSet.rest.videoId, sha256: bank.sourceSet.clips[0].sha256 }],
    frozenContext: { schemaVersion: 3, dealer: { id: bank.sourceSet.dealerId }, records: [] } });
  const evidenceBanks = [], reads = [];
  let runtime;
  const server = createServer(async (req, res) => { if (!await runtime.handleHttp(req, res)) { res.writeHead(404); res.end(); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const fetchPath = path => new Promise((resolve, reject) => get({ host: '127.0.0.1', port: server.address().port, path }, res => {
    const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
  }).on('error', reject).end());
  for (const entry of lanes) entry.seen.fetch = fetchPath;
  const options = { server, origin, releaseSha256: h, ticketSecret: 'fixture-only'.repeat(4),
    lanes: lanes.map(({ bank, sessions, admissionCheck }) => ({ bank, sessions, admissionCheck })),
    resolveOwner: async () => 'owner-one', readRegistry: async () => ({ videos: lanes.map(entry => entry.video) }),
    readEvidence: async (_context, mediaId, bank) => { evidenceBanks.push([mediaId, bank.sourceSet.dealerId]); return evidenceFor(bank); },
    readRest: async () => new Response(null, { status: 404 }), onPreparationFailure: () => {},
    bankRead: async record => { reads.push(record.pathname); const owner = lanes.find(entry => entry.bank.archive.pathname === record.pathname);
      return new Response(owner.archive, { headers: { 'content-length': String(owner.archive.length) } }); },
    dealerRuntime: { async prepareMoving(input) {
      assert.equal(input.sourceSet, byDealer(input.dealerId).bank.sourceSet);
      return { profileRevision: h, compositing: null, async assertFresh() {}, async *source() {} };
    } } };
  for (const invalid of [[], [options.lanes[0], options.lanes[0]], Array(9).fill(options.lanes[0]), [{ ...options.lanes[0], sessions: {} }]])
    assert.throws(() => createMovingSpeechRuntime({ ...options, lanes: invalid }), /moving_speech_configuration/);
  runtime = createMovingSpeechRuntime(options);
  t.after(async () => { await runtime.close(); await new Promise(resolve => server.close(resolve)); });
  assert.equal(runtime.supports('dragan'), true); assert.equal(runtime.supports('paow'), true);
  for (const unknown of ['astrid', undefined, '__proto__', 'constructor']) assert.equal(runtime.supports(unknown), false);
  const input = dealerId => ({ owner: 'owner-one', playerId: 'player-one', requestId: 'request-' + dealerId, dealerId, text: 'Hej.',
    context: { dealerId }, beforeCostly: async () => {} });
  await assert.rejects(runtime.prepare(input('astrid')), error => error.code === 'moving_speech_dealer_unavailable');
  await assert.rejects(runtime.prepare(input('paow')), /fixture_stop_after_admission/);
  assert.equal(paow.seen.admissions, 1); assert.equal(dragan.seen.admissions, 0); assert.equal(dragan.seen.admitted.length, 0);
  const [admitted] = paow.seen.admitted;
  assert.equal(admitted.binding.dealerId, 'paow'); assert.equal(admitted.binding.avatarSha256, paow.bank.archive.sha256);
  assert.equal(admitted.binding.bankReceiptSha256, paow.bank.receipt.sha256); assert.equal(admitted.binding.workerAvatar, 'paow');
  assert.equal(admitted.binding.releaseSha256, h); assert.deepEqual(admitted.driftAdmission, { dealerId: 'paow' });
  assert.deepEqual(evidenceBanks.map(([, dealerId]) => dealerId), ['paow', 'paow']);
  // The worker's bank capability resolves to Paow's archive and nothing else.
  assert.equal(paow.seen.descriptor.archive.sha256, paow.bank.archive.sha256);
  assert.equal(paow.seen.fetched.status, 200); assert.deepEqual(paow.seen.fetched.body, paow.archive);
  assert.deepEqual(reads, [paow.bank.archive.pathname]);
  assert.equal((await fetchPath('/api/moving-speech/bank/' + 'f'.repeat(64) + '/archive')).status, 403);
  await assert.rejects(runtime.prepare(input('dragan')), /fixture_stop_after_admission/);
  assert.equal(dragan.seen.admitted[0].binding.avatarSha256, dragan.bank.archive.sha256); assert.equal(dragan.seen.fetched.status, 200);
  assert.deepEqual(dragan.seen.fetched.body, dragan.archive);
  // One dealer's drift Off cancels only that dealer's attempts.
  const held = runtime.prepare({ ...input('paow'), requestId: 'hold-paow' });
  await until(() => paow.seen.admitted.length === 2);
  await runtime.cancelDealer('dragan'); await pause(10);
  assert.equal(paow.seen.admitted[1].signal.aborted, false);
  await runtime.cancelDealer('paow');
  await assert.rejects(held, /moving_speech_cancelled/);
});

// Rättelser efter oberoende granskning (PR 4a).
const room4 = Object.freeze({ operatorSlug: 'kasino', roomId: 'room-a', packageRevision: 2, dealerId: 'dragan' });
const roomPrepare = (f, overrides = {}) => f.runtime.forContext(room4, undefined, 's-room', { room: true }).prepare({ ...f.input, context: undefined, ...overrides });

test('room: 296 s cold wait generates no TTS; voice starts after ready as in solo, and a warm TTS failure never meets a running submit', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000000 });
  let attest; const attestation = new Promise(resolve => attest = resolve), abort = new AbortController();
  const f = await setup(t, { onReady: () => attestation });
  const rejected = assert.rejects(roomPrepare(f, { signal: abort.signal }), /abort|cancel/i);
  for (let i = 0; i < 100 && !f.trace.includes('ready'); i++) await new Promise(setImmediate);
  assert.ok(f.trace.includes('ready'));
  t.mock.timers.tick(296000); assert.equal(f.trace.includes('tts'), false, 'cold admission: no voice during the cold start');
  abort.abort(); attest(); await rejected;
  assert.equal(f.trace.includes('tts'), false); assert.ok(f.state.cancelled > 0);
  t.mock.timers.reset();
  // Cold but completed: TTS after ready, exactly like solo.
  const cold = await setup(t); await roomPrepare(cold);
  assert.deepEqual(cold.trace.filter(x => ['submit', 'ready', 'tts'].includes(x)).slice(0, 3), ['submit', 'ready', 'tts']);
  // Warm: a TTS failure starts only after submit has finished and keeps its own code.
  const error = Object.assign(Error('private'), { code: 'generated_speech_voice_unavailable' });
  const warm = await setup(t, { warm: true, onTts: state => { assert.equal(state.submitting, false); throw error; } });
  await assert.rejects(roomPrepare(warm), actual => actual === error);
  assert.deepEqual(warm.trace.filter(x => ['submit', 'tts'].includes(x)), ['submit', 'tts']);
  assert.equal(warm.preparationFailures[0].phase, 'voice'); assert.equal(warm.state.dispatched, 0);
});

test('room: the asker going stale or their request ending after chunk 1 does not end the answer for the table', async t => {
  let stale = false; const asker = new AbortController();
  const f = await setup(t, { beforeCostly: () => { if (stale) throw Error('stale_round_revision'); },
    afterChunk: async state => { if (state.chunks === 1) { stale = true; asker.abort(); } } });
  const service = f.runtime.forContext(room4, undefined, 's-room', { room: true });
  const d = await service.prepare({ ...f.input, context: undefined, signal: asker.signal });
  await until(() => f.state.cancelled === 1);
  assert.equal(f.state.chunks, 3, 'the worker finished the answer'); assert.deepEqual(f.failures, []);
  const other = service.issue(d, { owner: 'other-owner', playerId: 'player-two' });
  const bob = f.connect(other, { headers: { cookie: 'owner=two' } }); assert.equal((await bob.opened).status, 101);
  await until(() => bob.messages.length === 3); bob.send({ t: 'credit', id: bob.messages[0].plan.start.id, frames: 36 });
  assert.equal((await bob.close).code, 1000); assert.deepEqual(bob.messages.at(-1), { t: 'done', id: bob.messages[0].plan.start.id, frames: 36 });
  assert.equal((await f.connect(d).opened).status, 403, 'the stale asker\'s own ticket is checked with the asker\'s freshness');
});

test('room: nobody listening and no ticket left stops the GPU at the next chunk', async t => {
  const f = await setup(t, { afterChunk: async state => { if (state.chunks === 1) state.now += 16000; } });
  await roomPrepare(f);
  await until(() => f.state.cancelled === 1);
  assert.equal(f.state.chunks, 1, 'no chunk after the asker\'s ticket expired unredeemed');
  assert.equal(f.failures[0].code, 'moving_speech_no_listeners');
});

test('room: a publication change after chunk 1 stops the answer for every listener', async t => {
  const f = await setup(t, { afterChunk: async state => { if (state.chunks === 1) state.projectRevision = 2; } });
  const d = await roomPrepare(f);
  await until(() => f.state.cancelled === 1);
  assert.equal(f.state.chunks, 1); assert.equal(f.failures[0].code, 'moving_speech_context_changed');
  assert.equal((await f.connect(d).opened).status, 403, 'the failed buffer is gone');
});

test('room: cancelDealer, cancelOwner, cancelPlayer and close end a finished answer\'s connected listeners', async t => {
  for (const stop of [r => r.cancelDealer('dragan'), r => r.cancelOwner('owner-one'), r => r.cancelPlayer('player-one'), r => r.close()]) {
    const f = await setup(t), d = await roomPrepare(f);
    await until(() => f.state.cancelled === 1 && f.state.chunks === 3);
    const client = f.connect(d); assert.equal((await client.opened).status, 101);
    await until(() => client.messages.length === 3);
    await stop(f.runtime);
    const closed = await Promise.race([client.close, pause(1000).then(() => 'still open')]);
    assert.notEqual(closed, 'still open', String(stop)); assert.notEqual(closed.code, 1000, String(stop));
    assert.equal(client.messages.some(m => m.t === 'done'), false);
  }
});

test('room: issue needs the answer\'s own attempt and nonce', async t => {
  const f = await setup(t), service = f.runtime.forContext(room4, undefined, 's-room', { room: true });
  const d = await service.prepare({ ...f.input, context: undefined }), bob = { owner: 'other-owner', playerId: 'player-two' };
  assert.equal(service.issue({ ...d, nonce: '3'.repeat(64) }, bob), null);
  assert.equal(service.issue({ ...d, attemptId: 'attempt-0' }, bob), null);
  assert.ok(service.issue(d, bob));
});
