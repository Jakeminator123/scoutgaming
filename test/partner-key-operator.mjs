// Nyckel→bolag, PR A (docs/plans/NYCKEL-BOLAG.md): the engine reads a partner key's company tolerantly.
// Every product path runs on PGlite without migration 012 (today: no key has a company) and with it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { createPgliteStore, WITH_API_KEY_OPERATOR } from './fixtures/pglite-pool.mjs';
import { installPartnerApi } from '../services/game/storage/async-partner-api.mjs';
import { playerAuth } from '../services/game/storage/async-player-auth.mjs';
import { createSharedCommandAuth } from '../services/game/storage/shared-command-auth.mjs';
import { launchGameStart } from '../services/game/game-start.mjs';
import { keyOperator, claimedOperator, partnerLaunchOperator, partnerRoomRefusal, partnerRefusalHtml,
  PARTNER_ROOM_REFUSALS } from '../services/game/partner-operator.mjs';
import { createOperatorStore } from '../packages/operators/server/operator-store.mjs';
import { createStudioAdminAccounts } from '../apps/studio/lib/studio-admin-accounts.mjs';
import { createStudioAdminData } from '../apps/studio/lib/studio-admin-data.mjs';
import { readPartnerApiKeys } from '../apps/studio/lib/partner-api-keys.mjs';
import { approvedPartnerLaunchUrl } from '../apps/studio/lib/partner-launch-url.mjs';
import { demoLaunchLink } from '../apps/studio/client/admin/lib/demo-builder.mjs';

const scope = Object.freeze({ environment: 'partner-key-test', workspaceId: 'isolated' });
const origin = 'https://game.example.invalid';
const mismatch = { code: 'partner_operator_mismatch', statusCode: 403 }, invalid = { code: 'partner_key_operator_invalid', statusCode: 403 };
// The engine's own partner authority query (services/game/server.mjs).
const authority = boDb => id => boDb.prepare("SELECT id,secret,revoked_at,wallet_url,to_jsonb(k)->>'operator_id' AS operator_id FROM api_keys k WHERE id=?").get(id);
// Tokens are opaque here: the engine verifies its HS256 signature before any of this code runs.
const sign = claims => 'fixture.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.signature';
const claimsOf = url => JSON.parse(Buffer.from(new URL(url).searchParams.get('launch').split('.')[1], 'base64url').toString());

