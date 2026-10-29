// PR 3 (plan-chatt-tal-lipsync §3): a chat answer's generated speech in the shared room.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { createSharedRoomPresentationPorts } from '../services/game/public/shared-room-presentation.mjs';
import { mountSharedRoomApp } from '../services/game/public/shared-room-app.mjs';

const roomId = 'room-a', actor = 'alice';
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function snapshot(presentationVer = 1, extra = {}) {
  return { contract: 'blackjack-table/1', roomId, version: presentationVer, presentationVer, configVersion: 'cfg-1', windowId: 'window-1',
    phase: 'bets', roundId: null, turnSeq: 0, owners: Array(7).fill(null), seatGen: Array(7).fill(0), bets: Array.from({ length: 7 }, () => ({ main: 0, pp: 0, tp: 0 })),
    players: [], deadline: null, actionDeadline: null, plan: null, round: null, serverNow: 1000, unopened: false,
    settings: { configVersion: 'cfg-1', language: 'sv', betMs: 20000, actionMs: 15000, limits: { min: .5, max: 2000, sideMax: 100 }, chips: [.5, 1, 5], refill: 1000 },
    me: { id: actor, seats: [], memberGen: 0, active: false, available: 1000, pausedUntil: 0, insuranceDue: false, lastSettlement: null }, ...extra };
}
// The server's descriptor (moving-speech-stream); its ticket and hashes are checked by playGeneratedSpeech itself.
const speechStream = (extra = {}) => ({ schemaVersion: 1, kind: 'moving-speech-stream', id: 'a'.repeat(32), requestId: 'req-1', dealerId: 'paow',
  exactText: 'Lycka till vid bordet.', url: '/moving-speech-stream', ticket: 'e30.' + 'x'.repeat(43), expiresAt: Date.now() + 15000, ...extra });

function harness({ muted = () => false, playSpeech, dealerId = 'paow' } = {}) {
  const states = [], layers = [], captions = [], played = [], film = [];
  const media = { state: patch => states.push(patch), present: () => { const step = deferred(); film.push(step); return step.promise; }, close() {} };
  const cards = { restore() {}, sync() {}, clear() {}, show() {}, reveal() {}, close() {} };
  const composition = { prepareClip: (...args) => layers.push(['prepare', ...args]), renderFrame: (...args) => { layers.push(['frame', ...args]); return true; },
    setMovingSpeechLayer: layer => layers.push(['layer', layer]), close() {} };
  const host = { id: 'scene' };
  const ports = createSharedRoomPresentationPorts({ media, cards, composition, clock: () => 1000, dealerId, host, muted,
    caption: { show: text => captions.push(text) },
    playSpeech: async (descriptor, options) => { played.push({ descriptor, options }); return playSpeech?.(descriptor, options); } });
  const signal = new AbortController().signal;
  ports.restoreSnapshot(snapshot(1), { signal, receivedAt: 1000 });
  return { ports, states, layers, captions, played, film, host, signal };
}
const plan = ver => ({ roomId, ver, kind: 'plan', talkId: 'talk', startAt: 1000, endAt: 100000, events: [{ type: 'deal', shoeDraw: 1 }] });
const aborted = signal => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));

test('speech pauses the idle film, draws through the room composition and resumes idle when it ends', async () => {
  const h = harness({ playSpeech: async (descriptor, options) => {
    options.prepareRendering(null, 'framing'); options.renderFrame('video', 3); options.setMovingSpeechLayer('lapp');
    options.onStart(descriptor.exactText); options.assertCurrent();
    // Another player's ready changes the idle input; the dealer keeps speaking.
    h.ports.restoreSnapshot(snapshot(1, { players: [{ id: actor, seats: [0], ready: true }] }), { signal: h.signal, receivedAt: 1000 });
  } });
  assert.deepEqual(await h.ports.speak(speechStream()), { speech: 'played' });
  assert.deepEqual(h.states, [{ ready: false, action: false, speech: false }, { speech: true, ready: false },
    { ready: true, action: false, speech: true }, { speech: false, ready: true }]);
  const { options } = h.played[0];
  assert.equal(options.dealerId, 'paow'); assert.equal(options.requestId, 'req-1'); assert.equal(options.exactText, 'Lycka till vid bordet.');
  assert.equal(options.mount, h.host); assert.ok(options.signal instanceof AbortSignal);
  assert.deepEqual(h.layers, [['prepare', undefined, 'framing'], ['frame', 'video', 3], ['layer', 'lapp']]);
  assert.deepEqual(h.captions, ['Lycka till vid bordet.']);
  h.ports.close();
});

