import { validateMotionClip } from './motion-library.mjs';

// A target's current owner is replaced, never mixed with another JSON clip.
// No DOM lookup: the Stage supplies its own fixed React refs.
const owners = new WeakMap();
export function motionKeyframes(track) {
  return track.frames.map(({ at, x, y, rotate, opacity }) => ['blush', 'sadFace'].includes(track.target)
    ? { offset: at, opacity } : track.target === 'coverHands' ? { offset: at, opacity, transform: `translateY(${y}px)` }
    : { offset: at, ...(opacity === undefined ? {} : { opacity }), transform: track.target.endsWith('Arm') ? `rotate(${rotate}deg)` : `translate(${x}px, ${y}px) rotate(${rotate}deg)` });
}

/** Only the synthetic avatar is animated. Cards and the game engine are separate. */
export function playMotion(clip, targets, { durationMs = clip.durationMs, reducedMotion = false, onFinish } = {}) {
  validateMotionClip(clip);
  if (!Number.isFinite(durationMs) || durationMs < 200 || durationMs > 10000) throw new TypeError('Invalid motion duration');
  const actor = targets?.actor;
  if (actor && typeof actor === 'object') owners.get(actor)?.cancel();
  const handles = [];
  let notified = false;
  const playback = {
    status: reducedMotion ? 'reduced-motion' : 'playing',
    cancel() {
      if (playback.status === 'cancelled') return;
      for (const animation of handles) { animation.onfinish = null; animation.cancel(); }
      if (actor && owners.get(actor) === playback) owners.delete(actor);
      playback.status = 'cancelled';
    },
  };
  const finish = () => {
    if (notified || playback.status === 'cancelled' || playback.status === 'unsupported') return;
    notified = true;
    playback.status = 'finished';
    if (actor && owners.get(actor) === playback) owners.delete(actor);
    onFinish?.();
  };
  if (reducedMotion) { queueMicrotask(finish); return playback; }
  if (!clip.tracks.every(track => targets?.[track.target] && typeof targets[track.target].animate === 'function')) {
    playback.status = 'unsupported';
    return playback;
  }
  let remaining = clip.tracks.length;
  owners.set(actor, playback);
  try {
    for (const track of clip.tracks) {
      const animation = targets[track.target].animate(motionKeyframes(track), {
        id: `lab:${clip.assetId}:${track.target}`, duration: durationMs,
        iterations: 1, fill: 'none', easing: 'ease-in-out',
      });
      handles.push(animation);
      animation.onfinish = () => {
        if (--remaining === 0 && playback.status === 'playing') {
          finish();
        }
      };
    }
  } catch {
    // A partially started set must not remain on screen if browser support fails.
    playback.cancel();
    playback.status = 'unsupported';
  }
  return playback;
}
