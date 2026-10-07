// Session log for studio pages. SSR-safe: sessionStorage is touched only inside functions.
import { ACTIVITY_LIMIT } from './activity-log.mjs';

export const ACTIVITY_STORAGE_KEY = 'croupier.studio.activity.v1';
export const ACTIVITY_STORAGE_LIMIT = ACTIVITY_LIMIT;

function storage() {
  const candidate = globalThis.sessionStorage;
  if (!candidate || typeof candidate.getItem !== 'function' || typeof candidate.setItem !== 'function') return null;
  return candidate;
}

export function loadActivities() {
  try {
    const store = storage();
    if (!store) return [];
    const raw = store.getItem(ACTIVITY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-ACTIVITY_STORAGE_LIMIT) : [];
  } catch {
    return [];
  }
}

export function saveActivities(entries) {
  try {
    const store = storage();
    if (!store) return;
    const list = Array.isArray(entries) ? entries.slice(-ACTIVITY_STORAGE_LIMIT) : [];
    store.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Private mode and quota failures leave the in-memory log usable.
  }
}
