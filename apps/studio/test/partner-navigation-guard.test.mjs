import test from 'node:test';
import assert from 'node:assert/strict';
import {createPartnerLeaveGuard} from '../components/partner/partner-navigation-guard.mjs';

test('leave guard asks once while dirty, approves beforeunload after consent and resets', () => {
  let dirty = true, answers = [false, true];
  const guard = createPartnerLeaveGuard({isDirty: () => dirty, confirmLeave: () => answers.shift()});
  assert.equal(guard.requestLeave(), false);
  const blocked = {preventDefault() { this.prevented = true; }};
  guard.beforeUnload(blocked); assert.equal(blocked.prevented, true); assert.equal(blocked.returnValue, '');
  assert.equal(guard.requestLeave(), true);
  const allowed = {preventDefault() { this.prevented = true; }};
  guard.beforeUnload(allowed); assert.equal(allowed.prevented, undefined);
  guard.reset();
  const again = {preventDefault() { this.prevented = true; }};
  guard.beforeUnload(again); assert.equal(again.prevented, true);
  dirty = false;
  assert.equal(guard.requestLeave(), true);
});
