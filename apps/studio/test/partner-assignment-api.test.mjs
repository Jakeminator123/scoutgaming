// Läsa tilldelningen i partner-API:t (ADMIN-FORENKLING 5.5, första raden) mot
// riktig PostgreSQL-SQL (PGlite): rätt roll läser hela paketet, en roll utan
// presentations.read nekas, ett annat bolag nekas utan läckage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { partnerPostgresFixture } from './fixtures/partner-postgres.mjs';
import { partnerAllow, partnerAssignmentDetail, PARTNER_ASSIGNMENT_KEY } from '../lib/partner-assignment.mjs';
import { readPackagePresentation } from '../../../packages/presentation/server/presentation-package.mjs';

test('allow narrows the frozen composition and opens settings and pause only when Admin grants them', () => {
  const lane = { composition: null, operatorAdjustable: ['dealer', 'table.color'], layers: { background: { enabled: false }, table: { enabled: false }, dealer: { enabled: true, allowed: ['a'] } } };
  const presentation = { lanes: [lane] };
  assert.deepEqual(partnerAllow({ branding: {} }, presentation), { dealer: true, tableAsset: false, background: false, language: false, limit: false, pause: false });
  // allow kan inte vidga mallen: bordsgrafik saknas i operatorAdjustable och förblir stängd.
  const granted = { branding: { [PARTNER_ASSIGNMENT_KEY]: { allow: { dealer: false, tableAsset: true, language: true, limit: true, pause: 'yes' } } } };
  assert.deepEqual(partnerAllow(granted, presentation), { dealer: false, tableAsset: false, background: false, language: true, limit: true, pause: false });
  const detail = partnerAssignmentDetail({ games: ['blackjack'], branding: { [PARTNER_ASSIGNMENT_KEY]: { limitPresets: ['high', 'unknown', 'casual'], languages: ['sv', 'xx'] } } }, presentation);
  assert.deepEqual([detail.limitPresets, detail.languages], [['high', 'casual'], ['sv']]);
  assert.deepEqual(partnerAssignmentDetail({ branding: {} }, null).languages, ['en', 'sv']);
});

