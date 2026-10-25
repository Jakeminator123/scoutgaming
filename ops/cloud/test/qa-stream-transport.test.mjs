import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {QA_SERVICE_ID, QA_PUBLIC_ORIGIN, QA_TRANSPORT_ORIGIN, FIXTURE_PROVIDER_ORIGIN, FIXTURE_CREDENTIAL, FIXTURE_ENDPOINT,
  TRANSPORT_SENTINEL, unpaidQaFetch, openSyntheticWorker, assertUnpaidQaEnvironment, verifyUnpaidWssTransport, installUnpaidDiagnostics} from '../qa-stream-transport-preload.mjs';
import {unpaidQaSpecifications} from '../qa-stream-transport-start.mjs';

const env = {RENDER_SERVICE_ID: QA_SERVICE_ID, PUBLIC_URL: QA_PUBLIC_ORIGIN, CROUPIER_VERCEL_TRANSPORT_ORIGIN: QA_TRANSPORT_ORIGIN,
  NODE_ENV: 'production', OPENCLAW_PRODUCT_SPEECH_URL: FIXTURE_PROVIDER_ORIGIN, OPENCLAW_PRODUCT_SPEECH_TOKEN: FIXTURE_CREDENTIAL,
  CARTESIA_API_KEY: FIXTURE_CREDENTIAL, RUNPOD_API_KEY: FIXTURE_CREDENTIAL, CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID: FIXTURE_ENDPOINT,
  CROUPIER_GENERATED_SPEECH_STREAMING: '1', CROUPIER_CLOUD_GENERATED_SPEECH: '1', CROUPIER_GENERATED_SPEECH: '1', CROUPIER_MEDIA_STORAGE: 'disk'};

test('unpaid QA refuses other services, origins, real provider credentials and preload inheritance', () => {
  assertUnpaidQaEnvironment(env);
  for (const patch of [{RENDER_SERVICE_ID: 'production'}, {PUBLIC_URL: 'https://scoutgaming.tech'}, {RUNPOD_API_KEY: 'actual-provider-key'}, {CARTESIA_API_KEY: 'actual-provider-key'}, {CROUPIER_MEDIA_STORAGE: 'blob'}]) assert.throws(() => assertUnpaidQaEnvironment({...env, ...patch}));
  const specifications = {web: {args: ['services/game/server.mjs'], env: {...env}}};
  const transformed = unpaidQaSpecifications(specifications, env);
  assert.match(transformed.web.env.NODE_OPTIONS, /^--import=.*qa-stream-transport-preload\.mjs$/);
  assert.deepEqual(Object.keys(transformed), ['web']); assert.equal(specifications.web.env.NODE_OPTIONS, undefined);
  assert.throws(() => unpaidQaSpecifications(specifications, {...env, NODE_OPTIONS: '--require=foreign'}));
});

test('each unpaid run isolates speech journals without changing the original game specification', () => {
  const originalDirectory='/var/data/speech';
  const specifications={web:{env:{...env,CROUPIER_GENERATED_SPEECH_DIR:originalDirectory}}};
  const first='/var/data/speech/transport-qa-00000000-0000-0000-0000-000000000001';
  const second='/var/data/speech/transport-qa-00000000-0000-0000-0000-000000000002';
  assert.equal(unpaidQaSpecifications(specifications,env,{speechDirectory:first}).web.env.CROUPIER_GENERATED_SPEECH_DIR,first);
  assert.equal(unpaidQaSpecifications(specifications,env,{speechDirectory:second}).web.env.CROUPIER_GENERATED_SPEECH_DIR,second);
  assert.equal(specifications.web.env.CROUPIER_GENERATED_SPEECH_DIR,originalDirectory);
  for(const speechDirectory of ['/var/data/speech','/var/data/players','/var/data/speech/../players','/tmp/transport-qa-00000000-0000-0000-0000-000000000001'])assert.throws(()=>unpaidQaSpecifications(specifications,env,{speechDirectory}),/Invalid isolated/);
});

test('only bounded allowlisted child phases reach QA parent logs, with private stdout discarded', () => {
  const rows = [], specifications = {web: {env: {...env}}};
  const qa = unpaidQaSpecifications(specifications, env, {emit: row => rows.push(row)});
  qa.web.onStdoutLine('user=private-user password=private-password');
  qa.web.onStdoutLine('CROUPIER_UNPAID_STREAM ' + JSON.stringify({phase: 'fresh_before', count: 1, cookie: 'private-cookie', text: 'private-text'}));
  qa.web.onStdoutLine('CROUPIER_UNPAID_STREAM ' + JSON.stringify({phase: 'unknown-private', count: 1}));
  qa.web.onStdoutLine('CROUPIER_UNPAID_STREAM broken');
  for (let index = 0; index < 300; index++) qa.web.onStdoutLine('CROUPIER_UNPAID_STREAM ' + JSON.stringify({phase: 'pcm_written', bytes: 4800}));
  assert.equal(rows.length, 256);
  assert.deepEqual(JSON.parse(rows[0].slice('CROUPIER_UNPAID_STREAM '.length)), {phase: 'fresh_before', count: 1});
  assert.doesNotMatch(rows.join(''), /private-/);
  assert.equal(specifications.web.onStdoutLine, undefined);
  assert.throws(() => unpaidQaSpecifications(specifications, {...env, RENDER_SERVICE_ID: 'production'}));
});

