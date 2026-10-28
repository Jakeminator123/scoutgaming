import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateReportRows, CACHE_MAX_ENTRIES, clearPartnerGameReadoutCache, partnerGameReadoutCacheSize, readPartnerReports, readPublishedRoomSettings, REPORT_SEQ_WINDOW } from '../lib/partner-game-readout.mjs';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 28, 12);
const dayOf = at => new Date(at).toISOString().slice(0, 10);
// A row as services/game coordinator.mjs audits it: body is JSON text whose payload is JSON text.
let seq = 0;
const settlement = (roomId, roundId, { staked, returned, at = now - DAY, playerId = 'p1', currency = 'USD', type = 'wallet.settlement' } = {}) => ({
  seq: ++seq, room_id: roomId, body: JSON.stringify({ room: roomId, type, at, round_id: roundId,
    payload: JSON.stringify({ playerId, roundId, settledAt: at, staked, returned, net: returned - staked, ...(currency ? { currency } : {}) }) }),
});

// The fixture pool answers the three statements the way PostgreSQL would: the
// readiness probe, the seq bounds and the grouped settlement aggregate.
function fakePool(rows, { ready = true, fail = false, head = null, oldestAt } = {}) {
  const queries = [];
  // Only audit rows parse as body/payload; config rows are answered from `rows` as they are.
  const parsed = rows.flatMap(row => { try { const body = JSON.parse(row.body); return [{ ...row, body, payload: JSON.parse(body.payload) }]; } catch { return []; } });
  const top = head ?? Math.max(0, ...rows.map(row => row.seq));
  return { queries, query: async (text, values) => {
    queries.push({ text, values });
    if (fail) throw new Error('permission denied for table shared_table_audit');
    if (text.includes('to_regclass')) return { rows: [{ ready: ready ? 'croupier_game.shared_table_audit' : null }] };
    if (text.includes('partner-game-readout:bounds')) {
      const floor = Math.max(top - values[0], 1);
      const oldest = parsed.filter(row => row.seq >= floor).sort((a, b) => a.seq - b.seq)[0];
      return { rows: [{ floor: String(floor), oldest_at: oldestAt !== undefined ? oldestAt : oldest ? String(oldest.body.at) : null }] };
    }
    if (text.includes('partner-game-readout:settlements')) {
      const [ids, floor, from, to] = values;
      const groups = new Map();
      for (const row of parsed) {
        if (row.seq < floor || !ids.includes(row.room_id) || row.body.type !== 'wallet.settlement' || row.body.at < from || row.body.at >= to) continue;
        if (typeof row.payload.roundId !== 'string' || !row.payload.roundId || row.payload.staked < 0 || row.payload.returned < 0) continue;
        const key = `${row.room_id}|${dayOf(row.body.at)}|${row.payload.currency ?? ''}`;
        const group = groups.get(key) ?? { room_id: row.room_id, day: dayOf(row.body.at), currency: row.payload.currency ?? null, rounds: new Set(), staked: 0, returned: 0 };
        group.rounds.add(row.payload.roundId); group.staked += row.payload.staked; group.returned += row.payload.returned; groups.set(key, group);
      }
      // PostgreSQL returns bigint and numeric as text.
      return { rows: [...groups.values()].map(group => ({ ...group, rounds: String(group.rounds.size), staked: group.staked.toFixed(2), returned: group.returned.toFixed(2) })) };
    }
    if (text.includes('shared_table_configs')) return { rows: rows.filter(row => values[0].includes(row.room_id)) };
    throw new Error('unexpected query ' + text);
  } };
}

test.beforeEach(() => { clearPartnerGameReadoutCache(); seq = 0; });

