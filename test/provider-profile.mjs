import test from 'node:test';
import assert from 'node:assert/strict';
import { readProfile, checkProfile } from '../tools/check-provider-profile.mjs';

const core = 'RUNPOD_API_KEY=fixture-core\nCROUPIER_SPEECH_RUNPOD_ENDPOINT_ID=fixture-core-endpoint\nCARTESIA_API_KEY=fixture-voice';
const emil = 'EMIL_RUNPOD_API_KEY=fixture-emil\nEMIL_RUNPOD_ENDPOINT_ID=fixture-emil-endpoint';

test('profiles require their own complete pair and reject accidental mixed imports', () => {
  assert.throws(() => readProfile(core, '__proto__'), /provider_profile_invalid/);
  assert.equal(readProfile(core, 'scoutgaming').endpoint, 'fixture-core-endpoint');
  assert.equal(readProfile(emil, 'emil').endpoint, 'fixture-emil-endpoint');
  for (const [source, profile] of [[core, 'emil'], [emil, 'scoutgaming'], [core + '\nRUNPOD_ENDPOINT_ID=legacy', 'scoutgaming']]) {
    assert.throws(() => readProfile(source, profile), /provider_profile_mixed_names/);
  }
  assert.throws(() => readProfile('RUNPOD_API_KEY=fixture', 'scoutgaming'), /runpod_pair_required/);
  assert.throws(() => readProfile(core + '\nRUNPOD_API_KEY=other', 'scoutgaming'), /duplicate_key/);
  assert.throws(() => readProfile(core.replace('fixture-core-endpoint', 'evil.invalid/path'), 'scoutgaming'), /runpod_pair_required/);
});

test('explicit file credentials win over inherited process variables without changing them', async () => {
  const before = process.env.RUNPOD_API_KEY;
  process.env.RUNPOD_API_KEY = 'fixture-inherited';
  try {
    const configuration = readProfile(emil, 'emil');
    await checkProfile(configuration, { fetchImpl: async (url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer fixture-emil');
      assert.equal(options.method, 'GET');
      assert.equal(options.redirect, 'error');
      assert.equal(url, 'https://api.runpod.ai/v2/fixture-emil-endpoint/health');
      return Response.json({ workers: { ready: 1 } });
    } });
    assert.equal(process.env.RUNPOD_API_KEY, 'fixture-inherited');
  } finally {
    if (before === undefined) delete process.env.RUNPOD_API_KEY;
    else process.env.RUNPOD_API_KEY = before;
  }
});

test('health checks never start jobs, follow redirects or expose provider payloads', async () => {
  const calls = [];
  const report = await checkProfile(readProfile(core, 'scoutgaming'), { fetchImpl: async (url, options) => {
    calls.push([url, options.method, options.redirect]);
    return url.includes('runpod') ? Response.json({ workers: { ready: 0, idle: 0, credential: 'do-not-print' }, secret: 'do-not-print' }) : new Response('private-provider-error', { status: 401 });
  } });
  assert.equal(report.ok, false);
  assert.equal(report.speechAccepted, false);
  assert.equal(report.readOnly, true);
  assert.equal(report.results.find(r => r.provider === 'cartesia').http, 401);
  assert.ok(calls.every(([, method, redirect]) => method === 'GET' && redirect === 'error'));
  assert.doesNotMatch(JSON.stringify(report), /fixture|do-not-print|private-provider-error/);
});

test('network failures and malformed health responses fail closed without raw errors', async () => {
  const configuration = readProfile(emil, 'emil');
  const failed = await checkProfile(configuration, { fetchImpl: async () => { throw Error('secret in upstream error'); } });
  assert.equal(failed.ok, false);
  assert.doesNotMatch(JSON.stringify(failed), /secret in upstream/);
  const malformed = await checkProfile(configuration, { fetchImpl: async () => Response.json({ message: 'ok' }) });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.results[0].status, 'invalid_health_response');
});
