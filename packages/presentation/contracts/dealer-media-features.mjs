// These fields expand the shared strict StudioMediaRecord, not just the UI.
// All readers must support them before a native writer registers the record.
export function extendedDealerMediaFeatures(metadata) {
  const object=metadata!==null&&typeof metadata==='object'&&!Array.isArray(metadata);
  const roulette=Boolean(object&&(metadata.eventId?.startsWith?.('roulette.')||['game','action'].some(key=>Object.hasOwn(metadata,key))));
  const poses=Boolean(object&&['startPose','endPose'].some(key=>Object.hasOwn(metadata,key)));
  return {
    recordedSpeech:Boolean(object&&Object.hasOwn(metadata,'recordedSpeech')),
    mediaAlpha:Boolean(object&&(metadata.mediaType==='image'||metadata.compositing?.mode==='alpha')),
    rouletteMedia:roulette,
    // A declared VILA/REDO hand chain on a blackjack clip (capability v22).
    // Pose fields on a roulette-marked record remain roulette media.
    clipPoses:poses&&!roulette,
  };
}
