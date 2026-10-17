import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLabServer } from '../src/server.mjs';
import { createStudioOpenClawAdmin } from '../src/studio-admin.mjs';
import { validateOpenClawAdminPatch, STUDIO_OPENCLAW_ADMIN_PATH } from '../../../packages/director/studio-admin-contract.mjs';
import { readSettings } from '../src/settings.mjs';

const model = { primary:'lab-provider/model-one', fallbacks:['lab-provider/model-two'] };
const patch = { version:1, baseHash:'hmac-sha256:v1:before', agentId:'croupier-director', model:{ primary:'lab-provider/model-two', fallbacks:[] } };
const source = () => ({ valid:true, hash:patch.baseHash, configRevisionHash:'resolved-before', appliedConfigHash:'resolved-before', config:{
  agents:{ entries:{ 'croupier-director':{ model, tools:{ deny:['*'] } }, 'other-agent':{ model } } },
  gateway:{ auth:{ password:'PRIVATE_GATEWAY_SECRET' } },
  models:{ providers:{ 'lab-provider':{ apiKey:'PRIVATE_PROVIDER_SECRET', baseUrl:'https://private-provider.invalid', models:[{ id:'model-one' }, { id:'model-two' }] } } },
} });
function fixture({ snapshot = source(), acknowledge, gate } = {}) {
  const calls = [];
  const service = createStudioOpenClawAdmin({ now:() => 1, rpc:async (_, work) => work({ version:'2026.9.5', call:async (method, params) => {
    calls.push({ method, params });
    if (method === 'config.get') return structuredClone(snapshot);
    if (gate) await gate;
    return acknowledge ?? { ok:true, hash:'hmac-sha256:v1:after', restart:{ ok:true }, config:{ agents:{ entries:{ [patch.agentId]:{ model:patch.model } } } } };
  } }) });
  return { service, calls };
}

test('GET exposes actual configured agent/model choices without secrets, arbitrary agents or provider/model calls', async () => {
  const f = fixture(), output = await f.service.get({});
  assert.deepEqual(output.agents, [{ id:'croupier-director', model }]);
  assert.equal(output.gateway.applied, true); assert.equal(output.gateway.version, '2026.9.5');
  assert.deepEqual(output.models, [{ id:'lab-provider/model-one', provider:'lab-provider' }, { id:'lab-provider/model-two', provider:'lab-provider' }]);
  assert.doesNotMatch(JSON.stringify(output), /PRIVATE|baseUrl|tools|other-agent|password|apiKey/);
  assert.deepEqual(f.calls.map(value => value.method), ['config.get']);
});

test('PATCH sends only one existing agent model plus exact fallback replacement and native baseHash', async () => {
  const f = fixture(), result = await f.service.patch(patch, {});
  assert.deepEqual(f.calls.map(value => value.method), ['config.get', 'config.patch']);
  assert.deepEqual(JSON.parse(f.calls[1].params.raw), { agents:{ entries:{ 'croupier-director':{ model:patch.model } } } });
  assert.deepEqual(f.calls[1].params.replacePaths, ['agents.entries.croupier-director.model.fallbacks']);
  assert.equal(f.calls[1].params.baseHash, patch.baseHash);
  assert.deepEqual(result, { saved:true, baseHash:'hmac-sha256:v1:after', agentId:patch.agentId, model:patch.model, restartScheduled:true, verifiedAt:'1970-01-01T00:00:00.001Z' });
});

test('native v2026.9.5 no-op acknowledgement preserves the CAS hash without scheduling a restart', async () => {
  const input = { ...patch, model };
  // Exact shape of official respondConfigPatchNoop: no hash or restart field.
  const acknowledge = { ok:true, noop:true, changedPaths:[], path:'/synthetic/openclaw.json', config:source().config };
  const f = fixture({ acknowledge }), result = await f.service.patch(input, {});
  assert.deepEqual(result, { saved:true, baseHash:input.baseHash, agentId:input.agentId, model,
    restartScheduled:false, verifiedAt:'1970-01-01T00:00:00.001Z' });
  assert.deepEqual(f.calls.map(value => value.method), ['config.get', 'config.patch']);
  assert.equal(f.calls[1].params.baseHash, input.baseHash);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|password|apiKey|openclaw\.json/);
});

test('only a consistent native no-op may omit the acknowledgement hash', async () => {
  const input = { ...patch, model }, config = source().config;
  for (const acknowledge of [{ ok:true, config }, { ok:true, noop:true, config },
    { ok:true, noop:true, changedPaths:['agents.entries.croupier-director.model'], config },
    { ok:true, noop:true, changedPaths:[], hash:'unexpected-revision', config },
    { ok:true, noop:true, changedPaths:[], config:{ agents:{ entries:{ [input.agentId]:{ model:patch.model } } } } }]) {
    const f = fixture({ acknowledge });
    await assert.rejects(f.service.patch(input, {}), { code:'openclaw_admin_save_uncertain', statusCode:503 });
    assert.deepEqual(f.calls.map(value => value.method), ['config.get', 'config.patch']);
  }
  const f = fixture({ acknowledge:{ ok:true, noop:true, changedPaths:[], config:{ agents:{ entries:{ [patch.agentId]:{ model:patch.model } } } } } });
  await assert.rejects(f.service.patch(patch, {}), { code:'openclaw_admin_save_uncertain', statusCode:503 });
  assert.deepEqual(f.calls.map(value => value.method), ['config.get', 'config.patch']);
});

