import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, getEventListeners, once } from 'node:events';
import { createServer, request as httpRequest } from 'node:http';
import { setTimeout as pause } from 'node:timers/promises';
import { createChatResponseStream } from '../services/game/chat-response-stream.mjs';
import { completeChatWithSpeech } from '../services/game/generated-speech-chat.mjs';
import { CHAT_STAGES, readChatResponse, chatFailureMessage, chatFailureCode } from '../packages/presentation/contracts/chat-response.mjs';

function stream(frames, fragment = 7) {
  const bytes = new TextEncoder().encode(frames.map(frame => JSON.stringify(frame) + '\n').join(''));
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += fragment) controller.enqueue(bytes.slice(i, i + fragment));
    controller.close();
  } }), { headers: { 'Content-Type': 'application/x-ndjson' } });
}
test('split UTF-8 progress frames precede one complete decision', async () => {
  const decision = { kind: 'generatedText', exactText: 'Välkommen, så roligt!' }, events = [], previews = [];
  assert.deepEqual(await readChatResponse(stream([
    { type: 'progress', stage: 'text', elapsedMs: 0 }, { type: 'progress', stage: 'voice', elapsedMs: 2345 },
    { type: 'preview', exactText: decision.exactText },
    { type: 'progress', stage: 'media', elapsedMs: 4000, metrics: { runpodDelayMs: 300, runpodExecutionMs: 900, videoBytes: 1024 } },
    { type: 'result', decision },
  ], 1), frame => events.push(frame.stage), text => previews.push(text)), decision);
  assert.deepEqual(events, ['text', 'voice', 'media']);
  assert.deepEqual(previews, [decision.exactText]);
});
test('transport and mid-stream failures are errors, never empty successful replies', async () => {
  await assert.rejects(readChatResponse(stream([{ type: 'progress', stage: 'voice', elapsedMs: 2 }])), /incomplete_chat_response/);
  await assert.rejects(readChatResponse(stream([{ type: 'error', error: 'generated_speech_timeout' }])), /generated_speech_timeout/);
  await assert.rejects(readChatResponse(new Response('{"error":"stale_round_revision"}', { status: 409 })), /stale_round_revision/);
  await assert.rejects(readChatResponse(stream([{ type: 'progress', stage: 'private-data', elapsedMs: 0 }])), /invalid_chat_response/);
  await assert.rejects(readChatResponse(stream([{ type: 'preview', exactText: 'Hello!' },
    { type: 'result', decision: { kind: 'generatedText', exactText: 'Goodbye!' } }])), /invalid_chat_response/);
  await assert.rejects(readChatResponse(stream([{ type: 'progress', stage: 'media', elapsedMs: 1,
    metrics: { privateKey: 1 } }])), /invalid_chat_response/);
});
test('legacy JSON clients work and failures get distinct explanations', async () => {
  const decision = { kind: 'silence' };
  assert.deepEqual(await readChatResponse(Response.json(decision)), decision);
  assert.match(chatFailureMessage('hidden'), /flik/);
  assert.match(chatFailureMessage('muted'), /ljudet/);
  assert.match(chatFailureMessage('stale_round_revision'), /Bordet/);
  assert.match(chatFailureMessage('generated_speech_timeout'), /lång tid/);
  assert.match(chatFailureMessage('generated_speech_daily_budget_exhausted'), /Dagens budget/);
  assert.doesNotMatch(chatFailureMessage('generated_speech_daily_budget_exhausted'), /Försök igen\./);
});

test('DOM failure diagnostics keep application codes and redact arbitrary upstream data', () => {
  for (const code of ['generated_speech_session_untracked_worker', 'generated_speech_session_provider_job_mismatch',
    'generated_speech_session_provider_forbidden', 'generated_speech_session_stop_timeout', 'stale_chat_memory',
    'moving_speech_frame_unavailable', 'moving_speech_socket_closed', 'moving_speech_timeout', 'invalid_moving_speech_chunk']) {
    assert.equal(chatFailureCode(code), code);
  }
  for (const error of [undefined, 'https://provider.test/?key=private', 'generated_speech_private_token_value',
    'moving_speech_private_token_value', 'Authorization: Bearer private', 'The spoken private reply']) assert.equal(chatFailureCode(error), 'chat_failed');
});

