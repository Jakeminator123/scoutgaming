import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { authorizePartnerWorkspace, handlePartnerAuth, partnerSessionDigest } from '../lib/partner-session.mjs';
import { partnerWorkspaceData, partnerWorkspaceInitialData } from '../lib/partner-data.mjs';
import { createOperatorJournal } from '../lib/operator-journal.mjs';
import { STANDARD_OPERATOR_ROLES } from '../lib/operator-admin-api.mjs';
import { PARTNER_PERMISSIONS } from '../../web/partner-access-policy.mjs';
import { createOperatorStore } from '../../web/storage/operator-store.mjs';
import { operatorMemoryPool, usersDb } from './fixtures/operator-memory-pool.mjs';

const origin = 'https://public.example.invalid';
const host = 'public.example.invalid';
const scope = { environment: 'fixture', workspaceId: 'croupier' };
const now = 1_700_000_000_000;
const signer = 'ab'.repeat(32);
const john = { id: 'john-company', slug: 'johnsspelbolag', name: 'Johns spelbolag' };
const other = { id: 'other-company', slug: 'other-partner', name: 'Another partner' };
const stamp = user => createHash('sha256').update(`${user.salt}:${user.hash}`).digest('hex');
function jwt(user, claims = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ sub: user.username, role: user.role, aud: 'backoffice',
    exp: now / 1000 + 3600, source_stamp: stamp(user), auth_epoch: user.epoch, ...claims })).toString('base64url');
  const signature = createHmac('sha256', Buffer.from(signer, 'hex')).update(`${header}.${body}`).digest('base64url');
  return `bo_jwt=${header}.${body}.${signature}`;
}
function request(cookie, path = '/studio/api/partner/snapshot', { body, headers = {} } = {}) {
  return new Request(`${origin}${path}`, { method: body ? 'POST' : 'GET', headers: {
    host, cookie, ...(body ? { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' } : {}), ...headers,
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function fixture() {
  const users = [
    { id: '7', username: 'jakob', role: 'admin', email: 'admin@studio.invalid' },
    { id: '42', username: 'john-partner', role: 'partner', email: 'john@partner.invalid' },
    { id: '43', username: 'john-editor', role: 'partner', email: 'editor@partner.invalid' },
    { id: '44', username: 'outside-partner', role: 'partner', email: 'outside@partner.invalid' },
  ].map(user => ({ ...user, salt: 'cd'.repeat(16), hash: 'ef'.repeat(64), epoch: 0 }));
  const accounts = usersDb(users), sessions = [];
  let unavailable = false;
  const boDb = {
    async transaction(work) { return work(); },
    prepare(sql) {
      if (unavailable) throw new Error('fixture database unavailable');
      if (sql.startsWith('SELECT id,username') || sql.startsWith('INSERT INTO users')
        || sql.startsWith('DELETE FROM tokens') || sql.startsWith('INSERT INTO tokens')) return accounts.prepare(sql);
      const rows = args => {
        if (sql.includes('FROM meta')) return [{ v: signer }];
        if (sql.includes('FROM lab_sessions')) return sessions.filter(row => row.token_digest === args[0] && row.expires > args[1]);
        if (sql.includes('u.id=?')) return users.filter(user => user.id === String(args[0]));
        if (/lower\(u.username\)/i.test(sql)) return users.filter(user => user.username.toLowerCase() === args[0]
          || (sql.includes('u.email') && user.email.toLowerCase() === args[0]));
        throw new Error(`Unexpected fixture query: ${sql}`);
      };
      return { async all(...args) { return rows(args).map(row => ({ ...row })); },
        async get(...args) { return (await this.all(...args))[0]; },
      };
    },
  };
  function opaque(user, token, purpose) {
    sessions.push({ token_digest: purpose === 'partner' ? partnerSessionDigest(token)
      : createHash('sha256').update(token).digest('hex'), craig_user_id: user.id, role: user.role,
    source_stamp: stamp(user), auth_epoch: user.epoch, expires: now + 3600_000 });
    return `${purpose === 'partner' ? 'partner_session' : 'lab_session'}=${token}`;
  }
  const pool = operatorMemoryPool();
  const store = await createOperatorStore({ sql: pool, scope, now: () => now });
  for (const operator of [john, other]) {
    await store.createOperator({ actor: 'fixture', operatorId: operator.id, slug: operator.slug, name: operator.name });
    for (const role of STANDARD_OPERATOR_ROLES) await store.upsertRole({ actor: 'fixture', operatorId: operator.id,
      roleId: role.id, label: role.label, permissions: [...role.permissions], delegable: role.delegable });
  }
  for (const [userId, roleId] of [['42', 'partner-admin'], ['43', 'partner-editor']]) {
    await store.upsertMembership({ actor: 'fixture', operatorId: john.id, userId, roleId, status: 'active' });
  }
  const logs = [];
  const config = { boDb, scope, now: () => now, pool,
    gameDb: { prepare: () => ({ all: async () => [], get: async () => undefined }) },
    allowedOrigins: [origin, 'https://studio.example.invalid'], publicHosts: [host, 'studio.example.invalid'],
    apiBase: '/studio/api/admin', authBase: '/studio/api/auth',
    journal: createOperatorJournal({ log: (...entry) => logs.push(entry), now: () => now }),
  };
  return { users, sessions, pool, store, config, logs, admin: jwt(users[0]),
    lab: opaque(users[0], 'aa'.repeat(32), 'admin'), partner: opaque(users[1], 'bb'.repeat(32), 'partner'),
    unavailable() { unavailable = true; } };
}
const selected = (action = 'snapshot', slug = john.slug) => `/studio/api/partner/${action}?operator=${slug}`;
const expectStatus = status => error => error.statusCode === status;

test('N1 JWT and opaque admin sessions list actual scoped partners without creating partner membership', async () => {
  const f = await fixture();
  const before = structuredClone(f.pool.tables.operator_memberships);
  for (const cookie of [f.admin, f.lab]) {
    const response = await handlePartnerAuth(request(cookie), f.config);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('vary'), 'Cookie');
    const snapshot = await response.json();
    assert.equal(snapshot.preview, false);
    assert.equal(snapshot.accessClass, 'internal-admin');
    assert.deepEqual(snapshot.viewer, { user: 'jakob', accessClass: 'internal-admin' });
    assert.deepEqual(snapshot.operators, [john, other]);
    assert.doesNotMatch(JSON.stringify(snapshot), /Demo North|Demo South/);
  }
  assert.deepEqual(f.pool.tables.operator_memberships, before);
  assert.equal(f.sessions.length, 2);
});

test('Johns real slug opens an honest empty package and SSR identifies the admin access class', async () => {
  const f = await fixture();
  const loaded = await partnerWorkspaceInitialData(request(f.admin, `/partner/${john.slug}`), {
    config: f.config, store: f.store, operatorSlug: john.slug,
  });
  assert.deepEqual(loaded.session, { user: 'jakob', role: 'admin', accessClass: 'internal-admin' });
  assert.deepEqual(loaded.snapshot.operator, john);
  assert.deepEqual(loaded.snapshot.permissions, [...PARTNER_PERMISSIONS]);
  for (const key of ['tables', 'presentations', 'players', 'transactions', 'reports']) assert.deepEqual(loaded.snapshot[key], []);
  assert.equal(loaded.snapshot.team.some(member => member.id === '7'), false);
  assert.equal(loaded.snapshot.packageRevision, undefined);
  assert.deepEqual(loaded.snapshot.unavailableSections, ['players', 'transactions', 'reports']);
});

test('both cookies have deterministic N1 precedence and an invalid N1 cookie cannot fall back to partner', async () => {
  const f = await fixture();
  const snapshot = await partnerWorkspaceData(request(`${f.partner}; ${f.admin}`), { config: f.config, store: f.store });
  assert.equal(snapshot.accessClass, 'internal-admin');
  assert.deepEqual(snapshot.operators, [john, other]);
  for (const cookies of [`${f.partner}; bo_jwt=invalid`, `${f.partner}; lab_session=invalid`,
    `${f.partner}; bo_jwt=`, `${f.admin}; ${f.admin}`, `${f.partner}; bo_jwt=invalid; ${f.lab}`]) {
    await assert.rejects(() => authorizePartnerWorkspace(request(cookies), f.config), expectStatus(401));
    assert.equal((await handlePartnerAuth(request(cookies), f.config)).status, 401);
  }
});

test('expired, revoked, changed-password and downgraded admin sessions fail closed', async () => {
  for (const mutate of [f => { f.users[0].epoch += 1; }, f => { f.users[0].hash = 'ac'.repeat(64); },
    f => { f.users[0].role = 'partner'; }, f => { f.users.splice(0, 1); }]) {
    const f = await fixture(); mutate(f);
    for (const cookie of [f.admin, f.lab]) {
      const denied = await handlePartnerAuth(request(`${cookie}; ${f.partner}`), f.config);
      assert.equal(denied.status, 401);
      assert.equal((await denied.json()).operators, undefined);
    }
  }
  const f = await fixture();
  assert.equal((await handlePartnerAuth(request(jwt(f.users[0], { exp: now / 1000 })), f.config)).status, 401);
});

test('partner sessions retain membership isolation and fresh role and membership revocation', async () => {
  const f = await fixture();
  const directory = await partnerWorkspaceData(request(f.partner), { config: f.config, store: f.store });
  assert.equal(directory.accessClass, 'partner');
  assert.deepEqual(directory.operators, [john]);
  assert.equal((await handlePartnerAuth(request(f.partner, selected('snapshot', other.slug)), f.config)).status, 403);
  const member = f.pool.tables.operator_memberships.find(row => row.user_id === '42');
  const role = f.pool.tables.operator_roles.find(row => row.operator_id === john.id && row.role_id === member.role_id);
  role.permissions = JSON.stringify([]);
  assert.equal((await handlePartnerAuth(request(f.partner, selected()), f.config)).status, 403);
  role.permissions = JSON.stringify([...PARTNER_PERMISSIONS]); member.status = 'suspended';
  assert.equal((await handlePartnerAuth(request(f.partner, selected()), f.config)).status, 403);
});

test('admin rejects cross-workspace and suspended operators, unknown slugs and database failure without fixtures', async () => {
  const f = await fixture();
  const foreign = { ...john, scope: { ...scope, workspaceId: 'elsewhere' }, status: 'active' };
  await assert.rejects(() => partnerWorkspaceData(request(f.admin), { config: f.config, operatorSlug: john.slug,
    store: { ...f.store, getOperatorBySlug: async () => foreign } }), expectStatus(403));
  await assert.rejects(() => partnerWorkspaceData(request(f.admin), { config: f.config, operatorSlug: john.slug,
    store: { ...f.store, getOperatorBySlug: async () => ({ ...foreign, scope, status: 'suspended' }) } }), expectStatus(403));
  assert.equal((await handlePartnerAuth(request(f.admin, selected('snapshot', 'missing-company')), f.config)).status, 404);
  f.unavailable();
  const failure = await handlePartnerAuth(request(f.admin), f.config);
  assert.equal(failure.status, 503);
  assert.doesNotMatch(JSON.stringify(await failure.json()), /Demo North|Demo South|operators/);
});

test('admin team writes stay on John, record the real actor and retain Origin and membership CAS gates', async () => {
  const f = await fixture();
  const read = await handlePartnerAuth(request(f.admin, selected('team')), f.config);
  assert.equal(read.status, 200);
  const data = await read.json();
  assert.deepEqual(data.viewer, { userId: '7' });
  const body = { action: 'role', userId: '43', roleId: 'partner-viewer', expectedRevision: 1 };
  assert.equal((await handlePartnerAuth(request(f.admin, selected('team'), { body, headers: { origin: 'https://evil.invalid' } }), f.config)).status, 403);
  assert.equal((await handlePartnerAuth(request(f.admin, selected('team', other.slug), { body }), f.config)).status, 404);
  const saved = await handlePartnerAuth(request(f.admin, selected('team'), { body }), f.config);
  assert.equal(saved.status, 200);
  const row = f.pool.tables.operator_memberships.find(member => member.user_id === '43');
  assert.equal(row.operator_id, john.id);
  assert.equal(row.role_id, 'partner-viewer');
  assert.equal((await handlePartnerAuth(request(f.admin, selected('team'), { body }), f.config)).status, 409);
  const entry = JSON.parse(f.logs.at(-1)[1]);
  assert.equal(entry.actor, 'jakob');
  assert.equal(entry.operatorId, john.id);
  assert.equal(f.pool.tables.operator_memberships.some(member => member.user_id === '7'), false);
});

test('admin team rechecks a revoked session immediately before saving', async () => {
  const f = await fixture();
  f.pool.before('get-membership', () => { f.users[0].epoch += 1; });
  const response = await handlePartnerAuth(request(f.admin, selected('team'), { body: {
    action: 'suspend', userId: '43', expectedRevision: 1,
  } }), f.config);
  assert.equal(response.status, 401);
  assert.equal(f.pool.tables.operator_memberships.find(member => member.user_id === '43').status, 'active');
  assert.deepEqual(f.logs, []);
});

test('non-admin BO roles cannot upgrade a partner session to internal admin access', async () => {
  for (const role of ['staff', 'pitboss', 'player', 'partner']) {
    const f = await fixture();
    f.users[0].role = role;
    const response = await handlePartnerAuth(request(`${jwt(f.users[0])}; ${f.partner}`), f.config);
    assert.equal(response.status, 401, role);
    assert.deepEqual(await response.json(), { error: 'Authentication required' });
  }
});

test('overview-only partner snapshot does not expose team membership or identity', async () => {
  const f = await fixture();
  const role = f.pool.tables.operator_roles.find(row => row.operator_id === john.id && row.role_id === 'partner-admin');
  role.permissions = JSON.stringify(['overview.read']);
  const response = await handlePartnerAuth(request(f.partner, selected()), f.config);
  assert.equal(response.status, 200);
  const snapshot = await response.json();
  assert.deepEqual(snapshot.permissions, ['overview.read']);
  assert.deepEqual(snapshot.team, []);
  assert.equal((await handlePartnerAuth(request(f.partner, selected('team')), f.config)).status, 403);
});

test('action-specific invitation and suspension grants are reread under the operator lock', async () => {
  for (const [grant, body] of [
    ['team.invite', { action: 'invite', email: 'new-person@partner.invalid', roleId: 'partner-viewer' }],
    ['team.suspend', { action: 'suspend', userId: '43', expectedRevision: 1 }],
  ]) {
    const f = await fixture();
    f.pool.before('lock-operator', tables => {
      const role = tables.operator_roles.find(row => row.operator_id === john.id && row.role_id === 'partner-admin');
      role.permissions = JSON.stringify(PARTNER_PERMISSIONS.filter(permission => permission !== grant));
    });
    f.pool.trace.length = 0;
    const response = await handlePartnerAuth(request(f.partner, selected('team'), { body }), f.config);
    assert.equal(response.status, 403, grant);
    assert.equal(f.users.length, 4);
    assert.equal(f.pool.tables.operator_memberships.find(member => member.user_id === '43').status, 'active');
    assert.equal(f.pool.tables.operator_memberships.length, 2);
    assert.deepEqual(f.logs, []);
    const locked = f.pool.trace.filter(entry => entry.client !== 0);
    const steps = locked.map(entry => entry.step);
    assert.ok(steps.indexOf('scope-lock') < steps.indexOf('lock-operator'));
    assert.ok(steps.indexOf('lock-operator') < steps.indexOf('get-role'));
    assert.equal(steps.includes('create-membership') || steps.includes('cas-membership'), false);
    assert.equal(steps.at(-1), 'ROLLBACK');
    assert.equal(new Set(locked.map(entry => entry.client)).size, 1);
  }
});

test('a freshly protected target role blocks N1 team mutation without side effects', async () => {
  const f = await fixture();
  f.pool.before('lock-operator', tables => {
    tables.operator_roles.find(row => row.operator_id === john.id && row.role_id === 'partner-editor').delegable = false;
  });
  const response = await handlePartnerAuth(request(f.admin, selected('team'), { body: {
    action: 'suspend', userId: '43', expectedRevision: 1,
  } }), f.config);
  assert.equal(response.status, 403);
  assert.equal(f.pool.tables.operator_memberships.find(member => member.user_id === '43').status, 'active');
  assert.deepEqual(f.logs, []);
});

test('N1 invitation delivery and journal happen only after membership commit', async () => {
  const f = await fixture();
  let sent = 0;
  f.config.mail = { async send() {
    assert.equal(f.pool.trace.filter(entry => entry.client !== 0).at(-1).step, 'COMMIT');
    sent += 1;
    return { sent: true };
  } };
  f.pool.trace.length = 0;
  const response = await handlePartnerAuth(request(f.admin, selected('team'), { body: {
    action: 'invite', email: 'new-admin-invite@partner.invalid', roleId: 'partner-viewer',
  } }), f.config);
  assert.equal(response.status, 200);
  assert.equal(sent, 1);
  assert.equal(f.users.length, 5);
  assert.equal(f.pool.tables.operator_memberships.find(member => member.user_id === f.users.at(-1).id).status, 'invited');
  assert.equal(JSON.parse(f.logs.at(-1)[1]).actor, 'jakob');
});

test('N1 branding uses its real actor and preserves the scoped package with revision guards', async () => {
  const f = await fixture();
  f.config.readProject = async () => ({ project: { lanes: [{ id: 'john-lane', operatorAdjustable: ['table.color'] }] } });
  await f.store.publishPackage({ actor: 'fixture', operatorId: john.id, lanes: ['john-lane'],
    games: ['blackjack'], tables: ['john-room'], branding: { color: '#112233' } });
  const initial = await handlePartnerAuth(request(f.admin, selected('branding')), f.config);
  assert.equal(initial.status, 200);
  assert.equal((await initial.json()).packageRevision, 1);
  f.pool.trace.length = 0;
  const write = await handlePartnerAuth(request(f.admin, selected('branding'), { body: {
    expectedRevision: 1, branding: { color: '#445566' },
  } }), f.config);
  assert.equal(write.status, 200);
  assert.equal((await write.json()).packageRevision, 2);
  const steps = f.pool.trace.filter(entry => entry.client !== 0).map(entry => entry.step);
  assert.ok(steps.indexOf('scope-lock') < steps.indexOf('lock-operator'));
  assert.ok(steps.indexOf('lock-operator') < steps.indexOf('publish-package'));
  assert.equal(steps.at(-1), 'COMMIT');
  assert.equal((await handlePartnerAuth(request(f.admin, selected('branding'), { body: {
    expectedRevision: 1, branding: { color: '#778899' },
  } }), f.config)).status, 409);
  assert.equal((await handlePartnerAuth(request(f.admin, selected('branding'), { body: {
    expectedRevision: 2, branding: { dealer: 'not-in-package' },
  } }), f.config)).status, 422);
  const actors = [];
  f.config.store = { ...f.store, async publishPackage(input) {
    actors.push(input.actor);
    return f.store.publishPackage(input);
  } };
  assert.equal((await handlePartnerAuth(request(f.admin, selected('branding'), { body: {
    expectedRevision: 2, branding: { color: '#778899' },
  } }), f.config)).status, 200);
  assert.deepEqual(actors, ['jakob']);
  const pack = await f.store.getCurrentPackage(john.id);
  assert.equal(pack.revision, 3);
  assert.deepEqual(pack.lanes, ['john-lane']);
  assert.deepEqual(pack.games, ['blackjack']);
  assert.deepEqual(pack.tables, ['john-room']);
  assert.equal(await f.store.getCurrentPackage(other.id), null);
  assert.equal(f.pool.tables.operator_memberships.some(member => member.user_id === '7'), false);
});

test('N1 branding reauthorization rejects a revoked session after its operator lock', async () => {
  const f = await fixture();
  f.config.readProject = async () => ({ project: { lanes: [{ id: 'john-lane', operatorAdjustable: ['table.color'] }] } });
  await f.store.publishPackage({ actor: 'fixture', operatorId: john.id, lanes: ['john-lane'],
    games: ['blackjack'], tables: ['john-room'], branding: { color: '#112233' } });
  f.pool.before('lock-operator', () => { f.users[0].epoch += 1; });
  const response = await handlePartnerAuth(request(f.admin, selected('branding'), { body: {
    expectedRevision: 1, branding: { color: '#445566' },
  } }), f.config);
  assert.equal(response.status, 401);
  const pack = await f.store.getCurrentPackage(john.id);
  assert.equal(pack.revision, 1);
  assert.equal(pack.branding.color, '#112233');
  assert.equal(f.pool.trace.filter(entry => entry.client !== 0).at(-1).step, 'ROLLBACK');
});

test('internal administrator journal uses the actual admin ID without impersonating the partner',async()=>{
 const f=await fixture();
 const response=await handlePartnerAuth(request(f.admin,selected('team'),{body:{action:'suspend',userId:'43',expectedRevision:1}}),f.config);
 assert.equal(response.status,200);
 const read=await handlePartnerAuth(request(f.admin,selected('journal')),f.config);assert.equal(read.status,200);
 const journal=await read.json(),entry=journal.entries.find(row=>row.action==='team.suspend');
 assert.equal(entry.actor,'7');assert.equal(entry.accessClass,'internal-admin');assert.equal(entry.resourceId,'43');
 f.users[0].role='reader';
 assert.equal((await handlePartnerAuth(request(f.admin,selected('journal')),f.config)).status,401);
});
