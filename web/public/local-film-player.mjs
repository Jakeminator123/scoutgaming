// Full-frame MP4 support for PerformancePlayer. These portrait films have no
// calibrated pickup/release/land metadata; completion is an actual media event.
export function playLocalFilm({ host, src, signal, muted = true, onReceipt = () => {}, hold = () => {} }) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
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
    frame = video.requestVideoFrameCallback(() => {
      if (terminal) return; presented = true; video.style.visibility = ''; emit('presented');
    });
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    video.style.visibility = 'hidden'; host.append(video); video.src = src; arm();
    video.play().catch(finish);
  });
}
