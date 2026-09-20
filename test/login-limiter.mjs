import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loginLimiter } from '../web/login-limiter.mjs';
const req = (ip) => ({ headers: { 'x-forwarded-for': ip }, socket: { remoteAddress: '127.0.0.1' } });
test('ten failures from one ip block that ip, not another', () => {
  const l = loginLimiter({ max: 10 });
  for (let i = 0; i < 10; i++) l.fail(req('1.1.1.1'), 'a' + i);
  assert.equal(l.blocked(req('1.1.1.1'), 'fresh'), true);
  assert.equal(l.blocked(req('2.2.2.2'), 'fresh'), false);
});
test('ten failures on one account from many ips block the account', () => {
  const l = loginLimiter({ max: 10 });
  for (let i = 0; i < 10; i++) l.fail(req('9.9.9.' + i), 'kevin');
  assert.equal(l.blocked(req('5.5.5.5'), 'kevin'), true);
  assert.equal(l.blocked(req('5.5.5.5'), 'other'), false);
});
test('success clears, and stale entries are swept after the window', () => {
  const l = loginLimiter({ max: 2, windowMs: 1 });
  l.fail(req('3.3.3.3'), 'x'); l.fail(req('3.3.3.3'), 'x');
  assert.equal(l.blocked(req('3.3.3.3'), 'x'), true);
  l.ok(req('3.3.3.3'), 'x'); assert.equal(l.blocked(req('3.3.3.3'), 'x'), false);
  l.fail(req('4.4.4.4'), 'y'); l.fail(req('4.4.4.4'), 'y');
  return new Promise(r => setTimeout(() => { assert.equal(l.blocked(req('4.4.4.4'), 'y'), false); assert.equal(l.size(), 0); r(); }, 5));
});
