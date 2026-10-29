import {isOperatorSlug as operatorSlug} from '../../../packages/navigation/operator-slug.mjs';
import { operatorAuditContext } from './operator-audit-context.mjs';
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { createAccountCredentialResolver } from '../../../packages/studio-access/server/account-credentials.mjs';
import { allowsWorkspaceResource, internalPartnerContext } from './partner-workspace-access.mjs';
import { craigIdentity } from '../../../packages/studio-access/server/craig-identity.mjs';
import { installBoAuthEpoch } from '../../../packages/studio-access/server/bo-auth-epoch.mjs';
import { createPostgresStore } from '../../../packages/storage/server/postgres-store.mjs';
import { createStudioRepository } from '../../../packages/studio-registry/server/document-repository.mjs';
import { createOperatorStore } from '../../../packages/operators/server/operator-store.mjs';
import { validateStudioScope, StudioStorageError } from '../../../packages/studio-registry/server/document-contract.mjs';
import { createStudioLoginRateLimit } from './studio-native-auth-actions.mjs';
import { createStudioNativeAuth } from '../../../packages/studio-access/studio-native-auth.mjs';
import { normalizeStudioRole } from '../../../packages/studio-access/studio-access-policy.mjs';
import { assertNativeStudioRequest, nativeStudioAdminConfiguration } from './studio-native-runtime.mjs';
import { normalizeNativeStudioRequest } from './studio-native-request.mjs';
import { PARTNER_TEAM_CONFLICTS, createPartnerTeamApi } from './partner-team-api.mjs';
import { wrapNativePresentationRepository } from './presentation-runtime-readiness.mjs';
import { createOperatorMaterialStore } from './operator-material-store.mjs';

// Opaque partner sessions are stored in the existing lab_sessions table.
// The digest is purpose-prefixed so a lab_session or bo_jwt value can never
// resolve as a partner login, and a partner token can never resolve as an
// internal admin session. The users.role text value is 'partner'.
export const PARTNER_SESSION_COOKIE = 'partner_session';
export const PARTNER_SESSION_PURPOSE = 'partner';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const messages = new Map([[400, 'Invalid request'], [401, 'Authentication required'], [403, 'Access denied'], [404, 'Not found'],
  [405, 'Method not allowed'], [409, 'Conflict'], [413, 'Request too large'], [415, 'JSON required'], [422, 'Invalid data'],
  [429, 'Too many attempts'], [503, 'Authentication unavailable']]);
const accountProjection = `SELECT u.id,u.username,u.salt,u.hash,u.role,e.epoch
  FROM users u LEFT JOIN bo_auth_epochs e ON e.user_id=u.id WHERE `;

