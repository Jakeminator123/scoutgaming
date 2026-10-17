/** Return a disposer so a movie ending, unmount or user gesture cancels all work. */
export function animateScrollTo(targetY, duration, onDone, viewport = window) {
  const startY = viewport.scrollY;
  const distance = targetY - startY;
  const startedAt = viewport.performance.now();
  const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
  let finished = false, frameId = 0;
  const finish = () => {
    if (finished) return;
    finished = true;
    viewport.cancelAnimationFrame(frameId);
    events.forEach(name => viewport.removeEventListener(name, finish));
    onDone();
  };
  const frame = now => {
    if (finished) return;
    const t = Math.min(1, Math.max(0, (now - startedAt) / duration));
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    viewport.scrollTo({ top: startY + distance * eased, behavior: 'instant' });
    if (t < 1) frameId = viewport.requestAnimationFrame(frame);
    else finish();
  };
  events.forEach(name => viewport.addEventListener(name, finish, { passive: true }));
  frameId = viewport.requestAnimationFrame(frame);
  return finish;
}
