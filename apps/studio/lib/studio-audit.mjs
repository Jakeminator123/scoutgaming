import { MOTION_CLIPS, SOCIAL_MOTION_CLIPS, getMotionClip } from './motion-library.mjs';
import { isAssetCompatible } from '../../../packages/presentation/contracts/studio-model.mjs';
import { videoFitsLine } from '../../../packages/presentation/contracts/video-intake.mjs';

export function auditStudio(project, videos = []) {
  const assets = new Map(project.assets.map(a => [a.id, a]));
  const inventory = new Map(videos.map(v => [v.id, v]));
  const problems = [];
  const lines = project.lines.map(line => {
    const event = project.events.find(e => e.id === line.eventId);
    for (const v of line.variants) {
      const clip = getMotionClip(v.assetId);
      if (!clip || !isAssetCompatible(event, assets.get(v.assetId))) problems.push(`${v.id}: saknad eller inkompatibel 2D-rörelse`);
      else if (clip.eventId !== line.eventId) problems.push(`${v.id}: 2D-rörelse från en annan eventnod (${clip.eventId})`);
      if (v.videoGenerationId) {
        const video = inventory.get(v.videoGenerationId);
        if (!video) problems.push(`${v.id}: videoreferensen saknas i banken`);
        else if (!videoFitsLine(video, line.dealerId, line.eventId)) problems.push(`${v.id}: videon saknar giltig kategorisering för denna dealer/event`);
        else if (!video.available) problems.push(`${v.id}: videofilen är inte tillgänglig`);
      }
    }
    const standard = line.variants.find(v => v.id === line.baselineVariantId);
    const video = inventory.get(standard?.videoGenerationId);
    return { dealerId: line.dealerId, eventId: line.eventId, label: event?.label ?? line.eventId,
      standardVideo: video?.label ?? null, standardAvailable: Boolean(video?.available && videoFitsLine(video, line.dealerId, line.eventId)),
      situation: video?.classification?.situation ?? '',
      alternatives: line.variants.length - 1, boundAlternatives: line.variants.filter(v => v.id !== line.baselineVariantId && v.videoGenerationId).length };
  });
  const motionData = clip => JSON.stringify({ durationMs: clip.durationMs, tracks: clip.tracks });
  const groups = new Map();
  for (const clip of MOTION_CLIPS) { const key = motionData(clip); groups.set(key, [...(groups.get(key) ?? []), clip.assetId]); }
  return { events: project.events.length, lines, variants: project.lines.reduce((n, l) => n + l.variants.length, 0),
    motionRecords: MOTION_CLIPS.length, uniqueMotions: groups.size, socialMotions: SOCIAL_MOTION_CLIPS.length,
    duplicateMotions: [...groups.values()].filter(g => g.length > 1),
    videoRecords: videos.length, uniqueVideoHashes: new Set(videos.map(v => v.sha256)).size,
    boundVideos: new Set(project.lines.flatMap(l => l.variants).map(v => v.videoGenerationId).filter(Boolean)).size, problems };
}
