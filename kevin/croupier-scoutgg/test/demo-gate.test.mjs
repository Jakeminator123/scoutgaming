import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoGate } from '../server/demo-gate.mjs';

const secret = 'x'.repeat(32);
test('the Play demo pass is given only for the right password, and only a signed, unexpired pass opens the game (Kevin 12 Oct)', () => {
  let t = Date.UTC(2026, 9, 12);
  const g = createDemoGate({ password: 'scoutlive', secret, now: () => t });
  assert.equal(g.on, true);
  assert.equal(g.rightPassword('wrong'), false);
  assert.equal(g.rightPassword(''), false);
  assert.equal(g.rightPassword(' scoutlive '), true);
  assert.equal(g.hasPass({}), false);
  const cookie = g.passCookie(true).split(';')[0];
  assert.match(g.passCookie(true), /HttpOnly; SameSite=Lax; Max-Age=2592000; Secure$/);
  assert.equal(g.hasPass({ cookie }), true);
  assert.equal(g.hasPass({ cookie: cookie.replace(/.$/, c => (c === 'A' ? 'B' : 'A')) }), false);   // tampered signature
  const [exp] = cookie.slice('demo_pass='.length).split('.');
  assert.equal(g.hasPass({ cookie: `demo_pass=${Number(exp) + 999}.${cookie.split('.')[1]}` }), false);   // changed expiry
  assert.equal(createDemoGate({ password: 'scoutlive', secret: 'y'.repeat(32), now: () => t }).hasPass({ cookie }), false);   // other secret
  t += 31 * 86400000;
  assert.equal(g.hasPass({ cookie }), false);   // expired
});

test('without a password or secret the gate is off and changes nothing', () => {
  assert.equal(createDemoGate({ password: '', secret }).hasPass({}), true);
  assert.equal(createDemoGate({ password: 'p', secret: 'short' }).on, false);
  assert.equal(createDemoGate({ password: '', secret }).rightPassword(''), false);
});
