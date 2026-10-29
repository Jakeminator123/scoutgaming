import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { handlePartnerAuth, partnerSessionDigest } from '../lib/partner-session.mjs';
import { partnerWorkspaceInitialData } from '../lib/partner-data.mjs';
import { createOperatorJournal } from '../lib/operator-journal.mjs';
import { STANDARD_OPERATOR_ROLES } from '../lib/operator-admin-api.mjs';
import { PARTNER_PERMISSIONS, PARTNER_VIEW_PERMISSIONS } from '../../../packages/studio-access/server/partner-access-policy.mjs';
import { partnerNavigationItems } from '../../../packages/navigation/partner-navigation.mjs';
import { PARTNER_VIEWS, workspaceSurfacePath } from '../../../packages/navigation/workspace-surfaces.mjs';
import { createOperatorStore } from '../../../packages/operators/server/operator-store.mjs';
import { defaultPresentationLane } from '../../../packages/presentation/contracts/studio-model.mjs';
import { defaultCompositionSettings } from '../../../packages/presentation/contracts/composition-settings.mjs';
import { withPackagePresentation } from '../../../packages/presentation/server/presentation-package.mjs';
import { cloudPresentationFixture } from './fixtures/cloud-presentation.mjs';
import { operatorMemoryPool, usersDb } from './fixtures/operator-memory-pool.mjs';
import { partnerNavigation } from '../components/partner/partner-copy.mjs';

// Partnerportalens behörighetsmatris (docs/plans/PARTNERPORTAL-KONVERTERING.md, 4.3 punkt 6).
// Varje förväntat svar räknas fram ur kartan nedan och rollens behörigheter; kartan själv är
// handskriven efter vyernas behörigheter och vitlistan i lib/partner-session.mjs. Rollerna är de tre standardrollerna, en roll med enbart varje behörighet och en
// roll med alla utom varje behörighet. Den sista gör att en enda borttagen kontroll i servern
// syns: rollen som saknar just den behörigheten får då 200 där kartan säger 403.

// Portalens golv: utan overview.read öppnas ingen sida och ingen snapshot (partner-data.mjs).
const FLOOR = 'overview.read';
// Målrollerna för teamändringar saknar egna behörigheter, så att de inte i sig begränsar vem
// som får ändra dem (en roll får bara ge eller ändra behörigheter den själv har).
const TARGET_PERMISSIONS = [];
const TEAM_WRITE = ['team.read', 'team.roles.assign'];
const BRANDING_WRITE = ['presentations.read', 'presentations.configure'];

// Behörighetskartan för vyerna: golvet och vyns egen behörighet ur PARTNER_VIEW_PERMISSIONS.
const viewRequires = view => [...new Set([FLOOR, PARTNER_VIEW_PERMISSIONS[view]])];

// Behörighetskartan för partner-API:t (vitlistan i lib/partner-session.mjs).
const BRANDING_ACTIONS = ['save-draft', 'discard-draft', 'review', 'publish', 'restore'];
const API_READS = [
  { id: 'snapshot', path: 'snapshot', requires: [FLOOR] },
  { id: 'branding GET', path: 'branding', requires: ['presentations.read'] },
  { id: 'team GET', path: 'team', requires: ['team.read'] },
  { id: 'journal', path: 'journal', requires: TEAM_WRITE },
  { id: 'journal kind=publications', path: 'journal', query: '&kind=publications', requires: ['reports.read'] },
];
const API_WRITES = [
  ...BRANDING_ACTIONS.map(action => ({ id: `branding POST ${action}`, path: 'branding', action, requires: BRANDING_WRITE })),
  { id: 'team POST role', path: 'team', action: 'role', requires: [...TEAM_WRITE, ...TARGET_PERMISSIONS] },
  { id: 'team POST suspend', path: 'team', action: 'suspend', requires: [...TEAM_WRITE, 'team.suspend', ...TARGET_PERMISSIONS] },
  { id: 'team POST reactivate', path: 'team', action: 'reactivate', requires: [...TEAM_WRITE, 'team.suspend', ...TARGET_PERMISSIONS] },
  { id: 'team POST invite', path: 'team', action: 'invite', requires: [...TEAM_WRITE, 'team.invite', ...TARGET_PERMISSIONS] },
];

