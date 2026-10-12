import { BASE_DEALER_IDS, isDealerId, isActiveDealerId, validatePublicRegisteredDealers } from './dealer-identity.mjs';
import {validateComposition} from './presentation-composition.mjs';
// A lane selects a presentation adapter and media collection. Game rules,
// card projection and playback primitives remain shared, independently of lanes.
export const GAME_LANES = Object.freeze([]);
const LAYER_PREVIEW_LANE = Object.freeze({ schemaVersion: 1, id: 'layer-preview', label: 'Layer Preview Lane', renderer: 'layered', dealer: 'paow', mediaCollection: 'layer-packs-preview' });
export function gamePresentationForDealer(dealerId, renderer) {
  if (!isActiveDealerId(dealerId) || !['portrait-video', 'layered'].includes(renderer)) throw Error('Registered cloud presentation required');
  return renderer === 'layered' ? 'layered' : 'local';
}
const layerPreviewDealers = ['paow', 'dragge'];
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
      || /[\u0000-\u001f\u007f-\u009f<>]/u.test(lane.label) || !isDealerId(lane.dealer)
      || !(lane.renderer === 'portrait-video' && lane.mediaCollection === `${lane.dealer}-presentation`
        || lane.renderer === 'indexed-video' && BASE_DEALER_IDS.includes(lane.dealer) && lane.mediaCollection === 'legacy-dealers'
        || lane.renderer === 'layered' && lane.id === 'layer-preview' && lane.mediaCollection === 'layer-packs-preview' && lane.dealer === 'paow')) throw Error('Invalid lane definition');
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

// Package lanes that the saved catalogue can serve, in package order.
export function packageLaneIds(allowedLanes, lanes = GAME_LANES) {
  if (!Array.isArray(allowedLanes)) throw Error('Invalid allowed lanes');
  const fallbackLayer = LAYER_PREVIEW_LANE;
  const catalogue = fallbackLayer && !lanes.some(lane => lane.id === fallbackLayer.id) ? [...lanes, fallbackLayer] : lanes;
  return [...new Set(allowedLanes)].filter(id => isGameLane(id, catalogue));
}

// allowedLanes only narrows the catalogue. An empty intersection keeps the
// saved active lane; the caller decides whether that deserves a warning.
export function gameLaneSelection(query, activeLane = null, lanes = GAME_LANES, allowedLanes) {
  lanes = validateGameLanes(lanes);
  const fallbackLayer = LAYER_PREVIEW_LANE;
  const published = fallbackLayer && !lanes.some(row => row.id === fallbackLayer.id) ? [...lanes, fallbackLayer] : lanes;
  const permitted = allowedLanes === undefined ? [] : packageLaneIds(allowedLanes, published);
  if (permitted.length) {
    lanes = permitted.map(id => published.find(lane => lane.id === id));
    if (!permitted.includes(activeLane)) activeLane = permitted[0];
  } else lanes = published;
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(query);
  const explicit = params.getAll('lane').length === 1 ? params.get('lane') : null;
  const lane = lanes.find(row => row.id === (isGameLane(explicit, lanes) ? explicit : activeLane));
  if (!lane) throw Error('No configured game lane');
  const layeredDealer = lane.renderer === 'layered' && params.getAll('dealer').length === 1 && layerPreviewDealers.includes(params.get('dealer'))
    ? params.get('dealer') : null;
  const dealer = lane.renderer === 'indexed-video' && params.getAll('dealer').length === 1 && isActiveDealerId(params.get('dealer'))
    ? params.get('dealer') : layeredDealer || lane.dealer;
  const presentation = gamePresentationForDealer(dealer, lane.renderer);
  return { lane: lane.id, dealer, presentation };
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

const packageRevisionPattern = /^[1-9][0-9]{0,15}$/;
const CHOICE_DEALERS = Object.freeze(['paow', 'dragge']);
const TABLE_COLOR = /^#[0-9a-f]{6}$/;
const CHOICE_BACKGROUND_MODES = new Set(['baked', 'image', 'video']);
// Same layers as lab/lib/studio-model.mjs defaultPresentationLane. web does not import lab.
const STANDARD_PRESENTATION_LAYERS = Object.freeze({
  background: Object.freeze({ enabled: true, mode: 'baked', default: null, allowed: Object.freeze([]) }),
  table: Object.freeze({ enabled: true, default: null, allowed: Object.freeze([]) }),
  dealer: Object.freeze({ enabled: false, default: null, allowed: Object.freeze([]) }),
});
const choiceText = value => typeof value === 'string' && value.length >= 1 && value.length <= 200 && !/[\u0000-\u001f\u007f]/u.test(value);

function choiceList(list, accept, max) {
  if (!Array.isArray(list) || list.length > max) return null;
  const out = [];
  for (const item of list) {
    if (!accept(item) || out.includes(item)) return null;
    out.push(item);
  }
  return out;
}

// The document attribute is escaped JSON. A tampered list fails closed.
export function gameChoicesFromDocument(text, options) {
  if (typeof text !== 'string' || text.length > 8000) throw Error('Invalid game presentation');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw Error('Invalid game presentation'); }
  return assertGameChoices(parsed, options);
}

