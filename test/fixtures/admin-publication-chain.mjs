import {createHash, createHmac} from 'node:crypto';
import {createStudioMemoryPool} from './studio-memory-pool.mjs';
import {readRuntimeCatalogFixture} from './runtime-media-catalog.mjs';
import {operatorMemoryPool, usersDb} from '../../lab/test/fixtures/operator-memory-pool.mjs';
import {cloudPresentationFixture} from '../../lab/test/fixtures/cloud-presentation.mjs';
import {defaultPresentationLane} from '../../lab/lib/studio-model.mjs';
import {defaultCompositionSettings} from '../../web/public/composition-settings.mjs';
import {createStudioRepository} from '../../web/storage/studio-repository.mjs';
import {createOperatorStore} from '../../web/storage/operator-store.mjs';
import {createOperatorPackageReader} from '../../web/storage/operator-package-reader.mjs';
import {createStudioNativeAuth} from '../../packages/studio-access/studio-native-auth.mjs';
import {createStudioAdminApi} from '../../lab/lib/studio-admin-api.mjs';
import {createPresentationRoomApi} from '../../lab/lib/presentation-room-api.mjs';
import {STANDARD_OPERATOR_ROLES} from '../../lab/lib/operator-admin-api.mjs';
import {handlePartnerAuth, partnerSessionDigest} from '../../lab/lib/partner-session.mjs';
import {partnerWorkspaceInitialData} from '../../lab/lib/partner-data.mjs';
import {resolveWorkspaceSurfacePath} from '../../lab/lib/workspace-surfaces.mjs';
import {partnerRoomRequest} from '../../lab/lib/partner-room-selection.mjs';
import {createPublicOperatorRooms} from '../../web/public-operator-rooms.mjs';
import {createPublicOperatorDirectory} from '../../web/public-operators.mjs';
import {createGameEntrySelector} from '../../web/game-entry-operator.mjs';
import {decorateGameEntryHtml} from '../../web/public/game-entry-contract.mjs';
import {presentationCapabilitiesForVersion} from '../../packages/presentation/capability-contract.mjs';

export const fixtureOrigin = 'https://publication-chain.example.invalid';
export const company = {id: 'chain-north', slug: 'chain-north', name: 'C6 North'};
export const otherCompany = {id: 'chain-south', slug: 'chain-south', name: 'C6 South'};
export const compositionId = 'chain-presentation';
const scope = {environment: 'test', workspaceId: 'publication-chain'};
const now = () => 1_700_000_000_000;
const clone = value => structuredClone(value);

// Reuse both existing tagged SQL fixtures on one repository connection. This
// binds the document/package chain; it is not a PostgreSQL isolation test.
function publicationPool(studio, operators) {
  return {async connect() {
    const document = await studio.connect(), operator = await operators.connect();
    return {async query(sql, values = []) {
      if (sql.startsWith('BEGIN')) {
        await operator.query('BEGIN'); return document.query(sql, values);
      }
      if (sql === 'COMMIT' || sql === 'ROLLBACK' || sql.startsWith('SET LOCAL')) {
        const result = await document.query(sql, values);
        await operator.query(sql, values); return result;
      }
      if (sql.includes('/* operator-store:')) return operator.query(sql, values);
      if (sql.includes('/* presentation-room:used-key */')) return {rows: clone(operators.tables.operator_packages
        .filter(row => row.environment_id === values[0] && row.workspace_id === values[1]
          && row.operator_id === values[2] && JSON.parse(row.tables).includes(values[3])).slice(0, 1))};
      return document.query(sql, values);
    }, release() {document.release(); operator.release();}};
  }};
}

