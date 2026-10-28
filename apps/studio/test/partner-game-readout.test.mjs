import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateSettlements, clearPartnerGameReadoutCache, parseSettlement, readPartnerReports, readPublishedRoomSettings, REPORT_ROW_LIMIT } from '../lib/partner-game-readout.mjs';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 28, 12);
// A row as services/game coordinator.mjs audits it: body is JSON text whose payload is JSON text.
const settlement = (roomId, roundId, { staked, returned, at = now - DAY, playerId = 'p1', currency = 'USD', type = 'wallet.settlement' } = {}) => ({
  seq: 0, room_id: roomId, body: JSON.stringify({ seq: 0, room: roomId, type, at,
    payload: JSON.stringify({ playerId, roundId, settledAt: at, staked, returned, net: returned - staked, currency }) }),
});
function fakePool(rows, { ready = true, fail = false } = {}) {
  const queries = [];
  return { queries, query: async (text, values) => {
    queries.push({ text, values });
    if (fail) throw new Error('permission denied for table shared_table_audit');
    if (text.includes('to_regclass')) return { rows: [{ ready: ready ? 'croupier_game.shared_table_audit' : null }] };
    if (text.includes('shared_table_audit')) return { rows: rows.filter(row => values[0].includes(row.room_id)).slice(0, values[1]) };
    if (text.includes('shared_table_configs')) return { rows: rows.filter(row => values[0].includes(row.room_id)) };
    throw new Error('unexpected query ' + text);
  } };
}

test.beforeEach(() => clearPartnerGameReadoutCache());

test('a settlement row is read as the game writes it, and anything else is ignored', () => {
  const parsed = parseSettlement(settlement('room-a', 'round-1', { staked: 25, returned: 50 }));
  assert.deepEqual(parsed, { roomId: 'room-a', roundId: 'round-1', staked: 25, returned: 50, at: now - DAY, currency: 'USD' });
  assert.equal(parseSettlement(settlement('room-a', 'round-1', { staked: 25, returned: 50, type: 'engine.start' })), null);
  assert.equal(parseSettlement({ room_id: 'room-a', body: 'not json' }), null);
  assert.equal(parseSettlement(settlement('room-a', 'round-1', { staked: -1, returned: 0 })), null);
  assert.equal(parseSettlement(settlement('room-a', '', { staked: 1, returned: 0 })), null);
});

test('the aggregate counts each settled round once per room, sums stakes and payouts per day and only inside the window', () => {
  const rows = [
    settlement('room-a', 'round-1', { staked: 10, returned: 20, playerId: 'p1' }),
    settlement('room-a', 'round-1', { staked: 30, returned: 0, playerId: 'p2' }),
    settlement('room-a', 'round-2', { staked: 5, returned: 5, at: now - 2 * DAY }),
    settlement('room-b', 'round-9', { staked: 100, returned: 150, at: now - 3 * DAY }),
    settlement('room-a', 'round-old', { staked: 999, returned: 0, at: now - 31 * DAY }),
    settlement('room-foreign', 'round-x', { staked: 777, returned: 0 }),
  ];
  const report = aggregateSettlements(rows, { roomIds: ['room-a', 'room-b'], from: now - 30 * DAY, to: now });
  assert.equal(report.status, 'ready'); assert.equal(report.windowDays, 30); assert.equal(report.currency, 'USD');
  const a = report.rooms.find(room => room.roomId === 'room-a'), b = report.rooms.find(room => room.roomId === 'room-b');
  assert.deepEqual([a.rounds, a.staked, a.returned, a.net], [2, 45, 25, 20]);
  assert.deepEqual([b.rounds, b.staked, b.returned, b.net], [1, 100, 150, -50]);
  assert.equal(a.days.length, 31);
  const yesterday = a.days.find(day => day.day === new Date(now - DAY).toISOString().slice(0, 10));
  assert.deepEqual([yesterday.rounds, yesterday.staked, yesterday.returned], [1, 40, 20]);
  assert.equal(report.rooms.some(room => room.roomId === 'room-foreign'), false);
  assert.equal(JSON.stringify(report).includes('999'), false, 'rows outside the window never count');
  assert.equal(JSON.stringify(report).includes('p1'), false, 'player identities never leave the server');
});

