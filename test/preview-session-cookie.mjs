import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPreviewPlayer } from '../services/game/preview-session.mjs';
import { createPgliteStore } from './fixtures/pglite-pool.mjs';

const digest = token => createHash('sha256').update(token).digest('hex');
const tokenOf = cookie => {
  const token = /^preview_session=([a-f0-9]{64});/.exec(cookie)?.[1];
  assert.ok(token, 'the cookie carries a 32-byte bearer token');
  return token;
};

async function fixture(t, nodeEnv = 'production') {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  t.after(() => { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; });
  const store = await createPgliteStore(), db = store.db;
  t.after(() => store.close());
  let created = 0;
  const previewPlayer = createPreviewPlayer({ db,
    createPlayer: async ({ name }) => {
      const id = `preview-${++created}`;
      await db.prepare('INSERT INTO players (id,name,created_at) VALUES (?,?,?)').run(id, name, new Date().toISOString());
      return { id };
    },
    getPlayer: id => db.prepare('SELECT * FROM players WHERE id=?').get(id),
  });
  return { db, created: () => created,
    async issue({ encrypted = false, headers = {} } = {}) {
      const response = new Map();
      const playerId = await previewPlayer({ headers, socket: { encrypted } }, { setHeader: (name, value) => response.set(name, value) });
      return { playerId, cookie: response.get('Set-Cookie') };
    },
  };
}

test('production behind TLS termination issues Secure and preserves the digest and seven-day lifetime', async t => {
  const f = await fixture(t), before = Date.now();
  const issued = await f.issue({ headers: { 'x-forwarded-proto': 'http' } }), after = Date.now();
  const token = tokenOf(issued.cookie);
  assert.deepEqual(issued.cookie.split('; ').slice(1), ['Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=604800', 'Secure']);
  const row = await f.db.prepare('SELECT * FROM preview_sessions WHERE player_id=?').get(issued.playerId);
  assert.equal(row.digest, digest(token));
  assert.notEqual(row.digest, token);
  assert.ok(row.expires >= before + 7 * 86400000 && row.expires <= after + 7 * 86400000);
  assert.equal(f.created(), 1);
});

test('direct TLS issues Secure outside production regardless of forwarded protocol', async t => {
  const f = await fixture(t, 'development');
  const issued = await f.issue({ encrypted: true, headers: { 'x-forwarded-proto': 'http' } });
  assert.ok(issued.cookie.split('; ').includes('Secure'));
});

test('local HTTP remains usable and a forwarded HTTPS header cannot authorize Secure', async t => {
  const f = await fixture(t, 'development');
  const issued = await f.issue({ headers: { 'x-forwarded-proto': 'https', forwarded: 'proto=https' } });
  assert.deepEqual(issued.cookie.split('; ').slice(1), ['Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=604800']);
});

test('a valid preview session reuses its player without renewing the cookie or expiry', async t => {
  const f = await fixture(t), first = await f.issue();
  const before = await f.db.prepare('SELECT * FROM preview_sessions').all();
  const again = await f.issue({ headers: { cookie: `unrelated=1; preview_session=${tokenOf(first.cookie)}; another=2` } });
  assert.equal(again.playerId, first.playerId);
  assert.equal(again.cookie, undefined);
  assert.equal(f.created(), 1);
  assert.deepEqual(await f.db.prepare('SELECT * FROM preview_sessions').all(), before);
});

for (const [name, token] of [['malformed', 'invalid'], ['unknown', 'a'.repeat(64)]]) {
  test(`a ${name} preview token creates a new session without replacing another valid session`, async t => {
    const f = await fixture(t), first = await f.issue();
    const replacement = await f.issue({ headers: { cookie: `preview_session=${token}` } });
    assert.notEqual(replacement.playerId, first.playerId);
    assert.ok(replacement.cookie.split('; ').includes('Secure'));
    assert.notEqual(tokenOf(replacement.cookie), token);
    assert.equal(f.created(), 2);
    const again = await f.issue({ headers: { cookie: `preview_session=${tokenOf(first.cookie)}` } });
    assert.equal(again.playerId, first.playerId);
    assert.equal(again.cookie, undefined);
  });
}

test('an expired session is replaced and its stored digest is removed', async t => {
  const f = await fixture(t), first = await f.issue(), oldToken = tokenOf(first.cookie);
  await f.db.prepare('UPDATE preview_sessions SET expires=0 WHERE digest=?').run(digest(oldToken));
  const replacement = await f.issue({ headers: { cookie: `preview_session=${oldToken}` } });
  assert.notEqual(replacement.playerId, first.playerId);
  assert.notEqual(tokenOf(replacement.cookie), oldToken);
  assert.ok(replacement.cookie.split('; ').includes('Secure'));
  const rows = await f.db.prepare('SELECT * FROM preview_sessions').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].digest, digest(tokenOf(replacement.cookie)));
  assert.equal(rows[0].player_id, replacement.playerId);
});
