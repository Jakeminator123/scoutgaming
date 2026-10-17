import { StudioError } from '../../shared/studio-error.mjs';
import { usesMediaFamilies } from '../runtime/media-family-policy.mjs';
import { isLegacyClipReference, LEGACY_VARIANT_DEALERS } from '../runtime/legacy-standard-variants.mjs';

// Pure validation against the operation's explicit registry; no storage or Director access.
export function createVideoBindingValidator({ videoRules, speechSlots }) {
  const { videoFitsLine } = videoRules;
  const { speechSlotSituation, speechSlotVideoFits } = speechSlots;

  async function validateVideoBindings(project, { registry } = {}) {
    if (!registry || !Array.isArray(registry.videos)) throw new StudioError('Videoregistret måste anges uttryckligen.', 503);
    // Reserved standards are exact even for dealers whose legacy rows normally
    // defer to a manifest family. A conflicting classification cannot be selected.
    const byId = new Map(registry.videos.map(video => [video.id, video]));
    if (byId.size !== registry.videos.length) throw new StudioError('Videoregistret innehåller dubblerade ID:n.', 422);
    for (const line of project.lines) for (const variant of line.variants) {
      const situation = speechSlotSituation(line, variant);
      if (situation && !speechSlotVideoFits(byId.get(variant.videoGenerationId), { dealerId: line.dealerId, eventId: line.eventId, situation, requireRecordedSpeech: true })) throw new StudioError(`${variant.id}: standarden kräver en tillgänglig video för exakt dealer och talfack.`, 422);
    }
    const legacyLines = project.lines.filter(line => !usesMediaFamilies(registry, line.dealerId));
    const bound = legacyLines.flatMap(line => line.variants).filter(variant => variant.videoGenerationId !== null);
    if (!bound.length) return;
    const known = new Set(registry.videos.map(video => video.id));
    const tolerated = (line, id) => LEGACY_VARIANT_DEALERS.includes(line.dealerId) && isLegacyClipReference(id);
    if (legacyLines.some(line => line.variants.some(variant => variant.videoGenerationId && !known.has(variant.videoGenerationId) && !tolerated(line, variant.videoGenerationId)))) throw new StudioError('En videokoppling saknas i det kända registret. Välj en fil i Videobanken.', 422);
    const videos = new Map(registry.videos.map(v => [v.id, v]));
    for (const line of legacyLines) for (const variant of line.variants) {
      if (variant.videoGenerationId && known.has(variant.videoGenerationId) && !videoFitsLine(videos.get(variant.videoGenerationId), line.dealerId, line.eventId)) throw new StudioError(`${variant.id}: videon saknar giltig kategorisering för denna linje. Kategorisera i Videobankens Inkorg eller koppla loss filmen.`, 422);
    }
  }
  return validateVideoBindings;
}
