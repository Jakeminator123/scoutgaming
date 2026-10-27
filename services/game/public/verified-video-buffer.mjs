// Kevin's bounded blob-cache approach, adapted to reviewed SHA-256 assets.
// A lease pins a URL through decoding/playback. Cancelling one waiter cannot
// cancel another owner; the last waiter cancels an unfinished fetch after a
// short grace in which the same exact file may be acquired again.
//
// A download is bounded by silence, never by its total length: on a slow
// connection a clip keeps loading while bytes arrive (K04 at 400 kbit/s took
// longer than any whole-file limit), and a fetch that receives nothing for
// idleTimeoutMs fails as stalled. The exact hash is still checked over every
// byte before a URL exists.
const UNAVAILABLE_STATUS = new Set([404, 410]);
// The server's fixed answer for a published file it cannot serve (any status).
const UNAVAILABLE_CODES = new Set(['studio_presentation_idle_media_unavailable']);
const ERROR_BODY_LIMIT = 4096;

async function errorCode(response) {
  try {
    if (!/^application\/json\b/i.test(response.headers?.get?.('content-type') ?? '')) return null;
    const text = await response.text();
    if (text.length > ERROR_BODY_LIMIT) return null;
    const value = JSON.parse(text)?.error;
    return typeof value === 'string' && /^[a-z0-9_]{1,96}$/.test(value) ? value : null;
  } catch { return null; }
}

// A missing (404/410) or server-declared unavailable file is not retried by
// this presentation; the caller ends that step at once. Other failures keep
// their retry semantics. The receipt keeps the status and server code.
async function unavailable(response) {
  const code = await errorCode(response);
  if (code === null) await response.body?.cancel?.().catch?.(() => {});
  const retryable = !UNAVAILABLE_STATUS.has(response.status) && !UNAVAILABLE_CODES.has(code);
  return Object.assign(new Error('Local film unavailable'), { code: 'local_film_unavailable', status: response.status,
    retryable, ...(code ? { serverCode: code } : {}) });
}

// The owner's abort ends a body read even when a stream ignores the fetch signal.
function abortable(work, signal) {
  signal.throwIfAborted(); let abort;
  return Promise.race([work, new Promise((_, reject) => { abort = () => reject(signal.reason); signal.addEventListener('abort', abort, { once: true }); })])
    .finally(() => signal.removeEventListener('abort', abort));
}

async function readBody(response, { budget, onBytes, signal }) {
  signal.throwIfAborted();
  const declared = Number(response.headers?.get?.('content-length') ?? NaN);
  if (Number.isSafeInteger(declared) && declared > budget) {
    await response.body?.cancel?.().catch?.(() => {});
    throw new Error('Local film exceeds buffer budget');
  }
  const total = Number.isSafeInteger(declared) && declared >= 0 ? declared : null;
  const reader = response.body?.getReader?.();
  if (!reader) {
    const data = new Uint8Array(await abortable(response.arrayBuffer(), signal));
    if (data.byteLength > budget) throw new Error('Local film exceeds buffer budget');
    onBytes(data.byteLength, total);
    return data;
  }
  const chunks = []; let received = 0;
  try {
    for (;;) {
      const { done, value } = await abortable(reader.read(), signal);
      if (done) break;
      received += value.byteLength;
      if (received > budget) throw new Error('Local film exceeds buffer budget');
      chunks.push(value); onBytes(received, total);
    }
  } catch (error) { reader.cancel?.(error).catch?.(() => {}); throw error; }
  const data = new Uint8Array(received); let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  return data;
}

