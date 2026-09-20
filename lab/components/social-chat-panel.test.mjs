import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const source = readFileSync(new URL('./social-chat-panel.tsx', import.meta.url), 'utf8');
const compiled = transformSync(source, { filename: 'social-chat-panel.tsx', jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } }).code;
const policy = { schemaVersion: 1, revision: 'social-fixture-123', trigger: { id: 'social.ledsen', label: 'Ledsen', enabled: true, directive: 'Reagera på ohövlighet.', threshold: 0.7 }, response: { mode: 'fixed', fixedText: 'Oj, nu var du oförskämd.' }, cooldownMs: 5000 };
const status = { policy, configured: true, voiceConfigured: true };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

// Focused hook harness: exercises real handlers and cancellation without a browser,
// a model, external audio or an additional test dependency.
function harness({ compact = false, dealerId = 'astrid', eventId = 'idle.ready', draftCache, duration = 2, blocked = false, respond = async () => { throw new Error('Unexpected request'); } } = {}) {
  const slots = [], requests = [], reactions = [], audio = [], effects = [], ownership = [], activities = [];
  let cursor = 0, cancel;
  const listeners = new Map();
  const equalDeps = (a, b) => Boolean(a && b && a.length === b.length && a.every((item, i) => Object.is(item, b[i])));
  const hooks = {
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(fn, deps) { const index = cursor++; if (!equalDeps(slots[index]?.deps, deps)) slots[index] = { deps, fn }; return slots[index].fn; },
    useEffect(fn, deps) { const index = cursor++; if (!equalDeps(slots[index]?.deps, deps)) { const old = slots[index]; slots[index] = { deps, cleanup: old?.cleanup }; effects.push(() => { old?.cleanup?.(); slots[index].cleanup = fn(); }); } },
  };
  class FakeAudio {
    constructor(url) { this.url = url; this.duration = duration; this.readyState = 1; this.playCalls = 0; this.pauseCalls = 0; audio.push(this); }
    async play() { this.playCalls++; this.onplaying?.(); }
    pause() { this.pauseCalls++; }
    removeAttribute() {}
    load() {}
  }
  const module = { exports: {} };
  const document = { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  vm.runInNewContext(compiled, { module, exports: module.exports, Error, AbortController, structuredClone, crypto: { randomUUID }, Audio: FakeAudio, document, window: { confirm: () => true, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
    require: name => name === 'react' ? hooks : name === './studio-types' ? { requestJson: async (url, init = {}) => { requests.push({ url, init }); return url === '/api/social' && !init.method ? structuredClone(status) : respond(url, init); } } : name.endsWith('.module.css') ? { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) } : require(name),
  });
  const props = { compact, dealerId, eventId, draftCache, blocked, onBusyChange: value => ownership.push(value), onActivity: value => activities.push(value), onGoToIdle() {}, registerCancel: fn => { cancel = fn; }, onBegin() {}, onReaction: (...args) => reactions.push(args) };
  function render() { cursor = 0; const tree = module.exports.SocialChatPanel(props); while (effects.length) effects.shift()(); return tree; }
  return { render, props, requests, reactions, audio, ownership, activities, document, listeners, exports: module.exports, cancel: (reason) => cancel?.(reason), unmount: () => slots.forEach(slot => slot.cleanup?.()) };
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) { for (const child of node) { const result = find(child, predicate); if (result) return result; } return undefined; }
  if (predicate(node)) return node;
  return find(node.props?.children, predicate);
}
function text(node) { if (node == null || typeof node === 'boolean') return ''; if (typeof node === 'string' || typeof node === 'number') return String(node); if (Array.isArray(node)) return node.map(text).join(''); return text(node.props?.children); }
const messageField = tree => find(tree, node => node.type === 'textarea' && node.props.placeholder === 'Skriv som en spelare vid bordet…');
const button = (tree, label) => find(tree, node => node.type === 'button' && text(node).includes(label));
async function ready(options) { const instance = harness(options); instance.render(); await flush(); return instance; }
function typeMessage(instance, value) { messageField(instance.render()).props.onChange({ target: { value } }); }
function submit(instance) { find(instance.render(), node => node.type === 'form').props.onSubmit({ preventDefault() {} }); }
const replyFor = (body, extra = {}) => ({ requestId: body.requestId, policyRevision: body.policyRevision, reply: policy.response.fixedText, triggerId: 'social.ledsen', confidence: 0.9, provider: 'responded', assetId: 'social.ledsen', ...extra });