async function setup(t, { bound }) {
  const store = await createPgliteStore(bound ? { migrations: WITH_API_KEY_OPERATOR } : undefined);
  t.after(() => store.close());
  // croupier_studio.operators exactly as Studio migration 005 creates it.
  const studio = (await readFile(new URL('../ops/neon-studio/005-operators.sql', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  await store.pool.query('CREATE SCHEMA croupier_studio;\n' + /CREATE TABLE croupier_studio\.operators \([\s\S]*?\n\);/.exec(studio)[0]);
  for (const [id, slug, status] of [['north', 'north', 'active'], ['south', 'south-bet', 'active'], ['paused', 'paused-bet', 'suspended']]) {
    await store.pool.query('INSERT INTO croupier_studio.operators VALUES ($1,$2,$3,$4,$5,$6,$7)', [scope.environment, scope.workspaceId, id, slug, id, status, 1]);
  }
  const operators = await createOperatorStore({ sql: store.pool, scope });
  const operatorById = id => operators.getOperatorById(id), operatorBySlug = slug => operators.getOperatorBySlug(slug);
  const getPlayer = id => store.db.prepare('SELECT * FROM players WHERE id=?').get(id);
  const partner = installPartnerApi({ db: store.db, boDb: store.boDb, publicUrl: origin, publicGamePath: '/game', root: '',
    getPlayer, jwtSign: sign, logTx: () => {}, operatorById });
  const auth = playerAuth(store.db, () => assert.fail('a launch never creates a player here'), null,
    { partnerAuthority: authority(store.boDb), allowLegacyPartnerSessions: false });
  // Keys are inserted as Studio does: with the company column only once 012 exists.
  async function key(id, operatorId) {
    const secret = 'cs_' + id + '_'.repeat(8), value = 'ck_live_' + id;
    const columns = operatorId === undefined ? '' : ',operator_id', marks = operatorId === undefined ? '' : ',?';
    await store.boDb.prepare(`INSERT INTO api_keys (id,name,key,secret,scopes,created_at${columns}) VALUES (?,?,?,?,?,?${marks})`)
      .run(id, 'Key ' + id, value, secret, '["launch","play"]', '2026-10-28T00:00:00Z', ...(operatorId === undefined ? [] : [operatorId]));
    return { id, key: value, secret };
  }
  async function signed(k, input) {
    const path = '/api/v1/launch', body = JSON.stringify(input), ts = String(Math.floor(Date.now() / 1000));
    const req = Readable.from([body]); req.method = 'POST';
    req.headers = { 'x-api-key': k.key, 'x-timestamp': ts, 'x-signature': createHmac('sha256', k.secret).update(`${ts}.POST.${path}.${body}`).digest('hex') };
    const res = { writeHead(status) { this.status = status; }, end(text) { this.body = JSON.parse(text); } };
    await partner.handle(req, res, path); return res;
  }
  const count = async table => Number((await store.pool.query(`SELECT count(*) AS n FROM croupier_game.${table}`)).rows[0].n);
  // The engine launch route after jwtVerify: company check, landing, then the session (services/game/server.mjs).
  async function land(url, cookies = []) {
    const target = new URL(url), claims = claimsOf(url); target.searchParams.delete('launch');
    const operator = await partnerLaunchOperator(claims, target.searchParams, { operatorById });
    const destination = launchGameStart(target.searchParams, { origin: target.origin, operator });
    const cookie = (await auth.fromPartner({ headers: {}, socket: { encrypted: true } }, claims)).split(';')[0];
    cookies.push(cookie);
    return { destination, cookie, binding: await auth.binding({ headers: { cookie } }) };
  }
  return { store, partner, auth, key, signed, count, land, operatorById, operatorBySlug };
}

test('company values from key rows and claims are exact; refusals have fixed codes and Swedish pages', () => {
  assert.equal(keyOperator({}), null); assert.equal(keyOperator({ operator_id: null }), null); assert.equal(keyOperator(undefined), null);
  assert.equal(keyOperator({ operator_id: 'north' }), 'north');
  for (const value of ['', 'bad company', 42, '-north']) assert.throws(() => keyOperator({ operator_id: value }), { code: 'partner_key_operator_invalid', statusCode: 503 });
  assert.equal(claimedOperator({ sub: 'p' }), null); assert.equal(claimedOperator({ operator: 'north' }), 'north');
  for (const value of ['', {}, ['north'], 'a'.repeat(101)]) assert.throws(() => claimedOperator({ operator: value }), invalid);
  assert.deepEqual([...PARTNER_ROOM_REFUSALS].sort(), ['partner_key_unbound', 'partner_operator_mismatch']);
  for (const [code, title] of [['partner_operator_mismatch', 'Nyckeln gäller ett annat bolag'], ['partner_key_unbound', 'Nyckeln saknar bolag'],
    ['partner_key_operator_invalid', 'Bolaget är inte tillgängligt'], ['unknown', 'Bolaget är inte tillgängligt']]) {
    const html = partnerRefusalHtml(code);
    assert.match(html, new RegExp(`<title>${title}</title>`)); assert.match(html, /^<!doctype html><html lang="sv">/); assert.doesNotMatch(html, /unknown/);
  }
});

test('a bound launch lands at its company; another or an invalid ?operator= is refused, unbound keeps today', async () => {
  const operators = new Map([['north', { id: 'north', slug: 'north', status: 'active' }], ['paused', { id: 'paused', slug: 'paused-bet', status: 'suspended' }]]);
  const operatorById = async id => operators.get(id) ?? null, query = value => new URLSearchParams(value);
  assert.equal(await partnerLaunchOperator({ operator: 'north' }, query(''), { operatorById }), 'north');
  assert.equal(await partnerLaunchOperator({ operator: 'north' }, query('operator=north&table=room-1'), { operatorById }), 'north');
  for (const search of ['operator=south-bet', 'operator=Bad Slug', 'operator=north&operator=north'])
    await assert.rejects(partnerLaunchOperator({ operator: 'north' }, query(search), { operatorById }), mismatch, search);
  for (const claims of [{ operator: 'paused' }, { operator: 'missing' }]) await assert.rejects(partnerLaunchOperator(claims, query(''), { operatorById }), invalid);
  await assert.rejects(partnerLaunchOperator({ operator: 'north' }, query(''), {}), invalid, 'no operator store, no bound launch');
  // A token without a company keeps today's landing, also with ?operator= (PR C refuses it).
  assert.equal(await partnerLaunchOperator({ sub: 'p' }, query('operator=south-bet'), { operatorById: () => assert.fail('no lookup') }), null);
  assert.equal(launchGameStart(query('table=room-1&dealer=astrid'), { origin, operator: 'north' }), '/game?game=blackjack&dealer=astrid&table=room-1&operator=north');
  assert.equal(launchGameStart(query('operator=north'), { origin, operator: 'north' }), '/game?game=blackjack&operator=north');
  assert.equal(launchGameStart(query('table=room-1&dealer=astrid'), { origin }), '/game?game=blackjack');
  assert.equal(launchGameStart(query('table=room-1'), { origin, operator: null }), '/game?game=blackjack');
  assert.throws(() => launchGameStart(query(''), { origin, operator: 'Bad Slug' }), TypeError);
});

test('without 012: launches, sessions and bindings are unchanged and name no company', async t => {
  const h = await setup(t, { bound: false });
  const k = await h.key('key-a');
  const minted = await h.partner.keys.mintLaunch(k.id, { playerId: 'external-a' });
  const http = await h.signed(k, { playerId: 'external-a' });
  assert.equal(http.status, 200);
  for (const url of [minted.url, http.body.url]) {
    assert.deepEqual([...new URL(url).searchParams.keys()], ['launch']); assert.equal(Object.hasOwn(claimsOf(url), 'operator'), false);
  }
  const landed = await h.land(minted.url);
  assert.equal(landed.destination, '/game?game=blackjack');
  assert.deepEqual(landed.binding, { actorId: minted.playerRef, sessionId: landed.binding.sessionId, expiresAt: landed.binding.expiresAt, partnerKeyId: 'key-a', operatorId: null });
  assert.equal(await partnerRoomRefusal(landed.binding, 'north', { operatorBySlug: h.operatorBySlug }), 'partner_key_unbound');
  // A token that claims a company the key does not have is refused before any session.
  const sessions = await h.count('player_sessions');
  await assert.rejects(h.auth.fromPartner({ headers: {}, socket: {} }, { ...claimsOf(minted.url), operator: 'north' }), mismatch);
  assert.equal(await h.count('player_sessions'), sessions);
  // Studio creates no key before 012, so the table stays empty for it.
  const accounts = createStudioAdminAccounts({ boDb: h.store.boDb, gameDb: h.store.db, scope });
  const create = accounts.handlers.get('POST /studio/api/admin/apikeys/create');
  await assert.rejects(create({ body: { name: 'Partner', operatorId: 'north' }, scope, actor: { user: 'operator', role: 'admin' }, endpoint: { action: 'apikeys/create' } }),
    { code: 'partner_key_operator_schema_pending', statusCode: 503 });
  assert.equal(Number((await h.store.pool.query('SELECT count(*) AS n FROM croupier_auth.api_keys')).rows[0].n), 1, 'only the fixture key');
});

test('with 012: Studio binds a new key to an active company; launch claims, address and bindings carry it', async t => {
  const h = await setup(t, { bound: true });
  const accounts = createStudioAdminAccounts({ boDb: h.store.boDb, gameDb: h.store.db, scope });
  const create = body => accounts.handlers.get('POST /studio/api/admin/apikeys/create')({ body, scope, actor: { user: 'operator', role: 'admin' }, endpoint: { action: 'apikeys/create' } });
  for (const operatorId of ['missing', 'paused']) await assert.rejects(create({ name: 'Partner', operatorId }), { code: 'partner_key_operator_invalid', statusCode: 422 });
  const created = (await create({ name: 'Partner North', scopes: ['launch', 'play'], operatorId: 'north' })).key;
  assert.deepEqual((await h.store.pool.query('SELECT id,operator_id FROM croupier_auth.api_keys')).rows, [{ id: created.id, operator_id: 'north' }]);

  const minted = await h.partner.keys.mintLaunch(created.id, { playerId: 'external-a' });
  const http = await h.signed(created, { playerId: 'external-a' });
  assert.equal(http.status, 200); assert.equal(http.body.playerRef, minted.playerRef);
  for (const url of [minted.url, http.body.url]) {
    assert.equal(new URL(url).searchParams.get('operator'), 'north'); assert.equal(claimsOf(url).operator, 'north');
    assert.equal(claimsOf(url).partner, created.id);
  }
  const landed = await h.land(minted.url);
  assert.equal(landed.destination, '/game?game=blackjack&operator=north');
  assert.equal(landed.binding.operatorId, 'north'); assert.equal(landed.binding.partnerKeyId, created.id);
  assert.equal(await partnerRoomRefusal(landed.binding, 'north', { operatorBySlug: h.operatorBySlug }), null);
  assert.equal(await partnerRoomRefusal(landed.binding, 'south-bet', { operatorBySlug: h.operatorBySlug }), 'partner_operator_mismatch');
  assert.equal(await partnerRoomRefusal({ ...landed.binding, partnerKeyId: null }, 'south-bet', { operatorBySlug: h.operatorBySlug }), null, 'native players are not this check');
  // Explicit room address of the same company.
  const deep = await h.land(minted.url.replace('?operator=north&', '?operator=north&table=room-1&'));
  assert.equal(deep.destination, '/game?game=blackjack&table=room-1&operator=north');

  // Another company in the address: 403 before any session; a token without a company for a bound key: refused.
  const sessions = await h.count('player_sessions');
  await assert.rejects(h.land(minted.url.replace('?operator=north&', '?operator=south-bet&')), mismatch);
  const unclaimed = { ...claimsOf(minted.url) }; delete unclaimed.operator;
  await assert.rejects(h.auth.fromPartner({ headers: {}, socket: {} }, unclaimed), mismatch);
  await assert.rejects(h.auth.fromPartner({ headers: {}, socket: {} }, { ...unclaimed, operator: 'south' }), mismatch);
  assert.equal(await h.count('player_sessions'), sessions);

  // A suspended company stops new launches of its keys before any partner player is created.
  await h.store.pool.query("UPDATE croupier_studio.operators SET status='suspended' WHERE operator_id='north'");
  const players = await h.count('partner_players');
  await assert.rejects(h.partner.keys.mintLaunch(created.id, { playerId: 'external-new' }), invalid);
  const refused = await h.signed(created, { playerId: 'external-other' });
  assert.equal(refused.status, 403); assert.deepEqual(refused.body, { error: 'partner_key_operator_invalid' });
  assert.equal(await h.count('partner_players'), players);
  await assert.rejects(partnerLaunchOperator(claimsOf(minted.url), new URLSearchParams(), { operatorById: h.operatorById }), invalid);
});

test('the shared-table command binding reads the key company with real SQL, with and without 012', async t => {
  for (const bound of [false, true]) {
    const h = await setup(t, { bound });
    const k = await h.key('key-a', bound ? 'north' : undefined);
    const minted = await h.partner.keys.mintLaunch(k.id, { playerId: 'external-a' });
    const { binding } = await h.land(minted.url);
    // The command path runs inside the table's serialized shared transaction; here one PGlite transaction stands in.
    const joined = database => ({ prepare: sql => database.prepare(sql), assertSharedTransaction() {} });
    const commandAuth = createSharedCommandAuth({ db: joined(h.store.db), boDb: joined(h.store.boDb), scope });
    const locked = await h.store.db.transaction(() => commandAuth.bindingById(binding.sessionId, { actorId: binding.actorId }));
    if (!bound) { assert.equal(locked, null, 'a key without company is no command binding'); continue; }
    assert.deepEqual(locked, { actorId: binding.actorId, sessionId: binding.sessionId, expiresAt: binding.expiresAt, partnerKeyId: k.id, operatorId: 'north' });
    // Rotation (as Admin's apikeys/rotate) and revocation end both bindings.
    await h.store.boDb.prepare('UPDATE api_keys SET secret=? WHERE id=?').run('cs_rotated', k.id);
    assert.equal(await h.store.db.transaction(() => commandAuth.bindingById(binding.sessionId, { actorId: binding.actorId })), null);
    assert.equal(await h.auth.bindingById(binding.sessionId), null);
  }
});

// PR B (Admin och demo): what Admin's Integration and Partnerportalen read, with the real SQL.
const admin = { user: 'operator', role: 'admin' };
const adminData = h => createStudioAdminData({ db: h.store.db, boDb: h.store.boDb, scope,
  repository: { readDocument: async () => null, saveDocument: async () => assert.fail('no document write') } });
const listKeys = h => adminData(h).handlers.get('GET /studio/api/admin/apikeys')({ scope, actor: admin, endpoint: { action: 'apikeys' } });
const createKey = (h, body) => createStudioAdminAccounts({ boDb: h.store.boDb, gameDb: h.store.db, scope }).handlers
  .get('POST /studio/api/admin/apikeys/create')({ body, scope, actor: admin, endpoint: { action: 'apikeys/create' } });
const partnerKeys = (h, operatorId) => readPartnerApiKeys({ query: (text, values) => h.store.pool.query(text, values), operatorId });
const secretsOf = async h => (await h.store.pool.query('SELECT key, secret FROM croupier_auth.api_keys')).rows.flatMap(row => [row.key, row.secret]);

test('Admin lists every key with its company and offers this scope\'s companies; before 012 no key has one', async t => {
  for (const bound of [false, true]) {
    const h = await setup(t, { bound });
    // A company in another scope is never offered and never names a key.
    await h.store.pool.query('INSERT INTO croupier_studio.operators VALUES ($1,$2,$3,$4,$5,$6,$7)', ['other-scope', scope.workspaceId, 'elsewhere', 'elsewhere-bet', 'Elsewhere', 'active', 1]);
    if (bound) { await createKey(h, { name: 'North live', scopes: ['launch', 'play'], operatorId: 'north' }); await h.key('key-south', 'south'); }
    else await h.key('key-legacy');
    const listed = await listKeys(h);
    assert.equal(listed.operatorBinding, bound ? 'ready' : 'pending');
    assert.deepEqual(listed.operators, [{ id: 'north', name: 'north', status: 'active' }, { id: 'paused', name: 'paused', status: 'suspended' }, { id: 'south', name: 'south', status: 'active' }]);
    assert.deepEqual(listed.keys.map(key => [key.name, key.operatorId, key.operatorName]).sort(),
      bound ? [['Key key-south', 'south', 'south'], ['North live', 'north', 'north']] : [['Key key-legacy', null, null]]);
    const text = JSON.stringify(listed);
    for (const secret of await secretsOf(h)) assert.equal(text.includes(secret), false, 'no key or secret in the listing');
    assert.doesNotMatch(text, /elsewhere/i);
  }
});

test('Partnerportalen reads only its own company\'s keys with real SQL, masked; before 012 it reads none', async t => {
  const early = await setup(t, { bound: false });
  await early.key('key-legacy');
  assert.deepEqual(await partnerKeys(early, 'north'), { status: 'pending', keys: [] });
  const h = await setup(t, { bound: true });
  const north = (await createKey(h, { name: 'North live', scopes: ['launch', 'play'], operatorId: 'north' })).key;
  await h.key('key-south', 'south'); await h.key('key-north-old', 'north');
  await h.store.pool.query("UPDATE croupier_auth.api_keys SET revoked_at='2026-10-29T09:00:00.000Z', wallet_url='https://wallet.partner.invalid/x' WHERE id='key-north-old'");
  const own = await partnerKeys(h, 'north');
  assert.equal(own.status, 'connected');
  assert.deepEqual(own.keys.map(key => [key.id, key.operatorId, key.status, key.walletConfigured]), [[north.id, 'north', 'active', false], ['key-north-old', 'north', 'revoked', true]]);
  assert.deepEqual(own.keys[0].scopes, ['launch', 'play']); assert.equal(own.keys[1].revokedAt, '2026-10-29T09:00:00.000Z');
  assert.deepEqual((await partnerKeys(h, 'south')).keys.map(key => key.id), ['key-south']);
  assert.deepEqual(await partnerKeys(h, 'paused'), { status: 'connected', keys: [] });
  const text = JSON.stringify([own, await partnerKeys(h, 'south')]);
  for (const secret of await secretsOf(h)) assert.equal(text.includes(secret), false, 'no key or secret reaches the portal');
  assert.doesNotMatch(text, /wallet\.partner/);
  assert.deepEqual(Object.keys(own.keys[0]).sort(), ['createdAt', 'id', 'lastUsed', 'name', 'operatorId', 'revokedAt', 'scopes', 'status', 'walletConfigured']);
  // The company comes from the session; anything that is not a company id reads nothing.
  for (const operatorId of ["north' OR 'a'='a", '', null, undefined, ['north'], 'a'.repeat(101)]) {
    assert.deepEqual(await partnerKeys(h, operatorId), { status: 'not-connected', reason: 'no-operator', keys: [] }, String(operatorId));
  }
  assert.deepEqual(await readPartnerApiKeys({ operatorId: 'north' }), { status: 'not-connected', reason: 'no-pool', keys: [] });
  assert.deepEqual(await readPartnerApiKeys({ query: async () => { throw Error('private database details'); }, operatorId: 'north' }),
    { status: 'not-connected', reason: 'read-failed', keys: [] });
  // A row for another company is never shown, even from a wrong query.
  assert.deepEqual(await readPartnerApiKeys({ query: async text => ({ rows: text.includes(':column') ? [{ present: true }] : [{ id: 'x', operator_id: 'south' }] }), operatorId: 'north' }),
    { status: 'not-connected', reason: 'read-failed', keys: [] });
});

test('the demo key is bound to the chosen company: Admin\'s launch rule takes the engine address and the link lands there', async t => {
  const h = await setup(t, { bound: true });
  const created = await createKey(h, { name: 'demo-North', scopes: ['launch', 'play'], purpose: 'demo', operatorId: 'north' });
  assert.deepEqual(Object.keys(created.key).sort(), ['id', 'name'], 'a demo key never returns key or secret');
  const minted = await h.partner.keys.mintLaunch(created.key.id, { displayName: 'North demo' });
  assert.equal(approvedPartnerLaunchUrl(minted.url, origin)?.searchParams.get('operator'), 'north');
  const link = demoLaunchLink({ ok: true, url: minted.url }, { gameOrigin: origin, operatorSlug: 'north', roomId: 'room-1', dealerId: null });
  assert.deepEqual([...new URL(link).searchParams.keys()], ['launch', 'operator', 'table']);
  const landed = await h.land(link);
  assert.equal(landed.destination, '/game?game=blackjack&table=room-1&operator=north');
  assert.equal(landed.binding.operatorId, 'north');
  // A demo built for another company gets no link from this key: the engine would refuse it.
  assert.throws(() => demoLaunchLink({ ok: true, url: minted.url }, { gameOrigin: origin, operatorSlug: 'south-bet', roomId: 'room-1', dealerId: null }), /annat bolag/);
  const sessions = await h.count('player_sessions');
  await assert.rejects(h.land(link.replace('operator=north', 'operator=south-bet')), mismatch);
  assert.equal(await h.count('player_sessions'), sessions);
});
