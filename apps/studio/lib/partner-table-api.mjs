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
import { validateRoomGameConfig, validateRoomGameDrafts } from '../../../packages/presentation/contracts/room-game-config.mjs';
import { createStudioRepository } from '../../../packages/studio-registry/server/document-repository.mjs';
import { createOperatorStore } from '../../../packages/operators/server/operator-store.mjs';
import { StudioStorageError } from '../../../packages/studio-registry/server/document-contract.mjs';
import { resolveNativeRoomGameMaterial } from '../../../packages/presentation/server/native-room-game-material.mjs';
import { partnerAllow } from './partner-assignment.mjs';
import { partnerOperatorContext, decidedPartnerContext, PARTNER_TABLE_CONFLICTS } from './partner-session.mjs';
import { operatorAuditContext } from './operator-audit-context.mjs';
import { NATIVE_FILMED_PLANNING_MUTATION, wrapNativePresentationRepository } from './presentation-runtime-readiness.mjs';
import { createNativePresentationMutationTransaction } from './studio-native-runtime.mjs';
import { createRoomGameConfigApi } from './room-game-config-api.mjs';
import { createResourceLifecycleApi } from './resource-lifecycle-api.mjs';

function fail(statusCode, reason) {
  throw Object.assign(new Error('partner_table_rejected'), { statusCode, ...(reason ? { reason } : {}) });
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
// dealer och publicerade spelinställningar) kräver dessutom tables.read.
// Admins opublicerade spelinställningsutkast är ett arbetsläge, inte något
// spelarna ser: de visas bara med tables.configure (minsta behörighet).
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
  if (administration && may('tables.read') && may('tables.configure')) {
    // Bara bolagets egna utkast på bolagets egna spelbord valideras: en trasig
    // eller inaktuell rad hos ett annat bolag får aldrig fälla den här läsningen.
    const own = (Array.isArray(administration.roomGameConfigs) ? administration.roomGameConfigs : [])
      .filter(row => row?.operatorId === operator.id && rooms.some(room => room.id === row.roomId));
    try { drafts = validateRoomGameDrafts(own, administration.rooms); } catch { fail(503); }
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

const TABLE_WRITE = Object.freeze(['tables.read', 'tables.configure']);
const ROOM_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
function exactKeys(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== [...fields].sort().join(',')) fail(400);
}
const packageRevision = value => Number.isSafeInteger(value) && value >= 1;

// Spelinställningar och läge för ett eget spelbord. Samma skrivkod som Admins
// (room-game-config-api.mjs, resource-lifecycle-api.mjs) genom samma nativa
// grind; bolaget, behörigheten och `allow` läses om under bolagets lås i
// transaktionen och spelbordet måste höra till bolaget (annars 404).
function intentOf(action, body) {
  if (action === 'room-settings') {
    const save = body?.action === 'save-draft';
    exactKeys(body, ['action', 'roomId', 'expectedPackageRevision', 'expectedDraftRevision', ...(save ? ['gameConfig'] : [])]);
    if (!['save-draft', 'publish'].includes(body.action) || !ROOM_ID.test(body.roomId) || !packageRevision(body.expectedPackageRevision)
      || !(body.expectedDraftRevision === null && save || typeof body.expectedDraftRevision === 'string' && /^room-config-[a-f0-9-]{36}$/.test(body.expectedDraftRevision))) fail(400);
    if (save) validateRoomGameConfig(body.gameConfig);
    // Publiceringen journalförs redan som package.publish (operator-store.mjs).
    return { requires: allow => allow.language || allow.limit, presentation: [{ kind: 'administration', value: { roomGameConfigs: [] } },
      ...(save ? [] : [NATIVE_FILMED_PLANNING_MUTATION])], operatorPackage: !save, journaled: save };
  }
  exactKeys(body, ['roomId', 'state', 'expectedState', 'expectedPackageRevision']);
  if (!ROOM_ID.test(body.roomId) || !['live', 'pending'].includes(body.state) || !['live', 'pending'].includes(body.expectedState)
    || body.state === body.expectedState || !packageRevision(body.expectedPackageRevision)) fail(400);
  return { requires: allow => allow.pause, presentation: { kind: 'resource-lifecycle', value: {} }, operatorPackage: true, journaled: true };
}

export async function partnerTableAction(prepared, config, readBody) {
  const found = await partnerOperatorContext(prepared, config);
  const decided = await decidedPartnerContext(found);
  const { session, operator } = found;
  const may = context => TABLE_WRITE.every(permission => allowsWorkspaceResource(context, permission, { scope: session.scope, operatorId: operator.id }));
  if (!may(decided)) fail(403);
  const body = await readBody();
  const intent = intentOf(prepared.action, body);
  if (typeof config.pool?.connect !== 'function' || typeof config.pool?.query !== 'function' || typeof config.boDb?.transaction !== 'function') fail(503);
  const repository = config.repository ?? wrapNativePresentationRepository(createStudioRepository({ pool: config.pool, scope: config.scope }),
    { env: config.env ?? process.env, fetchImpl: config.fetchImpl ?? fetch });
  const transaction = config.presentationTransaction
    ?? createNativePresentationMutationTransaction({ repository, boDb: config.boDb, pool: config.pool, scope: config.scope });
  const actor = { user: session.user, audit: operatorAuditContext(session) };
  // Insatsprofilerna i tilldelningen när Admin inte angett någon lista: de som
  // bolagets spelbord har publicerade, lästa före transaktionen (frågan hör
  // till spelmotorns tabeller). Admins uttryckliga lista läses under låset.
  const settings = prepared.action === 'room-settings' ? await settingsBefore(config, operator) : null;
  const options = { presentationDocuments: ['project', 'administration'], presentationMutation: intent.presentation,
    ...(intent.operatorPackage ? { presentationOperatorIds: [operator.id] } : {}) };
  return transaction(() => repository.transaction(() => repository.withTransactionClient(async client => {
    try {
      // Samma ordning som övriga Studio-skrivare: scope-lås, sedan bolagets rad.
      const locked = await client.query(
        '/* operator-store:lock-operator */ SELECT operator_id FROM croupier_studio.operators WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 FOR UPDATE',
        [config.scope.environment, config.scope.workspaceId, operator.id]);
      if (!locked.rows.length) fail(404);
      const store = await createOperatorStore({ sql: client, scope: config.scope, now: config.now,
        transaction: work => repository.withTransactionClient(work) });
      // Sessionen, bolaget, medlemskapet och rollen läses om, som i `branding`.
      const current = await partnerOperatorContext(prepared, { ...config, store });
      const latest = await decidedPartnerContext(current);
      if (current.operator.id !== operator.id || current.session.accountId !== session.accountId
        || current.session.accessClass !== session.accessClass || !may(latest)) fail(403);
      const pack = await store.getCurrentPackage(operator.id);
      if (!pack || pack.operatorId !== operator.id) fail(404);
      const allow = partnerAllow(pack, readPackagePresentation(pack));
      if (!intent.requires(allow)) fail(403);
      // Paus, öppning och spelinställningsutkast skrivs i bolagets journal i samma
      // transaktion (Studio-migrering 022). Utan 022 skrivs ingenting: 503
      // studio_migration_required, prövat före varje annan skrivning.
      const journal = { operatorId: operator.id, roomId: body.roomId, actor: session.user, audit: actor.audit };
      if (intent.journaled) await store.assertPartnerJournalReady();
      if (prepared.action === 'room-settings') {
        const receipt = await roomSettings({ client, repository, config, operator, body, actor, allow, settings });
        if (intent.journaled) await store.recordPartnerTableEvent({ ...journal, action: 'room.settings',
          before: { draftRevision: body.expectedDraftRevision }, after: { draftRevision: receipt.draft.revision, gameConfig: receipt.draft.gameConfig,
            administrationRevision: receipt.administrationRevision } });
        const { administrationRevision: _hidden, ...visible } = receipt;
        return visible;
      }
      const lifecycle = createResourceLifecycleApi({ repository, scope: config.scope, now: config.now });
      const changed = await lifecycle.setRoomState(store, { operatorId: operator.id, roomId: body.roomId, state: body.state,
        expectedPackageRevision: body.expectedPackageRevision }, actor, async ({ room, pack: locked }) => {
        if (room.state !== body.expectedState) fail(409);
        if (body.state !== 'live') return;
        // Bara ett spelbord som redan har publicerade spelinställningar kan öppnas av bolaget;
        // ett spelbord som aldrig släppts öppnas av Admin.
        if (typeof locked?.branding?.roomGameConfigVersions?.[room.id] !== 'string') fail(409);
        // Och bara en paus som bolaget självt satt: Admins paus hävs aldrig här.
        if (!await store.isRoomPausedByPartner(operator.id,room.id,locked.revision)) fail(409, 'admin-pause');
      });
      await store.recordPartnerTableEvent({ ...journal, action: 'room.state', before: { state: body.expectedState },
        after: { state: changed.room.state, administrationRevision: changed.administrationRevision } });
      return { ok: true, room: { id: changed.room.id, state: changed.room.state }, packageRevision: changed.packageRevision };
    } catch (error) {
      if (Number.isInteger(error?.statusCode) && !(error instanceof StudioStorageError)) {
        throw Object.assign(new StudioStorageError('partner_request_rejected', error.statusCode),
          PARTNER_TABLE_CONFLICTS.includes(error.reason) ? { reason: error.reason } : {});
      }
      throw error;
    }
  })), options);
}

async function settingsBefore(config, operator) {
  const pack = await (await createOperatorStore({ sql: config.pool, scope: config.scope, now: config.now })).getCurrentPackage(operator.id);
  const presentation = readPackagePresentation(pack);
  if (!pack || pack.operatorId !== operator.id || !presentation) return new Map();
  const administration = await readAdministrationValue(config);
  const rooms = partnerPackageRooms({ administration, pack, presentation, operatorId: operator.id });
  return publishedRoomSettings({ query: (text, values) => config.pool.query(text, values), operatorId: operator.id, rooms, pack });
}

async function roomSettings({ client, repository, config, operator, body, actor, allow, settings }) {
  const api = createRoomGameConfigApi({ repository, scope: config.scope, now: config.now,
    resolveMaterial: input => resolveNativeRoomGameMaterial(input, { version: 2 }) });
  const save = body.action === 'save-draft';
  const receipt = await api.writeRoom(client, { action: body.action, operatorId: operator.id, roomId: body.roomId,
    expectedPackageRevision: body.expectedPackageRevision, ...(save ? { gameConfig: body.gameConfig } : { expectedDraftRevision: body.expectedDraftRevision }) },
  actor, async saved => {
    if (save && (saved.draft?.revision ?? null) !== body.expectedDraftRevision) fail(409);
    const candidate = save ? body.gameConfig : saved.draft?.gameConfig;
    if (!candidate) return; // Inget utkast att publicera: skrivkoden svarar 409.
    // Jämför med det publicerade: det är det spelaren ser och det bolaget ändrar.
    const baseline = saved.published?.gameConfig ?? null;
    const assignment = partnerAssignmentDetail(saved.pack, saved.presentation, settings);
    if (candidate.language !== baseline?.language && (!allow.language || !assignment.languages.includes(candidate.language))) fail(422);
    if (candidate.limitPreset !== baseline?.limitPreset && (!allow.limit || !assignment.limitPresets.includes(candidate.limitPreset))) fail(422);
  });
  return receipt;
}
