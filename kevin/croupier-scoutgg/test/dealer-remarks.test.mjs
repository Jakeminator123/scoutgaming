import test from 'node:test';
import assert from 'node:assert/strict';
import { remarkForAction, createWinStreak } from '../public/dealer-remarks.js';

const c = (...ranks) => ranks.map(r => ({ r, s: '♠' }));
const always = () => 0, never = () => .99;

test('dealer remarks only on questionable plays, and only sometimes', () => {
  assert.equal(remarkForAction('hit', c('K', 'Q'), always), 'remark_hit20_1');
  assert.ok(['remark_hit17_1', 'remark_hit17_2'].includes(remarkForAction('hit', c('10', '8'), always)));
  assert.equal(remarkForAction('stand', c('5', '6'), always), 'remark_stand11_1');
  assert.equal(remarkForAction('hit', c('A', '7'), always), null, 'soft 18 is a fair hit');
  assert.equal(remarkForAction('hit', c('10', '6'), always), null, '16 is a normal hit');
  assert.equal(remarkForAction('stand', c('10', '7'), always), null);
  assert.equal(remarkForAction('hit', c('K', 'Q'), never), null, 'not every time');
  assert.equal(remarkForAction('hit', [{ r: null }], always), null, 'hidden cards never judged');
});

test('banter comes once when a win streak reaches two', () => {
  const s = createWinStreak();
  assert.deepEqual([true, true, true, false, true, true].map(s), [null, 'banter_1', null, null, null, 'banter_1']);
});

test('greeting uses a recorded name when there is one, else the guest take', async () => {
  const { greetingFor } = await import('../public/dealer-remarks.js');
  assert.equal(greetingFor('Kevin'), 'greet_kevin');
  assert.equal(greetingFor('  axel berg '), 'greet_axel');
  assert.equal(greetingFor('Visitor 10'), 'greet_guest');
  assert.equal(greetingFor(''), 'greet_guest');
});

test('table talk only with company at the table, one of the two known lines', async () => {
  const { tableTalkFor, TABLE_TALK } = await import('../public/dealer-remarks.js');
  assert.equal(tableTalkFor(1, () => 0), null, 'never alone');
  assert.ok(TABLE_TALK.includes(tableTalkFor(2, () => 0)));
  assert.equal(tableTalkFor(3, () => .99), null, 'only sometimes');
});
