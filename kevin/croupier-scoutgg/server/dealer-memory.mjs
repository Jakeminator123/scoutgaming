// The dealer's memory of each visitor, kept across visits: the name they play under, how many
// times they came, what was said lately, and short notes the dealer chose to remember
// ("calls me jugge kung", "a Djurgården fan"). Keyed by a hash of the visitor's guest cookie,
// never by who they are. Notes that look like personal data are never stored.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';

const PERSONAL = /@|https?:|\d{5}|\+?\d[\d\s-]{7,}|password|lösenord|personnummer|credit card|kreditkort|bank|address|adress/i;

export function createDealerMemory(filename) {
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode=WAL;PRAGMA synchronous=NORMAL');
  db.exec(`CREATE TABLE IF NOT EXISTS dealer_memory (
    visitor TEXT NOT NULL, dealer TEXT NOT NULL, name TEXT, visits INTEGER NOT NULL DEFAULT 0,
    first_seen INTEGER, last_seen INTEGER, notes TEXT NOT NULL DEFAULT '[]', lines TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (visitor, dealer))`);
  const key = guest => createHash('sha256').update(`dealer-memory:${guest ?? ''}`).digest('hex').slice(0, 32);
  const get = (visitor, dealer) => db.prepare('SELECT * FROM dealer_memory WHERE visitor=? AND dealer=?').get(visitor, dealer);

  return {
    key,
    /** What the dealer remembers about this visitor, as prompt lines (empty when they are new). */
    recall(visitor, dealer) {
      const row = get(visitor, dealer);
      if (!row) return { known: false, text: 'You have never met this player before.', lines: [] };
      const notes = JSON.parse(row.notes), lines = JSON.parse(row.lines);
      const days = Math.round((Date.now() - row.last_seen) / 86400000);
      return {
        known: true, lines,
        text: [`You know this player as "${row.name ?? 'unknown'}". You have talked ${row.visits} time(s); last time ${days ? `${days} day(s) ago` : 'today'}.`,
          notes.length ? `Things you remember about them: ${notes.join('; ')}.` : ''].filter(Boolean).join(' '),
      };
    },
    /** Store one exchange, the player's current name and an optional new note. */
    remember(visitor, dealer, { name, said, reply, note }) {
      const row = get(visitor, dealer), now = Date.now();
      const notes = row ? JSON.parse(row.notes) : [], lines = row ? JSON.parse(row.lines) : [];
      const clean = String(note ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
      if (clean && !/^none$/i.test(clean) && !PERSONAL.test(clean) && !notes.includes(clean)) notes.push(clean);
      lines.push({ who: 'player', text: String(said).slice(0, 280) }, { who: 'dealer', text: String(reply).slice(0, 280) });
      const newVisit = !row || now - row.last_seen > 3600000;
      db.prepare(`INSERT INTO dealer_memory (visitor, dealer, name, visits, first_seen, last_seen, notes, lines) VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(visitor, dealer) DO UPDATE SET name=excluded.name, visits=excluded.visits, last_seen=excluded.last_seen, notes=excluded.notes, lines=excluded.lines`)
        .run(visitor, dealer, name ?? row?.name ?? null, (row?.visits ?? 0) + (newVisit ? 1 : 0), row?.first_seen ?? now, now,
          JSON.stringify(notes.slice(-20)), JSON.stringify(lines.slice(-16)));
    },
    close: () => db.close(),
  };
}
