// A lane selects a presentation adapter and media collection. Game rules,
// card projection and playback primitives remain shared, independently of lanes.
export const GAME_LANES = Object.freeze([
  Object.freeze({ schemaVersion: 1, id: 'mobile-phone', label: 'Mobile Phone Lane', renderer: 'portrait-video', dealer: 'astrid', mediaCollection: 'astrid-presentation' }),
]);
const dealers = ['vera', 'astrid', 'amira', 'mei'];
export const isGameLaneId = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value) && !['original', 'constructor', 'prototype'].includes(value);
export const isGameLane = (value, lanes = GAME_LANES) => lanes.some(lane => lane.id === value);
// Same rule as the partner portal slug (lab/lib/partner-session.mjs operatorSlug).
const reservedOperatorSlugs = new Set(['api', 'auth', 'login', 'logout', 'studio', 'control', 'partner', 'play', 'set-password']);
export const isOperatorSlug = value => typeof value === 'string' && value.length <= 63
  && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) && !reservedOperatorSlugs.has(value);

export function validateGameLanes(value) {
  if (!Array.isArray(value) || value.length > 32) throw Error('Invalid lane catalogue');
  const ids = new Set();
  return value.map(lane => {
    if (!lane || Object.keys(lane).sort().join(',') !== 'dealer,id,label,mediaCollection,renderer,schemaVersion'
      || lane.schemaVersion !== 1 || !isGameLaneId(lane.id) || ids.has(lane.id)
      || typeof lane.label !== 'string' || !lane.label.trim() || lane.label.length > 80
      || /[\u0000-\u001f\u007f-\u009f<>]/u.test(lane.label) || !dealers.includes(lane.dealer)
      || !(lane.renderer === 'portrait-video' && lane.mediaCollection === `${lane.dealer}-presentation`
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

// Package lanes that the saved catalogue can serve, in package order.
export function packageLaneIds(allowedLanes, lanes = GAME_LANES) {
  if (!Array.isArray(allowedLanes)) throw Error('Invalid allowed lanes');
  return [...new Set(allowedLanes)].filter(id => isGameLane(id, lanes));
}

// allowedLanes only narrows the catalogue. An empty intersection keeps the
// saved active lane; the caller decides whether that deserves a warning.
export function gameLaneSelection(query, activeLane = 'mobile-phone', lanes = GAME_LANES, allowedLanes) {
  lanes = validateGameLanes(lanes);
  if (activeLane === 'original') activeLane = 'mobile-phone';
  if (!isGameLane(activeLane, lanes)) throw Error('No active game lane');
  const permitted = allowedLanes === undefined ? [] : packageLaneIds(allowedLanes, lanes);
  if (permitted.length) {
    lanes = permitted.map(id => lanes.find(lane => lane.id === id));
    if (!permitted.includes(activeLane)) activeLane = permitted[0];
  }
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(query);
  const explicit = params.getAll('lane').length === 1 ? params.get('lane') : null;
  const lane = lanes.find(row => row.id === (isGameLane(explicit, lanes) ? explicit : activeLane));
  const dealer = lane.renderer === 'indexed-video' && params.getAll('dealer').length === 1 && dealers.includes(params.get('dealer')) ? params.get('dealer') : lane.dealer;
  return { lane: lane.id, dealer, presentation: lane.renderer === 'portrait-video' ? 'local' : 'original' };
}

// A presentation lane's dealer layer (Studio project) narrows the dealers its
// server lane can render: portrait lanes render only their own dealer. The
// layer default comes first. null means no overlap; the caller keeps its dealer.
export function laneDealerSelection(query, lane, dealerLayer) {
  if (!lane || !['portrait-video', 'indexed-video'].includes(lane.renderer) || !dealers.includes(lane.dealer)) throw Error('Invalid lane definition');
  const renderable = lane.renderer === 'indexed-video' ? dealers : [lane.dealer];
  const listed = [dealerLayer?.default, ...(Array.isArray(dealerLayer?.allowed) ? dealerLayer.allowed : [])];
  const permitted = [...new Set(listed)].filter(id => renderable.includes(id));
  if (!permitted.length) return null;
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(query);
  const requested = params.getAll('dealer').length === 1 ? params.get('dealer') : null;
  return permitted.includes(requested) ? requested : permitted[0];
}

const packageRevisionPattern = /^[1-9][0-9]{0,15}$/;

// The server resolves the saved catalogue. Client query strings cannot
// reselect a retired adapter or override that server-owned decision.
// Operator context is read-only here; it is not a selector.
export function gameLaneFromDocument(dataset, lanes = GAME_LANES) {
  if (!dataset?.gameLane) return gameLaneSelection('');
  if (!isGameLaneId(dataset.gameLane) || !dealers.includes(dataset.gameDealer)
    || !['local', 'original'].includes(dataset.gamePresentation)) throw Error('Invalid game presentation');
  if (dataset.gamePresentation === 'local' && dataset.gameDealer !== 'astrid') {
    let catalogue;
    try { catalogue = validateGameLanes(lanes); }
    catch { throw Error('Invalid game presentation'); }
    const lane = catalogue.find(row => row.id === dataset.gameLane);
    if (!lane || lane.renderer !== 'portrait-video' || lane.dealer !== dataset.gameDealer) throw Error('Invalid game presentation');
  }
  const selection = { lane: dataset.gameLane, dealer: dataset.gameDealer, presentation: dataset.gamePresentation };
  const packaged = dataset.gamePackageRevision !== undefined || dataset.gameBranding !== undefined;
  if (dataset.gameOperator === undefined) {
    if (packaged) throw Error('Invalid game presentation');
    return selection;
  }
  if (!isOperatorSlug(dataset.gameOperator)) throw Error('Invalid game presentation');
  selection.operator = dataset.gameOperator;
  if (!packaged) return selection;
  if (!packageRevisionPattern.test(dataset.gamePackageRevision ?? '') || !Number.isSafeInteger(Number(dataset.gamePackageRevision))
    || typeof dataset.gameBranding !== 'string') throw Error('Invalid game presentation');
  let branding;
  try { branding = JSON.parse(dataset.gameBranding); } catch { throw Error('Invalid game presentation'); }
  if (!branding || typeof branding !== 'object' || Array.isArray(branding)) throw Error('Invalid game presentation');
  selection.packageRevision = Number(dataset.gamePackageRevision);
  selection.branding = branding;
  return selection;
}
