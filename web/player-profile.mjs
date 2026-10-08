// Editable player profile: display name and language only.
// Balance, currency and players.name stay server-owned.
const CONTROL = /[\u0000-\u001f\u007f\u0080-\u009f]/u;
const WITH_COLUMNS = 'SELECT name, currency, balance, display_name, locale FROM players WHERE id=?';
const WITHOUT_COLUMNS = 'SELECT name, currency, balance FROM players WHERE id=?';

export function missingProfileColumn(error) {
  if (!error || error.code === '42703') return error?.code === '42703';
  const message = String(error.message || '');
  return /no such column: (?:display_name|locale)\b/i.test(message)
    || /column ["']?(?:display_name|locale)["']? (?:of relation ["']?players["']? )?does not exist/i.test(message);
}

export function parsePlayerProfileBody(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return null;
  if (!Object.hasOwn(value, 'displayName') || !Object.hasOwn(value, 'locale')) return null;
  if (typeof value.displayName !== 'string' || typeof value.locale !== 'string') return null;
  const displayName = value.displayName.trim();
  const length = [...displayName].length;
  if (length < 2 || length > 40 || CONTROL.test(displayName)) return null;
  if (value.locale !== 'sv' && value.locale !== 'en') return null;
  return {displayName, locale: value.locale};
}

function cleanFallback(value) {
  const name = typeof value === 'string' ? value.replace(CONTROL, '').trim() : '';
  const clipped = [...name].slice(0, 40).join('');
  return clipped.length >= 2 ? clipped : 'Spelare';
}

function present(row, editable) {
  const balance = Number(row.balance);
  if (!Number.isFinite(balance)) throw Object.assign(new Error('profile_balance_unreadable'), {statusCode: 503});
  const currency = typeof row.currency === 'string' ? row.currency : '';
  const stored = editable && typeof row.display_name === 'string' ? row.display_name.trim() : '';
  const storedOk = stored && !CONTROL.test(stored) && [...stored].length >= 2 && [...stored].length <= 40;
  return {
    displayName: storedOk ? stored : cleanFallback(row.name),
    locale: row.locale === 'sv' || row.locale === 'en' ? row.locale : null,
    currency,
    balance,
    editable,
  };
}

export function publicPlayerProfile(profile) {
  return {
    displayName: profile.displayName,
    locale: profile.locale,
    currency: profile.currency,
    balance: profile.balance,
    editable: profile.editable === true,
  };
}

export async function readPlayerProfile(db, playerId) {
  try {
    const row = await db.prepare(WITH_COLUMNS).get(playerId);
    if (!row) return null;
    return present(row, true);
  } catch (error) {
    if (!missingProfileColumn(error)) throw error;
    const row = await db.prepare(WITHOUT_COLUMNS).get(playerId);
    if (!row) return null;
    return present(row, false);
  }
}

async function sqliteTransaction(db, work) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const value = await work();
    db.exec('COMMIT');
    return value;
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch { /* Keep the original failure. */ }
    throw error;
  }
}

export async function writePlayerProfile(db, playerId, profile) {
  const current = await readPlayerProfile(db, playerId);
  if (!current) return {statusCode: 401, body: {error: 'Sign in required'}};
  if (!current.editable) return {statusCode: 503, body: {error: 'profile_unavailable'}};
  const apply = async () => {
    const updated = await db.prepare('UPDATE players SET display_name=?, locale=? WHERE id=?').run(profile.displayName, profile.locale, playerId);
    if (Number(updated?.changes ?? 0) !== 1) return null;
    return readPlayerProfile(db, playerId);
  };
  try {
    const next = typeof db.transaction === 'function' ? await db.transaction(apply) : await sqliteTransaction(db, apply);
    if (!next?.editable) return {statusCode: 503, body: {error: 'profile_unavailable'}};
    return {statusCode: 200, body: publicPlayerProfile(next)};
  } catch (error) {
    if (missingProfileColumn(error)) return {statusCode: 503, body: {error: 'profile_unavailable'}};
    throw error;
  }
}

// Local SQLite only. Production Neon waits for 006-player-profile.sql.
export function ensureSqliteProfileColumns(db) {
  if (!db || db.backend === 'postgres' || typeof db.prepare !== 'function' || typeof db.exec !== 'function') return;
  let columns;
  try { columns = db.prepare('PRAGMA table_info(players)').all(); } catch { return; }
  if (!Array.isArray(columns)) return;
  const names = new Set(columns.map(column => column.name));
  if (!names.has('display_name')) db.exec('ALTER TABLE players ADD COLUMN display_name TEXT');
  if (!names.has('locale')) db.exec('ALTER TABLE players ADD COLUMN locale TEXT');
}

function send(res, status, body) {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store'});
  res.end(JSON.stringify(body));
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) return {tooLarge: true};
    chunks.push(chunk);
  }
  try { return {value: JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')}; }
  catch { return {invalid: true}; }
}

export async function handlePlayerProfile(req, res, {db, playerId, originOk = true, limit = 10000} = {}) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    send(res, 405, {error: 'method_not_allowed'});
    return true;
  }
  if (!playerId) {
    send(res, 401, {error: 'Sign in required'});
    return true;
  }
  try {
    if (req.method === 'GET') {
      const profile = await readPlayerProfile(db, playerId);
      if (!profile) { send(res, 401, {error: 'Sign in required'}); return true; }
      send(res, 200, publicPlayerProfile(profile));
      return true;
    }
    if (!originOk) {
      res.writeHead(403, {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'});
      res.end('Invalid origin');
      return true;
    }
    const body = await readBody(req, limit);
    if (body.tooLarge) { send(res, 413, {error: 'request_too_large'}); return true; }
    if (body.invalid) { send(res, 400, {error: 'invalid_json'}); return true; }
    const profile = parsePlayerProfileBody(body.value);
    if (!profile) { send(res, 422, {error: 'invalid_profile'}); return true; }
    const result = await writePlayerProfile(db, playerId, profile);
    send(res, result.statusCode, result.body);
  } catch {
    send(res, 503, {error: 'profile_unavailable'});
  }
  return true;
}
