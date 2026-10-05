import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { createStudioNativeAuth } from '../lib/studio-native-auth.mjs';
import { createPostgresStore } from '../../web/storage/postgres-store.mjs';

const secret = 'a'.repeat(64), bearer = 'b'.repeat(64), clock = 2_000_000;
const scope = { environment: 'fixture', workspaceId: 'croupier' };
function fixture(role = 'admin') {
  const user = { id: '7', username: 'operator', email: 'operator@example.invalid', salt: 'salt', hash: 'c'.repeat(128), role };
  const state = { user, epoch: 2, secret, offline: false, queries: [] };
  state.stamp = () => createHash('sha256').update(`${user.salt}:${user.hash}`).digest('hex');
  state.lab = { craig_user_id: '7', role, source_stamp: state.stamp(), auth_epoch: 2, expires: clock + 60_000 };
  const boDb = { prepare(sql) {
    state.queries.push(sql);
    async function rows() {
      if (state.offline) throw Error('PRIVATE DATABASE URL');
      if (sql.includes('FROM meta')) return state.secret ? [{ v: state.secret }] : [];
      if (sql.includes('FROM bo_auth_epochs')) return [{ epoch: state.epoch }];
      if (sql.includes('FROM lab_sessions')) return state.lab ? [state.lab] : [];
      return state.user ? [state.user] : [];
    }
    return { all: rows, get: async () => (await rows())[0] };
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

// Exercise the real PostgreSQL adapter's connection/transaction boundary with
// isolated rows. No network, installed schema or real identity is involved.
function pooledFixture({ grouped = true, afterRead = () => {} } = {}) {
  const f = fixture(), calls = [], connections = { borrowed: 0, released: 0 };
  const pool = {
    async query() { throw Error('Unexpected query outside the borrowed connection'); },
    async connect() {
      connections.borrowed++;
      return {
        async query(sql) {
          calls.push(sql);
          if (/^(?:BEGIN|COMMIT|ROLLBACK)/.test(sql)) return { rows: [], command: sql.startsWith('COMMIT') ? 'COMMIT' : 'BEGIN' };
          if (f.state.offline) throw Error('PRIVATE DATABASE URL');
          let rows;
          if (sql.includes('FROM croupier_auth.meta')) rows = f.state.secret ? [{ v: f.state.secret }] : [];
          else if (sql.includes('FROM croupier_auth.bo_auth_epochs')) rows = [{ epoch: f.state.epoch }];
          else if (sql.includes('FROM croupier_auth.lab_sessions')) rows = f.state.lab ? [f.state.lab] : [];
          else rows = f.state.user ? [f.state.user] : [];
          const result = { rows: rows.map(row => ({ ...row })), fields: [] };
          afterRead(sql, f.state);
          return result;
        },
        release() { connections.released++; },
      };
    },
  };
  const { boDb } = createPostgresStore({ pool });
  const authorize = createStudioNativeAuth({ boDb: grouped ? boDb : { ...boDb, transaction: undefined }, scope, now: () => clock });
  return { ...f, authorize, boDb, calls, connections };
}

test('admin and stored superadmin use live identity with canonical admin privilege and no writes', async () => {
  for (const role of ['admin','superadmin']) {
    const f = fixture(role), session = await f.authorize(f.request());
    assert.deepEqual(session, { user: 'operator', role:'admin', scope });
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

test('PostgreSQL authorization keeps four live reads but uses one transaction instead of four', async () => {
  for (const kind of ['jwt', 'lab']) {
    const ungrouped = pooledFixture({ grouped: false }), grouped = pooledFixture();
    for (const f of [ungrouped, grouped]) {
      const request = kind === 'lab' ? f.request(`lab_session=${bearer}`) : f.request();
      assert.deepEqual(await f.authorize(request), { user: 'operator', role: 'admin', scope });
      assert.equal(f.calls.filter(sql => sql.startsWith('SELECT')).length, 4);
      assert.equal(f.connections.borrowed, f.connections.released);
    }
    assert.equal(ungrouped.calls.length, 12);
    assert.equal(ungrouped.connections.borrowed, 4);
    assert.equal(grouped.calls.length, 6);
    assert.equal(grouped.connections.borrowed, 1);
    assert.doesNotMatch(grouped.calls[0], /pg_advisory_xact_lock/);
  }
});

test('grouped authorization rereads every request and rolls back on password or epoch revocation', async () => {
  for (const kind of ['jwt', 'lab']) {
    for (const revoke of [state => state.epoch++, state => { state.user.hash = 'd'.repeat(128); }, state => { state.user.role = 'reader'; }]) {
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

test('a concurrent epoch change during grouped reads is still observed before authorization', async () => {
  for (const kind of ['jwt', 'lab']) {
    const f = pooledFixture({ afterRead(sql, state) {
      if (kind === 'jwt' && sql.startsWith('SELECT role') || kind === 'lab' && sql.startsWith('SELECT salt,hash')) state.epoch++;
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
  assert.equal(f.calls.length, 6);
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