test('speech waits for a playing plan, and a new presentation stops it without restarting idle under the plan', async () => {
  const h = harness({ playSpeech: (_descriptor, options) => aborted(options.signal) });
  h.ports.restoreSnapshot(snapshot(2), { signal: h.signal, receivedAt: 1000 });
  const first = h.ports.present(plan(2), { signal: h.signal }); await turn();
  const speaking = h.ports.speak(speechStream()); await turn();
  assert.equal(h.played.length, 0, 'no speech while the plan plays');
  h.film[0].resolve(true); await first; await turn(); await turn();
  assert.equal(h.played.length, 1, 'the answer speaks once the plan has ended');
  assert.deepEqual(h.states.slice(-2), [{ action: false, speech: false, ready: false }, { speech: true, ready: false }]);
  h.ports.restoreSnapshot(snapshot(3), { signal: h.signal, receivedAt: 1000 });
  const second = h.ports.present(plan(3), { signal: h.signal });
  assert.ok(h.played[0].options.signal.aborted, 'the presentation stops the speech');
  assert.deepEqual(await speaking, { speech: 'cancelled', reason: 'presentation' });
  assert.deepEqual(h.states.at(-1), { action: true, speech: false }, 'the cancelled answer leaves the dealer to the plan');
  h.film[1].resolve(true); await second; h.ports.close();
});

test('a descriptor of another dealer is refused, and a closed table makes the playing answer stale', async () => {
  const h = harness({ playSpeech: (_descriptor, options) => aborted(options.signal) });
  await assert.rejects(h.ports.speak(speechStream({ dealerId: 'dragan' })), /shared_room_speech_dealer_mismatch/);
  await assert.rejects(h.ports.speak({ ...speechStream(), kind: 'recorded' }), /shared_room_speech_invalid/);
  assert.equal(h.played.length, 0); assert.equal(h.states.length, 1, 'the idle film is untouched');
  const speaking = h.ports.speak(speechStream()); await turn(); await turn();
  h.ports.close();
  assert.throws(() => h.played[0].options.assertCurrent(), /AbortError|Shared room speech closed/);
  assert.deepEqual(await speaking, { speech: 'cancelled', reason: 'closed' });
  assert.equal(h.states.at(-1).speech, true, 'a closed table restarts no idle film');
  await assert.rejects(h.ports.speak(speechStream()), /shared_room_media_authority_unavailable/);
});

test('a muted player gets the text and Slå på ljud; muting during speech ends it as text', async () => {
  const quiet = harness({ muted: () => true });
  assert.deepEqual(await quiet.ports.speak(speechStream()), { speech: 'text-only', reason: 'muted', action: 'Slå på ljud' });
  assert.equal(quiet.played.length, 0); assert.equal(quiet.states.length, 1, 'idle keeps playing for a muted player');
  assert.deepEqual(quiet.captions, ['Lycka till vid bordet.']); quiet.ports.close();
  let mute = false;
  const h = harness({ muted: () => mute, playSpeech: async (_descriptor, options) => { mute = true; options.assertCurrent(); } });
  assert.deepEqual(await h.ports.speak(speechStream()), { speech: 'text-only', reason: 'muted', action: 'Slå på ljud' });
  assert.deepEqual(h.states.slice(-2), [{ speech: true, ready: false }, { speech: false, ready: false }]);
  assert.deepEqual(h.captions, ['Lycka till vid bordet.']); h.ports.close();
});

// Example for the room's chat panel (PR 1): app.presentation.speak(result.decision.speechStream).
test('the shared room app exposes speak through the confirmed binding only', async t => {
  const dataset = { sharedRoom: '1', gameLane: 'saved', gameDealer: 'paow', gameLocalDealer: 'paow', gamePresentation: 'local', gameOperator: 'north',
    gameRegisteredDealers: JSON.stringify([{ id: 'paow', label: 'Paow' }]), gamePackageRevision: '1', gameBranding: '{}', gameRoomId: roomId };
  const document = { documentElement: { dataset, style: {} }, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({}) };
  const window = new EventTarget(); window.location = { origin: 'https://game.invalid', href: 'https://game.invalid/game?room=room-a' };
  const binding = { owner: 'web', roomId, configVersion: 'cfg-1', windowId: 'window-1', presentationContext: { operatorSlug: 'north', roomId, packageRevision: 1, dealerId: 'paow' },
    selection: { lane: 'saved', dealer: 'paow', presentation: 'local', localDealer: 'paow', registeredDealers: [{ id: 'paow', label: 'Paow' }], operator: 'north', roomId, packageRevision: 1, branding: {} } };
  const spoken = []; let socket, sound = 0;
  const app = await mountSharedRoomApp({ document, window, fetchImpl: async () => Response.json(binding),
    createCommands: () => ({ state: 'idle', send: async () => ({ status: 'ok' }), stop() {} }),
    createView: () => ({ bind() {}, render() {}, close() {} }), createSocket: options => { socket = options; return { start() {}, stop() {} }; },
    createPresentation: async options => { options.onReady('paow'); return { restoreSnapshot() {}, present() {}, close() {},
      speak: async (descriptor, value) => { spoken.push([descriptor, value]); return { speech: 'played' }; }, enableSound: () => { sound++; } }; } });
  t.after(app.close);
  const result = { decision: { speechStream: speechStream() } };
  await assert.rejects(app.presentation.speak(result.decision.speechStream), /shared_room_media_authority_unavailable/);
  await socket.restoreSnapshot(snapshot(1), { signal: new AbortController().signal });
  assert.deepEqual(await app.presentation.speak(result.decision.speechStream), { speech: 'played' });
  assert.equal(spoken[0][0], result.decision.speechStream);
  app.presentation.enableSound(); assert.equal(sound, 1);
});
