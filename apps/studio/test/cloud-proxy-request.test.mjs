import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/dist/server/web/spec-extension/request.js';
import { assertLocalRequest, readLocalJson } from '../lib/http-guard.mjs';
import { createPartnerReference } from '../lib/partner-reference.mjs';

test('Next internal route URL accepts only authenticated cloud proxy headers and same-origin writes', async t => {
  const prior = { url: process.env.LAB_PUBLIC_URL, secret: process.env.CROUPIER_LAB_INTERNAL_SECRET };
  const origin = 'https://lab.example.test';
  process.env.LAB_PUBLIC_URL = origin;
  process.env.CROUPIER_LAB_INTERNAL_SECRET = 'fixture-internal-proxy-secret-32-bytes';
  t.after(() => {
    for (const [key, value] of [['LAB_PUBLIC_URL', prior.url], ['CROUPIER_LAB_INTERNAL_SECRET', prior.secret]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const headers = { host: 'lab.example.test', 'x-forwarded-host': 'lab.example.test',
    'x-forwarded-proto': 'https', 'x-croupier-lab-authorized': process.env.CROUPIER_LAB_INTERNAL_SECRET,
    origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' };
  const request = (url = 'https://127.0.0.1:4188/studio/api/inputs/reference', patch = {}, method = 'GET') => {
    const merged = { ...headers, ...patch };
    for (const [key, value] of Object.entries(merged)) if (value === null) delete merged[key];
    return new Request(url, { method, headers: merged, ...(method === 'POST' ? { body: '{"action":"verify"}' } : {}) });
  };
  assert.doesNotThrow(() => assertLocalRequest(request()));
  assert.deepEqual(await readLocalJson(request(undefined, {}, 'POST')), { action: 'verify' });
  // Next's production adapter turns the internal listener URL into a
  // NextRequest, whose NextURL normalizes 127.0.0.1 to localhost.
  const nextRequest = (url = 'https://127.0.0.1:4188/studio/api/inputs/reference', patch = {}) =>
    new NextRequest(url, { headers: { ...headers, ...patch } });
  const routed = nextRequest();
  assert.equal(routed.url, 'https://localhost:4188/studio/api/inputs/reference');
  assert.doesNotThrow(() => assertLocalRequest(routed));
  for (const patch of [
    { 'x-croupier-lab-authorized': 'forged' }, { host: 'attacker.example' },
    { 'x-forwarded-host': 'attacker.example' }, { 'x-forwarded-proto': 'http' },
    { origin: 'https://attacker.example' },
  ]) assert.throws(() => assertLocalRequest(nextRequest(undefined, patch)), error => error.statusCode === 403);
  assert.throws(() => assertLocalRequest(nextRequest('https://127.0.0.1:4189/studio/api/inputs/reference')),
    error => error.statusCode === 403);
  const reference = createPartnerReference({ env: {}, token: () => undefined,
    fetchImpl: () => assert.fail('Configuration read must not contact a provider') });
  const response = await reference.endpoint(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).configured, false);
  for (const patch of [
    { 'x-croupier-lab-authorized': null }, { 'x-croupier-lab-authorized': 'forged' },
    { host: '127.0.0.1:4188' }, { host: 'attacker.example' },
    { 'x-forwarded-host': 'attacker.example' }, { 'x-forwarded-proto': 'http' },
    { origin: 'https://attacker.example' }, { 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': 'same-site' },
  ]) assert.throws(() => assertLocalRequest(request(undefined, patch)), error => error.statusCode === 403);
  assert.throws(() => assertLocalRequest(request(undefined, { origin: null }, 'POST')), error => error.statusCode === 403);
  for (const host of ['127.0.0.1:4199', 'localhost:4199', 'attacker.example']) {
    assert.throws(() => assertLocalRequest(request(`https://${host}/studio/api/videos`)), error => error.statusCode === 403);
  }
});
