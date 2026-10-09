import {BASE_DEALER_IDS} from '../dealer-identity.mjs';
import {isPresentationRoom} from '../presentation-room-contract.mjs';
import {gameLaneConfiguration, laneDealerSelection} from '../public/game-lanes.mjs';
import {buildPresentationPackage} from '../presentation-layers.mjs';
import {defaultPresentationLane, normalizeProject} from '../../lab/lib/studio-model.mjs';
import {captureFrozenRegisteredDealers, assertFrozenMediaPreconditions} from './frozen-dealer-idle.mjs';
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
  const presentation = buildPresentationPackage(source, selectedLaneIds, source.layerAssets ?? [],
    captured.registeredDealers.length ? {registeredDealers:captured.registeredDealers} : {});
  const freeze = value => {
    if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
    return value;
  };
  return freeze({presentation, mediaPreconditions:captured.mediaPreconditions, projectRevision, administrationRevision});
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

export function isPresentationRoomLaneCompatible(gameLane, presentationLane) {
  if (!gameLane || !presentationLane || !['portrait-video', 'indexed-video'].includes(gameLane.renderer)) return false;
  const dealer = presentationLane.layers.dealer.default;
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
    if (!isPresentationRoomLaneCompatible(gameLane, lane)) throw new StudioStorageError('studio_conflict', 409);
  }
}
