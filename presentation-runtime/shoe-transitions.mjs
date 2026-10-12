import { videoFitsLine } from '../lab/lib/video-intake.mjs';

const SITUATIONS = Object.freeze({ toShoe: 'to-shoe', fromShoe: 'from-shoe' });

function transitionVideo(inventory, dealerId, situation) {
  const matches = (inventory?.videos ?? []).filter(video => {
    const metadata = video?.classification;
    if (!metadata || video.available !== true || metadata.archived === true || metadata.mediaType === 'audio') return false;
    if (metadata.dealerId !== dealerId || metadata.eventId !== 'transition.shoe' || metadata.situation !== situation) return false;
    return videoFitsLine(video, dealerId, 'transition.shoe');
  });
  return matches.find(video => video.classification.role === 'standard') ?? matches[0] ?? null;
}

// Classified clips only. The player still owns when idle, deals and the return play.
export function transitionClipsForDealer(project, inventory, dealerId) {
  if (!project || typeof dealerId !== 'string' || !dealerId) return { toShoe: null, fromShoe: null };
  return {
    toShoe: transitionVideo(inventory, dealerId, SITUATIONS.toShoe),
    fromShoe: transitionVideo(inventory, dealerId, SITUATIONS.fromShoe),
  };
}
