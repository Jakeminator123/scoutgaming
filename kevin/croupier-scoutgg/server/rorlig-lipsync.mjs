// Lip sync on the dealer's MOVING clips (Emil 12 Oct, staging): a ready dealer says his recorded lines WHILE he deals,
// instead of stopping for each line. His mouth is a layer over the clips that play anyway: for every frame of a line the
// GPU worker returns a small mouth patch tagged with the take and frame it belongs to, and the client draws a patch only
// when that take and frame is the one on screen. The game never waits for it: without a warm worker the plan keeps
// today's speech steps.
//
// Worker: RunPod Serverless endpoint croupier-lipsync-staging (github.com/EmaCodeHero/croupier-lipsync-worker), one
// image for every dealer. Like serverless.mjs we order a "session" job; the worker dials /lipsync-rorlig back and stays
// while the dealer's tables are in use (renewed before its ttl, released after inactivity). Or dedicated pods (same
// image, its pod.py) that dial in with &pod=<name> and stay: each worker is a lane of its own (Emil 14 Oct).
//
// Protocol (worker/motor.py): → {t:'start', id, karta:[[take, firstFrame, count], …], ljud_url} → {t:'end', id}
// ← {t:'lapp', id, del, fran, till, rutor:[{tagning, ruta, rect}|null…]} + raw H.264 (Annex B, 256×512) per 0.5 s
// ← {t:'done', id, …} | {t:'error', id, reason}. Patch k belongs to the map's frame k; the line's sound starts
// LJUD_FORE after the map's first frame.
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { WebSocket } from 'ws';
import { layChain } from '../public/idle-chain.js';   // the one chain generator: the worker's map and every viewer lay the same clips

export const LJUD_FORE = .22;   // s of silence the worker puts before a line (its mouth opens on the sound, not before)
const FPS = 24;
// The takes every worker image has (the deals, Paow's hands) and the one picture; anything else in a map is one of the
// dealer's idle takes (Kevin 20 Oct), which only a worker that announced them in its pong ("takes": [...]) can map.
const DEAL_TAKE = /^(pos[1-7]|posdealer|hole|flip|hands)(-[iuv]+)?$/;
export const idleTakesIn = karta => [...new Set((karta ?? []).map(k => k[0]).filter(t => t !== 'vila' && !DEAL_TAKE.test(t)))];
/** The same map for a worker that has only the deals: its idle takes become rest frames (the fallback, ko2 today). */
export const vilaMap = karta => (karta ?? []).map(([t, f, n]) => (t !== 'vila' && !DEAL_TAKE.test(t) ? ['vila', 0, n] : [t, f, n]));

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
 * take that ends at rest, the dealer rests: on his moving idle when the talk carries one (idle = its chain, idleChain
 * below, Kevin 20 Oct: he keeps moving while he speaks, also between rounds), else on his still ('vila').
 * Held frames are runs of one.
 */
export function kartaFor(steps, t0, n, { restEnd = [], idle = [] } = {}) {
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
    if (prev && !atRest(prev)) { push(takeOf(prev), Math.max(0, Math.round((prev.endAt - prev.startAt) * FPS / 1000) - 1)); continue; }
    const c = idle.find(x => t >= x.startAt && t < x.endAt);
    if (c) push(c.take, Math.min(c.frames - 1, Math.floor((t - c.startAt) * FPS / 1000 + 1e-6)));
    else push('vila', 0);
  }
  return out;
}

/**
 * When a talk's moving idle may start (ms, server clock), or null when he holds a pose then. His first frame when no take
 * plays under the talk; after the last take under it ends, when that take ends at rest (-u, -v, hole, flip). A take that
 * ends in REDO (more cards to come) holds its last frame as before: an idle there would snap him back to rest.
 */
