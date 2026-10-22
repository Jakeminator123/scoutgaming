import test from 'node:test';
import assert from 'node:assert/strict';

let sequence = 0;
const fresh = () => import(`../services/game/shared-room-qa-context.mjs?case=${++sequence}`);
const expected = () => ({ host: '127.0.0.1', port: 35432, database: 'croupier_qa_k04', role: 'studio_qa', systemIdentifier: '7561234567890123456' });
const inert = () => assert.fail('Startup identity verification must not invoke policy, auth, media or database mutation ports');
function fixture() {
  const target = expected(), calls = [];
  const row = { address: target.host, port: target.port, database: target.database, role: target.role,
    session_role: target.role, listeners: target.host, system_identifier: target.systemIdentifier };
  const pool = { options: { host: target.host, port: target.port, database: target.database, user: target.role, connectionTimeoutMillis: 5000 },
    connect: inert, async query(query) { calls.push(query); return { rows: [row] }; } };
  const storage = { pool, gamePool: { query: inert, connect: inert }, db: { prepare: inert, assertInstalled: inert }, boDb: { prepare: inert } };
  const scope = { environment: 'test', workspaceId: 'shared-qa-k04' };
  const studioPolicyRuntime = { scope, repository: { scope: { ...scope }, sharedTransaction: inert },
    policy: { readSaved: inert, projectStore: inert, readGameConfiguration: inert } };
  const studioMediaRuntime = Object.fromEntries(['videoRegistry', 'videoResponse', 'videoRegistryCaptured', 'videoResponseCaptured', 'publicMediaResponse', 'hasPublicMedia', 'readMetadata'].map(name => [name, inert]));
  return { pool, expected: target, httpPort: 34173, storage, studioPolicyRuntime, studioMediaRuntime, privateMedia: inert, row, calls };
}
async function withEnv(values, work) {
  const previous = process.env;
  process.env = { PATH: previous.PATH, SystemRoot: previous.SystemRoot, ...values };
  try { return await work(); } finally { process.env = previous; }
}
const denied = async (module, value, code) => {
  await assert.rejects(module.registerSharedRoomQaContext(value), { code });
  assert.throws(() => module.consumeSharedRoomQaContext(), { code: 'shared_room_qa_context_unavailable' });
};

test('ordinary startup has no QA ports and seals a later registration, even with a QA-looking environment flag', async () => withEnv({ CROUPIER_SHARED_ROOM_QA: '1' }, async () => {
  const m = await fresh(), f = fixture();
  assert.equal(m.consumeSharedRoomQaContext(), null); assert.equal(m.consumeSharedRoomQaContext(), null);
  await assert.rejects(m.registerSharedRoomQaContext(f), { code: 'shared_room_qa_already_registered' }); assert.equal(f.calls.length, 0);
}));

test('verified one-use context preserves actual ports and publishes only the explicit loopback listener', async () => withEnv({}, async () => {
  const m = await fresh(), f = fixture();
  assert.equal(await m.registerSharedRoomQaContext(f), undefined);
  const context = m.consumeSharedRoomQaContext();
  for (const name of ['storage', 'studioPolicyRuntime', 'studioMediaRuntime', 'privateMedia']) assert.equal(context[name], f[name]);
  assert.equal(context.host, '127.0.0.1'); assert.equal(context.port, f.httpPort); assert.equal(context.publicOrigin, 'http://127.0.0.1:34173');
  assert.deepEqual(context.target, f.expected); assert.ok(Object.isFrozen(context)); assert.ok(Object.isFrozen(context.target));
  assert.equal(f.calls.length, 1); assert.match(f.calls[0].text, /^SELECT /); assert.match(f.calls[0].text, /pg_control_system\(\)/);
  assert.equal(f.calls[0].query_timeout, 5000);
  assert.throws(() => m.consumeSharedRoomQaContext(), { code: 'shared_room_qa_context_unavailable' });
  await assert.rejects(m.registerSharedRoomQaContext(f), { code: 'shared_room_qa_already_registered' });
}));

test('a dedicated synthetically named QA role is accepted without changing its pool', async () => withEnv({}, async () => {
  const m = await fresh(), f = fixture(); f.expected.role = f.pool.options.user = f.row.role = f.row.session_role = 'croupier_qa_k04';
  await m.registerSharedRoomQaContext(f); assert.equal(m.consumeSharedRoomQaContext().storage.pool, f.pool);
}));

test('remote, DNS, socket and wildcard targets fail before any SQL query', async () => withEnv({}, async () => {
  for (const host of ['localhost', '::1', '/tmp/pg', '0.0.0.0', '127.0.0.2', 'fixture.neon.tech']) {
    const m = await fresh(), f = fixture(); f.expected.host = host;
    await denied(m, f, 'shared_room_qa_loopback_required'); assert.equal(f.calls.length, 0);
  }
}));

