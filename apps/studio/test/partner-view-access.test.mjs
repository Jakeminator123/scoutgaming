import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { handlePartnerAuth, partnerSessionDigest } from '../lib/partner-session.mjs';
import { partnerWorkspaceData, partnerWorkspaceInitialData } from '../lib/partner-data.mjs';
import { createOperatorJournal } from '../lib/operator-journal.mjs';
import { STANDARD_OPERATOR_ROLES } from '../lib/operator-admin-api.mjs';
import { PARTNER_VIEW_PERMISSIONS } from '../../../packages/studio-access/server/partner-access-policy.mjs';
import { PARTNER_VIEWS, workspaceSurfacePath } from '../../../packages/navigation/workspace-surfaces.mjs';
import { createOperatorStore } from '../../../packages/operators/server/operator-store.mjs';
import { defaultPresentationLane } from '../../../packages/presentation/contracts/studio-model.mjs';
import { defaultCompositionSettings } from '../../../packages/presentation/contracts/composition-settings.mjs';
import { withPackagePresentation } from '../../../packages/presentation/server/presentation-package.mjs';
import { cloudPresentationFixture } from './fixtures/cloud-presentation.mjs';
import { operatorMemoryPool, usersDb } from './fixtures/operator-memory-pool.mjs';

// Partnerportalen per role: the server decides every view, not the menu.
// partner-editor: overview, tables, presentations (configure). partner-viewer: every *.read.
const origin = 'https://public.example.invalid', host = 'public.example.invalid';
const scope = { environment: 'fixture', workspaceId: 'croupier' };
const now = 1_700_000_000_000;
const john = { id: 'john-company', slug: 'johnsspelbolag', name: 'Johns spelbolag' };
const stamp = user => createHash('sha256').update(`${user.salt}:${user.hash}`).digest('hex');
const request = (cookie, path, { body, headers = {} } = {}) => new Request(`${origin}${path}`, { method: body ? 'POST' : 'GET', headers: {
  host, cookie, ...(body ? { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' } : {}), ...headers,
}, ...(body ? { body: JSON.stringify(body) } : {}) });

async function fixture() {
  const users = [
    { id: '42', username: 'john-admin', role: 'partner', email: 'admin@partner.invalid' },
    { id: '43', username: 'john-editor', role: 'partner', email: 'editor@partner.invalid' },
    { id: '44', username: 'john-viewer', role: 'partner', email: 'viewer@partner.invalid' },
  ].map(user => ({ ...user, salt: 'cd'.repeat(16), hash: 'ef'.repeat(64), epoch: 0 }));
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
  const session = (user, token) => {
    sessions.push({ token_digest: partnerSessionDigest(token), craig_user_id: user.id, role: 'partner', source_stamp: stamp(user), auth_epoch: 0, expires: now + 3600_000 });
    return `partner_session=${token}`;
  };
  const pool = operatorMemoryPool();
  const store = await createOperatorStore({ sql: pool, scope, now: () => now });
  await store.createOperator({ actor: 'fixture', operatorId: john.id, slug: john.slug, name: john.name });
  for (const role of STANDARD_OPERATOR_ROLES) await store.upsertRole({ actor: 'fixture', operatorId: john.id, roleId: role.id, label: role.label, permissions: [...role.permissions], delegable: role.delegable });
  for (const [userId, roleId] of [['42', 'partner-admin'], ['43', 'partner-editor'], ['44', 'partner-viewer']]) {
    await store.upsertMembership({ actor: 'fixture', operatorId: john.id, userId, roleId, status: 'active' });
  }
  const lane = { ...defaultPresentationLane('astrid'), id: 'john-lane', composition: defaultCompositionSettings(), operatorAdjustable: ['dealer', 'branding'] };
  const presentation = cloudPresentationFixture({ lanes: [lane] }).presentation;
  await store.publishPackage({ actor: 'fixture', operatorId: john.id, lanes: [lane.id], games: ['blackjack'], tables: ['john-room', 'john-paused'],
    branding: withPackagePresentation({ lane: lane.id }, presentation) });
  // The room config binding is written by the Admin room publication (croupier_game tables the memory pool
  // does not have); the stored package row carries it, so the readout sees the bound configVersion.
  const row = pool.tables.operator_packages.find(item => item.operator_id === john.id);
  row.branding = JSON.stringify({ ...JSON.parse(row.branding), roomGameConfigVersions: { 'john-room': 'config-7' } });
  const readAdministration = async () => ({ gameLane: 'actual-portrait',
    gameLanes: [{ schemaVersion: 1, id: 'actual-portrait', label: 'Runtime', renderer: 'portrait-video', dealer: 'astrid', mediaCollection: 'astrid-presentation' }],
    rooms: [
      { schemaVersion: 2, id: 'john-room', name: 'Johns blackjack', operatorId: john.id, presentationLaneId: lane.id, gameLaneId: 'actual-portrait', state: 'live' },
      { schemaVersion: 2, id: 'john-paused', name: 'Pausat bord', operatorId: john.id, presentationLaneId: lane.id, gameLaneId: 'actual-portrait', state: 'pending' },
    ] });
  const config = { boDb, scope, now: () => now, pool, readAdministration, store,
    gameDb: { prepare: () => ({ all: async () => [], get: async () => undefined }) },
    allowedOrigins: [origin, 'https://studio.example.invalid'], publicHosts: [host, 'studio.example.invalid'], apiBase: '/studio/api/admin', authBase: '/studio/api/auth',
    journal: createOperatorJournal({ log: () => {}, now: () => now }) };
  return { store, config, pool, admin: session(users[0], 'aa'.repeat(32)), editor: session(users[1], 'bb'.repeat(32)), viewer: session(users[2], 'cc'.repeat(32)) };
}
const page = (f, cookie, view) => partnerWorkspaceInitialData(request(cookie, workspaceSurfacePath('partner', view, john.slug)), { config: f.config, store: f.store, operatorSlug: john.slug, view });
const api = (f, cookie, action, body) => handlePartnerAuth(request(cookie, `/studio/api/partner/${action}?operator=${john.slug}`, body ? { body } : {}), f.config);

test('a redaktör is denied Team, Spelare, Ekonomi and Integration by direct address, without their data', async () => {
  const f = await fixture();
  for (const view of ['team', 'players', 'reports', 'integration']) {
    const loaded = await page(f, f.editor, view);
    assert.deepEqual(loaded.denied, { view, permission: PARTNER_VIEW_PERMISSIONS[view], role: { id: 'partner-editor', label: 'redaktör' } }, view);
    assert.deepEqual(loaded.snapshot.denied, loaded.denied);
    assert.deepEqual(loaded.snapshot.team, []); assert.equal(loaded.snapshot.invitations, 0);
    assert.equal(loaded.snapshot.reports, undefined); assert.deepEqual(loaded.snapshot.publications, []);
    assert.equal(JSON.stringify(loaded.snapshot).includes('john-admin'), false, 'no member identity leaks to a denied view');
  }
  for (const view of ['overview', 'rooms', 'help']) {
    const loaded = await page(f, f.editor, view);
    assert.equal(loaded.denied, undefined, view); assert.equal(loaded.snapshot.view, view);
  }
  assert.equal((await api(f, f.editor, 'team')).status, 403);
  assert.equal((await api(f, f.editor, 'journal')).status, 403);
});

test('a läsare opens all seven views but every write is refused on the server', async () => {
  const f = await fixture();
  for (const view of PARTNER_VIEWS) {
    const loaded = await page(f, f.viewer, view);
    assert.equal(loaded.denied, undefined, view);
    assert.deepEqual(loaded.snapshot.role, { id: 'partner-viewer', label: 'läsare' });
  }
  const team = await api(f, f.viewer, 'team');
  assert.equal(team.status, 200);
  const listing = await team.json();
  assert.deepEqual(listing.can, { journal: false, invite: false, role: false, suspend: false });
  assert.equal((await api(f, f.viewer, 'team', { action: 'role', userId: '43', roleId: 'partner-viewer', expectedRevision: 1 })).status, 403);
  assert.equal((await api(f, f.viewer, 'team', { action: 'suspend', userId: '43', expectedRevision: 1 })).status, 403);
  const branding = await api(f, f.viewer, 'branding');
  assert.equal(branding.status, 200); assert.equal((await branding.json()).canConfigure, false);
  assert.equal((await api(f, f.viewer, 'branding', { action: 'save-draft', expectedDraftRevision: 0, expectedPackageRevision: 1, branding: { background: 'bg-two' } })).status, 403);
  assert.equal(f.pool.tables.operator_branding_drafts.length, 0);
  assert.equal(f.pool.tables.operator_memberships.find(row => row.user_id === '43').role_id, 'partner-editor');
});

test('the snapshot carries the assignment, room state, lobby link, config version, dealer and honest readouts', async () => {
  const f = await fixture();
  const loaded = await page(f, f.admin, 'overview');
  const { snapshot } = loaded;
  assert.deepEqual(snapshot.role, { id: 'partner-admin', label: 'administratör' });
  assert.equal(snapshot.packageRevision, '1'); assert.equal(snapshot.publishedAt, now);
  assert.deepEqual(snapshot.assignment, { games: ['blackjack'], dealers: [{ id: 'astrid', label: 'Astrid' }], lanes: [{ id: 'john-lane', label: 'Standardsammansättning' }],
    backgrounds: [], tables: [] });
  assert.deepEqual(snapshot.tables.map(room => [room.id, room.state, room.status, room.playUrl, room.configVersion, room.dealer]), [
    ['john-room', 'live', 'active', '/game?game=blackjack&operator=johnsspelbolag&table=john-room', 'config-7', { id: 'astrid', label: 'Astrid' }],
    ['john-paused', 'pending', 'pending', null, null, { id: 'astrid', label: 'Astrid' }],
  ]);
  assert.equal(snapshot.tables[0].settings, undefined, 'no game settings are invented when the game table cannot be read');
  assert.equal(snapshot.summary.activeTables, 1);
  assert.deepEqual(snapshot.reports, { status: 'not-connected', reason: 'read-failed' }, 'the fixture pool has no game journal, so Ekonomi says so');
  assert.equal(snapshot.draft, null); assert.equal(snapshot.invitations, 0);
  assert.deepEqual(snapshot.publications, [{ revision: 1, publishedAt: now }]);
  for (const key of ['players', 'transactions', 'unavailableSections', 'notConnected', 'integration']) assert.equal(snapshot[key], undefined, key);
  assert.equal(snapshot.summary.playersToday, undefined); assert.equal(snapshot.summary.roundsToday, undefined);
  // A saved draft and a pending invitation show up as waiting work.
  await f.store.saveBrandingDraft({ actor: '42', operatorId: john.id, expectedDraftRevision: 0, expectedPackageRevision: 1, branding: { lane: 'john-lane', dealer: 'astrid' },
    audit: { actorId: '42', accessClass: 'partner', action: 'draft.save', requestId: '00000000-0000-4000-8000-000000000001' } });
  await f.store.upsertMembership({ actor: '42', operatorId: john.id, userId: '45', roleId: 'partner-viewer', status: 'invited' });
  const waiting = (await page(f, f.admin, 'overview')).snapshot;
  assert.equal(waiting.draft?.revision, 1); assert.equal(waiting.draft?.basePackageRevision, 1);
  assert.equal(waiting.invitations, 1);
  await assert.rejects(partnerWorkspaceData(request(f.admin, '/studio/api/partner/snapshot'), { config: f.config, store: f.store, operatorSlug: john.slug, view: 'unknown' }), error => error.statusCode === 404);
});
