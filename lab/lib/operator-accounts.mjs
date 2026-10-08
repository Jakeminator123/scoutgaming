// Partner accounts live in croupier_auth.users. boDb takes `?` placeholders and
// returns int8 ids as text. operator_memberships.user_id is that id as text.
const accountId = /^[1-9]\d{0,18}$/;
const fail = statusCode => { throw Object.assign(new Error('operator_account_rejected'), { statusCode }); };

function plainName(value, max) {
  return typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max
    && !/[\u0000-\u001f\u007f-\u009f]/.test(value);
}

function account(row) {
  return Object.freeze({ userId: String(row.id), username: String(row.username), role: row.role });
}

export function createOperatorAccounts(boDb) {
  if (typeof boDb?.prepare !== 'function') fail(503);
  // More than one row means the login name is ambiguous; treat it as unknown.
  const single = rows => Array.isArray(rows) && rows.length === 1 && accountId.test(String(rows[0]?.id)) ? account(rows[0]) : null;
  return Object.freeze({
    async byId(userId) {
      if (typeof userId !== 'string' || !accountId.test(userId)) return null;
      return single(await boDb.prepare('SELECT id,username,role FROM users WHERE id=?').all(userId));
    },
    async byUsername(username) {
      if (!plainName(username, 254)) return null;
      return single(await boDb.prepare('SELECT id,username,role FROM users WHERE lower(username)=?').all(username.toLowerCase()));
    },
    async byEmail(email) {
      if (!plainName(email, 254) || !/^[^\s@]+@[^\s@]+$/.test(email)) return null;
      return single(await boDb.prepare('SELECT id,username,role FROM users WHERE lower(email)=?').all(email.toLowerCase()));
    },
    async usernames(userIds) {
      const ids = [...new Set(userIds)].filter(value => typeof value === 'string' && accountId.test(value));
      const names = new Map();
      for (let start = 0; start < ids.length; start += 100) {
        const chunk = ids.slice(start, start + 100);
        const rows = await boDb.prepare(`SELECT id,username FROM users WHERE id IN (${chunk.map(() => '?').join(',')})`).all(...chunk);
        for (const row of Array.isArray(rows) ? rows : []) {
          if (typeof row?.username === 'string') names.set(String(row.id), row.username);
        }
      }
      return names;
    },
  });
}
