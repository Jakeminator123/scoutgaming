import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLobbyCatalog, loadLobbyCatalog, lobbySelection, lobbyQuerySelection, playUrlFor, roomIllustration } from './catalog.mjs';
import { roomLimitProfiles } from '../../../lib/room-limit-profiles.mjs';

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
  assert.equal(playUrlFor(selection), '/game?game=blackjack&operator=alpha&table=shared-table&dealer=nora');
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
  assert.equal(playUrlFor(selection), '/game?game=roulette&operator=alpha&table=roulette-room&dealer=anna');
  assert.equal(catalog.rooms[0].game, 'blackjack');
  assert.equal(portraitFor(selection.dealer).id, 'anna');
  assert.equal('clips' in selection.dealer, false, 'lobby video never becomes gameplay configuration');
  assert.equal(playUrlFor({ ...selection, room: { ...selection.room, game: 'blackjack' } }), undefined,
    'the same dealer cannot change a roulette room into a blackjack launch');
  assert.equal(playUrlFor(lobbySelection(catalog, { operatorId: 'alpha', roomKey: 'alpha:shared-table', dealerId: 'anna' })), '/game?game=blackjack&operator=alpha&table=shared-table&dealer=anna');
});

test('room artwork comes from the published background the game starts with, never a draft or admin image', () => {
  const source = publication('alpha', 'nora', 'Nora Studio');
  const background = { id: '11111111-1111-1111-1111-111111111111', label: 'Salongen' };
  Object.assign(source.rooms[0].dealers[0], { presentation: 'layered', independentLayers: true,
    background: { enabled: true, default: background.id, allowed: [background], mode: 'image' } });
  const first = parseLobbyCatalog(payload([source])).rooms[0];
  assert.equal(first.environmentFixed, true);
  assert.equal(first.environmentLabel, 'Salongen');
  assert.equal(first.image, '/api/presentation/layers/alpha/' + background.id);
  const lounge = { id: '22222222-2222-2222-2222-222222222222', label: 'Lounge' };
  source.rooms[0].dealers[0].background.allowed.push(lounge);
  const multiple = parseLobbyCatalog(payload([source])).rooms[0];
  assert.equal(multiple.environmentFixed, false);
  assert.equal(multiple.environmentKind, 'variable');
  assert.equal(multiple.environmentLabel, 'Flera miljöer');
  assert.equal(multiple.image, '/api/presentation/layers/alpha/' + background.id, "several choices show the default dealer's default");
  source.rooms[0].dealers[0].background.default = lounge.id;
  assert.equal(parseLobbyCatalog(payload([source])).rooms[0].image, '/api/presentation/layers/alpha/' + lounge.id);
  // A second, baked dealer that is not the room default leaves the card on the default background.
  source.rooms[0].dealers.push({ ...publication('alpha', 'elin', 'Elin').rooms[0].dealers[0] });
  assert.equal(parseLobbyCatalog(payload([source])).rooms[0].image, '/api/presentation/layers/alpha/' + lounge.id);
  // Without a published default background the card keeps the design illustration.
  source.rooms[0].dealerDefault = 'elin';
  const baked = parseLobbyCatalog(payload([source])).rooms[0];
  assert.equal(baked.image, undefined); assert.equal(baked.environmentLabel, 'Flera miljöer');
  source.rooms[0].dealerDefault = 'nora'; source.rooms[0].dealers[0].background.default = null;
  assert.equal(parseLobbyCatalog(payload([source])).rooms[0].image, undefined);
});

