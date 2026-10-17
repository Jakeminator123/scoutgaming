import { operatorAuditContext } from './operator-audit-context.mjs';
import { PARTNER_PREVIEW_OPERATORS } from './partner-preview-policy.mjs';
import { normalizeProject } from '../../packages/presentation/contracts/studio-model.mjs';
import { buildPresentationPackage } from '../../web/presentation-layers.mjs';
import { BASE_DEALER_IDS } from '../../packages/presentation/contracts/dealer-identity.mjs';
import { createOperatorStore } from '../../web/storage/operator-store.mjs';
import { canonicalStudioJson, validateStudioScope, StudioStorageError } from '../../web/storage/studio-contract.mjs';
import {captureFrozenPresentation, selectedRegisteredIdleDefaults, assertCapturedPresentationMedia, assertPublishedRoomBindings} from '../../web/storage/frozen-presentation-capture.mjs';
import { withPackagePresentation } from '../../web/storage/presentation-package.mjs';

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
  const create = storeFactory ?? (await import('../../web/storage/operator-store.mjs')).createOperatorStore;
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

export function createOperatorPackageApi({ pool, scope, project, gameLanes, repository, videoRegistry, now = () => Date.now(), storeFactory } = {}) {
  const handlers = new Map();
  async function store() {
    return openWritableOperatorStore({ pool, scope, now, storeFactory });
  }
  const preparedValues = new WeakSet();
  const preparations = new Map();
  async function prepare(context) {
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
    const value = Object.freeze({operatorId, lanes:Object.freeze([...lanes]), ...captured, expectedPackageRevision:current?.revision ?? null});
    preparedValues.add(value);
    return value;
  }
  preparations.set('POST /studio/api/admin/operator-package', prepare);
  function result(published, presentation) {
    return {ok:true, operatorId:published.operatorId, packageRevision:published.revision, package_revision:published.revision,
      lanes:[...published.lanes], games:[...published.games], tables:[...published.tables], presentation};
  }
  handlers.set('POST /studio/api/admin/operator-package', async context => {
    const expectedPackageRevision = requestedPackageRevision(context.body);
    if (repository) {
      const prepared = context.prepared === undefined ? await prepare(context) : context.prepared;
      if (!preparedValues.has(prepared) || prepared.operatorId !== context.body.operatorId
        || canonicalStudioJson(prepared.lanes) !== canonicalStudioJson(context.body.lanes)) fail(422);
      if (expectedPackageRevision !== undefined && prepared.expectedPackageRevision !== expectedPackageRevision) fail(409);
      return repository.transaction(() => repository.withTransactionClient(async client => {
        const operators = await createOperatorStore({sql:client, scope, now, transaction:work => repository.withTransactionClient(work)});
        const projectDocument = await repository.readDocument('project'), administrationDocument = await repository.readDocument('administration');
        const current = await operators.getCurrentPackage(prepared.operatorId);
        if (projectDocument?.revision !== prepared.projectRevision || administrationDocument?.revision !== prepared.administrationRevision
          || (current?.revision ?? null) !== prepared.expectedPackageRevision) throw new StudioStorageError('studio_conflict', 409);
        await assertCapturedPresentationMedia(repository, prepared.mediaPreconditions);
        assertPublishedRoomBindings({administration:administrationDocument.value, operatorId:prepared.operatorId,
          currentPackage:current, presentation:prepared.presentation});
        const published = await operators.publishPackage({actor:context.actor.user, audit:operatorAuditContext(context.actor), operatorId:prepared.operatorId,
          expectedRevision:prepared.expectedPackageRevision, lanes:[...prepared.lanes],
          games:current?.games?.length ? [...current.games] : ['blackjack'], tables:current ? [...current.tables] : [],
          branding:withPackagePresentation(current?.branding ?? {}, prepared.presentation)});
        return result(published, prepared.presentation);
      }));
    }
    // Local fixture/legacy adapters retain original-four behavior. A registered
    // extra dealer requires the native saved snapshot and immutable media path.
    const saved = normalizeProject(typeof project === 'function' ? await project() : project);
    const lanes = selectedLanes(context.body.lanes, presentationLaneIds(saved));
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
