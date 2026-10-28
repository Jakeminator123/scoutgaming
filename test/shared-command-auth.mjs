// Instrumented SQL adapters prove query/lock order and rejection boundaries.
// They do not prove PostgreSQL lock blocking or live session revocation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createSharedCommandAuth } from '../services/game/storage/shared-command-auth.mjs';

const scope = Object.freeze({ environment: 'test', workspaceId: 'shared-command-auth' });
const digest = 'a'.repeat(64), sessionId = `player-${digest}`, actorId = 'player-a';
const stamp = row => createHash('sha256').update(`${row.salt}:${row.hash}`).digest('hex');
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

function fixture({ source = 'local', playerAccounts = true, epoch = 7, onRead } = {}) {
  const state = {
    time: 1000, active: true, serialized: true, scope, boJoined: true,
    player: { id: actorId, status: 'active' },
    account: { player_id: actorId, salt: 'account-salt', hash: 'account-hash' },
    link: { craig_user_id: '42' }, user: { id: 42, salt: 'bo-salt', hash: 'bo-hash' },
    key: { id: 'key-a', secret: 'key-secret', revoked_at: null, wallet_url: null, operator_id: 'north' },
    epoch: epoch === null ? undefined : { epoch },
  };
  const sources = {
    local: `local:${stamp(state.account)}`,
    credential: `credential:${stamp(state.user)}`,
    bo: `bo:${epoch ?? 0}:${stamp(state.user)}`,
    partner: `partner:key-a:${createHash('sha256').update(state.key.secret).digest('hex')}`,
  };
  state.session = { player_id: actorId, source_stamp: sources[source] ?? source,
    display_name: 'Alice', expires: 10000 };
  const queries = [], guards = [], failure = new Error('Required shared transaction absent');
  function adapter(schema) {
    return {
      assertSharedTransaction(options) {
        guards.push({ schema, options });
        if (!state.active || !state.serialized || schema === 'auth' && !state.boJoined
          || JSON.stringify(options.studioScope) !== JSON.stringify(state.scope)
          || options.serialize !== true) throw failure;
      },
      prepare(sql) {
        const table = /\bFROM (\w+)/.exec(sql)?.[1];
        const locked = /\bFOR SHARE$/.test(sql);
        return { async get(...parameters) {
          const query = { schema, table, locked, sql, parameters };
          queries.push(query);
          await onRead?.(query, state, queries.length);
          assert.equal(schema, ['users', 'bo_auth_epochs', 'api_keys'].includes(table) ? 'auth' : 'game');
          const row = {
            player_sessions: state.session, players: state.player, player_accounts: state.account,
            craig_player_links: state.link, users: state.user, bo_auth_epochs: state.epoch, api_keys: state.key,
          }[table];
          if (table === 'player_sessions') {
            assert.equal(parameters[0], digest);
            if (!row || !(row.expires > parameters[1])) return undefined;
          } else {
            assert.equal(parameters[0], ['users', 'bo_auth_epochs'].includes(table) ? '42' : table === 'api_keys' ? 'key-a' : actorId);
          }
          return row && { ...row };
        } };
      },
    };
  }
  const db = adapter('game'), boDb = adapter('auth');
  const options = { db, boDb, scope, playerAccounts, now: () => state.time };
  const auth = createSharedCommandAuth(options);
  return { auth, options, db, boDb, state, queries, guards, failure,
    bind: signal => auth.bindingById(sessionId, { actorId, signal }) };
}

test('local binding locks player and current credential before the final session and returns only internal identity', async () => {
  const h = fixture();
  assert.equal(h.queries.length, 0);
  assert.deepEqual(await h.bind(), { actorId, sessionId, expiresAt: 10000, partnerKeyId: null });
  assert.deepEqual(h.queries.map(q => [q.table, q.locked]), [
    ['player_sessions', false], ['players', true], ['player_accounts', true], ['player_sessions', true],
  ]);
  assert.ok(Object.isFrozen(await h.bind()));
  assert.ok(h.guards.every(g => g.options.serialize === true
    && Object.isFrozen(g.options.studioScope)));
});

test('credential and BO binding use current locked link/user, with an epoch lock for BO provenance', async () => {
  for (const source of ['credential', 'bo']) {
    const h = fixture({ source });
    assert.ok(await h.bind());
    assert.deepEqual(h.queries.map(q => [q.table, q.locked]), [
      ['player_sessions', false], ['players', true], ['craig_player_links', true], ['users', true],
      ...(source === 'bo' ? [['bo_auth_epochs', true]] : []), ['player_sessions', true],
    ]);
  }
});

test('local accounts require the explicit server option, while credential/BO do not inherit that switch', async () => {
  const h = fixture();
  for (const playerAccounts of [undefined, false]) {
    const options = { ...h.options, playerAccounts };
    if (playerAccounts === undefined) delete options.playerAccounts;
    assert.equal(await createSharedCommandAuth(options).bindingById(sessionId, { actorId }), null);
  }
  assert.ok(h.queries.every(q => q.table === 'player_sessions' && !q.locked));
  for (const source of ['credential', 'bo']) assert.ok(await fixture({ source, playerAccounts: false }).bind());
});

