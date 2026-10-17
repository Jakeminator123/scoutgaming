import { operatorAuditContext } from './operator-audit-context.mjs';
import { createHash } from 'node:crypto';
import { isPresentationRoomReadQuery } from './studio-admin-contract.mjs';
import { normalizeProject } from '../../packages/presentation/contracts/studio-model.mjs';
import { validatePresentationPackage } from '../../web/presentation-layers.mjs';
import { mergeFrozenDealerPlayback } from '../../web/frozen-dealer-playback.mjs';

import { gameLaneConfiguration, isGameLaneId } from '../../web/public/game-lanes.mjs';
import { createOperatorStore } from '../../web/storage/operator-store.mjs';
import { readPackagePresentation, withPackagePresentation } from '../../web/storage/presentation-package.mjs';
import { validateStudioGameAdministration } from '../../web/storage/studio-game-policy.mjs';
import { isPresentationRoom, resolvePackageRoom, roomGame, roomPlayPath } from '../../web/presentation-room-contract.mjs';
import { resolveFrozenDealerIdle } from '../../web/storage/frozen-dealer-idle.mjs';
import { captureFrozenPresentation, selectedRegisteredIdleDefaults, assertCapturedPresentationMedia,
  isPresentationRoomLaneCompatible, assertPublishedRoomBindings } from '../../web/storage/frozen-presentation-capture.mjs';
import { canonicalStudioJson, validateRevision, validateStudioScope, StudioStorageError } from '../../web/storage/studio-contract.mjs';
import { validatePresentationCapabilities } from '../../packages/presentation/capability-contract.mjs';
import { PRESENTATION_RUNTIME_UPDATE_REQUIRED } from './presentation-runtime-readiness.mjs';
import {assertPresentationRoomMaterials} from '../../web/presentation-material-game.mjs';

const operatorIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/;
const keyPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const fail = (status = 422, code = 'studio_presentation_room_rejected') => { throw new StudioStorageError(code, status); };
const conflictCodes = new Map(['presentation_shared_dealer_conflict', 'presentation_shared_layer_conflict',
  'presentation_room_binding_conflict', 'presentation_game_lane_conflict', 'presentation_legacy_package_conflict',
  'presentation_room_environment_conflict'].map(code => ['studio_' + code, code]));
export const PRESENTATION_ROOM_MUTATION = Object.freeze({ kind: 'administration', value: Object.freeze({
  rooms: Object.freeze([Object.freeze({ schemaVersion: 2 })]),
}) });

