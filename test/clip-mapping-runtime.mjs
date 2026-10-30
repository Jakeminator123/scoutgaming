import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ENGINE_QA_SKIP, createEngineDatabase, installBaseStudioRuntime, startEngine} from './fixtures/engine-qa.mjs';

const token = 'isolated-clip-mapping-fixture';
const headers = {authorization: `Bearer ${token}`};

async function gameServer(t, cloudRuntime = false) {
  const database = await createEngineDatabase(t);
  const studio = await installBaseStudioRuntime(t, database);
  const engine = await startEngine(t, { database, timeoutMs: 15000, preload: studio.preload, env: {
    ...studio.env, NODE_ENV: 'production',
    CROUPIER_CLOUD_RUNTIME: cloudRuntime ? '1' : '0',
    CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER: 'mapping-fixture',
    CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD: 'Isolated-Mapping-Fixture-Password',
    CROUPIER_GENERATED_SPEECH: '', CROUPIER_GENERATED_SPEECH_STREAMING: '',
    GENERATIONS_READ_TOKENS: createHash('sha256').update(token).digest('hex'),
    PUBLIC_URL: 'https://clip-mapping.fixture.invalid', BO_URL: 'https://clip-mapping.fixture.invalid',
  } });
  return `${engine.origin}/api/v1/generations/mapping`;
}

// Neon is the engine's fixed Studio registry and private Blob its only media store, so
// the local clip catalog under web/public is never served, inside or outside the cloud.
for (const cloudRuntime of [false, true]) {
  test(`game server never exposes the local clip catalog (cloud runtime ${cloudRuntime})`, { skip: ENGINE_QA_SKIP }, async t => {
    const url = await gameServer(t, cloudRuntime);
    assert.equal((await fetch(url)).status, 401);
    const response = await fetch(url, {headers});
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {error: 'no mapping'});
  });
}
