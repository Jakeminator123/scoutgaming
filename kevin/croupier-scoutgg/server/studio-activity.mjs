// Kevin 12 Oct: "kan vi se sessions från när de loggar in så vi kan följa dem". What a signed-in back office account does
// in the game, grouped per sign-in: sid = sha256 of the bo_jwt cookie value, first 16 hex (the BO logs the same sid on its
// "Signed in" row), never the token itself. Events: table.created, table.opened, seated, chat {len}, left; rounds come
// from the game's own settlements (shared_settlements) for the guest cookies that sid used. Chat text is never stored.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';

const h16 = s => createHash('sha256').update(String(s)).digest('hex').slice(0, 16);
export const sidOf = headers => { const m = /(?:^|;\s*)bo_jwt=([A-Za-z0-9._-]+)(?:;|$)/.exec(headers?.cookie ?? ''); return m ? h16(m[1]) : null; };

export function createStudioActivity(file, tableDb) {
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE IF NOT EXISTS studio_activity (at TEXT NOT NULL, user TEXT NOT NULL, sid TEXT, ip TEXT, ua TEXT,
    kind TEXT NOT NULL, tbl TEXT, guest TEXT, detail TEXT);
    CREATE INDEX IF NOT EXISTS studio_activity_user ON studio_activity(user, at);`);
  const ins = db.prepare('INSERT INTO studio_activity VALUES (?,?,?,?,?,?,?,?,?)');
  // guest: the astrid_guest cookie, stored hashed; it links the sign-in to that visitor's seats and settlements.
  function log({ user, sid = null, ip = null, ua = null, kind, table = null, guest = null, detail = null }) {
    if (!user || !kind) return;
    try { ins.run(new Date().toISOString(), String(user).toLowerCase(), sid, ip ? String(ip).slice(0, 64) : null, ua ? String(ua).slice(0, 300) : null,
      kind, table, guest ? h16(guest) : null, detail ? JSON.stringify(detail) : null); } catch {}
  }
  function list({ user = null, since = null } = {}) {
    user = user ? String(user).trim().toLowerCase() : null;
    const rows = db.prepare(`SELECT * FROM studio_activity WHERE (? IS NULL OR user = ?) AND (? IS NULL OR at >= ?) ORDER BY at LIMIT 5000`)
      .all(user, user, since, since);
    const events = rows.map(r => ({ at: r.at, user: r.user, sid: r.sid, ip: r.ip, ua: r.ua, kind: r.kind, table: r.tbl, detail: r.detail ? JSON.parse(r.detail) : null }));
    // Rounds: settlements of the players whose guest cookie appears on this user's events, credited to the latest sid seen
    // for that guest at that table.
    const seen = new Map();   // guestHash|table -> {sid, ip, ua}
    for (const r of rows) if (r.guest && r.tbl) seen.set(`${r.guest}|${r.tbl}`, { sid: r.sid, ip: r.ip, ua: r.ua, user: r.user });
    if (seen.size) {
      let tdb; try { tdb = new DatabaseSync(tableDb, { readOnly: true }); } catch {}
      if (tdb) {
        try {
          const players = tdb.prepare('SELECT room, token, id FROM shared_players').all();
          for (const p of players) {
            // shared_players.token is already sha256(cookie) (shared-table.mjs keyFor): its first 16 hex are the guest hash.
            const who = seen.get(`${String(p.token).slice(0, 16)}|${p.room}`); if (!who) continue;
            for (const s of tdb.prepare('SELECT receipt FROM shared_settlements WHERE room = ? AND player_id = ?').all(p.room, p.id)) {
              let rc; try { rc = JSON.parse(s.receipt); } catch { continue; }
              const at = new Date(rc.settledAt ?? 0).toISOString();
              if (since && at < since) continue;
              events.push({ at, user: who.user, sid: who.sid, ip: who.ip, ua: who.ua, kind: 'round', table: p.room,
                detail: { bet: rc.staked, net: rc.net, result: rc.net > 0 ? 'win' : rc.net < 0 ? 'loss' : 'push' } });
            }
          }
        } catch {} finally { try { tdb.close(); } catch {} }
      }
    }
    events.sort((a, b) => a.at.localeCompare(b.at));
    return { events };
  }
  return { log, list };
}
