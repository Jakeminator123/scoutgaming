// Kevin's bounded blob-cache approach, adapted to reviewed SHA-256 assets.
// A lease pins a URL through decoding/playback. Cancelling one waiter cannot
// cancel another owner; the last waiter cancels an unfinished fetch.
export function createVerifiedVideoBuffer({ budget = 96 * 1024 * 1024, fetchImpl = fetch,
  createUrl = blob => URL.createObjectURL(blob), revokeUrl = url => URL.revokeObjectURL(url) } = {}) {
  const entries = new Map(); let bytes = 0, closed = false;
  const abortError = () => new DOMException('Media preparation cancelled', 'AbortError');
  function trim() {
    for (const [key, entry] of entries) {
      if (bytes <= budget) break;
      if (entry.pins || !entry.src) continue;
      entries.delete(key); bytes -= entry.size; revokeUrl(entry.src);
    }
  }
  async function acquire(media, signal) {
    signal?.throwIfAborted(); if (closed) throw abortError();
    if (!/^[a-f0-9]{64}$/.test(media.sha256)) throw new Error('Reviewed media hash required');
    const key = media.sha256; let entry = entries.get(key);
    const cached = Boolean(entry?.src);
    if (!entry) {
      entry = { pins: 0, size: 0, src: null, controller: new AbortController() };
      entries.set(key, entry);
      entry.job = (async () => {
        const response = await fetchImpl(media.src, { signal: AbortSignal.any([entry.controller.signal, AbortSignal.timeout(15000)]) });
        if (!response.ok) throw new Error('Local film unavailable');
        const data = await response.arrayBuffer();
        if (data.byteLength > budget) throw new Error('Local film exceeds buffer budget');
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), x => x.toString(16).padStart(2, '0')).join('');
        if (digest !== key) throw new Error('Local film changed since review');
        entry.controller.signal.throwIfAborted(); if (closed) throw abortError();
        entry.src = createUrl(new Blob([data], { type: 'video/mp4' })); entry.size = data.byteLength;
        bytes += entry.size; trim(); return entry.src;
      })().catch(error => { if (entries.get(key) === entry) entries.delete(key); throw error; });
    }
    entries.delete(key); entries.set(key, entry); entry.pins++;
    let released = false, abort;
    const release = () => {
      if (released) return; released = true; entry.pins--;
      if (!entry.pins && !entry.src) { entry.controller.abort(); if (entries.get(key) === entry) entries.delete(key); }
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
  return { acquire, snapshot: () => ({ bytes, entries: entries.size }),
    close() { closed = true; for (const entry of entries.values()) { entry.controller.abort(); if (entry.src) revokeUrl(entry.src); } entries.clear(); bytes = 0; } };
}
