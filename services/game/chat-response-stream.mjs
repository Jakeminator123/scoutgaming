// External proxies may close a silent response while a cold GPU is preparing.
// Repeat only the already-public stage; never publish text, media or authority.
export function createChatResponseStream(res, {
  signal, startedAt = performance.now(), now = () => performance.now(), heartbeatMs = 15000,
} = {}) {
  let timer = null, stage = null, stopped = false;
  const stopTimer = () => { if (timer !== null) clearInterval(timer); timer = null; };
  const close = () => {
    stopped = true; stage = null; stopTimer();
    signal?.removeEventListener('abort', close);
    res.removeListener('close', close); res.removeListener('finish', close);
  };
  const write = value => {
    if (res.destroyed || res.writableEnded) return false;
    if (!res.headersSent) res.writeHead(200, {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no',
    });
    return res.write(JSON.stringify(value) + '\n');
  };
  const heartbeat = () => {
    if (signal?.aborted || res.destroyed || res.writableEnded) { close(); return; }
    // A slow reader must not accumulate periodic frames. Ordinary progress and
    // the bounded final result retain their existing delivery semantics.
    if (!stage || res.writableNeedDrain || res.writableLength > 0) return;
    write({ type: 'progress', stage, elapsedMs: Math.round(now() - startedAt) });
  };
  signal?.addEventListener('abort', close, { once: true });
  res.once('close', close); res.once('finish', close);
  if (signal?.aborted) close();
  return {
    frame(value) {
      if (value.type === 'progress' && value.stage !== 'ready') {
        stage = value.stage;
        if (!stopped && timer === null) {
          timer = setInterval(heartbeat, heartbeatMs); timer.unref?.();
        }
      } else if (value.type === 'result' || value.type === 'error' || value.stage === 'ready') {
        close();
      }
      return write(value);
    },
    close,
  };
}