// Real cookie validators and membership/role policy, with synthetic accounts,
// signer and session rows. No saved login, password or real database is read.
function identities() {
  const users = [
    {id: '7', username: 'c6-admin', role: 'admin'},
    {id: '42', username: 'c6-north-member', role: 'partner'},
    {id: '43', username: 'c6-south-member', role: 'partner'},
  ].map(user => ({...user, email: user.username + '@example.invalid', salt: 'cd'.repeat(16), hash: 'ef'.repeat(64), epoch: 0}));
  const signer = 'ab'.repeat(32), sessions = [], accounts = usersDb(users);
  const stamp = user => createHash('sha256').update(`${user.salt}:${user.hash}`).digest('hex');
  const boDb = {async transaction(work) {return work();}, prepare(sql) {
    if (sql.startsWith('SELECT id,username')) return accounts.prepare(sql);
    return {async all(...args) {
      if (sql.includes('FROM meta')) return [{v: signer}];
      if (sql.includes('FROM lab_sessions')) return clone(sessions.filter(row => row.token_digest === args[0] && row.expires > args[1]));
      if (sql.includes('u.id=?')) return clone(users.filter(row => row.id === String(args[0])));
      if (/lower\(u.username\)/i.test(sql)) return clone(users.filter(row => row.username.toLowerCase() === args[0]
        || sql.includes('u.email') && row.email.toLowerCase() === args[0]));
      throw Error('Unexpected C6 account query');
    }, async get(...args) {return (await this.all(...args))[0];}};
  }};
  const header = Buffer.from(JSON.stringify({alg: 'HS256', typ: 'JWT'})).toString('base64url');
  const body = Buffer.from(JSON.stringify({sub: users[0].username, role: 'admin', aud: 'backoffice',
    exp: now() / 1000 + 3600, source_stamp: stamp(users[0]), auth_epoch: 0})).toString('base64url');
  const signature = createHmac('sha256', Buffer.from(signer, 'hex')).update(`${header}.${body}`).digest('base64url');
  const partner = (user, token) => {
    sessions.push({token_digest: partnerSessionDigest(token), craig_user_id: user.id, role: 'partner',
      source_stamp: stamp(user), auth_epoch: 0, expires: now() + 3_600_000});
    return `partner_session=${token}`;
  };
  return {boDb, users, admin: `bo_jwt=${header}.${body}.${signature}`,
    north: partner(users[1], 'bc'.repeat(32)), south: partner(users[2], 'de'.repeat(32))};
}

async function publicResponse(handler, request) {
  let status, headers, body;
  const url = new URL(request.url);
  await handler({url: url.pathname + url.search, method: request.method, headers: Object.fromEntries(request.headers)},
    {writeHead(code, value) {status = code; headers = value;}, end(value) {body = value;}}, url.pathname);
  if (!status) throw Error('Public handler did not handle its fixture route');
  return new Response(body, {status, headers});
}

