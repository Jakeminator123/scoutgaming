// Partnerportalen mot riktig PostgreSQL-SQL (PGlite, en session): motorns
// croupier_auth (konton och partnersessioner), Studio-schemat (operatörer,
// roller, medlemskap, paket och administrationsdokumentet) och spelinställningarnas
// 009-tabeller. Bolagen north och south har var sitt publicerat paket med en
// fryst presentation (två dealers, dragan och paow) och egna spelbord. Konton:
// north-admin (partner-admin), north-editor (partner-editor), north-viewer
// (partner-viewer) i north, och south-admin (partner-admin) i south.
// Syntetiska data; ingen produktionsdatabas.
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { createPglitePool } from '../../../../test/fixtures/pglite-pool.mjs';
import { createPostgresStore } from '../../../../services/game/storage/postgres-store.mjs';
import { planStudioMigrations, applyStudioMigrations } from '../../../../ops/neon-studio/migrations.mjs';
import { createStudioRepository } from '../../../../packages/studio-registry/server/document-repository.mjs';
import { createOperatorStore } from '../../../../packages/operators/server/operator-store.mjs';
import { runtimeCatalogJson, runtimeCatalogRevision } from '../../../../packages/studio-registry/server/runtime-catalog.mjs';
import { PRESENTATION_CAPABILITY_VERSION_HEADER, presentationCapabilitiesForVersion } from '../../../../packages/presentation/capability-contract.mjs';
import { readRuntimeCatalogFixture } from '../../../../test/fixtures/runtime-media-catalog.mjs';
import { nativeRoomMaterialChoicesFixture } from '../../../../test/fixtures/native-room-game-material.mjs';
import { wrapNativePresentationRepository } from '../../lib/presentation-runtime-readiness.mjs';
import { createOperatorPackageApi } from '../../lib/operator-package-api.mjs';
import { createNativePresentationMutationTransaction } from '../../lib/studio-native-runtime.mjs';
import { STANDARD_OPERATOR_ROLES } from '../../lib/operator-admin-api.mjs';
import { handlePartnerAuth, partnerSessionDigest } from '../../lib/partner-session.mjs';

export const PARTNER_ORIGIN = 'https://partner.fixture.invalid';
const host = 'partner.fixture.invalid';
const ACCOUNTS = Object.freeze([
  { id: 42, username: 'north-admin', operatorId: 'north', roleId: 'partner-admin' },
  { id: 43, username: 'north-editor', operatorId: 'north', roleId: 'partner-editor' },
  { id: 44, username: 'north-viewer', operatorId: 'north', roleId: 'partner-viewer' },
  { id: 45, username: 'south-admin', operatorId: 'south', roleId: 'partner-admin' },
]);

