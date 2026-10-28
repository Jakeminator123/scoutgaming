import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateCloudConfig, childSpecifications } from '../config.mjs';
import { upstreamForRequest } from '../gateway.mjs';

const origin = 'https://croupier-fixture.onrender.com';
const env = {
  NODE_ENV: 'production', PORT: '10000', CROUPIER_CLOUD_LAYOUT: 'single-origin',
  CROUPIER_DATABASE:'postgres',CROUPIER_GAME_DATABASE_URL:'postgresql://game:fixture-password@game.neon.tech/game?sslmode=require',
  CROUPIER_STUDIO_NEON_POLICY:'1',CROUPIER_STUDIO_ENVIRONMENT_ID:'test',CROUPIER_STUDIO_WORKSPACE_ID:'cloud-fixture',
  CROUPIER_MEDIA_STORAGE:'blob',BLOB_READ_WRITE_TOKEN:'fixture-private-blob-token',
  RENDER_EXTERNAL_URL: origin, CROUPIER_CLOUD_DATA_ROOT: join(tmpdir(), 'cloud-fixture'),
  CROUPIER_STREAM_LANE: 'lissabon-stream-lane',
  OPENCLAW_PRODUCT_SPEECH_URL: 'https://speech.example.test', OPENCLAW_PRODUCT_SPEECH_TOKEN: 'fixture-only',
};

test('explicit one-origin mode derives exact platform origin and preserves secret separation', () => {
  const config = validateCloudConfig(env);
  assert.equal(config.gameOrigin, origin);
  assert.equal(config.boOrigin, origin);
  assert.equal(config.labOrigin, origin);
  const specs = childSpecifications(config, env);
  assert.equal(specs.web.env.CROUPIER_CLOUD_LAYOUT, 'single-origin');
  assert.deepEqual(Object.keys(specs), ['web']);
  assert.equal(specs.web.env.CROUPIER_LAB_INTERNAL_SECRET, undefined);
  for (const override of [{ CROUPIER_CLOUD_LAYOUT: '' }, { BO_URL: 'https://other.example.test' },
    { RENDER_EXTERNAL_URL: 'http://localhost' }]) {
    assert.throws(() => validateCloudConfig({ ...env, ...override }));
  }
});

test('one-origin router isolates the mounted Lab and rejects spoofing or internal identity access', () => {
  const config = validateCloudConfig(env);
  const route = (url, host = new URL(origin).host) => upstreamForRequest({ headers: { host }, method: 'GET', url }, config);
  for (const path of ['/', '/blackjack', '/api/table', '/bo/login.html', '/api/bo/users', '/api/auth/lab/start']) assert.equal(route(path), 4173, path);
  for (const path of ['/studio', '/studio/openclaw', '/studio/api/project', '/studio/_next/static/example.js']) assert.equal(route(path), null, path);
  for (const path of ['/api/auth/lab/check', '/api/auth/lab/%63heck', '/%73tudio/api/project', '/STUDIO/api/project', '/studio%2fapi/project', '//external.test/studio']) assert.equal(route(path), null, path);
  assert.equal(route('/studio', 'other.onrender.com'), null);
});

test('one-origin game-only mode keeps the Web routes and closes the mounted Lab entirely', () => {
  const gameOnly = { ...env, CROUPIER_CLOUD_LAB_CHILD: '0' };
  const config = validateCloudConfig(gameOnly);
  assert.equal(config.singleOrigin, true);
  const route = (url, host = new URL(origin).host) => upstreamForRequest({ headers: { host }, method: 'GET', url }, config);
  for (const path of ['/', '/blackjack', '/api/table', '/bo/login.html', '/api/bo/users', '/api/auth/lab/start', '/api/bo/lab-login?state=x']) assert.equal(route(path), 4173, path);
  for (const path of ['/studio', '/studio/openclaw', '/studio/api/project', '/studio/_next/static/example.js', '/api/auth/lab/check']) assert.equal(route(path), null, path);
  const specs = childSpecifications(config, gameOnly);
  assert.deepEqual(Object.keys(specs), ['web']);
  assert.equal(specs.web.env.CROUPIER_CLOUD_LAYOUT, 'single-origin');
  assert.equal(specs.web.env.LAB_PUBLIC_URL, origin);
  // Retired base-path configuration cannot create a second process.
  const obsolete = { ...gameOnly, CROUPIER_LAB_BASE_PATH:'/other-studio' };
  assert.deepEqual(Object.keys(childSpecifications(validateCloudConfig(obsolete), obsolete)), ['web']);
});
