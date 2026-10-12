import { isPresentationRoomLaneCompatible } from './storage/frozen-presentation-capture.mjs';
import { isActiveDealerId, isRegisteredDealer } from './dealer-identity.mjs';
import { validateFrozenRegisteredDealers } from './storage/frozen-dealer-idle.mjs';
// Server-owned /blackjack selection with optional operator context. Without
// ?operator= the lane, dealer and presentation stay on the saved catalogue
// path. gameChoices is still attached from the active presentation lane so
// the player can choose before a company exists. A package and a presentation
// lane only narrow lanes and dealers the catalogue already renders; they
// never add a lane, dealer or renderer. Wallet, cards, shoe and payouts are
// not read or written here.
import { gamePresentationForDealer, gameChoicesForLane, gameLaneConfiguration, gameLaneSelection, isOperatorSlug, laneDealerSelection, packageLaneIds } from './public/game-lanes.mjs';
import {readPackagePresentation, publicPackageBranding} from './storage/presentation-package.mjs';
import { resolvePackageRoom } from './presentation-room-contract.mjs';
import {resolveRoomBranding} from './storage/partner-branding.mjs';

export const OPERATOR_NOT_FOUND_HTML = '<!doctype html><html lang="sv"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Bolaget finns inte</title></head>'
  + '<body><main><h1>Bolaget finns inte</h1><p>Adressen pekar på ett spelbolag som inte finns.</p></main></body></html>';

// undefined: no operator context. null: present, but not exactly one valid slug.
export function requestedOperator(params) {
  if (!params.has('operator')) return undefined;
  const values = params.getAll('operator');
  return values.length === 1 && isOperatorSlug(values[0]) ? values[0] : null;
}

