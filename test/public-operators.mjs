import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicOperatorDirectory} from '../web/public-operators.mjs';

function response() {
  return {status: 0, headers: {}, body: '', writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = body; }};
}

test('GET /api/operators returns exactly slug and name for an active operator, and 404 otherwise', async () => {
  let calls = 0;
  let now = 1_000;
  const store = {
    async getOperatorBySlug(slug) {
      calls += 1;
      if (slug === 'sg-test') return {slug, name: 'SG test game provider', status: 'active', id: 'secret', environment_id: 'prod'};
      if (slug === 'paused') return {slug, name: 'Paused Co', status: 'suspended', id: 'secret'};
      return null;
    },
  };
  const directory = createPublicOperatorDirectory({store, now: () => now});
  const ok = response();
  await directory.handle({method: 'GET'}, ok, '/api/operators/sg-test');
  assert.equal(ok.status, 200);
  assert.equal(ok.headers['Cache-Control'], 'public, max-age=60');
  const body = JSON.parse(ok.body);
  assert.deepEqual(Object.keys(body).sort(), ['name', 'slug']);
  assert.deepEqual(body, {slug: 'sg-test', name: 'SG test game provider'});
  await directory.handle({method: 'GET'}, response(), '/api/operators/sg-test');
  assert.equal(calls, 1);
  now += 60_000;
  await directory.read('sg-test');
  assert.equal(calls, 2);

  const missing = response();
  await directory.handle({method: 'GET'}, missing, '/api/operators/missing');
  assert.equal(missing.status, 404);
  const paused = response();
  await directory.handle({method: 'GET'}, paused, '/api/operators/paused');
  assert.equal(paused.status, 404);
  assert.doesNotMatch(missing.body + paused.body, /secret|Paused|environment/);
  const denied = response();
  await directory.handle({method: 'POST'}, denied, '/api/operators/sg-test');
  assert.equal(denied.status, 405);
});

test('local fixture resolves sg-test when no operator store is configured', async () => {
  const directory = createPublicOperatorDirectory({store: null, now: () => 0});
  assert.deepEqual(await directory.read('sg-test'), {slug: 'sg-test', name: 'SG test game provider'});
  assert.equal(await directory.read('not-a-company'), null);
  assert.equal(await directory.read('PLAY'), null);
});
