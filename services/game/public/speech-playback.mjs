// Own every callback and timer for one utterance. Completion aborts pending
// preparation too, so a late video load cannot start audio in the next turn.
export function playSpeech({ audio, prepare = async () => {}, onStart = () => {}, onFinish = () => {}, signal, timeoutMs = 20000 }) {
  return new Promise(resolve => {
    const controller = new AbortController();
    let finished = false, timer;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      controller.abort();
      signal?.removeEventListener('abort', finish);
      audio.removeEventListener('ended', finish);
      audio.removeEventListener('error', finish);
      audio.pause();
      try { onFinish(); } finally { resolve(); }
    };
    audio.addEventListener('ended', finish);
    audio.addEventListener('error', finish);
    signal?.addEventListener('abort', finish, { once: true });
    timer = setTimeout(finish, timeoutMs);
    if (signal?.aborted) return finish();
    (async () => {
      try {
        await prepare(controller.signal);
        if (finished) return;
        audio.currentTime = 0;
        onStart();
        await audio.play();
      } catch { finish(); }
    })();
  });
}

export function abortableDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    let timer;
    const cancel = () => { clearTimeout(timer); reject(new DOMException('Speech cancelled', 'AbortError')); };
    if (signal?.aborted) return cancel();
    signal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, ms);
  });
}


export function waitForAudio(audio, signal) {
  if (signal.aborted) return Promise.reject(new DOMException('Speech cancelled', 'AbortError'));
  if (audio.readyState >= 3) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener('canplay', ready);
      audio.removeEventListener('error', failed);
      signal.removeEventListener('abort', failed);
    };
    const ready = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('Speech audio unavailable or cancelled')); };
    audio.addEventListener('canplay', ready, { once: true });
    audio.addEventListener('error', failed, { once: true });
    signal.addEventListener('abort', failed, { once: true });
    audio.preload = 'auto'; audio.load();
  });
}
