import seed from '../policies/project.seed.json' with { type: 'json' };

export const MAX_VIDEO_BYTES = 128 * 1024 * 1024;
export const VIDEO_KINDS = { idle: 'Idle / vänteläge', action: 'Action / korthandling', speech: 'Tal / exakt replik', reaction: 'Reaktion / tur / resultat' };
export const DEFAULT_SELECTION = Object.freeze({ rules: true, model: true, random: false });
export const MANUAL_SELECTION = Object.freeze({ rules: false, model: false, random: false });
export function selectionFor(variant) { return variant.selection ?? DEFAULT_SELECTION; }
export function kindForEvent(event) {
  return event.sourceType === 'idle' ? 'idle' : event.sourceType === 'speak' ? 'speech' : ['deal', 'reveal'].includes(event.sourceType) ? 'action' : 'reaction';
}
export function situationsForEvent(event) {
  if (event.sourceType === 'speak') return event.id === 'speak.other'
    ? ['placebets', 'dealerblackjack', 'blackjack', 'dealerbust', 'win', 'push', 'lose'] : [event.exampleEvent.line];
  if (event.id.startsWith('deal.player.')) return ({ 'deal.player.left': [0, 1], 'deal.player.centre': [2, 3, 4], 'deal.player.right': [5, 6] }[event.id] ?? []).map(n => `box${n}`);
  if (event.id === 'deal.dealer') return ['dealer-up', 'dealer-hole'];
  if (event.sourceType === 'reveal') return ['dealer-hole'];
  return [];
}
export function validateVideoMetadata(input) {
  const allowed = ['label', 'dealerId', 'eventId', 'kind', 'role', 'situation', 'notes'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !allowed.includes(k))) throw new Error('Ogiltiga videofält.');
  const event = seed.events.find(e => e.id === input.eventId);
  if (!seed.dealers.some(d => d.id === input.dealerId) || !event) throw new Error('Välj dealer och event.');
  if (!['standard', 'alternative'].includes(input.role)) throw new Error('Välj standard eller alternativ.');
  if (input.kind !== kindForEvent(event)) throw new Error('Videotypen passar inte eventet.');
  for (const [key, max] of [['label', 120], ['notes', 1500], ['situation', 80]]) {
    if (typeof input[key] !== 'string' || input[key].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input[key])) throw new Error(`Ogiltigt fält: ${key}.`);
  }
  if (!input.label.trim()) throw new Error('Ge videon ett namn.');
  const situations = situationsForEvent(event);
  if (input.situation && !situations.includes(input.situation)) throw new Error('Situationen passar inte eventet.');
  if (event.sourceType === 'speak' && !input.situation) throw new Error('En talvideo måste ha ett exakt replik-ID.');
  return { ...input, label: input.label.trim(), notes: input.notes.trim() };
}
// Classification is operator supplied. This checks declared compatibility, not visual quality.
export function videoFitsLine(video, dealerId, eventId) {
  const m = video?.classification;
  return !m || m.dealerId === dealerId && m.eventId === eventId;
}
export function videoFitsEvent(video, event) {
  const m = video?.classification;
  if (!m?.situation) return true;
  if (m.kind === 'speech') return event.line === m.situation;
  if (m.situation.startsWith('box')) return event.to === 'box' && event.box === Number(m.situation.slice(3));
  if (m.situation === 'dealer-up') return event.to === 'dealer' && event.faceDown === false;
  if (m.situation === 'dealer-hole') return event.to === 'dealer' && (event.type === 'reveal' || event.faceDown === true);
  return false;
}
