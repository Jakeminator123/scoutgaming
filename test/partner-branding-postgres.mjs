import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createPostgresStore } from '../web/storage/postgres-store.mjs';
import { createOperatorStore } from '../web/storage/operator-store.mjs';
import { canonicalStudioJson } from '../web/storage/studio-contract.mjs';
import { publicEditableBranding } from '../web/storage/partner-branding.mjs';
import { handlePartnerAuth } from '../lab/lib/partner-session.mjs';
import { STANDARD_OPERATOR_ROLES } from '../lab/lib/operator-admin-api.mjs';
import { createOperatorJournal } from '../lab/lib/operator-journal.mjs';
import { createFrozenDealerContextReader } from '../web/storage/frozen-dealer-presentation.mjs';
import { createGameEntrySelector } from '../web/game-entry-operator.mjs';
import { createOperatorAppearanceApi } from '../web/operator-appearance-api.mjs';
import { createOperatorAppearanceBoundary } from '../web/public/operator-appearance-boundary.mjs';
import { resolvePlayerSelection } from '../web/public/player-choices.mjs';
import { defaultPresentationLane } from '../lab/lib/studio-model.mjs';
import { defaultCompositionSettings } from '../web/public/composition-settings.mjs';
import { layerAssetPath } from '../web/presentation-layers.mjs';
import { withPackagePresentation, readPackagePresentation } from '../web/storage/presentation-package.mjs';

const origin = 'https://n2-branding-qa.example.invalid';
const host = 'n2-branding-qa.example.invalid';
const scope = { environment: 'isolated-n2-branding-qa', workspaceId: 'draft-acceptance' };

function presentationFixture() {
  const assets = ['table', 'table', 'background', 'background'].map((role, index) => {
    const asset = { schemaVersion: 1, id: '00000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'), role,
      label: role + index, contentType: 'image/png', sha256: 'a'.repeat(64), size: 32, width: 720, height: 1280 };
    return { ...asset, pathname: layerAssetPath(asset) };
  });
  const lanes = ['first-presentation', 'vip-presentation'].map((id, index) => {
    const lane = { ...defaultPresentationLane(), id, dealers: ['astrid', 'vera'],
      operatorAdjustable: ['table', 'table.color', 'background', 'dealer'], composition: defaultCompositionSettings() };
    lane.layers.dealer = { enabled: true, default: 'astrid', allowed: ['astrid', 'vera'] };
    lane.layers.table = { enabled: true, default: assets[index].id, allowed: assets.slice(0, 2).map(row => row.id), colors: ['#112233', '#445566'] };
    lane.layers.background = { enabled: true, mode: 'image', default: assets[index + 2].id, allowed: assets.slice(2).map(row => row.id) };
    return lane;
  });
  const room = (id, lane, operatorId = 'draft-north', state = 'live') => ({ schemaVersion: 2, id, name: id,
    presentationLaneId: lane, gameLaneId: 'indexed', operatorId, state });
  const administration = { gameLane: 'indexed', gameLanes: [{ schemaVersion: 1, id: 'indexed', label: 'Indexed',
    renderer: 'indexed-video', dealer: 'astrid', mediaCollection: 'legacy-dealers' }], rooms: [
      room('draft-room-first', lanes[0].id), room('draft-room-vip', lanes[1].id),
      room('draft-room-foreign', lanes[0].id, 'draft-south'), room('draft-room-hidden', lanes[0].id, 'draft-north', 'preview'),
    ] };
  return { assets, lanes, administration, presentation: { schemaVersion: 1, projectRevision: 'isolated-frozen-originals', lanes, assets } };
}

