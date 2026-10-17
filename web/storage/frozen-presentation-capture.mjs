import {isActiveDealerId} from '../../packages/presentation/contracts/dealer-identity.mjs';
import {isPresentationRoom} from '../presentation-room-contract.mjs';
import { gameLaneConfiguration } from '../../packages/presentation/contracts/game-lanes.mjs';
import { laneDealerSelection } from '../public/game-lanes.mjs';
import {buildPresentationPackage} from '../presentation-layers.mjs';
import {normalizeProject} from '../../packages/presentation/contracts/studio-model.mjs';
import {captureFrozenRegisteredDealers, captureFrozenDealerPlayback, assertFrozenMediaPreconditions, resolveFrozenDealerIdle} from './frozen-dealer-idle.mjs';
import {validateRevision, StudioStorageError} from './studio-contract.mjs';
import {assertPresentationRoomMaterials} from '../presentation-material-game.mjs';

const fail = () => { throw new StudioStorageError('studio_media_registry_unavailable'); };
export function captureFrozenPresentation({snapshot, selectedLaneIds, inventory, requiredIdleDealerIds = [], requiredRouletteIdleDealerIds = []} = {}) {
  const {projectDocument, administrationDocument, mediaRows} = snapshot ?? {};
  if (projectDocument?.kind !== 'project' || administrationDocument?.kind !== 'administration'
    || projectDocument.value?.revision !== projectDocument.revision) fail();
  const projectRevision = validateRevision(projectDocument.revision);
  const administrationRevision = validateRevision(administrationDocument.revision);
  const project = normalizeProject(projectDocument.value);
  const source = project;
  const captured = captureFrozenRegisteredDealers({project:source, selectedLaneIds, inventory, mediaRows, requiredIdleDealerIds, requiredRouletteIdleDealerIds});
  const events = captured.registeredDealers.length ? captureFrozenDealerPlayback({project:source, inventory, mediaRows, registeredDealers:captured.registeredDealers}) : null;
  // A new publication must not reactivate an explicitly baked dealer source.
  // Reading old immutable packages stays independent of this write guard.
  const mediaPreconditions = [...new Map([...captured.mediaPreconditions,...(events?.mediaPreconditions??[])].map(row=>[row.id,row])).values()];
  if (mediaPreconditions.some(({record}) => record.classification?.mediaType !== 'audio' && record.classification?.compositing?.mode === 'opaque'))
    throw new StudioStorageError('studio_dealer_background_required',422);
  const presentation = buildPresentationPackage(source, selectedLaneIds, source.layerAssets ?? [],
    events ? {registeredDealers:captured.registeredDealers, playback:events.playback} : {});
  const freeze = value => {
    if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
    return value;
  };
  return freeze({presentation, mediaPreconditions, projectRevision, administrationRevision});
}
export function selectedRegisteredIdleDefaults(project, selectedLaneIds) {
  return [...new Set(selectedLaneIds.map(id => project.lanes?.find(lane => lane.id === id)?.layers.dealer.default)
    .filter(isActiveDealerId))];
}
/** Call only after project/admin/package CAS, on the same bound write client. */
export async function assertCapturedPresentationMedia(repository, mediaPreconditions) {
  if (typeof repository?.getMedia !== 'function') fail();
  const rows = [];
  for (const expected of mediaPreconditions) {
    const row = await repository.getMedia(expected.id);
    if (row) rows.push(row);
  }
  assertFrozenMediaPreconditions(mediaPreconditions, rows);
}

export function isPresentationRoomLaneCompatible(gameLane, presentationLane, frozenPresentation = null, game = 'blackjack') {
  if (!gameLane || !presentationLane || gameLane.renderer !== 'portrait-video') return false;
  const dealer = presentationLane.layers.dealer.default;
  // The caller supplies the already validated frozen package, never the mutable
  // Studio registry. v3 portrait rooms select their adapter per allowed dealer.
  if (frozenPresentation?.schemaVersion === 3 && gameLane.renderer === 'portrait-video') {
    if (gameLane.mediaCollection !== `${gameLane.dealer}-presentation`) return false;
    const frozenLane = frozenPresentation.lanes.find(lane => lane.id === presentationLane.id);
    if (frozenLane?.layers.dealer.default !== dealer || !frozenLane.layers.dealer.allowed.includes(dealer)) return false;
    if (!isActiveDealerId(gameLane.dealer)
      || !frozenLane.layers.dealer.allowed.includes(gameLane.dealer)
      || !frozenPresentation.registeredDealers.some(row => row.id === gameLane.dealer)) return false;
    try {
      // Historical roulette packages predate explicit idle. Keep their engine
      // launch, while the preview exposes no blackjack dealer media.
      const legacyRoulette=game==='roulette'&&!frozenPresentation.registeredDealers.find(row=>row.id===dealer)?.rouletteIdle;
      if (!legacyRoulette&&!resolveFrozenDealerIdle(frozenPresentation.registeredDealers,
        { dealerId: dealer, allowedDealerIds: frozenLane.layers.dealer.allowed, game })) return false;
      const portraitDealerIds = frozenPresentation.registeredDealers.map(row => row.id).filter(isActiveDealerId);
      return laneDealerSelection('', gameLane, frozenLane.layers.dealer, { portraitDealerIds }) === dealer;
    } catch { return false; }
  }
  return isActiveDealerId(dealer) && Boolean(frozenPresentation?.registeredDealers?.some(row => row.id === dealer && (game==='roulette'?true:game==='blackjack'?row.idle:null)))
    && gameLane.dealer === dealer && gameLane.mediaCollection === `${dealer}-presentation`;
}
export function assertPublishedRoomBindings({administration, operatorId, currentPackage, presentation}) {
  const {gameLanes} = gameLaneConfiguration(administration);
  for (const room of administration.rooms ?? []) {
    if (!isPresentationRoom(room) || room.operatorId !== operatorId || !currentPackage?.tables?.includes(room.id)) continue;
    const lane = presentation.lanes.find(row => row.id === room.presentationLaneId);
    const gameLane = gameLanes.find(row => row.id === room.gameLaneId);
    if (!isPresentationRoomLaneCompatible(gameLane, lane, presentation, room.game??'blackjack')) throw new StudioStorageError('studio_conflict', 409);
    assertPresentationRoomMaterials(presentation,room);
  }
}
