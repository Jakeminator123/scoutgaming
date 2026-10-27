import {publishedChatStudio,withPublishedChatContext} from './fixtures/published-chat-authority.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { ENGINE_QA_SKIP, createEngineDatabase, installStudioRuntime, startEngine } from './fixtures/engine-qa.mjs';
const WebSocket = createRequire(new URL('../services/astrid-gpu-worker/gateway/package.json', import.meta.url))('ws');
const secret = 'isolated-http-worker-and-ticket-secret-32chars';
function messages(ws) {
  const values = [], waiters = [];
  ws.on('message', (data, binary) => { const value = binary ? data : JSON.parse(data.toString()); if (waiters.length) waiters.shift()(value); else values.push(value); });
  return () => values.length ? Promise.resolve(values.shift()) : new Promise(resolve => waiters.push(resolve));
}

// The engine runs on PostgreSQL with the Studio policy runtime, so the stream service
// claims, settles and cancels each request in the Studio speech journal
// (croupier_studio.speech_requests under its stream-session lease), not in a directory.
test('real product HTTP result survives into authenticated stream; memory forget cancels GPU', { skip: ENGINE_QA_SKIP, timeout: 60000 }, async t => {
  const database = await createEngineDatabase(t);
  const studio = await installStudioRuntime(t, database, publishedChatStudio);
  let engine, sockets = [];
  const llm = createServer(async (req, res) => {
    let raw = ''; for await (const c of req) raw += c;
    const body = JSON.parse(raw), base = JSON.parse(body.messages[1].content);
    let request = base.request;
    if (body.messages.length === 3) request = JSON.parse(body.messages[2].content.split('\n')[0]).request;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ kind: 'generatedText', requestId: request.requestId,
      dealerId: base.status.dealerId, sessionRevision: base.status.sessionRevision, roundRevision: base.status.roundRevision, text: 'Synthetic streaming reply.' }) } }] }));
  });
  llm.listen(0, '127.0.0.1'); await once(llm, 'listening');
  t.after(async () => {
    sockets.forEach(ws => ws.terminate());
    await engine?.stop();
    llm.closeAllConnections(); await new Promise(resolve => llm.close(resolve));
    // engine-qa drops this database and its role after the engine has exited.
    assert.match(database.name, /^croupier_engine_[a-f0-9]{12}$/, 'teardown removes only the fixture-owned database');
  });
  // Only OS paths and this env reach the engine (startEngine). Empty values still
  // override private file configuration, and the network preload rejects every
  // external host.
  const env = {};
  for (const key of ['OPENCLAW_PRODUCT_SPEECH_URL', 'OPENCLAW_PRODUCT_SPEECH_TOKEN',
    'OPENCLAW_MODEL_API_KEY', 'OPENCLAW_MODEL_BASE_URL', 'OPENCLAW_MODEL_ID', 'OPENCLAW_MODEL_API',
    'LAB_REMOTE_URL', 'LAB_REMOTE_TOKEN', 'CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID',
    'RUNPOD_API_KEY', 'RUNPOD_ENDPOINT_ID', 'ELEVENLABS_API_KEY', 'ELEVENLABS_OC_API']) env[key] = '';
  Object.assign(env, studio.env, { NODE_ENV: 'development', DEMO_GUEST_ACCESS: '1', CROUPIER_STREAM_LANE: '',
    CROUPIER_GENERATED_SPEECH: '1', CROUPIER_GENERATED_SPEECH_PREVIEW: '1', CROUPIER_GENERATED_SPEECH_STREAMING: '1',
    CROUPIER_SPEECH_STREAM_WORKER_SECRET: secret, CROUPIER_SPEECH_STREAM_TICKET_SECRET: `ticket-${secret}`, CARTESIA_API_KEY: 'isolated-test-key',
    OPENCLAW_BASE_URL: `http://127.0.0.1:${llm.address().port}`, OPENCLAWAPI_KEY: 'fixture-key', OPENCLAW_SPEECH_AGENT: 'openclaw/croupier-speech', OPENCLAW_CHAT_AGENT: 'openclaw/croupier-chat' });
  engine = await startEngine(t, { database, env,
    preload: [...studio.preload, new URL('./fixtures/generated-speech-stream-fetch.mjs', import.meta.url).href] });
  const origin = engine.origin;
  let cookie = '';
  const post = async (path, value, expected = 200) => {
    if(['/chat','/api/chat/memory/forget'].includes(path))value=withPublishedChatContext(value);
    const response = await fetch(origin + path, { method: 'POST', headers: { 'content-type': 'application/json', Origin: origin, Cookie: cookie }, body: JSON.stringify(value), signal: AbortSignal.timeout(5000) });
    cookie = response.headers.getSetCookie().map(v => v.split(';')[0]).join('; ') || cookie;
    const data = await response.json(); assert.equal(response.status, expected, JSON.stringify(data)); return data;
  };
  await post('/api/player', {}); const state = await post('/api/table', { op: 'state' });
  const worker = new WebSocket(origin.replace('http:', 'ws:') + '/lipsync-worker', { headers: { Authorization: `Bearer ${secret}`, 'X-Worker-Id': 'http-test' } }); sockets.push(worker);
  await once(worker, 'open');
  let currentId, starts = 0, pcm = 0, aborts = 0;
  const activity = new EventTarget();
  worker.on('message', (data, binary) => {
    if (binary) { pcm++; activity.dispatchEvent(new Event('pcm')); return; }
    const m = JSON.parse(data.toString());
    if (m.t === 'start') { currentId = m.id; starts++; worker.send(JSON.stringify({ t: 'stream', id: m.id, mime: 'video/mp4; codecs="avc1.64002a, mp4a.40.2"' })); }
    if (m.t === 'abort') { aborts++; worker.send(JSON.stringify({ t: 'done', id: m.id, aborted: true })); }
    if (m.t === 'end') worker.send(JSON.stringify({ t: 'done', id: m.id, frames: 24, ms: 1000 }));
  });
  const chat = capability => ({ requestId: crypto.randomUUID(), message: 'A test question.', history: [], dealer: 'astrid', sessionRevision: crypto.randomUUID(), roundRevision: String(state.version), ...(capability ? { acceptsSpeechStream: true } : {}) });
  const legacy = await post('/chat', chat(false)); assert.equal(legacy.speechStream, undefined);
  const result = await post('/chat', chat(true));
  assert.equal(result.visualMode, 'generated-lipsync-stream-preview'); assert.equal(starts, 0); assert.equal(engine.output().includes('FIXTURE_TTS_STARTED'), false);
  const d = result.speechStream;
  assert.equal(JSON.parse(Buffer.from(d.ticket.split('.')[0], 'base64url')).exp, d.expiresAt);
  const ws = new WebSocket(origin.replace('http:', 'ws:') + d.url, ['astrid-v2', `ticket.${d.ticket}`], { origin, headers: { Cookie: cookie } }); sockets.push(ws);
  const receive = messages(ws); assert.equal((await receive()).t, 'ready'); assert.equal((await receive()).t, 'stream');
  if (!pcm) await new Promise(resolve => activity.addEventListener('pcm', resolve, { once: true }));
  assert.equal(starts, 1); assert.ok(currentId); assert.ok(pcm > 0, 'own committed memory revision must remain valid after HTTP response ends');
  const closed = once(ws, 'close'); await post('/api/chat/memory/forget', { dealer: 'astrid' }); await closed;
  assert.equal(aborts, 1, 'memory invalidation cancels active worker');
  // Late attachment after a subsequent forget must be denied before TTS.
  const late = (await post('/chat', chat(true))).speechStream;
  await post('/api/chat/memory/forget', { dealer: 'astrid' });
  const rejected = new WebSocket(origin.replace('http:', 'ws:') + late.url, ['astrid-v2', `ticket.${late.ticket}`], { origin, headers: { Cookie: cookie } }); sockets.push(rejected);
  const error = await new Promise(resolve => rejected.once('error', resolve)); assert.match(error.message, /401/); assert.equal(starts, 1);
  const stolen = (await post('/chat', chat(true))).speechStream;
  const foreign = new WebSocket(origin.replace('http:', 'ws:') + stolen.url, ['astrid-v2', `ticket.${stolen.ticket}`], { origin }); sockets.push(foreign);
  const denied = await new Promise(resolve => foreign.once('error', resolve)); assert.match(denied.message, /401/); assert.equal(starts, 1);
});
