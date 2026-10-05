import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { validateStudioScope } from '../../web/storage/studio-contract.mjs';
import { isStudioRole, normalizeStudioRole } from './studio-access-policy.mjs';

export class NativeStudioAuthError extends Error {
  constructor(code = 'studio_auth_unavailable', statusCode = 503) {
    super(code); this.code = code; this.statusCode = statusCode;
  }
}
const denied = () => { throw new NativeStudioAuthError('studio_login_required', 401); };
const accountProjection = `SELECT u.id,u.username,u.salt,u.hash,u.role,e.epoch
  FROM users u LEFT JOIN bo_auth_epochs e ON e.user_id=u.id WHERE `;
const sourceStamp = account => account?.salt && account?.hash
  ? createHash('sha256').update(`${account.salt}:${account.hash}`).digest('hex') : null;
function currentEpoch(account) {
  const epoch = Number(account.epoch ?? 0);
  if (!Number.isSafeInteger(epoch) || epoch < 0) throw new NativeStudioAuthError();
  return epoch;
}
function cookie(request, name, pattern) {
  const entries = (request.headers.get('cookie') || '').split(';').map(part => part.trim())
    .filter(part => part.startsWith(`${name}=`));
  if (!entries.length) return null;
  if (entries.length !== 1 || !pattern.test(entries[0].slice(name.length + 1))) denied();
  return entries[0].slice(name.length + 1);
}
function claimsFor(token, secret, now) {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) denied();
  const signature = Buffer.from(parts[2], 'base64url');
  const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)
    || signature.toString('base64url') !== parts[2]) denied();
  let header, claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch { denied(); }
  if (header?.alg !== 'HS256' || header.typ !== 'JWT' || claims?.aud !== 'backoffice'
    || claims.partner || !isStudioRole(claims.role) || typeof claims.sub !== 'string'
    || typeof claims.source_stamp !== 'string' || !/^[a-f0-9]{64}$/.test(claims.source_stamp)
    || !Number.isSafeInteger(claims.auth_epoch) || claims.auth_epoch < 0
    || !Number.isFinite(claims.exp) || claims.exp * 1000 <= now) denied();
  return claims;
}

// Reuses CRAIG credentials, the existing BO signer and opaque Lab sessions.
// Never creates users, a JWT secret, an epoch, a session, or a replacement DB.
export function createStudioNativeAuth({ boDb, scope, now = Date.now } = {}) {
  if (typeof boDb?.prepare !== 'function') throw new NativeStudioAuthError();
  scope = validateStudioScope(scope);
  return async function authorize(request) {
    try {
      const token = cookie(request, 'bo_jwt', /^[A-Za-z0-9_.-]{1,8192}$/);
      // Reject missing/malformed cookies before borrowing a database connection.
      // A present invalid BO cookie must not fall back to another session.
      const bearer = token ? null : cookie(request, 'lab_session', /^[a-f0-9]{64}$/);
      if (!token && !bearer) denied();
      const readIdentity = async () => {
        if (token) {
          const secret = await boDb.prepare("SELECT v FROM meta WHERE k='jwt_secret'").get();
          if (!/^[a-f0-9]{64}$/i.test(secret?.v || '')) throw new NativeStudioAuthError();
          const claims = claimsFor(token, Buffer.from(secret.v, 'hex'), now());
          const key = claims.sub.trim().toLowerCase();
          const matches = await boDb.prepare(accountProjection + 'lower(u.username)=? OR lower(u.email)=?').all(key, key);
          const account = matches.length === 1 ? matches[0] : null;
          if (!account?.salt || !/^[a-f0-9]{128}$/i.test(account.hash ?? '')
            || sourceStamp(account) !== claims.source_stamp || account.role !== claims.role
            || currentEpoch(account) !== claims.auth_epoch) denied();
          return Object.freeze({ user: account.username, role: normalizeStudioRole(claims.role), scope });
        }
        const digest = createHash('sha256').update(bearer).digest('hex');
        const session = await boDb.prepare('SELECT * FROM lab_sessions WHERE token_digest=? AND expires>?').get(digest, now());
        if (!session || !['admin', 'superadmin'].includes(session.role)
          || !/^[a-f0-9]{64}$/.test(session.source_stamp ?? '')) denied();
        const matches = await boDb.prepare(accountProjection + 'u.id=?').all(session.craig_user_id);
        const account = matches.length === 1 ? matches[0] : null;
        if (!account || account.role !== session.role || sourceStamp(account) !== session.source_stamp
          || currentEpoch(account) !== session.auth_epoch) denied();
        return Object.freeze({ user: account.username, role: normalizeStudioRole(account.role), scope });
      };
      // The PostgreSQL adapter otherwise starts/commits a transaction for each
      // SELECT. Reuse one connection for this authorization only. Read the signer
      // or opaque session first, then project the current account, raw role,
      // password stamp inputs and epoch together. Nothing is cached between
      // requests; the joined fields share one fresh SQL statement snapshot. This
      // does not take the product mutation lock; an existing mutation transaction
      // retains its own lock and connection through the adapter's nested context.
      return await (typeof boDb.transaction === 'function'
        ? boDb.transaction(readIdentity, { serialize: false }) : readIdentity());
    } catch (error) {
      if (error instanceof NativeStudioAuthError) throw error;
      throw new NativeStudioAuthError();
    }
  };
}