test("each room's illustration follows its published bet profile, and an unknown profile keeps Salongen", async () => {
  const lobby = '/admin/_assets/lobby/images/lobby/';
  const expected = { casual: [lobby + 'room-studion.png', 'Nordisk studio med limegrön ljuslinje'],
    prive: [lobby + 'room-salongen.png', 'Klassiskt blackjackrum i valnöt och mässing'],
    high: [lobby + 'room-loungen.png', 'Neonlounge med blackjackbord'] };
  // Admin's profile cards and the lobby share one mapping; every contract profile has its own picture.
  assert.deepEqual(roomLimitProfiles().map(row => row.id), Object.keys(expected));
  for (const profile of roomLimitProfiles()) assert.deepEqual(roomIllustration(profile.id), { image: profile.image, alt: profile.alt });
  assert.equal(new Set(Object.values(expected).map(([image]) => image)).size, 3);
  const fallback = { image: lobby + 'room-salongen.png', alt: expected.prive[1] };
  for (const value of [undefined, null, '', 'vip', '__proto__', 'constructor', 3]) assert.deepEqual(roomIllustration(value), fallback);

  // The profile is read from the published rooms the lobby receives (GET /admin/_data/catalog), per room.
  const source = publication('alpha', 'nora', 'Nora Studio'), template = source.rooms[0];
  source.rooms = [...Object.keys(expected), 'vip', null].map((limitPreset, i) => ({ ...template, id: `room-${i}`,
    playUrl: `/play/blackjack?operator=alpha&table=room-${i}`, ...(limitPreset ? { limitPreset } : {}) }));
  const loaded = await loadLobbyCatalog({ fetchImpl: async () => Response.json(payload([source])) });
  assert.deepEqual(loaded.rooms.map(room => [room.limitPreset, room.illustration.image, room.illustration.alt]), [
    ...Object.entries(expected).map(([id, [image, alt]]) => [id, image, alt]),
    ['vip', fallback.image, fallback.alt], [undefined, fallback.image, fallback.alt]]);
  assert.equal(loaded.rooms.every(room => room.image === undefined), true, 'the illustration never becomes a published background');
  // The public contract carries only a profile key; anything else closes the catalog.
  for (const limitPreset of ['', 'High', 'https://example.invalid/x.png', 7, null]) {
    assert.throws(() => parseLobbyCatalog(payload([{ ...source, rooms: [{ ...template, limitPreset }] }])));
  }
});

