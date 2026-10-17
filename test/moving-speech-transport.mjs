import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { prepareMovingSpeechPcmInput } from '../web/moving-speech-pcm.mjs';
import { createMovingSpeechTransport, verifyMovingWorkerRelease } from '../web/moving-speech-transport.mjs';
import { createMovingSpeechFrameLayer } from '../web/public/moving-speech-frame-layer.mjs';
const { WebSocket } = createRequire(new URL('../services/astrid-gpu-worker/gateway/package.json', import.meta.url))('ws');
const hash = s => createHash('sha256').update(s).digest('hex');
const image = `ghcr.io/emacodehero/croupier-lipsync-worker:${hash('synthetic worker release').slice(0, 40)}`;
const receipt = () => ({ expectedImage: image, endpoint: { id: 'fixtureendpoint', image }, observedAtMs: Date.now(),
  workers: { endpointVersion: 13, workers: [{ image, version: 13, isStale: false }] } });
const ownedReceipt = () => {
  const r = receipt(), image = `ghcr.io/jakeminator123/moving-gpu-worker@sha256:${hash('owned image')}`;
  r.expectedImage = r.endpoint.image = r.workers.workers[0].image = image;
  return r;
};
const ownedBinding = input => ({ schemaVersion: 1, releaseSha256: hash('owned source release'),
  dealerId: input.plan.binding.dealerId, workerAvatar: input.plan.binding.workerAvatar,
  profileRevision: input.plan.binding.profileRevision, sourceSetSha256: hash('sources'),
  avatarSha256: input.plan.binding.avatarSha256, bankReceiptSha256: hash('bank receipt'),
  sessionId: input.plan.binding.sessionId, attemptId: 'attempt-1', nonce: hash('private fresh fixture nonce') });
const ownedHello = (binding, jobId = 'accepted-fixture-job') => ({ fps: 24, pad_after_s: .53,
  attestation: { ...binding, jobId } });
function inputFor(dealerId = 'paow', workerAvatar = dealerId, revision = 1, frameCount = 30, pcmBytes = 48000) {
  const pcm = Buffer.alloc(pcmBytes, revision);
  return prepareMovingSpeechPcmInput({
    binding: { dealerId, workerAvatar, sessionId: 'session-1', talkId: 'talk-1', revision,
      profileRevision: hash('profile'), textSha256: hash('text'), audioSha256: hash(pcm), avatarSha256: hash('bank') },
    clips: [{ dealerId, take: 'pos1', sha256: hash('source'), fps: 24, frameCount, kind: 'video' }],
    frames: Array.from({ length: frameCount }, (_, frame) => ({ take: 'pos1', frame })),
    audio: { pcm, sampleRate: 24000, channels: 1, format: 's16le' },
  });
}
const metadata = (input, fran = 0, n = 12, del = fran / 12) => ({ t: 'lapp', id: input.plan.start.id, del, fran,
  till: fran + n, rutor: Array.from({ length: n }, (_, i) => ({ tagning: 'pos1', ruta: fran + i, rect: [10, 20, 40, 60] })) });
