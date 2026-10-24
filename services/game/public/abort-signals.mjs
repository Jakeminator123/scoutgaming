// AbortSignal.any is not available in older Safari. Keep the first reason and
// release every source listener when either the owner or its timeout aborts.
export function combineAbortSignals(signals) {
  const controller = new AbortController(), listeners = new Map();
  const abort = source => {
    for (const [signal, listener] of listeners) signal.removeEventListener('abort', listener);
    listeners.clear();
    if (!controller.signal.aborted) controller.abort(source.reason);
  };
  for (const signal of new Set(signals.filter(Boolean))) {
    if (signal.aborted) { abort(signal); break; }
    const listener = () => abort(signal);
    listeners.set(signal, listener);
    signal.addEventListener('abort', listener, {once:true});
  }
  return controller.signal;
}