test('the readout limits itself to the company rooms, is cached per company and never throws', async () => {
  const pool = fakePool([settlement('room-a', 'round-1', { staked: 10, returned: 0 })]);
  const first = await readPartnerReports({ query: pool.query, operatorId: 'north', roomIds: ['room-a', 'room-b'], now });
  assert.equal(first.status, 'ready'); assert.equal(first.rooms[0].rounds, 1); assert.equal(first.truncated, false);
  const read = pool.queries.find(entry => entry.text.includes('shared_table_audit a'));
  assert.deepEqual(read.values, [['room-a', 'room-b'], REPORT_ROW_LIMIT]);
  assert.match(read.text, /ORDER BY a\.seq DESC LIMIT \$2/);
  assert.match(read.text, /wallet\.settlement/);
  const again = await readPartnerReports({ query: pool.query, operatorId: 'north', roomIds: ['room-b', 'room-a'], now: now + 60_000 });
  assert.equal(again, first, 'a second page view within the cache window makes no query');
  assert.equal(pool.queries.length, 2);
  const later = await readPartnerReports({ query: pool.query, operatorId: 'north', roomIds: ['room-a', 'room-b'], now: now + 10 * 60_000 });
  assert.notEqual(later, first); assert.equal(pool.queries.length, 4);
  const other = await readPartnerReports({ query: pool.query, operatorId: 'south', roomIds: ['room-a'], now });
  assert.notEqual(other, first, 'the cache is per company');
  assert.deepEqual(await readPartnerReports({ query: fakePool([], { ready: false }).query, operatorId: 'x', roomIds: ['room-a'], now }), { status: 'not-connected', reason: 'table-missing' });
  assert.deepEqual(await readPartnerReports({ query: fakePool([], { fail: true }).query, operatorId: 'y', roomIds: ['room-a'], now }), { status: 'not-connected', reason: 'read-failed' });
  assert.deepEqual(await readPartnerReports({ query: null, operatorId: 'z', roomIds: ['room-a'], now }), { status: 'not-connected', reason: 'no-pool' });
  const none = await readPartnerReports({ query: pool.query, operatorId: 'empty', roomIds: [], now });
  assert.equal(none.status, 'ready'); assert.deepEqual(none.rooms, []);
});

test('published game settings are read only for the version the package binds and only for this company', async () => {
  const body = (roomId, version, extra = {}) => ({ room_id: roomId, version, body: JSON.stringify({ configVersion: version, operatorId: 'north', roomId, packageRevision: 4, language: 'sv', limitPreset: 'prive', ...extra }) });
  const pool = fakePool([body('room-a', 'v-current'), body('room-a', 'v-old', { limitPreset: 'casual' }), body('room-b', 'v-b', { operatorId: 'south' }), { room_id: 'room-c', version: 'v-c', body: '{broken' }]);
  const settings = await readPublishedRoomSettings({ query: pool.query, operatorId: 'north', rooms: [
    { id: 'room-a', configVersion: 'v-current' }, { id: 'room-b', configVersion: 'v-b' }, { id: 'room-c', configVersion: 'v-c' }, { id: 'room-d' },
  ] });
  assert.deepEqual([...settings.entries()], [['room-a', { language: 'sv', limitPreset: 'prive', packageRevision: 4 }]]);
  assert.deepEqual(pool.queries.at(-1).values, [['room-a', 'room-b', 'room-c']]);
  assert.equal((await readPublishedRoomSettings({ query: fakePool([], { fail: true }).query, operatorId: 'north', rooms: [{ id: 'room-a', configVersion: 'v' }] })).size, 0);
  assert.equal((await readPublishedRoomSettings({ query: null, operatorId: 'north', rooms: [{ id: 'room-a', configVersion: 'v' }] })).size, 0);
});
