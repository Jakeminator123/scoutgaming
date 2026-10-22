import { createHash } from 'node:crypto';
import { readBackofficePlayerSource } from '../bo-player-session.mjs';
import { validateStudioScope } from '../../../packages/studio-registry/server/document-contract.mjs';

const fingerprint = row => row?.salt && row?.hash
  ? createHash('sha256').update(`${row.salt}:${row.hash}`).digest('hex') : null;
const sessionFields = ['player_id', 'source_stamp', 'display_name', 'expires'];
const copySession = row => row && Object.fromEntries(sessionFields.map(key => [key, row[key]]));
const sameSession = (a, b) => b && sessionFields.every(key => Object.is(a[key], b[key]));
const abort = signal => {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Shared command aborted', 'AbortError');
};

/** Locked counterpart to the PostgreSQL player binding. Call only after R/P/A
 * in the same G -> S transaction. This helper opens no connection/transaction.
 * P precedes credential/session locks to match existing account writers. The
 * session is first read only for provenance, then locked last and compared in
 * full. G also fences an absent BO epoch row, whose existing meaning is zero.
 * The caller must retain this outer transaction through command and response.
 */
export function createSharedCommandAuth({ db, boDb, scope, playerAccounts = false, now = Date.now } = {}) {
  if (![db, boDb].every(value => typeof value?.prepare === 'function'
    && typeof value?.assertSharedTransaction === 'function')
    || typeof playerAccounts !== 'boolean' || typeof now !== 'function') {
    throw new TypeError('Explicit shared command authentication adapters required');
  }
  const studioScope = Object.freeze(validateStudioScope(scope));
  const assertCurrent = signal => {
    abort(signal);
    db.assertSharedTransaction({ studioScope, serialize: true });
    boDb.assertSharedTransaction({ studioScope, serialize: true });
  };
  const clock = () => {
    const value = now();
    if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('Invalid shared command clock');
    return value;
  };
  async function read(database, sql, parameters, signal) {
    assertCurrent(signal);
    const row = await database.prepare(sql).get(...parameters);
    assertCurrent(signal);
    return row;
  }
  async function bindingById(sessionId, { actorId, signal } = {}) {
    assertCurrent(signal);
    const digest = typeof sessionId === 'string' && /^player-([a-f0-9]{64})$/.exec(sessionId)?.[1];
    if (!digest || typeof actorId !== 'string' || !actorId) return null;
    const first = copySession(await read(db,
      'SELECT player_id,source_stamp,display_name,expires FROM player_sessions WHERE digest=? AND expires>?',
      [digest, clock()], signal));
    if (!first || first.player_id !== actorId || !Number.isSafeInteger(first.expires)
      || first.expires <= clock() || typeof first.source_stamp !== 'string') return null;
    const local = /^local:([a-f0-9]{64})$/.exec(first.source_stamp);
    const credential = /^credential:([a-f0-9]{64})$/.exec(first.source_stamp);
    const backoffice = readBackofficePlayerSource(first.source_stamp);
    if (!local && !credential && !backoffice || local && !playerAccounts) return null;

    const player = await read(db, 'SELECT id,status FROM players WHERE id=? FOR SHARE', [actorId], signal);
    if (!player || player.id !== actorId || player.status !== 'active') return null;
    if (local) {
      const account = await read(db, 'SELECT player_id,salt,hash FROM player_accounts WHERE player_id=? FOR SHARE', [actorId], signal);
      if (!account || account.player_id !== actorId || fingerprint(account) !== local[1]) return null;
    } else {
      const link = await read(db, 'SELECT craig_user_id FROM craig_player_links WHERE player_id=? FOR SHARE', [actorId], signal);
      if (!link || typeof link.craig_user_id !== 'string' || !link.craig_user_id) return null;
      const user = await read(boDb, 'SELECT id,salt,hash FROM users WHERE id=? FOR SHARE', [link.craig_user_id], signal);
      if (!user || String(user.id) !== link.craig_user_id
        || fingerprint(user) !== (backoffice?.stamp ?? credential[1])) return null;
      if (backoffice) {
        const row = await read(boDb, 'SELECT epoch FROM bo_auth_epochs WHERE user_id=? FOR SHARE', [link.craig_user_id], signal);
        const epoch = Number(row?.epoch ?? 0);
        if (!Number.isSafeInteger(epoch) || epoch < 0) throw new Error('Invalid authentication epoch');
        if (epoch !== backoffice.authEpoch) return null;
      }
    }
    const locked = await read(db,
      'SELECT player_id,source_stamp,display_name,expires FROM player_sessions WHERE digest=? AND expires>? FOR SHARE',
      [digest, clock()], signal);
    if (!sameSession(first, locked) || locked.expires <= clock()) return null;
    return Object.freeze({ actorId, sessionId, expiresAt: locked.expires, partnerKeyId: null });
  }
  return Object.freeze({ bindingById });
}
