import {rouletteMediaEvent,validateRouletteMedia} from './roulette-media.mjs';
import seed from './policies/project.seed.json' with { type: 'json' };
import contract from './policies/studio-contract.json' with { type: 'json' };
import schema from './schemas/video.schema.json' with { type: 'json' };
import { MEDIA_FAMILY_DEFINITIONS } from '../runtime/media-families.mjs';
import { isDealerId } from './dealer-identity.mjs';
import { validateDealerFraming } from './dealer-framing.mjs';
import { assertDealerCompositingWrite } from './dealer-compositing.mjs';
import { normalizeRecordedSpeech } from './recorded-speech.mjs';

export const MAX_VIDEO_BYTES = contract.limits.videoBytes;
export const VIDEO_KINDS = Object.freeze(contract.videoKinds);
export const DEFAULT_SELECTION = Object.freeze(contract.selection.legacyAlternative);
export const MANUAL_SELECTION = Object.freeze(contract.selection.newAlternative);
export function selectionFor(variant) { return variant.selection ?? DEFAULT_SELECTION; }
export function kindForEvent(event) {
  return contract.sourceTypes[event.sourceType]?.kind;
}
export function situationsForEvent(event) {
  return [...((rouletteMediaEvent(event.id) ?? contract.events.find(e => e.id === event.id))?.situations ?? [])];
}
export function validateVideoMetadata(input, { allowLegacySituation = false, forWrite = false } = {}) {
  const allowed = Object.keys(schema.properties);
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !allowed.includes(k))) throw new Error('Ogiltiga videofält.');
  if (input.archived !== undefined && typeof input.archived !== 'boolean') throw new Error('Ogiltig biblioteksstatus.');
  if (input.mediaType !== undefined && (!['audio','image'].includes(input.mediaType) || input.mediaType === 'audio' && (input.kind !== 'speech' || input.familyId))) throw new Error('Ljud behöver ett exakt talfack.');
  validateRouletteMedia(input);
  if(input.mediaType==='image'&&(input.eventId!=='roulette.reference'||input.compositing?.mode!=='alpha'))throw Error('Bilder hör till roulettens VILA-referensfack och ska behålla sin alfa.');
  const event = rouletteMediaEvent(input.eventId) ?? seed.events.find(e => e.id === input.eventId);
  if (!isDealerId(input.dealerId) || !event) throw new Error('Välj dealer och event.');
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
  if (input.compositing !== undefined) validateVideoCompositing(input.compositing);
  if (input.framing !== undefined) validateDealerFraming(input.framing);
  let recordedSpeech;
  if (Object.hasOwn(input, 'recordedSpeech')) {
    if (event.sourceType !== 'speak' || input.mediaType !== undefined || input.game === 'roulette') throw new Error('Inspelat tal kräver en egen talvideo med exakt replik.');
    recordedSpeech = normalizeRecordedSpeech(input.recordedSpeech, {dealerId:input.dealerId,lineId:input.situation});
  }
  return { ...input, label: input.label.trim(), notes: input.notes.trim(),
    ...(recordedSpeech ? {recordedSpeech} : {}),
    ...(forWrite && input.mediaType !== 'audio' ? {compositing:assertDealerCompositingWrite(input.compositing)} : {}) };
}
export function validateVideoCompositing(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ogiltig friläggning.');
  const expected = ['opaque','alpha'].includes(value.mode) ? ['mode'] : ['despill', 'mode', 'softness', 'threshold'];
  if (!['opaque', 'alpha', 'green-screen'].includes(value.mode) || Object.keys(value).sort().join(',') !== expected.join(',')) throw new Error('Ogiltig friläggning.');
  if (value.mode === 'green-screen' && ['threshold', 'softness', 'despill'].some(key => !Number.isFinite(value[key]) || value[key] < (key === 'softness' ? 0.001 : 0) || value[key] > 1)) throw new Error('Ogiltiga värden för grön nyckling.');
  return structuredClone(value);
}
export function videoCompositing(video) {
  return video?.classification?.compositing === undefined ? {mode: 'opaque'} : validateVideoCompositing(video.classification.compositing);
}
// Classification is operator supplied. This checks declared compatibility, not visual quality.
export function videoFitsLine(video, dealerId, eventId) {
  const m = video?.classification;
  if (!m || m.game==='roulette' || ['audio','image'].includes(m.mediaType) || m.dealerId !== dealerId || m.eventId !== eventId) return false;
  try { validateVideoMetadata(m); return true; } catch { return false; }
}
export function videoFitsEvent(video, event) {
  const m = video?.classification;
  if (!m || m.mediaType==='image' || m.game==='roulette') return false;
  if (m.eventId === 'transition.shoe' || m.situation === 'to-shoe' || m.situation === 'from-shoe') return false;
  if (!m?.situation) return true;
  if (m.kind === 'speech') return event.line === m.situation;
  if (m.situation.startsWith('box')) return event.to === 'box' && event.box === Number(m.situation.slice(3));
  if (m.situation === 'dealer-up') return event.to === 'dealer' && event.faceDown === false;
  if (m.situation === 'dealer-hole') return event.to === 'dealer' && (event.type === 'reveal' || event.faceDown === true);
  return false;
}
