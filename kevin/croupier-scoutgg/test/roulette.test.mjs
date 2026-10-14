import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BETS, BET_BY_ID, WHEEL, pocketColor, settle } from '../public/roulette/rules.js';
import { createRoulette, BET_MS, SPIN_MS, RESULT_MS } from '../server/roulette.mjs';

test('the wheel holds each pocket 0–36 once and the board pays European odds', () => {
  assert.equal(WHEEL.length, 37);
  assert.deepEqual([...WHEEL].sort((a, b) => a - b), Array.from({ length: 37 }, (_, i) => i));
  assert.equal(pocketColor(0), 'green'); assert.equal(pocketColor(32), 'red'); assert.equal(pocketColor(15), 'black');
  assert.equal(BET_BY_ID['straight-17'].payout, 35);
  assert.equal(BET_BY_ID['split-1-2'].payout, 17);
  assert.equal(BET_BY_ID['street-1'].payout, 11);
  assert.equal(BET_BY_ID['corner-1'].payout, 8);
  assert.equal(BET_BY_ID['line-1'].payout, 5);
  assert.equal(BET_BY_ID['dozen-2'].payout, 2);
  assert.equal(BET_BY_ID['column-3'].payout, 2);
  for (const id of ['red', 'black', 'odd', 'even', 'low', 'high']) assert.equal(BET_BY_ID[id].payout, 1);
  assert.equal(new Set(BETS.map(b => b.id)).size, BETS.length);
});

test('zero loses every outside bet; a straight returns 36 times the stake', () => {
  assert.deepEqual(settle({ red: 10, black: 10, odd: 5, 'dozen-1': 5 }, 0), { returned: 0, wins: [] });
  assert.deepEqual(settle({ 'straight-0': 2, red: 10 }, 0), { returned: 72, wins: ['straight-0'] });
  assert.deepEqual(settle({ red: 10, 'dozen-3': 5, 'column-3': 5 }, 36), { returned: 50, wins: ['red', 'dozen-3', 'column-3'] });
});

function room(draws) {
  const dir = mkdtempSync(join(tmpdir(), 'roulette-')); let t = 1_000_000;
  const rl = createRoulette(join(dir, 'r.db'), { now: () => t, draw: () => draws.shift() });
  let n = 0; const req = (token, input) => rl.run(token, { session: 'rl-test', requestId: String(++n), ...input });
  return { rl, req, tick: ms => { t += ms; }, done: () => { rl.close(); rmSync(dir, { recursive: true, force: true }); } };
}
const A = 'a'.repeat(64), B = 'b'.repeat(64);

test('a round: the first chip opens 15 s, the pocket is drawn at close, the wheel spins, then the table pays', () => {
  const { req, tick, done } = room([17]);
  try {
    req(A, { op: 'join', name: 'Ann' });
    let v = req(A, { op: 'bet', bet: 'straight-17', chip: 5 });
    assert.equal(v.me.balance, 995); assert.equal(v.closesIn, BET_MS); assert.equal(v.number, null);
    v = req(A, { op: 'bet', bet: 'red', chip: 25 });
    assert.equal(v.me.balance, 970); assert.deepEqual(v.me.bets, { 'straight-17': 5, red: 25 });
    tick(BET_MS);
    v = req(A, { op: 'state' });
    assert.equal(v.phase, 'spin'); assert.equal(v.number, 17); assert.equal(v.color, 'black'); assert.equal(v.spinLeft, SPIN_MS);
    assert.throws(() => req(A, { op: 'bet', bet: 'red', chip: 5 }), /No more bets/);
    tick(SPIN_MS);
    v = req(A, { op: 'state' });
    assert.equal(v.phase, 'result'); assert.equal(v.me.balance, 970 + 180);
    assert.deepEqual(v.me.result, { staked: 30, returned: 180, wins: ['straight-17'] });
    assert.deepEqual(v.history, [17]);
    tick(RESULT_MS);
    v = req(A, { op: 'state' });
    assert.equal(v.phase, 'bets'); assert.equal(v.closesIn, null); assert.deepEqual(v.me.bets, {}); assert.equal(v.me.canRepeat, true);
    v = req(A, { op: 'repeat' });
    assert.deepEqual(v.me.bets, { 'straight-17': 5, red: 25 }); assert.equal(v.me.balance, 1120);
  } finally { done(); }
});