const done = input => JSON.stringify({ t: 'done', id: input.plan.start.id });
async function setup(t, options = {}) {
  const input = options.input || inputFor(), finished = [], chunks = [], incoming = [];
  const owner = { userId: 'user-1', sessionId: 'session-1', endpointId: 'fixtureendpoint', jobId: 'accepted-fixture-job', release: options.release || receipt() };
  const transport = await createMovingSpeechTransport({ input, origin: 'https://own-game.example', release: options.release || receipt(),
    attestationBinding: options.attestationBinding,
    startupMs: options.startupMs,
    authorize: options.authorize || (async () => owner), onChunk: options.onChunk || (async (meta, bytes) => chunks.push({ meta, bytes })),
    finalize: options.finalize || (async outcome => finished.push(outcome)), signal: options.signal,
    idleMs: options.idleMs || 1000, lifetimeMs: options.lifetimeMs || 5000 });
  const server = createServer(), clients = [];
  server.on('upgrade', (req, socket, head) => {
    if (!transport.handleUpgrade(req, socket, head)) socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => {
    await transport.cancel().catch(() => {});
    clients.forEach(ws => ws.terminate());
    await new Promise(resolve => server.close(resolve));
  });
  function connect(change = () => {}) {
    const url = new URL(transport.callbackUrl);
    url.protocol = 'ws:'; url.host = `127.0.0.1:${server.address().port}`; change(url);
    const ws = new WebSocket(url); clients.push(ws);
    ws.on('error', () => {});
    ws.on('message', (data, binary) => incoming.push(binary ? Buffer.from(data) : JSON.parse(data.toString())));
    return ws;
  }
  async function ready(hello = {}) {
    const ws = connect(); await once(ws, 'open');
    ws.send(JSON.stringify({ t: 'pong', avatar: input.plan.binding.workerAvatar, rutor_per_s: 65,
      ljud_fore_s: .22, del_rutor: 12, ...hello }));
    return ws;
  }
  async function ended(ws) {
    if (incoming.some(m => m.t === 'end')) return;
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { ws.off('message', read); reject(Error('fixture input did not finish')); }, 1500);
      function read(data, binary) { if (!binary && JSON.parse(data).t === 'end') { clearTimeout(timeout); ws.off('message', read); resolve(); } }
      ws.on('message', read);
    });
  }
  return { input, owner, transport, finished, chunks, incoming, connect, ready, ended };
}

test('release gate rejects wrong image, rolling versions, stale workers and stale/missing receipts', () => {
  assert.equal(verifyMovingWorkerRelease(receipt()).image, image);
  for (const change of [r => r.endpoint.image = 'other', r => r.workers.workers[0].image = 'other',
    r => r.workers.workers[0].version--, r => r.workers.workers[0].isStale = true,
    r => delete r.workers.workers[0].isStale, r => r.workers.workers = [],
    r => r.observedAtMs -= 61000, r => r.observedAtMs += 61000, r => r.expectedImage = 'latest']) {
    const r = receipt(); change(r); assert.throws(() => verifyMovingWorkerRelease(r), /moving_worker_release/);
  }
});

