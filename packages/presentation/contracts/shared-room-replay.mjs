// Browser-safe reconnect decision shared with the server's outbox projection.
// Current presentation belongs to exactly the snapshot's committed state; callers
// must restore that snapshot before applying it and retain their applied version.
export function reconnectPresentation(snapshot, presentation, { appliedVer = 0 } = {}) {
  if (!snapshot || !Number.isSafeInteger(snapshot.presentationVer)) return { apply: false, reason: 'snapshot_without_presentation_version' };
  if (!presentation) return { apply: false, reason: snapshot.presentationVer === 0 ? 'none' : 'stale_presentation' };
  if (presentation.roomId !== snapshot.roomId) throw new Error('Presentation of another room');
  if (presentation.ver < snapshot.presentationVer) return { apply: false, reason: 'stale_presentation' };
  if (presentation.ver > snapshot.presentationVer) return { apply: false, reason: 'stale_snapshot' };
  if (presentation.ver <= appliedVer) return { apply: false, reason: 'already_applied' };
  return { apply: true, presentation };
}
