// Full-frame MP4 support for PerformancePlayer. Consumers may attach calibration
// to the verified asset; motion must use presented mediaTime, never wall time.
export function playLocalFilm({ host, src, video: preparedVideo, signal, muted = true, onReceipt = () => {}, onFrame, renderFrame, hold = () => {} }) {
  return new Promise((resolve, reject) => {
    const video = preparedVideo ?? document.createElement('video');
    video.className = 'local-presentation-film'; video.playsInline = true; video.muted = muted; video.preload = 'auto';
    let frame, started = false, presented = false, terminal = false, watchdog;
    const deadline = setTimeout(() => finish(new Error('Film exceeded playback limit')), 60000);
    const emit = state => onReceipt({ state, evidence: state === 'presented' ? 'video-frame' : 'media-lifecycle' });
    const clean = () => {
      clearTimeout(watchdog); clearTimeout(deadline); signal?.removeEventListener('abort', abort);
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
    const arm = () => { clearTimeout(watchdog); watchdog = setTimeout(() => finish(new Error('Film playback stalled')), 8000); };
    const abort = () => finish(new DOMException('Presentation cancelled', 'AbortError'));
    video.addEventListener('playing', () => { if (terminal) return; arm(); if (!started) { started = true; emit('start'); } });
    video.addEventListener('timeupdate', () => { if (!terminal) arm(); });
    video.addEventListener('ended', () => finish());
    video.addEventListener('error', () => finish(new Error('Film could not be decoded')));
    if (!video.requestVideoFrameCallback) { finish(new Error('Presented frame callbacks unavailable')); return; }
    const presentedFrame = (_, metadata) => {
      if (terminal) return;
      try {
        const composed = renderFrame?.(video, metadata) === true;
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
