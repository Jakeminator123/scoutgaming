const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const REVISION = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/;
const INVALID = 'Provspelningen kunde inte öppnas. Servern gav ett ogiltigt svar.';
const errors = {
  studio_preview_revision_conflict: [409, 'Projektet har ändrats. Ladda om miljön och granska ändringarna före provspelning.'],
  studio_preview_limit: [429, 'För många provspelningar är öppna. Vänta en stund och försök igen.'],
  studio_preview_lane_not_found: [404, 'Miljön finns inte längre. Ladda om sidan.'],
  studio_login_required: [401, 'Logga in som administratör igen för att provspela.'],
  studio_preview_forbidden: [403, 'Ditt konto saknar behörighet att provspela i Studio.'],
  studio_preview_origin_rejected: [403, 'Provspelningen måste startas från den inloggade adminytan.'],
  studio_preview_snapshot_unavailable: [503, 'Det sparade projektet kunde inte läsas. Försök igen senare.'],
  studio_preview_media_unavailable: [503, 'Sparade medier kunde inte läsas. Försök igen senare.'],
  studio_preview_unavailable: [503, 'Provspelningen är inte tillgänglig just nu. Försök igen senare.'],
  studio_preview_layer_limit: [422, 'Biblioteket har fler lager än provspelningen stöder. Minska antalet och försök igen.'],
  studio_preview_idle_required: [422, 'Välj en grundloop för startdealern före provspelning.'],
};

/** Start only on an explicit click; accept only the exact session URL from this contract. */
export async function createStudioPreview({presentationLaneId, expectedProjectRevision}, {fetchImpl = globalThis.fetch, signal, now = Date.now} = {}) {
  if (typeof presentationLaneId !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(presentationLaneId)
    || typeof expectedProjectRevision !== 'string' || !REVISION.test(expectedProjectRevision)) {
    throw new Error('Spara miljön före provspelning.');
  }
  let response;
  try {
    response = await fetchImpl('/api/studio-preview', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal,
      headers: {'Content-Type': 'application/json', Accept: 'application/json'},
      body: JSON.stringify({presentationLaneId, expectedProjectRevision}),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Provspelningen kunde inte startas. Kontrollera anslutningen och försök igen.');
  }
  let data;
  try {
    if (!/^application\/json(?:;|$)/i.test(response.headers.get('content-type') ?? '')) throw new Error(INVALID);
    const text = await response.text();
    if (text.length > 16384) throw new Error(INVALID);
    data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(INVALID);
  } catch { throw new Error(INVALID); }
  if (response.status !== 201) {
    const known = typeof data.error === 'string' && Object.hasOwn(errors, data.error) ? errors[data.error] : undefined;
    throw new Error(known?.[0] === response.status ? known[1] : 'Provspelningen kunde inte startas. Försök igen eller ladda om sidan.');
  }
  const expiry = typeof data.expiresAt === 'string' ? Date.parse(data.expiresAt) : NaN;
  if (Object.keys(data).sort().join(',') !== 'entryUrl,expiresAt,presentationLaneId,projectRevision,sessionId'
    || typeof data.sessionId !== 'string' || !UUID.test(data.sessionId)
    || data.presentationLaneId !== presentationLaneId || data.projectRevision !== expectedProjectRevision
    || typeof data.expiresAt !== 'string' || !Number.isFinite(expiry) || expiry <= now()
    || new Date(expiry).toISOString() !== data.expiresAt
    || data.entryUrl !== '/studio-preview/' + data.sessionId) throw new Error(INVALID);
  return {...data};
}
