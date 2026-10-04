// A lane selects a presentation adapter and media collection. Game rules,
// card projection and playback primitives remain shared, independently of lanes.
export const GAME_LANES = Object.freeze([
  Object.freeze({ schemaVersion: 1, id: 'mobile-phone', label: 'Mobile Phone Lane', renderer: 'portrait-video', dealer: 'astrid', mediaCollection: 'astrid-presentation' }),
]);
const dealers = ['vera', 'astrid', 'amira', 'mei'];
export const isGameLaneId = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value) && !['original', 'constructor', 'prototype'].includes(value);
export const isGameLane = (value, lanes = GAME_LANES) => lanes.some(lane => lane.id === value);

export function validateGameLanes(value) {
  if (!Array.isArray(value) || value.length > 32) throw Error('Invalid lane catalogue');
  const ids = new Set();
  return value.map(lane => {
    if (!lane || Object.keys(lane).sort().join(',') !== 'dealer,id,label,mediaCollection,renderer,schemaVersion'
      || lane.schemaVersion !== 1 || !isGameLaneId(lane.id) || ids.has(lane.id)
      || typeof lane.label !== 'string' || !lane.label.trim() || lane.label.length > 80
      || /[\u0000-\u001f\u007f-\u009f<>]/u.test(lane.label) || !dealers.includes(lane.dealer)
      || !(lane.renderer === 'portrait-video' && lane.dealer === 'astrid' && lane.mediaCollection === 'astrid-presentation'
        || lane.renderer === 'indexed-video' && lane.mediaCollection === 'legacy-dealers')) throw Error('Invalid lane definition');
    ids.add(lane.id);
    return { ...lane };
  });
}

// Old saved documents retain their history. Their retired default resolves to
// the current catalogue; the first lane edit persists the explicit catalogue.
export function gameLaneConfiguration(value = {}) {
  const explicit = Object.hasOwn(value, 'gameLanes');
  const gameLanes = validateGameLanes(explicit ? value.gameLanes : GAME_LANES);
  const gameLane = explicit ? value.gameLane : value.gameLane === 'original' || value.gameLane === undefined ? 'mobile-phone' : value.gameLane;
  if (gameLanes.length ? !isGameLane(gameLane, gameLanes) : gameLane !== null) throw Error('Invalid active lane');
  return { gameLanes, gameLane };
}

export function gameLaneSelection(query, activeLane = 'mobile-phone', lanes = GAME_LANES) {
  lanes = validateGameLanes(lanes);
  if (activeLane === 'original') activeLane = 'mobile-phone';
  if (!isGameLane(activeLane, lanes)) throw Error('No active game lane');
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(query);
  const explicit = params.getAll('lane').length === 1 ? params.get('lane') : null;
  const lane = lanes.find(row => row.id === (isGameLane(explicit, lanes) ? explicit : activeLane));
  const dealer = lane.renderer === 'indexed-video' && params.getAll('dealer').length === 1 && dealers.includes(params.get('dealer')) ? params.get('dealer') : lane.dealer;
  return { lane: lane.id, dealer, presentation: lane.renderer === 'portrait-video' ? 'local' : 'original' };
}

// The server resolves the saved catalogue. Client query strings cannot
// reselect a retired adapter or override that server-owned decision.
export function gameLaneFromDocument(dataset) {
  if (!dataset?.gameLane) return gameLaneSelection('');
  if (!isGameLaneId(dataset.gameLane) || !dealers.includes(dataset.gameDealer)
    || !['local', 'original'].includes(dataset.gamePresentation)
    || dataset.gamePresentation === 'local' && dataset.gameDealer !== 'astrid') throw Error('Invalid game presentation');
  return { lane: dataset.gameLane, dealer: dataset.gameDealer, presentation: dataset.gamePresentation };
}