const ROLES = [
  ...STANDARD_OPERATOR_ROLES.map(role => ({ id: role.id, permissions: [...role.permissions], delegable: role.delegable })),
  ...PARTNER_PERMISSIONS.map(permission => ({ id: `bara-${permission}`, permissions: [permission], delegable: false })),
  ...PARTNER_PERMISSIONS.map(permission => ({ id: `utan-${permission}`, permissions: PARTNER_PERMISSIONS.filter(item => item !== permission), delegable: false })),
];
const allows = (role, requires) => requires.every(permission => role.permissions.includes(permission));
const expected = (role, requires) => allows(role, requires) ? 200 : 403;

const origin = 'https://public.example.invalid', host = 'public.example.invalid';
const scope = { environment: 'fixture', workspaceId: 'croupier' };
const now = 1_700_000_000_000;
const A = { id: 'alfa-bolag', slug: 'alfabolaget', name: 'Alfabolaget' };
const B = { id: 'beta-bolag', slug: 'betabolaget', name: 'Betabolaget' };
// Inget svar för bolag A får bära något av bolag B: id, adress, namn, spelbord, paketnamn eller konto.
// Bara B:s konkreta värden, så att vanliga ord som "betala" inte ger falska fel.
const B_MARKERS = /beta-bolag|betabolaget|beta-bord|Betas|beta-admin|beta@/i;
const LANE = 'alfa-lane';

