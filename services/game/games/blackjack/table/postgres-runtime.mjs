import { secureRandom } from '../secure-random.mjs';
import { createTableCoordinator } from './coordinator.mjs';
import { createPostgresTableStore } from './postgres-store.mjs';
import { assertSharedPostgresOwner } from '../../../../../packages/storage/server/postgres-transaction-context.mjs';

// Owns scheduling only, never the supplied pool or authentication. The application
// awaits start() before accepting commands through coordinator; start checks the
// installed schema and schedules the first pass. pump() explicitly runs one pass.
// stop() cancels the timer and drains the current pass (including error reporting);
// the application can then close its pool. Await stop() before restarting.
// No sink means no outbox acknowledgement. K04 supplies the version-aware sink
// described in ports.mjs; snapshots/polls never drive ticks or delivery here.
//
// Fault isolation (B3): a system fault (database unreachable, missing schema,
// invalid clock, or anything that cannot be attributed to one room) fails the
// pass and health.failed until a later pass succeeds. A fault in one room's tick,
// due-check or outbox row only marks that room: it is reported to onError with
// code shared_table_room_failed, retried after a bounded backoff, and blocked for
// commands after roomBlockAfter consecutive failures. Other rooms keep running
// and readiness stays open. A room recovers when a pass no longer fails for it.
const SYSTEM_SQLSTATE = /^(08|28|3D|3F|42|53|57P|58|XX)/;
const SYSTEM_NODE_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'EHOSTUNREACH', 'ENETUNREACH']);
const SYSTEM_MESSAGE = /connection terminated|connection (?:is )?closed|client has encountered a connection error|timeout exceeded when trying to connect|schema is not installed|cannot use a pool after calling end/i;
export function isSharedTableSystemFault(error, seen = new Set()) {
  if (!error || typeof error !== 'object' || seen.has(error)) return false;
  seen.add(error);
  const code = typeof error.code === 'string' ? error.code : '';
  if (SYSTEM_NODE_CODES.has(code) || /^[0-9A-Z]{5}$/.test(code) && SYSTEM_SQLSTATE.test(code)) return true;
  if (typeof error.message === 'string' && SYSTEM_MESSAGE.test(error.message)) return true;
  if (Array.isArray(error.errors) && error.errors.some(item => isSharedTableSystemFault(item, seen))) return true;
  return isSharedTableSystemFault(error.cause, seen);
}
const roomIdOf = value => typeof value === 'string' && value.length > 0 && value.length <= 128 ? value : null;