test('the aggregate takes the grouped SQL rows per room, day and currency and never invents a room or a day', () => {
  const from = now - 30 * DAY, yesterday = dayOf(now - DAY);
  const report = aggregateReportRows([
    { room_id: 'room-a', day: yesterday, currency: 'USD', rounds: '2', staked: '45.00', returned: '25.00' },
    { room_id: 'room-a', day: dayOf(now - 2 * DAY), currency: 'USD', rounds: '1', staked: '5', returned: '5' },
    { room_id: 'room-b', day: dayOf(now - 3 * DAY), currency: 'USD', rounds: '1', staked: '100', returned: '150' },
    { room_id: 'room-foreign', day: yesterday, currency: 'USD', rounds: '9', staked: '777', returned: '0' },
    { room_id: 'room-a', day: '2020-01-01', currency: 'USD', rounds: '9', staked: '999', returned: '0' },
    { room_id: 'room-a', day: yesterday, currency: 'USD', rounds: 'x', staked: 'nope', returned: '1' },
  ], { roomIds: ['room-a', 'room-b'], from, to: now });
  assert.equal(report.status, 'ready'); assert.equal(report.windowDays, 30); assert.equal(report.currency, 'USD'); assert.deepEqual(report.currencies, ['USD']);
  const a = report.rooms.find(room => room.roomId === 'room-a'), b = report.rooms.find(room => room.roomId === 'room-b');
  assert.deepEqual([a.rounds, a.staked, a.returned, a.net], [3, 50, 30, 20]);
  assert.deepEqual(a.amounts, { USD: { staked: 50, returned: 30, net: 20 } });
  assert.deepEqual([b.rounds, b.staked, b.returned, b.net], [1, 100, 150, -50]);
  assert.equal(a.days.length, 31);
  assert.deepEqual(a.days.find(day => day.day === yesterday), { day: yesterday, rounds: 2, staked: 45, returned: 25, amounts: { USD: { staked: 45, returned: 25 } } });
  assert.equal(report.rooms.some(room => room.roomId === 'room-foreign'), false);
  assert.equal(JSON.stringify(report).includes('999'), false, 'a day outside the window never counts');
});

test('several currencies are summed per currency, never together', () => {
  const day = dayOf(now - DAY);
  const report = aggregateReportRows([
    { room_id: 'room-a', day, currency: 'USD', rounds: '2', staked: '100', returned: '80' },
    { room_id: 'room-a', day, currency: 'EUR', rounds: '1', staked: '10', returned: '30' },
    { room_id: 'room-a', day, currency: null, rounds: '1', staked: '1', returned: '0' },
  ], { roomIds: ['room-a'], from: now - 30 * DAY, to: now });
  assert.equal(report.currency, null); assert.deepEqual(report.currencies, ['', 'EUR', 'USD']);
  assert.deepEqual(report.rooms[0].amounts, { USD: { staked: 100, returned: 80, net: 20 }, EUR: { staked: 10, returned: 30, net: -20 }, '': { staked: 1, returned: 0, net: 1 } });
  assert.equal(report.rooms[0].rounds, 4);
  const single = aggregateReportRows([{ room_id: 'room-a', day, currency: 'SEK', rounds: '1', staked: '10', returned: '0' }], { roomIds: ['room-a'], from: now - 30 * DAY, to: now });
  assert.equal(single.currency, 'SEK');
});

