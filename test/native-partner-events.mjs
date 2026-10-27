import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { command, newGame } from '../services/game/shoe-game.mjs';
import { createPostgresNativeTableCommand } from '../services/game/postgres-native-table.mjs';
import { installPartnerApi } from '../services/game/storage/async-partner-api.mjs';
import { playerAuth } from '../services/game/storage/async-player-auth.mjs';
import { createPgliteStore } from './fixtures/pglite-pool.mjs';

// The production PostgreSQL native table, partner API and player sessions on the
// engine's own schema (PGlite). PGlite has one session, so commands and the
// post-commit observer run strictly one after another; it proves rollback,
// commit ordering and provenance, not cross-session FOR UPDATE blocking (CI PG).
const bets = [{ main: 5, pp: 0, tp: 0 }, ...Array.from({ length: 6 }, () => ({ main: 0, pp: 0, tp: 0 }))];
const sha256 = value => createHash('sha256').update(value).digest('hex');

async function fixture(t, { failLog = false, failCommit = false, failPublish = false } = {}) {
  const store = await createPgliteStore(), { db, boDb, gamePool } = store;
  for (const id of ['native-alice', 'native-bob', 'ordinary']) await db.prepare('INSERT INTO players (id,name,currency,balance,created_at) VALUES (?,?,?,?,?)').run(id, id, 'EUR', 1000, 'test');
  const getPlayer = id => db.prepare('SELECT id, name, currency, balance, status FROM players WHERE id = ?').get(id);
  // Cloud policy: legacy unstamped partner sessions are refused (CROUPIER_STUDIO_NEON_POLICY=1).
  const auth = await playerAuth(db, () => { throw new Error('No real account creation'); }, null, { allowLegacyPartnerSessions: false,
    partnerAuthority: async id => boDb.prepare('SELECT id,secret,revoked_at,wallet_url FROM api_keys WHERE id=?').get(id) });
  let rejectedPublications = 0;
  const logTx = (pid, type, amount, currency, meta = '') => db.prepare('INSERT INTO transactions (player_id, type, amount, currency, meta, at) VALUES (?,?,?,?,?,?)')
    .run(pid, type, amount, currency, meta, new Date().toISOString());
  const partner = installPartnerApi({ db, boDb, shoeCommand: command, newGame, getPlayer, logTx, allowLegacyPartnerSessions: false,
    jwtSign: () => 'unused-test-token', publicUrl: 'https://example.invalid', root: '' });
  const keyA = await partner.keys.create({ name: 'A', scopes: ['launch', 'events'] }, null);
  const keyB = await partner.keys.create({ name: 'B', scopes: ['play'] }, null);
  const keyNoRead = await partner.keys.create({ name: 'launch only', scopes: ['launch'] }, null);
  for (const [key, external, internal] of [[keyA, 'alice', 'native-alice'], [keyA, 'bob', 'native-bob'], [keyB, 'alice', 'native-alice'], [keyNoRead, 'alice', 'native-alice']]) {
    await db.prepare('INSERT INTO partner_players VALUES (?,?,?)').run(key.id, external, internal);
  }
  const requests = [];
  async function subscribe(key, playerId) {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = createHmac('sha256', key.secret).update(`${ts}.GET./api/v1/events.${playerId}`).digest('hex');
    const url = new URL('https://example.invalid/api/v1/events');
    for (const [name, value] of Object.entries({ key: key.key, ts, sig, playerId })) url.searchParams.set(name, value);
    const req = new EventEmitter(), records = [];
    const res = { writeHead(status) { this.status = status; }, write(text) { records.push(text); }, end(text) { records.push(text); } };
    await partner.handleEvents(req, res, url); requests.push(req);
    return { res, records, rounds: () => records.filter(record => record.includes('event: round\n')).map(record => JSON.parse(record.match(/\ndata: (.*)\n/)[1])) };
  }
  const a = await subscribe(keyA, 'alice'), b = await subscribe(keyA, 'bob'), otherKey = await subscribe(keyB, 'alice');
  async function sessionFor(id = 'native-alice', stamp = `partner:${keyA.id}:${sha256(keyA.secret)}`, expires = Date.now() + 60000) {
    const token = randomBytes(32).toString('hex');
    await db.prepare('INSERT INTO player_sessions (digest,player_id,expires,source_stamp) VALUES (?,?,?,?)').run(sha256(token), id, expires, stamp);
    const request = { headers: { cookie: `player_session=${token}` } };
    return { request, session: await auth.session(request) };
  }
  const { session } = await sessionFor();
  async function seed(draws = [['8', '♠'], ['6', '♥'], ['9', '♣'], ['K', '♦'], ['5', '♠']]) {
    const game = newGame(); command(game, { op: 'state' }, 1000);
    const cards = draws.map(([r, s]) => ({ r, s })); game.shoe.cards.splice(-cards.length, cards.length, ...cards.reverse());
    await db.prepare('INSERT INTO blackjack_tables (player_id,state) VALUES (?,?) ON CONFLICT (player_id) DO UPDATE SET state=EXCLUDED.state').run('native-alice', JSON.stringify(game));
  }
  await seed();
  // Failures are injected on the table's own checked-out client: the ledger row is
  // written before the failure (as the old logTx did), and COMMIT never reaches the server.
  const pool = { query: (sql, values) => gamePool.query(sql, values), async connect() {
    const client = await gamePool.connect();
    return { release: () => client.release(), async query(sql, values) {
      if (failCommit && sql === 'COMMIT') throw new Error('isolated commit failure');
      const result = await client.query(sql, values);
      if (failLog && /^INSERT INTO transactions\b/.test(sql)) throw new Error('isolated transaction failure');
      return result;
    } };
  } };
  const native = createPostgresNativeTableCommand({ pool, publish: async observation => {
    // The observer reads through another pool checkout, which PGlite grants only
    // after the table client has committed and been released.
    assert.equal(JSON.parse((await db.prepare('SELECT state FROM blackjack_tables WHERE player_id=?').get(observation.playerId)).state).version, observation.view.version);
    assert.equal((await getPlayer(observation.playerId)).balance, observation.balance);
    if (failPublish) throw new Error('isolated subscriber failure');
    await partner.publishNativeRound(observation);
  }, onPublishError: () => rejectedPublications++ });
  async function request(op, fields = {}) {
    const version = JSON.parse((await db.prepare('SELECT state FROM blackjack_tables WHERE player_id=?').get('native-alice')).state).version;
    return { id: 'native-alice', op, version, requestId: randomUUID(), ...fields };
  }
  t.after(async () => { for (const req of requests) req.emit('close'); await store.close(); });
  return { db, boDb, auth, partner, keyA, keyB, keyNoRead, a, b, otherKey, native, session, sessionFor, request, seed, subscribe, getPlayer, rejectedPublications: () => rejectedPublications };
}

