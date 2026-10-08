// A browser may pause a video without firing ended (e.g. while its tab is hidden).
// Do not leave queued events waiting for that ended event forever.
export function createPlaybackRecovery({ getState, advance, isVisible, onSoundBlocked }) {
  let resuming = false;
  return async function recoverPlayback() {
    const { video, item, running, loading, queued } = getState();
    if (!isVisible() || loading || !running || !video?.paused || resuming) return;
    if (video.ended || (queued && item?.kind === "idle")) {
      advance();
      return;
    }
    resuming = true;
    try {
      await video.play();
    } catch {
      // Resume recorded speech silently only if the browser denies audio; let the
      // visitor enable sound again. Never change a video that has since switched.
      if (getState().video === video && !getState().loading && !video.muted) {
        video.muted = true;
        onSoundBlocked();
        await video.play().catch(() => {});
      }
    } finally {
      resuming = false;
    }
  };
}
