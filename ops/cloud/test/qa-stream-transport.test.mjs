import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {QA_SERVICE_ID, QA_PUBLIC_ORIGIN, QA_TRANSPORT_ORIGIN, FIXTURE_PROVIDER_ORIGIN, FIXTURE_CREDENTIAL, FIXTURE_ENDPOINT,
  TRANSPORT_SENTINEL, unpaidQaFetch, openSyntheticWorker, assertUnpaidQaEnvironment, verifyUnpaidWssTransport} from '../qa-stream-transport-preload.mjs';
import {unpaidQaSpecifications} from '../qa-stream-transport-start.mjs';

const env = {RENDER_SERVICE_ID: QA_SERVICE_ID, PUBLIC_URL: QA_PUBLIC_ORIGIN, CROUPIER_VERCEL_TRANSPORT_ORIGIN: QA_TRANSPORT_ORIGIN,
  NODE_ENV: 'production', OPENCLAW_PRODUCT_SPEECH_URL: FIXTURE_PROVIDER_ORIGIN, OPENCLAW_PRODUCT_SPEECH_TOKEN: FIXTURE_CREDENTIAL,
  CARTESIA_API_KEY: FIXTURE_CREDENTIAL, RUNPOD_API_KEY: FIXTURE_CREDENTIAL, CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID: FIXTURE_ENDPOINT,
  CROUPIER_GENERATED_SPEECH_STREAMING: '1', CROUPIER_CLOUD_GENERATED_SPEECH: '1', CROUPIER_GENERATED_SPEECH: '1', CROUPIER_MEDIA_STORAGE: 'disk'};

test('unpaid QA refuses other services, origins, real provider credentials and preload inheritance', () => {
  assertUnpaidQaEnvironment(env);
  for (const patch of [{RENDER_SERVICE_ID: 'production'}, {PUBLIC_URL: 'https://scoutgaming.tech'}, {RUNPOD_API_KEY: 'actual-provider-key'}, {CARTESIA_API_KEY: 'actual-provider-key'}, {CROUPIER_MEDIA_STORAGE: 'blob'}]) assert.throws(() => assertUnpaidQaEnvironment({...env, ...patch}));
  const specifications = {web: {args: ['web/server.mjs'], env: {...env}}, lab: {env: {unchanged: true}}};
  const transformed = unpaidQaSpecifications(specifications, env);
  assert.match(transformed.web.env.NODE_OPTIONS, /^--import=.*qa-stream-transport-preload\.mjs$/);
  assert.equal(transformed.lab, specifications.lab); assert.equal(specifications.web.env.NODE_OPTIONS, undefined);
  assert.throws(() => unpaidQaSpecifications(specifications, {...env, NODE_OPTIONS: '--require=foreign'}));
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
  class FixtureSocket extends EventEmitter {
    constructor(url, options) {super(); ws = this; this.sent = []; assert.equal(url, QA_PUBLIC_ORIGIN.replace('https:', 'wss:') + '/lipsync-worker'); assert.match(options.headers.Authorization, /^Bearer /); queueMicrotask(() => this.emit('open'));}
    send(...args) {this.sent.push(args);}
    terminate() {}
  }
  const input = {ws_url: QA_PUBLIC_ORIGIN.replace('https:', 'wss:') + '/lipsync-worker', ws_token: 'isolated-worker-secret'.repeat(3), worker_id: 'croupier-' + 'a'.repeat(32)};
  await openSyntheticWorker(input, {WebSocketImpl: FixtureSocket});
  ws.emit('message', Buffer.from('{"t":"start","id":"utterance"}'), false);
  assert.equal(ws.sent.length, 1);
  ws.emit('message', Buffer.alloc(4800), true);
  assert.deepEqual(ws.sent[1], [TRANSPORT_SENTINEL, {binary: true}]);
  ws.emit('message', Buffer.from('{"t":"end","id":"utterance"}'), false);
  assert.equal(JSON.parse(ws.sent[2][0]).syntheticTransport, true);
  await assert.rejects(openSyntheticWorker({...input, ws_url: QA_TRANSPORT_ORIGIN.replace('https:', 'wss:') + '/lipsync-worker'}, {WebSocketImpl: FixtureSocket}), /Invalid/);
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
