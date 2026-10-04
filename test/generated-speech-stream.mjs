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
  const config = { directory, workerSecret: secret, ticketSecret: secret, origin: 'http://127.0.0.1:4173', apiKey: 'fixture', voiceId: 'voice', modelId: 'model' };
  const services = [];
  const relay = { status: () => ({ available }), close() { options.onRelayClose?.(); }, openSource: () => ({ writePCM: async b => { written += b.length; }, end() {}, abort() { aborted = true; } }) };
  const construct = () => createGeneratedSpeechStreamService({}, config, { freshnessIntervalMs: 10,
    resolveOwner: req => req.owner,
    attachRelay: (_, value) => { relayOptions = value; return relay; },
    pcmSource: options.pcmSource ?? (async function*({ beforeCostly }) { await beforeCostly(); sourceCalls++; yield new Uint8Array(48); }),
    sessionManager: options.sessionManager,
  }).then(value => { services.push(value); return value; });
  service = await construct();
  const input = (requestId = 'test-request') => ({ requestId, dealerId: 'astrid', text: 'A test reply.', owner, playerId: 'player-one', beforeCostly: async () => { if (!fresh) throw Error('stale'); } });
  const request = (d, who = owner) => ({ owner: who, headers: { 'sec-websocket-protocol': `astrid-v2, ticket.${d.ticket}` } });
  t.after(async () => { services.forEach(s => s.close()); assert.equal(dirname(directory), resolve(tmpdir())); assert.match(basename(directory), /^croupier-stream-test-/); await rm(directory, { recursive: true, force: true }); });
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
  assert.equal(generatedSpeechStreamConfiguration(cloud).configured, true);
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
