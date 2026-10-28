import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {clipMapping} from '../services/game/clip-mapping.mjs';
import {ENGINE_QA_SKIP, createEngineDatabase, startEngine} from './fixtures/engine-qa.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const token = 'isolated-clip-mapping-fixture';
const headers = {authorization: `Bearer ${token}`};

async function gameServer(t, cloudRuntime = false) {
  const database = await createEngineDatabase(t);
  const engine = await startEngine(t, { database, timeoutMs: 15000, env: {
    NODE_ENV: 'production',
    CROUPIER_CLOUD_RUNTIME: cloudRuntime ? '1' : '0', CROUPIER_STUDIO_NEON_POLICY: '0',
    CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER: 'mapping-fixture',
    CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD: 'Isolated-Mapping-Fixture-Password',
    CROUPIER_GENERATED_SPEECH: '', CROUPIER_GENERATED_SPEECH_STREAMING: '',
    GENERATIONS_READ_TOKENS: createHash('sha256').update(token).digest('hex'),
    PUBLIC_URL: 'https://clip-mapping.fixture.invalid', BO_URL: 'https://clip-mapping.fixture.invalid',
  } });
  return `${engine.origin}/api/v1/generations/mapping`;
}

test('game server mapping requires its token and mirrors the catalog resolved from its public source root', { skip: ENGINE_QA_SKIP }, async t => {
  // No dealer-specific media is required: the server must return exactly what the
  // shared resolver finds from web/public, whatever the tree currently contains.
  const expected = clipMapping({root: join(repository, 'web/public')});
  const url = await gameServer(t);
  assert.equal((await fetch(url)).status, 401);
  const response = await fetch(url, {headers});
  assert.equal(response.status, 200);
  const actual = await response.json();
  assert.deepEqual(actual.dealers, expected.dealers,
    'the real server must retain exact media, captions, hashes, audio and availability through catalog aliases');
  assert.equal(actual.actualPlayback, false);
});

test('cloud game server does not expose the local clip catalog', { skip: ENGINE_QA_SKIP }, async t => {
  const url = await gameServer(t, true);
  const response = await fetch(url, {headers});
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {error: 'no mapping'});
});
