import { operatorAuditContext } from './operator-audit-context.mjs';
import { PARTNER_PREVIEW_OPERATORS } from './partner-preview-policy.mjs';
import { normalizeProject, LANE_ID, RESERVED_LANE_IDS } from '../../../packages/presentation/contracts/studio-model.mjs';
import { buildPresentationPackage, validatePresentationPackage } from '../../../packages/presentation/contracts/presentation-layers.mjs';
import { BASE_DEALER_IDS } from '../../../packages/presentation/contracts/dealer-identity.mjs';
import { createOperatorStore } from '../../../packages/operators/server/operator-store.mjs';
import { canonicalStudioJson, validateStudioScope, validateRevision, StudioStorageError } from '../../../packages/studio-registry/server/document-contract.mjs';
import {captureFrozenPresentation, selectedRegisteredIdleDefaults, assertCapturedPresentationMedia, assertPublishedRoomBindings} from '../../../packages/presentation/server/frozen-presentation-capture.mjs';
import {presentationPackageRequiresV29,PRESENTATION_RUNTIME_UPDATE_REQUIRED} from './presentation-runtime-readiness.mjs';
import { withPackagePresentation, readPackagePresentation, publicPackageBranding, encodePresentationPackage, PRESENTATION_PACKAGE_KEY } from '../../../packages/presentation/server/presentation-package.mjs';
import {resolvePackageRoom,listPackageRooms} from '../../../packages/presentation/server/package-rooms.mjs';
import {roomGame,isRoomOperatorId} from '../../../packages/presentation/contracts/presentation-room.mjs';
import {isGameLaneId} from '../../../packages/presentation/contracts/game-lane-id.mjs';
import {resolveRoomBranding} from '../../../packages/operators/contracts/branding.mjs';
import {sceneLayoutPublication} from '../../../packages/presentation/contracts/scene-layout-publication.mjs';
import {refreshFrozenDealerIdle} from '../../../packages/presentation/server/refresh-frozen-dealer-idle.mjs';
import {assertAiTablesFit} from './ai-table-publication-guard.mjs';
import {isActiveDealerId} from '../../../packages/presentation/contracts/dealer-identity.mjs';
import {withoutOperatorMaterials} from '../../../packages/presentation/server/operator-material-merge.mjs';
import {mergeOperatorMaterialsForPublication,operatorMaterialFingerprint,presentationFits,publicationRooms,readOperatorMaterialRows} from './operator-material-publication.mjs';

export const SG_TEST_OPERATOR = Object.freeze({
  id: 'sg-test',
  slug: 'sg-test',
  name: 'SG test game provider',
});

const fail = statusCode => { throw Object.assign(new Error('operator_package_rejected'), { statusCode }); };

export function fixtureLaneOperators() {
  return PARTNER_PREVIEW_OPERATORS.map(operator => ({ id: operator.id, slug: operator.slug, name: operator.name }));
}

// Writes need the pool itself. `{ query }` cannot BEGIN/lock (L24) and is refused
// before createOperatorStore, including for the read used by this page.
export async function openWritableOperatorStore({ pool, scope, now, storeFactory } = {}) {
  if (typeof pool?.connect !== 'function' || typeof pool?.query !== 'function') fail(503);
  const create = storeFactory ?? (await import('../../../packages/operators/server/operator-store.mjs')).createOperatorStore;
  if (typeof create !== 'function') fail(503);
  return create({ sql: pool, scope, now });
}

export function presentationLaneIds(project) {
  let normalized;
  try { normalized = normalizeProject(project); }
  catch (error) {
    if (error?.statusCode === 400) fail(422);
    throw error;
  }
  const ids = Array.isArray(normalized?.lanes) ? normalized.lanes.map(lane => lane.id).filter(id => typeof id === 'string') : [];
  return ids;
}

function exactKeys(body, keys) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400);
  const present = Object.keys(body);
  if (present.length !== keys.length || keys.some(key => !Object.hasOwn(body, key))) fail(400);
}

// Older callers may omit the revision; current editors send the revision they
// actually displayed so a stale tab cannot replace a newer package selection.
function requestedPackageRevision(body) {
  const specified = Object.hasOwn(body ?? {}, 'expectedPackageRevision');
  exactKeys(body, ['operatorId', 'lanes', ...(specified ? ['expectedPackageRevision'] : [])]);
  const revision = body.expectedPackageRevision;
  if (specified && revision !== null && (!Number.isSafeInteger(revision) || revision < 1)) fail(422);
  return specified ? revision : undefined;
}
function selectedLanes(value, allowed) {
  if (!allowed.length) throw new StudioStorageError('studio_presentation_required', 422);
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length < 1 || value.length > 32) fail(422);
  if (new Set(value).size !== value.length || value.some(item => typeof item !== 'string' || !allowed.includes(item))) fail(422);
  return value;
}

