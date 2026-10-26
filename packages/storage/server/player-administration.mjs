import { randomUUID, randomBytes, scryptSync } from 'node:crypto';

const bad = message => { throw Object.assign(new Error(message), { statusCode: 400 }); };
const clean = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
export function createPlayerAdministration({ db, boDb, now = () => new Date().toISOString() } = {}) {
  async function create({ username, password, name = username, currency = 'USD', actor, reason = 'operator-created demo account' }) {
    const key = typeof username === 'string' ? username.trim().toLowerCase() : '';
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(key) || typeof password !== 'string' || password.length < 12 || password.length > 128
      || !clean(name, 40) || !['USD','EUR','SEK'].includes(currency) || !clean(actor, 254) || !clean(reason, 500)) bad('Invalid player account');
    const salt = randomBytes(16).toString('hex'), hash = scryptSync(password, salt, 64).toString('hex');
    return db.transaction(async () => {
      if(boDb && (await boDb.prepare('SELECT id FROM users WHERE lower(username)=? OR lower(email)=?').all(key,key)).length) throw Object.assign(new Error('Account unavailable'),{statusCode:409});
      const id = randomUUID(), at = now();
      await db.prepare('INSERT INTO players (id,name,currency,balance,created_at) VALUES (?,?,?,?,?)').run(id, name.trim(), currency, 1000, at);
      await db.prepare('INSERT INTO player_accounts (email,player_id,salt,hash) VALUES (?,?,?,?)').run(`username:${key}`, id, salt, hash);
      await db.prepare('INSERT INTO transactions (player_id,type,amount,currency,meta,at) VALUES (?,?,?,?,?,?)').run(id, 'open', 1000, currency, 'starting demo balance', at);
      await db.prepare('INSERT INTO player_admin_events (player_id,actor,action,reason,previous_status,status,at) VALUES (?,?,?,?,?,?,?)').run(id, actor.trim(), 'create', reason.trim(), null, 'active', at);
      return { id, name: name.trim(), currency, balance: 1000, status: 'active', created_at: at };
    });
  }
  async function setStatus({ playerId, status, actor, reason }) {
    if (!clean(playerId, 256) || !['active','blocked','closed'].includes(status) || !clean(actor,254) || !clean(reason,500)) bad('Player, status and reason are required');
    return db.transaction(async () => {
      const player = await db.prepare('SELECT * FROM players WHERE id=? FOR UPDATE').get(playerId);
      if (!player) bad('No such player');
      if (player.status === 'closed' && status !== 'closed') bad('A closed account cannot be reactivated');
      if (player.status === status) return { id: playerId, status, changed: false };
      if (status === 'closed') {
        const table = await db.prepare('SELECT state FROM blackjack_tables WHERE player_id=?').get(playerId);
        if (table && JSON.parse(table.state).round) bad('Finish and collect the current round before closing the account');
      }
      const at = now();
      await db.prepare('UPDATE players SET status=?,account_epoch=account_epoch+1,closed_at=? WHERE id=?').run(status, status === 'closed' ? at : null, playerId);
      for (const table of ['player_sessions','preview_sessions']) await db.prepare(`DELETE FROM ${table} WHERE player_id=?`).run(playerId);
      await db.prepare('DELETE FROM bo_game_handoffs WHERE craig_user_id IN (SELECT craig_user_id FROM craig_player_links WHERE player_id=?)').run(playerId);
      await db.prepare('INSERT INTO player_admin_events (player_id,actor,action,reason,previous_status,status,at) VALUES (?,?,?,?,?,?,?)')
        .run(playerId, actor.trim(), status === 'active' ? 'reactivate' : status === 'blocked' ? 'block' : 'close', reason.trim(), player.status, status, at);
      return { id: playerId, status, changed: true };
    });
  }
  async function setPassword({ playerId, password, actor, reason }) {
    if (!clean(playerId,256) || typeof password !== 'string' || password.length < 12 || password.length > 128
      || !clean(actor,254) || !clean(reason,500)) bad('Invalid player password request');
    const salt = randomBytes(16).toString('hex'), hash = scryptSync(password,salt,64).toString('hex');
    return db.transaction(async () => {
      const player = await db.prepare('SELECT id,status FROM players WHERE id=? FOR UPDATE').get(playerId);
      const account = await db.prepare('SELECT player_id FROM player_accounts WHERE player_id=? FOR UPDATE').get(playerId);
      if (!player || !account) throw Object.assign(new Error('Player credentials unavailable'),{statusCode:404});
      if (player.status === 'closed') throw Object.assign(new Error('Closed player account'),{statusCode:409});
      await db.prepare('UPDATE player_accounts SET salt=?,hash=? WHERE player_id=?').run(salt,hash,playerId);
      for(const table of ['player_sessions','preview_sessions']) await db.prepare(`DELETE FROM ${table} WHERE player_id=?`).run(playerId);
      await db.prepare('DELETE FROM bo_game_handoffs WHERE craig_user_id IN (SELECT craig_user_id FROM craig_player_links WHERE player_id=?)').run(playerId);
      await db.prepare('INSERT INTO player_admin_events (player_id,actor,action,reason,previous_status,status,at) VALUES (?,?,?,?,?,?,?)')
        .run(playerId,actor.trim(),'password',reason.trim(),player.status,player.status,now());
      return { id:playerId,changed:true };
    });
  }
  return { create, setStatus, setPassword };
}

export function createPlayerPasswordCommand({ administration, cancelRuntime } = {}) {
  if (typeof administration?.setPassword !== 'function' || typeof cancelRuntime !== 'function') throw Error('Player password command unavailable');
  return async ({ body, actor }) => {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== 'password,playerId,reason'
      || !actor || !['admin','superadmin'].includes(actor.role)) throw Object.assign(new Error('Invalid player password request'),{statusCode:400});
    const changed=await administration.setPassword({...body,actor:actor.user});
    await cancelRuntime(changed.id);
    return {ok:true,id:changed.id,changed:true};
  };
}
