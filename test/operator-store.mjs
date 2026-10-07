import test from 'node:test';
import assert from 'node:assert/strict';
import { allowsPartnerResource } from '../web/partner-access-policy.mjs';
import { createOperatorStore } from '../web/storage/operator-store.mjs';
import { StudioStorageError, canonicalStudioJson } from '../web/storage/studio-contract.mjs';

const north = { environment: 'qa', workspaceId: 'workspace-north' };
const south = { environment: 'qa', workspaceId: 'workspace-south' };
const actor = 'tenant-test';
const partner = { userId: 'staff-1', role: 'partner', status: 'active' };
const refusal = code => error => error instanceof StudioStorageError && error.code === code;
const clock = () => 1_700_000_000_000;

function memorySql() {
  const tables = { operators: [], operator_roles: [], operator_memberships: [], operator_packages: [] };
  const calls = [];
  const clients = [];
  const trace = [];
  const tails = new Map();
  const depth = new Map();
  const flags = { holdUntilWaiters: 0 };
  let clientSeq = 0;
  let rendezvousDone = false;
  const pgError = code => Object.assign(new Error('fixture'), { code });
  const copy = row => structuredClone(row);
  function restore(snapshot) {
    for (const name of Object.keys(tables)) {
      tables[name].length = 0;
      tables[name].push(...snapshot[name]);
    }
  }
  async function acquire(key) {
    depth.set(key, (depth.get(key) ?? 0) + 1);
    const previous = tails.get(key) ?? Promise.resolve();
    let releaseGate;
    const gate = new Promise(resolve => { releaseGate = resolve; });
    tails.set(key, previous.then(() => gate, () => gate));
    await previous;
    try {
      if (flags.holdUntilWaiters && !rendezvousDone) {
        rendezvousDone = true;
        const need = flags.holdUntilWaiters + 1;
        const start = Date.now();
        while ((depth.get(key) ?? 0) < need) {
          if (Date.now() - start > 2000) throw new Error('lock rendezvous timed out');
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      }
    } catch (error) {
      depth.set(key, (depth.get(key) ?? 1) - 1);
      releaseGate();
      throw error;
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      depth.set(key, (depth.get(key) ?? 1) - 1);
      releaseGate();
    };
  }
  async function dispatch(text, values = [], tx = null) {
    calls.push({ text, values: [...values] });
    const tag = /\/\* operator-store:([a-z-]+) \*\//.exec(text)?.[1];
    if (!tag) throw new Error(`untagged query: ${text}`);
    const [environment, workspace] = values;
    const scoped = name => tables[name].filter(row => row.environment_id === environment && row.workspace_id === workspace);
    const snapshot = () => { if (tx?.inTx && !tx.snapshot) tx.snapshot = structuredClone(tables); };
    if (tag === 'list-operators') return scoped('operators').sort((a, b) => a.slug.localeCompare(b.slug)).map(copy);
    if (tag === 'operator-by-slug') return scoped('operators').filter(row => row.slug === values[2]).map(copy);
    if (tag === 'operator-by-id') return scoped('operators').filter(row => row.operator_id === values[2]).map(copy);
    if (tag === 'list-roles' || tag === 'guard-roles') return scoped('operator_roles').filter(row => row.operator_id === values[2]).sort((a, b) => a.role_id.localeCompare(b.role_id)).map(copy);
    if (tag === 'get-role') return scoped('operator_roles').filter(row => row.operator_id === values[2] && row.role_id === values[3]).map(copy);
    if (tag === 'get-membership') return scoped('operator_memberships').filter(row => row.operator_id === values[2] && row.user_id === values[3]).map(copy);
    if (tag === 'list-memberships' || tag === 'guard-memberships') return scoped('operator_memberships').filter(row => row.operator_id === values[2]).sort((a, b) => a.user_id.localeCompare(b.user_id)).map(copy);
    if (tag === 'current-package') return scoped('operator_packages').filter(row => row.operator_id === values[2]).sort((a, b) => b.package_revision - a.package_revision).slice(0, 1).map(copy);
    if (tag === 'lock-operator') return scoped('operators').filter(row => row.operator_id === values[2]).map(copy);
    if (tag === 'create-operator') {
      if (scoped('operators').some(row => row.operator_id === values[2] || row.slug === values[3])) throw pgError('23505');
      snapshot();
      const row = { environment_id: environment, workspace_id: workspace, operator_id: values[2], slug: values[3], name: values[4], status: values[5], created_at_ms: values[6] };
      tables.operators.push(row);
      return [copy(row)];
    }
    if (tag === 'upsert-role') {
      if (!scoped('operators').some(row => row.operator_id === values[2])) throw pgError('23503');
      let row = tables.operator_roles.find(item => item.environment_id === environment && item.workspace_id === workspace && item.operator_id === values[2] && item.role_id === values[3]);
      snapshot();
      if (!row) {
        row = { environment_id: environment, workspace_id: workspace, operator_id: values[2], role_id: values[3], label: values[4], permissions: values[5], delegable: values[6] };
        tables.operator_roles.push(row);
      } else Object.assign(row, { label: values[4], permissions: values[5], delegable: values[6] });
      return [copy(row)];
    }
    if (tag === 'create-membership') {
      if (!scoped('operators').some(row => row.operator_id === values[2])) throw pgError('23503');
      if (!scoped('operator_roles').some(row => row.operator_id === values[2] && row.role_id === values[4])) throw pgError('23503');
      if (scoped('operator_memberships').some(row => row.operator_id === values[2] && row.user_id === values[3])) throw pgError('23505');
      snapshot();
      const row = { environment_id: environment, workspace_id: workspace, operator_id: values[2], user_id: values[3], role_id: values[4], status: values[5], revision: 1, created_at_ms: values[6] };
      tables.operator_memberships.push(row);
      return [copy(row)];
    }
    if (tag === 'cas-membership') {
      if (!scoped('operator_roles').some(row => row.operator_id === values[2] && row.role_id === values[5])) throw pgError('23503');
      const row = tables.operator_memberships.find(item => item.environment_id === environment && item.workspace_id === workspace && item.operator_id === values[2] && item.user_id === values[3] && item.revision === values[4]);
      if (!row) return [];
      snapshot();
      row.role_id = values[5];
      row.status = values[6];
      row.revision += 1;
      return [copy(row)];
    }
    if (tag === 'publish-package') {
      if (!scoped('operators').some(row => row.operator_id === values[2])) throw pgError('23503');
      snapshot();
      const revision = scoped('operator_packages').filter(row => row.operator_id === values[2]).reduce((max, row) => Math.max(max, Number(row.package_revision)), 0) + 1;
      const row = { environment_id: environment, workspace_id: workspace, operator_id: values[2], package_revision: revision, lanes: values[3], games: values[4], tables: values[5], branding: values[6], published_at_ms: values[7] };
      tables.operator_packages.push(row);
      return [copy(row)];
    }
    throw new Error(`unknown tag ${tag}`);
  }
  const sql = async (text, values) => dispatch(text, values, null);
  sql.connect = async () => {
    const client = { id: ++clientSeq, calls: [], inTx: false, snapshot: null, lockRelease: null, released: false };
    const unlock = () => {
      const release = client.lockRelease;
      client.lockRelease = null;
      release?.();
    };
    client.query = async (text, values = []) => {
      client.calls.push({ text, values: [...values] });
      const command = text.trim();
      if (command === 'BEGIN') {
        client.inTx = true;
        client.snapshot = null;
        return { rows: [], command: 'BEGIN' };
      }
      if (command.startsWith('SET LOCAL')) return { rows: [], command: 'SET' };
      if (command === 'COMMIT' || command === 'ROLLBACK') {
        if (command === 'ROLLBACK' && client.snapshot) restore(client.snapshot);
        client.snapshot = null;
        client.inTx = false;
        unlock();
        trace.push({ event: command === 'COMMIT' ? 'commit' : 'rollback', client: client.id });
        return { rows: [], command };
      }
      const tag = /\/\* operator-store:([a-z-]+) \*\//.exec(text)?.[1];
      if (tag === 'lock-operator') {
        const key = `${values[0]}\0${values[1]}\0${values[2]}`;
        trace.push({ event: 'lock-wait', client: client.id, key });
        client.lockRelease = await acquire(key);
        trace.push({ event: 'lock-acquired', client: client.id, key });
      }
      return { rows: await dispatch(text, values, client) };
    };
    client.release = () => {
      client.released = true;
      unlock();
    };
    clients.push(client);
    return client;
  };
  sql.calls = calls;
  sql.tables = tables;
  sql.clients = clients;
  sql.trace = trace;
  Object.defineProperty(sql, 'holdUntilWaiters', {
    enumerable: true,
    get: () => flags.holdUntilWaiters,
    set: value => { flags.holdUntilWaiters = value; },
  });
  return sql;
}

async function open(scope, sql) {
  return createOperatorStore({ sql, scope, now: clock });
}

async function seed(store, { operatorId = 'operator-unibet', slug = 'unibet', name = 'Unibet', userId = 'staff-1', status = 'active', operatorStatus = 'active' } = {}) {
  const operator = await store.createOperator({ operatorId, slug, name, status: operatorStatus, actor });
  await store.upsertRole({ operatorId, roleId: 'manager', label: 'Manager', permissions: ['players.read', 'overview.read'], delegable: true, actor });
  const membership = await store.upsertMembership({ operatorId, userId, roleId: 'manager', status, actor });
  return { operator, membership };
}

test('two workspaces and two environments never see each other, and slug lookup is not ownership', async () => {
  const sql = memorySql();
  const left = await open(north, sql);
  const right = await open(south, sql);
  const otherEnvironment = await open({ environment: 'qa-other', workspaceId: 'workspace-north' }, sql);
  await seed(left, { name: 'Unibet North' });
  await seed(right, { name: 'Unibet South' });
  await seed(left, { operatorId: 'operator-betsson', slug: 'betsson', name: 'Betsson', userId: 'staff-2' });
  assert.equal((await left.getOperatorBySlug('unibet')).name, 'Unibet North');
  assert.equal((await right.getOperatorBySlug('unibet')).name, 'Unibet South');
  assert.equal((await left.getOperatorById('operator-unibet')).id, 'operator-unibet');
  assert.equal(await otherEnvironment.getOperatorBySlug('unibet'), null);
  assert.equal(await otherEnvironment.getOperatorById('operator-unibet'), null);
  assert.deepEqual((await right.listOperators()).map(row => row.name), ['Unibet South']);
  const context = await left.resolvePartnerContext({ account: partner, operatorSlug: 'unibet' });
  const owned = { scope: context.scope, operatorId: context.operator.id };
  assert.equal(context.operator.id, 'operator-unibet');
  assert.notEqual(context.operator.id, 'unibet');
  assert.equal(allowsPartnerResource(context, 'overview.read', owned), true);
  assert.equal(allowsPartnerResource(context, 'overview.read', { scope: context.scope, operatorId: 'operator-betsson' }), false);
  assert.equal(allowsPartnerResource(context, 'overview.read', { scope: context.scope, operatorId: 'unibet' }), false);
  assert.equal(allowsPartnerResource(context, 'overview.read', { scope: south, operatorId: 'operator-unibet' }), false);
  const lookup = sql.calls.filter(call => call.text.includes('operator-by-slug'));
  assert.ok(lookup.every(call => call.values[2] === 'unibet' && !call.text.includes("'unibet'") && !call.text.includes('operator-unibet')));
  const membershipLookup = sql.calls.filter(call => call.text.includes('get-membership') && call.values[1] === 'workspace-north');
  assert.ok(membershipLookup.every(call => call.values[2] === 'operator-unibet'));
  assert.ok(sql.calls.every(call => call.values[0] === 'qa' || call.values[0] === 'qa-other'));
  assert.ok(sql.calls.every(call => call.values[1] === 'workspace-north' || call.values[1] === 'workspace-south'));
  assert.ok(sql.calls.filter(call => call.text.includes('WHERE')).every(call => call.text.includes('environment_id=$1 AND workspace_id=$2')));
  assert.ok(sql.calls.filter(call => call.text.includes('INSERT')).every(call => call.text.includes('environment_id, workspace_id') || call.text.includes('environment_id=$1 AND workspace_id=$2')));
});

test('membership compare-and-set conflicts on a stale revision and a suspended member resolves to null', async () => {
  const store = await open(north, memorySql());
  const created = await seed(store);
  assert.equal(created.membership.revision, 1);
  assert.equal(created.operator.createdAtMs, clock());
  const updated = await store.upsertMembership({ operatorId: 'operator-unibet', userId: 'staff-1', roleId: 'manager', status: 'active', expectedRevision: 1, actor });
  assert.equal(updated.revision, 2);
  await assert.rejects(store.upsertMembership({ operatorId: 'operator-unibet', userId: 'staff-1', roleId: 'manager', status: 'active', expectedRevision: 1, actor }), refusal('studio_conflict'));
  const suspended = await store.upsertMembership({ operatorId: 'operator-unibet', userId: 'staff-1', roleId: 'manager', status: 'suspended', expectedRevision: 2, actor });
  assert.equal(suspended.status, 'suspended');
  assert.equal(await store.resolvePartnerContext({ account: partner, operatorSlug: 'unibet' }), null);
  const invited = await open(south, memorySql());
  await seed(invited, { status: 'invited' });
  assert.equal(await invited.resolvePartnerContext({ account: partner, operatorSlug: 'unibet' }), null);
});

test('active membership context is accepted only for that operator, and internal admins stay on a separate path', async () => {
  const sql = memorySql();
  const store = await open(north, sql);
  assert.deepEqual(await store.resolvePartnerContext({ account: { userId: '7', role: 'admin', status: 'active' } }), { internalPreview: true });
  assert.deepEqual(await store.resolvePartnerContext({ account: { userId: '8', role: 'superadmin', status: 'active' } }), { internalPreview: true });
  assert.equal(await store.resolvePartnerContext({ account: { userId: '9', role: 'admin', status: 'suspended' } }), null);
  assert.equal(sql.calls.length, 0);
  await seed(store);
  const context = await store.resolvePartnerContext({ account: partner, operatorSlug: 'unibet' });
  assert.equal(allowsPartnerResource(context, 'players.read', { scope: context.scope, operatorId: 'operator-unibet' }), true);
  assert.equal(allowsPartnerResource(context, 'tables.configure', { scope: context.scope, operatorId: 'operator-unibet' }), false);
  assert.deepEqual(context.role.permissions, ['overview.read', 'players.read']);
  assert.equal(await store.resolvePartnerContext({ account: { userId: 'staff-1', role: 'reader', status: 'active' }, operatorSlug: 'unibet' }), null);
  assert.equal(await store.resolvePartnerContext({ account: { ...partner, userId: 'missing-user' }, operatorSlug: 'unibet' }), null);
  await store.createOperator({ operatorId: 'operator-paused', slug: 'paused', name: 'Paused', status: 'suspended', actor });
  await store.upsertRole({ operatorId: 'operator-paused', roleId: 'manager', label: 'Manager', permissions: ['overview.read'], delegable: false, actor });
  await store.upsertMembership({ operatorId: 'operator-paused', userId: 'staff-1', roleId: 'manager', status: 'active', actor });
  const paused = await store.resolvePartnerContext({ account: partner, operatorSlug: 'paused' });
  assert.equal(paused.operator.status, 'suspended');
  assert.equal(allowsPartnerResource(paused, 'overview.read', { scope: paused.scope, operatorId: paused.operator.id }), false);
});

test('permissions and packages round-trip as canonical JSON, and bigint strings from Postgres still validate', async () => {
  const sql = memorySql();
  const store = await open(north, sql);
  await seed(store);
  const role = await store.getRole('operator-unibet', 'manager');
  assert.equal(canonicalStudioJson(role.permissions), '["overview.read","players.read"]');
  sql.tables.operator_roles[0].permissions = '["players.read", "overview.read"]';
  await assert.rejects(store.getRole('operator-unibet', 'manager'), refusal('studio_corrupt_operator'));
  sql.tables.operator_roles[0].permissions = '["overview.read","players.read"]';
  sql.tables.operator_memberships[0].revision = '2';
  sql.tables.operator_memberships[0].created_at_ms = '1700000000000';
  const membership = await store.getMembership('operator-unibet', 'staff-1');
  assert.equal(membership.revision, 2);
  assert.equal(membership.createdAtMs, clock());
  assert.equal(await store.getCurrentPackage('operator-unibet'), null);
  const first = await store.publishPackage({ operatorId: 'operator-unibet', lanes: ['vip-table', 'mobile-phone'], games: ['blackjack'], tables: ['table-a'], branding: { color: 'green', name: 'Unibet' }, actor });
  assert.equal(first.revision, 1);
  assert.deepEqual(first.lanes, ['mobile-phone', 'vip-table']);
  assert.deepEqual(first.branding, { color: 'green', name: 'Unibet' });
  const second = await store.publishPackage({ operatorId: 'operator-unibet', lanes: ['mobile-phone'], games: [], tables: [], branding: {}, actor });
  assert.equal(second.revision, 2);
  assert.equal((await store.getCurrentPackage('operator-unibet')).revision, 2);
  const listed = await store.listRoles('operator-unibet');
  assert.equal(listed.length, 1);
  assert.equal((await store.listMemberships('operator-unibet')).length, 1);
});

test('writes require an actor, reject duplicate slugs, and a query client is accepted', async () => {
  const sql = memorySql();
  const store = await open(north, sql);
  await assert.rejects(store.createOperator({ operatorId: 'operator-unibet', slug: 'unibet', name: 'Unibet' }), refusal('studio_invalid_actor'));
  await seed(store);
  await assert.rejects(store.createOperator({ operatorId: 'operator-other', slug: 'unibet', name: 'Other', actor }), refusal('studio_conflict'));
  await assert.rejects(store.upsertRole({ operatorId: 'missing-operator', roleId: 'manager', label: 'Manager', permissions: [], delegable: false, actor }), refusal('studio_conflict'));
  const calls = [];
  const client = { async query(text, values) { calls.push({ text, values }); return { rows: [] }; } };
  const wrapped = await createOperatorStore({ sql: client, scope: north, now: clock });
  assert.deepEqual(await wrapped.listOperators(), []);
  assert.deepEqual(calls[0].values.slice(0, 2), ['qa', 'workspace-north']);
  assert.match(calls[0].text, /WHERE environment_id=\$1 AND workspace_id=\$2/);
});

test('a row that claims another workspace is corrupt, and a missing role cannot authorize', async () => {
  const store = await open(north, async () => [{
    environment_id: 'qa', workspace_id: 'workspace-south', operator_id: 'operator-unibet', slug: 'unibet',
    name: 'Unibet', status: 'active', created_at_ms: 1,
  }]);
  await assert.rejects(store.listOperators(), refusal('studio_corrupt_operator'));
  const sql = memorySql();
  const real = await open(north, sql);
  await seed(real);
  sql.tables.operator_roles.splice(0, 1);
  await assert.rejects(real.resolvePartnerContext({ account: partner, operatorSlug: 'unibet' }), refusal('studio_corrupt_operator'));
  const getter = {};
  Object.defineProperty(getter, 'userId', { get() { throw new Error('must not execute'); } });
  await assert.rejects(real.resolvePartnerContext({ account: getter }), refusal('studio_invalid_data'));
});

const adminPermissions = ['overview.read', 'team.roles.assign'];
const viewerPermissions = ['overview.read'];
const lastAdmin = error => error instanceof StudioStorageError
  && error.code === 'studio_last_operator_admin' && error.statusCode === 409;

async function tenant(sql, { roles, members, operatorId = 'operator-unibet', slug = 'unibet' }) {
  const store = await open(north, sql);
  await store.createOperator({ operatorId, slug, name: 'Unibet', actor });
  for (const role of roles) {
    await store.upsertRole({
      operatorId, roleId: role.id, label: role.label ?? role.id, permissions: role.permissions,
      delegable: role.delegable ?? true, actor,
    });
  }
  for (const member of members) {
    await store.upsertMembership({
      operatorId, userId: member.userId, roleId: member.roleId, status: member.status ?? 'active', actor,
    });
  }
  return store;
}

function member(sql, userId) {
  return sql.tables.operator_memberships.find(row => row.user_id === userId);
}

function roleRow(sql, roleId) {
  return sql.tables.operator_roles.find(row => row.role_id === roleId);
}

function texts(client) {
  return client.calls.map(call => call.text);
}

test('the last operator admin cannot be demoted, suspended or uninvited', async () => {
  const sql = memorySql();
  const store = await tenant(sql, {
    roles: [
      { id: 'owner', permissions: adminPermissions },
      { id: 'viewer', permissions: viewerPermissions },
    ],
    members: [{ userId: 'admin-1', roleId: 'owner' }, { userId: 'guest', roleId: 'owner', status: 'suspended' }],
  });
  const before = structuredClone(sql.tables);
  await assert.rejects(store.upsertMembership({
    operatorId: 'operator-unibet', userId: 'admin-1', roleId: 'viewer', status: 'active', expectedRevision: 1, actor,
  }), lastAdmin);
  assert.deepEqual(sql.tables, before);
  const denied = sql.clients.at(-1);
  const deniedText = texts(denied);
  assert.equal(deniedText.some(text => text.includes('cas-membership')), false);
  assert.ok(deniedText.some(text => text.trim() === 'ROLLBACK'));
  assert.equal(deniedText.some(text => text.trim() === 'COMMIT'), false);
  assert.equal(denied.released, true);
  const lockAt = deniedText.findIndex(text => text.includes('lock-operator'));
  const readAt = deniedText.findIndex(text => text.includes('guard-memberships'));
  assert.ok(deniedText.findIndex(text => text.trim() === 'BEGIN') < lockAt);
  assert.ok(lockAt < readAt);
  assert.ok(readAt < deniedText.findIndex(text => text.trim() === 'ROLLBACK'));
  assert.match(deniedText.find(text => text.includes('lock-operator')), /FOR UPDATE/);
  assert.match(denied.calls[deniedText.findIndex(text => text.startsWith('SET LOCAL'))].text, /statement_timeout = '5000ms'/);
  assert.match(denied.calls[deniedText.findIndex(text => text.startsWith('SET LOCAL'))].text, /lock_timeout = '3000ms'/);

  await assert.rejects(store.upsertMembership({
    operatorId: 'operator-unibet', userId: 'admin-1', roleId: 'owner', status: 'suspended', expectedRevision: 1, actor,
  }), lastAdmin);
  await assert.rejects(store.upsertMembership({
    operatorId: 'operator-unibet', userId: 'admin-1', roleId: 'owner', status: 'invited', expectedRevision: 1, actor,
  }), lastAdmin);
  assert.equal(member(sql, 'admin-1').status, 'active');
  assert.equal(member(sql, 'admin-1').role_id, 'owner');
  assert.equal(member(sql, 'admin-1').revision, 1);
  sql.tables.operator_memberships.find(row => row.user_id === 'admin-1').revision = '1';
  await assert.rejects(store.upsertMembership({
    operatorId: 'operator-unibet', userId: 'admin-1', roleId: 'viewer', status: 'active', expectedRevision: 1, actor,
  }), lastAdmin);
  assert.equal(member(sql, 'admin-1').role_id, 'owner');
});

test('another active admin, a non-admin company, and a move between admin roles are allowed', async () => {
  const sql = memorySql();
  const store = await tenant(sql, {
    roles: [
      { id: 'owner', permissions: adminPermissions },
      { id: 'chief', permissions: ['team.roles.assign', 'team.read'] },
      { id: 'viewer', permissions: viewerPermissions },
    ],
    members: [
      { userId: 'admin-1', roleId: 'owner' },
      { userId: 'admin-2', roleId: 'chief' },
    ],
  });
  const demoted = await store.upsertMembership({
    operatorId: 'operator-unibet', userId: 'admin-1', roleId: 'viewer', status: 'active', expectedRevision: 1, actor,
  });
  assert.equal(demoted.roleId, 'viewer');
  assert.equal(demoted.revision, 2);
  assert.equal(member(sql, 'admin-2').role_id, 'chief');
  assert.equal(member(sql, 'admin-2').status, 'active');
  const client = sql.clients.at(-1);
  const order = texts(client);
  const at = part => order.findIndex(text => text.includes(part));
  assert.ok(at('BEGIN') < at('SET LOCAL') && at('SET LOCAL') < at('lock-operator'));
  assert.ok(at('lock-operator') < at('guard-memberships') && at('guard-memberships') < at('guard-roles'));
  assert.ok(at('guard-roles') < at('cas-membership') && at('cas-membership') < at('COMMIT'));
  assert.equal(client.released, true);
  assert.equal(sql.clients.filter(item => item.calls.some(call => call.text.includes('cas-membership'))).length, 1);

  const swapped = await store.upsertMembership({
    operatorId: 'operator-unibet', userId: 'admin-2', roleId: 'owner', status: 'active', expectedRevision: 1, actor,
  });
  assert.equal(swapped.roleId, 'owner');
  assert.equal(swapped.status, 'active');

  const empty = memorySql();
  const viewers = await tenant(empty, {
    roles: [{ id: 'viewer', permissions: viewerPermissions }, { id: 'support', permissions: ['players.read'] }],
    members: [{ userId: 'staff-9', roleId: 'viewer' }],
  });
  const edited = await viewers.upsertMembership({
    operatorId: 'operator-unibet', userId: 'staff-9', roleId: 'support', status: 'suspended', expectedRevision: 1, actor,
  });
  assert.equal(edited.roleId, 'support');
  assert.equal(edited.status, 'suspended');
});

test('removing team.roles.assign from the only admin role is rejected and a second admin role is not', async () => {
  const sql = memorySql();
  const store = await tenant(sql, {
    roles: [
      { id: 'owner', permissions: adminPermissions },
      { id: 'chief', permissions: ['team.roles.assign'] },
    ],
    members: [{ userId: 'admin-1', roleId: 'owner' }, { userId: 'admin-2', roleId: 'chief' }],
  });
  const renamed = await store.upsertRole({
    operatorId: 'operator-unibet', roleId: 'owner', label: 'Owner', permissions: ['overview.read', 'team.roles.assign'],
    delegable: false, actor,
  });
  assert.equal(renamed.label, 'Owner');
  assert.deepEqual(renamed.permissions, ['overview.read', 'team.roles.assign']);
  assert.equal(roleRow(sql, 'owner').permissions, '["overview.read","team.roles.assign"]');
  const opened = await store.upsertRole({
    operatorId: 'operator-unibet', roleId: 'chief', label: 'Chief', permissions: viewerPermissions, delegable: true, actor,
  });
  assert.deepEqual(opened.permissions, viewerPermissions);
  const ownerBefore = roleRow(sql, 'owner').permissions;
  await assert.rejects(store.upsertRole({
    operatorId: 'operator-unibet', roleId: 'owner', label: 'Owner', permissions: viewerPermissions, delegable: true, actor,
  }), lastAdmin);
  assert.equal(roleRow(sql, 'owner').permissions, ownerBefore);
  assert.equal(texts(sql.clients.at(-1)).some(text => text.includes('upsert-role')), false);
  assert.ok(texts(sql.clients.at(-1)).includes('ROLLBACK'));
  const created = await store.upsertRole({
    operatorId: 'operator-unibet', roleId: 'night', label: 'Night', permissions: ['reports.read'], delegable: false, actor,
  });
  assert.equal(created.id, 'night');
  assert.equal(roleRow(sql, 'night').permissions, '["reports.read"]');

  const shared = memorySql();
  const sharedStore = await tenant(shared, {
    roles: [{ id: 'owner', permissions: ['team.roles.assign'] }],
    members: [{ userId: 'admin-1', roleId: 'owner' }, { userId: 'admin-2', roleId: 'owner' }],
  });
  const sharedBefore = roleRow(shared, 'owner').permissions;
  await assert.rejects(sharedStore.upsertRole({
    operatorId: 'operator-unibet', roleId: 'owner', label: 'Owner', permissions: viewerPermissions, delegable: true, actor,
  }), lastAdmin);
  assert.equal(roleRow(shared, 'owner').permissions, sharedBefore);
  assert.equal(texts(shared.clients.at(-1)).some(text => text.includes('upsert-role')), false);
});

test('a stale admin revision is still a conflict, and writes without a transaction never skip the guard', async () => {
  const sql = memorySql();
  const store = await tenant(sql, {
    roles: [{ id: 'owner', permissions: ['team.roles.assign'] }, { id: 'viewer', permissions: viewerPermissions }],
    members: [{ userId: 'admin-1', roleId: 'owner' }],
  });
  await assert.rejects(store.upsertMembership({
    operatorId: 'operator-unibet', userId: 'admin-1', roleId: 'viewer', status: 'active', expectedRevision: 4, actor,
  }), refusal('studio_conflict'));
  assert.equal(member(sql, 'admin-1').role_id, 'owner');
  assert.equal(member(sql, 'admin-1').revision, 1);

  const bare = (text, values) => sql(text, values);
  const blocked = await createOperatorStore({ sql: bare, scope: north, now: clock });
  const before = structuredClone(sql.tables);
  const calls = sql.calls.length;
  await assert.rejects(blocked.upsertMembership({
    operatorId: 'operator-unibet', userId: 'admin-1', roleId: 'viewer', status: 'active', expectedRevision: 1, actor,
  }), error => error instanceof StudioStorageError && error.code === 'studio_invalid_configuration' && error.statusCode === 503);
  await assert.rejects(blocked.upsertRole({
    operatorId: 'operator-unibet', roleId: 'night', label: 'Night', permissions: ['reports.read'], delegable: false, actor,
  }), error => error instanceof StudioStorageError && error.code === 'studio_invalid_configuration' && error.statusCode === 503);
  assert.equal(sql.calls.length, calls);
  assert.deepEqual(sql.tables, before);
  const queryOnly = { async query(text, values) { return { rows: await sql(text, values) }; } };
  const wrapped = await createOperatorStore({ sql: queryOnly, scope: north, now: clock });
  assert.equal((await wrapped.listOperators()).length, 1);
  await assert.rejects(wrapped.upsertRole({
    operatorId: 'operator-unibet', roleId: 'owner', label: 'Owner', permissions: viewerPermissions, delegable: true, actor,
  }), error => error instanceof StudioStorageError && error.code === 'studio_invalid_configuration' && error.statusCode === 503);
  assert.equal(roleRow(sql, 'owner').permissions, '["team.roles.assign"]');
  const created = await blocked.upsertMembership({
    operatorId: 'operator-unibet', userId: 'staff-9', roleId: 'viewer', status: 'active', actor,
  });
  assert.equal(created.revision, 1);
});

test('two concurrent admin demotions serialize on the operator lock', async () => {
  const sql = memorySql();
  const store = await tenant(sql, {
    roles: [
      { id: 'owner', permissions: ['team.roles.assign'] },
      { id: 'viewer', permissions: viewerPermissions },
    ],
    members: [{ userId: 'admin-1', roleId: 'owner' }, { userId: 'admin-2', roleId: 'owner' }],
  });
  const mark = sql.trace.length;
  sql.holdUntilWaiters = 1;
  const settled = await Promise.allSettled([
    store.upsertMembership({ operatorId: 'operator-unibet', userId: 'admin-1', roleId: 'viewer', status: 'active', expectedRevision: 1, actor }),
    store.upsertMembership({ operatorId: 'operator-unibet', userId: 'admin-2', roleId: 'viewer', status: 'active', expectedRevision: 1, actor }),
  ]);
  const ok = settled.filter(item => item.status === 'fulfilled');
  const denied = settled.filter(item => item.status === 'rejected');
  assert.equal(ok.length, 1);
  assert.equal(denied.length, 1);
  assert.equal(denied[0].reason.code, 'studio_last_operator_admin');
  assert.equal(denied[0].reason.statusCode, 409);
  const stillAdmin = sql.tables.operator_memberships.filter(row => row.role_id === 'owner' && row.status === 'active');
  assert.equal(stillAdmin.length, 1);
  const race = sql.trace.slice(mark);
  const first = race.find(event => event.event === 'lock-acquired');
  const firstCommit = race.findIndex(event => event.event === 'commit' && event.client === first.client);
  const otherWait = race.findIndex(event => event.event === 'lock-wait' && event.client !== first.client);
  const secondAcquire = race.findIndex(event => event.event === 'lock-acquired' && event.client !== first.client);
  assert.ok(otherWait !== -1 && otherWait < firstCommit);
  assert.ok(secondAcquire > firstCommit);
});