test('owned transport preserves every exact sample boundary in the padded frame plan', async t => {
  for (const samples of [12999, 13000, 13001, 31999, 32000, 32001, 35000, 41000]) {
    await t.test(`${samples} PCM samples`, async t => {
      const frames = Math.floor((samples + 18000) / 1000);
      const input = inputFor('dragan', 'dragan', 1, frames, samples * 2);
      const binding = ownedBinding(input);
      const f = await setup(t, { input, release: ownedReceipt(), attestationBinding: binding });
      const ws = await f.ready(ownedHello(binding)), run = f.transport.run(); await f.ended(ws);
      for (let from = 0; from < frames; from += 12) {
        ws.send(JSON.stringify(metadata(input, from, Math.min(12, frames - from))));
        ws.send(Buffer.from([1]));
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      ws.send(done(input));
      assert.equal((await run).frames, frames);
      assert.equal(f.finished[0].reason, 'complete');
      assert.equal(Buffer.concat(f.incoming.filter(Buffer.isBuffer)).length, samples * 2);
    });
  }
});

test('owned Dragan bank is bound to the accepted job before start/PCM and requires complete output', async t => {
  const input = inputFor('dragan', 'dragan', 1, 42), binding = ownedBinding(input);
  const f = await setup(t, { input, release: ownedReceipt(), attestationBinding: binding });
  // Caller mutation cannot change the admission captured by this transport.
  const hello = ownedHello(binding); binding.nonce = hash('changed after preparation');
  const ws = await f.ready(hello), run = f.transport.run(); await f.ended(ws);
  assert.deepEqual(f.incoming[0], { t: 'bind', attestation: hello.attestation });
  assert.equal(f.incoming[1].t, 'start');
  assert.deepEqual(Buffer.concat(f.incoming.filter(Buffer.isBuffer)), input.playbackPcm());
  for (const [from, n] of [[0, 12], [12, 12], [24, 12], [36, 6]]) {
    ws.send(JSON.stringify(metadata(input, from, n))); ws.send(Buffer.from([n]));
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  ws.send(done(input));
  assert.equal((await run).frames, 42); assert.equal(f.finished.length, 1);
  assert.equal(f.finished[0].jobId, f.owner.jobId); assert.equal(f.finished[0].reason, 'complete');
});

test('a long explicit idle plan keeps source frame zero through every relay chunk', async t => {
  const pcm = Buffer.alloc(48000);
  const input = prepareMovingSpeechPcmInput({
    binding: { dealerId: 'dragan', workerAvatar: 'dragan', sessionId: 'session-1', talkId: 'idle-talk', revision: 1,
      profileRevision: hash('profile'), textSha256: hash('text'), audioSha256: hash(pcm), avatarSha256: hash('bank') },
    clips: [{ dealerId: 'dragan', take: 'vila', sha256: hash('idle-source'), fps: 24, frameCount: 1, kind: 'still' }],
    frames: Array.from({ length: 42 }, () => ({ take: 'vila', frame: 0 })),
    audio: { pcm, sampleRate: 24000, channels: 1, format: 's16le' },
  });
  const binding = ownedBinding(input), f = await setup(t, { input, release: ownedReceipt(), attestationBinding: binding });
  const ws = await f.ready(ownedHello(binding)), run = f.transport.run(); await f.ended(ws);
  assert.deepEqual(f.incoming.find(message => message.t === 'start').karta, [['vila', 0, 42]]);
  for (let from = 0; from < 42; from += 12) {
    const header = metadata(input, from, Math.min(12, 42 - from));
    header.rutor = header.rutor.map(frame => ({ ...frame, tagning: 'vila', ruta: 0 }));
    ws.send(JSON.stringify(header)); ws.send(Buffer.from([1]));
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  ws.send(done(input));
  assert.equal((await run).frames, 42);
  assert.ok(f.chunks.flatMap(chunk => chunk.meta.rutor).every(frame => frame.tagning === 'vila' && frame.ruta === 0));
});

test('owned worker rejects a missing, altered, foreign or extra attestation before disclosing PCM', async t => {
  for (const field of ['missing', 'jobId', 'nonce', 'attemptId', 'dealerId', 'workerAvatar', 'sessionId',
    'profileRevision', 'sourceSetSha256', 'avatarSha256', 'bankReceiptSha256', 'releaseSha256', 'extra']) {
    const input = inputFor('dragan', 'dragan', 1, 42), binding = ownedBinding(input);
    const f = await setup(t, { input, release: ownedReceipt(), attestationBinding: binding });
    const hello = ownedHello(binding);
    if (field === 'missing') delete hello.attestation;
    else hello.attestation[field] = 'different';
    await f.ready(hello); await assert.rejects(f.transport.run(), /attestation_mismatch/);
    assert.equal(f.incoming.length, 0, field); assert.equal(f.finished.length, 1);
    assert.throws(() => input.playbackPcm(), /cancelled/);
  }
});

test('owned release requires exact server binding, immutable digest and padded source plan at prepare', async () => {
  for (const scenario of ['missing-binding', 'wrong-profile', 'extra-binding', 'short-plan', 'mutable-image', 'legacy-binding']) {
    const input = inputFor('dragan', 'dragan', 1, scenario === 'short-plan' ? 30 : 42);
    const binding = ownedBinding(input), release = scenario === 'legacy-binding' ? receipt() : ownedReceipt(), finished = [];
    if (scenario === 'wrong-profile') binding.profileRevision = hash('other');
    if (scenario === 'extra-binding') binding.extra = true;
    if (scenario === 'mutable-image') release.expectedImage = 'ghcr.io/jakeminator123/moving-gpu-worker:latest';
    await assert.rejects(createMovingSpeechTransport({ input, origin: 'https://own-game.example', release,
      attestationBinding: scenario === 'missing-binding' ? undefined : binding,
      authorize: async () => assert.fail('invalid input must not authorize'), onChunk: async () => assert.fail('must not deliver'),
      finalize: async outcome => finished.push(outcome) }), /moving_worker_(binding|plan_padding|release)/);
    assert.equal(finished.length, 1); assert.equal(finished[0].reason, 'prepare_failed');
  }
});

test('owned worker rejects changed padding protocol and truncated output', async t => {
  for (const scenario of ['padding', 'fps', 'truncated']) {
    const input = inputFor('dragan', 'dragan', 1, 42), binding = ownedBinding(input);
    const f = await setup(t, { input, release: ownedReceipt(), attestationBinding: binding });
    const hello = ownedHello(binding);
    if (scenario === 'padding') hello.pad_after_s = 0;
    if (scenario === 'fps') hello.fps = 30;
    const ws = await f.ready(hello), run = f.transport.run();
    const rejected = assert.rejects(run, /incompatible|incomplete_result/);
    if (scenario === 'truncated') {
      await f.ended(ws); ws.send(JSON.stringify(metadata(input))); ws.send(Buffer.from([12])); ws.send(done(input));
    }
    await rejected;
    if (scenario !== 'truncated') assert.equal(f.incoming.length, 0);
    assert.equal(f.finished.length, 1); assert.notEqual(f.finished[0].reason, 'complete');
  }
});

test('owned cold start gets one bounded grace period; established I/O keeps its short timeout', async t => {
  const input = inputFor('dragan', 'dragan', 1, 42), binding = ownedBinding(input);
  const f = await setup(t, { input, release: ownedReceipt(), attestationBinding: binding,
    idleMs: 40, startupMs: 500, lifetimeMs: 1000 });
  const run = f.transport.run(), rejected = assert.rejects(run, /read_timeout/);
  await new Promise(resolve => setTimeout(resolve, 80));
  const ws = await f.ready(ownedHello(binding)); await f.ended(ws);
  await rejected;
  assert.ok(f.incoming.some(message => message.t === 'bind'));
  assert.equal(f.finished.length, 1);
  const missingInput = inputFor('dragan', 'dragan', 1, 42);
  const missing = await setup(t, { input: missingInput, release: ownedReceipt(), attestationBinding: ownedBinding(missingInput),
    idleMs: 20, startupMs: 60, lifetimeMs: 1000 });
  await assert.rejects(missing.transport.run(), /startup_timeout/);
  assert.equal(missing.finished.length, 1); assert.equal(missing.incoming.length, 0);
});

test('two consecutive Paow/Dragge socket transfers use our exact PCM and feed the existing dealer frame layer', async t => {
  for (const [dealer, avatar] of [['paow', 'paow'], ['dragan', 'dragge']]) {
    const input = inputFor(dealer, avatar), draws = [];
    const document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ clearRect() {},
      drawImage(...args) { draws.push(args); }, getImageData: () => ({ data: new Uint8ClampedArray(256 * 256 * 4) }), putImageData() {} }) }) };
    const layer = await createMovingSpeechFrameLayer({ plan: input.plan, document,
      decode: async bytes => Array.from({ length: bytes[0] }, () => ({ displayWidth: 256, displayHeight: 512, close() {} })) });
    t.after(() => layer.close());
    const f = await setup(t, { input, onChunk: (meta, bytes, context) => {
      assert.equal(context.signal.aborted, false); assert.equal(context.planSha256, input.plan.planSha256);
      return layer.push(meta, bytes);
    } });
    const ws = await f.ready(), run = f.transport.run(); await f.ended(ws);
    assert.deepEqual(Buffer.concat(f.incoming.filter(Buffer.isBuffer)), input.playbackPcm());
    assert.equal(f.incoming[0].id, input.plan.start.id);
    for (const [from, n] of [[0, 12], [12, 12], [24, 6]]) {
      ws.send(JSON.stringify(metadata(input, from, n))); ws.send(Buffer.from([n]));
      // Model actual chunk streaming; the receiver intentionally bounds bursts.
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    ws.send(done(input));
    assert.deepEqual(await run, { chunks: 3, frames: 30, planSha256: input.plan.planSha256 });
    assert.equal(f.finished.length, 1); assert.equal(f.finished[0].reason, 'complete');
    assert.ok(layer.paint({ videoWidth: 320, videoHeight: 240 }, { binding: input.plan.binding,
      planSha256: input.plan.planSha256, take: 'pos1', frame: 12, sourceSha256: hash('source'),
      audioPlaying: true, audioTimeSeconds: 12.5 / 24 - .22 }));
    assert.ok(draws.length > 0); assert.deepEqual(input.playbackPcm(), Buffer.alloc(48000, 1));
    await assert.rejects(f.transport.run(), /consumed/);
  }
});

