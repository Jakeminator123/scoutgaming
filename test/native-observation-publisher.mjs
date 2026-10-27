import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createNativeObservationPublisher, NATIVE_OBSERVATION_EVENTS } from '../services/game/native-observation-publisher.mjs';
import { createPostgresNativeTableCommand } from '../services/game/postgres-native-table.mjs';
import { command, newGame } from '../services/game/shoe-game.mjs';

const card = (r, s) => ({ r, s, shoeDraw: 3 });
// splitFrom 0 is a split; a busted hand loses even with a positive result.
const settledRound = { phase: 'settled', dealer: [card('9', '♣'), card('8', '♦')], hands: [
  { box: 0, stake: 10, cards: [card('K', '♠'), card('Q', '♥')], splitFrom: null, busted: false, result: 20 },
  { box: 1, stake: 0, cards: [card('2', '♠'), card('3', '♠')], splitFrom: null, busted: false, result: 0 },
  { box: 2, stake: 10, cards: [card('8', '♠'), card('9', '♥')], splitFrom: 0, busted: false, result: 10 },
  { box: 3, stake: 10, cards: [card('K', '♣'), card('7', '♦'), card('5', '♥')], busted: true, result: 20 },
  { box: 4, stake: 10, cards: [card('7', '♣'), card('9', '♦')], splitFrom: 2, busted: false, result: 0 },
] };
const expectedHands = [
  { handIndex: 0, box: 0, cards: [{ r: 'K', s: '♠' }, { r: 'Q', s: '♥' }], split: false, outcome: 'win' },
  { handIndex: 1, box: 2, cards: [{ r: '8', s: '♠' }, { r: '9', s: '♥' }], split: true, outcome: 'push' },
  { handIndex: 2, box: 3, cards: [{ r: 'K', s: '♣' }, { r: '7', s: '♦' }, { r: '5', s: '♥' }], split: false, outcome: 'lose' },
  { handIndex: 3, box: 4, cards: [{ r: '7', s: '♣' }, { r: '9', s: '♦' }], split: true, outcome: 'lose' },
];
const scope = { playerId: 'player-1', dealerId: 'astrid' };

function observation({ dealer = 'astrid', op = 'collect', round = settledRound, partnerKeyId = 'partner-key-1' } = {}) {
  return { session: { playerId: 'player-1', partnerKeyId }, playerId: 'player-1', balance: 1010,
    previousView: { version: 6, shoe: { id: 'shoe-1' }, round }, view: { version: 7, shoe: { id: 'shoe-1' }, round: null },
    command: { op, dealer, version: 6, requestId: 'request-1' } };
}

function fixture({ cancel, completedRound, publishNativeRound, partner, observeCommitted, warn } = {}) {
  const calls = [], warnings = [], db = { fake: 'db' };
  let movingSpeech = { observeCommitted: value => { calls.push(['observeCommitted', value]); observeCommitted?.(); } };
  const publisher = createNativeObservationPublisher({ db,
    probeRuntime: {
      async cancel(...args) { calls.push(['cancel', ...args]); await cancel?.(); },
      async completedRound(...args) { calls.push(['completedRound', ...args]); await completedRound?.(); },
    },
    partner: async () => { calls.push(['partner']); await partner?.(); return {
      async publishNativeRound(value) { calls.push(['publishNativeRound', value]); await publishNativeRound?.(); return true; } }; },
    getPlayer: async id => { calls.push(['getPlayer', id]); return { id, currency: 'EUR' }; },
    readPlayerResults: async (...args) => { calls.push(['readPlayerResults', ...args]); return { currencies: [{ rounds: 3 }, { rounds: 4 }] }; },
    movingSpeech: () => movingSpeech,
    warn: warn ?? (line => warnings.push(JSON.parse(line))),
  });
  return { ...publisher, calls, warnings, db, names: () => calls.map(([name]) => name),
    setMovingSpeech: value => { movingSpeech = value; } };
}

test('an Astrid settled collect cancels the probe, reports the completed round, then publishes to the partner', async () => {
  const f = fixture(), observed = observation();
  await f.publish(observed);
  assert.deepEqual(f.names(), ['observeCommitted', 'cancel', 'getPlayer', 'readPlayerResults', 'completedRound', 'partner', 'publishNativeRound']);
  assert.deepEqual(f.calls[1], ['cancel', scope], 'activity cancel keeps its default reason');
  assert.deepEqual(f.calls[3], ['readPlayerResults', f.db, 'player-1', {}, 'EUR']);
  assert.equal(f.calls[3][1], f.db);
  assert.deepEqual(f.calls[4], ['completedRound', scope, { roundId: 'collected-shoe-1-7', sequence: 7, hands: expectedHands }]);
  assert.equal(f.calls[0][1], observed);
  assert.equal(f.calls[6][1], observed, 'the partner receives the committed observation unchanged');
  assert.deepEqual(f.warnings, []);
});

