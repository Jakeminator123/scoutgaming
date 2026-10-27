import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { fileURLToPath } from 'node:url';
import { ENGINE_QA_SKIP, createEngineDatabase, engineBootFailure, freePort, insertCraigUser, startEngine } from './fixtures/engine-qa.mjs';

const game = 'https://game.example.test';
const bo = 'https://bo.example.test';
const lab = 'https://lab.example.test';
const username = 'pilot-admin';
const password = randomBytes(32).toString('base64url');
// The engine serves this public directory; calibration must never write into it.
const calibration = fileURLToPath(new URL('../services/game/public/calibration.css', import.meta.url));

async function fixture(t) {
  const database = await createEngineDatabase(t), port = await freePort();
  const env = { NODE_ENV: 'production', PUBLIC_URL: game, BO_URL: bo, LAB_PUBLIC_URL: lab, CROUPIER_CLOUD_RUNTIME: '1' };
  const users = async () => Number((await database.query('SELECT COUNT(*) AS n FROM croupier_auth.users'))[0].n);
  return { database, port, env, users };
}

function rejectedBoot(f, overrides = {}) {
  const result = engineBootFailure({ database: f.database, port: f.port, env: { ...f.env, ...overrides }, timeoutMs: 20000 });
  assert.equal(result.error, undefined, 'bootstrap must fail before the server listens');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Cloud operator bootstrap credentials are required/);
  assert.ok(!result.stdout.includes('croupier demo on'));
  assert.ok(!`${result.stdout}${result.stderr}`.includes(password), 'bootstrap secret reached child output');
}

const start = (t, f, overrides = {}) => startEngine(t, { database: f.database, port: f.port, env: { ...f.env, ...overrides } });

async function request(f, origin, path, body, cookie = '', method = 'POST') {
  const target = new URL(origin);
  return new Promise((resolveRequest, rejectRequest) => {
    const req = httpRequest(`http://127.0.0.1:${f.port}${path}`, {
      method, headers: { Host: target.host, Origin: target.origin, Cookie: cookie,
        'Content-Type': 'application/json' },
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolveRequest({ status: res.statusCode, headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', rejectRequest);
    req.end(JSON.stringify(body));
  });
}

test('empty cloud CRAIG fails closed for absent or weak bootstrap credentials', { skip: ENGINE_QA_SKIP }, async t => {
  const f = await fixture(t);
  rejectedBoot(f);
  rejectedBoot(f, { CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER: username,
    CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD: 'short' });
  rejectedBoot(f, { CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER: 'kevin',
    CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD: password });
  rejectedBoot(f, { CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER: 'Pilot-Admin',
    CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD: password });
  assert.equal(await f.users(), 0);
});

test('cloud creates one operator without logging the secret and preserves CRAIG on restart', { skip: ENGINE_QA_SKIP }, async t => {
  const f = await fixture(t);
  const first = await start(t, f, { CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER: username,
    CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD: password });
  assert.ok(!first.output().includes(password), 'bootstrap secret reached child output');
  assert.ok(!first.output().includes('password:'), 'cloud bootstrap logged a password');
  await first.stop();

  const [account] = await f.database.query('SELECT username,salt,hash,role FROM croupier_auth.users');
  assert.equal(account.username, username);
  assert.equal(account.role, 'superadmin');
  assert.equal(account.hash, scryptSync(password, account.salt, 64).toString('hex'));
  assert.equal(await f.users(), 1);
  await f.database.query("UPDATE croupier_auth.users SET role='admin' WHERE username=$1", [username]);
  await insertCraigUser(f.database, { username: 'pilot-reader', salt: 'isolated-reader-salt',
    password: 'Reader-Password-Only-In-This-Fixture', role: 'reader' });

  const second = await start(t, f);
  assert.ok(!second.output().includes(password), 'restart logged a bootstrap secret');
  const reader = await request(f, game, '/api/auth/login', {
    email: 'pilot-reader', password: 'Reader-Password-Only-In-This-Fixture',
  });
  assert.equal(reader.status, 200);
  const playerCookie = reader.headers['set-cookie']?.[0]?.split(';')[0];
  assert.match(playerCookie ?? '', /^player_session=/);
  const before = existsSync(calibration);
  const refused = await request(f, game, '/calibration', {}, playerCookie);
  assert.equal(refused.status, 403);
  assert.deepEqual(JSON.parse(refused.body), { error: 'calibration_unavailable' });
  assert.equal(existsSync(calibration), before, 'calibration never writes the served directory');
  await second.stop();

  assert.deepEqual(await f.database.query('SELECT username,role FROM croupier_auth.users ORDER BY username'), [
    { username, role: 'admin' }, { username: 'pilot-reader', role: 'reader' },
  ]);
});

test('local empty CRAIG creates no administrator or password log and preserves guest access', { skip: ENGINE_QA_SKIP }, async t => {
  const f = await fixture(t);
  const local = await start(t, f, { CROUPIER_CLOUD_RUNTIME: '', DEMO_GUEST_ACCESS: '1' });
  const session = await request(f, game, '/api/auth/session', undefined, '', 'GET');
  assert.equal(session.status, 200);
  const status = JSON.parse(session.body);
  assert.equal(status.guest, true);
  assert.equal(status.authenticated, false);
  assert.match(session.headers['set-cookie']?.[0] ?? '', /^preview_session=/);
  await local.stop();
  assert.doesNotMatch(local.output(), /backoffice login created|password:/i);
  assert.equal(await f.users(), 0);
});

test('local restarts preserve existing Kevin and other account roles and credentials', { skip: ENGINE_QA_SKIP }, async t => {
  const f = await fixture(t), existingPassword = randomBytes(24).toString('base64url');
  for (const [id, name, role] of [[41, 'kevin', 'reader'], [42, 'existing-operator', 'admin']]) {
    await insertCraigUser(f.database, { id, username: name, password: existingPassword, role });
  }
  const accountsQuery = 'SELECT * FROM croupier_auth.users ORDER BY id';
  const previous = await f.database.query(accountsQuery);
  for (let restart = 0; restart < 2; restart++) {
    const local = await start(t, f, { CROUPIER_CLOUD_RUNTIME: '' });
    await local.stop();
    assert.doesNotMatch(local.output(), /backoffice login created|password:/i);
    assert.ok(!local.output().includes(existingPassword), 'existing password reached child output');
    const accounts = await f.database.query(accountsQuery);
    assert.deepEqual(accounts.map(({id, username, role}) => ({id, username, role})),
      previous.map(({id, username, role}) => ({id, username, role})));
    assert.ok(accounts.every((row, i) => row.salt === previous[i].salt && row.hash === previous[i].hash
      && row.email === previous[i].email && row.created_at === previous[i].created_at), 'existing account data changed');
  }
});
