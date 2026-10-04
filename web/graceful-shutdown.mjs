// Runtime: 15s natural stop + 15s provider cancellation + 30s journal allowance.
// Then up to 5s HTTP drain and 10s storage. Child force at 80s leaves 5s
// local margin and 10s before Render's required 90s.
export const SHUTDOWN_BUDGET = Object.freeze({ naturalWorkerMs: 15000, providerRequestMs: 15000,
  journalFlushMs: 30000, runtimeMs: 60000, storageMs: 10000, httpMs: 5000, childMs: 80000, hostMs: 90000 });

const connections = new WeakMap();
export function trackServerConnections(server) {
  if (connections.has(server)) return connections.get(server);
  const sockets = new Set(), upgraded = new Set(), waiters = new Set();
  const track = socket => {
    if (sockets.has(socket)) return;
    sockets.add(socket);
    socket.once('close', () => {
      sockets.delete(socket); upgraded.delete(socket);
      if (!sockets.size) { for (const done of waiters) done(); waiters.clear(); }
    });
  };
  server.on('connection', track);
  server.on('upgrade', (_request, socket) => { track(socket); upgraded.add(socket); });
  const state = { sockets, upgraded,
    waitForEmpty: () => sockets.size ? new Promise(resolve => waiters.add(resolve)) : Promise.resolve(),
    destroy: ({ includeUpgraded = true, onlyUpgraded = false } = {}) => {
      for (const socket of sockets) if (onlyUpgraded ? upgraded.has(socket) : includeUpgraded || !upgraded.has(socket)) socket.destroy();
    } };
  connections.set(server, state); return state;
}

export function installGracefulShutdown({ server, closeRuntime, closeStorage = async () => {}, processTarget = process,
  runtimeTimeoutMs = SHUTDOWN_BUDGET.runtimeMs, storageTimeoutMs = SHUTDOWN_BUDGET.storageMs,
  httpTimeoutMs = SHUTDOWN_BUDGET.httpMs } = {}) {
  if (!server?.on || typeof server.close !== 'function' || typeof closeRuntime !== 'function'
    || typeof closeStorage !== 'function' || !processTarget?.on || typeof processTarget.off !== 'function'
    || [runtimeTimeoutMs, storageTimeoutMs, httpTimeoutMs].some(ms => !Number.isSafeInteger(ms) || ms < 1)) {
    throw new TypeError('Invalid graceful shutdown configuration.');
  }
  const sockets = trackServerConnections(server), runtimeAbort = new AbortController();
  const failed = () => { processTarget.exitCode = 1; };
  let runtimeClosePromise;
  const closeRuntimeOnce = () => runtimeClosePromise ??= Promise.resolve().then(() => closeRuntime({ signal: runtimeAbort.signal }));
  let storageClosePromise;
  const closeStorageOnce = () => storageClosePromise ??= Promise.resolve().then(closeStorage);
  let httpClosePromise;
  const closeHttpOnce = () => httpClosePromise ??= new Promise(resolve => {
    if (server.listening === false) { resolve(); return; }
    let completed = false;
    const finish = error => {
      if (completed) return;
      completed = true;
      resolve(error);
    };
    try {
      server.close(finish);
      server.closeIdleConnections?.();
    } catch (error) { finish(error); }
  });
  const bounded = async (promise, ms, onTimeout = () => {}) => {
    let timer;
    try {
      return await Promise.race([promise.then(() => true, () => { failed(); return true; }),
        new Promise(resolve => { timer = setTimeout(() => { failed(); onTimeout(); resolve(false); }, ms); })]);
    } finally { clearTimeout(timer); }
  };
  let stopPromise;
  const stop = () => stopPromise ??= (async () => {
    let completed = false;
    // Upgraded worker sockets stay available until runtime has finished.
    // Cancellation starts immediately, before waiting for HTTP or gateway WS.
    const httpDrain = closeHttpOnce();
    const ordinaryForce = setTimeout(() => {
      server.closeAllConnections?.(); sockets.destroy({ includeUpgraded: false });
    }, httpTimeoutMs);
    try {
      const settled = await bounded(closeRuntimeOnce(), runtimeTimeoutMs, () => runtimeAbort.abort());
      if (!settled) {
        sockets.destroy();
        // Timeout is not a terminal receipt. Do not close the journal pool
        // under unfinished writes; the parent owns the final force-stop.
        return { completed: false, timedOut: 'runtime' };
      }
      sockets.destroy({ onlyUpgraded: true });
      const httpCompleted = await bounded(httpDrain.then(error => { if (error) failed(); }), httpTimeoutMs);
      if (!httpCompleted) return { completed: false, timedOut: 'http' };
      const stored = await bounded(closeStorageOnce(), storageTimeoutMs);
      completed = stored;
      return { completed: stored, ...(stored ? {} : { timedOut: 'storage' }) };
    } finally {
      clearTimeout(ordinaryForce);
      if (completed) { processTarget.off('SIGINT', onSignal); processTarget.off('SIGTERM', onSignal); }
    }
  })();
  const onSignal = () => { void stop(); };
  // Repeated signals retain handlers while terminal journal work is pending.
  processTarget.on('SIGINT', onSignal); processTarget.on('SIGTERM', onSignal);
  server.once('close', () => { void stop(); });
  return Object.freeze({ stop, closeRuntime: closeRuntimeOnce, closeStorage: closeStorageOnce });
}
