// Mouth patches for a ready dealer who speaks his lines over his moving clips (server/rorlig-lipsync.mjs, Emil 12 Oct).
// The server sends each 0.5 s piece as raw H.264 (Annex B, an access unit delimiter before every frame); WebCodecs
// decodes it to one bitmap per frame: colour in the top 256x256, the mask as grey in the bottom half.
// dealer-layer.js asks for the patch of the frame on screen: patch k belongs to time kartaStart + k/24 on the server
// clock, and it is only drawn when its take and frame ARE what the dealer shows (or he rests and the patch says so), so a
// late, early or replanned patch never lands on the wrong body frame.
// A patch is chosen by the body frame on screen (its take and frame), anywhere in the talk within REACH frames of where
// the clock says the talk is: a clip that runs late (a slow phone, a decoder catching up) still gets the mouth made for
// exactly that frame, only a little later against the sound.
// NEIGHBOURS: how many body frames away a patch may be borrowed when the frame on screen has none (a take at tempo 2.5).
const FPS = 24, REACH = 48, NEIGHBOURS = 2;

/** Splits an Annex B stream into access units at each delimiter (NAL type 9): [{data, key}] in order. */
export function splitAccessUnits(buf) {
  const starts = [];
  for (let i = 0; i + 3 < buf.length; i++) {
    if (buf[i] === 0 && buf[i + 1] === 0 && (buf[i + 2] === 1 || (buf[i + 2] === 0 && buf[i + 3] === 1))) {
      const head = buf[i + 2] === 1 ? i + 3 : i + 4;
      starts.push({ at: i, type: buf[head] & 31 });
      i = head;
    }
  }
  const units = [];
  for (let n = 0; n < starts.length; n++) {
    if (starts[n].type !== 9) continue;
    let end = n + 1;
    while (end < starts.length && starts[end].type !== 9) end++;
    const from = starts[n].at, to = end < starts.length ? starts[end].at : buf.length;
    units.push({ data: buf.subarray(from, to), key: starts.slice(n, end).some(s => s.type === 5) });
    n = end - 1;
  }
  return units;
}

export const lipsSupported = () => typeof VideoDecoder === 'function' && typeof EncodedVideoChunk === 'function' && typeof createImageBitmap === 'function';

async function decode(buf) {
  const units = splitAccessUnits(buf), frames = [];
  let failed = null;
  const dec = new VideoDecoder({ output: f => frames.push(createImageBitmap(f).finally(() => f.close())), error: e => { failed = e; } });
  dec.configure({ codec: 'avc1.42E01F', optimizeForLatency: true });
  units.forEach((u, i) => dec.decode(new EncodedVideoChunk({ type: u.key ? 'key' : 'delta', timestamp: Math.round(i * 1e6 / FPS), data: u.data })));
  await dec.flush();
  dec.close();
  if (failed) throw failed;
  return Promise.all(frames);
}

/**
 * The patch keys to look for, for what is on screen: the take's frame; on a held last frame (the clip ended, the frame
 * index may run one past the end, or the player holds the last frame of a take while the next one loads) the take's
 * last known frames; at rest also the still ('vila'). last: take -> the highest frame index any patch of it carries.
 */
export function patchKeys(take, frame, rest, last = new Map()) {
  const keys = [`${take}:${frame}`];
  const top = last.get(take);
  if (top !== undefined && frame >= top) { for (let f = top; f >= top - 2 && f >= 0; f--) if (f !== frame) keys.push(`${take}:${f}`); }
  else if (rest) keys.push(`${take}:${frame - 1}`);
  if (rest) keys.push('vila');
  return keys;
}