function publicOperator(operator) {
  return { id: operator.id, slug: operator.slug, name: operator.name, status: operator.status };
}

function sceneLayoutIntent(body){
  exactKeys(body,['action','operatorId','compositionId','expectedPackageRevision','expectedProjectRevision']);
  if(body.action!=='publish-scene-layout'||!isRoomOperatorId(body.operatorId)
    ||typeof body.compositionId!=='string'||!LANE_ID.test(body.compositionId)||RESERVED_LANE_IDS.has(body.compositionId)
    ||!Number.isSafeInteger(body.expectedPackageRevision)||body.expectedPackageRevision<1)fail(422);
  validateRevision(body.expectedProjectRevision);
  return structuredClone(body);
}
const sceneConflict=()=>{throw new StudioStorageError('studio_conflict',409);};
function idleRefreshIntent(body){
  exactKeys(body,['action','operatorId','roomId','dealerId','expectedPackageRevision']);
  if(body.action!=='refresh-dealer-idle'||!isRoomOperatorId(body.operatorId)||!isGameLaneId(body.roomId)
    ||!isActiveDealerId(body.dealerId)||!Number.isSafeInteger(body.expectedPackageRevision)||body.expectedPackageRevision<1)fail(422);
  return structuredClone(body);
}
function idleRefreshPresentation(current,administration,body){
  if(!current||current.operatorId!==body.operatorId||current.revision!==body.expectedPackageRevision)sceneConflict();
  const presentation=readPackagePresentation(current),room=resolvePackageRoom({administration,package:current,operatorId:body.operatorId,roomId:body.roomId});
  if(!presentation||!room||room.state!=='live'||roomGame(room)!=='blackjack')sceneConflict();
  const lane=presentation.lanes.find(row=>row.id===room.presentationLaneId);
  const branding=resolveRoomBranding({lane:presentation.lanes[0].id,...publicPackageBranding(current.branding)},room.id,lane.id);
  if((branding.dealer??lane.layers.dealer.default)!==body.dealerId)sceneConflict();
  return presentation;
}
// Company material is stripped first and merged again by the caller, so the
// AI table guard and the geometry rules see only Admin's own frozen material.
function publishedScenePresentation(current,administration,projectDocument,body,materialRows=[]){
  if(!current||current.operatorId!==body.operatorId||current.revision!==body.expectedPackageRevision)sceneConflict();
  if(projectDocument?.revision!==body.expectedProjectRevision||projectDocument.value?.revision!==body.expectedProjectRevision)sceneConflict();
  const frozen=readPackagePresentation(current),presentation=frozen&&materialRows.length?withoutOperatorMaterials(frozen,materialRows):frozen;
  const lane=presentation?.lanes.find(row=>row.id===body.compositionId);
  if(!lane||!current.lanes.includes(body.compositionId))sceneConflict();
  const saved=normalizeProject(projectDocument.value).lanes?.find(row=>row.id===body.compositionId);
  if(!saved?.composition)fail(422);
  const candidate=sceneLayoutPublication(lane,saved);
  if(!candidate.changed)fail(422);
  lane.composition=candidate.composition;
  const checked=validatePresentationPackage(presentation);
  // A new placement must still fit the AI table graphics this template shows.
  assertAiTablesFit(checked.lanes.filter(row=>row.id===body.compositionId),checked.assets);
  assertPublishedRoomBindings({administration,operatorId:body.operatorId,currentPackage:current,presentation:checked});
  const affectedRooms=listPackageRooms({administration,package:current,operatorId:body.operatorId})
    .filter(room=>room.presentationLaneId===body.compositionId).map(({id,name,state})=>({id,name,state}));
  return {presentation:checked,affectedRooms};
}
function freeze(value){
  if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}
  return value;
}

