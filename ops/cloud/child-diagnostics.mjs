// Production children keep their stdout discarded except for this allowlist of
// finite moving-speech/drift diagnostics. Every forwarded field is an enum, a
// safe application code or a bounded identifier; text, URLs, tickets, provider
// responses and arbitrary objects never reach the parent log.
import { sanitizeDriftGuardDiagnostic } from '../../services/game/moving-drift-diagnostics.mjs';

const CODE = /^[a-z][a-z0-9_]{0,63}$/, PHASE = /^[a-z][a-z0-9_-]{0,63}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, HEX32 = /^[a-f0-9]{32}$/;
const DEALER = /^[a-z][a-z0-9-]{0,39}$/;
const READBACK_PHASES = new Set(['claim', 'configuration', 'cancel', 'reconcile', 'provider_observation', 'session_read', 'controller_observe']);
const own = (value, key) => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
};
const pick = (value, fields) => {
  const output = {};
  for (const [key, accept] of Object.entries(fields)) {
    const candidate = own(value, key);
    if (!accept(candidate)) return null;
    output[key] = candidate;
  }
  return output;
};
const oneOf = set => candidate => set.has(candidate);
const code = candidate => typeof candidate === 'string' && CODE.test(candidate);
const phase = candidate => typeof candidate === 'string' && PHASE.test(candidate);
const nullableId = pattern => candidate => candidate === null || typeof candidate === 'string' && pattern.test(candidate);
const receipt = value => pick(value, { code, phase, streamId: nullableId(HEX32), requestId: nullableId(UUID) });

export const CHILD_DIAGNOSTIC_EVENTS = Object.freeze({
  moving_drift_guard_rejected: value => { const { event: _event, ...rest } = value; return sanitizeDriftGuardDiagnostic(rest); },
  moving_drift_readback_timing: value => pick(value, { phase: oneOf(READBACK_PHASES), result: oneOf(new Set(['success', 'failure'])),
    durationClass: oneOf(new Set(['fast', 'slow', 'overdue', 'invalid'])) }),
  moving_drift_readback_failed: value => pick(value, { code }),
  moving_speech_preparation_failed: receipt,
  moving_speech_stream_interrupted: receipt,
  moving_speech_recovery: value => pick(value, { dealerId: candidate => typeof candidate === 'string' && DEALER.test(candidate),
    unresolved: candidate => Number.isSafeInteger(candidate) && candidate >= 0 && candidate <= 100000 }),
  moving_speech_cleanup_requires_recovery: () => ({}),
});

export function safeChildDiagnosticLine(line) {
  if (typeof line !== 'string' || line.length > 4096 || !line.startsWith('{')) return null;
  let value;
  try { value = JSON.parse(line); } catch { return null; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const event = own(value, 'event');
  const accept = typeof event === 'string' && Object.hasOwn(CHILD_DIAGNOSTIC_EVENTS, event) ? CHILD_DIAGNOSTIC_EVENTS[event] : null;
  if (!accept) return null;
  let output;
  try { output = accept(value); } catch { return null; }
  return output ? JSON.stringify({ event, source: 'game', ...output }) : null;
}

// Bounded per process lifetime so a looping child cannot flood the platform log.
export function createChildDiagnosticForwarder({ emit = value => console.warn(value), limit = 2000 } = {}) {
  let forwarded = 0;
  return line => {
    if (forwarded >= limit) return;
    const safe = safeChildDiagnosticLine(line);
    if (!safe) return;
    forwarded++;
    try { emit(safe); } catch { /* Diagnostics never change the child lifecycle. */ }
  };
}

// The game logs these events with console.warn (stderr); the same allowlist
// filter is applied to both streams and shares one per-process cap.
export function withChildDiagnostics(specifications, options) {
  const forward = createChildDiagnosticForwarder(options);
  return { ...specifications, web: { ...specifications.web, onStdoutLine: forward, onStderrLine: forward } };
}
