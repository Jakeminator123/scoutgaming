// Emil (11 Oct): a dealer's chat answer was cut off whenever the table moved on (deal, card, result). The table runs on
// the server's shared timeline, so it never waits for one viewer's answer; instead an answer only starts when it can
// finish before the table may need the screen, and otherwise waits in the queue for the next calm moment.

/** Lead kept free before the table's next possible step (decode, a late tap). */
export const ANSWER_MARGIN_MS = 800;
/** Assumed length of an answer whose clip length is not known yet. */
export const UNKNOWN_ANSWER_S = 8;

/** True when an answer of `dur` seconds finishes `margin` ms before the table may need the screen. */
export function answerFits(dur, quietMs, margin = ANSWER_MARGIN_MS) {
  const ms = (Number.isFinite(dur) && dur > 0 ? dur : UNKNOWN_ANSWER_S) * 1000;
  return ms + margin <= quietMs;
}

/**
 * Index of the queue item to play next, or -1 (idle).
 * In a round only the dealer's own remarks play (between deals); an answer waits until it fits the quiet time
 * (quietMs is 0 throughout a round, so answers given mid-round play after it). Other items keep their order.
 */
export function pickQueued(queue, { playing, quietMs }) {
  const ready = (q) => q.kind !== 'answer' || answerFits(q.dur, quietMs);
  return queue.findIndex((q) => (!playing || q.kind === 'remark' || q.kind === 'answer') && ready(q));
}

/** Clip length in seconds from the file's metadata, or null (the server sends no length for Dragge's and Paow's answers). */
export function clipDuration(url, { timeoutMs = 4000, doc = globalThis.document } = {}) {
  return new Promise((resolve) => {
    if (!doc || !url) return resolve(null);
    const v = doc.createElement('video');
    let settled = false;
    const done = (d) => { if (settled) return; settled = true; clearTimeout(t); v.removeAttribute('src'); v.load?.(); resolve(Number.isFinite(d) && d > 0 ? d : null); };
    const t = setTimeout(() => done(null), timeoutMs);
    v.preload = 'metadata'; v.muted = true;
    v.onloadedmetadata = () => done(v.duration);
    v.onerror = () => done(null);
    v.src = url;
  });
}
