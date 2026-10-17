import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioAdminApi } from '../lib/studio-admin-api.mjs';
import { STANDARD_OPERATOR_ROLES, createOperatorAdminApi } from '../lib/operator-admin-api.mjs';
import { createOperatorJournal } from '../lib/operator-journal.mjs';
import { PARTNER_PERMISSIONS } from '../../packages/studio-access/server/partner-access-policy.mjs';
import { operatorMemoryPool, usersDb } from './fixtures/operator-memory-pool.mjs';

const origin = 'https://studio.example';
const scope = { environment: 'isolated-fixture', workspaceId: 'qa' };
const session = { user: 'internal-admin', role: 'admin', scope };
const clock = () => 1_700_000_000_000;

const people = [
  { id: '42', username: 'north-admin', email: 'admin@north.invalid', role: 'partner' },
  { id: '43', username: 'north-second', email: 'second@north.invalid', role: 'partner' },
  { id: '44', username: 'north-viewer', email: 'viewer@north.invalid', role: 'partner' },
  { id: '7', username: 'internal-admin', email: 'staff@studio.invalid', role: 'admin' },
];

function setup({ pool = operatorMemoryPool(), boDb = usersDb(people) } = {}) {
  const logs = [];
  const journal = createOperatorJournal({ now: clock, log: (...line) => logs.push(line) });
  const operatorApi = createOperatorAdminApi({ pool, boDb, scope, now: clock, journal });
  const api = createStudioAdminApi({
    authorize: async () => session,
    mutationTransaction: work => work(),
    allowedOrigins: [origin],
    publicHosts: ['studio.example'],
    handlers: operatorApi.handlers,
  });
  const post = async (action, body, headers = {}) => {
    const response = await api.handle(new Request(`${origin}/studio/api/admin/${action}`, {
      method: 'POST',
      headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }));
    return { status: response.status, body: await response.json() };
  };
  return { pool, boDb, logs, operatorApi, api, post };
}

function journalEntries(logs) {
  return logs.map(([tag, line]) => { assert.equal(tag, '[operator-journal]'); return JSON.parse(line); });
}

async function withAdmin(context, { members = [['42', 'partner-admin']] } = {}) {
  assert.equal((await context.post('operator-create', { slug: 'north-casino', name: 'North Casino' })).status, 200);
  for (const [userId, roleId] of members) {
    assert.equal((await context.post('operator-membership', { operatorId: 'north-casino', userId, roleId, status: 'active' })).status, 200);
  }
}

test('standard roles: only partner-admin can assign roles, and every role can open the portal', () => {
  assert.deepEqual(STANDARD_OPERATOR_ROLES.map(role => [role.id, role.label, role.delegable]), [
    ['partner-admin', 'Partner administrator', false],
    ['partner-editor', 'Partner editor', true],
    ['partner-viewer', 'Partner viewer', true],
  ]);
  assert.deepEqual([...STANDARD_OPERATOR_ROLES[0].permissions], [...PARTNER_PERMISSIONS]);
  assert.deepEqual([...STANDARD_OPERATOR_ROLES[1].permissions], ['overview.read', 'tables.read', 'presentations.read', 'presentations.configure']);
  assert.deepEqual([...STANDARD_OPERATOR_ROLES[2].permissions],
    ['overview.read', 'players.read', 'team.read', 'tables.read', 'presentations.read', 'reports.read', 'integrations.read']);
  for (const role of STANDARD_OPERATOR_ROLES) {
    assert.ok(role.permissions.includes('overview.read'), role.id);
    assert.equal(role.permissions.includes('team.roles.assign'), role.id === 'partner-admin', role.id);
  }
});

test('operator-create stores the operator with the three standard roles and journals each write', async () => {
  const context = setup();
  const created = await context.post('operator-create', { slug: 'north-casino', name: ' North Casino ' });
  assert.equal(created.status, 200);
  assert.deepEqual(created.body.missingRoles, []);
  assert.equal(created.body.operator.id, 'north-casino');
  assert.equal(created.body.operator.name, 'North Casino');
  assert.deepEqual(created.body.operator.roles.map(role => role.id), ['partner-admin', 'partner-editor', 'partner-viewer']);
  assert.deepEqual(created.body.operator.members, []);
  const rows = context.pool.tables.operator_roles;
  assert.equal(rows.length, 3);
  assert.equal(rows.find(row => row.role_id === 'partner-admin').delegable, false);
  assert.deepEqual(JSON.parse(rows.find(row => row.role_id === 'partner-viewer').permissions),
    ['overview.read', 'players.read', 'team.read', 'tables.read', 'presentations.read', 'reports.read', 'integrations.read']);
  const entries = journalEntries(context.logs);
  assert.deepEqual(entries.map(entry => [entry.action, entry.actor, entry.operatorId]), [
    ['operator-create', 'internal-admin', 'north-casino'],
    ['operator-role', 'internal-admin', 'north-casino'],
    ['operator-role', 'internal-admin', 'north-casino'],
    ['operator-role', 'internal-admin', 'north-casino'],
  ]);
  assert.equal(entries[0].at, new Date(clock()).toISOString());
  assert.deepEqual(entries[0].target, { slug: 'north-casino' });
  const directory = await context.operatorApi.listOperatorDirectory();
  assert.deepEqual(directory.map(item => [item.slug, item.missingRoles.length]), [['north-casino', 0]]);
});

