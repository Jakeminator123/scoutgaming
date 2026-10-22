// K04: room-scoped idle chain while the table waits for a player, laid from server state (the
// accepted presentation row), the same for every viewer. Port of Kevin's public/idle-chain.js
// @ 5aa7ed10 (pickWeighted, layChain, waitClips, waitBoundary, restingPool); the deterministic
// sequence is byte-for-byte the same function so viewers and Kevin's worker map agree.
// Main's live-idle controller keeps its own per-viewer random base (policy base 1-4) for every
// existing caller; shared rooms use its explicit mode 'server-chain' (packages/presentation/runtime/
// live-idle.mjs), fed by serverChainEntry below (mapping gap I2), with each clip bound to its exact
// catalogue file through media-catalogue.mjs bindIdle. The dealer's whole calm pool is followed;
// nothing is trimmed to four.
const FPS = 24, WAIT_MAX = 400, LEAD = 100;

export function pickWeighted(pool, last, rnd, idOf = x => x.id) {
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

export function waitClips(wait, from, to) {
  if (!wait || !(to > wait.from)) return [];
  const end = wait.until ? Math.min(to, wait.until) : to;
  return layChain(wait.takes, wait.from, end, wait.seed, { max: WAIT_MAX }).filter(c => c.endAt > from && c.startAt < end);
}

// First clip boundary at or after `at`: where the next take may start without a jump in his face.
export function waitBoundary(wait, at) {
  if (!wait || at <= wait.from) return wait ? wait.from : at;
  const c = waitClips(wait, at - 1, at + 1).find(c => c.endAt > at);
  return c ? (c.startAt >= at ? c.startAt : c.endAt) : at;
}

// Waiting is calm (Kevin 21 Oct): only calm takes; a dealer without any keeps all of his.
export function restingPool(idles) {
  const calm = (idles ?? []).filter(i => i.calm);
  return calm.length ? calm : (idles ?? []);
}

// The wait a presentation opens: after a committed plan that leaves the table waiting for a
// decision (decisions/insurance), from the plan's end, seeded by its planId. takes: the dealer's
// idle takes [{take, frames, vikt, calm}] from its verified meta/catalogue. Else null.
export function roomWait(row, takes) {
  const p = row?.payload?.presentation, phase = p?.after?.round?.phase;
  if (p?.kind !== 'plan' || !['decisions', 'insurance'].includes(phase) || !row.payload.planId) return null;
  const pool = restingPool(takes).map(({ take, frames, vikt }) => ({ take, frames, vikt: vikt ?? 1 }));
  return pool.length ? { from: row.payload.endAt, until: null, seed: row.payload.planId, takes: pool } : null;
}

// The next accepted plan ends the wait on a clip boundary (Kevin sequence(): open.until).
export const endWait = (wait, nextStartAt) => wait && { ...wait, until: waitBoundary(wait, nextStartAt) };

// The wait clip on the table at `now`, or null.
export function waitClipAt(wait, now) {
  if (!wait || now < wait.from - LEAD || (wait.until && now >= wait.until - LEAD)) return null;
  const clips = waitClips(wait, now - 4000, now + 4000);
  let i = -1;
  for (let k = 0; k < clips.length; k++) if (now >= clips[k].startAt - LEAD) i = k;
  return i < 0 || now >= clips[i].endAt + 40 ? null : { clip: clips[i], next: clips[i + 1] ?? null };
}

// Adapter input for main's live-idle 'server-chain' mode: the wait clip on the table at `now` as
// {ver, startAt, endAt, videoId}. `ver` is the accepted presentation's outbox ver (the chain's
// order key with startAt); videoIdOf maps Kevin's take name to the room inventory's video id of
// that exact catalogue file. No clip on the table: null. An unmapped take refuses (no fallback).
export function serverChainEntry(ver, wait, now, videoIdOf) {
  const at = waitClipAt(wait, now);
  if (!at) return null;
  const videoId = videoIdOf(at.clip.take);
  if (typeof videoId !== 'string' || !videoId) throw new Error(`No inventory video for idle take ${at.clip.take}`);
  return { ver, startAt: at.clip.startAt, endAt: at.clip.endAt, videoId };
}
