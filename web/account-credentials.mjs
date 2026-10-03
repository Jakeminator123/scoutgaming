import { createHash, scryptSync, timingSafeEqual } from 'node:crypto';

import { effectiveAccountRole, isAdministratorRole } from './account-role.mjs';
export { effectiveAccountRole, isAdministratorRole } from './account-role.mjs';
const normalize = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const digest = value => createHash('sha256').update(value).digest('hex');

// Both existing credential namespaces are inspected before checking a password.
// A pending CRAIG invitation still owns its login name. Collisions fail closed;
// a wrong password never causes a retry against another identity or role.
export function createAccountCredentialResolver({ identity = null, playerDb, playerAccounts = false } = {}) {
  if (!playerDb?.prepare || identity && typeof identity.candidates !== 'function') throw Error('Account credentials unavailable');
  async function candidates(login) {
    const key = normalize(login);
    if (!key || key.length > 254 || /[\u0000-\u001f\u007f-\u009f]/u.test(key)) return [];
    const craig = identity ? await identity.candidates(key) : [];
    const local = await playerDb.prepare('SELECT email,player_id,salt,hash FROM player_accounts WHERE lower(email)=? OR lower(email)=?').all(key, `username:${key}`);
    if (!Array.isArray(craig) || !Array.isArray(local)) throw Error('Account credentials unavailable');
    return [...craig.map(account => ({ kind: 'craig', account })), ...local.map(account => ({ kind: 'player', account }))];
  }
  async function keyFor(login) {
    const found = await candidates(login);
    return found.length === 1 ? `${found[0].kind}:${found[0].account.id ?? found[0].account.player_id}` : `unknown:${normalize(login)}`;
  }
  async function authenticate(login, password) {
    if (typeof password !== 'string' || !password.length || password.length > 256) return null;
    const found = await candidates(login);
    if (found.length !== 1) return null;
    const { kind, account } = found[0];
    if (kind === 'craig') {
      const role = effectiveAccountRole(account.role);
      if (!role) return null;
      let verified;
      try { verified = await identity.authenticate(normalize(login), password); }
      catch (error) { if (error.message === 'Account setup is incomplete. Finish your Scout invitation before signing in.') return null; throw error; }
      if (!verified || String(verified.id) !== String(account.id)) return null;
      return { ...verified, kind, role, accountRole: account.role };
    }
    if (identity && !playerAccounts) return null;
    if (password.length > 128 || typeof account.salt !== 'string' || !account.salt || !/^[a-f0-9]{128}$/i.test(account.hash || '')) return null;
    const computed = scryptSync(password, account.salt, 64), expected = Buffer.from(account.hash, 'hex');
    if (expected.length !== computed.length || !timingSafeEqual(computed, expected)) return null;
    return { kind, playerId: account.player_id, sourceStamp: `local:${digest(`${account.salt}:${account.hash}`)}`, role: 'player' };
  }
  return Object.freeze({ authenticate, keyFor });
}
