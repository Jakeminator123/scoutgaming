import { sanitizeObservation, TRACE_RECORD_LIMIT, TRACE_BYTE_LIMIT } from './partner-trace.mjs';
import { eventSummary } from './activity-log.mjs';

// Browser-safe view of received instructions. This neither issues table commands
// nor produces cards, outcomes, playback receipts or missing presentation events.
export const SEQUENCE_STEP_LIMIT = 4096;
const TYPES = ['speak', 'deal', 'reveal', 'settle', 'turn', 'idle'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];
const ACTIONS = ['hit', 'stand', 'double', 'split'];
const OUTCOMES = ['blackjack', 'win', 'push', 'lose'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 256) => typeof value === 'string' && value.length <= max ? value : null;
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const card = value => record(value) && RANKS.includes(value.r) && SUITS.includes(value.s);
const optionalInteger = (value, key, max, nullable = false) => !Object.hasOwn(value, key) || nullable && value[key] === null || integer(value[key], 0, max);
const canonical = value => Array.isArray(value) ? value.map(canonical) : record(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const fingerprint = value => JSON.stringify(canonical(value));

// Conservative preview validation mirrors the public event contract. The real
// resolver validates again on the server before selecting or playing a variant.
function eventProblem(event) {
  if (!record(event) || typeof event.type !== 'string') return 'Eventet saknar en giltig källtyp.';
  if (!TYPES.includes(event.type)) return `Okänd signal: ${event.type.slice(0, 80)}. Ingen labblinje väljs.`;
  if (event.type === 'speak' && !(typeof event.line === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(event.line)
    && (!Object.hasOwn(event, 'blocking') || typeof event.blocking === 'boolean'))) return 'Repliken saknar ett giltigt exakt line-ID.';
  if (event.type === 'deal') {
    const destination = event.to === 'dealer' ? event.box === null : event.to === 'box' && integer(event.box, 0, 6);
    const action = event.to === 'dealer' ? 'deal-dealer' : event.box <= 1 ? 'deal-left' : event.box >= 5 ? 'deal-right' : 'deal-centre';
    if (!destination || typeof event.faceDown !== 'boolean' || !optionalInteger(event, 'handIndex', 31, true)
      || event.clip?.action !== action || !optionalInteger(event, 'shoeDraw', 100000)
      || !event.faceDown && !card(event.card)) return 'Kortdelningens destination, riktning eller publika kortfält är ogiltiga.';
  }
  if (event.type === 'reveal' && !(event.to === 'dealer' && card(event.card) && optionalInteger(event, 'shoeDraw', 100000))) return 'Kortvändningen saknar ett giltigt publicerat kort.';
  if (event.type === 'turn' && !(Object.hasOwn(event, 'box') && Object.hasOwn(event, 'handIndex')
    && optionalInteger(event, 'box', 6, true) && optionalInteger(event, 'handIndex', 31, true)
    && Array.isArray(event.legalActions) && event.legalActions.length <= 4 && event.legalActions.every(action => ACTIONS.includes(action)))) return 'Turmarkeringen saknar giltig plats, hand eller publicerade val.';
  if (event.type === 'settle' && !(integer(event.dealerTotal, 0, 200) && typeof event.dealerBlackjack === 'boolean'
    && Array.isArray(event.hands) && event.hands.length <= 32
    && event.hands.every(hand => record(hand) && integer(hand.box, 0, 6) && OUTCOMES.includes(hand.outcome)))) return 'Resultatet saknar giltiga publicerade handresultat.';
  return null;
}

function valueAt(value, parts) {
  if (!parts.length) return value;
  if (Array.isArray(value)) return value.flatMap(item => valueAt(item, parts));
  return record(value) && Object.hasOwn(value, parts[0]) ? valueAt(value[parts[0]], parts.slice(1)) : undefined;
}
function comparison(actual, op, expected) {
  if (op === 'eq') return actual === expected;
  if (op === 'ne') return actual !== undefined && actual !== expected;
  if (op === 'includes') return Array.isArray(actual) && actual.includes(expected);
  if (op === 'all_eq') return Array.isArray(actual) && actual.length > 0 && actual.every(item => item === expected);
  if (op === 'in') return Array.isArray(expected) && expected.includes(actual);
  if (op === 'exists') return (actual !== undefined && actual !== null) === expected;
  if (typeof actual !== 'number' || typeof expected !== 'number') return false;
  return op === 'gt' ? actual > expected : op === 'gte' ? actual >= expected : op === 'lt' ? actual < expected : op === 'lte' ? actual <= expected : false;
}
function matches(event, node) {
  return node.sourceType === event.type && record(node.match) && Object.entries(node.match).every(([path, rule]) => {
    const actual = valueAt(event, path.split('.'));
    return record(rule) ? Object.entries(rule).every(([op, expected]) => comparison(actual, op, expected)) : actual === rule;
  });
}

export function buildPresentationSequence(records, project) {
  const result = { steps: [], notices: [], duplicates: 0, batchCount: 0, receivedCount: 0, truncated: false };
  if (!Array.isArray(records)) return { ...result, notices: [{ kind: 'invalid', recordIndex: null, message: 'Observationslistan är ogiltig.' }] };
  const correlations = new Map(); const batches = new Set(); const versions = new Map(); const resetFloors = new Map();
  let bytes = 0;
  const addNotice = (kind, recordIndex, message) => result.notices.push({ kind, recordIndex, message });
  for (const [recordIndex, input] of records.slice(0, TRACE_RECORD_LIMIT).entries()) {
    let envelope;
    try {
      envelope = sanitizeObservation(input);
      bytes += new TextEncoder().encode(JSON.stringify(envelope)).byteLength;
    } catch { addNotice('invalid', recordIndex, 'En post kunde inte läsas inom observationsformatet.'); continue; }
    if (bytes > TRACE_BYTE_LIMIT) { result.truncated = true; break; }
    if (!record(envelope)) { addNotice('invalid', recordIndex, 'En post är inte ett observationsobjekt.'); continue; }
    const data = record(envelope.data) ? envelope.data : envelope;
    // Native diagnostics are retained in the full trace, not played as events.
    if (envelope.source === 'native' && ['playback', 'chat', 'state'].includes(envelope.kind)) continue;
    const status = envelope.kind === 'status';
    if (status) {
      const state = text(data.state, 80) || 'okänd';
      if (state === 'observation-reset' && record(data.previousVersionByChannel)) {
        for (const [channel, version] of Object.entries(data.previousVersionByChannel)) if (text(channel) && integer(version, 0, Number.MAX_SAFE_INTEGER)) { resetFloors.set(channel, version); versions.set(channel, version); }
      }
      addNotice(data.gap ? 'gap' : 'connection', recordIndex, `Anslutning: ${state}${text(data.reason) ? ` · ${data.reason}` : ''}. Tidigare eller mellanliggande events kan saknas.`);
      continue;
    }
    const events = data.type === 'round' && Array.isArray(data.events) ? data.events : Array.isArray(data.presentation) ? data.presentation : null;
    if (!events || events.length > 256) { addNotice('invalid', recordIndex, 'Posten saknar en stödd presentationslista (högst 256 instruktioner).'); continue; }
    if (!events.length) continue;
    result.receivedCount++;
    const requestId = text(data.requestId); const version = integer(data.version, 0, Number.MAX_SAFE_INTEGER) ? data.version : null;
    const channel = text(envelope.channel) || 'configured-partner';
    if (version !== null && resetFloors.has(channel) && version <= resetFloors.get(channel)) {
      addNotice('connection', recordIndex, 'Ett tidigare kommando kom efter den nya observationsgränsen. Det sparas som data men spelas inte igen.');
      continue;
    }
    const envelopeId = text(envelope.id); const source = text(envelope.source, 80) || (data.type === 'round' ? 'partner' : 'partner-response');
    const receivedAt = text(envelope.time, 80); const upstreamId = text(envelope.upstreamId);
    const replay = envelope.replay === true || envelope.replayed === true || envelope.origin === 'import';
    const batchKey = requestId && version !== null ? fingerprint([channel, requestId, version])
      : envelopeId ? fingerprint([channel, 'envelope', envelopeId]) : `uncorrelated:${recordIndex}`;
    const uncertainty = [];
    if (!requestId || version === null) uncertainty.push('Request-ID eller version saknas; mottagningar från olika kanaler kan inte säkert slås ihop.');
    if (!receivedAt) uncertainty.push('Mottagningstid saknas.');
    if (!batches.has(batchKey)) {
      const previous = versions.get(channel);
      if (version !== null && previous !== undefined && version < previous) uncertainty.push('Lägre version kom senare. Mottagningsordningen bevaras; ingen spelordning gissas.');
      if (version !== null && previous !== undefined && version > previous + 1) addNotice('gap', recordIndex, `Versionslucka: ${previous} → ${version}. Inga saknade instruktioner fylls i.`);
      if (version !== null) versions.set(channel, Math.max(previous ?? version, version));
      batches.add(batchKey);
    }
    for (const [presentationIndex, rawEvent] of events.entries()) {
      let event = rawEvent;
      const warnings = [...uncertainty];
      // Even a malformed upstream event must not leak a face-down card through
      // the preview, its data inspector, or an eventual director request.
      if (record(event) && event.faceDown === true && event.card != null) {
        event = { ...event, card: null };
        warnings.push('Ett kortvärde på en faceDown-instruktion doldes före visning.');
      }
      const key = `${batchKey}:${presentationIndex}`; const signature = fingerprint(event);
      const receipt = { source, receivedAt, envelopeId, upstreamId, replay, recordIndex };
      const existing = correlations.get(key) ?? [];
      const duplicate = existing.find(step => step.signature === signature);
      if (duplicate) { duplicate.step.deliveries.push(receipt); result.duplicates++; continue; }
      if (result.steps.length >= SEQUENCE_STEP_LIMIT) { result.truncated = true; break; }
      const problem = eventProblem(event);
      const candidates = problem ? [] : (project?.events ?? []).filter(node => matches(event, node));
      const selected = candidates[0];
      const step = { id: `instruction:${recordIndex}:${presentationIndex}`, requestId, version, presentationIndex,
        source, receivedAt, envelopeId, upstreamId, replay, recordIndex, channel,
        op: text(data.op, 80), phase: text(data.phase ?? data.round?.phase, 80),
        event, sourceEvent: event, eventId: selected?.id ?? null, eventLabel: selected?.label ?? null,
        candidateEventIds: candidates.map(node => node.id), label: eventSummary(event).slice(0, 220),
        evidence: 'instruction', actualPlaybackCaptured: false, uncertainty: warnings,
        issue: problem ?? (!selected ? 'Ingen befintlig labblinje matchar signalen.' : null),
        blocked: Boolean(problem || !selected || existing.length), deliveries: [receipt] };
      if (existing.length) {
        const message = 'Samma request-ID, version och index har olika innehåll. Automatisk återspelning är stoppad.';
        step.issue = message;
        for (const item of existing) { item.step.blocked = true; item.step.issue = message; }
        addNotice('conflict', recordIndex, message);
      }
      result.steps.push(step); correlations.set(key, [...existing, { step, signature }]);
    }
    if (result.truncated) break;
  }
  result.batchCount = batches.size;
  if (records.length > TRACE_RECORD_LIMIT) result.truncated = true;
  if (result.truncated) addNotice('limit', null, 'Sekvensgränsen nåddes. Visningen är ofullständig; inga fortsättningssteg har skapats.');
  return result;
}
