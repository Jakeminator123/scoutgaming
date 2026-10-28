import test from 'node:test';
import assert from 'node:assert/strict';
import { readPlayerResults } from '../services/game/storage/async-player-results.mjs';
import { normalizeProductSpeechEnvelope } from '../packages/director/product-speech.mjs';
import { projectOpenClawGameStatus } from '../services/game/openclaw-chat.mjs';
import { createPlayerHistoryHandler } from '../services/game/player-history.mjs';
import { createTableCoordinator } from '../services/game/games/blackjack/table/coordinator.mjs';
import { createPostgresTableStore } from '../services/game/games/blackjack/table/postgres-store.mjs';
import { createPostgresStore } from '../packages/storage/server/postgres-store.mjs';
import { createPglitePool } from './fixtures/pglite-pool.mjs';
import { DEFAULT_CONFIG } from './fixtures/blackjack-table-memory-store.mjs';
import { deterministicRandom } from './fixtures/blackjack-deterministic-random.mjs';

// Transaction ledger fake: the query must keep its owner, game and money-type
// predicates; the fake applies exactly those predicates to the stored rows.
function ledgerDb() {
  const transactions = [];
  return {
    transactions,
    prepare(sql) {
      const query = sql.replace(/\s+/g, ' ');
      // No shared table schema in this fake: the reader must ask before it reads.
      if (/to_regclass\('croupier_game\.shared_table_audit'\)/.test(query)) return { all: async () => [{ ready: null }] };
      assert.match(query, /^SELECT id, type, amount, currency, at FROM transactions WHERE player_id=\? /);
      assert.match(query, / AND meta='server blackjack' /);
      assert.match(query, / AND type IN \('start','act','insurance','collect'\) /);
      assert.match(query, / ORDER BY id$/);
      const types = new Set(['start', 'act', 'insurance', 'collect']);
      return { all: async playerId => transactions
        .filter(row => row.player_id === playerId && row.meta === 'server blackjack' && types.has(row.type))
        .sort((a, b) => a.id - b.id)
        .map(({ id, type, amount, currency, at }) => ({ id, type, amount, currency, at })) };
    },
  };
}

test('profile results separate profits, losses, returned stakes, currencies and uncollected play', async () => {
  const db = ledgerDb();
  const add = (type, amount, currency = 'USD', player = 'one', meta = 'server blackjack') =>
    db.transactions.push({ id: db.transactions.length + 1, player_id: player, type, amount, currency, meta });
  add('open', 1000, 'USD', 'one', 'starting demo balance');
  add('start', -5); add('collect', 10); // net +5
  add('start', -10); // zero collection is deliberately absent; net -10
  add('deposit', 500, 'USD', 'one', 'demo test card');
  add('start', -5); add('act', -5); add('insurance', -2.5); add('collect', 12.5); // push after all costs
  add('start', -7, 'EUR'); add('collect', 21, 'EUR');
  add('start', -2000, 'USD', 'other'); add('collect', 4000, 'USD', 'other');
  add('start', -20, 'USD'); add('act', -20); // current uncollected round
  const result = await readPlayerResults(db, 'one', { round: { phase: 'decisions' }, paid: false }, 'USD');
  assert.deepEqual(result.currencies, [
    { currency:'USD', rounds:3, won:5, lost:10, net:-5, wagered:27.5, returned:22.5 },
    { currency:'EUR', rounds:1, won:14, lost:0, net:14, wagered:7, returned:21 },
  ]);
  assert.deepEqual(result.currentRound, { currency:'USD', wagered:40, phase:'decisions' });
  assert.deepEqual(result.lastRound, {roundId:'native-ledger-10',currency:'EUR',wagered:7,returned:21,net:14,outcome:'win'});
  const collected = await readPlayerResults(db, 'one', { round: { phase:'settled' }, paid:true }, 'USD');
  assert.equal(collected.currencies[0].lost, 50);
  assert.equal(collected.currencies[0].net, -45);
  assert.equal(collected.currentRound, null);
  assert.equal(collected.lastRound.net,-40);
  assert.equal(collected.lastRound.outcome,'loss');
  assert.equal((await readPlayerResults(db,'new',{},'SEK')).lastRound,null);
  assert.deepEqual((await readPlayerResults(db, 'new', {}, 'SEK')).currencies,
    [{ currency:'SEK', rounds:0, won:0, lost:0, net:0, wagered:0, returned:0 }]);
});

