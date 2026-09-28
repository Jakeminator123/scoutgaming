import test from 'node:test';
import assert from 'node:assert/strict';
import { createAstridCameraControl } from '../web/public/astrid-camera-control.mjs';

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.hidden = false; this.value = ''; this.listeners = new Map(); this.style = {}; this.attributes = {}; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
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
const collect = root => [root, ...root.children.flatMap(collect)];
const startButton = root => find(root, 'Starta kamera och mikrofon') || find(root, 'Starta mikrofon');
const statusText = root => collect(root).find(element => element.attributes.role === 'status').textContent;
function harness({ enabled = true, transcriptionEnabled = true, permission = 'allow', deferredPlayback = false,
  config: initialConfig = {}, configFetch: initialConfigFetch = null,
  canStart = () => true, transcribe = async () => ({ ok: true, json: async () => ({ text: 'Hej Astrid' }) }) } = {}) {
  const priorDocument = globalThis.document, priorWindow = globalThis.window;
  const priorSetTimeout = globalThis.setTimeout;
  let timeoutCallback;
  globalThis.setTimeout = (fn, delay, ...args) => delay === 30000 ? (timeoutCallback = fn, 987654321) : priorSetTimeout(fn, delay, ...args);
  const listeners = new Map(), playback = [], constraints = [], sentMessages = [];
  let videoPlays = 0, configReads = 0, configFetch = initialConfigFetch;
  const defaultConfig = { enabled, profileRevision: 'a'.repeat(64), transcription: { enabled: transcriptionEnabled } };
  let config = { ...defaultConfig, ...initialConfig };
  globalThis.document = { hidden: false, createElement: tag => {
    const element = new Element(tag);
    if (tag === 'video') { element.videoWidth = 640; element.videoHeight = 480; }
    if (tag === 'canvas') { element.getContext = () => ({ drawImage() {} }); element.toDataURL = () => 'data:image/jpeg;base64,AAAA'; }
    if (tag === 'video') element.play = () => { videoPlays++; return deferredPlayback ? new Promise(resolve => playback.push(resolve)) : Promise.resolve(); };
    return element;
  }, addEventListener: (name, fn) => listeners.set(name, fn) };
  globalThis.window = { addEventListener: (name, fn) => listeners.set(name, fn) };
  const container = new Element('div');
  const tracks = [{ stopped: false, stop() { this.stopped = true; }, addEventListener() {} },
    { stopped: false, stop() { this.stopped = true; }, addEventListener() {} }];
  const stream = { getTracks: () => tracks, getAudioTracks: () => [tracks[1]] };
  let requests = 0, resolvePermission;
  const mediaDevices = { getUserMedia: options => {
    requests++; constraints.push(options);
    if (permission === 'deny') return Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    if (permission === 'pending') return new Promise(resolve => { resolvePermission = resolve; });
    return Promise.resolve(stream);
  } };
  let recording, recordedStream, activities = 0, sent = 0;
  const uploads = [];
  const createRecorder = async options => {
    recording = options; recordedStream = options.stream;
    return { stop: discard => discard ? null : new Uint8Array(100) };
  };
  let owner = 'profile-1';
  const control = createAstridCameraControl({ container,
    identity: () => ({ playerId: owner, dealerId: 'astrid', sessionRevision: 'session-1', roundRevision: '0' }),
    send: async message => { sent++; sentMessages.push(message); return true; }, mediaDevices, createRecorder, AudioContextClass: class {},
    canStart, onActivity: () => { activities++; },
    fetchImpl: async (url, init) => {
      if (url.endsWith('/transcription')) { uploads.push(init); return transcribe(init); }
      configReads++;
      if (configFetch) return configFetch();
      return { ok: true, json: async () => config };
    },
  });
  return { control, root: container, tracks, listeners, stream, requests: () => requests,
    constraints, sentMessages, videoPlays: () => videoPlays, configReads: () => configReads,
    setConfig: value => { config = { ...defaultConfig, ...value }; }, setConfigFetch: value => { configFetch = value; },
    toggle: open => { const details = container.children[0]; details.open = open; details.listeners.get('toggle')(); },
    resolvePermission: () => resolvePermission(stream), changeOwner: () => { owner = 'profile-2'; },
    recording: () => recording, timeout: () => timeoutCallback?.(), playback, uploads, sent: () => sent,
    recordedStream: () => recordedStream, activities: () => activities,
    restore: () => { control.stop(); globalThis.document = priorDocument; globalThis.window = priorWindow; globalThis.setTimeout = priorSetTimeout; } };
}