test('native start, act and collect publish committed public events only to the session key/player', async t => {
  const f = await fixture(t);
  assert.equal(f.a.res.status, 200, 'events-only observer is accepted');
  assert.equal(f.otherKey.res.status, 200, 'play observer stays supported');
  const start = await f.request('start', { bets, partnerKeyId: f.keyB.id, session: { partnerKeyId: f.keyB.id } });
  const opening = await f.native(start, f.session);
  assert.equal(opening.balance, 995);
  assert.equal(f.a.rounds().length, 1);
  const first = f.a.rounds()[0];
  assert.deepEqual(opening.presentation,first.events,'the original response and SSE carry the same presentation');
  assert.equal(opening.requestId,start.requestId);
  assert.deepEqual(Object.keys(first).sort(), ['type', 'op', 'requestId', 'version', 'phase', 'balance', 'events'].sort());
  assert.equal(first.requestId, start.requestId);
  assert.equal(first.events.filter(event => event.type === 'deal').length, 4);
  assert.equal(first.events.find(event => event.type === 'deal' && event.faceDown).card, null);
  assert.equal(JSON.stringify(first).includes('holeCard'), false);
  assert.equal(first.events.some(event => event.card?.r === 'K'), false, 'private hole rank excluded');
  assert.equal(f.b.rounds().length, 0);
  assert.equal(f.otherKey.rounds().length, 0, 'same native player in another key cannot leak there');
  const settlement = await f.native(await f.request('act', { action: 'stand' }), f.session);
  assert.equal(settlement.round.phase, 'settled');
  assert.equal(f.a.rounds().length, 2);
  assert.equal(f.a.rounds()[1].events.find(event => event.type === 'reveal').card.r, 'K', 'hole is public only after reveal');
  const collect = await f.request('collect');
  const paid = await f.native(collect, f.session);
  assert.equal(paid.round, null);
  assert.deepEqual(f.a.rounds()[2].events, [{ type: 'speak', line: 'placebets' }, { type: 'idle' }]);
  assert.deepEqual(await f.native(collect, f.session), paid);
  assert.equal(f.a.rounds().length, 3, 'duplicate collection is not another publication');
  assert.equal((await f.getPlayer('native-alice')).balance, paid.balance);
  assert.equal(f.rejectedPublications(), 0);
});

