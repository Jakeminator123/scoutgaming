import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoGate } from '../server/demo-gate.mjs';

test('only the right Play demo password is accepted (Kevin 12 Oct)', () => {
  const g = createDemoGate({ password: 'scoutlive' });
  assert.equal(g.on, true);
  assert.equal(g.rightPassword('wrong'), false);
  assert.equal(g.rightPassword(''), false);
  assert.equal(g.rightPassword(undefined), false);
  assert.equal(g.rightPassword(' scoutlive '), true);
});

test('without a password the gate is off and accepts nothing', () => {
  const g = createDemoGate({ password: '' });
  assert.equal(g.on, false);
  assert.equal(g.rightPassword(''), false);
});
