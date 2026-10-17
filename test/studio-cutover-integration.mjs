import { fileURLToPath as speechRootPath } from 'node:url';
import * as savedGameDocumentContract from '../packages/studio-registry/server/document-contract.mjs';

const speechRepositoryRoot = speechRootPath(new URL('../', import.meta.url));

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpsRequest } from 'node:https';
import { createHash, createHmac, randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPostgresStore } from '../web/storage/postgres-store.mjs';
import { playerAuth } from '../web/storage/async-player-auth.mjs';
import { craigIdentity } from '../packages/studio-access/server/craig-identity.mjs';
import { installBoAuthEpoch } from '../packages/studio-access/server/bo-auth-epoch.mjs';
import { createStudioRepository } from '../packages/studio-registry/server/document-repository.mjs';
import { createSavedGamePolicy } from '../packages/presentation/server/saved-game-policy.mjs';
import { createRenderStudioPolicy } from '../web/storage/studio-runtime.mjs';
import { createSeedProject } from '../packages/presentation/contracts/studio-model.mjs';
import { createStudioNativeAuth } from '../apps/studio/lib/studio-native-auth.mjs';
import { createStudioNativeAuthActions, createStudioLoginRateLimit } from '../apps/studio/lib/studio-native-auth-actions.mjs';
import { createStudioAdminData } from '../apps/studio/lib/studio-admin-data.mjs';
import { createStudioAdminReadouts } from '../apps/studio/lib/studio-admin-readouts.mjs';
import { createStudioAdminAccounts } from '../apps/studio/lib/studio-admin-accounts.mjs';
import { createStudioAdminApi } from '../apps/studio/lib/studio-admin-api.mjs';
import { createStudioDocumentApi } from '../apps/studio/lib/studio-document-api.mjs';
import { createStudioGameAuthority, studioCommandSignature } from '../apps/studio/lib/studio-game-authority.mjs';
import { createStudioGameCommandApi } from '../web/studio-game-commands.mjs';
import { createPlayerAdministration } from '../packages/storage/server/player-administration.mjs';
import { planStudioMigrations, loadStudioMigrations } from '../ops/neon-studio/migrations.mjs';
import { createSpeechJournal } from '../web/postgres-speech-journal.mjs';
import { createSpeechSessionManager, SPEECH_SESSION_POLICY } from '../web/generated-speech-session.mjs';
import { createGeneratedSpeechService } from '../packages/presentation/server/generated-speech-service.mjs';
import { GENERATED_SPEECH_DEFAULTS } from '../packages/presentation/server/generated-speech-provider.mjs';
import { createSpeechBlobArtifacts } from '../web/speech-blob-artifacts.mjs';
import {newGame} from '../web/shoe-game.mjs';
import { SHOE_RULES } from '../packages/shared/blackjack-shoe-rules.mjs';

const { createStudioGamePolicy } = createSavedGamePolicy({ documentContract: savedGameDocumentContract });

