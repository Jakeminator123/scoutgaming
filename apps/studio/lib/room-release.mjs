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
// Första versionen: ett opublicerat utseendeutkast för bolaget stoppar med 409
// studio_room_choices_draft_pending. Utkastet tas inte med i samma transaktion.
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
import {cleanBrandingDraft} from './partner-branding-api.mjs';
import {isRoomGameMaterialReason} from './room-game-config-api.mjs';
import {isRoomReleaseReadQuery} from './studio-admin-contract.mjs';
import {mergeOperatorMaterialsForPublication,operatorMaterialFingerprint,presentationFits,publicationRooms,readOperatorMaterialRows} from './operator-material-publication.mjs';

export const ROOM_RELEASE_ACTION = 'publish-room';
// Felkontraktet {error, code, step}: fasta koder och fasta steg, aldrig leverantörstext.
export const ROOM_RELEASE_CODES = Object.freeze(['studio_conflict','studio_release_preview_stale','studio_room_choices_draft_pending',
  'studio_room_game_material_unavailable','studio_release_invalid','studio_room_not_found','studio_presentation_runtime_update_required',
  'studio_room_config_storage_missing','studio_media_registry_unavailable']);
export const ROOM_RELEASE_STEPS = Object.freeze(['package','project','administration','room_config_head','media','materials']);
const BODY_KEYS = ['action','operatorId','roomId','gameConfig','expectedPackageRevision','expectedProjectRevision','expectedAdministrationRevision','previewToken'];

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
  // Annat i paketet (andra mallar, andra dealers) som inte syns i områdena ovan.
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
  async function readState(operatorId, roomId) {
    const operators = await store(), operator = await operators.getOperatorById(operatorId);
    if (!operator || operator.status !== 'active') notFound();
    const snapshot = await repository.readPresentationSnapshot(), current = await operators.getCurrentPackage(operatorId);
    if (canonicalStudioJson(validateStudioScope(snapshot?.scope)) !== scopeKey) refuse('studio_scope_mismatch', 409);
    const administration = snapshot.administrationDocument.value, room = liveRoom(administration, current, operatorId, roomId);
    const brandingDraft = await cleanBrandingDraft(await operators.getBrandingDraft(operatorId), current, operators);
    return {operators, snapshot, administration, current, room, brandingDraft};
  }
  // Samma infångning som "Publicera igen" (operator-package-api.mjs prepare) för paketets
  // alla mallar, med bolagets eget material. verify=false: ingen provider-I/O.
  async function buildCandidate({snapshot, current, administration, operatorId, rows}) {
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
        fits:presentationFits({branding:current.branding, base:presentation, allowExtended:canExtend()})});
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
      branding:withPackagePresentation(current.branding, presentation, {allowExtended:canExtend()})};
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
  function compare({state, live, gameConfig, built}) {
    const livePresentation = readPackagePresentation(state.current);
    const liveAreas = releaseAreas(state.current, livePresentation, state.room, live?.gameConfig ?? null);
    const nextAreas = built && gameConfig ? releaseAreas(built.candidate, built.presentation, state.room, gameConfig) : null;
    const presentationSha256 = {live:livePresentation ? sha256(livePresentation) : null, candidate:built ? sha256(built.presentation) : null};
    const changes = releaseChanges(liveAreas, nextAreas, presentationSha256.live !== presentationSha256.candidate);
    const revisions = {package:state.current.revision, project:state.snapshot.projectDocument.revision, administration:state.snapshot.administrationDocument.revision};
    const previewToken = sha256({contract:'room-release/1', scope, operatorId:state.room.operatorId, roomId:state.room.id, revisions,
      configVersion:live?.configVersion ?? null, presentationSha256, gameConfig:gameConfig ?? null, live:liveAreas, candidate:nextAreas,
      materialFingerprint:built?.materialFingerprint ?? null});
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
    const state = await readState(operatorId, roomId), blockers = [];
    const storage = await storageReady(pool);
    if (!storage) blockers.push({area:'settings', code:'studio_room_config_storage_missing'});
    if (state.brandingDraft) blockers.push({area:'roomChoices', code:'studio_room_choices_draft_pending', draftRevision:state.brandingDraft.revision});
    const live = storage ? await publishedConfig(pool, state.current, state.room) : null;
    const draft = validateRoomGameDrafts(state.administration.roomGameConfigs ?? [], state.administration.rooms).find(row => row.roomId === roomId) ?? null;
    const gameConfig = draft?.gameConfig ?? live?.gameConfig ?? null;
    if (!gameConfig) blockers.push({area:'settings', code:'studio_room_game_config_missing'});
    let built = null;
    try { built = await buildCandidate({...state, operatorId, rows:await materialRows(pool, operatorId)}); }
    catch (error) { blockers.push(blockerOf(error, 'package')); }
    const view = compare({state, live, gameConfig, built});
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
      if (!isNativeRoomMaterial(config?.material)) continue;
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
    ...(built?.materialWarnings?.length ? {materialWarnings:structuredClone(built.materialWarnings)} : {})};
  }

  // Steg 1: förbered utanför SQL-låset. Inaktuell förhandsvisning stoppas före provider-I/O.
  async function prepare(context) {
    trusted(context);
    const body = roomReleaseIntent(context.body);
    requireRuntime();
    const state = await readState(body.operatorId, body.roomId);
    if (state.current.revision !== body.expectedPackageRevision) conflict('package');
    if (state.snapshot.projectDocument.revision !== body.expectedProjectRevision) conflict('project');
    if (state.snapshot.administrationDocument.revision !== body.expectedAdministrationRevision) conflict('administration');
    if (!await storageReady(pool)) refuse('studio_room_config_storage_missing', 503);
    if (state.brandingDraft) refuse('studio_room_choices_draft_pending', 409);
    const live = await publishedConfig(pool, state.current, state.room);
    const built = await buildCandidate({...state, operatorId:body.operatorId, rows:await materialRows(pool, body.operatorId)});
    const view = compare({state, live, gameConfig:body.gameConfig, built});
    if (view.previewToken !== body.previewToken) refuse('studio_release_preview_stale', 409);
    if (!view.changed) invalid('studio_release_unchanged');
    await roomMaterial({snapshot:state.snapshot, candidate:built.candidate, presentation:built.presentation, room:state.room, gameConfig:body.gameConfig});
    if (built.mediaPreconditions.length) await videoRegistry.verifyCapturedMedia(built.mediaPreconditions);
    const administration = structuredClone(state.administration);
    // Djupfryst: en förberedelse kan inte ändras mellan förhandsvisning och lås.
    const value = freeze({action:ROOM_RELEASE_ACTION, intent:canonicalStudioJson(body), operatorId:body.operatorId, roomId:body.roomId,
      expectedPackageRevision:state.current.revision, projectRevision:state.snapshot.projectDocument.revision,
      administrationRevision:state.snapshot.administrationDocument.revision, presentation:built.presentation,
      currentBrandingSha256:sha256(state.current.branding), candidateBranding:structuredClone(built.candidate.branding), mediaPreconditions:built.mediaPreconditions, materialFingerprint:built.materialFingerprint,
      materialWarnings:structuredClone(built.materialWarnings), changes:structuredClone(view.changes),
      // Lagringsbeskrivningen för det administrationsdokument som skrivs utan rummets utkast.
      administrationDescriptor:{...administration, roomGameConfigs:administration.roomGameConfigs ?? []}});
    preparedValues.add(value);
    return value;
  }

  // Steg 2: en SQL-transaktion med bolagslås, N→N+1 och CAS på alla revisioner.
  async function publish(context) {
    trusted(context);
    const body = roomReleaseIntent(context.body), prepared = context.prepared === undefined ? await prepare(context) : context.prepared;
    if (!preparedValues.has(prepared) || prepared.intent !== canonicalStudioJson(body)) invalid();
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
      const snapshot = await repository.readPresentationSnapshot();
      if (snapshot.projectDocument.revision !== prepared.projectRevision) conflict('project');
      if (snapshot.administrationDocument.revision !== prepared.administrationRevision) conflict('administration');
      const administration = structuredClone(snapshot.administrationDocument.value), room = liveRoom(administration, current, operatorId, roomId);
      if (await cleanBrandingDraft(await operators.getBrandingDraft(operatorId), current, operators)) refuse('studio_room_choices_draft_pending', 409);
      if (materials && operatorMaterialFingerprint(await materialRows(client, operatorId)) !== prepared.materialFingerprint) conflict('materials');
      const recheck = async preconditions => {
        try { await assertCapturedPresentationMedia(repository, preconditions); }
        catch (error) { if (error?.code === 'studio_conflict') conflict('media'); throw error; }
      };
      await recheck(prepared.mediaPreconditions);
      try { assertPublishedRoomBindings({administration, operatorId, currentPackage:current, presentation:prepared.presentation}); }
      catch (error) { if (error?.code === 'studio_conflict') invalid('studio_room_binding_incompatible'); throw error; }
      // Kandidatens branding är en ren funktion av paketets branding och den förberedda presentationen.
      if (sha256(current.branding) !== prepared.currentBrandingSha256) conflict('package');
      const branding = structuredClone(prepared.candidateBranding);
      const candidate = {operatorId, revision:current.revision + 1, lanes:[...current.lanes], games:[...current.games], tables:[...current.tables], branding};
      const {material, preconditions} = await roomMaterial({snapshot, candidate, presentation:prepared.presentation, room, gameConfig:body.gameConfig});
      await recheck(preconditions);
      // J08-skrivaren: rumslås i ordning, CAS på varje huvud, andra rums bindningar oförändrade.
      try {
        await operators.publishRoomGameConfig({actor:context.actor.user, audit:operatorAuditContext(context.actor), operatorId,
          expectedRevision:current.revision, lanes:[...current.lanes], games:[...current.games], tables:[...current.tables], branding},
        {roomId, gameConfig:validateRoomGameConfig(body.gameConfig), material});
      } catch (error) {
        // Paketets revision är redan låst och kontrollerad: en konflikt här gäller spelbordens huvuden.
        if (error?.code === 'studio_conflict' && !error.step) conflict('room_config_head');
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
      if (!config || config.packageRevision !== stored.revision || canonicalStudioJson(config.gameConfig) !== canonicalStudioJson(body.gameConfig))
        refuse('studio_corrupt_room_game_config', 503);
      return {ok:true, operatorId, roomId, previousPackageRevision:current.revision, packageRevision:stored.revision, package_revision:stored.revision,
        configVersion:config.configVersion, gameConfig:config.gameConfig, administrationRevision,
        publishedAt:new Date(stored.publishedAtMs).toISOString(), actor:context.actor.user, changes:structuredClone(prepared.changes),
        ...(prepared.materialWarnings?.length ? {materialWarnings:structuredClone(prepared.materialWarnings)} : {})};
    }), {presentationMutation:[{kind:'presentation-package', value:prepared.presentation},
      {kind:'administration', value:prepared.administrationDescriptor}, NATIVE_FILMED_PLANNING_MUTATION]});
  }

  return Object.freeze({read, prepare, publish});
}
