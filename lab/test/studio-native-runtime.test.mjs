import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { loadStudioMigrations } from '../../ops/neon-studio/migrations.mjs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nativeStudioAdminConfiguration, assertNativeStudioRequest, createStudioNativeRuntime, handleNativeAdmin } from '../lib/studio-native-runtime.mjs';

const env = { CROUPIER_STUDIO_NATIVE_ADMIN: '1', CROUPIER_PUBLIC_ORIGIN: 'https://public.example.invalid',
  CROUPIER_STUDIO_NEON_POLICY: '1',
  CROUPIER_LAB_UI_ORIGIN: 'https://studio.example.invalid', CROUPIER_LAB_BASE_PATH: '/studio',
  CROUPIER_STUDIO_ENVIRONMENT_ID: 'fixture', CROUPIER_STUDIO_WORKSPACE_ID: 'croupier',
  CROUPIER_GAME_DATABASE_URL: 'postgres://fixture:fixture@fixture.neon.tech/fixture?sslmode=require' };
test('native mode is explicit, scoped and never substitutes zone/general database', () => {
  assert.equal(nativeStudioAdminConfiguration({}), null);
  const config = nativeStudioAdminConfiguration(env);
  assert.deepEqual(config.scope, { environment: 'fixture', workspaceId: 'croupier' });
  for (const change of [{ CROUPIER_GAME_DATABASE_URL: undefined }, { CROUPIER_STUDIO_ENVIRONMENT_ID: undefined },
    { CROUPIER_STUDIO_NEON_POLICY: undefined },
    { CROUPIER_STUDIO_WORKSPACE_ID: undefined }, { CROUPIER_ZONES_DATABASE_URL: env.CROUPIER_GAME_DATABASE_URL },
    { CROUPIER_PUBLIC_ORIGIN: 'http://public.example.invalid' }, { CROUPIER_LAB_UI_ORIGIN: env.CROUPIER_PUBLIC_ORIGIN }]) {
    assert.throws(() => nativeStudioAdminConfiguration({ ...env, ...change }), error => error.statusCode === 503);
  }
});
test('exact trusted request host/origin before DB initialization', () => {
  const config = nativeStudioAdminConfiguration(env);
  assert.doesNotThrow(() => assertNativeStudioRequest(new Request(`${env.CROUPIER_PUBLIC_ORIGIN}/studio/api/auth/session`), config));
  for (const headers of [{ origin: 'https://evil.invalid' }, { host: 'evil.invalid' }, { 'x-forwarded-host': 'evil.invalid' }, { 'sec-fetch-site': 'cross-site' }, { 'next-action': 'anything' }]) {
    assert.throws(() => assertNativeStudioRequest(new Request(`${env.CROUPIER_PUBLIC_ORIGIN}/studio/api/auth/session`, { headers }), config), error => error.statusCode === 403);
  }
});
test('factory asserts installed schema; DB failure closes pool and never constructs a disk fallback', async () => {
  let closed = 0, constructed = 0;
  const config = nativeStudioAdminConfiguration(env);
  await assert.rejects(createStudioNativeRuntime(config, {
    poolFactory: async () => ({ end: async () => closed++ }),
    storeFactory: () => ({ db: { assertInstalled: async () => { throw Error('PRIVATE'); } } }),
    repositoryFactory: () => { constructed++; },
  }), error => error.statusCode === 503 && !error.message.includes('PRIVATE'));
  assert.equal(closed, 1); assert.equal(constructed, 0);
});
test('disabled active route does not instantiate DB or acknowledge a mutation', async () => {
  const previous = process.env.CROUPIER_STUDIO_NATIVE_ADMIN;
  delete process.env.CROUPIER_STUDIO_NATIVE_ADMIN;
  try {
    const response = await handleNativeAdmin(new Request(`${env.CROUPIER_PUBLIC_ORIGIN}/studio/api/admin/room`, { method: 'POST' }));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  } finally {
    if (previous === undefined) delete process.env.CROUPIER_STUDIO_NATIVE_ADMIN; else process.env.CROUPIER_STUDIO_NATIVE_ADMIN = previous;
  }
});
test('existing BO login returns only to native administration or exact one-use handoff', async () => {
  const html = await readFile(new URL('../../web/public/bo/login.html', import.meta.url), 'utf8');
  const statement = html.split(/\r?\n/).find(line => line.includes('location.href ='));
  const target = next => { const location = {}; runInNewContext(statement, { next, location }); return location.href; };
  assert.equal(target('/studio/administration'), '/studio/administration');
  const handoff = `/api/bo/lab-login?state=${'a'.repeat(64)}`;
  assert.equal(target(handoff), handoff);
  for (const next of ['https://evil.invalid', '//evil.invalid', '/studio/api/admin/users', '/studio/administration?secret=1', '/studio/administration#extra', '/studio/administration/../api', undefined]) {
    assert.equal(target(next), '/bo/');
  }
});
test('bundled source paths load exactly both migrations without asset URLs', async () => {
  const directory = resolve(fileURLToPath(new URL('../../ops/neon-studio/', import.meta.url)));
  const expected = await loadStudioMigrations();
  const actual = await loadStudioMigrations({ directory });
  assert.deepEqual(actual.map(row => row.checksum), expected.map(row => row.checksum));
  assert.equal(actual.length, 2);
  await assert.rejects(loadStudioMigrations({ directory: '../relative' }));
});
