// Session-only diagnostics. Never persist credentials or treat advice as playback.
export const ACTIVITY_LIMIT = 150;
const privateKey = /authorization|cookie|password|secret|token|api.?key/i;

export function safeActivityData(value, depth = 0) {
  if (depth > 6) return '[djup begränsat]';
  if (typeof value === 'string') return value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const shown = value.slice(0, 40).map(item => safeActivityData(item, depth + 1));
    if (value.length > 40) shown.push({ $logTruncation: { kind: 'array', shown: 40, total: value.length, omitted: value.length - 40 } });
    return shown;
  }
  if (typeof value !== 'object') return String(value);
  const entries = Object.entries(value);
  const shown = Object.fromEntries(entries.slice(0, 60).map(([key, item]) => [key, privateKey.test(key) ? '[dolt]' : safeActivityData(item, depth + 1)]));
  if (entries.length > 60) shown.$logTruncation = { kind: 'object', shown: 60, total: entries.length, omitted: entries.length - 60 };
  return shown;
}

export function appendActivity(entries, entry) {
  return [...entries, { ...entry, data: safeActivityData(entry.data) }].slice(-ACTIVITY_LIMIT);
}

// Keep the first real receipt of each idle state on screen. The full bounded
// observation trace still receives every event, including repeated loops.
export function createIdleLogFilter() {
  let media = null; const states = new Set();
  const keep = record => {
    const data = record.data ?? {};
    if (record.kind !== 'playback' || data.event !== 'idle' || typeof data.mediaId !== 'string') {
      if (['playback', 'chat', 'round', 'state'].includes(record.kind) || data.state === 'attached') { media = null; states.clear(); }
      return true;
    }
    if (media !== data.mediaId) { media = data.mediaId; states.clear(); }
    if (!['start', 'presented', 'end', 'completed'].includes(data.state)) return true;
    if (states.has(data.state)) return false;
    states.add(data.state); return true;
  };
  keep.reset = () => { media = null; states.clear(); };
  return keep;
}

export function decisionAttribution(mode, reason, provider) {
  if (mode === 'off') return 'Labbets standardval';
  if (reason === 'local_deal_frequency') return 'Valda utdelningsfrekvenser';
  if (mode === 'shadow' && provider === 'local_deal_frequency') return 'Standardklipp · frekvensprov i skuggläge';
  if (mode === 'rules') return 'Lokal regelmotor';
  if (mode === 'random') return 'Lokal presentationsslump';
  if (reason === 'accepted') return 'OpenClaws förslag + serverns kontroll';
  if (mode === 'shadow') return 'Serverns standardval · modellråd i skuggläge';
  return `Serverns reservval · ${provider || 'inget användbart modellråd'}`;
}

export function eventSummary(event) {
  if (!event || typeof event !== 'object') return 'Inget presentationspayload';
  const fields = [event.type];
  if (event.faceDown) fields.push('dolt kort');
  else if (event.card) fields.push(`${event.card.r ?? '?'}${event.card.s ?? '?'}`);
  if (event.to) fields.push(['box', 'player'].includes(event.to) ? 'spelarsida' : event.to);
  if (Number.isInteger(event.box)) fields.push(`plats ${event.box + 1} (box ${event.box})`);
  if (Number.isInteger(event.handIndex)) fields.push(`handIndex ${event.handIndex}`);
  if (event.line) fields.push(`replik ${event.line}`);
  return fields.filter(Boolean).join(' · ') || 'Publicerade fält';
}
