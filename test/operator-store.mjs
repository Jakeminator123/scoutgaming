import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { allowsPartnerResource } from '../packages/studio-access/server/partner-access-policy.mjs';
import { createOperatorStore } from '../packages/operators/server/operator-store.mjs';
import { withOperatorLifecycle } from '../packages/operators/server/operator-lifecycle.mjs';
import { StudioStorageError, canonicalStudioJson } from '../packages/studio-registry/server/document-contract.mjs';

import { EXTENDED_PRESENTATION_STORAGE_CHECKSUM, validatePresentationBranding } from '../packages/presentation/server/presentation-storage.mjs';
import { nativeRoomMaterialFixture, nativeRoomMaterialChoicesFixture } from './fixtures/native-room-game-material.mjs';
import { readPackagePresentation, withPackagePresentation } from '../packages/presentation/server/presentation-package.mjs';
import { withNativeFilmedPlanningReadiness } from '../packages/presentation/server/native-filmed-readiness-context.mjs';
import { resolveNativeRoomGameMaterial } from '../packages/presentation/server/native-room-game-material.mjs';
import { ROOM_GAME_TIMERS, ROOM_LIMIT_PRESETS } from '../packages/presentation/contracts/room-game-config.mjs';

const north = { environment: 'qa', workspaceId: 'workspace-north' };
const south = { environment: 'qa', workspaceId: 'workspace-south' };
const actor = 'tenant-test';
const partner = { userId: 'staff-1', role: 'partner', status: 'active' };
const refusal = code => error => error instanceof StudioStorageError && error.code === code;
const clock = () => 1_700_000_000_000;

