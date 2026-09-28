import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { validateCloudConfig, childSpecifications } from '../config.mjs';
import { upstreamForRequest } from '../gateway.mjs';
import { backofficeLabAuth } from '../../../web/bo-lab-auth.mjs';

const origin = 'https://croupier-fixture.onrender.com';
const env = {
  NODE_ENV: 'production', PORT: '10000', CROUPIER_CLOUD_LAYOUT: 'single-origin',
  RENDER_EXTERNAL_URL: origin, CROUPIER_CLOUD_DATA_ROOT: join(tmpdir(), 'cloud-fixture'),
  CROUPIER_STREAM_LANE: 'lissabon-stream-lane',
  OPENCLAW_PRODUCT_SPEECH_URL: 'https://speech.example.test', OPENCLAW_PRODUCT_SPEECH_TOKEN: 'fixture-only',
};

test('explicit one-origin mode derives exact platform origin and preserves secret separation', () => {
  const config = validateCloudConfig(env);
  assert.equal(config.gameOrigin, origin);
  assert.equal(config.boOrigin, origin);
  assert.equal(config.labOrigin, origin);
  assert.equal(config.labBasePath, '/studio');
  const specs = childSpecifications(config, env, { labInternalSecret: 'a'.repeat(64) });
  assert.equal(specs.web.env.CROUPIER_CLOUD_LAYOUT, 'single-origin');
  assert.equal(specs.lab.env.CROUPIER_LAB_BASE_PATH, '/studio');
  assert.equal(specs.web.env.CROUPIER_LAB_INTERNAL_SECRET, undefined);
  for (const override of [{ CROUPIER_CLOUD_LAYOUT: '' }, { BO_URL: 'https://other.example.test' },
    { RENDER_EXTERNAL_URL: 'http://localhost' }, { CROUPIER_LAB_BASE_PATH: '' }]) {
    assert.throws(() => validateCloudConfig({ ...env, ...override }));
  }
});

test('one-origin router isolates the mounted Lab and rejects spoofing or internal identity access', () => {
  const config = validateCloudConfig(env);
  const route = (url, host = new URL(origin).host) => upstreamForRequest({ headers: { host }, method: 'GET', url }, config);
  for (const path of ['/', '/blackjack', '/api/table', '/bo/login.html', '/api/bo/users', '/api/auth/lab/start']) assert.equal(route(path), 4173, path);
  for (const path of ['/studio', '/studio/openclaw', '/studio/api/project', '/studio/_next/static/example.js']) assert.equal(route(path), 4188, path);
  for (const path of ['/api/auth/lab/check', '/api/auth/lab/%63heck', '/%73tudio/api/project', '/STUDIO/api/project', '/studio%2fapi/project', '//external.test/studio']) assert.equal(route(path), null, path);
  assert.equal(route('/studio', 'other.onrender.com'), null);
});

test('same-origin BO/Lab handoff still checks admin role, browser state, one-use code and live identity', () => {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, role TEXT); INSERT INTO users VALUES ('1','admin')");
  let claims = null;
  const handle = backofficeLabAuth({ db, singleOrigin: true, publicUrl: origin, boUrl: origin, labPublicUrl: origin,
    boSession: () => claims, identity: { stamp: () => 'fixture-stamp', find: () => ({ id: '1', stamp: 'fixture-stamp' }) }, authEpoch: () => 1 });
  const call = (url, cookie = '') => {
    const result = {};
    handle({ url, method: 'GET', headers: { host: new URL(origin).host, cookie }, socket: { remoteAddress: '127.0.0.1' } },
      { writeHead(status, headers) { result.status = status; result.headers = headers; }, end() {} });
    return result;
  };
  try {
    const start = call('/api/auth/lab/start?next=/studio/openclaw');
    const auth = start.headers.Location;
    const stateCookie = start.headers['Set-Cookie'].split(';')[0];
    assert.equal(call(auth).status, 303);
    assert.match(call(auth).headers.Location, /^\/bo\/login/);
    claims = { sub: '1', role: 'admin', aud: 'backoffice', source_stamp: 'fixture-stamp', auth_epoch: 1, exp: Date.now() / 1000 + 600 };
    const grant = call(auth);
    assert.equal(grant.status, 303);
    assert.equal(call(grant.headers.Location).status, 400);
    const callback = call(grant.headers.Location, stateCookie);
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.Location, '/studio/openclaw');
    const session = callback.headers['Set-Cookie'].find(value => value.startsWith('lab_session=')).split(';')[0];
    assert.equal(call('/api/auth/lab/check', session).status, 200);
    assert.equal(call(grant.headers.Location, stateCookie).status, 400);
    db.exec("UPDATE users SET role='reader'");
    assert.equal(call('/api/auth/lab/check', session).status, 401);
    const fallback = call('/api/auth/lab/start?next=/api/bo/users');
    assert.equal(db.prepare('SELECT next_path FROM bo_lab_handoffs ORDER BY rowid DESC LIMIT 1').get().next_path, '/studio');
    assert.equal(fallback.status, 303);
  } finally { db.close(); }
});
