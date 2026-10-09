import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoSession } from '../server/bo-session.mjs';

// A fake back office: one account, and a partner token with no role.
const fakeBo = async (url, init = {}) => {
  const u = new URL(url);
  const res = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers });
  if (u.pathname === '/api/bo/login') {
    const { user, pass } = JSON.parse(init.body);
    return user === 'kevin' && pass === 'right-pass' ? res(200, { ok: true }, { 'set-cookie': 'bo_jwt=good.jwt.sig; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800' }) : res(401, { error: 'wrong login' });
  }
  if (u.pathname === '/api/bo/me') {
    const c = init.headers?.cookie ?? '';
    return res(200, c === 'bo_jwt=good.jwt.sig' ? { user: 'kevin', role: 'superadmin' } : c === 'bo_jwt=partner.jwt.sig' ? { user: 'partner' } : {});
  }
  return res(404, {});
};

test('Table Studio signs in only with a back office account', async () => {
  const bo = createBoSession({ fetcher: fakeBo });
  assert.equal((await bo.login({ user: 'kevin', pass: 'nope' }, '1.2.3.4')).status, 401);
  const ok = await bo.login({ user: 'kevin', pass: 'right-pass' }, '1.2.3.4');
  assert.equal(ok.status, 200);
  assert.match(ok.cookie, /^bo_jwt=good\.jwt\.sig;/);
  assert.deepEqual(ok.who, { user: 'kevin', role: 'superadmin' });
});

test('a request is signed in only with a BO session that has a role', async () => {
  const bo = createBoSession({ fetcher: fakeBo });
  assert.equal(await bo.user({}), null);
  assert.equal(await bo.user({ cookie: 'bo_jwt=forged.jwt.sig' }), null);
  assert.equal(await bo.user({ cookie: 'bo_jwt=partner.jwt.sig' }), null);
  assert.deepEqual(await bo.user({ cookie: 'astrid_guest=x; bo_jwt=good.jwt.sig' }), { user: 'kevin', role: 'superadmin' });
  assert.match(bo.logoutCookie(true), /^bo_jwt=; Path=\/; HttpOnly; SameSite=Lax; Max-Age=0; Secure$/);
});

test('the back office must be a local service, and an unreachable one fails closed', async () => {
  assert.throws(() => createBoSession({ base: 'http://example.com' }), /local service/);
  const bo = createBoSession({ fetcher: async () => { throw new Error('down'); } });
  await assert.rejects(() => bo.user({ cookie: 'bo_jwt=a.b.c' }));
});