test('stampless partner, null, old bare fingerprints and malformed provenance cannot become a command binding', async () => {
  for (const source of [null, '', 'partner:key', 'b'.repeat(64), `local:${'A'.repeat(64)}`,
    `credential:${'c'.repeat(63)}`, `bo:01:${'b'.repeat(64)}`, `bo:9007199254740992:${'b'.repeat(64)}`]) {
    const h = fixture({ source });
    assert.equal(await h.bind(), null, String(source));
    assert.equal(h.queries.length, 1);
  }
});

test('a live same-scope serialized transaction and joined auth adapter are mandatory before any SQL', async () => {
  for (const changed of [{ active: false }, { serialized: false }, { boJoined: false },
    { scope: { ...scope, workspaceId: 'other' } }]) {
    const h = fixture();
    Object.assign(h.state, changed);
    await assert.rejects(h.bind(), error => error === h.failure);
    assert.equal(h.queries.length, 0);
  }
  const h = fixture();
  for (const changed of [{ db: {} }, { boDb: {} }, { playerAccounts: 'true' }, { now: 1 }]) {
    assert.throws(() => createSharedCommandAuth({ ...h.options, ...changed }), TypeError);
  }
});

test('binding must name the exact session and actor, with an integer unexpired session time', async () => {
  const h = fixture();
  for (const invalid of ['', digest, `player-${'A'.repeat(64)}`, null]) {
    assert.equal(await h.auth.bindingById(invalid, { actorId }), null);
  }
  assert.equal(h.queries.length, 0);
  assert.equal(await h.auth.bindingById(sessionId, { actorId: 'other-player' }), null);
  for (const expires of ['10000', Number.MAX_SAFE_INTEGER + 1, 1000, 999]) {
    h.state.session.expires = expires;
    assert.equal(await h.bind(), null);
  }
});

test('deleted or blocked players and missing local credentials are rejected before the session can be locked', async () => {
  for (const change of [state => { state.player = undefined; }, state => { state.player.status = 'blocked'; },
    state => { state.account = undefined; }, state => { state.account.player_id = 'other'; }]) {
    const h = fixture({ onRead(query, state) { if (query.table === 'players') change(state); } });
    assert.equal(await h.bind(), null);
    assert.ok(!h.queries.some(q => q.table === 'player_sessions' && q.locked));
  }
});

test('a local password rotation before its lock is acquired invalidates the issued fingerprint', async () => {
  for (const field of ['salt', 'hash']) {
    const h = fixture({ onRead(query, state) {
      if (query.table === 'player_accounts') state.account[field] = 'rotated';
    } });
    assert.equal(await h.bind(), null);
  }
});

test('deleted/reassigned links and deleted/rotated BO credentials cannot reuse a prior session', async () => {
  for (const change of [state => { state.link = undefined; }, state => { state.link.craig_user_id = ''; },
    state => { state.user = undefined; }, state => { state.user.id = 43; },
    state => { state.user.salt = 'rotated'; }, state => { state.user.hash = 'rotated'; }]) {
    const h = fixture({ source: 'credential', onRead(query, state) {
      if (query.table === 'craig_player_links') change(state);
    } });
    assert.equal(await h.bind(), null);
  }
});

test('BO logout or epoch changes observed at the lock reject the session, and corrupt epochs remain errors', async () => {
  for (const epoch of [8, 6]) {
    const h = fixture({ source: 'bo', onRead(query, state) {
      if (query.table === 'bo_auth_epochs') state.epoch.epoch = epoch;
    } });
    assert.equal(await h.bind(), null);
  }
  for (const epoch of [-1, 'bad', Number.MAX_SAFE_INTEGER + 1]) {
    const h = fixture({ source: 'bo' });
    h.state.epoch.epoch = epoch;
    await assert.rejects(h.bind(), /Invalid authentication epoch/);
  }
});

test('an absent BO epoch retains existing zero semantics only inside the serialized bridge', async () => {
  const h = fixture({ source: 'bo', epoch: null });
  assert.ok(await h.bind());
  h.state.serialized = false;
  await assert.rejects(h.bind(), error => error === h.failure);
  const revoked = fixture({ source: 'bo', epoch: null, onRead(query, state) {
    if (query.table === 'bo_auth_epochs') state.epoch = { epoch: 1 };
  } });
  assert.equal(await revoked.bind(), null);
});

test('the final locked session must equal every field of its first read, including display name and expiry', async () => {
  for (const [field, value] of [['player_id', 'other'], ['source_stamp', `local:${'b'.repeat(64)}`],
    ['display_name', 'Renamed'], ['expires', 11000]]) {
    const h = fixture({ onRead(query, state) {
      if (query.table === 'player_sessions' && query.locked) state.session[field] = value;
    } });
    assert.equal(await h.bind(), null, field);
  }
});