test('pre-admission application failures remain diagnosable without exposing upstream values', async () => {
  for (const code of ['generated_speech_voice_unavailable', 'generated_speech_voice_not_configured',
    'generated_speech_profile_invalid', 'generated_speech_profile_not_enabled',
    'generated_speech_reference_mismatch', 'generated_speech_moving_reference_unavailable',
    'generated_speech_moving_capacity_unverified', 'generated_speech_total_budget_exhausted',
    'generated_speech_recovery_required', 'generated_speech_lease_busy', 'moving_runpod_limits_changed']) {
    await assert.rejects(readChatResponse(stream([{type:'error',error:code}])), error => {
      assert.equal(chatFailureCode(error.message),code); return true;
    });
    assert.equal(chatFailureCode(code+' https://private.example/?token=secret'),'chat_failed');
  }
});

test('preparation progress never claims GPU admission and retains the legacy transport stage', async () => {
  const frames=[], failure=Error('generated_speech_voice_unavailable');
  await assert.rejects(completeChatWithSpeech({request:{requestId:'preparation-1'},status:{dealerId:'dragan'},
    owner:'owner',playerId:'fixture',readOwner:async()=>'owner',readStatus:async()=>{},
    decide:async()=>({kind:'generatedText',exactText:'Hej.'}),
    streamService:{prepare:async()=>{throw failure;}},
    onProgress:stage=>frames.push({type:'progress',stage,elapsedMs:0}),
  }),error=>error===failure);
  frames.push({type:'error',error:failure.message});
  const progress=[];
  await assert.rejects(readChatResponse(stream(frames),frame=>progress.push(frame.stage)),/voice_unavailable/);
  assert.deepEqual(progress,['text','video-queue']);
  assert.match(CHAT_STAGES['video-queue'],/Förbereder/);
  assert.doesNotMatch(CHAT_STAGES['video-queue'],/GPU|kö/i);
});

function responseFixture() {
  const response = new EventEmitter(), frames = [];
  Object.assign(response, { headersSent: false, destroyed: false, writableEnded: false,
    writableNeedDrain: false, writableLength: 0,
    writeHead() { this.headersSent = true; },
    write(value) { frames.push(JSON.parse(value)); return !this.writableNeedDrain; },
  });
  return { response, frames };
}

test('135-second admission repeats only public progress and stops before the final result', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const { response, frames } = responseFixture(), controller = new AbortController();
  let elapsed = 0;
  const output = createChatResponseStream(response, { signal: controller.signal, startedAt: 0, now: () => elapsed });
  output.frame({ type: 'preview', exactText: 'Hej.' });
  output.frame({ type: 'progress', stage: 'video-queue', elapsedMs: 0 });
  for (let i = 0; i < 9; i++) { elapsed += 15000; t.mock.timers.tick(15000); }
  assert.equal(frames.filter(frame => frame.type === 'progress').length, 10);
  assert.deepEqual(frames.at(-1), { type: 'progress', stage: 'video-queue', elapsedMs: 135000 });
  assert.ok(frames.slice(2).every(frame => Object.keys(frame).sort().join() === 'elapsedMs,stage,type'));
  output.frame({ type: 'progress', stage: 'ready', elapsedMs: elapsed });
  output.frame({ type: 'result', decision: { kind: 'generatedText', exactText: 'Hej.' } });
  const count = frames.length; t.mock.timers.tick(180000);
  assert.equal(frames.length, count);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  assert.equal(response.listenerCount('close'), 0); assert.equal(response.listenerCount('finish'), 0);
  assert.equal((await readChatResponse(stream(frames))).exactText, 'Hej.');
});

for (const ending of ['abort', 'close', 'finish', 'error', 'cleanup']) test(`heartbeat bounds slow-reader buffering and cleans up on ${ending}`, t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const { response, frames } = responseFixture(), controller = new AbortController();
  const output = createChatResponseStream(response, { signal: controller.signal });
  output.frame({ type: 'progress', stage: 'video-queue', elapsedMs: 0 });
  response.writableNeedDrain = true; t.mock.timers.tick(180000); assert.equal(frames.length, 1);
  response.writableNeedDrain = false; response.writableLength = 80;
  t.mock.timers.tick(15000); assert.equal(frames.length, 1);
  response.writableLength = 0; t.mock.timers.tick(15000); assert.equal(frames.length, 2);
  if (ending === 'abort') controller.abort();
  else if (ending === 'cleanup') output.close();
  else if (ending === 'error') output.frame({ type: 'error', error: 'chat_cancelled' });
  else response.emit(ending);
  const count = frames.length; t.mock.timers.tick(180000); assert.equal(frames.length, count);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  assert.equal(response.listenerCount('close'), 0); assert.equal(response.listenerCount('finish'), 0);
});

