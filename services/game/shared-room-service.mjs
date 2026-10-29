import { createSharedRoomAccess } from './shared-room-access.mjs';
import { createSharedRoomPresentationAccess } from './shared-room-presentation-access.mjs';
import { createSharedRoomChannel, projectSharedRoomSnapshot } from './shared-room-channel.mjs';
import { parseSharedRoomCommand, projectSharedRoomCommandResult } from './shared-room-command-contract.mjs';
import { createSharedRoomUpgrade } from './shared-room-upgrade.mjs';
import { createPostgresTableRuntime } from './games/blackjack/table/postgres-runtime.mjs';
import { createPostgresPresentationReceiver } from './games/blackjack/presentation/postgres-receiver.mjs';
import { assertSharedPostgresOwner } from '../../packages/storage/server/postgres-transaction-context.mjs';
import { createFilmedStepReader } from './shared-room-filmed-steps.mjs';

const unavailable = () => Object.assign(new Error('shared_room_service_unavailable'), { statusCode: 503 });
const stopped = () => new DOMException('Shared room service stopped', 'AbortError');
const timestamp = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const roomUnavailable = () => Object.assign(new Error('shared_room_unavailable'), { statusCode: 503, code: 'shared_room_unavailable' });
// Isolated room and delivery faults (B3): identity, counts and times only, never error details.
const projectFaults = (rooms, blocked) => Object.freeze((Array.isArray(rooms) ? rooms : [])
  .filter(room => typeof room?.roomId === 'string' && /^[a-z0-9_-]{1,128}$/.test(room.roomId))
  .map(room => Object.freeze({ roomId: room.roomId, failures: Number.isSafeInteger(room.failures) ? room.failures : 0,
    ...(blocked ? { blocked: room.blocked === true } : {}),
    since: timestamp(room.since), lastErrorAt: timestamp(room.lastErrorAt), retryAt: timestamp(room.retryAt) })));
const projectContention = value => Object.freeze({ count: Number.isSafeInteger(value?.count) && value.count >= 0 ? value.count : 0,
  lastAt: timestamp(value?.lastAt) });

/** Application-owned, single-use composition. It installs no HTTP listener and
 * never creates/closes a pool. Await start before readiness, and close BEFORE
 * closing the application's pool. A stopped/failed instance cannot be restarted.
 * K04's receiver converts the frozen outbox row and commits its version before
 * the channel receives an invalidation hint. Commits by another engine instance
 * reach the channel through the runtime pass's room versions (observeRoom, F11);
 * close() (SIGTERM) ends every socket with 1012 at once. Only the coordinator acknowledges
 * outbox rows. Commands share the scoped database transaction; no publication
 * writer or material fallback lives here.
 */
