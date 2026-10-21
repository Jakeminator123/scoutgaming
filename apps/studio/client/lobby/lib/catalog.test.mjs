import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLobbyCatalog, loadLobbyCatalog, lobbySelection, lobbyQuerySelection, playUrlFor } from './catalog.mjs';

function publication(slug, dealerId, label) {
  return { schemaVersion: 1, operator: { slug, name: `Bolag ${slug}` }, packageRevision: 2, rooms: [{
    id: 'shared-table', name: `Rum ${slug}`, laneId: 'test-composition',
    presentation: { id: 'test-composition', label: 'Publicerad miljö' }, dealerDefault: dealerId,
    dealers: [{ id: dealerId, label, presentation: 'original', independentLayers: false,
      table: { enabled: false, default: null, allowed: [] },
      background: { enabled: false, default: null, allowed: [], mode: 'baked' } }],
    playUrl: `/play/blackjack?operator=${slug}&table=shared-table`,
  }] };
}
const payload = catalogs => ({ schemaVersion: 1, source: 'registered', administration: { operators: [{ name: 'Must never become lobby data' }] }, lobby: { catalogs } });

test('published names and parent-scoped choices survive colliding room IDs without template data', () => {
  const catalog = parseLobbyCatalog(payload([publication('alpha', 'nora', 'Nora Studio'), publication('beta', 'elin', 'Elin')]));
  assert.deepEqual(catalog.operators.map(row => row.id), ['alpha', 'beta']);
  assert.deepEqual(catalog.rooms.map(row => row.key), ['alpha:shared-table', 'beta:shared-table']);
  const selection = lobbySelection(catalog, { operatorId: 'alpha', roomKey: 'alpha:shared-table', dealerId: 'nora' });
  assert.equal(selection.dealer.name, 'Nora Studio');
  assert.equal(playUrlFor(selection), '/play/blackjack?operator=alpha&table=shared-table&dealer=nora');
  assert.equal('image' in selection.dealer, false);
  assert.equal('limits' in selection.room, false);
});

test('roulette rooms preserve their game and launch endpoint alongside blackjack', () => {
  const original = publication('alpha', 'anna', 'Anna');
  const roulette = {
    ...original.rooms[0], id: 'roulette-room', name: 'Rouletterummet', game: 'roulette',
    playUrl: '/play/roulette?operator=alpha&table=roulette-room',
  };
  const catalog = parseLobbyCatalog(payload([{ ...original, rooms: [...original.rooms, roulette] }]));
  const selection = lobbySelection(catalog, { operatorId: 'alpha', roomKey: 'alpha:roulette-room', dealerId: 'anna' });
  assert.equal(selection.room.game, 'roulette');
  assert.equal(playUrlFor(selection), '/play/roulette?operator=alpha&table=roulette-room&dealer=anna');
  assert.equal(catalog.rooms[0].game, 'blackjack');
  assert.equal(portraitFor(selection.dealer).id, 'anna');
  assert.equal('clips' in selection.dealer, false, 'lobby video never becomes gameplay configuration');
  assert.equal(playUrlFor({ ...selection, room: { ...selection.room, game: 'blackjack' } }), undefined,
    'the same dealer cannot change a roulette room into a blackjack launch');
  assert.equal(playUrlFor(lobbySelection(catalog, { operatorId: 'alpha', roomKey: 'alpha:shared-table', dealerId: 'anna' })), '/play/blackjack?operator=alpha&table=shared-table&dealer=anna');
});

test('room artwork comes from a single published background, never an editable default or admin image', () => {
  const source = publication('alpha', 'nora', 'Nora Studio');
  const background = { id: '11111111-1111-1111-1111-111111111111', label: 'Salongen' };
  Object.assign(source.rooms[0].dealers[0], { presentation: 'layered', independentLayers: true,
    background: { enabled: true, default: background.id, allowed: [background], mode: 'image' } });
  const first = parseLobbyCatalog(payload([source])).rooms[0];
  assert.equal(first.environmentFixed, true);
  assert.equal(first.environmentLabel, 'Salongen');
  assert.equal(first.image, '/api/presentation/layers/alpha/' + background.id);
  source.rooms[0].dealers[0].background.allowed.push({ id: '22222222-2222-2222-2222-222222222222', label: 'Lounge' });
  const multiple = parseLobbyCatalog(payload([source])).rooms[0];
  assert.equal(multiple.environmentFixed, false);
  assert.equal(multiple.environmentKind, 'variable');
  assert.equal(multiple.image, undefined);
});

