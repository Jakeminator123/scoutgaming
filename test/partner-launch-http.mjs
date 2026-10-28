// Nyckel→bolag, PR A (docs/plans/NYCKEL-BOLAG.md) over the engine's own HTTP: services/game/server.mjs
// runs from the repository on its disposable PostgreSQL database (test/fixtures/engine-qa.mjs) with the
// Studio policy runtime, one published room and shared tables on. Once without migration 012 (no key has
// a company) and once with 012 applied through its own offline tool, exactly as Jakob will apply it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { ENGINE_QA_SKIP, createEngineDatabase, installStudioRuntime, startEngine } from './fixtures/engine-qa.mjs';
import { publishedChatStudio } from './fixtures/published-chat-authority.mjs';
import { createOperatorStore } from '../packages/operators/server/operator-store.mjs';
import { createStudioAdminAccounts } from '../apps/studio/lib/studio-admin-accounts.mjs';
import { prepareApiKeyOperator } from '../tools/prepare-api-key-operator.mjs';

const company = publishedChatStudio.operator.slug, room = `/blackjack?operator=${company}&table=room-astrid`;
const PRIVATE_ENV = ['OPENCLAW_PRODUCT_SPEECH_URL', 'OPENCLAW_PRODUCT_SPEECH_TOKEN', 'OPENCLAW_BASE_URL', 'OPENCLAWAPI_KEY',
  'OPENCLAW_MODEL_API_KEY', 'OPENCLAW_MODEL_BASE_URL', 'OPENCLAW_MODEL_ID', 'OPENCLAW_MODEL_API', 'LAB_REMOTE_URL', 'LAB_REMOTE_TOKEN',
  'CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID', 'RUNPOD_API_KEY', 'RUNPOD_ENDPOINT_ID', 'ELEVENLABS_API_KEY', 'ELEVENLABS_OC_API', 'CARTESIA_API_KEY'];

