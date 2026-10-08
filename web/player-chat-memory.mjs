import { createHmac, randomBytes, randomUUID } from 'node:crypto';

const DAY = 86400000;
const DEALERS = new Set(['astrid', 'vera', 'amira', 'mei', 'dragge', 'paow']);
const HISTORY_STATUS = 'generated-not-playback-confirmed';
export const PLAYER_CHAT_MEMORY_LIMITS = Object.freeze({
  history: 30, historyChars: 8000, message: 1000, retentionDays: 30,
  requestRetentionMs: DAY, pendingMs: 360000, requestsPerMinute: 10,
});

export class PlayerChatMemoryError extends Error {
  constructor(code, statusCode = 409) { super(code); this.code = code; this.statusCode = statusCode; }
}
const reject = (code, status = 409) => { throw new PlayerChatMemoryError(code, status); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeText = value => typeof value === 'string' && value.length > 0
  && value.length <= PLAYER_CHAT_MEMORY_LIMITS.message && value.trim() === value
  && !/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/.test(value);
const safeRequestId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value);

// Callers must obtain playerId from authenticated server state, never a browser
// field or displayName. This module does not authenticate sessions. It stores no
// raw IDs, auth cookies, provider credentials, game state, or media URLs.
//
// Inject the existing persistent DatabaseSync connection. The caller retains
// ownership of it; this module does not open/close databases or read env vars.
export function createPlayerChatMemory(db, { now = Date.now } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS player_chat_memory_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS player_chat_memory_profiles (
      player_ref TEXT NOT NULL, dealer_id TEXT NOT NULL, history TEXT NOT NULL,
      revision TEXT NOT NULL, touched INTEGER NOT NULL, PRIMARY KEY(player_ref, dealer_id));
    CREATE TABLE IF NOT EXISTS player_chat_memory_requests (
      player_ref TEXT NOT NULL, dealer_id TEXT NOT NULL, request_ref TEXT NOT NULL,
      fingerprint TEXT NOT NULL, reservation TEXT NOT NULL, profile_revision TEXT NOT NULL,
      state TEXT NOT NULL, started INTEGER NOT NULL, result_fingerprint TEXT, committed_revision TEXT,
      PRIMARY KEY(player_ref, dealer_id, request_ref));
    CREATE INDEX IF NOT EXISTS player_chat_memory_request_age ON player_chat_memory_requests(started);
  `);

  function transaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = work(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  const secret = transaction(() => {
    if (!db.prepare('SELECT 1 FROM player_chat_memory_meta WHERE key=?').get('hmac-v1')
      && (db.prepare('SELECT 1 FROM player_chat_memory_profiles LIMIT 1').get()
        || db.prepare('SELECT 1 FROM player_chat_memory_requests LIMIT 1').get())) {
      reject('player_memory_secret_invalid', 500);
    }
    db.prepare('INSERT OR IGNORE INTO player_chat_memory_meta VALUES (?,?)').run('hmac-v1', randomBytes(32).toString('hex'));
    const value = db.prepare('SELECT value FROM player_chat_memory_meta WHERE key=?').get('hmac-v1')?.value;
    // Never silently replace a damaged secret: doing so strands existing memory.
    if (!/^[a-f0-9]{64}$/.test(value ?? '')) reject('player_memory_secret_invalid', 500);
    return Buffer.from(value, 'hex');
  });
  const digest = (...parts) => createHmac('sha256', secret).update(JSON.stringify(parts)).digest('hex');
  function identity(input) {
    if (!object(input) || typeof input.playerId !== 'string' || !input.playerId.length
      || input.playerId.length > 256 || input.playerId.trim() !== input.playerId
      || /[\u0000-\u001f\u007f-\u009f]/.test(input.playerId) || !DEALERS.has(input.dealerId)) {
      reject('player_memory_invalid_identity', 400);
    }
    // Canonical player IDs are already globally separated by server-owned
    // Partner/Craig mappings. Login-cookie and Partner-key rotation do not alter
    // this reference. Different dealers have separate profiles under the ref.
    return { playerRef: digest('native-player-memory-v1', input.playerId), dealerId: input.dealerId };
  }
  function prune(at) {
    db.prepare('DELETE FROM player_chat_memory_requests WHERE started<=?').run(at - PLAYER_CHAT_MEMORY_LIMITS.requestRetentionMs);
    db.prepare("UPDATE player_chat_memory_requests SET state='expired' WHERE state='pending' AND started<=?")
      .run(at - PLAYER_CHAT_MEMORY_LIMITS.pendingMs);
    db.prepare('DELETE FROM player_chat_memory_profiles WHERE touched<=?').run(at - PLAYER_CHAT_MEMORY_LIMITS.retentionDays * DAY);
  }
  function ensureProfile({ playerRef, dealerId }, at) {
    db.prepare('INSERT OR IGNORE INTO player_chat_memory_profiles VALUES (?,?,?,?,?)')
      .run(playerRef, dealerId, '[]', randomUUID(), at);
    return db.prepare('SELECT * FROM player_chat_memory_profiles WHERE player_ref=? AND dealer_id=?').get(playerRef, dealerId);
  }
  function storedHistory(row) {
    let entries;
    try { entries = JSON.parse(row.history); } catch { reject('player_memory_corrupt', 500); }
    if (!Array.isArray(entries) || entries.length > PLAYER_CHAT_MEMORY_LIMITS.history
      || entries.some(entry => !object(entry) || !safeText(entry.text)
        || (entry.role === 'user' ? Object.keys(entry).sort().join(',') !== 'role,text'
          : entry.role !== 'assistant' || !(entry.delivery === 'generated' && Object.keys(entry).sort().join(',') === 'delivery,role,text'
            || entry.delivery === 'played' && entry.origin === 'probe' && Object.keys(entry).sort().join(',') === 'delivery,origin,role,text')))
      || entries.reduce((sum, entry) => sum + entry.text.length, 0) > PLAYER_CHAT_MEMORY_LIMITS.historyChars) {
      reject('player_memory_corrupt', 500);
    }
    return entries;
  }
  function snapshot(scope, row) {
    return { ...scope, revision: row.revision, history: storedHistory(row).map(({ role, text }) => ({ role, text })),
      historyStatus: HISTORY_STATUS, retentionDays: PLAYER_CHAT_MEMORY_LIMITS.retentionDays };
  }
  function receipt(scope, revision) { return { ...scope, revision, historyStatus: HISTORY_STATUS }; }
  const readRequest = (scope, requestRef) => db.prepare('SELECT * FROM player_chat_memory_requests WHERE player_ref=? AND dealer_id=? AND request_ref=?')
    .get(scope.playerRef, scope.dealerId, requestRef);

  // Expiry is enforced on startup and access, even after an offline interval.
  transaction(() => prune(now()));

  return {
    // Only a current, completed playback receipt may add an autonomous line.
    // No fabricated player message is needed to initiate or commit a probe.
    playedInitiative(input, commitReceipt = () => {}) {
      const scope = identity(input);
      if (!safeText(input.text)) reject('player_memory_invalid_result', 400);
      return transaction(() => {
        const at = now(); prune(at);
        const row = ensureProfile(scope, at);
        if (row.revision !== input.expectedRevision) reject('player_memory_stale');
        const history = [...storedHistory(row), { role: 'assistant', text: input.text, origin: 'probe', delivery: 'played' }];
        while (history.length > PLAYER_CHAT_MEMORY_LIMITS.history || history.reduce((sum, entry) => sum + entry.text.length, 0) > PLAYER_CHAT_MEMORY_LIMITS.historyChars) history.shift();
        const revision = randomUUID();
        db.prepare('UPDATE player_chat_memory_profiles SET history=?, revision=? WHERE player_ref=? AND dealer_id=?')
          .run(JSON.stringify(history), revision, scope.playerRef, scope.dealerId);
        // The caller's durable playback ledger commits in this same transaction.
        commitReceipt();
        return receipt(scope, revision);
      });
    },
    profile(input) {
      const scope = identity(input);
      return transaction(() => { const at = now(); prune(at); return snapshot(scope, ensureProfile(scope, at)); });
    },
    forget(input) {
      const scope = identity(input);
      return transaction(() => {
        const at = now(); prune(at); ensureProfile(scope, at);
        db.prepare('UPDATE player_chat_memory_profiles SET history=?, revision=?, touched=? WHERE player_ref=? AND dealer_id=?')
          .run('[]', randomUUID(), at, scope.playerRef, scope.dealerId);
        // Retain only opaque request tombstones for one day: old network retries
        // cannot charge again or resurrect forgotten text. No result text is
        // kept in this ledger. Provider logs/backups are outside this deletion.
        db.prepare("UPDATE player_chat_memory_requests SET state='forgotten', result_fingerprint=NULL, committed_revision=NULL WHERE player_ref=? AND dealer_id=?")
          .run(scope.playerRef, scope.dealerId);
        return snapshot(scope, ensureProfile(scope, at));
      });
    },
    begin(input) {
      const scope = identity(input);
      if (!safeRequestId(input.requestId) || !safeText(input.message)) reject('player_memory_invalid_request', 400);
      const message = input.message;
      const requestRef = digest('native-memory-request-v1', scope.playerRef, scope.dealerId, input.requestId);
      const fingerprint = digest('native-memory-message-v1', message);
      const reservation = randomUUID();
      const initial = transaction(() => {
        const at = now(); prune(at);
        const old = readRequest(scope, requestRef);
        if (old) {
          if (old.fingerprint !== fingerprint) reject('player_memory_request_conflict');
          // Never replay old game revisions/media, nor silently start another
          // model request after a failed/uncertain response or process restart.
          reject(`player_memory_request_${old.state === 'pending' ? 'pending_or_interrupted' : old.state}`);
        }
        if (db.prepare("SELECT 1 FROM player_chat_memory_requests WHERE player_ref=? AND dealer_id=? AND state='pending'")
          .get(scope.playerRef, scope.dealerId)) reject('player_memory_busy');
        if (db.prepare('SELECT COUNT(*) AS count FROM player_chat_memory_requests WHERE player_ref=? AND dealer_id=? AND started>?')
          .get(scope.playerRef, scope.dealerId, at - 60000).count >= PLAYER_CHAT_MEMORY_LIMITS.requestsPerMinute) {
          reject('player_memory_rate_limited', 429);
        }
        const row = ensureProfile(scope, at);
        const result = snapshot(scope, row);
        db.prepare('INSERT INTO player_chat_memory_requests VALUES (?,?,?,?,?,?,?, ?,NULL,NULL)')
          .run(scope.playerRef, scope.dealerId, requestRef, fingerprint, reservation, row.revision, 'pending', at);
        db.prepare('UPDATE player_chat_memory_profiles SET touched=? WHERE player_ref=? AND dealer_id=?').run(at, scope.playerRef, scope.dealerId);
        return result;
      });
      function terminate(state) {
        return transaction(() => {
          prune(now());
          return Boolean(db.prepare("UPDATE player_chat_memory_requests SET state=? WHERE player_ref=? AND dealer_id=? AND request_ref=? AND reservation=? AND state='pending'")
            .run(state, scope.playerRef, scope.dealerId, requestRef, reservation).changes);
        });
      }
      return {
        ...initial,
        commit(value) {
          if (!object(value) || Object.keys(value).some(key => !['kind', 'exactText'].includes(key))
            || !['recordedLine', 'generatedText', 'silence'].includes(value.kind)
            || (value.kind === 'silence' ? value.exactText !== undefined && value.exactText !== '' : !safeText(value.exactText))) {
            reject('player_memory_invalid_result', 400);
          }
          const resultFingerprint = digest('native-memory-result-v1', value.kind, value.exactText ?? '');
          return transaction(() => {
            const at = now(); prune(at);
            const request = readRequest(scope, requestRef);
            if (!request || request.reservation !== reservation) reject('player_memory_stale');
            if (request.state === 'completed') {
              if (request.result_fingerprint !== resultFingerprint) reject('player_memory_result_conflict');
              return receipt(scope, request.committed_revision);
            }
            if (request.state !== 'pending') reject(`player_memory_request_${request.state}`);
            const row = db.prepare('SELECT * FROM player_chat_memory_profiles WHERE player_ref=? AND dealer_id=?').get(scope.playerRef, scope.dealerId);
            if (!row || row.revision !== request.profile_revision) reject('player_memory_stale');
            const history = [...storedHistory(row), { role: 'user', text: message }];
            // This is evidence of a validated generated server response, NOT a
            // browser playback acknowledgment. Pose/round/session checks remain
            // the caller's responsibility before invoking commit.
            if (value.kind !== 'silence') history.push({ role: 'assistant', text: value.exactText, delivery: 'generated' });
            while (history.length > PLAYER_CHAT_MEMORY_LIMITS.history
              || history.reduce((sum, entry) => sum + entry.text.length, 0) > PLAYER_CHAT_MEMORY_LIMITS.historyChars) history.shift();
            while (history[0]?.role === 'assistant') history.shift();
            const revision = randomUUID();
            db.prepare('UPDATE player_chat_memory_profiles SET history=?, revision=?, touched=? WHERE player_ref=? AND dealer_id=? AND revision=?')
              .run(JSON.stringify(history), revision, at, scope.playerRef, scope.dealerId, request.profile_revision);
            db.prepare("UPDATE player_chat_memory_requests SET state='completed', result_fingerprint=?, committed_revision=? WHERE player_ref=? AND dealer_id=? AND request_ref=? AND reservation=?")
              .run(resultFingerprint, revision, scope.playerRef, scope.dealerId, requestRef, reservation);
            return receipt(scope, revision);
          });
        },
        // Deliberately discard provider exception strings; they can contain
        // credentials, URLs or user data. Only a generic state is persisted.
        fail() { return terminate('failed'); },
        cancel() { return terminate('cancelled'); },
      };
    },
  };
}