function intent(body) {
  const keys = ['operatorId', 'presentationLaneId', 'name', 'idempotencyKey', 'expectedProjectRevision', 'expectedAdministrationRevision', 'expectedPackageRevision', ...(Object.hasOwn(body ?? {},'game')?['game']:[])];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== keys.length || keys.some(key => !Object.hasOwn(body, key))) fail(400);
  if (!['blackjack','roulette'].includes(roomGame(body))) fail();
  if (typeof body.operatorId !== 'string' || !operatorIdPattern.test(body.operatorId) || !isGameLaneId(body.presentationLaneId)
    || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100 || body.name !== body.name.trim()
    || /[\u0000-\u001f\u007f-\u009f]/.test(body.name) || typeof body.idempotencyKey !== 'string' || !keyPattern.test(body.idempotencyKey)) fail();
  validateRevision(body.expectedProjectRevision); validateRevision(body.expectedAdministrationRevision);
  if (body.expectedPackageRevision !== null && (!Number.isSafeInteger(body.expectedPackageRevision) || body.expectedPackageRevision < 1)) fail();
  return structuredClone(body);
}
function roomIdentity(scope, body) {
  const hash = createHash('sha256').update(canonicalStudioJson([scope.environment, scope.workspaceId, body.operatorId, body.idempotencyKey.toLowerCase()])).digest('hex');
  return `room-${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}
function intentHash(value) {
  return createHash('sha256').update(canonicalStudioJson([value.operatorId, value.presentationLaneId, value.name, roomGame(value)])).digest('hex');
}
function sourceProject(project, id) {
  if (!project.lanes?.some(lane => lane.id === id)) fail(404, 'studio_presentation_required');
  return project;
}
// A room's identity must not depend on a player's background preference or
// another dealer's baked scene. This only constrains new room creation.
function roomEnvironment(project, id) {
  sourceProject(project, id);
  const lane = project.lanes.find(row => row.id === id), background = lane.layers.background;
  const dealers = new Set([...lane.dealers, ...lane.layers.dealer.allowed]);
  if (background.mode === 'baked' && !background.allowed.length && background.default === null) {
    return { kind: 'baked', fixed: dealers.size === 1,
      label: dealers.size === 1 ? 'Miljö i dealerfilmen' : 'Miljön följer vald dealer' };
  }
  const asset = project.layerAssets?.find(row => row.id === background.default && row.role === 'background');
  const fixed = background.enabled && ['image', 'video'].includes(background.mode)
    && background.allowed.length === 1 && background.allowed[0] === background.default && Boolean(asset)
    && (lane.backgroundPlayback?.rules ?? []).every(rule => rule.assetId === background.default);
  return fixed ? { kind: background.mode, fixed: true, label: asset.label }
    : { kind: 'variable', fixed: false, label: 'Välj en fast bakgrund för rummet' };
}
function requireRoomEnvironment(project, id) {
  if (!roomEnvironment(project, id).fixed) fail(422, 'studio_presentation_room_environment_required');
}
function preservePublishedRoomEnvironment(saved, id, captured) {
  if (!saved.administration.rooms.some(room => isPresentationRoom(room) && room.operatorId === saved.operator.id
    && room.presentationLaneId === id && saved.pack?.tables.includes(room.id))) return;
  const frozen = readPackagePresentation(saved.pack);
  const previous = frozen?.lanes.find(lane => lane.id === id);
  const next = captured?.lanes.find(lane => lane.id === id);
  const environment = lane => ({ background: lane.layers.background, playback: lane.backgroundPlayback ?? { schemaVersion: 1, rules: [] },
    ...(lane.layers.background.mode === 'baked' && !lane.layers.background.allowed.length
      ? { dealers: [...new Set([...lane.dealers, ...lane.layers.dealer.allowed])].sort() } : {}) });
  if (!previous || !next || canonicalStudioJson(environment(previous)) !== canonicalStudioJson(environment(next)))
    fail(409, 'studio_presentation_room_environment_conflict');
  if (previous.layers.background.mode === 'baked' && !previous.layers.background.allowed.length) {
    // The dealer ID is not the environment: the entire captured idle record
    // includes the film identity, hash, path, MIME, size and compositing.
    // Compare immutable captures rather than rereading provider state here.
    for (const dealerId of previous.layers.dealer.allowed) {
      const before = frozen.registeredDealers?.find(row => row.id === dealerId)?.idle;
      const after = captured.registeredDealers?.find(row => row.id === dealerId)?.idle;
      if (!before || !after || canonicalStudioJson(before) !== canonicalStudioJson(after))
        fail(409, 'studio_presentation_room_environment_conflict');
    }
  }
}
function lanePlan(presentation, administration, frozen, game='blackjack') {
  const config = gameLaneConfiguration(administration), candidates = config.gameLanes.filter(lane => lane.dealer === presentation.layers.dealer.default && isPresentationRoomLaneCompatible(lane, presentation, frozen,game));
  if (candidates.length === 1) return { lane: candidates[0], administration };
  const dealer = presentation.layers.dealer.default;
  const hash = createHash('sha256').update(canonicalStudioJson([presentation.id, dealer])).digest('hex').slice(0, 24);
  const lane = { schemaVersion: 1, id: `room-lane-${hash}`, label: presentation.label,
    renderer: 'portrait-video', dealer, mediaCollection: `${dealer}-presentation` };
  const existing = config.gameLanes.find(row => row.id === lane.id);
  if (existing) {
    if (canonicalStudioJson({ ...existing, label: lane.label }) !== canonicalStudioJson(lane)) fail(409, 'studio_presentation_game_lane_conflict');
    return { lane: existing, administration };
  }
  if (config.gameLanes.length >= 32) fail();
  return { lane, administration: validateStudioGameAdministration({ ...administration,
    gameLanes: [...config.gameLanes, lane], gameLane: config.gameLane ?? lane.id }) };
}
function selectedDealerIds(lanes) {
  return new Set(lanes.flatMap(lane => [...(lane.dealers ?? []), ...lane.layers.dealer.allowed]));
}
// Only this selected saved definition changes. Other frozen lanes, assets and
// dealer idle records cannot acquire unpublished edits as a side effect.
function mergePresentation(current, selected) {
  const old = current ? readPackagePresentation(current) : null;
  if (current && !old) fail(409, 'studio_presentation_legacy_package_conflict');
  if (!old) return selected;
  const id = selected.lanes[0].id;
  const lanes = old.lanes.some(lane => lane.id === id) ? old.lanes.map(lane => lane.id === id ? selected.lanes[0] : lane) : [...old.lanes, selected.lanes[0]];
  const assets = new Map(old.assets.map(asset => [asset.id, asset]));
  for (const asset of selected.assets) {
    if (assets.has(asset.id) && canonicalStudioJson(assets.get(asset.id)) !== canonicalStudioJson(asset)) fail(409, 'studio_presentation_shared_layer_conflict');
    assets.set(asset.id, asset);
  }
  const used = new Set(lanes.flatMap(lane => ['background', 'table'].flatMap(role => lane.layers[role].allowed)));
  const base = { projectRevision: selected.projectRevision, lanes, assets: [...assets.values()].filter(asset => used.has(asset.id)) };
  if (old.schemaVersion === 1 && selected.schemaVersion === 1) return validatePresentationPackage({ schemaVersion: 1, ...base });
  const registry = new Map((old.registeredDealers ?? []).map(entry => [entry.id, entry]));
  const preservedIds = selectedDealerIds(old.lanes.filter(lane => lane.id !== id));
  if (old.schemaVersion === 1 && preservedIds.size) fail(409, 'studio_presentation_legacy_package_conflict');
  for (const entry of selected.registeredDealers ?? []) {
    const previous=registry.get(entry.id);
    // Adding the first explicit roulette binding cannot alter an existing
    // blackjack capture. Replacing shared published data still needs full review.
    const compared=previous&&!previous.rouletteIdle&&entry.rouletteIdle?{...entry}:entry;
    if(compared!==entry)delete compared.rouletteIdle;
    if (preservedIds.has(entry.id) && previous
      && canonicalStudioJson(previous) !== canonicalStudioJson(compared)) fail(409, 'studio_presentation_shared_dealer_conflict');
    registry.set(entry.id, entry);
  }
  const ids = selectedDealerIds(lanes);
  if ([...ids].some(id => !registry.has(id))) fail(409, 'studio_presentation_legacy_package_conflict');
  const registeredDealers = [...registry.values()].filter(entry => ids.has(entry.id));
  let playback;
  try { playback = mergeFrozenDealerPlayback(old, selected, { registeredDealers, preservedDealerIds:[...preservedIds] }); }
  catch (error) { fail(409, error?.code === 'studio_shared_dealer_playback_conflict' ? 'studio_presentation_shared_dealer_conflict' : 'studio_presentation_room_rejected'); }
  return validatePresentationPackage({ schemaVersion: playback ? 3 : 2, ...base, registeredDealers, ...(playback ? {playback} : {}) });
}
function assertReplayBinding(saved, room) {
  const frozen = readPackagePresentation(saved.pack), presentation = frozen?.lanes.find(lane => lane.id === room.presentationLaneId);
  const gameLane = gameLaneConfiguration(saved.administration).gameLanes.find(lane => lane.id === room.gameLaneId);
  if (!isPresentationRoomLaneCompatible(gameLane, presentation, frozen,roomGame(room))) fail(409);
  const dealer = presentation.layers.dealer.default;
  if ([2,3].includes(frozen.schemaVersion)&&roomGame(room)!=='roulette'
    && !resolveFrozenDealerIdle(frozen.registeredDealers, { dealerId: dealer, allowedDealerIds: presentation.layers.dealer.allowed,game:roomGame(room) })) fail(409);
  return frozen;
}
function runtimeAccepts(capabilities, presentation, game = 'blackjack') {
  if (!capabilities || ![2, 3, 4, 9, 14, 15].includes(capabilities.schemaVersion) || game === 'roulette' && capabilities.schemaVersion < 9
    ||presentation?.registeredDealers?.some(row=>row.rouletteIdle)&&capabilities.rouletteIdle!=='explicit-game-idle-v1'
    ||presentation?.registeredDealers?.some(row=>row.rouletteStart)&&capabilities.rouletteStart!=='explicit-game-start-v1') return false;
  return capabilities.schemaVersion >= (presentation?.schemaVersion === 3 ? 4 : presentation?.schemaVersion === 2 ? 3 : 2);
}
export function createPresentationRoomApi({ repository, scope, runtimeCapabilities, videoRegistry, now = Date.now } = {}) {
  scope = validateStudioScope(scope);
  if (!repository?.transaction || !repository?.withTransactionClient || !repository?.saveDocument || !repository?.readPresentationSnapshot
    || canonicalStudioJson(scope) !== canonicalStudioJson(repository.scope) || typeof runtimeCapabilities !== 'function') fail(503);
  const parameters = [scope.environment, scope.workspaceId], handlers = new Map(), preparations = new Map(), preparedValues = new WeakSet();
  const assertScope = context => { if (canonicalStudioJson(validateStudioScope(context.scope)) !== canonicalStudioJson(scope)) fail(403); };
  async function snapshot(client, operatorId, captured) {
    const operators = await createOperatorStore({ sql: client, scope, now, transaction: work => repository.withTransactionClient(work) });
    const operator = await operators.getOperatorById(operatorId);
    if (!operator || operator.status !== 'active') fail(404);
    const projectDocument = captured?.projectDocument ?? await repository.readDocument('project');
    const administrationDocument = captured?.administrationDocument ?? await repository.readDocument('administration');
    if (!projectDocument || !administrationDocument) fail(503);
    const project = normalizeProject(projectDocument.value), administration = validateStudioGameAdministration(administrationDocument.value);
    const pack = await operators.getCurrentPackage(operatorId);
    return { operators, operator, project, administration, pack, projectRevision: projectDocument.revision, administrationRevision: administrationDocument.revision };
  }
  function receipt(saved, room, duplicate) {
    return { ok: true, duplicate, room: structuredClone(room), administrationRevision: saved.administrationRevision,
      packageRevision: saved.pack.revision, playUrl: roomPlayPath(room,saved.operator.slug) };
  }
  async function capture(snapshotValue, id, game='blackjack') {
    const project = normalizeProject(snapshotValue.projectDocument.value), source = sourceProject(project, id);
    const hasDealers = selectedDealerIds(source.lanes.filter(lane => lane.id === id)).size > 0;
    if (hasDealers && (!videoRegistry?.loadCaptured || !videoRegistry?.verifyCapturedMedia)) fail(503, 'studio_media_registry_unavailable');
    const inventory = hasDealers ? await videoRegistry.loadCaptured(snapshotValue) : null;
    const captured = captureFrozenPresentation({ snapshot: snapshotValue, selectedLaneIds: [id], inventory,
      ...(game==='roulette'?{requiredRouletteIdleDealerIds:selectedRegisteredIdleDefaults(source,[id])}
        :{requiredIdleDealerIds: selectedRegisteredIdleDefaults(source, [id])}) });
    if (captured.mediaPreconditions.length) await videoRegistry.verifyCapturedMedia(captured.mediaPreconditions);
    return captured;
  }
  async function capabilities(presentation, game = 'blackjack') {
    return validatePresentationCapabilities(await runtimeCapabilities(presentation,game));
  }
  async function prepare(context) {
    const body = intent(context.body); assertScope(context);
    const snapshotValue = await repository.readPresentationSnapshot();
    const existing = snapshotValue.administrationDocument.value.rooms?.find(room => room.id === roomIdentity(scope, body));
    let captured = null, publicationPresentation = null;
    if (!existing) {
      if (snapshotValue.projectDocument.revision !== body.expectedProjectRevision || snapshotValue.administrationDocument.revision !== body.expectedAdministrationRevision) fail(409);
      const saved = await repository.transaction(() => repository.withTransactionClient(async client => {
        const saved = await snapshot(client, body.operatorId, snapshotValue);
        const used = await client.query(`/* presentation-room:used-key */ SELECT package_revision FROM croupier_studio.operator_packages
          WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 AND tables::jsonb ? $4 LIMIT 1`, [...parameters, body.operatorId, roomIdentity(scope, body)]);
        if (used.rows.length) fail(409);
        return saved;
      }));
      if ((saved.pack?.revision ?? null) !== body.expectedPackageRevision) fail(409);
      requireRoomEnvironment(saved.project, body.presentationLaneId);
      captured = await capture(snapshotValue, body.presentationLaneId,roomGame(body));
      preservePublishedRoomEnvironment(saved, body.presentationLaneId, captured.presentation);
      publicationPresentation = mergePresentation(saved.pack, captured.presentation);
    } else {
      if (!isPresentationRoom(existing) || intentHash(existing) !== intentHash(body) || existing.state !== 'live') fail(409);
      const saved = await repository.transaction(() => repository.withTransactionClient(client => snapshot(client, body.operatorId, snapshotValue)));
      const room = resolvePackageRoom({ administration: saved.administration, package: saved.pack, operatorId: body.operatorId, roomId: existing.id });
      if (!room) fail(409);
      publicationPresentation = assertReplayBinding(saved, room);
    }
    assertPresentationRoomMaterials(publicationPresentation,{presentationLaneId:body.presentationLaneId,game:roomGame(body)});
    if (!runtimeAccepts(await capabilities(publicationPresentation,roomGame(body)), publicationPresentation,roomGame(body))) fail(503, PRESENTATION_RUNTIME_UPDATE_REQUIRED);
    const freeze = value => { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; };
    const value = freeze({ body: canonicalStudioJson(body), game: roomGame(body), publicationPresentation, ...captured });
    preparedValues.add(value); return value;
  }
  preparations.set('POST /studio/api/admin/presentation-room', prepare);
  handlers.set('GET /studio/api/admin/presentation-room', async context => {
    assertScope(context);
    const url = new URL(context.request.url);
    if (!isPresentationRoomReadQuery(context.request.method, url)) fail(400);
    const snapshotValue = await repository.readPresentationSnapshot();
    const saved = await repository.transaction(() => repository.withTransactionClient(client => snapshot(client, url.searchParams.get('operatorId'), snapshotValue)));
    const id = url.searchParams.get('presentationLaneId'), game=url.searchParams.get('game')??'blackjack';
    sourceProject(saved.project, id);
    const environment = roomEnvironment(saved.project, id);
    let selected = null, merged = null, packageReason = null, conflictCode = null, runtime = null;
    try {
      selected = await capture(snapshotValue, id,game);
      merged = mergePresentation(saved.pack, selected.presentation);
      const plan = lanePlan(merged.lanes.find(lane => lane.id === id), saved.administration, merged,game);
      try { assertPublishedRoomBindings({ administration: plan.administration, operatorId: saved.operator.id, currentPackage: saved.pack, presentation: merged }); }
      catch (error) { if (error?.statusCode === 409) fail(409, 'studio_presentation_room_binding_conflict'); throw error; }
      preservePublishedRoomEnvironment(saved, id, selected.presentation);
    } catch (error) {
      if (error?.statusCode === 409) {
        packageReason = 'presentation_package_conflict';
        // Expose fixed diagnostic categories only, never raw errors or snapshot data.
        if (conflictCodes.has(error.code)) conflictCode = conflictCodes.get(error.code);
      }
      else if (error?.statusCode === 413) packageReason = 'presentation_package_too_large';
      else if (error?.statusCode === 422) packageReason = 'presentation_lane_incompatible';
      else throw error;
    }
    try { runtime = await capabilities(merged ?? selected?.presentation,game); }
    catch (error) {
      // Runtime negotiation encodes the candidate too. An oversized draft must
      // block publication without hiding the existing frozen room on this read.
      if (error?.statusCode === 413) packageReason ??= 'presentation_package_too_large';
      else if (error?.code !== PRESENTATION_RUNTIME_UPDATE_REQUIRED) throw error;
    }
    const runtimeReady = runtimeAccepts(runtime, merged ?? selected?.presentation,game);
    const reason = !environment.fixed ? 'presentation_room_environment_required'
      : packageReason ?? (!runtimeReady ? PRESENTATION_RUNTIME_UPDATE_REQUIRED : null);
    return { ok: true, operator: { id: saved.operator.id, slug: saved.operator.slug, name: saved.operator.name }, presentationLaneId: id,
      projectRevision: saved.projectRevision, administrationRevision: saved.administrationRevision, packageRevision: saved.pack?.revision ?? null,
      ready: reason === null, reason, conflictCode: reason === 'presentation_package_conflict' ? conflictCode : null, capabilities: runtime,
      environment: conflictCode === 'presentation_shared_layer_conflict' ? null : environment,
      rooms: saved.administration.rooms.filter(room => room.state === 'live' && room.presentationLaneId === id
        && resolvePackageRoom({ administration:saved.administration, package:saved.pack, operatorId:saved.operator.id, roomId:room.id }))
        .map(room => ({ id:room.id, name:room.name, playUrl:roomPlayPath(room,saved.operator.slug) })) };
  });
  handlers.set('POST /studio/api/admin/presentation-room', async context => {
    const body = intent(context.body), roomId = roomIdentity(scope, body); assertScope(context);
    const prepared = context.prepared === undefined ? await prepare(context) : context.prepared;
    if (!preparedValues.has(prepared) || prepared.body !== canonicalStudioJson(body)) fail(422);
    return repository.transaction(() => repository.withTransactionClient(async client => {
      const locked = await client.query(`/* operator-store:lock-operator */ SELECT operator_id FROM croupier_studio.operators
        WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 FOR UPDATE`, [...parameters, body.operatorId]);
      if (!locked.rows.length) fail(404);
      const saved = await snapshot(client, body.operatorId);
      const existing = saved.administration.rooms.find(room => room.id === roomId);
      if (existing) {
        if (!isPresentationRoom(existing) || intentHash(existing) !== intentHash(body) || existing.state !== 'live') fail(409);
        const room = resolvePackageRoom({ administration: saved.administration, package: saved.pack, operatorId: body.operatorId, roomId });
        if (!room) fail(409);
        assertReplayBinding(saved, room);
        return receipt(saved, room, true);
      }
      const used = await client.query(`/* presentation-room:used-key */ SELECT package_revision FROM croupier_studio.operator_packages
        WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 AND tables::jsonb ? $4 LIMIT 1`, [...parameters, body.operatorId, roomId]);
      if (used.rows.length) fail(409);
      if (saved.projectRevision !== body.expectedProjectRevision || saved.administrationRevision !== body.expectedAdministrationRevision
        || (saved.pack?.revision ?? null) !== body.expectedPackageRevision
        || saved.projectRevision !== prepared.projectRevision || saved.administrationRevision !== prepared.administrationRevision) fail(409);
      requireRoomEnvironment(saved.project, body.presentationLaneId);
      preservePublishedRoomEnvironment(saved, body.presentationLaneId, prepared.presentation);
      await assertCapturedPresentationMedia(repository, prepared.mediaPreconditions);
      const presentation = mergePresentation(saved.pack, prepared.presentation), plan = lanePlan(prepared.presentation.lanes[0], saved.administration, presentation,roomGame(body));
      assertPublishedRoomBindings({ administration: plan.administration, operatorId: saved.operator.id, currentPackage: saved.pack, presentation });
      const room = { schemaVersion: 2, id: roomId, name: body.name, operatorId: body.operatorId,
        presentationLaneId: body.presentationLaneId, gameLaneId: plan.lane.id, state: 'live', ...(roomGame(body)==='roulette'?{game:'roulette'}:{}) };
      const administration = validateStudioGameAdministration({ ...plan.administration, rooms: [...saved.administration.rooms, room] });
      const changed = await repository.saveDocument('administration', { value: administration, expectedRevision: body.expectedAdministrationRevision, actor: context.actor.user });
      const pack = await saved.operators.publishPackage({ actor: context.actor.user, audit: operatorAuditContext(context.actor), operatorId: body.operatorId, expectedRevision: body.expectedPackageRevision,
        lanes: presentation.lanes.map(lane => lane.id), games: [...new Set([...(saved.pack?.games ?? []),roomGame(body)])],
        tables: [...(saved.pack?.tables ?? []), room.id], branding: withPackagePresentation(saved.pack?.branding ?? {}, presentation) });
      return receipt({ ...saved, administrationRevision: changed.revision, pack }, room, false);
    }), { presentationMutation: [roomGame(body)==='roulette'?{kind:'administration',value:{rooms:[{schemaVersion:2,game:'roulette'}]}}:PRESENTATION_ROOM_MUTATION, ...(prepared.publicationPresentation ? [{ kind: 'presentation-package', value: prepared.publicationPresentation }] : [])] });
  });
  return Object.freeze({ handlers, preparations });
}