test('chat keeps the composer primary and settings/audio collapsed without enabling speech or sending', async () => {
  const instance = await ready({ compact: true }), tree = instance.render();
  assert.match(text(tree), /VID BORDET/);
  assert.match(text(tree), /Chatta med Astrid/);
  for (const label of ['Chattinställningar och ljud', 'Reaktion och svar', 'Standardfrasens ljud', 'Om chatten och kostnader']) {
    const details = find(tree, node => node.type === 'details' && text(node).includes(label));
    assert.ok(details); assert.notEqual(details.props.open, true);
  }
  const voice = find(tree, node => node.type === 'input' && node.props.type === 'checkbox' && node.props.checked === false);
  assert.ok(voice);
  assert.match(text(tree), /nytt tal kan kosta ElevenLabs-krediter/);
  assert.equal(button(tree, 'Skicka till Astrid').props.disabled, true);
  assert.equal(instance.requests.filter(item => item.init.method).length, 0);
  instance.unmount();
});

test('only Astrid idle exposes an enabled player chat; other scenes offer explicit navigation', async () => {
  for (const options of [{ dealerId: 'vera' }, { eventId: 'deal.player.left' }]) {
    const instance = await ready(options), tree = instance.render();
    assert.equal(messageField(tree).props.disabled, true);
    assert.ok(button(tree, 'Gå till Astrids vänteläge'));
    submit(instance); await flush();
    assert.equal(instance.requests.filter(item => item.init.method === 'POST').length, 0);
    instance.unmount();
  }
});

test('scene cancellation aborts in-flight chat and ignores late replies without playing audio or motion', async () => {
  let release;
  const instance = await ready({ respond: (url, init) => new Promise(resolve => { release = () => resolve(replyFor(JSON.parse(init.body))); }) });
  typeMessage(instance, 'Du är otrevlig.'); submit(instance);
  const sent = instance.requests.find(item => item.url === '/api/social/chat');
  assert.ok(sent); instance.cancel();
  assert.equal(sent.init.signal.aborted, true);
  release(); await flush();
  assert.equal(instance.reactions.length, 0); assert.equal(instance.audio.length, 0);
  assert.ok(!text(instance.render()).includes(policy.response.fixedText + 'ASTRID'));
  instance.unmount();
});

test('chat stays mounted across node changes, cancels late replies and keeps the composer', async () => {
  let release;
  const instance = await ready({ compact: true, respond: (url, init) => new Promise(resolve => { release = () => resolve(replyFor(JSON.parse(init.body))); }) });
  typeMessage(instance, 'Ett väntande meddelande'); submit(instance);
  const sent = instance.requests.find(item => item.url === '/api/social/chat');
  instance.props.eventId = 'deal.player.left';
  instance.render();
  assert.equal(sent.init.signal.aborted, true);
  release(); await flush();
  assert.equal(instance.reactions.length, 0);
  assert.equal(instance.audio.length, 0);
  assert.equal(messageField(instance.render()).props.disabled, true);
  instance.props.eventId = 'idle.ready'; instance.render();
  typeMessage(instance, 'Mitt oskickade utkast');
  instance.props.eventId = 'deal.player.left'; instance.render();
  instance.props.eventId = 'idle.ready'; instance.render();
  assert.equal(messageField(instance.render()).props.value, 'Mitt oskickade utkast');
  assert.equal(messageField(instance.render()).props.disabled, false);
  assert.equal(instance.requests.filter(item => item.init.method === 'POST').length, 1);
  instance.unmount();
});

