// K04: spoken-line identity for moving lipsync (O01 2.10). A line keeps its stable lineId (from
// the committed outbox row, outbox-presentation.mjs); every media re-plan of that line (a new mouth
// plan from the worker, a later start) is a higher mediaRevision of the same lineId. K03's
// talkId/ver are never changed for this. A patch is drawn only for the current revision of a
// line; anything older is dropped, never re-applied.
export function createLineMediaTracker() {
  const lines = new Map(); // lineId -> revision
  return {
    // A line from an accepted presentation; idempotent for a redelivered row.
    open(lineId) { if (!lines.has(lineId)) lines.set(lineId, 0); return { lineId, revision: lines.get(lineId) }; },
    replan(lineId) {
      if (!lines.has(lineId)) throw new Error('Unknown line');
      const revision = lines.get(lineId) + 1; lines.set(lineId, revision); return { lineId, revision };
    },
    check({ lineId, revision }) {
      if (!lines.has(lineId)) return 'unknown';
      const current = lines.get(lineId);
      return revision === current ? 'current' : revision < current ? 'stale' : 'unknown';
    },
    close(lineId) { lines.delete(lineId); },
  };
}

// Adapter onto main's composition contract `setMovingSpeechLayer(layer|null)`
// (packages/presentation/runtime/presentation-composition.mjs). The layer itself (paint/close) is
// main's moving-speech frame layer; transport of patches is root's. Without a worker or with a
// late/stale patch no layer is set: body and recorded audio play without a mouth.
export function bindMovingSpeech({ composition, tracker }) {
  if (typeof composition?.setMovingSpeechLayer !== 'function' || !tracker) throw new TypeError('composition and tracker required');
  let owner = null; // { lineId, revision }
  return {
    offer({ lineId, revision, layer }) {
      if (tracker.check({ lineId, revision }) !== 'current') { layer?.close?.(); return false; }
      composition.setMovingSpeechLayer(layer); owner = { lineId, revision }; return true;
    },
    // The line ended, was cancelled or its media was re-planned: remove its mouth.
    end(lineId) {
      if (owner?.lineId !== lineId) return false;
      composition.setMovingSpeechLayer(null); owner = null; return true;
    },
    owner: () => owner && { ...owner },
  };
}
