import { randomBytes, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { canonicalStudioJson, validateStudioScope } from '../../../packages/studio-registry/server/document-contract.mjs';
import { isStudioRole, normalizeStudioRole, meetsStudioAdminActionRole } from './studio-access-policy.mjs';
import { normalizeDisplayName } from '../../../packages/studio-access/display-name.mjs';
import { createStudioPasswordDelivery } from './studio-native-auth-actions.mjs';
import { effectiveAccountRole } from '../../../packages/studio-access/account-role.mjs';

const fail = (statusCode = 400) => { throw Object.assign(new Error('studio_account_request_rejected'), { statusCode }); };
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
const SCOPES = Object.freeze(['launch', 'play', 'wallet', 'history', 'lobby', 'events']);
function keys(body, allowed, required = allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))
    || required.some(key => !Object.hasOwn(body, key))) fail();
}
function walletUrl(value) {
  if (value === undefined || value === null || value === '') return null;
  if (!text(value, 2048)) fail();
  let url; try { url = new URL(value); } catch { fail(); }
  const host = url.hostname.toLowerCase(), ipv4 = host.split('.').map(Number);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.port
    || !host.includes('.') || /(?:^|\.)(?:localhost|local|internal|invalid|test)$/.test(host)
    || host.startsWith('[') || isIP(host) && (ipv4[0] === 0 || ipv4[0] === 10 || ipv4[0] === 127 || ipv4[0] >= 224
      || ipv4[0] === 169 && ipv4[1] === 254 || ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31
      || ipv4[0] === 192 && ipv4[1] === 168 || ipv4[0] === 100 && ipv4[1] >= 64 && ipv4[1] <= 127)) fail();
  return url.href;
}
function ipAllow(value) {
  if (value === undefined || value === null || value === '') return null;
  if (!text(value, 2048)) fail();
  const ips = value.split(',').map(part => part.trim());
  if (ips.length > 50 || ips.some(ip => !isIP(ip)) || new Set(ips).size !== ips.length) fail();
  return ips.join(',');
}

