// croupier_studio has no table for operator writes: audit_events.action is closed
// to document and media actions (ops/neon-studio/001-studio-metadata.sql), and
// N2.2 adds no migration. Committed team and role writes therefore leave one
// server log line each. Ids, role ids and statuses only. An invitation may name
// the address as the first character plus ***@domain, never the full address,
// a password, a token or a cookie.
const TAG = '[operator-journal]';

export function createOperatorJournal({ log = console.info, now = Date.now } = {}) {
  return Object.freeze({
    record({ actor, action, operatorId, target }) {
      // The write has already committed; a failing clock or logger must not turn it into an error.
      try {
        const entry = { at: new Date(now()).toISOString(), actor, action, operatorId, target };
        log(TAG, JSON.stringify(entry));
        return entry;
      } catch { return null; }
    },
  });
}
