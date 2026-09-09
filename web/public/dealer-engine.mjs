// WebCodecs clip-splice dealer engine.
// Consumes streams/index.json ({codec,width,height,clips:{key:{file,fps,frameCount,frames:[[off,size]]}}})
// where each clip is a raw Annex-B .h264 elementary stream with one IDR at frame 0.
// Clips all start and end on the canonical pose, so any clip can follow any
// other at a clip boundary with no blending. We own the clock: chunks get
// self-assigned monotonic timestamps and fragment/container timing never exists.

import {createActorCompositor} from './actor-compositor.mjs';

export class DealerEngine {
  constructor(canvas, assetBase, { log = () => {}, handsCanvas = null, actorMatteBase = null, handsCut = .878 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.assetBase = assetBase;
    this.actorMatteBase=actorMatteBase;this.handsCut=handsCut;
    this.log = log;
    this.buffers = new Map();   // clipKey -> ArrayBuffer (whole stream)
    this.queue = [];            // pending action clip keys
    this.display = [];          // decoded VideoFrames waiting for presentation
    this.frameTags = new Map();
    this.handsFrameTags = new Map();
    this.requestSequence = 0;
    this.frameListeners = new Set();
    this.presentation = null;
    this.ts = 0;                // monotonic self-assigned timestamp (us)
    this.running = false;
    this.currentClip = null;
    this.stats = { decoded: 0, submitted: 0, errors: 0, splices: 0 };
    this.onIdlePick = null;     // optional idle-selection hook
    this.onPresentClip = null;  // fires when a clip's first frame is actually painted
    this.presentedClip = null;
    this.decodingClip = null;
    // hands layer: a per-clip matte track (streams-hands) says which pixels of
    // the frame's bottom band sit below the table rail; those are re-painted
    // onto handsCanvas, which the page stacks ABOVE the table art, so her
    // forearms rest ON the felt instead of vanishing behind it.
    this.handsCanvas = handsCanvas;
    this.handsIndex = null;
    this.handsBuffers = new Map();
    this.handsDisplay = [];
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
    await this.initHands();
    this.log(`engine ready: ${Object.keys(this.index.clips).length} clips, ${this.index.codec}`
      + (this.handsIndex ? `, hands matte on (${Object.keys(this.handsIndex.clips).length} clips)` : ''));
  }

  // The hands layer is strictly optional: no matte index (or no SVG-filter
  // support for luma->alpha) just means arms stay behind the table, as before.
  async initHands() {
    if (!this.handsCanvas) return;
    try {
      const res = await fetch(`${this.actorMatteBase??this.assetBase+'-hands'}/streams/index.json`);
      if (!res.ok) return;
      this.handsIndex = await res.json();
    } catch { return; }
    const hc = { codec: this.handsIndex.codec, optimizeForLatency: true };
    if (!(await VideoDecoder.isConfigSupported(hc)).supported) { this.handsIndex = null; return; }
    this.handsConfig = hc;
    this.fullActor=!!this.actorMatteBase&&this.handsIndex.fullActor===true;
    if(this.fullActor&&Object.entries(this.index.clips).some(([key,clip])=>this.handsIndex.clips[key]?.frameCount!==clip.frameCount))throw new Error('Actor matte coverage does not match the speech frames');
    // stacked track: frame = [band content | alpha] vertically; content and
    // alpha come from the SAME decoded frame, so they can never drift apart.
    // Legacy matte-only track: frame = alpha, content is cut from the main
    // frame at paint time.
    this.handsStacked = !!this.handsIndex.stacked;
    this.bandH = this.fullActor?Math.round(this.index.height*(1-this.handsCut)):(this.handsStacked ? this.handsIndex.height / 2 : this.handsIndex.height);
    this.handsCanvas.width = this.handsIndex.width;
    this.handsCanvas.height = this.bandH;
    this.handsCtx = this.handsCanvas.getContext('2d');
    this.bandY = this.index.height - this.bandH; // band is bottom-anchored
    this.matte = document.createElement('canvas');
    this.matte.width = this.handsIndex.width;
    this.matte.height = this.fullActor?this.index.height:this.bandH;
    this.matteCtx = this.matte.getContext('2d');
    if(this.fullActor)this.actorCompositor=createActorCompositor(this.index.width,this.index.height);
    else this.matteCtx.filter = 'url(#luma-alpha)';
    if (!this.fullActor && this.matteCtx.filter === 'none') { // legacy browser can't do SVG canvas filters
      this.log('hands matte off: no SVG filter support');
      this.handsIndex = null;
      this.fullActor = false;
      return;
    }
    this.handsDecoder = this.makeHandsDecoder();
  }

  makeHandsDecoder() {
    const d = new VideoDecoder({
      output: f => {
        const key = this.handsFrameTags.get(f.timestamp);
        this.handsFrameTags.delete(f.timestamp);
        if (!key) { f.close(); return; }
        this.handsDisplay.push({ f, key });
      },
      error: e => { this.stats.errors++; this.decoderDead = true; console.error('[dealer] hands decoder error:', e.message); },
    });
    d.configure(this.handsConfig);
    return d;
  }

  // A VideoDecoder that errors is closed for good; the feeder swaps in a fresh
  // one and restarts at the next clip boundary (frame 0 is always an IDR).
  makeDecoder() {
    const d = new VideoDecoder({
      output: f => {
        const tag = this.frameTags.get(f.timestamp);
        this.frameTags.delete(f.timestamp);
        if (!tag) { f.close(); return; }
        this.stats.decoded++; this.display.push({ f, ...tag });
      },
      error: e => { this.stats.errors++; this.decoderDead = true; console.error('[dealer] decoder error:', e.message); },
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
    if(this.fullActor)await this.checkActorHash(buf,this.handsIndex.clips[key]?.sha256,'speech source');
    this.buffers.set(key, buf);
    return buf;
  }

  async fetchHandsClip(key) {
    if (this.handsBuffers.has(key)) return this.handsBuffers.get(key);
    const meta = this.handsIndex?.clips[key];
    if (!meta) return null;
    const res = await fetch(`${this.actorMatteBase??this.assetBase+'-hands'}/streams/${meta.file}`);
    if (!res.ok) throw new Error(`hands clip ${key}: HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    if(this.fullActor)await this.checkActorHash(buf,meta.matteSha256,'actor mask');
    this.handsBuffers.set(key, buf);
    return buf;
  }

  async checkActorHash(bytes,expected,label){
    const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
    if(actual!==expected)throw new Error(`Astrid ${label} differs from its paired asset`);
  }

  waitForFrame(key, frame, { afterCycle = -1, timeoutMs = 9000 } = {}) {
    const matches = p => p?.key === key && p.frame >= frame && p.cycle > afterCycle;
    if (matches(this.presentation)) return Promise.resolve(this.presentation);
    return new Promise(resolve => {
      const done = value => { clearTimeout(timer); this.frameListeners.delete(listener); resolve(value); };
      const listener = p => { if (matches(p)) done(p); };
      const timer = setTimeout(() => done(null), timeoutMs);
      this.frameListeners.add(listener);
    });
  }

  // Queue an action clip; it plays at the next clip boundary.
  trigger(key) {
    if (!this.index.clips[key]) { this.log(`trigger ignored, unknown clip: ${key}`); return; }
    this.queue.push({ key, request: 0 });
    void this.fetchClip(key); // warm the cache before the boundary arrives
    if (this.handsIndex?.clips[key]) void this.fetchHandsClip(key);
  }

  // Cut to a clip NOW: abandon the current clip and flush buffered frames.
  // Every clip starts on an IDR so a mid-clip cut is legal; visually it is a
  // hard cut within the same pose family. Used for speech, where audio and
  // lips must start together.
  interrupt(key) {
    if (!this.index.clips[key]) return;
    const request = ++this.requestSequence;
    this.queue = [{ key, request }];
    this.cut = true;
    void this.fetchClip(key);
    if (this.handsIndex?.clips[key]) void this.fetchHandsClip(key);
    return request;
  }

  nextClip() {
    if (this.queue.length) return this.queue.shift();
    if (this.onIdlePick) return { key: this.onIdlePick(), request: 0 };
    return { key: this.clipKeys()[0], request: 0 };
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
            for (const d of this.display.splice(0)) d.f.close();
            this.decoder = this.makeDecoder();
            if (this.handsDecoder) {
              try { this.handsDecoder.close(); } catch { /* already closed */ }
              for (const d of this.handsDisplay.splice(0)) d.f.close();
              this.handsDecoder = this.makeHandsDecoder();
            }
            this.decoderDead = false;
            cur = null; // restart cleanly on an IDR
          }
          if (this.cut) {
            this.cut = false;
            cur = null;
            this.decoder.reset(); this.decoder.configure(this.config);
            this.frameTags.clear(); this.handsFrameTags.clear();
            if (this.handsDecoder) { this.handsDecoder.reset(); this.handsDecoder.configure(this.handsConfig); }
            this.handsCtx?.clearRect(0, 0, this.handsCanvas.width, this.handsCanvas.height);
            for (const d of this.display.splice(0)) d.f.close();
            for (const d of this.handsDisplay.splice(0)) d.f.close();
          }
          const buffered = this.display.length + this.decoder.decodeQueueSize;
          if (buffered >= 24) { await new Promise(r => setTimeout(r, 40)); continue; }
          if (!cur || cur.i >= cur.meta.frames.length) {
            const { key, request } = this.nextClip();
            cur = { key, request, meta: this.index.clips[key], buf: await this.fetchClip(key), i: 0, cycle: this.ts };
            // matte rides along frame-for-frame when this clip has one; a
            // missing matte file must not wedge the feeder, the clip just
            // plays without the hands layer
            cur.hands = null;
            if (this.handsIndex?.clips[key]) {
              try { cur.hands = { meta: this.handsIndex.clips[key], buf: await this.fetchHandsClip(key) }; }
              catch (e) { if(this.fullActor)throw e;this.log(`hands clip ${key} unavailable: ${e.message}`); }
            }
            this.stats.splices++;
            this.currentClip = key;
            this.decodingClip = key;
          }
          const [off, size] = cur.meta.frames[cur.i];
          this.frameTags.set(this.ts, { key: cur.key, first: cur.i === 0, request: cur.request, frame: cur.i, cycle: cur.cycle });
          this.decoder.decode(new EncodedVideoChunk({
            type: cur.i === 0 ? 'key' : 'delta',
            timestamp: this.ts,
            data: new Uint8Array(cur.buf, off, size),
          }));
          if (cur.hands && cur.i < cur.hands.meta.frames.length) {
            const [hoff, hsize] = cur.hands.meta.frames[cur.i];
            this.handsDecodingClip = this.decodingClip;
            this.handsFrameTags.set(this.ts, cur.key);
            this.handsDecoder.decode(new EncodedVideoChunk({
              type: cur.i === 0 ? 'key' : 'delta',
              timestamp: this.ts,
              data: new Uint8Array(cur.hands.buf, hoff, hsize),
            }));
          }
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
    // rAF stops in hidden/occluded tabs, which freezes the canvas and parks the
    // decoder at the buffer cap (reads as "engine dead" to any headless audit).
    // A low-rate interval watchdog keeps frames moving whenever rAF stalls.
    let next = performance.now();
    let lastRaf = performance.now();
    const drain = () => {
      const now = performance.now();
      while (now >= next && this.display.length) {
        if(this.fullActor){
          const pending=this.display[0];
          while(this.handsDisplay.length&&this.handsDisplay[0].f.timestamp<pending.f.timestamp)this.handsDisplay.shift().f.close();
          // Never paint a background-bearing RGB frame without its exact mask.
          if(!this.handsDisplay.length||this.handsDisplay[0].f.timestamp!==pending.f.timestamp)break;
        }
        const { f, key, first, request, frame, cycle } = this.display.shift();
        // a splice is a hard cut within the pose family; a ~200ms crossfade
        // hides the residual micro-pose jump (worst on speech interrupts,
        // invisible on well-matched boundaries)
        if (!this.fullActor && key && key !== this.presentedClip && this.presentedClip) {
          if (!this.fadeCanvas) {
            this.fadeCanvas = document.createElement('canvas');
            this.fadeCanvas.width = this.canvas.width;
            this.fadeCanvas.height = this.canvas.height;
          }
          this.fadeCanvas.getContext('2d').drawImage(this.canvas, 0, 0);
          this.fadeTicks = 5;
        }
        this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
        this.ctx.drawImage(f, 0, 0, this.canvas.width, this.canvas.height);
        if (this.fadeTicks > 0) {
          this.ctx.globalAlpha = this.fadeTicks / 6;
          this.ctx.drawImage(this.fadeCanvas, 0, 0);
          this.ctx.globalAlpha = 1;
          this.fadeTicks--;
        }
        this.presentHands(f, key);
        this.presentation = { key, frame, cycle, request };
        for (const listener of [...this.frameListeners]) listener(this.presentation);
        f.close();
        // presentedClip is the truth for anything that must line up with what
        // the viewer can actually see - audio, above all
        if (key && (first || key !== this.presentedClip)) {
          this.presentedClip = key;
          this.onPresentClip?.(key, request);
        }
        this.stats.presented = (this.stats.presented ?? 0) + 1;
        next += 1000 / 24;
      }
      if (now - next > 500) next = now; // fell behind badly; resync
    };
    const present = () => {
      if (!this.running) return;
      lastRaf = performance.now();
      drain();
      requestAnimationFrame(present);
    };
    requestAnimationFrame(present);
    this.watchdog = setInterval(() => {
      if (!this.running) { clearInterval(this.watchdog); return; }
      if (performance.now() - lastRaf > 400) drain(); // rAF throttled; keep alive
    }, 500);
    // heartbeat so a silent stall is visible in any console capture
    this.heartbeat = setInterval(() => {
      if (!this.running) { clearInterval(this.heartbeat); return; }
      const d = this.stats.decoded - (this.lastDecoded ?? 0);
      this.lastDecoded = this.stats.decoded;
      const wedged = d === 0 && (this.decoder?.decodeQueueSize ?? 0) > 0 && this.display.length === 0;
      if (d === 0) console.warn(`[dealer] STALLED: 0 frames decoded in 5s (display=${this.display.length}, queue=${this.decoder?.decodeQueueSize}, errors=${this.stats.errors})`);
      if (wedged) {
        // decoder accepted chunks but never emits and never errors: rebuild it
        this.stalls = (this.stalls ?? 0) + 1;
        if (this.stalls >= 2) { console.warn('[dealer] wedged decoder - rebuilding'); this.decoderDead = true; this.stalls = 0; }
      } else this.stalls = 0;
    }, 5000);
  }

  // Repaint the hands band for the main frame just presented: person pixels
  // below the rail (matte alpha) drawn from the SAME frame, on the canvas the
  // page stacks above the table art. Matte and main are fed 1:1, so pairing is
  // positional; a missing twin just leaves last frame's band for 1/24 s.
  presentHands(f, key) {
    if (!this.handsIndex) return;
    if (!this.handsIndex.clips[key]) {
      const { width, height } = this.handsCanvas;
      this.handsCtx.clearRect(0, 0, width, height);
      return;
    }
    while (this.handsDisplay.length && this.handsDisplay[0].f.timestamp < f.timestamp)
      this.handsDisplay.shift().f.close();
    if (!this.handsDisplay.length || this.handsDisplay[0].f.timestamp !== f.timestamp || this.handsDisplay[0].key !== key) {
      this.handsCtx.clearRect(0, 0, this.handsCanvas.width, this.handsCanvas.height);
      return;
    }
    const m = this.handsDisplay.shift();
    const { width, height } = this.handsCanvas;
    if(this.fullActor){
      this.actorCompositor.paint(this.canvas,m.f);
      this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);this.ctx.drawImage(this.actorCompositor.canvas,0,0);
      this.handsCtx.clearRect(0,0,width,height);
      this.handsCtx.drawImage(this.canvas,0,this.bandY,width,height,0,0,width,height);
      m.f.close();return;
    }
    this.matteCtx.clearRect(0, 0, width, height);
    // alpha strip: whole frame (legacy) or the frame's bottom half (stacked)
    this.matteCtx.drawImage(m.f, 0, this.handsStacked ? height : 0, width, height,
      0, 0, width, height); // ctx.filter turns luma into alpha
    this.handsCtx.clearRect(0, 0, width, height);
    if (this.handsStacked) {
      // content strip carries its own baked band (video felt apron + arms)
      this.handsCtx.drawImage(m.f, 0, 0, width, height, 0, 0, width, height);
    } else {
      this.handsCtx.drawImage(f, 0, this.bandY, width, height, 0, 0, width, height);
    }
    m.f.close();
    this.handsCtx.globalCompositeOperation = 'destination-in';
    this.handsCtx.drawImage(this.matte, 0, 0);
    this.handsCtx.globalCompositeOperation = 'source-over';
  }

  stop() {
    this.running = false;
    this.actorCompositor?.dispose();this.actorCompositor=null;
    for (const { f } of this.display.splice(0)) f.close();
    for (const { f } of this.handsDisplay.splice(0)) f.close();
    this.frameTags.clear(); this.handsFrameTags.clear();
    clearInterval(this.watchdog);
  }
}
