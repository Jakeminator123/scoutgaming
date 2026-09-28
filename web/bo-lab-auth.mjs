import { createHash, randomBytes } from 'node:crypto';

const PATHS = new Set(['/api/auth/lab/start', '/api/auth/lab/callback', '/api/auth/lab/check', '/api/bo/lab-login']);
const ADMIN_ROLES = new Set(['admin', 'superadmin']);
const validToken = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const digest = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('hex');

function exactHttpsOrigin(value, name) {
  if (typeof value !== 'string' || !URL.canParse(value)) throw Error(`${name} must be an HTTPS origin`);
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash || url.port) throw Error(`${name} must be an HTTPS origin`);
  return url;
}

const loopback = address => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
const cookie = (req, name) => {
  const match = new RegExp(`(?:^|;\\s*)${name}=([a-f0-9]{64})(?:;|$)`).exec(req.headers.cookie ?? '');
  return match?.[1] ?? null;
};

// Separate BO and Lab hosts share only a short-lived code. The Lab bearer is
// opaque, host-only and revalidated against CRAIG on every internal check.
export function backofficeLabAuth({ db, boSession, identity, authEpoch, publicUrl, boUrl, labPublicUrl }) {
  if (!labPublicUrl) return (req, res) => {
    const path = new URL(req.url, 'http://local').pathname;
    if (!PATHS.has(path)) return false;
    res.writeHead(404, { 'Cache-Control': 'no-store' }); res.end(); return true;
  };
  const game = exactHttpsOrigin(publicUrl, 'PUBLIC_URL');
  const bo = exactHttpsOrigin(boUrl, 'BO_URL');
  const lab = exactHttpsOrigin(labPublicUrl, 'LAB_PUBLIC_URL');
  if (new Set([game.host, bo.host, lab.host]).size !== 3) throw Error('Game, BO and Lab require distinct HTTPS hosts');
  if (typeof authEpoch !== 'function') throw Error('BO auth epoch is required for Lab access');

  const nextPath = value => {
    if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') ||
      value.startsWith('//') || /[\\#\x00-\x1f]/.test(value) || /%2f|%5c/i.test(value)) return '/';
    const target = new URL(value, lab);
    if (target.origin !== lab.origin || /^\/(?:api|_next)(?:\/|$)/i.test(target.pathname)) return '/';
    // Do not persist query parameters: they may carry a token or private draft.
    return target.pathname;
  };
  const recentStarts = [];

  db.exec(`
    CREATE TABLE IF NOT EXISTS bo_lab_handoffs (
      state_digest TEXT PRIMARY KEY, next_path TEXT NOT NULL DEFAULT '/', expires INTEGER NOT NULL,
      code_digest TEXT UNIQUE, craig_user_id TEXT, role TEXT, source_stamp TEXT,
      auth_epoch INTEGER, session_until INTEGER
    );
    CREATE TABLE IF NOT EXISTS lab_sessions (
      token_digest TEXT PRIMARY KEY, craig_user_id TEXT NOT NULL,
      role TEXT NOT NULL, source_stamp TEXT NOT NULL, auth_epoch INTEGER,
      expires INTEGER NOT NULL
    );
  `);
  for (const [table, column] of [['bo_lab_handoffs', 'next_path'],
    ['bo_lab_handoffs', 'auth_epoch'], ['lab_sessions', 'auth_epoch']]) {
    if (!db.prepare(`PRAGMA table_info(${table})`).all().some(item => item.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${column === 'next_path' ? "TEXT NOT NULL DEFAULT '/'" : 'INTEGER'}`);
    }
  }
  const current = id => {
    const user = db.prepare('SELECT role FROM users WHERE id=?').get(id);
    const stamp = user && identity.stamp(id);
    return user && stamp && ADMIN_ROLES.has(user.role) ? { role: user.role, stamp, epoch: authEpoch(id) } : null;
  };
  const stateCookie = (value, age) => `bo_lab_state=${value}; Path=/api/auth/lab/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
  const sessionCookie = (value, age) => `lab_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
  const reply = (res, status, headers = {}) => {
    res.writeHead(status, { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', ...headers });
    res.end(); return true;
  };

  return function handle(req, res) {
    const url = new URL(req.url, lab), path = url.pathname;
    if (!PATHS.has(path)) return false;
    if (req.method !== 'GET') return reply(res, 405);
    const expected = path === '/api/bo/lab-login' ? bo : lab;
    if (req.headers.host !== expected.host ||
        (req.headers.origin !== undefined && req.headers.origin !== expected.origin)) {
      return reply(res, path === '/api/auth/lab/check' ? 401 : 403);
    }

    if (path === '/api/auth/lab/check') {
      if (!loopback(req.socket.remoteAddress)) return reply(res, 401);
      const bearer = cookie(req, 'lab_session');
      if (!bearer) return reply(res, 401);
      const session = db.prepare('SELECT * FROM lab_sessions WHERE token_digest=? AND expires>?').get(digest(bearer), Date.now());
      const account = session && current(session.craig_user_id);
      const valid = session && account && account.role === session.role &&
        account.stamp === session.source_stamp && account.epoch === session.auth_epoch;
      if (session && !valid) db.prepare('DELETE FROM lab_sessions WHERE token_digest=?').run(digest(bearer));
      return reply(res, valid ? 200 : 401);
    }

    if (path === '/api/auth/lab/start') {
      const now = Date.now();
      while (recentStarts.length && recentStarts[0] <= now - 60000) recentStarts.shift();
      if (recentStarts.length >= 120) return reply(res, 429, { 'Retry-After': '60' });
      db.prepare('DELETE FROM bo_lab_handoffs WHERE expires<=?').run(now);
      db.prepare('DELETE FROM lab_sessions WHERE expires<=?').run(now);
      if (db.prepare('SELECT COUNT(*) AS n FROM bo_lab_handoffs').get().n >= 500) {
        return reply(res, 429, { 'Retry-After': '60' });
      }
      recentStarts.push(now);
      const state = token();
      db.prepare('INSERT INTO bo_lab_handoffs (state_digest,next_path,expires) VALUES (?,?,?)').run(
        digest(state), nextPath(url.searchParams.get('next') ?? '/'), now + 300000);
      return reply(res, 303, { Location: `${bo.origin}/api/bo/lab-login?state=${state}`, 'Set-Cookie': stateCookie(state, 300) });
    }

    const state = url.searchParams.get('state');
    if (!validToken(state)) return reply(res, 400);
    if (path === '/api/bo/lab-login') {
      const flow = db.prepare('SELECT 1 FROM bo_lab_handoffs WHERE state_digest=? AND expires>? AND code_digest IS NULL').get(digest(state), Date.now());
      if (!flow) return reply(res, 400);
      const claims = boSession(req);
      if (!claims) return reply(res, 303, { Location: `/bo/login.html?returnTo=${encodeURIComponent(`/api/bo/lab-login?state=${state}`)}` });
      if (!ADMIN_ROLES.has(claims.role)) return reply(res, 403);
      const account = identity.find(claims.sub);
      if (!account || account.stamp !== claims.source_stamp || claims.auth_epoch !== authEpoch(account.id)) return reply(res, 401);
      const until = Math.min(claims.exp * 1000, Date.now() + 86400000);
      if (until <= Date.now() + 1000) return reply(res, 401);
      const code = token();
      const updated = db.prepare(`UPDATE bo_lab_handoffs
        SET code_digest=?,craig_user_id=?,role=?,source_stamp=?,auth_epoch=?,session_until=?,expires=?
        WHERE state_digest=? AND expires>? AND code_digest IS NULL RETURNING state_digest`).get(
        digest(code), account.id, claims.role, account.stamp, authEpoch(account.id), until,
        Math.min(Date.now() + 60000, until), digest(state), Date.now());
      if (!updated) return reply(res, 400);
      return reply(res, 303, { Location: `${lab.origin}/api/auth/lab/callback?state=${state}&code=${code}` });
    }

    const code = url.searchParams.get('code');
    if (cookie(req, 'bo_lab_state') !== state || !validToken(code)) return reply(res, 400);
    const flow = db.prepare('DELETE FROM bo_lab_handoffs WHERE state_digest=? AND code_digest=? AND expires>? RETURNING *').get(digest(state), digest(code), Date.now());
    if (!flow) return reply(res, 400);
    const account = current(flow.craig_user_id);
    const age = Math.floor((flow.session_until - Date.now()) / 1000);
    if (!account || account.role !== flow.role || account.stamp !== flow.source_stamp ||
      account.epoch !== flow.auth_epoch || age < 1) {
      return reply(res, 401, { 'Set-Cookie': stateCookie('', 0) });
    }
    const bearer = token();
    db.prepare('INSERT INTO lab_sessions (token_digest,craig_user_id,role,source_stamp,auth_epoch,expires) VALUES (?,?,?,?,?,?)').run(
      digest(bearer), flow.craig_user_id, flow.role, flow.source_stamp, flow.auth_epoch, flow.session_until);
    return reply(res, 303, { Location: flow.next_path, 'Set-Cookie': [sessionCookie(bearer, age), stateCookie('', 0)] });
  };
}