// abandonGraceMs: an unfinished download whose last owner left keeps loading this
// long. A restarted idle (every table snapshot restarts it) or the step that
// follows a cancelled lookahead joins the same bytes instead of starting over.
export function createVerifiedVideoBuffer({ budget = 96 * 1024 * 1024, fetchImpl = fetch, idleTimeoutMs = 15000, abandonGraceMs = 5000,
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
  // Download progress for every owner of the same exact file (a prepared
  // lookahead and the step that later plays it share one fetch).
  function listen(entry, listener) {
    if (!entry || entry.src || typeof listener !== 'function') return () => {};
    entry.listeners.add(listener);
    if (entry.received) { try { listener({ received: entry.received, total: entry.total }); } catch {} }
    return () => entry.listeners.delete(listener);
  }
  async function acquire(media, signal, { onProgress } = {}) {
    signal?.throwIfAborted(); if (closed) throw abortError();
    if (!/^[a-f0-9]{64}$/.test(media.sha256)) throw new Error('Reviewed media hash required');
    const key = media.sha256; let entry = entries.get(key);
    const cached = Boolean(entry?.src);
    if (!entry) {
      entry = { pins: 0, size: 0, src: null, controller: new AbortController(), listeners: new Set(), received: 0, total: null };
      entries.set(key, entry);
      const owned = entry; let silence;
      const stalled = () => Object.assign(new Error('Local film download stalled'), { name: 'TimeoutError', code: 'local_film_download_stalled' });
      const quiet = () => { clearTimeout(silence); if (!owned.controller.signal.aborted) silence = setTimeout(() => owned.controller.abort(stalled()), idleTimeoutMs); };
      owned.controller.signal.addEventListener('abort', () => clearTimeout(silence), { once: true });
      entry.job = (async () => {
        quiet();
        try {
          const response = await abortable(Promise.resolve(fetchImpl(media.src, { signal: owned.controller.signal })), owned.controller.signal);
          if (!response.ok) throw await unavailable(response);
          quiet();
          const data = await readBody(response, { budget, signal: owned.controller.signal, onBytes: (received, total) => {
            quiet(); owned.received = received; owned.total = total;
            for (const listener of [...owned.listeners]) { try { listener({ received, total }); } catch {} }
          } });
          clearTimeout(silence);
          const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), x => x.toString(16).padStart(2, '0')).join('');
          if (digest !== key) throw new Error('Local film changed since review');
          owned.controller.signal.throwIfAborted(); if (closed) throw abortError();
          owned.src = createUrl(new Blob([data], { type: 'video/mp4' })); owned.size = data.byteLength;
          bytes += owned.size; trim(); return owned.src;
        } catch (error) {
          // The fetch reports its own abort; name the silence that caused it.
          if (owned.controller.signal.reason?.code === 'local_film_download_stalled') throw owned.controller.signal.reason;
          throw error;
        } finally { clearTimeout(silence); owned.listeners.clear(); }
      })().catch(error => { if (entries.get(key) === entry) entries.delete(key); throw error; });
    }
    entries.delete(key); entries.set(key, entry); entry.pins++; clearTimeout(entry.abandon); entry.abandon = undefined;
    const unlisten = listen(entry, onProgress);
    let released = false, abort;
    const release = () => {
      if (released) return; released = true; entry.pins--; unlisten();
      if (!entry.pins && !entry.src) {
        const cancel = () => { entry.abandon = undefined; if (entry.pins || entry.src) return; entry.controller.abort(); if (entries.get(key) === entry) entries.delete(key); };
        clearTimeout(entry.abandon); if (abandonGraceMs > 0) entry.abandon = setTimeout(cancel, abandonGraceMs); else cancel();
      }
      trim();
    };
    try {
      const src = await Promise.race([entry.job, new Promise((_, reject) => {
        abort = () => reject(abortError()); signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
      })]);
      signal?.throwIfAborted(); if (closed) throw abortError();
      unlisten();
      return { src, cached, release };
    } catch (error) { release(); throw error; }
    finally { signal?.removeEventListener('abort', abort); }
  }
  return { acquire, observe: (sha256, listener) => listen(entries.get(sha256), listener), snapshot: () => ({ bytes, entries: entries.size }),
    close() { closed = true; for (const entry of entries.values()) { clearTimeout(entry.abandon); entry.controller.abort(); if (entry.src) revokeUrl(entry.src); } entries.clear(); bytes = 0; } };
}
