import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { command, newGame } from '../web/shoe-game.mjs';
import { createNativeTableCommand } from '../web/native-table.mjs';
import { installPartnerApi } from '../web/partner-api.mjs';
import { playerAuth } from '../web/player-auth.mjs';

const bets = [{ main: 5, pp: 0, tp: 0 }, ...Array.from({ length: 6 }, () => ({ main: 0, pp: 0, tp: 0 }))];

function fixture(t, { failLog = false, failCommit = false, failPublish = false } = {}) {
  const db = new DatabaseSync(':memory:'), boDb = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE players (id TEXT PRIMARY KEY, name TEXT, currency TEXT, balance REAL, created_at TEXT);
    CREATE TABLE blackjack_tables (player_id TEXT PRIMARY KEY, state TEXT NOT NULL);
    CREATE TABLE transactions (player_id TEXT, type TEXT, amount REAL);`);
  for (const id of ['native-alice', 'native-bob', 'ordinary']) db.prepare('INSERT INTO players VALUES (?,?,?,?,?)').run(id, id, 'EUR', 1000, 'test');
  const getPlayer = id => db.prepare('SELECT * FROM players WHERE id=?').get(id);
  const auth = playerAuth(db, () => { throw new Error('No real account creation'); });
  let rejectedPublications = 0;
  const logTx = (id, type, delta) => {
    db.prepare('INSERT INTO transactions VALUES (?,?,?)').run(id, type, delta);
    if (failLog) throw new Error('isolated transaction failure');
  };
  const partner = installPartnerApi({ db, boDb, shoeCommand: command, newGame, getPlayer, logTx,
    jwtSign: () => 'unused-test-token', publicUrl: 'https://example.invalid', root: '' });
  const keyA = partner.keys.create({ name: 'A', scopes: ['launch', 'events'] }, null);
  const keyB = partner.keys.create({ name: 'B', scopes: ['play'] }, null);
  const keyNoRead = partner.keys.create({ name: 'launch only', scopes: ['launch'] }, null);
  for (const [key, external, internal] of [[keyA, 'alice', 'native-alice'], [keyA, 'bob', 'native-bob'], [keyB, 'alice', 'native-alice'], [keyNoRead, 'alice', 'native-alice']]) {
    db.prepare('INSERT INTO partner_players VALUES (?,?,?)').run(key.id, external, internal);
  }
  const requests = [];
  function subscribe(key, playerId) {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = createHmac('sha256', key.secret).update(`${ts}.GET./api/v1/events.${playerId}`).digest('hex');
    const url = new URL('https://example.invalid/api/v1/events');
    for (const [name, value] of Object.entries({ key: key.key, ts, sig, playerId })) url.searchParams.set(name, value);
    const req = new EventEmitter(), records = [];
    const res = { writeHead(status) { this.status = status; }, write(text) { records.push(text); }, end(text) { records.push(text); } };
    partner.handleEvents(req, res, url); requests.push(req);
    return { res, records, rounds: () => records.filter(record => record.includes('event: round\n')).map(record => JSON.parse(record.match(/\ndata: (.*)\n/)[1])) };
  }
  const a = subscribe(keyA, 'alice'), b = subscribe(keyA, 'bob'), otherKey = subscribe(keyB, 'alice');
  function sessionFor(id = 'native-alice', stamp = `partner:${keyA.id}`, expires = Date.now() + 60000) {
    const token = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO player_sessions (digest,player_id,expires,source_stamp) VALUES (?,?,?,?)').run(createHash('sha256').update(token).digest('hex'), id, expires, stamp);
    const request = { headers: { cookie: `player_session=${token}` } };
    return { request, session: auth.session(request) };
  }
  const { session } = sessionFor();
  function seed(draws = [['8', '♠'], ['6', '♥'], ['9', '♣'], ['K', '♦'], ['5', '♠']]) {
    const game = newGame(); command(game, { op: 'state' }, 1000);
    const cards = draws.map(([r, s]) => ({ r, s })); game.shoe.cards.splice(-cards.length, cards.length, ...cards.reverse());
    db.prepare('INSERT OR REPLACE INTO blackjack_tables VALUES (?,?)').run('native-alice', JSON.stringify(game));
  }
  seed();
  const commandDb = failCommit ? {
    exec(sql) { if (sql === 'COMMIT') throw new Error('isolated commit failure'); return db.exec(sql); },
    prepare(sql) { return db.prepare(sql); },
  } : db;
  const native = createNativeTableCommand({ db: commandDb, getPlayer, logTx, publish: observation => {
    // BEGIN can only succeed after the original table transaction has committed.
    db.exec('BEGIN IMMEDIATE');
    assert.equal(JSON.parse(db.prepare('SELECT state FROM blackjack_tables WHERE player_id=?').get(observation.playerId).state).version, observation.view.version);
    assert.equal(getPlayer(observation.playerId).balance, observation.balance);
    db.exec('ROLLBACK');
    if (failPublish) throw new Error('isolated subscriber failure');
    partner.publishNativeRound(observation);
  }, onPublishError: () => rejectedPublications++ });
  function request(op, fields = {}) {
    const version = JSON.parse(db.prepare('SELECT state FROM blackjack_tables WHERE player_id=?').get('native-alice').state).version;
    return { id: 'native-alice', op, version, requestId: randomUUID(), ...fields };
  }
  t.after(() => { for (const req of requests) req.emit('close'); db.close(); boDb.close(); });
  return { db, boDb, auth, partner, keyA, keyB, keyNoRead, a, b, otherKey, native, session, sessionFor, request, seed, subscribe, getPlayer, rejectedPublications: () => rejectedPublications };
}

test('native start, act and collect publish committed public events only to the session key/player', t => {
  const f = fixture(t);
  assert.equal(f.a.res.status, 200, 'events-only observer is accepted');
  assert.equal(f.otherKey.res.status, 200, 'play observer stays supported');
  const start = f.request('start', { bets, partnerKeyId: f.keyB.id, session: { partnerKeyId: f.keyB.id } });
  const opening = f.native(start, f.session);
  assert.equal(opening.balance, 995);
  assert.equal(f.a.rounds().length, 1);
  const first = f.a.rounds()[0];
  assert.deepEqual(Object.keys(first).sort(), ['type', 'op', 'requestId', 'version', 'phase', 'balance', 'events'].sort());
  assert.equal(first.requestId, start.requestId);
  assert.equal(first.events.filter(event => event.type === 'deal').length, 4);
  assert.equal(first.events.find(event => event.type === 'deal' && event.faceDown).card, null);
  assert.equal(JSON.stringify(first).includes('holeCard'), false);
  assert.equal(first.events.some(event => event.card?.r === 'K'), false, 'private hole rank excluded');
  assert.equal(f.b.rounds().length, 0);
  assert.equal(f.otherKey.rounds().length, 0, 'same native player in another key cannot leak there');
  const settlement = f.native(f.request('act', { action: 'stand' }), f.session);
  assert.equal(settlement.round.phase, 'settled');
  assert.equal(f.a.rounds().length, 2);
  assert.equal(f.a.rounds()[1].events.find(event => event.type === 'reveal').card.r, 'K', 'hole is public only after reveal');
  const collect = f.request('collect');
  const paid = f.native(collect, f.session);
  assert.equal(paid.round, null);
  assert.deepEqual(f.a.rounds()[2].events, [{ type: 'speak', line: 'placebets' }, { type: 'idle' }]);
  assert.deepEqual(f.native(collect, f.session), paid);
  assert.equal(f.a.rounds().length, 3, 'duplicate collection is not another publication');
  assert.equal(f.getPlayer('native-alice').balance, paid.balance);
  assert.equal(f.rejectedPublications(), 0);
});

test('state, duplicate commands, stale version and illegal action never republish', t => {
  const f = fixture(t);
  f.native(f.request('state'), f.session);
  assert.equal(f.a.rounds().length, 0);
  const start = f.request('start', { bets }); f.native(start, f.session);
  f.native(start, f.session);
  assert.equal(f.a.rounds().length, 1);
  assert.throws(() => f.native(f.request('act', { action: 'stand', version: 0 }), f.session), /Table changed/);
  assert.throws(() => f.native(f.request('act', { action: 'split' }), f.session), /Illegal action/);
  assert.throws(() => f.native({ ...start, bets: [] }, f.session), /Request ID reused/);
  assert.equal(f.a.rounds().length, 1);
  assert.equal(f.getPlayer('native-alice').balance, 995);
});

test('double derives the accepted action from the committed native request', t => {
  const f = fixture(t);
  f.native(f.request('start', { bets }), f.session);
  f.native(f.request('act', { action: 'double' }), f.session);
  assert.ok(f.a.rounds()[1].events.some(event => event.type === 'speak' && event.line === 'double'));
  assert.equal(f.getPlayer('native-alice').balance, 990);
});

test('rollback restores wallet and shoe and emits nothing', t => {
  const f = fixture(t, { failLog: true });
  const before = f.db.prepare('SELECT state FROM blackjack_tables').get().state;
  assert.throws(() => f.native(f.request('start', { bets }), f.session), /isolated transaction failure/);
  assert.equal(f.db.prepare('SELECT state FROM blackjack_tables').get().state, before);
  assert.equal(f.getPlayer('native-alice').balance, 1000);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM transactions').get().n, 0);
  assert.equal(f.a.rounds().length, 0);
});

test('failed commit is rolled back before any event can escape', t => {
  const f = fixture(t, { failCommit: true });
  const before = f.db.prepare('SELECT state FROM blackjack_tables').get().state;
  assert.throws(() => f.native(f.request('start', { bets }), f.session), /isolated commit failure/);
  assert.equal(f.db.prepare('SELECT state FROM blackjack_tables').get().state, before);
  assert.equal(f.getPlayer('native-alice').balance, 1000);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM transactions').get().n, 0);
  assert.equal(f.a.rounds().length, 0);
});

test('events permission grants no Partner table or wallet commands', async t => {
  const f = fixture(t);
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
  assert.equal(f.getPlayer('native-alice').balance, 1000);
  assert.equal(f.a.rounds().length, 0);
});

test('subscriber failure cannot roll back or fail an already accepted native command', t => {
  const f = fixture(t, { failPublish: true });
  const start = f.request('start', { bets });
  assert.equal(f.native(start, f.session).balance, 995);
  assert.equal(f.rejectedPublications(), 1);
  assert.equal(f.native(start, f.session).balance, 995);
  assert.equal(f.rejectedPublications(), 1);
  assert.equal(f.a.rounds().length, 0);
});

test('ordinary, guest, expired, wrong-player and unknown-key provenance have no channel', t => {
  const f = fixture(t);
  const ordinary = f.sessionFor('native-alice', null);
  assert.equal(f.auth.user(ordinary.request), 'native-alice');
  assert.deepEqual(ordinary.session, { playerId: 'native-alice', partnerKeyId: null });
  assert.equal(f.auth.user({ headers: {} }), null);
  assert.equal(f.auth.session({ headers: {} }), null);
  assert.equal(f.sessionFor('native-alice', `partner:${f.keyA.id}`, 0).session, null);
  const invalidContexts = [ordinary.session, null, { ...f.session, playerId: 'native-bob' }, { ...f.session, partnerKeyId: 'missing-key' }, { ...f.session, partnerKeyId: f.keyNoRead.id }];
  for (const session of invalidContexts) { f.seed(); f.native(f.request('start', { bets }), session); }
  assert.equal(f.a.rounds().length, 0);
  assert.equal(f.b.rounds().length, 0);
  assert.equal(f.otherKey.rounds().length, 0);
  assert.equal(f.subscribe(f.keyNoRead, 'alice').res.status, 403);
});

test('revoked, scope-removed, missing or ambiguous mappings stop native publication', t => {
  const f = fixture(t);
  f.native(f.request('start', { bets }), f.session);
  assert.equal(f.a.rounds().length, 1);
  f.boDb.prepare('UPDATE api_keys SET revoked_at=? WHERE id=?').run('test', f.keyA.id);
  f.native(f.request('act', { action: 'stand' }), f.session);
  assert.equal(f.a.rounds().length, 1, 'revoked key receives no further native message');
  f.boDb.prepare('UPDATE api_keys SET revoked_at=NULL, scopes=? WHERE id=?').run('["launch"]', f.keyA.id);
  f.native(f.request('collect'), f.session);
  assert.equal(f.a.rounds().length, 1);
  f.boDb.prepare('UPDATE api_keys SET scopes=? WHERE id=?').run('["launch","events"]', f.keyA.id);
  f.db.prepare('INSERT INTO partner_players VALUES (?,?,?)').run(f.keyA.id, 'ambiguous-alice', 'native-alice');
  f.seed();
  f.native(f.request('start', { bets }), f.session);
  assert.equal(f.a.rounds().length, 1);
  f.db.prepare('DELETE FROM partner_players WHERE key_id=? AND player_id=?').run(f.keyA.id, 'native-alice');
  f.native(f.request('act', { action: 'stand' }), f.session);
  assert.equal(f.a.rounds().length, 1);
});
