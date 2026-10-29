import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioAdminApi } from '../lib/studio-admin-api.mjs';
import { StudioStorageError } from '../../../packages/studio-access/studio-scope.mjs';
import { wrapNativePresentationRepository, PRESENTATION_RUNTIME_UPDATE_REQUIRED, PRESENTATION_RUNTIME_UPDATE_MESSAGE } from '../lib/presentation-runtime-readiness.mjs';
const origin = 'https://studio.example';
const path = action => `/studio/api/admin/${action}`;
const session = { user: 'Jakob', role: 'superadmin', scope: { environment: 'isolated-fixture', workspaceId: 'qa' } };
function api(options = {}) { return createStudioAdminApi({ authorize: async () => session, mutationTransaction: work => work(), allowedOrigins: [origin], publicHosts: ['studio.example'], handlers: new Map([['GET ' + path('players'), () => ({ players: [] })], ['POST ' + path('tier'), context => ({ actor: context.actor, scope: context.scope })]]), ...options }); }
function request(action = 'tier', options = {}) { return new Request(origin + path(action), { method: 'POST', headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' }, body: '{}', ...options }); }

test('exact contract routing, unavailable handler and private safe errors', async () => {
  const handler = api();
  for (const [url, method, status] of [[path('unknown'), 'GET', 404], [path('tier') + '/', 'GET', 404], [path('tier'), 'PUT', 405], [path('config'), 'GET', 503]]) {
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

test('successful reads publish only their freshly authorized encoded username and canonical role in private headers', async () => {
  let current = { ...session, user: 'Jåкob+qa@example.test' }, checks = 0;
  const configured = api({ authorize: () => { checks++; return current; } });
  for (const username of [current.user, 'other@example.test']) {
    current = { ...current, user: username };
    const response = await configured.handle(new Request(origin + path('players')));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Croupier-Studio-Actor'), encodeURIComponent(username));
    assert.equal(response.headers.get('X-Croupier-Studio-Role'), 'admin');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await response.json(), { players: [] }, 'identity metadata never widens the data payload');
  }
  assert.equal(checks, 2, 'every read authorizes afresh');
  const post = await configured.handle(request());
  assert.equal(post.status, 200);
  assert.equal(post.headers.get('X-Croupier-Studio-Actor'), null);
  assert.equal(post.headers.get('X-Croupier-Studio-Role'), null);
  current = { ...current, role: 'reader' };
  const denied = await configured.handle(new Request(origin + path('players')));
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('X-Croupier-Studio-Actor'), null);
  assert.equal(denied.headers.get('X-Croupier-Studio-Role'), null);
  assert.equal(current.role, 'reader', 'metadata cannot promote a stored legacy role');
});

test('unsafe read identity cannot invoke a handler or produce metadata', async () => {
  for (const user of ['x'.repeat(255), 'user\nname', 'user\u0085name', '\ud800']) {
    let invoked = 0;
    const configured = api({ authorize: () => ({ ...session, user }), handlers: new Map([['GET ' + path('players'), () => { invoked++; return { players: [] }; }]]) });
    const response = await configured.handle(new Request(origin + path('players')));
    assert.equal(response.status, 403);
    assert.equal(invoked, 0);
    assert.equal(response.headers.get('X-Croupier-Studio-Actor'), null);
    assert.equal(response.headers.get('X-Croupier-Studio-Role'), null);
  }
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
    assert.equal((await api().handle(request('tier', { headers: { 'content-type': 'application/json', ...headers } }))).status, 403);
  }
  assert.equal((await api().handle(new Request('https://evil.example' + path('players')))).status, 403);
});

test('bounded strict UTF8 object JSON and server-owned actor/scope', async () => {
  for (const body of ['null', '[]', 'true', '{bad}', '{"actor":"spoof"}', '{"scope":"spoof"}']) assert.equal((await api().handle(request('tier', { body }))).status, 400);
  assert.equal((await api().handle(request('tier', { body: new Uint8Array([0xc3, 0x28]) }))).status, 400);
  assert.equal((await api().handle(request('tier', { body: JSON.stringify({ text: 'x'.repeat(65536) }) }))).status, 413);
  assert.equal((await api().handle(request('tier', { headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'text/plain' } }))).status, 415);
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

// Captures console.error for one async block and restores it.
async function capturedErrors(work) {
  const original = console.error, lines = []; console.error = (...args) => { lines.push(args); };
  try { return { result: await work(), lines }; } finally { console.error = original; }
}
// Assembled at runtime so secret scanners never see a literal credential URI in the fixture.
const secretMessage = 'connect failed ' + ['postgres:/', 'fixture-user:fixture-pass@db.example.neon.tech', 'fixture'].join('/') + ' for owner@example.invalid token=fixture-token';

test('opaque 503/500 handler failures log one redacted line and expose only a fixed storage code', async () => {
  const cases = [
    [() => { const error = new StudioStorageError('studio_storage_unavailable', 503); error.detail = 'private provider detail'; throw error; }, 503, { error: 'Action unavailable', code: 'studio_storage_unavailable' }, 'StudioStorageError'],
    [() => { throw new StudioStorageError('studio_storage_unavailable', 500); }, 500, { error: 'Request failed', code: 'studio_storage_unavailable' }, 'StudioStorageError'],
    [() => { throw Object.assign(new Error(secretMessage, { cause: Object.assign(new Error(secretMessage), { code: 'ECONNREFUSED' }) }), { statusCode: 503, code: 'studio_storage_unavailable' }); }, 503, { error: 'Action unavailable' }, 'Error'],
    [() => { throw new Error(secretMessage); }, 500, { error: 'Request failed' }, 'Error'],
  ];
  for (const [handler, status, body, name] of cases) {
    const { result, lines } = await capturedErrors(async () => {
      const response = await api({ handlers: new Map([['POST ' + path('tier'), handler]]) }).handle(request('tier', { body: '{"secret":"fixture-body"}', headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', cookie: 'session=fixture-cookie' } }));
      return [response.status, await response.json()];
    });
    assert.deepEqual(result, [status, body]); assert.equal(lines.length, 1); assert.equal(lines[0].length, 1);
    const raw = lines[0][0], line = JSON.parse(raw);
    assert.deepEqual(Object.keys(line), ['studioNativeError', 'code', 'name', 'message', 'route', 'method', 'stack', 'cause']);
    assert.equal(line.studioNativeError, true); assert.equal(line.name, name); assert.equal(line.route, 'tier'); assert.equal(line.method, 'POST');
    assert.ok(line.stack.length > 0 && line.stack.length <= 8 && line.stack.every(frame => frame.startsWith('at ')));
    for (const secret of ['fixture-pass', 'fixture-user', 'neon.tech', 'owner@example', 'fixture-token', 'fixture-body', 'fixture-cookie', 'private provider detail', 'Jakob']) assert.equal(raw.includes(secret), false, secret);
    if (name === 'Error') assert.match(line.message, /^connect failed \[url\] for \[email\] token=\[redacted\]$/);
  }
  const { lines } = await capturedErrors(async () => {
    for (const statusCode of [409, 422]) await api({ handlers: new Map([['POST ' + path('tier'), () => { throw new StudioStorageError('studio_storage_unavailable', statusCode); }]]) }).handle(request());
  });
  assert.deepEqual(lines, []);
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
    handlers: new Map([['POST ' + path('tier'), () => { invoked++; return { ok: true }; }]]) });
  const body = new ReadableStream({ start(controller) { writer = controller; } });
  const pending = configured.handle(request('tier', { body, duplex: 'half' }));
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
    handlers: new Map([['POST ' + path('tier'), () => { assert.equal(locked, true); return { ok: true }; }]]) });
  assert.equal((await configured.handle(request())).status, 200); assert.equal(checks, 3);
});

test('Render-authoritative operations refresh session without holding a local DB transaction', async () => {
  let invoked = 0;
  const configured = api({ mutationTransaction: () => { throw Error('Render HTTP must remain outside the product transaction'); },
    handlers: new Map([['POST ' + path('apikeys/credit'), () => { invoked++; return { ok: true }; }]]),
    gates: new Map([['game-authority', () => true]]) });
  assert.equal((await configured.handle(request('apikeys/credit'))).status, 200); assert.equal(invoked, 1);
});

test('authenticated Nora lane creation requires preflight before product SQL and preserves state on old Render', async () => {
  for (const absent of [() => new Response(null,{status:404}), () => new Response(null,{status:503}), () => Response.json({schemaVersion:0})]) {
    let state={gameLane:'mobile-phone',gameLanes:[{id:'mobile-phone',dealer:'astrid'}]}, writes=0, fetches=0, inside=false, current=session, ready=false;
    const before=structuredClone(state);
    const repository={
      async saveDocument(_kind,options){assert.equal(inside,true);writes++;state=structuredClone(options.value);return{revision:'studio-next'};},
      transaction:work=>work(repository),
    };
    const wrapped=wrapNativePresentationRepository(repository,{env:{CROUPIER_BACKEND_ORIGIN:'https://render.example.invalid'},fetchImpl:async()=>{
      assert.equal(inside,false,'no capability HTTP while SQL is active');fetches++;
      return ready ? Response.json({schemaVersion:1,registeredDealerIds:['nora'],compositing:'per-clip'}) : absent();
    }});
    const configured=api({authorize:()=>current,handlers:new Map([['POST '+path('game-lanes/create'),async context=>{
      const value=structuredClone(state);value.gameLanes.push(context.body.definition);
      return wrapped.transaction(repo=>repo.saveDocument('administration',{value,actor:context.actor.user}),
        {presentationMutation:{kind:'administration',value}});
    }]]),mutationTransaction:async(work,options)=>{
      assert.deepEqual(options.presentationDocuments,['administration']);
      const descriptors=[{kind:'administration',value:structuredClone(state)},options.presentationMutation];
      return wrapped.withMutationContext(async()=>{
        inside=true;try{return await work();}finally{inside=false;}
      },descriptors);
    }});
    const body=JSON.stringify({definition:{schemaVersion:1,id:'nora-room',label:'Nora',renderer:'portrait-video',dealer:'nora',mediaCollection:'nora-presentation'}});
    current={...session,role:'reader'};
    assert.equal((await configured.handle(request('game-lanes/create',{body}))).status,403);
    assert.equal(fetches,0);assert.equal(writes,0);
    current=session;
    const denied=await configured.handle(request('game-lanes/create',{body}));
    assert.equal(denied.status,503);
    assert.deepEqual(await denied.json(),{error:PRESENTATION_RUNTIME_UPDATE_MESSAGE,code:PRESENTATION_RUNTIME_UPDATE_REQUIRED});
    assert.deepEqual(state,before);assert.equal(writes,0);assert.equal(fetches,1);
    ready=true;
    assert.equal((await configured.handle(request('game-lanes/create',{body}))).status,200);
    assert.equal(writes,1);assert.equal(fetches,2);assert.equal(state.gameLanes.at(-1).dealer,'nora');
  }
});

test('room game config writes negotiate the administration draft field before product SQL', async () => {
  for (const action of ['save-draft', 'publish']) {
    let seen = null, inside = false;
    const configured = api({ handlers: new Map([['POST ' + path('room-game-config'), () => { assert.equal(inside, true); return { ok: true }; }]]),
      mutationTransaction: async (work, options) => { seen = options; inside = true; try { return await work(); } finally { inside = false; } } });
    const response = await configured.handle(request('room-game-config', { body: JSON.stringify({ action, operatorId: 'north', roomId: 'room-1' }) }));
    assert.equal(response.status, 200);
    assert.deepEqual(seen.presentationDocuments, ['project', 'administration']);
    assert.deepEqual(seen.presentationMutation, [{ kind: 'administration', value: { roomGameConfigs: [] } }, ...(action==='publish'?[{kind:'native-film-planning',value:{}}]:[])]);
    assert.deepEqual(seen.presentationOperatorIds, action === 'publish' ? ['north'] : undefined);
  }
});

test('trusted preparation verifies provider data outside product SQL and supplies only server context to the locked handler', async () => {
  let inside = false, prepared = 0, invoked = 0;
  const proof = Object.freeze({ presentation: Object.freeze({ schemaVersion: 2, registeredDealers: [] }), source: 'server-capture' });
  const key = 'POST ' + path('operator-package');
  const configured = api({ handlers: new Map([[key, context => {
    assert.equal(inside, true); assert.equal(context.prepared, proof); assert.equal(context.body.prepared, 'untrusted-request');
    invoked++; return { ok: true };
  }]]), preparations: new Map([[key, async context => {
    assert.equal(inside, false); assert.equal(Object.hasOwn(context, 'prepared'), false); prepared++; await Promise.resolve(); return proof;
  }]]), mutationTransaction: async (work, options) => {
    assert.equal(options.presentationMutation.value, proof.presentation, 'format features come from the trusted frozen capture');
    inside = true; try { return await work(); } finally { inside = false; }
  } });
  const response = await configured.handle(request('operator-package', { body: JSON.stringify({ operatorId: 'north', lanes: ['vip'], prepared: 'untrusted-request' }) }));
  assert.equal(response.status, 200); assert.equal(prepared, 1); assert.equal(invoked, 1);
});

test('authorization revocation after provider preparation is rechecked under the product lock and never invokes the writer', async () => {
  for (const change of ['identity', 'role', 'scope']) {
    let principal = session, inside = false, writes = 0;
    const key = 'POST ' + path('operator-package');
    const configured = api({ authorize: () => principal, handlers: new Map([[key, () => { writes++; return { ok: true }; }]]),
      preparations: new Map([[key, async () => {
        assert.equal(inside, false);
        principal = change === 'identity' ? { ...session, user: 'another' } : change === 'role' ? { ...session, role: 'reader' } : { ...session, scope: { ...session.scope, workspaceId: 'foreign' } };
        return { presentation: { schemaVersion: 1 } };
      }]]), mutationTransaction: async work => { inside = true; try { return await work(); } finally { inside = false; } } });
    assert.equal((await configured.handle(request('operator-package'))).status, 403); assert.equal(writes, 0);
  }
});

test('preparation registration cannot widen the route contract and request denial precedes provider work', async () => {
  const key = 'POST ' + path('tier'); let preparations = 0;
  for (const invalid of [new Map([['GET ' + path('players'), () => ({})]]), new Map([['POST ' + path('unknown'), () => ({})]]),
    new Map([['POST ' + path('apikeys/credit'), () => ({})]]), new Map([[key, null]])]) {
    assert.throws(() => api({ preparations: invalid }), /Unknown admin preparation/);
  }
  const entries = new Map([[key, () => { preparations++; return { server: true }; }]]), configured = api({ preparations: entries });
  entries.set(key, () => { throw Error('Caller cannot replace snapshotted preparation'); });
  assert.equal((await configured.handle(request('tier', { headers: { origin: 'https://evil.example', 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' } }))).status, 403);
  assert.equal(preparations, 0); assert.equal((await configured.handle(request())).status, 200); assert.equal(preparations, 1);
});
