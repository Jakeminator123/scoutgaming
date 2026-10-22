import test from 'node:test';
import assert from 'node:assert/strict';
import { layChain, waitClips, waitBoundary, waitClipAt, pickWeighted, restingPool } from '../services/game/games/blackjack/presentation/room-idle.mjs';
import * as kevinIdle from './fixtures/kevin-5aa7ed1/public/idle-chain.js';

// K07 gap (K06-K07-forberedelse §2.2): Kevin's idle-chain unit tests @ 5aa7ed10 (test/idle-chain.test.mjs, the five that
// concern functions room-idle.mjs ports) run against K04's port, plus a function-for-function parity check against the
// frozen Kevin fixture. waitClipAt differs by design (K04 takes one wait, no talk list), so that case is adapted.
const ms = f => f * 1000 / 24;
const takes = [{ take: 'andas', frames: 39, vikt: 20 }, { take: 'huvud', frames: 39, vikt: 3 }, { take: 'fingrar', frames: 39, vikt: 4 }];
const W = { from: 10000, until: null, seed: 'plan-1', takes };
const LEAD = 100;

test('the chain is one sequence: a longer window only extends it, the same clips come back for any window, never one take twice in a row', () => {
  const a = layChain(takes, 10000, 20000, 'plan-1'), b = layChain(takes, 10000, 40000, 'plan-1');
  assert.deepEqual(b.slice(0, a.length), a);
  for (let i = 1; i < b.length; i++) { assert.equal(b[i].startAt, b[i - 1].endAt); assert.notEqual(b[i].take, b[i - 1].take); }
  const mid = waitClips(W, 15000, 17000);
  assert.ok(mid.length >= 2 && mid.every(c => b.some(x => x.startAt === c.startAt && x.take === c.take)), 'a window in the middle: the same clips');
  assert.deepEqual(waitClips({ ...W, until: 10000 + 2 * ms(39) }, 10000, 20000).map(c => c.endAt <= 10000 + 2 * ms(39) + .1), [true, true], 'a wait ended on a boundary stops there');
});

test('a take starts on the next clip boundary: at the boundary itself, else at the end of the clip running', () => {
  assert.equal(waitBoundary(W, 10000), 10000, 'on the boundary');
  assert.equal(waitBoundary(W, 10000 + ms(39)), 10000 + ms(39));
  assert.equal(waitBoundary(W, 10000 + 700), Math.round((10000 + ms(39)) * 10) / 10, 'within a clip: its end');
  assert.equal(waitBoundary(W, 9000), 10000, 'before the chain: its start');
  assert.equal(waitBoundary(null, 777), 777);
});

test('the wait clip now: none before the wait or after its end, the clip running meanwhile with its successor', () => {
  assert.equal(waitClipAt(W, 10000 - LEAD - 1), null);
  const r = waitClipAt(W, 10000 + 2000);
  assert.ok(r && r.clip.startAt <= 12000 && r.clip.endAt > 12000 && r.next && r.next.startAt === r.clip.endAt);
  assert.equal(waitClipAt({ ...W, until: 12000 }, 12000 - LEAD + 1), null, 'from LEAD before the take the chain is over');
  assert.ok(waitClipAt({ ...W, until: 12000 }, 11000));
  assert.equal(waitClipAt(null, 12000), null);
});

test('the weighted pick never returns the clip last picked, even one that outweighs all the others, and follows the weights otherwise', () => {
  const pool = [{ id: 'andas', vikt: 20 }, { id: 'nick6101', vikt: 6 }, { id: 'vikt6103', vikt: 6 }];
  let last = null; const seen = {};
  for (let i = 0; i < 400; i++) { const c = pickWeighted(pool, last, Math.random); assert.notEqual(c.id, last, 'twice in a row'); seen[c.id] = (seen[c.id] ?? 0) + 1; last = c.id; }
  assert.ok(seen.andas > 150 && seen.nick6101 > 40 && seen.vikt6103 > 40, JSON.stringify(seen));
  assert.equal(pickWeighted([{ id: 'only', vikt: 1 }], 'only', Math.random).id, 'only', 'one clip: it repeats, there is nothing else');
  assert.equal(pickWeighted([{ id: 'a', vikt: 5 }, { id: 'b', vikt: 1 }], 'a', () => 0.99).id, 'b', 'a lone candidate is taken whatever the draw');
  const chain = layChain([{ take: 'andas', frames: 39, vikt: 20 }, { take: 'nick6101', frames: 39, vikt: 6 }], 0, 60000, 'seed');
  for (let i = 1; i < chain.length; i++) assert.notEqual(chain[i].take, chain[i - 1].take, 'a chain never repeats either');
});

test('at rest he draws from the calm takes only; the lively ones are left for a chain under speech; a dealer without calm takes keeps all of his', () => {
  const idles = [{ id: 'andas', vikt: 20, calm: true }, { id: 'vikt6101', vikt: 6, calm: true }, { id: 'nick6101', vikt: 6, calm: false }, { id: 'huvud', vikt: 3, calm: false }];
  assert.deepEqual(restingPool(idles).map(i => i.id), ['andas', 'vikt6101']);
  let last = null; for (let i = 0; i < 100; i++) { const c = pickWeighted(restingPool(idles), last, Math.random); assert.ok(c.calm, c.id); assert.notEqual(c.id, last); last = c.id; }
  assert.deepEqual(restingPool([{ id: 'breath' }, { id: 'glance' }]).map(i => i.id), ['breath', 'glance'], 'Kling loops without the flag: all of them');
  assert.deepEqual(restingPool([]), []);
  const talk = layChain(idles.map(i => ({ take: i.id, frames: 39, vikt: i.vikt })), 0, 40000, 'answer');
  assert.ok(talk.some(c => c.take === 'nick6101' || c.take === 'huvud'), 'a chain under speech still uses the lively takes');
});

test('function-for-function parity with Kevin idle-chain.js @ 5aa7ed10: pickWeighted (seeded), layChain, waitClips, waitBoundary, restingPool', () => {
  let h = 12345; const rnd = () => { h = (Math.imul(h ^ (h >>> 15), 2246822519) + 0x9e3779b9) >>> 0; return h / 2 ** 32; };
  const pool = [{ id: 'andas', vikt: 20 }, { id: 'huvud', vikt: 3 }, { id: 'fingrar', vikt: 4 }];
  for (let i = 0, last = null, k = 12345; i < 200; i++) {
    const mine = pickWeighted(pool, last, rnd); h = k; const theirs = kevinIdle.pickWeighted(pool, last, rnd); k = h;
    assert.equal(mine.id, theirs.id); last = mine.id;
  }
  for (const seed of ['plan-1', 'x', '']) for (const [from, to] of [[0, 1], [10000, 40000], [500, 60000]]) {
    assert.deepEqual(layChain(takes, from, to, seed), kevinIdle.layChain(takes, from, to, seed));
    const wait = { from, until: null, seed, takes };
    assert.deepEqual(waitClips(wait, from - 100, to + 100), kevinIdle.waitClips(wait, from - 100, to + 100));
    for (const at of [from - 1, from, from + 700, from + ms(39), to]) assert.equal(waitBoundary(wait, at), kevinIdle.waitBoundary(wait, at));
  }
  const idles = [{ id: 'a', calm: true }, { id: 'b' }, { id: 'c', calm: false }];
  assert.deepEqual(restingPool(idles), kevinIdle.restingPool(idles)); assert.deepEqual(restingPool([{ id: 'x' }]), kevinIdle.restingPool([{ id: 'x' }]));
});