// Called after the empty-database team suite has installed the production schemas.
// This scope must itself be new. No shared/remote database or existing data is accepted.
export async function runPartnerBrandingPostgresChecks({ operatorPool, authPool, restart } = {}) {
  const checks = [];
  const check = async (name, run) => { await run(); checks.push(name); process.stdout.write(`PASS ${name}\n`); };
  const targets = [];
  for (const [pool, database] of [[operatorPool, 'n2_qa_operators'], [authPool, 'n2_qa_auth']]) {
    assert.equal(typeof pool?.connect, 'function');
    const target = (await pool.query("SELECT host(inet_server_addr()) AS address,current_user AS role,current_database() AS database,current_setting('listen_addresses') AS listeners,inet_server_port() AS port")).rows[0];
    assert.deepEqual({ ...target, port: undefined }, { address: '127.0.0.1', role: 'studio_qa', database, listeners: '127.0.0.1', port: undefined });
    targets.push(target);
  }
  assert.equal(targets[0].port, targets[1].port);
  assert.ok((await operatorPool.query("SELECT to_regclass('croupier_studio.operator_branding_drafts') AS present")).rows[0].present, 'production draft migration must already be installed');
  assert.equal((await operatorPool.query('SELECT count(*)::int AS count FROM croupier_studio.operators WHERE environment_id=$1 AND workspace_id=$2', [scope.environment, scope.workspaceId])).rows[0].count, 0, 'branding fixture scope must start empty');
  const fixture = presentationFixture();
  const pass = randomBytes(16).toString('hex');
  for (const [id, username] of [['242', 'draft-admin'], ['243', 'draft-editor'], ['244', 'draft-viewer'], ['245', 'draft-outsider']]) {
    const salt = randomBytes(16).toString('hex');
    await authPool.query('INSERT INTO croupier_auth.users(id,username,email,salt,hash,role,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [id, username, `${username}@qa.invalid`, salt, scryptSync(pass, salt, 64).toString('hex'), 'partner', new Date().toISOString()]);
  }
  let store = await createOperatorStore({ sql: operatorPool, scope });
  for (const operatorId of ['draft-north', 'draft-south']) {
    await store.createOperator({ actor: 'fixture', operatorId, slug: operatorId, name: operatorId });
    for (const role of STANDARD_OPERATOR_ROLES) await store.upsertRole({ actor: 'fixture', operatorId, roleId: role.id, label: role.label, permissions: [...role.permissions], delegable: role.delegable });
    await store.publishPackage({ actor: 'fixture', operatorId, lanes: fixture.lanes.map(row => row.id), games: ['blackjack'],
      tables: operatorId === 'draft-north' ? ['draft-room-first', 'draft-room-vip'] : ['draft-room-foreign'],
      branding: withPackagePresentation({ lane: fixture.lanes[0].id, dealer: 'astrid', color: '#112233' }, fixture.presentation) });
  }
  for (const [userId, roleId] of [['242', 'partner-admin'], ['243', 'partner-editor'], ['244', 'partner-viewer']]) {
    await store.upsertMembership({ actor: 'fixture', operatorId: 'draft-north', userId, roleId, status: 'active' });
  }
  await store.upsertMembership({ actor: 'fixture', operatorId: 'draft-south', userId: '245', roleId: 'partner-admin', status: 'active' });
  const auth = createPostgresStore({ pool: authPool });
  let config = { pool: operatorPool, scope, boDb: auth.boDb, gameDb: auth.db, allowedOrigins: [origin, 'https://n2-branding-lab.example.invalid'],
    publicHosts: [host, 'n2-branding-lab.example.invalid'], apiBase: '/studio/api/admin', authBase: '/studio/api/auth', publicOrigin: origin,
    rateLimit: async () => true, clientAddress: () => '192.0.2.2', journal: createOperatorJournal({ log: () => {} }),
    readAdministration: async () => ({ revision: 'qa-administration-1', value: structuredClone(fixture.administration) }),
    readProject: () => assert.fail('draft API must validate the frozen package, not a mutable project'),
  };
  const request = (path, { cookie, body } = {}) => new Request(`${origin}/studio/api/partner/${path}`, {
    method: body ? 'POST' : 'GET', headers: { host, origin, 'sec-fetch-site': 'same-origin', ...(cookie ? { cookie } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const call = (path, options, configuration = config) => handlePartnerAuth(request(path, options), configuration);
  async function cookieFor(user) {
    const response = await call('login', { body: { user, pass } });
    assert.equal(response.status, 200);
    return response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  }
  const admin = await cookieFor('draft-admin'), editor = await cookieFor('draft-editor'), viewer = await cookieFor('draft-viewer'), outsider = await cookieFor('draft-outsider');
  const path = 'branding?operator=draft-north';
  const get = async (cookie = admin) => { const response = await call(path, { cookie }); assert.equal(response.status, 200); return response.json(); };
  const post = async (body, { cookie = admin, status = 200, configuration = config } = {}) => {
    const response = await call(path, { cookie, body }, configuration); const value = await response.json();
    assert.equal(response.status, status, JSON.stringify({ action: body.action, value })); return value;
  };
  const editable = { lane: fixture.lanes[0].id, dealer: 'vera', color: '#445566' };
  const versions = state => ({ expectedDraftRevision: state.draft?.revision ?? state.draftRevision ?? 0, expectedPackageRevision: state.packageRevision });
  const snapshot = async () => ({ package: await store.getCurrentPackage('draft-north'), draft: await store.getBrandingDraft('draft-north'),
    journal: await store.listAuditEvents('draft-north', { limit: 100 }) });
  const refreshPools = async () => {
    if (!restart) return;
    ({ operatorPool, authPool } = await restart());
    store = await createOperatorStore({ sql: operatorPool, scope });
    const reopened = createPostgresStore({ pool: authPool });
    config = { ...config, pool: operatorPool, boDb: reopened.boDb, gameDb: reopened.db };
  };

  await check('draft reads and writes enforce real isolated account and tenant permissions', async () => {
    assert.equal((await get(viewer)).canConfigure, false);
    for (const action of ['save-draft', 'review', 'publish', 'restore']) {
      await post({ action, expectedDraftRevision: 0, expectedPackageRevision: 1, branding: editable, sourcePackageRevision: 1 }, { cookie: viewer, status: 403 });
    }
    assert.equal((await call(path, { cookie: outsider })).status, 403);
    assert.equal((await call('branding?operator=draft-south', { cookie: admin })).status, 403);
    assert.equal((await call('branding?operator=draft-south', { cookie: admin, body: { action: 'save-draft', expectedDraftRevision: 0, expectedPackageRevision: 1, branding: editable } })).status, 403);
    assert.equal((await store.getCurrentPackage('draft-south')).revision, 1);
  });
  await check('draft save survives reload and real database restart without publishing', async () => {
    const before = await store.getCurrentPackage('draft-north');
    const saved = await post({ action: 'save-draft', ...versions(await get()), branding: editable }, { cookie: editor });
    assert.equal(saved.draft.revision, 1); assert.equal(saved.draft.basePackageRevision, 1);
    assert.equal(saved.draft.branding.dealer, 'vera'); assert.deepEqual(await store.getCurrentPackage('draft-north'), before);
    const expected = await snapshot(); await refreshPools();
    assert.deepEqual(await snapshot(), expected); assert.deepEqual((await get()).draft, saved.draft);
  });
  await check('two real editors with one draft revision preserve the winner and reject stale CAS', async () => {
    const state = await get(), before = await snapshot();
    const bodies = ['astrid', 'vera'].map(dealer => ({ action: 'save-draft', ...versions(state), branding: { ...editable, dealer } }));
    const responses = await Promise.all(bodies.map((body, index) => call(path, { cookie: index ? editor : admin, body })));
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
    const winner = await responses.find(response => response.status === 200).json();
    assert.equal(winner.draft.revision, state.draft.revision + 1);
    assert.deepEqual((await get()).draft, winner.draft); assert.deepEqual(await store.getCurrentPackage('draft-north'), before.package);
    assert.equal((await store.listAuditEvents('draft-north', { limit: 100 })).entries.length, before.journal.entries.length + 1);
    await post(bodies[0], { status: 409 }); assert.deepEqual((await get()).draft, winner.draft);
  });
  await check('invalid room overrides and unsupported appearance fields never persist', async () => {
    const before = await snapshot(), state = await get();
    for (const branding of [{ ...editable, logo: 'data:image/svg+xml,<svg onload="alert(1)"/>' }, { ...editable, chips: 'invented' },
      { ...editable, color: '#GGGGGG' }, { ...editable, color: '#000000' },
      { ...editable, roomOverrides: { 'draft-room-foreign': { color: '#112233' } } },
      { ...editable, roomOverrides: { 'draft-room-hidden': { color: '#112233' } } },
      { ...editable, roomOverrides: { 'missing-room': { color: '#112233' } } }]) {
      const response = await call(path, { cookie: admin, body: { action: 'save-draft', ...versions(state), branding } });
      assert.ok([400, 403, 409, 422].includes(response.status), `invalid appearance returned ${response.status}`);
      assert.deepEqual(await snapshot(), before);
    }
  });
  await check('review token is invalidated by a competing draft save without losing either published or saved data', async () => {
    const state = await get(), reviewed = await post({ action: 'review', ...versions(state) });
    assert.ok(reviewed.reviewToken); assert.ok(Array.isArray(reviewed.changes)); assert.ok(Array.isArray(reviewed.affectedRooms));
    const saved = await post({ action: 'save-draft', ...versions(state), branding: editable }, { cookie: editor });
    const before = await snapshot();
    await post({ action: 'publish', ...versions(saved), reviewToken: reviewed.reviewToken }, { status: 409 });
    assert.deepEqual(await snapshot(), before);
  });
  await check('publish checks privileges again under the real operator lock', async () => {
    const state = await get(), reviewed = await post({ action: 'review', ...versions(state) }, { cookie: editor });
    const before = await store.getCurrentPackage('draft-north'), savedDraft = await store.getBrandingDraft('draft-north');
    let intercepted = false;
    const wrapped = { query: (...args) => operatorPool.query(...args), async connect() {
      const client = await operatorPool.connect();
      return { release: () => client.release(), async query(sql, values) {
        if (!intercepted && typeof sql === 'string' && sql.includes('operator-store:lock-operator')) {
          intercepted = true;
          await store.upsertMembership({ actor: 'fixture', operatorId: 'draft-north', userId: '243', roleId: 'partner-viewer', status: 'active', expectedRevision: 1 });
        }
        return client.query(sql, values);
      } };
    } };
    await post({ action: 'publish', ...versions(state), reviewToken: reviewed.reviewToken }, { cookie: editor, status: 403, configuration: { ...config, pool: wrapped } });
    assert.equal(intercepted, true); assert.deepEqual(await store.getCurrentPackage('draft-north'), before);
    assert.deepEqual(await store.getBrandingDraft('draft-north'), savedDraft);
  });
  await check('a new Scout package blocks stale reviewed publication and preserves the existing draft', async () => {
    const state = await get(), reviewed = await post({ action: 'review', ...versions(state) });
    const current = await store.getCurrentPackage('draft-north');
    await store.publishPackage({ actor: 'fixture-n1', operatorId: 'draft-north', expectedRevision: current.revision,
      lanes: current.lanes, games: current.games, tables: current.tables, branding: current.branding });
    const before = await snapshot();
    await post({ action: 'publish', ...versions(state), reviewToken: reviewed.reviewToken }, { status: 409 });
    assert.deepEqual(await snapshot(), before); assert.equal((await get()).draft.basePackageRevision, 1);
    await post({ action: 'save-draft', ...versions(await get()), branding: editable });
  });
  await check('real SQL journal failure rolls back publication and draft marker atomically', async () => {
    const state = await get(), reviewed = await post({ action: 'review', ...versions(state) });
    const before = await snapshot();
    await operatorPool.query("ALTER TABLE croupier_studio.operator_audit_events ADD CONSTRAINT n2_branding_refuse_publish CHECK(environment_id <> 'isolated-n2-branding-qa' OR action <> 'package.publish') NOT VALID");
    try {
      await post({ action: 'publish', ...versions(state), reviewToken: reviewed.reviewToken }, { status: 422 });
      assert.deepEqual(await snapshot(), before);
    } finally { await operatorPool.query('ALTER TABLE croupier_studio.operator_audit_events DROP CONSTRAINT n2_branding_refuse_publish'); }
  });
  await check('failure writing append-only publication marker rolls back the package and its journal', async () => {
    const state = await get(), reviewed = await post({ action: 'review', ...versions(state) });
    const before = await snapshot();
    await operatorPool.query("ALTER TABLE croupier_studio.operator_branding_drafts ADD CONSTRAINT n2_branding_refuse_marker CHECK(environment_id <> 'isolated-n2-branding-qa' OR action <> 'draft.publish') NOT VALID");
    try {
      await post({ action: 'publish', ...versions(state), reviewToken: reviewed.reviewToken }, { status: 422 });
      assert.deepEqual(await snapshot(), before);
    } finally { await operatorPool.query('ALTER TABLE croupier_studio.operator_branding_drafts DROP CONSTRAINT n2_branding_refuse_marker'); }
  });
  await check('reviewed publication advances once and retains the frozen Scout geometry and history', async () => {
    const state = await get(), reviewed = await post({ action: 'review', ...versions(state) });
    const before = await store.getCurrentPackage('draft-north');
    const body = { action: 'publish', ...versions(state), reviewToken: reviewed.reviewToken };
    const published = await post(body);
    assert.equal(published.packageRevision, before.revision + 1); assert.equal(published.draft, null);
    const current = await store.getCurrentPackage('draft-north');
    assert.deepEqual(readPackagePresentation(current), readPackagePresentation(before));
    assert.deepEqual(current.tables, before.tables); assert.deepEqual(current.lanes, before.lanes);
    assert.equal(current.branding.dealer, 'vera'); assert.equal(current.branding.color, '#445566');
    assert.ok(published.history.some(row => row.revision === before.revision));
    const expected = await snapshot(); await post(body, { status: 409 }); assert.deepEqual(await snapshot(), expected);
  });
  await check('restoring old branding creates a persisted draft and never rewrites live history', async () => {
    const state = await get(), before = await store.getCurrentPackage('draft-north');
    const restored = await post({ action: 'restore', ...versions(state), sourcePackageRevision: 1 });
    assert.equal(restored.draft.sourcePackageRevision, 1); assert.equal(restored.draft.basePackageRevision, before.revision);
    assert.equal(restored.draft.branding.dealer, 'astrid'); assert.equal(restored.draft.branding.color, '#112233');
    assert.deepEqual(await store.getCurrentPackage('draft-north'), before);
    const expected = await snapshot(); await refreshPools(); assert.deepEqual(await snapshot(), expected);
    assert.deepEqual((await get()).draft, restored.draft); assert.equal((await store.getCurrentPackage('draft-south')).revision, 1);
  });
  await check('saved room overrides publish to only their own rooms and reset restores lane defaults', async () => {
    const select = createGameEntrySelector({
      policy: { readGameConfiguration() {}, readSaved: async () => ({ project: { lanes: [], dealers: [] }, administration: fixture.administration }) },
      packages: { resolve: async slug => { const operator = await store.getOperatorBySlug(slug); return operator ? { operator, package: await store.getCurrentPackage(operator.id) } : null; } },
      log: () => {},
    });
    const entry = async roomId => { const result = await select(new URLSearchParams({ operator: 'draft-north', table: roomId })); assert.equal(result.status, 200); return result.selection; };
    const rendered = selected => resolvePlayerSelection({ choices: selected.choices, branding: selected.branding, currentDealer: selected.dealer, composition: selected.composition });
    const roomBranding = { ...editable, roomOverrides: {
      'draft-room-first': { color: '#112233', dealer: 'astrid' },
      'draft-room-vip': { color: '#445566', dealer: 'vera' },
    } };
    const saved = await post({ action: 'save-draft', ...versions(await get()), branding: roomBranding });
    const review = await post({ action: 'review', ...versions(saved) });
    assert.ok(review.affectedRooms.includes('draft-room-first')); assert.ok(review.affectedRooms.includes('draft-room-vip'));
    const published = await post({ action: 'publish', ...versions(saved), reviewToken: review.reviewToken });
    const first = await entry('draft-room-first'), vip = await entry('draft-room-vip');
    assert.equal(first.packageRevision, published.packageRevision); assert.equal(rendered(first).tableColor, '#112233');
    assert.equal(rendered(first).dealer, 'astrid'); assert.equal(rendered(vip).tableColor, '#445566'); assert.equal(rendered(vip).dealer, 'vera');
    assert.equal((await select(new URLSearchParams({ operator: 'draft-north', table: 'draft-room-foreign' }))).status, 404);
    assert.equal((await select(new URLSearchParams({ operator: 'draft-north', table: 'draft-room-hidden' }))).status, 404);

    // Drive the actual client boundary and actual revision API against the SQL-backed selector.
    // No refresh occurs during the active round; a fresh revision is read only before the next.
    let idle = false, reads = 0; const refreshes = [];
    const api = createOperatorAppearanceApi({ selectGameEntry: select });
    const boundary = createOperatorAppearanceBoundary({ entry: first, isIdle: () => idle,
      request: async url => { reads++; return api(new Request(origin + url)); }, refresh: revision => refreshes.push(revision) });
    const reset = await post({ action: 'save-draft', ...versions(await get()), branding: editable });
    const resetReview = await post({ action: 'review', ...versions(reset) });
    const resetPublished = await post({ action: 'publish', ...versions(reset), reviewToken: resetReview.reviewToken });
    assert.equal(await boundary.beforeRound(), false); assert.equal(reads, 0); assert.deepEqual(refreshes, []);
    assert.equal(rendered(first).tableColor, '#112233', 'ongoing round retains its captured appearance');
    idle = true;
    assert.equal(await boundary.beforeRound(), false); assert.equal(reads, 1); assert.deepEqual(refreshes, [resetPublished.packageRevision]);
    assert.equal(await boundary.beforeRound(), false); assert.equal(reads, 1, 'refresh blocks repeated round starts');
    const next = await entry('draft-room-first'); assert.equal(rendered(next).tableColor, '#445566'); assert.equal(rendered(next).dealer, 'vera');
    const nextVip = await entry('draft-room-vip'); assert.equal(nextVip.branding.color, undefined, 'another lane inherits its frozen defaults');
    assert.equal(nextVip.branding.roomOverrides, undefined, 'runtime receives only selected-room effective values');
  });
  await check('failed SQL draft append preserves the prior saved draft and durable journal', async () => {
    const saved = await post({ action: 'save-draft', ...versions(await get()), branding: editable });
    const before = await snapshot();
    await operatorPool.query("ALTER TABLE croupier_studio.operator_branding_drafts ADD CONSTRAINT n2_branding_refuse_save CHECK(environment_id <> 'isolated-n2-branding-qa' OR action <> 'draft.save') NOT VALID");
    try {
      await post({ action: 'save-draft', ...versions(saved), branding: { ...editable, color: '#112233' } }, { status: 422 });
      assert.deepEqual(await snapshot(), before);
    } finally { await operatorPool.query('ALTER TABLE croupier_studio.operator_branding_drafts DROP CONSTRAINT n2_branding_refuse_save'); }
  });

  await check('real repeatable-read context preserves branding history but never restores replaced N1 media', async () => {
    const administration = { ...structuredClone(fixture.administration), tiers: { classic: 'vera', high: 'astrid', vip: 'amira' },
      pitboss: { payout10x: true, streak5: true, randomWalkMin: 45 }, tournaments: [] };
    await operatorPool.query('INSERT INTO croupier_studio.documents(environment_id,workspace_id,kind,revision,value) VALUES($1,$2,$3,$4,$5)',
      [scope.environment, scope.workspaceId, 'administration', 'qa-frozen-context-1', JSON.stringify(administration)]);
    const reader = createFrozenDealerContextReader({ pool: operatorPool, scope });
    const current = await store.getCurrentPackage('draft-north'), historical = current.revision - 1;
    assert.equal((await reader('draft-north', historical)).package.revision, historical);
    administration.rooms[0].state = 'preview';
    await operatorPool.query('UPDATE croupier_studio.documents SET revision=$3,value=$4 WHERE environment_id=$1 AND workspace_id=$2 AND kind=\'administration\'',
      [scope.environment, scope.workspaceId, 'qa-frozen-context-2', JSON.stringify(administration)]);
    assert.equal((await reader('draft-north', historical)).administration.rooms[0].state, 'preview', 'current room withdrawal is never replaced by historical administration');
    const changed = await store.publishPackage({ actor: 'fixture-n1', operatorId: 'draft-north', expectedRevision: current.revision,
      lanes: current.lanes, games: current.games, tables: current.tables,
      branding: withPackagePresentation(current.branding, { ...fixture.presentation, projectRevision: 'replacement-N1-media' }) });
    const deniedHistorical = await reader('draft-north', historical);
    assert.equal(deniedHistorical.package.revision, changed.revision, 'stale N1 media is not substituted for the current package');
    assert.notEqual(deniedHistorical.package.revision, historical);
    assert.equal((await reader('draft-south', historical)).operator.id, 'draft-south');
  });

  async function largeOperatorFixture(operatorId, { oversized = false } = {}) {
    const lane = structuredClone(fixture.lanes[0]);
    lane.layers.table.allowed = [fixture.assets[0].id];
    lane.layers.background.allowed = [fixture.assets[2].id];
    const presentation = { ...fixture.presentation, lanes: [lane], assets: [fixture.assets[0], fixture.assets[2]] };
    const tables = Array.from({ length: 28 }, (_, i) => 'room-' + String(i).padStart(2, '0') + 'x'.repeat(50));
    const branding = { lane: lane.id, color: '#445566', roomOverrides: Object.fromEntries(tables.map(id => [id,
      { table: fixture.assets[0].id, background: fixture.assets[2].id, dealer: 'astrid', color: '#445566' }])) };
    const initial = withPackagePresentation({ lane: lane.id, color: '#112233' }, presentation);
    if (oversized) initial.n1Note = 'x'.repeat(6500 - Buffer.byteLength(canonicalStudioJson(initial)));
    assert.ok(Buffer.byteLength(canonicalStudioJson(branding)) > 5000);
    assert.ok(Buffer.byteLength(canonicalStudioJson(initial)) < 8000);
    assert.equal(Buffer.byteLength(canonicalStudioJson({ ...initial, ...branding })) > 8000, oversized);
    await store.createOperator({ actor: 'fixture', operatorId, slug: operatorId, name: operatorId });
    const role = STANDARD_OPERATOR_ROLES.find(row => row.id === 'partner-admin');
    await store.upsertRole({ actor: 'fixture', operatorId, roleId: role.id, label: role.label, permissions: [...role.permissions], delegable: role.delegable });
    await store.upsertMembership({ actor: 'fixture', operatorId, userId: '242', roleId: role.id, status: 'active' });
    await store.publishPackage({ actor: 'fixture', operatorId, lanes: [lane.id], games: ['blackjack'], tables, branding: initial });
    const configuration = () => ({ ...config, readAdministration: async () => ({ revision: 'qa-large-rooms-1', value: {
      ...fixture.administration, rooms: tables.map(id => ({ schemaVersion: 2, id, name: id, operatorId,
        presentationLaneId: lane.id, gameLaneId: 'indexed', state: 'live' })),
    } }) });
    const command = async (body, status = 200) => {
      const response = await call(`branding?operator=${operatorId}`, { cookie: admin, ...(body ? { body } : {}) }, configuration());
      const result = await response.json(); assert.equal(response.status, status, JSON.stringify(result)); return result;
    };
    const snapshot = async () => ({ package: await store.getCurrentPackage(operatorId), draft: await store.getBrandingDraft(operatorId),
      journal: await store.listAuditEvents(operatorId, { limit: 100 }) });
    return { operatorId, lane, branding, tables, command, snapshot };
  }
  await check('28-room drafts publish with verifiable bounded SQL audit, atomic rollback and restart persistence', async () => {
    const f = await largeOperatorFixture('draft-large');
    let state = await f.command({ action: 'save-draft', ...versions(await f.command()), branding: f.branding });
    const changed = structuredClone(f.branding); changed.roomOverrides[f.tables[0]].color = '#112233';
    state = await f.command({ action: 'save-draft', ...versions(state), branding: changed });
    assert.equal(state.draft.revision, 2); assert.deepEqual(state.draft.branding, changed);
    const review = await f.command({ action: 'review', ...versions(state) });
    assert.equal(review.affectedRooms.length, 28);
    const body = { action: 'publish', ...versions(state), reviewToken: review.reviewToken }, before = await f.snapshot();
    await operatorPool.query("ALTER TABLE croupier_studio.operator_branding_drafts ADD CONSTRAINT n2_large_refuse_marker CHECK(operator_id <> 'draft-large' OR action <> 'draft.publish') NOT VALID");
    try { await f.command(body, 422); assert.deepEqual(await f.snapshot(), before); }
    finally { await operatorPool.query('ALTER TABLE croupier_studio.operator_branding_drafts DROP CONSTRAINT n2_large_refuse_marker'); }
    const published = await f.command(body);
    assert.equal(published.packageRevision, 2); assert.equal(published.draftRevision, 3); assert.equal(published.draft, null);
    assert.deepEqual(publicEditableBranding((await store.getCurrentPackage(f.operatorId)).branding), changed);
    const journal = await store.listAuditEvents(f.operatorId), digest = value => createHash('sha256').update(canonicalStudioJson(value)).digest('hex');
    const update = journal.entries.find(row => row.action === 'draft.save' && row.afterRevision === 2);
    assert.equal(update.changes.before.draftRevision, 1); assert.equal(update.changes.before.brandingSha256, digest(f.branding));
    assert.equal(update.changes.after.draftRevision, 2); assert.equal(update.changes.after.brandingSha256, digest(changed));
    assert.equal(Object.hasOwn(update.changes.after, 'branding'), false);
    const publication = journal.entries.find(row => row.action === 'draft.publish');
    assert.equal(publication.changes.before.draftRevision, 2); assert.equal(publication.changes.after.draftRevision, 3);
    assert.equal(publication.changes.after.basePackageRevision, 1); assert.equal(publication.changes.after.publishedPackageRevision, 2);
    assert.equal(publication.changes.after.brandingSha256, digest(changed));
    const rows = (await operatorPool.query('SELECT draft_revision,branding,changes FROM croupier_studio.operator_branding_drafts WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 ORDER BY draft_revision',
      [scope.environment, scope.workspaceId, f.operatorId])).rows;
    assert.deepEqual(rows.map(row => row.draft_revision), ['1', '2', '3']);
    assert.deepEqual(rows.map(row => JSON.parse(row.branding)), [f.branding, changed, changed]);
    assert.ok(rows.every(row => Buffer.byteLength(row.changes) <= 10000));
    assert.deepEqual(JSON.parse(rows[0].changes).after.branding, f.branding);
    const expected = await f.snapshot(); await refreshPools(); assert.deepEqual(await f.snapshot(), expected);
    assert.equal((await f.command()).packageRevision, 2);
  });
  await check('oversized merged frozen package is refused before SQL mutation at save, review and publish', async () => {
    const f = await largeOperatorFixture('draft-oversized', { oversized: true });
    let state = await f.command({ action: 'save-draft', ...versions(await f.command()), branding: { lane: f.lane.id, color: '#445566' } });
    const before = await f.snapshot();
    await f.command({ action: 'save-draft', ...versions(state), branding: f.branding }, 413);
    assert.deepEqual(await f.snapshot(), before);
    // Simulate an already saved pre-fix draft, using only the isolated fixture scope.
    await store.saveBrandingDraft({ operatorId: f.operatorId, actor: 'fixture', ...versions(state), branding: f.branding });
    state = await f.command(); const legacy = await f.snapshot();
    for (const action of ['review', 'publish']) {
      await f.command({ action, ...versions(state), ...(action === 'publish' ? { reviewToken: 'unused' } : {}) }, 413);
      assert.deepEqual(await f.snapshot(), legacy);
    }
  });
  return { checks, operatorPool, authPool };
}

const configuration = process.env.CROUPIER_PARTNER_BRANDING_POSTGRES_QA_CONFIG;
if (process.env.NODE_TEST_CONTEXT || configuration) test('real isolated PostgreSQL verifies N2 appearance drafts, reviewed publication and restore',
  { skip: configuration ? false : 'isolated PostgreSQL branding fixture is not configured' }, async () => {
    const config = JSON.parse(await readFile(configuration, 'utf8'));
    const { Pool } = createRequire(new URL('../web/package.json', import.meta.url))('pg');
    const pools = ['operators', 'auth'].map(kind => {
      const url = new URL(config[`${kind}DatabaseUrl`]);
      assert.ok(['postgres:', 'postgresql:'].includes(url.protocol)); assert.equal(url.search, ''); assert.equal(url.hash, '');
      assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.username, 'studio_qa'); assert.equal(url.password, ''); assert.equal(url.pathname, `/n2_qa_${kind}`);
      return new Pool({ connectionString: url.href, max: 4, connectionTimeoutMillis: 5000, query_timeout: 15000 });
    });
    try {
      const { runPartnerTeamPostgresChecks } = await import('./partner-team-postgres.mjs');
      await runPartnerTeamPostgresChecks({ operatorPool: pools[0], authPool: pools[1] });
      await runPartnerBrandingPostgresChecks({ operatorPool: pools[0], authPool: pools[1] });
    } finally { await Promise.all(pools.map(pool => pool.end())); }
  });
