// K04: spoken-line identity for moving lipsync (O01 2.10). A line keeps its stable lineId (from
// the committed outbox row, outbox-presentation.mjs); every media re-plan of that line (a new mouth
// plan from the worker, a later start) is a higher mediaRevision of the same lineId. K03's
// talkId/ver are never changed for this. A patch is drawn only for the current revision of the
// active line; anything older, or anything for a line that has ended, is dropped, never re-applied.
//
// A line that ended (end, cancel, replaced by the next line) is kept as an ended entry, so a
// redelivered row (open again) or a late patch can never make one of its revisions current again.
// One entry per spoken line of the viewer's session; nothing else is retained.
export function createLineMediaTracker() {
  const lines = new Map(); // lineId -> { revision, ended, seq }
  let opened = 0;
  return {
    // A line from an accepted presentation; idempotent for a redelivered row, also after it ended.
    open(lineId) {
      if (!lines.has(lineId)) lines.set(lineId, { revision: 0, ended: false, seq: ++opened });
      const { revision, ended } = lines.get(lineId);
      return { lineId, revision, ended };
    },
    replan(lineId) {
      const line = lines.get(lineId);
      if (!line) throw new Error('Unknown line');
      if (line.ended) throw new Error('Line has ended');
      line.revision += 1; return { lineId, revision: line.revision };
    },
    check({ lineId, revision }) {
      const line = lines.get(lineId);
      if (!line || !Number.isSafeInteger(revision)) return 'unknown';
      if (line.ended) return 'ended';
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
// in the tracker). Every rejected layer is closed.
export function bindMovingSpeech({ composition, tracker }) {
  if (typeof composition?.setMovingSpeechLayer !== 'function' || !tracker) throw new TypeError('composition and tracker required');
  let owner = null; // { lineId, revision, layer }
  const reject = layer => { layer?.close?.(); return false; };
  return {
    offer({ lineId, revision, layer }) {
      if (tracker.check({ lineId, revision }) !== 'current') return reject(layer);
      if (owner?.lineId === lineId && owner.revision === revision) {
        // Re-delivery of the patch already on screen: applied once, the duplicate layer is closed.
        if (layer !== owner.layer) layer?.close?.();
        return true;
      }
      if (owner && owner.lineId !== lineId) {
        // Only a later line takes over; an earlier one that never drew is over as well.
        if (!tracker.newer(lineId, owner.lineId)) { tracker.close(lineId); return reject(layer); }
        tracker.close(owner.lineId); // the next line ends this one
      }
      composition.setMovingSpeechLayer(layer); owner = { lineId, revision, layer }; return true;
    },
    // The line ended or was cancelled: remove its mouth and end its generation, so a late patch,
    // a redelivered row or a re-open of it can never draw again. A re-plan is `tracker.replan`.
    end(lineId) {
      tracker.close(lineId);
      if (owner?.lineId !== lineId) return false;
      composition.setMovingSpeechLayer(null); owner = null; return true;
    },
    owner: () => owner && { lineId: owner.lineId, revision: owner.revision },
  };
}
