import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
const WebSocket = createRequire(new URL('../services/astrid-gpu-worker/gateway/package.json', import.meta.url))('ws');
const secret = 'isolated-http-worker-and-ticket-secret-32chars';
function messages(ws) {
  const values = [], waiters = [];
  ws.on('message', (data, binary) => { const value = binary ? data : JSON.parse(data.toString()); if (waiters.length) waiters.shift()(value); else values.push(value); });
  return () => values.length ? Promise.resolve(values.shift()) : new Promise(resolve => waiters.push(resolve));
}
async function freePort() { const net = createNetServer(); net.listen(0, '127.0.0.1'); await once(net, 'listening'); const port = net.address().port; await new Promise(resolve => net.close(resolve)); return port; }

test('real product HTTP result survives into authenticated stream; memory forget cancels GPU', { timeout: 25000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-stream-http-'));
  const port = await freePort(), origin = `http://127.0.0.1:${port}`;
  let child, sockets = [], output = '', errors = '';
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
    if (child && child.exitCode === null) { const stopped = once(child, 'exit'); child.kill('SIGTERM'); await stopped; }
    llm.closeAllConnections(); await new Promise(resolve => llm.close(resolve));
    assert.equal(dirname(directory), resolve(tmpdir())); assert.match(basename(directory), /^croupier-stream-http-/); await rm(directory, { recursive: true, force: true });
  });
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(OPENCLAW|LAB_REMOTE|CROUPIER_GENERATED_SPEECH|CROUPIER_SPEECH_|RUNPOD|CARTESIA)/.test(key)) env[key] = '';
  // Empty values override private file configuration even when the parent shell
  // has never loaded it. The network preload also rejects every external host.
  for (const key of ['OPENCLAW_PRODUCT_SPEECH_URL', 'OPENCLAW_PRODUCT_SPEECH_TOKEN',
    'OPENCLAW_MODEL_API_KEY', 'OPENCLAW_MODEL_BASE_URL', 'OPENCLAW_MODEL_ID', 'OPENCLAW_MODEL_API',
    'LAB_REMOTE_URL', 'LAB_REMOTE_TOKEN', 'CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID',
    'RUNPOD_API_KEY', 'RUNPOD_ENDPOINT_ID', 'ELEVENLABS_API_KEY', 'ELEVENLABS_OC_API']) env[key] = '';
  Object.assign(env, { HOST: '127.0.0.1', PORT: String(port), NODE_ENV: 'development', CROUPIER_DATA_DIR: join(directory, 'db'),
    DEMO_GUEST_ACCESS: '1', CROUPIER_LISSABON_PROFILES: '', CROUPIER_STREAM_LANE: '', CROUPIER_ASTRID_CAMERA: '',
    CROUPIER_GENERATED_SPEECH: '1', CROUPIER_GENERATED_SPEECH_PREVIEW: '1', CROUPIER_GENERATED_SPEECH_STREAMING: '1', CROUPIER_GENERATED_SPEECH_DIR: join(directory, 'speech'),
    CROUPIER_SPEECH_STREAM_WORKER_SECRET: secret, CROUPIER_SPEECH_STREAM_TICKET_SECRET: `ticket-${secret}`, CARTESIA_API_KEY: 'isolated-test-key',
    OPENCLAW_BASE_URL: `http://127.0.0.1:${llm.address().port}`, OPENCLAWAPI_KEY: 'fixture-key', OPENCLAW_SPEECH_AGENT: 'openclaw/croupier-speech', OPENCLAW_CHAT_AGENT: 'openclaw/croupier-chat' });
  child = spawn(process.execPath, ['--import', new URL('./fixtures/generated-speech-stream-fetch.mjs', import.meta.url).href, fileURLToPath(new URL('../web/server.mjs', import.meta.url))], {
    cwd: fileURLToPath(new URL('../web/', import.meta.url)), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { errors += b; });
  await new Promise((resolve, reject) => {
    // 30 s: server.mjs now imports the operator package reader and player surface at
    // boot; under the full pre-commit hook the 10 s budget tripped on 8 Oct.
    const timer = setTimeout(() => reject(Error('Product fixture did not start')), 30000);
    child.once('exit', code => { clearTimeout(timer); reject(Error(`Product fixture exited ${code}: ${errors}`)); });
    child.stdout.on('data', b => { if (String(b).includes('croupier demo on')) { clearTimeout(timer); resolve(); } });
  });
  let cookie = '';
  const post = async (path, value, expected = 200) => {
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
  assert.equal(result.visualMode, 'generated-lipsync-stream-preview'); assert.equal(starts, 0); assert.equal(output.includes('FIXTURE_TTS_STARTED'), false);
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
