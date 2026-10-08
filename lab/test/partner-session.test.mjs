import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { createStudioNativeAuth } from '../lib/studio-native-auth.mjs';
import { handlePartnerAuth, authorizePartner, partnerSessionDigest } from '../lib/partner-session.mjs';
import { partnerWorkspaceData, partnerWorkspaceInitialData } from '../lib/partner-data.mjs';

const routeUrl = new URL('../app/api/partner/[...action]/route.ts', import.meta.url);
const routeSource = stripTypeScriptTypes(await readFile(routeUrl, 'utf8'))
  .replace(/from (['"])(\.[^'"]+)\1/g, (_match, _quote, specifier) => `from '${new URL(specifier, routeUrl).href}'`);
const route = await import('data:text/javascript;base64,' + Buffer.from(routeSource).toString('base64'));

const publicOrigin = 'https://public.example.invalid';
const labOrigin = 'https://studio.example.invalid';
const scope = { environment: 'fixture', workspaceId: 'croupier' };
const now = 1_700_000_000_000;
const secret = 'correct-horse';
const wrong = 'incorrect-horse';

function credential(plain) {
  const salt = randomBytes(16).toString('hex');
  return { salt, hash: scryptSync(plain, salt, 64).toString('hex') };
}
const partnerPassword = credential(secret);
const adminPassword = credential(secret);
const users = [
  { id: '42', username: 'north-partner', email: 'north@partner.invalid', role: 'partner', epoch: 0, ...partnerPassword },
  { id: '7', username: 'internal-admin', email: 'admin@studio.invalid', role: 'admin', epoch: 0, ...adminPassword },
];
const sessions = [];
let limits = [];
function findUsers(login) {
  const key = String(login || '').toLowerCase();
  return users.filter(user => user.username.toLowerCase() === key || user.email.toLowerCase() === key);
}
const boDb = {
  async transaction(work) { return work(); },
  prepare(sql) {
    return {
      async all(...args) {
        if (sql.includes('FROM users') && sql.includes('lower(username)')) return findUsers(args[0]).map(user => ({ ...user }));
        if (sql.includes('u.id=?')) return users.filter(user => String(user.id) === String(args[0])).map(user => ({ ...user }));
        if (sql.includes('username=?')) return users.filter(user => user.username === args[0]).map(user => ({ id: user.id, role: user.role }));
        if (sql.includes('FROM lab_sessions')) {
          return sessions.filter(session => session.token_digest === args[0] && session.expires > args[1]).map(session => ({ ...session }));
        }
        if (sql.includes('bo_auth_epochs')) {
          const user = users.find(item => String(item.id) === String(args[0]));
          return user ? [{ epoch: user.epoch }] : [];
        }
        return [];
      },
      async get(...args) { return (await this.all(...args))[0]; },
      async run(...args) {
        if (sql.startsWith('INSERT INTO lab_sessions')) {
          sessions.push({ token_digest: args[0], craig_user_id: args[1], role: args[2], source_stamp: args[3], auth_epoch: args[4], expires: args[5] });
        } else if (sql.includes('DELETE FROM lab_sessions')) {
          for (let index = sessions.length - 1; index >= 0; index -= 1) {
            if (sessions[index].craig_user_id === String(args[0]) && sessions[index].role === args[1]) sessions.splice(index, 1);
          }
        } else if (sql.includes('bo_auth_epochs')) {
          const user = users.find(item => String(item.id) === String(args[0]));
          if (user) user.epoch += 1;
        }
        return { changes: 1 };
      },
    };
  },
};
const gameDb = { prepare: () => ({ all: async () => [], get: async () => undefined, run: async () => ({ changes: 0 }) }) };
const config = {
  boDb, gameDb, scope, now: () => now,
  allowedOrigins: [publicOrigin, labOrigin],
  publicHosts: ['public.example.invalid', 'studio.example.invalid'],
  apiBase: '/studio/api/admin',
  authBase: '/studio/api/auth',
  rateLimit: async input => { limits.push(input); return true; },
  clientAddress: async () => '203.0.113.10',
};
const northId = 'operator-demo-north';
const role = {
  id: 'role-partner', permissions: ['overview.read'], label: 'Partner',
  operatorId: northId, scope,
};
const activeMembership = { userId: '42', roleId: role.id, status: 'active', operatorId: northId, scope, name: 'North Partner', email: 'north@partner.invalid' };
function operator(id, slug, name) {
  return { id, slug, name, status: 'active', scope };
}
const north = operator(northId, 'demo-north', 'Demo North');
const south = operator('operator-demo-south', 'demo-south', 'Demo South');
function memoryStore() {
  let suspended = false;
  const calls = { packages: 0 };
  return {
    calls,
    suspend() { suspended = true; },
    async listOperators() { return [north, south]; },
    async getOperatorBySlug(slug) { return [north, south].find(item => item.slug === slug) ?? null; },
    async getMembership(operatorId, userId) {
      if (userId !== '42' || operatorId !== northId) return null;
      return suspended ? { ...activeMembership, status: 'suspended' } : { ...activeMembership };
    },
    async getRole(operatorId, roleId) {
      assert.equal(operatorId, northId);
      assert.equal(roleId, role.id);
      return { ...role };
    },
    async resolvePartnerContext({ account, operatorSlug }) {
      if (account?.userId !== '42' || account.role !== 'partner' || operatorSlug !== 'demo-north') return null;
      return {
        account: { userId: '42', role: 'partner', status: 'active' },
        scope, operator: north,
        membership: suspended ? { ...activeMembership, status: 'suspended' } : { ...activeMembership },
        role: { ...role },
      };
    },
    async getCurrentPackage(operatorId) {
      calls.packages += 1;
      assert.equal(operatorId, northId);
      return {
        package_revision: 3,
        lanes: [{ id: 'lane-1', name: 'Nordic', dealer: 'astrid' }],
        tables: [{ id: 'table-1', name: 'North 1', game: 'blackjack', presentationId: 'lane-1' }],
      };
    },
  };
}
function withStore(store = memoryStore()) {
  return { ...config, store };
}
function loginRequest(user, pass, headers = {}) {
  return new Request(`${publicOrigin}/studio/api/partner/login`, {
    method: 'POST',
    headers: {
      host: 'public.example.invalid', origin: publicOrigin, 'sec-fetch-site': 'same-origin',
      'content-type': 'application/json', ...headers,
    },
    body: JSON.stringify({ user, pass }),
  });
}
function cookieOf(response) {
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [response.headers.get('set-cookie')].filter(Boolean);
  return cookies.find(value => value.startsWith('partner_session=')) || '';
}
function tokenOf(response) {
  return /^partner_session=([a-f0-9]{64});/.exec(cookieOf(response))?.[1] || '';
}

describe('partner auth boundary', { concurrency: 1 }, () => {
test('partner and internal cookies do not authorize each other', async () => {
  let reads = 0;
  const counting = { prepare() { reads += 1; return { get: async () => null, all: async () => [] }; }, transaction: async work => work() };
  const partnerOnly = new Request('https://public.example.invalid/control', { headers: { cookie: `partner_session=${'ab'.repeat(32)}` } });
  await assert.rejects(() => createStudioNativeAuth({ boDb: counting, scope })(partnerOnly), error => error.statusCode === 401);
  assert.equal(reads, 0);
  const adminOnly = new Request('https://public.example.invalid/partner', { headers: { cookie: `lab_session=${'cd'.repeat(32)}` } });
  await assert.rejects(() => authorizePartner(adminOnly, config), error => error.statusCode === 401);
  const loggedIn = await handlePartnerAuth(loginRequest('north-partner', secret), config);
  assert.equal(loggedIn.status, 200);
  const token = tokenOf(loggedIn);
  assert.match(token, /^[a-f0-9]{64}$/);
  const asLab = new Request('https://public.example.invalid/studio', { headers: { cookie: `lab_session=${token}` } });
  await assert.rejects(() => createStudioNativeAuth({ boDb, scope, now: () => now })(asLab), error => error.statusCode === 401);
  const session = await authorizePartner(new Request('https://public.example.invalid/partner', { headers: { cookie: `partner_session=${token}` } }), config);
  assert.deepEqual(session, { user: 'north-partner', accountId: '42', role: 'partner', scope });
  assert.equal(sessions.some(item => item.token_digest === partnerSessionDigest(token) && item.role === 'partner'), true);
  assert.equal(sessions.some(item => item.token_digest === createHash('sha256').update(token).digest('hex')), false);
});

test('login POST rejects a wrong password and a non-partner without saying which field failed', async () => {
  limits = [];
  const bad = await handlePartnerAuth(loginRequest('north-partner', wrong), config);
  const missing = await handlePartnerAuth(loginRequest('nobody', wrong), config);
  const admin = await handlePartnerAuth(loginRequest('internal-admin', secret), config);
  const badBody = await bad.json();
  const missingBody = await missing.json();
  const adminBody = await admin.json();
  assert.equal(bad.status, 401);
  assert.deepEqual(badBody, missingBody);
  assert.deepEqual(adminBody, badBody);
  const text = JSON.stringify([badBody, missingBody, adminBody]);
  assert.equal(text.includes(wrong), false);
  assert.equal(text.includes(secret), false);
  assert.equal(text.includes('north-partner'), false);
  assert.equal(text.includes('password'), false);
  assert.equal(text.includes('username'), false);
  assert.equal(bad.headers.get('set-cookie'), null);
  assert.equal(admin.headers.get('set-cookie'), null);
  assert.equal(limits.every(item => item.action === 'login' && !JSON.stringify(item).includes(secret)), true);
  const malformed = await handlePartnerAuth(loginRequest('north-partner', secret, { 'content-type': 'text/plain' }), config);
  assert.equal(malformed.status, 415);
  assert.equal((await malformed.text()).includes(secret), false);
});

test('logout clears the partner cookie and the old token no longer authorizes', async () => {
  const loggedIn = await handlePartnerAuth(loginRequest('north-partner', secret), config);
  const token = tokenOf(loggedIn);
  const cookie = `partner_session=${token}`;
  const headers = {
    host: 'public.example.invalid', origin: publicOrigin, 'sec-fetch-site': 'same-origin',
    'content-type': 'application/json', cookie,
  };
  const response = await handlePartnerAuth(new Request(`${publicOrigin}/studio/api/partner/logout`, { method: 'POST', headers, body: '{}' }), config);
  assert.equal(response.status, 200);
  const cleared = cookieOf(response);
  assert.match(cleared, /partner_session=;/);
  assert.match(cleared, /Max-Age=0/);
  assert.match(cleared, /HttpOnly/);
  assert.match(cleared, /Secure/);
  assert.match(cleared, /SameSite=Lax/);
  assert.match(cleared, /Path=\//);
  assert.equal(cleared.includes('lab_session'), false);
  assert.equal(cleared.includes('bo_jwt'), false);
  await assert.rejects(() => authorizePartner(new Request('https://public.example.invalid/partner', { headers: { cookie } }), config), error => error.statusCode === 401);
});

test('a north membership cannot read demo-south, and a suspended membership is denied', async () => {
  const loggedIn = await handlePartnerAuth(loginRequest('north-partner', secret), config);
  const cookie = `partner_session=${tokenOf(loggedIn)}`;
  const store = memoryStore();
  const authed = { ...withStore(store) };
  const snapshot = await handlePartnerAuth(new Request(`${publicOrigin}/studio/api/partner/snapshot?operator=demo-north`, {
    headers: { host: 'public.example.invalid', cookie },
  }), authed);
  assert.equal(snapshot.status, 200);
  assert.equal(snapshot.headers.get('cache-control'), 'private, no-store');
  assert.equal(snapshot.headers.get('x-content-type-options'), 'nosniff');
  const body = await snapshot.json();
  assert.equal(body.preview, false);
  assert.equal(body.notConnected, true);
  assert.equal(body.operator.id, northId);
  assert.deepEqual(body.players, []);
  assert.deepEqual(body.transactions, []);
  assert.deepEqual(body.reports, []);
  assert.equal(JSON.stringify(body).includes('demo-south'), false);
  for (const key of ['tables', 'team', 'presentations']) {
    assert.ok(body[key].length > 0, key);
    for (const item of body[key]) assert.equal(item.operatorId, northId, key);
  }
  assert.equal(body.packageRevision, '3');
  const south = await handlePartnerAuth(new Request(`${publicOrigin}/studio/api/partner/snapshot?operator=demo-south`, {
    headers: { host: 'public.example.invalid', cookie },
  }), authed);
  assert.equal(south.status, 403);
  assert.deepEqual(await south.json(), { error: 'Access denied' });
  assert.equal(store.calls.packages, 1);
  store.suspend();
  const denied = await handlePartnerAuth(new Request(`${publicOrigin}/studio/api/partner/snapshot?operator=demo-north`, {
    headers: { host: 'public.example.invalid', cookie },
  }), authed);
  assert.equal(denied.status, 403);
  assert.equal(store.calls.packages, 1);
  await assert.rejects(() => partnerWorkspaceData(new Request('https://public.example.invalid/partner', { headers: { cookie } }), {
    operatorSlug: 'missing-operator', config: authed, store,
  }), error => error.statusCode === 404);
});

test('the partner index lists only member operators and the route rejects other methods', async () => {
  const loggedIn = await handlePartnerAuth(loginRequest('north-partner', secret), config);
  const cookie = `partner_session=${tokenOf(loggedIn)}`;
  const store = memoryStore();
  const page = await partnerWorkspaceInitialData(new Request('http://public.example.invalid/studio/partner', {
    headers: { host: 'public.example.invalid', cookie },
  }), { config: withStore(store), store });
  assert.equal(page.snapshot.preview, false);
  assert.deepEqual(page.snapshot.operators, [{ id: northId, slug: 'demo-north', name: 'Demo North' }]);
  assert.equal(page.session.user, 'north-partner');
  assert.equal(page.apiBase, '/studio/api/partner/snapshot');
  assert.equal(store.calls.packages, 0);
  await assert.rejects(() => partnerWorkspaceInitialData(new Request('http://public.example.invalid/studio/partner', {
    headers: { host: 'public.example.invalid', origin: 'https://evil.invalid', cookie },
  }), { config: withStore(store), store }), error => error.statusCode === 403);
  assert.equal(route.POST, handlePartnerAuth);
  assert.equal(route.GET, handlePartnerAuth);
  for (const method of ['PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    const response = await route[method](new Request(`${publicOrigin}/studio/api/partner/login`, { method }));
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.get('allow'), 'GET, POST');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(await response.text(), '');
  }
});

test('branding requires partner_session, rejects a query-only pool, and keeps the login Origin gate', async () => {
  const loggedIn = await handlePartnerAuth(loginRequest('north-partner', secret), config);
  const cookie = `partner_session=${tokenOf(loggedIn)}`;
  const headers = { host: 'public.example.invalid', cookie };
  const missing = await handlePartnerAuth(new Request(`${publicOrigin}/studio/api/partner/branding?operator=demo-north`, {
    headers: { host: 'public.example.invalid' },
  }), config);
  assert.equal(missing.status, 401);
  assert.equal(missing.headers.get('cache-control'), 'private, no-store');
  const noOrigin = await handlePartnerAuth(new Request(`${publicOrigin}/studio/api/partner/branding?operator=demo-north`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
    body: JSON.stringify({ expectedRevision: 1, branding: {} }),
  }), config);
  assert.equal(noOrigin.status, 403);
  const loginQuery = await handlePartnerAuth(new Request(`${publicOrigin}/studio/api/partner/login?operator=demo-north`, {
    method: 'POST',
    headers: {
      host: 'public.example.invalid', origin: publicOrigin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json',
    },
    body: JSON.stringify({ user: 'north-partner', pass: secret }),
  }), config);
  assert.equal(loginQuery.status, 400);
  let queries = 0;
  const unavailable = await handlePartnerAuth(new Request(`${publicOrigin}/studio/api/partner/branding?operator=demo-north`, { headers }), {
    ...config,
    pool: { async query() { queries += 1; return { rows: [] }; } },
  });
  assert.equal(unavailable.status, 503);
  assert.equal(queries, 0);
});

test('branding read follows the lane and writing requires presentations.configure', async () => {
  const loggedIn = await handlePartnerAuth(loginRequest('north-partner', secret), config);
  const cookie = `partner_session=${tokenOf(loggedIn)}`;
  const readProject = async () => ({ lanes: [{ id: 'mobile-phone', operatorAdjustable: ['table.color'] }] });
  function storeFor(permissions) {
    const published = [];
    const role = { id: 'partner-admin', permissions, operatorId: northId, scope };
    const membership = { userId: '42', roleId: role.id, status: 'active', operatorId: northId, scope };
    const pack = {
      operatorId: northId, revision: 4, lanes: ['mobile-phone'], games: ['blackjack'], tables: ['table-a'],
      branding: { color: '#112233', name: 'North' },
    };
    return {
      published,
      async getOperatorBySlug(slug) { return slug === 'demo-north' ? north : null; },
      async getMembership() { return { ...membership }; },
      async getRole() { return { ...role, permissions: [...permissions] }; },
      async resolvePartnerContext() {
        return {
          account: { userId: '42', role: 'partner', status: 'active' },
          scope,
          operator: { id: northId, status: 'active', scope },
          membership: { ...membership },
          role: { ...role, permissions: [...permissions] },
        };
      },
      async getCurrentPackage() { return { ...pack, lanes: [...pack.lanes], games: [...pack.games], tables: [...pack.tables], branding: { ...pack.branding } }; },
      async publishPackage(input) {
        published.push(input);
        return { ...pack, revision: 5, branding: { ...pack.branding, ...input.branding }, lanes: [...input.lanes], games: [...input.games], tables: [...input.tables] };
      },
    };
  }
  const reader = storeFor(['overview.read']);
  const authed = { ...config, store: reader, readProject };
  const read = await handlePartnerAuth(new Request(`${publicOrigin}/studio/api/partner/branding?operator=demo-north`, {
    headers: { host: 'public.example.invalid', cookie },
  }), authed);
  assert.equal(read.status, 200);
  assert.equal(read.headers.get('cache-control'), 'private, no-store');
  const body = await read.json();
  assert.deepEqual(body.adjustable, ['table.color']);
  assert.equal(body.packageRevision, 4);
  const denied = await handlePartnerAuth(new Request(`${publicOrigin}/studio/api/partner/branding?operator=demo-north`, {
    method: 'POST',
    headers: {
      host: 'public.example.invalid', origin: publicOrigin, 'sec-fetch-site': 'same-origin',
      'content-type': 'application/json', cookie,
    },
    body: JSON.stringify({ expectedRevision: 4, branding: { color: '#00ff00' } }),
  }), authed);
  assert.equal(denied.status, 403);
  assert.equal(reader.published.length, 0);
  const writer = storeFor(['overview.read', 'presentations.configure']);
  const saved = await handlePartnerAuth(new Request(`${publicOrigin}/studio/api/partner/branding?operator=demo-north`, {
    method: 'POST',
    headers: {
      host: 'public.example.invalid', origin: publicOrigin, 'sec-fetch-site': 'same-origin',
      'content-type': 'application/json', cookie,
    },
    body: JSON.stringify({ expectedRevision: 4, branding: { color: '#00ff00' } }),
  }), { ...config, store: writer, readProject });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).packageRevision, 5);
  assert.equal(writer.published[0].actor, 'north-partner');
  assert.deepEqual(writer.published[0].lanes, ['mobile-phone']);
  assert.deepEqual(writer.published[0].games, ['blackjack']);
  assert.deepEqual(writer.published[0].tables, ['table-a']);
  assert.equal(writer.published.length, 1);
});
});
