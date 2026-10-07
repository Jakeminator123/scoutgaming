import { createHash, randomBytes } from 'node:crypto';
import { createAccountCredentialResolver } from '../../web/account-credentials.mjs';
import { craigIdentity } from '../../web/storage/async-craig-identity.mjs';
import { installBoAuthEpoch } from '../../web/storage/async-bo-auth-epoch.mjs';
import { createPostgresStore } from '../../web/storage/postgres-store.mjs';
import { validateStudioScope } from '../../web/storage/studio-contract.mjs';
import { createStudioLoginRateLimit } from './studio-native-auth-actions.mjs';
import { assertNativeStudioRequest, nativeStudioAdminConfiguration } from './studio-native-runtime.mjs';
import { normalizeNativeStudioRequest } from './studio-native-request.mjs';

// Opaque partner sessions are stored in the existing lab_sessions table.
// The digest is purpose-prefixed so a lab_session or bo_jwt value can never
// resolve as a partner login, and a partner token can never resolve as an
// internal admin session. The users.role text value is 'partner'.
export const PARTNER_SESSION_COOKIE = 'partner_session';
export const PARTNER_SESSION_PURPOSE = 'partner';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const messages = new Map([[400, 'Invalid request'], [401, 'Authentication required'], [403, 'Access denied'], [404, 'Not found'],
  [405, 'Method not allowed'], [413, 'Request too large'], [415, 'JSON required'], [429, 'Too many attempts'], [503, 'Authentication unavailable']]);
const accountProjection = `SELECT u.id,u.username,u.salt,u.hash,u.role,e.epoch
  FROM users u LEFT JOIN bo_auth_epochs e ON e.user_id=u.id WHERE `;
const reservedSlugs = new Set(['api', 'auth', 'login', 'logout', 'studio', 'control', 'partner', 'play', 'set-password']);
const slugPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function fail(statusCode = 400) {
  throw Object.assign(new Error('partner_request_rejected'), { statusCode });
}
const digest = value => createHash('sha256').update(value).digest('hex');
export function partnerSessionDigest(token) {
  return digest(`purpose:${PARTNER_SESSION_PURPOSE}:${token}`);
}
const sourceStamp = account => account?.salt && account?.hash
  ? digest(`${account.salt}:${account.hash}`) : null;