export function createPostgresTableRuntime({
  pool, walletMode, clock = { now: Date.now }, random = secureRandom(), sink,
  intervalMs = 250, onError = error => process.emitWarning(error),
  lockTimeoutMs, statementTimeoutMs, authorizeCommand, onTickCommitted,
  roomBackoffMaxMs = 30000, roomBlockAfter = 3,
} = {}, {
  createStore = createPostgresTableStore, createCoordinator = createTableCoordinator,
  setTimer = setTimeout, clearTimer = clearTimeout,
} = {}) {
  if (!Number.isInteger(intervalMs) || intervalMs < 1 || intervalMs > 2147483647)
    throw new TypeError('intervalMs must be a positive timer interval');
  if (!Number.isSafeInteger(roomBackoffMaxMs) || roomBackoffMaxMs < 1 || !Number.isSafeInteger(roomBlockAfter) || roomBlockAfter < 1)
    throw new TypeError('Invalid room fault policy');
  if (typeof clock?.now !== 'function' || typeof onError !== 'function'
    || (sink !== undefined && typeof sink !== 'function')
    || (onTickCommitted !== undefined && typeof onTickCommitted !== 'function')) throw new TypeError('Invalid runtime ports');
  const checkedClock = { now() {
    const at = clock.now();
    if (!Number.isSafeInteger(at) || at < 0) throw new TypeError('Invalid shared table clock');
    return at;
  } };
  const store = createStore({ pool, walletMode, lockTimeoutMs, statementTimeoutMs });
  const coordinator = createCoordinator({ store, clock: checkedClock, random, authorizeCommand });
  let state = 'stopped', timer = null, starting = null, stopping = null, inFlight = null, background = null;
  let lastSuccessAt = null, lastErrorAt = null, failed = false;
  // roomId -> { failures, since, lastErrorAt, retryAt }; no error details are kept.
  const roomFaults = new Map();
  const roomView = (roomId, fault) => Object.freeze({ roomId, failures: fault.failures,
    blocked: fault.failures >= roomBlockAfter, since: fault.since, lastErrorAt: fault.lastErrorAt, retryAt: fault.retryAt });

  // A fresh snapshot only: no SQL, clock reads, timers or raw error details.
  // inFlight describes the pump; state also covers startup and reporting drain.
  // A pass without a system fault clears failed; historical timestamps survive
  // stop/start. rooms lists the isolated room faults, sorted and sanitized.
  function health() {
    return Object.freeze({ state, running: state === 'running', inFlight: inFlight !== null,
      lastSuccessAt, failed, lastErrorAt,
      rooms: Object.freeze([...roomFaults].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([id, fault]) => roomView(id, fault))) });
  }
  // Commands for a room that keeps failing are refused until a pass recovers it.
  function roomHealth(roomId) {
    const fault = roomFaults.get(roomId);
    return fault ? roomView(roomId, fault) : null;
  }
  function healthTime() {
    try { return checkedClock.now(); }
    catch { return null; } // Diagnostics must never replace the original outcome.
  }
  function recordFailure() { failed = true; lastErrorAt = healthTime(); }

  async function runPass() {
    const at = checkedClock.now(), ticks = [], errors = [], failedRooms = new Map(), systemRooms = new Set();
    const resting = roomId => (roomFaults.get(roomId)?.retryAt ?? -Infinity) > at;
    // True when the failure is isolated to its room; otherwise it is a system
    // fault of the whole pass (no room identity, or a database/schema fault).
    const isolate = (roomId, error) => {
      const id = roomIdOf(roomId);
      if (!id || isSharedTableSystemFault(error)) { if (id) systemRooms.add(id); return false; }
      // A resting room is already marked; its due-check repeats the known fault.
      if (!resting(id) && !failedRooms.has(id)) failedRooms.set(id, error);
      return true;
    };
    const due = await coordinator.dueTicks(at, { onRoomError(roomId, error) { if (!isolate(roomId, error)) throw error; } });
    // One snapshot, one attempt per descriptor. A failed transaction remains due;
    // only the coordinator can record a domain-level blocked receipt. A resting
    // room, or one that already failed in this pass, is skipped until later.
    for (const descriptor of due) {
      const roomId = roomIdOf(descriptor?.roomId);
      if (roomId && (resting(roomId) || failedRooms.has(roomId))) continue;
      let actors, result;
      try {
        result = await coordinator.tick(descriptor, { captureActors: value => { actors = value; } });
        ticks.push(result);
      } catch (error) { if (!isolate(roomId, error)) errors.push(error); continue; }
      if (onTickCommitted && result.outcome === 'applied' && !result.replay) {
        try {
          if (!Array.isArray(actors)) throw new Error('Committed tick actors missing');
          await onTickCommitted(Object.freeze({ roomId: descriptor.roomId, actors }));
        } catch (error) {
          // An invalidation is an observer of a committed effect. Report it
          // separately; even a broken reporter cannot mark that SQL unit failed.
          const failure = Object.assign(new Error('Shared table commit observer failed', { cause: error }),
            { code: 'shared_table_commit_observer_failed' });
          try { await onError(failure); } catch { /* Reporting never retries a committed tick. */ }
        }
      }
    }
    let outbox = null;
    if (sink) {
      try {
        outbox = await coordinator.deliverOutbox(sink, { skipRoom: roomId => resting(roomId) || failedRooms.has(roomId) });
        for (const item of outbox.failed) if (!isolate(item.row?.roomId, item.error)) errors.push(item.error);
      } catch (error) { errors.push(error); }
    }
    // Room bookkeeping also runs when the same pass has a system fault.
    for (const [roomId, error] of failedRooms) {
      const before = roomFaults.get(roomId), failures = (before?.failures ?? 0) + 1;
      const retryAt = at + Math.min(roomBackoffMaxMs, intervalMs * 2 ** Math.min(failures - 1, 30));
      roomFaults.set(roomId, { failures, since: before?.since ?? at, lastErrorAt: at, retryAt });
      const alarm = Object.assign(new Error('Shared table room failed', { cause: error }),
        { code: 'shared_table_room_failed', roomId, failures, blocked: failures >= roomBlockAfter, retryAt });
      try { await onError(alarm); } catch { /* A broken reporter cannot change the room outcome. */ }
    }
    // A room that was eligible in this pass and did not fail has recovered.
    for (const [roomId, fault] of [...roomFaults])
      if (!failedRooms.has(roomId) && !systemRooms.has(roomId) && fault.retryAt <= at) roomFaults.delete(roomId);
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Shared table pump failed');
    return { ticks, outbox, rooms: [...failedRooms.keys()] };
  }

  function pump() {
    // A tick return is an outer COMMIT only when this pump owns its transaction.
    if (onTickCommitted) assertSharedPostgresOwner();
    if (state !== 'running') return Promise.reject(new Error('Shared table runtime is not running'));
    if (!inFlight) inFlight = Promise.resolve().then(runPass).then(result => {
      lastSuccessAt = healthTime(); failed = false; return result;
    }, error => {
      recordFailure(); throw error;
    }).finally(() => { inFlight = null; });
    return inFlight;
  }

  function schedule(delay = intervalMs) {
    if (state !== 'running') return;
    timer = setTimer(() => {
      timer = null;
      background = (async () => {
        try { await pump(); }
        catch (error) { await onError(error); }
      })().finally(() => { background = null; schedule(); });
      // A broken observer must not create an unhandled rejection in a timer.
      background.catch(error => process.emitWarning(error));
    }, delay);
    timer?.unref?.();
  }

  function start() {
    if (state === 'running') return Promise.resolve();
    if (state === 'starting') return starting;
    if (state === 'stopping') return Promise.reject(new Error('Await stop before restarting the shared table runtime'));
    state = 'starting';
    starting = (async () => {
      try {
        await store.assertInstalled();
        if (state !== 'starting') return; // stop during readiness must not arm a timer.
        state = 'running'; schedule(0);
      } catch (error) {
        recordFailure();
        if (state !== 'stopping') state = 'stopped';
        throw error;
      }
    })().finally(() => { starting = null; });
    return starting;
  }

  function stop() {
    if (stopping) return stopping;
    if (state === 'stopped') return Promise.resolve();
    state = 'stopping';
    if (timer !== null) { clearTimer(timer); timer = null; }
    stopping = Promise.allSettled([starting, inFlight, background]).then(() => { state = 'stopped'; })
      .finally(() => { stopping = null; });
    return stopping;
  }

  async function withLockedRead({ rooms, players }, work) {
    if (typeof work !== 'function') throw new TypeError('Locked reader callback required');
    return store.runLocked({ rooms, players }, async tx => {
      let open = true;
      const check = () => { if (!open) throw new Error('Shared table read is closed'); };
      const reader = Object.freeze({
        room(id) { check(); return tx.rooms.read(id); },
        config(roomId, version) { check(); return tx.config.frozen(roomId, version); },
      });
      try { return await work(reader); } finally { open = false; }
    });
  }
  return { start, stop, pump, health, roomHealth, coordinator, store, withLockedRead };
}
