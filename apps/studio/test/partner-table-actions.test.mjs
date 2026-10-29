// Partner-API:ts åtgärder för egna spelbord (ADMIN-FORENKLING 5.5) mot riktig
// PostgreSQL-SQL (PGlite): byta dealer inom tilldelningen, spelinställningar och
// pausa/öppna. Varje åtgärd provas för rätt roll, fel roll (403), annat bolag
// (403/404 utan läckage), ett val utanför tilldelningen (422) och CAS (409).
// PGlite är en enda session: låskonkurrens mellan sessioner provas inte här.
import test from 'node:test';
import assert from 'node:assert/strict';
import { partnerPostgresFixture } from './fixtures/partner-postgres.mjs';
import { PARTNER_ASSIGNMENT_KEY } from '../lib/partner-assignment.mjs';
import { NATIVE_FILMED_PLANNING_MUTATION } from '../lib/presentation-runtime-readiness.mjs';
import { listPackageRooms } from '../../../packages/presentation/server/package-rooms.mjs';

test('partner table actions on PostgreSQL', async t => {
  const f = await partnerPostgresFixture(t);
  const pack = () => f.direct.getCurrentPackage('north');
  // Admins tilldelning: en ny paketrevision med `assignment` i brandingen.
  const grant = async assignment => {
    const current = await pack();
    const branding = { ...current.branding, [PARTNER_ASSIGNMENT_KEY]: assignment };
    // Efter en publicerad spelinställning kräver paketet den nativa grinden, som Admins publicering.
    return f.repository.withMutationContext(() => f.direct.publishPackage({ actor: 'fixture', operatorId: 'north', expectedRevision: current.revision,
      lanes: current.lanes, games: current.games, tables: current.tables, branding }), [NATIVE_FILMED_PLANNING_MUTATION]);
  };
  const status = async (promise, expected, message) => {
    const response = await promise;
    const body = await response.json();
    assert.equal(response.status, expected, `${message}: ${JSON.stringify(body)}`);
    return body;
  };
  const room = name => f.id(name);
  const assignment = async (user = 'north-admin') => (await f.call('assignment', { user })).json();

  await t.test('dealer: a choice inside the assignment is saved in the appearance draft', async () => {
    const before = await assignment();
    const body = { roomId: room('north-a'), dealer: 'paow', expectedDraftRevision: before.revisions.brandingDraft, expectedPackageRevision: before.revisions.package };
    await status(f.call('dealer', { user: 'north-viewer', body }), 403, 'a viewer has no presentations.configure');
    await status(f.call('dealer', { user: 'south-admin', body }), 403, 'another company');
    const saved = await status(f.call('dealer', { body }), 200, 'administrator');
    assert.equal(saved.draft.branding.roomOverrides[room('north-a')].dealer, 'paow');
    assert.equal((await pack()).revision, before.revisions.package, 'the draft publishes nothing');
    await status(f.call('dealer', { body }), 409, 'a stale draft revision');
    const after = await assignment();
    assert.equal(after.revisions.brandingDraft, before.revisions.brandingDraft + 1);
    const next = { ...body, expectedDraftRevision: after.revisions.brandingDraft };
    await status(f.call('dealer', { body: { ...next, dealer: 'ghost' } }), 422, 'a dealer outside the assignment, sent directly');
    await status(f.call('dealer', { body: { ...next, roomId: room('south') } }), 422, 'another company\'s table is not in the assignment');
    await status(f.call('dealer', { body: { ...next, expectedPackageRevision: next.expectedPackageRevision + 1 } }), 409, 'a stale package revision');
    await status(f.call('dealer', { body: { ...next, extra: true } }), 400, 'an unknown field');
  });

  await t.test('dealer: allow.dealer=false closes the action even for an administrator', async () => {
    const granted = await grant({ allow: { dealer: false } });
    const current = await assignment();
    assert.equal(current.assignment.allow.dealer, false);
    await status(f.call('dealer', { body: { roomId: room('north-a'), dealer: 'dragan', expectedDraftRevision: current.revisions.brandingDraft,
      expectedPackageRevision: granted.revision } }), 403, 'allow.dealer');
  });

  let draftRevision = null;
  await t.test('settings: closed until Admin grants language or limit; then only the assigned profiles', async () => {
    const closed = { action: 'save-draft', roomId: room('north-a'), expectedPackageRevision: (await pack()).revision, expectedDraftRevision: null,
      gameConfig: { language: 'sv', limitPreset: 'prive' } };
    await status(f.call('room-settings', { body: closed }), 403, 'no allow.language or allow.limit');
    const granted = await grant({ allow: { language: true, limit: true, pause: true }, limitPresets: ['casual', 'prive'] });
    const body = { ...closed, expectedPackageRevision: granted.revision };
    await status(f.call('room-settings', { user: 'north-editor', body }), 403, 'an editor has no tables.configure');
    await status(f.call('room-settings', { user: 'south-admin', body }), 403, 'another company');
    await status(f.call('room-settings', { body: { ...body, roomId: room('south') } }), 404, 'another company\'s table');
    await status(f.call('room-settings', { body: { ...body, gameConfig: { language: 'sv', limitPreset: 'high' } } }), 422, 'a profile outside the assignment');
    await status(f.call('room-settings', { body: { ...body, gameConfig: { language: 'de', limitPreset: 'prive' } } }), 422, 'an unknown language');
    const saved = await status(f.call('room-settings', { body }), 200, 'administrator');
    assert.equal(saved.administrationRevision, undefined, 'the shared administration revision stays internal');
    assert.deepEqual(saved.draft.gameConfig, { language: 'sv', limitPreset: 'prive' });
    draftRevision = saved.draft.revision;
    await status(f.call('room-settings', { body }), 409, 'a stale draft revision');
    const read = await assignment();
    assert.equal(read.rooms.find(row => row.id === room('north-a')).settings.draft.revision, draftRevision);
  });

  await t.test('settings: the draft is published through the shared J08 writer', async () => {
    const before = await pack();
    const body = { action: 'publish', roomId: room('north-a'), expectedPackageRevision: before.revision, expectedDraftRevision: draftRevision };
    await status(f.call('room-settings', { user: 'north-viewer', body }), 403, 'a viewer');
    const published = await status(f.call('room-settings', { body }), 200, 'administrator');
    assert.deepEqual(published.published.gameConfig, { language: 'sv', limitPreset: 'prive' });
    assert.equal(published.draft, null);
    const after = await pack();
    assert.equal(after.revision, before.revision + 1);
    assert.equal(typeof after.branding.roomGameConfigVersions[room('north-a')], 'string');
    assert.equal(after.branding.roomGameConfigVersions[room('south')], undefined);
    await status(f.call('room-settings', { body: { ...body, expectedPackageRevision: after.revision } }), 409, 'no draft left to publish');
  });

  await t.test('settings: a field without its allow is refused, the other may change', async () => {
    const granted = await grant({ allow: { limit: true, pause: true }, limitPresets: ['casual', 'prive'] });
    const body = { action: 'save-draft', roomId: room('north-a'), expectedPackageRevision: granted.revision, expectedDraftRevision: null };
    await status(f.call('room-settings', { body: { ...body, gameConfig: { language: 'en', limitPreset: 'prive' } } }), 422, 'language without allow.language');
    await status(f.call('room-settings', { body: { ...body, gameConfig: { language: 'sv', limitPreset: 'casual' } } }), 200, 'limit with allow.limit');
  });

  const lobby = async () => {
    const administration = (await f.raw.readDocument('administration')).value;
    return listPackageRooms({ administration, package: await pack(), operatorId: 'north' }).filter(row => row.state === 'live').map(row => row.id).sort();
  };
  await t.test('state: pausing removes the table from the lobby catalogue; reopening needs published settings', async () => {
    const revision = (await pack()).revision;
    const pause = { roomId: room('north-a'), state: 'pending', expectedState: 'live', expectedPackageRevision: revision };
    assert.deepEqual(await lobby(), [room('north-a'), room('north-b')]);
    await status(f.call('room-state', { user: 'north-editor', body: pause }), 403, 'an editor');
    await status(f.call('room-state', { user: 'south-admin', body: pause }), 403, 'another company');
    await status(f.call('room-state', { body: { ...pause, roomId: room('south') } }), 404, 'another company\'s table');
    const paused = await status(f.call('room-state', { body: pause }), 200, 'administrator');
    assert.deepEqual(paused.room, { id: room('north-a'), state: 'pending' });
    assert.deepEqual(await lobby(), [room('north-b')], 'the paused table leaves the lobby catalogue');
    await status(f.call('room-state', { body: pause }), 409, 'the table is no longer live (CAS)');
    await status(f.call('room-state', { body: { ...pause, state: 'live', expectedState: 'live' } }), 400, 'no change');
    await status(f.call('room-state', { body: { ...pause, state: 'live', expectedState: 'pending' } }), 200, 'reopen');
    assert.deepEqual(await lobby(), [room('north-a'), room('north-b')]);
    const other = { roomId: room('north-b'), state: 'pending', expectedState: 'live', expectedPackageRevision: revision };
    await status(f.call('room-state', { body: other }), 200, 'pause a table without published settings');
    await status(f.call('room-state', { body: { ...other, state: 'live', expectedState: 'pending' } }), 409, 'never released by Admin');
    const south = (await f.raw.readDocument('administration')).value.rooms.find(row => row.id === room('south'));
    assert.equal(south.state, 'live', 'the other company\'s table is untouched');
  });

  await t.test('state: allow.pause=false closes the action', async () => {
    const granted = await grant({ allow: { limit: true } });
    await status(f.call('room-state', { body: { roomId: room('north-a'), state: 'pending', expectedState: 'live', expectedPackageRevision: granted.revision } }), 403, 'allow.pause');
  });
});