// Real PostgreSQL (PGlite) with the real shared table coordinator and store: the
// history must contain the shared round exactly as its own ledger and receipt say.
test('history merges settled shared table rounds per player in time order and keeps native history unchanged', async t => {
  const pool = await createPglitePool(); t.after(() => pool.end());
  const db = createPostgresStore({ pool }).db, store = createPostgresTableStore({ pool, walletMode: 'demo' });
  let at = Date.parse('2026-10-28T11:00:00.000Z');
  const table = createTableCoordinator({ store, clock: { now: () => at }, random: deterministicRandom('shared-history-c') });
  for (const id of ['alice', 'bob', 'carol'])
    await pool.query('INSERT INTO croupier_game.players(id,name,balance,currency,created_at) VALUES($1,$2,$3,$4,$5)', [id, 'Synthetic', 1000, 'SEK', '2026-10-28T00:00:00.000Z']);
  const native = (player, type, amount, time) => pool.query('INSERT INTO croupier_game.transactions(player_id,type,amount,currency,meta,at) VALUES($1,$2,$3,$4,$5,$6)',
    [player, type, amount, 'SEK', 'server blackjack', time]);
  // Native rounds before the shared round: alice +15, carol a won and a lost round.
  await native('alice', 'start', -10, '2026-10-28T10:00:00.000Z'); await native('alice', 'collect', 25, '2026-10-28T10:00:05.000Z');
  await native('carol', 'start', -5, '2026-10-28T10:00:00.000Z'); await native('carol', 'collect', 10, '2026-10-28T10:00:05.000Z');
  await native('carol', 'start', -7, '2026-10-28T10:01:00.000Z');
  const settled = { round: null, paid: true };
  const nativeOnly = await readPlayerResults(db, 'carol', settled, 'SEK');
  assert.deepEqual(nativeOnly.currencies, [{ currency: 'SEK', rounds: 2, won: 5, lost: 7, net: -2, wagered: 12, returned: 10 }]);
  assert.deepEqual(await readPlayerResults(db, 'alice', settled, 'SEK'), { scope: 'saved-demo-profile', accounting: 'collected-rounds',
    currencies: [{ currency: 'SEK', rounds: 1, won: 15, lost: 0, net: 15, wagered: 10, returned: 25 }],
    lastRound: { roundId: 'native-ledger-1', currency: 'SEK', wagered: 10, returned: 25, net: 15, outcome: 'win' }, currentRound: null });

  await store.config.publish('party', 'v1', structuredClone(DEFAULT_CONFIG));
  const send = (actorId, op, extra) => table.command({ actorId }, { roomId: 'party', op, commandId: `${actorId}-${op}-${at}`, ...extra });
  await send('alice', 'join', { seats: [0], seatGens: { 0: 0 }, memberGen: 0 });
  await send('bob', 'join', { seats: [1], seatGens: { 1: 0 }, memberGen: 0 });
  const windowId = (await table.snapshot('party', 'alice')).windowId;
  await send('alice', 'bet', { seat: 0, field: 'main', chip: 25, windowId });
  await send('bob', 'bet', { seat: 1, field: 'main', chip: 10, windowId });
  await send('alice', 'ready', { windowId }); await send('bob', 'ready', { windowId });
  for (let i = 0; i < 20 && (await table.snapshot('party', 'alice')).phase !== 'settled'; i++) {
    at += 20000;
    for (const due of await table.dueTicks(at)) await table.tick(due);
  }
  assert.equal((await table.snapshot('party', 'alice')).phase, 'settled');
  // Seed chosen so the round covers both outcomes: alice wins 2:1, bob loses.
  for (const [player, stake, paid] of [['alice', 25, 50], ['bob', 10, 0]]) {
    const receipt = (await table.snapshot('party', player)).me.lastSettlement;
    const ledger = (await pool.query("SELECT type,amount FROM croupier_game.transactions WHERE player_id=$1 AND meta='shared blackjack demo' ORDER BY id", [player])).rows
      .map(row => ({ type: row.type, amount: Number(row.amount) }));
    const wagered = -ledger.filter(row => row.amount < 0).reduce((sum, row) => sum + row.amount, 0);
    const returned = ledger.filter(row => row.type === 'payout').reduce((sum, row) => sum + row.amount, 0);
    assert.equal(wagered, stake); assert.equal(returned, paid); assert.equal(receipt.staked, wagered); assert.equal(receipt.returned, returned);
    const result = await readPlayerResults(db, player, settled, 'SEK'), net = returned - wagered;
    const sharedRound = { roundId: `shared-party-${receipt.roundId}`, currency: 'SEK', wagered, returned, net, outcome: net > 0 ? 'win' : net < 0 ? 'loss' : 'push' };
    assert.deepEqual(result.lastRound, sharedRound, `${player}: the later shared round is the last round`);
    const nativeNet = player === 'alice' ? 15 : 0;
    assert.deepEqual(result.currencies, [{ currency: 'SEK', rounds: player === 'alice' ? 2 : 1,
      won: (player === 'alice' ? 15 : 0) + Math.max(0, net), lost: Math.max(0, -net), net: nativeNet + net,
      wagered: (player === 'alice' ? 10 : 0) + wagered, returned: (player === 'alice' ? 25 : 0) + returned }]);
  }
  // /api/history's handler: the same round without identifiers.
  const history = await createPlayerHistoryHandler({ db, readPlayerResults, getPlayer: async id => ({ id, currency: 'SEK' }),
    readGame: async () => settled })('bob');
  assert.equal(history.currencies[0].rounds, 1); assert.equal(JSON.stringify(history).includes('shared-party'), false);
  // A shared round still in play is not a result; the native history of others is untouched.
  const done = await table.snapshot('party', 'alice');
  at = Math.max(at, done.plan.endAt); await send('alice', 'next', { roundId: done.roundId });
  const next = (await table.snapshot('party', 'alice')).windowId;
  at += 1000; await send('alice', 'bet', { seat: 0, field: 'main', chip: 25, windowId: next });
  await send('alice', 'ready', { windowId: next });
  assert.equal((await table.snapshot('party', 'alice')).phase, 'round');
  assert.equal((await readPlayerResults(db, 'alice', settled, 'SEK')).currencies[0].rounds, 2);
  assert.deepEqual(await readPlayerResults(db, 'carol', settled, 'SEK'), nativeOnly);
});

