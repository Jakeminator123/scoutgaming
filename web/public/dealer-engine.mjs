// WebCodecs clip-splice dealer engine.
// Consumes streams/index.json ({codec,width,height,clips:{key:{file,fps,frameCount,frames:[[off,size]]}}})
// where each clip is a raw Annex-B .h264 elementary stream with one IDR at frame 0.
// Clips all start and end on the canonical pose, so any clip can follow any
// other at a clip boundary with no blending. We own the clock: chunks get
// self-assigned monotonic timestamps and fragment/container timing never exists.

export class DealerEngine {
  constructor(canvas, assetBase, { log = () => {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.assetBase = assetBase;
    this.log = log;
    this.buffers = new Map();   // clipKey -> ArrayBuffer (whole stream)
    this.queue = [];            // pending action clip keys
    this.display = [];          // decoded VideoFrames waiting for presentation
    this.ts = 0;                // monotonic self-assigned timestamp (us)
    this.running = false;
    this.currentClip = null;
    this.stats = { decoded: 0, submitted: 0, errors: 0, splices: 0 };
    this.onIdlePick = null;     // optional idle-selection hook
  }

  async init() {
    const res = await fetch(`${this.assetBase}/streams/index.json`);
    if (!res.ok) throw new Error(`streams index: HTTP ${res.status}`);
    this.index = await res.json();
    this.frameUs = Math.round(1e6 / 24);
    this.canvas.width = this.index.width;
    this.canvas.height = this.index.height;
    if (typeof VideoDecoder === 'undefined') throw new Error('WebCodecs VideoDecoder unavailable');
    // No description => Annex-B mode; SPS/PPS ride in-band on the IDR AU.
    this.config = { codec: this.index.codec, optimizeForLatency: true };
    const support = await VideoDecoder.isConfigSupported(this.config);
    if (!support.supported) throw new Error(`codec ${this.index.codec} unsupported`);
    this.decoder = this.makeDecoder();
    this.log(`engine ready: ${Object.keys(this.index.clips).length} clips, ${this.index.codec}`);
  }

  // A VideoDecoder that errors is closed for good; the feeder swaps in a fresh
  // one and restarts at the next clip boundary (frame 0 is always an IDR).
  makeDecoder() {
    const d = new VideoDecoder({
      output: f => { this.stats.decoded++; this.display.push(f); },
      error: e => { this.stats.errors++; this.decoderDead = true; this.log(`decoder error: ${e.message}`); },
    });
    d.configure(this.config);
    return d;
  }

  clipKeys() { return Object.keys(this.index.clips); }

  async fetchClip(key) {
    if (this.buffers.has(key)) return this.buffers.get(key);
    const meta = this.index.clips[key];
    if (!meta) throw new Error(`unknown clip: ${key}`);
    const res = await fetch(`${this.assetBase}/streams/${meta.file}`);
    if (!res.ok) throw new Error(`clip ${key}: HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    this.buffers.set(key, buf);
    return buf;
  }

  // Queue an action clip; it plays at the next clip boundary.
  trigger(key) {
    if (!this.index.clips[key]) { this.log(`trigger ignored, unknown clip: ${key}`); return; }
    this.queue.push(key);
    void this.fetchClip(key); // warm the cache before the boundary arrives
  }

  nextClip() {
    if (this.queue.length) return this.queue.shift();
    if (this.onIdlePick) return this.onIdlePick();
    return this.clipKeys()[0];
  }

  async start() {
    this.running = true;
    // Feeder: frame cursor across clip boundaries. VideoFrames are scarce GPU
    // resources, so keep at most ~24 in flight instead of whole clips.
    let cur = null; // { meta, buf, i }
    const feed = async () => {
      while (this.running) {
        try {
          if (this.decoderDead) {
            try { this.decoder.close(); } catch { /* already closed */ }
            for (const f of this.display.splice(0)) f.close();
            this.decoder = this.makeDecoder();
            this.decoderDead = false;
            cur = null; // restart cleanly on an IDR
          }
          const buffered = this.display.length + this.decoder.decodeQueueSize;
          if (buffered >= 24) { await new Promise(r => setTimeout(r, 40)); continue; }
          if (!cur || cur.i >= cur.meta.frames.length) {
            const key = this.nextClip();
            cur = { meta: this.index.clips[key], buf: await this.fetchClip(key), i: 0 };
            this.stats.splices++;
            this.currentClip = key;
          }
          const [off, size] = cur.meta.frames[cur.i];
          this.decoder.decode(new EncodedVideoChunk({
            type: cur.i === 0 ? 'key' : 'delta',
            timestamp: this.ts,
            data: new Uint8Array(cur.buf, off, size),
          }));
          cur.i++;
          this.ts += this.frameUs;
          this.stats.submitted++;
        } catch (err) {
          // fetch failure, decode-on-closed, anything: log, back off, try again
          this.stats.errors++;
          this.log(`feeder recovering: ${err.message}`);
          cur = null;
          await new Promise(r => setTimeout(r, 600));
        }
      }
    };
    void feed();
    // Presenter: fixed 24 fps cadence off performance.now, drift-corrected.
    let next = performance.now();
    const present = () => {
      if (!this.running) return;
      const now = performance.now();
      while (now >= next && this.display.length) {
        const f = this.display.shift();
        this.ctx.drawImage(f, 0, 0, this.canvas.width, this.canvas.height);
        f.close();
        next += 1000 / 24;
      }
      if (now - next > 500) next = now; // fell behind badly; resync
      requestAnimationFrame(present);
    };
    requestAnimationFrame(present);
  }

  stop() {
    this.running = false;
    for (const f of this.display.splice(0)) f.close();
  }
}
