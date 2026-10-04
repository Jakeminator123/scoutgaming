import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { createOpenClawAdminApi } from '../lib/openclaw-admin.mjs';
import { createStudioNativeAuth } from '../lib/studio-native-auth.mjs';
import { nativeStudioAdminConfiguration } from '../lib/studio-native-runtime.mjs';

const publicOrigin = 'https://public.example.invalid', labOrigin = 'https://studio.example.invalid';
const config = nativeStudioAdminConfiguration({ CROUPIER_STUDIO_NATIVE_ADMIN:'1', CROUPIER_STUDIO_NEON_POLICY:'1',
  CROUPIER_PUBLIC_ORIGIN:publicOrigin, CROUPIER_LAB_UI_ORIGIN:labOrigin, CROUPIER_LAB_BASE_PATH:'/studio',
  CROUPIER_STUDIO_ENVIRONMENT_ID:'fixture', CROUPIER_STUDIO_WORKSPACE_ID:'croupier',
  CROUPIER_GAME_DATABASE_URL:'postgres://fixture:fixture@fixture.neon.tech/fixture?sslmode=require' });
const scope = { environment:'fixture', workspaceId:'croupier' }, key = 'fixturepass';
const model = { primary:'lab-provider/model-one', fallbacks:['lab-provider/model-two'] };
const snapshot = { version:1, baseHash:'hmac-sha256:v1:fixture', gateway:{ connected:true, version:'2026.9.5', applied:true },
  agents:[{ id:'croupier-director', model }], models:[{ id:model.primary, provider:'lab-provider' }, { id:model.fallbacks[0], provider:'lab-provider' }] };
const patch = { version:1, baseHash:snapshot.baseHash, agentId:'croupier-director', model };
const request = (method = 'GET', body = patch, headers = {}, url = `${publicOrigin}/studio/api/openclaw/admin`) => new Request(url, {
  method, headers:{ cookie:'bo_jwt=synthetic-session', ...(method === 'PATCH' ? { origin:publicOrigin, 'sec-fetch-site':'same-origin', 'content-type':'application/json' } : {}), ...headers },
  ...(method === 'PATCH' ? { body:JSON.stringify(body) } : {}) });
function fixture({ authorize = async () => ({ user:'operator', role:'admin', scope }), response = snapshot, status = 200, settings, transport } = {}) {
  const calls = [];
  const api = createOpenClawAdminApi({ config, authorize, settings:settings ?? (() => ({ remoteUrl:'https://croupier-lab-director.onrender.com', gatewayKey:key, remoteToken:'synthetic-runtime-token' })),
    fetchImpl:async (url, options) => { calls.push({ url, options }); if (transport) return transport(url, options);
      return Response.json(response, { status }); } });
  return { api, calls };
}

test('authorized native admin reads only projected fields and sends no browser cookies to canonical Director', async () => {
  const f = fixture({ response:{ ...snapshot, password:key, config:{ providerKey:'PRIVATE_PROVIDER_KEY' }, gateway:{ ...snapshot.gateway, deviceToken:'PRIVATE_DEVICE_TOKEN' },
    models:snapshot.models.map(value => ({ ...value, apiKey:'PRIVATE_PROVIDER_KEY' })) } });
  const result = await f.api.handle(request());
  assert.equal(result.status, 200); assert.deepEqual(await result.json(), snapshot);
  assert.equal(f.calls[0].url, 'https://croupier-lab-director.onrender.com/api/studio/openclaw/admin');
  assert.deepEqual(f.calls[0].options.headers, { Authorization:`Bearer ${key}` });
  assert.equal(f.calls[0].options.redirect, 'error'); assert.equal(f.calls[0].options.cache, 'no-store');
  assert.equal(result.headers.get('cache-control'), 'private, no-store');
});

test('real native JWT is rechecked against account password fingerprint and epoch before remote access', async () => {
  const now = 2000000, secret = 'a'.repeat(64), user = { id:'7', username:'operator', salt:'fixture-salt', hash:'c'.repeat(128), role:'admin' };
  let epoch = 2;
  const stamp = () => createHash('sha256').update(`${user.salt}:${user.hash}`).digest('hex');
  const boDb = { prepare(sql) { return { async all() { return [user]; }, async get() {
    if (sql.includes('FROM meta')) return { v:secret };
    if (sql.includes('FROM bo_auth_epochs')) return { epoch };
    return user;
  } }; } };
  const authorize = createStudioNativeAuth({ boDb, scope, now:() => now });
  const pieces = [{ alg:'HS256', typ:'JWT' }, { aud:'backoffice', sub:user.username, role:'admin', source_stamp:stamp(), auth_epoch:epoch, exp:(now + 60000) / 1000 }]
    .map(value => Buffer.from(JSON.stringify(value)).toString('base64url'));
  const token = `${pieces.join('.')}.${createHmac('sha256', Buffer.from(secret, 'hex')).update(pieces.join('.')).digest('base64url')}`;
  const f = fixture({ authorize });
  assert.equal((await f.api.handle(request('GET', null, { cookie:`bo_jwt=${token}` }))).status, 200);
  epoch++;
  assert.equal((await f.api.handle(request('GET', null, { cookie:`bo_jwt=${token}` }))).status, 401);
  assert.equal(f.calls.length, 1);
});

test('unknown, player and missing sessions cannot read or write administration', async () => {
  for (const role of ['__proto__', 'owner', 'player', 'staff', 'reader', null]) for (const method of ['GET', 'PATCH']) {
    const f = fixture({ authorize:async () => role ? { user:'operator', role, scope } : null });
    assert.equal((await f.api.handle(request(method))).status, role ? 403 : 401); assert.equal(f.calls.length, 0);
  }
});

