// Matches game-entry-operator: composition settings enable separate layers;
// older lanes retain their approved full-frame dealer playback.
export function effectivePartnerAdjustments(lane) {
  return (lane?.operatorAdjustable ?? []).filter(token => {
    if (token === 'background') return Boolean(lane.composition && lane.layers.background.enabled && lane.layers.background.mode !== 'baked');
    if (token === 'table' || token === 'table.color') return Boolean(lane.composition && lane.layers.table.enabled);
    return true;
  });
}

export function partnerLaneState(lane, branding = {}, assets = []) {
  const selected = branding.lane === lane.id;
  const layers = Object.fromEntries(['background', 'dealer', 'table'].map(role => {
    const layer = lane.layers[role];
    const choice = selected && layer.allowed.includes(branding[role]) ? branding[role] : layer.default;
    const asset = role === 'dealer' ? null : assets.find(item => item.id === choice && item.role === role);
    return [role, { ...layer, selected: choice, label: asset?.label ?? choice ?? 'Inget lager', ...(asset ? { contentType: asset.contentType, width: asset.width, height: asset.height } : {}) }];
  }));
  return { id: lane.id, name: lane.label, compatibility: lane.composition ? 'per-clip' : 'full-frame', layers, adjustable: effectivePartnerAdjustments(lane) };
}

export function partnerPackageProfiles(presentation, branding, operatorId) {
  return presentation.lanes.map(lane => {
    const state = partnerLaneState(lane, { ...branding, lane: branding?.lane ?? presentation.lanes[0].id }, presentation.assets);
    return { ...state, operatorId, dealer: state.layers.dealer.selected, background: state.layers.background.label, table: state.layers.table.label, status: 'published' };
  });
}