test('the SQL filters on the company rooms, a seq floor and the time window, groups in the database and is cached per company', async () => {
  const pool = fakePool([
    settlement('room-a', 'round-1', { staked: 10, returned: 20, playerId: 'p1' }),
    settlement('room-a', 'round-1', { staked: 30, returned: 0, playerId: 'p2' }),
    settlement('room-a', 'round-2', { staked: 5, returned: 5, at: now - 2 * DAY }),
    settlement('room-b', 'round-9', { staked: 100, returned: 150, at: now - 3 * DAY }),
    settlement('room-a', 'round-old', { staked: 999, returned: 0, at: now - 31 * DAY }),
    settlement('room-foreign', 'round-x', { staked: 777, returned: 0 }),
    settlement('room-a', 'round-3', { staked: 1, returned: 0, type: 'engine.start' }),
  ]);
  const first = await readPartnerReports({ query: pool.query, operatorId: 'north', roomIds: ['room-b', 'room-a', 'room-a'], now });
  assert.equal(first.status, 'ready'); assert.equal(first.truncated, false); assert.equal(first.currency, 'USD');
  const a = first.rooms.find(room => room.roomId === 'room-a'), b = first.rooms.find(room => room.roomId === 'room-b');
  assert.deepEqual([a.rounds, a.staked, a.returned, a.net], [2, 45, 25, 20]);
  assert.deepEqual([b.rounds, b.staked, b.returned, b.net], [1, 100, 150, -50]);
  const yesterday = a.days.find(day => day.day === dayOf(now - DAY));
  assert.deepEqual([yesterday.rounds, yesterday.staked, yesterday.returned], [1, 40, 20]);
  assert.equal(JSON.stringify(first).includes('999'), false); assert.equal(JSON.stringify(first).includes('p1'), false, 'player identities never leave the database');
  const bounds = pool.queries.find(entry => entry.text.includes('partner-game-readout:bounds'));
  assert.deepEqual(bounds.values, [REPORT_SEQ_WINDOW]);
  assert.match(bounds.text, /MAX\(seq\)/); assert.match(bounds.text, /GREATEST\(head\.seq - \$1::bigint, 1\)/);
  const read = pool.queries.find(entry => entry.text.includes('partner-game-readout:settlements'));
  assert.deepEqual(read.values, [['room-a', 'room-b'], 1, now - 30 * DAY, now]);
  assert.match(read.text, /a\.seq >= \$2 AND a\.room_id = ANY\(\$1::text\[\]\) AND a\.body::jsonb->>'type' = 'wallet\.settlement'/);
  assert.match(read.text, /s\.at >= \$3 AND s\.at < \$4/);
  assert.match(read.text, /COUNT\(DISTINCT s\.payload->>'roundId'\)/); assert.match(read.text, /SUM\(s\.staked\)/);
  assert.match(read.text, /CASE WHEN jsonb_typeof\(p\.payload->'staked'\) = 'number' THEN \(p\.payload->>'staked'\)::numeric END/, 'every numeric cast sits behind a type check');
  assert.doesNotMatch(read.text, /AND \(s\.payload->>'staked'\)::numeric/, 'no bare cast in WHERE whose evaluation order PostgreSQL does not promise');
  assert.match(read.text, /GROUP BY s\.room_id, day, currency/);
  assert.equal(first.seqWindow, REPORT_SEQ_WINDOW);
  assert.doesNotMatch(read.text, /LIMIT/, 'the database returns grouped rows, not journal rows');
  assert.equal(pool.queries.length, 3);
  const again = await readPartnerReports({ query: pool.query, operatorId: 'north', roomIds: ['room-a', 'room-b'], now: now + 60_000 });
  assert.equal(again, first, 'a second page view within the cache window makes no query');
  assert.equal(pool.queries.length, 3);
  const later = await readPartnerReports({ query: pool.query, operatorId: 'north', roomIds: ['room-a', 'room-b'], now: now + 10 * 60_000 });
  assert.notEqual(later, first); assert.equal(pool.queries.length, 6);
  const other = await readPartnerReports({ query: pool.query, operatorId: 'south', roomIds: ['room-a'], now });
  assert.notEqual(other, first, 'the cache is per company');
});

test('the seq floor follows the journal head and marks the report truncated when the window does not reach the whole period', async () => {
  const rows = [settlement('room-a', 'round-1', { staked: 10, returned: 0, at: now - 20 * DAY }), settlement('room-a', 'round-2', { staked: 10, returned: 0, at: now - DAY })];
  const pool = fakePool(rows, { head: REPORT_SEQ_WINDOW + 2 });
  const report = await readPartnerReports({ query: pool.query, operatorId: 'north', roomIds: ['room-a'], now });
  const read = pool.queries.find(entry => entry.text.includes('partner-game-readout:settlements'));
  assert.equal(read.values[1], 2, 'the floor is head minus the window, so the first row falls outside');
  assert.equal(report.truncated, true); assert.equal(report.rooms[0].rounds, 1);
  const small = await readPartnerReports({ query: fakePool(rows).query, operatorId: 'west', roomIds: ['room-a'], now, seqWindow: 10 });
  assert.equal(small.truncated, false, 'a journal shorter than the window is complete even when its first row is younger than the period');
  assert.equal(small.rooms[0].rounds, 2); assert.equal(small.seqWindow, 10);
  // The floor row's time cannot be read: the window's reach is unknown, so the report says truncated.
  for (const oldestAt of [null, 'nope']) {
    clearPartnerGameReadoutCache();
    const unknown = await readPartnerReports({ query: fakePool(rows, { head: REPORT_SEQ_WINDOW + 2, oldestAt }).query, operatorId: 'north', roomIds: ['room-a'], now });
    assert.equal(unknown.truncated, true, String(oldestAt));
  }
});

