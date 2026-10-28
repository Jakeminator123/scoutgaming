// Full-frame MP4 support for PerformancePlayer. Consumers may attach calibration
// to the verified asset; motion must use presented mediaTime, never wall time.
import {MAX_RECORDED_SPEECH_SECONDS} from '../../../packages/presentation/contracts/recorded-speech.mjs';
import {FILMED_CATCH_UP_S, FILMED_SEEK_END_MARGIN_S} from '../../../packages/presentation/runtime/filmed-deal-timeline.mjs';
// Kevin's timed playback (K public/app.js @ 5aa7ed10), per option: startOffset seeks a step reached late into
// phase before its first frame (:234); handoverAt hands over on the last frames instead of 'ended' (:192);
// playbackRate is the chain's fitted rate (:223-227); clockTime() is the table clock in take seconds, to catch
// up after buffering and to end a step whose time is over (:180-185). Card motion still follows mediaTime.
export function playLocalFilm({ host, src, video: preparedVideo, signal, muted = true, onReceipt = () => {}, onGestureWait = () => {}, onSoundBlocked = null, onFrame, renderFrame, hold = () => {},
  startOffset = 0, handoverAt = null, playbackRate = null, clockTime = null }) {
  return new Promise((resolve, reject) => {
    const video = preparedVideo ?? document.createElement('video');
    video.className = 'local-presentation-film'; video.playsInline = true; video.muted = muted; video.preload = 'auto';
    let frame, started = false, presented = false, terminal = false, resuming = false, watchdog, handedOver = false, late = false, recovery, gestureWaiting = false, soundWaiting = false, soundWindow;
    const gestureWait = waiting => { if (gestureWaiting !== waiting) { gestureWaiting = waiting; onGestureWait(waiting); } };
    const clearRecovery = () => { recovery?.remove(); recovery = null; gestureWait(false); };
    const seekable = seconds => Number.isFinite(video.duration) && video.duration > 0 ? Math.min(seconds, Math.max(0, video.duration - FILMED_SEEK_END_MARGIN_S)) : seconds;
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
      ...(handedOver ? { handover: true } : {}), ...(late ? { late: true } : {}), ...(error?.playback ? { code: error.code, playback: error.playback } : {}) });
    const clean = () => {
      clearRecovery(); clearTimeout(soundWindow); soundWaiting = false;
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
    // A take that the table clock or its handover ends before playback began
    // ('playing') came too late for its place: K04 staging 28 Oct 2026 saw
    // 'presented' and the end in the same millisecond. It is skipped, not a
    // failed film: no fallback, no error text, and the receipt says late.
    const finish = error => {
      if (terminal) return; terminal = true;
      late = !error && handedOver && presented && !started;
      if (!error && !late && (!started || !presented || !(video.ended || handedOver))) {
        error = playbackError('Film ended without a presented frame',
          started && video.ended && !presented ? 'local_film_no_presented_frame' : 'local_film_incomplete');
      }
      if (presented) hold(video);
      emit(error ? signal?.aborted ? 'interrupted' : 'error' : late ? 'skipped' : 'end', error); clean();
      error ? reject(error) : resolve(late ? { completed: false, late: true } : { completed: true });
    };
    const arm = () => { clearTimeout(watchdog); if (!gestureWaiting && !soundWaiting) watchdog = setTimeout(() => finish(video.ended ? undefined : playbackError('Film playback stalled', 'local_film_stalled')), 8000); };
    const abort = () => finish(new DOMException('Presentation cancelled', 'AbortError'));
    // Unmuted speech refused by the autoplay policy before any interaction.
    // The owner offers the player's sound control and may resume this exact
    // line inside a real click. Nothing has started: suspend only the progress
    // watchdog; owner cancellation and the absolute deadline still apply. The
    // line keeps its place for at most its own length (8 s until metadata is
    // known), as if it had played, so the game never waits for the click.
    const waitForSound = cause => {
      clearTimeout(watchdog); soundWaiting = true;
      const length = () => Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
      const keepPlace = () => {
        clearTimeout(soundWindow);
        soundWindow = setTimeout(() => finish(Object.assign(playbackError('Speech sound needs a user gesture', 'local_film_sound_blocked'), { cause })), (length() ?? 8) * 1000);
      };
      keepPlace();
      if (length() === null) listen(video, 'loadedmetadata', () => { if (soundWaiting) keepPlace(); });
      try { onSoundBlocked(resumeSound); } catch (error) { finish(error); }
    };
    const resumeSound = () => {
      if (terminal || signal?.aborted || !soundWaiting || document.hidden) return false;
      soundWaiting = false; clearTimeout(soundWindow); arm();
      // This call must stay synchronous inside the click handler for iOS. A
      // refusal despite the player's gesture is a real failure, not a new wait.
      try { video.play().catch(finish); } catch (error) { finish(error); }
      return true;
    };
    const startFailed = error => {
      if (terminal || signal?.aborted) return;
      if (error?.name === 'NotAllowedError' && !muted && onSoundBlocked && !started && !presented && !soundWaiting) { waitForSound(error); return; }
      if (error?.name !== 'NotAllowedError' || !muted || started || presented) { finish(error); return; }
      // Retain this verified video's lease while waiting for a real gesture.
      // No playback has started: suspend only its progress watchdog, never
      // the absolute deadline or owner cancellation.
      clearTimeout(watchdog);
      if (!recovery) {
        recovery = document.createElement('button');
        recovery.type = 'button'; recovery.className = 'local-presentation-recovery';
        recovery.textContent = 'Starta videon';
        recovery.onclick = () => {
          if (terminal || signal?.aborted || !recovery || recovery.disabled || document.hidden) return;
          recovery.disabled = true; gestureWait(false); arm();
          // This call must stay synchronous inside the click handler for iOS.
          try { video.play().catch(startFailed); } catch (error) { startFailed(error); }
        };
        // The scene stays hidden until the selected dealer presents a frame.
        document.body.append(recovery);
      }
      recovery.disabled = false;
      gestureWait(true);
    };
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
    listen(video, 'playing', () => { if (terminal || started) return; clearRecovery(); arm(); started = true; emit('start'); });
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
        // The successor is prepared: hand over on the last frames, the held frame covers the switch.
        if (handoverAt !== null && metadata.mediaTime + 1e-6 >= handoverAt) { handedOver = true; finish(); return; }
        if (clockTime) {
          const target = clockTime();
          if (Number.isFinite(target)) {
            if (Number.isFinite(video.duration) && target >= video.duration) { handedOver = true; finish(); return; }
            if (!video.seeking && Math.abs(metadata.mediaTime - target) > FILMED_CATCH_UP_S) video.currentTime = seekable(target);
          }
        }
      } catch (error) { finish(error); return; }
      if (!terminal && (onFrame || renderFrame || handoverAt !== null || clockTime)) frame = video.requestVideoFrameCallback(presentedFrame);
    };
    frame = video.requestVideoFrameCallback(presentedFrame);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    video.style.visibility = 'hidden'; host.append(video); if (video.src !== src) video.src = src; arm();
    if (Number.isFinite(playbackRate) && playbackRate > 0) video.playbackRate = playbackRate;
    if (Number.isFinite(startOffset) && startOffset > 0) {
      const seek = () => { video.currentTime = seekable(startOffset); };
      if (video.readyState >= 1) seek(); else listen(video, 'loadedmetadata', seek);
    }
    try { video.play().catch(startFailed); } catch (error) { startFailed(error); }
  });
}
