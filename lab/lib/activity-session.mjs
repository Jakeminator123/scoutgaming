// Log entries survive page changes; live observation identities do not.
// Keeping older entries separate must never discard or rewrite their evidence.
export function splitObservationEntries(entries, observationId) {
  const current = [], previous = [];
  for (const entry of entries) {
    (observationId && entry.observationId === observationId ? current : previous).push(entry);
  }
  return { current, previous };
}

export function observationActivity(entry, observationId, context = {}) {
  return { ...entry, observationId, observationContext: { ...context } };
}