test('Astrid commands other than a settled collect only cancel the probe', async () => {
  for (const observed of [observation({ op: 'act' }), observation({ op: 'start', round: null }), observation({ round: { ...settledRound, phase: 'decisions' } }),
    observation({ round: null })]) {
    const f = fixture();
    await f.publish(observed);
    assert.deepEqual(f.names(), ['observeCommitted', 'cancel', 'partner', 'publishNativeRound'], observed.command.op);
    assert.deepEqual(f.warnings, []);
  }
});

test('non-Astrid rooms never touch the probe and still publish the partner round', async () => {
  for (const dealer of ['paow', 'dragan', null, 'Astrid']) {
    const f = fixture(), observed = observation({ dealer });
    if (dealer === null) delete observed.command.dealer;
    await f.publish(observed);
    assert.deepEqual(f.names(), ['observeCommitted', 'partner', 'publishNativeRound'], String(dealer));
    assert.deepEqual(f.warnings, []);
  }
});

test('ordinary sessions never load the partner API', async () => {
  for (const dealer of ['astrid', 'paow']) {
    const f = fixture(), observed = observation({ dealer, op: 'act', partnerKeyId: null });
    await f.publish(observed);
    await f.publish({ ...observed, session: null });
    assert.equal(f.names().includes('partner'), false, dealer);
    assert.deepEqual(f.warnings, []);
  }
});

test('a failed probe cancel cannot withhold the partner round and logs only the probe event', async () => {
  const unavailable = () => { throw Object.assign(Error('player_memory_dealer_unavailable player-1'), { statusCode: 403 }); };
  const f = fixture({ cancel: unavailable });
  await f.publish(observation());
  assert.deepEqual(f.names(), ['observeCommitted', 'cancel', 'partner', 'publishNativeRound']);
  assert.deepEqual(f.warnings, [{ event: NATIVE_OBSERVATION_EVENTS.probe }]);
  assert.equal(f.warnings[0].event, 'native_observation_probe_failed');
  const late = fixture({ completedRound: unavailable });
  await late.publish(observation());
  assert.deepEqual(late.names().slice(-2), ['partner', 'publishNativeRound']);
  assert.deepEqual(late.warnings, [{ event: NATIVE_OBSERVATION_EVENTS.probe }]);
});

test('a failed partner publication is logged without error text and never escapes publish', async () => {
  const lines = [];
  const f = fixture({ publishNativeRound: () => { throw Error('secret partner-key-1 player-1'); }, warn: line => lines.push(line) });
  await assert.doesNotReject(f.publish(observation()));
  assert.deepEqual(f.names(), ['observeCommitted', 'cancel', 'getPlayer', 'readPlayerResults', 'completedRound', 'partner', 'publishNativeRound']);
  assert.deepEqual(lines.map(line => JSON.parse(line)), [{ event: NATIVE_OBSERVATION_EVENTS.partner }]);
  assert.doesNotMatch(lines.join('\n'), /secret|player-1|partner-key-1/);
  const install = fixture({ partner: () => { throw Error('partner install failed'); } });
  await assert.doesNotReject(install.publish(observation({ dealer: 'paow' })));
  assert.deepEqual(install.warnings, [{ event: NATIVE_OBSERVATION_EVENTS.partner }]);
});

test('a failed moving-speech observer cannot skip the probe or partner round', async () => {
  const f = fixture({ observeCommitted: () => { throw Error('moving'); } });
  await f.publish(observation());
  assert.deepEqual(f.names(), ['observeCommitted', 'cancel', 'getPlayer', 'readPlayerResults', 'completedRound', 'partner', 'publishNativeRound']);
  assert.deepEqual(f.warnings, [{ event: NATIVE_OBSERVATION_EVENTS.movingSpeech }]);
});

test('the moving-speech runtime is read when each observation is published', async () => {
  const f = fixture();
  f.setMovingSpeech(null);
  await f.publish(observation({ dealer: 'paow' }));
  f.setMovingSpeech({ observeCommitted: value => f.calls.push(['late', value]) });
  await f.publish(observation({ dealer: 'paow' }));
  assert.deepEqual(f.names(), ['partner', 'publishNativeRound', 'late', 'partner', 'publishNativeRound']);
  assert.deepEqual(f.warnings, []);
});

test('diagnostics never fail: every concern failing with a throwing logger still resolves', async () => {
  const fail = () => { throw Error('fail'); }, warn = () => { throw Error('logger down'); };
  const f = fixture({ cancel: fail, publishNativeRound: fail, observeCommitted: fail, warn });
  await assert.doesNotReject(f.publish(observation()));
  assert.doesNotThrow(() => f.onPublishError());
  const lines = [], logged = fixture({ warn: line => lines.push(line) });
  assert.equal(logged.onPublishError(), undefined);
  assert.deepEqual(lines.map(line => JSON.parse(line)), [{ event: NATIVE_OBSERVATION_EVENTS.publish }]);
});

