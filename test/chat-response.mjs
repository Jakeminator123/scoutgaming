import test from 'node:test';
import assert from 'node:assert/strict';
import { readChatResponse, chatFailureMessage } from '../web/public/chat-response.mjs';

function stream(frames, fragment = 7) {
  const bytes = new TextEncoder().encode(frames.map(frame => JSON.stringify(frame) + '\n').join(''));
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += fragment) controller.enqueue(bytes.slice(i, i + fragment));
    controller.close();
  } }), { headers: { 'Content-Type': 'application/x-ndjson' } });
}
test('split UTF-8 progress frames precede one complete decision', async () => {
  const decision = { kind: 'generatedText', exactText: 'Välkommen, så roligt!' }, events = [];
  assert.deepEqual(await readChatResponse(stream([
    { type: 'progress', stage: 'text', elapsedMs: 0 }, { type: 'progress', stage: 'voice', elapsedMs: 2345 },
    { type: 'result', decision },
  ], 1), frame => events.push(frame.stage)), decision);
  assert.deepEqual(events, ['text', 'voice']);
});
test('transport and mid-stream failures are errors, never empty successful replies', async () => {
  await assert.rejects(readChatResponse(stream([{ type: 'progress', stage: 'voice', elapsedMs: 2 }])), /incomplete_chat_response/);
  await assert.rejects(readChatResponse(stream([{ type: 'error', error: 'generated_speech_timeout' }])), /generated_speech_timeout/);
  await assert.rejects(readChatResponse(new Response('{"error":"stale_round_revision"}', { status: 409 })), /stale_round_revision/);
  await assert.rejects(readChatResponse(stream([{ type: 'progress', stage: 'private-data', elapsedMs: 0 }])), /invalid_chat_response/);
});
test('legacy JSON clients work and failures get distinct explanations', async () => {
  const decision = { kind: 'silence' };
  assert.deepEqual(await readChatResponse(Response.json(decision)), decision);
  assert.match(chatFailureMessage('hidden'), /flik/);
  assert.match(chatFailureMessage('muted'), /ljudet/);
  assert.match(chatFailureMessage('stale_round_revision'), /Bordet/);
  assert.match(chatFailureMessage('generated_speech_timeout'), /lång tid/);
});