let fixtures = 0;
export async function partnerPostgresFixture(t, { deferOptional = [] } = {}) {
  const n = ++fixtures, scope = { environment: `partner-actions-${n}`, workspaceId: 'isolated' }, now = () => 1_800_000_000_000;
  const pool = await createPglitePool(); t.after(() => pool.end());
  const plan = await planStudioMigrations({ pool });
  await applyStudioMigrations({ pool, expectedTarget: plan.target, confirm: true, deferOptional });
  // Konton och sessioner i en egen PGlite: PGlite har en enda session, och
  // partnerns skrivvägar läser sessionen igen medan Studio-transaktionen är öppen
  // (i produktionen två anslutningar ur samma pool).
  const accounts = await createPglitePool(); t.after(() => accounts.end());
  const engine = createPostgresStore({ pool: accounts });
  const source = nativeRoomMaterialChoicesFixture();
  // Scenmallen ger bolaget dealervalet (operatorAdjustable), som Admin gör i Scenmallar.
  const lane = source.project.lanes[0];
  lane.operatorAdjustable = [...new Set([...lane.operatorAdjustable, 'dealer'])];
  lane.dealers = ['dragan', 'paow']; lane.layers.dealer.allowed = [...lane.dealers];
  const raw = createStudioRepository({ pool, scope });
  const repository = wrapNativePresentationRepository(raw, { env: { CROUPIER_BACKEND_ORIGIN: 'https://runtime.example.invalid' },
    fetchImpl: async (_url, init) => Response.json(presentationCapabilitiesForVersion(Number(init.headers[PRESENTATION_CAPABILITY_VERSION_HEADER] ?? 3))) });
  const catalog = readRuntimeCatalogFixture();
  await pool.query('INSERT INTO croupier_studio.runtime_media_catalogs(environment_id,workspace_id,revision,value) VALUES($1,$2,$3,$4::jsonb)',
    [scope.environment, scope.workspaceId, runtimeCatalogRevision(catalog), runtimeCatalogJson(catalog)]);
  const id = name => `p${n}-${name}`;
  const rooms = [['north-a', 'north'], ['north-b', 'north'], ['south', 'south']].map(([name, operatorId]) => ({ schemaVersion: 2, id: id(name), name: id(name), operatorId,
    presentationLaneId: lane.id, gameLaneId: 'fixture-lane', state: 'live' }));
  await raw.initializeDocument('project', { value: source.project, revision: source.project.revision, actor: 'fixture' });
  await raw.initializeDocument('administration', { value: { rooms, gameLane: 'fixture-lane', gameLanes: [{ schemaVersion: 1, id: 'fixture-lane', label: 'Fixture',
    renderer: 'portrait-video', dealer: 'dragan', mediaCollection: 'dragan-presentation' }] }, revision: 'admin-initial', actor: 'fixture' });
  for (const { revision, updatedAt, mediaTiming, ...record } of structuredClone(source.records)) {
    const { media } = await raw.registerMedia(record, { actor: 'fixture' });
    await raw.saveMediaTiming(record.id, { sha256: record.sha256, expectedRevision: media.revision, mediaTiming, actor: 'fixture' });
  }
  const direct = await createOperatorStore({ sql: pool, scope });
  for (const operatorId of ['north', 'south']) {
    await direct.createOperator({ actor: 'fixture', operatorId, slug: operatorId, name: operatorId });
    for (const role of STANDARD_OPERATOR_ROLES) await direct.upsertRole({ actor: 'fixture', operatorId, roleId: role.id, label: role.label,
      permissions: [...role.permissions], delegable: role.delegable });
  }
  const videoRegistry = { loadCaptured: async snapshot => ({ videos: snapshot.mediaRows.map(row => ({ ...row, dealer: row.classification.dealerId, bytes: row.size,
    available: true, integrity: 'verified' })), families: [], summary: { readable: true, snapshotReadable: true } }), verifyCapturedMedia: async () => {} };
  const packages = createOperatorPackageApi({ pool, scope, repository, videoRegistry });
  const POST = 'POST /studio/api/admin/operator-package', admin = { user: 'fixture-admin', role: 'admin' };
  for (const operatorId of ['north', 'south']) {
    const context = { body: { operatorId, lanes: [lane.id] }, actor: admin, scope };
    await packages.handlers.get(POST)({ ...context, prepared: await packages.preparations.get(POST)(context) });
    const pack = await direct.getCurrentPackage(operatorId);
    await direct.publishPackage({ actor: 'fixture', operatorId, expectedRevision: pack.revision, lanes: pack.lanes, games: pack.games,
      tables: rooms.filter(room => room.operatorId === operatorId).map(room => room.id), branding: pack.branding });
  }
  // Konton, medlemskap och en giltig partnersession per konto (samma rader som login skriver).
  const tokens = {};
  for (const account of ACCOUNTS) {
    const salt = randomBytes(16).toString('hex'), hash = scryptSync('fixture-password', salt, 64).toString('hex');
    await engine.boDb.prepare('INSERT INTO users (id,username,email,role,salt,hash,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(account.id, account.username, `${account.username}@fixture.invalid`, 'partner', salt, hash, 'fixture');
    await direct.upsertMembership({ actor: 'fixture', operatorId: account.operatorId, userId: String(account.id), roleId: account.roleId, status: 'active' });
    const token = randomBytes(32).toString('hex');
    await engine.boDb.prepare('INSERT INTO lab_sessions (token_digest,craig_user_id,role,source_stamp,auth_epoch,expires) VALUES (?,?,?,?,?,?)')
      .run(partnerSessionDigest(token), String(account.id), 'partner', createHash('sha256').update(`${salt}:${hash}`).digest('hex'), 0, now() + 3_600_000);
    tokens[account.username] = token;
  }
  // Den nativa grinden som Admins skrivningar går genom. PGlite har en enda
  // session, så produktlåset (boDb.transaction) är här en genomströmning, som i room-release.test.mjs.
  const presentationTransaction = createNativePresentationMutationTransaction({ repository, boDb: { transaction: work => work() }, pool, scope });
  const config = { boDb: engine.boDb, gameDb: engine.db, scope, now, pool, repository, presentationTransaction,
    allowedOrigins: [PARTNER_ORIGIN], unifiedUi: true, publicHosts: [host], apiBase: '/studio/api/admin', authBase: '/studio/api/auth',
    rateLimit: async () => true, clientAddress: async () => 'fixture-partner' };
  const call = (action, { user = 'north-admin', operator = 'north', body, method = body === undefined ? 'GET' : 'POST', headers = {} } = {}) =>
    handlePartnerAuth(new Request(`${PARTNER_ORIGIN}/studio/api/partner/${action}?operator=${operator}`, {
      method, headers: { host, cookie: `partner_session=${tokens[user]}`,
        ...(method === 'POST' ? { origin: PARTNER_ORIGIN, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' } : {}), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }), config);
  const rows = async (sql, values = []) => (await pool.query(sql, values)).rows;
  return { pool, scope, raw, repository, direct, engine, config, source, lane, rooms, id, tokens, call, rows, admin };
}