export function createSharedRoomService({
  pool, walletMode, origin, engineOrigin, scope, auth, commandAuth, repository, privateMedia,
  clock = { now: Date.now }, random, intervalMs, onError,
  lockTimeoutMs, statementTimeoutMs, readTimeoutMs, WebSocketServer,
} = {}, {
  createAccess = createSharedRoomAccess, createChannel = createSharedRoomChannel,
  createUpgrade = createSharedRoomUpgrade, createRuntime = createPostgresTableRuntime,
  createReceiver = createPostgresPresentationReceiver, createPresentationAccess = createSharedRoomPresentationAccess,
} = {}) {
  if (walletMode !== 'demo' || typeof pool?.connect !== 'function' || typeof pool?.query !== 'function'
    || typeof clock?.now !== 'function') throw unavailable();
  const access = createAccess({ auth, commandAuth, repository, scope, now: () => clock.now() });
  const receiver = createReceiver({ pool, lockTimeoutMs, statementTimeoutMs });
  const lifetime = new AbortController(), reads = new Set(), admissions = new WeakMap();
  let state = 'idle', failed = false, starting, closing, cleanup, channel;
  const runtime = createRuntime({ pool, walletMode, clock, random, intervalMs, onError,
    lockTimeoutMs, statementTimeoutMs, authorizeCommand: async (tx, context) => {
      const admission = context.authority && admissions.get(context.authority);
      if (!admission
        || context.actorId !== admission.binding.actorId || context.roomId !== admission.binding.roomId
        || typeof access.revalidateLocked !== 'function') throw unavailable();
      admission.signal.throwIfAborted(); requireReady();
      await access.revalidateLocked(admission.binding, { signal: admission.signal });
      const before = await tx.rooms.read(context.roomId);
      admission.presentationVer = before?.presentationVer ?? 0;
      if (!Array.isArray(context.lockedPlayers) || !context.lockedPlayers.includes(context.actorId)
        || context.lockedPlayers.some(actor => typeof actor !== 'string' || !actor)) throw unavailable();
      admission.actors = context.lockedPlayers;
      admission.signal.throwIfAborted(); requireReady();
      return true;
    }, onTickCommitted: ({ roomId, actors }) => {
      if (state !== 'running') return;
      channel.emitCommitted(roomId);
      channel.emitActorsCommitted(actors, { exceptRoom: roomId });
    }, onRoomObserved: ({ roomId, version, presentationVer }) => {
      // F11: the runtime pass's own room read. Covers commits by another engine instance,
      // whose hints never reach this channel (Render overlap during deploy/restart).
      if (state === 'running') channel.observeRoom(roomId, { version, presentationVer });
    }, sink: async row => {
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
      lastSuccessAt: timestamp(current?.lastSuccessAt), lastErrorAt: timestamp(current?.lastErrorAt),
      rooms: projectFaults(current?.rooms, true), outbox: projectFaults(current?.outbox, false), contention: projectContention(current?.contention) });
  }
  function requireReady() { if (!health().ready) throw unavailable(); }
  // A room fault never closes the service; only a room that keeps failing refuses commands.
  function requireRoomReady(roomId) {
    let fault = null;
    try { fault = typeof runtime.roomHealth === 'function' ? runtime.roomHealth(roomId) : null; } catch { throw unavailable(); }
    if (fault?.blocked === true) throw roomUnavailable();
  }
  function read(work, signal) {
    const combined = signal ? AbortSignal.any([lifetime.signal, signal]) : lifetime.signal;
    // Track the actual port operation, not the channel's timeout race. Closing
    // aborts admission immediately and drains these bounded SQL/auth operations.
    const operation = Promise.resolve().then(() => {
      requireReady(); combined.throwIfAborted(); return work(combined);
    }).then(async value => {
      try { combined.throwIfAborted(); requireReady(); return value; }
      catch(error) { if(value instanceof Response)try{await value.body?.cancel();}catch{}throw error; }
    })
      .finally(() => { reads.delete(operation); });
    reads.add(operation); return operation;
  }
  async function command(request, { roomId, input, signal } = {}) {
    if (typeof repository?.sharedTransaction !== 'function' || typeof runtime.coordinator.command !== 'function') throw unavailable();
    // Re-parse even for another internal caller; only the separately supplied
    // canonical room can be authoritative. The HTTP adapter already parses.
    if (!input || input.roomId !== roomId) throw Object.assign(new Error('shared_room_invalid_command'), { code: 'shared_room_invalid_command' });
    const { roomId: _room, ...body } = input;
    const parsed = parseSharedRoomCommand(roomId, body);
    const combined = request?.signal && signal ? AbortSignal.any([request.signal, signal]) : request?.signal ?? signal;
    return read(async active => {
      // This service owns the outer commit. A nested repository callback could
      // return before its caller commits, so it must never publish hints here.
      assertSharedPostgresOwner();
      const binding = await access.authorize(request, { roomId, signal: active });
      active.throwIfAborted(); requireReady(); requireRoomReady(roomId);
      const admission = { binding, signal: active, presentationVer: 0 }, token = Object.freeze({});
      admissions.set(token, admission);
      try {
        const notifyRooms = new Set();
        const response = await repository.sharedTransaction(async () => {
          active.throwIfAborted(); requireReady();
          const result = await runtime.coordinator.command({ actorId: binding.actorId, authority: token, clientSnapshot: true }, parsed);
          active.throwIfAborted(); requireReady();
          if (typeof result?.replay !== 'boolean') throw unavailable();
          // Both projections run before the outer COMMIT; projection failure
          // rolls back effects rather than returning private or malformed state.
          if (result.snapshot === null && parsed.op !== 'pause') throw unavailable();
          if (!result.replay && parsed.op === 'pause') {
            // This global operation may update other rooms without an outbox.
            // Keep its server-selected rooms private, but invalidate each one.
            const affected = result.result?.rooms;
            if (!Array.isArray(affected) || affected.some(room => typeof room !== 'string' || !/^[a-z0-9_-]{1,128}$/.test(room))) throw unavailable();
            for (const room of affected) notifyRooms.add(room);
          }
          return Object.freeze({ result: projectSharedRoomCommandResult(result.result),
            replay: result.replay, snapshot: result.snapshot === null ? null : projectSharedRoomSnapshot(result.snapshot, binding) });
        }, { serialize: true });
        // A new presentation is announced only by the receiver sink after its
        // durable version commits. Ordinary state-only changes can notify now.
        // K6: a waiting registration changes no snapshot, so no socket rereads for it.
        const seen = !response.replay && parsed.op !== 'wait';
        if (seen && response.snapshot && response.snapshot.presentationVer === admission.presentationVer) notifyRooms.add(roomId);
        for (const room of notifyRooms) channel.emitCommitted(room);
        if (seen) channel.emitActorsCommitted(admission.actors, { exceptRoom: roomId });
        return response;
      } finally { admissions.delete(token); }
    }, combined);
  }
  // Speech lag (28 Oct 2026): a spoken line also carries its room's standard clip, from the package its config is bound to.
  const filmedSteps = typeof runtime.store?.read?.config === 'function'
    ? createFilmedStepReader({ readConfig: (roomId, version) => runtime.store.read.config(roomId, version),
      ...(typeof access.readPackage === 'function' ? { readPackage: (operatorId, revision) => access.readPackage(operatorId, revision) } : {}) })
    : async (_roomId, presentation) => presentation;
  let presentationAccess;
  function presentationRead(method,args,selectFrozen) {
    if (typeof runtime.withLockedRead !== 'function' || typeof receiver.currentLocked !== 'function') throw unavailable();
    presentationAccess ??= createPresentationAccess({ access, repository,
      ...(privateMedia?{privateMedia}:{}),
      withLockedRead: (...values) => runtime.withLockedRead(...values),
      readPresentationLocked: (...values) => receiver.currentLocked(...values) });
    const signal = args.request?.signal && args.signal ? AbortSignal.any([args.request.signal,args.signal]) : args.request?.signal ?? args.signal;
    return read(active => presentationAccess[method]({...args,signal:active},selectFrozen),signal);
  }
  const withSharedCommittedReceipt=(args={},selectFrozen)=>presentationRead('withSharedCommittedReceipt',args,selectFrozen);
  const withActiveRoomPresentation=(args={},selectFrozen)=>presentationRead('withActiveRoomPresentation',args,selectFrozen);
  channel = createChannel({ origin, now: () => clock.now(), readTimeoutMs,
    authorize: (request, { roomId, signal }) => read(active => access.authorize(request, { roomId, signal: active }), signal),
    revalidate: (binding, { signal }) => read(active => access.revalidate(binding, { signal: active }), signal),
    readSnapshot: (roomId, actorId, { signal }) => read(() => runtime.coordinator.snapshot(roomId, actorId, {client:true}), signal),
    // K04 F5c: a native filmed plan carries its step choices (shared-room-filmed-steps.mjs).
    readPresentation: (roomId, { signal }) => read(async () => filmedSteps(roomId, await receiver.current(roomId)), signal),
    // Presence of an open, revalidated socket: the bound actor in the bound room only.
    touch: (binding, { signal }) => read(() => {
      if (typeof runtime.coordinator.seen !== 'function') throw unavailable();
      return runtime.coordinator.seen(binding.roomId, binding.actorId);
    }, signal),
  });
  const upgrade = createUpgrade({ origin, engineOrigin, WebSocketServer, channel: {
    async prepare(request) {
      requireReady();
      const admission = await channel.prepare(request);
      requireReady(); return admission;
    },
    close: () => channel.close(),
  } });
  // Chat (PR 1): the socket's authorization and client snapshot plus the room's published dealer,
  // read under the room lock like withActiveRoomPresentation. No command, wallet or outbox write.
  async function chatContext(request, { roomId, signal } = {}) {
    if (typeof repository?.sharedTransaction !== 'function' || typeof runtime.withLockedRead !== 'function'
      || typeof access.readPresentationContextLocked !== 'function') throw unavailable();
    const combined = request?.signal && signal ? AbortSignal.any([request.signal, signal]) : request?.signal ?? signal;
    return read(async active => {
      assertSharedPostgresOwner();
      const binding = await access.authorize(request, { roomId, signal: active });
      active.throwIfAborted(); requireRoomReady(roomId);
      const context = await repository.sharedTransaction(() => runtime.withLockedRead({ rooms: [roomId], players: [binding.actorId] }, async reader => {
        const room = await reader.room(roomId); active.throwIfAborted();
        return access.readPresentationContextLocked(binding, { configVersion: room?.configVersion ?? null, signal: active });
      }), { serialize: true });
      active.throwIfAborted();
      const snapshot = projectSharedRoomSnapshot(await runtime.coordinator.snapshot(roomId, binding.actorId, { client: true }), binding);
      // presentationContext {operatorSlug,roomId,packageRevision,dealerId} is the published room
      // context (PR 2: speech reads evidence with it); the binding itself carries none.
      const presentationContext = context?.context ? Object.freeze({ ...context.context }) : null;
      return Object.freeze({ binding, dealerId: presentationContext?.dealerId, presentationContext, snapshot });
    }, combined);
  }
  function emitChat(roomId, entry) { requireReady(); channel.emitChat(roomId, entry); }
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
  return Object.freeze({ start, close, stop: close, health, command, chatContext, emitChat, withSharedCommittedReceipt, withActiveRoomPresentation,
    handleUpgrade: (request, socket, head) => upgrade.handleUpgrade(request, socket, head) });
}

