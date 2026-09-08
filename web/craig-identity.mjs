import { scryptSync, timingSafeEqual, createHash } from 'node:crypto';

// Read existing CRAIG credentials; do not copy passwords or grant BO roles.
export function craigIdentity(db) {
  const fingerprint = u => u?.salt && u?.hash ? createHash('sha256').update(`${u.salt}:${u.hash}`).digest('hex') : null;
  return {
    authenticate(login, password) {
      const matches=db.prepare('SELECT id,username,salt,hash FROM users WHERE lower(username)=? OR lower(email)=?').all(login,login);
      const u=matches.length===1 ? matches[0] : null;
      const computed=scryptSync(password,u?.salt??'invalid-craig-account',64);
      if(u && !u.hash)throw Error('Account setup is incomplete. Finish your Scout invitation before signing in.');
      if(!u?.hash || !/^[a-f0-9]{128}$/i.test(u.hash) || !timingSafeEqual(computed,Buffer.from(u.hash,'hex')))return null;
      return {id:String(u.id),name:u.username,stamp:fingerprint(u)};
    },
    stamp(id) {return fingerprint(db.prepare('SELECT salt,hash FROM users WHERE id=?').get(id));}
  };
}
