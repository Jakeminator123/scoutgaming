// Mät speltid: Admins väg till POST /studio/api/videos/measure-timing. Servern läser filen,
// mäter tidslinjen och sparar kvittot; klienten skickar bara identitet och revision.
const MEASURE_URL = '/studio/api/videos/measure-timing';
const SHA256 = /^[a-f0-9]{64}$/;

/** Ett klipp som servern kan mäta: eget uppladdat MP4-klipp med revision, inte arkiverat eller raderat. */
export function timingMeasurable(video) {
  return Boolean(video && typeof video.id === 'string' && typeof video.revision === 'string' && SHA256.test(video.sha256 ?? '')
    && video.contentType === 'video/mp4' && video.classification && !video.classification.archived
    && !video.retainedBank && !video.familyId && !video.deletion);
}
export const timingMeasured = video => Boolean(video?.mediaTiming);

/** Dealerns klipp som kan mätas men saknar mätning, i registrets ordning. */
export function unmeasuredClips(inventory, dealerId) {
  return (inventory?.videos ?? []).filter(video => video.classification?.dealerId === dealerId && timingMeasurable(video) && !timingMeasured(video));
}

export function timingErrorMessage(status, code, error) {
  if (code === 'studio_retained_media_immutable') return 'Klippet hör till den bevarade banken och mäts inte här.';
  if (code === 'studio_media_deletion_pending' || code === 'studio_media_archived') return 'Klippet är arkiverat eller på väg att raderas och kan inte mätas.';
  if (typeof code === 'string' && typeof error === 'string' && error && error !== code && !error.startsWith('studio_')) return error;
  if (status === 409) return 'Klippet har ändrats sedan registret lästes in. Läs om registret och mät igen.';
  if (status === 404) return 'Klippet finns inte längre i registret.';
  if (status === 401 || status === 403) return 'Logga in igen för att mäta speltid.';
  if (status === 408) return 'Mätningen avbröts innan den blev klar.';
  if (status === 400 || status === 422) return 'Klippet kan inte mätas. Bara registrerade MP4-klipp hos en sparad dealer kan mätas.';
  return 'Mätningen kunde inte bekräftas' + (status ? ' (' + status + ')' : '') + '. Läs om registret och försök igen.';
}

export class TimingError extends Error {
  constructor(message, status = 0) { super(message); this.name = 'TimingError'; this.status = status; }
}

/** Mäter ett klipp. Returnerar klippet med serverns nya revision och mätning. */
export async function measureClipTiming(video, { fetchImpl = fetch, signal } = {}) {
  if (!timingMeasurable(video)) throw new TimingError('Klippet kan inte mätas här.');
  let response;
  try {
    response = await fetchImpl(MEASURE_URL, { method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal,
      headers: { 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ id: video.id, sha256: video.sha256, expectedRevision: video.revision }) });
  } catch (cause) {
    if (signal?.aborted) throw new TimingError('Mätningen avbröts innan den blev klar.', 408);
    throw new TimingError(timingErrorMessage(0));
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new TimingError(timingErrorMessage(response.status, result?.code, result?.error), response.status);
  const media = result?.media;
  if (!media || media.id !== video.id || !media.mediaTiming) throw new TimingError(timingErrorMessage(0));
  return { ...video, mediaTiming: media.mediaTiming, ...(typeof media.revision === 'string' ? { revision: media.revision } : {}) };
}

/** Mäter klippen ett i taget. Ett fel stoppar inte resten; `onProgress` får räknaren efter varje klipp. */
export async function measureClipsInOrder(videos, { fetchImpl = fetch, signal, onProgress } = {}) {
  const measured = [], failed = [];
  for (const video of videos) {
    if (signal?.aborted) break;
    try { measured.push(await measureClipTiming(video, { fetchImpl, signal })); }
    catch (cause) { failed.push({ id: video.id, label: video.label ?? video.id, message: cause instanceof Error ? cause.message : timingErrorMessage(0) }); }
    onProgress?.({ done: measured.length + failed.length, total: videos.length, failed: failed.length });
  }
  return { measured, failed };
}
