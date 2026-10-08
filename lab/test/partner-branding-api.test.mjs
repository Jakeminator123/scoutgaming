import test from 'node:test';
import assert from 'node:assert/strict';
import { createOperatorStore } from '../../web/storage/operator-store.mjs';
import { createPartnerBrandingApi, TABLE_COLOR_BRANDING_KEY } from '../lib/partner-branding-api.mjs';

const scope = { environment: 'isolated-fixture', workspaceId: 'qa' };
const clock = () => 1_700_000_000_000;
const actor = 'brand-actor';
const operatorId = 'operator-unibet';

function memoryPool() {
  const tables = { operators: [], operator_roles: [], operator_memberships: [], operator_packages: [] };
  const pgError = code => Object.assign(new Error('fixture'), { code });
  const copy = row => structuredClone(row);
  async function dispatch(text, values = []) {
    const tag = /\/\* operator-store:([a-z-]+) \*\//.exec(text)?.[1];
    if (!tag) throw new Error(`untagged query: ${text}`);
    const [environment, workspace] = values;
    const scoped = name => tables[name].filter(row => row.environment_id === environment && row.workspace_id === workspace);
    if (tag === 'list-operators') return { rows: scoped('operators').sort((a, b) => a.slug.localeCompare(b.slug)).map(copy) };
    if (tag === 'operator-by-slug') return { rows: scoped('operators').filter(row => row.slug === values[2]).map(copy) };
    if (tag === 'operator-by-id') return { rows: scoped('operators').filter(row => row.operator_id === values[2]).map(copy) };
    if (tag === 'list-roles' || tag === 'guard-roles') return { rows: scoped('operator_roles').filter(row => row.operator_id === values[2]).sort((a, b) => a.role_id.localeCompare(b.role_id)).map(copy) };
    if (tag === 'get-role') return { rows: scoped('operator_roles').filter(row => row.operator_id === values[2] && row.role_id === values[3]).map(copy) };
    if (tag === 'get-membership') return { rows: scoped('operator_memberships').filter(row => row.operator_id === values[2] && row.user_id === values[3]).map(copy) };
    if (tag === 'list-memberships' || tag === 'guard-memberships') return { rows: scoped('operator_memberships').filter(row => row.operator_id === values[2]).sort((a, b) => a.user_id.localeCompare(b.user_id)).map(copy) };
    if (tag === 'current-package') return { rows: scoped('operator_packages').filter(row => row.operator_id === values[2]).sort((a, b) => Number(b.package_revision) - Number(a.package_revision)).slice(0, 1).map(copy) };
    if (tag === 'lock-operator') return { rows: scoped('operators').filter(row => row.operator_id === values[2]).map(copy) };
    if (tag === 'create-operator') {
      if (scoped('operators').some(row => row.operator_id === values[2] || row.slug === values[3])) throw pgError('23505');
      const row = { environment_id: environment, workspace_id: workspace, operator_id: values[2], slug: values[3], name: values[4], status: values[5], created_at_ms: values[6] };
      tables.operators.push(row);
      return { rows: [copy(row)] };
    }
    if (tag === 'upsert-role') {
      if (!scoped('operators').some(row => row.operator_id === values[2])) throw pgError('23503');
      let row = tables.operator_roles.find(item => item.environment_id === environment && item.workspace_id === workspace && item.operator_id === values[2] && item.role_id === values[3]);
      if (!row) {
        row = { environment_id: environment, workspace_id: workspace, operator_id: values[2], role_id: values[3], label: values[4], permissions: values[5], delegable: values[6] };
        tables.operator_roles.push(row);
      } else Object.assign(row, { label: values[4], permissions: values[5], delegable: values[6] });
      return { rows: [copy(row)] };
    }
    if (tag === 'create-membership') {
      if (!scoped('operators').some(row => row.operator_id === values[2])) throw pgError('23503');
      if (!scoped('operator_roles').some(row => row.operator_id === values[2] && row.role_id === values[4])) throw pgError('23503');
      if (scoped('operator_memberships').some(row => row.operator_id === values[2] && row.user_id === values[3])) throw pgError('23505');
      const row = { environment_id: environment, workspace_id: workspace, operator_id: values[2], user_id: values[3], role_id: values[4], status: values[5], revision: 1, created_at_ms: values[6] };
      tables.operator_memberships.push(row);
      return { rows: [copy(row)] };
    }
    if (tag === 'publish-package') {
      if (!scoped('operators').some(row => row.operator_id === values[2])) throw pgError('23503');
      const revision = scoped('operator_packages').filter(row => row.operator_id === values[2]).reduce((max, row) => Math.max(max, Number(row.package_revision)), 0) + 1;
      const row = { environment_id: environment, workspace_id: workspace, operator_id: values[2], package_revision: revision, lanes: values[3], games: values[4], tables: values[5], branding: values[6], published_at_ms: values[7] };
      tables.operator_packages.push(row);
      return { rows: [copy(row)] };
    }
    throw new Error(`unknown tag ${tag}`);
  }
  async function query(text, values) {
    const command = String(text).trim();
    if (command === 'BEGIN' || command === 'COMMIT' || command === 'ROLLBACK' || command.startsWith('SET LOCAL')) {
      return { rows: [], command: command.startsWith('SET') ? 'SET' : command };
    }
    return dispatch(text, values);
  }
  return {
    query,
    async connect() { return { query, release() {} }; },
    packageCount: () => tables.operator_packages.length,
  };
}

