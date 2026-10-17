import { createHash, createHmac, randomBytes, scryptSync } from 'node:crypto';
import { craigIdentity } from '../../packages/studio-access/server/craig-identity.mjs';
import { installBoAuthEpoch } from '../../packages/studio-access/server/bo-auth-epoch.mjs';
import { validateStudioScope } from '../../web/storage/studio-contract.mjs';
import { isStudioRole } from './studio-access-policy.mjs';
import { createAccountCredentialResolver } from '../../packages/studio-access/server/account-credentials.mjs';
import { effectiveAccountRole } from '../../packages/studio-access/account-role.mjs';
import { studioLoginReturnTo } from './studio-login-client.mjs';

const fail = (statusCode = 400) => { throw Object.assign(new Error('studio_auth_request_rejected'), { statusCode }); };
const digest = value => createHash('sha256').update(value).digest('hex');
const tokenKey = token => `studio-sha256:${digest(token)}`;
const text = (value,max) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
function keys(body, allowed, required = allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))
    || required.some(key => !Object.hasOwn(body,key))) fail();
}
function origin(value) {
  let url; try { url = new URL(value); } catch { fail(503); }
  if (url.origin !== value || url.protocol !== 'https:' || url.username || url.password) fail(503);
  return url.origin;
}

// Same existing token table, with hashes for new links and support for currently
// outstanding raw legacy tokens when consumed. A mail failure is truthful and
// leaves an invitation available for an administrator to resend.
export function createStudioPasswordDelivery({ boDb, mail, publicOrigin, now = Date.now } = {}) {
  if (!boDb?.prepare || typeof mail?.send !== 'function') fail(503);
  publicOrigin = origin(publicOrigin);
  return {
    async mint({ username,email,role,kind }) {
      if (!text(username,254) || !text(email,254) || !effectiveAccountRole(role) || !['invite','reset'].includes(kind)) fail();
      const token = randomBytes(32).toString('base64url');
      await boDb.prepare('DELETE FROM tokens WHERE username=?').run(username);
      await boDb.prepare('INSERT INTO tokens (token,username,kind,exp) VALUES (?,?,?,?)')
        .run(tokenKey(token),username,kind,Math.floor(now()/1000) + (kind === 'invite' ? 72 : 2) * 3600);
      return { to: email, kind, role, link: `${publicOrigin}/studio/set-password?t=${encodeURIComponent(token)}` };
    },
    async send(invitation) {
      try { return (await mail.send(Object.freeze({ ...invitation })))?.sent === true; }
      catch { return false; }
    },
  };
}

// One bounded shared record uses the product store's transaction/advisory lock.
// Cold starts and different Vercel instances do not reset attempts. Identifiers
// are hashed, expired entries pruned, and capacity exhaustion fails closed.
export function createStudioLoginRateLimit({ boDb, now = Date.now, maxEntries = 2048 } = {}) {
  if (!boDb?.prepare || !boDb?.transaction || !Number.isInteger(maxEntries) || maxEntries < 2 || maxEntries > 4096) fail(503);
  const namespace = 'studio-auth-rate-limit-v1', windowMs = 15 * 60_000;
  return async ({ clientKey,user = '',action = 'login' }) => {
    if (!text(clientKey,256) || !text(user || '-',256) || !['login','reset-request','set-password'].includes(action)) fail(503);
    return boDb.transaction(async () => {
      const row = await boDb.prepare('SELECT v FROM meta WHERE k=? FOR UPDATE').get(namespace);
      let saved = { version: 1, entries: [] };
      if (row) {
        try { saved = JSON.parse(row.v); } catch { fail(503); }
        if (saved?.version !== 1 || !Array.isArray(saved.entries) || saved.entries.length > maxEntries
          || saved.entries.some(item => !item || !/^[a-f0-9]{64}$/.test(item.key) || !Number.isSafeInteger(item.count) || item.count < 1
            || !Number.isSafeInteger(item.until) || item.until < 0) || new Set(saved.entries.map(item => item.key)).size !== saved.entries.length) fail(503);
      }
      const at = now(), entries = new Map(saved.entries.filter(item => item.until > at).map(item => [item.key,item]));
      const selected = [digest(`${action}:ip:${clientKey}`), ...(user ? [digest(`${action}:user:${user.trim().toLowerCase()}`)] : [])];
      const max = action === 'reset-request' ? 3 : 10;
      if (selected.some(key => (entries.get(key)?.count || 0) >= max)
        || entries.size + selected.filter(key => !entries.has(key)).length > maxEntries) fail(429);
      for (const key of selected) {
        const previous = entries.get(key);
        entries.set(key,{ key, count: (previous?.count || 0) + 1, until: previous?.until || at + windowMs });
      }
      await boDb.prepare('INSERT INTO meta (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v')
        .run(namespace,JSON.stringify({ version:1, entries:[...entries.values()] }));
      return true;
    });
  };
}

