// K04: a committed outbox row of the shared table -> main's existing presentation instructions.
// The coordinator writes sanitized publicView before/after and explicit public fields with the row
// (payload.presentation, contract blackjack-presentation/1). This module only reads that row; it
// never reads table state, the shoe, the audit or a clock, and it has no write port into the game.
import { createHash } from 'node:crypto';
import { presentationEvents } from '../../../partner-presentation.mjs';
import { mediaSituationForEvent } from '../../../../../packages/presentation/runtime/media-family-resolver.mjs';
import { PRESENTATION_CONTRACT } from '../table/coordinator.mjs';

const DEDICATED_SPEECH = new Set(['goodluck', 'insurance', 'double']);
// Main's catalogue event id for an instruction (clip-naming.mjs / studio-contract events).
export function catalogueEventId(event) {
  if (event.type === 'speak') return `speak.${DEDICATED_SPEECH.has(event.line) ? event.line : 'other'}`;
  if (event.type === 'reveal') return 'reveal.dealer';
  if (event.type === 'idle') return 'idle.ready';
  if (event.type === 'deal') return event.to === 'dealer' ? 'deal.dealer' : `deal.player.${event.box < 2 ? 'left' : event.box < 5 ? 'centre' : 'right'}`;
  return null; // settle and turn are game facts, not media slots
}

// Stable line id: the same committed row (talkId, ver are kept on replay) gives the same id; it
// does not change when the media for the line is re-planned (that is mediaRevision, see line-identity.mjs).
export const lineIdOf = (roomId, talkId, index, line) =>
  createHash('sha256').update(JSON.stringify([roomId, talkId, index, line])).digest('hex').slice(0, 32);

const withFamily = event => {
  const eventId = catalogueEventId(event), situation = eventId ? mediaSituationForEvent(eventId, event) : null;
  return eventId && situation ? { ...event, family: `${eventId}/${situation}` } : { ...event };
};

// -> { roomId, ver, talkId, kind, status, events, lines }. status 'legacy' = a row written before
// K04 (no public views): it is still accepted by the receiver, but has nothing to present.
export function presentationForRow(row) {
  const base = { roomId: row.roomId, ver: row.ver, talkId: row.talkId, auditSeq: row.auditSeq };
  const p = row.payload?.presentation;
  if (!p || p.contract !== PRESENTATION_CONTRACT) return { ...base, kind: null, status: 'legacy', events: [], lines: [] };
  let events;
  if (p.kind === 'plan') events = presentationEvents(p.before, p.after, p.op, { action: p.action });
  // Collect is committed so the table clears, but placebets follows the opened window (decision 1).
  else if (p.kind === 'collect') events = [];
  // A newly opened betting window: main's generator emits placebets + idle for its own `collect`
  // op because in main collect opens the next window; here the window row is that moment.
  else if (p.kind === 'window') events = presentationEvents(null, null, 'collect');
  else throw new Error(`Unknown presentation kind ${p.kind}`);
  events = events.map(withFamily);
  const lines = events.flatMap((e, index) => e.type === 'speak' ? [{ index, line: e.line, lineId: lineIdOf(row.roomId, row.talkId, index, e.line) }] : []);
  return { ...base, kind: p.kind, status: 'ready', windowId: p.windowId, configVersion: p.configVersion,
    language: row.payload.language, startAt: row.payload.startAt, endAt: row.payload.endAt, events, lines };
}

// Reconnect (#312 decision: current(roomId) + root's authoritative room snapshot + version check).
// The receiver's current presentation is applied only when it is the presentation of exactly the
// snapshot's committed state: an older one (its newer row is not yet accepted) is never applied
// over newer game state; a newer one means the snapshot is the older read and is re-read. A viewer
// also never goes back below the ver it already applied.
export function reconnectPresentation(snapshot, presentation, { appliedVer = 0 } = {}) {
  if (!snapshot || !Number.isSafeInteger(snapshot.presentationVer)) return { apply: false, reason: 'snapshot_without_presentation_version' };
  if (!presentation) return { apply: false, reason: snapshot.presentationVer === 0 ? 'none' : 'stale_presentation' };
  if (presentation.roomId !== snapshot.roomId) throw new Error('Presentation of another room');
  if (presentation.ver < snapshot.presentationVer) return { apply: false, reason: 'stale_presentation' };
  if (presentation.ver > snapshot.presentationVer) return { apply: false, reason: 'stale_snapshot' };
  if (presentation.ver <= appliedVer) return { apply: false, reason: 'already_applied' };
  return { apply: true, presentation };
}