test('session deletion and expiration during credential reads or final row locking are rejected', async () => {
  const deleted = fixture({ onRead(query, state) {
    if (query.table === 'player_accounts') state.session = undefined;
  } });
  assert.equal(await deleted.bind(), null);
  const expired = fixture({ onRead(query, state) {
    if (query.table === 'player_accounts') state.time = 10000;
  } });
  assert.equal(await expired.bind(), null);
  const expiresAfterLock = fixture({ onRead(query, state) {
    if (query.table === 'player_sessions' && query.locked) state.time = 10000;
  } });
  assert.equal(await expiresAfterLock.bind(), null);
});

test('abort before SQL and during an awaited read preserves the reason and stops subsequent reads', async () => {
  const reason = new Error('request disconnected'), first = fixture(), controller = new AbortController();
  controller.abort(reason);
  await assert.rejects(first.bind(controller.signal), error => error === reason);
  assert.equal(first.queries.length, 0);
  const entered = deferred(), resume = deferred(), pendingController = new AbortController();
  const h = fixture({ onRead(query) {
    if (query.table === 'player_accounts') { entered.resolve(); return resume.promise; }
  } });
  const pending = h.bind(pendingController.signal);
  await entered.promise;
  pendingController.abort(reason);
  resume.resolve();
  await assert.rejects(pending, error => error === reason);
  assert.equal(h.queries.at(-1).table, 'player_accounts');
});

test('SQL failures are preserved on every BO read without fallback queries or binding', async () => {
  for (let failingRead = 1; failingRead <= 6; failingRead++) {
    const failure = new Error(`SQL read ${failingRead} failed`);
    const h = fixture({ source: 'bo', onRead(query, state, count) {
      if (count === failingRead) throw failure;
    } });
    await assert.rejects(h.bind(), error => error === failure);
    assert.equal(h.queries.length, failingRead);
  }
});

test('losing the shared transaction while a read awaits cannot return or continue a binding', async () => {
  const h = fixture({ onRead(query, state) { if (query.table === 'players') state.active = false; } });
  await assert.rejects(h.bind(), error => error === h.failure);
  assert.equal(h.queries.length, 2);
});

test('invalid or advancing clocks cannot issue a binding after its expiry', async () => {
  for (const time of [NaN, -1, Number.MAX_SAFE_INTEGER + 1, '1000']) {
    const h = fixture();
    h.state.time = time;
    await assert.rejects(h.bind(), /Invalid shared command clock/);
    assert.equal(h.queries.length, 0);
  }
  const h = fixture();
  let calls = 0;
  const auth = createSharedCommandAuth({ ...h.options, now: () => ++calls < 4 ? 1000 : 10000 });
  assert.equal(await auth.bindingById(sessionId, { actorId }), null);
});

// Nyckel→bolag (docs/plans/NYCKEL-BOLAG.md): a stamped partner session of a key bound to a company plays
// at the table. The key row is locked between P and the final session lock, and its company is returned.
test('stamped partner binding locks player, key and session in order and names the key company', async () => {
  const h = fixture({ source: 'partner', playerAccounts: false });
  assert.deepEqual(await h.bind(), { actorId, sessionId, expiresAt: 10000, partnerKeyId: 'key-a', operatorId: 'north' });
  assert.deepEqual(h.queries.map(q => [q.schema, q.table, q.locked]), [
    ['game', 'player_sessions', false], ['game', 'players', true], ['auth', 'api_keys', true], ['game', 'player_sessions', true],
  ]);
  assert.match(h.queries[2].sql, /to_jsonb\(k\)->>'operator_id' AS operator_id FROM api_keys k WHERE id=\? FOR SHARE$/);
  assert.ok(Object.isFrozen(await h.bind()));
});

test('a wrong stamp, revoked, external-wallet, other or company-less key and a mid-read rotation bind nothing', async () => {
  const changes = [state => { state.key.secret = 'rotated'; }, state => { state.key.revoked_at = '2026-10-28T00:00:00Z'; },
    state => { state.key.wallet_url = 'https://wallet.invalid'; }, state => { state.key.id = 'key-b'; },
    state => { state.key.operator_id = null; }, state => { delete state.key.operator_id; }, state => { state.key = undefined; }];
  for (const change of changes) {
    const h = fixture({ source: 'partner', onRead(query, state) { if (query.table === 'api_keys') change(state); } });
    assert.equal(await h.bind(), null, change.toString());
    assert.ok(!h.queries.some(q => q.table === 'player_sessions' && q.locked), 'the session is never locked');
  }
  for (const source of [`partner:key-a:${'0'.repeat(64)}`, `partner:key-a:${'A'.repeat(64)}`, 'partner:key-a', 'partner::' + 'a'.repeat(64)]) {
    const h = fixture({ source });
    assert.equal(await h.bind(), null, source);
    assert.ok(!h.queries.some(q => q.table === 'player_sessions' && q.locked));
  }
  const corrupt = fixture({ source: 'partner' }); corrupt.state.key.operator_id = 'bad company';
  await assert.rejects(corrupt.bind(), { code: 'partner_key_operator_invalid', statusCode: 503 });
});
