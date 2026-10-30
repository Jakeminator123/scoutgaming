import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtureDatabaseUrl } from './fixtures/database-url.mjs';
import { childSpecifications, validateCloudConfig } from '../ops/cloud/config.mjs';
import { sharedRoomOrigins } from '../services/game/shared-room-origins.mjs';
import { createSharedRoomService } from '../services/game/shared-room-service.mjs';
import { createSharedRoomCommand } from '../services/game/shared-room-command.mjs';
import { createSharedRoomChannel } from '../services/game/shared-room-channel.mjs';
import { createSharedRoomPresentationBridge } from '../services/game/shared-room-presentation-http.mjs';

// Composition regression for the cloud boot with CROUPIER_SHARED_TABLE_ENABLED=1
// in the single-origin Vercel-ingress layout. No listener, database or provider
// is used: the real channel, upgrade, command and presentation bridge validate
// their origins at construction, which is where the game child died at startup.
const publicOrigin = 'https://example.vercel.app', transport = 'https://example.onrender.com';
const ingressEnv = () => ({
  NODE_ENV: 'production', PORT: '10000', CROUPIER_CLOUD_LAYOUT: 'single-origin',
  CROUPIER_GAME_DATABASE_URL: fixtureDatabaseUrl('postgresql://game.neon.tech/game?sslmode=require', 'game'),
  CROUPIER_STUDIO_ENVIRONMENT_ID: 'test', CROUPIER_STUDIO_WORKSPACE_ID: 'cloud-fixture',
  BLOB_READ_WRITE_TOKEN: 'fixture-private-blob-token',
  CROUPIER_CLOUD_DATA_ROOT: join(tmpdir(), 'croupier-shared-room-origin-fixture'),
  PUBLIC_URL: publicOrigin, RENDER_EXTERNAL_URL: transport,
  CROUPIER_PUBLIC_ORIGIN: publicOrigin, CROUPIER_VERCEL_TRANSPORT_ORIGIN: transport,
  CROUPIER_VERCEL_INGRESS_SECRET: 'isolated-ingress-fixture-'.repeat(3),
  CROUPIER_SHARED_TABLE_ENABLED: '1',
  OPENCLAW_PRODUCT_SPEECH_URL: 'https://speech.example.test', OPENCLAW_PRODUCT_SPEECH_TOKEN: 'fixture-only',
});
// The game child's own derivation (server.mjs) in a cloud runtime without QA context.
const childFrontendOrigin = env => env.CROUPIER_CLOUD_RUNTIME === '1' ? env.CROUPIER_VERCEL_FRONTEND_ORIGIN ?? '' : '';

class FakeWebSocketServer { handleUpgrade() {} close(done) { done(); } }
function compose({ origin, engineOrigin }) {
  const pool = { connect() { assert.fail('Composition must not open SQL'); }, query() {} };
  const service = createSharedRoomService({ pool, walletMode: 'demo', origin, engineOrigin,
    scope: { environment: 'test', workspaceId: 'cloud-fixture' }, auth: {}, repository: {}, WebSocketServer: FakeWebSocketServer }, {
    createAccess: () => ({ authorize() {}, revalidate() {} }),
    createReceiver: () => ({ assertInstalled() {}, sink() {}, current() {} }),
    createRuntime: () => ({ start() {}, stop() {}, health: () => ({}), coordinator: {} }),
    createPresentationAccess: () => ({}),
  });
  const command = createSharedRoomCommand({ service: { command: async () => assert.fail('origin gate only') }, origin, engineOrigin });
  const bridge = createSharedRoomPresentationBridge({ service: () => service, origin, engineOrigin });
  return { service, command, bridge };
}

test('single-origin ingress with shared tables composes the room stack on the canonical public origin', async () => {
  const env = ingressEnv();
  const config = validateCloudConfig(env);
  assert.throws(() => validateCloudConfig({ ...env, CROUPIER_VERCEL_FRONTEND_ORIGIN: publicOrigin }), /CROUPIER_VERCEL_FRONTEND_ORIGIN/,
    'this layout cannot name the frontend origin separately');
  const child = childSpecifications(config, env).web.env;
  assert.equal(child.CROUPIER_SHARED_TABLE_ENABLED, '1');
  assert.equal(child.CROUPIER_CLOUD_LAYOUT, 'single-origin');
  const frontendOrigin = childFrontendOrigin(child);
  assert.equal(frontendOrigin, '');
  // The pre-fix composition passed the empty frontend origin and the child exited before readiness.
  assert.throws(() => createSharedRoomChannel({ origin: frontendOrigin, authorize() {}, revalidate() {}, readSnapshot() {}, readPresentation() {} }));
  assert.throws(() => compose({ origin: frontendOrigin, engineOrigin: publicOrigin }));

  const origins = sharedRoomOrigins({ frontendOrigin, env: child });
  assert.deepEqual({ ...origins }, { origin: publicOrigin, engineOrigin: publicOrigin });
  const { service, command, bridge } = compose(origins);
  assert.equal(typeof bridge, 'object');
  // The browser Origin of the single public origin passes the command gate; a foreign one does not.
  const post = origin => command(new Request(`${publicOrigin}/api/shared-room/room-a/command`, { method: 'POST',
    headers: { host: new URL(publicOrigin).host, origin, 'content-type': 'application/json' }, body: '{}' }));
  assert.notEqual((await post(publicOrigin)).status, 403);
  assert.equal((await post('https://other.example.test')).status, 403);
  await service.close();
});

test('separate-hosts keeps its explicit frontend origin and QA keeps its injected origin', () => {
  const env = { CROUPIER_PUBLIC_ORIGIN: 'https://game.example.test', PUBLIC_URL: 'https://game.example.test' };
  assert.deepEqual({ ...sharedRoomOrigins({ frontendOrigin: 'https://frontend.example.test', env }) },
    { origin: 'https://frontend.example.test', engineOrigin: 'https://game.example.test' });
  assert.deepEqual({ ...sharedRoomOrigins({ frontendOrigin: '', env: { PUBLIC_URL: 'https://game.example.test' } }) },
    { origin: 'https://game.example.test', engineOrigin: 'https://game.example.test' });
  assert.deepEqual({ ...sharedRoomOrigins({ qaOrigin: 'http://127.0.0.1:4100', frontendOrigin: 'http://127.0.0.1:4100', env }) },
    { origin: 'http://127.0.0.1:4100', engineOrigin: 'http://127.0.0.1:4100' });
});

test('fallback origin stays exact: a trailing slash or missing public origin is still refused', () => {
  for (const env of [{ CROUPIER_PUBLIC_ORIGIN: `${publicOrigin}/` }, {}]) {
    const origins = sharedRoomOrigins({ frontendOrigin: '', env });
    assert.throws(() => compose(origins));
    assert.throws(() => createSharedRoomCommand({ service: { command() {} }, ...origins }), /Explicit canonical shared room origin required/);
  }
  assert.throws(() => compose(sharedRoomOrigins({ frontendOrigin: `${publicOrigin}/`, env: { CROUPIER_PUBLIC_ORIGIN: publicOrigin } })));
});
