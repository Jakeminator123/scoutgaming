import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { handlePartnerAuth } from '../lib/partner-session.mjs';
import { createOperatorJournal } from '../lib/operator-journal.mjs';
import { STANDARD_OPERATOR_ROLES } from '../lib/operator-admin-api.mjs';
import { PARTNER_PERMISSIONS } from '../../web/partner-access-policy.mjs';
import { createOperatorStore } from '../../web/storage/operator-store.mjs';
import { operatorMemoryPool, usersDb } from './fixtures/operator-memory-pool.mjs';

const origin = 'https://public.example.invalid';
const host = 'public.example.invalid';
const scope = { environment: 'fixture', workspaceId: 'croupier' };
const now = 1_700_000_000_000;
const secret = 'correct-horse';

function credential(plain) {
  const salt = randomBytes(16).toString('hex');
  return { salt, hash: scryptSync(plain, salt, 64).toString('hex') };
}
const users = [
  { id: '42', username: 'north-admin', email: 'admin@north.invalid', role: 'partner' },
  { id: '43', username: 'north-viewer', email: 'viewer@north.invalid', role: 'partner' },
  { id: '44', username: 'north-editor', email: 'editor@north.invalid', role: 'partner' },
  { id: '45', username: 'outside-partner', email: 'outside@partner.invalid', role: 'partner' },
  { id: '46', username: 'north-second-admin', email: 'second@north.invalid', role: 'partner' },
  { id: '7', username: 'internal-admin', email: 'admin@studio.invalid', role: 'admin' },
].map(user => ({ ...user, ...credential(secret) }));

const accountQueries = new Set([
  'SELECT id,username,role FROM users WHERE id=?',
  'SELECT id,username,role FROM users WHERE lower(username)=?',
  'SELECT id,username,role FROM users WHERE lower(email)=?',
]);
// Login and session reads from partner-session.mjs, plus the account lookups
// from operator-accounts.mjs through the shared fixture.
function authDb() {
  const accounts = usersDb(users);
  const sessions = [];
  const byLogin = key => users.filter(user => user.username.toLowerCase() === key || user.email.toLowerCase() === key);
  return {
    accounts,
    async transaction(work) { return work(); },
    prepare(sql) {
      if (accountQueries.has(sql) || sql.startsWith('SELECT id,username FROM users WHERE id IN (')
        || sql.startsWith('INSERT INTO users') || sql.startsWith('DELETE FROM tokens') || sql.startsWith('INSERT INTO tokens')) return accounts.prepare(sql);
      const rows = args => {
        if (sql.includes('FROM lab_sessions')) return sessions.filter(session => session.token_digest === args[0] && session.expires > args[1]);
        if (sql.includes('lower(username)=? OR lower(email)=?')) return byLogin(String(args[0]).toLowerCase());
        if (sql.includes('u.id=?')) return users.filter(user => user.id === String(args[0])).map(user => ({ ...user, epoch: 0 }));
        if (sql.startsWith('SELECT epoch FROM bo_auth_epochs')) return [];
        throw new Error(`unexpected auth query: ${sql}`);
      };
      return {
        async all(...args) { return rows(args).map(row => ({ ...row })); },
        async get(...args) { return rows(args).map(row => ({ ...row }))[0]; },
        async run(...args) {
          if (!sql.startsWith('INSERT INTO lab_sessions')) throw new Error(`unexpected auth write: ${sql}`);
          sessions.push({ token_digest: args[0], craig_user_id: args[1], role: args[2], source_stamp: args[3], auth_epoch: args[4], expires: args[5] });
          return { changes: 1 };
        },
      };
    },
  };
}
const gameDb = { prepare: () => ({ all: async () => [], get: async () => undefined, run: async () => ({ changes: 0 }) }) };

