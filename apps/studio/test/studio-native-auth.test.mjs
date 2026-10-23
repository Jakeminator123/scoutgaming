import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createStudioNativeAuth } from '../../../packages/studio-access/studio-native-auth.mjs';
import * as sharedAuth from '../../../packages/studio-access/studio-native-auth.mjs';
import * as sharedScope from '../../../packages/studio-access/studio-scope.mjs';
import { StudioStorageError, studioStorageFailure, validateStudioEnvironmentId, validateStudioScope } from '../../../packages/studio-registry/server/document-contract.mjs';
import { createPostgresStore } from '../../../services/game/storage/postgres-store.mjs';

test('shared auth retains scope and error identities', async () => {
  assert.equal(StudioStorageError, sharedScope.StudioStorageError);
  assert.equal(validateStudioEnvironmentId, sharedScope.validateStudioEnvironmentId);
  assert.equal(validateStudioScope, sharedScope.validateStudioScope);
  assert.throws(() => sharedScope.validateStudioScope({ environment: 'fixture', workspaceId: '' }), error => {
    assert.ok(error instanceof StudioStorageError);
    assert.equal(studioStorageFailure(error), error);
    assert.equal(error.code, 'studio_invalid_scope');
    assert.equal(error.statusCode, 422);
    return true;
  });
  const authorize = sharedAuth.createStudioNativeAuth({ boDb: { prepare() { throw Error('must not query'); } }, scope });
  await assert.rejects(authorize(new Request('https://studio.example.invalid/')), error => {
    assert.ok(error instanceof sharedAuth.NativeStudioAuthError);
    assert.equal(error.code, 'studio_login_required');
    assert.equal(error.statusCode, 401);
    return true;
  });
});