test('optional results are allowlisted and validated at both sides of the speech relay', () => {
  const result = { scope:'saved-demo-profile', accounting:'collected-rounds',
    currencies:[{ currency:'USD', rounds:2, won:5, lost:10, net:-5, wagered:15, returned:10 }],
    currentRound:{ currency:'USD', wagered:5, phase:'decisions' }, private:'never forward' };
  const status = projectOpenClawGameStatus({ dealerId:'astrid', sessionRevision:1, roundRevision:1, playResults:result,
    policy:{ recordedLines:[], generatedText:true, silence:true, mediaFamilies:[] } });
  assert.equal('private' in status.playResults, false);
  const envelope = { request:{ requestId:'results-test', message:'My results?', history:[] }, status };
  assert.deepEqual(normalizeProductSpeechEnvelope(envelope).status.playResults, status.playResults);
  for (const change of [
    value => { value.currencies[0].net = 100; },
    value => { value.currencies[0].currency = 'PRIVATE'; },
    value => { value.currencies[0].wallet = 1000; },
    value => { value.currentRound.holeCard = 'A'; },
    value => { value.accounting = 'all wagers are losses'; },
  ]) {
    const invalid = structuredClone(envelope); change(invalid.status.playResults);
    assert.throws(() => normalizeProductSpeechEnvelope(invalid), /invalid_play_results/);
  }
});