test('feature off requests no device permission', async () => {
  const h = harness({ enabled: false });
  try { await tick(); startButton(h.root).onclick(); await tick(); assert.equal(h.requests(), 0); }
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
      if (reason === 'error') h.recording().onError();
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
    assert.equal(h.recordedStream(), h.stream);
    assert.equal(h.activities(), 1);
    assert.equal(h.control.busy, true);
    find(h.root, 'Stoppa').onclick();
    assert.equal(h.control.active, false);
    assert.equal(h.control.busy, true, 'review still suppresses automatic speech');
    find(h.root, 'Kassera').onclick();
    assert.equal(h.control.busy, false);
  } finally { h.restore(); }
});

test('unconfigured server transcription never requests the devices', async () => {
  const h = harness({ transcriptionEnabled: false });
  try { await tick(); find(h.root, 'Starta kamera och mikrofon').onclick(); await tick(); assert.equal(h.requests(), 0); }
  finally { h.restore(); }
});

test('speech uploads only after devices stop, then requires manual review and send', async () => {
  let resolveTranscription;
  const h = harness({ transcribe: () => new Promise(resolve => { resolveTranscription = resolve; }) });
  try {
    await tick(); find(h.root, 'Starta kamera och mikrofon').onclick(); await tick();
    h.recording().onSample({ rms: 0.1, speaking: true, at: 200 });
    find(h.root, 'Stoppa').onclick();
    assert.deepEqual(h.tracks.map(track => track.stopped), [true, true]);
    assert.equal(h.uploads.length, 1); assert.equal(h.sent(), 0);
    assert.equal(h.uploads[0].headers['X-Astrid-Language'], 'sv');
    assert.equal(h.uploads[0].headers['X-Astrid-Profile-Revision'], 'a'.repeat(64));
    assert.equal(find(h.root, 'Skicka till Astrid').disabled, true);
    find(h.root, 'Skicka till Astrid').onclick(); assert.equal(h.sent(), 0);
    assert.equal(h.control.busy, true);
    resolveTranscription({ ok: true, json: async () => ({ text: 'Hej Astrid' }) }); await tick();
    assert.equal(find(h.root, 'Skicka till Astrid').disabled, false);
    assert.equal(h.sent(), 0, 'successful transcription is not consent to chat');
    await find(h.root, 'Skicka till Astrid').onclick(); assert.equal(h.sent(), 1);
    assert.equal(h.control.busy, false);
    assert.ok(h.uploads[0].body.every(byte => byte === 0), 'transient PCM buffer erased after request');
  } finally { h.restore(); }
});

test('discard cancels transcription and ignores its late response', async () => {
  let resolveTranscription;
  const h = harness({ transcribe: () => new Promise(resolve => { resolveTranscription = resolve; }) });
  try {
    await tick(); find(h.root, 'Starta kamera och mikrofon').onclick(); await tick();
    h.recording().onSample({ rms: 0.1, speaking: true, at: 200 });
    find(h.root, 'Stoppa').onclick(); find(h.root, 'Kassera').onclick();
    assert.equal(h.uploads[0].signal.aborted, true);
    resolveTranscription({ ok: true, json: async () => ({ text: 'late private text' }) }); await tick();
    assert.equal(h.control.busy, false); assert.equal(h.sent(), 0);
    assert.ok(h.uploads[0].body.every(byte => byte === 0));
  } finally { h.restore(); }
});

test('silence does not upload audio and empty transcription removes candidate pictures', async () => {
  const silent = harness();
  try {
    await tick(); find(silent.root, 'Starta kamera och mikrofon').onclick(); await tick();
    find(silent.root, 'Stoppa').onclick(); await tick(); assert.equal(silent.uploads.length, 0);
  } finally { silent.restore(); }
  const h = harness({ transcribe: async () => ({ ok: true, json: async () => ({ text: '' }) }) });
  try {
    await tick(); find(h.root, 'Starta kamera och mikrofon').onclick(); await tick();
    h.recording().onSample({ rms: 0.1, speaking: true, at: 200 });
    find(h.root, 'Stoppa').onclick(); await tick();
    const collect = root => [root, ...root.children.flatMap(collect)];
    assert.equal(collect(h.root).filter(node => node.tag === 'img').length, 0);
    assert.equal(h.sent(), 0);
  } finally { h.restore(); }
});

