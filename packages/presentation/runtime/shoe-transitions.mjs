import { videoFitsLine } from '../contracts/video-intake.mjs';

const SITUATIONS = Object.freeze({ toShoe: 'to-shoe', fromShoe: 'from-shoe' });

function transitionVideo(project, inventory, dealerId, situation) {
  const line = project.lines?.find(row => row.dealerId === dealerId && row.eventId === 'transition.shoe');
  if (!line) return null;
  const matches = video => {
    const metadata = video?.classification;
    if (!metadata || video.available !== true || metadata.archived === true || metadata.mediaType === 'audio') return false;
    if (metadata.dealerId !== dealerId || metadata.eventId !== 'transition.shoe' || metadata.situation !== situation) return false;
    return videoFitsLine(video, dealerId, 'transition.shoe');
  };
  // Respect the saved slot standard, including the original legacy baseline.
  // Merely uploading an alternative must never change a published sequence.
  for (const id of [`${dealerId}.transition.shoe.slot.${situation}`, line.baselineVariantId]) {
    const variant = line.variants.find(row => row.id === id);
    const video = inventory?.videos?.find(row => row.id === variant?.videoGenerationId);
    if (id !== line.baselineVariantId && variant?.videoGenerationId) return video && matches(video) ? video : null;
    if (video && matches(video)) return video;
  }
  return null;
}

// Exact saved standards only. The filmed planner owns their pose boundaries.
export function transitionClipsForDealer(project, inventory, dealerId) {
  if (!project || typeof dealerId !== 'string' || !dealerId) return { toShoe: null, fromShoe: null };
  return {
    toShoe: transitionVideo(project, inventory, dealerId, SITUATIONS.toShoe),
    fromShoe: transitionVideo(project, inventory, dealerId, SITUATIONS.fromShoe),
  };
}