test('wrong token/avatar/path are rejected; the capability is single-use and does not replace its worker', async t => {
  const f = await setup(t);
  for (const [change, status] of [[u => u.searchParams.set('token', 'invalid'), 403],
    [u => u.searchParams.set('token', 'å'.repeat(64)), 403],
    [u => u.searchParams.set('avatar', 'other'), 403], [u => u.pathname = '/lipsync-worker', 404]]) {
    const ws = f.connect(change);
    const [, response] = await once(ws, 'unexpected-response'); assert.equal(response.statusCode, status); ws.terminate();
  }
  await f.ready();
  const replay = f.connect(); const [, response] = await once(replay, 'unexpected-response');
  assert.equal(response.statusCode, 403); replay.terminate();
});

test('incompatible pong and changed ownership/paid admission disclose no PCM', async t => {
  for (const options of [{ hello: { avatar: 'dragge' } }, { hello: { rutor_per_s: 29 } },
    { hello: { ljud_fore_s: 0 } }, { hello: { del_rutor: 24 } }, { denied: true }, { noJob: true }]) {
    let f;
    f = await setup(t, { authorize: async ({ phase }) => phase === 'prepare'
      ? { userId: 'u', sessionId: 'session-1', endpointId: 'fixtureendpoint' }
      : { userId: options.denied ? 'other' : 'u', sessionId: 'session-1', endpointId: 'fixtureendpoint', jobId: options.noJob ? undefined : 'accepted', release: receipt() } });
    await f.ready(options.hello); await assert.rejects(f.transport.run(), /incompatible|not_authorized/);
    assert.equal(f.incoming.filter(Buffer.isBuffer).length, 0); assert.equal(f.finished.length, 1);
    assert.throws(() => f.input.playbackPcm(), /cancelled/);
  }
});