test('production database or role, incomplete identity and unspecified listener are refused before SQL', async () => withEnv({}, async () => {
  for (const [key, value] of [['database', 'croupier_game'], ['database', 'postgres'], ['database', 'croupier_qa_'], ['role', 'croupier_game'],
    ['systemIdentifier', null], ['systemIdentifier', ''], ['systemIdentifier', 7561234567890123456], ['systemIdentifier', '12'], ['extra', true]]) {
    const m = await fresh(), f = fixture(); f.expected[key] = value;
    await denied(m, f, 'shared_room_qa_target_invalid'); assert.equal(f.calls.length, 0);
  }
  for (const httpPort of [0, 80, 65536, '34173', 35432]) {
    const m = await fresh(), f = fixture(); f.httpPort = httpPort;
    await denied(m, f, 'shared_room_qa_loopback_required'); assert.equal(f.calls.length, 0);
  }
}));

test('pool routing overrides, alternate connections and unbounded connection waits cannot hide behind expected metadata', async () => withEnv({}, async () => {
  for (const [key, value] of [['host', 'localhost'], ['host', '/tmp/pg'], ['port', 35433], ['database', 'croupier_game'], ['user', 'croupier_game'],
    ['connectionString', 'postgresql://redacted.invalid/db'], ['hostaddr', '127.0.0.1'], ['service', 'remote'], ['stream', {}], ['ssl', {}],
    ['connectionTimeoutMillis', 0], ['connectionTimeoutMillis', undefined], ['connectionTimeoutMillis', 10001]]) {
    const m = await fresh(), f = fixture(); f.pool.options[key] = value;
    await denied(m, f, 'shared_room_qa_pool_target_invalid'); assert.equal(f.calls.length, 0);
  }
}));

test('actual server identity must match every independently expected field and loopback listener', async () => withEnv({}, async () => {
  for (const [key, value] of [['address', '10.0.0.1'], ['address', null], ['port', 35433], ['database', 'croupier_game'], ['role', 'other'],
    ['session_role', 'croupier_game'], ['listeners', '*'], ['listeners', 'localhost'], ['system_identifier', '7561234567890123457']]) {
    const m = await fresh(), f = fixture(); f.row[key] = value;
    await denied(m, f, 'shared_room_qa_identity_mismatch'); assert.equal(f.calls.length, 1);
  }
  for (const rows of [[], [{}, {}]]) {
    const m = await fresh(), f = fixture(); f.pool.query = async () => ({ rows });
    await denied(m, f, 'shared_room_qa_identity_mismatch');
  }
}));

test('real process environment rejects production and provider execution despite a supplied fake env option', async () => {
  for (const [name, value, code] of [['NODE_ENV', 'production', 'shared_room_qa_production_process'], ['CROUPIER_CLOUD_RUNTIME', '1', 'shared_room_qa_production_process'], ['CROUPIER_STUDIO_ENVIRONMENT_ID', 'production', 'shared_room_qa_production_process'], ['RENDER', 'true', 'shared_room_qa_provider_process'],
    ['VERCEL', '1', 'shared_room_qa_provider_process'], ['FLY_APP_NAME', 'qa-app', 'shared_room_qa_provider_process'], ['K_SERVICE', 'qa', 'shared_room_qa_provider_process']]) {
    await withEnv({ [name]: value }, async () => {
      const m = await fresh(), f = fixture(); await denied(m, { ...f, env: {} }, code); assert.equal(f.calls.length, 0);
    });
  }
});

test('cloud credentials and inherited PG routing are refused without including their values in errors', async () => {
  for (const name of ['BLOB_READ_WRITE_TOKEN', 'NEON_API_KEY', 'AWS_ACCESS_KEY_ID', 'OPENAI_API_KEY', 'DATABASE_URL', 'PGHOST', 'PGPASSWORD',
    'CROUPIER_GAME_DATABASE_URL', 'CROUPIER_INGRESS_SECRET', 'CUSTOM_SERVICE_CREDENTIAL']) {
    await withEnv({ [name]: 'redacted-test-value' }, async () => {
      const m = await fresh(), f = fixture(); await denied(m, f, 'shared_room_qa_cloud_credentials'); assert.equal(f.calls.length, 0);
    });
  }
});

test('production scope, missing test marker or mismatched repository scope never reaches SQL', async () => withEnv({}, async () => {
  for (const mutate of [f => { f.studioPolicyRuntime.scope.environment = 'production'; }, f => { f.studioPolicyRuntime.scope.workspaceId = 'live'; },
    f => { f.studioPolicyRuntime.repository.scope.workspaceId = 'shared-qa-other'; }, f => { f.studioPolicyRuntime.scope.extra = true; }]) {
    const m = await fresh(), f = fixture(); mutate(f); await denied(m, f, 'shared_room_qa_scope_invalid'); assert.equal(f.calls.length, 0);
  }
}));

