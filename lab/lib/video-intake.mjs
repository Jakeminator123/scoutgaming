import seed from '../policies/project.seed.json' with { type: 'json' };
import contract from '../policies/studio-contract.json' with { type: 'json' };
import schema from '../schemas/video.schema.json' with { type: 'json' };
import { MEDIA_FAMILY_DEFINITIONS } from '../../presentation-runtime/media-families.mjs';

export const MAX_VIDEO_BYTES = contract.limits.videoBytes;
export const VIDEO_KINDS = Object.freeze(contract.videoKinds);
export const DEFAULT_SELECTION = Object.freeze(contract.selection.legacyAlternative);
export const MANUAL_SELECTION = Object.freeze(contract.selection.newAlternative);
export function selectionFor(variant) { return variant.selection ?? DEFAULT_SELECTION; }
export function kindForEvent(event) {
  return contract.sourceTypes[event.sourceType]?.kind;
}
export function situationsForEvent(event) {
  return [...(contract.events.find(e => e.id === event.id)?.situations ?? [])];
}
export function validateVideoMetadata(input, { allowLegacySituation = false } = {}) {
  const allowed = Object.keys(schema.properties);
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !allowed.includes(k))) throw new Error('Ogiltiga videofält.');
  const event = seed.events.find(e => e.id === input.eventId);
  if (!seed.dealers.some(d => d.id === input.dealerId) || !event) throw new Error('Välj dealer och event.');
  if (!schema.properties.role.enum.includes(input.role)) throw new Error('Välj standard eller alternativ.');
  if (input.playback !== undefined && !contract.playback.supported.includes(input.playback)) throw new Error('Labbet stöder endast en gång (once). Loop är ännu ett förslag.');
  if (input.kind !== kindForEvent(event)) throw new Error('Videotypen passar inte eventet.');
  if (input.familyId !== undefined) {
    const family = MEDIA_FAMILY_DEFINITIONS.find(row => row.id === input.familyId);
    if (!family || family.dealerId !== input.dealerId || family.eventId !== input.eventId
      || (family.playbackType === 'idle-pool' ? input.situation !== '' : family.situation !== input.situation)
      || input.role !== 'alternative') throw new Error('Välj en exakt familj och lägg in klippet som en ny variant.');
  }
  for (const key of ['label', 'notes', 'situation']) {
    if (typeof input[key] !== 'string' || input[key].length > schema.properties[key].maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input[key])) throw new Error(`Ogiltigt fält: ${key}.`);
  }
  if (!input.label.trim()) throw new Error('Ge videon ett namn.');
  const situations = situationsForEvent(event);
  if (situations.length && !input.situation && (!allowLegacySituation || event.sourceType === 'speak')) throw new Error('Välj exakt situation eller replik. Hela eventgruppen är inte ett videofack.');
  if (input.situation && !situations.includes(input.situation)) throw new Error('Situationen passar inte eventet.');
  if (event.sourceType === 'speak' && !input.situation) throw new Error('En talvideo måste ha ett exakt replik-ID.');
  return { ...input, label: input.label.trim(), notes: input.notes.trim() };
}
// Classification is operator supplied. This checks declared compatibility, not visual quality.
export function videoFitsLine(video, dealerId, eventId) {
  const m = video?.classification;
  if (!m || m.dealerId !== dealerId || m.eventId !== eventId) return false;
  try { validateVideoMetadata(m); return true; } catch { return false; }
}
export function videoFitsEvent(video, event) {
  const m = video?.classification;
  if (!m) return false;
  if (!m?.situation) return true;
  if (m.kind === 'speech') return event.line === m.situation;
  if (m.situation.startsWith('box')) return event.to === 'box' && event.box === Number(m.situation.slice(3));
  if (m.situation === 'dealer-up') return event.to === 'dealer' && event.faceDown === false;
  if (m.situation === 'dealer-hole') return event.to === 'dealer' && (event.type === 'reveal' || event.faceDown === true);
  return false;
}