test('the cache drops expired entries on every write and never holds more than the cap', async () => {
  const pool = fakePool([]);
  const ttlMs = 1000;
  await readPartnerReports({ query: pool.query, operatorId: 'a', roomIds: ['room-a'], now, ttlMs });
  await readPartnerReports({ query: pool.query, operatorId: 'b', roomIds: ['room-a'], now: now + 100, ttlMs });
  assert.equal(partnerGameReadoutCacheSize(), 2);
  await readPartnerReports({ query: pool.query, operatorId: 'c', roomIds: ['room-a'], now: now + 1000, ttlMs });
  assert.equal(partnerGameReadoutCacheSize(), 2, 'the expired first entry is gone, the second and third remain');
  await readPartnerReports({ query: pool.query, operatorId: 'd', roomIds: ['room-a'], now: now + 1100, ttlMs });
  assert.equal(partnerGameReadoutCacheSize(), 2);
  clearPartnerGameReadoutCache();
  for (let index = 0; index < CACHE_MAX_ENTRIES + 25; index += 1) await readPartnerReports({ query: pool.query, operatorId: `company-${index}`, roomIds: ['room-a'], now, ttlMs: 60_000 });
  assert.equal(partnerGameReadoutCacheSize(), CACHE_MAX_ENTRIES);
  const queries = pool.queries.length;
  await readPartnerReports({ query: pool.query, operatorId: `company-${CACHE_MAX_ENTRIES + 24}`, roomIds: ['room-a'], now, ttlMs: 60_000 });
  assert.equal(pool.queries.length, queries, 'the newest entries are the ones kept');
  await readPartnerReports({ query: pool.query, operatorId: 'company-0', roomIds: ['room-a'], now, ttlMs: 60_000 });
  assert.ok(pool.queries.length > queries, 'the oldest entry was evicted');
});