test('shared auth loads and fails closed without Studio, OpenClaw or storage implementations', () => {
  const entry = new URL('../../../packages/studio-access/studio-native-auth.mjs', import.meta.url).href;
  const root = new URL('../../../', import.meta.url);
  const blocked = ['apps/studio/', 'services/openclaw/', 'services/game/storage/', 'web/storage/'].map(path => new URL(path, root).href);
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { registerHooks } from 'node:module';
    import assert from 'node:assert/strict';
    registerHooks({ load(url, context, nextLoad) {
      if (${JSON.stringify(blocked)}.some(prefix => url.startsWith(prefix))) throw Error('unexpected_runtime_dependency');
      return nextLoad(url, context);
    } });
    const { createStudioNativeAuth, NativeStudioAuthError } = await import(${JSON.stringify(entry)});
    const authorize = createStudioNativeAuth({ boDb: { prepare() { throw Error('must not query'); } },
      scope: { environment: 'fixture', workspaceId: 'croupier' } });
    await assert.rejects(authorize(new Request('https://studio.example.invalid/')),
      error => error instanceof NativeStudioAuthError && error.statusCode === 401);
  `], { timeout: 10000, stdio: 'pipe' });
});

const secret = 'a'.repeat(64), bearer = 'b'.repeat(64), clock = 2_000_000;
const scope = { environment: 'fixture', workspaceId: 'croupier' };
function fixture(role = 'admin') {
  const user = { id: '7', username: 'operator', email: 'operator@example.invalid', salt: 'salt', hash: 'c'.repeat(128), role };
  const state = { user, extraUsers: [], epoch: 2, secret, offline: false, queries: [] };
  state.stamp = () => createHash('sha256').update(`${user.salt}:${user.hash}`).digest('hex');
  state.lab = { token_digest: createHash('sha256').update(bearer).digest('hex'), craig_user_id: '7', role, source_stamp: state.stamp(), auth_epoch: 2, expires: clock + 60_000 };
  const boDb = { prepare(sql) {
    state.queries.push(sql);
    async function rows(...args) {
      if (state.offline) throw Error('PRIVATE DATABASE URL');
      if (sql.includes('FROM meta')) return state.secret ? [{ v: state.secret }] : [];
      if (sql.includes('FROM bo_auth_epochs')) return [{ epoch: state.epoch }];
      if (sql.includes('FROM lab_sessions')) return labRows(state, args);
      if (sql.includes('LEFT JOIN bo_auth_epochs')) return accountRows(state, sql, args);
      return state.user ? [state.user] : [];
    }
    return { all: rows, get: async (...args) => (await rows(...args))[0] };
  } };
  const authorize = createStudioNativeAuth({ boDb, scope, now: () => clock });
  const token = (overrides = {}, header = { alg: 'HS256', typ: 'JWT' }) => {
    const parts = [header, { aud: 'backoffice', sub: user.username, role, source_stamp: state.stamp(), auth_epoch: 2, exp: (clock + 60_000) / 1000, ...overrides }]
      .map(value => Buffer.from(JSON.stringify(value)).toString('base64url'));
    return `${parts.join('.')}.${createHmac('sha256', Buffer.from(secret, 'hex')).update(parts.join('.')).digest('base64url')}`;
  };
  const request = (value = `bo_jwt=${token()}`) => new Request('https://studio.example.invalid/studio/api/auth/session', { headers: { cookie: value } });
  return { state, authorize, token, request };
}
const code = expected => error => error.code === expected;
function labRows(state, args) {
  return state.lab?.token_digest === args[0] && state.lab.expires > args[1] ? [state.lab] : [];
}
function accountRows(state, sql, args) {
  const users = [state.user, ...state.extraUsers].filter(Boolean);
  const matches = sql.includes('lower(u.username)')
    ? users.filter(user => user.username.toLowerCase() === args[0] || user.email?.toLowerCase() === args[1])
    : users.filter(user => String(user.id) === String(args[0]));
  return matches.map(user => ({ ...user, epoch: state.epoch }));
}

// Exercise the real PostgreSQL adapter's connection/transaction boundary with
// isolated rows. No network, installed schema or real identity is involved.
function pooledFixture({ grouped = true, afterRead = () => {}, failQuery = () => false, failRelease = false } = {}) {
  const f = fixture(), calls = [], parameters = [], connections = { borrowed: 0, released: 0 };
  const pool = {
    async query() { throw Error('Unexpected query outside the borrowed connection'); },
    async connect() {
      connections.borrowed++;
      return {
        async query(sql, values = []) {
          calls.push(sql);
          parameters.push(values);
          if (failQuery(sql)) throw Error('PRIVATE DATABASE URL');
          if (/^(?:BEGIN|COMMIT|ROLLBACK)/.test(sql)) return { rows: [], command: sql.startsWith('COMMIT') ? 'COMMIT' : 'BEGIN' };
          if (f.state.offline) throw Error('PRIVATE DATABASE URL');
          let rows;
          if (sql.includes('FROM croupier_auth.meta')) rows = f.state.secret ? [{ v: f.state.secret }] : [];
          else if (sql.includes('FROM croupier_auth.bo_auth_epochs')) rows = [{ epoch: f.state.epoch }];
          else if (sql.includes('FROM croupier_auth.lab_sessions')) rows = labRows(f.state, values);
          else if (sql.includes('LEFT JOIN croupier_auth.bo_auth_epochs')) rows = accountRows(f.state, sql, values);
          else rows = f.state.user ? [f.state.user] : [];
          const result = { rows: rows.map(row => ({ ...row })), fields: [] };
          afterRead(sql, f.state);
          return result;
        },
        release() { connections.released++; if (failRelease) throw Error('PRIVATE DATABASE URL'); },
      };
    },
  };
  const { boDb } = createPostgresStore({ pool });
  const authorize = createStudioNativeAuth({ boDb: grouped ? boDb : { ...boDb, transaction: undefined }, scope, now: () => clock });
  return { ...f, authorize, boDb, calls, parameters, connections };
}

test('admin and stored superadmin use live identity with canonical admin privilege and no writes', async () => {
  for (const role of ['admin','superadmin']) {
    const f = fixture(role), session = await f.authorize(f.request());
    assert.deepEqual(session, { accountId: '7', user: 'operator', role:'admin', scope });
    assert.ok(Object.isFrozen(session));
    assert.ok(f.state.queries.every(sql => sql.startsWith('SELECT')));
  }
});
test('partner/player/unknown roles, expired JWT and invalid headers are denied', async () => {
  const f = fixture();
  for (const overrides of [{ partner: true }, { aud: 'player' }, { role: 'player' }, { role: '__proto__' }, { exp: clock / 1000 }, { exp: '9999999' }, { auth_epoch: -1 }]) {
    await assert.rejects(f.authorize(f.request(`bo_jwt=${f.token(overrides)}`)), code('studio_login_required'));
  }
  await assert.rejects(f.authorize(f.request(`bo_jwt=${f.token({}, { alg: 'none', typ: 'JWT' })}`)), code('studio_login_required'));
});
test('epoch, role, password fingerprint and removed account invalidate existing JWT', async () => {
  for (const change of [f => f.state.epoch++, f => f.state.user.role = 'reader', f => f.state.user.hash = 'd'.repeat(128), f => f.state.user = null]) {
    const f = fixture(), request = f.request(); change(f);
    await assert.rejects(f.authorize(request), code('studio_login_required'));
  }
});
test('duplicate/tampered BO cookie never falls back to a valid Lab session', async () => {
  const f = fixture();
  for (const value of [`bo_jwt=bad; lab_session=${bearer}`, `bo_jwt=${f.token()}; bo_jwt=${f.token()}`, `bo_jwt=${f.token()}.more`, 'bo_jwt=']) {
    await assert.rejects(f.authorize(f.request(value)), code('studio_login_required'));
  }
});
test('opaque Lab access revalidates role, stamp and epoch but never admits reader/staff', async () => {
  const f = fixture();
  assert.equal((await f.authorize(f.request(`lab_session=${bearer}`))).user, 'operator');
  f.state.lab.auth_epoch++;
  await assert.rejects(f.authorize(f.request(`lab_session=${bearer}`)), code('studio_login_required'));
  for (const role of ['reader','staff','player']) {
    const lower = fixture(role);
    await assert.rejects(lower.authorize(lower.request(`lab_session=${bearer}`)), code('studio_login_required'));
    await assert.rejects(lower.authorize(lower.request()), code('studio_login_required'));
    assert.equal(lower.state.user.role, role, 'denial does not rewrite the stored legacy role');
  }
});
test('missing signer and DB failures fail closed without exposing secrets or seeding', async () => {
  const f = fixture(); f.state.secret = null;
  await assert.rejects(f.authorize(f.request()), code('studio_auth_unavailable'));
  f.state.offline = true;
  await assert.rejects(f.authorize(f.request()), error => error.statusCode === 503 && !error.message.includes('PRIVATE'));
  await assert.rejects(f.authorize(f.request('')), code('studio_login_required'));
});

test('PostgreSQL authorization uses two fresh projections and four query calls in one transaction', async () => {
  for (const kind of ['jwt', 'lab']) {
    const ungrouped = pooledFixture({ grouped: false }), grouped = pooledFixture();
    for (const f of [ungrouped, grouped]) {
      const request = kind === 'lab' ? f.request(`lab_session=${bearer}`) : f.request();
      assert.deepEqual(await f.authorize(request), { accountId: '7', user: 'operator', role: 'admin', scope });
      assert.equal(f.calls.filter(sql => sql.startsWith('SELECT')).length, 2);
      assert.equal(f.connections.borrowed, f.connections.released);
    }
    assert.equal(ungrouped.calls.length, 6);
    assert.equal(ungrouped.connections.borrowed, 2);
    assert.equal(grouped.calls.length, 4);
    assert.equal(grouped.connections.borrowed, 1);
    assert.doesNotMatch(grouped.calls[0], /pg_advisory_xact_lock/);
    assert.match(grouped.calls[2], /FROM croupier_auth\.users u LEFT JOIN croupier_auth\.bo_auth_epochs e ON e\.user_id=u\.id/);
    assert.ok(grouped.calls[1].includes(kind === 'jwt' ? 'FROM croupier_auth.meta' : 'FROM croupier_auth.lab_sessions'), 'signer/session is read before the account projection');
  }
});

test('grouped authorization rereads every request and rolls back on password, role, epoch or account revocation', async () => {
  for (const kind of ['jwt', 'lab']) {
    for (const revoke of [state => state.epoch++, state => { state.user.hash = 'd'.repeat(128); }, state => { state.user.salt = 'changed-salt'; }, state => { state.user.role = 'reader'; }, state => { state.user.role = 'superadmin'; }, state => { state.user = null; }]) {
      const f = pooledFixture(), request = kind === 'lab' ? f.request(`lab_session=${bearer}`) : f.request();
      await f.authorize(request);
      revoke(f.state);
      await assert.rejects(f.authorize(request), code('studio_login_required'));
      assert.equal(f.connections.borrowed, 2);
      assert.equal(f.connections.released, 2);
      assert.equal(f.calls.at(-1), 'ROLLBACK');
    }
  }
});

test('a concurrent epoch change after the signer/session read is observed by the account projection', async () => {
  for (const kind of ['jwt', 'lab']) {
    const f = pooledFixture({ afterRead(sql, state) {
      if (kind === 'jwt' && sql.includes('FROM croupier_auth.meta') || kind === 'lab' && sql.includes('FROM croupier_auth.lab_sessions')) state.epoch++;
    } });
    const request = kind === 'lab' ? f.request(`lab_session=${bearer}`) : f.request();
    await assert.rejects(f.authorize(request), code('studio_login_required'));
    assert.equal(f.calls.at(-1), 'ROLLBACK');
    assert.equal(f.connections.borrowed, 1);
    assert.equal(f.connections.released, 1);
  }
});

test('authorization inside an existing product mutation retains its transaction and advisory lock', async () => {
  const f = pooledFixture();
  await f.boDb.transaction(async () => {
    assert.equal((await f.authorize(f.request())).user, 'operator');
  });
  assert.equal(f.calls.length, 4);
  assert.equal(f.connections.borrowed, 1);
  assert.equal(f.connections.released, 1);
  assert.match(f.calls[0], /pg_advisory_xact_lock/);
  assert.equal(f.calls.filter(sql => sql.startsWith('BEGIN')).length, 1);
});

test('grouped authorization rejects absent or duplicate cookies before borrowing and safely releases DB failures', async () => {
  const f = pooledFixture();
  await assert.rejects(f.authorize(f.request('')), code('studio_login_required'));
  await assert.rejects(f.authorize(f.request(`bo_jwt=${f.token()}; bo_jwt=${f.token()}`)), code('studio_login_required'));
  assert.equal(f.connections.borrowed, 0);
  f.state.offline = true;
  await assert.rejects(f.authorize(f.request()), error => error.statusCode === 503 && !error.message.includes('PRIVATE'));
  assert.equal(f.calls.at(-1), 'ROLLBACK');
  assert.equal(f.connections.borrowed, 1);
  assert.equal(f.connections.released, 1);
});

test('case-folded username/email collisions and pending credentials deny JWT without Lab fallback or writes', async () => {
  for (const change of [
    state => { state.extraUsers.push({ ...state.user, id: '8', username: 'other', email: 'OPERATOR' }); },
    state => { state.extraUsers.push({ ...state.user, id: '8', username: 'OPERATOR', email: 'other@example.invalid' }); },
    state => { state.user.hash = null; state.user.salt = null; },
    state => { state.user.hash = 'invalid-hash'; },
  ]) {
    const f = pooledFixture(), request = f.request(`bo_jwt=${f.token()}; lab_session=${bearer}`);
    await f.authorize(request);
    change(f.state);
    await assert.rejects(f.authorize(request), code('studio_login_required'));
    assert.equal(f.calls.at(-1), 'ROLLBACK');
    assert.ok(f.calls.every(sql => !sql.includes('FROM croupier_auth.lab_sessions')), 'present BO cookies never fall back to Lab');
    assert.ok(f.calls.every(sql => /^(?:BEGIN|SELECT|COMMIT|ROLLBACK)/.test(sql)), 'no identity writes or promotions');
    assert.equal(f.connections.borrowed, f.connections.released);
  }
});

test('the real adapter binds login and account ID while projecting no credentials into the actor', async () => {
  for (const kind of ['jwt', 'lab']) {
    const f = pooledFixture();
    f.state.user.username = "operator' OR 1=1 --";
    const actor = await f.authorize(kind === 'lab' ? f.request(`lab_session=${bearer}`) : f.request());
    assert.deepEqual(actor, { accountId: '7', user: f.state.user.username, role: 'admin', scope });
    const projection = f.calls.findIndex(sql => sql.includes('LEFT JOIN croupier_auth.bo_auth_epochs'));
    assert.doesNotMatch(f.calls[projection], /OR 1=1/);
    assert.deepEqual(f.parameters[projection], kind === 'lab' ? ['7'] : [f.state.user.username.toLowerCase(), f.state.user.username.toLowerCase()]);
    assert.doesNotMatch(JSON.stringify(actor), /salt|hash|stamp|epoch|token/);
  }
});

test('identity changes are fresh: JWT subject removal is denied and Lab returns the current actor', async () => {
  for (const kind of ['jwt', 'lab']) {
    const f = pooledFixture(), request = kind === 'lab' ? f.request(`lab_session=${bearer}`) : f.request();
    assert.equal((await f.authorize(request)).user, 'operator');
    f.state.user.username = 'renamed-operator';
    if (kind === 'jwt') await assert.rejects(f.authorize(request), code('studio_login_required'));
    else assert.deepEqual(await f.authorize(request), { accountId: '7', user: 'renamed-operator', role: 'admin', scope });
    assert.equal(f.connections.borrowed, 2);
    assert.equal(f.connections.released, 2);
  }
});

test('missing epoch keeps zero semantics and corrupt epochs fail closed without secret errors', async () => {
  for (const kind of ['jwt', 'lab']) {
    for (const epoch of [null, undefined]) {
      const f = pooledFixture(); f.state.epoch = epoch; f.state.lab.auth_epoch = 0;
      const request = kind === 'lab' ? f.request(`lab_session=${bearer}`) : f.request(`bo_jwt=${f.token({ auth_epoch: 0 })}`);
      assert.equal((await f.authorize(request)).user, 'operator');
    }
    for (const epoch of [-1, NaN, Infinity, 'invalid', '9007199254740993']) {
      const f = pooledFixture(); f.state.epoch = epoch;
      const request = kind === 'lab' ? f.request(`lab_session=${bearer}`) : f.request();
      await assert.rejects(f.authorize(request), error => error.code === 'studio_auth_unavailable' && !error.message.includes('PRIVATE'));
      assert.equal(f.calls.at(-1), 'ROLLBACK');
      assert.equal(f.connections.borrowed, f.connections.released);
    }
  }
});

test('malformed stamps, pending Lab accounts and invalid stored session epochs are denied', async () => {
  for (const stamp of [null, '', 'bad', 'A'.repeat(64)]) {
    const f = pooledFixture(); f.state.lab.source_stamp = stamp;
    await assert.rejects(f.authorize(f.request(`lab_session=${bearer}`)), code('studio_login_required'));
    const jwt = pooledFixture();
    await assert.rejects(jwt.authorize(jwt.request(`bo_jwt=${jwt.token({ source_stamp: stamp })}`)), code('studio_login_required'));
  }
  for (const change of [
    state => { state.user.hash = null; state.user.salt = null; },
    state => { state.lab.source_stamp = null; state.user.hash = null; state.user.salt = null; },
    state => { state.lab.auth_epoch = null; },
    state => { state.lab.auth_epoch = '2'; },
    state => { state.lab.auth_epoch = -1; },
  ]) {
    const f = pooledFixture(); change(f.state);
    await assert.rejects(f.authorize(f.request(`lab_session=${bearer}`)), code('studio_login_required'));
    assert.equal(f.calls.at(-1), 'ROLLBACK');
    assert.equal(f.connections.borrowed, f.connections.released);
  }
});

test('signer rotation and removed or expired opaque sessions are read before the account each time', async () => {
  const jwt = pooledFixture(), request = jwt.request();
  await jwt.authorize(request);
  jwt.state.secret = 'd'.repeat(64);
  await assert.rejects(jwt.authorize(request), code('studio_login_required'));
  assert.equal(jwt.calls.slice(4).filter(sql => sql.startsWith('SELECT')).length, 1);
  for (const change of [state => { state.lab = null; }, state => { state.lab.expires = clock; }]) {
    const f = pooledFixture(), request = f.request(`lab_session=${bearer}`);
    await f.authorize(request); change(f.state);
    await assert.rejects(f.authorize(request), code('studio_login_required'));
    assert.equal(f.calls.slice(4).filter(sql => sql.startsWith('SELECT')).length, 1);
    assert.equal(f.connections.borrowed, f.connections.released);
  }
});

test('projection, transaction and release failures remain safe and release the borrowed connection', async () => {
  for (const options of [
    { failQuery: sql => sql.includes('LEFT JOIN croupier_auth.bo_auth_epochs') },
    { failQuery: sql => sql.startsWith('BEGIN') },
    { failQuery: sql => sql === 'COMMIT' },
    { failQuery: sql => sql.includes('LEFT JOIN croupier_auth.bo_auth_epochs') || sql === 'ROLLBACK' },
    { failRelease: true },
  ]) {
    const f = pooledFixture(options);
    await assert.rejects(f.authorize(f.request()), error => error.code === 'studio_auth_unavailable' && !error.message.includes('PRIVATE'));
    assert.equal(f.connections.borrowed, 1);
    assert.equal(f.connections.released, 1);
  }
});

test('denied authorization poisons an existing mutating transaction even if its callback catches denial', async () => {
  const f = pooledFixture(), request = f.request(); f.state.epoch++;
  await assert.rejects(f.boDb.transaction(async () => {
    await assert.rejects(f.authorize(request), code('studio_login_required'));
  }), code('studio_login_required'));
  assert.match(f.calls[0], /pg_advisory_xact_lock/);
  assert.equal(f.calls.at(-1), 'ROLLBACK');
  assert.equal(f.connections.borrowed, 1);
  assert.equal(f.connections.released, 1);
});
