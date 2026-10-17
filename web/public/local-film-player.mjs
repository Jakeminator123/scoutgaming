// Full-frame MP4 support for PerformancePlayer. Consumers may attach calibration
// to the verified asset; motion must use presented mediaTime, never wall time.
import {MAX_RECORDED_SPEECH_SECONDS} from '../../packages/presentation/contracts/recorded-speech.mjs';
export function playLocalFilm({ host, src, video: preparedVideo, signal, muted = true, onReceipt = () => {}, onFrame, renderFrame, hold = () => {} }) {
  return new Promise((resolve, reject) => {
    const video = preparedVideo ?? document.createElement('video');
    video.className = 'local-presentation-film'; video.playsInline = true; video.muted = muted; video.preload = 'auto';
    let frame, started = false, presented = false, terminal = false, resuming = false, watchdog;
    let lastMediaTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const listeners = [];
    const listen = (target, type, callback) => {
      target.addEventListener(type, callback);
      listeners.push(() => target.removeEventListener(type, callback));
    };
    // The tuple permits 120 s; keep a bounded 8 s startup allowance alongside
    // the existing progress watchdog rather than cutting valid speech at 60 s.
    const deadline = setTimeout(() => finish(new Error('Film exceeded playback limit')), (MAX_RECORDED_SPEECH_SECONDS + 8) * 1000);
    const emit = (state, error) => onReceipt({ state, evidence: state === 'presented' ? 'video-frame' : 'media-lifecycle',
      ...(error?.playback ? { code: error.code, playback: error.playback } : {}) });
    const clean = () => {
      clearTimeout(watchdog); clearTimeout(deadline); signal?.removeEventListener('abort', abort);
      for (const remove of listeners) remove();
      if (frame != null) video.cancelVideoFrameCallback(frame);
      video.pause(); video.removeAttribute('src'); video.load(); video.remove();
    };
    const playbackError = (message, code) => Object.assign(new Error(message), {
      code, playback: { started, presented, ended: video.ended, readyState: video.readyState,
        paused: video.paused, seeking: !!video.seeking, networkState: video.networkState,
        mediaTime: Number.isFinite(video.currentTime) ? video.currentTime : null,
        duration: Number.isFinite(video.duration) ? video.duration : null,
        visibility: document.visibilityState ?? (document.hidden ? 'hidden' : 'visible') },
    });
    const finish = error => {
      if (terminal) return; terminal = true;
      if (!error && (!started || !presented || !video.ended)) {
        error = playbackError('Film ended without a presented frame',
          started && video.ended && !presented ? 'local_film_no_presented_frame' : 'local_film_incomplete');
      }
      if (presented) hold(video);
      emit(error ? signal?.aborted ? 'interrupted' : 'error' : 'end', error); clean();
      error ? reject(error) : resolve({ completed: true });
    };
    const arm = () => { clearTimeout(watchdog); watchdog = setTimeout(() => finish(video.ended ? undefined : playbackError('Film playback stalled', 'local_film_stalled')), 8000); };
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
    listen(video, 'playing', () => { if (terminal || started) return; arm(); started = true; emit('start'); });
    listen(video, 'timeupdate', () => {
      // Events alone are not progress: browsers may repeat them at one frame.
      if (!terminal && Number.isFinite(video.currentTime) && video.currentTime > lastMediaTime) {
        lastMediaTime = video.currentTime; arm();
      }
    });
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
