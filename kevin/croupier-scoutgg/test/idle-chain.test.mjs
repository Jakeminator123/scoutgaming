import test from 'node:test';
import assert from 'node:assert/strict';
import { chainClipAt, LEAD, layChain, waitClips, waitBoundary, waitClipAt, pickWeighted, restingPool, upcomingChainAt } from '../public/idle-chain.js';
import { patchKeys } from '../public/lip-layer.js';

// 20 Oct: which clip of a talk's idle chain the table shows now must be gapless, or the handover on a clip's last frame
// (1.5 frames = 62 ms before its end) finds nothing, drops the prepared clip and lets a random idle start under the line.
const ms = f => f * 1000 / 24;
const talk = { id: 't1', startAt: 1220, endAt: 5000, kartaStart: 1000, idle: [
  { take: 'blickhoger', startAt: 1000, endAt: 1000 + ms(39), frames: 39 },
  { take: 'huvudb', startAt: 1000 + ms(39), endAt: 1000 + ms(78), frames: 39 },
  { take: 'andas', startAt: 1000 + ms(78), endAt: 1000 + ms(117), frames: 39 },
] };

test('every instant from the chain start to its end names a clip; the handover moment on a clip\'s last frame names the next one', () => {
  const [a, b, c] = talk.idle;
  assert.equal(chainClipAt([talk], 1000 - LEAD).clip.take, 'blickhoger', 'the first clip LEAD ms before its start');
  assert.equal(chainClipAt([talk], 1000 - LEAD - 1), null, 'nothing before that');
  for (let at = 1000 - LEAD; at < c.endAt + 40; at += 7) assert.ok(chainClipAt([talk], at), `a clip at ${at}`);
  assert.equal(chainClipAt([talk], a.endAt - 62).clip.take, 'huvudb', 'the handover 62 ms before the end lands on the next clip');
  assert.equal(chainClipAt([talk], a.endAt - 62).next.take, 'andas');
  assert.equal(chainClipAt([talk], a.endAt - 101).clip.take, 'blickhoger', 'until LEAD before the next one starts');
  assert.equal(chainClipAt([talk], b.endAt - 80).clip.take, 'andas', 'the old gap (endAt - 80 … next startAt - 40) is gone');
  assert.equal(chainClipAt([talk], c.endAt + 39).clip.take, 'andas', 'the last clip until just after its end');
  assert.equal(chainClipAt([talk], c.endAt + 40), null, 'then the chain is over');
  assert.equal(chainClipAt([talk], c.endAt - 62).next, null, 'no next after the last');
});

test('a flexible answer not started here yet names no clip; a started one is shifted by when this viewer started it', () => {
  const flex = { ...talk, id: 'f', flex: true };
  assert.equal(chainClipAt([flex], 1500, t => (t.flex ? null : 0)), null);
  const r = chainClipAt([flex], 1500 + 700, t => 700);
  assert.equal(r.clip.take, 'blickhoger'); assert.equal(r.shift, 700);
  assert.equal(chainClipAt([{ id: 'x', idle: [] }, talk], 1500).talk.id, 't1', 'a talk without a chain is skipped');
  assert.equal(chainClipAt(undefined, 1500), null);
});

// Kevin 20 Oct: the wait chain while the table waits for a player.
const takes = [{ take: 'andas', frames: 39, vikt: 20 }, { take: 'huvud', frames: 39, vikt: 3 }, { take: 'fingrar', frames: 39, vikt: 4 }];
const W = { from: 10000, until: null, seed: 'plan-1', takes };

test('the chain is one sequence: a longer window only extends it, the same clips come back for any window, never one take twice in a row', () => {
  const a = layChain(takes, 10000, 20000, 'plan-1'), b = layChain(takes, 10000, 40000, 'plan-1');
  assert.deepEqual(b.slice(0, a.length), a);
  for (let i = 1; i < b.length; i++) { assert.equal(b[i].startAt, b[i - 1].endAt); assert.notEqual(b[i].take, b[i - 1].take); }
  const mid = waitClips(W, 15000, 17000);
  assert.ok(mid.length >= 2 && mid.every(c => b.some(x => x.startAt === c.startAt && x.take === c.take)), 'a window in the middle: the same clips');
  assert.deepEqual(waitClips({ ...W, until: 10000 + 2 * ms(39) }, 10000, 20000).map(c => c.endAt <= 10000 + 2 * ms(39) + .1), [true, true], 'a wait ended on a boundary (the server always ends it there) stops there');
});

test('a take starts on the next clip boundary: at the boundary itself, else at the end of the clip running', () => {
  assert.equal(waitBoundary(W, 10000), 10000, 'on the boundary');
  assert.equal(waitBoundary(W, 10000 + ms(39)), 10000 + ms(39));
  assert.equal(waitBoundary(W, 10000 + 700), Math.round((10000 + ms(39)) * 10) / 10, 'within a clip: its end');
  assert.equal(waitBoundary(W, 9000), 10000, 'before the chain: its start');
  assert.equal(waitBoundary(null, 777), 777);
});

test('the wait clip now: none before the wait or after its end, the clip running meanwhile with its successor, and none while a talk rests on his still', () => {
  assert.equal(waitClipAt([W], 10000 - LEAD - 1), null);
  const r = waitClipAt([W], 10000 + 2000);
  assert.ok(r && r.talk.id === 'wait:plan-1' && r.clip.startAt <= 12000 && r.clip.endAt > 12000 && r.next && r.next.startAt === r.clip.endAt);
  assert.equal(waitClipAt([{ ...W, until: 12000 }], 12000 - LEAD + 1), null, 'from LEAD before the take the chain is over');
  assert.ok(waitClipAt([{ ...W, until: 12000 }], 11000));
  assert.equal(waitClipAt([W], 12000, [{ id: 't', kartaStart: 11500, startAt: 11720, endAt: 14000 }]), null, 'a talk without its own chain: he rests on his still for the mouth');
  assert.ok(waitClipAt([W], 12000, [{ id: 't', kartaStart: 11500, startAt: 11720, endAt: 14000, idle: [{ take: 'andas' }] }]), 'a talk over the chain: the chain goes on');
});