test('storage pool identity and required real application ports are checked without invoking them', async () => withEnv({}, async () => {
  for (const [mutate, code] of [[f => { f.storage.pool = { ...f.pool }; }, 'shared_room_qa_storage_invalid'],
    [f => { f.storage.boDb.prepare = null; }, 'shared_room_qa_storage_invalid'], [f => { f.studioPolicyRuntime.policy.readSaved = null; }, 'shared_room_qa_policy_invalid'],
    [f => { f.studioMediaRuntime.videoRegistryCaptured = null; }, 'shared_room_qa_media_invalid'], [f => { f.privateMedia = null; }, 'shared_room_qa_media_invalid']]) {
    const m = await fresh(), f = fixture(); mutate(f); await denied(m, f, code); assert.equal(f.calls.length, 0);
  }
}));

test('SQL failures are sanitized, keep the context closed and cannot be retried into a grant', async () => withEnv({}, async () => {
  const m = await fresh(), f = fixture(); f.pool.query = async () => { throw Error('redacted-test-database-detail'); };
  await denied(m, f, 'shared_room_qa_identity_unavailable');
  await assert.rejects(m.registerSharedRoomQaContext(f), { code: 'shared_room_qa_already_registered' });
}));

test('consume before asynchronous identity verification completes poisons that registration', async () => withEnv({}, async () => {
  const m = await fresh(), f = fixture(); let release;
  f.pool.query = () => new Promise(resolve => { release = () => resolve({ rows: [f.row] }); });
  const registering = m.registerSharedRoomQaContext(f); registering.catch(() => {});
  assert.throws(() => m.consumeSharedRoomQaContext(), { code: 'shared_room_qa_context_unavailable' });
  release(); await assert.rejects(registering, { code: 'shared_room_qa_startup_race' });
  assert.throws(() => m.consumeSharedRoomQaContext(), { code: 'shared_room_qa_context_unavailable' });
}));

test('guards run again after SQL and at consume, before yielding ports', async () => withEnv({}, async () => {
  for (const when of ['during-query', 'before-consume']) {
    const m = await fresh(), f = fixture();
    if (when === 'during-query') f.pool.query = async () => { process.env.RENDER = 'true'; return { rows: [f.row] }; };
    try {
      if (when === 'during-query') await denied(m, f, 'shared_room_qa_provider_process');
      else { await m.registerSharedRoomQaContext(f); process.env.RENDER = 'true'; assert.throws(() => m.consumeSharedRoomQaContext(), { code: 'shared_room_qa_provider_process' }); }
    } finally { delete process.env.RENDER; }
  }
  for (const mutate of [f => { f.pool.options.host = 'remote.invalid'; }, f => { f.studioPolicyRuntime.scope.environment = 'production'; },
    f => { f.studioMediaRuntime.videoResponse = null; }]) {
    const m = await fresh(), f = fixture(); await m.registerSharedRoomQaContext(f); mutate(f);
    assert.throws(() => m.consumeSharedRoomQaContext(), /shared_room_qa_/);
    assert.throws(() => m.consumeSharedRoomQaContext(), { code: 'shared_room_qa_context_unavailable' });
  }
}));


test('independent identity assertion can precede fixture construction without registering any app ports', async () => withEnv({}, async () => {
  const m = await fresh(), f = fixture();
  const target = await m.assertSharedRoomQaIdentity({ pool: f.pool, expected: f.expected });
  assert.deepEqual(target, f.expected); assert.notEqual(target, f.expected); assert.ok(Object.isFrozen(target)); assert.equal(f.calls.length, 1);
  assert.equal(m.consumeSharedRoomQaContext(), null);
}));

test('identity assertion rejects remote targets and changed actual clusters before any fixture grant', async () => withEnv({}, async () => {
  const m = await fresh(), f = fixture();
  f.pool.options.host = 'remote.invalid';
  await assert.rejects(m.assertSharedRoomQaIdentity({ pool: f.pool, expected: f.expected }), { code: 'shared_room_qa_pool_target_invalid' });
  assert.equal(f.calls.length, 0); f.pool.options.host = '127.0.0.1'; f.row.system_identifier = '7561234567890123457';
  await assert.rejects(m.assertSharedRoomQaIdentity({ pool: f.pool, expected: f.expected }), { code: 'shared_room_qa_identity_mismatch' });
  assert.equal(m.consumeSharedRoomQaContext(), null);
}));

test('registration rechecks actual identity after a successful pre-fixture assertion', async () => withEnv({}, async () => {
  const m = await fresh(), f = fixture(); await m.assertSharedRoomQaIdentity({ pool: f.pool, expected: f.expected });
  f.row.database = 'croupier_game'; await denied(m, f, 'shared_room_qa_identity_mismatch'); assert.equal(f.calls.length, 2);
}));


test('the consumed storage cannot exchange the identity-verified pool for a lookalike after registration', async () => withEnv({}, async () => {
  const m = await fresh(), f = fixture(); await m.registerSharedRoomQaContext(f);
  f.storage.pool = { ...f.pool, options: { ...f.pool.options } };
  assert.throws(() => m.consumeSharedRoomQaContext(), { code: 'shared_room_qa_storage_invalid' });
  assert.throws(() => m.consumeSharedRoomQaContext(), { code: 'shared_room_qa_context_unavailable' });
}));