test('mispaired, stale-revision, wrong-frame, duplicate and oversized chunks fail closed', async t => {
  for (const bad of ['binary-first', 'header-twice', 'old-id', 'wrong-frame', 'oversized', 'duplicate']) {
    const f = await setup(t), ws = await f.ready(), run = f.transport.run();
    const rejected = assert.rejects(run, /moving_worker/); await f.ended(ws);
    const m = metadata(f.input);
    if (bad === 'binary-first') ws.send(Buffer.from([12]));
    else if (bad === 'old-id') ws.send(JSON.stringify({ ...m, id: 'old-revision' }));
    else if (bad === 'wrong-frame') { m.rutor[0].ruta++; ws.send(JSON.stringify(m)); }
    else if (bad === 'oversized') ws.send(Buffer.alloc(2 * 1024 * 1024 + 1));
    else {
      ws.send(JSON.stringify(m));
      if (bad === 'duplicate') ws.send(Buffer.from([12]));
      ws.send(JSON.stringify(m));
    }
    await rejected; assert.equal(f.finished.length, 1);
    assert.ok(f.chunks.length <= (bad === 'duplicate' ? 1 : 0));
  }
});

test('revocation before output and disconnect release only this admitted attempt', async t => {
  const f = await setup(t, { authorize: async ({ phase }) => phase === 'output' ? null
    : { userId: 'u', sessionId: 'session-1', endpointId: 'fixtureendpoint', jobId: 'accepted', release: receipt() } });
  const ws = await f.ready(), run = f.transport.run(); const rejected = assert.rejects(run, /not_authorized/);
  await f.ended(ws); ws.send(JSON.stringify(metadata(f.input))); ws.send(Buffer.from([12]));
  await rejected; assert.equal(f.chunks.length, 0); assert.equal(f.finished.length, 1);
  const other = await setup(t); const ow = await other.ready(); const or = other.transport.run();
  const disconnected = assert.rejects(or, /disconnected/); await other.ended(ow); ow.terminate();
  await disconnected; assert.equal(other.finished.length, 1);
});

