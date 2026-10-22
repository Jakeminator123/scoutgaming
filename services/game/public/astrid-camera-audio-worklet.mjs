// Audio stays in memory. This worklet never plays microphone samples.
class AstridCameraAudio extends AudioWorkletProcessor {
  constructor(options = {}) {
    super(); this.samples = 0; this.discarded = false;
    this.armed = options.processorOptions?.armed === true;
    const requested = options.processorOptions?.preRollMs ?? 3000;
    const milliseconds = Number.isFinite(requested) ? Math.max(0, Math.min(3000, requested)) : 0;
    this.ring = this.armed ? new Int16Array(Math.floor(sampleRate * milliseconds / 1000)) : null;
    this.ringWrite = 0; this.ringCount = 0;
    this.port.onmessage = ({ data }) => {
      if (data?.type === 'discard') {
        this.discarded = true; this.ring?.fill(0); this.ring = null; this.ringCount = 0;
      } else if (data?.type === 'activate' && this.armed && !this.discarded) {
        const pcm = new Int16Array(this.ringCount);
        const first = this.ringCount === this.ring.length ? this.ringWrite : 0;
        for (let i = 0; i < pcm.length; i++) pcm[i] = this.ring[(first + i) % this.ring.length];
        this.samples = pcm.length; this.armed = false;
        this.ring.fill(0); this.ring = null; this.ringCount = 0;
        this.port.postMessage({ type: 'pre-roll', pcm: pcm.buffer }, [pcm.buffer]);
      }
    };
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (this.discarded) return false;
    if (!input || this.samples >= sampleRate * 30) return true;
    if (this.armed) {
      for (const sample of input) {
        if (!this.ring.length) break;
        const value = Math.max(-1, Math.min(1, sample));
        this.ring[this.ringWrite] = Math.round(value * (value < 0 ? 32768 : 32767));
        this.ringWrite = (this.ringWrite + 1) % this.ring.length;
        this.ringCount = Math.min(this.ringCount + 1, this.ring.length);
      }
      // No cross-thread audio messages while merely listening for the wake word.
      return true;
    }
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
