// Kevin's bounded blob-cache approach, adapted to reviewed SHA-256 assets.
// A lease pins a URL through decoding/playback. Cancelling one waiter cannot
// cancel another owner; the last waiter cancels an unfinished fetch.
export function createVerifiedVideoBuffer({ budget = 96 * 1024 * 1024, parallel = 4, fetchImpl = fetch,
  createUrl = blob => URL.createObjectURL(blob), revokeUrl = url => URL.revokeObjectURL(url) } = {}) {
  if (!Number.isSafeInteger(parallel) || parallel < 1) throw new TypeError('Positive transfer limit required');
  const entries = new Map(); let bytes = 0, closed = false, active = 0, order = 0;
  const abortError = () => new DOMException('Media preparation cancelled', 'AbortError');
  function trim() {
    for (const [key, entry] of entries) {
      if (bytes <= budget) break;
      if (entry.pins || !entry.src) continue;
      entries.delete(key); bytes -= entry.size; revokeUrl(entry.src);
    }
  }
  async function download(entry) {
    const response = await fetchImpl(entry.media.src, { signal: AbortSignal.any([entry.controller.signal, AbortSignal.timeout(15000)]) });
    if (!response.ok) throw new Error('Local film unavailable');
    const data = await response.arrayBuffer();
    if (data.byteLength > budget) throw new Error('Local film exceeds buffer budget');
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), x => x.toString(16).padStart(2, '0')).join('');
    if (digest !== entry.media.sha256) throw new Error('Local film changed since review');
    entry.controller.signal.throwIfAborted(); if (closed) throw abortError();
    entry.src = createUrl(new Blob([data], { type: 'video/mp4' })); entry.size = data.byteLength;
    bytes += entry.size; trim(); return entry.src;
  }
  // Kevin's pending-game-before-idle queue, with main's hash checks, leases and
  // per-owner cancellation retained. The timeout starts on transfer, not enqueue.
  function pump() {
    if (closed) return;
    const pending = [...entries.values()].filter(entry => !entry.started && !entry.src)
      .sort((a, b) => a.priority - b.priority || a.order - b.order);
    for (const entry of pending) {
      if (active >= parallel) break;
      entry.started = true; active++;
      void download(entry).then(entry.resolve, error => {
        if (entries.get(entry.media.sha256) === entry) entries.delete(entry.media.sha256);
        entry.reject(error);
      }).finally(() => { active--; pump(); });
    }
  }
  async function acquire(media, signal, { priority = 0 } = {}) {
    signal?.throwIfAborted(); if (closed) throw abortError();
    if (!/^[a-f0-9]{64}$/.test(media.sha256)) throw new Error('Reviewed media hash required');
    if (!Number.isFinite(priority)) throw new TypeError('Finite transfer priority required');
    const key = media.sha256; let entry = entries.get(key);
    const cached = Boolean(entry?.src);
    if (!entry) {
      entry = { media: { ...media }, priority, order: order++, started: false,
        pins: 0, size: 0, src: null, controller: new AbortController() };
      entry.job = new Promise((resolve, reject) => { entry.resolve = resolve; entry.reject = reject; });
      entries.set(key, entry);
    }
    entry.priority = Math.min(entry.priority, priority);
    entries.delete(key); entries.set(key, entry); entry.pins++;
    queueMicrotask(pump);
    let released = false, abort;
    const release = () => {
      if (released) return; released = true; entry.pins--;
      if (!entry.pins && !entry.src) {
        entry.controller.abort(); entry.reject(abortError());
        if (entries.get(key) === entry) entries.delete(key);
      }
      trim();
    };
    try {
      const src = await Promise.race([entry.job, new Promise((_, reject) => {
        abort = () => reject(abortError()); signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
      })]);
      signal?.throwIfAborted(); if (closed) throw abortError();
      return { src, cached, release };
    } catch (error) { release(); throw error; }
    finally { signal?.removeEventListener('abort', abort); }
  }
  return { acquire,
    prioritize(media) { const entry = entries.get(media.sha256); if (entry) entry.priority = Math.min(entry.priority, 0); },
    snapshot: () => ({ bytes, entries: entries.size }),
    close() { closed = true; for (const entry of entries.values()) { entry.controller.abort(); entry.reject(abortError()); if (entry.src) revokeUrl(entry.src); } entries.clear(); bytes = 0; } };
}