function fail(statusCode = 400) {
  throw Object.assign(new Error('partner_request_rejected'), { statusCode });
}
const digest = value => createHash('sha256').update(value).digest('hex');
const passwordTokenKey = value => `studio-sha256:${digest(value)}`;
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
// 409 med kod från spelbordens skrivvägar (partner-table-api.mjs): spelbordet är
// pausat av Admin (eller aldrig pausat av bolaget självt), och bara Admin öppnar det.
export const PARTNER_TABLE_CONFLICTS = Object.freeze(['admin-pause']);
function failure(error) {
  const status = messages.has(error?.statusCode) ? error.statusCode : 503;
  if (status === 405) return rejectPartnerMethod();
  // 503 studio_migration_required: koden väntar på en Studio-migrering (t.ex. 022).
  // 429 partner_request_limit: bolagets tak för begäranden per timme är nått.
  const reason = status === 409 && [...PARTNER_TEAM_CONFLICTS, ...PARTNER_TABLE_CONFLICTS].includes(error?.reason) ? error.reason
    : status === 503 && error?.code === 'studio_migration_required' ? error.code
      : status === 429 && error?.code === 'partner_request_limit' ? error.code : null;
  return json(reason ? { error: messages.get(status), reason } : { error: messages.get(status) }, status);
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

export function internalSessionPresent(request) {
  return (request?.headers?.get('cookie') || '').split(';')
    .some(part => /^(?:bo_jwt|lab_session)=/.test(part.trim()));
}

// A present N1 cookie must validate as a fresh N1 administrator even when a
// valid partner_session is also present. Stale admin credentials never fall
// back silently to another identity. No partner token or membership is minted.
export async function authorizePartnerWorkspace(request, config) {
  if (!internalSessionPresent(request)) {
    return { ...await authorizePartner(request, config), accessClass: 'partner' };
  }
  const authorize = createStudioNativeAuth({ boDb: config?.boDb, scope: config?.scope, now: config?.now });
  const read = async () => {
    const session = await authorize(request);
    const accounts = await config.boDb.prepare(accountProjection + 'LOWER(u.username)=?')
      .all(session.user.toLowerCase());
    if (accounts.length !== 1 || normalizeStudioRole(accounts[0].role) !== 'admin') fail(401);
    return Object.freeze({ ...session, accountId: String(accounts[0].id), accessClass: 'internal-admin' });
  };
  try {
    return await (typeof config.boDb.transaction === 'function'
      ? config.boDb.transaction(read, { serialize: false }) : read());
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

// Partner-API:ts egna vägar (ADMIN-FORENKLING 5.5, partner-table-api.mjs):
// läsningar med GET och åtgärder med POST, alltid med ?operator=<slug>.
const PARTNER_TABLE_GETS = Object.freeze(['assignment']);
const PARTNER_TABLE_POSTS = Object.freeze(['dealer', 'room-settings', 'room-state', 'request']);
const PARTNER_OPERATOR_POSTS = Object.freeze(['branding', 'team', ...PARTNER_TABLE_POSTS]);
function partnerAction(pathname, config) {
  const base = partnerApiBase(config);
  const bare = base.startsWith('/studio/') ? base.slice('/studio'.length) : base;
  const matched = [base, bare].find(prefix => pathname.startsWith(`${prefix}/`));
  return matched ? pathname.slice(matched.length + 1) : '';
}
function takeOperatorSlug(url) {
  const entries = [...url.searchParams];
  if (entries.length !== 1 || entries[0][0] !== 'operator' || !operatorSlug(entries[0][1])) fail(400);
  url.search = '';
  return entries[0][1];
}
function preparePartnerRequest(request, config) {
  if (!config) fail(503);
  const url = new URL(request.url);
  let operatorSlugValue, journalCursor = null, journalLimit = 50, journalKind = 'all';
  if (partnerAction(url.pathname, config) === 'journal') {
    // kind=publications: bara publiceringshistoriken (se journalResponse).
    const kinds = url.searchParams.getAll('kind');
    if (kinds.length > 1 || kinds.length && kinds[0] !== 'publications') fail(400);
    if (kinds.length) { journalKind = 'publications'; url.searchParams.delete('kind'); }
    const limits = url.searchParams.getAll('limit');
    if (limits.length > 1 || limits.length && !/^(?:[1-9][0-9]?|100)$/.test(limits[0])) fail(400);
    if (limits.length) { journalLimit = Number(limits[0]); url.searchParams.delete('limit'); }
    const cursors = url.searchParams.getAll('cursor');
    if (cursors.length > 1) fail(400);
    if (cursors.length) {
      const cursor = cursors[0];
      if (!/^[a-zA-Z0-9_-]{1,200}$/.test(cursor)) fail(400);
      try { journalCursor = JSON.parse(Buffer.from(cursor,'base64url').toString('utf8')); } catch { fail(400); }
      url.searchParams.delete('cursor');
    }
  }
  if (request.method === 'GET') {
    if (partnerAction(url.pathname, config) === 'snapshot' && !url.search) {
      if (url.hash) fail(400);
    } else operatorSlugValue = takeOperatorSlug(url);
  } else if (request.method === 'POST' && PARTNER_OPERATOR_POSTS.includes(partnerAction(url.pathname, config))) {
    if (url.hash) fail(400);
    operatorSlugValue = takeOperatorSlug(url);
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
  const action = partnerAction(pathname, config);
  if (!['login', 'logout', 'snapshot', 'branding', 'team', 'journal', 'set-password', ...PARTNER_TABLE_GETS, ...PARTNER_TABLE_POSTS].includes(action)) fail(404);
  if (action === 'branding' || action === 'team') {
    if (request.method !== 'GET' && request.method !== 'POST') {
      return { response: new Response(null, { status: 405, headers: { Allow: 'GET, POST', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } }) };
    }
  } else {
    const allowed = ['snapshot', 'journal', ...PARTNER_TABLE_GETS].includes(action) ? 'GET' : 'POST';
    if (request.method !== allowed) {
      return { response: new Response(null, { status: 405, headers: { Allow: allowed, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } }) };
    }
  }
  if (request.method === 'POST') {
    const origin = new URL(normalized.url).origin;
    if (normalized.headers.get('origin') !== origin || !['same-origin', 'none'].includes(normalized.headers.get('sec-fetch-site') || '')
      || normalized.headers.has('next-action')) fail(403);
  }
  return { request: normalized, action, operatorSlug: operatorSlugValue, journalCursor, journalLimit, journalKind };
}

function sameOperatorScope(left, right) {
  return !!left && !!right && left.environment === right.environment && left.workspaceId === right.workspaceId;
}
async function defaultReadProject() {
  const { studioNativeRuntime } = await import('./studio-native-runtime.mjs');
  return (await studioNativeRuntime()).gamePolicy.readSaved();
}
async function openBrandingStore(config) {
  if (config?.store) return config.store;
  const pool = config?.pool;
  // { query } cannot BEGIN. Branding opens the pool itself (L24).
  if (typeof pool?.connect !== 'function' || typeof pool?.query !== 'function') fail(503);
  let createOperatorStore;
  try {
    ({ createOperatorStore } = await import('../../../packages/operators/server/operator-store.mjs'));
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') fail(503);
    throw error;
  }
  if (typeof createOperatorStore !== 'function') fail(503);
  try {
    return await createOperatorStore({ sql: pool, scope: config.scope, now: config.now });
  } catch (error) {
    if (messages.has(error?.statusCode)) throw error;
    fail(503);
  }
}
// Session, operator and the caller's active membership, read fresh for this request.
export async function partnerOperatorContext(prepared, config) {
  const session = await authorizePartnerWorkspace(prepared.request, config);
  const store = await openBrandingStore(config);
  if (typeof store.getOperatorBySlug !== 'function') fail(503);
  const operator = await store.getOperatorBySlug(prepared.operatorSlug);
  if (!operator || operator.slug !== prepared.operatorSlug) fail(404);
  if (operator.scope && !sameOperatorScope(operator.scope, session.scope)) fail(403);
  if (operator.status && operator.status !== 'active') fail(403);
  if (session.accessClass === 'internal-admin') {
    const context = internalPartnerContext(session, operator);
    if (!allowsWorkspaceResource(context, 'overview.read', { scope: session.scope, operatorId: operator.id })) fail(403);
    return { session, store, operator, context, membership: null };
  }
  if (typeof store.resolvePartnerContext !== 'function' || typeof store.getMembership !== 'function') fail(503);
  const context = await store.resolvePartnerContext({
    account: { userId: session.accountId, role: 'partner', status: 'active' },
    operatorSlug: prepared.operatorSlug,
  });
  if (!context || context.internalPreview === true) fail(403);
  if (context.operator?.id !== operator.id || context.account?.userId !== session.accountId) fail(403);
  if (context.membership?.status !== 'active' || context.operator?.status !== 'active' || context.account?.status !== 'active') fail(403);
  const membership = await store.getMembership(operator.id, session.accountId);
  if (!membership || membership.status !== 'active' || (membership.userId && String(membership.userId) !== session.accountId)) fail(403);
  if (membership.scope && !sameOperatorScope(membership.scope, session.scope)) fail(403);
  return { session, store, operator, context, membership };
}
export async function decidedPartnerContext({ session, store, operator, context, membership }) {
  if (session.accessClass === 'internal-admin') return context;
  if (typeof store.getRole !== 'function') fail(503);
  const role = await store.getRole(operator.id, membership.roleId);
  const scope = context.scope ?? session.scope;
  return {
    ...context,
    scope,
    membership: {
      userId: String(membership.userId),
      roleId: membership.roleId,
      status: membership.status,
      operatorId: operator.id,
      scope: membership.scope ?? scope,
    },
    role: role ? {
      id: role.id,
      permissions: role.permissions,
      operatorId: role.operatorId ?? operator.id,
      scope: role.scope ?? scope,
    } : null,
  };
}
// tables.read styr spelbordslistan, som i snapshoten (partner-data.mjs). Utan den
// bär utseendet bara bolagets val: inga spelbord (namn, scenmall, spel), inga
// dealerval per spelbord och, i granskningen, bara bolagsradernas ändringar.
// Granskningen säger då `tablesHidden: true` (en tom `affectedRooms` betyder att
// spelborden inte visas, inte att inga berörs: en publicering gäller alltid alla
// bolagets spelbord) och `hiddenTableChanges`, antalet dolda spelbordsrader, så
// att ett utkast som bara ändrar spelbordsval fortfarande kan publiceras.
// Spelbordens id som nycklar i branding.roomOverrides hör till utseendet
// (presentations.read), precis som i snapshotens branding.
function brandingWithoutTables(view) {
  if (Object.hasOwn(view, 'reviewToken')) {
    const changes = view.changes ?? [];
    const visible = changes.filter(row => row.roomId === null);
    return { ...view, affectedRooms: [], changes: visible, hiddenTableChanges: changes.length - visible.length, tablesHidden: true };
  }
  return { ...view, rooms: [], roomDealerChoices: {} };
}
// Utseendets API med partnersessionen: delas av `branding` och `dealer`.
async function partnerBranding(prepared, config) {
  const found = await partnerOperatorContext(prepared, config);
  const { session, store, operator } = found;
  const { createPartnerBrandingApi } = await import('./partner-branding-api.mjs');
  const repository=config.store?null:wrapNativePresentationRepository(createStudioRepository({pool:config.pool,scope:config.scope}),
    {env:config.env??process.env,fetchImpl:config.fetchImpl??fetch});
  const readAdministration=async()=>{
    if(typeof config.readAdministration==='function') {
      const value=await config.readAdministration();
      if(value?.value&&typeof value.revision==='string')return value;
      return {value,revision:createHash('sha256').update(JSON.stringify(value)).digest('hex')};
    }
    if(!repository)fail(503);
    return repository.readDocument('administration');
  };
  // Samma kontroll som ingången nedan, läst på nytt inne i transaktionen: en
  // ändring kräver både presentations.read och presentations.configure.
  const mayConfigure=decided=>['presentations.read','presentations.configure']
    .every(permission=>allowsWorkspaceResource(decided,permission,{scope:session.scope,operatorId:operator.id}));
  // tables.read läses om i transaktionen tillsammans med ändringsrätten, så att
  // svaret efter en ändring följer rollen som den var när ändringen gjordes.
  let reauthorized=null;
  const reauthorize=async source=>{
    const current=await partnerOperatorContext(prepared,{...config,store:source});
    const decided=await decidedPartnerContext(current);
    if(current.operator.id!==operator.id||current.session.accountId!==session.accountId
      ||current.session.accessClass!==session.accessClass
      ||!sameOperatorScope(decided.scope,session.scope))fail(403);
    reauthorized=decided;
    return mayConfigure(decided);
  };
  const withWriteContext=async(work,options={})=>{
    if(config.store)return work({store,readAdministration,reauthorize:()=>reauthorize(store)});
    return repository.transaction(()=>repository.withTransactionClient(async client=>{
      try {
      // Same order as other Studio writers: scope lock, then operator row lock.
      // Membership/role mutations take this row lock too, before changing grants.
      const locked=await client.query(
        '/* operator-store:lock-operator */ SELECT operator_id FROM croupier_studio.operators WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 FOR UPDATE',
        [config.scope.environment,config.scope.workspaceId,operator.id]);
      if(!locked.rows.length)fail(404);
      const source=await createOperatorStore({sql:client,scope:config.scope,now:config.now,
        transaction:callback=>repository.withTransactionClient(callback)});
      // Bolagets eget material joins every branding publication; empty without 021.
      return await work({store:source,readAdministration,reauthorize:()=>reauthorize(source),
        withMutationContext:repository.withMutationContext,materials:createOperatorMaterialStore({sql:client,scope:config.scope,now:config.now})});
      } catch(error) {
        if(Number.isInteger(error?.statusCode))throw new StudioStorageError('partner_request_rejected',error.statusCode);
        throw error;
      }
    }),options);
  };
  // Bolagets eget material: read before SQL for the negotiated candidate, then again under the lock.
  const api = createPartnerBrandingApi({store,readAdministration,withWriteContext,
    materials:config.store?undefined:createOperatorMaterialStore({sql:config.pool,scope:config.scope,now:config.now}),
    readProject:typeof config.readProject==='function'?config.readProject:defaultReadProject});
  const decided = await decidedPartnerContext(found);
  const { scope } = decided;
  // Spelbordens utseende (presentation, bakgrund, dealer, bordsgrafik): läsning
  // kräver presentations.read, ändring dessutom presentations.configure.
  if (!allowsWorkspaceResource(decided, 'presentations.read', { scope, operatorId: operator.id })) fail(403);
  const canConfigure = mayConfigure(decided);
  const mayReadTables = context => allowsWorkspaceResource(context, 'tables.read', { scope: session.scope, operatorId: operator.id });
  // Svaret efter en ändring följer rollen som den var när ändringen gjordes.
  const savedView = saved => ({...(reauthorized&&mayReadTables(reauthorized)?saved:brandingWithoutTables(saved)),canConfigure:true});
  return { found, api, decided, canConfigure, mayReadTables, savedView };
}
async function brandingResponse(prepared, config) {
  const { found: { session, operator }, api, decided, canConfigure, mayReadTables, savedView } = await partnerBranding(prepared, config);
  if (prepared.request.method === 'GET') {
    const view = await api.readState({ operatorId: operator.id });
    return json({ ...(mayReadTables(decided) ? view : brandingWithoutTables(view)), canConfigure }, 200, [], { vary: true });
  }
  if (!canConfigure) fail(403);
  const body = await bodyOf(prepared.request);
  const actionFields={
    'save-draft':['action','expectedDraftRevision','expectedPackageRevision','branding'],
    'discard-draft':['action','expectedDraftRevision','expectedPackageRevision'],
    review:['action','expectedDraftRevision','expectedPackageRevision'],
    publish:['action','expectedDraftRevision','expectedPackageRevision','reviewToken'],
    restore:['action','expectedDraftRevision','expectedPackageRevision','sourcePackageRevision'],
  };
  if(!Object.hasOwn(actionFields,body.action))fail(400);
  keys(body,actionFields[body.action]);
  const saved=await api.command({...body,operatorId:operator.id,actor:session.user,audit:operatorAuditContext(session)});
  return json(savedView(saved),200,[],{vary:true});
}
// Byta dealer för ett eget spelbord inom tilldelningen (ADMIN-FORENKLING 5.5):
// presentations.configure och allow.dealer. Valet sparas i bolagets
// utseendeutkast (roomOverrides) med samma CAS som `branding`; publiceringen
// går sedan genom utkastets granskning och publicering som förut.
async function dealerResponse(prepared, config) {
  const { found: { session, store, operator }, api, canConfigure, savedView } = await partnerBranding(prepared, config);
  if (!canConfigure) fail(403);
  const [{ cleanBrandingDraft }, { partnerAllow, partnerAssignment }, { readPackagePresentation }, { publicEditableBranding }] = await Promise.all([
    import('./partner-branding-api.mjs'), import('./partner-assignment.mjs'),
    import('../../../packages/presentation/server/presentation-package.mjs'), import('../../../packages/operators/contracts/branding.mjs')]);
  const body = await bodyOf(prepared.request);
  keys(body, ['roomId', 'dealer', 'expectedDraftRevision', 'expectedPackageRevision']);
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(body.roomId ?? '') || !text(body.dealer, 100)
    || !Number.isSafeInteger(body.expectedDraftRevision) || body.expectedDraftRevision < 0
    || !Number.isSafeInteger(body.expectedPackageRevision) || body.expectedPackageRevision < 1) fail(400);
  if (!['getBrandingDraft', 'getCurrentPackage'].every(name => typeof store[name] === 'function')) fail(503);
  const pack = await store.getCurrentPackage(operator.id);
  if (!pack) fail(404);
  if (pack.operatorId !== operator.id) fail(403);
  // Utkastets bas läses vid de revisioner anroparen såg; transaktionen i
  // api.command kontrollerar samma revisioner igen under bolagets lås.
  if (pack.revision !== body.expectedPackageRevision) fail(409);
  const presentation = readPackagePresentation(pack);
  if (!partnerAllow(pack, presentation).dealer) fail(403);
  if (!partnerAssignment(pack, presentation).dealers.some(dealer => dealer.id === body.dealer)) fail(422);
  const draft = await store.getBrandingDraft(operator.id);
  if ((draft?.revision ?? 0) !== body.expectedDraftRevision) fail(409);
  const clean = await cleanBrandingDraft(draft, pack, store);
  const base = clean ? clean.branding : publicEditableBranding(pack.branding);
  const overrides = { ...(base.roomOverrides ?? {}) };
  overrides[body.roomId] = { ...(overrides[body.roomId] ?? {}), dealer: body.dealer };
  const saved = await api.command({ action: 'save-draft', expectedDraftRevision: body.expectedDraftRevision,
    expectedPackageRevision: body.expectedPackageRevision, branding: { ...base, roomOverrides: overrides },
    operatorId: operator.id, actor: session.user, audit: operatorAuditContext(session) });
  return json(savedView(saved), 200, [], { vary: true });
}
// Begära material eller nyckelrotation (ADMIN-FORENKLING 5.5): en journalpost i
// bolagets journal (operator_audit_events). Inget annat ändras. Den enda läsaren i
// dag är partnerjournalen (`journal`, team.read + team.roles.assign), utan egen
// etikett för request.* och utan meddelandet; en Admin-läsare av begäranden och
// etiketterna i journalvyn är en egen UI-PR efter steg C.
// Behörigheterna följer planen (ADMIN-FORENKLING 5.4): material.request (alla
// standardroller) och integration.request (Integration-vyn kräver integrations.read).
// Före Studio-migrering 022 svarar lagret 503 studio_migration_required, och högst
// PARTNER_REQUEST_LIMIT begäranden per bolag och timme (429 partner_request_limit).
export const PARTNER_REQUEST_KINDS = Object.freeze({
  material: Object.freeze({ action: 'request.material', requires: Object.freeze(['material.request']) }),
  'key-rotation': Object.freeze({ action: 'request.key-rotation', requires: Object.freeze(['integrations.read', 'integration.request']) }),
});
async function requestResponse(prepared, config) {
  const found = await partnerOperatorContext(prepared, config);
  const decided = await decidedPartnerContext(found);
  const { session, store, operator } = found;
  const body = await bodyOf(prepared.request);
  if (!body || !Object.hasOwn(PARTNER_REQUEST_KINDS, body.kind)) fail(400);
  keys(body, ['kind', 'message'], ['kind']);
  const kind = PARTNER_REQUEST_KINDS[body.kind];
  if (!kind.requires.every(permission => allowsWorkspaceResource(decided, permission, { scope: session.scope, operatorId: operator.id }))) fail(403);
  if (Object.hasOwn(body, 'message') && (!text(body.message, 500) || body.message.trim() !== body.message)) fail(400);
  if (typeof store.recordPartnerRequest !== 'function') fail(503);
  const saved = await store.recordPartnerRequest({ operatorId: operator.id, action: kind.action, actor: session.user,
    audit: operatorAuditContext(session), ...(Object.hasOwn(body, 'message') ? { message: body.message } : {}) });
  return json({ ok: true, kind: body.kind, message: saved.message }, 200, [], { vary: true });
}
// Tilldelningen (presentations.read; spelborden med tables.read), partner-table-api.mjs.
async function assignmentResponse(prepared, config) {
  const found = await partnerOperatorContext(prepared, config);
  const decided = await decidedPartnerContext(found);
  const { readPartnerAssignment } = await import('./partner-table-api.mjs');
  return json(await readPartnerAssignment({ found, decided, config }), 200, [], { vary: true });
}
// Publiceringshistoriken: bolagets publicerade versioner, utan ändringsinnehåll
// och utan vem/hur (konto-id, accessClass, requestId, resourceType/Id).
const PUBLICATION_ACTIONS = Object.freeze(['package.publish']);
const publicationEntry = ({ id, atMs, beforeRevision, afterRevision }) => ({ id, atMs, beforeRevision, afterRevision });
// Administrationsdokumentets revision (spelbordens läge, spelinställningsutkast)
// är Scoutgamings interna, delade revision: den stannar i journalen på servern
// och skickas aldrig till bolaget.
const withoutAdministrationRevision = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const { administrationRevision: _hidden, ...rest } = value;
  return rest;
};
const partnerJournalEntry = entry => (entry?.changes && typeof entry.changes === 'object' && !Array.isArray(entry.changes)
  ? { ...entry, changes: Object.fromEntries(Object.entries(withoutAdministrationRevision(entry.changes))
    .map(([key, value]) => [key, withoutAdministrationRevision(value)])) } : entry);
async function journalResponse(prepared, config) {
  const found = await partnerOperatorContext(prepared, config);
  const decided = await decidedPartnerContext(found);
  const resource = { scope: decided.scope, operatorId: found.operator.id };
  const publications = prepared.journalKind === 'publications';
  // Hela journalen, med teamets händelser, kräver team.read och team.roles.assign.
  // kind=publications läses med reports.read, samma behörighet som snapshotens
  // publiceringar (partner-data.mjs): bara package.publish, utan `changes`.
  if (publications ? !allowsWorkspaceResource(decided,'reports.read',resource)
    : !allowsWorkspaceResource(decided,'team.read',resource) || !allowsWorkspaceResource(decided,'team.roles.assign',resource)) fail(403);
  if (typeof found.store.listAuditEvents !== 'function') fail(503);
  const result = await found.store.listAuditEvents(found.operator.id,{cursor:prepared.journalCursor,limit:prepared.journalLimit,
    ...(publications ? { actions: [...PUBLICATION_ACTIONS] } : {})});
  // Försvar på djupet: även om lagret skulle lämna andra rader bär svaret bara publiceringar.
  const entries = publications ? result.entries.filter(entry => PUBLICATION_ACTIONS.includes(entry?.action)).map(publicationEntry)
    : result.entries.map(partnerJournalEntry);
  return json({...result,entries,nextCursor:result.nextCursor ? Buffer.from(JSON.stringify(result.nextCursor)).toString('base64url') : null},200,[],{vary:true});
}
// Invite links an existing partner account, or creates an invited one (N2.6).
async function teamResponse(prepared, config) {
  const found = await partnerOperatorContext(prepared, config);
  const { session, store } = found;
  if (!['listRoles', 'listMemberships', 'upsertMembership'].every(name => typeof store[name] === 'function')) fail(503);
  const decided = await decidedPartnerContext(found);
  const reauthorize = async source => {
    const current = await partnerOperatorContext(prepared, { ...config, store: source });
    const latest = await decidedPartnerContext(current);
    if (current.operator.id !== found.operator.id || current.session.accountId !== session.accountId
      || current.session.accessClass !== session.accessClass || !sameOperatorScope(latest.scope, session.scope)) fail(403);
    return latest;
  };
  const withWriteContext = async work => {
    if (config.store) return work({ store, reauthorize: () => reauthorize(store) });
    const repository = createStudioRepository({ pool: config.pool, scope: config.scope });
    return repository.transaction(() => repository.withTransactionClient(async client => {
      try {
        // Match all other Studio writers: scope lock, then operator row lock.
        const locked = await client.query(
          '/* operator-store:lock-operator */ SELECT operator_id FROM croupier_studio.operators WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 FOR UPDATE',
          [config.scope.environment, config.scope.workspaceId, found.operator.id]);
        if (!locked.rows.length) fail(404);
        const source = await createOperatorStore({ sql: client, scope: config.scope, now: config.now,
          transaction: callback => repository.withTransactionClient(callback) });
        return await work({ store: source, reauthorize: () => reauthorize(source) });
      } catch (error) {
        if (Number.isInteger(error?.statusCode)) {
          const rejected = new StudioStorageError('partner_request_rejected', error.statusCode);
          if (error.statusCode === 409 && PARTNER_TEAM_CONFLICTS.includes(error.reason)) rejected.reason = error.reason;
          throw rejected;
        }
        throw error;
      }
    }));
  };
  const api = createPartnerTeamApi({
    store, boDb: config.boDb, gameDb: config.gameDb, journal: config.journal,
    mail: config.mail, now: config.now, publicOrigin: config.publicOrigin ?? config.allowedOrigins?.[0],
    reauthorize: () => reauthorize(store), withWriteContext,
  });
  if (prepared.request.method === 'GET') return json(await api.read(decided), 200, [], { vary: true });
  if (!api.writable(decided)) fail(403);
  const body = await bodyOf(prepared.request);
  return json(await api.write(decided, { actor: session.user, body }), 200, [], { vary: true });
}

// Invite and reset links are single-use. A partner with a hash can only replace
// it when the token kind is reset. Membership writes use the operator store;
// a failure rolls the credential transaction back and returns invited rows.
async function setPassword(request, body, config) {
  keys(body, ['token', 'password']);
  if (typeof body.token !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(body.token)) fail(400);
  if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128
    || /[\u0000-\u001f\u007f-\u009f]/u.test(body.password)) fail(422);
  if (typeof config.rateLimit !== 'function' || typeof config.clientAddress !== 'function' || typeof config.boDb?.transaction !== 'function') fail(503);
  const clientKey = await config.clientAddress(request);
  if (!text(clientKey, 256)) fail(503);
  if (await config.rateLimit({ clientKey, user: body.token, action: 'set-password' }) !== true) fail(503);
  const now = typeof config.now === 'function' ? config.now : Date.now;
  const store = await openBrandingStore(config);
  if (!['listOperators', 'listMemberships', 'upsertMembership'].every(name => typeof store[name] === 'function')) fail(503);
  const activated = [];
  try {
    await config.boDb.transaction(async () => {
      const tokens = await config.boDb.prepare("DELETE FROM tokens WHERE (token=? OR token=?) AND exp>=? AND kind IN ('invite','reset') RETURNING username,kind")
        .all(passwordTokenKey(body.token), body.token, Math.floor(now() / 1000));
      if (tokens.length !== 1) fail(400);
      const target = await config.boDb.prepare('SELECT id,username,role,hash FROM users WHERE username=? FOR UPDATE').get(tokens[0].username);
      if (!target?.id) fail(400);
      if (target.role !== 'partner') fail(403);
      const hasHash = typeof target.hash === 'string' && target.hash.length > 0;
      if (hasHash && tokens[0].kind !== 'reset') fail(403);
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync(body.password, salt, 64).toString('hex');
      const changed = await config.boDb.prepare('UPDATE users SET salt=?,hash=? WHERE username=? RETURNING id').all(salt, hash, tokens[0].username);
      if (changed.length !== 1) fail(503);
      await config.boDb.prepare('INSERT INTO bo_auth_epochs (user_id,epoch) VALUES (?,1) ON CONFLICT(user_id) DO UPDATE SET epoch=bo_auth_epochs.epoch+1').run(target.id);
      await config.boDb.prepare('DELETE FROM tokens WHERE username=?').run(tokens[0].username);
      const userId = String(target.id);
      const audit = operatorAuditContext({accountId:userId,accessClass:'activation'},'membership.activate');
      const actor = text(String(target.username || ''), 128) ? String(target.username) : userId;
      const operators = await store.listOperators();
      if (!Array.isArray(operators)) fail(503);
      for (const operator of operators) {
        const memberships = await store.listMemberships(operator.id);
        if (!Array.isArray(memberships)) fail(503);
        for (const membership of memberships) {
          if (String(membership?.userId) !== userId || membership.status !== 'invited') continue;
          const saved = await store.upsertMembership({
            actor, audit, operatorId: operator.id, userId, roleId: membership.roleId, status: 'active', expectedRevision: membership.revision,
          });
          activated.push({ actor, audit, operatorId: operator.id, userId, roleId: membership.roleId, revision: saved?.revision });
        }
      }
    });
  } catch (error) {
    for (const item of activated) {
      try {
        await store.upsertMembership({
          actor: item.actor, audit: {...item.audit,action:'membership.compensate'}, operatorId: item.operatorId, userId: item.userId, roleId: item.roleId,
          status: 'invited', expectedRevision: item.revision,
        });
      } catch { /* Password transaction rolled back; retrying the same link converges. */ }
    }
    if (error?.statusCode === 400 || error?.statusCode === 403) throw error;
    fail(503);
  }
  return json({ ok: true });
}

// A test injects a complete configuration. Anything else in the second
// position (for example Next's route context { params }) is not a
// configuration and must not replace the server's own.
export function isPartnerAuthConfig(value) {
  return !!value && typeof value === 'object' && Array.isArray(value.allowedOrigins)
    && typeof value.boDb?.prepare === 'function';
}

export async function handlePartnerAuth(request, injected) {
  try {
    if (!['GET', 'POST'].includes(request.method)) return rejectPartnerMethod();
    const config = isPartnerAuthConfig(injected) ? injected : await partnerAuthConfig();
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
    if (prepared.action === 'branding') return await brandingResponse(prepared, config);
    if (prepared.action === 'team') return await teamResponse(prepared, config);
    if (prepared.action === 'journal') return await journalResponse(prepared, config);
    if (prepared.action === 'assignment') return await assignmentResponse(prepared, config);
    if (prepared.action === 'dealer') return await dealerResponse(prepared, config);
    if (prepared.action === 'request') return await requestResponse(prepared, config);
    if (prepared.action === 'room-settings' || prepared.action === 'room-state') {
      const { partnerTableAction } = await import('./partner-table-api.mjs');
      return json(await partnerTableAction(prepared, config, () => bodyOf(prepared.request)), 200, [], { vary: true });
    }
    const body = await bodyOf(prepared.request);
    if (prepared.action === 'login') return await login(prepared.request, body, config);
    if (prepared.action === 'set-password') return await setPassword(prepared.request, body, config);
    return await logout(prepared.request, body, config);
  } catch (error) {
    return failure(error);
  }
}
