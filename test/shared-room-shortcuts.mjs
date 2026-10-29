// K10: H/S/D/P click the decision panel's own button only while one of its buttons has focus, and leave every
// modified, repeated, composed, handled or foreign key alone. Chrome proves the page in
// test/shared-room-shortcuts-browser.mjs; this proves the key rules without a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDecisionShortcuts } from '../services/game/public/shared-room-shortcuts.mjs';

class Button extends EventTarget {
  constructor(act, attributes = {}) { super(); this.dataset = { act }; this.attributes = { ...attributes }; this.disabled = false; this.clicks = 0; }
  getAttribute(name) { return this.attributes[name] ?? null; } setAttribute(name, value) { this.attributes[name] = String(value); } removeAttribute(name) { delete this.attributes[name]; }
  click() { if (!this.disabled) this.clicks++; }
}
function panelWith(acts = ['double', 'hit', 'stand', 'split']) {
  const panel = new EventTarget(); panel.hidden = false;
  const buttons = acts.map(act => new Button(act));
  // A key event starts at the focused button and bubbles to the panel.
  const press = (target, init) => { const event = Object.assign(new Event('keydown', { cancelable: true }), { key: 'h', ...init }); Object.defineProperty(event, 'target', { value: target });
    panel.dispatchEvent(event); return event.defaultPrevented; };
  return { panel, buttons, press, clicks: () => buttons.map(node => node.clicks) };
}

test('a letter clicks the panel button for its decision and is consumed, with focus on any of the panel buttons', () => {
  const { panel, buttons, press, clicks } = panelWith();
  const uninstall = installDecisionShortcuts(panel, buttons);
  assert.deepEqual(buttons.map(node => [node.getAttribute('aria-keyshortcuts'), node.getAttribute('title')]),
    [['D', 'Kortkommando D'], ['H', 'Kortkommando H'], ['S', 'Kortkommando S'], ['P', 'Kortkommando P']]);
  const [double, hit, stand, split] = buttons;
  assert.equal(press(double, { key: 'h' }), true); assert.equal(press(hit, { key: 'S' }), true); assert.equal(press(stand, { key: 'd' }), true); assert.equal(press(hit, { key: 'p' }), true);
  assert.deepEqual(clicks(), [1, 1, 1, 1], 'D and P are armed from every panel button, like H and S');
  // A closed decision is neither clicked nor consumed; so is a letter without a decision.
  split.disabled = true;
  assert.equal(press(hit, { key: 'p' }), false); assert.equal(press(hit, { key: 'x' }), false); assert.equal(press(hit, { key: 'Enter' }), false);
  assert.deepEqual(clicks(), [1, 1, 1, 1]);
  uninstall();
  assert.equal(press(hit, { key: 'h' }), false); assert.deepEqual(clicks(), [1, 1, 1, 1], 'nothing after uninstall');
  assert.deepEqual(buttons.map(node => node.attributes), [{}, {}, {}, {}], 'uninstall removes the attributes it added');
});

test('a key outside the panel, a modified, repeated, composed or handled key, and a hidden panel decide nothing', () => {
  const { panel, buttons, press, clicks } = panelWith();
  installDecisionShortcuts(panel, buttons);
  const [, hit] = buttons, elsewhere = new Button('hit');
  assert.equal(press(elsewhere, { key: 'h' }), false, 'a button with the same decision outside the panel');
  assert.equal(press(panel, { key: 'h' }), false, 'the panel itself');
  for (const init of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { repeat: true }, { isComposing: true }, { keyCode: 229 }, { key: undefined }, { key: 'h', code: 'KeyH', ctrlKey: true }])
    assert.equal(press(hit, { key: 'h', ...init }), false, JSON.stringify(init));
  const handled = Object.assign(new Event('keydown', { cancelable: true }), { key: 'h' }); Object.defineProperty(handled, 'target', { value: hit }); handled.preventDefault();
  panel.dispatchEvent(handled);
  panel.hidden = true; assert.equal(press(hit, { key: 'h' }), false, 'a hidden panel'); panel.hidden = false;
  assert.deepEqual(clicks(), [0, 0, 0, 0]);
  assert.equal(press(hit, { key: 'h' }), true); assert.deepEqual(clicks(), [0, 1, 0, 0], 'the plain key still works');
});

test('a layout without Latin letters falls back to the physical key; a typed Latin letter always wins', () => {
  const { panel, buttons, press, clicks } = panelWith();
  installDecisionShortcuts(panel, buttons);
  const [, hit] = buttons;
  assert.equal(press(hit, { key: 'р', code: 'KeyH' }), true, 'Cyrillic р sits on the H key');
  assert.equal(press(hit, { key: 'ы', code: 'KeyS' }), true); assert.equal(press(hit, { key: 'в', code: 'KeyD' }), true); assert.equal(press(hit, { key: 'з', code: 'KeyP' }), true);
  assert.deepEqual(clicks(), [1, 1, 1, 1]);
  assert.equal(press(hit, { key: 'x', code: 'KeyH' }), false, 'a Latin letter that is no decision never falls back to the key');
  assert.equal(press(hit, { key: 'd', code: 'KeyH' }), true, 'Dvorak: the typed letter decides');
  assert.equal(press(hit, { key: 'ф', code: 'KeyA' }), false); assert.equal(press(hit, { key: 'Dead', code: 'KeyH' }), false, 'a dead key is no letter and no decision');
  assert.deepEqual(clicks(), [2, 1, 1, 1]);
});

test('existing titles and shortcuts are kept and restored', () => {
  const panel = new EventTarget(); panel.hidden = false;
  const hit = new Button('hit', { title: 'Ta kort', 'aria-keyshortcuts': 'Alt+H' });
  const uninstall = installDecisionShortcuts(panel, [hit]);
  assert.deepEqual(hit.attributes, { title: 'Ta kort', 'aria-keyshortcuts': 'H' });
  uninstall(); assert.deepEqual(hit.attributes, { title: 'Ta kort', 'aria-keyshortcuts': 'Alt+H' });
  assert.equal(typeof installDecisionShortcuts(null, [hit]), 'function', 'no panel installs nothing');
});
