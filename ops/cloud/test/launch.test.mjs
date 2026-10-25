import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { test } from 'node:test';
import { verifyCloudAccess, probeStatus } from '../access-check.mjs';
import { createCloudGateway } from '../gateway.mjs';
import { openCheckedGateway } from '../start.mjs';
import { closeGateway } from '../process-group.mjs';
import { createOperatorSpeechQa } from '../../../services/game/operator-speech-qa.mjs';

const config = { gameOrigin: 'https://game.example.test', boOrigin: 'https://bo.example.test',
  labOrigin: 'https://lab.example.test', publicPort: 0, streaming: false };
async function listening(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}
async function close(server) {
  if (!server.listening) return;
  const closed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  server.closeAllConnections();
  await closed;
}

async function fixture(change = {}, layout = config) {
  // Fake game API only: no product process or real database.
  const speechQa = createOperatorSpeechQa({ origin: layout.boOrigin, authenticate: async () => null,
    gateStore: { state() { throw new Error('Anonymous probe must not read the QA journal.'); } } });
  const web = createServer(async (request, response) => {
    if (!Object.hasOwn(change, request.url)
      && await speechQa.handle(request, response, request.url)) return;
    response.writeHead(change[request.url] ?? 401);
    response.end();
  });
  const webPort = await listening(web);
  const gateway = createCloudGateway(layout, { webPort });
  const gatewayPort = await listening(gateway);
  return { gatewayPort, gateway,
    close: () => Promise.all([gateway, web].map(close)) };
}

test('access probes pass with the real gateway and rejecting fixture children', async () => {
  const services = await fixture();
  try { await verifyCloudAccess(config, services); }
  finally { await services.close(); }
});

test('access probes also enforce BO authentication and the closed Studio boundary on one origin', async () => {
  const layout = { ...config, singleOrigin: true, boOrigin: config.gameOrigin,
    labOrigin: config.gameOrigin };
  const services = await fixture({}, layout);
  try { await verifyCloudAccess(layout, services); }
  finally { await services.close(); }
});

for (const [name, change] of [
  ['player authentication', { '/api/table': 200 }],
  ['BO speech QA authentication', { '/api/bo/speech-qa': 200 }],
]) test(`access probes fail closed if ${name} is broken`, async () => {
  const services = await fixture(change);
  try { await assert.rejects(verifyCloudAccess(config, services), new RegExp(name)); }
  finally { await services.close(); }
});

test('no public listener is opened when access checks fail', async () => {
  const gateway = createServer((_req, res) => res.end());
  const addresses = [];
  gateway.on('listening', () => addresses.push(gateway.address().address));
  await assert.rejects(openCheckedGateway(gateway, config, { checkAccess: async () => {
    assert.equal(gateway.address().address, '127.0.0.1');
    throw new Error('rejected access');
  } }), /rejected access/);
  assert.deepEqual(addresses, ['127.0.0.1']);
  assert.equal(gateway.listening, false);
});

test('public listener opens only after access checks complete', async () => {
  const gateway = createServer((_req, res) => res.end());
  const activity = [];
  gateway.on('listening', () => activity.push(gateway.address().address));
  try {
    await openCheckedGateway(gateway, config, { checkAccess: async (_config, { gatewayPort }) => {
      assert.equal(gatewayPort, gateway.address().port);
      activity.push('checked');
    } });
    assert.deepEqual(activity, ['127.0.0.1', 'checked', '0.0.0.0']);
  } finally { await close(gateway); }
});

test('interrupted checks cannot expose the public listener', async () => {
  const abort = new AbortController();
  const gateway = createServer();
  await assert.rejects(openCheckedGateway(gateway, config, {
    signal: abort.signal, checkAccess: async () => abort.abort(),
  }), /interrupted/);
  assert.equal(gateway.listening, false);
});

test('probe has a bounded deadline and does not reveal response contents', async () => {
  const server = createServer((_req, res) => { res.writeHead(200); res.write('private-fixture-data'); });
  const port = await listening(server);
  try {
    await assert.rejects(probeStatus({ port, host: 'game.example.test', path: '/', timeoutMs: 50 }),
      error => /Cloud access probe failed/.test(error.message) && !error.message.includes('private-fixture-data'));
  } finally { await close(server); }
});

test('an upgraded gateway connection cannot hold shutdown beyond the socket deadline', async t => {
  const gateway = createServer();
  let upgraded;
  gateway.on('upgrade', (_request, socket) => {
    upgraded = socket;
    socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
  });
  await openCheckedGateway(gateway, config, { checkAccess: async () => {} });
  const client = connect(gateway.address().port, '127.0.0.1');
  t.after(() => { client.destroy(); upgraded?.destroy(); gateway.closeAllConnections(); gateway.close(); });
  await once(client, 'connect');
  client.write('GET /fixture HTTP/1.1\r\nHost: game.example.test\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
  await once(client, 'data');
  const clientClosed = once(client, 'close');
  const started = performance.now();
  await closeGateway(gateway, 40);
  await clientClosed;
  assert.ok(performance.now() - started < 1000, 'upgraded sockets must actually close, not just HTTP keep-alives');
  assert.equal(upgraded.destroyed, true);
});

test('startup checks the Web-owned Studio session through signed Vercel ingress', async () => {
  const layout = { ...config, singleOrigin:true, boOrigin:config.gameOrigin, labOrigin:config.gameOrigin,
    vercelIngress:{ publicOrigin:config.gameOrigin, transportOrigin:'https://isolated.onrender.com', secret:'isolated-ingress-secret-'.repeat(3) } };
  for (const status of [401, 200, 503]) {
    const services = await fixture({ '/api/auth/lab/check':status }, layout);
    try {
      if (status === 401) await verifyCloudAccess(layout, services);
      else await assert.rejects(verifyCloudAccess(layout, services), /Studio session authentication/);
    } finally { await services.close(); }
  }
});