async function seeded(lanes = ['vip-table', 'mobile-phone']) {
  const pool = memoryPool();
  const store = await createOperatorStore({ sql: pool, scope, now: clock });
  await store.createOperator({ actor, operatorId, slug: 'unibet', name: 'Unibet' });
  await store.upsertRole({
    actor, operatorId, roleId: 'partner-admin', label: 'Partner administrator',
    permissions: ['overview.read', 'presentations.configure'], delegable: false,
  });
  await store.upsertMembership({ actor, operatorId, userId: 'staff-1', roleId: 'partner-admin', status: 'active' });
  await store.publishPackage({
    actor, operatorId, lanes, games: ['blackjack'], tables: ['table-a'],
    branding: { [TABLE_COLOR_BRANDING_KEY]: '#112233', name: 'Unibet' },
  });
  const listed = await store.listOperators();
  const bySlug = await store.getOperatorBySlug('unibet');
  const role = await store.getRole(operatorId, 'partner-admin');
  const membership = await store.getMembership(operatorId, 'staff-1');
  assert.equal(listed[0].slug, 'unibet');
  assert.equal(bySlug.id, operatorId);
  assert.equal(role.id, 'partner-admin');
  assert.equal(membership.roleId, 'partner-admin');
  return { pool, store };
}

function apiFor(store, lanes) {
  return createPartnerBrandingApi({
    store,
    readProject: async () => ({ project: { lanes } }),
  });
}

test('adjustable is the union of the package lanes, with mobile-phone falling back to the default lane', async () => {
  const { store } = await seeded(['mobile-phone', 'missing-lane']);
  const fallback = apiFor(store, [{ id: 'vip-table', operatorAdjustable: ['dealer'] }]);
  const fallen = await fallback.read({ operatorId });
  assert.deepEqual(fallen.adjustable, ['table.color', 'branding']);
  assert.equal(fallen.packageRevision, 1);
  const pinned = apiFor(store, [{ id: 'mobile-phone', operatorAdjustable: ['dealer'] }]);
  assert.deepEqual((await pinned.read({ operatorId })).adjustable, ['dealer']);
  const mixed = apiFor(store, [
    { id: 'mobile-phone', operatorAdjustable: ['table.color'] },
    { id: 'vip-table', operatorAdjustable: ['branding', 'background'] },
  ]);
  const { store: both } = await seeded(['vip-table', 'mobile-phone']);
  assert.deepEqual((await apiFor(both, [
    { id: 'mobile-phone', operatorAdjustable: ['table.color'] },
    { id: 'vip-table', operatorAdjustable: ['branding', 'background'] },
  ]).read({ operatorId })).adjustable, ['table.color', 'background', 'branding']);
  await assert.rejects(() => mixed.read({ operatorId: 'missing-operator' }), error => error.statusCode === 404);
});

test('a matching revision publishes branding and keeps lanes, games and tables', async () => {
  const { pool, store } = await seeded();
  const api = apiFor(store, [
    { id: 'mobile-phone', operatorAdjustable: ['table.color', 'branding'] },
    { id: 'vip-table', operatorAdjustable: [] },
  ]);
  const saved = await api.write({
    operatorId, actor, expectedRevision: 1,
    branding: { [TABLE_COLOR_BRANDING_KEY]: '#00ff00', logo: 'mark' },
  });
  assert.equal(saved.packageRevision, 2);
  assert.deepEqual(saved.lanes, ['mobile-phone', 'vip-table']);
  assert.deepEqual(saved.branding, { [TABLE_COLOR_BRANDING_KEY]: '#00ff00', logo: 'mark', name: 'Unibet' });
  const current = await store.getCurrentPackage(operatorId);
  assert.equal(current.revision, 2);
  assert.deepEqual([...current.lanes], ['mobile-phone', 'vip-table']);
  assert.deepEqual([...current.games], ['blackjack']);
  assert.deepEqual([...current.tables], ['table-a']);
  assert.equal(pool.packageCount(), 2);
});

test('the wrong revision is 409 and a key outside the lane is 422', async () => {
  const { pool, store } = await seeded(['mobile-phone']);
  const colorOnly = apiFor(store, [{ id: 'mobile-phone', operatorAdjustable: ['table.color'] }]);
  await assert.rejects(
    () => colorOnly.write({ operatorId, actor, expectedRevision: 4, branding: { name: 'Nord' } }),
    error => error.statusCode === 422,
  );
  await assert.rejects(
    () => colorOnly.write({ operatorId, actor, expectedRevision: 9, branding: { [TABLE_COLOR_BRANDING_KEY]: '#00ff00' } }),
    error => error.statusCode === 409,
  );
  const brandingOnly = apiFor(store, [{ id: 'mobile-phone', operatorAdjustable: ['branding'] }]);
  await assert.rejects(
    () => brandingOnly.write({ operatorId, actor, expectedRevision: 1, branding: { [TABLE_COLOR_BRANDING_KEY]: '#00ff00' } }),
    error => error.statusCode === 422,
  );
  await assert.rejects(
    () => brandingOnly.write({ operatorId, actor, expectedRevision: 1, branding: { constructor: 'nope' } }),
    error => error.statusCode === 422,
  );
  assert.equal(pool.packageCount(), 1);
  assert.equal((await store.getCurrentPackage(operatorId)).revision, 1);
});
