// Voice-overs for a ready dealer's lines and answers (app.js speak, yieldAnswer), Kevin 20 Oct: no sound on his phone
// when the dealer spoke. Every line was a new Audio() started by a timer, outside the player's gesture, and Safari on
// iPhone/iPad refuses play() on such an element (NotAllowedError, caught silently). A small pool of Audio elements is
// started once in the gesture (unlock), muted on a silent source, and reused for every voice-over: an element started
// in a gesture stays allowed when its src changes. The next line's sound is loaded into a free element as soon as the
// table knows the line (warm), so it starts on its first frame instead of seeking past its opening once its metadata
// arrives (measured on staging: the first ~0.9 s of a line never heard, the mouth ahead of the voice).
// A silent 50 ms WAV (8 kHz mono, public/media/silent.wav) for the unlock: served like the clips, since the page's
// Content-Security-Policy does not allow data: URIs for media.
export const SILENT_WAV = '/media/silent.wav';

/** busy(a): true while a pool element is speaking (the caller's set of voice-overs). create(): a new Audio. */
export function createVoicePool({ busy = () => false, create = () => new Audio(), size = 3 } = {}) {
  const pool = Array.from({ length: size }, () => { const a = create(); a.preload = 'auto'; a.dataset.voiceOver = '1'; a.dataset.pool = '1'; return a; });
  let unlocked = false;
  const free = () => pool.filter(a => !busy(a));
  return {
    pool,
    /** In the player's gesture: every element not yet holding a line plays the silent source once, muted. */
    unlock() {
      if (unlocked) return;
      unlocked = true;
      for (const a of pool) { if (a.dataset.src) continue; a.muted = true; a.src = SILENT_WAV; Promise.resolve(a.play()).then(() => a.pause()).catch(() => {}); }
    },
    /** Loads a line's sound into a free element ahead of time (nothing when it is loaded already or all are taken). */
    warm(url) {
      if (!url || pool.some(a => a.dataset.src === url)) return null;
      const a = free().find(x => !x.dataset.warm);
      if (!a) return null;
      a.dataset.src = url; a.dataset.warm = '1'; a.src = url; a.load();
      return a;
    },
    /** The element to speak this sound with: the one warmed with it, else a free one not holding another warmed line, else any free one, else a fresh Audio (all three speaking). */
    take(url) {
      const f = free();
      let a = f.find(x => x.dataset.src === url) ?? f.find(x => !x.dataset.warm) ?? f[0];
      if (!a) { a = create(); a.preload = 'auto'; a.dataset.voiceOver = '1'; }
      delete a.dataset.warm;
      if (a.dataset.src !== url) { a.dataset.src = url; a.src = url; a.load(); }
      return a;
    },
    /** Starts the sound offsetAt() seconds in: now when its metadata is here, else the moment it arrives (a reused element rewinds). */
    seek(a, offsetAt) {
      const go = () => { const o = offsetAt(); if (o > .15) a.currentTime = Math.min(o, a.duration || o); else if (a.currentTime > .05) a.currentTime = 0; };
      if (a.readyState >= 1) go(); else a.addEventListener('loadedmetadata', go, { once: true });
    },
  };
}