export function createGameEntrySelector({ policy, packages = null, log = console.warn } = {}) {
  if (typeof policy?.readGameConfiguration !== 'function' || typeof policy?.readSaved !== 'function') throw new TypeError('Invalid game policy');
  if (packages !== null && typeof packages?.resolve !== 'function') throw new TypeError('Invalid operator package reader');
  if (typeof log !== 'function') throw new TypeError('Invalid game entry log');
  function withChoices(selection, saved, gameLanes, presentationLaneId = selection.lane, registry = saved.project?.dealers, portraitDealerIds = []) {
    const serverLane = gameLanes.find(row => row.id === selection.lane);
    const extra = serverLane?.renderer !== 'layered';
    if (!isActiveDealerId(selection.dealer)) throw Object.assign(Error('presentation_dealer_unavailable'), {statusCode:503});
    if (extra && (!isRegisteredDealer({ dealers: registry }, selection.dealer) || serverLane?.renderer !== 'portrait-video' || serverLane.dealer !== selection.dealer && !portraitDealerIds.includes(selection.dealer))) {
      throw Object.assign(Error('presentation_dealer_unavailable'), { statusCode: 503 });
    }
    const presentation = serverLane ? gamePresentationForDealer(selection.dealer, serverLane.renderer) : selection.presentation;
    const choices = gameChoicesForLane(saved?.project?.lanes, presentationLaneId, serverLane, { portraitDealerIds });
    if (!choices.dealers.includes(selection.dealer)) throw Object.assign(Error('presentation_dealer_not_configured'), {statusCode:503});
    const allowed = new Set([...choices.dealers, selection.dealer]);
    const registeredDealers = (registry ?? []).filter(row => isActiveDealerId(row.id) && allowed.has(row.id)).map(({ id, label }) => ({ id, label }));
    return { ...selection, presentation, ...(presentation === 'local' ? { localDealer: selection.dealer } : {}),
      ...(registeredDealers.length ? { registeredDealers } : {}), choices };
  }
  // { status: 200, selection } or { status: 404 }. Policy failures reject, as today.
  return async function selectGameEntry(query) {
    const params = new URLSearchParams(query);
    if (params.has('dealer') && (params.getAll('dealer').length !== 1 || !isActiveDealerId(params.get('dealer')))) return {status:404};
    const tables = params.getAll('table');
    const explicitTable = tables.length > 0;
    if (explicitTable && (tables.length !== 1 || !/^[a-z][a-z0-9-]{0,63}$/.test(tables[0]))) return { status: 404 };
    const slug = requestedOperator(params);
    // N3.4: gameChoices follows the active presentation lane even before a
    // company is selected. Lane, dealer and presentation stay on the catalogue
    // rules, and this path still does not query operator storage.
    if (explicitTable && (slug === undefined || slug === null)) return { status: 404 };
    if (slug === undefined) {
      const saved = await policy.readSaved();
      const { gameLane, gameLanes } = gameLaneConfiguration(saved.administration);
      const selection = gameLaneSelection(params, gameLane, gameLanes);
      const lane = gameLanes.find(row => row.id === selection.lane);
      const presentation = saved.project?.lanes?.find(row => row.id === selection.lane);
      const portraitDealerIds = (saved.project?.dealers ?? []).map(row => row.id).filter(isActiveDealerId);
      const dealer = lane?.renderer === 'layered' ? selection.dealer : laneDealerSelection(params,lane,presentation?.layers.dealer,{portraitDealerIds});
      if (!dealer) return {status:404};
      return { status: 200, selection: withChoices({...selection,dealer}, saved, gameLanes, selection.lane, saved.project?.dealers, portraitDealerIds) };
    }
    if (slug === null) return { status: 404 };
    const [saved, context] = await Promise.all([policy.readSaved(), packages ? packages.resolve(slug) : null]);
    const { gameLane, gameLanes } = gameLaneConfiguration(saved.administration);

    // Unreadable operator storage: today's entry, no guess about the slug.
    if (context === null) {
      throw Object.assign(Error('presentation_room_unavailable'), {statusCode:503});
    }
    if (!context.operator || explicitTable && context.operator.status === 'suspended') return { status: 404 };
    const current = context.package;
    if (!current) return {status:404};
    const room = explicitTable ? resolvePackageRoom({ administration: saved.administration, package: current, operatorId: context.operator.id, roomId: tables[0] }) : null;
    if (explicitTable && (!room || room.state !== 'live' || !gameLanes.some(lane => lane.id === room.gameLaneId))) return { status: 404 };
    if (room) params.set('lane', room.gameLaneId);
    let selection;
    const frozen = readPackagePresentation(current);
    if ([2,3].includes(frozen?.schemaVersion)) validateFrozenRegisteredDealers(frozen.registeredDealers, { dealerIds: [...new Set(frozen.lanes.flatMap(lane => [...lane.dealers, ...lane.layers.dealer.allowed]))] });
    if (room) selection = gameLaneSelection(params, gameLane, gameLanes, [room.gameLaneId]);
    else if (packageLaneIds(current.lanes, gameLanes).length) selection = gameLaneSelection(params, gameLane, gameLanes, current.lanes);
    else throw Object.assign(Error('presentation_lane_unavailable'), {statusCode:503});
    const lane = gameLanes.find(row => row.id === selection.lane);
    if (room && selection.lane !== room.gameLaneId) throw Object.assign(Error('presentation_room_unavailable'), { statusCode: 503 });
    const presentationLane = (frozen?.lanes ?? saved.project?.lanes)?.find(row => row?.id === (room?.presentationLaneId ?? selection.lane));
    if(frozen && !presentationLane) throw Object.assign(new Error('presentation_lane_unavailable'),{statusCode:503});
    if (room && !isPresentationRoomLaneCompatible(lane, presentationLane, frozen)) throw Object.assign(Error('presentation_dealer_mismatch'),{statusCode:503});
    const portraitDealerIds = room && frozen?.schemaVersion === 3 && lane?.renderer === 'portrait-video'
      ? frozen.registeredDealers.map(row => row.id).filter(isActiveDealerId) : [];
    if (presentationLane) {
      const dealer = laneDealerSelection(params, lane, presentationLane.layers?.dealer, { portraitDealerIds });
      if (dealer) selection = { ...selection, dealer };
      else if (params.has('dealer')) return {status:404};
      else throw Object.assign(Error('presentation_dealer_mismatch'), {statusCode:503});
    }
    const storedBranding=publicPackageBranding(current.branding);
    // N1 owns the lane for a room. Defaults apply only to their presentation;
    // the matching room override then wins, without leaking another room's data.
    const branding={...storedBranding};
    if(frozen) {
      const resolved=resolveRoomBranding({lane:frozen.lanes[0].id,...storedBranding},room?.id,presentationLane.id);
      for(const key of ['lane','dealer','table','background','color','roomOverrides'])delete branding[key];
      if((storedBranding.lane??frozen.lanes[0].id)!==presentationLane.id)delete branding.tableColor;
      Object.assign(branding,resolved);
    }
    const next=withChoices({ ...selection, operator: slug, packageRevision: current.revision, branding },
      frozen?{project:{...saved.project,lanes:frozen.lanes}}:saved,gameLanes,room?.presentationLaneId ?? selection.lane,
      [2,3].includes(frozen?.schemaVersion) ? frozen.registeredDealers : saved.project?.dealers, portraitDealerIds);
    if(frozen) {
      const layers=presentationLane.layers;
      next.composition={schemaVersion:1,
        background:{enabled:layers.background.enabled,mode:layers.background.mode,allowed:layers.background.allowed,default:layers.background.default},
        table:{enabled:layers.table.enabled,allowed:layers.table.allowed,default:layers.table.default},
        dealer:{enabled:layers.dealer.enabled,compatibility:next.presentation !== 'original' && presentationLane.composition?'per-clip':'full-frame'},
        ...(presentationLane.composition?{settings:structuredClone(presentationLane.composition)}:{}),
        assets:frozen.assets.filter(asset=>layers[asset.role].allowed.includes(asset.id)).map(({id,role,label,contentType})=>({id,role,label,contentType,src:`/api/presentation/layers/${slug}/${id}`}))};
    }
    if (room) next.roomId = room.id;
    return {status:200,selection:next};
  };
}