test('stale revisions, absent agents and unconfigured models never reach config.patch', async () => {
  for (const [value, code] of [[{ ...patch, baseHash:'stale' }, 'openclaw_admin_conflict'], [{ ...patch, agentId:'croupier-chat' }, 'openclaw_admin_invalid_request'],
    [{ ...patch, model:{ primary:'unconfigured/model', fallbacks:[] } }, 'openclaw_admin_model_unavailable']]) {
    const f = fixture(); await assert.rejects(f.service.patch(value, {}), { code });
    assert.deepEqual(f.calls.map(item => item.method), ['config.get']);
  }
});

test('competing PATCH fails conflict while first accepted intent waits; no automatic retry', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; }), f = fixture({ gate });
  const first = f.service.patch(patch, {});
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(f.service.patch(patch, {}), { code:'openclaw_admin_conflict', statusCode:409 });
  release(); await first;
  assert.equal(f.calls.filter(value => value.method === 'config.patch').length, 1);
});

test('untrusted fields/agents/fallbacks and malformed acknowledgement fail safely', async () => {
  for (const input of [{ ...patch, gateway:{ auth:{ token:'private' } } }, { ...patch, agentId:'other-agent' },
    { ...patch, model:{ ...patch.model, tools:'*' } }, { ...patch, model:{ primary:'lab-provider/model-one', fallbacks:['lab-provider/model-one'] } }]) {
    assert.throws(() => validateOpenClawAdminPatch(input), { code:'openclaw_admin_invalid_request' });
  }
  for (const acknowledge of [{ ok:true }, { ok:true, hash:'next', config:{ agents:{ entries:{ 'croupier-director':{ model:'private-invalid-model' } } } } }]) {
    const f = fixture({ acknowledge }); await assert.rejects(f.service.patch(patch, {}), { code:'openclaw_admin_save_uncertain', statusCode:503 });
    assert.equal(f.calls.filter(value => value.method === 'config.patch').length, 1);
  }
});

test('Director admin route requires distinct server Gateway credential even on loopback; runtime token denied', async t => {
  const dataDir = await mkdtemp(join(tmpdir(), 'croupier-openclaw-admin-'));
  let calls = 0;
  const key = 'fixturepass';
  assert.equal(key.length, 11);
  const settings = readSettings({ env:{ LAB_DATA_DIR:dataDir, LAB_API_TOKEN:'synthetic-runtime-key', OPENCLAWAPI_KEY:key }, envFiles:[] });
  const { server } = await createLabServer({ settings:() => settings, studioAdmin:{ async get() { calls++; return { fixture:true }; }, async patch() { calls++; return { fixture:true }; } } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(dataDir, { recursive:true, force:true }); });
  const url = `http://127.0.0.1:${server.address().port}${STUDIO_OPENCLAW_ADMIN_PATH}`;
  for (const credential of ['', 'synthetic-runtime-key']) for (const method of ['GET', 'PATCH', 'POST']) {
    const response = await fetch(url, { method, headers:{ Authorization:`Bearer ${credential}`, ...(method === 'PATCH' ? { 'Content-Type':'application/json' } : {}) }, ...(method === 'PATCH' ? { body:JSON.stringify(patch) } : {}) });
    assert.equal(response.status, 401); assert.equal(calls, 0);
  }
  assert.equal((await fetch(url, { headers:{ Authorization:`Bearer ${key}` } })).status, 200); assert.equal(calls, 1);
  for (const empty of ['', '   ']) {
    settings.gatewayKey = empty;
    assert.equal((await fetch(url, { headers:{ Authorization:`Bearer ${key}` } })).status, 503); assert.equal(calls, 1);
  }
  settings.gatewayKey = key;
  settings.apiToken = key;
  assert.equal((await fetch(url, { headers:{ Authorization:`Bearer ${key}` } })).status, 503); assert.equal(calls, 1);
});


test('dashboard opens only through the fixed private helper and projects no legacy credentials',async()=>{
 const token='synthetic-bootstrap-token-'.repeat(2), expiresAtMs=Date.now()+590000;let calls=0;
 const admin=createStudioOpenClawAdmin({fetchImpl:async(url,options)=>{calls++;assert.equal(url.href,'http://private-gateway:18790/dashboard');assert.equal(options.method,'POST');assert.equal(options.headers.Authorization,'Bearer synthetic-key');assert.equal(options.redirect,'error');return Response.json({bootstrapToken:token,expiresAtMs,password:'PRIVATE'});}});
 const settings={baseUrl:'http://private-gateway:18789/v1',gatewayKey:'synthetic-key'};
 assert.deepEqual(await admin.dashboard({version:1,action:'dashboard.open'},settings),{bootstrapToken:token,expiresAtMs});
 for(const baseUrl of ['https://public.invalid/v1','http://foreign.invalid/v1','http://private-gateway/v1?x=1'])await assert.rejects(admin.dashboard({version:1,action:'dashboard.open'},{...settings,baseUrl}),/openclaw_dashboard_unavailable/);
 await assert.rejects(admin.dashboard({version:1,action:'dashboard.open',command:'shell'},settings),/openclaw_admin_invalid_request/);assert.equal(calls,1);
});
