import {isActiveDealerId} from './dealer-identity.mjs';
import { isGameLaneId } from './game-lane-id.mjs';
import { BASE_DEALER_IDS, isDealerId } from './dealer-identity.mjs';

export const GAME_LANES = Object.freeze([]);
export const isGameLane = (value, lanes = GAME_LANES) => lanes.some(lane => lane.id === value);

export function validateGameLanes(value) {
  if (!Array.isArray(value) || value.length > 32) throw Error('Invalid lane catalogue');
  const ids = new Set();
  return value.map(lane => {
    if (!lane || Object.keys(lane).sort().join(',') !== 'dealer,id,label,mediaCollection,renderer,schemaVersion'
      || lane.schemaVersion !== 1 || !isGameLaneId(lane.id) || ids.has(lane.id)
      || typeof lane.label !== 'string' || !lane.label.trim() || lane.label.length > 80
      || /[\u0000-\u001f\u007f-\u009f<>]/u.test(lane.label) || !isDealerId(lane.dealer)
      || !(lane.renderer === 'portrait-video' && lane.mediaCollection === `${lane.dealer}-presentation`
        || lane.renderer === 'indexed-video' && BASE_DEALER_IDS.includes(lane.dealer) && lane.mediaCollection === 'legacy-dealers'
        || lane.renderer === 'layered' && lane.id === 'layer-preview' && lane.mediaCollection === 'layer-packs-preview' && ['paow', 'dragge'].includes(lane.dealer))) throw Error('Invalid lane definition');
    ids.add(lane.id);
    return { ...lane };
  });
}

// Old saved documents retain their history. Their retired default resolves to
// the current catalogue; the first lane edit persists the explicit catalogue.
export function gameLaneConfiguration(value = {}) {
  const explicit = Object.hasOwn(value, 'gameLanes');
  const gameLanes = validateGameLanes(explicit ? value.gameLanes : GAME_LANES);
  const gameLane = explicit ? value.gameLane : value.gameLane ?? null;
  if (gameLane !== null && !isGameLane(gameLane, gameLanes)) throw Error('Invalid active lane');
  return { gameLanes, gameLane };
}

// A presentation lane's dealer layer (Studio project) narrows the dealers its
// server lane can render. Frozen v3 rooms supply their additional authorized dealers. The
// layer default comes first. null means no overlap; the caller keeps its dealer.
export function laneDealerSelection(query, lane, dealerLayer, { portraitDealerIds = [] } = {}) {
  if (!lane || !['portrait-video', 'indexed-video'].includes(lane.renderer) || !isDealerId(lane.dealer)) throw Error('Invalid lane definition');
  const renderable = lane.renderer === 'portrait-video' ? [lane.dealer, ...portraitDealerIds.filter(isActiveDealerId)] : [];
  const listed = [dealerLayer?.default, ...(Array.isArray(dealerLayer?.allowed) ? dealerLayer.allowed : [])];
  const permitted = [...new Set(listed)].filter(id => renderable.includes(id) && isActiveDealerId(id));
  if (!permitted.length) return null;
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(query);
  const requested = params.getAll('dealer').length === 1 ? params.get('dealer') : null;
  return params.has('dealer') ? (permitted.includes(requested) ? requested : null) : permitted[0];
}
