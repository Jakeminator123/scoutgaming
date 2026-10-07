// One received playback step handed from Uppspelning to Händelser.
// SSR-safe: sessionStorage is touched only inside functions.
export const OBSERVED_STEP_STORAGE_KEY = 'croupier.studio.observed.v1';

function storage() {
  try {
    const candidate = globalThis.sessionStorage;
    if (!candidate || typeof candidate.getItem !== 'function' || typeof candidate.setItem !== 'function' || typeof candidate.removeItem !== 'function') return null;
    return candidate;
  } catch {
    return null;
  }
}

export function saveObservedStep(step) {
  try {
    const store = storage();
    if (!store || !step || typeof step !== 'object' || Array.isArray(step)) return;
    store.setItem(OBSERVED_STEP_STORAGE_KEY, JSON.stringify(step));
  } catch {
    // Private mode and quota failures leave the handoff unused.
  }
}

export function takeObservedStep() {
  const store = storage();
  if (!store) return null;
  let raw = null;
  try { raw = store.getItem(OBSERVED_STEP_STORAGE_KEY); }
  catch { return null; }
  try { store.removeItem(OBSERVED_STEP_STORAGE_KEY); }
  catch { /* A failed delete must not hide a readable step or throw. */ }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}
