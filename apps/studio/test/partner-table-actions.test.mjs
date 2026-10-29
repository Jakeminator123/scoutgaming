// Partner-API:ts åtgärder för egna spelbord (ADMIN-FORENKLING 5.5) mot riktig
// PostgreSQL-SQL (PGlite): byta dealer inom tilldelningen, spelinställningar och
// pausa/öppna. Varje åtgärd provas för rätt roll, fel roll (403), annat bolag
// (403/404 utan läckage), ett val utanför tilldelningen (422) och CAS (409).
// Varje nekat anrop jämför administrations-, paket- och utkastrevisionen och
// bolagets spelbordsjournal före och efter: inget ändrat.
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
  const journal = () => f.rows(`SELECT action, access_class, actor_id, resource_type, resource_id, changes FROM croupier_studio.operator_audit_events
    WHERE environment_id=$1 AND workspace_id=$2 AND operator_id='north' AND action LIKE 'room.%' ORDER BY occurred_at_ms, event_id`, [f.scope.environment, f.scope.workspaceId]);
  const revisions = async () => ({ administration: (await f.raw.readDocument('administration')).revision, package: (await pack()).revision,
    draft: (await f.direct.getBrandingDraft('north'))?.revision ?? 0, journal: (await journal()).length });
  // Ett nekat anrop ändrar ingenting: anropet görs först efter ögonblicksbilden.
  const refused = async (call, expected, message) => {
    const before = await revisions();
    const body = await status(call(), expected, message);
    assert.deepEqual(await revisions(), before, `${message}: inget ändrat`);
    return body;
  };
  // Admins egen skrivning av administrationsdokumentet (spelbordens läge), som Admins room-state.
  const adminState = async (id, state) => {
    const saved = await f.raw.readDocument('administration');
    await f.raw.saveDocument('administration', { value: { ...saved.value, rooms: saved.value.rooms.map(row => row.id === id ? { ...row, state } : row) },
      expectedRevision: saved.revision, actor: 'fixture-admin' });
  };

  await t.test('dealer: a choice inside the assignment is saved in the appearance draft', async () => {
    const before = await assignment();
    const body = { roomId: room('north-a'), dealer: 'paow', expectedDraftRevision: before.revisions.brandingDraft, expectedPackageRevision: before.revisions.package };
    await refused(() => f.call('dealer', { user: 'north-viewer', body }), 403, 'a viewer has no presentations.configure');
    await refused(() => f.call('dealer', { user: 'south-admin', body }), 403, 'another company');
    const saved = await status(f.call('dealer', { body }), 200, 'administrator');
    assert.equal(saved.draft.branding.roomOverrides[room('north-a')].dealer, 'paow');
    assert.equal((await pack()).revision, before.revisions.package, 'the draft publishes nothing');
    await refused(() => f.call('dealer', { body }), 409, 'a stale draft revision');
    const after = await assignment();
    assert.equal(after.revisions.brandingDraft, before.revisions.brandingDraft + 1);
    const next = { ...body, expectedDraftRevision: after.revisions.brandingDraft };
    await refused(() => f.call('dealer', { body: { ...next, dealer: 'ghost' } }), 422, 'a dealer outside the assignment, sent directly');
    await refused(() => f.call('dealer', { body: { ...next, roomId: room('south') } }), 422, 'another company\'s table is not in the assignment');
    await refused(() => f.call('dealer', { body: { ...next, expectedPackageRevision: next.expectedPackageRevision + 1 } }), 409, 'a stale package revision');
    await refused(() => f.call('dealer', { body: { ...next, extra: true } }), 400, 'an unknown field');
  });

  await t.test('dealer: allow.dealer=false closes the action even for an administrator', async () => {
    const granted = await grant({ allow: { dealer: false } });
    const current = await assignment();
    assert.equal(current.assignment.allow.dealer, false);
    await refused(() => f.call('dealer', { body: { roomId: room('north-a'), dealer: 'dragan', expectedDraftRevision: current.revisions.brandingDraft,
      expectedPackageRevision: granted.revision } }), 403, 'allow.dealer');
  });

  await t.test('dealer: allow.dealer=false also closes the appearance draft (branding save-draft), under the lock', async () => {
    const draftFor = async () => {
      const view = await (await f.call('branding')).json();
      const base = view.draft?.branding ?? view.branding;
      return { action: 'save-draft', expectedDraftRevision: view.draftRevision, expectedPackageRevision: (await pack()).revision,
        branding: { ...base, roomOverrides: { ...(base.roomOverrides ?? {}), [room('north-b')]: { dealer: 'paow' } } } };
    };
    await refused(async () => f.call('branding', { body: await draftFor() }), 422, 'roomOverrides.dealer without allow.dealer');
    // Samma utkast med Admins tilldelning utan dealerstopp sparas: det var allow som nekade.
    await grant({});
    const saved = await status(f.call('branding', { body: await draftFor() }), 200, 'roomOverrides.dealer with the dealer layer open');
    assert.equal(saved.draft.branding.roomOverrides[room('north-b')].dealer, 'paow');
  });

  let draftRevision = null;
  await t.test('settings: closed until Admin grants language or limit; then only the assigned profiles', async () => {
    const closed = { action: 'save-draft', roomId: room('north-a'), expectedPackageRevision: (await pack()).revision, expectedDraftRevision: null,
      gameConfig: { language: 'sv', limitPreset: 'prive' } };
    await refused(() => f.call('room-settings', { body: closed }), 403, 'no allow.language or allow.limit');
    const granted = await grant({ allow: { language: true, limit: true, pause: true }, limitPresets: ['casual', 'prive'] });
    const body = { ...closed, expectedPackageRevision: granted.revision };
    await refused(() => f.call('room-settings', { user: 'north-editor', body }), 403, 'an editor has no tables.configure');
    await refused(() => f.call('room-settings', { user: 'south-admin', body }), 403, 'another company');
    await refused(() => f.call('room-settings', { body: { ...body, roomId: room('south') } }), 404, 'another company\'s table');
    await refused(() => f.call('room-settings', { body: { ...body, gameConfig: { language: 'sv', limitPreset: 'high' } } }), 422, 'a profile outside the assignment');
    await refused(() => f.call('room-settings', { body: { ...body, gameConfig: { language: 'de', limitPreset: 'prive' } } }), 422, 'an unknown language');
    await refused(() => f.call('room-settings', { body: { ...body, expectedPackageRevision: body.expectedPackageRevision - 1 } }), 409, 'a stale package revision (CAS)');
    const saved = await status(f.call('room-settings', { body }), 200, 'administrator');
    assert.equal(saved.administrationRevision, undefined, 'the shared administration revision stays internal');
    assert.deepEqual(saved.draft.gameConfig, { language: 'sv', limitPreset: 'prive' });
    draftRevision = saved.draft.revision;
    // Utkastet står i bolagets journal med partnerns konto och accessClass.
    const entries = (await journal()).filter(row => row.action === 'room.settings' && JSON.parse(row.changes).after.draftRevision === draftRevision);
    assert.deepEqual(entries.map(entry => [entry.access_class, entry.actor_id, entry.resource_type, entry.resource_id]), [['partner', '42', 'package', room('north-a')]]);
    await refused(() => f.call('room-settings', { body }), 409, 'a stale draft revision');
    const read = await assignment();
    assert.equal(read.rooms.find(row => row.id === room('north-a')).settings.draft.revision, draftRevision);
  });

  await t.test('settings: the draft is published through the shared J08 writer', async () => {
    const before = await pack();
    const body = { action: 'publish', roomId: room('north-a'), expectedPackageRevision: before.revision, expectedDraftRevision: draftRevision };
    await refused(() => f.call('room-settings', { user: 'north-viewer', body }), 403, 'a viewer');
    const published = await status(f.call('room-settings', { body }), 200, 'administrator');
    assert.deepEqual(published.published.gameConfig, { language: 'sv', limitPreset: 'prive' });
    assert.equal(published.draft, null);
    const after = await pack();
    assert.equal(after.revision, before.revision + 1);
    assert.equal(typeof after.branding.roomGameConfigVersions[room('north-a')], 'string');
    assert.equal(after.branding.roomGameConfigVersions[room('south')], undefined);
    await refused(() => f.call('room-settings', { body: { ...body, expectedPackageRevision: after.revision } }), 409, 'no draft left to publish');
  });

  await t.test('settings: a field without its allow is refused, the other may change', async () => {
    const granted = await grant({ allow: { limit: true, pause: true }, limitPresets: ['casual', 'prive'] });
    const body = { action: 'save-draft', roomId: room('north-a'), expectedPackageRevision: granted.revision, expectedDraftRevision: null };
    await refused(() => f.call('room-settings', { body: { ...body, gameConfig: { language: 'en', limitPreset: 'prive' } } }), 422, 'language without allow.language');
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
    await refused(() => f.call('room-state', { user: 'north-editor', body: pause }), 403, 'an editor');
    await refused(() => f.call('room-state', { user: 'south-admin', body: pause }), 403, 'another company');
    await refused(() => f.call('room-state', { body: { ...pause, roomId: room('south') } }), 404, 'another company\'s table');
    await refused(() => f.call('room-state', { body: { ...pause, expectedPackageRevision: revision - 1 } }), 409, 'a stale package revision (CAS)');
    const paused = await status(f.call('room-state', { body: pause }), 200, 'administrator');
    assert.deepEqual(paused.room, { id: room('north-a'), state: 'pending' });
    assert.deepEqual(await lobby(), [room('north-b')], 'the paused table leaves the lobby catalogue');
    // Pausen står i bolagets journal med partnerns konto och accessClass.
    const states = async () => (await journal()).filter(row => row.action === 'room.state');
    const [entry] = await states();
    assert.deepEqual([entry.access_class, entry.actor_id, entry.resource_type, entry.resource_id], ['partner', '42', 'package', room('north-a')]);
    assert.deepEqual(JSON.parse(entry.changes), { before: { state: 'live' }, after: { state: 'pending', administrationRevision: (await f.raw.readDocument('administration')).revision } });
    await refused(() => f.call('room-state', { body: pause }), 409, 'the table is no longer live (CAS)');
    await refused(() => f.call('room-state', { body: { ...pause, state: 'live', expectedState: 'live' } }), 400, 'no change');
    await refused(() => f.call('room-state', { body: { ...pause, state: 'live', expectedState: 'pending', expectedPackageRevision: revision - 1 } }), 409, 'reopen with a stale package revision (CAS)');
    await status(f.call('room-state', { body: { ...pause, state: 'live', expectedState: 'pending' } }), 200, 'reopen');
    assert.deepEqual(await lobby(), [room('north-a'), room('north-b')]);
    const opened = (await states()).map(row => JSON.parse(row.changes)).find(changes => changes.after.state === 'live');
    assert.deepEqual(opened, { before: { state: 'pending' }, after: { state: 'live', administrationRevision: (await f.raw.readDocument('administration')).revision } });
    // Partnerns journal visar händelserna men aldrig Scoutgamings administrationsrevision.
    const read = await status(f.call('journal'), 200, 'the partner journal');
    const shown = read.entries.filter(entry => entry.action === 'room.state');
    // Samma klocka i fixturen: ordningen mellan raderna avgörs av event_id, så jämför utan ordning.
    assert.deepEqual(shown.map(({ changes }) => `${JSON.stringify(changes.before)}>${JSON.stringify(changes.after)}`).sort(),
      ['{"state":"live"}>{"state":"pending"}', '{"state":"pending"}>{"state":"live"}']);
    assert.ok(shown.every(({ changes }) => Object.keys(changes).sort().join() === 'after,before'));
    assert.ok(read.entries.some(entry => entry.action === 'room.settings'), 'the settings draft is listed too');
    assert.doesNotMatch(JSON.stringify(read), /administrationRevision/, 'the administration revision never reaches the partner');
    const other = { roomId: room('north-b'), state: 'pending', expectedState: 'live', expectedPackageRevision: revision };
    await status(f.call('room-state', { body: other }), 200, 'pause a table without published settings');
    await refused(() => f.call('room-state', { body: { ...other, state: 'live', expectedState: 'pending' } }), 409, 'never released by Admin');
    const south = (await f.raw.readDocument('administration')).value.rooms.find(row => row.id === room('south'));
    assert.equal(south.state, 'live', 'the other company\'s table is untouched');
  });

  await t.test('state: the partner never lifts a pause Admin set, only its own', async () => {
    const revision = (await pack()).revision;
    const open = { roomId: room('north-a'), state: 'live', expectedState: 'pending', expectedPackageRevision: revision };
    const pause = { ...open, state: 'pending', expectedState: 'live' };
    // Admin pausar: partnern får 409 admin-pause och ingenting ändras.
    await adminState(room('north-a'), 'pending');
    const refusedBody = await refused(() => f.call('room-state', { body: open }), 409, 'an Admin pause');
    assert.equal(refusedBody.reason, 'admin-pause');
    // Partnern pausar, Admin öppnar och pausar igen: pausen är nu Admins.
    await adminState(room('north-a'), 'live');
    await status(f.call('room-state', { body: pause }), 200, 'partner pause');
    await adminState(room('north-a'), 'live');
    await adminState(room('north-a'), 'pending');
    assert.equal((await refused(() => f.call('room-state', { body: open }), 409, 'Admin re-paused after the partner pause')).reason, 'admin-pause');
    // Admin (N1) pausar genom portalens väg: journalraden är internal-admin, inte
    // partner, så bolaget kan inte häva den (listPartnerRoomPauses, access_class='partner').
    await adminState(room('north-a'), 'live');
    const n1 = await status(f.call('room-state', { user: 'n1-admin', body: pause }), 200, 'N1 pause through the portal route');
    assert.deepEqual(n1.room, { id: room('north-a'), state: 'pending' });
    const internal = (await journal()).filter(row => row.action === 'room.state' && row.access_class !== 'partner');
    assert.deepEqual(internal.map(row => [row.access_class, row.actor_id, JSON.parse(row.changes).after.state]), [['internal-admin', '7', 'pending']]);
    assert.equal((await refused(() => f.call('room-state', { body: open }), 409, 'an N1 pause set through the portal route')).reason, 'admin-pause');
    // Partnerns egen paus består genom Admins andra sparningar och öppnas av partnern.
    await adminState(room('north-a'), 'live');
    await status(f.call('room-state', { body: pause }), 200, 'partner pause');
    await adminState(room('north-b'), 'live');
    await status(f.call('room-state', { body: open }), 200, 'the partner opens its own pause');
    assert.deepEqual(await lobby(), [room('north-a'), room('north-b')]);
  });

  await t.test('state and settings: the role and the company are read again under the lock', async () => {
    const original = f.config.presentationTransaction;
    // Ändringen görs efter ingångens kontroll men före låset (transaktionen).
    const between = async (change, call, message) => {
      f.config.presentationTransaction = async (work, options) => { await change(); return original(work, options); };
      try { return await refused(call, 403, message); } finally { f.config.presentationTransaction = original; }
    };
    const revision = (await pack()).revision;
    const pause = { roomId: room('north-a'), state: 'pending', expectedState: 'live', expectedPackageRevision: revision };
    const settings = { action: 'save-draft', roomId: room('north-a'), expectedPackageRevision: revision, expectedDraftRevision: null,
      gameConfig: { language: 'sv', limitPreset: 'casual' } };
    const role = (await f.direct.getRole('north', 'partner-admin'));
    const setRole = permissions => f.direct.upsertRole({ actor: 'fixture', operatorId: 'north', roleId: 'partner-admin', label: role.label, permissions, delegable: role.delegable });
    const member = async (userId, changes) => {
      const membership = await f.direct.getMembership('north', userId);
      await f.direct.upsertMembership({ actor: 'fixture', operatorId: 'north', userId, roleId: membership.roleId, status: membership.status,
        expectedRevision: membership.revision, ...changes });
    };
    // Ett andra partner-admin-konto, så att medlemskapet får stängas (bolaget behåller en administratör).
    await member('43', { roleId: 'partner-admin' });
    for (const [body, path] of [[pause, 'room-state'], [settings, 'room-settings']]) {
      await between(() => setRole(role.permissions.filter(permission => permission !== 'tables.configure')), () => f.call(path, { body }), `${path}: role withdrawn`);
      await setRole([...role.permissions]);
      await between(() => member('42', { status: 'suspended' }), () => f.call(path, { body }), `${path}: membership in the company suspended`);
      await member('42', { status: 'active' });
    }
    await member('43', { roleId: 'partner-editor' });
    // Utan ändring däremellan går samma paus igenom.
    await status(f.call('room-state', { body: pause }), 200, 'nothing changed in between');
    await status(f.call('room-state', { body: { ...pause, state: 'live', expectedState: 'pending' } }), 200, 'reopen');
  });

  await t.test('state: allow.pause=false closes the action', async () => {
    const granted = await grant({ allow: { limit: true } });
    await refused(() => f.call('room-state', { body: { roomId: room('north-a'), state: 'pending', expectedState: 'live', expectedPackageRevision: granted.revision } }), 403, 'allow.pause');
  });

  await t.test('appearance: a paused table keeps its published override; only a new or changed one is refused', async () => {
    // Admin publicerar en dealer-override för north-b (i paketets branding).
    const current = await pack();
    await f.repository.withMutationContext(() => f.direct.publishPackage({ actor: 'fixture', operatorId: 'north', expectedRevision: current.revision,
      lanes: current.lanes, games: current.games, tables: current.tables,
      branding: { ...current.branding, roomOverrides: { ...(current.branding.roomOverrides ?? {}), [room('north-b')]: { dealer: 'paow' } } } }),
    [NATIVE_FILMED_PLANNING_MUTATION]);
    // Ett utkast som bara ändrar north-a och bär north-b:s publicerade override vidare.
    const draftFor = async (overrides = {}) => {
      const view = await (await f.call('branding')).json();
      return { action: 'save-draft', expectedDraftRevision: view.draftRevision, expectedPackageRevision: view.packageRevision,
        branding: { ...view.branding, roomOverrides: { ...view.branding.roomOverrides, [room('north-a')]: { dealer: 'paow' }, ...overrides } } };
    };
    const dealerFor = async (id, dealer = 'paow') => {
      const read = await assignment();
      return { roomId: id, dealer, expectedDraftRevision: read.revisions.brandingDraft, expectedPackageRevision: read.revisions.package };
    };
    assert.equal((await draftFor()).branding.roomOverrides[room('north-b')].dealer, 'paow');
    await status(f.call('branding', { body: await draftFor() }), 200, 'north-b live: the same draft');
    await status(f.call('dealer', { body: await dealerFor(room('north-a')) }), 200, 'north-b live: dealer for north-a');
    // north-b pausas (läge pending): samma utkast och dealerbytet för north-a går fortfarande igenom.
    await adminState(room('north-b'), 'pending');
    await status(f.call('branding', { body: await draftFor() }), 200, `north-b paused by Admin: the same draft`);
    await status(f.call('dealer', { body: await dealerFor(room('north-a'), 'dragan') }), 200, `north-b paused by Admin: dealer for north-a`);
    await refused(async () => f.call('branding', { body: await draftFor({ [room('north-b')]: { dealer: 'dragan' } }) }), 422, 'a changed override for the paused table');
    await refused(async () => f.call('branding', { body: await draftFor({ [room('north-b')]: { dealer: 'paow', background: 'ghost' } }) }), 422, 'a widened override for the paused table');
    await refused(async () => f.call('dealer', { body: await dealerFor(room('north-b'), 'dragan') }), 422, 'POST dealer for the paused table');
    await refused(async () => f.call('branding', { body: await draftFor({ [room('south')]: { dealer: 'paow' } }) }), 422, 'another company\'s table');
    await adminState(room('north-b'), 'live');
  });
});

