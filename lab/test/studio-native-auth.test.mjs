import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { createStudioNativeAuth } from '../lib/studio-native-auth.mjs';

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

test('all four existing BO roles use the live identity without writes', async () => {
  for (const role of ['reader','staff','admin','superadmin']) {
    const f = fixture(role), session = await f.authorize(f.request());
    assert.deepEqual(session, { user: 'operator', role, scope });
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
  for (const role of ['reader','staff']) {
    const lower = fixture(role);
    await assert.rejects(lower.authorize(lower.request(`lab_session=${bearer}`)), code('studio_login_required'));
  }
});
test('missing signer and DB failures fail closed without exposing secrets or seeding', async () => {
  const f = fixture(); f.state.secret = null;
  await assert.rejects(f.authorize(f.request()), code('studio_auth_unavailable'));
  f.state.offline = true;
  await assert.rejects(f.authorize(f.request()), error => error.statusCode === 503 && !error.message.includes('PRIVATE'));
  await assert.rejects(f.authorize(f.request('')), code('studio_login_required'));
});
