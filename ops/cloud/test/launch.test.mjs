import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { verifyCloudAccess, probeStatus } from '../access-check.mjs';
import { createCloudGateway } from '../gateway.mjs';
import { openCheckedGateway } from '../start.mjs';

const config = { gameOrigin: 'https://game.example.test', boOrigin: 'https://bo.example.test',
  labOrigin: 'https://lab.example.test', publicPort: 0, streaming: false };
const secret = 'fixture-private-lab-secret-longer-than-32-characters';
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
  // Fake child APIs only: no game/Lab product processes or real databases.
  const web = createServer((request, response) => {
    response.writeHead(change[request.url] ?? 401);
    response.end();
  });
  const lab = createServer((_request, response) => {
    response.writeHead(change.labDirect ?? 403);
    response.end();
  });
  const webPort = await listening(web), labPort = await listening(lab);
  const gateway = createCloudGateway(layout, { labInternalSecret: secret, webPort, labPort });
  const gatewayPort = await listening(gateway);
  return { labPort, gatewayPort, gateway,
    close: () => Promise.all([gateway, web, lab].map(close)) };
}

test('access probes pass with the real gateway and rejecting fixture children', async () => {
  const services = await fixture();
  try { await verifyCloudAccess(config, services); }
  finally { await services.close(); }
});

test('access probes also enforce BO and mounted Lab authentication on one origin', async () => {
  const layout = { ...config, singleOrigin: true, boOrigin: config.gameOrigin,
    labOrigin: config.gameOrigin, labBasePath: '/studio' };
  const services = await fixture({}, layout);
  try { await verifyCloudAccess(layout, services); }
  finally { await services.close(); }
});

for (const [name, change] of [
  ['player authentication', { '/api/table': 200 }],
  ['BO speech QA authentication', { '/api/bo/speech-qa': 200 }],
  ['Lab forged session', { '/api/auth/lab/check': 200 }],
  ['Lab direct access', { labDirect: 200 }],
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
