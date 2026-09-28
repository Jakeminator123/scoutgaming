import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { validateCloudConfig } from '../config.mjs';
import { createCloudGateway } from '../gateway.mjs';
import { attachSpeechRelay } from '../../../services/astrid-gpu-worker/gateway/relay.mjs';
import { issueTicket, ticketAuthenticator } from '../../../services/astrid-gpu-worker/gateway/auth.mjs';

const requireWorker = createRequire(new URL('../../../services/astrid-gpu-worker/gateway/package.json', import.meta.url));
const WebSocket = requireWorker('ws');
const workerSecret = 'fixture-worker-secret-longer-than-32-characters';
const ticketSecret = 'fixture-ticket-secret-longer-than-32-characters';
const origin = 'https://game.example.test';
const configuration = () => validateCloudConfig({
  NODE_ENV: 'production', PORT: '10000', CROUPIER_CLOUD_DATA_ROOT: join(tmpdir(), 'croupier-cloud-ws-fixture'),
  PUBLIC_URL: origin, BO_URL: 'https://bo.example.test', LAB_PUBLIC_URL: 'https://lab.example.test',
  CROUPIER_GAME_ORIGIN: origin, BETTALOTTO_PARTNER_BASE_URL: origin,
  CROUPIER_STREAM_LANE: 'lissabon-stream-lane', OPENCLAW_PRODUCT_SPEECH_URL: 'https://speech.example.test',
  OPENCLAW_PRODUCT_SPEECH_TOKEN: 'fixture-token', CROUPIER_GENERATED_SPEECH: '1',
  CROUPIER_CLOUD_GENERATED_SPEECH: '1', CROUPIER_GENERATED_SPEECH_STREAMING: '1',
  CARTESIA_API_KEY: 'fixture-key', RUNPOD_API_KEY: 'fixture-key',
  CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID: 'fixture-endpoint',
  CROUPIER_SPEECH_STREAM_WORKER_SECRET: workerSecret,
  CROUPIER_SPEECH_STREAM_TICKET_SECRET: ticketSecret,
});

function connect(url, path, { host = 'game.example.test', clientOrigin, authorization, workerId, ticket, cookie } = {}) {
  const headers = { Host: host, ...(clientOrigin ? { Origin: clientOrigin } : {}),
    ...(authorization ? { Authorization: authorization } : {}),
    ...(workerId ? { 'X-Worker-Id': workerId } : {}), ...(cookie ? { Cookie: cookie } : {}) };
  return new WebSocket(`${url}${path}`, ticket ? ['astrid-v2', `ticket.${ticket}`] : undefined,
    { headers });
}

const rejected = ws => new Promise(resolve => ws.once('error', error => resolve(error.message)));

test('cloud gateway admits only owned game WebSockets and preserves relay cancellation', { timeout: 10000 }, async t => {
  const web = createServer();
  const authenticate = ticketAuthenticator(ticketSecret);
  const relay = attachSpeechRelay(web, { workerSecret, allowedOrigins: [origin],
    authenticateClient: req => req.headers.cookie === 'player=owner'
      ? authenticate(req) : null, allowClientPCM: true });
  web.listen(0, '127.0.0.1'); await once(web, 'listening');
  const gateway = createCloudGateway(configuration(), { labInternalSecret: ticketSecret,
    webPort: web.address().port });
  gateway.listen(0, '127.0.0.1'); await once(gateway, 'listening');
  const url = `ws://127.0.0.1:${gateway.address().port}`;
  const sockets = [];
  t.after(async () => {
    sockets.forEach(ws => ws.terminate()); relay.close();
    await Promise.all([gateway, web].map(server => new Promise(resolve => server.close(resolve))));
  });
  const open = (path, options) => { const ws = connect(url, path, options); sockets.push(ws); return ws; };
  assert.match(await rejected(open('/lipsync-worker', { workerId: 'bad' })), /403/);
  assert.match(await rejected(open('/lipsync-worker', { host: 'bo.example.test',
    authorization: `Bearer ${workerSecret}`, workerId: 'bad-host' })), /421/);
  const worker = open('/lipsync-worker', { authorization: `Bearer ${workerSecret}`, workerId: 'gpu-fixture' });
  await once(worker, 'open');
  assert.equal(relay.status().available, 1);
  const ticket = issueTicket(ticketSecret, { userId: 'owner', sessionId: 'turn' });
  assert.match(await rejected(open('/speech-stream', { clientOrigin: 'https://evil.example.test', ticket, cookie: 'player=owner' })), /421/);
  assert.match(await rejected(open('/speech-stream', { clientOrigin: origin, ticket, cookie: 'player=other' })), /401/);
  const client = open('/speech-stream', { clientOrigin: origin, ticket, cookie: 'player=owner' });
  const [ready] = await once(client, 'message');
  assert.equal(JSON.parse(ready.toString()).t, 'ready');
  assert.equal(relay.status().busy, 1);
  client.close(); await once(client, 'close');
  const deadline = Date.now() + 1000;
  while (relay.status().busy && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(relay.status().available, 1);
});

test('cloud gateway rejects speech upgrades when streaming is disabled', { timeout: 5000 }, async () => {
  const config = { ...configuration(), streaming: false };
  const gateway = createCloudGateway(config, { labInternalSecret: ticketSecret });
  gateway.listen(0, '127.0.0.1'); await once(gateway, 'listening');
  try {
    const url = `ws://127.0.0.1:${gateway.address().port}`;
    assert.match(await rejected(connect(url, '/speech-stream', { clientOrigin: origin })), /421/);
  } finally { await new Promise(resolve => gateway.close(resolve)); }
});
