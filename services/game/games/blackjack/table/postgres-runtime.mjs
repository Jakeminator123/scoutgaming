import { secureRandom } from '../secure-random.mjs';
import { createTableCoordinator } from './coordinator.mjs';
import { createPostgresTableStore } from './postgres-store.mjs';

// Owns scheduling only, never the supplied pool or authentication. The application
// awaits start() before accepting commands through coordinator; start checks the
// installed schema and schedules the first pass. pump() explicitly runs one pass.
// stop() cancels the timer and drains the current pass (including error reporting);
// the application can then close its pool. Await stop() before restarting.
// No sink means no outbox acknowledgement. K04 supplies the version-aware sink
// described in ports.mjs; snapshots/polls never drive ticks or delivery here.
export function createPostgresTableRuntime({
  pool, walletMode, clock = { now: Date.now }, random = secureRandom(), sink,
  intervalMs = 250, onError = error => process.emitWarning(error),
  lockTimeoutMs, statementTimeoutMs,
} = {}, {
  createStore = createPostgresTableStore, createCoordinator = createTableCoordinator,
  setTimer = setTimeout, clearTimer = clearTimeout,
} = {}) {
  if (!Number.isInteger(intervalMs) || intervalMs < 1 || intervalMs > 2147483647)
    throw new TypeError('intervalMs must be a positive timer interval');
  if (typeof clock?.now !== 'function' || typeof onError !== 'function'
    || (sink !== undefined && typeof sink !== 'function')) throw new TypeError('Invalid runtime ports');
  const checkedClock = { now() {
    const at = clock.now();
    if (!Number.isSafeInteger(at) || at < 0) throw new TypeError('Invalid shared table clock');
    return at;
  } };
  const store = createStore({ pool, walletMode, lockTimeoutMs, statementTimeoutMs });
  const coordinator = createCoordinator({ store, clock: checkedClock, random });
  let state = 'stopped', timer = null, starting = null, stopping = null, inFlight = null, background = null;

  async function runPass() {
    const due = await coordinator.dueTicks(checkedClock.now()), ticks = [], errors = [];
    // One snapshot, one attempt per descriptor. A failed transaction remains due;
    // only the coordinator can record a domain-level blocked receipt.
    for (const descriptor of due) {
      try { ticks.push(await coordinator.tick(descriptor)); }
      catch (error) { errors.push(error); }
    }
    let outbox = null;
    if (sink) {
      try {
        outbox = await coordinator.deliverOutbox(sink);
        errors.push(...outbox.failed.map(item => item.error));
      } catch (error) { errors.push(error); }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Shared table pump failed');
    return { ticks, outbox };
  }

  function pump() {
    if (state !== 'running') return Promise.reject(new Error('Shared table runtime is not running'));
    if (!inFlight) inFlight = Promise.resolve().then(runPass).finally(() => { inFlight = null; });
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

  return { start, stop, pump, coordinator, store };
}