// Kevin 21 Oct: never the same clip twice in a row, whatever its weight: the random idles (app.js pickIdle) and the
// chains (layChain) pick through the same function.
test('the weighted pick never returns the clip last picked, even one that outweighs all the others, and follows the weights otherwise', () => {
  const pool = [{ id: 'andas', vikt: 20 }, { id: 'nick6101', vikt: 6 }, { id: 'vikt6103', vikt: 6 }];
  let last = null; const seen = {};
  for (let i = 0; i < 400; i++) { const c = pickWeighted(pool, last); assert.notEqual(c.id, last, 'twice in a row'); seen[c.id] = (seen[c.id] ?? 0) + 1; last = c.id; }
  assert.ok(seen.andas > 150 && seen.nick6101 > 40 && seen.vikt6103 > 40, JSON.stringify(seen));
  assert.equal(pickWeighted([{ id: 'only', vikt: 1 }], 'only').id, 'only', 'one clip: it repeats, there is nothing else');
  assert.equal(pickWeighted([{ id: 'a', vikt: 5 }, { id: 'b', vikt: 1 }], 'a', () => 0.99).id, 'b', 'a lone candidate is taken whatever the draw');
  const chain = layChain([{ take: 'andas', frames: 39, vikt: 20 }, { take: 'nick6101', frames: 39, vikt: 6 }], 0, 60000, 'seed');
  for (let i = 1; i < chain.length; i++) assert.notEqual(chain[i].take, chain[i - 1].take, 'a chain never repeats either');
});

test('at rest he draws from the calm takes only; the lively ones are left for a chain under speech; a dealer without calm takes keeps all of his', () => {
  const idles = [{ id: 'andas', vikt: 20, calm: true }, { id: 'vikt6101', vikt: 6, calm: true }, { id: 'nick6101', vikt: 6, calm: false }, { id: 'huvud', vikt: 3, calm: false }];
  assert.deepEqual(restingPool(idles).map(i => i.id), ['andas', 'vikt6101']);
  let last = null; for (let i = 0; i < 100; i++) { const c = pickWeighted(restingPool(idles), last); assert.ok(c.calm, c.id); assert.notEqual(c.id, last); last = c.id; }
  assert.deepEqual(restingPool([{ id: 'breath' }, { id: 'glance' }]).map(i => i.id), ['breath', 'glance'], 'Kling loops without the flag: all of them');
  assert.deepEqual(restingPool([]), []);
  const talk = layChain(idles.map(i => ({ take: i.id, frames: 39, vikt: i.vikt })), 0, 40000, 'answer');
  assert.ok(talk.some(c => c.take === 'nick6101' || c.take === 'huvud'), 'a chain under speech still uses the lively takes');
});

test('the first clip of a chain about to start is known 2.5 s ahead, a wait or a talk, unless a plan take comes first', () => {
  const w = { from: 20000, until: null, seed: 'p2', takes };
  assert.equal(upcomingChainAt([w], [], null, 17000), null, 'too early');
  const u = upcomingChainAt([w], [], null, 18000);
  assert.ok(u && u.talk.id === 'wait:p2' && u.clip.startAt === 20000 && u.next === null);
  assert.equal(upcomingChainAt([w], [], { steps: [{ clip: {}, startAt: 19000, endAt: 19500 }] }, 18000), null, 'a take before it needs the hidden video');
  assert.ok(upcomingChainAt([w], [], { steps: [{ clip: {}, startAt: 17500, endAt: 19000 }] }, 18000), 'a take already running is no obstacle');
  const t = { id: 'a', idle: [{ take: 'andas', startAt: 19000, endAt: 19000 + ms(39), frames: 39 }] };
  assert.equal(upcomingChainAt([w], [t], null, 18000).talk.id, 'a', 'the earliest of the two');
  assert.equal(upcomingChainAt([], [{ ...t, flex: true }], null, 18000, 2500, x => (x.flex ? null : 0)), null, 'a flexible answer not started here: nothing to prepare');
  assert.equal(upcomingChainAt([w], [], null, 20100), null, 'once it has started it is the chain, not upcoming');
});

test('which patches fit what is on screen: the frame itself; on a held last frame the take\'s last known frames; at rest also the still', () => {
  const last = new Map([['pos1-i', 65], ['andas', 38]]);
  assert.deepEqual(patchKeys('pos1-i', 30, false, last), ['pos1-i:30']);
  assert.deepEqual(patchKeys('pos1-i', 66, false, last), ['pos1-i:66', 'pos1-i:65', 'pos1-i:64', 'pos1-i:63'], 'one past the end: the last frames (the player holds the last frame while the next take loads)');
  assert.deepEqual(patchKeys('andas', 38, true, last), ['andas:38', 'andas:37', 'andas:36', 'vila'], 'the last frame of an idle, at rest');
  assert.deepEqual(patchKeys('andas', 12, true, last), ['andas:12', 'andas:11', 'vila']);
  assert.deepEqual(patchKeys('flip', 39, true, new Map()), ['flip:39', 'flip:38', 'vila'], 'a take without patches yet');
});