// The production Postgres table command over a fake pool (the test/postgres-native-table.mjs
// pattern) proves which request field reaches the committed observation. No database is opened.
function nativeTable(probeRuntime) {
  const calls = [], warnings = [];
  // Player 8+9 stands on 17; dealer 6+K draws 5.
  const game = newGame(); command(game, { op: 'state' }, 1000);
  const draws = [['8', '♠'], ['6', '♥'], ['9', '♣'], ['K', '♦'], ['5', '♠']].map(([r, s]) => ({ r, s }));
  game.shoe.cards.splice(-draws.length, draws.length, ...draws.reverse());
  let state = { players: { 'player-1': { id: 'player-1', name: 'Fixture', currency: 'EUR', balance: '1000.00', status: 'active' } },
    tables: { 'player-1': JSON.stringify(game) }, presentations: {} };
  const pool = { async connect() {
    let tx;
    return { release() {}, async query(sql, args = []) {
      if (sql.startsWith('BEGIN;')) { tx = structuredClone(state); return { rows: [] }; }
      if (sql === 'COMMIT') { state = tx; tx = undefined; return { rows: [] }; }
      if (sql === 'ROLLBACK') { tx = undefined; return { rows: [] }; }
      if (sql.startsWith('SELECT id, name, currency, balance')) return { rows: tx.players[args[0]] ? [tx.players[args[0]]] : [] };
      if (sql.startsWith('SELECT state FROM blackjack_tables')) return { rows: tx.tables[args[0]] ? [{ state: tx.tables[args[0]] }] : [] };
      if (sql.startsWith('INSERT INTO blackjack_tables')) { tx.tables[args[0]] = args[1]; return { rows: [] }; }
      if (sql.startsWith('UPDATE players SET balance')) { tx.players[args[1]].balance = String(args[0]); return { rows: [] }; }
      if (sql.startsWith('INSERT INTO transactions')) return { rows: [] };
      if (sql.startsWith('INSERT INTO native_presentations')) { tx.presentations[args[0]] = args.slice(1); return { rows: [] }; }
      throw new Error(`Unexpected SQL: ${sql}`);
    } };
  } };
  const getPlayer = async id => state.players[id];
  const publisher = createNativeObservationPublisher({ db: {}, getPlayer, probeRuntime: probeRuntime(calls),
    partner: () => ({ publishNativeRound: value => calls.push(['publishNativeRound', value.command.op]) }),
    readPlayerResults: async () => ({ currencies: [{ rounds: 1 }] }), warn: line => warnings.push(JSON.parse(line)) });
  const native = createPostgresNativeTableCommand({ pool, ...publisher });
  const bets = [{ main: 5, pp: 0, tp: 0 }, ...Array.from({ length: 6 }, () => ({ main: 0, pp: 0, tp: 0 }))];
  // The Postgres command awaits publish after COMMIT, so every call is recorded on return.
  const play = (op, dealer, fields = op === 'start' ? { bets } : {}) => native({ id: 'player-1', op, version: JSON.parse(state.tables['player-1']).version,
    requestId: randomUUID(), dealer, ...fields }, { playerId: 'player-1', partnerKeyId: 'partner-key-1' });
  return { play, calls, warnings };
}

test('a real Astrid table reports the settled round from the committed collect', async () => {
  const f = nativeTable(calls => ({ async cancel(...args) { calls.push(['cancel', ...args]); },
    async completedRound(...args) { calls.push(['completedRound', ...args]); } }));
  await f.play('start', 'astrid');
  assert.equal((await f.play('act', 'astrid', { action: 'stand' })).round.phase, 'settled');
  const paid = await f.play('collect', 'astrid');
  assert.equal(paid.round, null);
  assert.deepEqual(f.calls.map(([name]) => name), ['cancel', 'publishNativeRound', 'cancel', 'publishNativeRound',
    'cancel', 'completedRound', 'publishNativeRound']);
  assert.deepEqual(f.calls.at(-2), ['completedRound', scope, { roundId: `collected-${paid.shoe.id}-${paid.version}`, sequence: 1,
    hands: [{ handIndex: 0, box: 0, cards: [{ r: '8', s: '♠' }, { r: '9', s: '♣' }], split: false, outcome: 'lose' }] }]);
  assert.deepEqual(f.warnings, []);
});

test('a real PAOW table skips the probe and a failing Astrid probe still publishes every partner round', async () => {
  const f = nativeTable(calls => ({ async cancel() { calls.push(['cancel']); throw Error('player_memory_dealer_unavailable'); },
    async completedRound() { calls.push(['completedRound']); } }));
  await f.play('start', 'paow');
  assert.deepEqual(f.calls, [['publishNativeRound', 'start']], 'a PAOW room never reaches the probe');
  await f.play('act', 'astrid', { action: 'stand' });
  await f.play('collect', 'astrid');
  assert.deepEqual(f.calls.slice(1), [['cancel'], ['publishNativeRound', 'act'], ['cancel'], ['publishNativeRound', 'collect']]);
  assert.deepEqual(f.warnings, [{ event: NATIVE_OBSERVATION_EVENTS.probe }, { event: NATIVE_OBSERVATION_EVENTS.probe }]);
});
