import { PARTNER_PREVIEW_OPERATORS } from './partner-preview-policy.mjs';
import { defaultPresentationLane, normalizeProject } from './studio-model.mjs';

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
  return ids.length ? ids : [defaultPresentationLane().id];
}

function exactKeys(body, keys) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400);
  const present = Object.keys(body);
  if (present.length !== keys.length || keys.some(key => !Object.hasOwn(body, key))) fail(400);
}

function selectedLanes(value, allowed) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length < 1 || value.length > 32) fail(422);
  if (new Set(value).size !== value.length || value.some(item => typeof item !== 'string' || !allowed.includes(item))) fail(422);
  return value;
}

function publicOperator(operator) {
  return { id: operator.id, slug: operator.slug, name: operator.name, status: operator.status };
}

export function createOperatorPackageApi({ pool, scope, project, now = () => Date.now(), storeFactory } = {}) {
  const handlers = new Map();
  async function store() {
    return openWritableOperatorStore({ pool, scope, now, storeFactory });
  }
  async function allowedLaneIds() {
    const current = typeof project === 'function' ? await project() : project;
    return presentationLaneIds(current);
  }
  handlers.set('POST /studio/api/admin/operator-package', async context => {
    exactKeys(context.body, ['operatorId', 'lanes']);
    const lanes = selectedLanes(context.body.lanes, await allowedLaneIds());
    const operators = await store();
    // Publishing lanes must not wipe what the operator saved through the partner
    // branding API; games and tables are carried forward the same way.
    const current = typeof operators.getCurrentPackage === 'function' ? await operators.getCurrentPackage(context.body.operatorId) : null;
    const published = await operators.publishPackage({
      actor: context.actor.user,
      operatorId: context.body.operatorId,
      lanes,
      games: current?.games?.length ? [...current.games] : ['blackjack'],
      tables: current ? [...current.tables] : [],
      branding: current ? structuredClone(current.branding) : {},
    });
    return {
      ok: true,
      operatorId: published.operatorId,
      packageRevision: published.revision,
      package_revision: published.revision,
      lanes: [...published.lanes],
      games: [...published.games],
      tables: [...published.tables],
    };
  });
  handlers.set('POST /studio/api/admin/operator-create-demo', async context => {
    exactKeys(context.body, []);
    const created = await (await store()).createOperator({
      actor: context.actor.user,
      operatorId: SG_TEST_OPERATOR.id,
      slug: SG_TEST_OPERATOR.slug,
      name: SG_TEST_OPERATOR.name,
    });
    return { ok: true, operator: publicOperator(created) };
  });
  return Object.freeze({
    handlers,
    listOperators: async () => {
      const listed = await (await store()).listOperators();
      return listed.filter(operator => operator.status !== 'suspended').map(operator => ({
        id: operator.id, slug: operator.slug, name: operator.name,
      }));
    },
  });
}
