// K04: spoken-line identity for moving lipsync (O01 2.10). A line keeps its stable lineId (from
// the committed outbox row, outbox-presentation.mjs); every media re-plan of that line (a new mouth
// plan from the worker, a later start) is a higher mediaRevision of the same lineId. K03's
// talkId/ver are never changed for this. A patch is drawn only for the current revision of the
// active line; anything older, or anything for a line that has ended, is dropped, never re-applied.
//
// A line that ended (end, cancel, replaced by the next line) is kept as an ended entry, so a
// redelivered row (open again) or a late patch can never make one of its revisions current again.
// One entry per spoken line of the viewer's session; nothing else is retained.
//
// Time window, as Kevin's public/lip-layer.js @ 5aa7ed10 (at() :144-146, silentNow() :159-161):
// a line opened with its window { startAt (its map's first frame, kartaStart), endAt } only draws
// while startAt <= now < endAt + 600 ms (the held last frame). Outside it a patch is refused
// whenever it arrives, and expire() takes a mouth off once the window has passed. Patches that
// arrive before their line is known are root's transport concern (Kevin parks at most 20 talks,
// :134-135); here an unknown line is refused and its layer closed.
export const LINE_GRACE_MS = 600;
export function createLineMediaTracker() {
  const lines = new Map(); // lineId -> { revision, ended, seq, window }
  let opened = 0;
  const windowOf = w => {
    if (w === undefined) return null;
    if (!Number.isFinite(w?.startAt) || !Number.isFinite(w?.endAt) || w.endAt < w.startAt) throw new TypeError('Invalid line window');
    return { startAt: w.startAt, endAt: w.endAt };
  };
  return {
    // A line from an accepted presentation; idempotent for a redelivered row, also after it ended
    // (the first window stays: a redelivery never moves it).
    open(lineId, window) {
      if (!lines.has(lineId)) lines.set(lineId, { revision: 0, ended: false, seq: ++opened, window: windowOf(window) });
      const { revision, ended } = lines.get(lineId);
      return { lineId, revision, ended };
    },
    replan(lineId) {
      const line = lines.get(lineId);
      if (!line) throw new Error('Unknown line');
      if (line.ended) throw new Error('Line has ended');
      line.revision += 1; return { lineId, revision: line.revision };
    },
    // now: the table clock; required for a line opened with a window.
    check({ lineId, revision }, now) {
      const line = lines.get(lineId);
      if (!line || !Number.isSafeInteger(revision)) return 'unknown';
      if (line.ended) return 'ended';
      if (line.window && !(Number.isFinite(now) && now >= line.window.startAt && now < line.window.endAt + LINE_GRACE_MS)) return 'outside';
      return revision === line.revision ? 'current' : revision < line.revision ? 'stale' : 'unknown';
    },
    // Open order: a line opened later belongs to a later accepted presentation.
    newer(lineId, than) { return (lines.get(lineId)?.seq ?? 0) > (lines.get(than)?.seq ?? 0); },
    // The line's generation is over: no revision of it is ever current again.
    close(lineId) { const line = lines.get(lineId); if (line) line.ended = true; },
  };
}

// Adapter onto main's composition contract `setMovingSpeechLayer(layer|null)`
// (packages/presentation/runtime/presentation-composition.mjs). The layer itself (paint/close) is
// main's moving-speech frame layer; transport of patches is root's. Without a worker or with a
// late/stale patch no layer is set: body and recorded audio play without a mouth.
// Acceptance is bound to the active line: a patch for another line than the one speaking now is
// accepted only as the start of a line opened later, which ends the previous one (its generation closes
// in the tracker). The latest line that drew stays the boundary after its end or expiry, so an earlier
// line that never drew can not start once the screen is empty. Every rejected layer is closed.
export function bindMovingSpeech({ composition, tracker, now = () => NaN }) {
  if (typeof composition?.setMovingSpeechLayer !== 'function' || !tracker || typeof now !== 'function') throw new TypeError('composition and tracker required');
  let owner = null; // { lineId, revision, layer }
  let boundary = null; // lineId of the latest line that drew; kept when owner becomes null
  const reject = layer => { layer?.close?.(); return false; };
  return {
    offer({ lineId, revision, layer }) {
      if (tracker.check({ lineId, revision }, now()) !== 'current') return reject(layer);
      if (owner?.lineId === lineId && owner.revision === revision) {
        // Re-delivery of the patch already on screen: applied once, the duplicate layer is closed.
        if (layer !== owner.layer) layer?.close?.();
        return true;
      }
      if (boundary !== null && boundary !== lineId) {
        // Only a later line takes over; an earlier one that never drew is over as well.
        if (!tracker.newer(lineId, boundary)) { tracker.close(lineId); return reject(layer); }
        if (owner) tracker.close(owner.lineId); // the next line ends this one
      }
      composition.setMovingSpeechLayer(layer); owner = { lineId, revision, layer }; boundary = lineId; return true;
    },
    // The line ended or was cancelled: remove its mouth and end its generation, so a late patch,
    // a redelivered row or a re-open of it can never draw again. A re-plan is `tracker.replan`.
    end(lineId) {
      tracker.close(lineId);
      if (owner?.lineId !== lineId) return false;
      composition.setMovingSpeechLayer(null); owner = null; return true;
    },
    // Call on each frame: the mouth leaves once its line's window has passed (Kevin at() stops there).
    expire() {
      if (!owner || tracker.check({ lineId: owner.lineId, revision: owner.revision }, now()) !== 'outside') return false;
      tracker.close(owner.lineId); composition.setMovingSpeechLayer(null); owner = null; return true;
    },
    owner: () => owner && { lineId: owner.lineId, revision: owner.revision },
  };
}
