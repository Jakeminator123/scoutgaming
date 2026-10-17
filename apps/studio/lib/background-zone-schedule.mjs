const MIN_INTERVAL_MS = 30_000;
const JITTER_MS = 10_000;

export function firstAutomaticDelayMs(random = Math.random) {
  return Math.floor(random() * (JITTER_MS + 1));
}

export function nextAutomaticDelayMs(lastStart, now, random = Math.random) {
  const interval = MIN_INTERVAL_MS + Math.floor(random() * (JITTER_MS + 1));
  return Math.max(0, lastStart + interval - now);
}