test('a changed tenant or room revokes stale downstream selections and cross-room launch links', () => {
  const catalog = parseLobbyCatalog(payload([publication('alpha', 'nora', 'Nora Studio'), publication('beta', 'elin', 'Elin')]));
  const wrongTenant = lobbySelection(catalog, { operatorId: 'beta', roomKey: 'alpha:shared-table', dealerId: 'nora' });
  assert.equal(wrongTenant.room, null); assert.equal(wrongTenant.dealer, null);
  assert.deepEqual(wrongTenant.availableDealers, []);
  const wrongDealer = lobbySelection(catalog, { operatorId: 'beta', roomKey: 'beta:shared-table', dealerId: 'nora' });
  assert.equal(wrongDealer.dealer, null);
  assert.equal(playUrlFor({ operator: catalog.operators[0], room: catalog.rooms[1], dealer: catalog.dealers[1] }), undefined);
  assert.equal(playUrlFor({ operator: catalog.operators[0], room: catalog.rooms[0], dealer: catalog.dealers[1] }), undefined);
});

test('malformed, duplicate, draft and injected external launch catalogs fail closed', () => {
  const original = publication('alpha', 'nora', 'Nora Studio');
  for (const candidate of [
    { ...payload([original]), source: 'fixture' },
    { schemaVersion: 1, source: 'registered', administration: { rooms: [original.rooms[0]] } },
    payload([original, original]),
    payload([{ ...original, packageRevision: null }]),
    payload([{ ...original, rooms: [{ ...original.rooms[0], playUrl: 'https://example.invalid/play' }] }]),
  ]) assert.throws(() => parseLobbyCatalog(candidate));
});

test('empty registered directories and unpublished operator catalogs stay empty', () => {
  assert.deepEqual(parseLobbyCatalog(payload([])), { operators: [], rooms: [], dealers: [] });
  const original = publication('alpha', 'nora', 'Nora Studio');
  const catalog = parseLobbyCatalog(payload([{ ...original, packageRevision: null, rooms: [] }]));
  assert.equal(catalog.operators[0].status, 'empty');
  assert.deepEqual(catalog.rooms, []); assert.deepEqual(catalog.dealers, []);
});

test('catalog read carries session and cancellation, disables cache, and rejects auth/backend failure', async () => {
  const signal = new AbortController().signal;
  const loaded = await loadLobbyCatalog({ signal, fetchImpl: async (path, options) => {
    assert.equal(path, '/admin/_data/catalog');
    assert.equal(options.credentials, 'same-origin'); assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error'); assert.equal(options.signal, signal);
    return Response.json(payload([publication('alpha', 'nora', 'Nora Studio')]));
  } });
  assert.equal(loaded.dealers[0].name, 'Nora Studio');
  for (const status of [401, 403, 503]) await assert.rejects(loadLobbyCatalog({ fetchImpl: async () => new Response('private details', { status }) }), error => !error.message.includes('private details'));
  await assert.rejects(loadLobbyCatalog({ fetchImpl: async () => Response.json({}) }));
});

// Artwork must never become a second source of dealer cards or playable IDs.
import { dealerCards, portraitFor } from './dealer-portraits.mjs';

test('empty or unavailable catalogs do not recreate dealers from supplied portraits', () => {
  assert.deepEqual(dealerCards(), []);
  const catalog = parseLobbyCatalog(payload([]));
  assert.deepEqual(dealerCards(catalog.dealers), []);
  assert.equal(lobbySelection(catalog, { dealerId: 'astrid' }).dealer, null);
  assert.equal(portraitFor({ id: 'unknown', name: 'Astrid' }), undefined);
});

