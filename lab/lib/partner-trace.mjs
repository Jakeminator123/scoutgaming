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
export function restartPartnerTrace(previous, { time = new Date().toISOString(), observedVersions = {} } = {}) {
  const previousVersionByChannel = Object.create(null);
  for (const record of previous.records) {
    const channel = typeof record.channel === 'string' ? record.channel : 'configured-partner';
    const version = record.data?.version;
    if (Number.isSafeInteger(version) && version >= 0) previousVersionByChannel[channel] = Math.max(previousVersionByChannel[channel] ?? -1, version);
  }
  const boundaries = [observedVersions, ...previous.records.filter(record => record.data?.state === 'observation-reset').map(record => record.data.previousVersionByChannel)];
  for (const boundary of boundaries) for (const [channel, version] of Object.entries(boundary ?? {})) if (Number.isSafeInteger(version) && version >= 0) previousVersionByChannel[channel] = Math.max(previousVersionByChannel[channel] ?? -1, version);
  return appendPartnerTrace(createPartnerTrace(), { source: 'lab-observer', kind: 'status', time,
    data: { state: 'observation-reset', reason: 'user-started-new-observation', gap: true, replay: false,
      discardedRecords: previous.records.length, previousLimited: previous.limited, previousVersionByChannel } });
}
export function appendPartnerTrace(trace, envelope) {
  if (trace.limited) return trace;
  let record;
  try { record = sanitizeObservation(envelope); } catch { return { ...trace, limited: true }; }
  const bytes = new TextEncoder().encode(JSON.stringify(record)).byteLength;
  if (trace.records.length >= TRACE_RECORD_LIMIT || trace.bytes + bytes > TRACE_BYTE_LIMIT) return { ...trace, limited: true };
  return { records: [...trace.records, record], bytes: trace.bytes + bytes, limited: false };
}
export function exportPartnerTrace(trace, { access = null, videoMapping = null, exportedAt = new Date().toISOString() } = {}) {
  const native = trace.records.filter(record => record.source === 'native');
  const playback = native.filter(record => record.kind === 'playback');
  return sanitizeObservation({ schemaVersion: 1, kind: 'croupier-partner-observation', exportedAt, access, videoMapping,
    limits: { recordLimit: TRACE_RECORD_LIMIT, byteLimit: TRACE_BYTE_LIMIT, reached: trace.limited },
    evidence: { source: native.length ? 'Partner SSE + native popup observation' : 'Partner SSE', replayAvailable: false,
      actualVideoPlaybackCaptured: playback.some(record => ['start', 'end', 'presented', 'landed'].includes(record.data?.state)),
      nativePlaybackRecords: playback.length,
      note: native.length ? 'Originalets offentliga serversvar, chatt och tillgängliga uppspelningskvitton tillsammans med Partner-instruktioner. Klippval är inte uppspelning; kvittona bevisar inte visuell kvalitet. Avbrott och protokollgränser kan ge luckor.' : 'Mottagna presentationsinstruktioner och en separat videokarta. Varken klippstart, klippslut eller landningstid har observerats i originalspelaren. Avbrott och protokollgränser kan ge luckor.' },
    records: trace.records });
}
