import test from 'node:test';
import assert from 'node:assert/strict';
import { createSocialPlayback } from '../lib/social-playback.mjs';

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function fixture({ duration = 2, readyState = 1, play } = {}) {
  const elements = [], timers = new Map(), states = [], receipts = [];
  let timerId = 0;
  const player = createSocialPlayback({
    createAudio(source) {
      const audio = { source, duration, readyState, currentTime: 0, ended: false, playCalls: 0, pauseCalls: 0,
        play() { this.playCalls++; this.onplaying?.(); return play?.() ?? Promise.resolve(); },
        pause() { this.pauseCalls++; }, load() {}, removeAttribute() {} };
      elements.push(audio); return audio;
    },
    schedule(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimer(id) { timers.delete(id); },
    onState(value) { states.push(value); }, onActivity(value) { receipts.push(value); },
  });
  function fireTimer(ms) { const match = [...timers].find(([, timer]) => timer.ms === ms); assert.ok(match, `timer ${ms} exists`); timers.delete(match[0]); match[1].fn(); }
  return { player, elements, timers, states, receipts, fireTimer };
}

test('metadata over 25 seconds is rejected before any audio play call', async () => {
  for (const duration of [25.01, 30, Infinity]) {
    const f = fixture({ duration }), result = await f.player.play('/voice');
    assert.equal(result.outcome, 'rejected'); assert.equal(result.reason, 'audio-longer-than-25-seconds');
    assert.equal(f.elements[0].playCalls, 0); assert.equal(f.player.active, false); assert.equal(f.timers.size, 0);
  }
});

test('a 24-second poem now plays once and completes normally', async () => {
  const f = fixture({ duration: 24 }), pending = f.player.play('/poem');
  await flush(); assert.equal(f.elements[0].playCalls, 1);
  f.elements[0].currentTime = 24; f.elements[0].ended = true; f.elements[0].onended();
  assert.equal((await pending).outcome, 'completed'); assert.equal(f.timers.size, 0);
});

test('metadata must arrive before playback and missing metadata fails without retry', async () => {
  const f = fixture({ readyState: 0 }), pending = f.player.play('/voice');
  await flush(); assert.equal(f.elements[0].playCalls, 0);
  const staleMetadata = f.elements[0].onloadedmetadata;
  f.fireTimer(3000); const result = await pending;
  assert.equal(result.reason, 'audio-metadata-timeout'); staleMetadata(); await flush();
  assert.equal(f.elements[0].playCalls, 0); assert.equal(f.receipts.length, 1);
});

test('arriving metadata permits one play and natural end clears the hard watchdog', async () => {
  const f = fixture({ readyState: 0 }), pending = f.player.play('/voice');
  const element = f.elements[0]; element.onloadedmetadata(); element.onloadedmetadata(); await flush();
  assert.equal(element.playCalls, 1); assert.equal(f.player.active, true);
  element.onended(); const result = await pending;
  assert.equal(result.outcome, 'completed'); assert.equal(f.timers.size, 0); assert.deepEqual(f.states, ['loading', 'playing', 'idle']);
});

test('unknown or falsely short duration is stopped by the 25-second watchdog as a failed preview', async () => {
  for (const duration of [NaN, 2]) {
    const f = fixture({ duration }), pending = f.player.play('/voice'); await flush(); f.fireTimer(25000);
    const result = await pending;
    assert.equal(result.outcome, 'failed'); assert.equal(result.reason, 'speech-25-second-watchdog');
    assert.ok(f.elements[0].pauseCalls > 0); assert.equal(f.timers.size, 0);
  }
});

test('a second play is rejected while the owner is held, without interrupting the first', async () => {
  const f = fixture(), first = f.player.play('/first'); await flush();
  const second = await f.player.play('/second');
  assert.equal(second.reason, 'speech-owner-busy'); assert.equal(f.elements.length, 1); assert.equal(f.player.active, true);
  f.player.cancel('user-stop'); assert.equal((await first).reason, 'user-stop');
});

test('explicit stop owns the reason and late play resolution or old events cannot affect another turn', async () => {
  let resolvePlay;
  const f = fixture({ play: () => new Promise(resolve => { resolvePlay = resolve; }) });
  const first = f.player.play('/first'); await flush();
  const old = f.elements[0], staleEnded = old.onended;
  f.player.cancel('view-change'); assert.equal((await first).reason, 'view-change');
  const resolveOld = resolvePlay, second = f.player.play('/second'); await flush();
  resolveOld(); staleEnded(); await flush();
  assert.equal(f.player.active, true); assert.ok(old.pauseCalls >= 2); assert.equal(f.receipts.length, 1);
  f.player.cancel('user-stop'); await second;
});

test('current time and changing metadata also enforce the bound', async () => {
  for (const source of ['time', 'metadata']) {
    const f = fixture(), pending = f.player.play('/voice'); await flush();
    const element = f.elements[0];
    if (source === 'time') { element.currentTime = 25; element.ontimeupdate(); }
    else { element.duration = 26; element.ondurationchange(); }
    assert.notEqual((await pending).outcome, 'completed'); assert.equal(f.player.active, false);
  }
});

test('browser autoplay rejection produces one failed receipt and no automatic replay', async () => {
  const f = fixture({ play: () => Promise.reject(new Error('NotAllowedError')) });
  const result = await f.player.play('/voice');
  assert.equal(result.reason, 'audio-play-rejected'); assert.equal(f.elements[0].playCalls, 1); assert.equal(f.receipts.length, 1); assert.equal(f.timers.size, 0);
});

test('delayed browser end notification cannot label an overlong take completed', async () => {
  const f = fixture(), pending = f.player.play('/voice'); await flush();
  f.elements[0].currentTime = 25.5; f.elements[0].onended();
  const result = await pending;
  assert.equal(result.outcome, 'failed'); assert.equal(result.reason, 'speech-25-second-watchdog');
});