test('undo and clear give the chips back, and an empty table waits for a new first chip', () => {
  const { req, tick, done } = room([3]);
  try {
    req(A, { op: 'join', name: 'Ann' });
    req(A, { op: 'bet', bet: 'odd', chip: 5 });
    req(A, { op: 'bet', bet: 'odd', chip: 25 });
    let v = req(A, { op: 'undo' });
    assert.deepEqual(v.me.bets, { odd: 5 }); assert.equal(v.me.balance, 995);
    v = req(A, { op: 'clear' });
    assert.deepEqual(v.me.bets, {}); assert.equal(v.me.balance, 1000); assert.equal(v.closesIn, null);
    tick(BET_MS * 2);
    assert.equal(req(A, { op: 'state' }).phase, 'bets');
  } finally { done(); }
});

test('limits, chips, balance and names are the server\'s, not the client\'s', () => {
  const { req, done } = room([]);
  try {
    assert.throws(() => req(A, { op: 'bet', bet: 'red', chip: 5 }), /Enter your name/);
    req(A, { op: 'join', name: 'Ann' });
    assert.throws(() => req(A, { op: 'bet', bet: 'red', chip: 7 }), /Choose a chip/);
    assert.throws(() => req(A, { op: 'bet', bet: 'straight-37', chip: 5 }), /Unknown bet/);
    req(A, { op: 'bet', bet: 'red', chip: 500 });
    req(A, { op: 'bet', bet: 'red', chip: 500 });
    assert.throws(() => req(A, { op: 'bet', bet: 'red', chip: 5 }), /Maximum \$1,000 per bet/);
    assert.throws(() => req(A, { op: 'bet', bet: 'black', chip: 5 }), /Insufficient demo balance/);
    assert.throws(() => req(A, { op: 'join', name: '<script>' }), /Enter a name/);
  } finally { done(); }
});

test('two players share the spin and are paid on their own bets only', () => {
  const { req, tick, done } = room([0]);
  try {
    req(A, { op: 'join', name: 'Ann' }); req(B, { op: 'join', name: 'Bo' });
    req(A, { op: 'bet', bet: 'straight-0', chip: 1 });
    let b = req(B, { op: 'bet', bet: 'red', chip: 100 });
    assert.equal(b.players, 2); assert.equal(b.othersStaked, 1);
    tick(BET_MS + SPIN_MS);
    const a = req(A, { op: 'state' }); b = req(B, { op: 'state' });
    assert.equal(a.me.balance, 999 + 36); assert.equal(b.me.balance, 900);
    assert.equal(b.me.result.returned, 0);
  } finally { done(); }
});

test('a retried request is applied once; a reused ID with other input is refused', () => {
  const { rl, done } = room([]);
  try {
    rl.run(A, { session: 'x', op: 'join', name: 'Ann', requestId: 'j' });
    rl.run(A, { session: 'x', op: 'bet', bet: 'red', chip: 5, requestId: 'r1' });
    const v = rl.run(A, { session: 'x', op: 'bet', bet: 'red', chip: 5, requestId: 'r1' });
    assert.equal(v.me.balance, 995);
    assert.throws(() => rl.run(A, { session: 'x', op: 'bet', bet: 'black', chip: 5, requestId: 'r1' }), /reused/);
  } finally { done(); }
});

test('the pocket is not in any view before bets close', () => {
  const { req, done } = room([22]);
  try {
    req(A, { op: 'join', name: 'Ann' });
    const v = req(A, { op: 'bet', bet: 'red', chip: 5 });
    assert.ok(!JSON.stringify(v).includes('"number":22'));
  } finally { done(); }
});
