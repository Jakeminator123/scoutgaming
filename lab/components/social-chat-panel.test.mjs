import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import { modeLabels } from '../lib/director-modes.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const source = readFileSync(new URL('./social-chat-panel.tsx', import.meta.url), 'utf8');
const compiled = transformSync(source, { filename: 'social-chat-panel.tsx', jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } }).code;
const policy = { schemaVersion: 1, revision: 'social-fixture-123', trigger: { id: 'social.ledsen', label: 'Ledsen', enabled: true, directive: 'Reagera på ohövlighet.', threshold: 0.7 }, response: { mode: 'fixed', fixedText: 'Oj, nu var du oförskämd.' }, cooldownMs: 5000 };
const status = { policy, configured: true, voiceConfigured: true };
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };

// Focused hook harness: exercises real handlers and cancellation without a browser,
// a model, external audio or an additional test dependency.
function harness({ compact = false, companionEnabled = false, voiceConfigured = true, generatedSpeechConfigured = false, autoFrames = true, dealerId = 'astrid', eventId = 'idle.ready', draftCache, duration = 2, blocked = false, respond = async () => { throw new Error('Unexpected request'); }, playGenerated = async () => { throw new Error('Unexpected generated playback'); } } = {}) {
  const slots = [], requests = [], reactions = [], audio = [], generated = [], effects = [], ownership = [], activities = [];
  const frames = new Map(); let frameSequence = 0;
  const requestAnimationFrame = fn => { const id = ++frameSequence; frames.set(id, fn); if (autoFrames) queueMicrotask(() => { if (frames.delete(id)) fn(); }); return id; };
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
  vm.runInNewContext(compiled, { module, exports: module.exports, Error, AbortController, structuredClone, crypto: { randomUUID }, Audio: FakeAudio, document, window: { confirm: () => true, requestAnimationFrame, cancelAnimationFrame: id => frames.delete(id), addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
    require: name => name === 'react' ? hooks : name === './studio-types' ? { requestJson: async (url, init = {}) => { requests.push({ url, init }); return url === '/api/social' && !init.method ? structuredClone({ ...status, voiceConfigured, companionEnabled, generatedSpeech: { configured: generatedSpeechConfigured } }) : respond(url, init); } } : name === '../../web/public/generated-speech-player.mjs' ? { playGeneratedSpeech: async (value, options) => { generated.push({ value, options }); return playGenerated(value, options); } } : name.endsWith('.module.css') ? { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) } : require(name),
  });
  const props = { compact, dealerId, eventId, draftCache, blocked, speechHost: { current: { testId: 'same-stage-host' } }, onBusyChange: value => ownership.push(value), onActivity: value => activities.push(value), onGoToIdle() {}, registerCancel: fn => { cancel = fn; }, onBegin() {}, onReaction: (...args) => reactions.push(args) };
  function render() { cursor = 0; const tree = module.exports.SocialChatPanel(props); while (effects.length) effects.shift()(); return tree; }
  return { render, props, requests, reactions, audio, generated, frames, ownership, activities, document, listeners, exports: module.exports, cancel: (reason) => cancel?.(reason), unmount: () => slots.forEach(slot => slot.cleanup?.()) };
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

test('chat defaults to speech but never generates it until sending; only one settings section is exposed', async () => {
  const instance = await ready({ compact: true }), tree = instance.render();
  assert.match(text(tree), /Fristående chattprov med Astrid/);
  for (const label of ['Inställningar', 'Uttryck och svar', 'Standardfrasens ljud']) {
    const details = find(tree, node => node.type === 'details' && [node.props.children].flat().some(child => child?.type === 'summary' && text(child).includes(label)));
    assert.ok(details); assert.notEqual(details.props.open, true);
  }
  const voice = find(tree, node => node.type === 'input' && node.props['aria-label'] === 'Ljud från ElevenLabs');
  assert.ok(voice); assert.equal(voice.props.checked, true);
  assert.match(text(tree), /använder krediter/);
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

test('compact chat is collapsed beside deal clips, opens at idle and keeps drafts when toggled', async () => {
  const instance = await ready({ compact: true, eventId: 'deal.player.left' });
  const disclosure = tree => find(tree, node => node.type === 'details' && node.props.className === 'chatDisclosure');
  assert.equal(disclosure(instance.render()).props.open, false);
  assert.match(text(instance.render()), /Separat chattprov/);
  disclosure(instance.render()).props.onToggle({ currentTarget: { open: true } });
  assert.equal(disclosure(instance.render()).props.open, true);
  instance.props.eventId = 'idle.ready'; instance.render();
  assert.equal(disclosure(instance.render()).props.open, true);
  typeMessage(instance, 'Behåll mitt utkast');
  disclosure(instance.render()).props.onToggle({ currentTarget: { open: false } });
  assert.equal(disclosure(instance.render()).props.open, false);
  assert.equal(messageField(instance.render()).props.value, 'Behåll mitt utkast');
  assert.equal(instance.requests.filter(item => item.init.method).length, 0);
  instance.props.eventId = 'deal.player.right'; instance.render();
  assert.equal(disclosure(instance.render()).props.open, false);
  assert.equal(messageField(instance.render()).props.value, 'Behåll mitt utkast');
  instance.props.eventId = 'idle.ready'; instance.render();
  assert.equal(disclosure(instance.render()).props.open, true);
  instance.unmount();
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
  assert.match(text(instance.render()), /SYSTEM/);
  assert.equal(instance.reactions.length, 0); assert.equal(instance.audio.length, 0);
  typeMessage(instance, 'Andra meddelandet'); submit(instance); await flush();
  assert.equal(bodies[1].message, 'Andra meddelandet');
  assert.deepEqual(bodies[1].history, [{ role: 'user', content: 'Första meddelandet' }]);
  instance.unmount();
});

test('speech is on by default, exact matched audio plays once and cancellation pauses it', async () => {
  const instance = await ready({ respond: async (url, init) => { const body = JSON.parse(init.body); return replyFor(body, { audio: { id: 'a'.repeat(64), audioUrl: `/api/voice/${'a'.repeat(64)}`, text: policy.response.fixedText, cached: true } }); } });
  const toggle = find(instance.render(), node => node.type === 'input' && node.props['aria-label'] === 'Ljud från ElevenLabs');
  assert.ok(toggle); assert.equal(toggle.props.checked, true);
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
  const disclosure = find(instance.render(), node => node.type === 'details' && node.props.className === 'chatDisclosure');
  disclosure.props.onToggle({ currentTarget: { open: false } });
  assert.ok(find(instance.render(), node => node.type === 'input' && node.props.value === 'Min ledsna reaktion'));
  assert.match(text(find(instance.render(), node => node.type === 'summary' && node.props.className === 'heading')), /Osparad policy/);
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
  const toggle = find(instance.render(), node => node.type === 'input' && node.props['aria-label'] === 'Ljud från ElevenLabs');
  assert.equal(toggle.props.checked, true);
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

test('muting speech prevents playback even if the response unexpectedly contains audio', async () => {
  const instance = await ready({ respond: async (url, init) => replyFor(JSON.parse(init.body), { audio: { id: 'b'.repeat(64), audioUrl: `/api/voice/${'b'.repeat(64)}`, text: policy.response.fixedText, cached: true } }) });
  find(instance.render(), node => node.type === 'input' && node.props['aria-label'] === 'Ljud från ElevenLabs').props.onChange({ target: { checked: false } });
  typeMessage(instance, 'Ett tyst test'); submit(instance); await flush();
  assert.equal(JSON.parse(instance.requests.find(item => item.url === '/api/social/chat').init.body).voice, false);
  assert.equal(instance.reactions.length, 1); assert.equal(instance.audio.length, 0);
  instance.unmount();
});

test('voice preference stays on but unavailable ElevenLabs sends text-only and cannot play unexpected audio', async () => {
  const instance = await ready({ voiceConfigured: false, respond: async (url, init) => replyFor(JSON.parse(init.body), { audio: { id: 'b'.repeat(64), audioUrl: `/api/voice/${'b'.repeat(64)}`, text: policy.response.fixedText, cached: true } }) });
  const toggle = find(instance.render(), node => node.props?.['aria-label'] === 'Ljud från ElevenLabs');
  assert.equal(toggle.props.checked, true);
  assert.equal(toggle.props.disabled, true);
  typeMessage(instance, 'Hej'); submit(instance); await flush();
  assert.equal(JSON.parse(instance.requests.find(item => item.url === '/api/social/chat').init.body).voice, false);
  assert.equal(instance.audio.length, 0);
  assert.equal(instance.activities.find(item => item.type === 'social.responded').data.output, 'text');
  instance.unmount();
});

test('configured generated package owns one exact paired playback in the same scene, never a second audio player', async () => {
  let complete;
  const instance = await ready({ generatedSpeechConfigured: true, voiceConfigured: false,
    respond: async (_url, init) => replyFor(JSON.parse(init.body), {
      speechPackage: { packageId: 'fixture-paired-package' },
      audio: { id: 'a'.repeat(64), audioUrl: `/api/voice/${'a'.repeat(64)}`, text: policy.response.fixedText, cached: true },
    }),
    playGenerated: async (_value, options) => {
      options.onStart(); options.onReceipt({ state: 'start', packageId: 'fixture-paired-package', reviewStatus: 'pending' });
      await new Promise(resolve => { complete = resolve; });
      options.onReceipt({ state: 'end', packageId: 'fixture-paired-package', reviewStatus: 'pending' });
    },
  });
  assert.match(text(instance.render()), /ElevenLabs \+ läppsynk · labbprov, ej visuellt godkänt/);
  typeMessage(instance, 'Hej, säg något kort.'); submit(instance); await flush();
  assert.equal(instance.generated.length, 1);
  const { options } = instance.generated[0];
  assert.equal(options.exactText, policy.response.fixedText);
  assert.equal(options.dealerId, 'astrid');
  assert.equal(options.mount, instance.props.speechHost.current);
  const request = instance.requests.find(item => item.url === '/api/social/chat');
  assert.equal(options.signal, request.init.signal);
  assert.equal(JSON.parse(request.init.body).voice, true);
  assert.equal(instance.audio.length, 0);
  assert.equal(instance.reactions.length, 1);
  assert.equal(instance.ownership.at(-1), true);
  typeMessage(instance, 'Ett till'); submit(instance);
  assert.equal(instance.requests.filter(item => item.init.method === 'POST').length, 1);
  complete(); await flush();
  assert.equal(instance.ownership.at(-1), false);
  const receipts = instance.activities.filter(item => item.type.startsWith('social.audio.'));
  assert.deepEqual(receipts.map(item => item.type), ['social.audio.started', 'social.audio.completed']);
  assert.ok(receipts.every(item => item.data.lipsyncVerified === false && item.data.reviewStatus === 'pending'));
  instance.unmount();
});

test('cancel before the scene frame prevents generated playback and leaves no frame callback', async () => {
  const instance = await ready({ generatedSpeechConfigured: true, autoFrames: false,
    respond: async (_url, init) => replyFor(JSON.parse(init.body), { speechPackage: { packageId: 'fixture-before-frame' } }),
  });
  typeMessage(instance, 'Hej'); submit(instance); await flush();
  assert.equal(instance.frames.size, 1);
  assert.equal(instance.generated.length, 0);
  instance.cancel('user-stop'); await flush();
  assert.equal(instance.frames.size, 0);
  assert.equal(instance.generated.length, 0);
  assert.equal(instance.audio.length, 0);
  assert.equal(instance.ownership.at(-1), false);
  instance.unmount();
});

test('generated playback cancels through the shared request signal on stop, scene change, blocking and unmount', async () => {
  for (const operation of ['stop', 'scene', 'blocked', 'unmount']) {
    const instance = await ready({ generatedSpeechConfigured: true,
      respond: async (_url, init) => replyFor(JSON.parse(init.body), { speechPackage: { packageId: 'fixture-cancellation' } }),
      playGenerated: async (_value, options) => {
        options.onStart(); options.onReceipt({ state: 'start', reviewStatus: 'pending' });
        await new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => {
          options.onReceipt({ state: 'interrupted', reviewStatus: 'pending' }); reject(new Error('fixture cancelled'));
        }, { once: true }));
      },
    });
    typeMessage(instance, 'Hej'); submit(instance); await flush();
    assert.equal(instance.generated.length, 1, operation);
    const signal = instance.generated[0].options.signal;
    if (operation === 'stop') instance.cancel('user-stop');
    if (operation === 'scene') { instance.props.eventId = 'deal.player.left'; instance.render(); }
    if (operation === 'blocked') { instance.props.blocked = true; instance.render(); }
    if (operation === 'unmount') instance.unmount();
    await flush();
    assert.equal(signal.aborted, true, operation);
    assert.equal(instance.audio.length, 0, operation);
    assert.equal(instance.ownership.at(-1), false, operation);
    assert.ok(instance.activities.some(item => item.type === 'social.audio.cancelled'), operation);
    assert.ok(!instance.activities.some(item => item.type === 'social.audio.completed'), operation);
    if (operation !== 'unmount') instance.unmount();
  }
});

test('muting ignores unexpected generated packages; missing host or unconfigured preview never starts them', async () => {
  for (const operation of ['muted', 'no-host', 'unconfigured']) {
    const instance = await ready({ generatedSpeechConfigured: operation !== 'unconfigured',
      respond: async (_url, init) => replyFor(JSON.parse(init.body), { speechPackage: { packageId: 'fixture-gated' } }),
    });
    if (operation === 'muted') find(instance.render(), node => node.type === 'input' && node.props['aria-label'] === 'Ljud från ElevenLabs').props.onChange({ target: { checked: false } });
    if (operation === 'no-host') instance.props.speechHost.current = null;
    typeMessage(instance, 'Hej'); submit(instance); await flush();
    assert.equal(instance.generated.length, 0, operation);
    assert.equal(instance.audio.length, 0, operation);
    assert.equal(instance.ownership.at(-1), false, operation);
    if (operation !== 'muted') assert.ok(find(instance.render(), node => node.props?.role === 'alert'), operation);
    instance.unmount();
  }
});

test('a rejected generated package keeps its text reply but never falls through to another audio or automatic regeneration', async () => {
  const instance = await ready({ generatedSpeechConfigured: true,
    respond: async (_url, init) => replyFor(JSON.parse(init.body), {
      speechPackage: { packageId: 'fixture-rejected' },
      audio: { id: 'a'.repeat(64), audioUrl: `/api/voice/${'a'.repeat(64)}`, text: policy.response.fixedText, cached: true },
    }),
    playGenerated: async () => { throw new Error('Generated speech media hash mismatch'); },
  });
  typeMessage(instance, 'Hej'); submit(instance); await flush();
  assert.equal(instance.generated.length, 1);
  assert.equal(instance.audio.length, 0);
  assert.equal(instance.requests.filter(item => item.init.method === 'POST').length, 1);
  assert.equal(instance.ownership.at(-1), false);
  assert.match(text(instance.render()), /Generated speech media hash mismatch/);
  assert.match(text(instance.render()), /Oj, nu var du oförskämd/);
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
  const instance = await ready({ duration: 26, respond: async (url, init) => replyFor(JSON.parse(init.body), { audio: { id: 'e'.repeat(64), audioUrl: `/api/voice/${'e'.repeat(64)}`, text: policy.response.fixedText, cached: true } }) });
  typeMessage(instance, 'Hej'); submit(instance); await flush();
  assert.equal(instance.audio[0].playCalls, 0); assert.equal(instance.ownership.at(-1), false);
  assert.equal(instance.reactions.length, 1); assert.match(text(instance.render()), /längre än 25 sekunder/);
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
  assert.match(studio, /speechHost=\{speechHost\}/);
  assert.match(studio, /<div className=\{socialStyles\.speechStage\}><Stage/);
  assert.match(studio, /<div ref=\{speechHost\} className=\{socialStyles\.speechHost\} \/><\/div>/);
  assert.match(studio, /aria-live="polite" aria-atomic="true"/);
  assert.match(studio, /<p>\{socialReply\}<\/p>/);
  assert.match(studio, /previewKind !== 'social'/);
  assert.match(studio, /prefers-reduced-motion: reduce/);
  assert.match(studio, /Visa chatten/);
  assert.equal(modeLabels.off, 'Standard');
  assert.match(readFileSync(new URL('./gateway-panel.tsx', import.meta.url), 'utf8'), /export \{ modeLabels, modeExplanations \}/);
});

test('companion asks a new visitor, restores returned memory and forgets without generating speech', async () => {
  let profile = { name: null, history: [], greeting: 'Tjena! Vem kom in?', names: ['Jakob', 'Emil', 'Kevin', 'Alex', 'John'], retentionDays: 30 };
  const instance = await ready({ companionEnabled: true, respond: async (url, init) => {
    assert.equal(url, '/api/social/profile');
    if (init.method === 'POST') {
      const body = JSON.parse(init.body);
      profile = { ...profile, name: body.operation === 'forget' ? null : body.name, history: [], greeting: body.operation === 'forget' ? 'Vem kom in?' : 'Tjena Jakob!' };
    }
    return structuredClone(profile);
  } });
  instance.render(); await flush();
  typeMessage(instance, 'Hej'); submit(instance); await flush();
  assert.equal(instance.requests.some(item => item.url === '/api/social/chat'), false);
  await button(instance.render(), 'Jakob').props.onClick(); await flush();
  assert.match(text(instance.render()), /Du är Jakob/);
  await button(instance.render(), 'Glöm mig').props.onClick(); await flush();
  assert.match(text(instance.render()), /Vem kom in/); assert.equal(instance.audio.length, 0);
  instance.unmount();
  const returning = await ready({ companionEnabled: true, respond: async () => ({ ...profile, name: 'John', history: [{ role: 'user', content: 'Min favorithobby är paddling.' }], greeting: 'Tjena John! Kul att du är tillbaka.' }) });
  returning.render(); await flush();
  assert.match(text(returning.render()), /paddling/); assert.match(text(returning.render()), /Tjena John/);
  returning.unmount();
});