// Vercel owns identity/config metadata. Render owns every operation that touches
// a live player, wallet or partner runtime; missing authority means no handler.
export function createStudioAdminAccounts({ boDb, gameDb, scope, gameAuthority, mail, publicOrigin, now = Date.now } = {}) {
  if (!boDb?.prepare || !boDb?.transaction) fail(503);
  scope = validateStudioScope(scope);
  const handlers = new Map(), gates = new Map();
  const delivery = mail?.send ? createStudioPasswordDelivery({ boDb, mail, publicOrigin, now }) : null;
  function trusted(context, action) {
    if (canonicalStudioJson(validateStudioScope(context.scope)) !== canonicalStudioJson(scope)
      || !text(context.actor?.user, 254) || !isStudioRole(context.actor.role)
      || !meetsStudioAdminActionRole(context.actor.role, action)) fail(403);
    return Object.freeze({ user: context.actor.user, role: normalizeStudioRole(context.actor.role) });
  }
  const register = (action, run) => handlers.set(`POST /studio/api/admin/${action}`, async context => {
    trusted(context, action); return run(context);
  });
  async function delivered(context, invitation) {
    const result = { ok: true, kind: invitation.kind, emailSent: false };
    const send = async () => { result.emailSent = await delivery.send(invitation); };
    if (typeof context.afterCommit === 'function') context.afterCommit(send);
    else await send(); // Direct handler callers have already committed above.
    return result;
  }
  if (delivery) {
    register('users/invite', async context => {
      keys(context.body, ['email','role']);
      const email = typeof context.body.email === 'string' ? context.body.email.trim().toLowerCase() : '';
      if (!text(email,254) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || context.body.role !== 'admin') fail();
      let invitation;
      try {
        invitation = await boDb.transaction(async () => {
          if (!gameDb?.prepare) fail(503);
          if ((await boDb.prepare('SELECT id FROM users WHERE lower(username)=? OR lower(email)=?').all(email,email)).length
            || (await gameDb.prepare('SELECT player_id FROM player_accounts WHERE lower(email)=? OR lower(email)=?').all(email,`username:${email}`)).length) fail(409);
          await boDb.prepare('INSERT INTO users (username,email,role,created_at) VALUES (?,?,?,?)')
            .run(email,email,context.body.role,new Date(now()).toISOString());
          return delivery.mint({ username: email, email, role: context.body.role, kind: 'invite' });
        });
      } catch (error) { if (error.code === '23505') fail(409); throw error; }
      return delivered(context, invitation);
    });
    register('users/resend', async context => {
      keys(context.body,['username']); if (!text(context.body.username,254)) fail();
      const invitation = await boDb.transaction(async () => {
        const user = await boDb.prepare('SELECT id,username,email,role,hash FROM users WHERE username=? FOR UPDATE').get(context.body.username);
        if (!user) fail(404);
        if (!text(user.email,254) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(user.email) || !effectiveAccountRole(user.role)) fail(409);
        return delivery.mint({ ...user, kind: user.hash ? 'reset' : 'invite' });
      });
      return delivered(context, invitation);
    });
  }
  register('apikeys/create', async context => {
    keys(context.body,['name','scopes','walletUrl','ipAllow'],['name']);
    const { name, scopes = SCOPES } = context.body;
    if (!text(name,80) || !Array.isArray(scopes) || !scopes.length || scopes.some(scope => !SCOPES.includes(scope))
      || new Set(scopes).size !== scopes.length) fail();
    const wallet = walletUrl(context.body.walletUrl), ips = ipAllow(context.body.ipAllow);
    const id = randomUUID(), key = `ck_live_${randomBytes(18).toString('base64url')}`, secret = `cs_${randomBytes(32).toString('base64url')}`;
    await boDb.prepare('INSERT INTO api_keys (id,name,key,secret,scopes,wallet_url,ip_allow,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id,name.trim(),key,secret,JSON.stringify(scopes),wallet,ips,context.actor.user,new Date(now()).toISOString());
    return { ok: true, key: { id, name: name.trim(), key, secret, scopes: [...scopes], walletUrl: wallet, note: 'Secret is shown ONCE. Store it now.' } };
  });
  if (typeof gameAuthority?.execute === 'function') {
    const authorityActions = ['players/password','players/status','apikeys/revoke','apikeys/rotate','apikeys/launch','apikeys/credit'];
    for (const action of authorityActions) register(action, async context => {
      const body = context.body;
      if (action === 'players/status') {
        keys(body,['playerId','status','reason']);
        if (!text(body.playerId,256) || !['active','blocked','closed'].includes(body.status) || !text(body.reason,500)) fail();
      } else if (action === 'players/password') {
        keys(body,['playerId','password','reason']);
        if (!text(body.playerId,256) || typeof body.password !== 'string' || body.password.length < 12
          || body.password.length > 128 || /[\u0000-\u001f\u007f-\u009f]/u.test(body.password) || !text(body.reason,500)) fail();
      } else {
        const fields = action === 'apikeys/launch' ? ['id','playerId','displayName','currency','language']
          : action === 'apikeys/credit' ? ['id','playerId','amount'] : ['id'];
        keys(body,fields, action === 'apikeys/credit' ? ['id','playerId','amount'] : ['id']);
        if (!text(body.id,256)) fail();
        if (action === 'apikeys/launch') {
          if (body.playerId !== undefined && !text(body.playerId,256) || body.currency !== undefined && !['USD','EUR','SEK'].includes(body.currency)
            || body.language !== undefined && !['en','sv'].includes(body.language)) fail();
          try { normalizeDisplayName(body.displayName); } catch { fail(); }
        }
        if (action === 'apikeys/credit' && (!text(body.playerId,256) || !Number.isFinite(body.amount) || body.amount <= 0 || body.amount > 100000)) fail();
      }
      const result = await gameAuthority.execute({ action, body: structuredClone(body), actor: trusted(context,action), scope, request: context.request });
      if (!result || typeof result !== 'object' || result instanceof Response || result.ok !== true) fail(503);
      if (action === 'players/password') {
        if (result.id !== body.playerId || result.changed !== true) fail(503);
        return { ok: true, id: result.id, changed: true }; // Never echo credentials/provider payloads.
      }
      if (action === 'apikeys/launch') {
        // Explicit projection: the engine reply also carries curlLines/signedString/curlNote (API key and signature); never forward them.
        const str = value => typeof value === 'string' ? value : undefined, num = value => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
        if (!str(result.url)) fail(503);
        return Object.fromEntries(Object.entries({ ok: true, url: result.url, playerId: str(result.playerId), playerRef: str(result.playerRef),
          balance: num(result.balance), currency: str(result.currency), expiresIn: num(result.expiresIn) }).filter(([, value]) => value !== undefined));
      }
      return result;
    });
    const ready = context => typeof gameAuthority.execute === 'function' && authorityActions.includes(context.endpoint.action);
    gates.set('game-authority', ready);
    gates.set('cancel-player-runtime', context => ready(context) && ['players/status','players/password'].includes(context.endpoint.action));
    gates.set('player-lifecycle-and-ledger', context => context.endpoint.action === 'players/create' || ready(context) && ['players/status','players/password'].includes(context.endpoint.action));
  }
  return { handlers, gates };
}
