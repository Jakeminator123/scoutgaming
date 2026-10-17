import { isDealerId } from './dealer-identity.mjs';
import { SPEECH_LINES } from './speech-lines.mjs';
import { normalizeRecordedSpeech } from './recorded-speech.mjs';

// A slot standard is an explicit project variant, never an inventory search.
// The three dedicated events keep their existing standard IDs and limits.
const dedicated = new Set(['goodluck', 'insurance', 'double']);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const fail = () => { throw Object.assign(Error('invalid_speech_slot_binding'), { code: 'invalid_speech_slot_binding' }); };
export const SPEECH_SLOT_IDS = Object.freeze(Object.keys(SPEECH_LINES));
export const OTHER_SPEECH_SLOT_IDS = Object.freeze(SPEECH_SLOT_IDS.filter(id => !dedicated.has(id)));
export function speechSlotEventId(situation) {
  if (!SPEECH_SLOT_IDS.includes(situation)) fail();
  return dedicated.has(situation) ? `speak.${situation}` : 'speak.other';
}
export function speechSlotVariantId(dealerId, eventId, situation) {
  if (!isDealerId(dealerId) || speechSlotEventId(situation) !== eventId) fail();
  return `${dealerId}.${eventId}.${eventId === 'speak.other' ? `slot-${situation}` : 'standard'}`;
}

// Reserved names cannot be repurposed as ordinary alternatives or move between
// rows. All other pre-existing variant IDs retain their original meaning.
export function speechSlotSituation(line, variant) {
  if (typeof variant?.id !== 'string' || !variant.id.includes('.slot-')) return null;
  const situation = variant.id.slice(variant.id.lastIndexOf('.slot-') + 6);
  if (line?.eventId !== 'speak.other' || variant.id !== speechSlotVariantId(line.dealerId, line.eventId, situation)) fail();
  return situation;
}
export function validateSpeechSlotLine(line) {
  const ids = new Set(), videos = new Set();
  for (const variant of line.variants) {
    if (ids.has(variant.id)) fail();
    ids.add(variant.id);
    if (!speechSlotSituation(line, variant)) continue;
    if (!uuid(variant.videoGenerationId) || videos.has(variant.videoGenerationId)
      || variant.priority !== 0 || !Array.isArray(variant.triggerIds) || variant.triggerIds.length
      || !variant.selection || ['rules', 'model', 'random'].some(key => variant.selection[key] !== false)) fail();
    videos.add(variant.videoGenerationId);
  }
  if (line.eventId === 'speak.other' && line.variants.filter(variant => variant.id !== line.baselineVariantId && !speechSlotSituation(line, variant)).length > 4) fail();
  return line;
}
export function speechSlotStandard(project, dealerId, eventId, situation) {
  const id = speechSlotVariantId(dealerId, eventId, situation);
  const lines = project.lines.filter(line => line.dealerId === dealerId && line.eventId === eventId);
  if (!lines.length) return null;
  if (lines.length !== 1) fail();
  validateSpeechSlotLine(lines[0]);
  return lines[0].variants.find(variant => variant.id === id && variant.videoGenerationId !== null) ?? null;
}
export function bindSpeechSlotStandard(project, { dealerId, eventId, situation, videoId }) {
  const id = speechSlotVariantId(dealerId, eventId, situation);
  if (videoId !== null && !uuid(videoId)) fail();
  const next = structuredClone(project), lines = next.lines.filter(line => line.dealerId === dealerId && line.eventId === eventId);
  if (lines.length !== 1 || !next.dealers.some(dealer => dealer.id === dealerId)) fail();
  const line = validateSpeechSlotLine(lines[0]);
  const baseline = line.variants.find(variant => variant.id === line.baselineVariantId);
  if (line.baselineVariantId !== `${dealerId}.${eventId}.standard` || !baseline) fail();
  // A malformed or duplicate reserved ID must not be silently overwritten.
  for (const other of next.lines) for (const variant of other.variants) {
    if (other !== line && variant.id === id) fail();
    if (videoId !== null && variant.id !== id && speechSlotSituation(other, variant) && variant.videoGenerationId === videoId) fail();
  }
  if (eventId !== 'speak.other') baseline.videoGenerationId = videoId;
  else if (videoId === null) line.variants = line.variants.filter(variant => variant.id !== id);
  else {
    const existing = line.variants.find(variant => variant.id === id);
    if (existing) existing.videoGenerationId = videoId;
    else line.variants.push({ id, label: situation, priority: 0, triggerIds: [], assetId: baseline.assetId,
      videoGenerationId: videoId, selection: { rules: false, model: false, random: false } });
  }
  validateSpeechSlotLine(line);
  return next;
}

// This validates declared ownership and the recorded tuple, not audiovisual
// acceptance. Pending/rejected takes still cannot pass the playback review gate.
export function speechSlotVideoFits(video, { dealerId, eventId, situation, requireRecordedSpeech = false }) {
  try {
    speechSlotVariantId(dealerId, eventId, situation);
    const metadata = video?.classification;
    if (!metadata || video.available !== true || video.deletion || video.archived === true || metadata.archived === true
      || metadata.dealerId !== dealerId || metadata.eventId !== eventId || metadata.situation !== situation
      || metadata.kind !== 'speech' || ['audio', 'image'].includes(metadata.mediaType) || metadata.game === 'roulette'
      || [video.dealer, video.dealerId].some(owner => owner !== undefined && owner !== dealerId)
      || video.contentType !== undefined && !['video/mp4', 'video/webm'].includes(video.contentType)
      || typeof video.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(video.sha256)) return false;
    if (requireRecordedSpeech && metadata.recordedSpeech === undefined && video.recordedSpeech === undefined) return false;
    const tuple = value => normalizeRecordedSpeech(value, { dealerId, lineId: situation, videoSha256: video.sha256 });
    if (metadata.recordedSpeech !== undefined) tuple(metadata.recordedSpeech);
    if (video.recordedSpeech !== undefined) {
      const checked = tuple(video.recordedSpeech);
      if (metadata.recordedSpeech !== undefined && JSON.stringify(checked) !== JSON.stringify(tuple(metadata.recordedSpeech))) return false;
    }
    return true;
  } catch { return false; }
}