test('abort sends avbryt rather than end, clears PCM and finalizes exactly once', async t => {
  const controller = new AbortController(), f = await setup(t, { signal: controller.signal });
  const ws = await f.ready(), run = f.transport.run(); const rejected = assert.rejects(run, /closed|cancelled/);
  await f.ended(ws); controller.abort(); await rejected;
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(f.incoming.some(m => m.t === 'avbryt' && m.id === f.input.plan.start.id));
  assert.equal(f.incoming.filter(m => m.t === 'end').length, 1);
  assert.throws(() => f.input.playbackPcm(), /cancelled/); await f.transport.cancel(); assert.equal(f.finished.length, 1);
});

test('missing worker, unpaired header, stalled consumer and burst overflow are bounded', async t => {
  for (const scenario of ['missing', 'header', 'consumer', 'burst']) {
    const f = await setup(t, { idleMs: 100, onChunk: scenario === 'consumer' || scenario === 'burst' ? () => new Promise(() => {}) : undefined });
    const ws = scenario === 'missing' ? null : await f.ready();
    const run = f.transport.run(); const rejected = assert.rejects(run, /timeout|backpressure|closed/);
    if (ws) {
      await f.ended(ws); ws.send(JSON.stringify(metadata(f.input)));
      if (scenario !== 'header') ws.send(Buffer.from([12]));
      if (scenario === 'burst') for (let i = 0; i < 20; i++) ws.send(Buffer.from([12]));
    }
    await rejected; assert.equal(f.finished.length, 1);
  }
});

test('cleanup failure is reported, and a never-run channel expires and releases its owner', async t => {
  const f = await setup(t, { finalize: async () => { throw Error('fixture journal unavailable'); } });
  await assert.rejects(f.transport.cancel(), /journal unavailable/);
  await assert.rejects(f.transport.closed, /journal unavailable/);
  const waiting = await setup(t, { idleMs: 20, lifetimeMs: 50 });
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(waiting.finished.length, 1); assert.throws(() => waiting.input.playbackPcm(), /cancelled/);
});

test('a release changed during startup or a replaced paid job cannot send PCM/output', async t => {
  for (const phaseToChange of ['send', 'transfer']) {
    const f = await setup(t, { authorize: async ({ phase }) => {
      const release = receipt();
      if (phase === 'send' && phaseToChange === 'send') {
        release.workers.endpointVersion++; release.workers.workers[0].version++;
      }
      return { userId: 'u', sessionId: 'session-1', endpointId: 'fixtureendpoint', release,
        jobId: phase === 'transfer' && phaseToChange === 'transfer' ? 'replaced' : 'accepted' };
    } });
    await f.ready(); await assert.rejects(f.transport.run(), /release_changed|not_authorized/);
    assert.equal(f.incoming.filter(Buffer.isBuffer).length, 0);
  }
});

test('a pre-aborted attempt exposes no callback capability and still releases its reservation', async () => {
  const controller = new AbortController(); controller.abort();
  const input = inputFor(), finished = [];
  await assert.rejects(createMovingSpeechTransport({ input, origin: 'https://own-game.example', release: receipt(),
    signal: controller.signal, authorize: async () => ({ userId: 'u', sessionId: 'session-1', endpointId: 'fixtureendpoint' }),
    onChunk: async () => assert.fail('must not deliver'), finalize: async outcome => finished.push(outcome) }), /cancelled/);
  assert.equal(finished.length, 1); assert.throws(() => input.playbackPcm(), /cancelled/);
});

test('normal close drains all received frames and done across delayed output authorization', async t => {
  const f = await setup(t, { authorize: async ({ phase }) => {
    if (phase === 'output') await new Promise(resolve => setTimeout(resolve, 30));
    return { userId: 'u', sessionId: 'session-1', endpointId: 'fixtureendpoint', jobId: 'accepted', release: receipt() };
  } });
  const ws = await f.ready(), run = f.transport.run(); await f.ended(ws);
  for (const [from, n] of [[0, 12], [12, 12], [24, 6]]) {
    ws.send(JSON.stringify(metadata(f.input, from, n))); ws.send(Buffer.from([n]));
  }
  ws.send(done(f.input)); ws.close(1000);
  assert.deepEqual(await run, { chunks: 3, frames: 30, planSha256: f.input.plan.planSha256 });
  assert.equal(f.chunks.length, 3); assert.equal(f.finished.length, 1);
  assert.equal(f.finished[0].reason, 'complete');
});