test('a retried native response retains its original presentation without replaying the command or SSE',async t=>{
  const f=await fixture(t),request=await f.request('start',{bets});
  const first=await f.native(request,f.session),retry=await f.native(request,f.session);
  assert.deepEqual(retry.presentation,first.presentation);
  assert.ok(retry.presentation.length>0);
  assert.equal(retry.balance,first.balance);
  assert.equal(f.a.rounds().length,1);
  const state=await f.native(await f.request('state'),f.session);
  assert.deepEqual(state.presentation,[]);
});

test('state, duplicate commands, stale version and illegal action never republish', async t => {
  const f = await fixture(t);
  await f.native(await f.request('state'), f.session);
  assert.equal(f.a.rounds().length, 0);
  const start = await f.request('start', { bets }); await f.native(start, f.session);
  await f.native(start, f.session);
  assert.equal(f.a.rounds().length, 1);
  await assert.rejects(f.native(await f.request('act', { action: 'stand', version: 0 }), f.session), /Table changed/);
  await assert.rejects(f.native(await f.request('act', { action: 'split' }), f.session), /Illegal action/);
  await assert.rejects(f.native({ ...start, bets: [] }, f.session), /Request ID reused/);
  assert.equal(f.a.rounds().length, 1);
  assert.equal((await f.getPlayer('native-alice')).balance, 995);
});

test('double derives the accepted action from the committed native request', async t => {
  const f = await fixture(t);
  await f.native(await f.request('start', { bets }), f.session);
  await f.native(await f.request('act', { action: 'double' }), f.session);
  assert.ok(f.a.rounds()[1].events.some(event => event.type === 'speak' && event.line === 'double'));
  assert.equal((await f.getPlayer('native-alice')).balance, 990);
});

test('rollback restores wallet and shoe and emits nothing', async t => {
  const f = await fixture(t, { failLog: true });
  const before = (await f.db.prepare('SELECT state FROM blackjack_tables').get()).state;
  await assert.rejects(f.native(await f.request('start', { bets }), f.session), /isolated transaction failure/);
  assert.equal((await f.db.prepare('SELECT state FROM blackjack_tables').get()).state, before);
  assert.equal((await f.getPlayer('native-alice')).balance, 1000);
  assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM transactions').get()).n, 0);
  assert.equal(f.a.rounds().length, 0);
});

test('failed commit is rolled back before any event can escape', async t => {
  const f = await fixture(t, { failCommit: true });
  const before = (await f.db.prepare('SELECT state FROM blackjack_tables').get()).state;
  await assert.rejects(f.native(await f.request('start', { bets }), f.session), /isolated commit failure/);
  assert.equal((await f.db.prepare('SELECT state FROM blackjack_tables').get()).state, before);
  assert.equal((await f.getPlayer('native-alice')).balance, 1000);
  assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM transactions').get()).n, 0);
  assert.equal(f.a.rounds().length, 0);
});

