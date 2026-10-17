// A single audible H.264/AAC element owns a streamed utterance. Receiving all
// bytes is not playback completion: done resolves only on the video's ended.
const aborted = () => new DOMException('Speech cancelled', 'AbortError');
const MIME = 'video/mp4; codecs="avc1.64002a, mp4a.40.2"';

export class SpeechStreamPlayer {
  constructor(video, { signal, beforePlay = async () => {}, onStart = () => {}, onFirstFrame = () => {},
    onAutoplayBlocked = () => {}, onBinary, maxQueueBytes = 16 * 1024 * 1024 } = {}) {
    Object.assign(this, { video, signal, beforePlay, onStart, onFirstFrame, onAutoplayBlocked, onBinary, maxQueueBytes });
    this.queue = []; this.queuedBytes = 0; this.totalBytes = 0; this.listeners = [];
    this.timings = {};
  }

  listen(target, name, callback, options) {
    target.addEventListener(name, callback, options);
    this.listeners.push(() => target.removeEventListener(name, callback, options));
  }

  async connect(path, ticket) {
    if (this.ws || this.stopped) throw new Error('Create a new stream player per utterance');
    if (this.signal?.aborted) throw aborted();
    if (!globalThis.MediaSource || !MediaSource.isTypeSupported(MIME)) throw new Error('speech_stream_unsupported');
    // Product sessions are admitted by their own authenticated application
    // server. Never forward a ticket to a URL supplied by model output.
    if (path !== '/speech-stream') throw new Error('invalid_speech_stream_url');
    this.connectedAt = performance.now();
    const url = new URL(path, location.origin);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
      throw new Error('speech_stream_requires_secure_transport');
    }
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    this.done = new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
    void this.done.catch(() => {});
    const connected = new Promise((resolve, reject) => { this.connectResolve = resolve; this.connectReject = reject; });
    void connected.catch(() => {});
    this.listen(this.video, 'error', () => this.fail(new Error('speech_stream_decode_failed')));
    this.listen(this.video, 'ended', () => {
      if (this.starting && !this.started && this.receivedDone && this.inputComplete) { this.playbackEnded = true; return; }
      if (!this.started || !this.receivedDone || !this.inputComplete) return this.fail(new Error('speech_stream_ended_early'));
      this.completed = true; this.resolve(this.receivedDone);
    });
    if (this.signal) this.listen(this.signal, 'abort', () => this.fail(aborted()), { once: true });
    try {
      this.ms = new MediaSource();
      this.listen(this.ms, 'sourceopen', () => { this.sourceOpen = true; this.setupBuffer(); }, { once: true });
      this.objectUrl = URL.createObjectURL(this.ms);
      this.video.src = this.objectUrl;
      this.video.muted = false; this.video.playsInline = true;
      this.ws = new WebSocket(url.href, ['astrid-v2', `ticket.${ticket}`]);
      this.ws.binaryType = 'arraybuffer';
      this.listen(this.ws, 'open', () => { this.socketOpenedAt = performance.now();
        this.timings.socket_open_ms = Math.round(this.socketOpenedAt - this.connectedAt); });
      this.listen(this.ws, 'message', event => this.message(event.data));
      this.listen(this.ws, 'error', () => this.fail(new Error('speech_stream_connection_failed')));
      this.listen(this.ws, 'close', () => {
        if (!this.stopped && !this.receivedDone) this.fail(new Error('speech_stream_connection_closed'));
      });
      if (this.signal?.aborted) this.fail(aborted());
    } catch (error) { this.fail(error); }
    return connected;
  }

  message(data) {
    if (this.stopped) return;
    try {
      if (typeof data !== 'string') {
        if (!(data instanceof ArrayBuffer) || !data.byteLength || !this.mime || this.receivedDone) throw new Error('speech_stream_unexpected_media');
        if (this.timings.first_media_ms === undefined) {
          const now = performance.now();
          this.timings.first_media_ms = Math.round(now - this.connectedAt);
          if (this.socketOpenedAt) this.timings.socket_to_media_ms = Math.round(now - this.socketOpenedAt);
        }
        this.queuedBytes += data.byteLength; this.totalBytes += data.byteLength;
        if (this.queuedBytes > this.maxQueueBytes || this.totalBytes > 128 * 1024 * 1024) throw new Error('speech_stream_too_large');
        // Optional per-play QA observation sees a copy of the exact accepted
        // packet. It cannot replace or mutate bytes passed to the decoder.
        this.onBinary?.({ bytes: data.slice(0), player: this });
        this.queue.push(data); this.pump(); return;
      }
      const message = JSON.parse(data);
      if (message.t === 'ready' && !this.id && message.protocol === 2 && typeof message.id === 'string'
        && /^[A-Za-z0-9._:-]{1,128}$/.test(message.id)) {
        this.id = message.id; this.connectResolve(this); this.connectResolve = this.connectReject = null;
      } else if (!this.id || message.id !== this.id) throw new Error('speech_stream_id_mismatch');
      else if (message.t === 'stream' && !this.mime && message.mime === MIME) {
        this.mime = message.mime; this.setupBuffer();
      } else if (message.t === 'done' && !this.receivedDone) {
        if (message.aborted) throw aborted();
        if (!this.mime || !Number.isSafeInteger(message.frames) || message.frames < 1 || message.frames > 624) throw new Error('speech_stream_invalid_completion');
        this.receivedDone = message; this.pump();
      } else if (message.t === 'error') throw new Error('speech_stream_generation_failed');
      else throw new Error('speech_stream_invalid_message');
    } catch (error) { this.fail(error); }
  }

  setupBuffer() {
    if (!this.mime || !this.sourceOpen || this.sb || this.stopped) return;
    try {
      this.sb = this.ms.addSourceBuffer(this.mime);
      this.listen(this.sb, 'error', () => this.fail(new Error('speech_stream_decode_failed')));
      this.listen(this.sb, 'updateend', () => {
        if (this.stopped) return;
        if (this.sb.buffered.length && this.sb.buffered.end(this.sb.buffered.length - 1) > 26.5) return this.fail(new Error('speech_stream_too_long'));
        if (!this.starting && this.sb.buffered.length && this.sb.buffered.end(0) > 0) {
          this.starting = true;
          void this.start().catch(error => this.fail(error));
        }
        this.pump();
      });
      this.pump();
    } catch (error) { this.fail(error); }
  }

  async start() {
    await this.beforePlay();
    if (this.stopped || this.signal?.aborted) throw aborted();
    if (this.video.requestVideoFrameCallback) this.frame = this.video.requestVideoFrameCallback((_, info) => {
      this.frame = null;
      if (!this.stopped) {
        this.timings.first_visible_frame_ms = Math.round(performance.now() - this.connectedAt);
        this.onFirstFrame(info);
      }
    });
    try { await this.video.play(); }
    catch (cause) {
      if (this.stopped || this.signal?.aborted) throw aborted();
      const error = new Error('speech_autoplay_blocked', { cause });
      this.onAutoplayBlocked(error);
      throw error;
    }
    if (this.stopped || this.signal?.aborted) throw aborted();
    this.started = true;
    this.timings.first_playing_ms = Math.round(performance.now() - this.connectedAt);
    if (!this.video.requestVideoFrameCallback) {
      this.timings.first_visible_frame_ms = this.timings.first_playing_ms;
      this.onFirstFrame({ evidence: 'media-playing' });
    }
    this.onStart();
    // Very short streams can already have ended when the play promise settles.
    if ((this.video.ended || this.playbackEnded) && this.receivedDone && this.inputComplete) {
      this.completed = true; this.resolve(this.receivedDone);
    }
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
      } else if (this.receivedDone && !this.inputComplete) {
        if (!this.totalBytes || !this.starting) throw new Error('speech_stream_empty');
        this.inputComplete = true; this.ms.endOfStream();
      }
    } catch (error) { this.fail(error); }
  }

  fail(error) {
    if (this.stopped) return;
    this.connectReject?.(error); this.reject?.(error); this.abort(error);
  }

  abort(error = aborted()) {
    if (this.stopped) return;
    this.stopped = true;
    if (!this.completed) { this.connectReject?.(error); this.reject?.(error); }
    if (this.ws?.readyState === WebSocket.OPEN && !this.receivedDone) {
      try { this.ws.send(JSON.stringify({ t: 'abort', id: this.id })); } catch {}
    }
    this.ws?.close();
    for (const remove of this.listeners.splice(0)) remove();
    if (this.frame != null) this.video.cancelVideoFrameCallback?.(this.frame);
    this.queue = []; this.queuedBytes = 0;
    try { if (this.sb?.updating) this.sb.abort(); } catch {}
    this.video.pause(); this.video.removeAttribute('src'); this.video.load();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }
}