for (const bound of [false, true]) test(`engine launch route and shared-table page hold a partner key to its company (012 applied: ${bound})`, { skip: ENGINE_QA_SKIP }, async t => {
  const database = await createEngineDatabase(t);
  const studio = await installStudioRuntime(t, database, publishedChatStudio);
  const operators = await createOperatorStore({ sql: database.pool, scope: studio.scope });
  for (const [operatorId, status] of [['other-company', 'active'], ['paused-company', 'suspended']])
    await operators.createOperator({ actor: 'engine-qa-seed', operatorId, slug: operatorId, name: operatorId, status });
  if (bound) await database.pool.query((await prepareApiKeyOperator({ database: database.name, role: database.name,
    releaseSha: '1'.repeat(40), rollbackSha: '2'.repeat(40), backupSha256: '3'.repeat(64) })).sql);
  const accounts = createStudioAdminAccounts({ boDb: database.store.boDb, gameDb: database.store.db, scope: studio.scope });
  const create = body => accounts.handlers.get('POST /studio/api/admin/apikeys/create')({ body, scope: studio.scope,
    actor: { user: 'engine-qa', role: 'admin' }, endpoint: { action: 'apikeys/create' } });
  // Keys exactly as Admin creates them; before 012 Admin creates none, so the fixture writes the row itself.
  async function key(name, operatorId) {
    if (bound && operatorId !== 'paused-company') return (await create({ name, scopes: ['launch'], operatorId })).key;
    const row = { id: 'key-' + name, key: 'ck_live_' + name.padEnd(24, 'x'), secret: 'cs_' + name.padEnd(43, 'y') };
    await database.query(`INSERT INTO croupier_auth.api_keys (id,name,key,secret,scopes,created_at${bound ? ',operator_id' : ''})
      VALUES ($1,$2,$3,$4,'["launch"]','2026-10-28T00:00:00Z'${bound ? ',$5' : ''})`, [row.id, name, row.key, row.secret, ...(bound ? [operatorId] : [])]);
    return row;
  }
  if (!bound) await assert.rejects(create({ name: 'pending', operatorId: company }), { code: 'partner_key_operator_schema_pending', statusCode: 503 });

  const env = { ...Object.fromEntries(PRIVATE_ENV.map(name => [name, ''])), ...studio.env, NODE_ENV: 'development',
    PUBLIC_URL: studio.env.CROUPIER_PUBLIC_ORIGIN, CROUPIER_SHARED_TABLE_ENABLED: '1', CROUPIER_STREAM_LANE: '', DEMO_GUEST_ACCESS: '' };
  const engine = await startEngine(t, { database, env, preload: studio.preload }), origin = engine.origin;
  async function mint(k, playerId) {
    const path = '/api/v1/launch', body = JSON.stringify({ playerId }), ts = String(Math.floor(Date.now() / 1000));
    const response = await fetch(origin + path, { method: 'POST', body, signal: AbortSignal.timeout(10000), headers: { 'content-type': 'application/json',
      'x-api-key': k.key, 'x-timestamp': ts, 'x-signature': createHmac('sha256', k.secret).update(`${ts}.POST.${path}.${body}`).digest('hex') } });
    return { status: response.status, body: await response.json() };
  }
  const sessions = async () => (await database.query("SELECT count(*)::int AS n FROM croupier_game.player_sessions WHERE source_stamp LIKE 'partner:%'"))[0].n;
  async function land(search) {
    const response = await fetch(`${origin}/game?${search}`, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
    return { status: response.status, location: response.headers.get('location'), cookies: response.headers.getSetCookie(), text: await response.text() };
  }
  async function page(cookie) {
    const response = await fetch(origin + room, { headers: cookie ? { cookie } : {}, signal: AbortSignal.timeout(10000) });
    return { status: response.status, text: await response.text() };
  }
  const token = url => new URL(url).searchParams.get('launch');
  const refused = (result, title) => {
    assert.equal(result.status, 403); assert.deepEqual(result.cookies ?? [], [], 'a refusal sets no cookie');
    assert.match(result.text, new RegExp(`<h1>${title}</h1>`)); assert.match(result.text, /^<!doctype html><html lang="sv">/);
  };

  // Without a partner session the published shared-table room is served as today.
  const open = await page();
  assert.equal(open.status, 200); assert.match(open.text, /data-shared-room="1"/); assert.match(open.text, /data-game-room-id="room-astrid"/);

  const north = await key('north', company), other = await key('other', 'other-company');
  const minted = await mint(north, 'external-north');
  assert.equal(minted.status, 200, JSON.stringify(minted.body));
  const url = new URL(minted.body.url);
  assert.deepEqual([...url.searchParams.keys()], bound ? ['operator', 'launch'] : ['launch']);
  if (bound) assert.equal(url.searchParams.get('operator'), company);

  let before = await sessions();
  const landed = await land('launch=' + token(minted.body.url));
  assert.equal(landed.status, 303);
  assert.equal(landed.location, bound ? `/game?game=blackjack&operator=${company}` : '/game?game=blackjack');
  assert.equal(landed.cookies.length, 1); assert.match(landed.cookies[0], /^player_session=[a-f0-9]{64};/);
  assert.equal(await sessions(), before + 1);
  const cookie = landed.cookies[0].split(';')[0];

  // Another company in the address: bound refuses before any session; a key without company keeps today's landing.
  before = await sessions();
  const elsewhere = await land(`operator=other-company&launch=${token(minted.body.url)}`);
  if (bound) { refused(elsewhere, 'Nyckeln gäller ett annat bolag'); assert.equal(await sessions(), before, 'no session row for a refusal'); }
  else { assert.equal(elsewhere.status, 303); assert.equal(elsewhere.location, '/game?game=blackjack&operator=other-company'); }

  // A token whose company was changed fails on the engine signature, also before any session.
  const [header, payload, signature] = token(minted.body.url).split('.');
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), operator: 'other-company' })).toString('base64url');
  before = await sessions();
  const tampered = await land(`operator=other-company&launch=${header}.${forged}.${signature}`);
  assert.equal(tampered.status, 403); assert.deepEqual(tampered.cookies, []); assert.match(tampered.text, /Launch token invalid or expired/);
  assert.equal(await sessions(), before);

  // The shared-table page: the key's own company plays; another company or no company sees why.
  const own = await page(cookie);
  if (bound) { assert.equal(own.status, 200); assert.match(own.text, /data-shared-room="1"/); }
  else refused(own, 'Nyckeln saknar bolag');
  const otherMinted = await mint(other, 'external-other');
  assert.equal(otherMinted.status, 200, JSON.stringify(otherMinted.body));
  const otherLanded = await land('launch=' + token(otherMinted.body.url));
  assert.equal(otherLanded.status, 303);
  if (bound) assert.equal(otherLanded.location, '/game?game=blackjack&operator=other-company');
  refused(await page(otherLanded.cookies[0].split(';')[0]), bound ? 'Nyckeln gäller ett annat bolag' : 'Nyckeln saknar bolag');

  // A suspended company launches nothing and creates no partner player.
  if (bound) {
    const paused = await key('paused', 'paused-company');
    const players = (await database.query('SELECT count(*)::int AS n FROM croupier_game.partner_players'))[0].n;
    assert.deepEqual(await mint(paused, 'external-paused'), { status: 403, body: { error: 'partner_key_operator_invalid' } });
    assert.equal((await database.query('SELECT count(*)::int AS n FROM croupier_game.partner_players'))[0].n, players);
  }
});
