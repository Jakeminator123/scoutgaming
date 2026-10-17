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

export function createPartnerTrace({ rolling = false } = {}) {
  return { records: [], bytes: 0, limited: false, ...(rolling ? { rolling: true, droppedRecords: 0 } : {}) };
}
export function restartPartnerTrace(previous, { time = new Date().toISOString(), observedVersions = {} } = {}) {
  const previousVersionByChannel = Object.create(null);
  const previousNativeSequenceByChannel = Object.create(null);
  for (const record of previous.records) {
    const channel = typeof record.channel === 'string' ? record.channel : 'configured-partner';
    const version = record.data?.version;
    if (Number.isSafeInteger(version) && version >= 0) previousVersionByChannel[channel] = Math.max(previousVersionByChannel[channel] ?? -1, version);
    if (record.source === 'native' && Number.isSafeInteger(record.nativeSequence)) previousNativeSequenceByChannel[channel] = Math.max(previousNativeSequenceByChannel[channel] ?? -1, record.nativeSequence);
    for (const [id, sequence] of Object.entries(record.data?.previousNativeSequenceByChannel ?? {})) if (Number.isSafeInteger(sequence)) previousNativeSequenceByChannel[id] = Math.max(previousNativeSequenceByChannel[id] ?? -1, sequence);
  }
  const boundaries = [observedVersions, ...previous.records.filter(record => record.data?.state === 'observation-reset').map(record => record.data.previousVersionByChannel)];
  for (const boundary of boundaries) for (const [channel, version] of Object.entries(boundary ?? {})) if (Number.isSafeInteger(version) && version >= 0) previousVersionByChannel[channel] = Math.max(previousVersionByChannel[channel] ?? -1, version);
  return appendPartnerTrace(createPartnerTrace({ rolling: previous.rolling }), { source: 'lab-observer', kind: 'status', time,
    data: { state: 'observation-reset', reason: 'user-started-new-observation', gap: true, replay: false,
      discardedRecords: previous.records.length, previousLimited: previous.limited, previousVersionByChannel, previousNativeSequenceByChannel } });
}
export function appendPartnerTrace(trace, envelope) {
  if (trace.limited) return trace;
  let record;
  try { record = sanitizeObservation(envelope); } catch { return { ...trace, limited: true }; }
  const bytes = new TextEncoder().encode(JSON.stringify(record)).byteLength;
  if (trace.rolling) {
    // Lissabon follows Web directly. Keep observing rather than freezing after
    // idle diagnostics fill the window. Export an explicit, replay-safe boundary.
    const size = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;
    const records = [...trace.records, record];
    let total = trace.bytes + bytes, droppedRecords = trace.droppedRecords ?? 0;
    const previousVersionByChannel = Object.create(null);
    const previousNativeSequenceByChannel = Object.create(null);
    const remember = old => {
      for (const [channel, sequence] of Object.entries(old.data?.previousNativeSequenceByChannel ?? {})) if (Number.isSafeInteger(sequence)) previousNativeSequenceByChannel[channel] = Math.max(previousNativeSequenceByChannel[channel] ?? -1, sequence);
      if (old.source === 'native' && Number.isSafeInteger(old.nativeSequence)) previousNativeSequenceByChannel[old.channel ?? 'configured-partner'] = Math.max(previousNativeSequenceByChannel[old.channel ?? 'configured-partner'] ?? -1, old.nativeSequence);
      for (const [channel, version] of Object.entries(old.data?.previousVersionByChannel ?? {})) {
        if (Number.isSafeInteger(version) && version >= 0) previousVersionByChannel[channel] = Math.max(previousVersionByChannel[channel] ?? -1, version);
      }
      const version = old.data?.version, channel = old.channel ?? 'configured-partner';
      if (Number.isSafeInteger(version) && version >= 0) previousVersionByChannel[channel] = Math.max(previousVersionByChannel[channel] ?? -1, version);
    };
    if (records[0]?.data?.reason === 'rolling-window') {
      const old = records.shift(); total -= size(old); remember(old);
    }
    if (!droppedRecords && records.length <= TRACE_RECORD_LIMIT && total <= TRACE_BYTE_LIMIT) {
      return { ...trace, records, bytes: total, limited: false };
    }
    const boundary = () => ({ source: 'lab-observer', kind: 'status', time: record.time,
      data: { state: 'observation-reset', reason: 'rolling-window', gap: true, replay: false, droppedRecords, previousVersionByChannel, previousNativeSequenceByChannel } });
    while (records.length && (records.length + 1 > TRACE_RECORD_LIMIT || total + size(boundary()) > TRACE_BYTE_LIMIT)) {
      const old = records.shift(); total -= size(old); remember(old); droppedRecords++;
    }
    const marker = boundary();
    if (size(marker) > TRACE_BYTE_LIMIT) return { ...trace, limited: true };
    return { ...trace, records: [marker, ...records], bytes: total + size(marker), limited: false, droppedRecords };
  }
  if (trace.records.length >= TRACE_RECORD_LIMIT || trace.bytes + bytes > TRACE_BYTE_LIMIT) return { ...trace, limited: true };
  return { records: [...trace.records, record], bytes: trace.bytes + bytes, limited: false };
}
export function exportPartnerTrace(trace, { access = null, videoMapping = null, exportedAt = new Date().toISOString() } = {}) {
  const native = trace.records.filter(record => record.source === 'native');
  const playback = native.filter(record => record.kind === 'playback');
  const source = native.length ? trace.records.some(record => record.source === 'partner') ? 'Partner SSE + native popup observation' : 'native popup observation' : 'Partner SSE';
  return sanitizeObservation({ schemaVersion: 1, kind: 'croupier-partner-observation', exportedAt, access, videoMapping,
    limits: { recordLimit: TRACE_RECORD_LIMIT, byteLimit: TRACE_BYTE_LIMIT, reached: trace.limited || (trace.droppedRecords ?? 0) > 0,
      ...(trace.rolling ? { mode: 'rolling', droppedRecords: trace.droppedRecords ?? 0 } : {}) },
    evidence: { source, replayAvailable: false,
      actualVideoPlaybackCaptured: playback.some(record => ['start', 'end', 'presented', 'landed'].includes(record.data?.state)),
      nativePlaybackRecords: playback.length,
      note: native.length ? 'Originalets offentliga serversvar, chatt och tillgängliga uppspelningskvitton tillsammans med Partner-instruktioner. Klippval är inte uppspelning; kvittona bevisar inte visuell kvalitet. Avbrott och protokollgränser kan ge luckor.' : 'Mottagna presentationsinstruktioner och en separat videokarta. Varken klippstart, klippslut eller landningstid har observerats i originalspelaren. Avbrott och protokollgränser kan ge luckor.' },
    records: trace.records });
}
