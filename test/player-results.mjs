import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readPlayerResults } from '../web/player-results.mjs';
import { normalizeProductSpeechEnvelope } from '../open-claw/lab/src/product-speech.mjs';
import { projectOpenClawGameStatus } from '../web/openclaw-chat.mjs';

test('profile results separate profits, losses, returned stakes, currencies and uncollected play', t => {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  db.exec('CREATE TABLE transactions (id INTEGER PRIMARY KEY, player_id TEXT, type TEXT, amount REAL, currency TEXT, meta TEXT)');
  const add = (type, amount, currency = 'USD', player = 'one', meta = 'server blackjack') =>
    db.prepare('INSERT INTO transactions(player_id,type,amount,currency,meta) VALUES (?,?,?,?,?)').run(player,type,amount,currency,meta);
  add('open', 1000, 'USD', 'one', 'starting demo balance');
  add('start', -5); add('collect', 10); // net +5
  add('start', -10); // zero collection is deliberately absent; net -10
  add('deposit', 500, 'USD', 'one', 'demo test card');
  add('start', -5); add('act', -5); add('insurance', -2.5); add('collect', 12.5); // push after all costs
  add('start', -7, 'EUR'); add('collect', 21, 'EUR');
  add('start', -2000, 'USD', 'other'); add('collect', 4000, 'USD', 'other');
  add('start', -20, 'USD'); add('act', -20); // current uncollected round
  const result = readPlayerResults(db, 'one', { round: { phase: 'decisions' }, paid: false }, 'USD');
  assert.deepEqual(result.currencies, [
    { currency:'USD', rounds:3, won:5, lost:10, net:-5, wagered:27.5, returned:22.5 },
    { currency:'EUR', rounds:1, won:14, lost:0, net:14, wagered:7, returned:21 },
  ]);
  assert.deepEqual(result.currentRound, { currency:'USD', wagered:40, phase:'decisions' });
  const collected = readPlayerResults(db, 'one', { round: { phase:'settled' }, paid:true }, 'USD');
  assert.equal(collected.currencies[0].lost, 50);
  assert.equal(collected.currencies[0].net, -45);
  assert.equal(collected.currentRound, null);
  assert.deepEqual(readPlayerResults(db, 'new', {}, 'SEK').currencies,
    [{ currency:'SEK', rounds:0, won:0, lost:0, net:0, wagered:0, returned:0 }]);
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