export function assertGameChoices(value, { registeredDealerIds = [] } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid game presentation');
  if (Object.keys(value).length !== 5 || !['dealers', 'dealerDefault', 'tableColors', 'tableDefault', 'background'].every(key => Object.hasOwn(value, key))) throw Error('Invalid game presentation');
  const dealers = choiceList(value.dealers, id => (CHOICE_DEALERS.includes(id) || registeredDealerIds.includes(id)) && isActiveDealerId(id), 32);
  if (!dealers || (value.dealerDefault !== null && !dealers.includes(value.dealerDefault))) throw Error('Invalid game presentation');
  const tableColors = choiceList(value.tableColors, color => TABLE_COLOR.test(color), 16);
  if (!tableColors || (value.tableDefault !== null && !tableColors.includes(value.tableDefault))) throw Error('Invalid game presentation');
  const background = value.background;
  if (!background || typeof background !== 'object' || Array.isArray(background)) throw Error('Invalid game presentation');
  if (Object.keys(background).length !== 4 || !['enabled', 'mode', 'allowed', 'default'].every(key => Object.hasOwn(background, key))) throw Error('Invalid game presentation');
  if (typeof background.enabled !== 'boolean' || !CHOICE_BACKGROUND_MODES.has(background.mode)) throw Error('Invalid game presentation');
  const allowed = choiceList(background.allowed, choiceText, 32);
  if (!allowed || (background.default !== null && !allowed.includes(background.default))) throw Error('Invalid game presentation');
  return value;
}

function keptStrings(list, accept, max) {
  const out = [];
  if (!Array.isArray(list)) return out;
  for (const item of list) {
    if (!accept(item) || out.includes(item)) continue;
    out.push(item);
    if (out.length === max) break;
  }
  return out;
}

// Missing project lane → the standard lane. Portrait lanes can only offer the
// dealer that lane already renders; an indexed lane can offer any of the four.
export function gameChoicesForLane(projectLanes, laneId, serverLane, { portraitDealerIds = [] } = {}) {
  if (laneId === 'layer-preview') {
    return {
      dealers: ['paow', 'dragge'],
      dealerDefault: serverLane?.dealer && ['paow', 'dragge'].includes(serverLane.dealer) ? serverLane.dealer : 'paow',
      tableColors: [],
      tableDefault: null,
      background: {
        enabled: true,
        mode: 'image',
        allowed: ['a_nearly_still__seamless_loop_ambient_background_plate_for_a-383b1b5f'],
        default: 'a_nearly_still__seamless_loop_ambient_background_plate_for_a-383b1b5f',
      },
    };
  }
  const found = Array.isArray(projectLanes) ? projectLanes.find(row => row && row.id === laneId) : undefined;
  const layers = found?.layers && typeof found.layers === 'object' ? found.layers : STANDARD_PRESENTATION_LAYERS;
  const renderable = !serverLane ? CHOICE_DEALERS
    : serverLane.renderer === 'indexed-video' ? []
    : isDealerId(serverLane.dealer) ? [serverLane.dealer, ...portraitDealerIds.filter(isDealerId)] : [];
  const dealerLayer = layers.dealer && typeof layers.dealer === 'object' ? layers.dealer : {};
  const dealers = keptStrings([dealerLayer.default, ...(Array.isArray(dealerLayer.allowed) ? dealerLayer.allowed : [])], id => renderable.includes(id) && isActiveDealerId(id), 32);
  const table = layers.table && typeof layers.table === 'object' ? layers.table : {};
  const tableColors = keptStrings(Array.isArray(table.colors) ? table.colors : table.allowed, color => TABLE_COLOR.test(color), 16);
  const background = layers.background && typeof layers.background === 'object' ? layers.background : {};
  const allowed = keptStrings(background.allowed, choiceText, 32);
  return {
    dealers,
    dealerDefault: dealers.includes(dealerLayer.default) ? dealerLayer.default : (dealers[0] ?? null),
    tableColors,
    tableDefault: tableColors.includes(table.default) ? table.default : null,
    background: {
      enabled: typeof background.enabled === 'boolean' ? background.enabled : true,
      mode: CHOICE_BACKGROUND_MODES.has(background.mode) ? background.mode : 'baked',
      allowed,
      default: allowed.includes(background.default) ? background.default : null,
    },
  };
}

