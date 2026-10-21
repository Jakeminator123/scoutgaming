// Real Web server with disposable CRAIG data and three synthetic HTTPS hosts.
import assert from 'node:assert/strict';
import { mkdtemp, readdir, copyFile, symlink, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { createHash, createHmac, scryptSync } from 'node:crypto';
import { copyOpenClawRuntime } from './fixtures/copy-openclaw-runtime.mjs';
import { backofficeLabAuth } from '../services/game/bo-lab-auth.mjs';
import { installBoAuthEpoch } from '../services/game/bo-auth-epoch.mjs';
import { craigIdentity } from '../services/game/craig-identity.mjs';

const dir = await mkdtemp(join(tmpdir(), 'bo-lab-auth-'));
const web = new URL('../services/game/', import.meta.url), webDir = join(dir,'services','game');
const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
const game = 'https://game.example.test', bo = 'https://bo.example.test', lab = 'https://lab.example.test';
const password = 'Isolated-Lab-QA-Only';
let server, craig, authEpoch;

const request = async (url, { cookie = '', body, headers = {}, method = body ? 'POST' : 'GET' } = {}) => {
  const target = new URL(url);
  assert.ok([game, bo, lab].includes(target.origin));
  return new Promise((resolve, reject) => {
    const req = httpRequest(`http://127.0.0.1:${port}${target.pathname}${target.search}`, {
      method, headers: { Host: target.host, Cookie: cookie,
        ...(body ? { Origin: target.origin, 'Content-Type': 'application/json' } : {}), ...headers },
    }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const h = new Headers();
        for (let i = 0; i < res.rawHeaders.length; i += 2) h.append(res.rawHeaders[i], res.rawHeaders[i + 1]);
        resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: h }));
      });
    });
    req.on('error', reject); req.end(body ? JSON.stringify(body) : undefined);
  });
};
const location = response => response.headers.get('location');
const cookies = response => response.headers.getSetCookie().map(value => value.split(';')[0]);
const start = async (next = '/') => {
  const result = await request(lab + '/api/auth/lab/start?next=' + encodeURIComponent(next));
  assert.equal(result.status, 303);
  assert.match(location(result), /^https:\/\/bo\.example\.test\/api\/bo\/lab-login\?state=[a-f0-9]{64}$/);
  const stateCookie = cookies(result)[0];
  assert.match(stateCookie, /^bo_lab_state=[a-f0-9]{64}$/);
  return { authorize: location(result), stateCookie };
};
const authorize = async (boCookie, next = '/') => {
  const flow = await start(next);
  const result = await request(flow.authorize, { cookie: boCookie });
  assert.equal(result.status, 303);
  assert.match(location(result), /^https:\/\/lab\.example\.test\/api\/auth\/lab\/callback\?state=[a-f0-9]{64}&code=[a-f0-9]{64}$/);
  return { ...flow, callback: location(result) };
};
const sign = claims => {
  const secret = Buffer.from(craig.prepare("SELECT v FROM meta WHERE k='jwt_secret'").get().v, 'hex');
  const message = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') + '.' +
    Buffer.from(JSON.stringify(claims)).toString('base64url');
  return message + '.' + createHmac('sha256', secret).update(message).digest('base64url');
};
const administratorCookie = () => {
  const account = craig.prepare('SELECT id,username,salt,hash,role FROM users WHERE id=1').get();
  const epoch = craig.prepare('SELECT epoch FROM bo_auth_epochs WHERE user_id=?').get(account.id)?.epoch ?? 0;
  const source_stamp = createHash('sha256').update(`${account.salt}:${account.hash}`).digest('hex');
  return `bo_jwt=${sign({sub:account.username,role:account.role,aud:'backoffice',source_stamp,auth_epoch:epoch,exp:Date.now()/1000+3600})}`;
};