export async function createPublicationChain(origin = fixtureOrigin, {roomAppearance = false} = {}) {
  const studio = createStudioMemoryPool(), operators = operatorMemoryPool();
  studio.seedRuntimeCatalog(scope,readRuntimeCatalogFixture());
  const repository = createStudioRepository({pool: publicationPool(studio, operators), scope});
  const store = await createOperatorStore({sql: operators, scope, now});
  for (const item of [company, otherCompany]) {
    await store.createOperator({actor: 'fixture-seed', operatorId: item.id, slug: item.slug, name: item.name});
    for (const role of STANDARD_OPERATOR_ROLES) await store.upsertRole({actor: 'fixture-seed', operatorId: item.id,
      roleId: role.id, label: role.label, permissions: [...role.permissions], delegable: role.delegable});
  }
  for (const [operatorId, userId] of [[company.id, '42'], [otherCompany.id, '43']])
    await store.upsertMembership({actor: 'fixture-seed', operatorId, userId, roleId: 'partner-admin', status: 'active'});
  const lane = {...defaultPresentationLane('astrid'), id: compositionId, label: 'C6 sparad sammansättning'};
  // Keep the existing full-frame fixture, and opt into the real independent
  // layer contract where N2 is allowed to choose a room's table colour.
  if (roomAppearance) {
    lane.composition = defaultCompositionSettings();
    lane.layers.table.colors = ['#112233', '#445566'];
  }
  const cloud = cloudPresentationFixture({lanes: [lane]});
  const saved = await repository.initializeDocument('project', {value: cloud.project, actor: 'fixture-seed'});
  await repository.initializeDocument('administration', {actor: 'fixture-seed', value: {
    gameLane: 'mobile-phone', gameLanes: [{schemaVersion: 1, id: 'mobile-phone', label: 'Fixture portrait',
      renderer: 'portrait-video', dealer: 'astrid', mediaCollection: 'astrid-presentation'}],
    rooms: [], tiers: {classic: 'vera', high: 'astrid', vip: 'amira'}, tournaments: [],
    pitboss: {payout10x: true, streak5: true, randomWalkMin: 45},
  }});
  for (const {revision, ...record} of cloud.mediaRows) await repository.registerMedia(record, {actor: 'fixture-seed'});
  const auth = identities();
  const config = {boDb: auth.boDb, scope, now, store,
    // Keep the native adapter's exact two-origin contract. The page loader
    // normalizes loopback document URLs to HTTPS without opening a TLS listener.
    allowedOrigins: [origin, origin.startsWith('http:') ? origin.replace(/^http:/, 'https:') : 'https://studio-publication-chain.example.invalid'],
    publicHosts: [new URL(origin).host, 'studio-publication-chain.example.invalid'], apiBase: '/studio/api/admin', authBase: '/studio/api/auth',
    readAdministration: async () => (await repository.readDocument('administration')).value,
    readProject: async () => ({project: (await repository.readDocument('project')).value}),
    gameDb: {prepare: () => ({all: async () => [], get: async () => undefined})}};
  const rooms = createPresentationRoomApi({repository, scope, now,
    runtimeCapabilities: async () => presentationCapabilitiesForVersion(4),
    videoRegistry: {async loadCaptured(snapshot) {return {videos: snapshot.mediaRows.map(row => ({id: row.id,
      dealer: row.classification.dealerId, sha256: row.sha256, bytes: row.size, classification: row.classification,
      available: true, integrity: 'verified'}))};}, async verifyCapturedMedia() {}},
  });
  const api = createStudioAdminApi({authorize: createStudioNativeAuth(config),
    allowedOrigins: config.allowedOrigins, publicHosts: config.publicHosts, handlers: rooms.handlers,
    preparations: rooms.preparations, mutationTransaction: work => repository.transaction(work)});
  const policy = {async readSaved() {return {project: (await repository.readDocument('project')).value,
    administration: (await repository.readDocument('administration')).value};}, readGameConfiguration() {}};
  const select = createGameEntrySelector({policy,
    packages: createOperatorPackageReader({sql: operators, scope, ttlMs: 0, now, log: () => {}}), log: () => {}});
  const publicRooms = createPublicOperatorRooms({store, policy});
  const directory = createPublicOperatorDirectory({store, readRooms: publicRooms.read, ttlMs: 0, now});
  const publications = [], brandingCommands = [];
  async function handle(request) {
    const url = new URL(request.url);
    if (url.origin !== origin) throw Error('C6 request outside fixture origin');
    if (url.pathname === '/studio/api/admin/presentation-room') {
      const body = request.method === 'POST' ? await request.clone().json() : null;
      const response = await api.handle(request);
      if (body) publications.push({body, status: response.status, origin: request.headers.get('origin'),
        site: request.headers.get('sec-fetch-site'), result: await response.clone().json()});
      return response;
    }
    if (['/studio/api/partner/snapshot', '/studio/api/partner/branding'].includes(url.pathname)) {
      const body = request.method === 'POST' ? await request.clone().json() : null;
      const response = await handlePartnerAuth(request, config);
      if (body) brandingCommands.push({body, status: response.status, origin: request.headers.get('origin'),
        site: request.headers.get('sec-fetch-site')});
      return response;
    }
    if (url.pathname === '/api/operators') return publicResponse(directory.handle, request);
    if (/^\/api\/operators\/[^/]+\/rooms$/.test(url.pathname)) return publicResponse(publicRooms.handle, request);
    if (url.pathname === '/play/blackjack') {
      const entry = await select(url.searchParams);
      return new Response(entry.status === 200 ? decorateGameEntryHtml('<html lang="sv"><body>Isolerad spelstart</body></html>',
        {CROUPIER_STUDIO_NEON_POLICY: '1'}, entry.selection) : 'Not found',
      {status: entry.status, headers: {'content-type': 'text/html; charset=utf-8'}});
    }
    return new Response(null, {status: 404});
  }
  // The fixture supplies only routing/HTML. Production page loading still checks
  // the real cookie, current membership, role, operator and frozen package.
  async function partnerPageProps(request) {
    const url = new URL(request.url), route = resolveWorkspaceSurfacePath(url.pathname);
    if (request.method !== 'GET' || url.origin !== origin || route?.surface !== 'partner' || !route.operatorSlug)
      throw Object.assign(new Error('Fixture partner route not found'), {statusCode: 404});
    // WorkspaceSurfacePage constructs the canonical document request without
    // query selectors; those stay separate props and never become auth input.
    const pageRequest = new Request(new URL(route.studioPath, origin), {headers: request.headers});
    const data = await partnerWorkspaceInitialData(pageRequest, {operatorSlug: route.operatorSlug, store, config});
    const selection = partnerRoomRequest(url.searchParams);
    return {surface: 'partner', initialSnapshot: data.snapshot, user: data.session.user,
      apiBase: data.apiBase, initialView: route.view,
      initialRoomId: selection.roomId, initialRoomScope: selection.scope};
  }
  function request(path, {cookie = auth.admin, body} = {}) {
    return handle(new Request(origin + path, {method: body ? 'POST' : 'GET', headers: {cookie,
      ...(body ? {origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json'} : {})},
    ...(body ? {body: JSON.stringify(body)} : {})}));
  }
  return {origin, repository, store, studio, operators, auth, config, handle, request, select, publicRooms, publications, brandingCommands, partnerPageProps,
    props: {operator: company, presentation: {id: compositionId, label: lane.label},
      projectRevision: saved.revision, projectSaved: true, storeAvailable: true}};
}