test('the assignment read on PostgreSQL follows role and company', async t => {
  const f = await partnerPostgresFixture(t);
  const pack = await f.direct.getCurrentPackage('north');

  await t.test('a partner administrator reads the whole package, its revisions and the own tables', async () => {
    const response = await f.call('assignment');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const body = await response.json();
    assert.equal(body.operator.slug, 'north');
    assert.deepEqual(body.revisions, { package: pack.revision, brandingDraft: 0 });
    assert.deepEqual(body.assignment.games, pack.games);
    assert.deepEqual(body.assignment.dealers.map(row => row.id).sort(), ['dragan', 'paow']);
    assert.deepEqual(body.assignment.lanes.map(row => row.id), [f.lane.id]);
    assert.deepEqual(body.assignment.allow, partnerAllow(pack, readPackagePresentation(pack)));
    assert.equal(body.assignment.allow.dealer, true);
    assert.equal(body.assignment.allow.pause, false);
    assert.deepEqual(body.canConfigure, { presentations: true, tables: true });
    assert.deepEqual(body.rooms.map(room => room.id).sort(), [f.id('north-a'), f.id('north-b')]);
    assert.ok(body.rooms.every(room => room.state === 'live' && room.settings.draft === null));
    assert.equal(JSON.stringify(body).includes(f.id('south')), false, 'another company\'s table never appears');
  });

  await t.test('an editor reads without tables.configure; a viewer reads without any configure right', async () => {
    const editor = await (await f.call('assignment', { user: 'north-editor' })).json();
    assert.deepEqual(editor.canConfigure, { presentations: true, tables: false });
    assert.ok(Array.isArray(editor.rooms));
    const viewer = await (await f.call('assignment', { user: 'north-viewer' })).json();
    assert.deepEqual(viewer.canConfigure, { presentations: false, tables: false });
  });

  await t.test('published settings need tables.read; Admin\'s unpublished drafts need tables.configure and stay within the company', async () => {
    // Publicerade inställningar: paketets bindning och raden i shared_table_configs (samma form som J08 skriver).
    const version = 'fixture-config-v1';
    await f.pool.query('INSERT INTO croupier_game.shared_table_configs(room_id,version,body) VALUES($1,$2,$3)',
      [f.id('north-a'), version, JSON.stringify({ operatorId: 'north', roomId: f.id('north-a'), language: 'sv', limitPreset: 'high', packageRevision: pack.revision })]);
    const [row] = await f.rows('SELECT branding FROM croupier_studio.operator_packages WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3 AND package_revision=$4',
      [f.scope.environment, f.scope.workspaceId, 'north', pack.revision]);
    await f.pool.query('UPDATE croupier_studio.operator_packages SET branding=$1 WHERE environment_id=$2 AND workspace_id=$3 AND operator_id=$4 AND package_revision=$5',
      [JSON.stringify({ ...JSON.parse(row.branding), roomGameConfigVersions: { [f.id('north-a')]: version } }), f.scope.environment, f.scope.workspaceId, 'north', pack.revision]);
    // Admins sparade utkast för bolag A (north-b) och bolag B (south).
    const draft = (room, operatorId, limitPreset) => ({ roomId: f.id(room), operatorId, revision: `room-config-${randomUUID()}`,
      basePackageRevision: pack.revision, gameConfig: { language: 'en', limitPreset } });
    const saved = await f.raw.readDocument('administration');
    await f.raw.saveDocument('administration', { value: { ...saved.value, roomGameConfigs: [draft('north-b', 'north', 'prive'), draft('south', 'south', 'casual')] },
      expectedRevision: saved.revision, actor: 'fixture' });
    const read = async (user, operator = 'north') => (await f.call('assignment', { user, operator })).json();
    const admin = await read('north-admin');
    const roomA = admin.rooms.find(room => room.id === f.id('north-a')), roomB = admin.rooms.find(room => room.id === f.id('north-b'));
    assert.deepEqual(roomA.settings, { published: { language: 'sv', limitPreset: 'high' }, draft: null });
    assert.deepEqual(roomB.settings.draft?.gameConfig, { language: 'en', limitPreset: 'prive' });
    assert.equal(JSON.stringify(admin).includes(f.id('south')), false, 'company B\'s draft never appears');
    for (const user of ['north-editor', 'north-viewer']) {
      const body = await read(user);
      assert.deepEqual(body.rooms.find(room => room.id === f.id('north-a')).settings.published, { language: 'sv', limitPreset: 'high' }, user);
      assert.ok(body.rooms.every(room => room.settings.draft === null), `${user} sees no unpublished draft without tables.configure`);
      assert.equal(JSON.stringify(body).includes('prive'), false, user);
    }
    const south = await read('south-admin', 'south');
    assert.deepEqual(south.rooms.map(room => room.settings.draft?.gameConfig.limitPreset), ['casual']);
    assert.equal(JSON.stringify(south).includes(f.id('north-b')), false);
  });

  await t.test('a broken or stale draft of another company never fails this company\'s read', async () => {
    const saved = await f.raw.readDocument('administration');
    const rows = [
      // Bolag B:s rad är ogiltig, och en äldre rad bär fortfarande B som ägare av A:s spelbord.
      { roomId: f.id('south'), operatorId: 'south', revision: 'not-a-revision', basePackageRevision: 0, gameConfig: {} },
      { roomId: f.id('north-a'), operatorId: 'south', revision: `room-config-${randomUUID()}`, basePackageRevision: pack.revision, gameConfig: { language: 'en', limitPreset: 'casual' } },
      ...saved.value.roomGameConfigs.filter(row => row.operatorId === 'north'),
    ];
    f.config.readAdministration = async () => ({ ...saved.value, roomGameConfigs: rows });
    try {
      const response = await f.call('assignment');
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.deepEqual(body.rooms.map(room => [room.id, room.settings.draft?.gameConfig.limitPreset ?? null]).sort(),
        [[f.id('north-a'), null], [f.id('north-b'), 'prive']]);
      // Det egna bolagets trasiga rad fäller däremot den egna läsningen.
      assert.equal((await f.call('assignment', { user: 'south-admin', operator: 'south' })).status, 503);
    } finally { delete f.config.readAdministration; }
  });

  await t.test('a role without presentations.read is refused with 403', async () => {
    await f.direct.upsertRole({ actor: 'fixture', operatorId: 'north', roleId: 'partner-viewer', label: 'Partner viewer',
      permissions: ['overview.read', 'tables.read'], delegable: true });
    const response = await f.call('assignment', { user: 'north-viewer' });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'Access denied' });
  });

  await t.test('another company is refused without leaking its package', async () => {
    const response = await f.call('assignment', { user: 'south-admin', operator: 'north' });
    assert.equal(response.status, 403);
    const text = await response.text();
    assert.equal(text.includes('north-a') || text.includes('dragan'), false);
    assert.equal((await f.call('assignment', { operator: 'missing' })).status, 404);
  });

  await t.test('the read takes exactly one operator and only GET', async () => {
    // Läsningen är ingen skrivväg: en POST med bolagsparametern avvisas före all läsning.
    assert.equal((await f.call('assignment', { body: {} })).status, 400);
    assert.equal((await f.call('assignment', { method: 'PUT' })).status, 405);
    const unknown = await f.call('assignment', { operator: 'north&room=x' });
    assert.equal(unknown.status, 400);
  });
});