test('normal close without done drains a valid pair but never reports successful completion', async t => {
  const f = await setup(t, { onChunk: async (meta, bytes) => {
    await new Promise(resolve => setTimeout(resolve, 30)); f.chunks.push({ meta, bytes });
  } });
  const ws = await f.ready(), run = f.transport.run();
  const rejected = assert.rejects(run, /disconnected/); await f.ended(ws);
  ws.send(JSON.stringify(metadata(f.input))); ws.send(Buffer.from([12])); ws.close(1000);
  await rejected;
  assert.equal(f.chunks.length, 1); assert.equal(f.finished.length, 1);
  assert.notEqual(f.finished[0].reason, 'complete');
});

test('blocked prepare is bounded on abort and timeout, cleans its reservation and ignores a late result', async () => {
  for (const mode of ['abort', 'timeout']) {
    const input = inputFor(), controller = new AbortController(), finished = [];
    let enter, resume, context;
    const entered = new Promise(resolve => { enter = resolve; });
    const pending = new Promise(resolve => { resume = resolve; });
    const factory = createMovingSpeechTransport({ input, origin: 'https://own-game.example', release: receipt(),
      signal: controller.signal, idleMs: 30, lifetimeMs: 60,
      authorize: args => { context = args; enter(); return pending; },
      onChunk: async () => assert.fail('prepare cannot deliver'), finalize: async outcome => finished.push(outcome) });
    const observed = factory.then(transport => ({ transport }), error => ({ error }));
    await entered;
    if (mode === 'abort') controller.abort();
    let watchdog;
    try {
      const result = await Promise.race([observed, new Promise(resolve => { watchdog = setTimeout(() => resolve('hung'), 200); })]);
      assert.notEqual(result, 'hung', `prepare must settle on ${mode}`);
      assert.match(result.error?.message || '', /cancelled|closed|authorization_timeout|lifetime_exceeded/);
      assert.equal(finished.length, 1); assert.equal(finished[0].owner, null);
      assert.equal(finished[0].binding, input.plan.binding);
      assert.equal(context.signal.aborted, true); assert.throws(() => input.playbackPcm(), /cancelled/);
      resume({ userId: 'late', sessionId: 'session-1', endpointId: 'fixtureendpoint' });
      await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(finished.length, 1); assert.equal((await observed).transport, undefined);
    } finally {
      clearTimeout(watchdog);
      resume({ userId: 'late', sessionId: 'session-1', endpointId: 'fixtureendpoint' });
      const late = await observed;
      await late.transport?.cancel();
    }
  }
});

test('prepare denial or exception finalizes the reserved attempt and clears PCM', async () => {
  for (const authorize of [async () => null, async () => { throw Error('fixture authorization unavailable'); }]) {
    const input = inputFor(), finished = [];
    await assert.rejects(createMovingSpeechTransport({ input, origin: 'https://own-game.example', release: receipt(),
      authorize, onChunk: async () => assert.fail('must not deliver'), finalize: async outcome => finished.push(outcome) }),
    /not_authorized|authorization unavailable/);
    assert.equal(finished.length, 1); assert.equal(finished[0].owner, null);
    assert.throws(() => input.playbackPcm(), /cancelled/);
  }
});

test('invalid startup release or origin releases the captured reservation before admission', async () => {
  for (const invalid of [{ release: { ...receipt(), expectedImage: 'latest' } }, { origin: 'http://own-game.example' }]) {
    const input = inputFor(), finished = [];
    await assert.rejects(createMovingSpeechTransport({ input, origin: 'https://own-game.example', release: receipt(),
      ...invalid, authorize: async () => assert.fail('invalid setup must not authorize'),
      onChunk: async () => assert.fail('invalid setup must not deliver'), finalize: async outcome => finished.push(outcome) }),
    /moving_worker_release|invalid_moving_worker_channel/);
    assert.equal(finished.length, 1); assert.equal(finished[0].owner, null);
    assert.equal(finished[0].reason, 'prepare_failed'); assert.throws(() => input.playbackPcm(), /cancelled/);
  }
});