test('profile change while transcription is pending discards a valid late transcript', async () => {
  let resolveTranscription;
  const h = harness({ transcribe: () => new Promise(resolve => { resolveTranscription = resolve; }) });
  try {
    await tick(); find(h.root, 'Starta kamera och mikrofon').onclick(); await tick();
    h.recording().onSample({ rms: 0.1, speaking: true, at: 200 });
    find(h.root, 'Stoppa').onclick(); h.changeOwner();
    resolveTranscription({ ok: true, json: async () => ({ text: 'wrong profile' }) }); await tick();
    assert.equal(h.control.busy, false); assert.equal(h.sent(), 0);
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

test('audio remains available without vision, requests no camera and sends only reviewed text', async () => {
  const h = harness({ config: { vision: { enabled: false, reason: 'model_not_verified' } } });
  try {
    await tick();
    assert.equal(startButton(h.root).textContent, 'Starta mikrofon');
    assert.equal(startButton(h.root).disabled, false);
    assert.ok(collect(h.root).some(node => node.textContent?.includes('Bild kräver GPT-6 Luna.')));
    startButton(h.root).onclick(); await tick();
    assert.equal(h.constraints[0].video, false); assert.ok(h.constraints[0].audio);
    assert.equal(h.videoPlays(), 0);
    assert.equal(collect(h.root).find(node => node.tag === 'video').hidden, true);
    h.recording().onSample({ rms: 0.1, speaking: true, at: 200 });
    find(h.root, 'Stoppa').onclick(); await tick();
    assert.equal(h.uploads.length, 1);
    assert.equal(collect(h.root).filter(node => node.tag === 'img').length, 0);
    assert.equal(statusText(h.root), 'Granska texten och välj Skicka till Astrid');
    assert.equal(h.sent(), 0);
    await find(h.root, 'Skicka till Astrid').onclick();
    assert.deepEqual(h.sentMessages[0], { message: 'Hej Astrid', images: [], profileRevision: 'a'.repeat(64) });
  } finally { h.restore(); }
});

test('legacy config without vision still enables the existing camera path', async () => {
  const h = harness();
  try {
    await tick(); assert.equal(startButton(h.root).textContent, 'Starta kamera och mikrofon');
    startButton(h.root).onclick(); await tick();
    assert.equal(typeof h.constraints[0].video, 'object'); assert.equal(h.videoPlays(), 1);
  } finally { h.restore(); }
});

test('feature and transcription blockers remain precise after visibility, reset and closing panel', async () => {
  for (const [config, expected] of [
    [{ enabled: false, reason: 'feature_disabled' }, /bild och ljud är avstängt på servern/],
    [{ enabled: true, transcription: { enabled: false }, reason: 'transcription_unavailable' }, /serverns transkription är inte tillgänglig/],
  ]) {
    const h = harness({ config });
    try {
      await tick(); assert.match(statusText(h.root), expected); assert.equal(startButton(h.root).disabled, true);
      globalThis.document.hidden = true; h.listeners.get('visibilitychange')(); assert.match(statusText(h.root), expected);
      globalThis.document.hidden = false; h.control.stop('Profilbyte'); assert.match(statusText(h.root), expected);
      h.toggle(false); assert.match(statusText(h.root), expected);
      assert.equal(h.requests(), 0);
    } finally { h.restore(); }
  }
});

test('opening panel reloads changed settings and recovers the disabled start button without polling', async () => {
  const h = harness({ config: { enabled: false, reason: 'feature_disabled' } });
  try {
    await tick(); assert.equal(h.configReads(), 1); assert.equal(startButton(h.root).disabled, true);
    h.setConfig({ enabled: true, vision: { enabled: false, reason: 'model_not_verified' } });
    h.toggle(true); await tick();
    assert.equal(h.configReads(), 2); assert.equal(startButton(h.root).disabled, false);
    assert.equal(startButton(h.root).textContent, 'Starta mikrofon');
    h.toggle(false); h.setConfig({ enabled: true, vision: { enabled: true } });
    h.toggle(true); await tick();
    assert.equal(h.configReads(), 3); assert.equal(startButton(h.root).textContent, 'Starta kamera och mikrofon');
    await tick(); await tick(); assert.equal(h.configReads(), 3); assert.equal(h.requests(), 0);
  } finally { h.restore(); }
});

test('opening panel never reloads settings during recording, transcription or draft review', async () => {
  let resolveTranscription;
  const h = harness({ transcribe: () => new Promise(resolve => { resolveTranscription = resolve; }) });
  try {
    await tick(); startButton(h.root).onclick(); await tick();
    const reads = h.configReads(); h.toggle(true); await tick();
    assert.equal(h.configReads(), reads); assert.equal(h.control.active, true);
    assert.equal(h.tracks.some(track => track.stopped), false);
    h.recording().onSample({ rms: 0.1, speaking: true, at: 200 });
    find(h.root, 'Stoppa').onclick();
    h.toggle(true); await tick(); assert.equal(h.configReads(), reads);
    resolveTranscription({ ok: true, json: async () => ({ text: 'Keep this draft' }) }); await tick();
    const input = collect(h.root).find(node => node.tag === 'textarea'); input.value = 'Edited draft';
    const previousStatus = statusText(h.root);
    h.setConfig({ enabled: false, reason: 'feature_disabled' }); h.toggle(true); await tick();
    assert.equal(h.configReads(), reads); assert.equal(input.value, 'Edited draft');
    assert.equal(statusText(h.root), previousStatus); assert.equal(h.control.busy, true);
  } finally { h.restore(); }
});

test('network failure explains the blocker and panel reopening can recover', async () => {
  const h = harness({ configFetch: async () => { throw new TypeError('private connection detail'); } });
  try {
    await tick(); assert.match(statusText(h.root), /kunde inte nå servern/);
    assert.equal(startButton(h.root).disabled, true);
    h.control.stop(); assert.match(statusText(h.root), /kunde inte nå servern/);
    assert.equal(statusText(h.root).includes('private connection detail'), false);
    h.setConfigFetch(null); h.toggle(true); await tick();
    assert.equal(startButton(h.root).disabled, false); assert.match(statusText(h.root), /inget tillstånd begärt/);
  } finally { h.restore(); }
});

test('HTTP and malformed settings have distinct persistent errors', async () => {
  for (const [response, expected] of [
    [{ ok: false, status: 503 }, /HTTP 503/],
    [{ ok: false, status: 401 }, /sessionen har gått ut/],
    [{ ok: true, json: async () => ({ enabled: true, profileRevision: 'invalid' }) }, /ogiltigt inställningssvar/],
  ]) {
    const h = harness({ configFetch: async () => response });
    try { await tick(); assert.match(statusText(h.root), expected); h.control.stop(); assert.match(statusText(h.root), expected); }
    finally { h.restore(); }
  }
});

test('late settings response cannot replace the newer capability or blocker', async () => {
  const h = harness(); let resolveOld;
  try {
    await tick(); h.setConfigFetch(() => new Promise(resolve => { resolveOld = resolve; }));
    h.toggle(true); h.toggle(false);
    h.setConfigFetch(null); h.setConfig({ enabled: true, vision: { enabled: false, reason: 'model_not_verified' } });
    h.toggle(true); await tick(); assert.equal(startButton(h.root).textContent, 'Starta mikrofon');
    resolveOld({ ok: false, status: 503 }); await tick();
    assert.equal(startButton(h.root).disabled, false); assert.equal(startButton(h.root).textContent, 'Starta mikrofon');
    assert.match(statusText(h.root), /mikrofonen är tillgänglig/);
  } finally { h.restore(); }
});

test('fresh settings can remove camera access but cannot add it after a microphone-only click', async () => {
  for (const before of [false, true]) {
    const h = harness({ config: { vision: { enabled: before } } });
    try {
      await tick(); h.setConfig({ vision: { enabled: !before } });
      startButton(h.root).onclick(); await tick();
      assert.equal(h.constraints[0].video, false); assert.equal(h.videoPlays(), 0);
    } finally { h.restore(); }
  }
});

test('config network failure on Start preserves its cause and requests no microphone', async () => {
  const h = harness();
  try {
    await tick(); h.setConfigFetch(async () => { throw new TypeError('offline'); });
    startButton(h.root).onclick(); await tick();
    assert.equal(h.requests(), 0); assert.equal(h.control.active, false);
    assert.equal(startButton(h.root).disabled, true); assert.match(statusText(h.root), /kunde inte nå servern/);
    h.control.stop('Av'); assert.match(statusText(h.root), /kunde inte nå servern/);
  } finally { h.restore(); }
});