test('PATCH requires exact same-origin JSON and revalidates session after input before transport', async () => {
  for (const headers of [{ origin:'https://foreign.invalid' }, { origin:'' }, { 'sec-fetch-site':'cross-site' }, { 'sec-fetch-site':'' }, { 'content-type':'text/plain' }]) {
    const f = fixture(); assert.ok([403,415].includes((await f.api.handle(request('PATCH', patch, headers))).status)); assert.equal(f.calls.length, 0);
  }
  let checks = 0;
  const f = fixture({ authorize:async () => ({ user:'operator', role:++checks === 1 ? 'admin' : 'reader', scope }) });
  assert.equal((await f.api.handle(request('PATCH'))).status, 403); assert.equal(f.calls.length, 0);
});

test('public rewrite preserves authenticated cookie and CSRF origin for only exact admin namespace', async () => {
  const f = fixture({ response:{ saved:true, baseHash:'hmac-sha256:v1:next', agentId:patch.agentId, model, restartScheduled:false, verifiedAt:'2026-10-05T00:00:00.000Z' } });
  const headers = { host:new URL(labOrigin).host, 'x-forwarded-host':new URL(publicOrigin).host, 'x-forwarded-proto':'https' };
  assert.equal((await f.api.handle(request('PATCH', patch, headers, `${labOrigin}/api/openclaw/admin`))).status, 200);
  assert.deepEqual(JSON.parse(f.calls[0].options.body), patch);
  for (const url of [`${publicOrigin}/studio/api/openclaw/admin?url=https://foreign.invalid`, `${publicOrigin}/api/admin/config`, 'https://foreign.invalid/studio/api/openclaw/admin']) {
    const denied = fixture(); assert.ok([403,404].includes((await denied.api.handle(request('GET', null, {}, url))).status)); assert.equal(denied.calls.length, 0);
  }
});

test('field allowlist rejects credential/proxy/actor/tool edits before transport', async () => {
  for (const body of [{ ...patch, actor:'admin' }, { ...patch, url:'https://foreign.invalid' }, { ...patch, gateway:{ auth:{ password:'private' } } },
    { ...patch, agentId:'other-agent' }, { ...patch, model:{ ...model, tools:['*'] } }, { ...patch, model:{ primary:model.primary, fallbacks:[model.primary] } }]) {
    const f = fixture(); assert.equal((await f.api.handle(request('PATCH', body))).status, 400); assert.equal(f.calls.length, 0);
  }
});

test('wrong Director, missing key and shared runtime/admin key fail closed without calls', async () => {
  for (const value of [{ remoteUrl:'https://foreign.invalid', gatewayKey:key }, { remoteUrl:'https://croupier-lab-director.onrender.com', gatewayKey:'' },
    { remoteUrl:'https://croupier-lab-director.onrender.com', gatewayKey:key, remoteToken:key }]) {
    const f = fixture({ settings:() => value }); assert.equal((await f.api.handle(request())).status, 503); assert.equal(f.calls.length, 0);
  }
});

test('native production accepts existing 11-character Gateway password with empty retired remote settings', async () => {
  assert.equal(key.length, 11);
  const f = fixture({ settings:() => ({ remoteUrl:'', remoteToken:'', gatewayKey:key }) });
  assert.equal((await f.api.handle(request())).status, 200);
  assert.equal(f.calls[0].url, 'https://croupier-lab-director.onrender.com/api/studio/openclaw/admin');
  assert.deepEqual(f.calls[0].options.headers, { Authorization:`Bearer ${key}` });
});

test('password contract trims outer whitespace and rejects empty or multiline credentials', async () => {
  const trimmed = fixture({ settings:() => ({ remoteUrl:'', remoteToken:'', gatewayKey:` ${key} ` }) });
  assert.equal((await trimmed.api.handle(request())).status, 200);
  assert.deepEqual(trimmed.calls[0].options.headers, { Authorization:`Bearer ${key}` });
  for (const gatewayKey of ['', '   ', `${key}\n`]) {
    const f = fixture({ settings:() => ({ remoteUrl:'', remoteToken:'', gatewayKey }) });
    assert.equal((await f.api.handle(request())).status, 503); assert.equal(f.calls.length, 0);
  }
});

test('conflict and pairing errors are safe; upstream secrets and lost mutation acknowledgement never leak or retry', async () => {
  for (const [status, body, expected] of [[409, { error:'openclaw_admin_conflict', secret:key }, 'openclaw_admin_conflict'],
    [503, { error:'openclaw_admin_pairing_required', message:key }, 'openclaw_admin_pairing_required'],
    [500, { error:key, message:'PRIVATE_PROVIDER_KEY' }, 'openclaw_admin_unavailable']]) {
    const f = fixture({ response:body, status }), result = await f.api.handle(request('PATCH'));
    assert.deepEqual(await result.json(), { error:expected }); assert.equal(f.calls.length, 1);
  }
  const lost = fixture({ transport:async () => { throw Error(key); } });
  assert.deepEqual(await (await lost.api.handle(request('PATCH'))).json(), { error:'openclaw_admin_save_uncertain' });
  assert.equal(lost.calls.length, 1);
});

test('oversized and invalid UTF8 input is rejected before any remote mutation', async () => {
  const f = fixture();
  assert.equal((await f.api.handle(request('PATCH', { ...patch, padding:'x'.repeat(40000) }))).status, 413);
  const malformed = new Request(`${publicOrigin}/studio/api/openclaw/admin`, { method:'PATCH', headers:{ origin:publicOrigin, 'sec-fetch-site':'same-origin', 'content-type':'application/json' }, body:Uint8Array.from([0xff]) });
  assert.equal((await f.api.handle(malformed)).status, 400); assert.equal(f.calls.length, 0);
});
