// A complete quiet gesture roughly every 50 seconds. Ineligible cards start a
// fresh interval when they return; background tabs never accumulate a burst.
export function portraitIdleDelay(random = Math.random) {
  const value = Number(random());
  return 45_000 + 10_000 * (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5);
}

export function createPortraitPlayback({ start, stop, random = Math.random,
  setTimer = setTimeout, clearTimer = clearTimeout }) {
  let eligible = false, playing = false, disposed = false, timer = null;
  const cancelTimer = () => { if (timer !== null) clearTimer(timer); timer = null; };
  const schedule = () => {
    cancelTimer();
    if (!eligible || playing || disposed) return;
    timer = setTimer(() => { timer = null; request(); }, portraitIdleDelay(random));
  };
  const finish = () => {
    cancelTimer();
    if (playing) stop();
    playing = false;
    schedule();
  };
  const request = () => {
    if (!eligible || playing || disposed) return false;
    cancelTimer(); playing = true;
    // A refused or stalled media load cannot leave the card animated forever.
    timer = setTimer(finish, 15_000);
    start();
    return true;
  };
  return {
    request, finish,
    setEligible(value) {
      if (disposed || eligible === Boolean(value)) return;
      eligible = Boolean(value);
      if (eligible) schedule();
      else { cancelTimer(); if (playing) stop(); playing = false; }
    },
    dispose() { disposed = true; eligible = false; cancelTimer(); if (playing) stop(); playing = false; },
  };
}
