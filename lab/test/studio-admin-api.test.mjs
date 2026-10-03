import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioAdminApi } from '../lib/studio-admin-api.mjs';
const origin = 'https://studio.example';
const path = action => `/studio/api/admin/${action}`;
const session = { user: 'Jakob', role: 'superadmin', scope: { environment: 'isolated-fixture', workspaceId: 'qa' } };
function api(options = {}) { return createStudioAdminApi({ authorize: async () => session, mutationTransaction: work => work(), allowedOrigins: [origin], publicHosts: ['studio.example'], handlers: new Map([['GET ' + path('players'), () => ({ players: [] })], ['POST ' + path('room'), context => ({ actor: context.actor, scope: context.scope })]]), ...options }); }
function request(action = 'room', options = {}) { return new Request(origin + path(action), { method: 'POST', headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' }, body: '{}', ...options }); }

test('exact contract routing, unavailable handler and private safe errors', async () => {
  const handler = api();
  for (const [url, method, status] of [[path('unknown'), 'GET', 404], [path('room') + '/', 'GET', 404], [path('room'), 'PUT', 405], [path('config'), 'GET', 503]]) {
    const response = await handler.handle(new Request(origin + url, { method }));
    assert.equal(response.status, status); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  assert.throws(() => api({ handlers: new Map([['GET /other', () => ({})]]) }), /Unknown admin handler/);
  const response = await api({ authorize() { throw new Error('private db password'); } }).handle(new Request(origin + path('players')));
  assert.equal(response.status, 500); assert.doesNotMatch(await response.text(), /password/);
});

test('local API base only replaces the exact canonical prefix', async () => {
  const local = api({ apiBase: '/api/admin' });
  assert.equal((await local.handle(new Request(origin + '/api/admin/players'))).status, 200);
  for (const route of ['/studio/api/admin/players', '/api/admin/players?token=x', '/api/admin/%70layers', '/api/admin/players/']) assert.equal((await local.handle(new Request(origin + route))).status, 404);
  assert.throws(() => api({ apiBase: '/anything' }), /Invalid admin API base/);
});

test('live authorization and explicit role floor deny players and reader writes', async () => {
  for (const principal of [null, { user: '', role: 'admin' }]) assert.equal((await api({ authorize: () => principal }).handle(request())).status, 401);
  const reader = api({ authorize: () => ({ user: 'r', role: 'reader', scope: session.scope }) });
  assert.equal((await reader.handle(request())).status, 403);
  assert.deepEqual(reader.availableActions({ user: 'r', role: 'reader' }), []);
  assert.equal((await reader.handle(new Request(origin + path('players')))).status, 403);
});

test('host and browser-origin spoofing cannot invoke a write', async () => {
  for (const headers of [{ origin: 'https://evil.example' }, { origin, 'sec-fetch-site': 'cross-site' }, { origin, 'sec-fetch-site': 'same-site' }, { origin, 'sec-fetch-site': 'same-origin', host: 'evil.example' }, { origin, 'sec-fetch-site': 'same-origin', 'x-forwarded-host': 'evil.example' }, { origin }, {}]) {
    assert.equal((await api().handle(request('room', { headers: { 'content-type': 'application/json', ...headers } }))).status, 403);
  }
  assert.equal((await api().handle(new Request('https://evil.example' + path('players')))).status, 403);
});

test('bounded strict UTF8 object JSON and server-owned actor/scope', async () => {
  for (const body of ['null', '[]', 'true', '{bad}', '{"actor":"spoof"}', '{"scope":"spoof"}']) assert.equal((await api().handle(request('room', { body }))).status, 400);
  assert.equal((await api().handle(request('room', { body: new Uint8Array([0xc3, 0x28]) }))).status, 400);
  assert.equal((await api().handle(request('room', { body: JSON.stringify({ text: 'x'.repeat(65536) }) }))).status, 413);
  assert.equal((await api().handle(request('room', { headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'text/plain' } }))).status, 415);
  const result = await (await api().handle(request())).json();
  assert.deepEqual(result, { actor: { user: 'Jakob', role: 'admin' }, scope: session.scope });
});

test('extra requirements need explicit gates for capabilities and execution', async () => {
  let invoked = 0;
  const handlers = new Map([['POST ' + path('players/status'), () => { invoked++; return { ok: true }; }]]);
  assert.deepEqual(api({ handlers }).availableActions(session), []);
  assert.equal((await api({ handlers }).handle(request('players/status'))).status, 503);
  const gates = new Map([['player-lifecycle-and-ledger', () => true], ['cancel-player-runtime', () => false]]);
  const guarded = api({ handlers, gates });
  assert.deepEqual(guarded.availableActions(session), ['POST players/status']);
  assert.equal((await guarded.handle(request('players/status'))).status, 403);
  assert.equal(invoked, 0);
  gates.set('cancel-player-runtime', () => true);
  assert.equal((await api({ handlers, gates }).handle(request('players/status'))).status, 200);
  assert.equal(invoked, 1);
});

test('self-role and self-removal remain denied even with generic approving gates', async () => {
  const handlers = new Map(['users/role', 'users/remove'].map(action => ['POST ' + path(action), () => ({ ok: true })]));
  const gates = new Map(['forbid-self-role-change', 'forbid-self-removal', 'revoke-changed-identity'].map(key => [key, () => true]));
  for (const action of ['users/role', 'users/remove']) assert.equal((await api({ handlers, gates }).handle(request(action, { body: JSON.stringify({ username: ' JAKOB ', role: 'reader' }) }))).status, 403);
  assert.equal((await api({ handlers, gates }).handle(request('users/role', { body: '{"username":"other","role":"player"}' }))).status, 400);
});

test('registrations are snapshotted, undefined cannot claim success and every call validates session', async () => {
  let calls = 0;
  const handlers = new Map([['GET ' + path('players'), () => undefined]]);
  const configured = api({ handlers, authorize: () => { calls++; if (calls > 1) throw Object.assign(new Error('private revoked details'), { statusCode: 401 }); return session; } });
  handlers.set('GET ' + path('players'), () => ({ fake: true }));
  assert.equal((await configured.handle(new Request(origin + path('players')))).status, 503);
  const revoked = await configured.handle(new Request(origin + path('players')));
  assert.equal(revoked.status, 401);
  assert.deepEqual(await revoked.json(), { error: 'Authentication required' });
  assert.equal(calls, 2);
});

test('storage validation and busy errors keep safe status messages and scope is a frozen snapshot', async () => {
  for (const statusCode of [422, 423]) {
    const response = await api({ handlers: new Map([['GET ' + path('players'), () => { throw Object.assign(new Error('private schema detail'), { statusCode }); }]]) }).handle(new Request(origin + path('players')));
    assert.equal(response.status, statusCode);
    assert.doesNotMatch(await response.text(), /private|schema/);
  }
  const scope = { ...session.scope };
  const response = await api({ authorize: () => ({ ...session, scope }), handlers: new Map([['GET ' + path('players'), context => {
    scope.workspaceId = 'changed';
    assert.equal(context.scope.workspaceId, 'qa');
    assert.equal(Object.isFrozen(context.scope), true);
    return { ok: true };
  }]]) }).handle(new Request(origin + path('players')));
  assert.equal(response.status, 200);
  assert.equal((await api({ authorize: () => ({ ...session, scope: {} }) }).handle(new Request(origin + path('players')))).status, 422);
});

test('local writes are unavailable without an explicit mutation transaction', async () => {
  const configured = api({ mutationTransaction: undefined });
  assert.deepEqual(configured.availableActions(session), ['GET players']);
  assert.equal((await configured.handle(request())).status, 503);
});

test('revocation while the request body is pending cannot execute a local mutation', async () => {
  let principal = session, writer, authorizations = 0, invoked = 0, bodyPending;
  const waiting = new Promise(resolve => { bodyPending = resolve; });
  const configured = api({ authorize: () => { authorizations++; bodyPending(); return principal; },
    handlers: new Map([['POST ' + path('room'), () => { invoked++; return { ok: true }; }]]) });
  const body = new ReadableStream({ start(controller) { writer = controller; } });
  const pending = configured.handle(request('room', { body, duplex: 'half' }));
  await waiting;
  principal = { ...session, role: 'reader' };
  writer.enqueue(new TextEncoder().encode('{}')); writer.close();
  assert.equal((await pending).status, 403);
  assert.equal(invoked, 0); assert.equal(authorizations, 2);
});

test('identity and scope are checked again after gates while holding the product transaction', async () => {
  for (const replacement of [{ ...session, role: 'reader' }, { ...session, user: 'other' },
    { ...session, scope: { ...session.scope, workspaceId: 'other' } }, null]) {
    let principal = session, locked = false, invoked = 0, checks = 0;
    const configured = api({ authorize: () => { checks++; return principal; },
      mutationTransaction: async work => { locked = true; principal = replacement; try { return await work(); } finally { locked = false; } },
      handlers: new Map([['POST ' + path('players/create'), () => { invoked++; assert.equal(locked, true); return { ok: true }; }]]),
      gates: new Map([['player-lifecycle-and-ledger', () => true]]) });
    assert.equal((await configured.handle(request('players/create'))).status, replacement === null ? 401 : 403);
    assert.equal(invoked, 0); assert.equal(checks, 3);
  }
  let checks = 0, locked = false;
  const configured = api({ authorize: () => { checks++; if (checks === 3) assert.equal(locked, true); return session; },
    mutationTransaction: async work => { locked = true; try { return await work(); } finally { locked = false; } },
    handlers: new Map([['POST ' + path('room'), () => { assert.equal(locked, true); return { ok: true }; }]]) });
  assert.equal((await configured.handle(request())).status, 200); assert.equal(checks, 3);
});

test('Render-authoritative operations refresh session without holding a local DB transaction', async () => {
  let invoked = 0;
  const configured = api({ mutationTransaction: () => { throw Error('Render HTTP must remain outside the product transaction'); },
    handlers: new Map([['POST ' + path('apikeys/credit'), () => { invoked++; return { ok: true }; }]]),
    gates: new Map([['game-authority', () => true]]) });
  assert.equal((await configured.handle(request('apikeys/credit'))).status, 200); assert.equal(invoked, 1);
});