function currentEpoch(account) {
  const epoch = Number(account?.epoch ?? 0);
  if (!Number.isSafeInteger(epoch) || epoch < 0) fail(503);
  return epoch;
}
function text(value, max) {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
}
function keys(body, allowed, required = allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))
    || required.some(key => !Object.hasOwn(body, key))) fail(400);
}
export function partnerApiBase(config) {
  return config?.apiBase === '/studio/api/admin' ? '/studio/api/partner' : '/api/partner';
}
export function partnerSessionPresent(request) {
  const header = request?.headers?.get?.('cookie') || '';
  return header.split(';').some(part => part.trim().startsWith(`${PARTNER_SESSION_COOKIE}=`));
}
function readCookie(request) {
  const entries = (request.headers.get('cookie') || '').split(';').map(part => part.trim())
    .filter(part => part.startsWith(`${PARTNER_SESSION_COOKIE}=`));
  if (!entries.length) return null;
  const value = entries[0].slice(PARTNER_SESSION_COOKIE.length + 1);
  if (entries.length !== 1 || !/^[a-f0-9]{64}$/.test(value)) fail(401);
  return value;
}
function partnerCookie(value, maxAge) {
  return `${PARTNER_SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function json(value, status = 200, cookies = [], { vary = false } = {}) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  if (vary) headers.set('Vary', 'Cookie');
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  if (status === 429) headers.set('Retry-After', '900');
  return new Response(JSON.stringify(value), { status, headers });
}
export function rejectPartnerMethod() {
  return new Response(null, {
    status: 405,
    headers: { Allow: 'GET, POST', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
function failure(error) {
  const status = messages.has(error?.statusCode) ? error.statusCode : 503;
  if (status === 405) return rejectPartnerMethod();
  return json({ error: messages.get(status) }, status);
}
async function bodyOf(request) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') || '')) fail(415);
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 8192)) fail(/^\d+$/.test(length) ? 413 : 400);
  const reader = request.body?.getReader();
  if (!reader) fail(400);
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); fail(413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body;
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail(400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400);
  return body;
}
function operatorSlug(value) {
  return typeof value === 'string' && value.length <= 63 && slugPattern.test(value) && !reservedSlugs.has(value);
}

let pendingConfig;
export async function partnerAuthConfig() {
  const native = nativeStudioAdminConfiguration();
  if (!native) fail(503);
  pendingConfig ??= openPartnerAuth(native).catch(error => { pendingConfig = undefined; throw error; });
  return pendingConfig;
}
async function openPartnerAuth(native) {
  const { Pool } = await import('@neondatabase/serverless');
  const pool = new Pool({ connectionString: native.connectionString, max: 4, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 15_000 });
  const store = createPostgresStore({ pool });
  return Object.freeze({
    ...native,
    pool,
    boDb: store.boDb,
    gameDb: store.db,
    rateLimit: createStudioLoginRateLimit({ boDb: store.boDb }),
    clientAddress: request => request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'shared-unknown',
  });
}

export async function authorizePartner(request, config) {
  if (typeof config?.boDb?.prepare !== 'function') fail(503);
  let scope;
  try { scope = validateStudioScope(config.scope); } catch { fail(503); }
  const now = typeof config.now === 'function' ? config.now : Date.now;
  const token = readCookie(request);
  if (!token) fail(401);
  const readIdentity = async () => {
    const session = await config.boDb.prepare('SELECT * FROM lab_sessions WHERE token_digest=? AND expires>?')
      .get(partnerSessionDigest(token), now());
    if (!session || session.role !== PARTNER_SESSION_PURPOSE || !/^[a-f0-9]{64}$/.test(session.source_stamp ?? '')) fail(401);
    const matches = await config.boDb.prepare(accountProjection + 'u.id=?').all(session.craig_user_id);
    const account = matches.length === 1 ? matches[0] : null;
    if (!account?.salt || !/^[a-f0-9]{128}$/i.test(account.hash ?? '') || account.role !== 'partner'
      || sourceStamp(account) !== session.source_stamp || currentEpoch(account) !== Number(session.auth_epoch)) fail(401);
    return Object.freeze({
      user: account.username,
      accountId: String(account.id),
      role: 'partner',
      scope,
    });
  };
  try {
    return await (typeof config.boDb.transaction === 'function'
      ? config.boDb.transaction(readIdentity, { serialize: false }) : readIdentity());
  } catch (error) {
    if (messages.has(error?.statusCode)) throw error;
    fail(503);
  }
}

async function login(request, body, config) {
  keys(body, ['user', 'pass']);
  if (!text(body.user, 254) || !body.user.trim() || !text(body.pass, 256)) fail(400);
  if (typeof config.rateLimit !== 'function' || typeof config.clientAddress !== 'function' || typeof config.gameDb?.prepare !== 'function') fail(503);
  const clientKey = await config.clientAddress(request);
  if (!text(clientKey, 256)) fail(503);
  const loginName = body.user.trim().toLowerCase();
  const now = typeof config.now === 'function' ? config.now : Date.now;
  const identity = craigIdentity(config.boDb);
  const credentials = createAccountCredentialResolver({ identity, playerDb: config.gameDb, playerAccounts: true });
  const userKey = await credentials.keyFor(loginName);
  if (await config.rateLimit({ clientKey, user: userKey, action: 'login' }) !== true) fail(503);
  const authEpoch = installBoAuthEpoch(config.boDb);
  const session = await config.boDb.transaction(async () => {
    const matches = await config.boDb.prepare('SELECT id,username,role FROM users WHERE lower(username)=? OR lower(email)=? FOR UPDATE').all(loginName, loginName);
    let verified = null;
    try { verified = await identity.authenticate(loginName, body.pass); }
    catch (error) {
      if (error?.message === 'Account setup is incomplete. Finish your Scout invitation before signing in.') verified = null;
      else throw error;
    }
    // Same password check as Studio. A non-partner role, including internal
    // admin, is the same failure as a wrong password.
    if (matches.length !== 1 || !verified || String(matches[0].id) !== String(verified.id) || matches[0].role !== 'partner') fail(401);
    const epoch = await authEpoch(verified.id);
    const token = randomBytes(32).toString('hex');
    const expires = now() + SESSION_MS;
    if (!Number.isSafeInteger(expires)) fail(503);
    await config.boDb.prepare('INSERT INTO lab_sessions (token_digest,craig_user_id,role,source_stamp,auth_epoch,expires) VALUES (?,?,?,?,?,?)')
      .run(partnerSessionDigest(token), String(verified.id), 'partner', verified.stamp, epoch, expires);
    return { token, username: matches[0].username };
  });
  return json({ ok: true, username: session.username, role: 'partner' }, 200, [partnerCookie(session.token, SESSION_SECONDS)]);
}

async function revokePartnerSessions(boDb, actor) {
  await boDb.transaction(async () => {
    const matches = await boDb.prepare('SELECT id,role FROM users WHERE username=? FOR UPDATE').all(actor.user);
    if (matches.length !== 1 || matches[0].role !== 'partner' || String(matches[0].id) !== actor.accountId) fail(401);
    await boDb.prepare('INSERT INTO bo_auth_epochs (user_id,epoch) VALUES (?,1) ON CONFLICT(user_id) DO UPDATE SET epoch=bo_auth_epochs.epoch+1').run(matches[0].id);
    await boDb.prepare('DELETE FROM lab_sessions WHERE craig_user_id=? AND role=?').run(String(matches[0].id), 'partner');
  });
}

async function logout(request, body, config) {
  keys(body, []);
  if (typeof config?.boDb?.transaction !== 'function') fail(503);
  try {
    const actor = await authorizePartner(request, config);
    await revokePartnerSessions(config.boDb, actor);
  } catch (error) {
    if (error?.statusCode !== 401) throw error;
    return json({ error: messages.get(401) }, 401, [partnerCookie('', 0)]);
  }
  return json({ ok: true }, 200, [partnerCookie('', 0)]);
}

function preparePartnerRequest(request, config) {
  if (!config) fail(503);
  const url = new URL(request.url);
  let operatorSlugValue;
  if (request.method === 'GET') {
    const entries = [...url.searchParams];
    if (entries.length !== 1 || entries[0][0] !== 'operator' || !operatorSlug(entries[0][1])) fail(400);
    operatorSlugValue = entries[0][1];
    url.search = '';
  } else if (url.search || url.hash) fail(400);
  const next = new Request(url, {
    method: request.method,
    headers: request.headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    ...(request.method === 'GET' || request.method === 'HEAD' ? {} : { duplex: 'half' }),
    signal: request.signal,
  });
  let normalized = normalizeNativeStudioRequest(next, config);
  const logical = new URL(normalized.url);
  const base = partnerApiBase(config);
  if (base.startsWith('/studio') && logical.pathname.startsWith('/api/partner/') && !logical.pathname.startsWith('/studio/')) {
    logical.pathname = '/studio' + logical.pathname;
    normalized = new Request(logical, {
      method: normalized.method,
      headers: normalized.headers,
      body: normalized.body,
      ...(normalized.body ? { duplex: 'half' } : {}),
      signal: request.signal,
    });
  }
  assertNativeStudioRequest(normalized, config);
  const pathname = new URL(normalized.url).pathname;
  const bare = base.startsWith('/studio/') ? base.slice('/studio'.length) : base;
  const matched = [base, bare].find(prefix => pathname.startsWith(`${prefix}/`));
  const action = matched ? pathname.slice(matched.length + 1) : '';
  if (!['login', 'logout', 'snapshot'].includes(action)) fail(404);
  const allowed = action === 'snapshot' ? 'GET' : 'POST';
  if (request.method !== allowed) {
    return { response: new Response(null, { status: 405, headers: { Allow: allowed, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } }) };
  }
  if (request.method === 'POST') {
    const origin = new URL(normalized.url).origin;
    if (normalized.headers.get('origin') !== origin || !['same-origin', 'none'].includes(normalized.headers.get('sec-fetch-site') || '')
      || normalized.headers.has('next-action')) fail(403);
  }
  return { request: normalized, action, operatorSlug: operatorSlugValue };
}

export async function handlePartnerAuth(request, injected) {
  try {
    if (!['GET', 'POST'].includes(request.method)) return rejectPartnerMethod();
    const config = injected ?? await partnerAuthConfig();
    const prepared = preparePartnerRequest(request, config);
    if (prepared.response) return prepared.response;
    if (prepared.action === 'snapshot') {
      const { partnerWorkspaceData } = await import('./partner-data.mjs');
      const snapshot = await partnerWorkspaceData(prepared.request, {
        operatorSlug: prepared.operatorSlug,
        config,
        store: config.store,
      });
      return json(snapshot, 200, [], { vary: true });
    }
    const body = await bodyOf(prepared.request);
    if (prepared.action === 'login') return await login(prepared.request, body, config);
    return await logout(prepared.request, body, config);
  } catch (error) {
    return failure(error);
  }
}