test('a duplicate slug is 409 and a reserved or malformed slug is 422 without a write', async () => {
  const context = setup();
  assert.equal((await context.post('operator-create', { slug: 'north-casino', name: 'North' })).status, 200);
  assert.equal((await context.post('operator-create', { slug: 'north-casino', name: 'Other' })).status, 409);
  for (const slug of ['login', 'partner', 'North', 'north_casino', '-north', 'a'.repeat(64)]) {
    assert.equal((await context.post('operator-create', { slug, name: 'North' })).status, 422, slug);
  }
  assert.equal((await context.post('operator-create', { slug: 'south', name: '' })).status, 422);
  assert.equal((await context.post('operator-create', { slug: 'south', name: 'South', status: 'active' })).status, 400);
  assert.equal(context.pool.tables.operators.length, 1);
});

test('membership needs an existing partner account, a known role and a known operator', async () => {
  const context = setup();
  await withAdmin(context, { members: [] });
  const base = { operatorId: 'north-casino', roleId: 'partner-admin', status: 'active' };
  assert.equal((await context.post('operator-membership', { ...base, userId: '999' })).status, 422);
  assert.equal((await context.post('operator-membership', { ...base, username: 'nobody' })).status, 422);
  assert.equal((await context.post('operator-membership', { ...base, userId: '7' })).status, 422, 'internal admin is not a partner account');
  assert.equal((await context.post('operator-membership', { ...base, roleId: 'owner', userId: '42' })).status, 422);
  assert.equal((await context.post('operator-membership', { ...base, operatorId: 'south', userId: '42' })).status, 404);
  assert.equal((await context.post('operator-membership', { ...base, status: 'invited', userId: '42' })).status, 422);
  assert.equal((await context.post('operator-membership', { ...base, userId: '42', username: 'north-admin' })).status, 400);
  assert.equal(context.pool.tables.operator_memberships.length, 0);
  const added = await context.post('operator-membership', { ...base, username: 'North-Admin' });
  assert.equal(added.status, 200);
  assert.deepEqual(added.body.membership, { userId: '42', username: 'north-admin', roleId: 'partner-admin', status: 'active', revision: 1 });
  assert.deepEqual(added.body.operator.members, [{ userId: '42', username: 'north-admin', roleId: 'partner-admin', status: 'active', revision: 1 }]);
  assert.equal((await context.post('operator-membership', { ...base, userId: '42' })).status, 409, 'insert never overwrites');
  const last = journalEntries(context.logs).at(-1);
  assert.deepEqual(last.target, { userId: '42', roleId: 'partner-admin', status: 'active', revision: 1 });
  assert.doesNotMatch(context.logs.map(line => line.join(' ')).join('\n'), /@north\.invalid/);
});

test('the store refuses to suspend or demote the last active partner-admin inside its operator lock', async () => {
  const context = setup();
  await withAdmin(context);
  const change = { operatorId: 'north-casino', userId: '42', expectedRevision: 1 };
  const start = context.pool.trace.length;
  const suspended = await context.post('operator-membership', { ...change, roleId: 'partner-admin', status: 'suspended' });
  assert.equal(suspended.status, 409);
  const steps = context.pool.trace.slice(start).filter(step => step.client !== 0).map(step => step.step);
  assert.deepEqual(steps, ['BEGIN', 'lock-operator', 'guard-memberships', 'guard-roles', 'ROLLBACK']);
  const demoted = await context.post('operator-membership', { ...change, roleId: 'partner-viewer', status: 'active' });
  assert.equal(demoted.status, 409);
  assert.deepEqual(context.pool.tables.operator_memberships.map(row => [row.user_id, row.role_id, row.status, row.revision]),
    [['42', 'partner-admin', 'active', 1]]);
  assert.equal((await context.post('operator-role', { operatorId: 'north-casino', roleId: 'partner-admin', permissions: ['overview.read'] })).status, 422);

  assert.equal((await context.post('operator-membership', { operatorId: 'north-casino', userId: '43', roleId: 'partner-admin', status: 'active' })).status, 200);
  const allowed = await context.post('operator-membership', { ...change, roleId: 'partner-admin', status: 'suspended' });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.membership.revision, 2);
  assert.equal((await context.post('operator-membership', { operatorId: 'north-casino', userId: '43', roleId: 'partner-viewer', status: 'active', expectedRevision: 1 })).status, 409);
});

