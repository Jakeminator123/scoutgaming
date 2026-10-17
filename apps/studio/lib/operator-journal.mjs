// Optional post-commit diagnostics. Durable audit is inserted atomically by
// web/storage/operator-store.mjs into croupier_studio.operator_audit_events.
// This logger is not the audit source or a condition for write success.
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
