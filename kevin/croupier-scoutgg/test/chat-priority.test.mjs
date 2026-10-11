import test from 'node:test';
import assert from 'node:assert/strict';
import { answerFits, pickQueued, clipDuration, ANSWER_MARGIN_MS, UNKNOWN_ANSWER_S } from '../public/chat-priority.js';

const answer = (dur, extra = {}) => ({ kind: 'answer', url: '/answers/a.mp4', dur, ...extra });

test('an answer starts only if it ends (with a margin) before the table may need the screen', () => {
  assert.equal(answerFits(3, 3000 + ANSWER_MARGIN_MS), true);
  assert.equal(answerFits(3, 3000 + ANSWER_MARGIN_MS - 1), false);
  assert.equal(answerFits(30, Infinity), true);
  assert.equal(answerFits(1, 0), false);
  assert.equal(answerFits(null, UNKNOWN_ANSWER_S * 1000 + ANSWER_MARGIN_MS), true, 'unknown length counts as the assumed length');
  assert.equal(answerFits(undefined, UNKNOWN_ANSWER_S * 1000), false);
});

test('betting countdown: a long answer waits, a remark queued behind it still plays, a short one fits', () => {
  const q = [answer(6), { kind: 'remark', url: '/r.mp4' }, answer(2)];
  assert.equal(pickQueued(q, { playing: false, quietMs: 4000 }), 1, 'the 6 s answer does not fit 4 s; the remark goes first');
  assert.equal(pickQueued([answer(6), answer(2)], { playing: false, quietMs: 4000 }), 1, 'the 2 s answer fits');
  assert.equal(pickQueued([answer(6)], { playing: false, quietMs: 4000 }), -1, 'nothing fits: the dealer idles and the answer stays queued');
  assert.equal(pickQueued([answer(6)], { playing: false, quietMs: Infinity }), 0, 'after the round (no countdown) it plays');
});

test('in a round only remarks play between deals; answers wait for the round to end', () => {
  const q = [answer(2, { own: true }), { kind: 'event', url: '/e.mp4' }, { kind: 'remark', url: '/r.mp4' }];
  assert.equal(pickQueued(q, { playing: true, quietMs: 0 }), 2);
  assert.equal(pickQueued([answer(2, { own: true }), { kind: 'event' }], { playing: true, quietMs: 0 }), -1);
});

test('outside a round the queue keeps its order for everything but answers that do not fit', () => {
  const q = [{ kind: 'event', url: '/e.mp4' }, answer(2)];
  assert.equal(pickQueued(q, { playing: false, quietMs: 0 }), 0);
  assert.equal(pickQueued([answer(2), { kind: 'event' }], { playing: false, quietMs: Infinity }), 0);
});

test('clip length is read from the file metadata, null when it cannot be read', async () => {
  const fakeDoc = (fire) => ({ createElement: () => { const v = { removeAttribute() {}, load() {} };
    Object.defineProperty(v, 'src', { set() { setTimeout(() => fire(v), 5); } }); return v; } });
  assert.equal(await clipDuration('/a.mp4', { doc: fakeDoc(v => { v.duration = 4.25; v.onloadedmetadata(); }) }), 4.25);
  assert.equal(await clipDuration('/a.mp4', { doc: fakeDoc(v => v.onerror()) }), null);
  assert.equal(await clipDuration('/a.mp4', { doc: fakeDoc(() => {}), timeoutMs: 30 }), null);
  assert.equal(await clipDuration('', { doc: fakeDoc(() => {}) }), null);
});