export function createLipTracks() {
  // ?lipdebug=1: when each talk became known and each piece arrived, in ms from the talk's first frame (QA only)
  const trace = /[?&]lipdebug=1/.test(globalThis.location?.search ?? '') ? (globalThis.__lipTrace = []) : null;
  const talks = new Map();
  // Pieces pushed before this viewer's next poll shows their talk (the server sends them the moment they are ready).
  const early = new Map();
  let time = () => Date.now();
  const supported = lipsSupported();

  // A new map for a talk (the plan changed under it) is a new version: its patches replace older ones, never the reverse.
  async function piece(t, meta, bytes = null) {
    const ver = meta.ver ?? 1, seen = `${ver}:${meta.del}`;
    if (t.seen.has(seen) || !supported || ver < t.ver) return;
    t.seen.add(seen); t.ver = Math.max(t.ver, ver);
    try {
      if (!bytes) {   // catching up (joined mid-line, missed a push): fetch it
        const r = await fetch(`/api/lip/${t.id}/${meta.del}?v=${ver}`);
        if (!r.ok) throw new Error(r.status);
        bytes = new Uint8Array(await r.arrayBuffer());
      }
      const bitmaps = await decode(bytes);
      trace?.push(`${Math.round(time() - t.kartaStart)} bit ${meta.del} v${ver} klar`);
      if (!talks.has(t.id)) { bitmaps.forEach(b => b.close()); return; }
      bitmaps.forEach((bitmap, i) => {
        const tag = meta.rutor?.[i], k = meta.fran + i, old = t.frames[k];
        if (old && old.ver > ver) { bitmap.close(); return; }
        old?.bitmap.close();
        if (tag) { t.frames[k] = { bitmap, tag, ver }; t.silent.delete(k); const key = tag.tagning === 'vila' ? 'vila' : `${tag.tagning}:${tag.ruta}`; (t.index.get(key) ?? t.index.set(key, new Set()).get(key)).add(k); if (tag.tagning !== 'vila' && (t.last.get(tag.tagning) ?? -1) < tag.ruta) t.last.set(tag.tagning, tag.ruta); }
        else { bitmap.close(); t.frames[k] = undefined; t.silent.add(k); }
      });
    } catch { t.seen.delete(seen); }
  }

  // A viewer who joins mid-line, or misses a push, catches up from the index until the line is done.
  async function catchUp(t) {
    if (t.polling || !supported) return;
    t.polling = true;
    try {
      while (talks.has(t.id) && time() < t.endAt + 1000) {
        const r = await fetch(`/api/lip/${t.id}`).catch(() => null);
        const ix = r?.ok ? await r.json() : null;
        for (const meta of ix?.delar ?? []) piece(t, { ...meta, ver: meta.ver ?? ix.ver });
        if (ix?.klar || ix?.fel) break;
        await new Promise(res => setTimeout(res, 400));
      }
    } finally { t.polling = false; }
  }

  return {
    supported,
    setClock(fn) { time = fn; },
    /**
     * A talk of the table (state.talk[i]). lips: false when this viewer hears another language than the mouth was synced to,
     * or a flexible answer has not started here yet. shift: ms this viewer started it after its time (flexible answers).
     */
    talk(t, lips = true, shift = 0) {
      let x = talks.get(t.id);
      if (!x) {
        x = { ...t, frames: [], index: new Map(), last: new Map(), silent: new Set(), seen: new Set(), polling: false, ver: 0, lips, shift }; talks.set(t.id, x);
        trace?.push(`${Math.round(time() - t.kartaStart)} replik ${t.kind}/${t.event ?? ''} känd, ${early.get(t.id)?.length ?? 0} bitar väntade`);
        for (const [m, bytes] of early.get(t.id) ?? []) piece(x, m, bytes);
        early.delete(t.id);
        catchUp(x);
      }
      x.lips = lips; x.shift = shift;
      Object.assign(x, { startAt: t.startAt, endAt: t.endAt, kartaStart: t.kartaStart });   // a line moved after an answer
    },
    /** The server pushed a piece ({t:'lip', talk, del, fran, till, rutor}) with its bytes. */
    push(m, bytes = null) {
      const t = talks.get(m.talk);
      trace?.push(`${t ? Math.round(time() - t.kartaStart) : '?'} push bit ${m.del}`);
      if (t) return piece(t, m, bytes);
      if (!early.has(m.talk)) { if (early.size > 20) early.delete(early.keys().next().value); early.set(m.talk, []); }
      early.get(m.talk).push([m, bytes]);
    },
    /** True while a line's mouth may be on screen: the layer then redraws for every new patch, even on a still frame. */
    active() { for (const t of talks.values()) { const n = time() - t.shift; if (t.lips && n >= t.kartaStart && n < t.endAt + 600) return true; } return false; },
    /**
     * The patch for what is on screen: take = file name of the clip shown (pos4-iv), frame = its frame index, rest = the
     * dealer rests (his still, or a take that ended at rest). → {bitmap, rect, key} or null.
     */
    at(take, frame, rest) {
      for (const t of talks.values()) {
        const n = time() - t.shift;
        if (!t.lips || n < t.kartaStart || n >= t.endAt + 600) continue;
        const k = Math.floor((n - t.kartaStart) * FPS / 1000);
        let best = -1;
        // at rest on a clip's last frame the layer may count one frame past the map (floor of its end time): that frame's
        // patch is for the same VILA pose
        for (const key of patchKeys(take, frame, rest, t.last))
          for (const j of t.index.get(key) ?? []) if (Math.abs(j - k) <= REACH && (best < 0 || Math.abs(j - k) < Math.abs(best - k))) best = j;
        // Emil 28 Oct (a table's tempo): a take at 2x or 2.5x shows 2-2.5 body frames per patch, so the frames between get
        // the patch of the nearest frame of the same take (one or two frames of head movement away) instead of no mouth
        for (let d = 1; best < 0 && d <= NEIGHBOURS; d++)
          for (const f of [frame - d, frame + d])
            for (const j of t.index.get(`${take}:${f}`) ?? []) if (Math.abs(j - k) <= REACH && (best < 0 || Math.abs(j - k) < Math.abs(best - k))) best = j;
        if (best >= 0) { const e = t.frames[best]; return { bitmap: e.bitmap, rect: e.tag.rect, key: `${t.id}:${best}` }; }
      }
      return null;
    },
    /** True when the talk is silent at this moment (a pause, its ramp in or out): no mouth patch on purpose. */
    silentNow() {
      for (const t of talks.values()) {
        const n = time() - t.shift;
        if (t.lips && n >= t.kartaStart && n < t.endAt + 600) return t.silent.has(Math.floor((n - t.kartaStart) * FPS / 1000));
      }
      return false;
    },
    /** Why at() found nothing (QA, ?lipdebug=1): the frame index it looked at and the nearest patch it had. */
    why(take, frame) {
      for (const t of talks.values()) {
        const n = time() - t.shift;
        if (!t.lips || n < t.kartaStart || n >= t.endAt + 600) continue;
        const k = Math.floor((n - t.kartaStart) * FPS / 1000);
        let best = null;
        for (let d = 0; d <= REACH && !best; d++) for (const j of d ? [k - d, k + d] : [k]) if (t.frames[j]) { best = `${j - k}:${t.frames[j].tag.tagning}:${t.frames[j].tag.ruta}`; break; }
        return `k${k} ${best ?? (t.frames.length ? 'inga nära' : 'inga bitar än')}`;
      }
      return 'ingen replik';
    },
    /** Lines of finished plans: their bitmaps go. */
    prune() {
      const n = time();
      for (const [id, t] of talks) if (n - t.shift > t.endAt + 5000) { t.frames.forEach(e => e?.bitmap.close()); talks.delete(id); }
    },
  };
}
