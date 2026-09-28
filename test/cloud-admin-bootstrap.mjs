import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, scryptSync } from 'node:crypto';
import { once } from 'node:events';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { copyOpenClawRuntime } from './fixtures/copy-openclaw-runtime.mjs';

const game = 'https://game.example.test';
const bo = 'https://bo.example.test';
const lab = 'https://lab.example.test';
const web = new URL('../web/', import.meta.url);
const publicWeb = new URL('../web/public/', import.meta.url);
const username = 'pilot-admin';
const password = randomBytes(32).toString('base64url');

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'croupier-cloud-bootstrap-'));
  const webDir = join(root, 'web');
  const dataDir = join(root, 'data');
  const calibration = join(webDir, 'public', 'calibration.css');
  const children = [];
  t.after(async () => {
    for (const child of children) await stop(child);
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(basename(root).startsWith('croupier-cloud-bootstrap-'));
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(webDir, 'public'), { recursive: true });
  await mkdir(dataDir);
  await writeFile(calibration, '/* fixture calibration */\n');
  await copyOpenClawRuntime(root);
  for (const file of await readdir(web)) {
    if (file.endsWith('.mjs')) await copyFile(new URL(file, web), join(webDir, file));
  }
  for (const file of await readdir(publicWeb)) {
    if (file.endsWith('.mjs')) await copyFile(new URL(file, publicWeb), join(webDir, 'public', file));
  }
  const portSocket = createServer();
  portSocket.listen(0, '127.0.0.1');
  await once(portSocket, 'listening');
  const port = portSocket.address().port;
  await new Promise(resolveClose => portSocket.close(resolveClose));
  const env = { PATH: process.env.PATH ?? process.env.Path ?? '', NODE_ENV: 'production',
    HOST: '127.0.0.1', PORT: String(port), PUBLIC_URL: game, BO_URL: bo, LAB_PUBLIC_URL: lab,
    CROUPIER_DATA_DIR: dataDir, CROUPIER_CLOUD_RUNTIME: '1' };
  return { root, webDir, dataDir, calibration, port, env, children };
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const ended = once(child, 'exit').catch(() => {});
  child.kill();
  await Promise.race([ended, new Promise(resolveWait => setTimeout(resolveWait, 3000))]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await ended;
  }
}

function rejectedBoot(f, overrides = {}) {
  const result = spawnSync(process.execPath, [join(f.webDir, 'server.mjs')], {
    cwd: f.webDir, env: { ...f.env, ...overrides }, encoding: 'utf8', timeout: 10000,
    windowsHide: true,
  });
  assert.equal(result.error, undefined, 'bootstrap must fail before the server listens');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Cloud operator bootstrap credentials are required/);
  assert.ok(!result.stdout.includes('croupier demo on'));
  assert.ok(!`${result.stdout}${result.stderr}`.includes(password), 'bootstrap secret reached child output');
}