test('a stale expectedRevision is a 409 conflict and leaves the membership unchanged', async () => {
  const context = setup();
  await withAdmin(context, { members: [['42', 'partner-admin'], ['44', 'partner-viewer']] });
  const update = { operatorId: 'north-casino', userId: '44', roleId: 'partner-editor', status: 'active' };
  assert.equal((await context.post('operator-membership', { ...update, expectedRevision: 1 })).status, 200);
  const stale = await context.post('operator-membership', { ...update, roleId: 'partner-viewer', expectedRevision: 1 });
  assert.equal(stale.status, 409);
  assert.deepEqual(context.pool.trace.filter(step => step.client !== 0).slice(-2).map(step => step.step), ['cas-membership', 'ROLLBACK']);
  const row = context.pool.tables.operator_memberships.find(item => item.user_id === '44');
  assert.deepEqual([row.role_id, row.revision], ['partner-editor', 2]);
  assert.equal((await context.post('operator-membership', { ...update, expectedRevision: 0 })).status, 400);
});

test('operator-role accepts known permissions on the three standard roles only', async () => {
  const context = setup();
  await withAdmin(context);
  const role = body => context.post('operator-role', { operatorId: 'north-casino', ...body });
  assert.equal((await role({ roleId: 'partner-viewer', permissions: ['overview.read', 'players.write'] })).status, 422);
  assert.equal((await role({ roleId: 'partner-viewer', permissions: ['overview.read', 'overview.read'] })).status, 422);
  assert.equal((await role({ roleId: 'partner-editor', permissions: ['overview.read', 'team.roles.assign'] })).status, 422);
  assert.equal((await role({ roleId: 'partner-admin', permissions: [] })).status, 422);
  assert.equal((await role({ roleId: 'partner-owner', permissions: ['overview.read'] })).status, 422);
  assert.equal((await role({ roleId: 'partner-viewer', permissions: ['overview.read'], label: 'Viewer' })).status, 400);
  assert.equal((await context.post('operator-role', { operatorId: 'south', roleId: 'partner-viewer', permissions: ['overview.read'] })).status, 404);
  const saved = await role({ roleId: 'partner-viewer', permissions: ['team.read', 'overview.read'] });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.role, { id: 'partner-viewer', label: 'Partner viewer', permissions: ['overview.read', 'team.read'], delegable: true });
  assert.deepEqual(journalEntries(context.logs).at(-1).target, { roleId: 'partner-viewer', permissions: ['overview.read', 'team.read'] });
});

test('a missing standard role can be added later through operator-role', async () => {
  const context = setup();
  assert.equal((await context.post('operator-create', { slug: 'north-casino', name: 'North Casino' })).status, 200);
  context.pool.tables.operator_roles.splice(context.pool.tables.operator_roles.findIndex(row => row.role_id === 'partner-editor'), 1);
  assert.deepEqual((await context.operatorApi.listOperatorDirectory())[0].missingRoles, ['partner-editor']);
  const editor = STANDARD_OPERATOR_ROLES.find(item => item.id === 'partner-editor');
  const added = await context.post('operator-role', { operatorId: 'north-casino', roleId: 'partner-editor', permissions: [...editor.permissions] });
  assert.equal(added.status, 200);
  assert.deepEqual(added.body.operator.missingRoles, []);
  assert.equal(context.pool.tables.operator_roles.find(row => row.role_id === 'partner-editor').label, 'Partner editor');
});

test('writes keep the admin Origin gate and refuse a query-only pool', async () => {
  const context = setup();
  const noOrigin = await context.api.handle(new Request(`${origin}/studio/api/admin/operator-create`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
    body: JSON.stringify({ slug: 'north-casino', name: 'North' }),
  }));
  assert.equal(noOrigin.status, 403);
  const crossSite = await context.post('operator-membership', { operatorId: 'north-casino', userId: '42', roleId: 'partner-admin', status: 'active' }, { 'sec-fetch-site': 'cross-site' });
  assert.equal(crossSite.status, 403);
  assert.equal(context.pool.tables.operators.length, 0);
  assert.equal(context.logs.length, 0);
  const queryOnly = setup({ pool: { query: operatorMemoryPool().query } });
  assert.equal((await queryOnly.post('operator-create', { slug: 'north-casino', name: 'North' })).status, 503);
  assert.equal((await queryOnly.post('operator-membership', { operatorId: 'north-casino', userId: '42', roleId: 'partner-admin', status: 'active' })).status, 503);
  assert.equal((await queryOnly.post('operator-role', { operatorId: 'north-casino', roleId: 'partner-viewer', permissions: ['overview.read'] })).status, 503);
  await assert.rejects(queryOnly.operatorApi.listOperatorDirectory(), error => error.statusCode === 503);
});

