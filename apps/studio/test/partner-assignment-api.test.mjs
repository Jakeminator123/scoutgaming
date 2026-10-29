// Läsa tilldelningen i partner-API:t (ADMIN-FORENKLING 5.5, första raden) mot
// riktig PostgreSQL-SQL (PGlite): rätt roll läser hela paketet, en roll utan
// presentations.read nekas, ett annat bolag nekas utan läckage.
import test from 'node:test';
import assert from 'node:assert/strict';
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
