// One utterance, at most two frames. The clock and capture source are injected
// so synthetic VAD traces can cover pauses, silence and late callbacks.
export function createAstridCameraSession({ clock = () => performance.now(), capture, onEnd = () => {}, speechMs = 3000, endSilenceMs = 650 } = {}) {
  let active = true, lastAt = null, speaking = false, silenceAt = null;
  let accumulated = 0, heardSpeech = false, middle = false;
  const images = [];
  function frame() {
    const image = capture();
    if (image && images.length < 2) images.push(image);
  }
  function finish(reason) {
    if (!active) return { reason, images: [...images], speechMs: accumulated };
    active = false;
    if (heardSpeech) frame();
    const result = { reason, images: [...images], speechMs: accumulated };
    onEnd(result);
    return result;
  }
  return {
    sample(isSpeech, at = clock()) {
      if (!active) return;
      if (lastAt !== null && speaking) accumulated += Math.max(0, Math.min(250, at - lastAt));
      lastAt = at;
      if (isSpeech) {
        heardSpeech = true;
        silenceAt = null;
        if (!middle && accumulated >= speechMs) { middle = true; frame(); }
      } else if (heardSpeech) {
        silenceAt ??= at;
        if (at - silenceAt >= endSilenceMs) return finish('speech_end');
      }
      speaking = Boolean(isSpeech);
    },
    stop: (reason = 'stop') => finish(reason),
    get active() { return active; },
    get speechMs() { return accumulated; },
    get images() { return [...images]; },
  };
}