test('before Studio migration 022 the journaled table actions answer 503 and write nothing', async t => {
  const f = await partnerPostgresFixture(t, { deferOptional: ['022'] });
  const current = await f.direct.getCurrentPackage('north');
  const granted = await f.repository.withMutationContext(() => f.direct.publishPackage({ actor: 'fixture', operatorId: 'north', expectedRevision: current.revision,
    lanes: current.lanes, games: current.games, tables: current.tables,
    branding: { ...current.branding, [PARTNER_ASSIGNMENT_KEY]: { allow: { language: true, limit: true, pause: true }, limitPresets: ['casual', 'prive'] } } }),
  [NATIVE_FILMED_PLANNING_MUTATION]);
  const revisions = async () => ({ administration: (await f.raw.readDocument('administration')).revision, package: (await f.direct.getCurrentPackage('north')).revision,
    journal: (await f.rows('SELECT count(*)::integer AS n FROM croupier_studio.operator_audit_events WHERE environment_id=$1 AND workspace_id=$2', [f.scope.environment, f.scope.workspaceId]))[0].n });
  for (const [path, body] of [
    ['room-state', { roomId: f.id('north-a'), state: 'pending', expectedState: 'live', expectedPackageRevision: granted.revision }],
    ['room-settings', { action: 'save-draft', roomId: f.id('north-a'), expectedPackageRevision: granted.revision, expectedDraftRevision: null, gameConfig: { language: 'sv', limitPreset: 'prive' } }],
  ]) {
    const before = await revisions();
    const response = await f.call(path, { body });
    assert.equal(response.status, 503, path);
    assert.deepEqual(await response.json(), { error: 'Authentication unavailable', reason: 'studio_migration_required' });
    assert.deepEqual(await revisions(), before, `${path}: inget skrivet`);
  }
  assert.equal((await f.raw.readDocument('administration')).value.rooms.find(row => row.id === f.id('north-a')).state, 'live');
});
