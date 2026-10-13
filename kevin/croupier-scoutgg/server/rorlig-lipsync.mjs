// Lip sync on the dealer's MOVING clips (Emil 12 Oct, staging): a ready dealer says his recorded lines WHILE he deals,
// instead of stopping for each line. His mouth is a layer over the clips that play anyway: for every frame of a line the
// GPU worker returns a small mouth patch tagged with the take and frame it belongs to, and the client draws a patch only
// when that take and frame is the one on screen. The game never waits for it: without a warm worker the plan keeps
// today's speech steps.
//
// Worker: RunPod Serverless endpoint croupier-lipsync-staging (github.com/EmaCodeHero/croupier-lipsync-worker), one
// image for every dealer. Like serverless.mjs we order a "session" job; the worker dials /lipsync-rorlig back and stays
// while the dealer's tables are in use (renewed before its ttl, released after inactivity).
//
// Protocol (worker/motor.py): → {t:'start', id, karta:[[take, firstFrame, count], …], ljud_url} → {t:'end', id}
// ← {t:'lapp', id, del, fran, till, rutor:[{tagning, ruta, rect}|null…]} + raw H.264 (Annex B, 256×512) per 0.5 s
// ← {t:'done', id, …} | {t:'error', id, reason}. Patch k belongs to the map's frame k; the line's sound starts
// LJUD_FORE after the map's first frame.
import { randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { WebSocket } from 'ws';

export const LJUD_FORE = .22;   // s of silence the worker puts before a line (its mouth opens on the sound, not before)
const FPS = 24;

/** Duration in seconds of an mp4 (moov/mvhd), or null. */
export function mp4Duration(buf) {
  const i = buf.indexOf('mvhd');
  if (i < 4 || i + 32 > buf.length) return null;
  const v1 = buf[i + 4] === 1;
  const scale = buf.readUInt32BE(i + (v1 ? 24 : 16));
  const dur = v1 ? Number(buf.readBigUInt64BE(i + 28)) : buf.readUInt32BE(i + 20);
  return scale ? dur / scale : null;
}

/** A ready dealer's own take of a manifest line (mirrors public/dealers.js dealerLineUrl): its id, language and path. */
export function dealerLine(clipUrl, language, { linesDir, langs }) {
  const m = /\/media\/repliker(?:-[a-z]+)?\/([a-z0-9]+_\d)(?:_[a-z]+)?\.mp4/.exec(clipUrl ?? '');
  if (!m) return null;
  const lang = langs.includes(language) ? language : 'en';
  return { id: m[1], lang, url: `${linesDir}${lang}/${m[1]}.mp4` };
}

/** The take file a plan step plays for a ready dealer (pos4-iv, hole, flip-u …), as in public/dealers.js dealerClipUrl. */
export function takeOf(step) {
  const m = /\/media\/deal\/([a-z0-9]+)\.mp4/.exec(step?.clip?.url ?? '');
  return m ? m[1] + (step.variant ? '-' + step.variant : '') : null;
}

/**
 * Which take and frame is on screen for n frames from t0 (ms, server clock), as the worker's map:
 * [[take, firstFrame, count], …]. Between two takes the last frame stays (the 80 ms gaps); before the plan and after a
 * take that ends at rest, the dealer rests ('vila'). Held frames are runs of one.
 */
export function kartaFor(steps, t0, n, { restEnd = [] } = {}) {
  const takes = (steps ?? []).filter(s => takeOf(s) && Number.isFinite(s.startAt) && s.endAt > s.startAt);
  const atRest = s => /[uv]/.test(s.variant ?? '') || restEnd.includes(s.track ?? s.seat);
  const out = [];
  const push = (take, frame) => {
    const last = out[out.length - 1];
    if (last && last[0] === take && (take === 'vila' || last[1] + last[2] === frame)) last[2]++;
    else out.push([take, take === 'vila' ? 0 : frame, 1]);
  };
  for (let k = 0; k < n; k++) {
    const t = t0 + k * 1000 / FPS + 1;
    const s = takes.find(x => t >= x.startAt && t < x.endAt);
    if (s) { push(takeOf(s), Math.floor((t - s.startAt) * FPS / 1000 + 1e-6)); continue; }
    const prev = [...takes].reverse().find(x => x.endAt <= t);
    if (prev && !atRest(prev)) push(takeOf(prev), Math.max(0, Math.round((prev.endAt - prev.startAt) * FPS / 1000) - 1));
    else push('vila', 0);
  }
  return out;
}

/**
 * Line timing for a plan: where each line the plan would have spoken as a step starts instead, so it plays over the
 * cards. talks = [{after, …}] (after = index of the step the line followed), steps already timed (readyTimeline).
 * Before the first card: in the middle of his reach for the shoe. After a card: once it has landed (~62 % into its take).
 * Lines never overlap, also across plans (free = when the table's previous line ends).
 */
export function scheduleTalks(talks, steps, { free = 0, end = 0, gap = 250 } = {}) {
  return talks.map(t => {
    const prev = steps[t.after - 1], next = steps[t.after];
    // before the first card: in the middle of his reach for the shoe (600 ms), which also gives the worker and the viewers'
    // decoders a head start on the round's first line
    const want = prev?.clip ? prev.startAt + .62 * (prev.endAt - prev.startAt) : (next?.startAt ?? end) + 600;
    const startAt = Math.round(Math.max(want, free)), endAt = Math.round(startAt + t.dur * 1000);
    free = endAt + gap;
    return { ...t, startAt, endAt, kartaStart: startAt - LJUD_FORE * 1000 };
  });
}

/**
 * Sessions on the endpoint, one per dealer (avatar), plus the patches it sends. publicBase() gives this server's public
 * https origin (the worker dials it); dealers lists the avatars the image carries.
 */
// A worker slower than this cannot keep ahead of the picture (a healthy 4090 makes 55–63 frames/s)
const MIN_FPS = 30;

export class RorligLipsync {
  constructor({ endpointId, apiKey, publicBase, publicDir, dealers = ['paow'], log = console.log, fetchImpl = fetch,
    onPiece = () => {}, inactivityMs = 480_000, ttlS = 3300 }) {
    // ttlS: one session per ~55 min (the endpoint allows jobs of 1 h). Every renewal can land on a cold or slow machine,
    // and with 9 min sessions that happened every 6.5 min of play; a session still ends 8 min after the table goes quiet
    Object.assign(this, { endpointId, apiKey, publicBase, publicDir, dealers, log, fetchImpl, onPiece, inactivityMs, ttlS });
    this.token = randomBytes(24).toString('hex');   // per process: only the sessions we ordered can dial in
    this.s = new Map(dealers.map(d => [d, { ws: null, next: null, info: null, askedAt: 0, at: 0, active: 0, orders: [], jobs: [], busy: false, waiters: [], recent: [] }]));
    this.talks = new Map();   // talk id -> {room, pieces:[{meta, bytes}], done, error, at}
    this.durations = new Map();
    this.timer = setInterval(() => this.#tick(), 5000);
    this.timer.unref?.();
  }

  status() {
    return Object.fromEntries([...this.s].map(([d, s]) => [d, { ready: this.ready(d), info: s.info ? { gpu: s.info.gpu, motor: s.info.motor, forsta_bit_ms: s.info.forsta_bit_ms, rutor_per_s: s.info.rutor_per_s } : null,
      asked: s.askedAt ? Math.round((Date.now() - s.askedAt) / 1000) : null, activeAgo: s.active ? Math.round((Date.now() - s.active) / 1000) : null,
      recent: s.recent }]));
  }

  ready(dealer) {
    const s = this.s.get(dealer);
    return Boolean(s?.ws?.readyState === WebSocket.OPEN && s.info && (s.info.rutor_per_s ?? 0) >= MIN_FPS);
  }

  /** A table with this dealer is in use: keep (or get) a warm worker. */
  activity(dealer) {
    const s = this.s.get(dealer);
    if (!s) return;
    s.active = Date.now();
    if (!s.ws) this.#order(dealer);
  }

  /** The dealer's own take of a line: {url, lang, dur} or null when he has none. */
  line(dealer, clipUrl, language) {
    const l = dealerLine(clipUrl, language, { linesDir: `/media/dealers/${dealer}/repliker/`, langs: ['sv', 'en'] });
    if (!l) return null;
    let dur = this.durations.get(l.url);
    if (dur === undefined) {
      const file = path.join(this.publicDir, ...l.url.split('/').filter(Boolean));
      try { dur = existsSync(file) ? mp4Duration(readFileSync(file)) : null; } catch { dur = null; }
      this.durations.set(l.url, dur);
    }
    return dur ? { ...l, dur } : null;
  }

  /**
   * Lip-syncs one line or answer over a map of frames; patches go to onPiece(room, talkId, meta) as they come.
   * pcm: an answer's voice (s16le 24 kHz), kept for a new map; without it the worker fetches the line (talk.line).
   * A new map for the same talk (the plan changed under it) is a new version: its patches replace the old ones.
   */
  speak(dealer, room, talk, karta, { pcm = null, fran = 0 } = {}) {
    const s = this.s.get(dealer);
    const old = this.talks.get(talk.id);
    const rec = { room, ver: (old?.ver ?? 0) + 1, pieces: [], done: false, error: null, at: Date.now(), pcm: pcm ?? old?.pcm ?? null, pcmWs: old?.pcmWs ?? null, talk };
    this.talks.set(talk.id, rec);
    const base = this.publicBase();
    const run = () => new Promise(resolve => {
      const ws = s.ws;
      if (rec !== this.talks.get(talk.id)) return resolve();   // a newer map came while this one waited
      if (!this.ready(dealer) || (!rec.pcm && !base)) { rec.error = 'no worker'; rec.done = true; return resolve(); }
      // timings of the last lines (in /api/lipsync-status): queue = waited behind other lines, first = sent until the
      // first patch, spare = how long before its first frame is on screen the first patch came (negative = late)
      const sent = Date.now(), tm = { what: talk.event ?? talk.kind, ver: rec.ver, fran, queue: sent - rec.at, first: null, total: null, spare: null, steg: null, error: null };
      const finish = (err) => { clearTimeout(timer); ws.off('message', onMsg); ws.off('close', onClose); rec.error = err; rec.done = true; tm.total = Date.now() - sent; tm.error = err; s.recent.unshift(tm); s.recent.length = Math.min(s.recent.length, 20); resolve(); };
      let pending = null;
      const onMsg = (data, isBinary) => {
        if (isBinary) {
          if (pending) { const meta = { ...pending, ver: rec.ver }; pending = null; if (tm.first === null) { tm.first = Date.now() - sent; tm.spare = Math.round(talk.kartaStart + fran * 1000 / 24 - Date.now()); } const bytes = Buffer.from(data); rec.pieces.push({ meta, bytes }); this.onPiece(room, talk.id, meta, bytes); }
          return;
        }
        let m; try { m = JSON.parse(String(data)); } catch { return; }
        if (m.id !== talk.id) return;
        if (m.t === 'lapp') pending = { del: m.del, fran: m.fran, till: m.till, rutor: m.rutor };
        else if (m.t === 'done') { tm.steg = m.steg ?? null; this.log(`läppsynk rörlig [${dealer}]: ${talk.event ?? 'replik'} klar, första bit ${m.forsta_bit_ms} ms, ${m.ms} ms`); finish(null); }
        else if (m.t === 'error') { this.log(`läppsynk rörlig [${dealer}]: fel ${m.reason}`); finish(m.reason); }
      };
      // a worker that goes away mid-line (terminated, its machine lost) ends the line at once: the queue behind it waited
      // 30 s before; a line takes under 4 s, so 15 s means the worker hangs
      const onClose = () => finish('worker gone');
      const timer = setTimeout(() => finish('timeout'), 15_000);
      ws.on('message', onMsg);
      ws.on('close', onClose);
      // fran: the first frame the viewers still need (a new map while it speaks): the worker makes only the rest
      // a new map for an answer this worker already has the voice of: not the voice again (~0.5 s when it matters most)
      if (rec.pcm && rec.pcmWs === ws && s.info?.samma_ljud) ws.send(JSON.stringify({ t: 'start', id: talk.id, rate: 24000, karta, fran_ruta: fran, samma_ljud: true }));
      else if (rec.pcm) {
        ws.send(JSON.stringify({ t: 'start', id: talk.id, rate: 24000, karta, fran_ruta: fran }));
        for (let i = 0; i < rec.pcm.length; i += 32768) ws.send(rec.pcm.subarray(i, i + 32768));
        rec.pcmWs = ws;
      } else ws.send(JSON.stringify({ t: 'start', id: talk.id, rate: 24000, karta, ljud_url: base + talk.line, fran_ruta: fran }));
      ws.send(JSON.stringify({ t: 'end', id: talk.id }));
    });
    // One line at a time per worker, the one needed on screen soonest first (earliest deadline): a line starting in a
    // second goes before an answer made for later, and a new map for what is on screen now goes before both.
    return new Promise(resolve => {
      s.jobs.push({ deadline: talk.kartaStart + fran * 1000 / 24, run: () => run().then(resolve, resolve) });
      this.#pump(dealer);
    });
  }

  #pump(dealer) {
    const s = this.s.get(dealer);
    if (s.busy) return;
    if (!s.jobs.length) { for (const f of s.waiters.splice(0)) f(); return; }
    s.jobs.sort((a, b) => a.deadline - b.deadline);
    const job = s.jobs.shift();
    s.busy = true;
    job.run().finally(() => { s.busy = false; this.#pump(dealer); });
  }

  #idle(s) { return !s.busy && !s.jobs.length ? Promise.resolve() : new Promise(r => s.waiters.push(r)); }

  piece(talkId, del, ver) { const t = this.talks.get(talkId); return t && (!ver || t.ver === ver) ? t.pieces.find(p => p.meta.del === del) ?? null : null; }
  index(talkId) {
    const t = this.talks.get(talkId);
    return t ? { ver: t.ver, delar: t.pieces.map(p => p.meta), klar: t.done, fel: t.error } : null;
  }
  /** An answer's voice as WAV, for the viewers' players. */
  wav(talkId) {
    const pcm = this.talks.get(talkId)?.pcm;
    if (!pcm) return null;
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
    h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(24000, 24); h.writeUInt32LE(48000, 28);
    h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([h, pcm]);
  }

  /** The worker dialed /lipsync-rorlig?token=…&avatar=… */
  adoptWorker(ws, url) {
    const dealer = url.searchParams.get('avatar') ?? '';
    const s = this.s.get(dealer);
    if (url.searchParams.get('token') !== this.token || !s) { ws.close(4403, 'fel token'); return; }
    ws.once('message', data => {
      let m; try { m = JSON.parse(String(data)); } catch { ws.close(); return; }
      if (m.t !== 'pong') { ws.close(); return; }
      // a slow machine (14.5 frames/s on 13 Oct) must not take over from a working worker: it is sent away (and
      // replaced by RunPod) and a new session is ordered in ~15 s; the one in use keeps speaking meanwhile
      if ((m.rutor_per_s ?? 0) < MIN_FPS) {
        this.log(`läppsynk rörlig [${dealer}]: arbetaren för långsam (${m.gpu}, ${m.rutor_per_s} rutor/s) — skickas bort, ny beställs`);
        try { ws.send(JSON.stringify({ t: 'bye' })); } catch {}
        s.askedAt = Date.now() - 225_000;
        return;
      }
      const old = s.ws;
      s.ws = ws; s.info = m; s.at = Date.now(); s.askedAt = 0;
      this.log(`läppsynk rörlig [${dealer}]: arbetare uppkopplad (${m.gpu}, första bit ${m.forsta_bit_ms} ms, ${m.rutor_per_s} rutor/s)`);
      // the lines said at round start have the least time to spare: the worker fetches their sound now, not then
      const base = this.publicBase();
      if (base) try { ws.send(JSON.stringify({ t: 'forhamta', urls: this.#roundStartLines(dealer).map(u => base + u) })); } catch {}
      // the session it replaces says goodbye once its line queue is empty
      if (old && old !== ws) this.#idle(s).then(() => { try { old.send(JSON.stringify({ t: 'bye' })); } catch {} });
    });
    ws.on('close', () => { if (s.ws === ws) { s.ws = null; s.info = null; this.log(`läppsynk rörlig [${dealer}]: arbetaren kopplade ner`); } });
    ws.on('error', () => {});
  }

  #roundStartLines(dealer) {
    const urls = [];
    for (const lang of ['en', 'sv']) {
      const dir = path.join(this.publicDir, 'media', 'dealers', dealer, 'repliker', lang);
      try { for (const f of readdirSync(dir)) if (/^goodluck_\d+\.mp4$/.test(f)) urls.push(`/media/dealers/${dealer}/repliker/${lang}/${f}`); } catch {}
    }
    return urls;
  }

  #api(p, init = {}) {
    return this.fetchImpl(`https://api.runpod.ai/v2/${this.endpointId}/${p}`, { ...init,
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20_000) });
  }

  #order(dealer, force = false) {
    const s = this.s.get(dealer), base = this.publicBase();
    if (!base) return;
    // a cold start (image pull) can take minutes: one order at a time, a new one only after 4 min without a worker
    if (!force && (s.ws || Date.now() - s.askedAt < 240_000)) return;
    if (force && Date.now() - s.askedAt < 60_000) return;
    s.askedAt = Date.now();
    const ws_url = `${base.replace(/^http/, 'ws')}/lipsync-rorlig?token=${this.token}&avatar=${encodeURIComponent(dealer)}`;
    this.#api('run', { method: 'POST', body: JSON.stringify({ input: { op: 'session', ws_url, ttl: this.ttlS, avatar: dealer } }) })
      .then(r => r.json()).then(j => { if (j.id) { s.orders.push(j.id); this.log(`läppsynk rörlig [${dealer}]: session beställd (${j.id})`); } else this.log(`läppsynk rörlig [${dealer}]: beställningen misslyckades ${JSON.stringify(j).slice(0, 200)}`); })
      .catch(e => { s.askedAt = 0; this.log(`läppsynk rörlig [${dealer}]: RunPod svarar inte (${e.message})`); });
  }

  #tick() {
    const now = Date.now();
    for (const [dealer, s] of this.s) {
      const inUse = s.active && now - s.active < this.inactivityMs;
      if (inUse) {
        if (!s.ws) this.#order(dealer);
        else if (now - s.at > (this.ttlS - 150) * 1000) this.#order(dealer, true);   // renew before the session's ttl
      } else if (s.ws || s.orders.length) {
        try { s.ws?.send(JSON.stringify({ t: 'bye' })); } catch {}
        for (const id of s.orders.splice(0)) this.#api(`cancel/${id}`, { method: 'POST' }).catch(() => {});
        if (s.ws) this.log(`läppsynk rörlig [${dealer}]: ingen vid bordet på ${Math.round(this.inactivityMs / 60000)} min — arbetaren släpps`);
        s.active = 0; s.askedAt = 0;
      }
      if (s.orders.length > 8) s.orders.splice(0, s.orders.length - 8);
    }
    for (const [id, t] of this.talks) if (now - t.at > 600_000) this.talks.delete(id);
  }
}