test('events permission grants no Partner table or wallet commands', async t => {
  const f = await fixture(t);
  for (const path of ['/api/v1/table', '/api/v1/demo-credit', '/api/v1/balance']) {
    const body = JSON.stringify({ playerId: 'alice', op: 'state', amount: 10 });
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', f.keyA.secret).update(`${ts}.POST.${path}.${body}`).digest('hex');
    const req = Readable.from([body]);
    req.method = 'POST'; req.headers = { 'x-api-key': f.keyA.key, 'x-timestamp': ts, 'x-signature': signature };
    const res = { writeHead(status) { this.status = status; }, end(text) { this.body = JSON.parse(text); } };
    await f.partner.handle(req, res, path);
    assert.equal(res.status, 403);
    assert.match(res.body.error, /scope (play|wallet) required/);
  }
  assert.equal((await f.getPlayer('native-alice')).balance, 1000);
  assert.equal(f.a.rounds().length, 0);
});

test('subscriber failure cannot roll back or fail an already accepted native command', async t => {
  const f = await fixture(t, { failPublish: true });
  const start = await f.request('start', { bets });
  assert.equal((await f.native(start, f.session)).balance, 995);
  assert.equal(f.rejectedPublications(), 1);
  assert.equal((await f.native(start, f.session)).balance, 995);
  assert.equal(f.rejectedPublications(), 1);
  assert.equal(f.a.rounds().length, 0);
});

test('ordinary, guest, expired, wrong-player, legacy-stamp and unknown-key provenance have no channel', async t => {
  const f = await fixture(t);
  const ordinary = await f.sessionFor('native-alice', null);
  assert.equal(await f.auth.user(ordinary.request), 'native-alice');
  assert.deepEqual(ordinary.session, { playerId: 'native-alice', partnerKeyId: null });
  assert.equal(await f.auth.user({ headers: {} }), null);
  assert.equal(await f.auth.session({ headers: {} }), null);
  assert.equal((await f.sessionFor('native-alice', `partner:${f.keyA.id}:${sha256(f.keyA.secret)}`, 0)).session, null);
  assert.equal((await f.sessionFor('native-alice', `partner:${f.keyA.id}`)).session, null, 'unstamped legacy session is refused under the cloud policy');
  const invalidContexts = [ordinary.session, null, { ...f.session, playerId: 'native-bob' }, { ...f.session, partnerKeyId: 'missing-key' }, { ...f.session, partnerKeyId: f.keyNoRead.id },
    { playerId: 'native-alice', partnerKeyId: f.keyA.id }];
  for (const session of invalidContexts) { await f.seed(); await f.native(await f.request('start', { bets }), session); }
  assert.equal(f.a.rounds().length, 0);
  assert.equal(f.b.rounds().length, 0);
  assert.equal(f.otherKey.rounds().length, 0);
  assert.equal((await f.subscribe(f.keyNoRead, 'alice')).res.status, 403);
});

test('revoked, scope-removed, missing or ambiguous mappings stop native publication', async t => {
  const f = await fixture(t);
  await f.native(await f.request('start', { bets }), f.session);
  assert.equal(f.a.rounds().length, 1);
  await f.boDb.prepare('UPDATE api_keys SET revoked_at=? WHERE id=?').run('test', f.keyA.id);
  await f.native(await f.request('act', { action: 'stand' }), f.session);
  assert.equal(f.a.rounds().length, 1, 'revoked key receives no further native message');
  await f.boDb.prepare('UPDATE api_keys SET revoked_at=NULL, scopes=? WHERE id=?').run('["launch"]', f.keyA.id);
  await f.native(await f.request('collect'), f.session);
  assert.equal(f.a.rounds().length, 1);
  await f.boDb.prepare('UPDATE api_keys SET scopes=? WHERE id=?').run('["launch","events"]', f.keyA.id);
  await f.db.prepare('INSERT INTO partner_players VALUES (?,?,?)').run(f.keyA.id, 'ambiguous-alice', 'native-alice');
  await f.seed();
  await f.native(await f.request('start', { bets }), f.session);
  assert.equal(f.a.rounds().length, 1);
  await f.db.prepare('DELETE FROM partner_players WHERE key_id=? AND player_id=?').run(f.keyA.id, 'native-alice');
  await f.native(await f.request('act', { action: 'stand' }), f.session);
  assert.equal(f.a.rounds().length, 1);
});
