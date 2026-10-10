// Read the selected file's metadata; never infer a loop duration from another clip.
export function readIdleVideoDuration(src, { signal, createVideo = () => document.createElement('video'), timeoutMs = 10000 } = {}) {
  if (signal?.aborted) return Promise.reject(new DOMException('Avbrutet', 'AbortError'));
  return new Promise((resolve, reject) => {
    const probe = createVideo(); let finished = false;
    const finish = (error, durationMs) => {
      if (finished) return; finished = true;
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
      probe.onloadedmetadata = null; probe.onerror = null;
      probe.removeAttribute('src'); probe.load();
      error ? reject(error) : resolve(durationMs);
    };
    const abort = () => finish(new DOMException('Avbrutet', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('Videons längd kunde inte läsas. Försök igen.')), timeoutMs);
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      const durationMs = Math.round(probe.duration * 1000);
      if (!Number.isInteger(durationMs) || durationMs < 200 || durationMs > 60000) return finish(new Error('Klippet måste vara mellan 0,2 och 60 sekunder.'));
      finish(null, durationMs);
    };
    probe.onerror = () => finish(new Error('Videons längd kunde inte läsas.'));
    signal?.addEventListener('abort', abort, { once: true });
    probe.src = src; probe.load();
  });
}
