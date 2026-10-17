import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { GatewayError } from '../openclaw.mjs';

const DAY = 86400000;
export const COMPANION_RETENTION_DAYS = 30;

// Separate from the catalogue and all game/wallet databases. SQLite transactions
// protect the shared search quota and request reservations across processes.
export function createCompanionStore(directory, { now = Date.now } = {}) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(directory, 'companion.sqlite'));
  db.exec(`PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, name TEXT, history TEXT NOT NULL, revision TEXT NOT NULL, touched INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS requests (identity TEXT NOT NULL, id TEXT NOT NULL, fingerprint TEXT NOT NULL, result TEXT, started INTEGER NOT NULL, PRIMARY KEY(identity,id));
    CREATE TABLE IF NOT EXISTS searches (at INTEGER NOT NULL);`);
  function transaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = work(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function prune() {
    db.prepare('DELETE FROM profiles WHERE touched < ?').run(now() - COMPANION_RETENTION_DAYS * DAY);
    db.prepare('DELETE FROM requests WHERE started < ?').run(now() - DAY);
    db.prepare('DELETE FROM searches WHERE at <= ?').run(now() - 3600000);
  }
  function profile(identity) {
    prune();
    db.prepare('INSERT OR IGNORE INTO profiles VALUES (?,NULL,?,?,?)').run(identity, '[]', randomUUID(), now());
    const row = db.prepare('SELECT * FROM profiles WHERE id=?').get(identity);
    return { name: row.name, history: JSON.parse(row.history), revision: row.revision };
  }
  return {
    profile,
    rename(identity, name) {
      profile(identity);
      db.prepare('UPDATE profiles SET name=?, revision=?, touched=? WHERE id=?').run(name, randomUUID(), now(), identity);
      return profile(identity);
    },
    forget(identity) {
      // Changing the revision invalidates in-flight replies, so they cannot
      // resurrect forgotten history. Cached replies are removed as well.
      transaction(() => {
        db.prepare('DELETE FROM profiles WHERE id=?').run(identity);
        db.prepare('DELETE FROM requests WHERE identity=?').run(identity);
      });
      return profile(identity);
    },
    reserve(identity, id, fingerprint) {
      return transaction(() => {
        prune();
        const old = db.prepare('SELECT * FROM requests WHERE identity=? AND id=?').get(identity, id);
        if (old) {
          if (old.fingerprint !== fingerprint) throw new GatewayError('companion_request_conflict', 409);
          if (old.result) return JSON.parse(old.result);
          throw new GatewayError('companion_request_pending_or_interrupted', 409);
        }
        if (db.prepare('SELECT 1 FROM requests WHERE identity=? AND result IS NULL AND started>?').get(identity, now() - 120000)) throw new GatewayError('companion_busy', 409);
        if (db.prepare('SELECT COUNT(*) AS n FROM requests WHERE result IS NULL AND started>?').get(now() - 120000).n >= 2) throw new GatewayError('companion_busy', 429);
        if (db.prepare('SELECT COUNT(*) AS n FROM requests WHERE identity=? AND started>?').get(identity, now() - 60000).n >= 10) throw new GatewayError('companion_rate_limit', 429);
        db.prepare('INSERT INTO requests VALUES (?,?,?,NULL,?)').run(identity, id, fingerprint, now());
        return null;
      });
    },
    finish(identity, id, revision, history, result) {
      transaction(() => {
        const changed = db.prepare('UPDATE profiles SET history=?, touched=? WHERE id=? AND revision=?').run(JSON.stringify(history), now(), identity, revision);
        if (!changed.changes) throw new GatewayError('companion_profile_changed', 409);
        db.prepare('UPDATE requests SET result=? WHERE identity=? AND id=?').run(JSON.stringify(result), identity, id);
      });
    },
    fail(identity, id, code) {
      db.prepare('UPDATE requests SET result=? WHERE identity=? AND id=?').run(JSON.stringify({ error: code }), identity, id);
    },
    reserveSearch() {
      return transaction(() => {
        prune();
        const used = db.prepare('SELECT COUNT(*) AS n FROM searches').get().n;
        if (used >= 20) return false;
        // Reserve BEFORE network I/O; failures count and restarts do not reset.
        db.prepare('INSERT INTO searches VALUES (?)').run(now());
        return true;
      });
    },
    close() { db.close(); },
  };
}