test('cooldown is a system message, never a spoken Astrid reply or model-history entry', async () => {
  const bodies = [];
  const instance = await ready({ respond: async (url, init) => { const body = JSON.parse(init.body); bodies.push(body); return replyFor(body, { triggerId: null, assetId: 'idle.ready.standard', systemNotice: true, suppressed: 'cooldown', reply: 'Serverns pausförklaring.' }); } });
  typeMessage(instance, 'Första meddelandet'); submit(instance); await flush();
  assert.match(text(instance.render()), /SYSTEM \/ PAUS/);
  assert.equal(instance.reactions.length, 0); assert.equal(instance.audio.length, 0);
  typeMessage(instance, 'Andra meddelandet'); submit(instance); await flush();
  assert.equal(bodies[1].message, 'Andra meddelandet');
  assert.deepEqual(bodies[1].history, [{ role: 'user', content: 'Första meddelandet' }]);
  instance.unmount();
});

test('speech is opt-in, exact matched audio plays once and cancellation pauses it', async () => {
  const instance = await ready({ respond: async (url, init) => { const body = JSON.parse(init.body); return replyFor(body, { audio: { id: 'a'.repeat(64), audioUrl: `/api/voice/${'a'.repeat(64)}`, text: policy.response.fixedText, cached: true } }); } });
  const toggle = find(instance.render(), node => node.type === 'input' && node.props.type === 'checkbox' && node.props.checked === false);
  assert.ok(toggle); toggle.props.onChange({ target: { checked: true } });
  typeMessage(instance, 'Ett test'); submit(instance); await flush();
  assert.equal(JSON.parse(instance.requests.find(item => item.url === '/api/social/chat').init.body).voice, true);
  assert.equal(instance.reactions.length, 1); assert.equal(instance.audio.length, 1); assert.equal(instance.audio[0].playCalls, 1);
  assert.equal(instance.reactions[0][2], policy.response.fixedText, 'the main scene receives the exact reply, not an ID');
  instance.cancel(); assert.ok(instance.audio[0].pauseCalls > 0);
  instance.unmount();
});

test('editing social policy does not save implicitly and disables test until explicit save', async () => {
  const instance = await ready();
  const name = find(instance.render(), node => node.type === 'input' && node.props.value === 'Ledsen');
  name.props.onChange({ target: { value: 'Min ledsna reaktion' } });
  typeMessage(instance, 'Hej');
  assert.equal(button(instance.render(), 'Skicka till Astrid').props.disabled, true);
  assert.equal(instance.requests.filter(item => item.init.method).length, 0);
  assert.equal(button(instance.render(), 'Spara sociala inställningar').props.disabled, false);
  instance.unmount();
});

test('two saved-audio replays preserve a neutral model choice without another paid request', async () => {
  const replyText = 'Hej! Trevligt att du tittar förbi.';
  const instance = await ready({ respond: async (url, init) => replyFor(JSON.parse(init.body), {
    triggerId: null, assetId: 'idle.ready.standard', confidence: 0.1, reply: replyText,
    audio: { id: 'c'.repeat(64), audioUrl: `/api/voice/${'c'.repeat(64)}`, text: replyText, cached: true },
  }) });
  const toggle = find(instance.render(), node => node.type === 'input' && node.props.type === 'checkbox' && node.props.checked === false);
  toggle.props.onChange({ target: { checked: true } });
  typeMessage(instance, 'Hej!'); submit(instance); await flush();
  for (let replay = 0; replay < 2; replay++) {
    instance.audio.at(-1).onended(); await flush();
    button(instance.render(), 'Spela sparat ljud').props.onClick(); await flush();
    assert.match(text(instance.render()), /Ingen social reaktion valdes/);
  }
  assert.deepEqual(instance.reactions.map(item => item[0]), Array(3).fill('idle.ready.standard'));
  assert.ok(instance.reactions.every(item => item[2] === replyText));
  assert.equal(instance.audio.length, 3);
  assert.ok(instance.audio.slice(0, 2).every(item => item.pauseCalls > 0));
  assert.equal(instance.requests.filter(item => item.init.method === 'POST').length, 1);
  instance.unmount();
});

