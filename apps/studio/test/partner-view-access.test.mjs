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
import { validatePartnerSnapshot } from '../components/kevin-bo/partner-workspace-context.mjs';

// Partnerportalen per role: the server decides every view, not the menu.
// partner-editor: overview, tables, presentations (configure). partner-viewer: every *.read.
const origin = 'https://public.example.invalid', host = 'public.example.invalid';
const scope = { environment: 'fixture', workspaceId: 'croupier' };
const now = 1_700_000_000_000;
const john = { id: 'john-company', slug: 'johnsspelbolag', name: 'Johns spelbolag' };
// A second company in the same scope: its members, rooms and package must never reach John's.
const south = { id: 'south-company', slug: 'southsspelbolag', name: 'Souths spelbolag' };
const stamp = user => createHash('sha256').update(`${user.salt}:${user.hash}`).digest('hex');
const request = (cookie, path, { body, headers = {} } = {}) => new Request(`${origin}${path}`, { method: body ? 'POST' : 'GET', headers: {
  host, cookie, ...(body ? { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' } : {}), ...headers,
}, ...(body ? { body: JSON.stringify(body) } : {}) });

async function fixture(poolOptions) {
  const users = [
    { id: '42', username: 'john-admin', role: 'partner', email: 'admin@partner.invalid' },
    { id: '43', username: 'john-editor', role: 'partner', email: 'editor@partner.invalid' },
    { id: '44', username: 'john-viewer', role: 'partner', email: 'viewer@partner.invalid' },
    { id: '46', username: 'south-admin', role: 'partner', email: 'south@partner.invalid' },
    { id: '47', username: 'john-night', role: 'partner', email: 'night@partner.invalid' },
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
  const pool = operatorMemoryPool(poolOptions);
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
  await store.createOperator({ actor: 'fixture', operatorId: south.id, slug: south.slug, name: south.name });
  for (const role of STANDARD_OPERATOR_ROLES) await store.upsertRole({ actor: 'fixture', operatorId: south.id, roleId: role.id, label: role.label, permissions: [...role.permissions], delegable: role.delegable });
  await store.upsertMembership({ actor: 'fixture', operatorId: south.id, userId: '46', roleId: 'partner-admin', status: 'active' });
  await store.publishPackage({ actor: 'fixture', operatorId: south.id, lanes: [lane.id], games: ['blackjack'], tables: ['south-room'],
    branding: withPackagePresentation({ lane: lane.id, name: 'Souths bordsnamn' }, presentation) });
  // The room config binding is written by the Admin room publication (croupier_game tables the memory pool
  // does not have); the stored package row carries it, so the readout sees the bound configVersion.
  const row = pool.tables.operator_packages.find(item => item.operator_id === john.id);
  row.branding = JSON.stringify({ ...JSON.parse(row.branding), roomGameConfigVersions: { 'john-room': 'config-7' } });
  const readAdministration = async () => ({ gameLane: 'actual-portrait',
    gameLanes: [{ schemaVersion: 1, id: 'actual-portrait', label: 'Runtime', renderer: 'portrait-video', dealer: 'astrid', mediaCollection: 'astrid-presentation' }],
    rooms: [
      { schemaVersion: 2, id: 'john-room', name: 'Johns blackjack', operatorId: john.id, presentationLaneId: lane.id, gameLaneId: 'actual-portrait', state: 'live' },
      { schemaVersion: 2, id: 'john-paused', name: 'Pausat bord', operatorId: john.id, presentationLaneId: lane.id, gameLaneId: 'actual-portrait', state: 'pending' },
      { schemaVersion: 2, id: 'south-room', name: 'Souths blackjack', operatorId: south.id, presentationLaneId: lane.id, gameLaneId: 'actual-portrait', state: 'live' },
    ] });
  const config = { boDb, scope, now: () => now, pool, readAdministration, store,
    gameDb: { prepare: () => ({ all: async () => [], get: async () => undefined }) },
    allowedOrigins: [origin, 'https://studio.example.invalid'], publicHosts: [host, 'studio.example.invalid'], apiBase: '/studio/api/admin', authBase: '/studio/api/auth',
    journal: createOperatorJournal({ log: () => {}, now: () => now }) };
  return { store, config, pool, admin: session(users[0], 'aa'.repeat(32)), editor: session(users[1], 'bb'.repeat(32)), viewer: session(users[2], 'cc'.repeat(32)),
    southAdmin: session(users[3], 'dd'.repeat(32)), night: session(users[4], 'ee'.repeat(32)) };
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
    // The denied view's own data is absent, as is anything about members or other companies.
    const text = JSON.stringify(loaded.snapshot);
    assert.doesNotMatch(text, /john-admin|john-viewer|admin@partner|viewer@partner/, 'no member identity leaks to a denied view');
    assert.doesNotMatch(text, /south-room|south-admin|Souths/, 'nothing from another company');
    assert.doesNotMatch(text, /"status":"ready"|api_keys|integrations:/);
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

test('a member of one company is refused another company\'s pages, economy and API without any of its data', async () => {
  const f = await fixture();
  const foreign = (cookie, view) => partnerWorkspaceInitialData(request(cookie, workspaceSurfacePath('partner', view, south.slug)), { config: f.config, store: f.store, operatorSlug: south.slug, view });
  for (const cookie of [f.admin, f.editor, f.viewer]) {
    for (const view of PARTNER_VIEWS) {
      let leaked = null;
      await assert.rejects(foreign(cookie, view).then(value => { leaked = value; }), error => error.statusCode === 403 && error.message === 'partner_data_rejected', view);
      assert.equal(leaked, null);
    }
    for (const action of ['snapshot', 'branding', 'team', 'journal']) {
      const response = await handlePartnerAuth(request(cookie, `/studio/api/partner/${action}?operator=${south.slug}`), f.config);
      assert.equal(response.status, 403, action);
      const text = await response.text();
      assert.deepEqual(JSON.parse(text), { error: 'Access denied' });
      assert.doesNotMatch(text, /south|Souths/i, 'the refusal names nothing about the other company');
    }
  }
  // The other company's own administrator reads only their company, and John's rooms, package name and members never appear.
  const theirs = await partnerWorkspaceInitialData(request(f.southAdmin, workspaceSurfacePath('partner', 'overview', south.slug)), { config: f.config, store: f.store, operatorSlug: south.slug, view: 'overview' });
  assert.equal(theirs.snapshot.operator.id, south.id);
  assert.deepEqual(theirs.snapshot.tables.map(room => room.id), ['south-room']);
  assert.deepEqual(theirs.snapshot.operators.map(item => item.slug), [south.slug]);
  // (The scene template is shared fixture material, so its id is not a company marker.)
  assert.doesNotMatch(JSON.stringify(theirs), /john-room|john-paused|john-admin|john-editor|Johns/);
  // And the reverse: John's administrator's economy snapshot never carries South.
  const mine = await handlePartnerAuth(request(f.admin, `/studio/api/partner/snapshot?operator=${john.slug}`), f.config);
  assert.equal(mine.status, 200);
  assert.doesNotMatch(await mine.text(), /south-room|south-admin|Souths/);
});

test('an anonymous or forged session is refused on every new address before any company data is read', async () => {
  const f = await fixture();
  for (const cookie of ['', 'partner_session=' + 'ff'.repeat(32), 'partner_session=not-a-token']) {
    for (const view of PARTNER_VIEWS) {
      await assert.rejects(partnerWorkspaceInitialData(request(cookie, workspaceSurfacePath('partner', view, john.slug)), { config: f.config, store: f.store, operatorSlug: john.slug, view }),
        error => error.statusCode === 401, `${view} ${cookie}`);
    }
    for (const action of ['snapshot', 'branding', 'team', 'journal']) {
      const response = await handlePartnerAuth(request(cookie, `/studio/api/partner/${action}?operator=${john.slug}`), f.config);
      assert.equal(response.status, 401, `${action} ${cookie}`);
      assert.doesNotMatch(await response.text(), /john|astrid|Johns/i);
    }
  }
});

test('the snapshot carries only the sections the role may read, so a denied or narrow role gets no stray data', async () => {
  const f = await fixture();
  // partner-editor: overview, tables and presentations, but neither reports nor team.
  const editor = (await page(f, f.editor, 'overview')).snapshot;
  assert.deepEqual(editor.tables.map(room => room.id), ['john-room', 'john-paused']);
  assert.equal(editor.presentation?.lanes?.length, 1); assert.ok(editor.assignment); assert.equal(editor.draft, null);
  assert.deepEqual([editor.team, editor.invitations, editor.publications, editor.reports], [[], 0, [], undefined]);
  assert.deepEqual(editor.summary, { activeTables: 1 });
  // A custom role with overview.read alone: no rooms, no scene template, no assignment, no draft, no economy, no team.
  await f.store.upsertRole({ actor: 'fixture', operatorId: john.id, roleId: 'night-shift', label: 'Nattskift', permissions: ['overview.read'], delegable: false });
  await f.store.upsertMembership({ actor: 'fixture', operatorId: john.id, userId: '47', roleId: 'night-shift', status: 'active' });
  const narrow = (await page(f, f.night, 'overview')).snapshot;
  assert.deepEqual(narrow.role, { id: 'night-shift', label: 'Nattskift' }); assert.deepEqual(narrow.permissions, ['overview.read']);
  assert.deepEqual([narrow.tables, narrow.presentations, narrow.team, narrow.publications], [[], [], [], []]);
  for (const key of ['presentation', 'branding', 'roomBindings', 'assignment', 'reports']) assert.equal(narrow[key], undefined, key);
  assert.equal(narrow.draft, null); assert.deepEqual(narrow.summary, {});
  assert.equal(narrow.packageRevision, '1', 'the revision in the sidebar needs only overview.read');
  assert.doesNotMatch(JSON.stringify(narrow), /john-room|astrid|john-admin|Johns blackjack/);
  for (const view of ['rooms', 'players', 'reports', 'team', 'integration']) {
    const loaded = await page(f, f.night, view);
    assert.equal(loaded.denied?.view, view);
    assert.doesNotMatch(JSON.stringify(loaded.snapshot), /john-room|astrid|john-admin/);
  }
});

// Nyckel→bolag (docs/plans/NYCKEL-BOLAG.md): Integration shows the company's own keys, masked.
// The memory pool hands back whole rows (key, secret, wallet, IP list, creator) on purpose: only
// the projection in lib/partner-api-keys.mjs may reach the snapshot. The SQL runs on PGlite in
// test/partner-key-operator.mjs.
const apiKey = (id, operatorId, extra = {}) => ({ id, name: `Nyckel ${id}`, key: `ck_live_LEAKKEY${id}`, secret: `cs_LEAKSECRET${id}`, scopes: '["launch","play","admin"]',
  wallet_url: 'https://wallet.partner.invalid/LEAKWALLET', ip_allow: '203.0.113.7', created_by: 'staff@scoutgaming.invalid',
  created_at: '2026-10-29T08:00:00.000Z', last_used: null, revoked_at: null, operator_id: operatorId, ...extra });
const integration = (f, cookie, company = john) => partnerWorkspaceInitialData(request(cookie, workspaceSurfacePath('partner', 'integration', company.slug)),
  { config: f.config, store: f.store, operatorSlug: company.slug, view: 'integration' });

test('Integration lists only the company\'s own keys, masked, and only to a role with integrations.read', async () => {
  const f = await fixture();
  f.pool.tables.api_keys.push(apiKey('john-live', john.id, { last_used: '2026-10-29T10:00:00.000Z' }),
    apiKey('john-old', john.id, { revoked_at: '2026-10-29T09:00:00.000Z' }), apiKey('south-live', south.id));
  for (const cookie of [f.admin, f.viewer]) {
    const { snapshot } = await integration(f, cookie);
    assert.equal(snapshot.apiKeys.status, 'connected');
    assert.deepEqual(snapshot.apiKeys.keys.map(key => [key.id, key.operatorId, key.status, key.scopes, key.walletConfigured, key.lastUsed, key.revokedAt]), [
      ['john-live', john.id, 'active', ['launch', 'play'], true, '2026-10-29T10:00:00.000Z', null],
      ['john-old', john.id, 'revoked', ['launch', 'play'], true, null, '2026-10-29T09:00:00.000Z'],
    ]);
    assert.deepEqual(Object.keys(snapshot.apiKeys.keys[0]).sort(), ['createdAt', 'id', 'lastUsed', 'name', 'operatorId', 'revokedAt', 'scopes', 'status', 'walletConfigured']);
    assert.doesNotMatch(JSON.stringify(snapshot), /LEAK|south-live|203\.0\.113\.7|staff@scoutgaming|ip_allow|created_by|wallet_url/);
    assert.equal(validatePartnerSnapshot(snapshot), snapshot);
    // Client-side navigation keeps the snapshot, so the keys are there on every view the role opens.
    assert.deepEqual((await page(f, cookie, 'overview')).snapshot.apiKeys.keys.map(key => key.id), ['john-live', 'john-old']);
  }
  // The redaktör lacks integrations.read: no keys on Integration (the 403 card) or on any other view.
  for (const view of PARTNER_VIEWS) {
    const loaded = await page(f, f.editor, view);
    assert.equal(loaded.snapshot.apiKeys, undefined, view);
    assert.doesNotMatch(JSON.stringify(loaded.snapshot), /john-live|john-old|LEAK/, view);
  }
  // The other company's administrator sees their own key only, and John's never.
  const theirs = (await integration(f, f.southAdmin, south)).snapshot;
  assert.deepEqual(theirs.apiKeys.keys.map(key => [key.id, key.operatorId]), [['south-live', south.id]]);
  assert.doesNotMatch(JSON.stringify(theirs), /john-live|john-old|LEAK/);
  // John's members cannot read South's keys through the page or the snapshot API.
  for (const cookie of [f.admin, f.viewer]) {
    await assert.rejects(integration(f, cookie, south), error => error.statusCode === 403);
    const response = await handlePartnerAuth(request(cookie, `/studio/api/partner/snapshot?operator=${south.slug}`), f.config);
    assert.equal(response.status, 403); assert.doesNotMatch(await response.text(), /south-live/);
  }
  // A snapshot that would carry another company's key is refused before it renders.
  const { snapshot } = await integration(f, f.admin);
  const forged = { ...snapshot, apiKeys: { ...snapshot.apiKeys, keys: [...snapshot.apiKeys.keys, { ...snapshot.apiKeys.keys[0], id: 'south-live', operatorId: south.id }] } };
  assert.throws(() => validatePartnerSnapshot(forged), /fel bolagskontext/);
  assert.throws(() => validatePartnerSnapshot({ ...snapshot, apiKeys: { status: 'connected' } }), /fel bolagskontext/);
});

test('Partnerportalen cannot create, rotate or revoke a key; only Admin can, so a body naming a company changes nothing', async () => {
  const f = await fixture();
  f.pool.tables.api_keys.push(apiKey('john-live', john.id));
  const before = structuredClone(f.pool.tables.api_keys);
  for (const cookie of [f.admin, f.viewer, f.southAdmin]) {
    for (const action of ['apikeys', 'apikeys/create', 'apikeys/rotate', 'keys']) {
      for (const body of [{ operatorId: john.id, name: 'Egen' }, { operatorId: south.id, name: 'Annans' }, { id: 'john-live' }]) {
        const response = await handlePartnerAuth(request(cookie, `/studio/api/partner/${action}?operator=${john.slug}`, { body }), f.config);
        assert.ok(response.status >= 400 && response.status < 500, `${action} ${response.status}`);
        assert.doesNotMatch(await response.text(), /ck_live|cs_|LEAK/);
      }
    }
  }
  assert.deepEqual(f.pool.tables.api_keys, before);
});

test('before game migration 012 Integration says the keys are pending; a failed read is honest and keeps the page', async () => {
  const pending = await fixture({ apiKeyColumn: false });
  pending.pool.tables.api_keys.push(apiKey('john-live', john.id));
  const early = (await integration(pending, pending.admin)).snapshot;
  assert.deepEqual(early.apiKeys, { status: 'pending', keys: [] });
  assert.doesNotMatch(JSON.stringify(early), /john-live|LEAK/);
  const broken = await fixture();
  broken.pool.tables.api_keys = null; // the read throws inside the pool
  const loaded = await integration(broken, broken.admin);
  assert.equal(loaded.denied, undefined);
  assert.deepEqual(loaded.snapshot.apiKeys, { status: 'not-connected', reason: 'read-failed', keys: [] });
});
