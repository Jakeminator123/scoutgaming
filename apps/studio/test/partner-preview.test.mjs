import { fixtureDatabaseUrl } from '../../../test/fixtures/database-url.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { NextRequest } from 'next/server.js';
import { createPartnerPreviewHandlers } from '../lib/partner-preview.mjs';
import { createPartnerPreviewContext, assertPartnerPreviewResourceAccess, partnerPreviewOperator } from '../lib/partner-preview-policy.mjs';
import { readPartnerPreviewFixture } from '../lib/partner-preview-fixtures.mjs';
import { createStudioNativeAuth } from '../lib/studio-native-auth.mjs';

// Execute the actual route exports without requiring automatic .ts imports on
// every supported Node 22 release. Only relative import resolution is adjusted.
const routeUrl = new URL('../app/api/partner-preview/route.ts', import.meta.url);
const routeSource = stripTypeScriptTypes(await readFile(routeUrl, 'utf8'))
  .replace(/from (['"])(\.[^'"]+)\1/g, (_match, _quote, specifier) => `from '${new URL(specifier, routeUrl).href}'`);
const route = await import('data:text/javascript;base64,' + Buffer.from(routeSource).toString('base64'));

const publicOrigin = 'https://public.example.invalid', labOrigin = 'https://studio.example.invalid';
const scope = { environment: 'fixture', workspaceId: 'croupier' };
const config = { scope, allowedOrigins: [publicOrigin, labOrigin], publicHosts: ['public.example.invalid', 'studio.example.invalid'],
  apiBase: '/studio/api/admin', authBase: '/studio/api/auth' };
const session = { user: 'internal-fixture', role: 'admin', scope };
const north = 'operator-demo-north', south = 'operator-demo-south';
const request = (suffix = '', options = {}) => new Request(`${publicOrigin}/studio/api/partner-preview${suffix}`, options);
const handlers = (options = {}) => createPartnerPreviewHandlers({ previewEnabled: true, configuration: () => config,
  runtime: async () => ({ authorize: async () => session }), now: () => 0, ...options });
const context = (operatorId = north) => createPartnerPreviewContext({ session, scope, operatorId, previewEnabled: true });
const denied = error => error.statusCode === 403;

test('explicit fixture flag, trusted role, matching environment/workspace and real actor are required', () => {
  const input = { session, scope, operatorId: north, previewEnabled: true };
  for (const role of ['player', 'reader', 'staff', 'partner', 'partner-admin', undefined]) {
    assert.throws(() => createPartnerPreviewContext({ ...input, session: { ...session, role } }), denied);
  }
  for (const wrongScope of [{ ...scope, workspaceId: 'other' }, { ...scope, environment: 'other' }, null, { ...scope, operatorId: north }]) {
    assert.throws(() => createPartnerPreviewContext({ ...input, session: { ...session, scope: wrongScope } }), denied);
  }
  assert.throws(() => createPartnerPreviewContext({ ...input, previewEnabled: false }), error => error.statusCode === 503);
  assert.throws(() => createPartnerPreviewContext({ ...input, session: null }), error => error.statusCode === 401);
  assert.throws(() => createPartnerPreviewContext({ ...input, session: { ...session, user: '' } }), denied);
  assert.throws(() => createPartnerPreviewContext({ ...input, operatorId: 'real-customer' }), error => error.statusCode === 404);
  assert.equal(partnerPreviewOperator('demo-south').id, south);
  assert.equal(partnerPreviewOperator('real-customer'), null);
});

test('actions, fixture membership and resource owner all fail closed', () => {
  const current = context();
  const valid = { action: 'preview.read', resource: { operatorId: north, preview: true } };
  assert.doesNotThrow(() => assertPartnerPreviewResourceAccess(current, valid));
  for (const action of ['*', 'players.read', 'preview.write', '', undefined]) {
    assert.throws(() => assertPartnerPreviewResourceAccess(current, { ...valid, action }), denied);
  }
  for (const change of [{ preview: false }, { accessClass: 'partner' }, { role: 'partner-admin' }, { permissions: [] },
    { operatorId: south }, { membership: null }, { membership: { ...current.membership, status: 'revoked' } },
    { membership: { ...current.membership, operatorId: south } }, { membership: { ...current.membership, source: 'request' } }]) {
    assert.throws(() => assertPartnerPreviewResourceAccess({ ...current, ...change }, valid), denied);
  }
  for (const resource of [null, { operatorId: south, preview: true }, { operatorId: north, preview: false }]) {
    assert.throws(() => assertPartnerPreviewResourceAccess(current, { ...valid, resource }), denied);
  }
});

test('two operator snapshots keep every resource separate and cannot contaminate later reads', async () => {
  const api = handlers();
  const first = await api.handle(request(`?operator=${north}`));
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('cache-control'), 'private, no-store');
  assert.equal(first.headers.get('vary'), 'Cookie');
  assert.equal(first.headers.get('x-content-type-options'), 'nosniff');
  const a = await first.json(), b = await (await api.handle(request(`?operator=${south}`))).json();
  assert.equal(a.operator.id, north); assert.equal(b.operator.id, south);
  for (const data of [a, b]) {
    assert.equal(data.preview, true); assert.equal(data.mode, 'fixture'); assert.equal(data.accessClass, 'internal');
    assert.deepEqual(data.viewer, { user: session.user, accessClass: 'internal' });
    assert.equal(data.generatedAt, '1970-01-01T00:00:00.000Z');
    assert.equal(data.integration.status, 'not-connected');
    assert.deepEqual(data.players, []); assert.deepEqual(data.transactions, []); assert.deepEqual(data.reports, []);
    for (const collection of ['brands', 'tables', 'team', 'presentations']) {
      for (const resource of data[collection]) assert.equal(resource.operatorId, data.operator.id);
    }
  }
  assert.notEqual(a.tables.length, b.tables.length);
  assert.ok(!JSON.stringify(a.team).includes('demo-south'));
  assert.ok(!JSON.stringify(b.team).includes('demo-north'));
  const mutated = readPartnerPreviewFixture(context());
  mutated.team[0].email = 'changed'; mutated.operators[0].name = 'changed';
  assert.notEqual(readPartnerPreviewFixture(context()).team[0].email, 'changed');
  assert.equal(readPartnerPreviewFixture(context()).operator.name, 'Demo North');
});

test('unknown or duplicate selectors, extra scope fields and forged origins never initialize runtime', async () => {
  const api = handlers({ runtime: async () => assert.fail('invalid request must not initialize runtime') });
  for (const suffix of ['?operator=real-customer', '?operator=', `?operator=${north}&operator=${south}`,
    `?operator=${north}&scope=production`, '?preview=true', '?role=admin']) {
    assert.equal((await api.handle(request(suffix))).status, 400);
  }
  for (const headers of [{ host: 'evil.invalid' }, { origin: 'https://evil.invalid' }, { 'x-forwarded-host': 'evil.invalid' },
    { 'x-forwarded-proto': 'http' }, { 'sec-fetch-site': 'cross-site' }, { 'next-action': 'pretend-action' }]) {
    assert.equal((await api.handle(request(`?operator=${north}`, { headers }))).status, 403);
  }
  for (const path of ['/studio/api/partner-preview/other', '/api/admin', '/partner/api/partner-preview']) {
    assert.equal((await api.handle(new Request(publicOrigin + path))).status, 404);
  }
  for (const suffix of ['#fragment', '/%70']) {
    assert.equal((await api.handle(request(suffix))).status, 403);
  }
});

test('real NextRequest public rewrite restores only this endpoint and preserves cookies for authorization', async () => {
  let seen;
  const api = handlers({ runtime: async () => ({ authorize: async current => { seen = current; return session; } }) });
  const rewritten = new NextRequest(`${labOrigin}/api/partner-preview?operator=${south}`, { headers: {
    host: 'studio.example.invalid', 'x-forwarded-host': 'public.example.invalid', 'x-forwarded-proto': 'https',
    origin: publicOrigin, cookie: 'lab_session=fixture', 'sec-fetch-site': 'same-origin',
  } });
  const result = await api.handle(rewritten);
  assert.equal(result.status, 200); assert.equal((await result.json()).operator.id, south);
  assert.equal(seen.url, publicOrigin + '/studio/api/partner-preview');
  assert.equal(seen.headers.get('cookie'), 'lab_session=fixture');
  assert.equal(seen.headers.get('origin'), publicOrigin);
});

test('actual native authorization rereads account epoch/role for every GET and SSR; no fixture fallback after revocation', async () => {
  const account = { id: 1, username: 'internal-fixture', role: 'admin', salt: 'fixture-salt', hash: 'a'.repeat(128), epoch: 0 };
  const stamp = createHash('sha256').update(`${account.salt}:${account.hash}`).digest('hex');
  const storedSession = { craig_user_id: 1, role: 'admin', source_stamp: stamp, auth_epoch: 0 };
  let reads = 0;
  const authorize = createStudioNativeAuth({ scope, boDb: { prepare: sql => ({
    get: async () => { assert.match(sql, /lab_sessions/); return storedSession; },
    all: async () => { reads++; return [account]; },
  }) } });
  const api = handlers({ runtime: async () => ({ authorize }) });
  const headers = { cookie: `lab_session=${'b'.repeat(64)}` };
  assert.equal((await api.handle(request('', { headers }))).status, 200);
  const page = await api.initialData(new Request('http://public.example.invalid/partner', { headers }));
  assert.equal(page.snapshot.operator.id, north); assert.equal(page.apiBase, '/studio/api/partner-preview');
  assert.deepEqual(page.session, { user: 'internal-fixture', role: 'admin', accessClass: 'internal' });
  assert.deepEqual(page.snapshot.viewer, { user: page.session.user, accessClass: 'internal' });
  account.epoch = 1;
  const response = await api.handle(request('', { headers }));
  assert.equal(response.status, 401); assert.deepEqual(await response.json(), { error: 'studio_login_required' });
  await assert.rejects(api.initialData(new Request('http://public.example.invalid/control', { headers })), error => error.statusCode === 401);
  account.epoch = 0; account.role = 'player';
  assert.equal((await api.handle(request('', { headers }))).status, 401);
  assert.equal(reads, 5);
});

test('a changed native actor is projected freshly into API and SSR snapshots for client context invalidation', async () => {
  let actor = 'internal-first', reads = 0;
  const api = handlers({ runtime: async () => ({ authorize: async () => { reads++; return { ...session, user: actor }; } }) });
  const pageRequest = () => new Request('http://public.example.invalid/partner');
  const firstPage = await api.initialData(pageRequest());
  assert.equal(firstPage.session.user, actor); assert.equal(firstPage.snapshot.viewer.user, actor);
  actor = 'internal-second';
  const secondResponse = await api.handle(request());
  assert.equal(secondResponse.status, 200);
  const second = await secondResponse.json();
  assert.deepEqual(second.viewer, { user: actor, accessClass: 'internal' });
  assert.notEqual(second.viewer.user, firstPage.snapshot.viewer.user);
  const secondPage = await api.initialData(pageRequest());
  assert.equal(secondPage.session.user, actor); assert.equal(secondPage.snapshot.viewer.user, actor);
  assert.equal(reads, 3);
});

test('SSR maps only known server-owned slugs and guards page transport before loading a snapshot', async () => {
  let calls = 0;
  const api = handlers({ runtime: async () => { calls++; return { authorize: async () => session }; } });
  const result = await api.initialData(new Request('http://public.example.invalid/studio/partner/demo-south/tables'), { operatorSlug: 'demo-south' });
  assert.equal(result.snapshot.operator.id, south);
  assert.equal(calls, 1);
  await assert.rejects(api.initialData(new Request('http://public.example.invalid/partner'), { operatorSlug: 'real-customer' }), error => error.statusCode === 404);
  await assert.rejects(api.initialData(new Request('http://public.example.invalid/partner'), { operatorSlug: 'operator-demo-north' }), error => error.statusCode === 404);
  await assert.rejects(api.initialData(new Request('http://public.example.invalid/partner'), { operatorId: north, operatorSlug: 'demo-north' }), error => error.statusCode === 400);
  await assert.rejects(api.initialData(new Request('http://evil.invalid/partner')), denied);
  await assert.rejects(api.initialData(new Request('http://public.example.invalid/api/partner-preview')), denied);
  await assert.rejects(api.initialData(new Request('http://public.example.invalid/partner', { headers: { origin: 'https://evil.invalid' } })), denied);
  await assert.rejects(api.initialData(new Request('http://public.example.invalid/unrelated')), error => error.statusCode === 404);
  assert.equal(calls, 1);
});

test('role/scope failures and private runtime errors expose no data; default adapter remains disabled', async () => {
  for (const [value, expected] of [[null, 401], [{ ...session, role: 'reader' }, 403], [{ ...session, role: 'staff' }, 403],
    [{ ...session, role: 'player' }, 403], [{ ...session, role: 'partner-admin' }, 403],
    [{ ...session, scope: { ...scope, workspaceId: 'other' } }, 403]]) {
    const response = await handlers({ runtime: async () => ({ authorize: async () => value }) }).handle(request());
    assert.equal(response.status, expected); assert.deepEqual(Object.keys(await response.json()), ['error']);
  }
  const privateFailure = await handlers({ runtime: async () => { throw Error('PRIVATE credential/query'); } }).handle(request());
  assert.equal(privateFailure.status, 503); assert.ok(!(await privateFailure.text()).includes('PRIVATE'));
  const disabled = createPartnerPreviewHandlers({ configuration: () => assert.fail('disabled must not inspect runtime configuration') });
  assert.equal((await disabled.handle(request())).status, 503);
  await assert.rejects(disabled.initialData(new Request('http://public.example.invalid/partner')), error => error.statusCode === 503);
});

test('actual Next route exports deny all mutation/HEAD/OPTIONS methods and configured origin failures before DB access', async () => {
  assert.equal(route.runtime, 'nodejs'); assert.equal(route.dynamic, 'force-dynamic');
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    const response = await route[method](request('', { method }));
    assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'GET');
    assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(await response.text(), '');
  }
  const changes = { CROUPIER_STUDIO_NATIVE_ADMIN: '1', CROUPIER_STUDIO_NEON_POLICY: '1',
    CROUPIER_PUBLIC_ORIGIN: publicOrigin, CROUPIER_LAB_UI_ORIGIN: labOrigin, CROUPIER_LAB_BASE_PATH: '/studio',
    CROUPIER_STUDIO_ENVIRONMENT_ID: 'fixture', CROUPIER_STUDIO_WORKSPACE_ID: 'croupier',
    CROUPIER_GAME_DATABASE_URL: fixtureDatabaseUrl('postgres://fixture.neon.tech/fixture?sslmode=require', 'fixture'), CROUPIER_ZONES_DATABASE_URL: undefined };
  const previous = Object.fromEntries(Object.keys(changes).map(key => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(changes)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    assert.equal((await route.GET(request('', { headers: { origin: 'https://evil.invalid' } }))).status, 403);
    assert.equal((await route.GET(request('?operator=customer-production'))).status, 400);
    delete process.env.CROUPIER_STUDIO_NATIVE_ADMIN;
    const disabled = await route.GET(request());
    assert.equal(disabled.status, 503); assert.deepEqual(await disabled.json(), { error: 'partner_preview_unavailable' });
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