test('the directory shows usernames when the users table answers and ids when it does not', async () => {
  const context = setup();
  await withAdmin(context, { members: [['42', 'partner-admin'], ['44', 'partner-viewer']] });
  const [north] = await context.operatorApi.listOperatorDirectory();
  assert.deepEqual(north.members.map(member => [member.userId, member.username, member.roleId]),
    [['42', 'north-admin', 'partner-admin'], ['44', 'north-viewer', 'partner-viewer']]);
  const failing = createOperatorAdminApi({ pool: context.pool, boDb: { prepare() { return { all: async () => { throw new Error('down'); } }; } }, scope, now: clock });
  const [blind] = await failing.listOperatorDirectory();
  assert.deepEqual(blind.members.map(member => [member.userId, member.username]), [['42', null], ['44', null]]);
});

test('email invitation creates an invited partner or links an existing one, and the sixth in an hour is 429', async () => {
  const copy = people.map(user => ({ ...user }));
  const pool = operatorMemoryPool();
  const boDb = usersDb(copy);
  const sent = [];
  const logs = [];
  const journal = createOperatorJournal({ now: clock, log: (...line) => logs.push(line) });
  const operatorApi = createOperatorAdminApi({
    pool, boDb, scope, now: clock, journal, publicOrigin: origin,
    mail: { async send(message) { sent.push(message); return { sent: true }; } },
  });
  const api = createStudioAdminApi({
    authorize: async () => session,
    mutationTransaction: work => work(),
    allowedOrigins: [origin],
    publicHosts: ['studio.example'],
    handlers: operatorApi.handlers,
  });
  const post = async (action, body) => {
    const response = await api.handle(new Request(`${origin}/studio/api/admin/${action}`, {
      method: 'POST',
      headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }));
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await post('operator-create', { slug: 'north-casino', name: 'North Casino' })).status, 200);
  const created = await post('operator-membership', {
    operatorId: 'north-casino', roleId: 'partner-viewer', email: 'New.Person@partner.invalid', status: 'invited',
  });
  assert.equal(created.status, 200);
  assert.equal(created.body.invited, true);
  assert.equal(created.body.ok, true);
  const account = copy.find(user => user.email === 'new.person@partner.invalid');
  assert.equal(account.role, 'partner');
  assert.equal(account.hash, null);
  const member = created.body.operator.members.find(item => item.userId === account.id);
  assert.equal(member.status, 'invited');
  assert.equal(member.username, null);
  assert.equal(JSON.stringify(created.body).includes('new.person@partner.invalid'), false);
  assert.equal(sent.length, 1);
  const link = new URL(sent[0].link);
  assert.equal(link.pathname, '/partner/set-password');
  assert.equal(link.searchParams.has('password'), false);
  assert.match(sent[0].text, /North Casino/);
  assert.match(sent[0].text, /Partner viewer/);
  const linked = await post('operator-membership', {
    operatorId: 'north-casino', roleId: 'partner-editor', email: 'admin@north.invalid', status: 'invited',
  });
  assert.equal(linked.status, 200);
  assert.equal(linked.body.invited, true);
  assert.equal(copy.length, people.length + 1);
  assert.equal(sent.length, 1);
  assert.equal(linked.body.operator.members.find(item => item.userId === '42').status, 'active');
  const inviteLog = journalEntries(logs).find(entry => entry.action === 'operator-membership');
  assert.deepEqual(inviteLog.target, { email: 'n***@partner.invalid' });
  assert.equal(logs.flat().join(' ').includes('new.person@partner.invalid'), false);
  for (let index = 2; index <= 4; index += 1) {
    const extra = await post('operator-membership', {
      operatorId: 'north-casino', roleId: 'partner-viewer', email: `more-${index}@partner.invalid`, status: 'invited',
    });
    assert.equal(extra.status, 200, String(index));
    assert.equal(extra.body.invited, true);
  }
  const blocked = await post('operator-membership', {
    operatorId: 'north-casino', roleId: 'partner-viewer', email: 'more-5@partner.invalid', status: 'invited',
  });
  assert.equal(blocked.status, 429);
  assert.equal(copy.some(user => user.email === 'more-5@partner.invalid'), false);
  assert.equal(pool.tables.operator_memberships.filter(row => row.status === 'invited').length, 4);
});