test('retired PAOW artwork cannot return through old publication aliases', () => {
  const catalog = parseLobbyCatalog(payload([publication('alpha', 'paow-v2', 'PAOW'), publication('beta', 'nora', 'Nora')]));
  const chosen = lobbySelection(catalog, { operatorId: 'alpha', roomKey: 'alpha:shared-table', dealerId: 'paow-v2' });
  assert.deepEqual(dealerCards(chosen.availableDealers).map(row => row.id), ['paow-v2']);
  assert.equal(portraitFor(chosen.dealer), undefined);
  assert.equal(portraitFor({ id: 'paow', name: 'PAOW' }), undefined);
  assert.equal(playUrlFor(chosen), '/play/blackjack?operator=alpha&table=shared-table&dealer=paow-v2');
  assert.equal(lobbySelection(catalog, { operatorId: 'alpha', roomKey: 'alpha:shared-table', dealerId: 'paow' }).dealer, null);
  const other = lobbySelection(catalog, { operatorId: 'beta', roomKey: 'beta:shared-table', dealerId: 'paow-v2' });
  assert.equal(other.dealer, null);
  assert.deepEqual(dealerCards(other.availableDealers).map(row => row.id), ['nora']);
  assert.equal(portraitFor({ id: 'nora', name: 'PAOW' }), undefined);
});

test('only registered choices appear in publication order, with or without a supplied portrait', () => {
  const registered = [{ id: 'dragan', name: 'Dragan' }, { id: 'anna', name: 'Anna' }, { id: 'paow', name: 'Paow' }, { id: 'paow-v2', name: 'PAOW' }, { id: 'new-dealer', name: 'New' }];
  const cards = dealerCards(registered);
  assert.deepEqual(cards.map(row => row.id), ['dragan', 'anna', 'paow', 'paow-v2', 'new-dealer']);
  assert.ok(cards.every(row => row.available));
  assert.equal(portraitFor(cards[0]), undefined);
  assert.equal(portraitFor(cards[1]).id, 'anna');
  assert.equal(new Set(cards.map(row => row.id)).size, cards.length);
});

test('room URL context resolves exact published ownership without accepting table design IDs as rooms', () => {
  const catalog = parseLobbyCatalog(payload([publication('alpha', 'nora', 'Nora'), publication('beta', 'elin', 'Elin')]));
  assert.deepEqual(lobbyQuerySelection(catalog, '?operator=beta&room=shared-table'),
    { operatorId: 'beta', roomKey: 'beta:shared-table', dealerId: null, unavailable: false });
  assert.deepEqual(lobbyQuerySelection(catalog, '?operator=alpha&table=shared-table'),
    { operatorId: 'alpha', roomKey: 'alpha:shared-table', dealerId: null, unavailable: false });
  assert.deepEqual(lobbyQuerySelection(catalog, '?operator=alpha'),
    { operatorId: 'alpha', roomKey: null, dealerId: null, unavailable: false });
  assert.deepEqual(lobbyQuerySelection(catalog),
    { operatorId: null, roomKey: null, dealerId: null, unavailable: false });
  for (const query of ['operator=alpha&room=', 'operator=alpha&room=11111111-1111-4111-8111-111111111111',
    'operator=alpha&room=../shared-table', 'room=shared-table', 'operator=missing&room=shared-table',
    'operator=alpha&operator=beta&room=shared-table', 'operator=alpha&room=shared-table&room=shared-table']) {
    const selected = lobbyQuerySelection(catalog, query);
    assert.equal(selected.roomKey, null, query); assert.equal(selected.unavailable, true, query);
  }
});

test('a foreign or removed room URL never chooses an available room for its operator', () => {
  const foreign = publication('beta', 'elin', 'Elin');
  foreign.rooms[0].id = 'beta-only';
  foreign.rooms[0].playUrl = '/play/blackjack?operator=beta&table=beta-only';
  const catalog = parseLobbyCatalog(payload([publication('alpha', 'nora', 'Nora'), foreign]));
  assert.deepEqual(lobbyQuerySelection(catalog, '?operator=alpha&room=beta-only'),
    { operatorId: 'alpha', roomKey: null, dealerId: null, unavailable: true });
  assert.equal(lobbyQuerySelection(catalog, '?operator=alpha&room=shared-table').roomKey, 'alpha:shared-table');
  const updated = parseLobbyCatalog(payload([{ ...publication('alpha', 'nora', 'Nora'), rooms: [] }, foreign]));
  assert.deepEqual(lobbyQuerySelection(updated, '?operator=alpha&room=shared-table'),
    { operatorId: 'alpha', roomKey: null, dealerId: null, unavailable: true });
});
