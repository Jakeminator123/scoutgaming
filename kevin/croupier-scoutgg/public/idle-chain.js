// Which clip of a talk's idle chain the table shows now (shared-table.js idleChain, app.js next). Gapless: a clip is
// current from LEAD ms before its start until the next one's lead, so the handover on the previous clip's last frame
// (app.js, 1.5 frames before its end) lands on the next clip and never in a gap where a random idle would start.
// (20 Oct: with a 40 ms gap between clips the handover found nothing, dropped the prepared clip, started a random idle,
// and the interval that cuts random idles then kept killing the chain clip while it loaded.)
export const LEAD = 100;

/**
 * talks: state.talk; now: the table clock (ms); shiftOf(t): ms this viewer started the talk late (flexible answers), or
 * null when it has not started here yet. → {talk, clip, next, shift} or null.
 */
export function chainClipAt(talks, now, shiftOf = () => 0) {
  for (const t of talks ?? []) {
    if (!t.idle?.length) continue;
    const shift = shiftOf(t);
    if (shift === null || shift === undefined) continue;
    const at = now - shift;
    let i = -1;
    for (let k = 0; k < t.idle.length; k++) if (at >= t.idle[k].startAt - LEAD) i = k;
    if (i < 0 || at >= t.idle[i].endAt + 40) continue;
    return { talk: t, clip: t.idle[i], next: t.idle[i + 1] ?? null, shift };
  }
  return null;
}

const FPS = 24;
/**
 * A dealer's idle takes laid back to back from `from` to `to` (ms): [{take, startAt, endAt, frames}]. Every take starts
 * and ends on VILA, so the chain joins without a seam and any take can follow it. Deterministic from the seed, weighted
 * like his random idles (vikt), never the same take twice in a row when he has more than one. The same code on the
 * server (a talk's chain, the worker's map) and in every viewer: a longer `to` only extends the same sequence.
 */
/**
 * One of `pool` by weight (vikt, 1 when unset), never the one last picked (by idOf) when there is more than one to choose
 * from (Kevin 21 Oct: never the same clip twice in a row, whatever its weight). rnd: a number in [0, 1).
 */
export function pickWeighted(pool, last, rnd = Math.random, idOf = x => x.id) {
  const cand = pool.length > 1 ? pool.filter(x => idOf(x) !== last) : pool;
  const w = x => (x.vikt > 0 ? x.vikt : 1);
  let r = rnd() * cand.reduce((n, x) => n + w(x), 0), t = cand[cand.length - 1];
  for (const c of cand) if ((r -= w(c)) < 0) { t = c; break; }
  return t;
}

export function layChain(idles, from, to, seed = '', { max = 64 } = {}) {
  const takes = (idles ?? []).filter(i => i?.take && i.frames > 0).map(i => ({ ...i, vikt: i.vikt > 0 ? i.vikt : 1 }));
  if (!takes.length || !(to > from)) return [];
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rnd = () => { h = (Math.imul(h ^ (h >>> 15), 2246822519) + 0x9e3779b9) >>> 0; return h / 2 ** 32; };
  const out = [];
  let at = from, last = null;
  while (at < to && out.length < max) {
    const t = pickWeighted(takes, last, rnd, x => x.take);
    const endAt = at + t.frames * 1000 / FPS;
    out.push({ take: t.take, startAt: Math.round(at * 10) / 10, endAt: Math.round(endAt * 10) / 10, frames: t.frames });
    last = t.take; at = endAt;
  }
  return out;
}

// Kevin 20 Oct: while the table waits for a player (hit or stand, insurance) the dealer does not stand still in his
// pose. From the plan's end, back at VILA, his idle takes run as a chain on the table clock (state.waits, from the
// server), the same for every viewer and for the worker's map, until the next take, which the server starts on a clip
// boundary (until). A wait: {from, until|null, seed, takes: [{take, frames, vikt}]}.
const WAIT_MAX = 400;   // clips (~10 min of 1.6 s takes); a longer wait ends on his still

/** The wait's clips that overlap [from, to): the chain is laid from its start, so every caller gets the same clips. */
export function waitClips(wait, from, to) {
  if (!wait || !(to > wait.from)) return [];
  const end = wait.until ? Math.min(to, wait.until) : to;
  return layChain(wait.takes, wait.from, end, wait.seed, { max: WAIT_MAX }).filter(c => c.endAt > from && c.startAt < end);
}

/** The first clip boundary of the wait at or after `at` (ms): where a take may start without a jump in his face. */
export function waitBoundary(wait, at) {
  if (!wait || at <= wait.from) return wait ? wait.from : at;
  const c = waitClips(wait, at - 1, at + 1).find(c => c.endAt > at);
  return c ? (c.startAt >= at ? c.startAt : c.endAt) : at;
}

/** A talk going on now whose mouth is on his still (no chain of its own): the dealer rests for it, chain or no chain. */
const restingTalk = (talks, now) => (talks ?? []).some(t => !t.idle?.length && now >= (t.kartaStart ?? t.startAt) && now < t.endAt + 300);

/** The wait clip on the table now (same shape as chainClipAt): {talk: 'wait:<seed>', clip, next, shift: 0}, or null. */
export function waitClipAt(waits, now, talks = []) {
  if (restingTalk(talks, now)) return null;
  for (const w of waits ?? []) {
    if (now < w.from - LEAD || (w.until && now >= w.until - LEAD)) continue;
    const clips = waitClips(w, now - 4000, now + 4000);
    let i = -1;
    for (let k = 0; k < clips.length; k++) if (now >= clips[k].startAt - LEAD) i = k;
    if (i < 0 || now >= clips[i].endAt + 40) continue;
    return { talk: { id: 'wait:' + w.seed }, clip: clips[i], next: clips[i + 1] ?? null, shift: 0 };
  }
  return null;
}