async function start(f, overrides = {}) {
  const child = spawn(process.execPath, [join(f.webDir, 'server.mjs')], {
    cwd: f.webDir, env: { ...f.env, ...overrides }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  f.children.push(child);
  let stdout = '', stderr = '';
  await new Promise((resolveReady, rejectReady) => {
    const timer = setTimeout(() => rejectReady(new Error('isolated Web fixture did not start')), 10000);
    const fail = () => { clearTimeout(timer); rejectReady(new Error('isolated Web fixture exited before ready')); };
    child.once('error', fail);
    child.once('exit', fail);
    child.stdout.on('data', chunk => {
      stdout += chunk;
      if (stdout.includes('croupier demo on')) { clearTimeout(timer); child.off('exit', fail); child.off('error', fail); resolveReady(); }
    });
    child.stderr.on('data', chunk => { stderr += chunk; });
  });
  return { child, output: () => stdout + stderr };
}

async function request(f, origin, path, body, cookie = '') {
  const target = new URL(origin);
  return new Promise((resolveRequest, rejectRequest) => {
    const req = httpRequest(`http://127.0.0.1:${f.port}${path}`, {
      method: 'POST', headers: { Host: target.host, Origin: target.origin, Cookie: cookie,
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

test('empty cloud CRAIG fails closed for absent or weak bootstrap credentials', async t => {
  const f = await fixture(t);
  rejectedBoot(f);
  rejectedBoot(f, { CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER: username,
    CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD: 'short' });
  rejectedBoot(f, { CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER: 'kevin',
    CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD: password });
  rejectedBoot(f, { CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER: 'Pilot-Admin',
    CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD: password });
  const db = new DatabaseSync(join(f.dataDir, 'craig.db'));
  try { assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 0); }
  finally { db.close(); }
});

test('cloud creates one operator without logging the secret and preserves CRAIG on restart', async t => {
  const f = await fixture(t);
  const first = await start(f, { CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER: username,
    CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD: password });
  assert.ok(!first.output().includes(password), 'bootstrap secret reached child output');
  assert.ok(!first.output().includes('password:'), 'cloud bootstrap logged a password');
  const login = await request(f, bo, '/api/bo/login', { user: username, pass: password });
  assert.equal(login.status, 200);
  assert.match(login.headers['set-cookie']?.[0] ?? '', /^bo_jwt=/);
  await stop(first.child);

  const db = new DatabaseSync(join(f.dataDir, 'craig.db'));
  try {
    const account = db.prepare('SELECT username,salt,hash,role FROM users').get();
    assert.equal(account.username, username);
    assert.equal(account.role, 'superadmin');
    assert.equal(account.hash, scryptSync(password, account.salt, 64).toString('hex'));
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
    db.prepare("UPDATE users SET role='admin' WHERE username=?").run(username);
    const salt = 'isolated-reader-salt';
    db.prepare('INSERT INTO users (username,salt,hash,role,created_at) VALUES (?,?,?,?,?)').run(
      'pilot-reader', salt, scryptSync('Reader-Password-Only-In-This-Fixture', salt, 64).toString('hex'),
      'reader', new Date().toISOString());
  } finally { db.close(); }

  const second = await start(f);
  assert.ok(!second.output().includes(password), 'restart logged a bootstrap secret');
  const reader = await request(f, game, '/api/auth/login', {
    email: 'pilot-reader', password: 'Reader-Password-Only-In-This-Fixture',
  });
  assert.equal(reader.status, 200);
  const playerCookie = reader.headers['set-cookie']?.[0]?.split(';')[0];
  assert.match(playerCookie ?? '', /^player_session=/);
  const before = await readFile(f.calibration, 'utf8');
  const calibration = await request(f, game, '/calibration', {}, playerCookie);
  assert.equal(calibration.status, 403);
  assert.deepEqual(JSON.parse(calibration.body), { error: 'calibration_unavailable' });
  assert.equal(await readFile(f.calibration, 'utf8'), before);
  await stop(second.child);

  const reloaded = new DatabaseSync(join(f.dataDir, 'craig.db'));
  try {
    assert.deepEqual(reloaded.prepare('SELECT username,role FROM users ORDER BY username').all().map(row => ({ ...row })), [
      { username, role: 'admin' }, { username: 'pilot-reader', role: 'reader' },
    ]);
  } finally { reloaded.close(); }
});

test('local empty CRAIG keeps its existing Kevin bootstrap', async t => {
  const f = await fixture(t);
  const local = await start(f, { CROUPIER_CLOUD_RUNTIME: '' });
  assert.match(local.output(), /backoffice login created - user: kevin  password: /);
  await stop(local.child);
  const db = new DatabaseSync(join(f.dataDir, 'craig.db'));
  try { assert.deepEqual(db.prepare('SELECT username,role FROM users').all().map(row => ({ ...row })), [{ username: 'kevin', role: 'superadmin' }]); }
  finally { db.close(); }
});
