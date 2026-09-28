import test from 'node:test';
import assert from 'node:assert/strict';
import { createAstridCameraControl } from '../web/public/astrid-camera-control.mjs';

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.hidden = false; this.value = ''; this.listeners = new Map(); this.style = {}; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute() {}
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  pause() {}
  play() { return Promise.resolve(); }
}
function find(root, text) {
  if (root.textContent === text) return root;
  for (const child of root.children) { const match = find(child, text); if (match) return match; }
  return null;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness({ enabled = true, permission = 'allow', deferredPlayback = false, canStart = () => true } = {}) {
  const priorDocument = globalThis.document, priorWindow = globalThis.window;
  const priorSetTimeout = globalThis.setTimeout;
  let timeoutCallback;
  globalThis.setTimeout = (fn, delay, ...args) => delay === 30000 ? (timeoutCallback = fn, 987654321) : priorSetTimeout(fn, delay, ...args);
  const listeners = new Map(), playback = [];
  globalThis.document = { hidden: false, createElement: tag => {
    const element = new Element(tag);
    if (tag === 'video' && deferredPlayback) element.play = () => new Promise(resolve => playback.push(resolve));
    return element;
  }, addEventListener: (name, fn) => listeners.set(name, fn) };
  globalThis.window = { addEventListener: (name, fn) => listeners.set(name, fn) };
  const container = new Element('div');
  const tracks = [{ stopped: false, stop() { this.stopped = true; }, addEventListener() {} },
    { stopped: false, stop() { this.stopped = true; }, addEventListener() {} }];
  const stream = { getTracks: () => tracks, getAudioTracks: () => [tracks[1]] };
  let requests = 0, resolvePermission;
  const mediaDevices = { getUserMedia: () => {
    requests++;
    if (permission === 'deny') return Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    if (permission === 'pending') return new Promise(resolve => { resolvePermission = resolve; });
    return Promise.resolve(stream);
  } };
  let recognition, recognizedTrack, activities = 0;
  class Recognition { constructor() { recognition = this; } start(track) { recognizedTrack = track; } abort() {} }
  class AudioContext { createAnalyser() { return { fftSize: 0, getFloatTimeDomainData(samples) { samples.fill(0); } }; }
    createMediaStreamSource() { return { connect() {} }; } close() { return Promise.resolve(); } }
  let owner = 'profile-1';
  const control = createAstridCameraControl({ container,
    identity: () => ({ playerId: owner, dealerId: 'astrid', sessionRevision: 'session-1', roundRevision: '0' }),
    send: async () => true, mediaDevices, Recognition, AudioContextClass: AudioContext,
    canStart, onActivity: () => { activities++; },
    fetchImpl: async () => ({ json: async () => ({ enabled, profileRevision: 'a'.repeat(64) }) }),
  });
  return { control, root: container, tracks, listeners, stream, requests: () => requests,
    resolvePermission: () => resolvePermission(stream), changeOwner: () => { owner = 'profile-2'; },
    recognition: () => recognition, timeout: () => timeoutCallback?.(), playback,
    recognizedTrack: () => recognizedTrack, activities: () => activities,
    restore: () => { control.stop(); globalThis.document = priorDocument; globalThis.window = priorWindow; globalThis.setTimeout = priorSetTimeout; } };
}

test('feature off requests no device permission', async () => {
  const h = harness({ enabled: false });
  try { await tick(); find(h.root, 'Starta kamera och mikrofon').onclick(); await tick(); assert.equal(h.requests(), 0); }
  finally { h.restore(); }
});

test('denied permission and a late grant leave both tracks stopped', async () => {
  const denied = harness({ permission: 'deny' });
  try { await tick(); find(denied.root, 'Starta kamera och mikrofon').onclick(); await tick(); assert.equal(denied.control.active, false); }
  finally { denied.restore(); }
  const pending = harness({ permission: 'pending' });
  try {
    await tick(); find(pending.root, 'Starta kamera och mikrofon').onclick(); await tick();
    pending.control.stop('Profilbyte'); pending.resolvePermission(); await tick();
    assert.deepEqual(pending.tracks.map(track => track.stopped), [true, true]);
    assert.equal(pending.control.active, false);
  } finally { pending.restore(); }
});

test('pending permission has a usable Stop button and cannot start twice', async () => {
  const h = harness({ permission: 'pending' });
  try {
    await tick();
    const start = find(h.root, 'Starta kamera och mikrofon');
    start.onclick(); await tick(); start.onclick(); await tick();
    assert.equal(h.requests(), 1);
    const stop = find(h.root, 'Stoppa');
    assert.equal(stop.hidden, false);
    stop.onclick(); h.resolvePermission(); await tick();
    assert.equal(h.control.active, false);
    assert.deepEqual(h.tracks.map(track => track.stopped), [true, true]);
  } finally { h.restore(); }
});

test('permission timeout invalidates a late device grant', async () => {
  const h = harness({ permission: 'pending' });
  try {
    await tick(); find(h.root, 'Starta kamera och mikrofon').onclick(); await tick();
    h.timeout(); h.resolvePermission(); await tick();
    assert.equal(h.control.active, false);
    assert.deepEqual(h.tracks.map(track => track.stopped), [true, true]);
  } finally { h.restore(); }
});

test('hidden tab and profile change release video and audio tracks', async () => {
  for (const reason of ['hidden', 'profile']) {
    const h = harness();
    try {
      await tick(); find(h.root, 'Starta kamera och mikrofon').onclick(); await tick(); await tick();
      assert.equal(h.control.active, true);
      if (reason === 'hidden') { globalThis.document.hidden = true; h.listeners.get('visibilitychange')(); }
      else { h.changeOwner(); h.control.stop('Profilbyte'); }
      assert.deepEqual(h.tracks.map(track => track.stopped), [true, true]);
      assert.equal(h.control.active, false);
    } finally { h.restore(); }
  }
});

test('device error, timeout and navigation all release tracks', async () => {
  for (const reason of ['error', 'timeout', 'navigation']) {
    const h = harness();
    try {
      await tick(); find(h.root, 'Starta kamera och mikrofon').onclick(); await tick(); await tick();
      if (reason === 'error') h.recognition().onerror();
      if (reason === 'timeout') h.timeout();
      if (reason === 'navigation') h.listeners.get('pagehide')();
      assert.deepEqual(h.tracks.map(track => track.stopped), [true, true]);
      assert.equal(h.control.active, false);
    } finally { h.restore(); }
  }
});

test('speech uses the acquired microphone track and blocks Probe through review', async () => {
  let quiet = false;
  const h = harness({ canStart: () => quiet });
  try {
    await tick();
    const start = find(h.root, 'Starta kamera och mikrofon');
    start.onclick(); await tick(); assert.equal(h.requests(), 0);
    quiet = true; start.onclick(); await tick(); await tick();
    assert.equal(h.recognizedTrack(), h.stream.getAudioTracks()[0]);
    assert.equal(h.activities(), 1);
    assert.equal(h.control.busy, true);
    find(h.root, 'Stoppa').onclick();
    assert.equal(h.control.active, false);
    assert.equal(h.control.busy, true, 'review still suppresses automatic speech');
    find(h.root, 'Kassera').onclick();
    assert.equal(h.control.busy, false);
  } finally { h.restore(); }
});

test('late preview playback cannot reset a newer recording', async () => {
  const h = harness({ deferredPlayback: true });
  try {
    await tick();
    const start = find(h.root, 'Starta kamera och mikrofon');
    start.onclick(); await tick();
    h.control.stop();
    start.onclick(); await tick();
    assert.equal(h.playback.length, 2);
    h.playback[1](); await tick();
    assert.equal(h.control.active, true);
    h.playback[0](); await tick();
    assert.equal(h.control.active, true, 'stale play promise must leave the current recording alone');
  } finally { h.restore(); }
});
