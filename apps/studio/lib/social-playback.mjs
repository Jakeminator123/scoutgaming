export const SOCIAL_SPEECH_LIMIT_MS = 25000;

/** One local speech owner. A stopped/overlong take is a failed preview, never
 * an accepted shortened recording or proof of lip sync. No retries are made. */
export function createSocialPlayback({ createAudio = source => new Audio(source), schedule = setTimeout, clearTimer = clearTimeout, onState = () => {}, onActivity = () => {} } = {}) {
  let current = null;
  function finish(turn, outcome, reason) {
    if (current !== turn) return;
    current = null;
    clearTimer(turn.timer);
    for (const name of ['onended', 'onerror', 'onloadedmetadata', 'ondurationchange', 'onplaying', 'ontimeupdate']) turn.audio[name] = null;
    turn.audio.pause();
    turn.audio.removeAttribute('src');
    turn.audio.load();
    onState('idle');
    const result = { outcome, reason, durationMs: Number.isFinite(turn.durationMs) ? turn.durationMs : null };
    onActivity(result);
    turn.resolve(result);
  }
  function cancel(reason = 'explicit-stop') { if (current) finish(current, 'cancelled', reason); }
  function play(source) {
    if (current) return Promise.resolve({ outcome: 'rejected', reason: 'speech-owner-busy', durationMs: null });
    return new Promise(resolve => {
      const audio = createAudio(source);
      const turn = { audio, resolve, timer: null, started: false, playing: false, durationMs: NaN };
      current = turn;
      const durationAllowed = () => {
        turn.durationMs = audio.duration * 1000;
        if (turn.durationMs > SOCIAL_SPEECH_LIMIT_MS) { finish(turn, 'rejected', 'audio-longer-than-25-seconds'); return false; }
        return true;
      };
      const start = () => {
        if (current !== turn || turn.started || !durationAllowed()) return;
        turn.started = true;
        clearTimer(turn.timer);
        // Includes any browser delay after play(); a stale play promise can
        // never restart audio after this turn has ended.
        turn.timer = schedule(() => finish(turn, 'failed', 'speech-25-second-watchdog'), SOCIAL_SPEECH_LIMIT_MS);
        Promise.resolve().then(() => { if (current === turn) return audio.play(); }).then(() => { if (current !== turn) audio.pause(); }).catch(() => finish(turn, 'failed', 'audio-play-rejected'));
      };
      audio.preload = 'metadata';
      audio.onloadedmetadata = start;
      audio.ondurationchange = () => { if (current === turn) durationAllowed(); };
      audio.onplaying = () => { if (current === turn && !turn.playing) { turn.playing = true; onState('playing'); } };
      audio.onended = () => {
        if (audio.currentTime * 1000 > SOCIAL_SPEECH_LIMIT_MS || audio.duration * 1000 > SOCIAL_SPEECH_LIMIT_MS) finish(turn, 'failed', 'speech-25-second-watchdog');
        else finish(turn, 'completed', 'audio-ended');
      };
      audio.onerror = () => finish(turn, 'failed', 'audio-error');
      audio.ontimeupdate = () => { if (audio.currentTime * 1000 >= SOCIAL_SPEECH_LIMIT_MS && !audio.ended) finish(turn, 'failed', 'speech-25-second-watchdog'); };
      onState('loading');
      turn.timer = schedule(() => finish(turn, 'failed', 'audio-metadata-timeout'), 3000);
      if (audio.readyState >= 1) start();
      else audio.load();
    });
  }
  return { play, cancel, get active() { return Boolean(current); } };
}