const errors = new Map([[400,'Invalid request'],[401,'Authentication required'],[403,'Access denied'],[404,'Not found'],
  [405,'Method not allowed'],[413,'Request too large'],[415,'JSON required'],[429,'Too many attempts'],[503,'Authentication unavailable']]);
const cookie = (name,value,seconds,path = '/') => `${name}=${value}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${seconds}; Secure`;
function response(value,status = 200,cookies = []) {
  const headers = new Headers({ 'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer' });
  for (const value of cookies) headers.append('Set-Cookie',value);
  if (status === 429) headers.set('Retry-After','900');
  return new Response(JSON.stringify(value),{ status,headers });
}
async function bodyOf(request) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') || '')) fail(415);
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 8192)) fail(/^\d+$/.test(length) ? 413 : 400);
  const reader = request.body?.getReader(); if (!reader) fail();
  let size = 0; const chunks = [];
  try {
    while (true) {
      const { done,value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > 8192) { await reader.cancel(); fail(413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  let body; try { body = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); } catch { fail(); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail();
  return body;
}
async function revokeCurrentPlayerSession(gameDb,request) {
  if (!gameDb?.prepare) return;
  const values=(request.headers.get('cookie') || '').split(';').map(part=>part.trim())
    .filter(part=>part.startsWith('player_session='));
  const token=values.length === 1 ? values[0].slice('player_session='.length) : '';
  if (/^[a-f0-9]{64}$/.test(token)) await gameDb.prepare('DELETE FROM player_sessions WHERE digest=?').run(digest(token));
}
async function revokeIdentity(boDb,id) {
  await boDb.prepare('DELETE FROM lab_sessions WHERE craig_user_id=?').run(String(id));
  await boDb.prepare('DELETE FROM bo_lab_handoffs WHERE craig_user_id=?').run(String(id));
}

// Direct handlers for the existing CRAIG identity. No account/bootstrap/signing
// secret is invented; all mutations require the explicit native request origin.
export function createStudioNativeAuthActions({ boDb,gameDb,scope,authorize,mail,publicOrigin,allowedOrigins = [publicOrigin],
  authBase = '/studio/api/auth',rateLimit,clientAddress,now = Date.now } = {}) {
  if (!boDb?.prepare || !boDb?.transaction || typeof authorize !== 'function'
    || !['/studio/api/auth','/api/auth'].includes(authBase) || !Array.isArray(allowedOrigins) || !allowedOrigins.length) fail(503);
  scope = validateStudioScope(scope);
  const origins = new Set(allowedOrigins.map(origin));
  const identity = craigIdentity(boDb), authEpoch = installBoAuthEpoch(boDb);
  const credentials = gameDb?.prepare ? createAccountCredentialResolver({ identity, playerDb: gameDb, playerAccounts: true }) : null;
  const delivery = mail?.send ? createStudioPasswordDelivery({ boDb,mail,publicOrigin,now }) : null;
  const limited = typeof rateLimit === 'function' && typeof clientAddress === 'function';
  const availableActions = Object.freeze(['logout',...(limited ? ['login','set-password',...(delivery ? ['reset-request'] : [])] : [])]);
  async function limit(request,user,action) {
    if (!limited) fail(503);
    const clientKey = await clientAddress(request);
    if (!text(clientKey,256) || await rateLimit({ clientKey,user,action }) !== true) fail(503);
  }
  async function handle(request) {
    try {
      const url = new URL(request.url);
      if (!origins.has(url.origin) || url.protocol !== 'https:' || url.username || url.password) fail(403);
      for (const header of ['host','x-forwarded-host']) { const host = request.headers.get(header); if (host !== null && host !== url.host) fail(403); }
      if (url.pathname.includes('%') || url.pathname.includes('\\') || url.search || url.hash || !url.pathname.startsWith(`${authBase}/`)) fail(404);
      const action = url.pathname.slice(authBase.length+1);
      if (!['login','logout','reset-request','set-password'].includes(action)) fail(404);
      if (request.method !== 'POST') fail(405);
      if (request.headers.get('origin') !== url.origin || !['same-origin','none'].includes(request.headers.get('sec-fetch-site'))
        || request.headers.has('next-action')) fail(403);
      if (!availableActions.includes(action)) fail(503);
      const body = await bodyOf(request);
      if (action === 'login') {
        keys(body,['user','pass','returnTo'],['user','pass']);
        if (!text(body.user,254) || !body.user.trim() || !text(body.pass,256)
          || body.returnTo !== undefined && studioLoginReturnTo(body.returnTo) !== body.returnTo) fail();
        const login = body.user.trim().toLowerCase();
        if (!credentials) fail(503);
        await limit(request,await credentials.keyFor(login),action);
        const session = await boDb.transaction(async () => {
          const matches = await boDb.prepare('SELECT id,username,role FROM users WHERE lower(username)=? OR lower(email)=? FOR UPDATE').all(login,login);
          const account = await credentials.authenticate(login,body.pass);
          // Same credential namespace as the game, with explicit Studio admission.
          // Collision, pending invitation and non-admin credentials never mint BO cookies.
          if (matches.length !== 1 || account?.kind !== 'craig' || account.role !== 'admin'
            || String(matches[0].id) !== account.id || matches[0].role !== account.accountRole
            || !isStudioRole(matches[0].role)) fail(401);
          const signer = await boDb.prepare("SELECT v FROM meta WHERE k='jwt_secret'").get();
          if (!/^[a-f0-9]{64}$/i.test(signer?.v || '')) fail(503);
          const role = matches[0].role, epoch = await authEpoch(account.id);
          const parts = [{ alg:'HS256',typ:'JWT' },{ sub:account.name,role,aud:'backoffice',source_stamp:account.stamp,
            auth_epoch:epoch,exp:Math.floor(now()/1000) + 7 * 86400 }].map(value => Buffer.from(JSON.stringify(value)).toString('base64url'));
          const token = `${parts.join('.')}.${createHmac('sha256',Buffer.from(signer.v,'hex')).update(parts.join('.')).digest('base64url')}`;
          return { token,username:account.name,role:'admin' };
        });
        return response({ ok:true,username:session.username,role:session.role },200,[cookie('bo_jwt',session.token,604800),cookie('player_session','',0)]);
      }
      if (action === 'logout') {
        keys(body,[]);
        const actor = await authorize(request);
        if (!actor || actor.scope?.environment !== scope.environment || actor.scope?.workspaceId !== scope.workspaceId || !isStudioRole(actor.role)) fail(401);
        await boDb.transaction(async () => {
          const matches = await boDb.prepare('SELECT id FROM users WHERE username=? FOR UPDATE').all(actor.user);
          if (matches.length !== 1) fail(401);
          await revokeCurrentPlayerSession(gameDb,request);
          if (gameDb?.prepare) await gameDb.prepare('DELETE FROM bo_game_handoffs WHERE craig_user_id=?').run(String(matches[0].id));
          await boDb.prepare('INSERT INTO bo_auth_epochs (user_id,epoch) VALUES (?,1) ON CONFLICT(user_id) DO UPDATE SET epoch=bo_auth_epochs.epoch+1').run(matches[0].id);
          await revokeIdentity(boDb,matches[0].id);
        });
        return response({ ok:true },200,[cookie('bo_jwt','',0),cookie('lab_session','',0),cookie('player_session','',0),
          cookie('bo_game_state','',0,'/api/auth/bo/callback')]);
      }
      if (action === 'reset-request') {
        keys(body,['user']); if (!text(body.user,254) || !body.user.trim()) fail();
        const login = body.user.trim().toLowerCase(); await limit(request,login,action);
        const invitation = await boDb.transaction(async () => {
          const matches = await boDb.prepare('SELECT id,username,email,role,hash FROM users WHERE lower(username)=? OR lower(email)=? FOR UPDATE').all(login,login);
          const user = matches.length === 1 ? matches[0] : null;
          if (!user?.hash || !text(user.email,254) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(user.email) || !effectiveAccountRole(user.role)) return null;
          return delivery.mint({ ...user,kind:'reset' });
        });
        if (invitation) await delivery.send(invitation);
        return response({ ok:true }); // Never reveal account existence or mail status.
      }
      keys(body,['token','pass']);
      if (typeof body.token !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(body.token)
        || !text(body.pass,128) || body.pass.length < 8) fail();
      await limit(request,body.token,action);
      const salt = randomBytes(16).toString('hex'), hash = scryptSync(body.pass,salt,64).toString('hex');
      await boDb.transaction(async () => {
        const tokens = await boDb.prepare("DELETE FROM tokens WHERE (token=? OR token=?) AND exp>=? AND kind IN ('invite','reset') RETURNING username,kind")
          .all(tokenKey(body.token),body.token,Math.floor(now()/1000));
        if (tokens.length !== 1) fail();
        const target = await boDb.prepare('SELECT id,role FROM users WHERE username=? FOR UPDATE').get(tokens[0].username);
        if (!target || !effectiveAccountRole(target.role)) fail();
        const changed = await boDb.prepare('UPDATE users SET salt=?,hash=? WHERE username=? RETURNING id').all(salt,hash,tokens[0].username);
        if (changed.length !== 1) fail();
        // product-v1's update trigger bumps auth_epoch in this transaction.
        await boDb.prepare('DELETE FROM tokens WHERE username=?').run(tokens[0].username);
        await revokeIdentity(boDb,changed[0].id);
      });
      return response({ ok:true },200,[cookie('bo_jwt','',0),cookie('lab_session','',0)]);
    } catch (error) {
      const status = errors.has(error.statusCode) ? error.statusCode : 503;
      return response({ error:errors.get(status) },status);
    }
  }
  return Object.freeze({ handle,availableActions });
}
