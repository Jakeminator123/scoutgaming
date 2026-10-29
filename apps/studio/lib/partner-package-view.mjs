import { materialLabel } from '../../../packages/presentation/contracts/material-catalog.mjs';
import { selectableLayerBases } from '../../../packages/presentation/contracts/background-playback-policy.mjs';

// Matches game-entry-operator: composition settings enable separate layers;
// older lanes retain their approved full-frame dealer playback.
export function effectivePartnerAdjustments(lane) {
  return (lane?.operatorAdjustable ?? []).filter(token => {
    if (token === 'background') return Boolean(lane.composition && lane.layers.background.enabled && lane.layers.background.mode !== 'baked');
    if (token === 'table' || token === 'table.color') return Boolean(lane.composition && lane.layers.table.enabled);
    return true;
  });
}

// Admin (N1) chooses among every layer the frozen composition lists as allowed.
// operatorAdjustable only narrows what the company may change itself; the
// material's real compatibility (baked background, legacy full-frame clip) still
// applies, and values outside `allowed` are refused by the branding API.
export function adminLayerAdjustments(lane) {
  if (!lane) return [];
  const tokens = new Set(effectivePartnerAdjustments(lane));
  const layered = Boolean(lane.composition);
  if (layered && lane.layers.background.enabled && lane.layers.background.mode !== 'baked' && lane.layers.background.allowed.length) tokens.add('background');
  if (layered && lane.layers.table.enabled && lane.layers.table.allowed.length) tokens.add('table');
  if (lane.layers.dealer.enabled && lane.layers.dealer.allowed.length) tokens.add('dealer');
  return ['table.color', 'table', 'background', 'dealer', 'branding'].filter(token => tokens.has(token));
}

// Partner and room choices for one layer. A table clip named by the lane's
// tablePlayback rules stays granted to the rules but is never a selectable table.
export function partnerLayerChoices(lane, role) {
  const layer = lane?.layers?.[role];
  return role === 'table' ? selectableLayerBases(layer?.allowed, lane.tablePlayback, layer?.default ?? null) : layer?.allowed ?? [];
}

export function partnerLaneState(lane, branding = {}, assets = [], registeredDealers = []) {
  const selected = branding.lane === lane.id;
  const layers = Object.fromEntries(['background', 'dealer', 'table'].map(role => {
    const layer = lane.layers[role];
    const choice = selected && partnerLayerChoices(lane, role).includes(branding[role]) ? branding[role] : layer.default;
    const dealerLabel = role === 'dealer' ? registeredDealers.find(row => row.id === choice)?.label : null;
    const asset = role === 'dealer' ? null : assets.find(item => item.id === choice && item.role === role);
    return [role, { ...layer, selected: choice, label: (asset ? materialLabel(asset) : null) ?? dealerLabel ?? choice ?? 'Inget lager', ...(asset ? { contentType: asset.contentType, width: asset.width, height: asset.height } : {}) }];
  }));
  return { id: lane.id, name: lane.label, compatibility: lane.composition ? 'per-clip' : 'full-frame', layers, adjustable: effectivePartnerAdjustments(lane) };
}
