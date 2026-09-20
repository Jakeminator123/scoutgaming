const PRIVATE = /authorization|cookie|password|secret|token|api.?key/i;
export const TRACE_RECORD_LIMIT = 300;
export const TRACE_BYTE_LIMIT = 4 * 1024 * 1024;

// Unlike the on-screen log, observations retain full arrays. No 40-event clipping.
export function sanitizeObservation(value, depth = 0) {
  if (depth > 32) throw new TypeError('Observation too deeply nested');
  if (typeof value === 'string') {
    return value.replace(/https?:\/\/[^\s<>"']+/g, address => {
      try { const url = new URL(address); url.username = ''; url.password = ''; url.search = ''; url.hash = ''; return url.href; }
      catch { return '[ogiltig adress]'; }
    }).replace(/\b(?:ck_live_|cs_|gen_)[A-Za-z0-9_-]{20,}\b/g, '[dolt]');
  }
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(item => sanitizeObservation(item, depth + 1));
  if (typeof value !== 'object') return null;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, PRIVATE.test(key) ? '[dolt]' : sanitizeObservation(item, depth + 1)]));
}

export function createPartnerTrace() { return { records: [], bytes: 0, limited: false }; }
export function appendPartnerTrace(trace, envelope) {
  if (trace.limited) return trace;
  let record;
  try { record = sanitizeObservation(envelope); } catch { return { ...trace, limited: true }; }
  const bytes = new TextEncoder().encode(JSON.stringify(record)).byteLength;
  if (trace.records.length >= TRACE_RECORD_LIMIT || trace.bytes + bytes > TRACE_BYTE_LIMIT) return { ...trace, limited: true };
  return { records: [...trace.records, record], bytes: trace.bytes + bytes, limited: false };
}
export function exportPartnerTrace(trace, { access = null, videoMapping = null, exportedAt = new Date().toISOString() } = {}) {
  return sanitizeObservation({ schemaVersion: 1, kind: 'croupier-partner-observation', exportedAt, access, videoMapping,
    limits: { recordLimit: TRACE_RECORD_LIMIT, byteLimit: TRACE_BYTE_LIMIT, reached: trace.limited },
    evidence: { source: 'Partner SSE', replayAvailable: false, actualVideoPlaybackCaptured: false,
      note: 'Mottagna presentationsinstruktioner och en separat videokarta. Varken klippstart, klippslut eller landningstid har observerats i originalspelaren. Avbrott och protokollgränser kan ge luckor.' },
    records: trace.records });
}
