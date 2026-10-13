import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLobbyCatalog, loadLobbyCatalog, lobbySelection, playUrlFor } from './catalog.mjs';

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
  const catalog = parseLobbyCatalog(payload([publication('alpha', 'nora', 'Johanna'), publication('beta', 'amira', 'Amira')]));
  assert.deepEqual(catalog.operators.map(row => row.id), ['alpha', 'beta']);
  assert.deepEqual(catalog.rooms.map(row => row.key), ['alpha:shared-table', 'beta:shared-table']);
  const selection = lobbySelection(catalog, { operatorId: 'alpha', roomKey: 'alpha:shared-table', dealerId: 'nora' });
  assert.equal(selection.dealer.name, 'Johanna');
  assert.equal(playUrlFor(selection), '/play/blackjack?operator=alpha&table=shared-table&dealer=nora');
  assert.equal('image' in selection.dealer, false);
  assert.equal('limits' in selection.room, false);
});

test('roulette rooms preserve their game and launch endpoint alongside blackjack', () => {
  const original = publication('alpha', 'nora', 'Johanna');
  const roulette = {
    ...original.rooms[0], id: 'roulette-room', name: 'Rouletterummet', game: 'roulette',
    playUrl: '/play/roulette?operator=alpha&table=roulette-room',
  };
  const catalog = parseLobbyCatalog(payload([{ ...original, rooms: [...original.rooms, roulette] }]));
  const selection = lobbySelection(catalog, { operatorId: 'alpha', roomKey: 'alpha:roulette-room', dealerId: 'nora' });
  assert.equal(selection.room.game, 'roulette');
  assert.equal(playUrlFor(selection), '/play/roulette?operator=alpha&table=roulette-room&dealer=nora');
  assert.equal(catalog.rooms[0].game, 'blackjack');
  assert.equal(playUrlFor(lobbySelection(catalog, { operatorId: 'alpha', roomKey: 'alpha:shared-table', dealerId: 'nora' })), '/play/blackjack?operator=alpha&table=shared-table&dealer=nora');
});

test('room artwork comes from a single published background, never an editable default or admin image', () => {
  const source = publication('alpha', 'nora', 'Johanna');
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
  const catalog = parseLobbyCatalog(payload([publication('alpha', 'nora', 'Johanna'), publication('beta', 'amira', 'Amira')]));
  const wrongTenant = lobbySelection(catalog, { operatorId: 'beta', roomKey: 'alpha:shared-table', dealerId: 'nora' });
  assert.equal(wrongTenant.room, null); assert.equal(wrongTenant.dealer, null);
  assert.deepEqual(wrongTenant.availableDealers, []);
  const wrongDealer = lobbySelection(catalog, { operatorId: 'beta', roomKey: 'beta:shared-table', dealerId: 'nora' });
  assert.equal(wrongDealer.dealer, null);
  assert.equal(playUrlFor({ operator: catalog.operators[0], room: catalog.rooms[1], dealer: catalog.dealers[1] }), undefined);
  assert.equal(playUrlFor({ operator: catalog.operators[0], room: catalog.rooms[0], dealer: catalog.dealers[1] }), undefined);
});

test('malformed, duplicate, draft and injected external launch catalogs fail closed', () => {
  const original = publication('alpha', 'nora', 'Johanna');
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
  const original = publication('alpha', 'nora', 'Johanna');
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
    return Response.json(payload([publication('alpha', 'nora', 'Johanna')]));
  } });
  assert.equal(loaded.dealers[0].name, 'Johanna');
  for (const status of [401, 403, 503]) await assert.rejects(loadLobbyCatalog({ fetchImpl: async () => new Response('private details', { status }) }), error => !error.message.includes('private details'));
  await assert.rejects(loadLobbyCatalog({ fetchImpl: async () => Response.json({}) }));
});

// Visual teasers must never become a second source of playable dealer IDs.
import { dealerCards, portraitFor } from './dealer-portraits.mjs';

test('four locked portraits do not grant access, including an empty or unavailable catalog', () => {
  const cards = dealerCards();
  assert.deepEqual(cards.map(row => row.id), ['astrid', 'marten', 'paow', 'dragge']);
  assert.ok(cards.every(row => !row.available));
  const catalog = parseLobbyCatalog(payload([]));
  assert.equal(lobbySelection(catalog, { dealerId: 'astrid' }).dealer, null);
  assert.equal(portraitFor({ id: 'unknown', name: 'Astrid' }), undefined);
});

test('portrait alias preserves PAOW publication ID and cannot unlock her in another room', () => {
  const catalog = parseLobbyCatalog(payload([publication('alpha', 'paow-v2', 'PAOW'), publication('beta', 'nora', 'Nora')]));
  const chosen = lobbySelection(catalog, { operatorId: 'alpha', roomKey: 'alpha:shared-table', dealerId: 'paow-v2' });
  assert.deepEqual(dealerCards(chosen.availableDealers).filter(row => row.available).map(row => row.id), ['paow-v2']);
  assert.equal(portraitFor(chosen.dealer).id, 'paow');
  assert.equal(playUrlFor(chosen), '/play/blackjack?operator=alpha&table=shared-table&dealer=paow-v2');
  assert.equal(lobbySelection(catalog, { operatorId: 'alpha', roomKey: 'alpha:shared-table', dealerId: 'paow' }).dealer, null);
  const other = lobbySelection(catalog, { operatorId: 'beta', roomKey: 'beta:shared-table', dealerId: 'paow-v2' });
  assert.equal(other.dealer, null);
  assert.deepEqual(dealerCards(other.availableDealers).filter(row => row.available).map(row => row.id), ['nora']);
  assert.equal(portraitFor({ id: 'nora', name: 'PAOW' }), undefined);
});

test('all registered choices survive, including two explicitly mapped versions of a portrait', () => {
  const registered = [{ id: 'paow', name: 'Paow' }, { id: 'paow-v2', name: 'PAOW' }, { id: 'new-dealer', name: 'New' }];
  const cards = dealerCards(registered);
  assert.deepEqual(cards.filter(row => row.available).map(row => row.id), registered.map(row => row.id));
  assert.equal(new Set(cards.map(row => row.id)).size, cards.length);
});
