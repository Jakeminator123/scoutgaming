import { createHash, randomBytes } from 'node:crypto';

// Partner accounts live in croupier_auth.users. boDb takes `?` placeholders and
// returns int8 ids as text. operator_memberships.user_id is that id as text.
const accountId = /^[1-9]\d{0,18}$/;
const fail = statusCode => { throw Object.assign(new Error('operator_account_rejected'), { statusCode }); };
const INVITE_WINDOW_MS = 60 * 60 * 1000;
const INVITE_MAX = 5;
const inviteHits = new Map();

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

export function partnerMailbox(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (!plainName(email, 254) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
  return email;
}

// First character plus ***@domain. The full address never enters the journal.
export function maskOperatorEmail(email) {
  const mailbox = partnerMailbox(email);
  if (!mailbox) return null;
  return `${mailbox[0]}***@${mailbox.slice(mailbox.indexOf('@') + 1)}`;
}

export function visibleOperatorUsername(name) {
  return typeof name === 'string' && name.length > 0 && !name.includes('@') ? name : null;
}

// In memory, per actor, one hour. The login limiter lives in meta and only
// counts login, reset-request and set-password, so invitations keep their own.
export function consumePartnerInvite(actor, now = Date.now()) {
  const key = typeof actor === 'string' ? actor.trim().toLowerCase() : '';
  const at = typeof now === 'function' ? now() : now;
  if (!key || !Number.isFinite(at)) fail(503);
  const recent = (inviteHits.get(key) ?? []).filter(stamp => at - stamp < INVITE_WINDOW_MS && at - stamp >= 0);
  if (recent.length >= INVITE_MAX) {
    inviteHits.set(key, recent);
    fail(429);
  }
  recent.push(at);
  inviteHits.set(key, recent);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = inviteHits.get(key);
    if (!current) return;
    const index = current.lastIndexOf(at);
    if (index >= 0) current.splice(index, 1);
  };
}

function passwordLink(publicOrigin, token) {
  let url;
  try { url = new URL(publicOrigin); } catch { return null; }
  if (url.origin !== publicOrigin || url.protocol !== 'https:' || url.username || url.password) return null;
  return `${url.origin}/partner/set-password?t=${encodeURIComponent(token)}`;
}

export function partnerInviteDelivery({ to, link, operatorName, roleLabel }) {
  const name = typeof operatorName === 'string' ? operatorName.slice(0, 120) : '';
  const label = typeof roleLabel === 'string' ? roleLabel.slice(0, 80) : '';
  const text = [
    `ScoutGamingGroup: inbjudan till ${name}`,
    `Roll: ${label}`,
    `Välj lösenord: ${link}`,
    'Länken gäller i 72 timmar och kan användas en gång. Dela den inte.',
  ].join('\n\n');
  return Object.freeze({ to, kind: 'invite', role: 'partner', link, operatorName: name, roleLabel: label, text });
}

export async function sendPartnerInvite(mail, delivery) {
  if (!delivery?.link || typeof mail?.send !== 'function') return false;
  try { return (await mail.send(delivery))?.sent === true; }
  catch { return false; }
}

export async function playerOwnsEmail(gameDb, email) {
  if (typeof gameDb?.prepare !== 'function') return false;
  let rows;
  try {
    rows = await gameDb.prepare('SELECT player_id FROM player_accounts WHERE lower(email)=? OR lower(email)=?').all(email, `username:${email}`);
  } catch { fail(503); }
  return Array.isArray(rows) && rows.length > 0;
}

// Same users and tokens tables as Studio users/invite. The token is stored as
// studio-sha256:<hex>, which POST /studio/api/auth/set-password already deletes.
// Role stays partner. Studio's mint() rejects that role, so this writes the row itself.
export async function insertInvitedPartner(boDb, email, now = () => Date.now(), publicOrigin) {
  if (typeof boDb?.prepare !== 'function' || !partnerMailbox(email)) fail(422);
  const token = randomBytes(32).toString('base64url');
  const at = typeof now === 'function' ? now() : now;
  if (!Number.isFinite(at)) fail(503);
  const work = async () => {
    let inserted;
    try {
      inserted = await boDb.prepare('INSERT INTO users (username,email,role,created_at) VALUES (?,?,?,?) RETURNING id')
        .run(email, email, 'partner', new Date(at).toISOString());
    } catch (error) {
      if (error?.code === '23505') return null;
      throw error;
    }
    const userId = String(inserted?.lastInsertRowid ?? '');
    if (!accountId.test(userId)) fail(503);
    await boDb.prepare('DELETE FROM tokens WHERE username=?').run(email);
    await boDb.prepare('INSERT INTO tokens (token,username,kind,exp) VALUES (?,?,?,?)')
      .run(`studio-sha256:${createHash('sha256').update(token).digest('hex')}`, email, 'invite', Math.floor(at / 1000) + 72 * 3600);
    return userId;
  };
  const userId = typeof boDb.transaction === 'function' ? await boDb.transaction(work) : await work();
  if (!userId) return null;
  return Object.freeze({ userId, link: passwordLink(publicOrigin, token) });
}
