import { registeredDealerIds } from '../contracts/dealer-identity.mjs';
import { videoFitsLine } from '../contracts/video-intake.mjs';

const IDLE_EVENT = 'idle.ready';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const SHA256 = /^[a-f0-9]{64}$/;

/**
 * Resolve an explicitly saved, own-dealer idle baseline. The caller supplies the
 * saved project and inventory, verifies media bytes, and owns muted playback.
 * Metadata establishes declared compatibility, never silence or visual approval.
 * No family, duration, alternate-variant or other-dealer fallback is permitted.
 */
export function ownDealerIdle(project, inventory, dealerId) {
  try {
    if (!registeredDealerIds(project).has(dealerId)
      || !Array.isArray(project.lines) || !Array.isArray(inventory?.videos)) return null;
    const lines = project.lines.filter(line => line?.dealerId === dealerId && line.eventId === IDLE_EVENT);
    if (lines.length !== 1) return null;
    const line = lines[0], baselineId = `${dealerId}.${IDLE_EVENT}.standard`;
    if (line.baselineVariantId !== baselineId || !Array.isArray(line.variants)) return null;
    const variants = line.variants.filter(variant => variant?.id === baselineId);
    if (variants.length !== 1) return null;
    const baseline = variants[0];
    if (!Array.isArray(baseline.triggerIds) || baseline.triggerIds.length
      || typeof baseline.videoGenerationId !== 'string' || !UUID.test(baseline.videoGenerationId)) return null;
    const videos = inventory.videos.filter(video => video?.id === baseline.videoGenerationId);
    if (videos.length !== 1) return null;
    const video = videos[0], metadata = video.classification;
    if (video.available !== true || video.dealer !== dealerId
      || typeof video.sha256 !== 'string' || !SHA256.test(video.sha256)
      || metadata?.kind !== 'idle' || (metadata.playback ?? 'once') !== 'once'
      || video.playbackType !== undefined && video.playbackType !== 'once'
      || video.eventId !== undefined && video.eventId !== IDLE_EVENT
      || !videoFitsLine(video, dealerId, IDLE_EVENT)) return null;
    return structuredClone(video);
  } catch {
    return null;
  }
}
