import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { GatewayError } from '../openclaw.mjs';

const DAY = 86400000;
export const COMPANION_RETENTION_DAYS = 30;
export const COMPANION_STORE_FILE = 'companion.json';
const SCHEMA = 'croupier-companion-v1';

// Throws on anything but a complete store; the backup tool uses the same check.
export function parseCompanionState(text) {
  const state = JSON.parse(text);
  if (state?.schema !== SCHEMA || !['profiles', 'requests', 'searches'].every(key => Array.isArray(state[key]))
    || Object.keys(state).length !== 4) throw new Error('invalid_companion_store');
  return state;
}

// Separate from the catalogue and all game/wallet data. One Director process owns
// the directory (a Render disk mounts on one instance). Each operation reads,
// changes and atomically replaces the file synchronously, so nothing interleaves
// in that process and a crash leaves either the old or the new complete file.
export function createCompanionStore(directory, { now = Date.now } = {}) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, COMPANION_STORE_FILE), temporary = `${path}.tmp`;
  let closed = false;
  function read() {
    let text;
    try { text = readFileSync(path, 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') return { schema: SCHEMA, profiles: [], requests: [], searches: [] }; throw error; }
    // Never start over on damage: that would reset the paid search quota.
    try { return parseCompanionState(text); } catch { throw new GatewayError('companion_store_corrupt', 503); }
  }
  function write(state) {
    const file = openSync(temporary, 'w', 0o600);
    try { writeFileSync(file, JSON.stringify(state)); fsyncSync(file); } finally { closeSync(file); }
    renameSync(temporary, path);
    if (process.platform !== 'win32') { const folder = openSync(directory, 'r'); try { fsyncSync(folder); } finally { closeSync(folder); } }
  }
  // The transaction: a throwing step writes nothing. Unchanged state is not rewritten.
  function transaction(work) {
    if (closed) throw new GatewayError('companion_store_closed', 503);
    const state = read(), before = JSON.stringify(state);
    const result = work(state);
    if (JSON.stringify(state) !== before) write(state);
    return result;
  }
  function prune(state) {
    state.profiles = state.profiles.filter(row => row.touched >= now() - COMPANION_RETENTION_DAYS * DAY);
    state.requests = state.requests.filter(row => row.started >= now() - DAY);
    state.searches = state.searches.filter(at => at > now() - 3600000);
  }
  function ensureProfile(state, identity) {
    prune(state);
    let row = state.profiles.find(item => item.id === identity);
    if (!row) state.profiles.push(row = { id: identity, name: null, history: [], revision: randomUUID(), touched: now() });
    return row;
  }
  // Every transaction parses a fresh copy, so returned values never alias stored state.
  const view = row => ({ name: row.name, history: row.history, revision: row.revision });
  const profile = identity => transaction(state => view(ensureProfile(state, identity)));
  const request = (state, identity, id) => state.requests.find(row => row.identity === identity && row.id === id);
  return {
    profile,
    rename(identity, name) {
      return transaction(state => view(Object.assign(ensureProfile(state, identity), { name, revision: randomUUID(), touched: now() })));
    },
    forget(identity) {
      // Changing the revision invalidates in-flight replies, so they cannot
      // resurrect forgotten history. Cached replies are removed as well.
      transaction(state => {
        state.profiles = state.profiles.filter(row => row.id !== identity);
        state.requests = state.requests.filter(row => row.identity !== identity);
      });
      return profile(identity);
    },
    reserve(identity, id, fingerprint) {
      return transaction(state => {
        prune(state);
        const old = request(state, identity, id);
        if (old) {
          if (old.fingerprint !== fingerprint) throw new GatewayError('companion_request_conflict', 409);
          if (old.result) return old.result;
          throw new GatewayError('companion_request_pending_or_interrupted', 409);
        }
        const open = state.requests.filter(row => row.result === null && row.started > now() - 120000);
        if (open.some(row => row.identity === identity)) throw new GatewayError('companion_busy', 409);
        if (open.length >= 2) throw new GatewayError('companion_busy', 429);
        if (state.requests.filter(row => row.identity === identity && row.started > now() - 60000).length >= 10) throw new GatewayError('companion_rate_limit', 429);
        state.requests.push({ identity, id, fingerprint, result: null, started: now() });
        return null;
      });
    },
    finish(identity, id, revision, history, result) {
      transaction(state => {
        const row = state.profiles.find(item => item.id === identity && item.revision === revision);
        if (!row) throw new GatewayError('companion_profile_changed', 409);
        Object.assign(row, { history, touched: now() });
        const saved = request(state, identity, id);
        if (saved) saved.result = result;
      });
    },
    fail(identity, id, code) {
      transaction(state => { const saved = request(state, identity, id); if (saved) saved.result = { error: code }; });
    },
    reserveSearch() {
      return transaction(state => {
        prune(state);
        if (state.searches.length >= 20) return false;
        // Reserve BEFORE network I/O; failures count and restarts do not reset.
        state.searches.push(now());
        return true;
      });
    },
    close() { closed = true; },
  };
}
