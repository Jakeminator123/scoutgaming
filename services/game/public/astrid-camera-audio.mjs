export const CAMERA_AUDIO_SECONDS = 30;
export const CAMERA_AUDIO_MAX_BYTES = 44 + 48000 * 2 * CAMERA_AUDIO_SECONDS;
export const CAMERA_AUDIO_PREROLL_MAX_MS = 3000;

// A local level gate, not speech recognition. Debouncing rejects a single click;
// the transcription provider decides whether the captured audio contains words.
export function createCameraAudioActivity() {
  let noise = 0.002, attack = 0, release = 0, active = false;
  return (rms, elapsedMs = 100) => {
    const step = Math.max(0, Math.min(150, elapsedMs));
    const above = rms >= Math.max(0.008, noise * 3);
    if (!above && !active) noise = noise * 0.95 + rms * 0.05;
    if (above) { attack += step; release = 0; if (attack >= 180) active = true; }
    else { attack = 0; release += step; if (release >= 180) active = false; }
    return active;
  };
}

export function encodeCameraWav(chunks, sampleRate) {
  const count = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 48000
    || count < sampleRate / 10 || count > sampleRate * CAMERA_AUDIO_SECONDS) throw new Error('invalid_camera_audio');
  const bytes = new Uint8Array(44 + count * 2), view = new DataView(bytes.buffer);
  const word = (offset, text) => { for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i); };
  word(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); word(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); word(36, 'data'); view.setUint32(40, count * 2, true);
  let offset = 44;
  for (const chunk of chunks) for (const sample of chunk) { view.setInt16(offset, sample, true); offset += 2; }
  return bytes;
}

function preRollActivity(pcm, sampleRate) {
  const activity = createCameraAudioActivity(), window = Math.round(sampleRate / 10);
  let rms = 0, preRollSpeech = false;
  for (let start = 0; start < pcm.length; start += window) {
    const end = Math.min(start + window, pcm.length);
    let power = 0;
    for (let index = start; index < end; index++) power += (pcm[index] / 32768) ** 2;
    const level = Math.sqrt(power / (end - start));
    rms = Math.max(rms, level);
    if (activity(level, (end - start) / sampleRate * 1000)) preRollSpeech = true;
  }
  return { rms, preRollSpeech };
}

export async function createAstridAudioRecorder({ stream, AudioContextClass, AudioWorkletNodeClass,
  signal, onSample = () => {}, onLimit = () => {}, onError = () => {}, armed = false, preRollMs = CAMERA_AUDIO_PREROLL_MAX_MS }) {
  signal.throwIfAborted();
  if (typeof armed !== 'boolean' || !Number.isInteger(preRollMs) || preRollMs < 0 || preRollMs > CAMERA_AUDIO_PREROLL_MAX_MS) throw new Error('invalid_audio_preroll');
  const context = new AudioContextClass({ sampleRate: 16000 });
  let node, source, stopped = false, total = 0, power = 0, windowCount = 0, recording = !armed;
  let preRollReceived = !armed, preRollSamples = 0, limitReached = false;
  const chunks = [], activity = createCameraAudioActivity();
  function stop(discard = false) {
    if (stopped) return null;
    stopped = true;
    signal.removeEventListener('abort', abort);
    if (node) { node.port.onmessage = null; node.onprocessorerror = null; node.port.postMessage({ type: 'discard' }); node.port.close(); node.disconnect(); }
    source?.disconnect();
    void context.close().catch(() => {});
    try { return discard || total < context.sampleRate / 10 ? null : encodeCameraWav(chunks, context.sampleRate); }
    finally { for (const chunk of chunks) chunk.fill(0); chunks.length = 0; }
  }
  const abort = () => stop(true);
  signal.addEventListener('abort', abort, { once: true });
  try {
    if (!context.audioWorklet || !AudioWorkletNodeClass || context.sampleRate < 8000 || context.sampleRate > 48000) throw new Error('audio_recording_unavailable');
    await context.audioWorklet.addModule('/astrid-camera-audio-worklet.mjs');
    signal.throwIfAborted();
    await context.resume();
    signal.throwIfAborted();
    node = new AudioWorkletNodeClass(context, 'astrid-camera-audio', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: { armed, preRollMs } });
    node.onprocessorerror = () => { stop(true); onError(); };
    node.port.onmessage = ({ data }) => {
      const prefix = data?.type === 'pre-roll';
      const bytes = prefix ? data.pcm : data;
      if (stopped || !(bytes instanceof ArrayBuffer) || bytes.byteLength % 2) return;
      const received = new Int16Array(bytes);
      if (!recording || prefix && (preRollReceived || received.length > context.sampleRate * preRollMs / 1000) || !prefix && !preRollReceived) {
        received.fill(0); return;
      }
      if (prefix) preRollReceived = true;
      const remaining = context.sampleRate * CAMERA_AUDIO_SECONDS - total;
      const pcm = received.subarray(0, Math.max(0, remaining));
      received.subarray(pcm.length).fill(0);
      if (pcm.length) chunks.push(pcm);
      total += pcm.length;
      if (prefix) {
        preRollSamples = pcm.length;
        // Report only whether the buffer held voice-level activity. The owner can
        // start its current silence timer at wake without replaying old pauses.
        onSample({ ...preRollActivity(pcm, context.sampleRate), speaking: false, at: 0 });
        return;
      }
      for (const sample of pcm) power += (sample / 32768) ** 2;
      windowCount += pcm.length;
      if (windowCount >= context.sampleRate / 10) {
        const rms = Math.sqrt(power / windowCount), elapsedMs = windowCount / context.sampleRate * 1000;
        power = 0; windowCount = 0;
        // VAD and camera timing start at wake; buffered pauses are never replayed.
        onSample({ rms, speaking: activity(rms, elapsedMs), at: (total - preRollSamples) / context.sampleRate * 1000 });
      }
      if (!stopped && !limitReached && total >= context.sampleRate * CAMERA_AUDIO_SECONDS) { limitReached = true; onLimit(); }
    };
    source = context.createMediaStreamSource(stream); source.connect(node); node.connect(context.destination);
    return {
      stop,
      activate() {
        if (stopped || recording) return false;
        recording = true;
        node.port.postMessage({ type: 'activate' });
        return true;
      },
      get recording() { return !stopped && recording; },
    };
  } catch (error) { stop(true); throw error; }
}