test('an unexpected audio field cannot start speech without the user opt-in', async () => {
  const instance = await ready({ respond: async (url, init) => replyFor(JSON.parse(init.body), { audio: { id: 'b'.repeat(64), audioUrl: `/api/voice/${'b'.repeat(64)}`, text: policy.response.fixedText, cached: true } }) });
  typeMessage(instance, 'Ett tyst test'); submit(instance); await flush();
  assert.equal(JSON.parse(instance.requests.find(item => item.url === '/api/social/chat').init.body).voice, false);
  assert.equal(instance.reactions.length, 1); assert.equal(instance.audio.length, 0);
  instance.unmount();
});

test('history drops system output and oldest complete messages to fit bounded API history', () => {
  const instance = harness();
  const input = Array.from({ length: 14 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: 'x'.repeat(1000) }));
  input.push({ role: 'system', content: 'Not a model answer' });
  const before = JSON.stringify(input), result = instance.exports.socialHistory(input);
  assert.equal(result.length, 8); assert.ok(result.every(item => item.role !== 'system'));
  assert.equal(JSON.stringify(input), before);
});

test('another action blocks social input before any provider call', async () => {
  const instance = await ready({ blocked: true });
  typeMessage(instance, 'Hej'); submit(instance); await flush();
  assert.equal(messageField(instance.render()).props.disabled, true);
  assert.equal(instance.requests.filter(item => item.init.method === 'POST').length, 0);
  assert.match(text(instance.render()), /Scenen används av ett annat prov/);
  instance.unmount();
});

test('one owner survives idle rerenders and blocks a second send or replay until audio ends', async () => {
  const instance = await ready({ respond: async (url, init) => replyFor(JSON.parse(init.body), { audio: { id: 'd'.repeat(64), audioUrl: `/api/voice/${'d'.repeat(64)}`, text: policy.response.fixedText, cached: true } }) });
  find(instance.render(), node => node.type === 'input' && node.props.type === 'checkbox' && node.props.checked === false).props.onChange({ target: { checked: true } });
  typeMessage(instance, 'Hej'); submit(instance); submit(instance); await flush();
  assert.equal(instance.ownership.at(-1), true);
  assert.equal(instance.requests.filter(item => item.init.method === 'POST').length, 1);
  for (let i = 0; i < 3; i++) instance.render();
  assert.equal(instance.audio[0].playCalls, 1); assert.equal(instance.audio[0].pauseCalls, 0);
  assert.equal(button(instance.render(), 'Spela sparat ljud').props.disabled, true);
  button(instance.render(), 'Spela sparat ljud').props.onClick(); await flush();
  assert.equal(instance.audio.length, 1);
  instance.audio[0].onended(); await flush();
  assert.equal(instance.ownership.at(-1), false); assert.equal(button(instance.render(), 'Spela sparat ljud').props.disabled, false);
  assert.equal(instance.activities.filter(item => item.type === 'social.responded').length, 1);
  assert.equal(instance.activities.filter(item => item.type === 'social.audio.completed').length, 1);
  instance.unmount();
});

test('overlong audio leaves one text reply, rejects playback and releases ownership', async () => {
  const instance = await ready({ duration: 8, respond: async (url, init) => replyFor(JSON.parse(init.body), { audio: { id: 'e'.repeat(64), audioUrl: `/api/voice/${'e'.repeat(64)}`, text: policy.response.fixedText, cached: true } }) });
  find(instance.render(), node => node.type === 'input' && node.props.type === 'checkbox' && node.props.checked === false).props.onChange({ target: { checked: true } });
  typeMessage(instance, 'Hej'); submit(instance); await flush();
  assert.equal(instance.audio[0].playCalls, 0); assert.equal(instance.ownership.at(-1), false);
  assert.equal(instance.reactions.length, 1); assert.match(text(instance.render()), /längre än sex sekunder/);
  assert.equal(instance.activities.filter(item => item.type === 'social.audio.rejected').length, 1);
  instance.unmount();
});

