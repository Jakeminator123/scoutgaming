import { createSharedRoomAccess } from './shared-room-access.mjs';
import { createSharedRoomChannel } from './shared-room-channel.mjs';
import { createSharedRoomUpgrade } from './shared-room-upgrade.mjs';
import { createPostgresTableRuntime } from './games/blackjack/table/postgres-runtime.mjs';
import { createPostgresPresentationReceiver } from './games/blackjack/presentation/postgres-receiver.mjs';

const unavailable = () => Object.assign(new Error('shared_room_service_unavailable'), { statusCode: 503 });
const stopped = () => new DOMException('Shared room service stopped', 'AbortError');
const timestamp = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

/** Application-owned, single-use composition. It installs no HTTP listener and
 * never creates/closes a pool. Await start before readiness, and close BEFORE
 * closing the application's pool. A stopped/failed instance cannot be restarted.
 * K04's receiver converts the frozen outbox row and commits its version before
 * the channel receives an invalidation hint. Only the coordinator acknowledges
 * outbox rows. No commands, publication writer or material fallback live here.
 */
export function createSharedRoomService({
  pool, walletMode, origin, engineOrigin, scope, auth, repository,
  clock = { now: Date.now }, random, intervalMs, onError,
  lockTimeoutMs, statementTimeoutMs, readTimeoutMs, WebSocketServer,
} = {}, {
  createAccess = createSharedRoomAccess, createChannel = createSharedRoomChannel,
  createUpgrade = createSharedRoomUpgrade, createRuntime = createPostgresTableRuntime,
  createReceiver = createPostgresPresentationReceiver,
} = {}) {
  if (walletMode !== 'demo' || typeof pool?.connect !== 'function' || typeof pool?.query !== 'function'
    || typeof clock?.now !== 'function') throw unavailable();
  const access = createAccess({ auth, repository, scope, now: () => clock.now() });
  const receiver = createReceiver({ pool, lockTimeoutMs, statementTimeoutMs });
  const lifetime = new AbortController(), reads = new Set();
  let state = 'idle', failed = false, starting, closing, cleanup, channel;
  const runtime = createRuntime({ pool, walletMode, clock, random, intervalMs, onError,
    lockTimeoutMs, statementTimeoutMs, sink: async row => {
      // receiver.sink owns presentationForRow + the atomic receiver transaction.
      // Replayed 'applied' is only a reread hint, never a second application.
      const result = await receiver.sink(row);
      if (result !== 'applied' && result !== 'stale') throw new TypeError('Invalid presentation receiver result');
      if (result === 'applied' && state === 'running') channel.emitCommitted(row.roomId);
      return result;
    } });
  function health() {
    let current;
    try { current = runtime.health(); } catch { current = { failed: true }; }
    return Object.freeze({ state, ready: state === 'running' && current?.running === true && current.failed === false,
      failed: failed || current?.failed !== false, inFlight: reads.size > 0 || current?.inFlight === true,
      lastSuccessAt: timestamp(current?.lastSuccessAt), lastErrorAt: timestamp(current?.lastErrorAt) });
  }
  function requireReady() { if (!health().ready) throw unavailable(); }
  function read(work, signal) {
    const combined = signal ? AbortSignal.any([lifetime.signal, signal]) : lifetime.signal;
    // Track the actual port operation, not the channel's timeout race. Closing
    // aborts admission immediately and drains these bounded SQL/auth operations.
    const operation = Promise.resolve().then(() => {
      requireReady(); combined.throwIfAborted(); return work(combined);
    }).then(value => { combined.throwIfAborted(); requireReady(); return value; })
      .finally(() => { reads.delete(operation); });
    reads.add(operation); return operation;
  }
  channel = createChannel({ origin, now: () => clock.now(), readTimeoutMs,
    authorize: (request, { roomId, signal }) => read(active => access.authorize(request, { roomId, signal: active }), signal),
    revalidate: (binding, { signal }) => read(active => access.revalidate(binding, { signal: active }), signal),
    readSnapshot: (roomId, actorId, { signal }) => read(() => runtime.coordinator.snapshot(roomId, actorId), signal),
    readPresentation: (roomId, { signal }) => read(() => receiver.current(roomId), signal),
  });
  const upgrade = createUpgrade({ origin, engineOrigin, WebSocketServer, channel: {
    async prepare(request) {
      requireReady();
      const admission = await channel.prepare(request);
      requireReady(); return admission;
    },
    close: () => channel.close(),
  } });
  function release() {
    if (cleanup) return cleanup;
    lifetime.abort(stopped());
    const outcomes = [];
    // Invoke immediately, not in later microtasks: no late admission after stop.
    for (const close of [() => channel.close(), () => upgrade.close(), () => runtime.stop()]) {
      try { outcomes.push(Promise.resolve(close())); } catch (error) { outcomes.push(Promise.reject(error)); }
    }
    cleanup = Promise.allSettled(outcomes).then(async results => {
      // No new work can pass requireReady after close/failure. Port rejections
      // belong to their callers and do not turn successful cleanup into failure.
      while (reads.size) await Promise.allSettled([...reads]);
      const errors = results.filter(item => item.status === 'rejected').map(item => item.reason);
      if (errors.length) throw new AggregateError(errors, 'Shared room service cleanup failed');
    });
    return cleanup;
  }
  function start() {
    if (state === 'running') return Promise.resolve();
    if (state === 'starting') return starting;
    if (state !== 'idle') return Promise.reject(unavailable());
    state = 'starting';
    starting = Promise.resolve().then(async () => {
      if (state !== 'starting') throw stopped();
      await receiver.assertInstalled();
      if (state !== 'starting') throw stopped();
      await runtime.start();
      if (state !== 'starting') throw stopped();
      state = 'running';
    }).catch(async error => {
      if (state !== 'stopping') { failed = true; state = 'failed'; }
      try { await release(); } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'Shared room service startup failed');
      }
      throw error;
    });
    return starting;
  }
  function close() {
    if (closing) return closing;
    state = 'stopping';
    const drain = release();
    closing = Promise.allSettled([starting, drain]).then(results => {
      state = 'stopped';
      // A startup failure remains observable on start() and health(). A cleanup
      // failure must also reach the application's shutdown owner.
      if (results[1].status === 'rejected') { failed = true; throw results[1].reason; }
    });
    return closing;
  }
  return Object.freeze({ start, close, stop: close, health,
    handleUpgrade: (request, socket, head) => upgrade.handleUpgrade(request, socket, head) });
}