// A room without published game settings (status 'preparing') is listed but offers no game start.
test('a room being prepared is shown without a game start; any other status closes the catalog', () => {
  const source = publication('alpha', 'nora', 'Nora Studio'), template = source.rooms[0];
  const ready = parseLobbyCatalog(payload([source])), preparing = parseLobbyCatalog(payload([{ ...source, rooms: [{ ...template, status: 'preparing' }] }]));
  const pick = catalog => lobbySelection(catalog, { operatorId: 'alpha', roomKey: catalog.rooms[0].key, dealerId: catalog.dealers[0].id });
  assert.equal(ready.rooms[0].preparing, undefined); assert.equal(typeof playUrlFor(pick(ready)), 'string');
  assert.equal(preparing.rooms[0].preparing, true); assert.equal(playUrlFor(pick(preparing)), undefined);
  for (const status of ['live', 'Preparing', '', null, true]) assert.throws(() => parseLobbyCatalog(payload([{ ...source, rooms: [{ ...template, status }] }])));
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

// Artwork may show locked teasers, but never becomes a source of playable IDs.
import { dealerCards, dealerPortraits, portraitFor } from './dealer-portraits.mjs';

// Every lobby portrait, in artwork order; the list itself is artwork, not a rule.
const TEASERS = dealerPortraits.map(portrait => portrait.id);

test('locked portrait teasers fill an empty or unavailable catalog without granting access', () => {
  const cards = dealerCards();
  assert.ok(TEASERS.length > 0);
  assert.equal(new Set(TEASERS).size, TEASERS.length);
  assert.deepEqual(cards.map(row => row.id), TEASERS);
  assert.ok(cards.every(row => row.available === false));
  const catalog = parseLobbyCatalog(payload([]));
  assert.deepEqual(dealerCards(catalog.dealers), cards);
  for (const dealerId of TEASERS) assert.equal(lobbySelection(catalog, { dealerId }).dealer, null);
  assert.equal(portraitFor({ id: 'unknown', name: 'Astrid' }), undefined);
});

test('a teaser cannot become a choice or launch link in a room that does not publish it', () => {
  const catalog = parseLobbyCatalog(payload([publication('alpha', 'nora', 'Nora')]));
  const room = { operatorId: 'alpha', roomKey: 'alpha:shared-table' };
  const cards = dealerCards(lobbySelection(catalog, room).availableDealers);
  assert.deepEqual(cards.map(row => [row.id, row.available]), [['nora', true], ...TEASERS.map(id => [id, false])]);
  for (const dealerId of TEASERS) {
    const selection = lobbySelection(catalog, { ...room, dealerId });
    assert.equal(selection.dealer, null);
    assert.equal(playUrlFor({ ...selection, dealer: { id: dealerId, name: dealerId } }), undefined);
  }
});

test('registered Dragan shows the Dragge portrait under the published ID, by exact ID only', () => {
  const catalog = parseLobbyCatalog(payload([publication('alpha', 'dragan', 'Dragan')]));
  const chosen = lobbySelection(catalog, { operatorId: 'alpha', roomKey: 'alpha:shared-table', dealerId: 'dragan' });
  assert.equal(portraitFor(chosen.dealer).id, 'dragge');
  assert.equal(playUrlFor(chosen), '/game?game=blackjack&operator=alpha&table=shared-table&dealer=dragan');
  assert.deepEqual(dealerCards(chosen.availableDealers).map(row => [row.id, row.available]),
    [['dragan', true], ['astrid', false], ['marten', false], ['anna', false], ['paow', false]], 'no second, locked Dragge card');
  assert.equal(portraitFor({ id: 'dragan-2', name: 'Dragan' }), undefined);
  assert.equal(portraitFor({ id: 'nora', name: 'Dragge' }), undefined);
  assert.equal(lobbySelection(catalog, { operatorId: 'alpha', roomKey: 'alpha:shared-table', dealerId: 'dragge' }).dealer, null);
});

test('PAOW keeps her published ID paow-v2 with her portrait and cannot be unlocked in another room', () => {
  const catalog = parseLobbyCatalog(payload([publication('alpha', 'paow-v2', 'PAOW'), publication('beta', 'nora', 'Nora')]));
  const chosen = lobbySelection(catalog, { operatorId: 'alpha', roomKey: 'alpha:shared-table', dealerId: 'paow-v2' });
  assert.deepEqual(dealerCards(chosen.availableDealers).filter(row => row.available).map(row => row.id), ['paow-v2']);
  assert.ok(!dealerCards(chosen.availableDealers).some(row => row.id === 'paow'), 'no second, locked Paow card');
  assert.equal(portraitFor(chosen.dealer).id, 'paow');
  assert.equal(portraitFor({ id: 'paow-v3', name: 'PAOW' }), undefined);
  assert.equal(playUrlFor(chosen), '/game?game=blackjack&operator=alpha&table=shared-table&dealer=paow-v2');
  assert.equal(lobbySelection(catalog, { operatorId: 'alpha', roomKey: 'alpha:shared-table', dealerId: 'paow' }).dealer, null);
  const other = lobbySelection(catalog, { operatorId: 'beta', roomKey: 'beta:shared-table', dealerId: 'paow-v2' });
  assert.equal(other.dealer, null);
  assert.deepEqual(dealerCards(other.availableDealers).map(row => [row.id, row.available]),
    [['nora', true], ...TEASERS.map(id => [id, false])]);
  assert.equal(portraitFor({ id: 'nora', name: 'PAOW' }), undefined);
});

test('registered choices come first in publication order, then only the unpublished teasers', () => {
  const registered = [{ id: 'new-dealer', name: 'New' }, { id: 'anna', name: 'Anna' }, { id: 'paow', name: 'Paow' }, { id: 'dragge', name: 'Dragge' }, { id: 'dragan', name: 'Dragan' }];
  const cards = dealerCards(registered);
  assert.deepEqual(cards.map(row => [row.id, row.available]), [
    ...registered.map(row => [row.id, true]), ['astrid', false], ['marten', false],
  ]);
  assert.equal(portraitFor(cards[0]), undefined);
  assert.equal(portraitFor(cards[1]).id, 'anna');
  assert.equal(portraitFor(cards[2]).id, 'paow');
  assert.equal(portraitFor(cards[3]), portraitFor(cards[4]), 'both registered Dragge IDs keep their own card');
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
