import {BASE_DEALER_IDS} from '../dealer-identity.mjs';
import {isPresentationRoom} from '../presentation-room-contract.mjs';
import {gameLaneConfiguration, laneDealerSelection} from '../public/game-lanes.mjs';
import {buildPresentationPackage} from '../presentation-layers.mjs';
import {defaultPresentationLane, normalizeProject} from '../../lab/lib/studio-model.mjs';
import {captureFrozenRegisteredDealers, captureFrozenDealerPlayback, assertFrozenMediaPreconditions, resolveFrozenDealerIdle} from './frozen-dealer-idle.mjs';
import {validateRevision, StudioStorageError} from './studio-contract.mjs';

const fail = () => { throw new StudioStorageError('studio_media_registry_unavailable'); };
export function captureFrozenPresentation({snapshot, selectedLaneIds, inventory, requiredIdleDealerIds = []} = {}) {
  const {projectDocument, administrationDocument, mediaRows} = snapshot ?? {};
  if (projectDocument?.kind !== 'project' || administrationDocument?.kind !== 'administration'
    || projectDocument.value?.revision !== projectDocument.revision) fail();
  const projectRevision = validateRevision(projectDocument.revision);
  const administrationRevision = validateRevision(administrationDocument.revision);
  const project = normalizeProject(projectDocument.value);
  const source = project.lanes?.length ? project : {...project, lanes:[defaultPresentationLane()]};
  const captured = captureFrozenRegisteredDealers({project:source, selectedLaneIds, inventory, mediaRows, requiredIdleDealerIds});
  const events = captured.registeredDealers.length ? captureFrozenDealerPlayback({project:source, inventory, mediaRows, registeredDealers:captured.registeredDealers}) : null;
  const presentation = buildPresentationPackage(source, selectedLaneIds, source.layerAssets ?? [],
    events ? {registeredDealers:captured.registeredDealers, playback:events.playback} : {});
  const freeze = value => {
    if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
    return value;
  };
  return freeze({presentation, mediaPreconditions:events?.mediaPreconditions ?? captured.mediaPreconditions, projectRevision, administrationRevision});
}
export function selectedRegisteredIdleDefaults(project, selectedLaneIds) {
  return [...new Set(selectedLaneIds.map(id => project.lanes?.find(lane => lane.id === id)?.layers.dealer.default)
    .filter(id => id && !BASE_DEALER_IDS.includes(id)))];
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

export function isPresentationRoomLaneCompatible(gameLane, presentationLane, frozenPresentation = null) {
  if (!gameLane || !presentationLane || !['portrait-video', 'indexed-video'].includes(gameLane.renderer)) return false;
  const dealer = presentationLane.layers.dealer.default;
  // The caller supplies the already validated frozen package, never the mutable
  // Studio registry. v3 portrait rooms select their adapter per allowed dealer.
  if (frozenPresentation?.schemaVersion === 3 && gameLane.renderer === 'portrait-video') {
    if (gameLane.mediaCollection !== `${gameLane.dealer}-presentation`) return false;
    const frozenLane = frozenPresentation.lanes.find(lane => lane.id === presentationLane.id);
    if (frozenLane?.layers.dealer.default !== dealer || !frozenLane.layers.dealer.allowed.includes(dealer)) return false;
    try {
      if (!BASE_DEALER_IDS.includes(dealer) && !resolveFrozenDealerIdle(frozenPresentation.registeredDealers,
        { dealerId: dealer, allowedDealerIds: frozenLane.layers.dealer.allowed })) return false;
      const portraitDealerIds = [...BASE_DEALER_IDS, ...frozenPresentation.registeredDealers.map(row => row.id)];
      return laneDealerSelection('', gameLane, frozenLane.layers.dealer, { portraitDealerIds }) === dealer;
    } catch { return false; }
  }
  if (!BASE_DEALER_IDS.includes(dealer)) return gameLane.renderer === 'portrait-video' && gameLane.dealer === dealer
    && gameLane.mediaCollection === `${dealer}-presentation`;
  try { return laneDealerSelection('', gameLane, presentationLane.layers.dealer) === dealer; } catch { return false; }
}
export function assertPublishedRoomBindings({administration, operatorId, currentPackage, presentation}) {
  const {gameLanes} = gameLaneConfiguration(administration);
  for (const room of administration.rooms ?? []) {
    if (!isPresentationRoom(room) || room.operatorId !== operatorId || !currentPackage?.tables?.includes(room.id)) continue;
    const lane = presentation.lanes.find(row => row.id === room.presentationLaneId);
    const gameLane = gameLanes.find(row => row.id === room.gameLaneId);
    if (!isPresentationRoomLaneCompatible(gameLane, lane, presentation)) throw new StudioStorageError('studio_conflict', 409);
  }
}
