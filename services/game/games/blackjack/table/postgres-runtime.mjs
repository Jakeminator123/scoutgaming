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
// Fault isolation (B3). Four classes, none of them carries error details into health:
// - system (database unreachable, missing schema, invalid clock, or anything without a
//   room identity) fails the pass and health.failed until a later pass succeeds;
// - contention (lock/statement timeout, serialization failure, deadlock) is neutral:
//   the global A lock makes it say nothing about the room. The room is skipped for the
//   rest of that pass, nothing is counted against it, no backoff grows; a separate
//   counter and a shared_table_room_contention report record it;
// - a room fault in a tick or due-check marks only that room: reported with code
//   shared_table_room_failed, retried after a bounded backoff, blocked for commands
//   after roomBlockAfter consecutive failures. It recovers when a pass no longer fails;
// - an outbox (presentation) fault only defers that room's delivery with its own
//   backoff (shared_table_outbox_failed). It never pauses ticks or blocks commands (K04).
// Other rooms keep running and readiness stays open for every class but system.
const SYSTEM_SQLSTATE = /^(08|28|3D|3F|42|53|57P|58|XX)/;
const CONTENTION_SQLSTATE = new Set(['55P03', '57014', '40001', '40P01']);
const SYSTEM_NODE_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'EHOSTUNREACH', 'ENETUNREACH']);
const SYSTEM_MESSAGE = /connection terminated|connection (?:is )?closed|client has encountered a connection error|timeout exceeded when trying to connect|schema is not installed|cannot use a pool after calling end/i;
function someError(error, test, seen = new Set()) {
  if (!error || typeof error !== 'object' || seen.has(error)) return false;
  seen.add(error);
  if (test(error)) return true;
  if (Array.isArray(error.errors) && error.errors.some(item => someError(item, test, seen))) return true;
  return someError(error.cause, test, seen);
}
const codeOf = error => typeof error.code === 'string' ? error.code : '';
export function isSharedTableSystemFault(error) {
  return someError(error, item => SYSTEM_NODE_CODES.has(codeOf(item))
    || /^[0-9A-Z]{5}$/.test(codeOf(item)) && SYSTEM_SQLSTATE.test(codeOf(item))
    || typeof item.message === 'string' && SYSTEM_MESSAGE.test(item.message));
}
export function isSharedTableContention(error) {
  return !isSharedTableSystemFault(error) && someError(error, item => CONTENTION_SQLSTATE.has(codeOf(item)));
}
const roomIdOf = value => typeof value === 'string' && value.length > 0 && value.length <= 128 ? value : null;
const byRoom = ([a], [b]) => a < b ? -1 : a > b ? 1 : 0;

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
  const roomFaults = new Map(), outboxFaults = new Map();
  const contention = { count: 0, lastAt: null };
  const faultView = (roomId, fault) => ({ roomId, failures: fault.failures, since: fault.since, lastErrorAt: fault.lastErrorAt, retryAt: fault.retryAt });
  const roomView = (roomId, fault) => Object.freeze({ ...faultView(roomId, fault), blocked: fault.failures >= roomBlockAfter });
  const backoff = failures => Math.min(roomBackoffMaxMs, intervalMs * 2 ** Math.min(failures - 1, 30));

  // A fresh snapshot only: no SQL, clock reads, timers or raw error details.
  // inFlight describes the pump; state also covers startup and reporting drain.
  // A pass without a system fault clears failed; historical timestamps survive
  // stop/start. rooms/outbox list isolated faults, sorted and sanitized.
  function health() {
    return Object.freeze({ state, running: state === 'running', inFlight: inFlight !== null,
      lastSuccessAt, failed, lastErrorAt,
      rooms: Object.freeze([...roomFaults].sort(byRoom).map(([id, fault]) => roomView(id, fault))),
      outbox: Object.freeze([...outboxFaults].sort(byRoom).map(([id, fault]) => Object.freeze(faultView(id, fault)))),
      contention: Object.freeze({ ...contention }) });
  }
  // Commands for a room whose ticks keep failing are refused until a pass recovers it.
  function roomHealth(roomId) {
    const fault = roomFaults.get(roomId);
    return fault ? roomView(roomId, fault) : null;
  }
  function healthTime() {
    try { return checkedClock.now(); }
    catch { return null; } // Diagnostics must never replace the original outcome.
  }
  function recordFailure() { failed = true; lastErrorAt = healthTime(); }
  async function report(message, cause, fields) {
    const alarm = Object.assign(new Error(message, { cause }), fields);
    try { await onError(alarm); } catch { /* A broken reporter cannot change a room outcome. */ }
  }
  function mark(faults, roomId, at) {
    const before = faults.get(roomId), failures = (before?.failures ?? 0) + 1, retryAt = at + backoff(failures);
    faults.set(roomId, { failures, since: before?.since ?? at, lastErrorAt: at, retryAt });
    return { failures, retryAt };
  }

  async function runPass() {
    const at = checkedClock.now(), ticks = [], errors = [];
    const failedRooms = new Map(), failedDelivery = new Map(), contended = new Map(), systemRooms = new Set();
    const resting = (faults, roomId) => (faults.get(roomId)?.retryAt ?? -Infinity) > at;
    // Returns false for a system fault (the caller fails the pass); otherwise the
    // failure is contention (neutral) or recorded against its room or delivery.
    const isolate = (roomId, error, faults, failures) => {
      const id = roomIdOf(roomId);
      if (!id || isSharedTableSystemFault(error)) { if (id) systemRooms.add(id); return false; }
      if (isSharedTableContention(error)) { if (!contended.has(id)) contended.set(id, error); return true; }
      // A resting room is already marked; its due-check repeats the known fault.
      if (!resting(faults, id) && !failures.has(id)) failures.set(id, error);
      return true;
    };
    const tickFault = (roomId, error) => isolate(roomId, error, roomFaults, failedRooms);
    const due = await coordinator.dueTicks(at, { onRoomError(roomId, error) { if (!tickFault(roomId, error)) throw error; } });
    // One snapshot, one attempt per descriptor. A failed transaction remains due;
    // only the coordinator can record a domain-level blocked receipt. A resting
    // room, or one that failed or met contention in this pass, waits until later.
    for (const descriptor of due) {
      const roomId = roomIdOf(descriptor?.roomId);
      if (roomId && (resting(roomFaults, roomId) || failedRooms.has(roomId) || contended.has(roomId))) continue;
      let actors, result;
      try {
        result = await coordinator.tick(descriptor, { captureActors: value => { actors = value; } });
        ticks.push(result);
      } catch (error) { if (!tickFault(roomId, error)) errors.push(error); continue; }
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
    let outbox = null, delivered = false;
    if (sink) {
      try {
        // Presentation delivery is independent of the game: only its own backoff defers it.
        outbox = await coordinator.deliverOutbox(sink, { skipRoom: roomId => resting(outboxFaults, roomId) || failedDelivery.has(roomId) });
        for (const item of outbox.failed) if (!isolate(item.row?.roomId, item.error, outboxFaults, failedDelivery)) errors.push(item.error);
        delivered = true;
      } catch (error) { errors.push(error); }
    }
    // Bookkeeping also runs when the same pass has a system fault.
    for (const [roomId, error] of failedRooms) {
      const { failures, retryAt } = mark(roomFaults, roomId, at);
      await report('Shared table room failed', error,
        { code: 'shared_table_room_failed', roomId, failures, blocked: failures >= roomBlockAfter, retryAt });
    }
    for (const [roomId, error] of failedDelivery) {
      const { failures, retryAt } = mark(outboxFaults, roomId, at);
      await report('Shared table presentation delivery failed', error, { code: 'shared_table_outbox_failed', roomId, failures, retryAt });
    }
    for (const [roomId, error] of contended) {
      contention.count++; contention.lastAt = at;
      await report('Shared table room met lock contention', error, { code: 'shared_table_room_contention', roomId });
    }
    // A room that was eligible in this pass and did not fail has recovered; contention
    // and system faults prove nothing either way.
    for (const [roomId, fault] of [...roomFaults])
      if (!failedRooms.has(roomId) && !systemRooms.has(roomId) && !contended.has(roomId) && fault.retryAt <= at) roomFaults.delete(roomId);
    if (delivered) for (const [roomId, fault] of [...outboxFaults])
      if (!failedDelivery.has(roomId) && !systemRooms.has(roomId) && !contended.has(roomId) && fault.retryAt <= at) outboxFaults.delete(roomId);
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Shared table pump failed');
    return { ticks, outbox, rooms: [...failedRooms.keys()], outboxRooms: [...failedDelivery.keys()], contended: [...contended.keys()] };
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
