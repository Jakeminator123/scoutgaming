import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { setTimeout as pause } from 'node:timers/promises';
import { createMovingSpeechRuntime } from '../web/moving-speech-runtime.mjs';
import { createMovingSpeechSourceSet } from '../web/moving-speech-bank.mjs';
import { validateMovingSpeechStream } from '../web/public/moving-speech-player.mjs';

const { WebSocket } = createRequire(new URL('../services/astrid-gpu-worker/gateway/package.json', import.meta.url))('ws');
const digest = bytes => createHash('sha256').update(bytes).digest('hex'), h = 'a'.repeat(64), sessionId = '1'.repeat(32);
const videoId = '11111111-1111-1111-1111-111111111111', origin = 'https://fixture.example';
const record = (extension, type, bytes) => ({ provider: 'vercel-blob',
  pathname: `croupier/media/dealers/dragan/runtime/moving-bank/${videoId}/${digest(bytes)}.${extension}`,
  contentType: type, size: bytes.length, sha256: digest(bytes) });
async function until(check) { for (let i = 0; i < 100; i++) { if (check()) return; await pause(5); } assert.fail('runtime fixture did not settle'); }

async function setup(t, options = {}) {
  const original = Buffer.from('synthetic-original'), pcm = Buffer.alloc(36000, 1), trace = [], sockets = [];
  const sourceSet = createMovingSpeechSourceSet({ dealerId: 'dragan', clips: [{ videoId, sha256: digest(original), bytes: original.length,
    fps: 24, frameCount: 24, width: 1080, height: 1920 }], rest: { videoId, frame: 7 } });
  const bank = { schemaVersion: 1, sourceSet, archive: record('bin', 'application/octet-stream', Buffer.from('bank')),
    receipt: record('json', 'application/json', Buffer.from('{}')) };
  const registry = { videos: [{ id: videoId, dealer: 'dragan', sha256: digest(original), bytes: original.length,
    available: true, storage: 'private-blob', contentType: 'video/mp4', classification: { dealerId: 'dragan', kind: 'idle' } }] };
  const state = { projectRevision: 1, profileChanged: false, now: Date.now(), cancelled: 0, dispatched: 0, reads: 0, chunks: 0 };
  const evidence = () => ({ projectRevision: state.projectRevision, mediaReferences: [{ id: videoId, sha256: digest(original) }],
    frozenContext: { schemaVersion: 3, context: { dealerId: 'dragan' }, dealer: { id: 'dragan' }, records: [{ id: videoId,
      sha256: digest(original), size: original.length, contentType: 'video/mp4', classification: { dealerId: 'dragan', kind: 'idle' } }] } });
  let runtime, admitted;
  const server = createServer(async (req, res) => { if (!await runtime.handleHttp(req, res)) { res.writeHead(404); res.end(); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`, address = base.replace('http:', 'ws:') + '/moving-speech-stream';
  runtime = createMovingSpeechRuntime({ server, origin, bank, releaseSha256: h, ticketSecret: 'fixture-only'.repeat(4), now: () => state.now,
    connectionMs: options.connectionMs ?? 15000, onCleanupError:()=>trace.push('cleanup-recovery'),
    resolveOwner: async req => req.headers.cookie === 'owner=one' ? 'owner-one' : 'other-owner',
    readEvidence: async () => { state.reads++; return evidence(); }, readRegistry: async () => registry,
    readRest: async () => new Response(original, { headers: { 'content-type': 'video/mp4', 'content-length': String(original.length), 'cache-control': 'private, no-store' } }),
    bankRead: async () => assert.fail('runtime fixture must never download bank bytes'),
    dealerRuntime: { async prepareMoving(input) {
      assert.equal(input.dealerId,'dragan'); assert.deepEqual(input.sourceSet,sourceSet);
      trace.push('voice-prepared'); return { profileRevision: h, compositing: null,
        async assertFresh() { if (state.profileChanged) throw Error('profile_changed'); },
        async *source({ beforeCostly, signal }) { trace.push('tts'); await beforeCostly(); signal.throwIfAborted();
          await options.onTts?.(state); yield pcm; },
      };
    } },
    sessions: { async admit(args) {
      trace.push('admit'); admitted = args; await args.beforeCostly();
      const binding = { ...args.binding, schemaVersion: 1, sessionId, attemptId: 'attempt-1', nonce: '2'.repeat(64) };
      return { sessionId, binding, async submit() { trace.push('submit'); await args.beforeCostly(); },
        async ready() { trace.push('ready'); await options.onReady?.(state); }, handleUpgrade() { return false; },
        async cancel() { trace.push('cancel'); state.cancelled++; if(options.cancelFails)throw Error('journal_unavailable'); },
        async dispatch(input, { onChunk }) {
          state.dispatched++; trace.push('dispatch');
          for (let from = 0; from < input.plan.timeline.length; from += 12) {
            const n = Math.min(12, input.plan.timeline.length - from);
            await onChunk({ t: 'lapp', id: input.plan.start.id, del: from / 12, fran: from,
              rutor: Array.from({ length: n }, () => ({ tagning: 'vila', ruta: 0, rect: [1, 2, 30, 40] })) }, Buffer.from([n, 0, 1, 9]));
            state.chunks++;
          }
        },
      };
    } },
  });
  t.after(async () => { for (const socket of sockets) socket.terminate(); await runtime.close(); await new Promise(resolve => server.close(resolve)); });
  const input = { owner: 'owner-one', playerId: 'player-one', requestId: 'request-1', dealerId: 'dragan', text: 'Hej Jakob.',
    context: { dealerId: 'dragan' }, beforeCostly: async () => { trace.push('guard'); await options.beforeCostly?.(state); } };
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
  return { runtime, state, input, trace, original, pcm, registry, base, address, sourceSet, connect,
    prepare: overrides => runtime.prepare({ ...input, ...overrides }), get admitted() { return admitted; } };
}

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
