// These fields expand the shared strict StudioMediaRecord, not just the UI.
// All readers must support them before a native writer registers the record.
export function extendedDealerMediaFeatures(metadata) {
  const object=metadata!==null&&typeof metadata==='object'&&!Array.isArray(metadata);
  return {
    mediaAlpha:Boolean(object&&(metadata.mediaType==='image'||metadata.compositing?.mode==='alpha')),
    rouletteMedia:Boolean(object&&(metadata.eventId?.startsWith?.('roulette.')
      ||['game','action','startPose','endPose'].some(key=>Object.hasOwn(metadata,key)))),
  };
}
