// En publicering per spelbord (målbildens steg D, docs/plans/ADMIN-FORENKLING.md §7).
// Datamodellen ändras inte: paketet fryses om och spelbordets spelinställningar
// publiceras med de befintliga skrivarna, i EN SQL-transaktion.
//
// GET  /studio/api/admin/room-release?operatorId&roomId  förhandsvisning: live och
//      kandidat per område, hinder och previewToken. Ingen provider-I/O.
// POST /studio/api/admin/operator-package {action:'publish-room', ...}  publicering.
//      Förberedelse utanför låset (infångning, mediekontroll mot Blob), därefter
//      bolagslås, N→N+1, CAS på alla revisioner och J08-skrivaren för spelbordet.
//
// Andra versionen: bolagets öppna utseendeutkast tas med i samma transaktion när rollen
// får publicera utseende (presentations.read och presentations.configure, som i Utseende).
// Utkastet prövas med Utseendes egen granskning mot kandidatens presentation, ingår i
// previewToken med sin revision och markeras publicerat av operatörsbutiken med samma
// journalrad som "Publicera granskat utkast". Utan rätten, eller när utkastet bygger på
// ett äldre paket, stoppar det som förut med 409 studio_room_choices_draft_pending.
import {createHash} from 'node:crypto';
import {createOperatorStore} from '../../../packages/operators/server/operator-store.mjs';
import {isAdministratorRole} from '../../../packages/studio-access/account-role.mjs';
import {canonicalStudioJson,validateRevision,validateStudioScope,validateStudioMedia,StudioStorageError} from '../../../packages/studio-registry/server/document-contract.mjs';
import {validateRuntimeCatalogRecord} from '../../../packages/studio-registry/server/runtime-catalog.mjs';
import {normalizeProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {isPresentationRoom,isRoomOperatorId,roomGame} from '../../../packages/presentation/contracts/presentation-room.mjs';
import {isGameLaneId} from '../../../packages/presentation/contracts/game-lane-id.mjs';
import {captureFrozenPresentation,selectedRegisteredIdleDefaults,assertCapturedPresentationMedia,assertPublishedRoomBindings} from '../../../packages/presentation/server/frozen-presentation-capture.mjs';
import {readPackagePresentation,resolvePackageRoomDealer,withPackagePresentation,publicPackageBranding} from '../../../packages/presentation/server/presentation-package.mjs';
import {listPackageRooms,resolvePackageRoom} from '../../../packages/presentation/server/package-rooms.mjs';
import {resolveNativeRoomGameMaterial} from '../../../packages/presentation/server/native-room-game-material.mjs';
import {isNativeRoomMaterial,nativeRoomMaterialVersion} from '../../../packages/presentation/contracts/native-room-filmed-planning.mjs';
import {validateRoomGameConfig,validateRoomGameDrafts,validateRoomGameMaterial} from '../../../packages/presentation/contracts/room-game-config.mjs';
import {recordedSpeechForVideo} from '../../../packages/presentation/contracts/recorded-speech.mjs';
import {resolveRoomBranding} from '../../../packages/operators/contracts/branding.mjs';
import {assertAiTablesFit} from './ai-table-publication-guard.mjs';
import {presentationPackageRequiresV29,PRESENTATION_RUNTIME_UPDATE_REQUIRED,NATIVE_FILMED_PLANNING_MUTATION} from './presentation-runtime-readiness.mjs';
import {operatorAuditContext} from './operator-audit-context.mjs';
import {cleanBrandingDraft,createPartnerBrandingApi} from './partner-branding-api.mjs';
import {allowsWorkspaceResource,internalPartnerContext} from './partner-workspace-access.mjs';
import {PARTNER_BRANDING_FIELDS,PARTNER_ROOM_BRANDING_FIELDS,publicEditableBranding} from '../../../packages/operators/contracts/branding.mjs';
import {isRoomGameMaterialReason} from './room-game-config-api.mjs';
import {isRoomReleaseReadQuery} from './studio-admin-contract.mjs';
import {mergeOperatorMaterialsForPublication,operatorMaterialFingerprint,presentationFits,publicationRooms,readOperatorMaterialRows} from './operator-material-publication.mjs';
import {AI_ADOPT_ACTION,AiAdoptError,adoptLayerAssets,validateAdoptMaterials} from './ai-material-adoption.mjs';

export const ROOM_RELEASE_ACTION = 'publish-room';
// Felkontraktet {error, code, step}: fasta koder och fasta steg, aldrig leverantörstext.
export const ROOM_RELEASE_CODES = Object.freeze(['studio_conflict','studio_release_preview_stale','studio_room_choices_draft_pending',
  'studio_room_game_material_unavailable','studio_release_invalid','studio_room_not_found','studio_presentation_runtime_update_required',
  'studio_room_config_storage_missing','studio_media_registry_unavailable']);
export const ROOM_RELEASE_STEPS = Object.freeze(['package','project','administration','room_config_head','media','materials','room_choices']);
const BODY_KEYS = ['action','operatorId','roomId','gameConfig','expectedPackageRevision','expectedProjectRevision','expectedAdministrationRevision','previewToken'];
const ADOPT_KEYS = ['action','operatorId','roomId','compositionId','materials','tableWidth','expectedProjectRevision'];

const refuse = (code, status, extra = {}) => { throw Object.assign(new StudioStorageError(code, status), extra); };
const conflict = step => refuse('studio_conflict', 409, {step});
const notFound = () => refuse('studio_room_not_found', 404);
const invalid = reason => refuse('studio_release_invalid', 422, reason ? {reason} : {});
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exact = (value, keys) => plain(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const sha256 = value => createHash('sha256').update(canonicalStudioJson(value)).digest('hex');
const rowsOf = result => Array.isArray(result) ? result : result?.rows ?? [];
function freeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
const safeCode = value => typeof value === 'string' && /^[a-z][a-z0-9_]{0,100}$/.test(value);
const DRAFT_INVALID = 'studio_room_choices_draft_invalid';
// Utkastets valbara yta ersätter brandingens, allt annat (presentation, bindningar,
// livscykel) står kvar: samma sammanfogning som Utseendes publicering.
function withEditableBranding(branding, editable) {
  const next = structuredClone(branding ?? {});
  for (const key of [...PARTNER_BRANDING_FIELDS, 'roomOverrides']) delete next[key];
  return {...next, ...publicEditableBranding(editable)};
}
// Utseendes granskning avvisar ett utkast som inte passar med 400, 409, 413 eller 422. Granskningen
// körs mot en fryst kopia (kandidatens presentation, utkastet, administrationen), så 409 betyder här
// att ett val inte ryms i kandidaten (t.ex. en dealer miljön inte tillåter), inte en samtidig ändring.
// Andra statusar (503 och liknande) är tillfälliga och släpps igenom som de är.
const DRAFT_REJECTIONS = Object.freeze([400, 409, 413, 422]);
export const isDraftValidationFailure = error => error instanceof StudioStorageError && error.code === 'partner_branding_rejected'
  && DRAFT_REJECTIONS.includes(error.statusCode);
/**
 * De val utkastet ändrar mot live (bolagets fält och spelbordens egna val) som kandidatens
 * presentation tappar. Bara utkastets nycklar jämförs: ett live-val som presentationen tar bort
 * utan att utkastet rör det hindrar inte, precis som samma publicering utan utkast.
 * @returns {string[]} sökvägar som 'dealer' eller 'roomOverrides.<spelbord>.table'
 */
export function lostDraftChoices({live, draft, candidate}) {
  const before = publicEditableBranding(live), after = publicEditableBranding(withEditableBranding(live, draft)), next = publicEditableBranding(candidate);
  const same = (a, b) => canonicalStudioJson(a ?? null) === canonicalStudioJson(b ?? null);
  const lost = [];
  for (const key of PARTNER_BRANDING_FIELDS) if (!same(before[key], after[key]) && !same(after[key], next[key])) lost.push(key);
  const rooms = new Set([...Object.keys(before.roomOverrides ?? {}), ...Object.keys(after.roomOverrides ?? {})]);
  for (const roomId of [...rooms].sort()) for (const key of PARTNER_ROOM_BRANDING_FIELDS) {
    const wanted = after.roomOverrides?.[roomId]?.[key];
    if (!same(before.roomOverrides?.[roomId]?.[key], wanted) && !same(wanted, next.roomOverrides?.[roomId]?.[key])) lost.push('roomOverrides.' + roomId + '.' + key);
  }
  return lost;
}

/**
 * Live och utkastet så som Utseendes granskning ska se dem mot kandidaten. Utkastet är hela ytan
 * och bär därför live-val det inte ändrar; ett sådant val som kandidatens presentation tar bort
 * (samma fall som lostDraftChoices släpper igenom) får kandidatens värde i både live och utkastet.
 * Granskningen prövar då bara det utkastet ändrar, och ett ändrat val som inte ryms stoppas som förut.
 * @returns {{live:object, draft:object}} publika valbara ytor
 */
export function draftReviewSurfaces({live, draft, candidate}) {
  const base = structuredClone(publicEditableBranding(live)), wanted = structuredClone(publicEditableBranding(withEditableBranding(live, draft)));
  const next = publicEditableBranding(candidate);
  const same = (a, b) => canonicalStudioJson(a ?? null) === canonicalStudioJson(b ?? null);
  const settle = (from, to, value) => {
    if (value === undefined) { delete from.object[from.key]; delete to.object[to.key]; }
    else { from.object[from.key] = structuredClone(value); to.object[to.key] = structuredClone(value); }
  };
  for (const key of PARTNER_BRANDING_FIELDS) if (same(base[key], wanted[key]) && !same(wanted[key], next[key]))
    settle({object:base, key}, {object:wanted, key}, next[key]);
  for (const roomId of Object.keys(wanted.roomOverrides ?? {})) for (const key of PARTNER_ROOM_BRANDING_FIELDS) {
    const was = base.roomOverrides?.[roomId], now = wanted.roomOverrides[roomId];
    if (!was || !same(was[key], now[key]) || same(now[key], next.roomOverrides?.[roomId]?.[key])) continue;
    settle({object:was, key}, {object:now, key}, next.roomOverrides?.[roomId]?.[key]);
  }
  for (const surface of [base, wanted]) {
    for (const [roomId, value] of Object.entries(surface.roomOverrides ?? {})) if (!Object.keys(value).length) delete surface.roomOverrides[roomId];
    if (surface.roomOverrides && !Object.keys(surface.roomOverrides).length) delete surface.roomOverrides;
  }
  return {live:base, draft:wanted};
}

/** Den publika felkroppen för rummets publicering, eller null för andra fel. */
export function roomReleaseErrorBody(error, status) {
  if (!(error instanceof StudioStorageError) || error.statusCode !== status) return null;
  if (status === 422 && !ROOM_RELEASE_CODES.includes(error.code)) {
    // Infångningens egna 422-koder (t.ex. saknad vila) blir ett fast release-fel med skälet.
    return {error:'studio_release_invalid', code:'studio_release_invalid', ...(safeCode(error.code) ? {reason:error.code} : {})};
  }
  if (!ROOM_RELEASE_CODES.includes(error.code)) return null;
  return {error:error.code, code:error.code,
    ...(error.code === 'studio_conflict' && ROOM_RELEASE_STEPS.includes(error.step) ? {step:error.step} : {}),
    ...(error.code === 'studio_room_game_material_unavailable' && isRoomGameMaterialReason(error.materialReason) ? {materialReason:error.materialReason} : {}),
    ...(error.code === 'studio_release_invalid' && safeCode(error.reason) ? {reason:error.reason} : {})};
}

/** Exakt kropp för POST operator-package {action:'publish-room'}; allt annat är 422. */
export function roomReleaseIntent(body) {
  if (!exact(body, BODY_KEYS) || body.action !== ROOM_RELEASE_ACTION || !isRoomOperatorId(body.operatorId) || !isGameLaneId(body.roomId)
    || !Number.isSafeInteger(body.expectedPackageRevision) || body.expectedPackageRevision < 1
    || typeof body.previewToken !== 'string' || !/^[a-f0-9]{64}$/.test(body.previewToken)) invalid();
  try {
    validateRevision(body.expectedProjectRevision); validateRevision(body.expectedAdministrationRevision);
    validateRoomGameConfig(body.gameConfig);
  } catch { invalid(); }
  return structuredClone(body);
}

/**
 * "Använd i miljön och i spelbordet" (AI-dialogen): exakt kropp för POST operator-package
 * {action:'adopt-room-material'}. Materialet tillåts i spelbordets scenmall och blir dess
 * standard (bordets bredd följer med), och spelbordet publiceras i samma transaktion.
 */
export function adoptRoomMaterialIntent(body) {
  if (!exact(body, ADOPT_KEYS) || body.action !== AI_ADOPT_ACTION || !isRoomOperatorId(body.operatorId) || !isGameLaneId(body.roomId)
    || typeof body.compositionId !== 'string' || body.compositionId.length > 63 || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(body.compositionId)) invalid();
  try { validateRevision(body.expectedProjectRevision); return {...structuredClone(body), ...validateAdoptMaterials(body.materials, body.tableWidth)}; }
  catch { return invalid(); }
}
// Live och kandidat utan projektrevisionen: lika betyder att inget annat sparat väntar.
const samePresentation = (live, next) => Boolean(live && next)
  && canonicalStudioJson({...live, projectRevision:null}) === canonicalStudioJson({...next, projectRevision:null});

/** Spelbordet ska vara bolagets, öppet, blackjack och ingå i bolagets nuvarande paket. */
function liveRoom(administration, pack, operatorId, roomId) {
  const matches = (administration?.rooms ?? []).filter(row => row?.id === roomId), room = matches.length === 1 ? matches[0] : null;
  if (!pack || pack.operatorId !== operatorId || !isPresentationRoom(room) || roomGame(room) !== 'blackjack' || room.operatorId !== operatorId
    || room.state !== 'live' || !pack.games?.includes('blackjack') || !resolvePackageRoom({administration, package:pack, operatorId, roomId})) notFound();
  return structuredClone(room);
}

// Det spelaren märker per område. Fullständiga listor används för jämförelse och token;
// svaret visar antal i stället för klipplistan.
function releaseAreas(pack, presentation, room, gameConfig) {
  const lane = presentation?.lanes.find(row => row.id === room.presentationLaneId);
  if (!lane) return null;
  const dealerId = resolvePackageRoomDealer(pack, room, presentation);
  const media = (presentation.playback?.media ?? []).filter(row => row.classification?.dealerId === dealerId);
  const speech = media.filter(row => row.classification.kind === 'speech').map(row => {
    const recorded = row.classification.recordedSpeech ?? {};
    return {lineId:row.classification.situation ?? '', language:recorded.language ?? null, takeId:recorded.takeId ?? null,
      approvedBy:recorded.review?.status === 'approved' && typeof recorded.review.by === 'string' ? recorded.review.by : null, mediaId:row.id};
  }).sort((a, b) => `${a.lineId}\0${a.language}\0${a.mediaId}`.localeCompare(`${b.lineId}\0${b.language}\0${b.mediaId}`));
  const registered = presentation.registeredDealers?.find(row => row.id === dealerId);
  const policies = (presentation.playback?.dealerIdlePolicies ?? []).filter(row => row.dealerId === dealerId);
  const branding = resolveRoomBranding({lane:presentation.lanes[0].id, ...publicPackageBranding(pack.branding)}, room.id, lane.id);
  return {dealerId:dealerId ?? null, speech,
    clips:media.map(row => `${row.id}:${row.sha256}`).sort(),
    idle:{mediaId:registered?.idle?.id ?? null, policySha256:policies.length ? sha256(policies) : null},
    placement:{compositionSha256:sha256(lane.composition ?? null)},
    settings:gameConfig ? validateRoomGameConfig(gameConfig) : null,
    roomChoices:{dealer:dealerId ?? null, table:branding.table ?? lane.layers.table.default ?? null,
      background:branding.background ?? lane.layers.background.default ?? null}};
}
function publicAreas(areas) {
  return areas ? {...structuredClone(areas), clips:{count:areas.clips.length},
    speech:areas.speech.map(({mediaId, ...row}) => row)} : null;
}
function releaseChanges(live, next, presentationChanged) {
  const changes = [];
  if (!next) return changes;
  const key = row => `${row.lineId}\0${row.language}`;
  const take = row => row ? {takeId:row.takeId, approvedBy:row.approvedBy} : null;
  const before = new Map((live?.speech ?? []).map(row => [key(row), row])), after = new Map(next.speech.map(row => [key(row), row]));
  for (const id of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const was = before.get(id), now = after.get(id);
    if (canonicalStudioJson(was ? {...take(was), mediaId:was.mediaId} : null) !== canonicalStudioJson(now ? {...take(now), mediaId:now.mediaId} : null))
      changes.push({area:'speech', lineId:(now ?? was).lineId, language:(now ?? was).language, before:take(was), after:take(now)});
  }
  const liveClips = new Set(live?.clips ?? []), nextClips = new Set(next.clips);
  const added = next.clips.filter(id => !liveClips.has(id)).length, removed = [...liveClips].filter(id => !nextClips.has(id)).length;
  if (added || removed) changes.push({area:'clips', added, removed});
  if (canonicalStudioJson(live?.idle ?? null) !== canonicalStudioJson(next.idle)) changes.push({area:'idle', before:live?.idle ?? null, after:next.idle});
  if (live?.placement.compositionSha256 !== next.placement.compositionSha256) changes.push({area:'placement'});
  if (canonicalStudioJson(live?.settings ?? null) !== canonicalStudioJson(next.settings)) changes.push({area:'settings', before:live?.settings ?? null, after:next.settings});
  for (const role of ['background','dealer','table']) {
    const was = live?.roomChoices[role] ?? null, now = next.roomChoices[role];
    if (was !== now) changes.push({area:'roomChoices', key:role, before:was, after:now});
  }
  // Annat i paketet (andra miljöer, andra dealers) som inte syns i områdena ovan.
  if (presentationChanged && !changes.some(row => row.area !== 'settings')) changes.push({area:'package'});
  return changes;
}

export function createRoomRelease({pool, scope, repository, videoRegistry, store, now = () => Date.now(), materials = null,
  resolveMaterial = input => resolveNativeRoomGameMaterial(input, {version:2})} = {}) {
  // Ogiltig konfiguration upptäcks vid anrop (503), inte när paket-API:t skapas.
  let scopeKey = null, params = null;
  try { scope = validateStudioScope(scope); scopeKey = canonicalStudioJson(scope); params = [scope.environment, scope.workspaceId]; }
  catch { scope = null; }
  const preparedValues = new WeakSet();
  const canExtend = () => typeof repository?.withMutationContext === 'function';
  function requireRuntime() {
    if (!scopeKey || typeof pool?.query !== 'function' || typeof store !== 'function' || typeof resolveMaterial !== 'function'
      || !repository?.readPresentationSnapshot || !repository.transaction || !repository.withTransactionClient
      || typeof repository.readDocument !== 'function' || typeof repository.saveDocument !== 'function'
      || canonicalStudioJson(validateStudioScope(repository.scope)) !== scopeKey) refuse('studio_storage_unavailable', 503);
  }
  function trusted(context) {
    if (!isAdministratorRole(context.actor?.role) || typeof context.actor?.user !== 'string' || !context.actor.user
      || canonicalStudioJson(validateStudioScope(context.scope)) !== scopeKey) refuse('studio_forbidden', 403);
  }
  // Rätten att publicera utseende, med Utseendes policy: en N1-administratör med konto får
  // presentations.read och presentations.configure för bolaget som internal-admin
  // (partner-workspace-access.mjs, partner-session.mjs). Ett konto utan id får det inte.
  function mayPublishAppearance(actor, operatorId) {
    const context = internalPartnerContext({accountId:actor?.accountId, role:actor?.role, scope}, {id:operatorId, status:'active', scope});
    return ['presentations.read','presentations.configure'].every(permission => allowsWorkspaceResource(context, permission, {scope, operatorId}));
  }
  const materialRows = async (sql, operatorId) => materials ? readOperatorMaterialRows(materials(sql), operatorId) : [];
  // 009-lagringen (spelinställningar) kontrolleras innan något skrivs.
  async function storageReady(sql) {
    const row = rowsOf(await sql.query(`/* room-release:storage */ SELECT to_regclass('croupier_game.shared_table_configs')::text AS configs,
      to_regclass('croupier_game.shared_table_config_heads')::text AS heads WHERE $1::text IS NOT NULL AND $2::text IS NOT NULL`, params))[0];
    return Boolean(row?.configs && row?.heads);
  }
  // Exakt den version paketet binder, aldrig ett utkast eller senaste huvudet.
  async function publishedConfig(sql, pack, room) {
    const bindings = pack?.branding?.roomGameConfigVersions;
    if (!plain(bindings) || !Object.hasOwn(bindings, room.id)) return null;
    const version = bindings[room.id];
    if (typeof version !== 'string') refuse('studio_corrupt_room_game_config', 503);
    const row = rowsOf(await sql.query(`/* room-release:read-published */ SELECT body FROM croupier_game.shared_table_configs
      WHERE $1::text IS NOT NULL AND $2::text IS NOT NULL AND room_id=$3 AND version=$4`, [...params, room.id, version]))[0];
    let value;
    try { value = typeof row?.body === 'string' ? JSON.parse(row.body) : row?.body; } catch { refuse('studio_corrupt_room_game_config', 503); }
    if (!value || value.configVersion !== version || value.operatorId !== room.operatorId || value.roomId !== room.id
      || !Number.isSafeInteger(value.packageRevision)) refuse('studio_corrupt_room_game_config', 503);
    let gameConfig;
    try { gameConfig = validateRoomGameConfig({language:value.language, limitPreset:value.limitPreset}); }
    catch { refuse('studio_corrupt_room_game_config', 503); }
    return {configVersion:version, packageRevision:value.packageRevision, gameConfig, material:value.material ?? null};
  }
  // Bolaget, spelbordet och dess utkast, lästa utanför låset.
  // includeDraft: utkastet tas med (rätten finns och det bygger på nuvarande paket).
  async function readState(operatorId, roomId, actor) {
    const operators = await store(), operator = await operators.getOperatorById(operatorId);
    if (!operator || operator.status !== 'active') notFound();
    const snapshot = await repository.readPresentationSnapshot(), current = await operators.getCurrentPackage(operatorId);
    if (canonicalStudioJson(validateStudioScope(snapshot?.scope)) !== scopeKey) refuse('studio_scope_mismatch', 409);
    const administration = snapshot.administrationDocument.value, room = liveRoom(administration, current, operatorId, roomId);
    const rawBrandingDraft = await operators.getBrandingDraft(operatorId);
    const brandingDraft = await cleanBrandingDraft(rawBrandingDraft, current, operators);
    const includeDraft = Boolean(brandingDraft) && brandingDraft.basePackageRevision === current.revision && mayPublishAppearance(actor, operatorId);
    return {operators, snapshot, administration, current, room, brandingDraft, rawBrandingDraft, includeDraft};
  }
  // Utseendes egen granskning (partner-branding-api.mjs, action 'review') av utkastet mot
  // kandidatens presentation: samma val, rättigheter, dealerval och bordskontroller som
  // "Granska publicering", utan skrivning. Ett utkast som inte passar är 422 med fast skäl.
  async function reviewDraft({state, built, actor}) {
    const {operators, current} = state;
    // Bara det utkastet ändrar granskas: live-val som kandidaten tappar och utkastet inte rör
    // rensas ur både live och utkastet (draftReviewSurfaces), precis som publiceringen utan utkast.
    const surfaces = draftReviewSurfaces({live:current.branding, draft:state.brandingDraft.branding, candidate:built.candidate.branding});
    const rawBrandingDraft = {...state.rawBrandingDraft, branding:surfaces.draft};
    const view = {...current, branding:withEditableBranding(built.candidate.branding, surfaces.live)};
    const document = structuredClone(state.snapshot.administrationDocument);
    const readAdministration = async () => document;
    const source = {...operators, getCurrentPackage:async id => id === current.operatorId ? view : null, getBrandingDraft:async () => rawBrandingDraft};
    const api = createPartnerBrandingApi({store:source, readAdministration, readProject:async () => refuse('studio_storage_unavailable', 503),
      withWriteContext:work => work({store:source, readAdministration, reauthorize:async () => true})});
    try {
      return await api.command({action:'review', operatorId:current.operatorId, expectedDraftRevision:rawBrandingDraft.revision,
        expectedPackageRevision:current.revision, actor:actor.user, audit:operatorAuditContext(actor)});
    } catch (error) {
      if (isDraftValidationFailure(error)) invalid(DRAFT_INVALID);
      throw error;
    }
  }
  // Samma infångning som "Publicera igen" (operator-package-api.mjs prepare) för paketets
  // alla miljöer, med bolagets eget material. verify=false: ingen provider-I/O.
  async function buildCandidate({snapshot, current, administration, operatorId, rows, brandingDraft, includeDraft}) {
    // Med utkastet byggs kandidaten på utkastets val; materialet ryms mot den brandingen.
    const baseBranding = includeDraft ? withEditableBranding(current.branding, brandingDraft.branding) : current.branding;
    let saved;
    try { saved = normalizeProject(snapshot.projectDocument.value); } catch { invalid('studio_presentation_required'); }
    const allowed = new Set((saved.lanes ?? []).map(lane => lane.id)), lanes = [...current.lanes];
    if (!lanes.length || lanes.some(id => !allowed.has(id))) invalid('studio_presentation_required');
    assertAiTablesFit(saved.lanes.filter(lane => lanes.includes(lane.id)), saved.layerAssets ?? []);
    const hasDealers = saved.lanes.filter(lane => lanes.includes(lane.id)).some(lane => lane.dealers.length || lane.layers.dealer.allowed.length);
    if (hasDealers && (typeof videoRegistry?.loadCaptured !== 'function' || typeof videoRegistry?.verifyCapturedMedia !== 'function'))
      refuse('studio_media_registry_unavailable', 503);
    const inventory = hasDealers ? await videoRegistry.loadCaptured(snapshot) : null;
    const rooms = (administration.rooms ?? []).filter(room => room.operatorId === operatorId && current.tables.includes(room.id));
    const blackjackLanes = lanes.filter(id => !rooms.some(room => room.presentationLaneId === id)
      || rooms.some(room => room.presentationLaneId === id && (room.game ?? 'blackjack') === 'blackjack'));
    const rouletteLanes = lanes.filter(id => rooms.some(room => room.presentationLaneId === id && room.game === 'roulette'));
    const captured = captureFrozenPresentation({snapshot, selectedLaneIds:lanes, inventory,
      requiredIdleDealerIds:selectedRegisteredIdleDefaults(saved, blackjackLanes),
      requiredRouletteIdleDealerIds:selectedRegisteredIdleDefaults(saved, rouletteLanes)});
    let presentation = captured.presentation, materialWarnings = [], materialFingerprint = null;
    if (materials) {
      const merged = mergeOperatorMaterialsForPublication({presentation, rows, rooms:publicationRooms(administration, operatorId, current),
        fits:presentationFits({branding:baseBranding, base:presentation, allowExtended:canExtend()})});
      presentation = merged.presentation; materialWarnings = merged.warnings ?? []; materialFingerprint = operatorMaterialFingerprint(rows);
    }
    try { assertPublishedRoomBindings({administration, operatorId, currentPackage:current, presentation}); }
    catch (error) {
      // Den nya presentationen kan inte bära ett öppet spelbord: inget att vänta ut.
      if (error?.code === 'studio_conflict') invalid('studio_room_binding_incompatible');
      throw error;
    }
    if (!canExtend() && presentationPackageRequiresV29(presentation)) refuse(PRESENTATION_RUNTIME_UPDATE_REQUIRED, 503);
    const candidate = {operatorId, revision:current.revision + 1, lanes:[...current.lanes], games:[...current.games], tables:[...current.tables],
      branding:withPackagePresentation(baseBranding, presentation, {allowExtended:canExtend()})};
    // Presentationen tar tyst bort val den inte bär; ett utkastval får inte försvinna så.
    if (includeDraft && lostDraftChoices({live:current.branding, draft:brandingDraft.branding, candidate:candidate.branding}).length) invalid(DRAFT_INVALID);
    return {presentation, candidate, mediaPreconditions:captured.mediaPreconditions, materialWarnings, materialFingerprint};
  }
  // Samma materialkontroll som room-game-config-api.mjs material(): rummets material
  // löses mot kandidatpaketet, varje frusen post ska vara lika med registrets post och
  // varje tal godkänt för språket. Kastar 422 med materialReason ur den fasta listan.
  async function roomMaterial({snapshot, candidate, presentation, room, gameConfig}) {
    try {
      const capturedCatalog = validateRuntimeCatalogRecord(snapshot.runtimeCatalog);
      const dealerId = resolvePackageRoomDealer(candidate, room, presentation);
      if (!dealerId) refuse('studio_room_game_material_unavailable', 422);
      const value = validateRoomGameMaterial(await resolveMaterial({room:structuredClone(room), package:structuredClone(candidate),
        language:gameConfig.language, capturedCatalog:structuredClone(capturedCatalog)}), {language:gameConfig.language, dealerId});
      const captured = [...(presentation.playback?.media ?? []), ...(presentation.registeredDealers ?? []).flatMap(row => row.idle ? [row.idle] : [])];
      const preconditions = value.media.map(ref => {
        const frozen = captured.find(row => row.id === ref.id && row.sha256 === ref.sha256 && row.classification?.dealerId === value.dealerId);
        const registered = snapshot.mediaRows?.find(row => row.id === ref.id);
        if (!frozen || !registered) refuse('studio_room_game_material_unavailable', 422);
        const {revision, updatedAt, ...input} = registered, record = validateStudioMedia(input);
        if (record.deletion || record.classification.archived === true || canonicalStudioJson(record) !== canonicalStudioJson(validateStudioMedia(frozen)))
          refuse('studio_room_game_material_unavailable', 422);
        if (record.classification.kind === 'speech' && !recordedSpeechForVideo(record, {dealerId:value.dealerId, language:gameConfig.language,
          lineId:frozen.classification.situation, takeId:frozen.classification.recordedSpeech?.takeId})) refuse('studio_room_game_material_unavailable', 422);
        return {id:record.id, revision:validateRevision(revision), record};
      });
      return {material:value, preconditions};
    } catch (error) {
      if (error?.statusCode === 422) refuse('studio_room_game_material_unavailable', 422,
        error.code === 'studio_room_game_material_unavailable' && isRoomGameMaterialReason(error.reason) ? {materialReason:error.reason} : {});
      throw error;
    }
  }
  // Skillnaden mot live och dess hash. Samma funktion för förhandsvisning och publicering.
  function compare({state, live, gameConfig, built, review = null}) {
    const livePresentation = readPackagePresentation(state.current);
    const liveAreas = releaseAreas(state.current, livePresentation, state.room, live?.gameConfig ?? null);
    const nextAreas = built && gameConfig ? releaseAreas(built.candidate, built.presentation, state.room, gameConfig) : null;
    const presentationSha256 = {live:livePresentation ? sha256(livePresentation) : null, candidate:built ? sha256(built.presentation) : null};
    const changes = releaseChanges(liveAreas, nextAreas, presentationSha256.live !== presentationSha256.candidate);
    // Utkastet är ett eget ändrat område: Utseendes granskningsrader (bolaget och varje spelbord).
    const appearance = state.includeDraft ? {revision:state.brandingDraft.revision, branding:state.brandingDraft.branding} : null;
    if (nextAreas && appearance && review) changes.push({area:'appearance', draftRevision:appearance.revision,
      changes:structuredClone(review.changes), affectedRooms:[...review.affectedRooms]});
    const revisions = {package:state.current.revision, project:state.snapshot.projectDocument.revision, administration:state.snapshot.administrationDocument.revision};
    const previewToken = sha256({contract:'room-release/1', scope, operatorId:state.room.operatorId, roomId:state.room.id, revisions,
      configVersion:live?.configVersion ?? null, presentationSha256, gameConfig:gameConfig ?? null, live:liveAreas, candidate:nextAreas,
      materialFingerprint:built?.materialFingerprint ?? null, appearance, brandingDraft:state.brandingDraft?.revision ?? null});
    return {liveAreas, nextAreas, changes, changed:Boolean(nextAreas) && (changes.length > 0 || !live), revisions, presentationSha256, previewToken};
  }
  function blockerOf(error, area) {
    if (error?.code === 'ai_table_misfit') return {code:'ai_table_misfit', area:'placement', compositionId:error.compositionId ?? null,
      assetId:error.assetId ?? null, reason:['ai_table_other_dealer','ai_table_other_placement'].includes(error.reason) ? error.reason : null};
    if (!(error instanceof StudioStorageError)) throw error;
    const body = roomReleaseErrorBody(error, error.statusCode);
    if (!body) throw error;
    const {error:_message, ...rest} = body;
    return {area, ...rest};
  }

  async function read(context) {
    trusted(context);
    const url = new URL(context.request.url);
    if (!isRoomReleaseReadQuery('GET', url)) refuse('studio_invalid_data', 400);
    requireRuntime();
    const operatorId = url.searchParams.get('operatorId'), roomId = url.searchParams.get('roomId');
    if (!isRoomOperatorId(operatorId) || !isGameLaneId(roomId)) notFound();
    const state = await readState(operatorId, roomId, context.actor), blockers = [];
    const storage = await storageReady(pool);
    if (!storage) blockers.push({area:'settings', code:'studio_room_config_storage_missing'});
    if (state.brandingDraft && !state.includeDraft)
      blockers.push({area:'roomChoices', code:'studio_room_choices_draft_pending', draftRevision:state.brandingDraft.revision});
    const live = storage ? await publishedConfig(pool, state.current, state.room) : null;
    const draft = validateRoomGameDrafts(state.administration.roomGameConfigs ?? [], state.administration.rooms).find(row => row.roomId === roomId) ?? null;
    const gameConfig = draft?.gameConfig ?? live?.gameConfig ?? null;
    if (!gameConfig) blockers.push({area:'settings', code:'studio_room_game_config_missing'});
    let built = null, review = null;
    const draftBlocker = error => { const row = blockerOf(error, 'package'); return row.reason === DRAFT_INVALID ? {...row, area:'roomChoices'} : row; };
    try { built = await buildCandidate({...state, operatorId, rows:await materialRows(pool, operatorId)}); }
    catch (error) { blockers.push(draftBlocker(error)); }
    if (built && state.includeDraft) {
      try { review = await reviewDraft({state, built, actor:context.actor}); }
      catch (error) { blockers.push(draftBlocker(error)); }
    }
    const view = compare({state, live, gameConfig, built, review});
    if (built && gameConfig) {
      try { await roomMaterial({snapshot:state.snapshot, candidate:built.candidate, presentation:built.presentation, room:state.room, gameConfig}); }
      catch (error) { blockers.push(blockerOf(error, 'speech')); }
    }
    // Andra öppna spelbord i paketet: deras spelinställningar binds om när presentationen
    // ändras. Inställningarna står kvar; nativt material ska gå att lösa mot kandidaten.
    const affectedRooms = [];
    for (const room of listPackageRooms({administration:state.administration, package:state.current, operatorId})) {
      if (room.id === roomId || room.state !== 'live' || roomGame(room) !== 'blackjack') continue;
      const bound = Object.hasOwn(state.current.branding?.roomGameConfigVersions ?? {}, room.id);
      const rebinds = Boolean(bound && built) && (view.presentationSha256.live !== view.presentationSha256.candidate
        || resolvePackageRoomDealer(state.current, room) !== resolvePackageRoomDealer(built.candidate, room));
      affectedRooms.push({id:room.id, name:room.name, bound, rebinds});
      if (!rebinds || !storage) continue;
      const config = await publishedConfig(pool, state.current, room);
      // J08 binder om icke-nativt material bara med oförändrad presentation och dealer
      // (room-game-publication.mjs): en ändrad kandidat blir annars 422 vid publiceringen.
      if (!isNativeRoomMaterial(config?.material)) {
        blockers.push({area:'rooms', code:'studio_room_game_material_unavailable', roomId:room.id});
        continue;
      }
      try { resolveNativeRoomGameMaterial({package:structuredClone(built.candidate), room:structuredClone(room), language:config.gameConfig.language},
        {version:nativeRoomMaterialVersion(config.material)}); }
      catch (error) {
        if (error?.code !== 'studio_room_game_material_unavailable' || error.statusCode !== 422) throw error;
        blockers.push({area:'rooms', code:error.code, roomId:room.id, ...(isRoomGameMaterialReason(error.reason) ? {materialReason:error.reason} : {})});
      }
    }
    return {ok:true, operatorId, roomId, revisions:{...view.revisions, configVersion:live?.configVersion ?? null,
      roomGameConfigDraft:draft?.revision ?? null, brandingDraft:state.brandingDraft?.revision ?? null},
    gameConfig, live:publicAreas(view.liveAreas), candidate:publicAreas(view.nextAreas), changes:view.changes, changed:view.changed,
    affectedRooms, ready:view.changed && blockers.length === 0, blockers, previewToken:view.previewToken,
    appearanceDraft:state.brandingDraft ? {revision:state.brandingDraft.revision, included:state.includeDraft} : null,
    ...(built?.materialWarnings?.length ? {materialWarnings:structuredClone(built.materialWarnings)} : {})};
  }

  // Ett utkast lika med live är inget att publicera; det tas bort med CAS på administrationens
  // revision så att det inte ligger kvar som väntande. Svaret är ändå 422 studio_release_unchanged.
  async function dropNoopDraft({state, roomId, live, gameConfig, actor}) {
    const drafts = validateRoomGameDrafts(state.administration.roomGameConfigs ?? [], state.administration.rooms);
    const draft = drafts.find(row => row.roomId === roomId), same = value => canonicalStudioJson(value) === canonicalStudioJson(gameConfig);
    if (!draft || !live || !same(draft.gameConfig) || !same(live.gameConfig)) return;
    const value = {...state.administration, roomGameConfigs:drafts.filter(row => row.roomId !== roomId)};
    try {
      // Egen transaktion utanför publiceringens: vägran ska inte rulla tillbaka borttagningen.
      await repository.transaction(() => repository.saveDocument('administration', {value,
        expectedRevision:state.snapshot.administrationDocument.revision, actor}), {presentationMutation:[{kind:'administration', value}]});
    } catch (error) { if (error?.code === 'studio_conflict') conflict('administration'); throw error; }
  }

  // Steg 1: förbered utanför SQL-låset. Inaktuell förhandsvisning stoppas före provider-I/O.
  async function prepare(context) {
    trusted(context);
    const body = roomReleaseIntent(context.body);
    requireRuntime();
    const state = await readState(body.operatorId, body.roomId, context.actor);
    if (state.current.revision !== body.expectedPackageRevision) conflict('package');
    if (state.snapshot.projectDocument.revision !== body.expectedProjectRevision) conflict('project');
    if (state.snapshot.administrationDocument.revision !== body.expectedAdministrationRevision) conflict('administration');
    if (!await storageReady(pool)) refuse('studio_room_config_storage_missing', 503);
    if (state.brandingDraft && !state.includeDraft) refuse('studio_room_choices_draft_pending', 409);
    const live = await publishedConfig(pool, state.current, state.room);
    const built = await buildCandidate({...state, operatorId:body.operatorId, rows:await materialRows(pool, body.operatorId)});
    const review = state.includeDraft ? await reviewDraft({state, built, actor:context.actor}) : null;
    const view = compare({state, live, gameConfig:body.gameConfig, built, review});
    if (view.previewToken !== body.previewToken) refuse('studio_release_preview_stale', 409);
    if (!view.changed) {
      await dropNoopDraft({state, roomId:body.roomId, live, gameConfig:body.gameConfig, actor:context.actor.user});
      invalid('studio_release_unchanged');
    }
    await roomMaterial({snapshot:state.snapshot, candidate:built.candidate, presentation:built.presentation, room:state.room, gameConfig:body.gameConfig});
    if (built.mediaPreconditions.length) await videoRegistry.verifyCapturedMedia(built.mediaPreconditions);
    const administration = structuredClone(state.administration);
    // Djupfryst: en förberedelse kan inte ändras mellan förhandsvisning och lås.
    const value = freeze({action:ROOM_RELEASE_ACTION, intent:canonicalStudioJson(body), operatorId:body.operatorId, roomId:body.roomId,
      expectedPackageRevision:state.current.revision, projectRevision:state.snapshot.projectDocument.revision,
      administrationRevision:state.snapshot.administrationDocument.revision, presentation:built.presentation,
      currentBrandingSha256:sha256(state.current.branding), candidateBranding:structuredClone(built.candidate.branding), mediaPreconditions:built.mediaPreconditions, materialFingerprint:built.materialFingerprint,
      gameConfig:structuredClone(body.gameConfig), projectWrite:null,
      materialWarnings:structuredClone(built.materialWarnings), changes:structuredClone(view.changes),
      appearanceDraftRevision:state.includeDraft ? state.brandingDraft.revision : null,
      // Lagringsbeskrivningen för det administrationsdokument som skrivs utan rummets utkast.
      administrationDescriptor:{...administration, roomGameConfigs:administration.roomGameConfigs ?? []}});
    preparedValues.add(value);
    return value;
  }

  // "Använd i miljön och i spelbordet": samma förberedelse som publiceringen, på projektet
  // med materialet infört. Inget annat som är sparat men inte live får följa med: finns det
  // (ett annat val, en annan mall, klipp, tal eller inställningar) stoppas åtgärden och
  // spelbordet publiceras som vanligt med Publicera, där skillnaden visas.
  async function prepareAdopt(context) {
    trusted(context);
    const body = adoptRoomMaterialIntent(context.body);
    requireRuntime();
    const state = await readState(body.operatorId, body.roomId, context.actor);
    if (state.snapshot.projectDocument.revision !== body.expectedProjectRevision) conflict('project');
    if (state.room.presentationLaneId !== body.compositionId) invalid('ai_adopt_other_template');
    if (state.brandingDraft) refuse('studio_room_choices_draft_pending', 409);
    if (!await storageReady(pool)) refuse('studio_room_config_storage_missing', 503);
    const live = await publishedConfig(pool, state.current, state.room);
    if (!live) invalid('studio_room_game_config_missing');
    const draft = validateRoomGameDrafts(state.administration.roomGameConfigs ?? [], state.administration.rooms).find(row => row.roomId === body.roomId);
    if (draft && canonicalStudioJson(draft.gameConfig) !== canonicalStudioJson(live.gameConfig)) invalid('studio_release_other_changes');
    const rows = await materialRows(pool, body.operatorId);
    const baseline = await buildCandidate({...state, operatorId:body.operatorId, rows});
    const before = compare({state, live, gameConfig:live.gameConfig, built:baseline});
    if (before.changes.some(row => row.area !== 'package') || !samePresentation(readPackagePresentation(state.current), baseline.presentation))
      invalid('studio_release_other_changes');
    let project;
    try { project = adoptLayerAssets(state.snapshot.projectDocument.value, body); }
    catch (error) { if (error instanceof AiAdoptError) invalid(error.code); throw error; }
    const adopted = {...state, snapshot:{...state.snapshot, projectDocument:{...state.snapshot.projectDocument, value:project}}};
    const built = await buildCandidate({...adopted, operatorId:body.operatorId, rows});
    const view = compare({state:adopted, live, gameConfig:live.gameConfig, built});
    // Samma klick två gånger: inget skiljer sig från live, så inget publiceras (N→N+1 utan ändring).
    if (!view.changed) invalid('studio_release_unchanged');
    // Ett eget val hos bolaget eller spelbordet skulle dölja mallens standard: då publiceras inget.
    if (body.materials.some(({role, assetId}) => view.nextAreas?.roomChoices?.[role] !== assetId)) invalid('ai_adopt_room_choice');
    // Ny bredd gäller hela scenmallen. Ett annat öppet spelbord i paketet på samma mall som visar
    // ett annat bord (eget val) skulle breddas utan att synas i kvittot: då publiceras inget.
    if (body.tableWidth) {
      const table = body.materials.find(row => row.role === 'table').assetId;
      const others = listPackageRooms({administration:state.administration, package:built.candidate, operatorId:body.operatorId})
        .filter(room => room.id !== body.roomId && room.state === 'live' && room.presentationLaneId === body.compositionId);
      if (others.some(room => releaseAreas(built.candidate, built.presentation, room, null)?.roomChoices.table !== table)) invalid('ai_adopt_other_room_table');
    }
    await roomMaterial({snapshot:state.snapshot, candidate:built.candidate, presentation:built.presentation, room:state.room, gameConfig:live.gameConfig});
    if (built.mediaPreconditions.length) await videoRegistry.verifyCapturedMedia(built.mediaPreconditions);
    const administration = structuredClone(state.administration);
    const value = freeze({action:AI_ADOPT_ACTION, intent:canonicalStudioJson(body), operatorId:body.operatorId, roomId:body.roomId,
      expectedPackageRevision:state.current.revision, projectRevision:state.snapshot.projectDocument.revision,
      administrationRevision:state.snapshot.administrationDocument.revision, presentation:built.presentation,
      currentBrandingSha256:sha256(state.current.branding), baseBranding:structuredClone(state.current.branding),
      candidateBranding:structuredClone(built.candidate.branding), mediaPreconditions:built.mediaPreconditions, materialFingerprint:built.materialFingerprint,
      materialWarnings:structuredClone(built.materialWarnings), changes:structuredClone(view.changes), appearanceDraftRevision:null,
      gameConfig:structuredClone(live.gameConfig), projectWrite:structuredClone(project),
      administrationDescriptor:{...administration, roomGameConfigs:administration.roomGameConfigs ?? []}});
    preparedValues.add(value);
    return value;
  }

  // Steg 2: en SQL-transaktion med bolagslås, N→N+1 och CAS på alla revisioner.
  async function publish(context) {
    trusted(context);
    const adopt = context.body?.action === AI_ADOPT_ACTION;
    const body = adopt ? adoptRoomMaterialIntent(context.body) : roomReleaseIntent(context.body);
    const prepared = context.prepared === undefined ? await (adopt ? prepareAdopt(context) : prepare(context)) : context.prepared;
    if (!preparedValues.has(prepared) || prepared.action !== body.action || prepared.intent !== canonicalStudioJson(body)) invalid();
    const allowExtended = canExtend();
    if (!allowExtended && presentationPackageRequiresV29(prepared.presentation)) refuse(PRESENTATION_RUNTIME_UPDATE_REQUIRED, 503);
    const {operatorId, roomId} = body;
    return repository.transaction(() => repository.withTransactionClient(async client => {
      if (!await storageReady(client)) refuse('studio_room_config_storage_missing', 503);
      // Samma ordning som övriga skrivare: scopelås (transaktionen), sedan bolagsraden.
      const locked = rowsOf(await client.query(`/* operator-store:lock-operator */ SELECT operator_id FROM croupier_studio.operators
        WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 FOR UPDATE`, [...params, operatorId]));
      if (locked.length !== 1) notFound();
      const operators = await createOperatorStore({sql:client, scope, now, transaction:work => repository.withTransactionClient(work)});
      const operator = await operators.getOperatorById(operatorId);
      if (!operator || operator.status !== 'active') notFound();
      const current = await operators.getCurrentPackage(operatorId);
      if (current?.revision !== prepared.expectedPackageRevision) conflict('package');
      let snapshot = await repository.readPresentationSnapshot();
      if (snapshot.projectDocument.revision !== prepared.projectRevision) conflict('project');
      if (snapshot.administrationDocument.revision !== prepared.administrationRevision) conflict('administration');
      // Med materialet: scenmallen skrivs först, med CAS på den förberedda revisionen, och
      // paketets presentation bär den nya projektrevisionen.
      let presentation = prepared.presentation, candidateBranding = prepared.candidateBranding, projectRevision = null;
      if (prepared.projectWrite) {
        let saved;
        try { saved = await repository.saveDocument('project', {value:structuredClone(prepared.projectWrite), expectedRevision:prepared.projectRevision, actor:context.actor.user}); }
        catch (error) { if (error?.code === 'studio_conflict') conflict('project'); throw error; }
        projectRevision = saved.revision;
        presentation = {...prepared.presentation, projectRevision:saved.revision};
        candidateBranding = withPackagePresentation(prepared.baseBranding, presentation, {allowExtended});
        snapshot = await repository.readPresentationSnapshot();
      }
      const administration = structuredClone(snapshot.administrationDocument.value), room = liveRoom(administration, current, operatorId, roomId);
      // Utkastet under låset ska vara exakt det förberedda (eller inget). Ett nytt eller ändrat
      // utkast är en konflikt; utan rätt att publicera utseende stoppar det som förut.
      const lockedDraft = await cleanBrandingDraft(await operators.getBrandingDraft(operatorId), current, operators);
      if ((lockedDraft?.revision ?? null) !== prepared.appearanceDraftRevision) {
        if (lockedDraft && !mayPublishAppearance(context.actor, operatorId)) refuse('studio_room_choices_draft_pending', 409);
        conflict('room_choices');
      }
      if (materials && operatorMaterialFingerprint(await materialRows(client, operatorId)) !== prepared.materialFingerprint) conflict('materials');
      const recheck = async preconditions => {
        try { await assertCapturedPresentationMedia(repository, preconditions); }
        catch (error) { if (error?.code === 'studio_conflict') conflict('media'); throw error; }
      };
      await recheck(prepared.mediaPreconditions);
      try { assertPublishedRoomBindings({administration, operatorId, currentPackage:current, presentation}); }
      catch (error) { if (error?.code === 'studio_conflict') invalid('studio_room_binding_incompatible'); throw error; }
      // Kandidatens branding är en ren funktion av paketets branding och den förberedda presentationen.
      if (sha256(current.branding) !== prepared.currentBrandingSha256) conflict('package');
      const branding = structuredClone(candidateBranding), gameConfig = prepared.gameConfig;
      const candidate = {operatorId, revision:current.revision + 1, lanes:[...current.lanes], games:[...current.games], tables:[...current.tables], branding};
      const {material, preconditions} = await roomMaterial({snapshot, candidate, presentation, room, gameConfig});
      await recheck(preconditions);
      // J08-skrivaren: rumslås i ordning, CAS på varje huvud, andra rums bindningar oförändrade.
      try {
        // Med utkastet: samma transaktion markerar det publicerat (operator-store.mjs, CAS på revisionen).
        await operators.publishRoomGameConfig({actor:context.actor.user, audit:operatorAuditContext(context.actor), operatorId,
          expectedRevision:current.revision, lanes:[...current.lanes], games:[...current.games], tables:[...current.tables], branding},
        {roomId, gameConfig:validateRoomGameConfig(gameConfig), material},
        prepared.appearanceDraftRevision === null ? null : {expectedDraftRevision:prepared.appearanceDraftRevision});
      } catch (error) {
        // Paketets revision är redan låst och kontrollerad: en konflikt här gäller spelbordens huvuden.
        // Butikens CAS på utkastet (operator-store.mjs) bär steget room_choices.
        if (error?.code === 'studio_conflict' && error.step === 'room_choices') conflict('room_choices');
        if (error?.code === 'studio_conflict' && !error.step) conflict('room_config_head');
        // J08 löser om grannrummens nativa material: skälet ur den fasta listan blir materialReason.
        if (error?.code === 'studio_room_game_material_unavailable' && error.statusCode === 422 && error.materialReason === undefined)
          refuse(error.code, 422, isRoomGameMaterialReason(error.reason) ? {materialReason:error.reason} : {});
        throw error;
      }
      // Rummets utkast för spelinställningar tas bort med CAS på administrationens revision.
      let administrationRevision = snapshot.administrationDocument.revision;
      const drafts = validateRoomGameDrafts(administration.roomGameConfigs ?? [], administration.rooms);
      if (drafts.some(row => row.roomId === roomId)) {
        try {
          administrationRevision = (await repository.saveDocument('administration', {value:{...administration, roomGameConfigs:drafts.filter(row => row.roomId !== roomId)},
            expectedRevision:administrationRevision, actor:context.actor.user})).revision;
        } catch (error) { if (error?.code === 'studio_conflict') conflict('administration'); throw error; }
      }
      // Kvittot läses ur de skrivna raderna (operator_packages och shared_table_configs).
      const stored = await operators.getCurrentPackage(operatorId);
      if (stored?.revision !== current.revision + 1) conflict('package');
      const config = await publishedConfig(client, stored, room);
      if (!config || config.packageRevision !== stored.revision || canonicalStudioJson(config.gameConfig) !== canonicalStudioJson(gameConfig))
        refuse('studio_corrupt_room_game_config', 503);
      return {ok:true, operatorId, roomId, previousPackageRevision:current.revision, packageRevision:stored.revision, package_revision:stored.revision,
        configVersion:config.configVersion, gameConfig:config.gameConfig, administrationRevision, appearanceDraftRevision:prepared.appearanceDraftRevision,
        publishedAt:new Date(stored.publishedAtMs).toISOString(), actor:context.actor.user, changes:structuredClone(prepared.changes),
        ...(projectRevision ? {projectRevision} : {}),
        ...(prepared.materialWarnings?.length ? {materialWarnings:structuredClone(prepared.materialWarnings)} : {})};
    }), {presentationMutation:[{kind:'presentation-package', value:prepared.presentation},
      {kind:'administration', value:prepared.administrationDescriptor}, NATIVE_FILMED_PLANNING_MUTATION,
      ...(prepared.projectWrite ? [{kind:'project', value:prepared.projectWrite}] : [])]});
  }

  return Object.freeze({read, prepare:context => context.body?.action === AI_ADOPT_ACTION ? prepareAdopt(context) : prepare(context), publish});
}