// materials: optional sql => operator material store (Bolagets eget material).
// Without it, or without migration 021, every publication is unchanged.
export function createOperatorPackageApi({ pool, scope, project, gameLanes, repository, videoRegistry, now = () => Date.now(), storeFactory, materials = null } = {}) {
  const handlers = new Map();
  async function store() {
    return openWritableOperatorStore({ pool, scope, now, storeFactory });
  }
  const materialRows = async (sql, operatorId) => materials ? readOperatorMaterialRows(materials(sql), operatorId) : [];
  // The merge is negotiated before SQL; the transaction proves the same rows.
  function mergedMaterials(presentation, rows, {administration, pack, branding, allowExtended}) {
    if (!materials) return {presentation};
    const merged = mergeOperatorMaterialsForPublication({presentation, rows, rooms:publicationRooms(administration, pack?.operatorId, pack),
      fits:presentationFits({branding, base:presentation, allowExtended})});
    return {presentation:merged.presentation, materialWarnings:merged.warnings, materialFingerprint:operatorMaterialFingerprint(rows)};
  }
  async function assertSameMaterials(client, operatorId, fingerprint) {
    if (materials && operatorMaterialFingerprint(await materialRows(client, operatorId)) !== fingerprint) sceneConflict();
  }
  const warningsOf = prepared => prepared.materialWarnings?.length ? {materialWarnings:structuredClone(prepared.materialWarnings)} : {};
  const canExtend = () => typeof repository?.withMutationContext === 'function';
  const preparedValues = new WeakSet();
  const preparations = new Map();
  async function prepareIdleRefresh(context){
    const body=idleRefreshIntent(context.body);
    if(!repository?.readPresentationSnapshot||!repository.transaction||!repository.withTransactionClient
      ||canonicalStudioJson(validateStudioScope(repository.scope))!==canonicalStudioJson(validateStudioScope(scope))
      ||!videoRegistry?.loadCaptured||!videoRegistry.verifyCapturedMedia)fail(503);
    if(canonicalStudioJson(validateStudioScope(context.scope))!==canonicalStudioJson(validateStudioScope(scope)))fail(403);
    const operators=await store(),operator=await operators.getOperatorById(body.operatorId);
    if(!operator||operator.status!=='active')sceneConflict();
    const current=await operators.getCurrentPackage(body.operatorId),snapshot=await repository.readPresentationSnapshot();
    const previous=idleRefreshPresentation(current,snapshot.administrationDocument.value,body);
    const captured=refreshFrozenDealerIdle({presentation:previous,snapshot,inventory:await videoRegistry.loadCaptured(snapshot),dealerId:body.dealerId});
    await videoRegistry.verifyCapturedMedia(captured.mediaPreconditions);
    const merged=mergedMaterials(captured.presentation,await materialRows(pool,body.operatorId),
      {administration:snapshot.administrationDocument.value,pack:current,branding:current.branding,allowExtended:canExtend()});
    const value=freeze({action:body.action,intent:canonicalStudioJson(body),operatorId:body.operatorId,expectedPackageRevision:body.expectedPackageRevision,
      projectRevision:snapshot.projectDocument.revision,administrationRevision:snapshot.administrationDocument.revision,...captured,...merged});
    preparedValues.add(value);return value;
  }
  async function prepareSceneLayout(context){
    const body=sceneLayoutIntent(context.body);
    if(!repository?.readDocument||!repository.transaction||!repository.withTransactionClient
      ||canonicalStudioJson(validateStudioScope(repository.scope))!==canonicalStudioJson(validateStudioScope(scope)))fail(503);
    if(canonicalStudioJson(validateStudioScope(context.scope))!==canonicalStudioJson(validateStudioScope(scope)))fail(403);
    const operators=await store(),operator=await operators.getOperatorById(body.operatorId);
    if(!operator||operator.status!=='active')sceneConflict();
    const current=await operators.getCurrentPackage(body.operatorId),administration=await repository.readDocument('administration'),projectDocument=await repository.readDocument('project');
    if(!administration)sceneConflict();
    const rows=await materialRows(pool,body.operatorId);
    const candidate=publishedScenePresentation(current,administration.value,projectDocument,body,rows);
    const merged=mergedMaterials(candidate.presentation,rows,{administration:administration.value,pack:current,branding:current.branding,allowExtended:canExtend()});
    assertPublishedRoomBindings({administration:administration.value,operatorId:body.operatorId,currentPackage:current,presentation:merged.presentation});
    const value=freeze({action:body.action,intent:canonicalStudioJson(body),operatorId:body.operatorId,
      expectedPackageRevision:body.expectedPackageRevision,projectRevision:body.expectedProjectRevision,
      administrationRevision:administration.revision,...candidate,...merged});
    preparedValues.add(value);return value;
  }
  async function prepare(context) {
    if(context.body?.action==='refresh-dealer-idle')return prepareIdleRefresh(context);
    if(context.body?.action==='publish-scene-layout')return prepareSceneLayout(context);
    const expectedPackageRevision = requestedPackageRevision(context.body);
    const operatorId = context.body.operatorId;
    if (typeof operatorId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(operatorId)) fail(422);
    // Clone the intent before any asynchronous read/provider verification.
    const wanted = structuredClone(context.body.lanes);
    if (!repository) return null;
    if (!repository.readPresentationSnapshot || !repository.transaction || !repository.withTransactionClient
      || canonicalStudioJson(validateStudioScope(repository.scope)) !== canonicalStudioJson(validateStudioScope(scope))) fail(503);
    const snapshot = await repository.readPresentationSnapshot();
    const saved = normalizeProject(snapshot.projectDocument.value);
    const lanes = selectedLanes(wanted, presentationLaneIds(saved));
    // Refuse an AI table graphic drawn for another dealer or placement before any I/O or freezing.
    assertAiTablesFit(saved.lanes.filter(lane => lanes.includes(lane.id)), saved.layerAssets ?? []);
    const source = saved;
    const hasDealers = source.lanes.filter(lane => lanes.includes(lane.id)).some(lane => lane.dealers.length || lane.layers.dealer.allowed.length);
    if (hasDealers && (!videoRegistry?.loadCaptured || !videoRegistry?.verifyCapturedMedia)) {
      throw new StudioStorageError('studio_media_registry_unavailable');
    }
    // This package revision is a server-read CAS precondition, never a guessed
    // null. Reading it before I/O ensures concurrent branding cannot be erased.
    const operators = await store();
    const current = await operators.getCurrentPackage(operatorId);
    if (expectedPackageRevision !== undefined && (current?.revision ?? null) !== expectedPackageRevision) fail(409);
    const inventory = hasDealers ? await videoRegistry.loadCaptured(snapshot) : null;
    const rooms=(snapshot.administrationDocument.value.rooms??[]).filter(room=>room.operatorId===operatorId&&current?.tables?.includes(room.id));
    const blackjackLanes=lanes.filter(id=>!rooms.some(room=>room.presentationLaneId===id)
      ||rooms.some(room=>room.presentationLaneId===id&&(room.game??'blackjack')==='blackjack'));
    const rouletteLanes=lanes.filter(id=>rooms.some(room=>room.presentationLaneId===id&&room.game==='roulette'));
    const captured = captureFrozenPresentation({snapshot, selectedLaneIds:lanes, inventory,
      requiredIdleDealerIds:selectedRegisteredIdleDefaults(source, blackjackLanes),
      requiredRouletteIdleDealerIds:selectedRegisteredIdleDefaults(source, rouletteLanes)});
    if (captured.mediaPreconditions.length) await videoRegistry.verifyCapturedMedia(captured.mediaPreconditions);
    const merged = mergedMaterials(captured.presentation, await materialRows(pool, operatorId),
      {administration:snapshot.administrationDocument.value, pack:current, branding:current?.branding ?? {}, allowExtended:canExtend()});
    const value = freeze({operatorId, lanes:[...lanes], ...captured, ...merged, expectedPackageRevision:current?.revision ?? null});
    preparedValues.add(value);
    return value;
  }
  preparations.set('POST /studio/api/admin/operator-package', prepare);
  function result(published, presentation) {
    return {ok:true, operatorId:published.operatorId, packageRevision:published.revision, package_revision:published.revision,
      lanes:[...published.lanes], games:[...published.games], tables:[...published.tables], presentation};
  }
  function encodingOptions(presentation) {
    const allowExtended=typeof repository?.withMutationContext==='function';
    if(!allowExtended&&presentationPackageRequiresV29(presentation))
      throw new StudioStorageError(PRESENTATION_RUNTIME_UPDATE_REQUIRED,503);
    return {allowExtended};
  }
  handlers.set('POST /studio/api/admin/operator-package', async context => {
    if(context.body?.action==='refresh-dealer-idle'){
      const body=idleRefreshIntent(context.body),prepared=context.prepared===undefined?await prepare(context):context.prepared;
      if(!preparedValues.has(prepared)||prepared.action!==body.action||prepared.intent!==canonicalStudioJson(body))fail(422);
      if(canonicalStudioJson(validateStudioScope(context.scope))!==canonicalStudioJson(validateStudioScope(scope)))fail(403);
      const encoding=encodingOptions(prepared.presentation);
      return repository.transaction(()=>repository.withTransactionClient(async client=>{
        const operators=await createOperatorStore({sql:client,scope,now,transaction:work=>repository.withTransactionClient(work)});
        const operator=await operators.getOperatorById(body.operatorId),current=await operators.getCurrentPackage(body.operatorId);
        const project=await repository.readDocument('project'),administration=await repository.readDocument('administration');
        if(!operator||operator.status!=='active'||project?.revision!==prepared.projectRevision||administration?.revision!==prepared.administrationRevision)sceneConflict();
        idleRefreshPresentation(current,administration.value,body);
        await assertSameMaterials(client,body.operatorId,prepared.materialFingerprint);
        await assertCapturedPresentationMedia(repository,prepared.mediaPreconditions);
        assertPublishedRoomBindings({administration:administration.value,operatorId:body.operatorId,currentPackage:current,presentation:prepared.presentation});
        const branding={...current.branding,[PRESENTATION_PACKAGE_KEY]:encodePresentationPackage(prepared.presentation,encoding)};
        const published=await operators.publishPackage({actor:context.actor.user,audit:operatorAuditContext(context.actor),operatorId:body.operatorId,
          expectedRevision:body.expectedPackageRevision,lanes:current.lanes,games:current.games,tables:current.tables,branding});
        return {...result(published,prepared.presentation),idleRefreshed:{dealerId:body.dealerId,roomId:body.roomId},...warningsOf(prepared)};
      }),{presentationMutation:{kind:'presentation-package',value:prepared.presentation}});
    }
    if(context.body?.action==='publish-scene-layout'){
      const body=sceneLayoutIntent(context.body),prepared=context.prepared===undefined?await prepare(context):context.prepared;
      if(!preparedValues.has(prepared)||prepared.action!==body.action||prepared.intent!==canonicalStudioJson(body))fail(422);
      if(canonicalStudioJson(validateStudioScope(context.scope))!==canonicalStudioJson(validateStudioScope(scope)))fail(403);
      const encoding=encodingOptions(prepared.presentation);
      return repository.transaction(()=>repository.withTransactionClient(async client=>{
        const operators=await createOperatorStore({sql:client,scope,now,transaction:work=>repository.withTransactionClient(work)});
        const operator=await operators.getOperatorById(body.operatorId),current=await operators.getCurrentPackage(body.operatorId),administration=await repository.readDocument('administration'),projectDocument=await repository.readDocument('project');
        if(!operator||operator.status!=='active'||administration?.revision!==prepared.administrationRevision||projectDocument?.revision!==prepared.projectRevision)sceneConflict();
        const rows=await materialRows(client,body.operatorId);
        if(materials&&operatorMaterialFingerprint(rows)!==prepared.materialFingerprint)sceneConflict();
        const candidate=publishedScenePresentation(current,administration.value,projectDocument,body,rows),affectedRooms=candidate.affectedRooms;
        const {presentation}=mergedMaterials(candidate.presentation,rows,{administration:administration.value,pack:current,branding:current.branding,allowExtended:canExtend()});
        if(canonicalStudioJson(presentation)!==canonicalStudioJson(prepared.presentation))sceneConflict();
        assertPublishedRoomBindings({administration:administration.value,operatorId:body.operatorId,currentPackage:current,presentation});
        // Preserve every other branding field, including unrelated published room choices.
        // A saved branding draft is neither read nor published.
        const branding={...current.branding,[PRESENTATION_PACKAGE_KEY]:encodePresentationPackage(presentation,encoding)};
        const published=await operators.publishPackage({actor:context.actor.user,audit:operatorAuditContext(context.actor),operatorId:body.operatorId,
          expectedRevision:body.expectedPackageRevision,lanes:current.lanes,games:current.games,tables:current.tables,branding});
        return {...result(published,presentation),compositionId:body.compositionId,projectRevision:prepared.projectRevision,affectedRooms,...warningsOf(prepared)};
      }),{presentationMutation:{kind:'presentation-package',value:prepared.presentation}});
    }
    const expectedPackageRevision = requestedPackageRevision(context.body);
    if (repository) {
      const prepared = context.prepared === undefined ? await prepare(context) : context.prepared;
      if (!preparedValues.has(prepared) || prepared.operatorId !== context.body.operatorId
        || canonicalStudioJson(prepared.lanes) !== canonicalStudioJson(context.body.lanes)) fail(422);
      if (expectedPackageRevision !== undefined && prepared.expectedPackageRevision !== expectedPackageRevision) fail(409);
      const encoding=encodingOptions(prepared.presentation);
      return repository.transaction(() => repository.withTransactionClient(async client => {
        const operators = await createOperatorStore({sql:client, scope, now, transaction:work => repository.withTransactionClient(work)});
        const projectDocument = await repository.readDocument('project'), administrationDocument = await repository.readDocument('administration');
        const current = await operators.getCurrentPackage(prepared.operatorId);
        if (projectDocument?.revision !== prepared.projectRevision || administrationDocument?.revision !== prepared.administrationRevision
          || (current?.revision ?? null) !== prepared.expectedPackageRevision) throw new StudioStorageError('studio_conflict', 409);
        await assertSameMaterials(client, prepared.operatorId, prepared.materialFingerprint);
        await assertCapturedPresentationMedia(repository, prepared.mediaPreconditions);
        assertPublishedRoomBindings({administration:administrationDocument.value, operatorId:prepared.operatorId,
          currentPackage:current, presentation:prepared.presentation});
        const published = await operators.publishPackage({actor:context.actor.user, audit:operatorAuditContext(context.actor), operatorId:prepared.operatorId,
          expectedRevision:prepared.expectedPackageRevision, lanes:[...prepared.lanes],
          games:current?.games?.length ? [...current.games] : ['blackjack'], tables:current ? [...current.tables] : [],
          branding:withPackagePresentation(current?.branding ?? {}, prepared.presentation,encoding)});
        return {...result(published, prepared.presentation), ...warningsOf(prepared)};
      }),{presentationMutation:{kind:'presentation-package',value:prepared.presentation}});
    }
    // Local fixture/legacy adapters retain original-four behavior. A registered
    // extra dealer requires the native saved snapshot and immutable media path.
    const saved = normalizeProject(typeof project === 'function' ? await project() : project);
    const lanes = selectedLanes(context.body.lanes, presentationLaneIds(saved));
    assertAiTablesFit(saved.lanes.filter(lane => lanes.includes(lane.id)), saved.layerAssets ?? []);
    const source = saved;
    if (source.lanes.filter(lane => lanes.includes(lane.id)).some(lane => lane.dealers.some(id => !BASE_DEALER_IDS.includes(id))))
      throw new StudioStorageError('studio_media_registry_unavailable');
    const presentation = buildPresentationPackage(source, lanes, saved.layerAssets ?? []);
    const operators = await store();
    if (expectedPackageRevision !== undefined && typeof operators.getCurrentPackage !== 'function') fail(503);
    const current = typeof operators.getCurrentPackage === 'function' ? await operators.getCurrentPackage(context.body.operatorId) : null;
    if (expectedPackageRevision !== undefined && (current?.revision ?? null) !== expectedPackageRevision) fail(409);
    const published = await operators.publishPackage({actor:context.actor.user, audit:operatorAuditContext(context.actor), operatorId:context.body.operatorId,
      expectedRevision:current?.revision ?? null, lanes, games:current?.games?.length ? [...current.games] : ['blackjack'],
      tables:current ? [...current.tables] : [], branding:withPackagePresentation(current?.branding ?? {}, presentation)});
    return result(published, presentation);
  });
  handlers.set('POST /studio/api/admin/operator-create-demo', async context => {
    exactKeys(context.body, []);
    const created = await (await store()).createOperator({
      actor: context.actor.user, audit: operatorAuditContext(context.actor),
      operatorId: SG_TEST_OPERATOR.id,
      slug: SG_TEST_OPERATOR.slug,
      name: SG_TEST_OPERATOR.name,
    });
    return { ok: true, operator: publicOperator(created) };
  });
  return Object.freeze({
    handlers, preparations,
    listOperators: async () => {
      const operators = await store(), listed = await operators.listOperators();
      return Promise.all(listed.filter(operator => operator.status !== 'suspended').map(async operator => {
        const published = await operators.getCurrentPackage(operator.id);
        // Server-owned current assignment. The editor must not seed another
        // company's publish selection or omit lanes serving its live rooms.
        return { id: operator.id, slug: operator.slug, name: operator.name, status: operator.status,
          publishedPackage: published ? { revision: published.revision, lanes: [...published.lanes] } : null };
      }));
    },
  });
}