export function idleFrom(steps, talk, { restEnd = [], minMs = 500 } = {}) {
  const from = talk.kartaStart, to = talk.endAt;
  const all = (steps ?? []).filter(s => takeOf(s) && Number.isFinite(s.startAt) && s.endAt > s.startAt);
  const takes = all.filter(s => s.startAt < to);
  const atRest = s => /[uv]/.test(s.variant ?? '') || restEnd.includes(s.track ?? s.seat);
  const last = takes.sort((a, b) => a.endAt - b.endAt).at(-1);
  if (!last) return from;
  if (!atRest(last)) return null;
  const start = Math.max(from, last.endAt);
  // a take that follows within minMs (the 80 ms gap between the hole card and its turn, say) leaves no room for an idle:
  // a clip of a frame or two would only cost a switch
  if (all.some(s => s.startAt >= start && s.startAt < start + minMs)) return null;
  return start < to ? start : null;
}

/**
 * His idle takes (v2/idle1.mp4 …, short, VILA to VILA) laid back to back from `from` to `to` (ms, server clock), so a
 * line or answer said while he rests runs over a moving body instead of his still: [{take, startAt, endAt, frames}].
 * Every idle take starts and ends on VILA (the one picture he returns to), so the chain joins without a seam, any take
 * can follow it and it ends on his still. Deterministic from the seed (the talk id): the worker's map, every viewer and
 * a remap all lay the same chain. Weighted like his random idles (vikt), never the same take twice in a row when he has
 * more than one.
 */
export function idleChain(idles, from, to, seed = '') { return layChain(idles, from, to, seed); }

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
 * Workers per dealer (avatar), plus the patches they send. publicBase() gives this server's public https origin (the
 * worker dials it); dealers lists the avatars the image carries.
 *
 * Two kinds of worker dial in. A serverless session we ordered (token = this.token, renewed before its ttl, released
 * when the table goes quiet), and dedicated pods (Emil 14 Oct, the Svenska Spel demo: serverless machines came cold,
 * slow or late). A pod dials with &pod=<name> and podToken(), stays connected and dials again when the line breaks
 * or this server restarts. Every worker is a lane of its own: with two pods a hit during an answer has its remap
 * made on the second GPU at once while the first is still busy, instead of queueing behind it.
 */
// A worker slower than this cannot keep ahead of the picture (a healthy 4090 makes 55–63 frames/s)
const MIN_FPS = 30;

