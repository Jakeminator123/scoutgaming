/** Reference MSE player, one instance per utterance. The fMP4 contains both AAC
 * and H264: never play the original TTS audio alongside this element.
 * Start from a user gesture or supply onAutoplayBlocked to show a Play button.
 */
export class SpeechStreamPlayer {
  constructor(video, { maxQueueBytes = 16 * 1024 * 1024, onAutoplayBlocked = () => {}, onFirstFrame = () => {} } = {}) {
    this.video = video;
    this.maxQueueBytes = maxQueueBytes;
    this.onAutoplayBlocked = onAutoplayBlocked;
    this.onFirstFrame = onFirstFrame;
    this.queue = []; this.queuedBytes = 0; this.stopped = false;
  }

  async connect(url, ticket, { receiveOnly = true, rate = 24000 } = {}) {
    if (this.ws || this.stopped) throw new Error('Create a new player per utterance');
    if (!globalThis.MediaSource) throw new Error('MediaSource is unsupported in this browser');
    if (!/^wss:/.test(url) && !/^ws:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(url)) throw new Error('Use secure WebSocket transport');
    this.done = new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
    // Caller can await done later without an unhandled rejection in the meantime.
    this.done.catch(() => {});
    this.ms = new MediaSource();
    this.objectUrl = URL.createObjectURL(this.ms);
    this.video.src = this.objectUrl;
    this.ws = new WebSocket(url, ['astrid-v2', `ticket.${ticket}`]);
    this.ws.binaryType = 'arraybuffer';
    this.receiveOnly = receiveOnly;
    return new Promise((resolve, reject) => {
      this.connectReject = reject;
      this.ms.addEventListener('sourceopen', () => { this.sourceOpen = true; this.setupBuffer(); }, { once: true });
      this.ws.addEventListener('message', event => {
        if (this.stopped) return;
        try {
          if (typeof event.data !== 'string') {
            if (!this.mime || this.receivedDone) throw new Error('Unexpected media');
            this.queuedBytes += event.data.byteLength;
            if (this.queuedBytes > this.maxQueueBytes) throw new Error('Playback queue exceeded');
            this.queue.push(event.data); this.pump(); return;
          }
          const m = JSON.parse(event.data);
          if (m.t === 'ready' && !this.id) {
            this.id = m.id; if (!receiveOnly) this.send({ t: 'start', protocol: 2, rate }); resolve(this); this.connectReject = null;
          } else if (m.id !== this.id) throw new Error('Unexpected stream id');
          else if (m.t === 'stream' && !this.mime) {
            if (!MediaSource.isTypeSupported(m.mime)) throw new Error(`Unsupported media type: ${m.mime}`);
            this.mime = m.mime; this.setupBuffer();
          } else if (m.t === 'done') { this.receivedDone = m; this.pump(); }
          else if (m.t === 'error') throw new Error(m.error || 'Speech generation failed');
          else throw new Error('Unexpected server message');
        } catch (error) { this.fail(error); }
      });
      this.ws.addEventListener('error', () => this.fail(new Error('Speech connection failed')));
      this.ws.addEventListener('close', () => { if (!this.stopped && !this.receivedDone) this.fail(new Error('Speech connection closed before completion')); });
    });
  }

  setupBuffer() {
    if (!this.mime || !this.sourceOpen || this.sb || this.stopped) return;
    try {
      this.sb = this.ms.addSourceBuffer(this.mime);
      this.sb.addEventListener('error', () => this.fail(new Error('Invalid or unsupported MP4 stream')));
      this.sb.addEventListener('updateend', () => {
        if (!this.playStarted && this.sb.buffered.length && this.sb.buffered.end(0) > 0) {
          this.playStarted = true;
          if (this.video.requestVideoFrameCallback) this.video.requestVideoFrameCallback((_, info) => this.onFirstFrame(info));
          this.video.play().catch(error => this.onAutoplayBlocked(error));
        }
        this.pump();
      });
      this.pump();
    } catch (error) { this.fail(error); }
  }

  pump() {
    if (this.stopped || !this.sb || this.sb.updating || this.ms.readyState !== 'open') return;
    try {
      const cutoff = this.video.currentTime - 10;
      if (cutoff > 0 && this.sb.buffered.length && this.sb.buffered.start(0) < cutoff - 1) {
        this.sb.remove(0, cutoff); return;
      }
      if (this.queue.length) {
        const next = this.queue.shift(); this.queuedBytes -= next.byteLength;
        this.sb.appendBuffer(next);
      } else if (this.receivedDone && !this.completed) {
        this.completed = true; this.ms.endOfStream(); this.resolve(this.receivedDone);
      }
    } catch (error) { this.fail(error); }
  }

  send(message) {
    if (this.stopped || this.ws?.readyState !== WebSocket.OPEN) throw new Error('Speech connection is not open');
    this.ws.send(JSON.stringify(message));
  }

  async writePCM(bytes) {
    if (this.receiveOnly) throw new Error('PCM is supplied by the application server');
    if (this.inputEnded || this.stopped) throw new Error('Audio input is closed');
    const chunk = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (chunk.byteLength % 2) throw new Error('PCM16 must have an even number of bytes');
    // Bound each WebSocket message and respect browser backpressure. Caller must
    // await writes, rather than dispatching the entire utterance concurrently.
    for (let offset = 0; offset < chunk.byteLength; offset += 65536) {
      const deadline = Date.now() + 10000;
      while (this.ws?.bufferedAmount > 512 * 1024) {
        if (Date.now() > deadline || this.stopped || this.ws.readyState !== WebSocket.OPEN) throw new Error('Audio upload stalled');
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      if (this.ws?.readyState !== WebSocket.OPEN || this.stopped) throw new Error('Speech connection is not open');
      this.ws.send(chunk.subarray(offset, offset + 65536));
    }
  }

  endInput() { if (this.receiveOnly) throw new Error('PCM is supplied by the application server'); this.send({ t: 'end' }); this.inputEnded = true; }

  fail(error) { this.connectReject?.(error); this.reject?.(error); this.abort(); }

  abort() {
    if (this.stopped) return;
    this.stopped = true;
    if (!this.completed) { const error = new Error('Playback cancelled'); this.connectReject?.(error); this.reject?.(error); }
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: 'abort', id: this.id }));
    this.ws?.close();
    this.queue = []; this.queuedBytes = 0;
    try { if (this.sb?.updating) this.sb.abort(); } catch {}
    this.video.pause(); this.video.removeAttribute('src'); this.video.load();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }
}