const salt = 'cd'.repeat(16), hash = 'ef'.repeat(64);
const stamp = createHash('sha256').update(`${salt}:${hash}`).digest('hex');
const tokenOf = id => createHash('sha256').update(`matris:${id}`).digest('hex');
const request = (cookie, path, { body, headers = {} } = {}) => new Request(`${origin}${path}`, { method: body ? 'POST' : 'GET', headers: {
  host, cookie, ...(body ? { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' } : {}), ...headers,
}, ...(body ? { body: JSON.stringify(body) } : {}) });

async function fixture() {
  const users = [
    ...ROLES.map((role, index) => ({ id: String(100 + index), username: `alfa-${role.id}`, role: 'partner', email: `alfa-${index}@partner.invalid`, roleId: role.id })),
    { id: '50', username: 'alfa-mal', role: 'partner', email: 'mal@partner.invalid' },
    { id: '51', username: 'alfa-vilande', role: 'partner', email: 'vilande@partner.invalid' },
    { id: '60', username: 'alfa-ny', role: 'partner', email: 'ny@partner.invalid' },
    { id: '46', username: 'beta-admin', role: 'partner', email: 'beta@partner.invalid' },
  ].map(user => ({ ...user, salt, hash, epoch: 0 }));
  const accounts = usersDb(users), sessions = [];
  const boDb = {
    async transaction(work) { return work(); },
    prepare(sql) {
      if (sql.startsWith('SELECT id,username') || sql.startsWith('INSERT INTO users') || sql.startsWith('DELETE FROM tokens') || sql.startsWith('INSERT INTO tokens')) return accounts.prepare(sql);
      const rows = args => {
        if (sql.includes('FROM lab_sessions')) return sessions.filter(row => row.token_digest === args[0] && row.expires > args[1]);
        if (sql.includes('u.id=?')) return users.filter(user => user.id === String(args[0]));
        throw new Error(`Unexpected fixture query: ${sql}`);
      };
      return { async all(...args) { return rows(args).map(row => ({ ...row })); }, async get(...args) { return (await this.all(...args))[0]; } };
    },
  };
  const cookies = new Map();
  for (const user of users) {
    const token = tokenOf(user.id);
    sessions.push({ token_digest: partnerSessionDigest(token), craig_user_id: user.id, role: 'partner', source_stamp: stamp, auth_epoch: 0, expires: now + 3600_000 });
    cookies.set(user.roleId ?? user.username, `partner_session=${token}`);
  }
  const pool = operatorMemoryPool();
  const store = await createOperatorStore({ sql: pool, scope, now: () => now });
  const lane = { ...defaultPresentationLane('astrid'), id: LANE, composition: defaultCompositionSettings(), operatorAdjustable: ['dealer', 'branding'] };
  const presentation = cloudPresentationFixture({ lanes: [lane] }).presentation;
  await store.createOperator({ actor: 'fixture', operatorId: A.id, slug: A.slug, name: A.name });
  for (const role of [...ROLES, { id: 'mal', permissions: TARGET_PERMISSIONS, delegable: true }, { id: 'mal-nasta', permissions: TARGET_PERMISSIONS, delegable: true }]) {
    await store.upsertRole({ actor: 'fixture', operatorId: A.id, roleId: role.id, label: role.id, permissions: [...role.permissions], delegable: role.delegable });
  }
  for (const user of users.filter(item => item.roleId)) await store.upsertMembership({ actor: 'fixture', operatorId: A.id, userId: user.id, roleId: user.roleId, status: 'active' });
  await store.upsertMembership({ actor: 'fixture', operatorId: A.id, userId: '50', roleId: 'mal', status: 'active' });
  await store.upsertMembership({ actor: 'fixture', operatorId: A.id, userId: '51', roleId: 'mal', status: 'suspended' });
  await store.publishPackage({ actor: 'fixture', operatorId: A.id, lanes: [LANE], games: ['blackjack'], tables: ['alfa-bord'],
    branding: withPackagePresentation({ lane: LANE }, presentation) });
  await store.createOperator({ actor: 'fixture', operatorId: B.id, slug: B.slug, name: B.name });
  for (const role of STANDARD_OPERATOR_ROLES) await store.upsertRole({ actor: 'fixture', operatorId: B.id, roleId: role.id, label: role.label, permissions: [...role.permissions], delegable: role.delegable });
  await store.upsertMembership({ actor: 'fixture', operatorId: B.id, userId: '46', roleId: 'partner-admin', status: 'active' });
  await store.publishPackage({ actor: 'fixture', operatorId: B.id, lanes: [LANE], games: ['blackjack'], tables: ['beta-bord'],
    branding: withPackagePresentation({ lane: LANE, name: 'Betas bordsnamn' }, presentation) });
  const readAdministration = async () => ({ gameLane: 'actual-portrait',
    gameLanes: [{ schemaVersion: 1, id: 'actual-portrait', label: 'Runtime', renderer: 'portrait-video', dealer: 'astrid', mediaCollection: 'astrid-presentation' }],
    rooms: [
      { schemaVersion: 2, id: 'alfa-bord', name: 'Alfas blackjack', operatorId: A.id, presentationLaneId: LANE, gameLaneId: 'actual-portrait', state: 'live' },
      { schemaVersion: 2, id: 'beta-bord', name: 'Betas blackjack', operatorId: B.id, presentationLaneId: LANE, gameLaneId: 'actual-portrait', state: 'live' },
    ] });
  // config.store gör att skrivningarna inte går via transaktionsvägen med FOR UPDATE-låset
  // (partner-session.mjs); behörighet under lås provas av SQL-proven, inte här.
  const config = { boDb, scope, now: () => now, pool, readAdministration, store,
    gameDb: { prepare: () => ({ all: async () => [], get: async () => undefined }) },
    allowedOrigins: [origin, 'https://studio.example.invalid'], publicHosts: [host, 'studio.example.invalid'], apiBase: '/studio/api/admin', authBase: '/studio/api/auth',
    journal: createOperatorJournal({ log: () => {}, now: () => now }) };
  return { store, pool, config, cookies, publishPackage: () => store.publishPackage({ actor: 'fixture', operatorId: A.id, lanes: [LANE], games: ['blackjack'], tables: ['alfa-bord'],
    branding: withPackagePresentation({ lane: LANE, name: 'Alfas andra version' }, presentation) }) };
}

const call = async (f, cookie, path, { company = A, query = '', body } = {}) => {
  const response = await handlePartnerAuth(request(cookie, `/studio/api/partner/${path}?operator=${company.slug}${query}`, body ? { body } : {}), f.config);
  return { status: response.status, text: await response.text() };
};
const page = async (f, cookie, view, company = A) => {
  try {
    const loaded = await partnerWorkspaceInitialData(request(cookie, workspaceSurfacePath('partner', view, company.slug)), { config: f.config, store: f.store, operatorSlug: company.slug, view });
    return { status: loaded.denied ? 403 : 200, loaded, text: JSON.stringify(loaded) };
  } catch (error) {
    return { status: error.statusCode, text: String(error.message) };
  }
};
const admin = f => f.cookies.get('partner-admin');
const ok = async (promise, label) => { const result = await promise; assert.equal(result.status, 200, `${label}: ${result.text}`); return JSON.parse(result.text); };

// Förutsättningarna som gör att en tillåten skrivning faktiskt lyckas (200), lagda av bolagets
// administratör i samma fixtur. Kroppen är samma för alla roller.
async function prepare(f, write) {
  const draft = () => ok(call(f, admin(f), 'branding', { body: { action: 'save-draft', expectedDraftRevision: 0, expectedPackageRevision: 1, branding: { lane: LANE } } }), 'utkast');
  if (write.action === 'save-draft') return { action: 'save-draft', expectedDraftRevision: 0, expectedPackageRevision: 1, branding: { lane: LANE } };
  if (write.action === 'discard-draft' || write.action === 'review') { await draft(); return { action: write.action, expectedDraftRevision: 1, expectedPackageRevision: 1 }; }
  if (write.action === 'publish') {
    await draft();
    const review = await ok(call(f, admin(f), 'branding', { body: { action: 'review', expectedDraftRevision: 1, expectedPackageRevision: 1 } }), 'granskning');
    return { action: 'publish', expectedDraftRevision: 1, expectedPackageRevision: 1, reviewToken: review.reviewToken };
  }
  if (write.action === 'restore') { await f.publishPackage(); return { action: 'restore', expectedDraftRevision: 0, expectedPackageRevision: 2, sourcePackageRevision: 1 }; }
  const revision = async userId => (await f.store.getMembership(A.id, userId)).revision;
  if (write.action === 'role') return { action: 'role', userId: '50', roleId: 'mal-nasta', expectedRevision: await revision('50') };
  if (write.action === 'suspend') return { action: 'suspend', userId: '50', expectedRevision: await revision('50') };
  if (write.action === 'reactivate') return { action: 'reactivate', userId: '51', expectedRevision: await revision('51') };
  if (write.action === 'invite') return { action: 'invite', email: 'ny@partner.invalid', roleId: 'mal' };
  throw new Error(`okänd åtgärd ${write.action}`);
}

test('kartan täcker alla tolv behörigheter, alla vyer i menyn och varje vy har en behörighet', () => {
  assert.equal(PARTNER_PERMISSIONS.length, 12);
  // Låser vyernas behörigheter: en vy som flyttas till fel behörighet i policyn ska fälla provet.
  assert.deepEqual({ ...PARTNER_VIEW_PERMISSIONS }, {
    overview: 'overview.read', rooms: 'tables.read', players: 'players.read', reports: 'reports.read',
    team: 'team.read', integration: 'integrations.read', help: 'overview.read',
  });
  assert.deepEqual([...partnerNavigationItems.map(item => item.id)].sort(), [...PARTNER_VIEWS].sort());
  for (const view of PARTNER_VIEWS) assert.ok(PARTNER_PERMISSIONS.includes(PARTNER_VIEW_PERMISSIONS[view]), view);
  const used = new Set([...PARTNER_VIEWS.flatMap(viewRequires), ...API_READS.flatMap(item => item.requires), ...API_WRITES.flatMap(item => item.requires)]);
  // tables.configure styr ännu ingen vy eller åtgärd (steg C); när den gör det utökas kartan här.
  assert.deepEqual(PARTNER_PERMISSIONS.filter(permission => !used.has(permission)), ['tables.configure']);
  assert.equal(ROLES.length, 3 + 2 * PARTNER_PERMISSIONS.length);
});

test('varje roll öppnar exakt de vyer kartan ger, och menyn visar samma vyer', async () => {
  const f = await fixture();
  for (const role of ROLES) {
    const cookie = f.cookies.get(role.id), opened = [];
    for (const view of PARTNER_VIEWS) {
      const result = await page(f, cookie, view);
      assert.equal(result.status, expected(role, viewRequires(view)), `${role.id} ${view}: ${result.text.slice(0, 200)}`);
      assert.doesNotMatch(result.text, B_MARKERS, `${role.id} ${view}`);
      if (result.loaded?.denied) assert.equal(result.loaded.denied.permission, PARTNER_VIEW_PERMISSIONS[view], `${role.id} ${view}`);
      if (result.status === 200) opened.push(view);
    }
    if (role.permissions.includes(FLOOR)) assert.deepEqual(partnerNavigation('sv', role.permissions).map(item => item.id), opened, role.id);
    else assert.deepEqual(opened, [], role.id);
  }
});

test('varje roll får exakt de läsningar kartan ger, och läsningen bär bara vad rollen får se', async () => {
  const f = await fixture();
  for (const role of ROLES) {
    const cookie = f.cookies.get(role.id);
    for (const read of API_READS) {
      const result = await call(f, cookie, read.path, { query: read.query });
      assert.equal(result.status, expected(role, read.requires), `${role.id} ${read.id}: ${result.text.slice(0, 200)}`);
      assert.doesNotMatch(result.text, B_MARKERS, `${role.id} ${read.id}`);
      if (result.status !== 200) { assert.deepEqual(JSON.parse(result.text), { error: 'Access denied' }); continue; }
      const body = JSON.parse(result.text);
      if (read.id === 'branding GET') {
        // tables.read styr spelbordslistan i utseendet (4.3 punkt 1).
        assert.equal(body.rooms.length > 0, role.permissions.includes('tables.read'), `${role.id} spelbord i utseendet`);
        assert.equal(body.canConfigure, allows(role, BRANDING_WRITE), `${role.id} canConfigure`);
      }
      if (read.id === 'team GET') {
        // Teamvyns knappar följer samma karta som servern använder för skrivningarna.
        const can = action => allows(role, API_WRITES.find(item => item.path === 'team' && item.action === action).requires);
        assert.deepEqual(body.can, { journal: allows(role, TEAM_WRITE), invite: can('invite'), role: can('role'), suspend: can('suspend') }, role.id);
      }
      if (read.id === 'journal kind=publications') for (const entry of body.entries) assert.deepEqual(Object.keys(entry).sort(), ['afterRevision', 'atMs', 'beforeRevision', 'id']);
    }
  }
});

test('varje roll får exakt de skrivningar kartan ger, och en nekad skrivning ändrar ingenting', async () => {
  for (const write of API_WRITES) {
    const f = await fixture();
    const body = await prepare(f, write);
    // Varje roll prövar samma utgångsläge: lagret läggs tillbaka efter varje försök.
    const saved = structuredClone(f.pool.tables), before = JSON.stringify(saved);
    for (const role of ROLES) {
      for (const [name, rows] of Object.entries(structuredClone(saved))) f.pool.tables[name].splice(0, Infinity, ...rows);
      assert.equal(JSON.stringify(f.pool.tables), before);
      const result = await call(f, f.cookies.get(role.id), write.path, { body });
      const want = expected(role, write.requires);
      assert.equal(result.status, want, `${role.id} ${write.id}: ${result.text.slice(0, 200)}`);
      assert.doesNotMatch(result.text, B_MARKERS, `${role.id} ${write.id}`);
      if (want === 403) assert.equal(JSON.stringify(f.pool.tables), before, `${role.id} ${write.id} ändrade lagret`);
      else if (write.action !== 'review') assert.notEqual(JSON.stringify(f.pool.tables), before, `${role.id} ${write.id} sparade inget`);
    }
  }
});

test('bolag B och ett okänt bolag: 403 respektive 404 för varje roll, vy och åtgärd, utan B:s data', async () => {
  const f = await fixture();
  const unknown = { slug: 'okantbolag' };
  const before = JSON.stringify(f.pool.tables);
  for (const role of ROLES) {
    const cookie = f.cookies.get(role.id);
    for (const view of PARTNER_VIEWS) {
      const foreign = await page(f, cookie, view, B);
      assert.equal(foreign.status, 403, `${role.id} ${view} B`); assert.doesNotMatch(foreign.text, B_MARKERS);
      assert.equal((await page(f, cookie, view, unknown)).status, 404, `${role.id} ${view} okänt bolag`);
    }
    for (const item of [...API_READS, ...API_WRITES]) {
      const body = item.action ? { action: item.action } : undefined;
      const foreign = await call(f, cookie, item.path, { company: B, query: item.query, body });
      assert.equal(foreign.status, 403, `${role.id} ${item.id} B`);
      assert.deepEqual(JSON.parse(foreign.text), { error: 'Access denied' });
      assert.equal((await call(f, cookie, item.path, { company: unknown, query: item.query, body })).status, 404, `${role.id} ${item.id} okänt bolag`);
    }
  }
  assert.equal(JSON.stringify(f.pool.tables), before);
});

test('en teamändring som pekar på bolag B:s medlem: 404 för den som får ändra teamet, annars 403', async () => {
  const f = await fixture();
  const before = JSON.stringify(f.pool.tables);
  const betaRevision = (await f.store.getMembership(B.id, '46')).revision;
  for (const role of ROLES) {
    for (const body of [{ action: 'role', userId: '46', roleId: 'mal', expectedRevision: betaRevision }, { action: 'suspend', userId: '46', expectedRevision: betaRevision }]) {
      const result = await call(f, f.cookies.get(role.id), 'team', { body });
      assert.equal(result.status, allows(role, TEAM_WRITE) ? 404 : 403, `${role.id} ${body.action}`);
      assert.doesNotMatch(result.text, B_MARKERS);
    }
  }
  assert.equal(JSON.stringify(f.pool.tables), before);
  assert.equal((await f.store.getMembership(B.id, '46')).status, 'active');
});