export class RorligLipsync {
  constructor({ endpointId, apiKey, publicBase, publicDir, dealers = ['paow'], log = console.log, fetchImpl = fetch,
    onPiece = () => {}, inactivityMs = 480_000, ttlS = 3300, horizonMs = 3000, urgentMs = 2500, maxLanes = 1,
    podToken = null, podGraceMs = 20_000, alert = null, sessionWaitMs = 90_000 }) {
    // ttlS: one session per ~55 min (the endpoint allows jobs of 1 h). Every renewal can land on a cold or slow machine,
    // and with 9 min sessions that happened every 6.5 min of play; a session still ends 8 min after the table goes quiet
    // horizonMs: a line is made no earlier than this before it is needed (a line takes ~1.5 s, its first patch ~0.5 s).
    // Made sooner, every new plan remade it again (insurance 3–4 times) and the worker was busy with that when a hit
    // during an answer needed its remap at once (staging 13 Oct)
    // maxLanes/urgentMs: lines at once on ONE worker. A worker that can (pong spar: 2) may take a second line when it is
    // needed within urgentMs. Off: on staging 13 Oct two lines at once on one GPU took 2.5–12 s to a first patch and one
    // hung. A remap after a hit during an answer instead stops the version it replaces (abort), which frees its lane
    // podGraceMs: no serverless order while pods are expected (one is connected or left within this, or this server just
    // started and they have not dialed back yet). Kevin 24 Oct: serverless only as the reserve when the pod lane has been
    // gone about 20 s, never next to it
    Object.assign(this, { endpointId, apiKey, publicBase, publicDir, dealers, log, fetchImpl, onPiece, inactivityMs, ttlS, horizonMs, urgentMs, maxLanes, podGraceMs });
    this.fixedPodToken = podToken;
    // alert: server/alerts.mjs (Kevin 23 Oct: every failure in the lip sync or a worker's callback goes to the webhook)
    this.alert = alert ?? { fail() {}, ok() {} }; this.sessionWaitMs = sessionWaitMs;
    this.token = randomBytes(24).toString('hex');   // per process: only the sessions we ordered can dial in
    this.startedAt = Date.now();
    const none = () => ({ ws: null, info: null, pod: null, running: 0, waiters: [] });   // the lane of "no worker": its lines fail at once
    this.s = new Map(dealers.map(d => [d, { workers: [], none: none(), podAt: 0, askedAt: 0, active: 0, orders: [], jobs: [], recent: [] }]));
    this.talks = new Map();   // talk id -> {room, pieces:[{meta, bytes}], done, error, at}
    this.durations = new Map();
    this.timer = setInterval(() => this.#tick(), 5000);
    this.timer.unref?.();
  }

  /** The token a dedicated pod dials with: RORLIG_POD_TOKEN, else derived from the RunPod key (no new secret to store). */
  podToken() {
    if (this.fixedPodToken) return this.fixedPodToken;
    return this.apiKey ? createHash('sha256').update(`rorlig-pod:${this.apiKey}`).digest('hex').slice(0, 40) : null;
  }

  #ok(w) { return Boolean(w.ws?.readyState === WebSocket.OPEN && w.info && (w.info.rutor_per_s ?? 0) >= MIN_FPS); }
  // the takes a worker announced in its pong ("takes": all of them, or "idle": the idle ones); none announced = the deals only
  #announced(w) { const t = w.info?.takes ?? w.info?.idle; return Array.isArray(t) ? t : []; }
  #knows(w, names) { const has = this.#announced(w); return names.every(n => has.includes(n)); }
  /** The idle takes a connected worker can map for this dealer (a chain at rest is laid from these, shared-table.mjs). */
  idleTakes(dealer) {
    const out = new Set();
    for (const w of this.workers(dealer)) if (this.#ok(w)) for (const t of this.#announced(w)) if (t !== 'vila' && !DEAL_TAKE.test(t)) out.add(t);
    return [...out];
  }

  status() {
    return Object.fromEntries([...this.s].map(([d, s]) => {
      const first = s.workers.find(w => this.#ok(w));
      return [d, { ready: this.ready(d), info: first ? { gpu: first.info.gpu, motor: first.info.motor, forsta_bit_ms: first.info.forsta_bit_ms, rutor_per_s: first.info.rutor_per_s } : null,
        idle: this.idleTakes(d),
        workers: s.workers.map(w => ({ pod: w.pod, gpu: w.info?.gpu ?? null, rutor_per_s: w.info?.rutor_per_s ?? null, forsta_bit_ms: w.info?.forsta_bit_ms ?? null, takes: this.#announced(w).length, running: w.running, up: Math.round((Date.now() - w.at) / 1000), ...(w.badUntil > Date.now() ? { resting: Math.round((w.badUntil - Date.now()) / 1000) } : {}) })),
        asked: s.askedAt ? Math.round((Date.now() - s.askedAt) / 1000) : null, activeAgo: s.active ? Math.round((Date.now() - s.active) / 1000) : null,
        recent: s.recent }];
    }));
  }

  ready(dealer) {
    return Boolean(this.s.get(dealer)?.workers.some(w => this.#ok(w)));
  }

  workers(dealer) { return this.s.get(dealer)?.workers ?? []; }

  /** A table with this dealer is in use: keep (or get) a warm worker. */
  /**
   * Whether a worker for this dealer is up or on its way: connected, or a serverless session ordered on a server no pod
   * serves (where pods serve, a dealer whose avatar no pod carries gets none: Mårten on staging, 23 Oct).
   */
  coming(dealer) {
    const s = this.s.get(dealer);
    if (!s) return false;
    if (s.workers.length) return true;
    const pods = [...this.s.values()].some(x => x.workers.some(w => w.pod));
    return !pods && Boolean(s.askedAt) && Date.now() - s.askedAt < 240_000;
  }

  activity(dealer) {
    const s = this.s.get(dealer);
    if (!s) return;
    s.active = Date.now();
    if (!s.workers.length) this.#order(dealer);
  }

  // the languages a dealer has recorded lines in (his repliker/<lang>/ folders)
  #langs(dealer) {
    this.langCache ??= new Map();
    if (!this.langCache.has(dealer)) {
      let l = [];
      try { l = readdirSync(path.join(this.publicDir, 'media', 'dealers', dealer, 'repliker')).filter(d => /^[a-z]{2}$/.test(d)); } catch {}
      this.langCache.set(dealer, l.length ? l : ['sv', 'en']);
    }
    return this.langCache.get(dealer);
  }

  /** The dealer's own take of a line: {url, lang, dur} or null when he has none. */
  line(dealer, clipUrl, language) {
    const l = dealerLine(clipUrl, language, { linesDir: `/media/dealers/${dealer}/repliker/`, langs: this.#langs(dealer) });
    if (!l) return null;
    let dur = this.durations.get(l.url);
    if (dur === undefined) {
      const file = path.join(this.publicDir, ...l.url.split('/').filter(Boolean));
      try { dur = existsSync(file) ? mp4Duration(readFileSync(file)) : null; } catch { dur = null; }
      this.durations.set(l.url, dur);
    }
    return dur ? { ...l, dur } : null;
  }

  /** A recorded line of the dealer's own by its take id (greet_guest, table_trust_1, remark_hit17_1 …: outside the shared
   *  /media/repliker set dealerLine reads), in the table's language or English. → {id, lang, url, dur} or null. */
  extraLine(dealer, id, language) {
    if (!/^[a-z0-9_]{3,40}$/.test(id ?? '')) return null;
    const langs = this.#langs(dealer), lang = langs.includes(language) ? language : 'en', url = `/media/dealers/${dealer}/repliker/${lang}/${id}.mp4`;
    let dur = this.durations.get(url);
    if (dur === undefined) {
      const file = path.join(this.publicDir, ...url.split('/').filter(Boolean));
      try { dur = existsSync(file) ? mp4Duration(readFileSync(file)) : null; } catch { dur = null; }
      this.durations.set(url, dur);
    }
    return dur ? { id, lang, url, dur } : null;
  }

  /**
   * Lip-syncs one line or answer over a map of frames; patches go to onPiece(room, talkId, meta) as they come.
   * pcm: an answer's voice (s16le 24 kHz), kept for a new map; without it the worker fetches the line (talk.line).
   * A new map for the same talk (the plan changed under it) is a new version: its patches replace the old ones.
   */
  speak(dealer, room, talk, karta, { pcm = null, fran = 0 } = {}) {
    const s = this.s.get(dealer);
    const old = this.talks.get(talk.id);
    old?.abort?.();   // the worker stops making the version this map replaces
    const rec = { room, ver: (old?.ver ?? 0) + 1, pieces: [], done: false, error: null, at: Date.now(), pcm: pcm ?? old?.pcm ?? null, pcmWs: old?.pcmWs ?? null, talk };
    this.talks.set(talk.id, rec);
    const base = this.publicBase();
    const run = (w, map) => new Promise(resolve => {
      const ws = w.ws;
      if (rec !== this.talks.get(talk.id)) return resolve();   // a newer map came while this one waited
      if (!this.#ok(w) || (!rec.pcm && !base)) { rec.error = 'no worker'; rec.done = true; return resolve(); }
      // timings of the last lines (in /api/lipsync-status): queue = waited behind other lines, first = sent until the
      // first patch, spare = how long before its first frame is on screen the first patch came (negative = late)
      // a two-lane worker may make two versions of one answer at once: each run has its own id, the voice its answer's
      const lanes = (w.info?.spar ?? 1) >= 2, jid = lanes ? `${talk.id}#${rec.ver}` : talk.id;
      const sent = Date.now(), tm = { what: talk.event ?? talk.kind, ver: rec.ver, fran, worker: w.pod ?? 'serverless', queue: sent - rec.at, first: null, total: null, spare: null, steg: null, error: null };
      // a worker that hangs (15 s without an answer) gets no lines for a minute while another one works (14 Oct: a pod far
      // from the server fell behind and every line it took after that timed out)
      const finish = (err) => { if (err === 'timeout') { w.badUntil = Date.now() + 60_000; this.log(`läppsynk rörlig [${dealer}${w.pod ? ' ' + w.pod : ''}]: timeout — vilar 60 s`); this.alert.fail('timeout', dealer, `${talk.event ?? talk.kind}: inget svar på 15 s från ${w.pod ?? 'serverless'}`); } rec.abort = null; clearTimeout(timer); ws.off('message', onMsg); ws.off('close', onClose); rec.error = err; rec.done = true; tm.total = Date.now() - sent; tm.error = err; s.recent.unshift(tm); s.recent.length = Math.min(s.recent.length, 20);
        // the worker with his idle takes hung or went away mid-line: once more on another worker, with those frames as rest
        // (it has only the deals), rather than no mouth at all for the line
        if ((err === 'timeout' || err === 'worker gone') && job.idle.length && !job.retried && rec === this.talks.get(talk.id) && Date.now() < (talk.endAt ?? Infinity) && s.workers.some(o => o !== w && this.#ok(o))) {
          job.retried = true; job.map = vilaMap(job.map); job.idle = []; rec.done = false; rec.error = null;
          this.log(`läppsynk rörlig [${dealer}]: ${talk.event ?? talk.kind} görs om på en annan arbetare, utan idle-tagningarna`);
          return resolve('retry');
        }
        resolve(); };
      let pending = null;
      const onMsg = (data, isBinary) => {
        if (isBinary) {
          if (pending) { const meta = { ...pending, ver: rec.ver }; pending = null; if (tm.first === null) { tm.first = Date.now() - sent; tm.spare = Math.round(talk.kartaStart + fran * 1000 / 24 - Date.now()); } const bytes = Buffer.from(data); rec.pieces.push({ meta, bytes }); this.onPiece(room, talk.id, meta, bytes); }
          return;
        }
        let m; try { m = JSON.parse(String(data)); } catch { return; }
        if (m.id !== jid) return;
        if (m.t === 'lapp') pending = { del: m.del, fran: m.fran, till: m.till, rutor: m.rutor };
        else if (m.t === 'done') { tm.steg = m.steg ?? null; this.log(`läppsynk rörlig [${dealer}${w.pod ? ' ' + w.pod : ''}]: ${talk.event ?? 'replik'} klar, första bit ${m.forsta_bit_ms} ms, ${m.ms} ms`); this.alert.ok('timeout', dealer); this.alert.ok('fel_i_worker', dealer); finish(null); }
        else if (m.t === 'error') { if (m.reason !== 'avbruten') { this.log(`läppsynk rörlig [${dealer}]: fel ${m.reason}`); this.alert.fail('fel_i_worker', dealer, `${talk.event ?? talk.kind}: ${m.reason}`); } finish(m.reason); }
      };
      // a worker that goes away mid-line (terminated, its machine lost) ends the line at once: the queue behind it waited
      // 30 s before; a line takes under 4 s, so 15 s means the worker hangs
      const onClose = () => finish('worker gone');
      const timer = setTimeout(() => finish('timeout'), 15_000);
      ws.on('message', onMsg);
      ws.on('close', onClose);
      if (lanes) rec.abort = () => { try { ws.send(JSON.stringify({ t: 'avbryt', id: jid })); } catch {} };
      // fran: the first frame the viewers still need (a new map while it speaks): the worker makes only the rest
      // a new map for an answer this worker already has the voice of: not the voice again (~0.5 s when it matters most)
      if (rec.pcm && rec.pcmWs === ws && lanes) ws.send(JSON.stringify({ t: 'start', id: jid, ljud_id: talk.id, rate: 24000, karta: map, fran_ruta: fran, samma_ljud: true }));
      else if (rec.pcm) {
        ws.send(JSON.stringify({ t: 'start', id: jid, ljud_id: talk.id, rate: 24000, karta: map, fran_ruta: fran }));
        for (let i = 0; i < rec.pcm.length; i += 32768) ws.send(rec.pcm.subarray(i, i + 32768));
        rec.pcmWs = ws;
      } else ws.send(JSON.stringify({ t: 'start', id: jid, rate: 24000, karta: map, ljud_url: base + talk.line, fran_ruta: fran }));
      ws.send(JSON.stringify({ t: 'end', id: jid }));
    });
    // The line needed on screen soonest first (earliest deadline): a line starting in a second goes before an answer made
    // for later, and a new map for what is on screen now goes before both. One at a time per worker (maxLanes).
    // idle: the idle takes in the map, which only a worker that announced them can make (#pump); map: the map as sent
    // (rewritten to rest frames for the fallback worker); a 'retry' from run queues the job again on another worker
    let job;
    return new Promise(resolve => {
      job = { deadline: talk.kartaStart + fran * 1000 / 24, stale: () => rec !== this.talks.get(talk.id), voiceAt: () => rec.pcmWs, idle: idleTakesIn(karta), map: karta, retried: false,
        run: (w) => run(w, job.map).then(r => { if (r === 'retry') { s.jobs.push(job); queueMicrotask(() => this.#pump(dealer)); } else resolve(); }, resolve) };
      s.jobs.push(job);
      this.#pump(dealer);
    });
  }

  #pump(dealer) {
    const s = this.s.get(dealer);
    // a line remade since it was queued: the old version ends at once, it is never made
    for (const j of s.jobs.filter(j => j.stale())) j.run(s.none);
    s.jobs = s.jobs.filter(j => !j.stale());
    clearTimeout(s.later);
    if (!s.jobs.length) return;
    const all = s.workers.filter(w => this.#ok(w)), fine = all.filter(w => !(w.badUntil > Date.now()));
    const ok = fine.length ? fine : all;
    const free = ok.length ? ok.filter(w => w.running < Math.min(this.maxLanes, w.info?.spar ?? 1)) : (s.none.running ? [] : [s.none]);
    if (!free.length) return;
    s.jobs.sort((a, b) => a.deadline - b.deadline);
    // a free worker that is idle takes a line from its horizon on; a second line on a busy one only when urgent
    const idle = free.filter(w => !w.running), wait = s.jobs[0].deadline - Date.now() - (idle.length ? this.horizonMs : this.urgentMs);
    if (wait > 0) { s.later = setTimeout(() => this.#pump(dealer), wait); return; }
    const job = s.jobs.shift();
    // a line over the dealer's idle takes goes to a worker that announced them (Kevin 20 Oct); none free: the fastest as
    // before (its map then has takes it lacks: the chain is never laid unless such a worker is connected, shared-table.mjs)
    const able = job.idle.length ? free.filter(w => this.#knows(w, job.idle)) : [];
    // the worker that has his idle takes is busy (an answer in hand) while another one is free: the line waits for it
    // until it would be late (urgentMs), rather than going at once to a worker that cannot make its idle frames
    if (job.idle.length && !able.length && ok.some(w => this.#knows(w, job.idle)) && job.deadline - Date.now() > this.urgentMs) {
      s.jobs.unshift(job); s.later = setTimeout(() => this.#pump(dealer), 150); return;
    }
    const cand = able.length ? able : free, candIdle = cand.filter(w => !w.running);
    // the worker that already has this answer's voice when it is free (no ~0.5 s resend), else the fastest idle one
    const pick = (candIdle.length ? candIdle : cand).slice().sort((a, b) => (b.info?.rutor_per_s ?? 0) - (a.info?.rutor_per_s ?? 0));
    const w = pick.find(x => x.ws && x.ws === job.voiceAt()) ?? pick[0];
    w.running++;
    job.run(w).finally(() => { w.running--; if (!w.running) for (const f of w.waiters.splice(0)) f(); this.#pump(dealer); });
    this.#pump(dealer);   // the next line on another free worker (or a second lane, maxLanes 2, when urgent)
  }

  // the worker has no line in hand (lines still waiting go to whichever worker is free when their time comes)
  #idle(w) { return !w.running ? Promise.resolve() : new Promise(r => w.waiters.push(r)); }

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

  /**
   * A worker that measured fast enough joins the dealer's lanes. A new serverless session replaces the one before it;
   * a pod's new connection replaces its own old one; the first pod sends the serverless sessions away. Each one leaves
   * with a goodbye once its lines in hand are made.
   */
  addWorker(dealer, ws, info, pod = null) {
    const s = this.s.get(dealer);
    // a serverless session that comes up after the pod lane is back is not needed next to it (Kevin 24 Oct): sent away
    if (!pod && s.workers.some(o => o.pod)) {
      this.log(`läppsynk rörlig [${dealer}]: podden är tillbaka — reservsessionen skickas bort`);
      s.releasedAt = Date.now();
      try { ws.send(JSON.stringify({ t: 'bye' })); } catch {}
      return null;
    }
    const w = { ws, info, pod, running: 0, waiters: [], at: Date.now() };
    const old = s.workers.filter(o => o.ws !== ws && (pod ? (o.pod === pod || !o.pod) : !o.pod));
    s.workers = [...s.workers.filter(o => !old.includes(o)), w];
    for (const o of old) this.#idle(o).then(() => { try { o.ws.send(JSON.stringify({ t: 'bye' })); } catch {} });
    if (pod) {
      s.podAt = Date.now(); s.askedAt = 0;
      // orders still in RunPod's queue would start a GPU next to the pod (Kevin 24 Oct): cancelled
      for (const id of s.orders.splice(0)) this.#api(`cancel/${id}`, { method: 'POST' }).catch(() => {});
    }
    this.#pump(dealer);
    return w;
  }

  /** A worker dialed /lipsync-rorlig?token=…&avatar=…[&pod=<name>] */
  adoptWorker(ws, url) {
    const dealer = url.searchParams.get('avatar') ?? '';
    const s = this.s.get(dealer), token = url.searchParams.get('token');
    const pod = (url.searchParams.get('pod') ?? '').replace(/[^\w.-]/g, '').slice(0, 40) || null;
    if (!s || !(token === this.token || (pod && token && token === this.podToken()))) { this.alert.fail('callback_fel', dealer || 'okänd', `lipsync-rorlig nekad: ${s ? 'fel token' : 'okänd avatar'} (${pod ?? 'serverless'})`); ws.close(4403, 'fel token'); return; }
    const name = `${dealer}${pod ? ' ' + pod : ''}`;
    ws.once('message', data => {
      let m; try { m = JSON.parse(String(data)); } catch { this.alert.fail('callback_fel', dealer, `lipsync-rorlig: första meddelandet är inte JSON (${name})`); ws.close(); return; }
      if (m.t !== 'pong') { this.alert.fail('callback_fel', dealer, `lipsync-rorlig: väntade pong, fick ${String(m.t).slice(0, 20)} (${name})`); ws.close(); return; }
      // a slow machine (14.5 frames/s on 13 Oct) must not take over from a working worker: it is sent away (a serverless
      // one is replaced by RunPod and a new session is ordered in ~15 s; a pod measures again and dials back)
      if ((m.rutor_per_s ?? 0) < MIN_FPS) {
        this.log(`läppsynk rörlig [${name}]: arbetaren för långsam (${m.gpu}, ${m.rutor_per_s} rutor/s) — skickas bort${pod ? '' : ', ny beställs'}`);
        this.alert.fail('worker_for_langsam', dealer, `${name}: ${m.gpu}, ${m.rutor_per_s} rutor/s (minst ${MIN_FPS})`);
        try { ws.send(JSON.stringify({ t: 'bye' })); } catch {}
        if (!pod) s.askedAt = Date.now() - 225_000;
        return;
      }
      if (!this.addWorker(dealer, ws, m, pod)) return;
      for (const typ of ['worker_nere', 'session_uteblir', 'worker_for_langsam', 'callback_fel']) this.alert.ok(typ, dealer);
      this.log(`läppsynk rörlig [${name}]: arbetare uppkopplad (${m.gpu}, första bit ${m.forsta_bit_ms} ms, ${m.rutor_per_s} rutor/s)`);
      // the lines said at round start have the least time to spare: the worker fetches their sound now, not then
      const base = this.publicBase();
      if (base) try { ws.send(JSON.stringify({ t: 'forhamta', urls: this.#roundStartLines(dealer).map(u => base + u) })); } catch {}
    });
    ws.on('close', () => {
      const before = s.workers.length;
      s.workers = s.workers.filter(w => w.ws !== ws);
      if (pod && s.workers.length < before) s.podAt = Date.now();   // the 20 s before the reserve count from when it left
      if (s.workers.length < before) this.log(`läppsynk rörlig [${name}]: arbetaren kopplade ner`);
      // the last one gone, not a session this server let go of (released, or sent away as too slow)
      if (s.workers.length < before && !s.workers.length && !(Date.now() - (s.releasedAt ?? 0) < 30_000)) this.alert.fail('worker_nere', dealer, `${name} kopplade ner, ingen arbetare kvar`);
    });
    ws.on('error', e => this.alert.fail('callback_fel', dealer, `lipsync-rorlig (${name}): ${e?.message ?? 'socketfel'}`));
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

  // pods are connected, were a moment ago, or this server just started and they have not dialed back yet
  #podsExpected(s) {
    const now = Date.now();
    return s.workers.some(w => w.pod) || now - s.podAt < this.podGraceMs || (this.podToken() && now - this.startedAt < 30_000);
  }

  #order(dealer, force = false) {
    const s = this.s.get(dealer), base = this.publicBase();
    if (!base || this.#podsExpected(s)) return;
    // a cold start (image pull) can take minutes: one order at a time, a new one only after 4 min without a worker
    if (!force && (s.workers.length || Date.now() - s.askedAt < 240_000)) return;
    if (force && Date.now() - s.askedAt < 60_000) return;
    s.askedAt = Date.now();
    const ws_url = `${base.replace(/^http/, 'ws')}/lipsync-rorlig?token=${this.token}&avatar=${encodeURIComponent(dealer)}`;
    this.#api('run', { method: 'POST', body: JSON.stringify({ input: { op: 'session', ws_url, ttl: this.ttlS, avatar: dealer } }) })
      .then(r => r.json()).then(j => { if (j.id) { s.orders.push(j.id); this.log(`läppsynk rörlig [${dealer}]: session beställd (${j.id})`); this.alert.ok('bestallning', dealer); } else this.alert.fail('bestallning', dealer, `RunPod: ${JSON.stringify(j).slice(0, 160)}`), this.log(`läppsynk rörlig [${dealer}]: beställningen misslyckades ${JSON.stringify(j).slice(0, 200)}`); })
      .catch(e => { s.askedAt = 0; this.log(`läppsynk rörlig [${dealer}]: RunPod svarar inte (${e.message})`); this.alert.fail('bestallning', dealer, `RunPod svarar inte (${e.message})`); });
  }

  #tick() {
    const now = Date.now();
    for (const [dealer, s] of this.s) {
      const inUse = s.active && now - s.active < this.inactivityMs;
      const sessions = s.workers.filter(w => !w.pod);
      if (inUse) {
        if (!s.workers.length && s.askedAt && now - s.askedAt > this.sessionWaitMs) this.alert.fail('session_uteblir', dealer, `ingen arbetare ${Math.round((now - s.askedAt) / 1000)} s efter beställningen`);
        if (!s.workers.length) this.#order(dealer);
        else if (sessions.some(w => now - w.at > (this.ttlS - 150) * 1000)) this.#order(dealer, true);   // renew before the session's ttl
      } else if (sessions.length || s.orders.length) {
        // pods stay: only the serverless sessions are released
        if (sessions.length) s.releasedAt = now;
        for (const w of sessions) try { w.ws.send(JSON.stringify({ t: 'bye' })); } catch {}
        for (const id of s.orders.splice(0)) this.#api(`cancel/${id}`, { method: 'POST' }).catch(() => {});
        if (sessions.length) this.log(`läppsynk rörlig [${dealer}]: ingen vid bordet på ${Math.round(this.inactivityMs / 60000)} min — arbetaren släpps`);
        s.active = 0; s.askedAt = 0;
      }
      if (s.orders.length > 8) s.orders.splice(0, s.orders.length - 8);
    }
    for (const [id, t] of this.talks) if (now - t.at > 600_000) this.talks.delete(id);
  }
}
