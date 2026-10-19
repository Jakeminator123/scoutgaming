// Display only. startPose/endPose on blackjack shoe clips are declared at
// import and are not verified against the frames.
const CHAIN_EVENT = /^(?:deal|reveal|transition)\./;
const POSES = new Set(['VILA', 'REDO']);

export function clipPoseChain(metadata) {
  if (!metadata || metadata.game === 'roulette' || metadata.mediaType || metadata.kind !== 'action' || !CHAIN_EVENT.test(metadata.eventId ?? '')) return null;
  if (!POSES.has(metadata.startPose) || !POSES.has(metadata.endPose)) return { declared: false, text: 'Poskedja ej angiven' };
  return { declared: true, text: `${metadata.startPose} → ${metadata.endPose}` };
}
