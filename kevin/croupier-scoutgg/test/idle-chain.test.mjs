import test from 'node:test';
import assert from 'node:assert/strict';
import { chainClipAt, LEAD } from '../public/idle-chain.js';

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
