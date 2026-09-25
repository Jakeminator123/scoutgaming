import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

async function freePort() {
  const socket = createNetServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve)); return port;
}

test('product /chat sends only the server-owned public projection to OpenClaw', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-product-chat-'));
  const appPort = await freePort();
  const captured = [];
  const gateway = createHttpServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw); captured.push({ url: req.url, authorization: req.headers.authorization, body });
    const supplied = JSON.parse(body.messages.at(-1).content);
    const { requestId } = supplied.request;
    const { dealerId, sessionRevision, roundRevision } = supplied.status;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      kind: 'generatedText', requestId, dealerId, sessionRevision, roundRevision, text: 'Exakt neutralt svar.',
    }) } }] }));
  });
  gateway.listen(0, '127.0.0.1'); await once(gateway, 'listening');
  const gatewayPort = gateway.address().port;
  const web = fileURLToPath(new URL('../web/', import.meta.url));
  const server = spawn(process.execPath, [join(web, 'server.mjs')], {
    cwd: web,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(appPort), CROUPIER_DATA_DIR: directory,
      DEMO_GUEST_ACCESS: '1', OPENCLAW_BASE_URL: `http://127.0.0.1:${gatewayPort}`,
      OPENCLAWAPI_KEY: 'isolated-test-gateway-key', OPENCLAW_CHAT_AGENT: 'openclaw/croupier-chat',
      OPENCLAW_SPEECH_AGENT: 'openclaw/croupier-speech' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (server.exitCode === null) { const stopped = once(server, 'exit'); server.kill('SIGTERM'); await stopped; }
    await new Promise(resolve => gateway.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Product server did not start')), 10000);
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Product server exited ${code}`)); });
    server.stdout.on('data', chunk => { if (String(chunk).includes('croupier demo on')) { clearTimeout(timer); resolve(); } });
  });
  const origin = `http://127.0.0.1:${appPort}`;
  let cookie = '';
  async function post(path, value, expected = 200) {
    const response = await fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie }, body: JSON.stringify(value) });
    cookie = response.headers.getSetCookie().map(entry => entry.split(';')[0]).join('; ') || cookie;
    const result = await response.json(); assert.equal(response.status, expected, JSON.stringify(result)); return result;
  }
  await post('/api/player', {});
  let state = await post('/api/table', { op: 'state' });
  state = await post('/api/table', { op: 'start', version: state.version, requestId: crypto.randomUUID(),
    bets: [{ main: 5, pp: 0, tp: 0 }, ...Array.from({ length: 6 }, () => ({ main: 0, pp: 0, tp: 0 }))] });
  const requestId = crypto.randomUUID();
  const decision = await post('/chat', { requestId, message: 'Vad syns på bordet?', history: [], dealer: 'astrid',
    sessionRevision: crypto.randomUUID(), roundRevision: String(state.version) });
  assert.deepEqual(decision, { kind: 'generatedText', requestId, dealerId: 'astrid',
    sessionRevision: decision.sessionRevision, roundRevision: String(state.version), exactText: 'Exakt neutralt svar.',
    visualMode: 'neutral', provider: 'responded' });
  assert.equal(captured.length, 1);
  assert.equal(captured[0].url, '/v1/chat/completions');
  assert.equal(captured[0].authorization, 'Bearer isolated-test-gateway-key');
  assert.equal(captured[0].body.model, 'openclaw/croupier-speech');
  assert.equal(captured[0].body.tool_choice, 'none');
  const projection = JSON.parse(captured[0].body.messages.at(-1).content).status;
  const serialized = JSON.stringify(projection);
  assert.equal(serialized.includes('playerId'), false);
  assert.equal(serialized.includes('balance'), false);
  assert.equal(serialized.includes('holeCard'), false);
  assert.equal(serialized.includes('future'), false);
  assert.equal(serialized.includes('cookie'), false);
  assert.equal(serialized.includes('clip'), false);
  assert.equal(projection.displayName, 'Product preview');
  assert.equal(projection.visibleCards.dealer.cards.length, 1);
  assert.ok(projection.publishedEvents.some(event => event.type === 'deal' && event.faceDown && event.card === null));
  await post('/chat', { requestId: crypto.randomUUID(), message: 'Sent?', history: [], dealer: 'astrid',
    sessionRevision: crypto.randomUUID(), roundRevision: '0' }, 409);
  assert.equal(captured.length, 1, 'stale chat never reaches OpenClaw');
});
