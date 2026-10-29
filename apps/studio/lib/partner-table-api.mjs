// Partner-API:ts egna vägar för spelborden (ADMIN-FORENKLING 5.5), i
// partnersessionens väg `/studio/api/partner/*`, aldrig via Admins endpoints.
// Bolaget kommer alltid ur sessionen (partner-session.mjs), aldrig ur en
// adress eller en kropp; varje åtgärd kontrollerar behörighet och `allow` på
// servern.
import { allowsWorkspaceResource } from './partner-workspace-access.mjs';
import { partnerAssignmentDetail } from './partner-assignment.mjs';
import { readPublishedRoomSettings } from './partner-game-readout.mjs';
import { readPackagePresentation, resolvePackageRoomDealer } from '../../../packages/presentation/server/presentation-package.mjs';
import { listPackageRooms } from '../../../packages/presentation/server/package-rooms.mjs';
import { gameLaneConfiguration } from '../../../packages/presentation/contracts/game-lanes.mjs';
import { isPresentationRoomLaneCompatible } from '../../../packages/presentation/server/frozen-presentation-capture.mjs';
import { validateRoomGameDrafts } from '../../../packages/presentation/contracts/room-game-config.mjs';
import { createStudioRepository } from '../../../packages/studio-registry/server/document-repository.mjs';

function fail(statusCode) {
  throw Object.assign(new Error('partner_table_rejected'), { statusCode });
}

async function readAdministrationValue(config) {
  if (typeof config.readAdministration === 'function') {
    const read = await config.readAdministration();
    return read?.value && typeof read.revision === 'string' ? read.value : read;
  }
  if (typeof config.pool?.connect !== 'function') fail(503);
  const document = await createStudioRepository({ pool: config.pool, scope: config.scope }).readDocument('administration');
  if (!document) fail(503);
  return document.value;
}

// Bolagets spelbord i paketet, med samma urval som snapshoten (partner-data.mjs).
export function partnerPackageRooms({ administration, pack, presentation, operatorId }) {
  if (!administration || !presentation) return [];
  const { gameLanes } = gameLaneConfiguration(administration);
  return listPackageRooms({ administration, package: pack, operatorId })
    .filter(room => isPresentationRoomLaneCompatible(gameLanes.find(lane => lane.id === room.gameLaneId),
      presentation.lanes.find(lane => lane.id === room.presentationLaneId), presentation, room.game ?? 'blackjack'));
}

// De publicerade spelinställningarna för bolagets spelbord, ur paketets bindningar.
export function publishedRoomSettings({ query, operatorId, rooms, pack }) {
  const bindings = pack?.branding?.roomGameConfigVersions;
  return readPublishedRoomSettings({ query, operatorId, rooms: rooms.map(room => ({ id: room.id, configVersion: bindings?.[room.id] })) });
}

// Läsa tilldelningen: kräver presentations.read. Spelborden (namn, läge,
// dealer, spelinställningar och deras utkast) kräver dessutom tables.read.
// Revisionerna är de som skrivvägarna kontrollerar (CAS).
export async function readPartnerAssignment({ found, decided, config }) {
  const { store, operator, session } = found;
  const resource = { scope: session.scope, operatorId: operator.id };
  const may = permission => allowsWorkspaceResource(decided, permission, resource);
  if (!may('presentations.read')) fail(403);
  if (typeof store.getCurrentPackage !== 'function') fail(503);
  const pack = await store.getCurrentPackage(operator.id);
  if (pack && pack.operatorId !== operator.id) fail(403);
  const presentation = readPackagePresentation(pack);
  const administration = presentation ? await readAdministrationValue(config) : null;
  const rooms = partnerPackageRooms({ administration, pack, presentation, operatorId: operator.id });
  const query = typeof config.pool?.query === 'function' ? (text, values) => config.pool.query(text, values) : null;
  const settings = await publishedRoomSettings({ query, operatorId: operator.id, rooms, pack });
  const brandingDraft = typeof store.getBrandingDraft === 'function' ? await store.getBrandingDraft(operator.id) : null;
  if (brandingDraft && brandingDraft.operatorId !== operator.id) fail(403);
  let drafts = [];
  if (administration && may('tables.read')) {
    try { drafts = validateRoomGameDrafts(administration.roomGameConfigs ?? [], administration.rooms); } catch { fail(503); }
  }
  const dealerLabel = id => presentation?.registeredDealers?.find(dealer => dealer.id === id)?.label ?? id;
  return {
    operator: { id: operator.id, slug: operator.slug, name: operator.name },
    packageRevision: pack?.revision ?? null,
    ...(pack?.publishedAtMs ? { publishedAt: pack.publishedAtMs } : {}),
    assignment: partnerAssignmentDetail(pack, presentation, settings),
    revisions: { package: pack?.revision ?? null, brandingDraft: brandingDraft?.revision ?? 0 },
    canConfigure: { presentations: may('presentations.configure'), tables: may('tables.configure') },
    ...(may('tables.read') ? { rooms: rooms.map(room => {
      let dealer = null; try { dealer = resolvePackageRoomDealer(pack, room, presentation); } catch { dealer = null; }
      const published = settings.get(room.id), draft = drafts.find(row => row.roomId === room.id && row.operatorId === operator.id);
      return { id: room.id, name: room.name, game: room.game ?? 'blackjack', state: room.state,
        dealer: dealer ? { id: dealer, label: dealerLabel(dealer) } : null,
        settings: { published: published ? { language: published.language, limitPreset: published.limitPreset } : null,
          draft: draft ? { revision: draft.revision, gameConfig: { ...draft.gameConfig } } : null } };
    }) } : {}),
  };
}