test('fixture provider never reaches a paid host and uses the real session worker request', async () => {
  let realCalls = 0, closed = 0, workerInput;
  const fixtureFetch = unpaidQaFetch(env, {realFetch: async () => {realCalls++; return Response.json({local: true});}, createWorker: async input => {workerInput = input; return {close: () => {closed++;}};}});
  const input = {ws_url: QA_PUBLIC_ORIGIN.replace('https:', 'wss:') + '/lipsync-worker', ws_token: 'isolated-worker-secret'.repeat(3), worker_id: 'croupier-' + 'a'.repeat(32)};
  const job = await (await fixtureFetch(`https://api.runpod.ai/v2/${FIXTURE_ENDPOINT}/run`, {method: 'POST', body: JSON.stringify({input})})).json();
  assert.deepEqual(workerInput, input);
  assert.equal((await (await fixtureFetch(`https://api.runpod.ai/v2/${FIXTURE_ENDPOINT}/status/${job.id}`)).json()).status, 'IN_PROGRESS');
  await fixtureFetch(`https://api.runpod.ai/v2/${FIXTURE_ENDPOINT}/cancel/${job.id}`, {method: 'POST'}); assert.equal(closed, 1);
  const restartedFetch = unpaidQaFetch(env, {realFetch: async () => {throw Error('External request');}});
  assert.equal((await (await restartedFetch(`https://api.runpod.ai/v2/${FIXTURE_ENDPOINT}/status/${job.id}`)).json()).status, 'COMPLETED');
  const pcm = await fixtureFetch('https://api.cartesia.ai/tts/bytes'); assert.equal((await pcm.arrayBuffer()).byteLength, 4800);
  const speech = await (await fixtureFetch(FIXTURE_PROVIDER_ORIGIN + '/api/product/speech', {body: JSON.stringify({request: {requestId: 'request'}, status: {dealerId: 'astrid', sessionRevision: 'session', roundRevision: 'round'}})})).json();
  assert.equal(speech.requestId, 'request'); assert.equal(speech.kind, 'generatedText');
  await assert.rejects(fixtureFetch('https://api.runpod.ai/v2/actual-endpoint/run'), /Nonfixture/);
  await assert.rejects(fixtureFetch('https://api.openai.com/v1/responses'), /forbidden/);
  assert.equal(realCalls, 0);
});

test('synthetic worker proves bidirectional binary transport without claiming media playback', async () => {
  let ws;
  const phases = [];
  class FixtureSocket extends EventEmitter {
    constructor(url, options) {super(); ws = this; this.sent = []; assert.equal(url, QA_PUBLIC_ORIGIN.replace('https:', 'wss:') + '/lipsync-worker'); assert.match(options.headers.Authorization, /^Bearer /); queueMicrotask(() => this.emit('open'));}
    send(...args) {this.sent.push(args);}
    terminate() {}
  }
  const input = {ws_url: QA_PUBLIC_ORIGIN.replace('https:', 'wss:') + '/lipsync-worker', ws_token: 'isolated-worker-secret'.repeat(3), worker_id: 'croupier-' + 'a'.repeat(32)};
  await openSyntheticWorker(input, {WebSocketImpl: FixtureSocket, trace: (phase, fields) => phases.push({phase, fields})});
  ws.emit('message', Buffer.from('{"t":"start","id":"utterance"}'), false);
  assert.equal(ws.sent.length, 1);
  ws.emit('message', Buffer.alloc(4800), true);
  assert.deepEqual(ws.sent[1], [TRANSPORT_SENTINEL, {binary: true}]);
  ws.emit('message', Buffer.from('{"t":"end","id":"utterance"}'), false);
  assert.equal(JSON.parse(ws.sent[2][0]).syntheticTransport, true);
  assert.deepEqual(phases.map(value => value.phase), ['worker_open', 'worker_recv_start', 'worker_send_stream', 'worker_recv_pcm', 'worker_send_bytes', 'worker_recv_end', 'worker_send_done']);
  assert.doesNotMatch(JSON.stringify(phases), /utterance|ws_token|worker_id|isolated-worker-secret/);
  await assert.rejects(openSyntheticWorker({...input, ws_url: QA_TRANSPORT_ORIGIN.replace('https:', 'wss:') + '/lipsync-worker'}, {WebSocketImpl: FixtureSocket}), /Invalid/);
});

