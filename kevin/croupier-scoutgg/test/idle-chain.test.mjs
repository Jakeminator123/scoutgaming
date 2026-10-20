import test from 'node:test';
import assert from 'node:assert/strict';
import { chainClipAt, LEAD, layChain, waitClips, waitBoundary, waitClipAt } from '../public/idle-chain.js';

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