// Real HTTP bytes pass through a silent-origin timeout proxy and the production
// parser. Scale time only: 1.6 s preparation exceeds a 1 s idle limit; no providers.
for (const mode of ['success', 'no-heartbeat', 'stale', 'disconnect']) test(`cold preparation through an idle-limited proxy: ${mode}`, async t => {
  let preparations = 0, currentOwner = 'owner', preparationSignal, cancellations = 0, proxyTimeouts = 0;
  const origin = createServer(async (req, res) => {
    const controller = new AbortController();
    res.once('close', () => { if (!res.writableEnded) controller.abort(); });
    const output = createChatResponseStream(res, { signal: controller.signal, heartbeatMs: mode === 'no-heartbeat' ? 60000 : 100 });
    try {
      const decision = await completeChatWithSpeech({
        request: { requestId: 'isolated-transport' }, status: { dealerId: 'paow' }, owner: 'owner', playerId: 'fixture',
        readOwner: async () => currentOwner, readStatus: async () => {}, signal: controller.signal,
        decide: async () => ({ kind: 'generatedText', exactText: 'Hej.' }),
        streamService: { prepare: async ({ signal, beforeCostly }) => {
          await beforeCostly(); preparations++; preparationSignal = signal;
          signal.addEventListener('abort', () => cancellations++, { once: true });
          await pause(1600, undefined, { signal });
          return { kind: 'generated-speech-stream', dealerId: 'paow' };
        }, cancelOwner: () => cancellations++ },
        onProgress: stage => output.frame({ type: 'progress', stage, elapsedMs: 0 }),
        onDecision: exactText => output.frame({ type: 'preview', exactText }),
      });
      output.frame({ type: 'result', decision });
    } catch (error) { output.frame({ type: 'error', error: controller.signal.aborted ? 'chat_cancelled' : error.message }); }
    finally { output.close(); res.end(); }
  });
  origin.listen(0, '127.0.0.2'); await once(origin, 'listening');
  t.after(() => { origin.closeAllConnections(); origin.close(); });
  const proxy = createServer((req, res) => {
    const upstream = httpRequest({ hostname: '127.0.0.2', port: origin.address().port, path: '/chat' }, reply => {
      res.writeHead(reply.statusCode, reply.headers); reply.pipe(res);
      reply.on('error', () => res.destroy());
    });
    upstream.setTimeout(1000, () => { proxyTimeouts++; upstream.destroy(); res.destroy(); });
    upstream.on('error', () => res.destroy()); res.once('close', () => upstream.destroy()); upstream.end();
  });
  proxy.listen(0, '127.0.0.2'); await once(proxy, 'listening');
  t.after(() => { proxy.closeAllConnections(); proxy.close(); });
  const client = new AbortController(), stages = [];
  const response = await fetch(`http://127.0.0.2:${proxy.address().port}/chat`, { signal: client.signal });
  const result = readChatResponse(response, frame => {
    stages.push(frame.stage);
    if (frame.stage === 'video-queue' && stages.filter(stage => stage === 'video-queue').length === 2) {
      if (mode === 'stale') currentOwner = 'revoked';
      if (mode === 'disconnect') client.abort();
    }
  });
  if (mode === 'success') assert.equal((await result).speechStream.dealerId, 'paow');
  else if (mode === 'stale') await assert.rejects(result, /stale_chat_session/);
  else await assert.rejects(result);
  assert.equal(preparations, 1);
  if (mode === 'disconnect' || mode === 'no-heartbeat') {
    if (!preparationSignal.aborted) await once(preparationSignal, 'abort');
    assert.equal(cancellations, 1);
  }
  if (mode === 'stale') assert.equal(cancellations, 1);
  assert.equal(proxyTimeouts, Number(mode === 'no-heartbeat'));
  if (mode !== 'no-heartbeat') assert.ok(stages.filter(stage => stage === 'video-queue').length >= 2);
});