// This fixture accepts only a fresh user-owned localhost cluster. It never reads
// production environment/config files and is not a product/lab devserver.
export async function runStudioCutoverChecks({ pool, restart, tls } = {}) {
  assert.equal(typeof pool?.query, 'function'); assert.equal(typeof restart, 'function');
  const target = (await pool.query("SELECT host(inet_server_addr()) AS address,current_user AS role,current_database() AS database,current_setting('listen_addresses') AS listeners")).rows[0];
  assert.deepEqual(target, { address: '127.0.0.1', role: 'studio_qa', database: 'postgres', listeners: '127.0.0.1' });
  assert.ok(tls?.key && tls?.cert);
  const checks = [], scope = { environment: `https_qa_${randomBytes(6).toString('hex')}`, workspaceId: 'croupier' };
  async function check(name, work) { await work(); checks.push(name); console.log(`PASS ${name}`); }
  const password = `fixture-${randomBytes(18).toString('hex')}`, salt = randomBytes(16).toString('hex'), signer = randomBytes(32).toString('hex');
  const names = ['qa-superadmin', 'qa-reader', 'qa-revocable-admin', 'qa-staff', 'qa-player'];
  const roles = ['superadmin', 'reader', 'admin', 'staff', 'player'];
  await pool.query('INSERT INTO croupier_auth.meta(k,v) VALUES ($1,$2)', ['jwt_secret', signer]);
  for (const [index, username] of names.entries()) await pool.query('INSERT INTO croupier_auth.users(username,email,salt,hash,role,created_at) VALUES ($1,$2,$3,$4,$5,$6)',
    [username, `${username}@example.invalid`, salt, scryptSync(password, salt, 64).toString('hex'), roles[index], new Date().toISOString()]);
  const idle = dealerId => ({ dealerId, engineKey: 'idle-1/idle/idle', available: true });
  const voiceIdentity = Object.fromEntries(['audioSha256','videoSha256','previewSha256','textSha256','indexSha256']
    .map((key, index) => [key, String(index + 1).repeat(64)])); voiceIdentity.audioDelayMs = 200;
  let currentVoiceIdentity = structuredClone(voiceIdentity);
  const voiceLines = async () => ({ dealers: [{ dealer: 'astrid', name: 'Astrid', lines: [{ key: 'goodluck', text: 'Synthetic review fixture',
    identity: structuredClone(currentVoiceIdentity), reviewable: true, productionApproved: false }] }] });
  let runtime, cancellations = 0, server, studioOrigin, backendOrigin, cookies = {};
  let lastMail;
  const commandSecret = randomBytes(32).toString('hex'), mail = { send: async message => { lastMail = message; return { sent: true }; } };
  const transport = (url, options = {}) => new Promise((yes, no) => {
    const destination = new URL(url);
    if (![studioOrigin, backendOrigin].includes(destination.origin)) return no(new Error('fixture_external_request_rejected'));
    const outgoing = httpsRequest(destination, { method: options.method || 'GET', headers: options.headers, ca: tls.cert,
      lookup: (_name, options, callback) => callback(null, options.all ? [{ address: '127.0.0.1', family: 4 }] : '127.0.0.1', 4),
      signal: options.signal }, incoming => {
      const chunks = []; let bytes = 0;
      incoming.on('data', chunk => { bytes += chunk.length; if (bytes > 2 * 1024 * 1024) incoming.destroy(new Error('fixture_response_limit')); else chunks.push(chunk); });
      incoming.once('error', no);
      incoming.once('end', () => {
        const headers = new Headers(); for (const [key, value] of Object.entries(incoming.headers)) for (const item of Array.isArray(value) ? value : [value]) if (item !== undefined) headers.append(key, String(item));
        yes(new Response(Buffer.concat(chunks), { status: incoming.statusCode, headers }));
      });
    });
    outgoing.once('error', no); outgoing.end(options.body);
  });
  const call = (path, { method = 'GET', body, cookie = cookies.admin, origin = studioOrigin, headers = {} } = {}) => transport(`${studioOrigin}${path}`, {
    method, body: body === undefined ? undefined : JSON.stringify(body), headers: { ...(cookie ? { cookie } : {}),
      ...(method === 'GET' ? {} : { 'content-type': 'application/json', origin, 'sec-fetch-site': 'same-origin' }), ...headers },
  });
  // Previously issued, correctly signed game-only credentials must still be
  // rejected. Current Studio login never mints these legacy role cookies.
  const legacyRoleCookie = async username => {
    const { rows: [account] } = await pool.query('SELECT u.username,u.role,u.salt,u.hash,COALESCE(e.epoch,0)::int AS epoch FROM croupier_auth.users u LEFT JOIN croupier_auth.bo_auth_epochs e ON e.user_id=u.id WHERE u.username=$1', [username]);
    assert.ok(account);
    const parts = [{ alg: 'HS256', typ: 'JWT' }, { sub: account.username, role: account.role, aud: 'backoffice',
      source_stamp: createHash('sha256').update(`${account.salt}:${account.hash}`).digest('hex'),
      auth_epoch: account.epoch, exp: Math.floor(Date.now() / 1000) + 3600 }].map(value => Buffer.from(JSON.stringify(value)).toString('base64url'));
    return `bo_jwt=${parts.join('.')}.${createHmac('sha256', Buffer.from(signer, 'hex')).update(parts.join('.')).digest('base64url')}`;
  };
  async function setup() {
    const store = createPostgresStore({ pool }); await store.db.assertInstalled();
    const repository = createStudioRepository({ pool, scope }), gamePolicy = createStudioGamePolicy({ repository, scope, dealerIdle: idle });
    const authorize = createStudioNativeAuth({ boDb: store.boDb, scope });
    const publicOrigin = `https://public.croupier-qa.invalid:${new URL(studioOrigin).port}`;
    const allowedOrigins = [publicOrigin, studioOrigin];
    const config = { scope, allowedOrigins, publicHosts: allowedOrigins.map(origin => new URL(origin).host), apiBase: '/studio/api/admin', authBase: '/studio/api/auth' };
    const gameAuthority = createStudioGameAuthority({ env: { CROUPIER_PUBLIC_ORIGIN: studioOrigin, CROUPIER_BACKEND_ORIGIN: backendOrigin, CROUPIER_VERCEL_INGRESS_SECRET: commandSecret }, scope, fetchImpl: transport });
    const data = createStudioAdminData({ db: store.db, boDb: store.boDb, repository, scope, gamePolicy, canAssignDealer: gamePolicy.canAssignDealer, voiceLines });
    const accounts = createStudioAdminAccounts({ boDb: store.boDb, gameDb: store.db, scope, gameAuthority, mail, publicOrigin: studioOrigin });
    const readouts = createStudioAdminReadouts({ db: store.db, scope });
    const handlers = new Map([...data.handlers, ...accounts.handlers, ...readouts.handlers]), gates = new Map([...data.gates, ...accounts.gates]);
    const admin = createStudioAdminApi({ authorize, handlers, gates, allowedOrigins: config.allowedOrigins, publicHosts: config.publicHosts,
      mutationTransaction:work => store.boDb.transaction(work) });
    const auth = createStudioNativeAuthActions({ boDb: store.boDb, gameDb: store.db, scope, authorize, mail, publicOrigin: studioOrigin,
      rateLimit: createStudioLoginRateLimit({ boDb: store.boDb }), clientAddress: () => 'fixture-client' });
    const document = createStudioDocumentApi({ repository, authorize, config, gamePolicy, mutationTransaction:work => store.boDb.transaction(work),
      // Only animation labels are changed by this fixture; no new media binding
      // is accepted or marked reviewed by this synthetic verification callback.
      validateProjectBindings: value => { assert.ok(value.lines.every(line => line.variants.every(variant => variant.videoGenerationId === null))); } });
    const players = createPlayerAdministration({ db: store.db });
    const command = createStudioGameCommandApi({ scope, secret: commandSecret, publicOrigin: studioOrigin, authorize, boDb: store.boDb,
      execute: async ({ action, body, actor }) => {
        if (action === 'players/status') { const player = await players.setStatus({ ...body, actor: actor.user }); if (player.changed && body.status !== 'active') cancellations++; return { ok: true, player }; }
        if (action === 'apikeys/credit') {
          // Synthetic engine-owned wallet mutation proves nonce + domain atomicity.
          await store.db.prepare('UPDATE players SET balance=balance+? WHERE id=?').run(body.amount, body.playerId);
          await store.db.prepare('INSERT INTO transactions(player_id,type,amount,currency,meta,at) VALUES (?,?,?,?,?,?)')
            .run(body.playerId, 'qa-credit', body.amount, 'USD', 'isolated-engine-command', new Date().toISOString());
          return { ok: true };
        }
        throw Object.assign(new Error('fixture_action_unavailable'), { statusCode: 503 });
      } });
    const identity = craigIdentity(store.boDb), authEpoch = installBoAuthEpoch(store.boDb);
    const gameAuth = playerAuth(store.db, async ({ name }) => {
      const id = randomUUID();
      await store.db.prepare('INSERT INTO players(id,name,created_at) VALUES (?,?,?)').run(id, name, new Date().toISOString());
      return { id };
    }, identity, { authEpoch });
    runtime = { store, repository, gamePolicy, authorize, admin, auth, document, command, identity, authEpoch, gameAuth };
  }
  server = createServer(tls, async (incoming, outgoing) => {
    try {
      const chunks = []; let size = 0; for await (const chunk of incoming) { size += chunk.length; if (size > 2 * 1024 * 1024) throw new Error('fixture_body_limit'); chunks.push(chunk); }
      const raw = Buffer.concat(chunks), headers = new Headers(incoming.headers), path = incoming.url.split('?')[0];
      const engine = incoming.headers.host === new URL(backendOrigin).host;
      if (engine && incoming.headers['x-croupier-vercel-secret'] !== commandSecret) { outgoing.writeHead(403); outgoing.end(); return; }
      // The trusted ingress supplies the exact public host to the Render API.
      if (engine) headers.set('host', new URL(studioOrigin).host);
      const request = new Request(`${studioOrigin}${incoming.url}`, { method: incoming.method, headers,
        ...(!['GET', 'HEAD'].includes(incoming.method) ? { body: raw } : {}) });
      let result;
      if (path === '/api/studio-game/command') result = await runtime.command(request);
      else if (path.startsWith('/studio/api/auth/')) result = await runtime.auth.handle(request);
      else if (['/studio/api/project', '/studio/api/social'].includes(path)) result = await runtime.document.handle(request);
      else if (path === '/api/bo/config') result = Response.json(await runtime.gamePolicy.readGameConfiguration());
      else result = await runtime.admin.handle(request);
      const responseHeaders = Object.fromEntries(result.headers), setCookies = result.headers.getSetCookie();
      if (setCookies.length) responseHeaders['set-cookie'] = setCookies;
      outgoing.writeHead(result.status, responseHeaders); outgoing.end(Buffer.from(await result.arrayBuffer()));
    } catch { outgoing.writeHead(503, { 'content-type': 'application/json' }); outgoing.end('{"error":"fixture_unavailable"}'); }
  });
  await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
  const port = server.address().port;
  studioOrigin = `https://studio.croupier-qa.invalid:${port}`; backendOrigin = `https://render.croupier-qa.invalid:${port}`;
  try {
    await setup();
    const adminValue = { tiers: { classic: 'vera', high: 'astrid', vip: 'amira' }, rooms: [],
      pitboss: { payout10x: true, streak5: true, randomWalkMin: 45 }, tournaments: [] };
    await runtime.repository.initializeDocument('project', { value: createSeedProject(), revision: 'https-project-initial', actor: 'fixture-import' });
    await runtime.repository.initializeDocument('administration', { value: adminValue, revision: 'https-admin-initial', actor: 'fixture-import' });
    await check('current product-v1 and every registered Studio migration are checksum-verified', async () => {
      await runtime.store.db.assertInstalled(); const plan = await planStudioMigrations({ pool });
      assert.deepEqual(plan.applied.map(row => row.version), (await loadStudioMigrations()).map(row => row.version));
      assert.equal(plan.toApply.length, 0); assert.equal(plan.optionalPending.length, 0);
    });
    await check('actual Render default schema factory accepts001004 saved Neon policy and denies missing import without seeding', async () => {
      // URL validation is inert; the supplied pool remains the owned localhost
      // cluster. No fake schemaCheck replaces the real migrator/catalog checks.
      const fixtureGameDatabaseUrl = new URL('postgresql://ep-fixture.neon.tech/croupier_game?sslmode=require');
      fixtureGameDatabaseUrl.username = 'fixture';
      fixtureGameDatabaseUrl.password = 'synthetic';
      const env = { CROUPIER_STUDIO_NEON_POLICY:'1', CROUPIER_DATABASE:'postgres',
        CROUPIER_GAME_DATABASE_URL:fixtureGameDatabaseUrl.href,
        CROUPIER_STUDIO_ENVIRONMENT_ID:scope.environment, CROUPIER_STUDIO_WORKSPACE_ID:scope.workspaceId };
      const before = await runtime.gamePolicy.readSaved();
      const saved = await createRenderStudioPolicy({ storage:runtime.store, env, dealerIdle:idle });
      assert.deepEqual(saved.scope, scope); assert.deepEqual(await saved.policy.readSaved(), before);
      assert.deepEqual(await saved.repository.readDocument('project'), await runtime.repository.readDocument('project'));
      assert.deepEqual(await saved.repository.readDocument('administration'), await runtime.repository.readDocument('administration'));
      const absentScope = { ...scope, environment:`missing_${randomBytes(6).toString('hex')}` };
      const count = async () => (await pool.query('SELECT count(*)::int n FROM croupier_studio.documents WHERE environment_id=$1', [absentScope.environment])).rows[0].n;
      assert.equal(await count(), 0);
      await assert.rejects(createRenderStudioPolicy({ storage:runtime.store,
        env:{ ...env, CROUPIER_STUDIO_ENVIRONMENT_ID:absentScope.environment }, dealerIdle:idle }),
        { code:'studio_game_policy_missing' });
      assert.equal(await count(), 0);
      assert.deepEqual(await runtime.gamePolicy.readSaved(), before);
      assert.equal(await createRenderStudioPolicy({ env:{...env,CROUPIER_STUDIO_NEON_POLICY:'0'} }), null);
    });
    await check('HTTPS real native login admits administrators and rejects game-only credentials and legacy role cookies', async () => {
      for (const [key, user] of [['admin', names[0]], ['revocable', names[2]]]) {
        const result = await call('/studio/api/auth/login', { method: 'POST', body: { user, pass: password }, cookie: '' });
        assert.equal(result.status, 200);
        const issued = result.headers.getSetCookie(), boCookies = issued.filter(value => value.startsWith('bo_jwt='));
        assert.equal(boCookies.length, 1, 'HTTPS preserves the native BO session cookie separately');
        assert.ok(issued.some(value => value.startsWith('player_session=;') && value.includes('Max-Age=0')),
          'HTTPS separately clears the previous player session without replacing the BO cookie');
        cookies[key] = boCookies[0].split(';')[0];
        assert.equal((await result.json()).role, 'admin');
      }
      for (const [key, user] of [['reader', names[1]], ['staff', names[3]], ['player', names[4]]]) {
        const denied = await call('/studio/api/auth/login', { method: 'POST', body: { user, pass: password }, cookie: '' });
        assert.equal(denied.status, 401); assert.equal(denied.headers.get('set-cookie'), null);
        cookies[key] = await legacyRoleCookie(user);
        assert.equal((await call('/studio/api/project', { cookie: cookies[key] })).status, 401);
        assert.equal((await call('/studio/api/admin/config', { cookie: cookies[key] })).status, 401);
      }
      assert.equal((await call('/studio/api/project', { cookie: '' })).status, 401);
    });
    await check('HTTPS native administrator sees four inert mail previews and empty persisted shoes; anonymous/game-only access denied', async () => {
      assert.equal((await pool.query('SELECT count(*)::int n FROM croupier_game.blackjack_tables')).rows[0].n, 0);
      for (const action of ['shoes','emails']) {
        assert.equal((await call(`/studio/api/admin/${action}`, { cookie: '' })).status, 401);
        assert.equal((await call(`/studio/api/admin/${action}`, { cookie: cookies.reader })).status, 401);
        assert.equal((await call(`/studio/api/admin/${action}`, { method: 'POST', cookie: cookies.reader, body: {} })).status, 405);
      }
      const empty = await call('/studio/api/admin/shoes'); assert.equal(empty.status, 200);
      const state = await empty.json();
      assert.deepEqual(state.rules, SHOE_RULES); assert.equal(state.tableCount, 0); assert.equal(state.shoes, 0);
      assert.equal(state.activeRounds, 0); assert.equal(state.cutReached, 0); assert.equal(state.partial, false);
      const emails = await call('/studio/api/admin/emails'); assert.equal(emails.status, 200);
      const preview = await emails.json(); assert.equal(preview.templates.length, 4); assert.equal(preview.previewOnly, true);
      assert.doesNotMatch(JSON.stringify(preview), /https?:|<iframe|<script|bettalotto|backoffice|@/i);
      assert.equal(lastMail, undefined);
    });
    const shoePlayers = Array.from({ length: 4 }, (_, index) => `shoe-private-${randomUUID()}-${index}`);
    const shoeState = (dealt, phase = null, paid = false) => ({ ...newGame(), version: 1, paid,
      shoe: { id: randomUUID(), dealt, cards: Array.from({ length: SHOE_RULES.total - dealt }, () => ({ rank: 'K', suit: 'private-card-sentinel' })),
        cutReached: dealt >= SHOE_RULES.cutAfter }, round: phase ? { phase, holeCard: { privateHole: 'private-hole-sentinel' } } : null });
    const savedShoes = [newGame(), shoeState(SHOE_RULES.burn, 'insurance'), shoeState(SHOE_RULES.cutAfter, 'decisions'), shoeState(SHOE_RULES.cutAfter + 1, 'settled', true)];
    for (let index = 0; index < shoePlayers.length; index++) {
      await pool.query('INSERT INTO croupier_game.players(id,name,created_at) VALUES ($1,$2,$3)', [shoePlayers[index], 'private-player-name', new Date().toISOString()]);
      await pool.query('INSERT INTO croupier_game.blackjack_tables(player_id,state) VALUES ($1,$2)', [shoePlayers[index], JSON.stringify(savedShoes[index])]);
    }
    await check('actual persisted shoe/burn/cut/current-round SQL returns only bounded administrator aggregates over HTTPS', async () => {
      const result = await call('/studio/api/admin/shoes'); assert.equal(result.status, 200);
      const state = await result.json();
      assert.equal(state.tableCount, 4); assert.equal(state.sampledTables, 4); assert.equal(state.partial, false);
      assert.equal(state.shoes, 3); assert.equal(state.activeRounds, 2); assert.equal(state.cutReached, 2);
      assert.equal(state.certificationVerified, false); assert.equal(state.source, 'render-persisted-state');
      assert.doesNotMatch(JSON.stringify(state), /private-|player|cards|hole|balance|rank|suit|shoe_id/i);
      for (const id of shoePlayers) assert.equal(JSON.stringify(state).includes(id), false);
    });
    await check('actual malformed/scalar/missing shoe JSON and invalid cut arithmetic fail closed without hidden card disclosure', async () => {
      const corrupt = [ 'not-json', 'null', '[]', JSON.stringify({ ...newGame(), shoe: 'broken', round: 'broken' }),
        JSON.stringify({ ...newGame(), shoe: {} }), JSON.stringify({ ...newGame(), round: {} }),
        JSON.stringify({ ...newGame(), paid: 'false' }), JSON.stringify({ paid: false }),
        JSON.stringify({ ...savedShoes[1], shoe: { ...savedShoes[1].shoe, cards: 'private-card-sentinel' } }),
        JSON.stringify({ ...savedShoes[2], shoe: { ...savedShoes[2].shoe, cutReached: false } }),
        JSON.stringify({ ...savedShoes[1], shoe: { ...savedShoes[1].shoe, dealt: 2 } }) ];
      try {
        for (const state of corrupt) {
          await pool.query('UPDATE croupier_game.blackjack_tables SET state=$1 WHERE player_id=$2', [state, shoePlayers[0]]);
          const result = await call('/studio/api/admin/shoes');
          assert.ok([500, 503].includes(result.status), `corrupt persisted state must reject (${result.status})`);
          assert.doesNotMatch(await result.text(), /private-|cards|hole|rank|suit|SELECT|jsonb|syntax|postgres|invalid input/i);
        }
      } finally { await pool.query('UPDATE croupier_game.blackjack_tables SET state=$1 WHERE player_id=$2', [JSON.stringify(savedShoes[0]), shoePlayers[0]]); }
      assert.equal((await call('/studio/api/admin/shoes')).status, 200);
    });
    await check('actual persisted shoe aggregate caps its sample at 500 and exposes partial rather than a false total', async () => {
      const prefix = `partial-${randomUUID()}`;
      try {
        await pool.query("INSERT INTO croupier_game.players(id,name,created_at) SELECT $1||'-'||n,'private-player-name',$2 FROM generate_series(1,500) n", [prefix, new Date().toISOString()]);
        await pool.query('INSERT INTO croupier_game.blackjack_tables(player_id,state) SELECT id,$1 FROM croupier_game.players WHERE id LIKE $2', [JSON.stringify(newGame()), `${prefix}-%`]);
        const result = await call('/studio/api/admin/shoes'); assert.equal(result.status, 200);
        const state = await result.json(); assert.equal(state.tableCount, 504); assert.equal(state.sampledTables, 500); assert.equal(state.partial, true);
        assert.doesNotMatch(JSON.stringify(state), /private-|player|cards|hole|balance|rank|suit/i);
      } finally {
        await pool.query('DELETE FROM croupier_game.blackjack_tables WHERE player_id LIKE $1', [`${prefix}-%`]);
        await pool.query('DELETE FROM croupier_game.players WHERE id LIKE $1', [`${prefix}-%`]);
      }
    });
    let updatedProject, previousProjection;
    await check('Studio HTTPS save is observed by Render with exact saved revision and CAS conflict', async () => {
      previousProjection = await (await call('/api/bo/config')).json();
      const source = (await (await call('/studio/api/project')).json()).project, draft = structuredClone(source); draft.lines[0].label = 'HTTPS saved label';
      const save = await call('/studio/api/project', { method: 'PUT', body: { project: draft, expectedRevision: source.revision } });
      assert.equal(save.status, 200); updatedProject = (await save.json()).project;
      assert.notEqual(updatedProject.revision, source.revision);
      const config = await (await call('/api/bo/config')).json(); assert.equal(config.projectRevision, updatedProject.revision); assert.notEqual(config.revision, previousProjection.revision);
      assert.equal(config.configurationSource, 'neon/croupier_studio');
      assert.equal((await call('/studio/api/project', { method: 'PUT', body: { project: draft, expectedRevision: source.revision } })).status, 409);
      assert.equal((await runtime.repository.listDocumentHistory('project')).length, 1);
    });
    await check('actual two-deployment concurrent saves have one winner with history and audit committed together', async () => {
      const documents = await runtime.gamePolicy.readSaved(), another = createStudioGamePolicy({ repository: createStudioRepository({ pool, scope }), scope, dealerIdle: idle });
      const results = await Promise.allSettled([runtime.gamePolicy, another].map((policy, index) => policy.saveAdministration({ ...documents.administration,
        tiers: { ...documents.administration.tiers, classic: index ? 'mei' : 'astrid' } }, documents.administrationRevision, { actor: names[0] })));
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1); assert.equal(results.filter(result => result.status === 'rejected' && result.reason.code === 'studio_conflict').length, 1);
      assert.equal((await runtime.repository.listDocumentHistory('administration')).length, 1);
      assert.equal((await pool.query('SELECT count(*)::int n FROM croupier_studio.audit_events WHERE environment_id=$1 AND action=$2', [scope.environment, 'save_document'])).rows[0].n, 2);
    });
    await check('actual native voice review binds exact identities, current roles and saved CAS with changed-media approval invalidation', async () => {
      const first = await call('/studio/api/admin/voicelines'); assert.equal(first.status, 200);
      const lines = await first.json(), line = lines.dealers[0].lines[0];
      const body = { dealer: 'astrid', line: 'goodluck', verdict: 'approved', expectedIdentity: line.identity, expectedRevision: lines.revision };
      assert.equal((await call('/studio/api/admin/voiceline-review', { method: 'POST', cookie: cookies.reader, body })).status, 401);
      assert.equal((await call('/studio/api/admin/voiceline-review', { method: 'POST', cookie: '', body })).status, 401);
      const tampered = { ...body, expectedIdentity: { ...line.identity, audioSha256: '9'.repeat(64) } };
      assert.equal((await call('/studio/api/admin/voiceline-review', { method: 'POST', body: tampered })).status, 409);
      const saved = await call('/studio/api/admin/voiceline-review', { method: 'POST', body }); assert.equal(saved.status, 200);
      assert.equal((await call('/studio/api/admin/voiceline-review', { method: 'POST', body })).status, 409);
      const document = await runtime.repository.readDocument('administration');
      assert.deepEqual(document.value.voiceReview.astrid.goodluck.identity, voiceIdentity);
      assert.equal(document.value.voiceReview.astrid.goodluck.by, names[0]);
      assert.equal((await (await call('/studio/api/admin/voicelines')).json()).dealers[0].lines[0].reviewState, 'current-human-review');
      currentVoiceIdentity.audioSha256 = '8'.repeat(64);
      try {
        const changed = await (await call('/studio/api/admin/voicelines')).json(), changedLine = changed.dealers[0].lines[0];
        assert.equal(changedLine.review, null); assert.equal(changedLine.reviewState, 'unbound-or-changed-media'); assert.equal(changedLine.productionApproved, false);
        assert.equal((await call('/studio/api/admin/voiceline-review', { method: 'POST', body: { ...body, expectedRevision: changed.revision } })).status, 409);
      } finally { currentVoiceIdentity = structuredClone(voiceIdentity); }
    });
    let player, invitedCookie;
    await check('native account creation and invite/resend execute actual SQL with isolated mail fixture', async () => {
      const created = await call('/studio/api/admin/players/create', { method: 'POST', body: { username: 'isolated-user', password, name: 'Isolated user' } });
      assert.equal(created.status, 200, 'isolated player creation'); player = (await created.json()).player;
      assert.equal((await runtime.store.db.prepare('SELECT balance FROM players WHERE id=?').get(player.id)).balance, 1000);
      assert.equal((await call('/studio/api/admin/users/invite', { method: 'POST', body: { email: 'invite@example.invalid', role: 'staff' } })).status, 400);
      assert.equal(lastMail, undefined);
      const invited = await call('/studio/api/admin/users/invite', { method: 'POST', body: { email: 'invite@example.invalid', role: 'admin' } });
      assert.equal(invited.status, 200, 'isolated administrator invitation'); assert.equal((await invited.json()).emailSent, true);
      assert.equal((await call('/studio/api/admin/users/resend', { method: 'POST', body: { username: 'invite@example.invalid' } })).status, 200);
      assert.equal((await pool.query('SELECT count(*)::int n FROM croupier_auth.tokens WHERE username=$1', ['invite@example.invalid'])).rows[0].n, 1);
      const invitationToken = new URL(lastMail.link).searchParams.get('t');
      const setupPassword = await call('/studio/api/auth/set-password', { method: 'POST', cookie: '', body: { token: invitationToken, pass: password } });
      assert.equal(setupPassword.status, 200);
      assert.equal((await call('/studio/api/auth/set-password', { method: 'POST', cookie: '', body: { token: invitationToken, pass: password } })).status, 400);
      assert.equal((await pool.query('SELECT count(*)::int n FROM croupier_auth.tokens WHERE username=$1', ['invite@example.invalid'])).rows[0].n, 0);
      const login = await call('/studio/api/auth/login', { method: 'POST', cookie: '', body: { user: 'invite@example.invalid', pass: password } });
      assert.equal(login.status, 200); invitedCookie = login.headers.get('set-cookie').split(';')[0];
    });
    await check('native reset consumes SQL tokens, revokes old sessions and preserves game-only roles', async () => {
      const replacement = `reset-${randomBytes(18).toString('hex')}`;
      for (const [user, expectedRole] of [['invite@example.invalid', 'admin'], [names[1], 'reader']]) {
        assert.equal((await call('/studio/api/auth/reset-request', { method: 'POST', cookie: '', body: { user } })).status, 200);
        const token = new URL(lastMail.link).searchParams.get('t');
        assert.equal((await pool.query('SELECT count(*)::int n FROM croupier_auth.tokens WHERE username=$1', [user])).rows[0].n, 1);
        assert.equal((await call('/studio/api/auth/set-password', { method: 'POST', cookie: '', body: { token, pass: replacement } })).status, 200);
        assert.equal((await call('/studio/api/auth/set-password', { method: 'POST', cookie: '', body: { token, pass: replacement } })).status, 400);
        assert.equal((await pool.query('SELECT count(*)::int n FROM croupier_auth.tokens WHERE username=$1', [user])).rows[0].n, 0);
        const stored = (await pool.query('SELECT role,salt,hash FROM croupier_auth.users WHERE username=$1', [user])).rows[0];
        assert.equal(stored.role, expectedRole);
        assert.equal(stored.hash, scryptSync(replacement, stored.salt, 64).toString('hex'));
        const login = await call('/studio/api/auth/login', { method: 'POST', cookie: '', body: { user, pass: replacement } });
        assert.equal(login.status, expectedRole === 'admin' ? 200 : 401);
        if (expectedRole === 'reader') assert.equal(login.headers.get('set-cookie'), null);
      }
      assert.equal((await call('/studio/api/admin/config', { cookie: invitedCookie })).status, 401);
      assert.equal((await call('/studio/api/auth/login', { method: 'POST', cookie: '', body: { user: 'invite@example.invalid', pass: password } })).status, 401);
    });
    await check('signed Render status command calls cancellation and preserves authoritative balance', async () => {
      const result = await call('/studio/api/admin/players/status', { method: 'POST', body: { playerId: player.id, status: 'blocked', reason: 'isolated QA' } });
      assert.equal(result.status, 200); assert.equal((await result.json()).authority, 'render'); assert.equal(cancellations, 1);
      const stored = await runtime.store.db.prepare('SELECT status,balance,account_epoch FROM players WHERE id=?').get(player.id);
      assert.equal(stored.status, 'blocked'); assert.equal(stored.balance, 1000); assert.equal(stored.account_epoch, 1);
    });
    await check('Render command replay rejects a second SQL credit in the same nonce transaction', async () => {
      const command = { action: 'apikeys/credit', actor: { user: names[0], role: 'admin' }, body: { id: 'qa-partner', playerId: player.id, amount: 25 }, commandId: randomUUID(), scope };
      const raw = JSON.stringify(command), timestamp = String(Date.now()), headers = { cookie: cookies.admin, origin: studioOrigin, 'content-type': 'application/json',
        'x-croupier-vercel-secret': commandSecret, 'x-forwarded-host': new URL(studioOrigin).host,
        'x-croupier-studio-timestamp': timestamp, 'x-croupier-studio-signature': studioCommandSignature(commandSecret, timestamp, raw) };
      assert.equal((await transport(`${backendOrigin}/api/studio-game/command`, { method: 'POST', headers, body: raw })).status, 200);
      assert.equal((await transport(`${backendOrigin}/api/studio-game/command`, { method: 'POST', headers, body: raw })).status, 409);
      assert.equal((await runtime.store.db.prepare('SELECT balance FROM players WHERE id=?').get(player.id)).balance, 1025);
      assert.equal((await pool.query("SELECT count(*)::int n FROM croupier_game.transactions WHERE player_id=$1 AND type='qa-credit'", [player.id])).rows[0].n, 1);
    });
    await check('Host/Origin/scope/actor tampering rejects without changing saved policy or wallet', async () => {
      assert.equal((await call('/studio/api/admin/tier', { method: 'POST', body: {}, origin: 'https://wrong.invalid' })).status, 403);
      // HTTPS itself rejects an invalid Host/SNI before application routing.
      await assert.rejects(call('/studio/api/project', { headers: { host: 'wrong.invalid' } }), error => error.code === 'ERR_TLS_CERT_ALTNAME_INVALID');
      assert.equal((await call('/studio/api/project', { headers: { 'x-forwarded-host': 'wrong.invalid' } })).status, 403);
      const other = createStudioGamePolicy({ repository: createStudioRepository({ pool, scope: { ...scope, workspaceId: 'wrong' } }), scope: { ...scope, workspaceId: 'wrong' }, dealerIdle: idle });
      await assert.rejects(other.readSaved(), error => error.code === 'studio_game_policy_missing');
      for (const tampering of [{ actor: { user: 'forged-user', role: 'admin' } }, { scope: { ...scope, workspaceId: 'wrong' } }]) {
        const raw = JSON.stringify({ action: 'apikeys/credit', actor: { user: names[0], role: 'admin' }, body: { id: 'qa-partner', playerId: player.id, amount: 100 },
          commandId: randomUUID(), scope, ...tampering }), timestamp = String(Date.now());
        const denied = await transport(`${backendOrigin}/api/studio-game/command`, { method: 'POST', body: raw,
          headers: { cookie: cookies.admin, origin: studioOrigin, 'content-type': 'application/json', 'x-croupier-vercel-secret': commandSecret,
            'x-forwarded-host': new URL(studioOrigin).host, 'x-croupier-studio-timestamp': timestamp,
            'x-croupier-studio-signature': studioCommandSignature(commandSecret, timestamp, raw) } });
        assert.equal(denied.status, 403);
      }
      assert.equal((await runtime.store.db.prepare('SELECT balance FROM players WHERE id=?').get(player.id)).balance, 1025);
    });
    const savedBeforeRestart = await runtime.gamePolicy.readSaved();
    const sessionRequest = cookie => ({ headers: { host: new URL(backendOrigin).host, cookie }, socket: { encrypted: true } });
    const n1Account = await runtime.identity.find(names[0]);
    const frozenN1 = { ...n1Account, authEpoch: await runtime.authEpoch(n1Account.id) };
    const n1PlayerCookie = (await runtime.gameAuth.fromBackoffice(sessionRequest(''), frozenN1)).split(';')[0];
    const n1PlayerId = await runtime.gameAuth.user(sessionRequest(n1PlayerCookie));
    assert.ok(n1PlayerId);
    await check('actual cluster restart preserves saved policy, native auth, account balance, history and nonce', async () => {
      pool = await restart(); await setup();
      assert.equal(await runtime.gameAuth.user(sessionRequest(n1PlayerCookie)), n1PlayerId, 'BO-derived session survives an ordinary database restart');
      assert.deepEqual(await runtime.gamePolicy.readSaved(), savedBeforeRestart);
      assert.equal((await call('/studio/api/admin/config')).status, 200);
      assert.equal((await runtime.store.db.prepare('SELECT balance,status FROM players WHERE id=?').get(player.id)).balance, 1025);
      assert.equal((await runtime.repository.listDocumentHistory('project')).length, 1);
      assert.equal((await pool.query("SELECT count(*)::int n FROM croupier_auth.meta WHERE k LIKE 'studio-command:%'")).rows[0].n, 2);
      const readout = await call('/studio/api/admin/shoes'); assert.equal(readout.status, 200);
      assert.equal((await readout.json()).cutReached, 2);
      assert.equal((await (await call('/studio/api/admin/voicelines')).json()).dealers[0].lines[0].reviewState, 'current-human-review');
    });
    await check('native HTTPS logout invalidates real JWT and epoch-bound player sessions after SQL restart', async () => {
      assert.equal((await call('/studio/api/admin/config', { cookie: cookies.revocable })).status, 200);
      await pool.query('UPDATE croupier_auth.users SET role=$1 WHERE username=$2', ['staff', names[2]]);
      assert.equal((await call('/studio/api/admin/config', { cookie: cookies.revocable })).status, 401);
      assert.equal((await call('/studio/api/auth/logout', { method: 'POST', body: {} })).status, 200);
      assert.equal((await call('/studio/api/admin/config')).status, 401);
      assert.equal(await runtime.gameAuth.user(sessionRequest(n1PlayerCookie)), null, 'a delayed cookie from before logout cannot restore authentication');
      await assert.rejects(runtime.gameAuth.fromBackoffice(sessionRequest(''), frozenN1), /Backoffice session expired/, 'a frozen handoff cannot adopt the new epoch');
      assert.ok(await runtime.store.db.prepare('SELECT id FROM players WHERE id=?').get(n1PlayerId), 'logout preserves the player account');
      assert.equal((await runtime.store.db.prepare('SELECT balance FROM players WHERE id=?').get(player.id)).balance, 1025, 'logout does not change the existing wallet');
    });
    await check('schema-checksum mismatch fails closed and never creates replacement disk/default state', async () => {
      const checksum = (await pool.query("SELECT checksum FROM croupier_studio.storage_migrations WHERE version='002'")).rows[0].checksum;
      await pool.query("UPDATE croupier_studio.storage_migrations SET checksum=$1 WHERE version='002'", ['0'.repeat(64)]);
      await assert.rejects(planStudioMigrations({ pool }));
      await pool.query("UPDATE croupier_studio.storage_migrations SET checksum=$1 WHERE version='002'", [checksum]);
      assert.deepEqual(await runtime.gamePolicy.readSaved(), savedBeforeRestart);
    });
    await check('active speech callers use actual SQL reservations, package identity and restart uncertainty without disk journals', async () => {
      const directory = await mkdtemp(join(tmpdir(), 'croupier-cutover-speech-'));
      const environmentId = `speech_${randomBytes(6).toString('hex')}`;
      let stamp = Date.parse('2026-10-03T23:59:00Z'), connected = false, paid = 0, packageCalls = 0;
      let journal = await createSpeechJournal({ pool, environmentId, now:() => stamp });
      const managers = [];
      const speechInput = { owner:'real-sql-fixture-owner', requestId:'real-sql-request', dealerId:'astrid', text:'Exact synthetic speech.', beforeCostly:async () => {} };
      const config = { directory, apiKey:'synthetic-no-live-provider', endpointId:'isolated-provider', origin:'https://render.croupier-qa.invalid',
        workerSecret:'isolated-worker-no-live-secret-at-least-32', reserveUsd:'0.20', dailyBudgetUsd:'1' };
      const response = value => new Response(JSON.stringify(value), { headers:{ 'content-type':'application/json' } });
      const manager = (uncertain = false) => {
        const value = createSpeechSessionManager(config, { journal, journalRequired:true, now:() => stamp,
          workerState:() => ({ workers:Number(connected), available:Number(connected), busy:0 }), stopWorker:() => { connected = false; }, sleep:async ms => { stamp += ms; },
          fetchImpl:async (url) => {
            if (url.endsWith('/run')) { paid++; if (uncertain) throw Error('fixture lost paid response'); return response({ id:'known-fixture-job', status:'IN_QUEUE' }); }
            if (url.includes('/status/')) { connected = true; return response({ id:'known-fixture-job', status:'IN_PROGRESS' }); }
            if (url.includes('/cancel/')) { connected = false; return response({ id:'known-fixture-job', status:'CANCELLED' }); }
            assert.fail('unexpected fixture provider endpoint');
          } }); managers.push(value); return value;
      };
      const hash = value => createHash('sha256').update(value).digest('hex');
      const artifactValues = new Map(); let blobReads = 0;
      const blobMetadata = (pathname, value) => ({ pathname, url:`https://fixture.private.blob.vercel-storage.com/${pathname}`,
        size:value.bytes.length, contentType:value.contentType });
      const artifacts = createSpeechBlobArtifacts({ env:{ CROUPIER_MEDIA_STORAGE:'blob', BLOB_READ_WRITE_TOKEN:'fixture-private-storage-token' }, blobClient:{
        put:async (pathname, bytes, options) => {
          assert.equal(options.access, 'private'); assert.equal(options.allowOverwrite, false); assert.equal(options.addRandomSuffix, false);
          assert.equal(artifactValues.has(pathname), false);
          const value = { bytes:Buffer.from(bytes), contentType:options.contentType }; artifactValues.set(pathname, value);
          return blobMetadata(pathname, value);
        },
        get:async (pathname, options) => {
          assert.equal(options.access, 'private'); assert.equal(options.useCache, false); blobReads++;
          const value = artifactValues.get(pathname); if (!value) return null;
          return { statusCode:200, stream:new Response(value.bytes).body, blob:blobMetadata(pathname, value) };
        },
        del:async pathname => { artifactValues.delete(pathname); },
      } });
      const files = () => createGeneratedSpeechService({ directory, reserveMicroUsd:200000, dailyBudgetMicroUsd:1000000 }, { repositoryRoot: speechRepositoryRoot, journal, journalRequired:true, artifacts, provider:{
        generate:async ({ text, beforeCostly }) => {
          await beforeCostly(); packageCalls++;
          const audio = Buffer.from(`fixture-audio:${text}`), video = Buffer.from(`fixture-video:${text}`);
          return { exactText:text, ...GENERATED_SPEECH_DEFAULTS, provider:{ kind:'cartesia-runpod' },
            audio:{ bytes:audio, sha256:hash(audio), durationMs:2000, contentType:'audio/wav' },
            video:{ bytes:video, sha256:hash(video), fps:24, frameCount:48, contentType:'video/mp4' } };
        } } });
      try {
        const absent = manager();
        await assert.rejects(absent.ensure(speechInput), { code:'generated_speech_budget_policy_missing' });
        assert.equal(paid, 0); await absent.close();
        await journal.initializeBudgetPolicy({ dailyBudgetMicroUsd:1000000, confirmation:'verified-new-empty-cost-journal' });
        await journal.initializeFullfileBudgetPolicy({ reserveMicroUsd:200000, currentBudgetMicroUsd:1000000, confirmation:'verified-new-empty-cost-journal' });
        const active = manager(); await Promise.all([active.ensure(speechInput), active.ensure(speechInput)]); assert.equal(paid, 1);
        const charges = (await pool.query('SELECT day::text,reserved_micro_usd::text FROM croupier_studio.gpu_reservations WHERE environment_id=$1 ORDER BY day', [environmentId])).rows;
        assert.deepEqual(charges, [{ day:'2026-10-03', reserved_micro_usd:'200000' }, { day:'2026-10-04', reserved_micro_usd:'200000' }]);
        await active.close();
        assert.equal((await pool.query("SELECT count(*)::int n FROM croupier_studio.gpu_sessions WHERE environment_id=$1 AND released_at_ms IS NOT NULL", [environmentId])).rows[0].n, 1,
          'known terminal job is drained and released in the actual SQL journal');
        const cached = await files().generate(speechInput); assert.equal(packageCalls, 1);
        assert.equal(artifactValues.size, 2); assert.equal(blobReads, 2, 'private save readback verifies exact bytes before SQL completion');
        assert.equal(hash((await files().media({ id:cached.packageId.slice('generated-'.length), kind:'audio', owner:speechInput.owner })).bytes), cached.audio.sha256);
        await assert.rejects(files().media({ id:cached.packageId.slice('generated-'.length), kind:'audio', owner:'foreign' }), { code:'generated_speech_not_found' });
        assert.equal(blobReads, 3, 'foreign owner is denied by SQL before private Blob access');
        assert.deepEqual(await files().generate(speechInput), cached); assert.equal(packageCalls, 1);
        await assert.rejects(files().generate({ ...speechInput, text:'Changed text.' }), { code:'generated_speech_request_conflict' });
        const uncertain = manager(true); await assert.rejects(uncertain.ensure(speechInput)); assert.equal(paid, 2);
        await assert.rejects(uncertain.close(), { code:'generated_speech_session_shutdown_incomplete' },
          'a lost paid response cannot be reported as fully shut down or release its reservation');
        assert.equal((await pool.query("SELECT count(*)::int n FROM croupier_studio.gpu_sessions WHERE environment_id=$1 AND state='submission_uncertain'", [environmentId])).rows[0].n, 1);
        pool = await restart(); await setup(); stamp += SPEECH_SESSION_POLICY.reservationWindowMs + 1;
        journal = await createSpeechJournal({ pool, environmentId, now:() => stamp });
        await assert.rejects(manager().ensure(speechInput), { code:'generated_speech_session_submission_uncertain' }); assert.equal(paid, 2);
        assert.deepEqual(await files().generate(speechInput), cached); assert.equal(packageCalls, 1);
        assert.equal(hash((await files().media({ id:cached.packageId.slice('generated-'.length), kind:'video', owner:speechInput.owner })).bytes), cached.video.sha256);
        assert.equal(blobReads, 4, 'new operation reads private Blob after actual SQL restart');
        assert.equal((await pool.query('SELECT sum(reserved_micro_usd)::text used FROM croupier_studio.gpu_reservations WHERE environment_id=$1', [environmentId])).rows[0].used, '800000');
        assert.equal((await readdir(directory)).filter(name => name.endsWith('.json')).length, 0);
      } finally { await Promise.allSettled(managers.map(value => value.close())); await rm(directory, { recursive:true, force:true }); }
    });
    return { checks, pool };
  } finally { await new Promise(yes => server.close(yes)); server.closeAllConnections(); }
}

test('latest SQL/HTTPS fixture rejects a foreign database before any mutation or listener', async () => {
  const calls = [];
  const pool = { query: async sql => { calls.push(sql); return { rows: [{ address: '10.0.0.1', role: 'production', database: 'product', listeners: '*' }] }; } };
  await assert.rejects(runStudioCutoverChecks({ pool, restart: async () => pool }), assert.AssertionError);
  assert.equal(calls.length, 1); assert.match(calls[0], /^SELECT /);
});
