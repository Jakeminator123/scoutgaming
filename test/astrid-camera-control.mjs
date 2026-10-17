import test from 'node:test';
import assert from 'node:assert/strict';
import { createAstridCameraControl } from '../web/public/astrid-camera-control.mjs';
import { createAstridWakeWord } from '../web/public/astrid-wake-word.mjs';
import { createSpeechPoseGate } from '../packages/presentation/runtime/speech-pose-gate.mjs';

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.hidden = false; this.textContent = ''; this.attributes = {}; this.listeners = new Map(); this.style = {}; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, fn) { this.listeners.set(name, fn); }
  pause() {} play() { return Promise.resolve(); } showModal() { this.open = true; } close() { this.open = false; }
}
const all = root => [root, ...root.children.flatMap(all)];
const tick = () => new Promise(resolve => setImmediate(resolve));
const event = values => ({ preventDefault() {}, ...values });
function harness({ config: initialConfig = {}, configFetch: initialConfigFetch, permission = 'allow', cameraPermission = 'allow',
  dealerId = 'astrid', dealerName = 'Astrid', cameraOptIn = true, wakeStart = () => true, canStart = () => true, deferredPlayback = false, useRealWake = false, enablePlayback,
  transcribe = async () => ({ ok: true, json: async () => ({ text: 'Hello Astrid' }) }), send = async () => true } = {}) {
  const globals = Object.fromEntries(['document', 'window', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'].map(name => [name, globalThis[name]]));
  const timers = new Map(), intervals = new Map(), listeners = new Map(); let timerId = 0;
  globalThis.setTimeout = (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  globalThis.setInterval = fn => { const id = ++timerId; intervals.set(id, fn); return id; };
  globalThis.clearInterval = id => intervals.delete(id);
  const playbackPromises = [];
  globalThis.document = { hidden: false, createElement: tag => {
    const node = new Element(tag);
    if (tag === 'video') { node.videoWidth = 640; node.videoHeight = 480; if (deferredPlayback) node.play = () => new Promise(resolve => playbackPromises.push(resolve)); }
    if (tag === 'canvas') { node.getContext = () => ({ drawImage() {} }); node.toDataURL = () => 'data:image/jpeg;base64,AAAA'; }
    return node;
  }, addEventListener: (name, fn) => listeners.set(name, fn) };
  globalThis.window = { addEventListener: (name, fn) => listeners.set(name, fn) };
  const root = new Element('div'), requests = [], streams = [], uploads = [], sent = [], wakes = [], recorders = [], logToggles = [], recognitions = [];
  class LocalRecognition {
    static async available() { return 'available'; }
    static async install() { return true; }
    constructor() { this.processLocally = false; this.started = false; this.aborted = false; recognitions.push(this); }
    start() { this.started = true; queueMicrotask(() => this.onstart?.()); }
    abort() { this.aborted = true; }
  }
  const permissionResolvers = []; let profile = 'one', configReads = 0, configFetch = initialConfigFetch, activity = 0, playbackEnabled = false, playbackToggles = 0, playbackEnables = 0;
  const base = { enabled: true, profileRevision: 'a'.repeat(64), transcription: { enabled: true, outputLanguage: 'en', acceptsAutoLanguage: true }, vision: { enabled: true } };
  let config = { ...base, ...initialConfig };
  const mediaDevices = { getUserMedia: constraints => {
    requests.push(constraints);
    const tracks = (constraints.video ? ['video'] : ['audio']).map(kind => ({ kind, stopped: false, stop() { this.stopped = true; }, addEventListener() {} }));
    const stream = { getTracks: () => tracks, getAudioTracks: () => tracks.filter(track => track.kind === 'audio') }; streams.push(stream);
    const behavior = constraints.video ? cameraPermission : permission;
    if (behavior === 'deny') return Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    if (behavior === 'pending') return new Promise(resolve => permissionResolvers.push(() => resolve(stream)));
    return Promise.resolve(stream);
  } };
  const control = createAstridCameraControl({ container: root, identity: () => ({ playerId: profile, dealerId, sessionRevision: 's1', roundRevision: '0' }), dealerName, wakeNames:[dealerName,dealerId],
    mediaDevices, AudioContextClass: class {}, canStart, onActivity: () => activity++,
    createWakeWord: options => {
      const instance = useRealWake ? createAstridWakeWord({ ...options, RecognitionClass: LocalRecognition })
        : { active: false, stops: 0, async start() { this.active = true; options.onStatus({ state: 'listening' }); return wakeStart(this); }, stop() { this.active = false; this.stops++; } };
      instance.options = options;
      wakes.push(instance); return instance;
    },
    createRecorder: async options => {
      const instance = { options, activated: false, discarded: false, stopped: false,
        activate() { if (this.stopped) return false; this.activated = true; return true; },
        stop(discard) { this.stopped = true; this.discarded ||= Boolean(discard); return discard ? null : new Uint8Array(100).fill(3); } };
      recorders.push(instance); return instance;
    },
    fetchImpl: async (url, init) => {
      if (url.endsWith('/transcription')) { uploads.push(init); return transcribe(init); }
      configReads++; return configFetch ? configFetch(init) : { ok: true, json: async () => config };
    },
    send: async input => { sent.push(input); return send(input); },
    onPlaybackToggle: () => { playbackEnabled = !playbackEnabled; playbackToggles++; control.refreshPlayback(); },
    onPlaybackEnable: () => { playbackEnables++; if (enablePlayback) enablePlayback(); playbackEnabled = true; control.refreshPlayback(); },
    getPlaybackEnabled: () => playbackEnabled,
    onLogToggle: value => logToggles.push(value),
  });
  const buttons = all(root).filter(node => node.tag === 'button'), [play, record] = buttons;
  const find = text => all(root).find(node => node.textContent === text);
  const dialog = all(root).find(node => node.tag === 'dialog'), debug = all(root).find(node => node.tag === 'section');
  const click = node => node.onclick(event());
  if (cameraOptIn) click(all(root).find(node => node.attributes['aria-label'] === 'Include optional camera images'));
  const fire = delay => { const entry = [...timers].find(([, timer]) => timer.delay === delay); assert.ok(entry, `missing ${delay} ms timer`); timers.delete(entry[0]); entry[1].fn(); };
  const start = async () => { await tick(); click(record); click(find('Enable voice')); await tick(); await tick(); };
  const startManual = async () => { await tick(); click(record); click(find('Record one message')); await tick(); await tick(); };
  const wake = async () => { const instance = wakes.at(-1); assert.equal(instance.options.canWake(), true); instance.stop(); instance.options.onWake(); await tick(); };
  const sample = (speaking, at) => recorders.at(-1).options.onSample({ speaking, at, rms: speaking ? 0.1 : 0 });
  const pause = () => { sample(true, 100); sample(true, 200); sample(false, 300); sample(false, 1450); };
  return { root, control, play, record, dialog, debug, find, click, start, startManual, wake, sample, pause, fire, wakes, recorders, requests, streams, uploads, sent, listeners, logToggles, playbackPromises, recognitions,
    status: () => all(root).find(node => node.attributes.role === 'status').textContent,
    log: () => all(root).find(node => node.tag === 'pre').textContent,
    activity: () => activity, configReads: () => configReads, playbackToggles: () => playbackToggles,
    playbackEnabled: () => playbackEnabled, playbackEnables: () => playbackEnables,
    resolvePermission: () => permissionResolvers.shift()(), changeOwner: () => { profile = 'two'; },
    setConfig: value => { config = { ...base, ...value }; }, setConfigFetch: value => { configFetch = value; },
    identityCheck: () => [...intervals.values()].forEach(fn => fn()),
    press: (button, kind, extra = {}) => button.listeners.get(kind)?.(event(extra)),
    restore: () => { control.stop(); for (const [name, value] of Object.entries(globals)) globalThis[name] = value; },
  };
}

test('page loads off with separate playback, microphone and camera controls; first Record requires explicit English consent', async () => {
  const h = harness();
  try {
    await tick(); assert.equal(h.control.active, false); assert.equal(h.control.busy, false);
    assert.equal(h.requests.length, 0); assert.equal(h.wakes.length, 0); assert.equal(h.debug.hidden, true);
    assert.equal(all(h.root).filter(node => node.tag === 'textarea' || node.tag === 'img').length, 0);
    h.click(h.record); assert.equal(h.dialog.hidden, false); assert.equal(h.wakes.length, 0);
    assert.ok(all(h.dialog).some(node => node.textContent?.includes('Nothing is uploaded before the wake word')));
    const consentText = all(h.dialog).map(node => node.textContent).join(' ');
    assert.match(consentText, /sent to OpenAI for speech translation into English/);
    assert.match(consentText, /English text is automatically sent to OpenClaw and its model provider/);
    assert.equal(consentText.includes('Cartesia'), false);
    h.click(h.find('Keep off')); assert.equal(h.control.active, false); assert.equal(h.requests.length, 0);
    h.click(h.record); h.click(h.find('Enable voice')); await tick();
    assert.equal(h.wakes.length, 1); assert.equal(h.requests.length, 1); assert.equal(h.requests[0].video, false);
    assert.equal(h.recorders[0].options.armed, true); assert.equal(h.recorders[0].options.preRollMs, 3000);
    assert.equal(h.recorders[0].activated, false); assert.equal(h.uploads.length, 0);
  } finally { h.restore(); }
});

test('Play only toggles Astrid playback and never requests recording consent or devices', async () => {
  const h = harness();
  try { await tick(); h.click(h.play); await tick(); assert.equal(h.playbackToggles(), 1); assert.equal(h.play.attributes['aria-pressed'], 'true'); assert.equal(h.dialog.hidden, true); assert.equal(h.requests.length, 0); }
  finally { h.restore(); }
});

test('explicit wake and manual voice activation clear saved mute before autosend reaches the real pose gate', async () => {
  for (const manual of [false, true]) {
    const identity = { dealerId: 'astrid', sessionRevision: 's1', roundRevision: '0' };
    let replies = 0;
    const gate = createSpeechPoseGate({ initialState: { ...identity, dealerPose: 'standard-idle', actionOwner: 'none',
      speechOwner: 'none', visible: true, muted: true, idlePresented: null },
      enqueue: work => Promise.resolve().then(() => work(new AbortController().signal)), onSpeech: async () => { replies++; } });
    const muted = gate.receive({ ...identity, jobId: 'before-activation', requestFingerprint: 'before' });
    assert.equal(muted.record.reason, 'muted', 'reproduces the original autosend rejection');
    const h = harness({ enablePlayback: () => gate.updateRendererState({ muted: false }, 'voice-enabled'),
      send: async input => {
        const jobId = `voice-${replies + 1}`;
        const received = gate.receive({ ...identity, jobId, requestFingerprint: jobId });
        if (received.record.status === 'cancelled') return false;
        gate.presentStandardIdle({ ...identity, presentationId: `idle-${jobId}` });
        gate.responseReady(jobId, { kind: 'generatedText', exactText: input.message });
        return (await received.completion).status === 'completed';
      } });
    try {
      await tick(); assert.equal(h.playbackEnabled(), false); assert.equal(h.playbackEnables(), 0);
      assert.equal(h.requests.length, 0);
      if (manual) await h.startManual(); else { await h.start(); await h.wake(); }
      assert.equal(h.playbackEnabled(), true); assert.equal(h.playbackEnables(), 1);
      h.pause(); await tick(); await tick();
      assert.equal(h.uploads.length, 1); assert.equal(h.sent.length, 1); assert.equal(replies, 1);
      assert.equal(h.playbackEnables(), 1, 'automatic rearming must not enable playback again');
      assert.equal(h.control.active, !manual);
    } finally { h.restore(); }
  }
});

test('muting after voice activation stops capture or translation and never autosends late audio', async () => {
  for (const stage of ['idle', 'capture', 'transcription']) {
    let translated;
    const h = harness({ transcribe: () => new Promise(resolve => { translated = resolve; }) });
    try {
      await h.start();
      if (stage !== 'idle') await h.wake();
      if (stage === 'transcription') { h.pause(); await tick(); }
      h.click(h.play); await tick();
      assert.equal(h.playbackEnabled(), false); assert.equal(h.control.active, false);
      assert.match(h.status(), /playback muted.*Voice off/);
      if (translated) translated({ ok: true, json: async () => ({ text: 'late transcript' }) });
      await tick();
      assert.equal(h.sent.length, 0); assert.equal(h.playbackEnables(), 1); assert.equal(h.wakes.length, 1);
      assert.ok(h.streams.every(stream => stream.getTracks().every(track => track.stopped)));
    } finally { h.restore(); }
  }
});

test('failed playback activation stops before microphone acquisition without exposing details', async () => {
  const h = harness({ enablePlayback: () => { throw Error('private exception'); } });
  try {
    await h.start(); assert.equal(h.control.active, false); assert.equal(h.requests.length, 0);
    assert.equal(h.uploads.length, 0); assert.equal(h.sent.length, 0);
    assert.match(h.status(), /playback could not be enabled/); assert.doesNotMatch(h.status(), /private/);
  } finally { h.restore(); }
});

test('wake idle does not block Probe; wake synchronously activates the same microphone buffer', async () => {
  const h = harness();
  try {
    await h.start(); assert.equal(h.control.active, true); assert.equal(h.control.busy, false); assert.equal(h.activity(), 0);
    const mic = h.streams[0], recorder = h.recorders[0], wake = h.wakes[0];
    wake.options.onWake(); assert.equal(recorder.activated, true); assert.equal(h.control.busy, true); assert.equal(wake.active, false);
    await tick(); assert.equal(h.requests.length, 2); assert.equal(h.requests[1].audio, false); assert.ok(h.requests[1].video);
    assert.equal(h.recorders.length, 1); assert.equal(recorder.options.stream, mic); assert.equal(h.activity(), 1);
    assert.equal(all(h.root).find(node => node.tag === 'video').hidden, true);
  } finally { h.restore(); }
});

test('1150 ms speech pause auto-transcribes and auto-sends once, then rearms local wake', async () => {
  const h = harness();
  try {
    await h.start(); await h.wake();
    h.sample(true, 100); h.sample(true, 200); h.sample(false, 300); h.sample(false, 1449);
    assert.equal(h.uploads.length, 0, 'must wait the full extra half second');
    h.sample(false, 1450); await tick(); assert.equal(h.uploads.length, 1);
    assert.ok(h.streams.slice(0, 2).every(stream => stream.getTracks().every(track => track.stopped)));
    await tick(); assert.equal(h.sent.length, 1); assert.equal(h.sent[0].message, 'Hello Astrid'); assert.equal(h.sent[0].voice, true);
    assert.equal(h.sent[0].images.length, 1); assert.equal(h.uploads[0].headers['X-Astrid-Language'], 'auto');
    assert.ok(h.uploads[0].body.every(value => value === 0));
    assert.equal(h.wakes.length, 2); assert.equal(h.control.busy, false); assert.equal(h.control.active, true);
    assert.equal(h.debug.hidden, true); assert.equal(h.log(), '');
  } finally { h.restore(); }
});

test('a short question entirely in pre-roll sends after fresh silence without replaying old pauses', async () => {
  const h = harness();
  try {
    await h.start(); await h.wake();
    h.recorders[0].options.onSample({ speaking: false, at: 0, preRollSpeech: true });
    h.sample(false, 100); h.sample(false, 1249);
    assert.equal(h.uploads.length, 0, 'the buffered phrase must not carry an old silence deadline');
    h.sample(false, 1250); await tick();
    assert.equal(h.uploads.length, 1); assert.equal(h.sent.length, 1);
    assert.equal(h.sent[0].message, 'Hello Astrid'); assert.equal(h.sent[0].images.length, 1);
    assert.equal(h.wakes.length, 2); assert.equal(h.control.busy, false);
  } finally { h.restore(); }
});

test('silent pre-roll does not invent speech or submit an empty turn', async () => {
  const h = harness();
  try {
    await h.start(); await h.wake();
    h.recorders[0].options.onSample({ speaking: false, at: 0, preRollSpeech: false });
    h.sample(false, 100); h.sample(false, 2000); h.fire(30000); await tick();
    assert.equal(h.uploads.length, 0); assert.equal(h.sent.length, 0); assert.equal(h.wakes.length, 2);
  } finally { h.restore(); }
});

test('audio-only model never requests camera or sends images, legacy vision config still works', async () => {
  for (const vision of [{ enabled: false, reason: 'model_not_verified' }, undefined]) {
    const h = harness({ config: { vision } });
    try {
      await h.start(); await h.wake(); h.pause(); await tick();
      assert.equal(h.sent[0].images.length, vision ? 0 : 1);
      assert.equal(h.requests.filter(request => request.video).length, vision ? 0 : 1);
      if (vision) assert.match(h.record.title, /GPT-5\.6 Terra or GPT-6 Luna/);
    } finally { h.restore(); }
  }
});

test('record toggles off and discards an unfinished utterance without upload', async () => {
  const h = harness();
  try {
    await h.start(); await h.wake(); h.sample(true, 100); h.click(h.record); await tick();
    assert.equal(h.control.active, false); assert.equal(h.uploads.length, 0); assert.equal(h.sent.length, 0);
    assert.ok(h.streams.every(stream => stream.getTracks().every(track => track.stopped)));
    assert.equal(h.recorders[0].discarded, true);
  } finally { h.restore(); }
});

test('stopping while STT is pending aborts it and suppresses late autosend and wake restart', async () => {
  let resolve;
  const h = harness({ transcribe: () => new Promise(done => { resolve = done; }) });
  try {
    await h.start(); await h.wake(); h.pause(); await tick(); assert.equal(h.control.busy, true);
    h.click(h.record); assert.equal(h.uploads[0].signal.aborted, true);
    resolve({ ok: true, json: async () => ({ text: 'late' }) }); await tick();
    assert.equal(h.sent.length, 0); assert.equal(h.wakes.length, 1); assert.equal(h.control.active, false);
  } finally { h.restore(); }
});

test('STT failure and invalid results send nothing and never automatically retry', async () => {
  for (const transcribe of [async () => { throw new Error('provider secret'); }, async () => ({ ok: false, status: 502 }),
    async () => ({ ok: true, json: async () => ({ text: null }) })]) {
    const h = harness({ transcribe });
    try {
      await h.start(); await h.wake(); h.pause(); await tick();
      assert.equal(h.sent.length, 0); assert.equal(h.wakes.length, 1); assert.equal(h.control.active, false);
      assert.match(h.status(), /Speech translation failed/); assert.equal(h.status().includes('secret'), false);
    } finally { h.restore(); }
  }
});

test('empty speech sends no images or text and returns to wake idle', async () => {
  const h = harness({ transcribe: async () => ({ ok: true, json: async () => ({ text: ' ' }) }) });
  try { await h.start(); await h.wake(); h.pause(); await tick(); assert.equal(h.sent.length, 0); assert.equal(h.wakes.length, 2); assert.equal(h.control.busy, false); }
  finally { h.restore(); }
});

test('OpenAI authentication failure shows a server-key action without exposing provider details or retrying', async () => {
  const h = harness({ transcribe: async () => ({ ok: false, status: 502,
    json: async () => ({ error: 'transcription_authentication_failed', message: 'private provider secret' }) }) });
  try {
    await h.start(); await h.wake(); h.pause(); await tick();
    assert.match(h.status(), /OpenAI authentication failed.*server translation key/);
    assert.equal(h.status().includes('secret'), false);
    assert.equal(h.uploads.length, 1); assert.equal(h.sent.length, 0);
    assert.equal(h.control.active, false); assert.equal(h.wakes.length, 1);
  } finally { h.restore(); }
});

test('wake failure cannot fall back to direct/cloud recording or loop retries', async () => {
  const h = harness({ wakeStart: instance => { instance.options.onError(Object.assign(new Error('private'), { code: 'network' })); return false; } });
  try { await h.start(); assert.equal(h.requests.length, 0); assert.equal(h.control.active, false); assert.equal(h.wakes.length, 1); assert.match(h.status(), /Local wake-word recognition failed/); }
  finally { h.restore(); }
});

test('wake failure offers manual recording but waits for a separate informed click', async () => {
  const h = harness({ wakeStart: () => false });
  try {
    await h.start();
    assert.equal(h.control.active, false); assert.equal(h.requests.length, 0); assert.equal(h.uploads.length, 0);
    assert.equal(h.dialog.hidden, false);
    assert.ok(all(h.dialog).some(node => node.textContent.includes('without a wake word')));
    h.click(h.find('Record one message')); await tick(); await tick();
    assert.equal(h.wakes.length, 1, 'manual recording must not construct another recognizer');
    assert.equal(h.recorders.at(-1).options.preRollMs, 0);
    assert.equal(h.recorders.at(-1).activated, true);
    h.pause(); await tick();
    assert.equal(h.uploads.length, 1); assert.equal(h.sent.length, 1);
    assert.equal(h.control.active, false); assert.equal(h.control.busy, false);
    assert.ok(h.streams.every(stream => stream.getTracks().every(track => track.stopped)));
  } finally { h.restore(); }
});

test('two explicit manual messages use Whisper and camera once each without wake or automatic rearming', async () => {
  const h = harness();
  try {
    await h.startManual();
    for (let turn = 1; turn <= 2; turn++) {
      assert.equal(h.wakes.length, 0); assert.equal(h.control.busy, true);
      h.pause(); await tick();
      assert.equal(h.uploads.length, turn); assert.equal(h.sent.length, turn);
      assert.equal(h.sent.at(-1).images.length, 1); assert.equal(h.sent.at(-1).message, 'Hello Astrid');
      assert.equal(h.uploads.at(-1).headers['X-Astrid-Language'], 'auto');
      assert.ok(h.uploads.at(-1).body.every(value => value === 0));
      assert.equal(h.control.active, false); assert.equal(h.control.busy, false);
      assert.ok(h.streams.every(stream => stream.getTracks().every(track => track.stopped)));
      if (turn === 1) { h.click(h.record); await tick(); await tick(); }
    }
  } finally { h.restore(); }
});

test('an early explicit manual recording continues after configuration arrives; wake still needs a fresh gesture', async () => {
  for (const manual of [true, false]) {
    let resolve;
    const configuration = new Promise(done => { resolve = done; });
    const h = harness({ configFetch: () => configuration });
    try {
      h.click(h.record); h.click(h.find(manual ? 'Record one message' : 'Enable voice'));
      assert.equal(h.requests.length, 0); assert.equal(h.control.active, true);
      h.setConfigFetch(null);
      resolve({ ok: true, json: async () => ({ enabled: true, profileRevision: 'a'.repeat(64),
        transcription: { enabled: true, outputLanguage: 'en', acceptsAutoLanguage: true }, vision: { enabled: true } }) });
      await tick(); await tick();
      if (manual) {
        assert.equal(h.control.active, true); assert.equal(h.control.busy, true);
        assert.equal(h.requests.length, 2); assert.equal(h.wakes.length, 0); assert.equal(h.recorders[0].activated, true);
        h.pause(); await tick();
        assert.equal(h.uploads.length, 1); assert.equal(h.sent.length, 1); assert.equal(h.control.active, false);
      } else {
        assert.equal(h.control.active, false); assert.equal(h.requests.length, 0); assert.equal(h.wakes.length, 0);
        assert.match(h.status(), /Press Record again to enable local listening/);
        h.click(h.record); assert.equal(h.wakes.length, 1); await tick();
      }
    } finally { h.restore(); }
  }
});

test('early manual consent cannot outlive cancellation, visibility, identity, turn availability or server disablement', async () => {
  for (const reason of ['cancel', 'hidden', 'identity', 'occupied', 'disabled']) {
    let resolve, available = true;
    const configuration = new Promise(done => { resolve = done; });
    const h = harness({ configFetch: () => configuration, canStart: () => available });
    try {
      h.click(h.record); h.click(h.find('Record one message'));
      if (reason === 'cancel') h.click(h.record);
      if (reason === 'hidden') globalThis.document.hidden = true;
      if (reason === 'identity') h.changeOwner();
      if (reason === 'occupied') available = false;
      h.setConfigFetch(null);
      resolve({ ok: true, json: async () => ({ enabled: reason !== 'disabled', profileRevision: 'a'.repeat(64),
        transcription: { enabled: true, outputLanguage: 'en', acceptsAutoLanguage: true }, vision: { enabled: true } }) });
      await tick(); await tick();
      assert.equal(h.control.active, false, reason); assert.equal(h.requests.length, 0, reason);
      assert.equal(h.wakes.length, 0); assert.equal(h.uploads.length, 0); assert.equal(h.sent.length, 0);
    } finally { h.restore(); }
  }
});

test('manual silence, cancellation and late permission never upload or start wake listening', async () => {
  for (const outcome of ['silence', 'cancel', 'late-permission', 'profile-change']) {
    const h = harness({ permission: outcome === 'late-permission' ? 'pending' : 'allow' });
    try {
      await h.startManual();
      assert.equal(h.control.busy, true, 'manual permission/capture reserves the voice turn');
      if (outcome === 'silence') { h.fire(30000); await tick(); }
      else if (outcome === 'profile-change') { h.changeOwner(); h.identityCheck(); }
      else h.click(h.record);
      if (outcome === 'late-permission') { h.resolvePermission(); await tick(); }
      assert.equal(h.control.active, false); assert.equal(h.uploads.length, 0); assert.equal(h.sent.length, 0);
      assert.equal(h.wakes.length, 0);
      assert.ok(h.streams.every(stream => stream.getTracks().every(track => track.stopped)));
    } finally { h.restore(); }
  }
});

test('manual recording respects unavailable translation and an occupied speech turn', async () => {
  for (const options of [{ config: { enabled: false, reason: 'feature_disabled' } }, { canStart: () => false }]) {
    const h = harness(options);
    try {
      await h.startManual(); assert.equal(h.requests.length, 0); assert.equal(h.uploads.length, 0);
      assert.equal(h.control.active, false); assert.equal(h.wakes.length, 0);
    } finally { h.restore(); }
  }
});

test('selecting Terra after the tab opened enables images on the next fresh voice turn without reloading', async () => {
  const h = harness({ config: { model: 'gateway-default', vision: { enabled: false, reason: 'model_not_verified' } } });
  try {
    await h.start();
    h.setConfig({ model: 'gpt-5.6-terra', vision: { enabled: true } });
    await h.wake(); h.pause(); await tick();
    assert.equal(h.requests.filter(request => request.video).length, 1);
    assert.equal(h.sent[0].images.length, 1);
  } finally { h.restore(); }
});

test('canWake stays false until local PCM buffer is ready and while Astrid is speaking', async () => {
  let quiet = false;
  const h = harness({ permission: 'pending', canStart: () => quiet });
  try {
    await h.start(); assert.equal(h.wakes[0].options.canWake(), false); assert.match(h.status(), /Preparing the local audio buffer/);
    h.resolvePermission(); await tick(); assert.equal(h.wakes[0].options.canWake(), false);
    quiet = true; assert.equal(h.wakes[0].options.canWake(), true);
  } finally { h.restore(); }
});

test('real wake module can start before the local buffer is ready and then trigger one voice turn', async () => {
  const h = harness({ permission: 'pending', useRealWake: true });
  try {
    await h.start();
    assert.equal(h.recognitions.length, 1); assert.equal(h.recognitions[0].started, true);
    assert.equal(h.recognitions[0].processLocally, true); assert.equal(h.requests.length, 1);
    assert.equal(h.wakes[0].options.canWake(), false); assert.match(h.status(), /Preparing the local audio buffer/);
    const recognition = h.recognitions[0];
    const early = [{ transcript: 'Astrid too early' }];
    recognition.onresult({ resultIndex: 0, results: [early] });
    assert.equal(h.control.busy, false); assert.equal(h.requests.length, 1);
    h.resolvePermission(); await tick();
    assert.equal(h.wakes[0].options.canWake(), true); assert.match(h.status(), /Listening locally/);
    recognition.onresult({ resultIndex: 1, results: [early, [{ transcript: 'Astrid hello' }]] });
    assert.equal(h.recorders[0].activated, true); assert.equal(recognition.aborted, true);
    await tick(); h.pause(); await tick();
    assert.equal(h.sent.length, 1); assert.equal(h.wakes.length, 2);
    assert.equal(h.recognitions[1].processLocally, true); assert.equal(h.recognitions[1].started, true);
  } finally { h.restore(); }
});

test('local wake starts directly in the consent click before permission or asynchronous config waits', async () => {
  const h = harness();
  try { await tick(); h.click(h.record); h.click(h.find('Enable voice')); assert.equal(h.wakes.length, 1); assert.equal(h.requests.length, 0); await tick(); }
  finally { h.restore(); }
});

test('pending permission cancellation and timeout stop late microphone grants', async () => {
  for (const timeout of [false, true]) {
    const h = harness({ permission: 'pending' });
    try {
      await h.start(); if (timeout) h.fire(30000); else h.click(h.record);
      h.resolvePermission(); await tick();
      assert.equal(h.control.active, false); assert.ok(h.streams[0].getTracks().every(track => track.stopped));
      assert.equal(h.recorders.length, 0);
    } finally { h.restore(); }
  }
});

test('camera permission failure keeps the already consented voice turn usable', async () => {
  const h = harness({ cameraPermission: 'deny' });
  try { await h.start(); await h.wake(); h.pause(); await tick(); assert.equal(h.sent.length, 1); assert.deepEqual(h.sent[0].images, []); }
  finally { h.restore(); }
});

test('visibility, navigation and identity changes stop idle wake and discard all audio buffers', async () => {
  for (const reason of ['hidden', 'pagehide', 'identity']) {
    const h = harness();
    try {
      await h.start();
      if (reason === 'hidden') { globalThis.document.hidden = true; h.listeners.get('visibilitychange')(); }
      else if (reason === 'pagehide') h.listeners.get('pagehide')();
      else { h.changeOwner(); h.identityCheck(); }
      assert.equal(h.control.active, false); assert.equal(h.wakes[0].active, false); assert.equal(h.recorders[0].discarded, true);
      assert.ok(h.streams[0].getTracks().every(track => track.stopped)); assert.equal(h.uploads.length, 0);
    } finally { h.restore(); }
  }
});

test('profile change during STT suppresses result and wake restart', async () => {
  let resolve; const h = harness({ transcribe: () => new Promise(done => { resolve = done; }) });
  try {
    await h.start(); await h.wake(); h.pause(); await tick(); h.changeOwner();
    resolve({ ok: true, json: async () => ({ text: 'wrong profile' }) }); await tick();
    assert.equal(h.sent.length, 0); assert.equal(h.control.active, false); assert.equal(h.wakes.length, 1);
  } finally { h.restore(); }
});

test('voice sending stays busy and only a successful send can resume wake', async () => {
  let resolve; const h = harness({ send: () => new Promise(done => { resolve = done; }) });
  try {
    await h.start(); await h.wake(); h.pause(); await tick(); assert.equal(h.control.busy, true); assert.equal(h.wakes.length, 1);
    resolve(false); await tick(); assert.equal(h.control.active, false); assert.equal(h.wakes.length, 1); assert.match(h.status(), /could not be completed/);
  } finally { h.restore(); }
});

test('five-second pointer hold on either button opens log and suppresses the following click', async () => {
  for (const which of ['play', 'record']) {
    const h = harness();
    try {
      await tick(); h.press(h[which], 'pointerdown', { button: 0 }); h.fire(5000);
      assert.equal(h.debug.hidden, false); h.press(h[which], 'pointerup'); h.click(h[which]); await tick();
      assert.equal(h.playbackToggles(), 0); assert.equal(h.dialog.hidden, true); assert.equal(h.wakes.length, 0);
      assert.deepEqual(h.logToggles, [true]);
      h.listeners.get('keydown')(event({ key: 'Escape' })); assert.equal(h.debug.hidden, true); assert.deepEqual(h.logToggles, [true, false]);
    } finally { h.restore(); }
  }
});

test('five-second Enter and Space holds suppress short keyboard actions', async () => {
  for (const key of ['Enter', ' ']) {
    const h = harness();
    try {
      await tick(); h.press(h.record, 'keydown', { key }); h.fire(5000); h.press(h.record, 'keyup', { key }); h.click(h.record); await tick();
      assert.equal(h.debug.hidden, false); assert.equal(h.dialog.hidden, true); assert.equal(h.wakes.length, 0);
    } finally { h.restore(); }
  }
});

test('short keyboard and pointer interactions perform just one action', async () => {
  const h = harness();
  try {
    await tick(); h.press(h.play, 'keydown', { key: 'Enter' }); h.press(h.play, 'keyup', { key: 'Enter' }); h.click(h.play); await tick();
    assert.equal(h.playbackToggles(), 1);
    h.press(h.play, 'pointerdown', { button: 0 }); h.press(h.play, 'pointerup'); h.click(h.play); await tick(); assert.equal(h.playbackToggles(), 2);
  } finally { h.restore(); }
});

test('English RAM log is bounded, hidden normally, and contains no raw audio or image data', async () => {
  const h = harness();
  try {
    await h.start(); for (let i = 0; i < 65; i++) h.wakes[0].options.onStatus({ state: 'rearming' });
    assert.equal(h.log(), ''); h.press(h.record, 'pointerdown', { button: 0 }); h.fire(5000);
    assert.ok(h.log().split('\n').length <= 40); assert.equal(h.log().includes('data:image'), false);
    assert.ok(h.control.debugContainer); assert.equal(h.control.active, true, 'long hold does not stop voice');
  } finally { h.restore(); }
});

test('precise config reasons survive stop and can recover from a later server change', async () => {
  for (const [config, expected] of [[{ enabled: false, reason: 'feature_disabled' }, /disabled on this server/],
    [{ transcription: { enabled: false }, reason: 'transcription_unavailable' }, /OpenAI speech translation is unavailable/]]) {
    const h = harness({ config });
    try {
      await tick(); assert.match(h.status(), expected); h.control.stop('Fliken dold'); assert.match(h.status(), expected);
      h.setConfig({}); h.click(h.record); await tick(); h.click(h.find('Enable voice')); await tick();
      assert.equal(h.control.active, true); assert.equal(h.uploads.length, 0);
    } finally { h.restore(); }
  }
});

test('legacy Cartesia settings cannot enable auto-send without English translation and auto-language capabilities', async () => {
  for (const transcription of [{ enabled: true }, { enabled: true, outputLanguage: 'en' },
    { enabled: true, acceptsAutoLanguage: true }, { enabled: true, outputLanguage: 'sv', acceptsAutoLanguage: true }]) {
    const h = harness({ config: { transcription } });
    try {
      await h.start();
      assert.equal(h.status(), 'English speech translation is not configured on this server.');
      assert.equal(h.control.active, false); assert.equal(h.wakes.length, 0); assert.equal(h.requests.length, 0);
      assert.equal(h.uploads.length, 0); assert.equal(h.sent.length, 0);
    } finally { h.restore(); }
  }
});

test('network/settings failures are precise, redacted and recover on log reopen', async () => {
  const h = harness({ configFetch: async () => { throw new Error('private token'); } });
  try {
    await tick(); assert.match(h.status(), /Cannot reach the server/); h.control.stop(); assert.match(h.status(), /Cannot reach the server/);
    h.setConfigFetch(null); h.press(h.record, 'pointerdown', { button: 0 }); h.fire(5000); await tick();
    assert.equal(h.status().includes('private'), false); assert.match(h.status(), /Voice off/);
  } finally { h.restore(); }
});

test('fresh post-wake config can remove images and reject disabled transcription before uploads', async () => {
  for (const config of [{ vision: { enabled: false } }, { enabled: false, reason: 'feature_disabled' }]) {
    const h = harness();
    try {
      await h.start(); h.setConfig(config); await h.wake();
      if (config.enabled === false) { assert.equal(h.control.active, false); assert.equal(h.uploads.length, 0); }
      else { h.pause(); await tick(); assert.deepEqual(h.sent[0].images, []); }
      assert.equal(h.requests.filter(request => request.video).length, 0);
    } finally { h.restore(); }
  }
});

test('a finished buffered phrase waits for fresh configuration before any upload and respects stop', async () => {
  for (const outcome of ['enabled', 'disabled', 'stop']) {
    let resolve, request;
    const h = harness();
    try {
      await h.start();
      h.setConfigFetch(init => { request = init; return new Promise(done => { resolve = done; }); });
      await h.wake();
      h.recorders[0].options.onSample({ speaking: false, at: 0, preRollSpeech: true });
      h.sample(false, 100); h.sample(false, 1250); await tick();
      assert.equal(h.uploads.length, 0); assert.equal(h.control.busy, true);
      assert.ok(h.streams[0].getTracks().every(track => track.stopped));
      if (outcome === 'stop') { h.click(h.record); assert.equal(request.signal.aborted, true); }
      resolve({ ok: true, json: async () => ({ enabled: outcome !== 'disabled', reason: outcome === 'disabled' ? 'feature_disabled' : null,
        profileRevision: 'a'.repeat(64), transcription: { enabled: true, outputLanguage: 'en', acceptsAutoLanguage: true }, vision: { enabled: true } }) });
      await tick();
      assert.equal(h.uploads.length, outcome === 'enabled' ? 1 : 0);
      assert.equal(h.sent.length, outcome === 'enabled' ? 1 : 0);
      assert.equal(h.requests.filter(constraints => constraints.video).length, 0, 'no camera may start after the utterance ended');
      if (outcome !== 'enabled') assert.equal(h.control.active, false);
    } finally { h.restore(); }
  }
});

test('a late old camera preview cannot interrupt the next voice session', async () => {
  const h = harness({ deferredPlayback: true });
  try {
    await h.start(); await h.wake(); assert.equal(h.playbackPromises.length, 1);
    h.click(h.record); h.click(h.record); await tick(); await h.wake(); assert.equal(h.playbackPromises.length, 2);
    h.playbackPromises[1](); await tick(); h.playbackPromises[0](); await tick();
    assert.equal(h.control.active, true); assert.equal(h.control.busy, true);
  } finally { h.restore(); }
});

test('all base and registered dealers use their own wake names, context and transcription dealer',async()=>{
  for(const dealerId of ['vera','astrid','amira','mei','paow','dragge']) {
    const dealerName=dealerId[0].toUpperCase()+dealerId.slice(1),h=harness({dealerId,dealerName,cameraOptIn:false});
    try {
      await h.start();assert.deepEqual(h.wakes[0].options.wakeNames,[dealerName,dealerId]);
      await h.wake();h.pause();await tick();await tick();
      assert.equal(h.uploads[0].headers['X-Astrid-Dealer'],dealerId);assert.equal(h.sent[0].images.length,0);
      assert.equal(h.requests.filter(request=>request.video).length,0);
    } finally {h.restore();}
  }
});
test('ordinary listening status stays visible and explains busy suppression then recovery',async()=>{
  let ready=true;const h=harness({canStart:()=>ready,cameraOptIn:false});
  try {
    await h.start();const status=all(h.root).find(node=>node.attributes.role==='status');assert.equal(status.hidden,false);
    ready=false;h.identityCheck();assert.match(h.status(),/paused while the dealer replies/);assert.equal(h.wakes.at(-1).options.canWake(),false);
    ready=true;h.identityCheck();assert.match(h.status(),/Listening locally for Astrid/);assert.equal(h.wakes.at(-1).options.canWake(),true);
  } finally {h.restore();}
});