async function fixture({ memberships = [['42', 'partner-admin'], ['43', 'partner-viewer'], ['44', 'partner-editor'], ['46', 'partner-admin']] } = {}) {
  const pool = operatorMemoryPool();
  const store = await createOperatorStore({ sql: pool, scope, now: () => now });
  await store.createOperator({ actor: 'fixture', operatorId: 'north', slug: 'north', name: 'North' });
  for (const role of STANDARD_OPERATOR_ROLES) {
    await store.upsertRole({ actor: 'fixture', operatorId: 'north', roleId: role.id, label: role.label, permissions: [...role.permissions], delegable: role.delegable });
  }
  for (const [userId, roleId] of memberships) await store.upsertMembership({ actor: 'fixture', operatorId: 'north', userId, roleId, status: 'active' });
  const logs = [];
  const boDb = authDb();
  const config = {
    boDb, gameDb, scope, now: () => now, pool,
    allowedOrigins: [origin, 'https://studio.example.invalid'],
    publicHosts: [host, 'studio.example.invalid'],
    apiBase: '/studio/api/admin',
    authBase: '/studio/api/auth',
    rateLimit: async () => true,
    clientAddress: async () => '203.0.113.10',
    journal: createOperatorJournal({ now: () => now, log: (...line) => logs.push(line) }),
  };
  pool.trace.length = 0;
  return { pool, store, boDb, config, logs };
}
async function cookieFor(config, user) {
  const response = await handlePartnerAuth(new Request(`${origin}/studio/api/partner/login`, {
    method: 'POST',
    headers: { host, origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
    body: JSON.stringify({ user, pass: secret }),
  }), config);
  assert.equal(response.status, 200);
  const token = /^partner_session=([a-f0-9]{64});/.exec(response.headers.getSetCookie().find(value => value.startsWith('partner_session=')) || '')?.[1];
  assert.ok(token);
  return `partner_session=${token}`;
}
const teamUrl = (slug = 'north') => `${origin}/studio/api/partner/team?operator=${slug}`;
function read(cookie, url = teamUrl()) {
  return new Request(url, { headers: { host, ...(cookie ? { cookie } : {}) } });
}
function write(cookie, body, { url = teamUrl(), headers = {} } = {}) {
  const all = { host, origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', cookie, ...headers };
  for (const [key, value] of Object.entries(all)) if (value === null) delete all[key];
  return new Request(url, { method: 'POST', headers: all, body: JSON.stringify(body) });
}
const writes = pool => pool.trace.filter(entry => ['create-membership', 'cas-membership'].includes(entry.step));
const memberRow = (pool, userId, operatorId = 'north') => pool.tables.operator_memberships.find(row => row.operator_id === operatorId && row.user_id === userId);
function journalEntries(logs) {
  return logs.map(([tag, line]) => { assert.equal(tag, '[operator-journal]'); return JSON.parse(line); });
}

describe('partner team API', { concurrency: 1 }, () => {
  test('team requires partner_session, keeps the Origin gate and refuses a query-only pool', async () => {
    const { config, pool, logs } = await fixture();
    const missing = await handlePartnerAuth(read(), config);
    assert.equal(missing.status, 401);
    assert.equal(missing.headers.get('cache-control'), 'private, no-store');
    const cookie = await cookieFor(config, 'north-admin');
    const invite = { action: 'invite', email: 'outside@partner.invalid', roleId: 'partner-viewer' };
    for (const headers of [{ origin: null }, { origin: 'https://evil.example.invalid' }, { 'sec-fetch-site': 'cross-site' }]) {
      const denied = await handlePartnerAuth(write(cookie, invite, { headers }), config);
      assert.equal(denied.status, 403);
    }
    assert.equal((await handlePartnerAuth(write(cookie, invite, { url: `${origin}/studio/api/partner/team` }), config)).status, 400);
    assert.equal((await handlePartnerAuth(read(cookie, `${teamUrl()}&extra=1`), config)).status, 400);
    assert.equal((await handlePartnerAuth(new Request(teamUrl(), { method: 'PUT', headers: { host, origin, cookie } }), config)).status, 405);
    assert.deepEqual(writes(pool), []);
    assert.equal(memberRow(pool, '45'), undefined);
    assert.deepEqual(logs, []);
    let queries = 0;
    const queryOnly = { async query() { queries += 1; return { rows: [] }; } };
    for (const request of [read(cookie), write(cookie, invite)]) {
      const unavailable = await handlePartnerAuth(request, { ...config, pool: queryOnly });
      assert.equal(unavailable.status, 503);
    }
    assert.equal(queries, 0);
  });

  test('a partner without team.roles.assign reads the team (200) but every write is 403', async () => {
    const { config, pool, logs } = await fixture();
    const cookie = await cookieFor(config, 'north-viewer');
    const listed = await handlePartnerAuth(read(cookie), config);
    assert.equal(listed.status, 200);
    assert.equal(listed.headers.get('cache-control'), 'private, no-store');
    assert.equal(listed.headers.get('vary'), 'Cookie');
    const body = await listed.json();
    assert.equal(body.operatorId, 'north');
    assert.deepEqual(body.viewer, { userId: '43' });
    assert.deepEqual(body.can, { invite: false, role: false, suspend: false });
    assert.deepEqual(body.inviteRoles, []);
    assert.deepEqual(body.roles.map(role => role.id), ['partner-admin', 'partner-editor', 'partner-viewer']);
    assert.deepEqual(body.members.map(member => [member.userId, member.username, member.roleId, member.status, member.revision]), [
      ['42', 'north-admin', 'partner-admin', 'active', 1],
      ['43', 'north-viewer', 'partner-viewer', 'active', 1],
      ['44', 'north-editor', 'partner-editor', 'active', 1],
      ['46', 'north-second-admin', 'partner-admin', 'active', 1],
    ]);
    for (const member of body.members) assert.deepEqual(member.allowed, { role: [], suspend: false, reactivate: false });
    assert.equal(JSON.stringify(body).includes('@'), false);
    for (const attempt of [
      { action: 'invite', email: 'outside@partner.invalid', roleId: 'partner-viewer' },
      { action: 'role', userId: '44', roleId: 'partner-viewer', expectedRevision: 1 },
      { action: 'suspend', userId: '44', expectedRevision: 1 },
      { action: 'reactivate', userId: '44', expectedRevision: 1 },
    ]) {
      const denied = await handlePartnerAuth(write(cookie, attempt), config);
      assert.equal(denied.status, 403, attempt.action);
      assert.deepEqual(await denied.json(), { error: 'Access denied' });
    }
    assert.deepEqual(writes(pool), []);
    assert.deepEqual(logs, []);
    // partner-editor has no team.read: it cannot list the team either.
    const editor = await cookieFor(config, 'north-editor');
    assert.equal((await handlePartnerAuth(read(editor), config)).status, 403);
  });

  test('an administrator sees per-member actions; admins and the viewer themselves are protected', async () => {
    const { config } = await fixture();
    const cookie = await cookieFor(config, 'north-admin');
    const body = await (await handlePartnerAuth(read(cookie), config)).json();
    assert.deepEqual(body.can, { invite: true, role: true, suspend: true });
    assert.deepEqual(body.inviteRoles, ['partner-editor', 'partner-viewer']);
    const allowed = Object.fromEntries(body.members.map(member => [member.userId, member.allowed]));
    assert.deepEqual(allowed, {
      42: { role: [], suspend: false, reactivate: false },
      43: { role: ['partner-editor'], suspend: true, reactivate: false },
      44: { role: ['partner-viewer'], suspend: true, reactivate: false },
      46: { role: [], suspend: false, reactivate: false },
    });
  });

  test('invite links an existing partner account by e-mail; a repeat is 409 member and unknown accounts are 422', async () => {
    const { config, pool, logs, boDb } = await fixture();
    const cookie = await cookieFor(config, 'north-admin');
    const invited = await handlePartnerAuth(write(cookie, { action: 'invite', email: 'Outside@Partner.invalid', roleId: 'partner-viewer' }), config);
    assert.equal(invited.status, 200);
    const body = await invited.json();
    assert.deepEqual(body, { invited: true });
    const listed = await (await handlePartnerAuth(read(cookie), config)).json();
    assert.deepEqual(listed.members.find(member => member.userId === '45'), {
      userId: '45', username: 'outside-partner', roleId: 'partner-viewer', roleLabel: 'Partner viewer', status: 'active', revision: 1,
      allowed: { role: ['partner-editor'], suspend: true, reactivate: false },
    });
    assert.ok(boDb.accounts.queries.includes('SELECT id,username,role FROM users WHERE lower(email)=?'));
    const repeat = await handlePartnerAuth(write(cookie, { action: 'invite', email: 'outside@partner.invalid', roleId: 'partner-editor' }), config);
    assert.equal(repeat.status, 409);
    assert.deepEqual(await repeat.json(), { error: 'Conflict', reason: 'member' });
    assert.equal(memberRow(pool, '45').role_id, 'partner-viewer');
    for (const email of ['admin@studio.invalid', 'not-an-email', 42]) {
      const rejected = await handlePartnerAuth(write(cookie, { action: 'invite', email, roleId: 'partner-viewer' }), config);
      assert.equal(rejected.status, 422, String(email));
    }
    assert.equal(memberRow(pool, '7'), undefined);
    const unknownRole = await handlePartnerAuth(write(cookie, { action: 'invite', email: 'outside@partner.invalid', roleId: 'partner-owner' }), config);
    assert.equal(unknownRole.status, 422);
    // partner-admin is not delegable, and nobody re-invites themselves.
    for (const attempt of [
      { action: 'invite', email: 'viewer@north.invalid', roleId: 'partner-admin' },
      { action: 'invite', email: 'admin@north.invalid', roleId: 'partner-viewer' },
    ]) assert.equal((await handlePartnerAuth(write(cookie, attempt), config)).status, 403);
    for (const attempt of [
      { action: 'invite', userId: '45', roleId: 'partner-viewer' },
      { action: 'invite', email: 'outside@partner.invalid', roleId: 'partner-viewer', status: 'active' },
      { action: 'promote', userId: '45' },
    ]) assert.equal((await handlePartnerAuth(write(cookie, attempt), config)).status, 400);
    const entries = journalEntries(logs);
    assert.deepEqual(entries, [{
      at: new Date(now).toISOString(), actor: 'north-admin', action: 'team.invite', operatorId: 'north',
      target: { email: 'o***@partner.invalid' },
    }]);
    assert.equal(logs.flat().join(' ').includes('outside@partner.invalid'), false);
  });

  test('role change, suspension and reactivation use the membership revision; a stale revision is 409', async () => {
    const { config, pool, logs } = await fixture();
    const cookie = await cookieFor(config, 'north-admin');
    const changed = await handlePartnerAuth(write(cookie, { action: 'role', userId: '43', roleId: 'partner-editor', expectedRevision: 1 }), config);
    assert.equal(changed.status, 200);
    assert.deepEqual((await changed.json()).changed, { userId: '43', roleId: 'partner-editor', status: 'active', revision: 2 });
    const stale = await handlePartnerAuth(write(cookie, { action: 'role', userId: '43', roleId: 'partner-viewer', expectedRevision: 1 }), config);
    assert.equal(stale.status, 409);
    assert.deepEqual(await stale.json(), { error: 'Conflict', reason: 'revision' });
    assert.deepEqual(pool.trace.slice(-2).map(entry => entry.step), ['cas-membership', 'ROLLBACK']);
    assert.equal(memberRow(pool, '43').role_id, 'partner-editor');
    const suspended = await handlePartnerAuth(write(cookie, { action: 'suspend', userId: '43', expectedRevision: 2 }), config);
    assert.equal(suspended.status, 200);
    const afterSuspend = await suspended.json();
    assert.deepEqual(afterSuspend.changed, { userId: '43', roleId: 'partner-editor', status: 'suspended', revision: 3 });
    assert.deepEqual(afterSuspend.members.find(member => member.userId === '43').allowed, { role: [], suspend: false, reactivate: true });
    // A suspended member is reactivated first; role and repeated suspension are refused.
    assert.equal((await handlePartnerAuth(write(cookie, { action: 'role', userId: '43', roleId: 'partner-viewer', expectedRevision: 3 }), config)).status, 403);
    assert.equal((await handlePartnerAuth(write(cookie, { action: 'suspend', userId: '43', expectedRevision: 3 }), config)).status, 403);
    const reactivated = await handlePartnerAuth(write(cookie, { action: 'reactivate', userId: '43', expectedRevision: 3 }), config);
    assert.equal(reactivated.status, 200);
    assert.deepEqual((await reactivated.json()).changed, { userId: '43', roleId: 'partner-editor', status: 'active', revision: 4 });
    for (const attempt of [
      { action: 'suspend', userId: '46', expectedRevision: 1 },
      { action: 'role', userId: '46', roleId: 'partner-viewer', expectedRevision: 1 },
      { action: 'role', userId: '43', roleId: 'partner-admin', expectedRevision: 4 },
      { action: 'suspend', userId: '42', expectedRevision: 1 },
    ]) assert.equal((await handlePartnerAuth(write(cookie, attempt), config)).status, 403, JSON.stringify(attempt));
    assert.equal((await handlePartnerAuth(write(cookie, { action: 'suspend', userId: '99', expectedRevision: 1 }), config)).status, 404);
    assert.equal((await handlePartnerAuth(write(cookie, { action: 'role', userId: '43', roleId: 'partner-owner', expectedRevision: 4 }), config)).status, 422);
    for (const expectedRevision of [0, '4', 1.5, null]) {
      assert.equal((await handlePartnerAuth(write(cookie, { action: 'suspend', userId: '43', expectedRevision }), config)).status, 400);
    }
    assert.equal(memberRow(pool, '46').status, 'active');
    assert.deepEqual(journalEntries(logs).map(entry => [entry.action, entry.actor, entry.operatorId, entry.target.status, entry.target.revision]), [
      ['team.role', 'north-admin', 'north', 'active', 2],
      ['team.suspend', 'north-admin', 'north', 'suspended', 3],
      ['team.reactivate', 'north-admin', 'north', 'active', 4],
    ]);
  });

  test('a concurrently suspended actor is rejected after the operator lock; the store still protects the last administrator', async () => {
    const { config, pool, store, logs } = await fixture({ memberships: [] });
    // Only a custom, delegable administrator role can reach the guard through this path.
    await store.upsertRole({ actor: 'fixture', operatorId: 'north', roleId: 'co-admin', label: 'Co-admin', permissions: [...PARTNER_PERMISSIONS], delegable: true });
    await store.upsertMembership({ actor: 'fixture', operatorId: 'north', userId: '42', roleId: 'co-admin', status: 'active' });
    await store.upsertMembership({ actor: 'fixture', operatorId: 'north', userId: '46', roleId: 'co-admin', status: 'active' });
    const cookie = await cookieFor(config, 'north-admin');
    pool.before('lock-operator', tables => {
      const actor = tables.operator_memberships.find(row => row.operator_id === 'north' && row.user_id === '42');
      actor.status = 'suspended';
      actor.revision += 1;
    });
    pool.trace.length = 0;
    const refused = await handlePartnerAuth(write(cookie, { action: 'suspend', userId: '46', expectedRevision: 1 }), config);
    assert.equal(refused.status, 403);
    assert.deepEqual(await refused.json(), { error: 'Access denied' });
    const steps = pool.trace.filter(entry => entry.client !== 0).map(entry => entry.step);
    assert.ok(steps.indexOf('scope-lock') < steps.indexOf('lock-operator'));
    assert.ok(steps.indexOf('lock-operator') < steps.indexOf('get-membership'));
    assert.equal(steps.includes('cas-membership'), false);
    assert.equal(steps.at(-1), 'ROLLBACK');
    assert.equal(memberRow(pool, '46').status, 'active');
    assert.deepEqual(logs, []);
    // The suspended actor's next request no longer gets past the membership check.
    assert.equal((await handlePartnerAuth(read(cookie), config)).status, 403);
    await assert.rejects(() => store.upsertMembership({ actor: 'fixture', operatorId: 'north', userId: '46',
      roleId: 'co-admin', status: 'suspended', expectedRevision: 1 }), error => error.code === 'studio_last_operator_admin');
    assert.equal(memberRow(pool, '46').status, 'active');
  });

  test('a new address is invited with one mail; an existing address is linked with the same response and no mail', async () => {
    const { config, pool, boDb } = await fixture();
    const sent = [];
    config.mail = { async send(message) { sent.push(message); return { sent: true }; } };
    config.publicOrigin = origin;
    const cookie = await cookieFor(config, 'north-admin');
    const before = users.length;
    const created = await handlePartnerAuth(write(cookie, { action: 'invite', email: 'New.Person@partner.invalid', roleId: 'partner-viewer' }), config);
    const linked = await handlePartnerAuth(write(cookie, { action: 'invite', email: 'outside@partner.invalid', roleId: 'partner-editor' }), config);
    assert.equal(created.status, 200);
    assert.equal(linked.status, 200);
    assert.deepEqual(await created.json(), { invited: true });
    assert.deepEqual(await linked.json(), { invited: true });
    assert.equal(users.length, before + 1);
    const account = users.find(user => user.email === 'new.person@partner.invalid');
    assert.equal(account.role, 'partner');
    assert.equal(account.username, 'new.person@partner.invalid');
    assert.equal(account.hash ?? null, null);
    assert.equal(memberRow(pool, account.id).status, 'invited');
    assert.equal(memberRow(pool, account.id).role_id, 'partner-viewer');
    assert.equal(memberRow(pool, '45').status, 'active');
    assert.equal(memberRow(pool, '45').role_id, 'partner-editor');
    assert.equal(sent.length, 1);
    const link = new URL(sent[0].link);
    assert.equal(link.origin, origin);
    assert.equal(link.pathname, '/partner/set-password');
    assert.match(link.searchParams.get('t'), /^[A-Za-z0-9_-]{32,128}$/);
    assert.equal(link.searchParams.has('password'), false);
    assert.equal(sent[0].password, undefined);
    assert.match(sent[0].text, /North/);
    assert.match(sent[0].text, /Partner viewer/);
    assert.equal(sent[0].to, 'new.person@partner.invalid');
    const token = link.searchParams.get('t');
    assert.equal(boDb.accounts.tokens[0].token, `studio-sha256:${createHash('sha256').update(token).digest('hex')}`);
    assert.equal(boDb.accounts.tokens[0].kind, 'invite');
    assert.equal(boDb.accounts.tokens[0].username, 'new.person@partner.invalid');
    const viewer = await cookieFor(config, 'north-viewer');
    assert.equal((await handlePartnerAuth(write(viewer, { action: 'invite', email: 'other@partner.invalid', roleId: 'partner-viewer' }), config)).status, 403);
    assert.equal(users.some(user => user.email === 'other@partner.invalid'), false);
    const taken = { ...config, gameDb: { prepare: () => ({ all: async () => [{ player_id: 'p1' }] }) } };
    assert.equal((await handlePartnerAuth(write(cookie, { action: 'invite', email: 'player@partner.invalid', roleId: 'partner-viewer' }), taken)).status, 422);
    assert.equal(users.some(user => user.email === 'player@partner.invalid'), false);
  });

  test('the sixth invitation from one actor within the hour is 429 and creates nothing', async () => {
    const { config, pool } = await fixture();
    const sent = [];
    config.mail = { async send(message) { sent.push(message); return { sent: true }; } };
    config.publicOrigin = origin;
    const cookie = await cookieFor(config, 'north-second-admin');
    for (let index = 1; index <= 5; index += 1) {
      const response = await handlePartnerAuth(write(cookie, { action: 'invite', email: `hour-${index}@partner.invalid`, roleId: 'partner-viewer' }), config);
      assert.equal(response.status, 200, String(index));
      assert.deepEqual(await response.json(), { invited: true });
    }
    const blocked = await handlePartnerAuth(write(cookie, { action: 'invite', email: 'hour-6@partner.invalid', roleId: 'partner-viewer' }), config);
    assert.equal(blocked.status, 429);
    assert.deepEqual(await blocked.json(), { error: 'Too many attempts' });
    assert.equal(sent.length, 5);
    assert.equal(users.some(user => user.email === 'hour-6@partner.invalid'), false);
    assert.equal(pool.tables.operator_memberships.filter(row => row.status === 'invited').length, 5);
  });
});
