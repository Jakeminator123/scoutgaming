import test from 'node:test';
import assert from 'node:assert/strict';
import { askConfirm, dismissConfirm, hardTotal, needsConfirm } from '../public/confirm-action.js';
const c = (...r) => r.map((x) => ({ r: x, s: '♠' }));
test('hit or double on a hard 17+ asks first', () => {
  assert.equal(needsConfirm('hit', c('10', '9')), true);       // hard 19 (CH: hit on 19 vs a 6)
  assert.equal(needsConfirm('double', c('10', '7')), true);    // hard 17
  assert.equal(needsConfirm('hit', c('A', '6', 'K')), true);   // ace forced to 1: hard 17
});
test('normal moves are not interrupted', () => {
  assert.equal(needsConfirm('hit', c('10', '6')), false);      // 16
  assert.equal(needsConfirm('hit', c('A', '7')), false);       // soft 18 is a real choice
  assert.equal(needsConfirm('stand', c('10', '9')), false);
  assert.equal(needsConfirm('hit', []), false);
  assert.equal(hardTotal(c('A', '7')), null);
  assert.equal(hardTotal(c('10', '9')), 19);
});

// Minimal DOM: enough for the dialog to be built, opened and removed.
function fakeDocument() {
  const open = new Set();
  const el = () => { const e = { children: [], listeners: {}, setAttribute() {}, append(...k) { e.children.push(...k); }, focus() {},
    addEventListener(t, f) { e.listeners[t] = f; }, remove() { open.delete(e); }, click() { e.listeners.click?.(); } }; return e; };
  globalThis.document = { createElement: el, addEventListener() {}, removeEventListener() {}, body: { append: e => open.add(e) } };
  return open;
}
test('one dialog at a time, and the table can close it as No when the turn moves on', async () => {
  const open = fakeDocument();
  const first = askConfirm('Hit on 20? Are you sure?'), second = askConfirm('Hit on 20? Are you sure?');
  assert.equal(await first, false);            // a second click replaced the first dialog instead of stacking it
  assert.equal(open.size, 1);
  dismissConfirm();                            // the timer moved the turn on
  assert.equal(await second, false);
  assert.equal(open.size, 0);
  const third = askConfirm('Double on 17? Are you sure?');
  [...open][0].children[1].children[1].click();   // Yes
  assert.equal(await third, true);
  delete globalThis.document;
});
