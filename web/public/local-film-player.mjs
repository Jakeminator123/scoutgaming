// Full-frame MP4 support for PerformancePlayer. Consumers may attach calibration
// to the verified asset; motion must use presented mediaTime, never wall time.
export function playLocalFilm({ host, src, video: preparedVideo, signal, muted = true, onReceipt = () => {}, onFrame, renderFrame, hold = () => {} }) {
  return new Promise((resolve, reject) => {
    const video = preparedVideo ?? document.createElement('video');
    video.className = 'local-presentation-film'; video.playsInline = true; video.muted = muted; video.preload = 'auto';
    let frame, started = false, presented = false, terminal = false, resuming = false, watchdog;
    const listeners = [];
    const listen = (target, type, callback) => {
      target.addEventListener(type, callback);
      listeners.push(() => target.removeEventListener(type, callback));
    };
    const deadline = setTimeout(() => finish(new Error('Film exceeded playback limit')), 60000);
    const emit = state => onReceipt({ state, evidence: state === 'presented' ? 'video-frame' : 'media-lifecycle' });
    const clean = () => {
      clearTimeout(watchdog); clearTimeout(deadline); signal?.removeEventListener('abort', abort);
      for (const remove of listeners) remove();
      if (frame != null) video.cancelVideoFrameCallback(frame);
      video.pause(); video.removeAttribute('src'); video.load(); video.remove();
    };
    const finish = error => {
      if (terminal) return; terminal = true;
      if (!error && (!started || !presented || !video.ended)) error = new Error('Film ended without a presented frame');
      if (presented) hold(video);
      emit(error ? signal?.aborted ? 'interrupted' : 'error' : 'end'); clean();
      error ? reject(error) : resolve({ completed: true });
    };
    const arm = () => { clearTimeout(watchdog); watchdog = setTimeout(() => finish(video.ended ? undefined : new Error('Film playback stalled')), 8000); };
    const abort = () => finish(new DOMException('Presentation cancelled', 'AbortError'));
    // Adapt Kevin's paused-playback recovery to this film's existing owner.
    // Resume the exact frame, never skip a queued card or silently mute speech.
    // Hidden-tab cancellation remains the presentation controller's decision.
    const recover = async () => {
      if (terminal || signal?.aborted || document.hidden || !started) return;
      if (video.ended) { finish(); return; }
      if (!video.paused || resuming) return;
      resuming = true;
      try { await video.play(); }
      catch (error) { if (!terminal && !signal?.aborted) finish(error); }
      finally { resuming = false; }
    };
    listen(video, 'playing', () => { if (terminal) return; arm(); if (!started) { started = true; emit('start'); } });
    listen(video, 'timeupdate', () => { if (!terminal) arm(); });
    listen(video, 'ended', () => finish());
    listen(video, 'error', () => finish(new Error('Film could not be decoded')));
    listen(video, 'pause', recover);
    listen(document, 'visibilitychange', recover);
    listen(window, 'focus', recover);
    listen(document, 'pointerdown', recover);
    listen(document, 'keydown', recover);
    if (!video.requestVideoFrameCallback) { finish(new Error('Presented frame callbacks unavailable')); return; }
    const presentedFrame = (_, metadata) => {
      if (terminal) return;
      try {
        const composed = renderFrame?.(video, metadata) === true;
        if (renderFrame && !composed) throw new Error('Dealer background removal unavailable');
        if (!presented) { presented = true; video.style.visibility = composed ? 'hidden' : ''; emit('presented'); }
        onFrame?.(metadata.mediaTime);
      } catch (error) { finish(error); return; }
      if (!terminal && (onFrame || renderFrame)) frame = video.requestVideoFrameCallback(presentedFrame);
    };
    frame = video.requestVideoFrameCallback(presentedFrame);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    video.style.visibility = 'hidden'; host.append(video); if (video.src !== src) video.src = src; arm();
    video.play().catch(finish);
  });
}