test('failed model request and explicit stop release the owner and log the actual reason', async () => {
  const failed = await ready({ respond: async () => { throw new Error('offline'); } });
  typeMessage(failed, 'Hej'); submit(failed); await flush();
  assert.equal(failed.ownership.at(-1), false); assert.equal(failed.activities.at(-1).reason, 'offline'); failed.unmount();
  const stopped = await ready({ respond: () => new Promise(() => {}) });
  typeMessage(stopped, 'Hej'); submit(stopped); stopped.cancel('view-change');
  assert.equal(stopped.ownership.at(-1), false); assert.equal(stopped.activities.at(-1).reason, 'view-change'); stopped.unmount();
});

test('leaving the visible page cancels the pending turn rather than allowing background speech', async () => {
  const instance = await ready({ respond: () => new Promise(() => {}) });
  typeMessage(instance, 'Hej'); submit(instance);
  instance.document.hidden = true; instance.listeners.get('visibilitychange')();
  assert.equal(instance.ownership.at(-1), false); assert.equal(instance.activities.at(-1).reason, 'page-hidden');
  assert.equal(instance.requests.find(item => item.url === '/api/social/chat').init.signal.aborted, true);
  instance.unmount();
});

test('social policy draft survives panel navigation and warns before browser reload', async () => {
  const draftCache = { current: null }, instance = await ready({ draftCache });
  const name = find(instance.render(), node => node.type === 'input' && node.props.value === 'Ledsen');
  name.props.onChange({ target: { value: 'Osparat nytt namn' } }); instance.render();
  assert.equal(draftCache.current.draft.trigger.label, 'Osparat nytt namn');
  let warned = false;
  instance.listeners.get('beforeunload')({ preventDefault() { warned = true; }, returnValue: undefined });
  assert.equal(warned, true);
  instance.unmount();
  const restored = harness({ draftCache }), tree = restored.render(); await flush();
  assert.ok(find(tree, node => node.type === 'input' && node.props.value === 'Osparat nytt namn'));
  assert.equal(restored.requests.length, 0, 'remount must not replace the unsaved draft with a GET');
  assert.match(text(tree), /försvinner om du laddar om/);
  restored.unmount();
});

test('studio uses a distinct direct-preview state, cancellation and separate social panel', () => {
  const studio = readFileSync(new URL('./studio.tsx', import.meta.url), 'utf8');
  const direct = studio.match(/function previewSelected\(\) \{([\s\S]*?)\n  \}/)?.[1];
  assert.ok(direct); assert.match(direct, /setPreviewKind\('selected'\)/);
  assert.doesNotMatch(direct, /requestJson|setResult\(response\)/);
  assert.match(studio, /onPreview=\{previewSelected\}/);
  assert.match(studio, /signal: controller\.signal/);
  assert.match(studio, /cancelSocial\.current\?\.\(\)/);
  assert.match(readFileSync(new URL('./event-test-panel.tsx', import.meta.url), 'utf8'), /Det är inget godkänt regelbeslut/);
  assert.match(studio, /<SocialChatPanel/);
  assert.match(studio, /aria-live="polite" aria-atomic="true"/);
  assert.match(studio, /<p>\{socialReply\}<\/p>/);
  assert.match(studio, /previewKind !== 'social'/);
  assert.match(studio, /prefers-reduced-motion: reduce/);
  assert.match(studio, /Visa chatten/);
  assert.match(readFileSync(new URL('./gateway-panel.tsx', import.meta.url), 'utf8'), /off: 'Bara standard'/);
});