try {
  await mkdir(webDir,{recursive:true}); await copyOpenClawRuntime(dir);
  for (const file of await readdir(web)) if (file.endsWith('.mjs')) await copyFile(new URL(file, web), join(webDir, file));
  await symlink(new URL('public', web), join(webDir, 'public'), process.platform === 'win32' ? 'junction' : 'dir');
  await mkdir(join(dir, 'data'));
  craig = new DatabaseSync(join(dir, 'data/craig.db'));
  craig.exec('CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE NOT NULL,email TEXT,salt TEXT,hash TEXT,role TEXT NOT NULL,created_at TEXT NOT NULL)');
  craig.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?)').run(1, 'lab-admin', 'admin@example.invalid', 'test-salt',
    scryptSync(password, 'test-salt', 64).toString('hex'), 'reader', new Date().toISOString());
  authEpoch = installBoAuthEpoch(craig);
  const config = { db: craig, identity: craigIdentity(craig), boSession: () => null,
    authEpoch, publicUrl: game, boUrl: bo, labPublicUrl: lab };
  for (const override of [
    { labPublicUrl: 'http://lab.example.test' }, { labPublicUrl: lab + '/path' },
    { labPublicUrl: lab + ':444' }, { boUrl: game },
  ]) assert.throws(() => backofficeLabAuth({ ...config, ...override }), /HTTPS origin|distinct HTTPS hosts/);
  server = spawn(process.execPath, [join(webDir, 'server.mjs')], { cwd: webDir,
    env: { PATH: process.env.PATH, HOST: '127.0.0.1', PORT: String(port), PUBLIC_URL: game,
      BO_URL: bo, LAB_PUBLIC_URL: lab, CROUPIER_DATA_DIR: join(dir, 'data'), DEMO_GUEST_ACCESS: '1' },
    stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    let startupError = '';
    const timer = setTimeout(() => reject(Error('Server start timed out' + startupError)), 10000);
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(Error(`Server exited ${code}: ${startupError}`)); });
    server.stdout.on('data', chunk => { if (String(chunk).includes('croupier demo on')) { clearTimeout(timer); resolve(); } });
    server.stderr.on('data', chunk => { startupError ||= String(chunk).match(/(?:Error|SyntaxError|TypeError)(?: \[[A-Z_]+\])?:[^\n]*/)?.[0] ?? ''; });
  });

  const roulettePage = await request(game + '/roulette-test');
  assert.equal(roulettePage.status, 200);
  const rouletteSpin = await request(game + '/api/roulette-test/spin', {
    method: 'POST', headers: { Origin: game, 'X-Roulette-Preview': '1' },
  });
  assert.equal(rouletteSpin.status, 200);
  assert.equal((await rouletteSpin.json()).event.operatorId, 'roulette-demo');
  const rouletteStateResponse = await request(game + '/api/roulette/table', {body:{op:'state'}});
  assert.equal(rouletteStateResponse.status,200);
  const rouletteCookie = cookies(rouletteStateResponse).join('; '), rouletteState = await rouletteStateResponse.json();
  const rouletteRequest = {op:'spin',playerId:rouletteState.player.id,currency:rouletteState.currency,requestId:'00000000-0000-4000-8000-000000000001',version:0,bets:[{id:'red',amount:5}]};
  const roulettePlay = body => request(game + '/api/roulette/table', {cookie:rouletteCookie,body});
  assert.equal((await roulettePlay({...rouletteRequest,playerId:'other-player'})).status,401);
  assert.equal((await request(game + '/api/roulette/table', {cookie:rouletteCookie,body:rouletteRequest,headers:{Origin:'https://other.invalid'}})).status,403);
  const rouletteFirst = await roulettePlay(rouletteRequest);assert.equal(rouletteFirst.status,200);
  const rouletteResult = await rouletteFirst.json();assert.equal(rouletteResult.version,1);
  const rouletteReplay = await roulettePlay({...rouletteRequest,id:'forged-player-id'});assert.equal(rouletteReplay.status,200);
  const rouletteReceipt = await rouletteReplay.json();assert.equal(rouletteReceipt.replayed,true);
  assert.equal(rouletteReceipt.player.id,rouletteState.player.id);assert.equal(rouletteReceipt.round.id,rouletteResult.round.id);
  assert.equal(rouletteReceipt.balance,rouletteResult.balance);
  assert.equal((await roulettePlay({...rouletteRequest,requestId:'00000000-0000-4000-8000-000000000002'})).status,400);
  assert.equal((await roulettePlay({op:'state',context:{operator:'unknown',table:'other'}})).status,503);
  assert.equal((await request(game + '/api/roulette/table',{cookie:rouletteCookie})).status,405);
  assert.equal((await request(game + '/api/balance',{cookie:rouletteCookie,body:{balance:999999}})).status,400);

  assert.equal(rouletteSpin.headers.has('set-cookie'), false, 'roulette demo does not create a guest player');
  const offlinePreview = await request(game + '/api/studio-preview');
  assert.equal(offlinePreview.status, 503, 'offline preview refuses before loading Studio or creating a player');
  assert.deepEqual(await offlinePreview.json(), {error:'studio_preview_unavailable'});
  assert.equal(offlinePreview.headers.get('cache-control'), 'private, no-store');
  assert.equal(offlinePreview.headers.has('set-cookie'), false);
  const offlineRooms = await request(game + '/api/operators/sg-test/rooms');
  assert.equal(offlineRooms.status, 503, 'offline rooms refuse without importing the absent Studio storage runtime');
  assert.deepEqual(await offlineRooms.json(), {error:'operator_rooms_unavailable'});
  assert.equal(offlineRooms.headers.get('cache-control'), 'no-store');
  assert.equal(offlineRooms.headers.has('set-cookie'), false, 'catalog lookup must not create a guest player');
  assert.equal((await request(lab + '/api/auth/lab/check')).status, 401, 'guest preview cannot open Lab');
  assert.equal((await request(game + '/api/auth/lab/start')).status, 403);
  assert.equal((await request(bo + '/api/auth/lab/start')).status, 403);
  assert.equal((await request(lab + '/api/auth/lab/start', { headers: { Origin: game } })).status, 403);
  const anonymous = await start();
  const loginRedirect = await request(anonymous.authorize);
  assert.equal(loginRedirect.status, 303);
  assert.match(location(loginRedirect), /^\/admin\/login\?returnTo=%2Fapi%2Fbo%2Flab-login%3Fstate%3D[a-f0-9]{64}$/);

  const readerRedirect = await request(anonymous.authorize, { cookie: administratorCookie() });
  assert.match(location(readerRedirect), /^\/admin\/login/, 'reader cannot authorize a Lab handoff');
  const partner = sign({ sub: 'partner-player', partner: 'partner-key', exp: Date.now() / 1000 + 60 });
  const partnerRedirect = await request(anonymous.authorize, { cookie: `bo_jwt=${partner}` });
  assert.match(location(partnerRedirect), /^\/admin\/login/, 'Partner JWT is not a BO admin session');

  craig.prepare("UPDATE users SET role='admin' WHERE id=1").run();
  const adminCookie = administratorCookie();
  const flow = await authorize(adminCookie);
  assert.equal((await request(lab + new URL(flow.authorize).pathname + new URL(flow.authorize).search, { cookie: adminCookie })).status, 403);
  assert.equal((await request(bo + new URL(flow.callback).pathname + new URL(flow.callback).search, { cookie: flow.stateCookie })).status, 403);
  assert.equal((await request(flow.callback)).status, 410, 'callback without its initiating Lab browser cookie receives the existing expired-handoff response');
  assert.equal((await request(flow.callback, { cookie: flow.stateCookie, headers: { Origin: game } })).status, 403, 'sibling Origin is rejected');
  const completed = await request(flow.callback, { cookie: flow.stateCookie });
  assert.equal(completed.status, 303); assert.equal(location(completed), '/');
  const issued = completed.headers.getSetCookie();
  assert.match(issued[0], /^lab_session=[a-f0-9]{64}; Path=\/; HttpOnly; Secure; SameSite=Lax;/);
  assert.ok(!issued[0].includes('Domain='));
  const labCookie = cookies(completed)[0]; assert.ok(!labCookie.includes('bo_jwt'));
  const restoredPage = await authorize(adminCookie, '/control?private-token=must-not-persist');
  const pageResponse = await request(restoredPage.callback, { cookie: restoredPage.stateCookie });
  assert.equal(location(pageResponse), '/control');
  for (const unsafe of ['//evil.invalid/', 'https://evil.invalid/', '/\\evil.invalid/', '/api/project', '/probe#fragment']) {
    const unsafeFlow = await authorize(adminCookie, unsafe);
    const unsafeResponse = await request(unsafeFlow.callback, { cookie: unsafeFlow.stateCookie });
    assert.equal(location(unsafeResponse), '/', 'unsafe Lab return path becomes root');
  }
  const check = await request(lab + '/api/auth/lab/check', { cookie: labCookie });
  assert.equal(check.status, 200); assert.equal(await check.text(), '', 'success contains no PII');
  let directStatus;
  backofficeLabAuth({ db: craig, identity: craigIdentity(craig), boSession: () => null, authEpoch,
    publicUrl: game, boUrl: bo, labPublicUrl: lab })(
    { method: 'GET', url: '/api/auth/lab/check', headers: { host: new URL(lab).host,
      cookie: labCookie, 'x-forwarded-for': '127.0.0.1' }, socket: { remoteAddress: '203.0.113.5' } },
    { writeHead(status) { directStatus = status; }, end() {} });
  assert.equal(directStatus, 401, 'X-Forwarded-For cannot replace a loopback socket');
  assert.equal((await request(lab + '/api/auth/lab/check', { cookie: labCookie, headers: { Origin: bo } })).status, 401);
  assert.equal((await request(bo + '/api/auth/lab/check', { cookie: labCookie })).status, 401);
  assert.equal((await request(lab + '/api/auth/lab/check', { cookie: adminCookie })).status, 401);
  assert.equal((await request(bo + '/bo/speech-qa.html', { cookie: labCookie })).status, 302, 'Lab bearer grants no BO role');
  const reused = await request(flow.callback, { cookie: flow.stateCookie });
  assert.equal(reused.status, 410, 'single-use code receives the expired-handoff response on reuse');
  assert.match(reused.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(await reused.text(), /Starta en ny labbinloggning/);

  const sessionFlow = await authorize(adminCookie);
  const sessionResponse = await request(sessionFlow.callback, { cookie: sessionFlow.stateCookie });
  assert.equal(sessionResponse.status, 303);
  const expiredSessionCookie = cookies(sessionResponse)[0];
  craig.prepare('UPDATE lab_sessions SET expires=0 WHERE token_digest=?').run(
    createHash('sha256').update(expiredSessionCookie.split('=')[1]).digest('hex'));
  assert.equal((await request(lab + '/api/auth/lab/check', { cookie: expiredSessionCookie })).status, 401, 'Lab bearer expires server-side');

  const expiring = await authorize(adminCookie);
  craig.prepare('UPDATE bo_lab_handoffs SET expires=0 WHERE state_digest=?').run(
    createHash('sha256').update(expiring.stateCookie.split('=')[1]).digest('hex'));
  assert.equal((await request(expiring.callback, { cookie: expiring.stateCookie })).status, 410, 'expired code cannot be used');
  const beforeRole = await authorize(adminCookie);
  craig.prepare("UPDATE users SET role='staff' WHERE id=1").run();
  assert.equal((await request(beforeRole.callback, { cookie: beforeRole.stateCookie })).status, 401, 'role downgrade revokes pending code');
  assert.equal((await request(lab + '/api/auth/lab/check', { cookie: labCookie })).status, 401, 'role downgrade revokes Lab session');
  craig.prepare("UPDATE users SET role='admin' WHERE id=1").run();
  assert.equal((await request(lab + '/api/auth/lab/check', { cookie: labCookie })).status, 401, 'old Lab session never revives');
  assert.match(location(await request((await start()).authorize, { cookie: adminCookie })), /^\/admin\/login/, 'old BO cookie never revives');
  const freshAdmin = administratorCookie();
  const beforePassword = await authorize(freshAdmin);
  craig.prepare('UPDATE users SET hash=? WHERE id=1').run(scryptSync('Changed-password', 'test-salt', 64).toString('hex'));
  assert.equal((await request(beforePassword.callback, { cookie: beforePassword.stateCookie })).status, 401, 'password change revokes pending code');
  assert.equal((await request(lab + '/api/auth/lab/check', { cookie: labCookie })).status, 401, 'password change revokes Lab session');
  craig.prepare('UPDATE users SET hash=? WHERE id=1').run(scryptSync(password, 'test-salt', 64).toString('hex'));
  assert.equal((await request(lab + '/api/auth/lab/check', { cookie: labCookie })).status, 401, 'old Lab session stays revoked after password restore');
  craig.prepare('DELETE FROM users WHERE id=1').run();
  assert.equal((await request(lab + '/api/auth/lab/check', { cookie: labCookie })).status, 401, 'deleted CRAIG account cannot use Lab');
  let limited = false;
  for (let i = 0; i < 130; i++) {
    const response = await request(lab + '/api/auth/lab/start');
    if (response.status === 429) { limited = true; break; }
    assert.equal(response.status, 303);
  }
  assert.equal(limited, true, 'public start is globally rate limited');
  assert.ok(craig.prepare('SELECT COUNT(*) AS n FROM bo_lab_handoffs').get().n <= 120);
  craig.exec('DELETE FROM bo_lab_handoffs');
  const insertPending = craig.prepare('INSERT INTO bo_lab_handoffs (state_digest,next_path,expires) VALUES (?,?,?)');
  for (let i = 0; i < 500; i++) insertPending.run(String(i).padStart(64, '0'), '/', Date.now() + 300000);
  let cappedStatus;
  backofficeLabAuth(config)(
    { method: 'GET', url: '/api/auth/lab/start', headers: { host: new URL(lab).host }, socket: { remoteAddress: '127.0.0.1' } },
    { writeHead(status) { cappedStatus = status; }, end() {} });
  assert.equal(cappedStatus, 429, 'persistent outstanding state count is bounded across handler restarts');
  console.log('BO/Lab auth passed: three exact HTTPS hosts, admin+ only, Partner rejection, browser state, single use, expiry, host-only Secure Lab cookie, loopback check, current CRAIG role/password/deletion, no guest bypass or PII.');
} finally {
  if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped; }
  craig?.close(); await rm(dir, { recursive: true, force: true });
}
