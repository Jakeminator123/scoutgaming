export function installGracefulShutdown({ server, closeRuntime, closeStorage = async () => {}, processTarget = process } = {}) {
  if (!server?.once || typeof server.close !== 'function' || typeof closeRuntime !== 'function'
    || typeof closeStorage !== 'function' || !processTarget?.once || typeof processTarget.off !== 'function') {
    throw new TypeError('Invalid graceful shutdown configuration.');
  }
  const failed = () => { processTarget.exitCode = 1; };
  let runtimeClosePromise;
  const closeRuntimeOnce = () => runtimeClosePromise ??= Promise.resolve().then(closeRuntime);
  let storageClosePromise;
  const closeStorageOnce = () => storageClosePromise ??= Promise.resolve().then(closeStorage);
  let httpClosePromise;
  const closeHttpOnce = () => httpClosePromise ??= new Promise(resolve => {
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
  let stopPromise;
  const stop = () => stopPromise ??= (async () => {
    // Stop accepting first, but cancel accepted work immediately. Waiting for
    // HTTP before cancellation can deadlock a response that ends on abort.
    const httpDrain = closeHttpOnce();
    await closeRuntimeOnce().catch(failed);
    const httpError = await httpDrain;
    if (httpError) failed();
    await closeStorageOnce().catch(failed);
  })();
  const onSignal = () => { void stop(); };
  const removeSignals = () => {
    processTarget.off('SIGINT', onSignal);
    processTarget.off('SIGTERM', onSignal);
  };
  processTarget.once('SIGINT', onSignal);
  processTarget.once('SIGTERM', onSignal);
  server.once('close', () => {
    removeSignals();
    void closeRuntimeOnce().catch(failed).then(() => closeStorageOnce().catch(failed));
  });
  return Object.freeze({ stop, closeRuntime: closeRuntimeOnce, closeStorage: closeStorageOnce });
}