test('diagnostics require the exact unpaid environment, filter private fields and bound log volume', () => {
  const symbol = Symbol.for('croupier.unpaid-stream-diagnostics'), previous = globalThis[symbol];
  const output = [];
  try {
    assert.throws(() => installUnpaidDiagnostics({...env, RENDER_SERVICE_ID: 'production'}, {emit: value => output.push(value)}));
    assert.equal(globalThis[symbol], previous);
    const trace = installUnpaidDiagnostics(env, {emit: value => output.push(value)});
    trace('fresh_before', {ticket: 'private-ticket', cookie: 'private-cookie', text: 'private-text', id: 'private-id'});
    trace('worker_recv_pcm', {bytes: 4800, payload: 'private-media'});
    trace('unknown-private-phase', {bytes: 42});
    trace('fresh_after', 7);
    assert.deepEqual(output.map(value => JSON.parse(value.slice('CROUPIER_UNPAID_STREAM '.length))),
      [{phase: 'fresh_before', count: 1}, {phase: 'worker_recv_pcm', count: 1, bytes: 4800}, {phase: 'fresh_after', count: 1, ms: 7}]);
    assert.doesNotMatch(output.join(''), /private-/);
    for (let index = 0; index < 300; index++) trace('worker_recv_pcm', {bytes: 2});
    assert.equal(output.length, 256);
    const throwingTrace = installUnpaidDiagnostics(env, {emit() {throw Error('Log destination unavailable');}});
    assert.doesNotThrow(() => throwingTrace('worker_close', {code: 1000}));
  } finally {
    if (previous === undefined) delete globalThis[symbol]; else globalThis[symbol] = previous;
  }
});

test('client transport verifier requires ready, stream, exact bytes and synthetic terminal, keeping credentials private', async () => {
  class FixtureClient extends EventEmitter {
    constructor(url, protocols, options) {
      super(); assert.equal(url, QA_PUBLIC_ORIGIN.replace('https:', 'wss:') + '/speech-stream');
      assert.deepEqual(protocols, ['astrid-v2', 'ticket.signed.fixture']); assert.equal(options.origin, QA_PUBLIC_ORIGIN);
      queueMicrotask(() => {
        this.emit('open');
        this.emit('message', Buffer.from('{"t":"ready","id":"turn","protocol":2}'), false);
        this.emit('message', Buffer.from('{"t":"stream","id":"turn"}'), false);
        this.emit('message', TRANSPORT_SENTINEL, true);
        this.emit('message', Buffer.from('{"t":"done","id":"turn","syntheticTransport":true}'), false);
        this.emit('close', 1000);
      });
    }
    terminate() {}
  }
  const result = await verifyUnpaidWssTransport({cookie: 'bo_jwt=private-fixture', descriptor: {url: '/speech-stream', ticket: 'signed.fixture'}}, {WebSocketImpl: FixtureClient});
  assert.equal(result.workerRoundTrip, true); assert.equal(result.actualPlayback, false);
  assert.equal(result.bytes, TRANSPORT_SENTINEL.length); assert.doesNotMatch(JSON.stringify(result), /private-fixture|signed\.fixture/);
  await assert.rejects(verifyUnpaidWssTransport({cookie: '', descriptor: {url: '/speech-stream', ticket: 'signed.fixture'}}, {WebSocketImpl: FixtureClient}), /real isolated BO/);
});

test('client failures expose only exact upgrade and terminal evidence without upstream secret text', async () => {
  class DeniedClient extends EventEmitter {
    constructor() {super(); queueMicrotask(() => this.emit('unexpected-response', null, {statusCode: 401, resume() {}}));}
    terminate() {}
  }
  const input = {cookie: 'bo_jwt=private-fixture', descriptor: {url: '/speech-stream', ticket: 'signed.fixture'}};
  await assert.rejects(verifyUnpaidWssTransport(input, {WebSocketImpl: DeniedClient}), error => {
    assert.equal(error.gate, 'client_upgrade'); assert.equal(error.statusCode, 401); assert.equal(error.accepted, false);
    assert.doesNotMatch(JSON.stringify(error), /private-fixture|signed\.fixture/); return true;
  });
  class InterruptedClient extends EventEmitter {
    constructor() {super(); queueMicrotask(() => {this.emit('open'); this.emit('close', 1006);});}
    terminate() {}
  }
  await assert.rejects(verifyUnpaidWssTransport(input, {WebSocketImpl: InterruptedClient}), error => error.gate === 'client_terminal' && error.accepted && error.closeCode === 1006);
});
