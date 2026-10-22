import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../services/game/public/app.mjs', import.meta.url), 'utf8');
const visibility = app.slice(app.indexOf('function setChatOpen(open)'), app.indexOf('\n}', app.indexOf('function setChatOpen(open)')) + 2);

function harness(studioPreview = null) {
  let open = false;
  const chatToggle = { dataset: { unread: '1' }, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } };
  const context = vm.createContext({ studioPreview, chatToggle,
    $: () => ({ classList: { toggle: (_name, value) => { open = value; } } }) });
  vm.runInContext(visibility, context);
  return { set: value => vm.runInContext(`setChatOpen(${value})`, context), isOpen: () => open, chatToggle };
}

test('conversation opens and closes on request with accessible state and cleared unread status', () => {
  const h = harness();
  for (const requested of [true, false, false, true, false]) {
    h.set(requested);
    assert.equal(h.isOpen(), requested);
    assert.equal(h.chatToggle.attributes['aria-expanded'], String(requested));
    assert.equal(h.chatToggle.dataset.unread, undefined);
  }
});

test('Studio preview cannot expose chat through ordinary open or close controls', () => {
  const h = harness({ sessionId: 'preview-fixture' });
  for (const requested of [true, false, true]) {
    h.set(requested);
    assert.equal(h.isOpen(), false);
    assert.deepEqual(h.chatToggle.attributes, {});
    assert.equal(h.chatToggle.dataset.unread, '1');
  }
});