function memorySql() {
  const tables = { operators: [], operator_roles: [], operator_memberships: [], operator_packages: [], operator_audit_events: [],
    documents: [], media_records: [], shared_table_configs: [], shared_table_config_heads: [] };
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
    if (sql.failTag === tag) { sql.failTag = null; throw pgError('XX000'); }
    const [environment, workspace] = values;
    const scoped = name => tables[name].filter(row => row.environment_id === environment && row.workspace_id === workspace);
    const snapshot = () => { if (tx?.inTx && !tx.snapshot) tx.snapshot = structuredClone(tables); };
    if (tag === 'extended-presentation-ready') return copy(sql.extendedStorage ?? []);
    if (tag === 'room-config-lock') { assert.equal(tx?.inTx, true); return []; }
    if (tag === 'room-config-administration') return scoped('documents').filter(row => row.kind === 'administration').map(copy);
    if (tag === 'room-config-media') {
      assert.ok(Array.isArray(values[2]), 'rotation reads the needed media identities in one scoped batch');
      return scoped('media_records').filter(row => values[2].includes(row.id)).map(copy);
    }
    if (tag === 'room-config-current') return tables.shared_table_config_heads.filter(row => row.room_id === values[2]).map(head => ({
      version: head.version, body: copy(tables.shared_table_configs.find(row => row.room_id === head.room_id && row.version === head.version)?.body ?? null),
    }));
    if (tag === 'room-config-insert') {
      assert.equal(tx?.inTx, true);
      if (tables.shared_table_configs.some(row => row.room_id === values[2] && row.version === values[3])) throw pgError('23505');
      snapshot();
      const row = { room_id: values[2], version: values[3], body: JSON.parse(values[4]) };
      tables.shared_table_configs.push(row); return [copy(row)];
    }
    if (tag === 'room-config-head') {
      assert.equal(tx?.inTx, true);
      if (sql.conflictHead) return [];
      const row = tables.shared_table_config_heads.find(row => row.room_id === values[2]);
      if ((row?.version ?? null) !== values[4]) return [];
      snapshot();
      if (row) row.version = values[3];
      else tables.shared_table_config_heads.push({ room_id: values[2], version: values[3] });
      return [{ version: values[3] }];
    }
    if (tag === 'list-operators') return scoped('operators').sort((a, b) => a.slug.localeCompare(b.slug)).map(copy);
    if (tag === 'operator-by-slug') return scoped('operators').filter(row => row.slug === values[2]).map(copy);
    if (tag === 'operator-by-id') return scoped('operators').filter(row => row.operator_id === values[2]).map(copy);
    if (tag === 'list-roles' || tag === 'guard-roles') return scoped('operator_roles').filter(row => row.operator_id === values[2]).sort((a, b) => a.role_id.localeCompare(b.role_id)).map(copy);
    if (tag === 'get-role') return scoped('operator_roles').filter(row => row.operator_id === values[2] && row.role_id === values[3]).map(copy);
    if (tag === 'get-membership') return scoped('operator_memberships').filter(row => row.operator_id === values[2] && row.user_id === values[3]).map(copy);
    if (tag === 'list-memberships' || tag === 'guard-memberships') return scoped('operator_memberships').filter(row => row.operator_id === values[2]).sort((a, b) => a.user_id.localeCompare(b.user_id)).map(copy);
    if (tag === 'current-package') return scoped('operator_packages').filter(row => row.operator_id === values[2]).sort((a, b) => b.package_revision - a.package_revision).slice(0, 1).map(copy);
    if (tag === 'package-by-revision') return scoped('operator_packages').filter(row => row.operator_id === values[2] && row.package_revision === values[3]).map(copy);
    if (tag === 'lock-operator') return scoped('operators').filter(row => row.operator_id === values[2]).map(copy);
    if (tag === 'audit-write') {
      snapshot();
      const row={environment_id:environment,workspace_id:workspace,operator_id:values[2],event_id:values[3],actor_id:values[4],access_class:values[5],action:values[6],resource_type:values[7],resource_id:values[8],before_revision:values[9],after_revision:values[10],occurred_at_ms:values[11],request_id:values[12],changes:values[13]};
      tables.operator_audit_events.push(row); return [copy(row)];
    }
    if (tag === 'list-audit') return scoped('operator_audit_events').filter(row=>row.operator_id===values[2] && (values[3]===null || row.occurred_at_ms<values[3] || row.occurred_at_ms===values[3] && row.event_id<values[4]))
      .sort((a,b)=>b.occurred_at_ms-a.occurred_at_ms || b.event_id.localeCompare(a.event_id)).slice(0,values[5]).map(copy);
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
  await assert.rejects(blocked.upsertMembership({
    operatorId: 'operator-unibet', userId: 'staff-9', roleId: 'viewer', status: 'active', actor,
  }), refusal('studio_invalid_configuration'));
  assert.deepEqual(sql.tables, before);
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


test('all package publishers share the operator lock and CAS prevents lost tables after a concurrent publish', async () => {
  const sql = memorySql(), store = await open(north, sql);
  await seed(store);
  const input = { operatorId: 'operator-unibet', lanes: ['mobile-phone'], games: ['blackjack'], tables: ['room-first'], branding: { name: 'North' }, actor, expectedRevision: null };
  const first = await store.publishPackage(input); assert.equal(first.revision, 1);
  sql.holdUntilWaiters = 1;
  const results = await Promise.allSettled([
    store.publishPackage({ ...input, tables: ['room-first', 'room-new'], expectedRevision: 1 }),
    store.publishPackage({ ...input, branding: { name: 'stale' }, expectedRevision: 1 }),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected' && result.reason.code === 'studio_conflict').length, 1);
  assert.equal(sql.tables.operator_packages.length, 2);
  assert.equal((await store.getCurrentPackage(input.operatorId)).revision, 2);
  assert.equal(sql.trace.filter(row => row.event === 'lock-acquired').length >= 3, true);
  const before = structuredClone(sql.tables.operator_packages);
  await assert.rejects(store.publishPackage({ ...input, expectedRevision: null }), refusal('studio_conflict'));
  assert.deepEqual(sql.tables.operator_packages, before);
});

test('extended immutable packages read safely but publication requires exact optional020 proof',async()=>{
  const sql=memorySql(),store=await open(north,sql);await seed(store);
  const {input}=nativeRoomMaterialFixture({allSpeechSlots:true});
  const branding=input.package.branding,request={operatorId:'operator-unibet',lanes:['mobile-phone'],games:['blackjack'],tables:['room-first'],branding,actor,expectedRevision:null};
  const before=structuredClone(sql.tables);
  await assert.rejects(store.assertExtendedPresentationReady(),refusal('studio_extended_presentation_storage_unavailable'));
  await assert.rejects(store.publishPackage(request),refusal('studio_extended_presentation_storage_unavailable'));
  assert.deepEqual(sql.tables,before);
  sql.extendedStorage=[{checksum:EXTENDED_PRESENTATION_STORAGE_CHECKSUM,structure_checksum:'a'.repeat(64),matching_checks:2}];
  assert.equal(await store.assertExtendedPresentationReady(),true);
  const saved=await store.publishPackage(request);assert.deepEqual(saved.branding,branding);
  sql.extendedStorage=[];
  assert.deepEqual((await store.getCurrentPackage(request.operatorId)).branding,branding,'reader requires no mutable readiness lookup');
  const frozen=structuredClone(sql.tables);
  for(const proof of [{checksum:'f'.repeat(64),structure_checksum:'a'.repeat(64),matching_checks:2},
    {checksum:EXTENDED_PRESENTATION_STORAGE_CHECKSUM,structure_checksum:'bad',matching_checks:2},
    {checksum:EXTENDED_PRESENTATION_STORAGE_CHECKSUM,structure_checksum:'a'.repeat(64),matching_checks:1}]) {
    sql.extendedStorage=[proof];
    await assert.rejects(store.publishPackage({...request,expectedRevision:1}),refusal('studio_extended_presentation_storage_unavailable'));
    assert.deepEqual(sql.tables,frozen);
  }
  const writer=sql.clients.find(client=>client.calls.some(call=>call.text.includes('operator-store:publish-package')));
  assert.ok(writer.calls.some(call=>call.text.includes('operator-store:extended-presentation-ready')),'proof uses publication connection');
  assert.throws(()=>validatePresentationBranding({...branding,name:'x'.repeat(8000)}),refusal('studio_invalid_data'));
  await assert.rejects(store.publishPackage({...request,expectedRevision:1,branding:{name:'x'.repeat(8000)}}),refusal('studio_invalid_data'));
  assert.deepEqual(sql.tables,frozen);
});

let cachedRoomPublicationSource;
async function roomPublicationFixture({ imported = false, twoRooms = false } = {}) {
  if (!cachedRoomPublicationSource) {
    const source = nativeRoomMaterialChoicesFixture({ allSpeechSlots: true });
    cachedRoomPublicationSource = structuredClone({ input: source.input, records: source.records });
  }
  const source = structuredClone(cachedRoomPublicationSource), sql = memorySql(), store = await open(north, sql);
  const room = source.input.room, operatorId = room.operatorId;
  await seed(store, { operatorId, slug: 'fixture' });
  sql.extendedStorage = [{ checksum: EXTENDED_PRESENTATION_STORAGE_CHECKSUM, structure_checksum: 'a'.repeat(64), matching_checks: 2 }];
  const rooms = [room, ...(twoRooms ? [{ ...room, id: 'room-other', name: 'Other room' }] : [])];
  const versions = Object.fromEntries(rooms.map((row, index) => [row.id, `room-config-20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`]));
  const pack = { ...source.input.package, revision: 1, tables: rooms.map(row => row.id), branding: {
    ...source.input.package.branding, roomOverrides: { [room.id]: { color: '#112233' } }, roomGameConfigVersions: versions,
  } };
  const presentation = readPackagePresentation(pack), preset = ROOM_LIMIT_PRESETS.prive;
  const hash = value => createHash('sha256').update(canonicalStudioJson(value)).digest('hex');
  const scoped = { environment_id: north.environment, workspace_id: north.workspaceId };
  sql.tables.documents.push({ ...scoped, kind: 'administration', revision: 'administration-1', value: {
    rooms: structuredClone(rooms), gameLane: room.gameLaneId,
    gameLanes: [{ schemaVersion: 1, id: room.gameLaneId, label: 'Fixture', renderer: 'portrait-video', dealer: 'dragan', mediaCollection: 'dragan-presentation' }],
  } });
  sql.tables.media_records.push(...source.records.map(record => ({ ...scoped, id: record.id, record: structuredClone(record) })));
  sql.tables.operator_packages.push({ ...scoped, operator_id: operatorId, package_revision: 1,
    lanes: canonicalStudioJson(pack.lanes), games: canonicalStudioJson(pack.games), tables: canonicalStudioJson(pack.tables),
    branding: canonicalStudioJson(pack.branding), published_at_ms: clock() });
  for (const currentRoom of rooms) {
    const material = resolveNativeRoomGameMaterial({ package: pack, room: currentRoom, language: 'sv' });
    if (imported) material.revision = 'imported-verified-fixture';
    const body = { configVersion: versions[currentRoom.id], roomId: currentRoom.id, operatorId, packageRevision: 1,
      presentationLaneId: currentRoom.presentationLaneId, presentationHash: hash(presentation), language: 'sv', limitPreset: 'prive',
      ...ROOM_GAME_TIMERS, limits: { min: preset.min, max: preset.max, sideMax: preset.sideMax }, chips: [...preset.chips], refill: preset.refill,
      leadMs: material.leadMs, cardMs: material.cardMs, material };
    sql.tables.shared_table_configs.push({ room_id: currentRoom.id, version: body.configVersion, body });
    sql.tables.shared_table_config_heads.push({ room_id: currentRoom.id, version: body.configVersion });
  }
  const request = extra => ({ actor, operatorId, expectedRevision: 1, lanes: pack.lanes, games: pack.games, tables: pack.tables,
    branding: structuredClone(pack.branding), ...extra });
  const changedRequest = () => request({ branding: { ...pack.branding, roomOverrides: { [room.id]: { color: '#445566' } } } });
  const config = (roomId = room.id) => {
    const version = sql.tables.shared_table_config_heads.find(row => row.room_id === roomId)?.version;
    return sql.tables.shared_table_configs.find(row => row.room_id === roomId && row.version === version)?.body;
  };
  const reframe = mutate => {
    const changed = structuredClone(presentation); mutate(changed);
    return withPackagePresentation(pack.branding, changed, { allowExtended: true });
  };
  return { sql, store, room, rooms, pack, presentation, request, changedRequest, config, reframe, hash };
}

test('N2 room override rotates only that room while active history and the neighbouring room stay unchanged', async () => {
  const h = await roomPublicationFixture({ twoRooms: true });
  const historical = structuredClone(h.sql.tables.shared_table_configs), beforeAudit = h.sql.tables.operator_audit_events.length;
  const branding = { ...h.pack.branding, roomOverrides: { [h.room.id]: { color: '#445566' } } };
  const saved = await h.store.publishPackage(h.request({ branding }));
  assert.equal(saved.revision, 2); assert.equal(saved.branding.roomOverrides[h.room.id].color, '#445566');
  const original = historical[0].body, next = h.config();
  assert.notEqual(next.configVersion, original.configVersion, 'next window receives a distinct frozen config');
  assert.equal(next.configVersion, saved.branding.roomGameConfigVersions[h.room.id]);
  assert.equal(next.packageRevision, saved.revision);
  assert.deepEqual({ ...next, configVersion: original.configVersion, packageRevision: original.packageRevision }, original);
  assert.deepEqual(h.config('room-other'), historical[1].body, 'room A appearance must not invalidate room B');
  assert.equal(saved.branding.roomGameConfigVersions['room-other'], historical[1].version);
  assert.deepEqual(h.sql.tables.shared_table_configs.slice(0, historical.length), historical, 'ongoing windows retain their original immutable bodies');
  assert.equal(h.sql.tables.shared_table_configs.length, 3);
  assert.equal(h.sql.tables.operator_audit_events.length, beforeAudit + 1);
  assert.equal(h.sql.clients.at(-1).released, true);
  const writer = h.sql.clients.at(-1);
  assert.ok(writer.calls.some(row => row.text.includes('room-config-insert')));
  assert.ok(writer.calls.some(row => row.text.includes('publish-package')));
  assert.ok(writer.calls.some(row => row.text.includes('audit-write')));
  assert.equal(writer.calls.at(-1).text, 'COMMIT');

  const secondBranding = { ...saved.branding, roomOverrides: { ...saved.branding.roomOverrides, 'room-other': { color: '#778899' } } };
  const second = await h.store.publishPackage(h.request({ expectedRevision: 2, branding: secondBranding }));
  assert.equal(second.revision, 3); assert.deepEqual(h.config(), next, 'a later B-only edit preserves A');
  assert.equal(h.config('room-other').packageRevision, 3);
  assert.notEqual(h.config('room-other').configVersion, historical[1].version);
  assert.equal(h.sql.tables.shared_table_configs.length, 4);
  const noChange = structuredClone(h.sql.tables.shared_table_configs), heads = structuredClone(h.sql.tables.shared_table_config_heads);
  await h.store.publishPackage(h.request({ expectedRevision: 3, branding: second.branding }));
  assert.deepEqual(h.sql.tables.shared_table_configs, noChange, 'same effective room appearance and N1 need no new configs');
  assert.deepEqual(h.sql.tables.shared_table_config_heads, heads);
});

test('N1 publication recomputes the selected native dealer bank and exact presentation identity for the next config', async t => {
  const provider = t.mock.method(globalThis, 'fetch', () => assert.fail('publication must use scoped registry data, never provider I/O'));
  const h = await roomPublicationFixture(), original = structuredClone(h.config());
  const branding = h.reframe(presentation => { presentation.lanes[0].layers.dealer.default = 'paow'; });
  const saved = await h.store.publishPackage(h.request({ branding })), next = h.config();
  assert.equal(next.material.dealerId, 'paow'); assert.equal(original.material.dealerId, 'dragan');
  assert.notEqual(next.material.revision, original.material.revision);
  assert.deepEqual(next.material, resolveNativeRoomGameMaterial({ package: saved, room: h.room, language: original.language }));
  assert.equal(next.presentationHash, h.hash(readPackagePresentation(saved)));
  assert.notEqual(next.presentationHash, original.presentationHash);
  for (const key of ['language', 'limitPreset', 'betMs', 'actionMs', 'limits', 'chips', 'refill']) assert.deepEqual(next[key], original[key]);
  assert.equal(next.packageRevision, 2); assert.equal(saved.branding.roomGameConfigVersions[h.room.id], next.configVersion);
  assert.deepEqual(h.sql.tables.shared_table_configs[0].body, original);
  assert.equal(provider.mock.callCount(), 0);
});

test('ordinary publication cannot fabricate, replace or remove retained room config bindings', async () => {
  for (const change of ['replace', 'remove', 'add', 'omit-map']) {
    const h = await roomPublicationFixture(), branding = structuredClone(h.pack.branding);
    if (change === 'replace') branding.roomGameConfigVersions[h.room.id] = 'room-config-30000000-0000-4000-8000-000000000001';
    if (change === 'remove') delete branding.roomGameConfigVersions[h.room.id];
    if (change === 'add') branding.roomGameConfigVersions['room-foreign'] = 'room-config-30000000-0000-4000-8000-000000000001';
    if (change === 'omit-map') delete branding.roomGameConfigVersions;
    const before = structuredClone(h.sql.tables);
    await assert.rejects(h.store.publishPackage(h.request({ branding })), error => [403, 409, 422].includes(error.statusCode), change);
    assert.deepEqual(h.sql.tables, before, `${change} cannot publish or mutate config history`);
  }
});

test('removing a room clears only its current package binding and preserves immutable config history', async () => {
  for (const keepInputBinding of [true, false]) {
    const h = await roomPublicationFixture({ twoRooms: true }), original = structuredClone(h.config());
    const administration = h.sql.tables.documents[0].value;
    const branding = withOperatorLifecycle(h.pack.branding, { schemaVersion: 1, operator: null, rooms: [{
      archivedAt: new Date(clock()).toISOString(), room: h.room, gameLane: administration.gameLanes[0], sourcePackageRevision: 1,
    }] });
    if (!keepInputBinding) delete branding.roomGameConfigVersions[h.room.id];
    const saved = await h.store.publishPackage(h.request({ tables: ['room-other'], branding,
      lifecycle: { resourceType: 'room', resourceId: h.room.id, archived: true } }));
    assert.equal(Object.hasOwn(saved.branding.roomGameConfigVersions ?? {}, h.room.id), false);
    assert.equal(saved.branding.roomGameConfigVersions['room-other'], h.config('room-other').configVersion);
    assert.equal(h.config('room-other').packageRevision, 1);
    assert.deepEqual(h.config(), original, 'removal cannot erase or rewrite the active/historical config body');
    assert.equal(h.sql.tables.shared_table_configs.length, 2, 'an unrelated surviving room keeps its existing config');
    assert.deepEqual(JSON.parse(h.sql.tables.operator_packages[0].branding).roomGameConfigVersions, h.pack.branding.roomGameConfigVersions);
  }
});

test('unavailable or foreign room/config/head authority fails before any publication is committed', async () => {
  const changes = [
    h => { h.sql.tables.documents.length = 0; },
    h => { h.sql.tables.documents[0].workspace_id = south.workspaceId; },
    h => { h.sql.tables.documents[0].value.rooms[0].operatorId = 'operator-foreign'; },
    h => { h.sql.tables.documents[0].value.rooms[0].state = 'draft'; },
    h => { h.sql.tables.shared_table_config_heads[0].version = 'room-config-30000000-0000-4000-8000-000000000001'; },
    h => { h.sql.tables.shared_table_configs[0].body.operatorId = 'operator-foreign'; },
    h => { h.sql.tables.shared_table_configs[0].body.roomId = 'room-foreign'; },
    h => { h.sql.tables.shared_table_configs[0].body.packageRevision = 2; },
    h => { h.sql.tables.shared_table_configs[0].body.material.dealerId = 'paow'; },
    h => { h.sql.tables.shared_table_configs[0].body.presentationHash = 'f'.repeat(64); },
  ];
  for (const change of changes) {
    const h = await roomPublicationFixture(); change(h);
    const before = structuredClone(h.sql.tables);
    await assert.rejects(h.store.publishPackage(h.changedRequest()), error => [403, 409, 422, 503].includes(error.statusCode));
    assert.deepEqual(h.sql.tables, before);
    assert.equal(h.sql.clients.at(-1).released, true);
  }
});

test('rotation rechecks current scoped media rather than resurrecting an archived, changed or unapproved frozen source', async () => {
  const changes = [
    h => { h.sql.tables.media_records[0].workspace_id = south.workspaceId; },
    h => { h.sql.tables.media_records[0].record.classification.archived = true; },
    h => { h.sql.tables.media_records[0].record.sha256 = 'f'.repeat(64); },
    h => { h.sql.tables.media_records[0].record.classification.notes = 'Changed after capture'; },
    h => { h.sql.tables.media_records.find(row => row.record.classification.kind === 'speech').record.classification.recordedSpeech.review = { status: 'pending' }; },
  ];
  for (const change of changes) {
    const h = await roomPublicationFixture(); change(h);
    const before = structuredClone(h.sql.tables);
    await assert.rejects(h.store.publishPackage(h.changedRequest()), error => [409, 422, 503].includes(error.statusCode));
    assert.deepEqual(h.sql.tables, before);
  }
});

test('config insertion, head CAS, package and audit failures roll back every part of a room publication', async () => {
  for (const failure of ['room-config-insert', 'room-config-head', 'publish-package', 'audit-write', 'head-conflict']) {
    const h = await roomPublicationFixture(), before = structuredClone(h.sql.tables);
    if (failure === 'head-conflict') h.sql.conflictHead = true;
    else h.sql.failTag = failure;
    await assert.rejects(h.store.publishPackage(h.changedRequest()), error => [409, 503].includes(error.statusCode), failure);
    assert.deepEqual(h.sql.tables, before, `${failure} must keep package, config, head and audit atomic`);
    const client = h.sql.clients.at(-1);
    assert.equal(client.released, true); assert.equal(client.calls.at(-1).text, 'ROLLBACK');
    assert.equal(client.calls.some(row => row.text === 'COMMIT'), false);
  }
});

test('concurrent package CAS creates one new config version and cannot leave the head bound to the loser', async () => {
  const h = await roomPublicationFixture(), original = structuredClone(h.config());
  h.sql.holdUntilWaiters = 1;
  const results = await Promise.allSettled(['#445566', '#778899'].map(color => h.store.publishPackage(h.request({
    branding: { ...h.pack.branding, roomOverrides: { [h.room.id]: { color } } },
  }))));
  const accepted = results.filter(result => result.status === 'fulfilled'), denied = results.filter(result => result.status === 'rejected');
  assert.equal(accepted.length, 1); assert.equal(denied.length, 1); assert.equal(denied[0].reason.code, 'studio_conflict');
  assert.equal(h.sql.tables.operator_packages.length, 2); assert.equal(h.sql.tables.shared_table_configs.length, 2);
  assert.equal(h.config().configVersion, accepted[0].value.branding.roomGameConfigVersions[h.room.id]);
  assert.equal(h.config().packageRevision, accepted[0].value.revision);
  assert.deepEqual(h.sql.tables.shared_table_configs[0].body, original);
});

test('an imported material receipt survives N2 rotation only while its exact presentation and dealer stay the same', async () => {
  const h = await roomPublicationFixture({ imported: true }), original = structuredClone(h.config());
  const saved = await h.store.publishPackage(h.request({ branding: {
    ...h.pack.branding, roomOverrides: { [h.room.id]: { color: '#445566' } },
  } }));
  assert.equal(h.config().packageRevision, saved.revision); assert.notEqual(h.config().configVersion, original.configVersion);
  assert.deepEqual(h.config().material, original.material);
  for (const change of ['dealer', 'presentation']) {
    const denied = await roomPublicationFixture({ imported: true });
    const branding = change === 'dealer'
      ? { ...denied.pack.branding, roomOverrides: { [denied.room.id]: { dealer: 'paow' } } }
      : denied.reframe(presentation => { presentation.lanes[0].openclaw.speak = 'rules'; });
    const before = structuredClone(denied.sql.tables);
    await assert.rejects(denied.store.publishPackage(denied.request({ branding })), error => [409, 422].includes(error.statusCode));
    assert.deepEqual(denied.sql.tables, before, 'generic publication must not invent a new imported-material proof');
  }
});

test('the explicit J08 writer authors its own config version without changing an unrelated retained room', async () => {
  const h = await roomPublicationFixture({ twoRooms: true }), old = structuredClone(h.sql.tables.shared_table_configs);
  const gameConfig = { language: 'sv', limitPreset: 'casual' }, material = structuredClone(h.config().material);
  const result = await h.store.publishRoomGameConfig(h.request(), { roomId: h.room.id, gameConfig, material });
  assert.equal(result.package.revision, 2); assert.deepEqual(result.config, h.config());
  assert.equal(result.config.configVersion, result.package.branding.roomGameConfigVersions[h.room.id]);
  assert.notEqual(result.config.configVersion, old[0].version); assert.equal(result.config.packageRevision, 2);
  assert.equal(result.config.limitPreset, 'casual'); assert.equal(result.config.language, 'sv');
  assert.deepEqual(result.config.limits, { min: 1, max: 500, sideMax: 50 });
  assert.deepEqual(result.config.chips, ROOM_LIMIT_PRESETS.casual.chips); assert.equal(result.config.refill, 500);
  assert.deepEqual(result.config.material, material);
  assert.deepEqual(h.config('room-other'), old[1].body);
  assert.equal(result.package.branding.roomGameConfigVersions['room-other'], old[1].version);
  assert.deepEqual(h.sql.tables.shared_table_configs.slice(0, 2), old);
  const forged = structuredClone(material); forged.media[0].sha256 = 'f'.repeat(64);
  for (const extra of [{ roomId: 'room-foreign' }, { material: forged }]) {
    const denied = await roomPublicationFixture(), before = structuredClone(denied.sql.tables);
    await assert.rejects(denied.store.publishRoomGameConfig(denied.request(), { roomId: denied.room.id, gameConfig, material, ...extra }),
      error => [403, 409, 422].includes(error.statusCode));
    assert.deepEqual(denied.sql.tables, before);
  }
});

test('a first J08 package binding cannot adopt an existing foreign or malformed config head', async () => {
  for(const change of [body=>{body.operatorId='operator-foreign';},body=>{body.roomId='room-foreign';},body=>{body.configVersion='room-config-ffffffff-ffff-4fff-8fff-ffffffffffff';}]) {
    const h=await roomPublicationFixture(),material=structuredClone(h.config().material);
    delete h.pack.branding.roomGameConfigVersions;
    h.sql.tables.operator_packages[0].branding=canonicalStudioJson(h.pack.branding);
    change(h.sql.tables.shared_table_configs[0].body);
    const before=structuredClone(h.sql.tables);
    await assert.rejects(h.store.publishRoomGameConfig(h.request(),{roomId:h.room.id,gameConfig:{language:'sv',limitPreset:'prive'},material}),refusal('studio_conflict'));
    assert.deepEqual(h.sql.tables,before);
  }
});

test('v2 configuration publication requires live readiness and preserves v1 room history through republication',async()=>{
  const h=await roomPublicationFixture({twoRooms:true}),original=structuredClone(h.config()),other=structuredClone(h.config('room-other'));
  const material=resolveNativeRoomGameMaterial({package:h.pack,room:h.room,language:'sv'},{version:2});
  const replacement={roomId:h.room.id,gameConfig:{language:'sv',limitPreset:'prive'},material};
  const before=structuredClone(h.sql.tables);
  await assert.rejects(h.store.publishRoomGameConfig(h.request(),replacement),refusal('studio_presentation_runtime_update_required'));
  assert.deepEqual(h.sql.tables,before);
  const result=await withNativeFilmedPlanningReadiness(true,()=>h.store.publishRoomGameConfig(h.request(),replacement));
  const active=structuredClone(h.config()),pack=result.package;
  assert.deepEqual(active.material,material);assert.match(active.material.revision,/^native-film-v2-/);
  assert.deepEqual(h.config('room-other'),other);
  assert.deepEqual(h.sql.tables.shared_table_configs.find(row=>row.version===original.configVersion).body,original);
  const request=h.request({expectedRevision:pack.revision,branding:{...pack.branding,roomOverrides:{[h.room.id]:{color:'#778899'}}}});
  const saved=structuredClone(h.sql.tables);
  await assert.rejects(h.store.publishPackage(request),refusal('studio_presentation_runtime_update_required'));
  assert.deepEqual(h.sql.tables,saved);
  await withNativeFilmedPlanningReadiness(true,()=>h.store.publishPackage(request));
  assert.deepEqual(h.config().material,material);assert.notEqual(h.config().configVersion,active.configVersion);
  assert.deepEqual(h.config('room-other'),other);
  assert.deepEqual(h.sql.tables.shared_table_configs.find(row=>row.version===active.configVersion).body,active);
});

// The lobby's room picture reads each room's published bet profile: exactly the version the package binds,
// on PostgreSQL (PGlite with the game schema), never another version, room or operator.
test('published bet profiles are read for the versions the package binds, on the real game schema', async t => {
  const { createPglitePool } = await import('./fixtures/pglite-pool.mjs');
  const pool = await createPglitePool(); t.after(() => pool.end());
  const store = await createOperatorStore({ sql: pool, scope: north, now: clock });
  const version = n => `room-config-${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
  const config = async (roomId, n, body) => pool.query('INSERT INTO croupier_game.shared_table_configs(room_id,version,body) VALUES($1,$2,$3)',
    [roomId, version(n), typeof body === 'string' ? body : JSON.stringify({ configVersion: version(n), roomId, operatorId: 'north', language: 'sv', ...body })]);
  await config('room-a', 1, { limitPreset: 'casual' });
  await config('room-a', 2, { limitPreset: 'high' });
  await config('room-b', 3, { limitPreset: 'prive' });
  await config('room-c', 4, { limitPreset: 'high', operatorId: 'south' });
  await config('room-d', 5, '{not json');
  await config('room-e', 6, { limitPreset: 'casual', roomId: 'room-a' });
  const pack = { operatorId: 'north', revision: 3, branding: { roomGameConfigVersions: {
    'room-a': version(2), 'room-b': version(3), 'room-c': version(4), 'room-d': version(5), 'room-e': version(6), 'room-f': version(7) } } };
  assert.deepEqual([...(await store.getPublishedRoomLimitPresets(pack)).entries()].sort(), [['room-a', 'high'], ['room-b', 'prive']]);
  pack.branding.roomGameConfigVersions['room-a'] = version(1);
  assert.equal((await store.getPublishedRoomLimitPresets(pack)).get('room-a'), 'casual', 'the bound version, not the newest row');
  assert.equal((await store.getPublishedRoomLimitPresets({ operatorId: 'north', revision: 1, branding: {} })).size, 0);
});
