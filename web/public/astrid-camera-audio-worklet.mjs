// Audio stays in memory. This worklet never plays microphone samples.
class AstridCameraAudio extends AudioWorkletProcessor {
  constructor() { super(); this.samples = 0; }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input || this.samples >= sampleRate * 30) return true;
    const length = Math.min(input.length, sampleRate * 30 - this.samples);
    const pcm = new Int16Array(length);
    for (let i = 0; i < length; i++) {
      const value = Math.max(-1, Math.min(1, input[i]));
      pcm[i] = Math.round(value * (value < 0 ? 32768 : 32767));
    }
    this.samples += length;
    this.port.postMessage(pcm.buffer, [pcm.buffer]);
    return true;
  }
}
registerProcessor('astrid-camera-audio', AstridCameraAudio);
