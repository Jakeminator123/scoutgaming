import test from 'node:test';
import assert from 'node:assert/strict';
import { registeredDesignCatalog, serveDesignCatalog } from '../lib/design-preview-catalog.mjs';
import { createPortraitRoomEntryFixture } from '../../test/fixtures/portrait-room-entry.mjs';
import { addDealer } from '../lib/studio-model.mjs';
import { parseLobbyCatalog, lobbySelection, playUrlFor } from '../../packages/design-preview/lobby/lib/catalog.mjs';

function fixture() {
  const f = createPortraitRoomEntryFixture({ operator: 'north', dealer: 'johanna' });
  f.project = addDealer(f.project, 'unpublished', 'Unpublished dealer');
  const operators = [{ id: f.room.operatorId, slug: 'north', name: 'North', status: 'active', secret: 'private-operator-field' },
    { id: 'another', slug: 'another', name: 'Another', status: 'suspended' }];
  f.administration.rooms.push({ ...f.room, id: 'not-published', name: 'Draft room' },
    { ...f.room, id: 'other-room', operatorId: 'another', name: 'Another room' });
  const saved = { project: f.project, administration: f.administration, projectRevision: 'project-7', administrationRevision: 'admin-3' };
  const store = { listOperators: async () => operators, getCurrentPackage: async id => id === f.room.operatorId ? f.pack : null };
  const policy = { readSaved: async () => saved };
  return { ...f, saved, store, policy, operators };
}

test('registered admin and published lobby share exact identities without private media or fixture substitution', async () => {
  const f = fixture(), before = structuredClone(f.saved);
  const result = await registeredDesignCatalog({ ...f, now: () => 0 });
  assert.equal(result.source, 'registered');
  assert.equal(result.readAt, '1970-01-01T00:00:00.000Z');
  assert.equal(result.administration.operators.length, 2);
  assert.equal(result.administration.rooms.length, 3);
  assert.equal(result.administration.operators[0].packageRevision, 7);
  assert.ok(result.administration.dealers.some(row => row.id === 'unpublished'));
  assert.deepEqual(result.lobby.catalogs.map(row => row.operator.slug), ['north']);
  assert.deepEqual(result.lobby.catalogs[0].rooms.map(row => row.id), [f.room.id]);
  assert.deepEqual(result.lobby.catalogs[0].rooms[0].dealers.map(row => row.id), ['johanna']);
  assert.equal(result.administration.rooms.find(row => row.id === 'not-published').playable, false);
  assert.doesNotMatch(JSON.stringify(result), /private-operator-field|sha256|pathname|croupier\/media|_scoutPresentation|salt|password/);
  assert.deepEqual(f.saved, before);
  const lobby = parseLobbyCatalog(result);
  const choice = lobbySelection(lobby, { operatorId: 'north', roomKey: 'north:' + f.room.id, dealerId: 'johanna' });
  assert.equal(playUrlFor(choice), '/play/blackjack?operator=north&table=' + f.room.id + '&dealer=johanna');
  assert.equal(lobbySelection(lobby, { operatorId: 'another', roomKey: 'north:' + f.room.id, dealerId: 'johanna' }).dealer, null);
});

test('preview rooms and suspended operators never enter the playable lobby; genuine empty data stays empty', async () => {
  const f = fixture();
  f.administration.rooms[0].state = 'preview';
  assert.deepEqual((await registeredDesignCatalog(f)).lobby.catalogs, []);
  f.administration.rooms[0].state = 'live'; f.operators[0].status = 'suspended';
  assert.deepEqual((await registeredDesignCatalog(f)).lobby.catalogs, []);
  const empty = await registeredDesignCatalog({ store: { listOperators: async () => [] }, policy: {
    readSaved: async () => ({ project: { dealers: [], lanes: [] }, administration: { rooms: [] }, projectRevision: 'a', administrationRevision: 'b' }),
  } });
  assert.deepEqual(empty.administration.operators, []);
  assert.deepEqual(empty.administration.dealers, []);
  assert.deepEqual(empty.lobby.catalogs, []);
});

test('storage failure and cross-operator package mismatch fail closed', async () => {
  const f = fixture();
  await assert.rejects(registeredDesignCatalog({ ...f, store: { ...f.store, listOperators: async () => { throw Error('offline'); } } }), /offline/);
  await assert.rejects(registeredDesignCatalog({ ...f, store: { ...f.store, getCurrentPackage: async () => ({ ...f.pack, operatorId: 'other' }) } }), error => error.statusCode === 503);
});

test('a published non-live room retains frozen dealers after saved composition edits', async () => {
  const f = fixture();
  f.administration.rooms[0].state = 'preview';
  f.project.lanes[0].dealers = ['unpublished'];
  f.project.lanes[0].layers.dealer = { enabled: true, default: 'unpublished', allowed: ['unpublished'] };
  const result = await registeredDesignCatalog(f);
  const room = result.administration.rooms.find(row => row.id === f.room.id);
  assert.equal(room.published, true); assert.equal(room.playable, false);
  assert.deepEqual(room.dealerIds, ['johanna']);
  assert.equal(room.dealerSource, 'published');
  assert.equal(room.dealers[0].name, 'Johanna');
  const draft = result.administration.rooms.find(row => row.id === 'not-published');
  assert.equal(draft.dealerSource, 'saved'); assert.deepEqual(draft.dealerIds, ['unpublished']);
});

test('catalog request reauthorizes before reads, accepts GET/HEAD only and never caches by session', async () => {
  let reads = 0, authorizations = 0;
  const request = new Request('https://studio.test/admin/_data/catalog');
  const options = { authorize: async () => { authorizations++; }, readCatalog: async () => { reads++; return { schemaVersion: 1 }; } };
  const denied = Object.assign(new Error('denied'), { statusCode: 403 });
  await assert.rejects(serveDesignCatalog(request, { ...options, authorize: async () => { throw denied; } }), error => error === denied);
  assert.equal(reads, 0);
  const response = await serveDesignCatalog(request, options);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { schemaVersion: 1 });
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('vary'), 'Cookie');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  const head = await serveDesignCatalog(new Request(request.url, { method: 'HEAD' }), options);
  assert.equal(await head.text(), ''); assert.equal(authorizations, 2); assert.equal(reads, 2);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal((await serveDesignCatalog(new Request(request.url, { method }), options)).status, 405);
  assert.equal(authorizations, 2); assert.equal(reads, 2);
  const query = await serveDesignCatalog(new Request(request.url + '?operator=other'), options);
  assert.equal(query.status, 400); assert.equal(reads, 2);
});
