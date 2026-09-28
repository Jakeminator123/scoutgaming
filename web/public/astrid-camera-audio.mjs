export const CAMERA_AUDIO_SECONDS = 30;
export const CAMERA_AUDIO_MAX_BYTES = 44 + 48000 * 2 * CAMERA_AUDIO_SECONDS;

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

export async function createAstridAudioRecorder({ stream, AudioContextClass, AudioWorkletNodeClass,
  signal, onSample = () => {}, onLimit = () => {}, onError = () => {} }) {
  signal.throwIfAborted();
  const context = new AudioContextClass({ sampleRate: 16000 });
  let node, source, stopped = false, total = 0, power = 0, windowCount = 0;
  const chunks = [], activity = createCameraAudioActivity();
  function stop(discard = false) {
    if (stopped) return null;
    stopped = true;
    signal.removeEventListener('abort', abort);
    if (node) { node.port.onmessage = null; node.onprocessorerror = null; node.port.close(); node.disconnect(); }
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
    node = new AudioWorkletNodeClass(context, 'astrid-camera-audio', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    node.onprocessorerror = () => { stop(true); onError(); };
    node.port.onmessage = ({ data }) => {
      if (stopped || !(data instanceof ArrayBuffer) || data.byteLength % 2) return;
      const received = new Int16Array(data), remaining = context.sampleRate * CAMERA_AUDIO_SECONDS - total;
      const pcm = received.subarray(0, Math.max(0, remaining));
      chunks.push(pcm); total += pcm.length;
      for (const sample of pcm) power += (sample / 32768) ** 2;
      windowCount += pcm.length;
      if (windowCount >= context.sampleRate / 10) {
        const rms = Math.sqrt(power / windowCount), elapsedMs = windowCount / context.sampleRate * 1000;
        power = 0; windowCount = 0;
        onSample({ rms, speaking: activity(rms, elapsedMs), at: total / context.sampleRate * 1000 });
      }
      if (!stopped && total >= context.sampleRate * CAMERA_AUDIO_SECONDS) onLimit();
    };
    source = context.createMediaStreamSource(stream); source.connect(node); node.connect(context.destination);
    return { stop };
  } catch (error) { stop(true); throw error; }
}
