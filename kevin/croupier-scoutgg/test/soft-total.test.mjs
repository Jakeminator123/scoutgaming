import test from 'node:test';
import assert from 'node:assert/strict';
import { total, totalLabel } from '../public/game-events.js';

const h = (...r) => r.map(r => ({ r, s: '♠' }));

test('an ace that can still count as 11 shows both values (Kevin 10/10)', () => {
  assert.equal(totalLabel(h('A', '6')), '7/17');
  assert.equal(totalLabel(h('A', 'A')), '2/12');
  assert.equal(totalLabel(h('A', '2', '3')), '6/16');
  assert.equal(totalLabel(h('A', 'A', '9')), '21');
});

test('hard hands, 21 and hands where the ace must count as 1 show one value', () => {
  assert.equal(totalLabel(h('K', '7')), '17');
  assert.equal(totalLabel(h('A', 'K')), '21');
  assert.equal(totalLabel(h('A', '6', '9')), '16');
  assert.equal(totalLabel(h('K', '9', '5')), '24');
  assert.equal(totalLabel([]), '0');
  assert.equal(total(h('A', '6')), 17);
});
