import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../web/public/app.mjs', import.meta.url), 'utf8');
const visibility = app.slice(app.indexOf('function setChatOpen(open)'), app.indexOf('\n}', app.indexOf('function setChatOpen(open)')) + 2);

function harness(dealer, localPresentationEnabled = true) {
  let open = false;
  const chatToggle = { dataset: { unread: '1' }, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } };
  const context = vm.createContext({ DEALER: { key: dealer }, localPresentationEnabled, chatToggle,
    $: () => ({ classList: { toggle: (_name, value) => { open = value; } } }) });
  vm.runInContext(visibility, context);
  return { set: value => vm.runInContext(`setChatOpen(${value})`, context), isOpen: () => open, chatToggle };
}

test('Astrid conversation remains visible on initialization and close requests from timeout, Escape or compact viewport', () => {
  const h = harness('astrid');
  for (const requested of [true, false, false, true, false]) {
    h.set(requested);
    assert.equal(h.isOpen(), true);
    assert.equal(h.chatToggle.attributes['aria-expanded'], 'true');
    assert.equal(h.chatToggle.dataset.unread, undefined);
  }
});

test('other dealer presentations retain their existing open/close behavior', () => {
  for (const dealer of ['vera', 'amira', 'mei']) {
    const h = harness(dealer);
    h.set(true); assert.equal(h.isOpen(), true);
    h.set(false); assert.equal(h.isOpen(), false);
  }
});

test('chat controls never move into the hidden private camera panel', () => {
  assert.doesNotMatch(app, /debugContainer\.append\([^;]*(?:chat-input|chat-log)/);
  assert.doesNotMatch(app, /onLogToggle:\s*[^\n]*setChatOpen/);
  const start = app.indexOf('if (astridCamera)', app.indexOf('const chatMemory'));
  const init = app.slice(start, app.indexOf('\n}', start) + 2);
  const h = harness('astrid');
  vm.runInNewContext(init, { astridCamera: {}, chatToggle: h.chatToggle, setChatOpen: value => h.set(value) });
  assert.equal(h.isOpen(), true);
  assert.equal(h.chatToggle.hidden, true);
});
