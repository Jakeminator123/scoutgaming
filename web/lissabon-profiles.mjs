import { createHash, randomBytes } from 'node:crypto';

const cookieName = 'lissabon_profile';
const lifetime = 30 * 86400;
const digest = value => createHash('sha256').update(value).digest('hex');
const tokenFor = req => (req.headers.cookie ?? '').match(/(?:^|;\s*)lissabon_profile=([a-f0-9]{64})(?:;|$)/)?.[1];
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
function localRequest(req) {
  try {
    const host = new URL(`http://${req.headers.host}`).hostname;
    return ['localhost', '127.0.0.1', '[::1]'].includes(host)
      && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  } catch { return false; }
}

/** Shared-computer demo profiles, deliberately not password authentication.
 * Only the explicitly enabled loopback Lissabon process installs this API. */
export function createLissabonProfiles({ db, createPlayer, enabled = false, onSwitch = () => {}, now = Date.now }) {
  if (enabled) db.exec(`
    CREATE TABLE IF NOT EXISTS lissabon_profiles (player_id TEXT PRIMARY KEY, name_key TEXT UNIQUE NOT NULL);
    CREATE TABLE IF NOT EXISTS lissabon_profile_sessions (digest TEXT PRIMARY KEY, player_id TEXT NOT NULL, expires INTEGER NOT NULL);
  `);
  function session(req) {
    if (!enabled || !localRequest(req)) return null;
    const token = tokenFor(req);
    if (!token) return null;
    const row = db.prepare(`SELECT p.id, p.name FROM lissabon_profile_sessions s
      JOIN lissabon_profiles d ON d.player_id=s.player_id JOIN players p ON p.id=d.player_id
      WHERE s.digest=? AND s.expires>?`).get(digest(token), now());
    return row ? { playerId: row.id, displayName: row.name, partnerKeyId: null, owner: `lissabon-${digest(token)}` } : null;
  }
  const cookie = (token, age) => `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}`;
  async function handle(req, res, pathname, currentPlayerId) {
    if (pathname !== '/api/lissabon/profiles') return false;
    const reply = (status, value, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(value)); };
    try {
      if (!enabled) fail('Lissabon-profiler är inte aktiverade.', 404);
      if (!localRequest(req)) fail('Profilerna är endast tillgängliga lokalt.', 403);
      if (req.method === 'GET') {
        const current = session(req);
        reply(200, { profiles: db.prepare('SELECT p.id, p.name FROM lissabon_profiles d JOIN players p ON p.id=d.player_id ORDER BY p.name').all(),
          current: current ? { id: current.playerId, name: current.displayName } : null });
        return true;
      }
      if (req.method !== 'POST') fail('GET eller POST krävs.', 405);
      if (req.headers.origin !== `http://${req.headers.host}`) fail('Ogiltigt ursprung.', 403);
      let raw = '';
      for await (const part of req) { raw += part; if (raw.length > 1024) fail('För stor begäran.', 413); }
      const value = JSON.parse(raw);
      if (!value || !['create', 'select', 'guest'].includes(value.action)) fail('Välj en profil eller skapa en ny.');
      // A switch never abandons an active hand or moves its wallet to someone else.
      const game = currentPlayerId && db.prepare('SELECT state FROM blackjack_tables WHERE player_id=?').get(currentPlayerId);
      if (game && JSON.parse(game.state).round) fail('Avsluta handen innan du byter profil.', 409);
      let profile;
      if (value.action === 'create') {
        const name = typeof value.name === 'string' ? value.name.trim().normalize('NFC') : '';
        if (!name || name.length > 40 || /[\u0000-\u001f\u007f-\u009f]/.test(name)) fail('Välj ett namn med 1–40 tecken.');
        const key = name.toLocaleLowerCase('sv-SE');
        if (db.prepare('SELECT 1 FROM lissabon_profiles WHERE name_key=?').get(key)) fail('Namnet finns redan. Välj profilen eller använd ett annat namn.', 409);
        db.exec('BEGIN IMMEDIATE');
        try {
          profile = createPlayer({ name });
          db.prepare('INSERT INTO lissabon_profiles VALUES (?,?)').run(profile.id, key);
          db.exec('COMMIT');
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      } else if (value.action === 'select') {
        if (typeof value.id !== 'string') fail('Välj en befintlig profil.');
        profile = db.prepare('SELECT p.id, p.name FROM lissabon_profiles d JOIN players p ON p.id=d.player_id WHERE p.id=?').get(value.id);
        if (!profile) fail('Profilen finns inte.', 404);
      }
      const previous = session(req), oldToken = tokenFor(req);
      if (oldToken) db.prepare('DELETE FROM lissabon_profile_sessions WHERE digest=?').run(digest(oldToken));
      if (previous) onSwitch(previous.playerId);
      db.prepare('DELETE FROM lissabon_profile_sessions WHERE expires<=?').run(now());
      const token = profile ? randomBytes(32).toString('hex') : '';
      if (profile) db.prepare('INSERT INTO lissabon_profile_sessions VALUES (?,?,?)').run(digest(token), profile.id, now() + lifetime * 1000);
      reply(200, { current: profile ? { id: profile.id, name: profile.name } : null }, { 'Set-Cookie': cookie(token, profile ? lifetime : 0) });
    } catch (error) { reply(error.status ?? 400, { error: error.status ? error.message : 'Profilen kunde inte sparas.' }); }
    return true;
  }
  return { enabled, session, handle };
}