test('the readout never throws: missing table, denied read, no pool and no rooms all answer honestly', async () => {
  assert.deepEqual(await readPartnerReports({ query: fakePool([], { ready: false }).query, operatorId: 'x', roomIds: ['room-a'], now }), { status: 'not-connected', reason: 'table-missing' });
  assert.deepEqual(await readPartnerReports({ query: fakePool([], { fail: true }).query, operatorId: 'y', roomIds: ['room-a'], now }), { status: 'not-connected', reason: 'read-failed' });
  assert.deepEqual(await readPartnerReports({ query: null, operatorId: 'z', roomIds: ['room-a'], now }), { status: 'not-connected', reason: 'no-pool' });
  const pool = fakePool([]);
  const none = await readPartnerReports({ query: pool.query, operatorId: 'empty', roomIds: [], now });
  assert.equal(none.status, 'ready'); assert.deepEqual(none.rooms, []); assert.equal(pool.queries.length, 1, 'no rooms, no journal query');
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

// The same statements against PostgreSQL (PGlite with the game schema): the JSON
// casts, the day bucket and the grouping run in the database, not in Node.
test('the settlement SQL runs on the real game schema and groups per room, day and currency', async t => {
  const { createPglitePool } = await import('../../../test/fixtures/pglite-pool.mjs');
  const pool = await createPglitePool(); t.after(() => pool.end());
  const audit = async (roomId, type, at, payload, roundId = payload.roundId ?? null) => {
    const row = { room: roomId, round_id: roundId, at, parent: null, type, payload: JSON.stringify(payload), previous_hash: 'x', hash: 'y' };
    await pool.query('INSERT INTO croupier_game.shared_table_audit(seq,room_id,body) VALUES($1,$2,$3)', [++seq, roomId, JSON.stringify(row)]);
  };
  await audit('room-a', 'table.tick', now - 40 * DAY, { kind: 'window.close' });
  await audit('room-a', 'wallet.settlement', now - 31 * DAY, { playerId: 'p1', roundId: 'old', settledAt: now - 31 * DAY, staked: 999, returned: 0, currency: 'USD' });
  await audit('room-a', 'wallet.settlement', now - DAY, { playerId: 'p1', roundId: 'r1', settledAt: now - DAY, staked: 10, returned: 20, currency: 'USD' });
  await audit('room-a', 'wallet.settlement', now - DAY, { playerId: 'p2', roundId: 'r1', settledAt: now - DAY, staked: 30, returned: 0, currency: 'USD' });
  await audit('room-a', 'wallet.settlement', now - 2 * DAY, { playerId: 'p1', roundId: 'r2', settledAt: now - 2 * DAY, staked: 5.5, returned: 5.25, currency: 'USD' });
  await audit('room-a', 'engine.start', now - 2 * DAY, { shoeId: 's', draws: [] }, 'r2');
  await audit('room-b', 'wallet.settlement', now - 3 * DAY, { playerId: 'p3', roundId: 'r9', settledAt: now - 3 * DAY, staked: 100, returned: 150, currency: 'EUR' });
  await audit('room-foreign', 'wallet.settlement', now - DAY, { playerId: 'p4', roundId: 'rx', settledAt: now - DAY, staked: 777, returned: 0, currency: 'USD' });
  // Damaged rows are skipped, never fatal: text where a number belongs, a missing amount, a text timestamp, an empty round id.
  await audit('room-a', 'wallet.settlement', now - DAY, { playerId: 'p9', roundId: 'broken-1', settledAt: now - DAY, staked: 'abc', returned: 5, currency: 'USD' });
  await audit('room-a', 'wallet.settlement', now - DAY, { playerId: 'p9', roundId: 'broken-2', settledAt: now - DAY, staked: 5, returned: null, currency: 'USD' });
  await audit('room-a', 'wallet.settlement', 'yesterday', { playerId: 'p9', roundId: 'broken-3', settledAt: now - DAY, staked: 5, returned: 5, currency: 'USD' });
  await audit('room-a', 'wallet.settlement', now - DAY, { playerId: 'p9', roundId: '', settledAt: now - DAY, staked: 5, returned: 5, currency: 'USD' });
  const query = (text, values) => pool.query(text, values);
  const report = await readPartnerReports({ query, operatorId: 'north', roomIds: ['room-a', 'room-b'], now });
  assert.equal(report.status, 'ready'); assert.equal(report.truncated, false);
  assert.equal(report.currency, null); assert.deepEqual(report.currencies, ['EUR', 'USD']);
  const a = report.rooms.find(room => room.roomId === 'room-a'), b = report.rooms.find(room => room.roomId === 'room-b');
  assert.deepEqual([a.rounds, a.staked, a.returned, a.net], [2, 45.5, 25.25, 20.25]);
  assert.deepEqual(a.amounts, { USD: { staked: 45.5, returned: 25.25, net: 20.25 } });
  assert.deepEqual(a.days.find(day => day.day === dayOf(now - DAY)), { day: dayOf(now - DAY), rounds: 1, staked: 40, returned: 20, amounts: { USD: { staked: 40, returned: 20 } } });
  assert.deepEqual([b.rounds, b.amounts], [1, { EUR: { staked: 100, returned: 150, net: -50 } }]);
  assert.equal(JSON.stringify(report).includes('999'), false); assert.equal(JSON.stringify(report).includes('p1'), false);
  assert.equal(JSON.stringify(report).includes('broken'), false, 'damaged rows are skipped, not counted');
  clearPartnerGameReadoutCache();
  // The last five rows: room-b's settlement and the four damaged rows; room-a's rounds fall outside.
  const narrow = await readPartnerReports({ query, operatorId: 'north', roomIds: ['room-a', 'room-b'], now, seqWindow: 5 });
  assert.equal(narrow.truncated, true, 'a window of five rows from the head cannot reach thirty days back');
  assert.deepEqual([narrow.rooms[0].rounds, narrow.rooms[1].rounds], [0, 1]);
});