// The server resolves the saved catalogue. Client query strings cannot
// reselect a retired adapter or override that server-owned decision.
// Operator context is read-only here; it is not a selector.
export function gameLaneFromDocument(dataset, lanes = GAME_LANES) {
  if (!dataset?.gameLane) throw Error('No configured game presentation');
  const registry = dataset.gameRegisteredDealers === undefined ? [] : validatePublicRegisteredDealers(JSON.parse(dataset.gameRegisteredDealers));
  const extra = dataset.gamePresentation !== 'layered';
  if (!isGameLaneId(dataset.gameLane) || !isActiveDealerId(dataset.gameDealer)
    || !['local', 'layered'].includes(dataset.gamePresentation)) throw Error('Invalid game presentation');
  if (extra && (dataset.gamePresentation !== 'local' || dataset.gameLocalDealer !== dataset.gameDealer
    || !registry.some(row => row.id === dataset.gameDealer))) throw Error('Invalid game presentation');
  if (dataset.gamePresentation === 'layered') {
    if (dataset.gameLane !== 'layer-preview' || !layerPreviewDealers.includes(dataset.gameDealer)) throw Error('Invalid game presentation');
  }
  const selection = { lane: dataset.gameLane, dealer: dataset.gameDealer, presentation: dataset.gamePresentation };
  if (dataset.gameLocalDealer !== undefined) {
    if (dataset.gamePresentation !== 'local' || dataset.gameLocalDealer !== dataset.gameDealer) throw Error('Invalid game presentation');
    selection.localDealer = dataset.gameLocalDealer;
  }
  if (registry.length) selection.registeredDealers = registry;
  const packaged = dataset.gamePackageRevision !== undefined || dataset.gameBranding !== undefined;
  const finish = () => {
    if(dataset.gameComposition!==undefined){
      if(typeof dataset.gameComposition!=='string'||dataset.gameComposition.length>32000)throw Error('Invalid game presentation');
      selection.composition=validateComposition(JSON.parse(dataset.gameComposition));
    }
    if (dataset.gameChoices !== undefined) selection.choices = gameChoicesFromDocument(dataset.gameChoices, { registeredDealerIds: registry.map(row => row.id) });
    if (dataset.gameRoomId !== undefined) {
      if (!isGameLaneId(dataset.gameRoomId) || !selection.operator || !selection.packageRevision) throw Error('Invalid game presentation');
      selection.roomId = dataset.gameRoomId;
    }
    return selection;
  };
  if (dataset.gameOperator === undefined) {
    if (packaged) throw Error('Invalid game presentation');
    return finish();
  }
  if (!isOperatorSlug(dataset.gameOperator)) throw Error('Invalid game presentation');
  selection.operator = dataset.gameOperator;
  if (!packaged) return finish();
  if (!packageRevisionPattern.test(dataset.gamePackageRevision ?? '') || !Number.isSafeInteger(Number(dataset.gamePackageRevision))
    || typeof dataset.gameBranding !== 'string') throw Error('Invalid game presentation');
  let branding;
  try { branding = JSON.parse(dataset.gameBranding); } catch { throw Error('Invalid game presentation'); }
  if (!branding || typeof branding !== 'object' || Array.isArray(branding)) throw Error('Invalid game presentation');
  selection.packageRevision = Number(dataset.gamePackageRevision);
  selection.branding = branding;
  return finish();
}
